import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPageManager,definePageManager,repository} from '../packages/page-manager/src/index.js';
import {createSqliteDatabase} from '../packages/page-manager/src/sqlite-database.js';
import {readFile} from 'node:fs/promises';

const credentials={ADMIN_USERNAME:'editor',ADMIN_PASSWORD:'test-only-unique-password',SITE_INDEXING:'off'};
const config=(id,siteName,categories)=>({id,siteName,categories,theme:{primary:'#216954',dark:'#164536',pale:'#edf8f4'}});
async function signIn(manager,origin){
  let response=await manager.fetch(new Request(origin+'/admin/login/'));
  const html=await response.text(),csrf=html.match(/name="csrf" value="([^"]+)"/)[1],cookie=response.headers.getSetCookie()[0].split(';')[0];
  response=await manager.fetch(new Request(origin+'/admin/login/',{method:'POST',headers:{origin,cookie},body:new URLSearchParams({csrf,username:credentials.ADMIN_USERNAME,password:credentials.ADMIN_PASSWORD})}));
  const session=response.headers.getSetCookie().find(c=>c.includes('_admin_session=')).split(';')[0];
  const editor=await (await manager.fetch(new Request(origin+'/admin/new/',{headers:{cookie:session}}))).text();
  return {cookie:session,csrf:editor.match(/name="csrf" value="([^"]+)"/)[1],editor};
}

test('two independent websites share one module without brand, category, authentication or storage leakage',async()=>{
  const firstDB=createSqliteDatabase(),secondDB=createSqliteDatabase();
  const first=createPageManager(config('first_site','첫 번째 홈페이지',[{slug:'news',name:'새 소식'}]),{storage:firstDB,environment:()=>credentials,audit:()=>{}});
  const second=createPageManager(config('second_site','두 번째 스튜디오',[{slug:'portfolio',name:'작업 기록'}]),{storage:secondDB,environment:()=>credentials,audit:()=>{}});
  const origin='https://example.test';
  try{
    assert.equal(await first.fetch(new Request(origin+'/contact/')),null);
    const a=await signIn(first,origin),b=await signIn(second,origin);
    assert.match(a.editor,/첫 번째 홈페이지/);assert.match(a.editor,/새 소식/);assert.doesNotMatch(a.editor,/두 번째|양정|안과|의료|의학|field-reviewer/);
    assert.match(b.editor,/두 번째 스튜디오/);assert.match(b.editor,/작업 기록/);assert.doesNotMatch(b.editor,/첫 번째|새 소식/);
    assert.match(a.editor,/--brand:#216954/);assert.match(a.editor,/\/page-manager\/editor.js/);assert.doesNotMatch(a.editor,/href="\/style.css|src="\/client.js/);
    const wrongName=a.cookie.replace('__Host-first_site_admin_session=','__Host-second_site_admin_session=');
    assert.equal((await second.fetch(new Request(origin+'/admin/',{headers:{cookie:wrongName}}))).status,303);
    const fields={title:'모듈 발행 확인',category:'news',bodyFormat:'html',body:'<h2>소식</h2><p>공통 모듈의 글입니다.</p>',excerpt:'새로운 이야기',author:'운영자',status:'published',csrf:a.csrf};
    const save=extra=>first.fetch(new Request(origin+'/api/posts',{method:'POST',headers:{origin,cookie:a.cookie,Accept:'application/json'},body:new URLSearchParams({...fields,...extra})}));
    assert.equal((await save({category:'portfolio'})).status,422);
    const saved=await save();assert.equal(saved.status,200);const {id}=await saved.json();
    assert.equal((await first.publishedPosts()).length,1);assert.equal((await second.publishedPosts()).length,0);
    const post=(await first.publishedPosts())[0];assert.equal(post.id,id);assert.equal(post.cover,undefined);assert.equal(post.inlineImages,undefined);assert.equal(post.reviewApproved,undefined);
    assert.equal((await save({id,status:'draft'})).status,200);assert.equal((await first.publishedPosts()).length,0);
    assert.equal((await repository(firstDB).get(id)).status,'draft');
  }finally{firstDB.close();secondDB.close();}
});

test('portable module preserves review gates, rejects unsafe configuration, and never enables preview on a public origin',async()=>{
  const DB=createSqliteDatabase();
  const reviewConfig={id:'review_site',siteName:'검수 사이트',categories:[{slug:'reviewed',name:'검수 글',reviewRequired:true}],review:{enabled:true,label:'내용 검수'}};
  const manager=createPageManager(reviewConfig,{storage:DB,environment:()=>credentials,localPreview:true,audit:()=>{}}),origin='https://public.test';
  try{
    assert.equal((await manager.fetch(new Request(origin+'/admin/'))).status,303);
    const {cookie,csrf,editor}=await signIn(manager,origin);assert.match(editor,/field-reviewer/);assert.match(editor,/내용 검수자/);
    const response=await manager.fetch(new Request(origin+'/api/posts',{method:'POST',headers:{origin,cookie,Accept:'application/json'},body:new URLSearchParams({title:'검수 글',category:'reviewed',body:'본문',excerpt:'요약',author:'운영자',status:'published',csrf})}));
    assert.equal(response.status,422);assert.match((await response.json()).errors.join(' '),/검수/);
    const production=createPageManager(reviewConfig,{storage:DB,localPreview:true,environment:()=>({...credentials,NODE_ENV:'production',LOCAL_PREVIEW:true,ADMIN_AUTHENTICATED:true}),audit:()=>{}});
    assert.equal((await production.fetch(new Request('http://127.0.0.1/admin/'))).status,303);
    const local=createPageManager({id:'local_only'},{storage:DB,localPreview:true,environment:()=>({})});
    assert.equal((await local.fetch(new Request('http://127.0.0.1/admin/'))).status,200);
    assert.equal((await manager.fetch(new Request(origin+'/admin/new/',{method:'HEAD',headers:{cookie}}))).body,null);
    assert.throws(()=>definePageManager({theme:{primary:'red;position:fixed'}}),/hex/);
    assert.throws(()=>definePageManager({logo:'javascript:alert(1)'}),/URLs/);
    assert.throws(()=>definePageManager({categories:[{slug:'a',name:'A'},{slug:'a',name:'B'}]}),/unique/);
    assert.throws(()=>definePageManager({...reviewConfig,review:{enabled:false}}),/Review/);
  }finally{DB.close();}
});

test('the kit has no imports from the host and production schema includes the server delete privilege',async()=>{
  const source=await readFile('packages/page-manager/src/admin-views.js','utf8');assert.doesNotMatch(source,/hospital.js|\.\.\/\.\.\/src|양정|안과/);
  assert.match(await readFile('packages/page-manager/migrations/supabase.sql','utf8'),/grant select, insert, update, delete on public.posts to service_role/);
});
