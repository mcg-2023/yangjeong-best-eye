import {esc,validatePost,publicationData,postBody} from './content.js';
import {repository} from './repository.js';
import {prepareHtmlPost} from './html-content.js';
import {imageData} from './image-data.js';
import {createAdminViews} from './admin-views.js';
import {definePageManager,validationOptions} from './config.js';
import {icon} from './ui.js';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const redirect=path=>new Response(null,{status:303,headers:{Location:path,'Cache-Control':'no-store'}});
function parsePairs(value,names){return String(value??'').split('\n').filter(l=>l.trim()).map(line=>{const i=line.indexOf('|');return i<0?null:{[names[0]]:line.slice(0,i).trim(),[names[1]]:line.slice(i+1).trim()};}).filter(p=>p&&p[names[0]]&&p[names[1]]);}
function parseForm(data){const keys=['id','title','category','excerpt','answer','takeaways','body','cover','imageAlt','author','reviewer','reviewedAt','seoTitle','description','status'];const p=Object.fromEntries(keys.map(k=>[k,String(data.get(k)??'').trim()]));p.bodyFormat=data.get('bodyFormat')==='html'?'html':'markdown';p.reviewApproved=data.get('reviewApproved')==='yes';p.tags=String(data.get('tags')??'').split(',').map(t=>t.trim()).filter(Boolean).slice(0,15);p.sources=parsePairs(data.get('sourcesText'),['title','url']);p.faq=parsePairs(data.get('faqText'),['question','answer']);p.seoTitle||=p.title;p.description||=p.excerpt;return p;}

