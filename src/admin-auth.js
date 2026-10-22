import {createHmac,createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {loginPage} from './admin-views.js';

const SESSION='__Host-yjbest_admin_session',LOGIN='__Host-yjbest_admin_login';
const lifetime=8*60*60;
const digest=value=>createHash('sha256').update(String(value)).digest();
const equal=(a,b)=>timingSafeEqual(digest(a),digest(b));
const cookie=(name,value,seconds)=>`${name}=${value}; Path=/; Max-Age=${seconds}; HttpOnly; Secure; SameSite=Lax`;
function cookies(request){return Object.fromEntries((request.headers.get('cookie')??'').split(';').map(pair=>{const index=pair.indexOf('=');return [pair.slice(0,index).trim(),pair.slice(index+1).trim()];}));}
function safeNext(value){return typeof value==='string'&&value.startsWith('/admin/')&&!/[\\\r\n]/.test(value)&&!/^\/admin\/(?:login|logout)(?:\/|\?|$)/.test(value)?value:'/admin/';}
const redirect=location=>new Response(null,{status:303,headers:{Location:location,'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}});
const problem=(message,status)=>Response.json({error:{message},errors:[message]},{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}});
function key(env){return createHmac('sha256',env.ADMIN_PASSWORD).update('yjbest:admin-session:v1:'+(env.ADMIN_USERNAME||'admin')).digest();}
function sign(payload,env){const encoded=Buffer.from(JSON.stringify(payload)).toString('base64url');return encoded+'.'+createHmac('sha256',key(env)).update(encoded).digest('base64url');}
function verify(value,env,now,scope='session'){
  try{
    if(!value||value.length>2048)return null;
    const parts=value.split('.');if(parts.length!==2)return null;
    const signature=createHmac('sha256',key(env)).update(parts[0]).digest('base64url');
    if(!equal(parts[1],signature))return null;
    const p=JSON.parse(Buffer.from(parts[0],'base64url').toString());
    if(p.scope!==scope||(scope==='session'&&p.u!==(env.ADMIN_USERNAME||'admin'))||!Number.isInteger(p.exp)||!Number.isInteger(p.iat)||p.exp<=now||p.iat>now+30||p.exp-p.iat>lifetime||!/^[\w-]{43}$/.test(p.n))return null;
    return p;
  }catch{return null;}
}
const freshNonce=()=>randomBytes(32).toString('base64url');

export function createAdminAccess({now=()=>Date.now(),audit=entry=>console.info(JSON.stringify(entry))}={}){
  // Per-instance backoff complements the hosting firewall; it is not a distributed rate limiter.
  const attempts=new Map();
  return async(request,env)=>{
    const url=new URL(request.url),path=url.pathname;
    const stamp=Math.floor(now()/1000),jar=cookies(request),configured=Boolean(env.ADMIN_PASSWORD);
    const session=configured?verify(jar[SESSION],env,stamp):null;
    if(!/^\/admin(?:\/|$)/.test(path)&&!path.startsWith('/api/'))return {context:path.startsWith('/media/')&&session?{ADMIN_AUTHENTICATED:true}:{}};
    if(path==='/admin/login')return {response:new Response(null,{status:308,headers:{Location:'/admin/login/'}})};
    if(path==='/admin/login/'){
      if(!['GET','HEAD','POST'].includes(request.method))return {response:new Response(null,{status:405,headers:{Allow:'GET, HEAD, POST'}})};
      if(!configured)return {response:loginPage({configured:false,status:503})};
      const render=(error='',status=200,next=safeNext(url.searchParams.get('next')))=>{
        const nonce=sign({scope:'login',iat:stamp,exp:stamp+600,n:freshNonce()},env);
        const response=loginPage({csrf:nonce,error,next,status});response.headers.append('Set-Cookie',cookie(LOGIN,nonce,600));return {response};
      };
      if(request.method!=='POST')return session?{response:redirect(safeNext(url.searchParams.get('next')))}:render();
      if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return {response:problem('로그인 화면에서 다시 시도해주세요.',403)};
      if(Number(request.headers.get('content-length')??0)>8192)return {response:problem('요청 크기가 너무 큽니다.',413)};
      const raw=await request.text();if(raw.length>8192)return {response:problem('요청 크기가 너무 큽니다.',413)};
      const form=new URLSearchParams(raw),next=safeNext(form.get('next'));
      if(!jar[LOGIN]||!equal(form.get('csrf')??'',jar[LOGIN])||!verify(jar[LOGIN],env,stamp,'login'))return render('로그인 화면이 만료되었습니다. 다시 로그인해주세요.',403,next);
      const actor=digest(request.headers.get('x-forwarded-for')?.split(',')[0]??'unknown').toString('hex');
      for(const [id,entry] of attempts)if(entry.until<=stamp)attempts.delete(id);
      if(attempts.size>2000)attempts.delete(attempts.keys().next().value);
      const entry=attempts.get(actor)??{count:0,until:stamp+900};
      if(entry.count>=8){const result=render('로그인 시도가 많습니다. 잠시 후 다시 시도해주세요.',429,next);result.response.headers.set('Retry-After',String(entry.until-stamp));return result;}
      const user=form.get('username')?.trim()??'',password=form.get('password')??'';
      const userMatches=equal(user,env.ADMIN_USERNAME||'admin'),passwordMatches=equal(password,env.ADMIN_PASSWORD);
      if(!userMatches||!passwordMatches){entry.count++;attempts.set(actor,entry);audit({event:'admin_login',success:false,reason:'invalid_credentials'});return render('아이디 또는 비밀번호를 확인해주세요.',401,next);}
      attempts.delete(actor);audit({event:'admin_login',success:true});
      const token=sign({scope:'session',u:env.ADMIN_USERNAME||'admin',iat:stamp,exp:stamp+lifetime,n:freshNonce()},env);
      const response=redirect(next);response.headers.append('Set-Cookie',cookie(SESSION,token,lifetime));response.headers.append('Set-Cookie',cookie(LOGIN,'',0));return {response};
    }
    if(!configured)return {response:loginPage({configured:false,status:503})};
    if(!session){
      if(path.startsWith('/api/'))return {response:problem('로그인이 만료되었습니다. 다시 로그인해주세요.',401)};
      return {response:redirect('/admin/login/?next='+encodeURIComponent(safeNext(path+url.search)))};
    }
    if(request.method==='POST'){
      if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return {response:problem('같은 사이트의 관리 화면에서 다시 시도해주세요.',403)};
      if(Number(request.headers.get('content-length')??0)>3500000)return {response:problem('요청 크기가 너무 큽니다.',413)};
      const raw=await request.clone().text();if(raw.length>3500000)return {response:problem('요청 크기가 너무 큽니다.',413)};
      const csrf=request.headers.get('x-csrf-token')??new URLSearchParams(raw).get('csrf');
      if(!csrf||!equal(csrf,session.n))return {response:problem('화면을 새로고침한 후 다시 시도해주세요.',403)};
    }
    if(path==='/admin/logout/'){
      if(request.method!=='POST')return {response:new Response(null,{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}})};
      const response=redirect('/admin/login/');response.headers.append('Set-Cookie',cookie(SESSION,'',0));response.headers.append('Set-Cookie',cookie(LOGIN,'',0));return {response};
    }
    return {context:{ADMIN_AUTHENTICATED:true,CSRF_TOKEN:session.n,ADMIN_USERNAME:env.ADMIN_USERNAME||'admin'}};
  };
}
