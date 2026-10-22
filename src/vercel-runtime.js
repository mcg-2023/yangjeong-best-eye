import {createApp} from './app.js';
import {createSupabaseDatabase} from './supabase-database.js';
import {siteOrigin} from './seo.js';
import {createAdminAccess} from './admin-auth.js';

// Stable public fallback; never use a preview request's Host for canonical URLs.
const productionOrigin='https://yangjeong-best-eye.vercel.app';
function configuredOrigin(value){
  if(typeof value!=='string'||!value.trim())return null;
  let cleaned=value.trim();
  if((cleaned.startsWith('"')&&cleaned.endsWith('"'))||(cleaned.startsWith("'")&&cleaned.endsWith("'")))cleaned=cleaned.slice(1,-1).trim();
  if(/^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z\d-]+(?::\d+)?\/?$/i.test(cleaned))cleaned='https://'+cleaned;
  try{
    const origin=siteOrigin(cleaned);
    // The owner's earlier deployment/branch URLs are temporary, even when valid URLs.
    if(/^yangjeong-best(?:-eye)?-.+-mcg24\.vercel\.app$/i.test(new URL(origin).hostname))return null;
    return origin;
  }catch{return null;}
}

export function createVercelHandler({environment=()=>process.env,fetchImpl=fetch}={}){
  const app=createApp();
  const adminAccess=createAdminAccess();
  let warnedAboutOrigin=false;
  return async request=>{
    const env=environment();
    const denied=(text,status,extra={})=>new Response(text,{status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex',...extra}});
    const access=await adminAccess(request,env);
    if(access.response)return request.method==='HEAD'?new Response(null,{status:access.response.status,headers:access.response.headers}):access.response;
    let database;
    try{database=createSupabaseDatabase({url:env.SUPABASE_URL,secretKey:env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY,fetchImpl});}
    catch{return denied('게시판 저장소 설정을 확인해주세요.',503);}
    if(!database)return denied('게시판 저장소 연결이 필요합니다.',503);
    const configured=configuredOrigin(env.SITE_URL);
    if(env.SITE_URL?.trim()&&!configured&&!warnedAboutOrigin){
      console.warn('Invalid or temporary SITE_URL configuration; using the production origin fallback.');
      warnedAboutOrigin=true;
    }
    const origin=configured||configuredOrigin(env.VERCEL_PROJECT_PRODUCTION_URL)||productionOrigin;
    const response=await app.fetch(request,{
      DB:database,VERCEL_RUNTIME:true,...access.context,
      SITE_URL:origin,SITE_INDEXING:env.SITE_INDEXING||'off',
      GOOGLE_SITE_VERIFICATION:env.GOOGLE_SITE_VERIFICATION,NAVER_SITE_VERIFICATION:env.NAVER_SITE_VERIFICATION,
    });
    return request.method==='HEAD'?new Response(null,{status:response.status,headers:response.headers}):response;
  };
}
