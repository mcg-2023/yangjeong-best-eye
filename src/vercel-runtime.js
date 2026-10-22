import {createHash,timingSafeEqual} from 'node:crypto';
import {createApp} from './app.js';
import {createSupabaseDatabase} from './supabase-database.js';

const hash=value=>createHash('sha256').update(value).digest();
function adminAuthorized(request,env){
  const value=request.headers.get('authorization')??'';
  if(!/^Basic /i.test(value)||!env.ADMIN_PASSWORD)return false;
  const received=Buffer.from(value.slice(6),'base64').toString('utf8');
  return timingSafeEqual(hash(received),hash((env.ADMIN_USERNAME||'admin')+':'+env.ADMIN_PASSWORD));
}
export function createVercelHandler({environment=()=>process.env,fetchImpl=fetch}={}){
  const app=createApp();
  return async request=>{
    const env=environment(),path=new URL(request.url).pathname;
    const admin=path.startsWith('/admin')||path.startsWith('/api/');
    const denied=(text,status,extra={})=>new Response(text,{status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex',...extra}});
    if(admin&&!env.ADMIN_PASSWORD)return denied('관리자 로그인 설정이 필요합니다.',503);
    if(admin&&!adminAuthorized(request,env))return denied('관리자 로그인이 필요합니다.',401,{'WWW-Authenticate':'Basic realm="Clinic Journal", charset="UTF-8"'});
    let database;
    try{database=createSupabaseDatabase({url:env.SUPABASE_URL,secretKey:env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY,fetchImpl});}
    catch{return denied('게시판 저장소 설정을 확인해주세요.',503);}
    if(!database)return denied('게시판 저장소 연결이 필요합니다.',503);
    const response=await app.fetch(request,{
      DB:database,VERCEL_RUNTIME:true,ADMIN_AUTHENTICATED:admin,
      SITE_URL:env.SITE_URL,SITE_INDEXING:env.SITE_INDEXING||'off',
      GOOGLE_SITE_VERIFICATION:env.GOOGLE_SITE_VERIFICATION,NAVER_SITE_VERIFICATION:env.NAVER_SITE_VERIFICATION,
    });
    return request.method==='HEAD'?new Response(null,{status:response.status,headers:response.headers}):response;
  };
}
