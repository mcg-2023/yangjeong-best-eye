import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createVercelHandler} from '../src/vercel-runtime.js';
import {createSupabaseDatabase} from '../src/supabase-database.js';
import {login} from './admin-helper.mjs';

const origin='https://clinic.vercel.app';
test('Vercel accepts pasted domains and recovers invalid SITE_URL without preview canonicals',async t=>{
  const warning=t.mock.method(console,'warn',()=>{});
  const base={SUPABASE_URL:'https://test.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test_only',SITE_INDEXING:'on'};
  const cases=[
    [{SITE_URL:'yangjeong-best-eye.vercel.app'},'https://yangjeong-best-eye.vercel.app'],
    [{SITE_URL:'  "https://clinic.example/"  '},'https://clinic.example'],
    [{SITE_URL:" 'clinic.example/' "},'https://clinic.example'],
    [{SITE_URL:'not a URL',VERCEL_PROJECT_PRODUCTION_URL:'clinic.example'},'https://clinic.example'],
    [{SITE_URL:'https://private-user:private-password@clinic.example/',VERCEL_PROJECT_PRODUCTION_URL:'clinic.example'},'https://clinic.example'],
    [{SITE_URL:'https://clinic.example/path',VERCEL_PROJECT_PRODUCTION_URL:'clinic.example'},'https://clinic.example'],
    [{SITE_URL:'javascript:alert(1)',VERCEL_PROJECT_PRODUCTION_URL:'clinic.example'},'https://clinic.example'],
    [{VERCEL_PROJECT_PRODUCTION_URL:'clinic.example'},'https://clinic.example'],
    [{SITE_URL:'bad value',VERCEL_PROJECT_PRODUCTION_URL:'bad value'},'https://yangjeong-best-eye.vercel.app'],
    [{SITE_URL:'https://yangjeong-best-kpohzvd4t-mcg24.vercel.app',VERCEL_PROJECT_PRODUCTION_URL:'yangjeong-best-eye.vercel.app'},'https://yangjeong-best-eye.vercel.app'],
    [{SITE_URL:'yangjeong-best-eye-git-main-mcg24.vercel.app',VERCEL_PROJECT_PRODUCTION_URL:'yangjeong-best-kpohzvd4t-mcg24.vercel.app'},'https://yangjeong-best-eye.vercel.app'],
  ];
  for(const [config,expected] of cases){
    const handler=createVercelHandler({environment:()=>({...base,...config}),fetchImpl:async()=>Response.json([])});
    for(const path of ['/','/clinic/','/location/','/robots.txt','/sitemap.xml','/feed.xml']){
      const response=await handler(new Request('https://private-preview.vercel.app'+path));
      assert.equal(response.status,200,JSON.stringify({config,path}));
      const body=await response.text();
      assert.ok(body.includes(expected+'/'),path+' uses the stable production origin');
      assert.doesNotMatch(body,/private-preview\.vercel\.app|private-user|private-password/);
      if(path.endsWith('/')){
        assert.ok(body.includes('<link rel="canonical" href="'+expected+path+'">'));
        assert.equal(response.headers.get('x-robots-tag'),'noindex, follow');
      }
    }
  }
  assert.equal(warning.mock.callCount(),7,'invalid or temporary settings warn once per handler');
  assert.doesNotMatch(JSON.stringify(warning.mock.calls),/private-user|private-password/);
});

