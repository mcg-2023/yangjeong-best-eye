import {definePageManager} from './config.js';
import {createAdminAccess} from './admin-auth.js';
import {createManagerRoutes,isManagerRequest} from './routes.js';
import {createSupabaseDatabase} from './supabase-database.js';
import {repository} from './repository.js';
import {analyticsRoutes} from './analytics.js';
import {analyticsStore} from './analytics-store.js';
import {createAdminViews} from './admin-views.js';
import {latestPosts,postBody,postText,postHeadings,coverUrl} from './content.js';
export {definePageManager,createSupabaseDatabase,repository,postBody,postText,postHeadings};

// One independent instance per website. Secrets and storage stay on the server.
export function createPageManager(input={},options={}){
  const config=definePageManager(input),access=createAdminAccess({config,audit:options.audit}),routes=createManagerRoutes(config,{renderPreview:options.renderPreview});
  const environment=options.environment??(()=>process.env);
  const database=env=>typeof options.storage==='function'?options.storage(env):options.storage??createSupabaseDatabase({url:env.SUPABASE_URL,secretKey:env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY,fetchImpl:options.fetchImpl});
  async function fetchRequest(request){
    const url=new URL(request.url);if(!isManagerRequest(url.pathname))return null;
    const env=environment(),local=options.localPreview===true&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&env.NODE_ENV!=='production'&&!env.VERCEL;
    const publicTrack=url.pathname==='/api/public/track';
    const result=publicTrack?{context:{}}:local?{context:{ADMIN_AUTHENTICATED:true,CSRF_TOKEN:'local-preview',ADMIN_USERNAME:'로컬 관리자'}}:await access(request,env);
    if(result.response)return result.response;
    const DB=await database(env);
    if(!DB)return new Response('게시판 저장소 연결이 필요합니다.',{status:503,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
    const context={DB,...result.context,LOCAL_PREVIEW:local,SITE_URL:env.SITE_URL||url.origin,SITE_INDEXING:env.SITE_INDEXING||'off',VERCEL:env.VERCEL};
    const analyticsPath=publicTrack||/^\/(?:admin\/(?:statistics|sites)(?:\/|$)|api\/statistics(?:\/|$))/.test(url.pathname);
    if(analyticsPath&&config.analytics.enabled){
      // Only an explicitly configured canonical URL (or loopback preview) can seed the default site.
      if(env.SITE_URL||local){const canonical=new URL(env.SITE_URL||url.origin);if(['https:','http:'].includes(canonical.protocol)){const store=analyticsStore(DB);if(!await store.site(config.id))await store.saveSite({id:config.id,name:config.siteName,domains:[canonical.host],active:true});}}
      const admin=createAdminViews(config);
      const response=await analyticsRoutes(request,context,config,(title,body)=>admin.adminLayout({title,body,path:url.pathname,csrf:context.CSRF_TOKEN,username:context.ADMIN_USERNAME,local}));
      if(response)return response;
    }
    if(analyticsPath)return new Response('방문통계가 비활성화되어 있습니다.',{status:404,headers:{'Cache-Control':'no-store'}});
    return routes.fetch(request,context);
  }
  return {config,async fetch(request){
    try{const response=await fetchRequest(request);return response&&request.method==='HEAD'?new Response(null,{status:response.status,headers:response.headers}):response;}
    catch(error){console.error('Page manager request failed:',error?.name||'Error');return new Response('일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',{status:500,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});}
  },async publishedPosts(){
    const DB=await database(environment());if(!DB)throw new Error('Page manager storage is not configured');
    return latestPosts(await repository(DB).list()).map(post=>{
      const {cover,inlineImages,reviewApproved,...publicFields}=post;
      return {...publicFields,coverUrl:coverUrl(post)};
    });
  }};
}
