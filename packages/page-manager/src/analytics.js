import {isIP} from 'node:net';
import {analyticsStore} from './analytics-store.js';
import {analyticsPage,sitesPage,sessionPage} from './analytics-views.js';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const siteId=/^[a-z][a-z0-9_-]{1,39}$/;
const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff',...headers}});
const text=(value,max=200)=>typeof value==='string'?value.replace(/[\u0000-\u001f]/g,'').slice(0,max):'';
function safeUrl(value){try{const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return '';return u.origin+u.pathname;}catch{return '';}}
function domain(value){try{const v=value.trim().toLowerCase();const u=new URL('https://'+v);return u.host===v&&u.pathname==='/'&&!u.username&&!u.password&&!u.search&&!u.hash?v:null;}catch{return null;}}
function source(value){let host;try{host=new URL(value).hostname;}catch{return '직접접속';}for(const [label,domains] of [['제미나이',['gemini.google.com','bard.google.com']],['챗지피티',['chatgpt.com','chat.openai.com']],['클로드',['claude.ai']],['퍼플렉시티',['perplexity.ai']],['네이버',['naver.com']],['구글',['google.com','google.co.kr']],['다음',['daum.net']],['인스타그램',['instagram.com']],['페이스북',['facebook.com','fb.com']],['유튜브',['youtube.com','youtu.be']],['기타 검색엔진',['bing.com','yahoo.com','duckduckgo.com']]])if(domains.some(d=>host===d||host.endsWith('.'+d)))return label;return '기타';}
export function deviceInfo(ua,automation){
 const bots=[['GPTBot',/gptbot|oai-searchbot|chatgpt-user/i],['ClaudeBot',/claudebot|claude-user|anthropic/i],['PerplexityBot',/perplexitybot|perplexity-user/i],['구글봇',/googlebot|google-inspectiontool/i],['빙봇',/bingbot/i],['네이버 예티',/yeti\/|naverbot/i]];
 const bot=bots.find(([,re])=>re.test(ua))?.[0]||(automation||/headless|playwright|puppeteer|selenium|webdriver|phantomjs/i.test(ua)?'자동화 브라우저':/bot\b|crawler|spider|scrap|curl\/|python-requests/i.test(ua)?'기타 봇':!ua?'UA 없음':null);
 return {bot,isBot:!!bot,device:/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)?'Tablet':/Mobi|iPhone|iPod|Android/i.test(ua)?'Mobile':'PC',os:/iPhone|iPad|iPod/i.test(ua)?'iOS':/Android/i.test(ua)?'Android':/Windows/i.test(ua)?'Windows':/Macintosh|Mac OS X/i.test(ua)?'macOS':/Linux/i.test(ua)?'Linux':'기타',browser:/SamsungBrowser/i.test(ua)?'Samsung Internet':/Edg\//i.test(ua)?'Edge':/Firefox|FxiOS/i.test(ua)?'Firefox':/Chrome|CriOS/i.test(ua)?'Chrome':/Safari/i.test(ua)?'Safari':'기타'};
}
const day=stamp=>new Date(new Date(stamp).getTime()+9*3600000).toISOString().slice(0,10);
export function period(params,now=new Date()){
 const today=day(now),base=new Date(today+'T00:00:00+09:00'),name=params.get('period')||'7d';let start=new Date(base),end=new Date(+base+86400000);
 if(name==='yesterday'){start=new Date(+base-86400000);end=base;}
 else if(['7d','30d','90d'].includes(name))start=new Date(+base-(Number(name.slice(0,-1))-1)*86400000);
 else if(name==='this_month')start=new Date(today.slice(0,7)+'-01T00:00:00+09:00');
 else if(name==='last_month'){end=new Date(today.slice(0,7)+'-01T00:00:00+09:00');start=new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7))-2,1)-9*3600000);}
 else if(name==='custom'){
   const a=params.get('start'),b=params.get('end');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(a||'')||!/^\d{4}-\d{2}-\d{2}$/.test(b||''))throw new Error('시작일과 종료일을 선택해주세요.');
   start=new Date(a+'T00:00:00+09:00');end=new Date(+new Date(b+'T00:00:00+09:00')+86400000);
   if(!Number.isFinite(+start)||!Number.isFinite(+end)||day(start)!==a||day(new Date(+end-86400000))!==b)throw new Error('날짜를 확인해주세요.');
 }else if(name!=='today')throw new Error('기간을 확인해주세요.');
 if(end<=start||end-start>366*86400000)throw new Error('조회 기간은 1일부터 366일까지 선택할 수 있습니다.');
 return {start:start.toISOString(),end:end.toISOString(),label:day(start)+' ~ '+day(new Date(+end-1))+' (한국시간)'};
}
export function aggregate(hits,firstSeen,range,{visitorType='human',page='',event='',sessionPage:pageNumber=1}={}){
 const allSessions=new Map(),durations=new Map();
 for(const h of hits){if(h.kind==='end')durations.set(h.siteId+':'+h.pageViewId,Math.max(durations.get(h.siteId+':'+h.pageViewId)||0,h.duration));if(h.kind!=='pageview')continue;const key=h.siteId+':'+h.sessionId;let s=allSessions.get(key);if(!s){s={...h,pages:[],events:[]};allSessions.set(key,s);}s.pages.push(h);if(h.createdAt<s.createdAt)Object.assign(s,{...h,pages:s.pages,events:s.events});}
 for(const h of hits){if(h.kind==='event')allSessions.get(h.siteId+':'+h.sessionId)?.events.push(h);}
 const inRange=h=>h.createdAt>=range.start&&h.createdAt<range.end;
 const sessions=[...allSessions.values()].filter(s=>s.pages.some(inRange)&&(visitorType==='all'||(visitorType==='bot'?s.isBot:!s.isBot)));
 const views=sessions.flatMap(s=>s.pages.filter(inRange)),events=sessions.flatMap(s=>s.events.filter(inRange)),visitors=new Map();
 for(const s of sessions)visitors.set(s.siteId+':'+s.visitorId,s);
 const newVisitors=[...visitors.keys()].filter(k=>Date.parse(firstSeen[k])>=Date.parse(range.start)&&Date.parse(firstSeen[k])<Date.parse(range.end)).length;
 const measured=views.filter(v=>durations.has(v.siteId+':'+v.pageViewId));
 const group=(items,key)=>{const map=new Map();for(const item of items){const name=key(item)||'없음';map.set(name,(map.get(name)||0)+1);}return [...map].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));};
 const trend=[];for(let t=+new Date(range.start);t<+new Date(range.end);t+=86400000){const date=day(t),p=views.filter(v=>day(v.createdAt)===date);trend.push({date,visitors:new Set(p.map(v=>v.siteId+':'+v.visitorId)).size,pageViews:p.length});}
 const pages=group(views.filter(v=>!page||v.pageUrl.toLowerCase().includes(page.toLowerCase())),v=>v.pageUrl).map(g=>{const list=views.filter(v=>v.pageUrl===g.name),timed=list.filter(v=>durations.has(v.siteId+':'+v.pageViewId));return {...g,title:list[0]?.title||'',visitors:new Set(list.map(v=>v.siteId+':'+v.visitorId)).size,avgDurationSeconds:timed.length?Math.round(timed.reduce((n,v)=>n+durations.get(v.siteId+':'+v.pageViewId),0)/timed.length):null};});
 const eventRows=group(events.filter(e=>!event||e.eventName.includes(event)),e=>e.eventName).map(g=>({...g,pages:group(events.filter(e=>e.eventName===g.name),e=>e.pageUrl)}));
 const sorted=sessions.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(s=>({siteId:s.siteId,sessionId:s.sessionId,visitorId:s.visitorId,createdAt:s.createdAt,ip:s.ip,source:s.source,device:s.device,os:s.os,browser:s.browser,bot:s.bot,landingPage:s.landingPage||s.pages[0]?.pageUrl,pageViews:s.pages.filter(inRange).length,durationSeconds:s.pages.reduce((n,p)=>n+(durations.get(p.siteId+':'+p.pageViewId)||0),0),utm:s.utm}));
 const sessionPages=Math.max(1,Math.ceil(sorted.length/20)),selectedPage=Math.max(1,Math.min(sessionPages,Number.parseInt(pageNumber,10)||1));
 return {range,overview:{visitors:visitors.size,sessions:sessions.length,pageViews:views.length,newVisitors,returningVisitors:visitors.size-newVisitors,bounceRate:sessions.length?Math.round(sessions.filter(s=>s.pages.length<=1).length/sessions.length*1000)/10:0,avgDurationSeconds:measured.length?Math.round(measured.reduce((n,v)=>n+durations.get(v.siteId+':'+v.pageViewId),0)/measured.length):null},trend,pages,events:eventRows,referrers:group(sessions,s=>s.source),devices:group(sessions,s=>s.device),os:group(sessions,s=>s.os),browsers:group(sessions,s=>s.browser),bots:group(sessions.filter(s=>s.isBot),s=>s.bot),campaigns:group(sessions.filter(s=>Object.values(s.utm||{}).some(Boolean)),s=>[s.utm.source,s.utm.medium,s.utm.campaign].filter(Boolean).join(' / ')),sessions:sorted.slice((selectedPage-1)*20,selectedPage*20),pagination:{page:selectedPage,pages:sessionPages,total:sorted.length}};
}
export async function analyticsRoutes(request,env,config,desk){
 const url=new URL(request.url),path=url.pathname,publicTrack=path==='/api/public/track';
 if(!publicTrack&&!/^\/(?:admin\/(?:statistics|sites)(?:\/|$)|api\/statistics(?:\/|$))/.test(path))return null;
 if(!config.analytics.enabled)return json({error:'방문통계가 비활성화되어 있습니다.'},404);
 if(!publicTrack&&!env.ADMIN_AUTHENTICATED)return json({error:'관리자 로그인이 필요합니다.'},401);
 const store=analyticsStore(env.DB);
 if(publicTrack){
   if(!['POST','OPTIONS'].includes(request.method))return json({error:'POST 요청만 허용합니다.'},405,{Allow:'POST, OPTIONS'});
   const id=url.searchParams.get('site_id');if(!siteId.test(id||''))return json({error:'사이트 ID를 확인해주세요.'},400);
   const site=await store.site(id);let origin;
   try{origin=new URL(request.headers.get('origin'));if(origin.origin!==request.headers.get('origin')||!['https:','http:'].includes(origin.protocol))throw 0;}catch{return json({error:'허용되지 않은 출처입니다.'},403);}
   if(!site?.active||!site.domains.includes(origin.host))return json({error:'허용되지 않은 도메인입니다.'},403);
   const cors={'Access-Control-Allow-Origin':origin.origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'};
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Cache-Control':'no-store'}});
   if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return json({error:'JSON 요청이 필요합니다.'},415,cors);
   if(Number(request.headers.get('content-length'))>16384)return json({error:'요청 크기가 너무 큽니다.'},413,cors);
   let p;try{const reader=request.body?.getReader();let chunks=[],length=0;if(!reader)throw 0;while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>16384){await reader.cancel();return json({error:'요청 크기가 너무 큽니다.'},413,cors);}chunks.push(value);}p=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!p||Array.isArray(p)||typeof p!=='object')throw 0;}catch{return json({error:'잘못된 수집 요청입니다.'},400,cors);}
   if(!['pageview','end','event'].includes(p.kind)||![p.visitorId,p.sessionId,p.pageViewId,p.hitId].every(v=>typeof v==='string'&&uuid.test(v)))return json({error:'수집 ID를 확인해주세요.'},400,cors);
   const pageUrl=safeUrl(p.pageUrl);if(!pageUrl||new URL(pageUrl).origin!==origin.origin||/^\/(?:admin|api)(?:\/|$)/.test(new URL(pageUrl).pathname))return json({error:'수집 페이지를 확인해주세요.'},400,cors);
   if(p.kind==='event'&&!text(p.eventName))return json({error:'이벤트 이름이 필요합니다.'},400,cors);
   let ip='';if(env.VERCEL==='1'||config.analytics.trustProxy){const candidate=((env.VERCEL==='1'?request.headers.get('x-vercel-forwarded-for'):null)||request.headers.get('x-forwarded-for')||request.headers.get('x-real-ip')||'').split(',')[0].trim();if(isIP(candidate))ip=candidate;}
   const ua=text(request.headers.get('user-agent'),1000),utm={};for(const key of ['source','medium','campaign','term','content'])utm[key]=text(p.utm?.[key],150);
   const hit={id:id+':'+p.kind+':'+(p.kind==='event'?p.hitId:p.pageViewId),siteId:id,kind:p.kind,visitorId:p.visitorId,sessionId:p.sessionId,pageViewId:p.pageViewId,createdAt:new Date().toISOString(),pageUrl,title:text(p.title),landingPage:safeUrl(p.landingPage)||pageUrl,referrer:safeUrl(p.referrer),source:source(p.referrer),utm,ua,ip,...deviceInfo(ua,p.automation===true),duration:Math.max(0,Math.min(86400,Math.round(Number(p.duration)||0))),eventName:text(p.eventName),eventCategory:text(p.eventCategory,100),eventValue:text(p.eventValue)};
   await store.addHit(hit);return new Response(null,{status:204,headers:{...cors,'Cache-Control':'no-store'}});
 }
 if(path==='/admin/statistics'||path==='/admin/sites')return new Response(null,{status:308,headers:{Location:path+'/'+url.search}});
 if(request.method==='POST'&&path==='/api/statistics/sites'){
   if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'관리 화면에서 다시 시도해주세요.'},403);
   const raw=await request.text();if(raw.length>8192)return json({error:'요청이 너무 큽니다.'},413);
   const form=new URLSearchParams(raw);if(!env.CSRF_TOKEN||form.get('csrf')!==env.CSRF_TOKEN)return json({error:'화면을 새로고침해주세요.'},403);
   const id=form.get('id')||'',name=text(form.get('name'),100),domains=[...new Set((form.get('domains')||'').split(/[\s,]+/).filter(Boolean).map(domain))];
   if(!siteId.test(id)||!name||!domains.length||domains.length>30||domains.includes(null))return json({error:'사이트 ID(영문 소문자 시작, 2~40자), 사이트명, 도메인(경로 제외)을 확인해주세요.'},422);
   await store.saveSite({id,name,domains,active:form.get('active')==='yes'});return new Response(null,{status:303,headers:{Location:'/admin/sites/?saved=1','Cache-Control':'no-store'}});
 }
 if(!['GET','HEAD'].includes(request.method))return json({error:'허용되지 않은 메서드입니다.'},405,{Allow:path==='/api/statistics/sites'?'GET, HEAD, POST':'GET, HEAD'});
 if(path==='/api/statistics/sites')return json({data:await store.sites()});
 if(path==='/admin/sites/')return desk('통계 사이트 관리',sitesPage(await store.sites(),env,config));
 if(path==='/admin/statistics/')return desk('방문통계',analyticsPage());
 if(path==='/admin/statistics/session/')return desk('방문 세션 상세',sessionPage());
 if(path==='/api/statistics/session'){
   const site=url.searchParams.get('site'),session=url.searchParams.get('session');if(!siteId.test(site||'')||!uuid.test(session||''))return json({error:'세션을 확인해주세요.'},400);
   const hits=await store.hits({site,session});return hits.length?json({data:hits}):json({error:'세션을 찾을 수 없습니다.'},404);
 }
 if(path!=='/api/statistics/overview')return json({error:'페이지를 찾을 수 없습니다.'},404);
 try{
   const range=period(url.searchParams),site=url.searchParams.get('site'),type=url.searchParams.get('visitor_type')||'human';
   if((site&&site!=='all'&&!siteId.test(site))||!['human','bot','all'].includes(type))return json({error:'필터를 확인해주세요.'},400);
   // Include adjacent days for sessions and exit beacons crossing midnight.
   const hits=await store.hits({site:site==='all'?null:site,start:new Date(+new Date(range.start)-86400000).toISOString(),end:new Date(+new Date(range.end)+86400000).toISOString()});
   const pairs=[...new Map(hits.filter(h=>h.kind==='pageview').map(h=>[h.siteId+':'+h.visitorId,h])).values()];
   const data=aggregate(hits,await store.firstSeen(pairs),range,{visitorType:type,page:text(url.searchParams.get('page_filter')),event:text(url.searchParams.get('event_filter')),sessionPage:url.searchParams.get('session_page')});
   return json({data});
 }catch(error){if(error.message?.includes('기간')||error.message?.includes('일')||error.message?.includes('날짜'))return json({error:error.message},400);throw error;}
}
