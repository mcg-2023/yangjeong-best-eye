import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdir,unlink} from 'node:fs/promises';
import {createApp} from '../src/app.js';
import {adapt} from '../scripts/sqlite-adapter.mjs';
import {markdown,validatePost,relatedPosts} from '../src/content.js';
import {home} from '../src/views.js';

const sql=await readFile('drizzle/0000_posts.sql','utf8');
function setup(){const db=new DatabaseSync(':memory:');db.exec(sql);const app=createApp();const env={DB:adapt(db),LOCAL_PREVIEW:true};const get=(path,overrides=env)=>app.fetch(new Request('https://clinic.test'+path),overrides);const save=(fields,origin='https://clinic.test')=>app.fetch(new Request('https://clinic.test/api/posts',{method:'POST',headers:{origin,Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields)}),env);return {db,env,get,save};}
const notice={title:'게시판 기능 확인용 안내',category:'notice',body:'## 안내\n저장과 발행을 확인하는 테스트입니다.',excerpt:'게시판 동작 확인',author:'테스트 작성자',status:'draft'};
test('drafts are private; publication, edit, search, feed and withdrawal share one persisted record',async()=>{const {db,get,save}=setup();try{
  let r=await save(notice);assert.equal(r.status,200);const {id}=await r.json();
  assert.equal((await get('/health/'+id+'/')).status,404);
  assert.doesNotMatch(await (await get('/health/')).text(),/게시판 기능 확인용 안내/);
  assert.match(await (await get('/admin/')).text(),/게시판 기능 확인용 안내/);
  r=await save({...notice,id,status:'published'});assert.equal(r.status,200);
  const page=await (await get('/health/'+id+'/')).text();assert.match(page,/<h1>게시판 기능 확인용 안내<\/h1>/);assert.match(page,/BlogPosting/);assert.match(page,/section-1/);
  assert.match(await (await get('/health/?q=기능')).text(),/게시판 기능 확인용 안내/);
  assert.match(await (await get('/feed.xml')).text(),/<item>/);assert.match(await (await get('/sitemap.xml')).text(),new RegExp(id));
  r=await save({...notice,id,title:'수정된 안내',status:'published'});assert.equal(r.status,200);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM posts').get().n,1);
  assert.match(await (await get('/health/'+id+'/')).text(),/수정된 안내/);
  r=await save({...notice,id,status:'draft'});assert.equal(r.status,200);assert.equal((await get('/health/'+id+'/')).status,404);assert.doesNotMatch(await (await get('/feed.xml')).text(),new RegExp(id));
}finally{db.close();}});
test('unreviewed medical content cannot be published; explicit review is required on every save',async()=>{const {db,get,save}=setup();try{
 const p={...notice,category:'dry-eye',status:'published',answer:'의료정보 확인용 초안'};
 let r=await save(p);assert.equal(r.status,422);assert.equal(db.prepare('SELECT count(*) AS n FROM posts').get().n,0);
 r=await save({...p,reviewer:'검수 확인용',reviewedAt:'2026-01-01',reviewApproved:'yes',sourcesText:'공식 참고자료 | https://www.nei.nih.gov/'});assert.equal(r.status,200);const {id}=await r.json();
 r=await save({...p,id,body:'변경된 본문',reviewer:'검수 확인용',reviewedAt:'2026-01-01',sourcesText:'공식 참고자료 | https://www.nei.nih.gov/'});assert.equal(r.status,422);
 assert.doesNotMatch(await (await get('/health/'+id+'/')).text(),/변경된 본문/);
}finally{db.close();}});
test('authentication, CSRF, input escaping and status codes are enforced',async()=>{const {db,get,save,env}=setup();try{
 assert.equal((await get('/admin/',{DB:env.DB})).status,403);
 assert.equal((await save(notice,'https://attacker.test')).status,403);
 assert.equal((await get('/unknown/')).status,404);
 assert.equal((await save({...notice,category:'invalid'})).status,422);
 assert.equal((await save({...notice,title:'<script>alert(1)</script>',body:'<img src=x onerror=alert(1)>',status:'published'})).status,200);
 const text=await (await get('/health/')).text();assert.doesNotMatch(text,/<script>alert\(1\)/);assert.match(text,/&lt;script&gt;/);
 assert.doesNotMatch(markdown('<script>alert(1)</script>'),/<script>/);
}finally{db.close();}});
test('removed FAQ, reference and tag fields do not block reviewed publication or erase existing metadata',async()=>{const {db,get,save}=setup();try{
  const html=await (await get('/admin/new/')).text();
  assert.doesNotMatch(html,/질문과 참고자료|name="(?:faqText|sourcesText|tags)"/);
  let response=await save({...notice,category:'dry-eye',status:'published',answer:'검증용 핵심 답변',reviewer:'검수 확인용',reviewedAt:'2026-01-01',reviewApproved:'yes'});
  assert.equal(response.status,200,'reviewed medical posts can publish without removed source inputs');
  response=await save({...notice,faqText:'기존 질문 | 기존 답변',sourcesText:'기존 출처 | https://www.nei.nih.gov/',tags:'기존 태그'});
  const {id}=await response.json();
  response=await save({...notice,id,title:'내용만 수정한 글'});assert.equal(response.status,200);
  const stored=JSON.parse(db.prepare('SELECT data FROM posts WHERE id=?').get(id).data);
  assert.deepEqual(stored.faq,[{question:'기존 질문',answer:'기존 답변'}]);
  assert.deepEqual(stored.sources,[{title:'기존 출처',url:'https://www.nei.nih.gov/'}]);
  assert.deepEqual(stored.tags,['기존 태그']);
}finally{db.close();}});
test('canonical metadata, JSON-LD and crawlable pages are rendered without client JavaScript',async()=>{const {db,get}=setup();try{
 for(const path of ['/','/health/','/clinic/','/location/']){
  const r=await get(path);assert.equal(r.status,200,path);const html=await r.text();assert.equal((html.match(/<h1[\s>]/g)??[]).length,1,path);assert.match(html,/<link rel="canonical"/);assert.match(html,/<meta name="description"/);for(const m of html.matchAll(/<script type="application\/ld\+json">([^]*?)<\/script>/g))JSON.parse(m[1]);
 }
 assert.match(await (await get('/health/?q=test')).text(),/noindex,follow/);
 assert.match(await (await get('/robots.txt')).text(),/Disallow: \/admin\//);
 assert.doesNotMatch(await (await get('/sitemap.xml')).text(),/\/admin\//);
 for(const path of ['/care/','/care/cataract/','/care/dry-eye/','/doctor/jeong-hyeon-cheol/']) assert.equal((await get(path)).status,404,path);
 assert.doesNotMatch(await (await get('/sitemap.xml')).text(),/\/(?:care|doctor)\//);
 const home=await (await get('/')).text(); assert.doesNotMatch(home,/href="\/(?:care|doctor)\//); assert.doesNotMatch(home,/정현철|doctor-section|doctor\.webp|MEET YOUR DOCTOR/); assert.match(home,/눈 건강을 살피는 다섯 가지 진료/);
}finally{db.close();}});
test('server database survives closing and reopening',async()=>{await mkdir('.data',{recursive:true});const path='.data/test-'+crypto.randomUUID()+'.sqlite';let db=new DatabaseSync(path);try{db.exec(sql);db.prepare('INSERT INTO posts VALUES (?,?,?,?)').run('test',JSON.stringify(notice),'draft','2026-01-01');db.close();db=new DatabaseSync(path);assert.equal(db.prepare('SELECT count(*) AS n FROM posts').get().n,1);}finally{db.close();await unlink(path);}});
test('related content is ranked by topic, distinct from newest posts',()=>{const p={id:'a',category:'dry-eye',tags:['screen']};const result=relatedPosts(p,[{id:'b',status:'published',category:'retina',updatedAt:'2026-10-21'},{id:'c',status:'published',category:'dry-eye',updatedAt:'2026-09-01'},{id:'d',status:'draft',category:'dry-eye'}]);assert.deepEqual(result.map(x=>x.id),['c']);});

test('full-width journal features only the latest three published posts, and test posts stay out of search feeds',async()=>{
 const {db,get}=setup();try{
  const posts=[1,2,3,4].map(i=>({...notice,id:`test-journal-0${i}`,status:'published',author:'테스트 작성자',title:`[TEST ${i}] 게시글`,publishedAt:`2026-10-0${i}T00:00:00Z`,updatedAt:`2026-10-0${5-i}T00:00:00Z`}));
  const html=home([...posts,{...posts[0],id:'draft-hidden',title:'미발행 제목',status:'draft',publishedAt:'2026-11-01T00:00:00Z'}]);
  assert.doesNotMatch(html,/journal-sidebar|sidebar-contact|미발행 제목/);
  assert.equal((html.match(/<article[^>]+data-slide /g)??[]).length,3);
  assert.equal((html.match(/<h1[\s>]/g)??[]).length,1);
  assert.ok(html.indexOf('[TEST 4]')<html.indexOf('[TEST 3]'));
  assert.match(html,/journal-post-grid/);assert.match(html,/data-carousel-toggle/);assert.match(html,/hidden inert aria-hidden="true"/);
  for(const p of posts)db.prepare('INSERT INTO posts VALUES (?,?,?,?)').run(p.id,JSON.stringify(p),p.status,p.updatedAt);
  assert.match(await (await get('/health/test-journal-01/')).text(),/noindex,follow/);
  assert.doesNotMatch(await (await get('/sitemap.xml')).text(),/test-journal-/);
  assert.doesNotMatch(await (await get('/feed.xml')).text(),/test-journal-/);
 }finally{db.close();}
});