test('Vercel requires its own admin authentication, preserves drafts, and writes through Supabase',async()=>{
  const rows=new Map(),calls=[];
  const fetchImpl=async(input,options)=>{
    const url=new URL(input);calls.push({url,options});
    assert.equal(options.headers.apikey,'sb_secret_test_only');
    if(options.method==='DELETE'){
      assert.equal(url.searchParams.get('id'),'eq.'+[...rows.keys()][0]);
      assert.equal(options.headers.Prefer,'return=minimal');
      rows.delete(url.searchParams.get('id').slice(3));return new Response(null,{status:204});
    }
    if(options.method==='POST'){
      const row=JSON.parse(options.body);rows.set(row.id,row);
      assert.equal(options.headers.Prefer,'resolution=merge-duplicates,return=minimal');
      return new Response(null,{status:204});
    }
    const id=url.searchParams.get('id')?.slice(3);
    return Response.json(id?(rows.has(id)?[rows.get(id)]:[]):[...rows.values()]);
  };
  const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test_only',ADMIN_USERNAME:'editor',ADMIN_PASSWORD:'example-password-for-tests',LOCAL_PREVIEW:true};
  const handler=createVercelHandler({environment:()=>env,fetchImpl});
  assert.equal((await handler(new Request(origin+'/admin/',{headers:{'oai-authenticated-user-id':'spoofed'}}))).status,303);
  const {cookie,csrf}=await login(handler,origin);
  const get=(path,headers={})=>handler(new Request(origin+path,{headers:{cookie,...headers}}));
  assert.equal((await get('/admin/')).status,200);
  const fields={title:'배포 연결 확인',body:'## 안내\n저장 상태를 확인합니다.',category:'notice',author:'운영자',excerpt:'배포 확인용',status:'draft'};
  const save=(extra={},site=origin)=>handler(new Request(origin+'/api/posts',{method:'POST',headers:{cookie,origin:site,Accept:'application/json'},body:new URLSearchParams({...fields,csrf,...extra})}));
  assert.equal((await save({},'https://other.example')).status,403);
  let response=await save();assert.equal(response.status,200);
  const {id}=await response.json();
  assert.equal((await get('/health/'+id+'/')).status,404);
  assert.doesNotMatch(await (await get('/health/')).text(),/배포 연결 확인/);
  response=await save({id,status:'published'});assert.equal(response.status,200);
  assert.equal(rows.size,1);
  const reopened=createVercelHandler({environment:()=>env,fetchImpl});
  response=await reopened(new Request(origin+'/health/'+id+'/'));
  assert.equal(response.status,200);
  const html=await response.text();assert.match(html,/배포 연결 확인/);assert.doesNotMatch(html,/sb_secret_test_only|example-password-for-tests/);
  assert.match(html,/noindex,follow/);
  const deleted=await handler(new Request(origin+'/api/posts/delete',{method:'POST',headers:{cookie,origin,Accept:'application/json'},body:new URLSearchParams({id,csrf,confirmDelete:'yes'})}));
  assert.equal(deleted.status,200);assert.equal(rows.size,0);
  assert.equal((await get('/health/'+id+'/')).status,404);
  assert.ok(calls.every(call=>call.url.origin==='https://test.supabase.co'));
});

test('missing production credentials fail closed and do not enable ephemeral database writes',async()=>{
  let calls=0;
  const handler=createVercelHandler({environment:()=>({}),fetchImpl:async()=>{calls++;throw new Error('Unexpected request');}});
  assert.equal((await handler(new Request(origin+'/'))).status,503);
  assert.equal((await handler(new Request(origin+'/admin/'))).status,503);
  assert.equal(calls,0);
  assert.throws(()=>createSupabaseDatabase({url:'https://test.supabase.co',secretKey:'sb_publishable_test'}),/server secret/);
});

test('Supabase pagination reads beyond one API page and transport failures do not disclose secrets',async()=>{
  let page=0;
  const database=createSupabaseDatabase({url:'https://test.supabase.co',secretKey:'sb_secret_test_only',fetchImpl:async(input)=>{
    const url=new URL(input);assert.equal(Number(url.searchParams.get('offset')),page*100);
    const count=page++===0?100:1;
    return Response.json(Array.from({length:count},(_,i)=>({data:{id:String((page-1)*100+i)}})));
  }});
  assert.equal((await database.posts.list()).length,101);
  const failing=createSupabaseDatabase({url:'https://test.supabase.co',secretKey:'sb_secret_test_only',fetchImpl:async()=>new Response('private backend message',{status:500})});
  await assert.rejects(()=>failing.posts.list(),error=>error.message==='Supabase posts request failed: 500');
});
