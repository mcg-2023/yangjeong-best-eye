import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createPageManager} from '../src/index.js';
import {createSqliteDatabase} from '../src/sqlite-database.js';
import {analyticsStore} from '../src/analytics-store.js';
import {aggregate,period,deviceInfo} from '../src/analytics.js';
import {createSupabaseDatabase} from '../src/supabase-database.js';

const origin='http://localhost:5180';
function fixture(options={}){
 const DB=createSqliteDatabase(),manager=createPageManager({id:'clinic',siteName:'테스트 병원',...options.config},{storage:DB,localPreview:true,environment:()=>({}),...options});
 const request=(path,init={})=>manager.fetch(new Request(origin+path,init));
 const hit={kind:'pageview',hitId:randomUUID(),visitorId:randomUUID(),sessionId:randomUUID(),pageViewId:randomUUID(),pageUrl:origin+'/articles/notice/',title:'진료 안내',referrer:'https://search.naver.com/search.naver?query=private',utm:{source:'naver',campaign:'clinic'}};
 const send=(patch={},headers={})=>request('/api/public/track?site_id=clinic',{method:'POST',headers:{origin,'content-type':'application/json','user-agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1 Safari/604.1',...headers},body:JSON.stringify({...hit,...patch})});
 return {DB,manager,request,hit,send};
}
test('collector → SQLite → dashboard: deduplication, duration, event drilldown, privacy and post isolation',async()=>{
 const f=fixture();try{
  assert.equal((await f.send()).status,204);assert.equal((await f.send()).status,204);
  const eventId=randomUUID();await f.send({kind:'event',hitId:eventId,eventName:'전화 버튼 클릭',eventValue:'예약'});await f.send({kind:'event',hitId:eventId,eventName:'전화 버튼 클릭'});
  await f.send({kind:'end',hitId:randomUUID(),duration:30});await f.send({kind:'end',hitId:randomUUID(),duration:12});
  const body=await(await f.request('/api/statistics/overview?period=today')).json();
  assert.deepEqual(body.data.overview,{visitors:1,sessions:1,pageViews:1,newVisitors:1,returningVisitors:0,bounceRate:100,avgDurationSeconds:30});
  assert.equal(body.data.events[0].count,1);assert.equal(body.data.referrers[0].name,'네이버');assert.equal(body.data.devices[0].name,'Mobile');assert.equal(body.data.os[0].name,'iOS');assert.equal(body.data.sessions[0].ip,'');
  assert.equal(body.data.events[0].pages[0].name,f.hit.pageUrl);
  const hits=(await(await f.request('/api/statistics/session?site=clinic&session='+f.hit.sessionId)).json()).data;
  assert.equal(hits.length,3);assert.equal(hits[0].referrer,'https://search.naver.com/search.naver');
  assert.deepEqual(await f.manager.publishedPosts(),[]);
  assert.match(await(await f.request('/admin/statistics/')).text(),/방문통계/);
  assert.match(await(await f.request('/admin/posts/')).text(),/게시글 관리/);
 }finally{f.DB.close();}
});
test('origin allowlist, preflight, malformed requests, disabled sites and methods',async()=>{
 const f=fixture();try{
  assert.equal((await f.send({}, {origin:'https://evil.example'})).status,403);
  assert.equal((await f.send({pageUrl:'https://evil.example/'})).status,400);
  assert.equal((await f.send({pageUrl:origin+'/admin/'})).status,400);
  assert.equal((await f.send({pageViewId:'not-a-uuid'})).status,400);
  assert.equal((await f.send({title:'x'.repeat(17000)})).status,413);
  assert.equal((await f.request('/api/public/track?site_id=clinic')).status,405);
  const preflight=await f.request('/api/public/track?site_id=clinic',{method:'OPTIONS',headers:{origin}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
  const store=analyticsStore(f.DB);await store.saveSite({id:'clinic',name:'중지',domains:['localhost:5180'],active:false});assert.equal((await f.send()).status,403);
 }finally{f.DB.close();}
});
test('API authentication is enforced server-side and site writes require CSRF',async()=>{
 const DB=createSqliteDatabase();try{
  const manager=createPageManager({id:'clinic'},{storage:DB,environment:()=>({ADMIN_PASSWORD:'test-only-password',SITE_URL:'https://clinic.test'}),audit:()=>{}});
  for(const path of ['/api/statistics/overview','/api/statistics/sites','/api/statistics/session?site=clinic&session='+randomUUID()])assert.equal((await manager.fetch(new Request('https://clinic.test'+path))).status,401);
  assert.equal((await manager.fetch(new Request('https://clinic.test/admin/statistics/'))).status,303);
  const login=await manager.fetch(new Request('https://clinic.test/admin/login/'));const cookie=login.headers.get('set-cookie').split(';')[0];const csrf=new URLSearchParams('csrf='+cookie.slice(cookie.indexOf('=')+1)).get('csrf');
  const response=await manager.fetch(new Request('https://clinic.test/admin/login/',{method:'POST',headers:{origin:'https://clinic.test',cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'admin',password:'test-only-password',csrf})}));assert.equal(response.status,303);
  const session=response.headers.get('set-cookie').split(';')[0];const dashboard=await manager.fetch(new Request('https://clinic.test/admin/statistics/',{headers:{cookie:session}}));assert.equal(dashboard.status,200);
  assert.equal((await manager.fetch(new Request('https://clinic.test/api/statistics/overview?period=today',{headers:{cookie:session}}))).status,200);
 }finally{DB.close();}
 const f=fixture();try{
  assert.equal((await f.request('/api/statistics/sites',{method:'POST',headers:{origin},body:new URLSearchParams({id:'second',name:'두 번째',domains:'second.test',active:'yes'})})).status,403);
  const response=await f.request('/api/statistics/sites',{method:'POST',headers:{origin},body:new URLSearchParams({csrf:'local-preview',id:'second',name:'두 번째',domains:'second.test\nwww.second.test',active:'yes'})});assert.equal(response.status,303);
  assert.equal((await(await f.request('/api/statistics/sites')).json()).data.length,2);
 }finally{f.DB.close();}
});
test('calendar ranges use Seoul time, reject invalid dates and enforce max interval',()=>{
 const now=new Date('2026-11-01T15:10:00Z');assert.deepEqual(period(new URLSearchParams('period=today'),now),{start:'2026-11-01T15:00:00.000Z',end:'2026-11-02T15:00:00.000Z',label:'2026-11-02 ~ 2026-11-02 (한국시간)'});
 assert.equal(period(new URLSearchParams('period=last_month'),now).start,'2026-09-30T15:00:00.000Z');
 for(const q of ['period=custom&start=2026-02-30&end=2026-03-02','period=custom&start=2024-01-01&end=2026-01-01','period=custom&start=2026-11-02&end=2026-11-01'])assert.throws(()=>period(new URLSearchParams(q),now));
});
test('return visitors, multi-site identity, bot filtering, pagination and out-of-order exit records',()=>{
 const range={start:'2026-11-01T15:00:00.000Z',end:'2026-11-02T15:00:00.000Z'},hits=[],first={};
 for(let i=0;i<23;i++){const h={kind:'pageview',siteId:'clinic',visitorId:'v'+i,sessionId:'s'+i,pageViewId:'p'+i,createdAt:'2026-11-02T01:00:00.000Z',pageUrl:origin+'/',source:'직접접속',device:'PC',isBot:i===22,bot:i===22?'구글봇':null};hits.push(h);first['clinic:v'+i]=i===0?'2026-10-01T00:00:00.000Z':h.createdAt;}
 hits.unshift({kind:'end',siteId:'clinic',pageViewId:'p0',duration:42,createdAt:'2026-11-02T01:01:00.000Z'});
 const data=aggregate(hits,first,range,{sessionPage:2});assert.equal(data.overview.visitors,22);assert.equal(data.overview.newVisitors,21);assert.equal(data.overview.returningVisitors,1);assert.equal(data.overview.avgDurationSeconds,42);assert.equal(data.sessions.length,2);assert.equal(data.pagination.pages,2);
 assert.equal(aggregate(hits,first,range,{visitorType:'bot'}).overview.visitors,1);
 assert.equal(deviceInfo('Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile',false).os,'Android');
});
test('Supabase adapter paginates all records, uses dedicated tables and never sends browser roles',async()=>{
 const calls=[];const fake=async(url,options)=>{calls.push({url:new URL(url),options});const u=new URL(url);if(options.method==='POST')return new Response(null,{status:201});if(u.pathname.endsWith('/pm_analytics_hits')){const offset=Number(u.searchParams.get('offset'));return Response.json(Array.from({length:offset===0?500:offset===500?1:0},(_,i)=>({data:{id:offset+i}})));}return Response.json([]);};
 const db=createSupabaseDatabase({url:'https://example.supabase.co',secretKey:'sb_secret_test',fetchImpl:fake});const hits=await db.analytics.hits({site:'clinic',start:'2026-11-01T00:00:00.000Z',end:'2026-11-02T00:00:00.000Z'});assert.equal(hits.length,501);assert.equal(calls[1].url.searchParams.get('offset'),'500');assert.equal(calls[0].options.headers.apikey,'sb_secret_test');assert.match(calls[0].url.searchParams.get('and'),/created_at.gte/);
 await db.analytics.addHit({id:'clinic:pageview:id',siteId:'clinic',visitorId:randomUUID(),sessionId:randomUUID(),createdAt:new Date().toISOString()});assert.match(calls[3].url.pathname,/rpc\/pm_analytics_ingest$/);assert.equal(JSON.parse(calls[3].options.body).hit.siteId,'clinic');
});
test('Supabase data survives a fresh Vercel manager instance; provider IP and sub-limit pagination work',async()=>{
 const tables={pm_analytics_sites:[],pm_analytics_hits:[],pm_analytics_visitors:[]};
 const fetchImpl=async(input,options={})=>{
  const u=new URL(input),table=u.pathname.split('/').at(-1),body=options.body?JSON.parse(options.body):null;
  if(table==='pm_analytics_ingest'){const h=body.hit;if(!tables.pm_analytics_hits.some(r=>r.id===h.id))tables.pm_analytics_hits.push({id:h.id,data:h,created_at:h.createdAt});if(!tables.pm_analytics_visitors.some(r=>r.visitor_id===h.visitorId))tables.pm_analytics_visitors.push({site_id:h.siteId,visitor_id:h.visitorId,first_seen_at:h.createdAt});return new Response(null,{status:204});}
  if(options.method==='POST'){const old=tables[table].findIndex(r=>r.id===body.id);if(old<0)tables[table].push(body);else tables[table][old]=body;return new Response(null,{status:201});}
  let rows=tables[table]||[];if(u.searchParams.get('id'))rows=rows.filter(r=>r.id===u.searchParams.get('id').slice(3));const offset=Number(u.searchParams.get('offset')||0);return Response.json(rows.slice(offset,offset+2));
 };
 const environment=()=>({VERCEL:'1',SITE_URL:'https://clinic.test',SUPABASE_URL:'https://db.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test',ADMIN_PASSWORD:'test-only'});
 const make=()=>createPageManager({id:'clinic'},{fetchImpl,environment});
 for(let i=0;i<5;i++)assert.equal((await make().fetch(new Request('https://clinic.test/api/public/track?site_id=clinic',{method:'POST',headers:{origin:'https://clinic.test','content-type':'application/json','user-agent':'Chrome/120','x-vercel-forwarded-for':'203.0.113.5','x-forwarded-for':'192.0.2.9'},body:JSON.stringify({kind:'pageview',visitorId:randomUUID(),sessionId:randomUUID(),pageViewId:randomUUID(),hitId:randomUUID(),pageUrl:'https://clinic.test/'})}))).status,204);
 const db=createSupabaseDatabase({url:'https://db.supabase.co',secretKey:'sb_secret_test',fetchImpl});const hits=await db.analytics.hits({site:'clinic'});assert.equal(hits.length,5);assert.equal(hits[0].ip,'203.0.113.5');assert.equal(tables.pm_analytics_visitors.length,5);
});
