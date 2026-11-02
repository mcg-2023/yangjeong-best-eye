import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/app.js';
import {createVercelHandler} from '../src/vercel-runtime.js';
import {createSqliteDatabase} from '../packages/page-manager/src/sqlite-database.js';
import {login} from './admin-helper.mjs';

test('clinic host collects public visits, renders analytics, and keeps analytics out of posts and sitemap',async()=>{
  const DB=createSqliteDatabase(),app=createApp(),origin='http://localhost:5173';
  const env={DB,LOCAL_PREVIEW:true,CSRF_TOKEN:'local-preview'};
  const get=path=>app.fetch(new Request(origin+path),env);
  const payload={kind:'pageview',hitId:randomUUID(),visitorId:randomUUID(),sessionId:randomUUID(),pageViewId:randomUUID(),pageUrl:origin+'/',title:'홈페이지 확인'};
  const send=(patch={},extra={})=>app.fetch(new Request(origin+'/api/public/track?site_id=yjbest',{method:'POST',headers:{origin,'content-type':'application/json','user-agent':'Chrome/120'},body:JSON.stringify({...payload,...patch})}),{...env,...extra});
  try{
    assert.match(await (await get('/')).text(),/tracker\.js\?v=1\.2\.0-clinic\.6" data-site-id="yjbest"/);
    assert.equal((await send()).status,204);
    assert.equal((await send({kind:'event',eventName:'전화문의'})).status,204);
    const overview=await (await get('/api/statistics/overview?period=today')).json();
    assert.equal(overview.data.overview.pageViews,1);
    assert.equal(overview.data.events[0].name,'전화문의');
    const sites=await (await get('/api/statistics/sites')).json();
    assert.deepEqual(sites.data[0].domains,['localhost:5173']);
    for(const path of ['/admin/statistics/','/admin/sites/','/admin/statistics/session/']){
      const response=await get(path);assert.equal(response.status,200);
      assert.doesNotMatch(await response.text(),/src="\/page-manager\/tracker/);
    }
    assert.doesNotMatch(await (await get('/sitemap.xml')).text(),/statistics|analytics|\/api\/|\/admin\//);
    assert.deepEqual((await DB.prepare('SELECT * FROM posts').all()).results,[]);
    const privacy=await (await get('/privacy/')).text();
    assert.match(privacy,/홈페이지 방문통계/);assert.doesNotMatch(privacy,/방문자 분석 추적 스크립트는 설치하지/);
  }finally{DB.close();}
});

test('Vercel collector bypasses only public collection auth; stats, posts and settings remain protected',async()=>{
  const sites=new Map(),hits=[];
  const environment=()=>({VERCEL:'1',SITE_URL:'https://clinic.test',SUPABASE_URL:'https://test.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test_only',ADMIN_USERNAME:'editor',ADMIN_PASSWORD:'example-password-for-tests'});
  const fetchImpl=async(input,options={})=>{
    const url=new URL(input),table=url.pathname.split('/').at(-1);
    if(table==='pm_analytics_sites'){
      if(options.method==='POST'){const row=JSON.parse(options.body);sites.set(row.id,row);return new Response(null,{status:201});}
      if(Number(url.searchParams.get('offset'))>0)return Response.json([]);
      const id=url.searchParams.get('id')?.slice(3);
      return Response.json(id?(sites.has(id)?[sites.get(id)]:[]):[...sites.values()]);
    }
    if(table==='pm_analytics_ingest'){hits.push(JSON.parse(options.body).hit);return new Response(null,{status:204});}
    return Response.json([]);
  };
  const handler=createVercelHandler({environment,fetchImpl}),origin='https://clinic.test';
  for(const path of ['/api/statistics/overview','/api/statistics/sites','/api/posts'])assert.equal((await handler(new Request(origin+path))).status,401);
  assert.equal((await handler(new Request(origin+'/admin/statistics/'))).status,303);
  const hit={kind:'pageview',hitId:randomUUID(),visitorId:randomUUID(),sessionId:randomUUID(),pageViewId:randomUUID(),pageUrl:origin+'/'};
  const send=(source=origin)=>handler(new Request(origin+'/api/public/track?site_id=yjbest',{method:'POST',headers:{origin:source,'content-type':'application/json','x-vercel-forwarded-for':'203.0.113.5','x-forwarded-for':'192.0.2.4'},body:JSON.stringify(hit)}));
  assert.equal((await send()).status,204);assert.equal(hits[0].ip,'203.0.113.5');
  assert.equal((await send('https://evil.test')).status,403);assert.equal(hits.length,1);
  assert.equal((await handler(new Request(origin+'/api/public/track?site_id=yjbest',{method:'OPTIONS',headers:{origin}}))).status,204);
  const {cookie,csrf}=await login(handler,origin);
  assert.equal((await handler(new Request(origin+'/admin/statistics/',{headers:{cookie}}))).status,200);
  const save=(token,source=origin)=>handler(new Request(origin+'/api/statistics/sites',{method:'POST',headers:{origin:source,cookie},body:new URLSearchParams({csrf:token,id:'yjbest',name:'양정베스트안과',domains:'clinic.test',active:'yes'})}));
  assert.equal((await save('invalid')).status,403);
  assert.equal((await save(csrf,'https://evil.test')).status,403);
  assert.equal((await save(csrf)).status,303);
});
