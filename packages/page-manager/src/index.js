import {definePageManager} from './config.js';
import {createAdminAccess} from './admin-auth.js';
import {createManagerRoutes,isManagerRequest} from './routes.js';
import {createSupabaseDatabase} from './supabase-database.js';
import {repository} from './repository.js';
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
    const result=local?{context:{ADMIN_AUTHENTICATED:true,CSRF_TOKEN:'local-preview',ADMIN_USERNAME:'로컬 관리자'}}:await access(request,env);
    if(result.response)return result.response;
    const DB=await database(env);
    if(!DB)return new Response('게시판 저장소 연결이 필요합니다.',{status:503,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
    return routes.fetch(request,{DB,...result.context,LOCAL_PREVIEW:local,SITE_URL:env.SITE_URL||url.origin,SITE_INDEXING:env.SITE_INDEXING||'off'});
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
