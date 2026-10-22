import {hospital as h,categories,categoryName} from './hospital.js';
import {esc,validatePost,publicationData,safeLink,isTestPost,latestPosts} from './content.js';
import {repository} from './repository.js';
import * as v from './views.js';
import {siteOrigin,articleSchema} from './seo.js';

const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const redirect=path=>new Response(null,{status:303,headers:{Location:path,'Cache-Control':'no-store'}});
const xml=s=>esc(s);
function parsePairs(value,names){return String(value??'').split('\n').filter(l=>l.trim()).map(line=>{const i=line.indexOf('|');return i<0?null:{[names[0]]:line.slice(0,i).trim(),[names[1]]:line.slice(i+1).trim()};}).filter(p=>p&&p[names[0]]&&p[names[1]]);}
function parseForm(data){const keys=['id','title','category','excerpt','answer','takeaways','body','cover','imageAlt','author','reviewer','reviewedAt','seoTitle','description','status'];const p=Object.fromEntries(keys.map(k=>[k,String(data.get(k)??'').trim()]));p.reviewApproved=data.get('reviewApproved')==='yes';p.tags=String(data.get('tags')??'').split(',').map(t=>t.trim()).filter(Boolean).slice(0,15);p.sources=parsePairs(data.get('sourcesText'),['title','url']);p.faq=parsePairs(data.get('faqText'),['question','answer']);p.seoTitle||=p.title;p.description||=p.excerpt;return p;}
export function createApp(assets={}) {
  return {async fetch(request,env={}) {
    try {
      const url=new URL(request.url),path=url.pathname;
      if(assets[path]){const a=assets[path];return new Response(Uint8Array.from(atob(a.data),c=>c.charCodeAt(0)),{headers:{'Content-Type':a.type,'Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}});}
      const isAdmin=path.startsWith('/admin')||path.startsWith('/api/');
      const authorized=env.LOCAL_PREVIEW===true||env.ADMIN_AUTHENTICATED===true||(!env.VERCEL_RUNTIME&&Boolean(request.headers.get('oai-authenticated-user-id')));
      if(isAdmin&&!authorized){return new Response('사이트 소유자 로그인이 필요합니다.',{status:403,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});}
      if(!env.DB) return new Response('게시판 데이터베이스를 연결하지 못했습니다. 관리자에게 문의해주세요.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
      const repo=repository(env.DB),origin=siteOrigin(env.SITE_URL,url.origin);
      const previewHost=env.LOCAL_PREVIEW===true||env.SITE_INDEXING==='off'||origin!==url.origin;
      if(request.method==='POST'){
        if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return json({errors:['같은 사이트의 글쓰기 화면에서 다시 시도해주세요.']},403);
        if(path!=='/api/posts')return json({errors:['지원하지 않는 요청입니다.']},404);
        if(Number(request.headers.get('content-length')??0)>1200000)return json({errors:['요청 크기가 너무 큽니다.']},413);
        const raw=await request.text();if(raw.length>1200000)return json({errors:['요청 크기가 너무 큽니다.']},413);
        const data=new URLSearchParams(raw),input=parseForm(data);
        const old=input.id?await repo.get(input.id):null;
        if(input.id&&!old)return json({errors:['글을 찾을 수 없습니다.']},404);
        if(!['draft','medical_review','published','archived'].includes(input.status))return json({errors:['올바른 저장 상태를 선택해주세요.']},400);
        const p=publicationData(input,old);const errors=validatePost(p,p.status==='published');
        if(errors.length)return json({errors},422);
        const all=await repo.list();if(p.status==='published'&&all.some(x=>x.id!==p.id&&x.status==='published'&&x.title.replace(/\s/g,'')===p.title.replace(/\s/g,'')))return json({errors:['동일한 제목의 발행 글이 있습니다. 기존 글을 수정해주세요.']},422);
        await repo.save(p);
        if(request.headers.get('accept')?.includes('application/json'))return json({id:p.id,status:p.status,url:'/admin/edit/'+p.id+'/',message:p.status==='published'?'글을 발행했습니다.':'글을 저장했습니다.'});
        return redirect('/admin/edit/'+p.id+'/');
      }
      if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD, POST'}});
      // Consolidate aliases and slash variants with permanent redirects; removed pages remain 404.
      if(path==='/contact'||path==='/contact/')return new Response(null,{status:301,headers:{Location:'/location/'+url.search}});
      if(/^\/(?:health|clinic|location|privacy|editorial-policy|admin|admin\/new|health\/category\/[\w-]+|health\/[\w-]+|admin\/(?:edit|preview)\/[\w-]+)$/.test(path))return new Response(null,{status:308,headers:{Location:path+'/'+url.search}});
      const media=path.match(/^\/media\/([\w-]+)\/cover$/);
      if(media){
        const p=await repo.get(media[1]);
        const image=p?.status==='published'&&p.cover?.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
        if(!image)return new Response(null,{status:404,headers:{'X-Robots-Tag':'noindex','Cache-Control':'no-store'}});
        return new Response(Uint8Array.from(atob(image[2]),c=>c.charCodeAt(0)),{headers:{'Content-Type':image[1],'Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff',...((previewHost||isTestPost(p))?{'X-Robots-Tag':'noindex'}:{})}});
      }
      const posts=await repo.list(),published=latestPosts(posts),indexable=published.filter(p=>!isTestPost(p));
      const labels={'/health/':'건강정보','/clinic/':'병원안내','/location/':'오시는 길','/privacy/':'개인정보 안내','/editorial-policy/':'콘텐츠 운영원칙'};
      const frame=(title,description,body,options={})=>v.layout({title,description,body,path,origin,breadcrumbs:labels[path]?[{name:'홈',url:'/'},{name:labels[path],url:path}]:[],verification:{'google-site-verification':env.GOOGLE_SITE_VERIFICATION,'naver-site-verification':env.NAVER_SITE_VERIFICATION},...options,noindex:previewHost||options.noindex===true});
      function collectionOptions(category){
        const query=url.searchParams.get('q')??'',page=Number(url.searchParams.get('page')??1);
        const items=published.filter(p=>(!category||p.category===category)&&(!query||[p.title,p.excerpt,p.body,...(p.tags??[])].join(' ').toLowerCase().includes(query.toLowerCase())));
        const valid=Number.isInteger(page)&&page>=1&&page<=Math.max(1,Math.ceil(items.length/6));
        return {valid,page,path:path+(page>1?'?page='+page:''),pageType:'CollectionPage',noindex:url.searchParams.has('q')||!items.slice((page-1)*6,page*6).some(p=>!isTestPost(p))};
      }
      if(path==='/')return frame('부산 양정 건강정보','양정베스트안과의원 건강정보. 건강정보와 병원소식, 진료분야 및 방문 안내를 확인하세요.',v.home(posts));
      if(path==='/admin/')return frame('게시판 관리','건강정보 글 관리',v.adminDashboard(posts,url.searchParams.get('status')??''),{admin:true});
      if(path==='/admin/new/')return frame('새 글 작성','건강정보 글쓰기',v.editor(),{admin:true});
      const edit=path.match(/^\/admin\/edit\/([\w-]+)\/$/);if(edit){const p=await repo.get(edit[1]);return p?frame('글 수정','건강정보 편집',v.editor(p),{admin:true}):notFound();}
      const preview=path.match(/^\/admin\/preview\/([\w-]+)\/$/);if(preview){const p=await repo.get(preview[1]);return p?frame(p.title,p.excerpt,v.article(p,posts,true),{admin:true}):notFound();}
      if(path==='/health/'){const options=collectionOptions();if(!options.valid)return notFound();return frame('건강정보'+(options.page>1?' · '+options.page+'페이지':''),'눈 건강 정보와 병원소식을 주제별로 살펴보세요.',`<div class="wrap">${v.breadcrumb([{name:'건강정보'}])}${v.pageIntro('HEALTH JOURNAL','눈 건강을 읽다.','눈에 관한 질문과 일상의 건강을 잇는 이야기. 필요한 정보를 주제별로 찾아보세요.')}</div>${v.journal(posts,{query:url.searchParams.get('q')??'',page:Number(url.searchParams.get('page'))||1})}`,options);}
      const category=path.match(/^\/health\/category\/([\w-]+)\/$/);if(category){if(![...categories.map(c=>c.slug),'notice'].includes(category[1]))return notFound();const options=collectionOptions(category[1]);if(!options.valid)return notFound();return frame(categoryName(category[1])+' 이야기'+(options.page>1?' · '+options.page+'페이지':''),categories.find(c=>c.slug===category[1])?.intro??'병원의 소식과 진료 안내를 전합니다.',`<div class="wrap">${v.breadcrumb([{name:'건강정보',url:'/health/'},{name:categoryName(category[1])}])}${v.pageIntro('JOURNAL TOPICS',categoryName(category[1]),categories.find(c=>c.slug===category[1])?.intro??'병원의 새로운 소식과 일정을 안내합니다.')}</div>${v.journal(posts,{category:category[1],query:url.searchParams.get('q')??'',page:Number(url.searchParams.get('page'))||1})}`,{...options,breadcrumbs:[{name:'홈',url:'/'},{name:'건강정보',url:'/health/'},{name:categoryName(category[1]),url:options.path}]});}
      const post=path.match(/^\/health\/([\w-]+)\/$/);if(post){const p=published.find(p=>p.id===post[1]);if(!p)return notFound();const schema=[articleSchema(p,origin,path)];if(p.faq?.length)schema.push(faqSchema(p.faq));return frame(p.seoTitle||p.title,p.description||p.excerpt,v.article(p,posts),{schema,post:p,pageType:p.category==='notice'?'WebPage':'MedicalWebPage',noindex:isTestPost(p),breadcrumbs:[{name:'홈',url:'/'},{name:'건강정보',url:'/health/'},{name:categoryName(p.category),url:'/health/category/'+p.category+'/'},{name:p.title,url:path}]});}
      if(path==='/clinic/')return frame('병원안내','부산 양정베스트안과의 의료진 소개와 진료 공간, 진료시간 및 방문 안내',v.clinicPage());
      if(path==='/location/')return frame('오시는 길과 진료안내',h.address+' · 4층 접수·외래·검진, 5층 수술센터 · '+h.phone,v.locationPage(),{schema:[faqSchema(v.clinicFAQ.map(([question,answer])=>({question,answer})))]});
      if(path==='/privacy/')return frame('개인정보 안내','홈페이지 개인정보 및 게시판 운영 안내',`<section class="wrap policy">${v.pageIntro('PRIVACY','개인정보 안내')}<div class="prose"><h2>방문자 정보 입력</h2><p>이 홈페이지는 방문자 회원가입, 환자 상담 접수, 온라인 예약 및 결제 정보를 수집하지 않습니다. 진료 문의는 병원 전화로 안내합니다.</p><h2>게시판 정보</h2><p>관리자가 작성한 글, 작성자·검수자 이름 및 대표이미지는 운영 데이터베이스에 저장됩니다. 글에 환자 이름, 연락처, 진료기록 등 개인정보를 입력하지 마세요.</p><h2>접속 및 인증</h2><p>게시판 관리 기능은 관리자 인증을 거친 경우에만 이용할 수 있습니다. 로그인 정보와 게시글 저장소의 비밀 키는 방문자 화면에 공개하지 않습니다. 별도의 광고·방문자 분석 추적 스크립트는 설치하지 않았습니다.</p><h2>문의</h2><p>개인정보 관련 문의: ${h.phone}. 실제 공개 운영 전 병원 담당자가 처리방침과 운영 주체를 최종 확인해야 합니다.</p></div></section>`,{noindex:true});
      if(path==='/editorial-policy/')return frame('콘텐츠 운영원칙','건강정보의 출처, 검수, 발행과 수정 원칙',`<section class="wrap policy">${v.pageIntro('EDITORIAL POLICY','정확하게 쓰고, 확인 후 전합니다.')}<div class="prose"><h2>질문에 먼저 답합니다</h2><p>의료정보는 핵심 답변과 요약, 본문, 참고자료의 순서로 읽을 수 있게 구성합니다. 단정적인 표현이나 과장된 치료효과를 사용하지 않습니다.</p><h2>검수 후 발행합니다</h2><p>의료정보 글에는 실제 작성자와 의료 검수자, 검수일, 참고자료를 입력하고 검수 완료를 확인해야 합니다. 임시저장과 검수 대기 글은 방문자 목록 및 검색용 사이트맵에 포함하지 않습니다.</p><h2>출처와 수정일을 남깁니다</h2><p>실제로 참고한 자료의 제목과 주소를 표시합니다. 글을 고칠 때 수정일을 갱신하고, 변경된 의료정보는 다시 검수합니다. 관련 콘텐츠와 최신 콘텐츠는 주제에 따라 구분합니다.</p><h2>병원 정보의 출처</h2><p>병원명, 진료분야, 전화·주소·진료시간은 <a href="${h.source}" target="_blank" rel="noopener">병원 공식 홈페이지</a>를 기준으로 ${h.verifiedAt} 확인했습니다. 주차 등 확인되지 않은 사항은 전화로 안내합니다.</p></div></section>`);
      if(path==='/robots.txt')return new Response(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`,{headers:{'Content-Type':'text/plain; charset=utf-8'}});
      if(path==='/sitemap.xml'){const paths=['/',...(indexable.length?['/health/']:[]),'/clinic/','/location/','/editorial-policy/',...categories.filter(c=>indexable.some(p=>p.category===c.slug)).map(c=>'/health/category/'+c.slug+'/'),...(indexable.some(p=>p.category==='notice')?['/health/category/notice/']:[])];return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p=>`<url><loc>${xml(origin+p)}</loc></url>`).join('')}${indexable.map(p=>`<url><loc>${xml(origin+'/health/'+p.id+'/')}</loc><lastmod>${xml(p.updatedAt)}</lastmod></url>`).join('')}</urlset>`,{headers:{'Content-Type':'application/xml; charset=utf-8'}});}
      if(path==='/feed.xml')return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><atom:link href="${xml(origin+'/feed.xml')}" rel="self" type="application/rss+xml"/><title>${h.shortName} 건강정보</title><link>${xml(origin+'/health/')}</link><description>눈 건강 정보와 병원소식</description><language>ko-kr</language>${indexable.slice(0,20).map(p=>`<item><title>${xml(p.title)}</title><link>${xml(origin+'/health/'+p.id+'/')}</link><guid isPermaLink="true">${xml(origin+'/health/'+p.id+'/')}</guid><pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate><description>${xml(p.excerpt+'\n'+p.answer+'\n'+p.body)}</description></item>`).join('')}</channel></rss>`,{headers:{'Content-Type':'application/rss+xml; charset=utf-8'}});
      
      return notFound();
      function notFound(){return frame('페이지를 찾을 수 없습니다','요청한 페이지가 없거나 발행되지 않았습니다.',`<section class="wrap not-found">${v.pageIntro('404 · PAGE NOT FOUND','잠시, 길을 벗어났네요.','요청한 글이 없거나 아직 발행되지 않았습니다.')}<a class="btn primary" href="/">홈으로 돌아가기</a><a class="btn" href="/health/">건강정보</a></section>`,{status:404,noindex:true});}
    } catch(error){console.error('Request failed:',error?.message);return new Response('일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',{status:500,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});}
  }};
}
function faqSchema(faq){return {'@type':'FAQPage',mainEntity:faq.map(f=>({'@type':'Question',name:f.question,acceptedAnswer:{'@type':'Answer',text:f.answer}}))};}