export const isManagerRequest=path=>/^\/admin(?:\/|$)/.test(path)||path.startsWith('/api/posts')||/^\/media\/[\w-]+\/(?:cover|inline\/[\w-]+)$/.test(path);
function defaultPreview(p,_posts,config){return '<article class="prose"><p>'+esc(config.categories.find(c=>c.slug===p.category)?.name)+'</p><h1>'+esc(p.title)+'</h1><p>'+esc(p.excerpt)+'</p><p>'+esc(p.author)+'</p>'+postBody(p)+(p.status==='published'?'<p><a href="'+config.publicPostBase+encodeURIComponent(p.id)+'/" target="_blank" rel="noopener">발행된 글 보기</a></p>':'')+'</article>';}
// Internal router: the host must supply verified authentication context. Use createPageManager for standalone installs.
export function createManagerRoutes(input={},options={}){
 const config=definePageManager(input),admin=createAdminViews(config),renderPreview=options.renderPreview??defaultPreview;
 return {async fetch(request,env={}){
  const url=new URL(request.url),path=url.pathname;if(!isManagerRequest(path))return null;
  const isAdmin=path.startsWith('/admin')||path.startsWith('/api/');
  if(isAdmin&&!env.ADMIN_AUTHENTICATED&&!env.LOCAL_PREVIEW)return new Response('사이트 소유자 로그인이 필요합니다.',{status:403,headers:{'Cache-Control':'no-store'}});
  if(path==='/admin/login/'&&env.LOCAL_PREVIEW)return admin.loginPage({local:true});
  if(!env.DB)return new Response('게시판 저장소 연결이 필요합니다.',{status:503,headers:{'Cache-Control':'no-store'}});
  const repo=repository(env.DB),origin=env.SITE_URL??url.origin,previewHost=env.LOCAL_PREVIEW===true||env.SITE_INDEXING==='off'||origin!==url.origin;
  const isTestPost=p=>p.id?.startsWith('test-journal-')===true;
  const desk=(title,body,options={})=>admin.adminLayout({title,body,path,csrf:env.CSRF_TOKEN??'',username:env.ADMIN_USERNAME||'관리자',local:env.LOCAL_PREVIEW===true,...options});
  const notFound=()=>desk('페이지를 찾을 수 없습니다','<div class="desk-empty"><h1>페이지를 찾을 수 없습니다.</h1><p>주소가 올바른지 확인해주세요.</p><a class="btn primary" href="/admin/">대시보드로 이동</a></div>',{status:404});
      if(request.method==='POST'){
        if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return json({errors:['같은 사이트의 글쓰기 화면에서 다시 시도해주세요.']},403);
        if(!['/api/posts','/api/posts/status','/api/posts/delete'].includes(path))return json({errors:['지원하지 않는 요청입니다.']},404);
        if(Number(request.headers.get('content-length')??0)>3500000)return json({errors:['요청 크기가 너무 큽니다.']},413);
        const raw=await request.text();if(raw.length>3500000)return json({errors:['요청 크기가 너무 큽니다.']},413);
        const data=new URLSearchParams(raw);
        if(env.CSRF_TOKEN&&data.get('csrf')!==env.CSRF_TOKEN)return json({errors:['화면을 새로고침한 후 다시 시도해주세요.']},403);
        if(path==='/api/posts/delete'){
          const id=data.get('id')??'';
          if(!/^[\w-]+$/.test(id))return json({errors:['글을 찾을 수 없습니다.']},404);
          if(data.get('confirmDelete')!=='yes')return json({errors:['삭제 확인 화면에서 다시 시도해주세요.']},400);
          const old=await repo.get(id);
          if(!old)return json({errors:['글을 찾을 수 없습니다.']},404);
          await repo.delete(id);
          return request.headers.get('accept')?.includes('application/json')?json({message:'글을 삭제했습니다.',url:'/admin/posts/?deleted=1'}):redirect('/admin/posts/?deleted=1');
        }
        if(path==='/api/posts/status'){
          const old=await repo.get(data.get('id')??''),status=data.get('status');
          if(!old)return json({errors:['글을 찾을 수 없습니다.']},404);
          if(!['draft','archived'].includes(status))return json({errors:['보관 또는 초안 복원만 가능합니다.']},400);
          if(status==='draft'&&old.status!=='archived')return json({errors:['보관된 글만 초안으로 복원할 수 있습니다.']},400);
          await repo.save({...old,status,reviewApproved:false,updatedAt:new Date().toISOString()});
          const message=status==='archived'?'글을 보관했습니다.':'글을 초안으로 복원했습니다.';
          return request.headers.get('accept')?.includes('application/json')?json({data:{id:old.id,status},message}):redirect('/admin/posts/?status='+status);
        }
        const input=parseForm(data);
        const old=input.id?await repo.get(input.id):null;
        if(input.id&&!old)return json({errors:['글을 찾을 수 없습니다.']},404);
        // Removed optional editor fields must not erase metadata on existing posts.
        for(const [field,key] of [['faqText','faq'],['sourcesText','sources'],['tags','tags']])if(!data.has(field))input[key]=old?.[key]??[];
        if(!['draft','medical_review','published','archived'].includes(input.status))return json({errors:['올바른 저장 상태를 선택해주세요.']},400);
        let p=publicationData(input,old);
        if(p.bodyFormat==='html')try{p=prepareHtmlPost(p,old);}catch(error){return json({errors:[error.message]},422);}
        const errors=validatePost(p,p.status==='published',validationOptions(config));
        if(errors.length)return json({errors},422);
        const all=await repo.list();if(p.status==='published'&&all.some(x=>x.id!==p.id&&x.status==='published'&&x.title.replace(/\s/g,'')===p.title.replace(/\s/g,'')))return json({errors:['동일한 제목의 발행 글이 있습니다. 기존 글을 수정해주세요.']},422);
        await repo.save(p);
        if(request.headers.get('accept')?.includes('application/json'))return json({id:p.id,status:p.status,url:'/admin/edit/'+p.id+'/',message:p.status==='published'?'글을 발행했습니다.':'글을 저장했습니다.'});
        return redirect('/admin/edit/'+p.id+'/');
      }
      if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD, POST'}});
      if(path==='/api/posts/delete')return new Response(null,{status:405,headers:{Allow:'POST'}});

  if(/^\/admin(?:\/(?:new|posts|settings|(?:edit|preview|delete)\/[\w-]+))?$/.test(path))return new Response(null,{status:308,headers:{Location:path+'/'+url.search}});
      const inlineMedia=path.match(/^\/media\/([\w-]+)\/inline\/([\w-]+)$/);
      if(inlineMedia){
        const p=await repo.get(inlineMedia[1]),publicPost=p?.status==='published';
        const item=p&&(publicPost||env.ADMIN_AUTHENTICATED===true)?p.inlineImages?.find(i=>i.id===inlineMedia[2]):null;
        const image=imageData(item?.data,300*1024);
        if(!image)return new Response(null,{status:404,headers:{'X-Robots-Tag':'noindex','Cache-Control':'no-store'}});
        return new Response(Uint8Array.from(image.bytes,c=>c.charCodeAt(0)),{headers:{'Content-Type':image.mime,'Cache-Control':publicPost?'public, max-age=3600':'private, no-store','X-Content-Type-Options':'nosniff',...((!publicPost||previewHost||isTestPost(p))?{'X-Robots-Tag':'noindex'}:{})}});
      }
      const media=path.match(/^\/media\/([\w-]+)\/cover$/);
      if(media){
        const p=await repo.get(media[1]);
        const image=p?.status==='published'&&p.cover?.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
        if(!image)return new Response(null,{status:404,headers:{'X-Robots-Tag':'noindex','Cache-Control':'no-store'}});
        return new Response(Uint8Array.from(atob(image[2]),c=>c.charCodeAt(0)),{headers:{'Content-Type':image[1],'Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff',...((previewHost||isTestPost(p))?{'X-Robots-Tag':'noindex'}:{})}});
      }

  const posts=await repo.list();
      if(path==='/admin/')return url.searchParams.has('status')?redirect('/admin/posts/'+url.search):desk('대시보드',admin.dashboard(posts));
      if(path==='/admin/posts/')return desk('게시글 관리',admin.postsPage(posts,url.searchParams,{csrf:env.CSRF_TOKEN??''}));
      if(path==='/admin/settings/')return desk('운영 안내',admin.settingsPage({username:env.ADMIN_USERNAME,origin,indexing:!previewHost,local:env.LOCAL_PREVIEW===true}));
      if(path==='/admin/new/')return desk('새 글 작성',admin.editorPage({},env.CSRF_TOKEN??''));
      const deletion=path.match(/^\/admin\/delete\/([\w-]+)\/$/);if(deletion){const p=await repo.get(deletion[1]);return p?desk('게시글 삭제',admin.deletePage(p,env.CSRF_TOKEN??'')):notFound();}
      const edit=path.match(/^\/admin\/edit\/([\w-]+)\/$/);if(edit){const p=await repo.get(edit[1]);return p?desk('글 수정',admin.editorPage(p,env.CSRF_TOKEN??'')):notFound();}
      const preview=path.match(/^\/admin\/preview\/([\w-]+)\/$/);if(preview){const p=await repo.get(preview[1]);return p?desk('미리보기',`<div class="desk-preview"><a href="/admin/edit/${p.id}/" class="btn">편집 화면으로 ${icon('arrow',16)}</a>${renderPreview(p,posts,config)}</div>`):notFound();}

  return notFound();
 }};
}
