import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {createAdminAccess} from '../src/admin-auth.js';
import {createApp} from '../src/app.js';
import {adapt} from '../scripts/sqlite-adapter.mjs';
import {validCover} from '../src/content.js';

const origin='https://clinic.test',env={ADMIN_USERNAME:'owner-hidden',ADMIN_PASSWORD:'private-test-password'};
const get=(path,headers={})=>new Request(origin+path,{headers});
const post=(path,fields={},headers={})=>new Request(origin+path,{method:'POST',headers:{origin,...headers},body:new URLSearchParams(fields)});
async function begin(access,credentials=env){
  const {response}=await access(get('/admin/login/'),credentials),html=await response.text();
  const csrf=html.match(/name="csrf" value="([^"]+)"/)[1],cookie=response.headers.getSetCookie()[0].split(';')[0];
  return {csrf,cookie,html};
}
async function authenticate(access,credentials=env){
  const start=await begin(access,credentials);
  const {response}=await access(post('/admin/login/',{csrf:start.csrf,username:credentials.ADMIN_USERNAME,password:credentials.ADMIN_PASSWORD},{cookie:start.cookie}),credentials);
  assert.equal(response.status,303);
  const cookie=response.headers.getSetCookie().find(c=>c.startsWith('__Host-yjbest_admin_session=')).split(';')[0];
  const {context}=await access(get('/admin/',{cookie}),credentials);
  return {cookie,csrf:context.CSRF_TOKEN,response};
}
test('login cookies cannot authenticate, unknown users get the same error, and sessions expire or invalidate after a credential change',async()=>{
  let clock=1800000000000;const logs=[],access=createAdminAccess({now:()=>clock,audit:event=>logs.push(event)});
  const start=await begin(access);
  const protectedPage=(await import('../src/admin-views.js')).adminLayout({title:'확인',body:'관리자'});
  assert.equal(protectedPage.headers.get('x-frame-options'),'DENY');
  assert.match(protectedPage.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  assert.doesNotMatch(start.html,/owner-hidden|private-test-password/);
  assert.doesNotMatch(Buffer.from(start.csrf.split('.')[0],'base64url').toString(),/owner-hidden|private-test-password/);
  const spoof=start.cookie.replace('__Host-yjbest_admin_login=','__Host-yjbest_admin_session=');
  assert.equal((await access(get('/admin/',{cookie:spoof}),env)).response.status,303);
  const messages=[];
  for(const username of ['nonexistent','owner-hidden']){
    const {response}=await access(post('/admin/login/',{csrf:start.csrf,username,password:'incorrect'},{cookie:start.cookie}),env);
    assert.equal(response.status,401);messages.push((await response.text()).match(/role="alert">([^<]+)/)[1]);
  }
  assert.equal(messages[0],messages[1]);
  assert.equal((await access(post('/admin/login/',{username:'owner-hidden',password:env.ADMIN_PASSWORD},{cookie:start.cookie}),env)).response.status,403);
  const first=await authenticate(access),second=await authenticate(access);
  assert.notEqual(first.cookie,second.cookie,'each login gets a new random session');
  assert.match(first.response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
  assert.equal((await access(get('/admin/',{cookie:first.cookie}),{...env,ADMIN_PASSWORD:'changed-password'})).response.status,303);
  assert.equal((await access(get('/admin/',{cookie:first.cookie+'tampered'}),env)).response.status,303);
  clock+=8*60*60*1000;
  assert.equal((await access(get('/api/posts',{cookie:first.cookie}),env)).response.status,401);
  assert.doesNotMatch(JSON.stringify(logs),/private-test-password|incorrect|owner-hidden|nonexistent/);
});
test('all protected mutations require a session and CSRF token; logout only accepts POST; return paths stay on this site',async()=>{
  const access=createAdminAccess({audit:()=>{}}),session=await authenticate(access);
  assert.equal((await access(post('/api/posts',{}),env)).response.status,401);
  assert.equal((await access(post('/api/posts',{}, {cookie:session.cookie}),env)).response.status,403);
  assert.equal((await access(post('/api/posts',{csrf:session.csrf},{cookie:session.cookie,origin:'https://attacker.example'}),env)).response.status,403);
  assert.equal((await access(post('/api/posts',{csrf:session.csrf},{cookie:session.cookie}),env)).context.ADMIN_AUTHENTICATED,true);
  assert.equal((await access(post('/api/posts/delete',{id:'post',confirmDelete:'yes'}),env)).response.status,401);
  assert.equal((await access(post('/api/posts/delete',{id:'post',confirmDelete:'yes'},{cookie:session.cookie}),env)).response.status,403);
  assert.equal((await access(get('/admin/logout/',{cookie:session.cookie}),env)).response.status,405);
  assert.equal((await access(post('/admin/logout/',{}, {cookie:session.cookie}),env)).response.status,403);
  const logout=await access(post('/admin/logout/',{csrf:session.csrf},{cookie:session.cookie}),env);
  assert.equal(logout.response.status,303);assert.ok(logout.response.headers.getSetCookie().every(c=>c.includes('Max-Age=0')));
  const start=await begin(access);
  const result=await access(post('/admin/login/',{csrf:start.csrf,username:env.ADMIN_USERNAME,password:env.ADMIN_PASSWORD,next:'//attacker.example'},{cookie:start.cookie}),env);
  assert.equal(result.response.headers.get('location'),'/admin/');
});
test('repeated failed logins back off without exposing account names',async()=>{
  const access=createAdminAccess({audit:()=>{}}),start=await begin(access);
  for(let n=0;n<8;n++)assert.equal((await access(post('/admin/login/',{csrf:start.csrf,username:'wrong',password:'wrong'},{cookie:start.cookie}),env)).response.status,401);
  const {response}=await access(post('/admin/login/',{csrf:start.csrf,username:'wrong',password:'wrong'},{cookie:start.cookie}),env);
  assert.equal(response.status,429);assert.ok(Number(response.headers.get('retry-after'))>0);
});
test('management filters and pagination use real posts; archive hides a post and restoration never publishes it',async()=>{
  const db=new DatabaseSync(':memory:');db.exec(await readFile('drizzle/0000_posts.sql','utf8'));
  const DB=adapt(db),app=createApp(),settings={DB,LOCAL_PREVIEW:true,CSRF_TOKEN:'test-csrf'};
  const fetchPage=(path)=>app.fetch(get(path),settings);
  try{
    for(let i=0;i<14;i++){
      const p={id:'admin-fixture-'+i,title:'관리 확인 '+String(i).padStart(2,'0'),body:'내용',excerpt:'요약',author:'운영자',category:i===0?'dry-eye':'notice',status:i===0?'medical_review':'published',updatedAt:'2026-10-22T00:00:00Z',publishedAt:'2026-10-22T00:00:00Z'};
      db.prepare('INSERT INTO posts VALUES (?,?,?,?)').run(p.id,JSON.stringify(p),p.status,p.updatedAt);
    }
    let r=await fetchPage('/admin/posts/?status=medical_review&q=00&category=dry-eye');
    assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow');
    let html=await r.text();assert.match(html,/관리 확인 00/);assert.doesNotMatch(html,/관리 확인 01/);assert.match(html,/name="csrf" value="test-csrf"/);
    html=await (await fetchPage('/admin/posts/?q=%3Cscript%3E')).text();assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
    html=await (await fetchPage('/admin/posts/?page=2')).text();assert.equal((html.match(/class="desk-post-title"/g)||[]).length,2);
    assert.equal((await app.fetch(post('/api/posts/status',{id:'admin-fixture-1',status:'archived'}),settings)).status,403);
    const change=status=>app.fetch(post('/api/posts/status',{id:'admin-fixture-1',status,csrf:'test-csrf'},{Accept:'application/json'}),settings);
    assert.equal((await change('published')).status,400);
    assert.equal((await change('archived')).status,200);
    assert.equal((await fetchPage('/health/admin-fixture-1/')).status,404);
    assert.doesNotMatch(await (await fetchPage('/sitemap.xml')).text(),/admin-fixture-1\//);
    assert.equal((await change('draft')).status,200);
    assert.equal((await fetchPage('/health/admin-fixture-1/')).status,404);
    for(const path of ['/admin/','/admin/new/','/admin/settings/','/admin/edit/admin-fixture-1/','/admin/preview/admin-fixture-1/'])assert.equal((await fetchPage(path)).status,200,path);
  }finally{db.close();}
});
test('image validation checks file signatures instead of trusting MIME or extension',async()=>{
  assert.equal(validCover('data:image/png;base64,'+Buffer.from('<?php echo "bad";').toString('base64')),false);
  assert.equal(validCover('data:image/webp;base64,'+Buffer.from('<svg onload="bad()"/>').toString('base64')),false);
  assert.equal(validCover('data:image/svg+xml;base64,PHN2Zy8+'),false);
  for(const file of ['medical05.webp','quick-blog.png']){
    const path='public/assets/'+file;
    const bytes=await readFile(path);assert.equal(validCover('data:image/'+(file.endsWith('png')?'png':'webp')+';base64,'+bytes.toString('base64')),true);
  }
});

test('confirmed deletion removes only the selected post and its media; public pages contain no admin controls',async()=>{
  const db=new DatabaseSync(':memory:');db.exec(await readFile('drizzle/0000_posts.sql','utf8'));
  const settings={DB:adapt(db),LOCAL_PREVIEW:true,CSRF_TOKEN:'delete-csrf'},app=createApp();
  const page=path=>app.fetch(get(path),settings);
  const remove=(fields={},headers={})=>app.fetch(post('/api/posts/delete',{id:'delete-fixture',confirmDelete:'yes',csrf:'delete-csrf',...fields},{Accept:'application/json',...headers}),settings);
  try{
    for(const path of ['/','/health/','/health/category/notice/','/clinic/','/location/'])assert.doesNotMatch(await (await page(path)).text(),/href="\/admin\//,path+' has no admin links, including empty collections');
    const image='data:image/png;base64,'+(await readFile('public/assets/favicon.png')).toString('base64');
    for(const id of ['delete-fixture','keep-fixture']){
      const p={id,title:id,category:'notice',author:'운영자',body:'## 안내\n본문',status:'published',excerpt:'요약',updatedAt:'2026-10-22T00:00:00Z',publishedAt:'2026-10-22T00:00:00Z',cover:image,imageAlt:'병원 로고',inlineImages:[{id:'inline-fixture',data:image,alt:'병원 로고'}]};
      db.prepare('INSERT INTO posts VALUES (?,?,?,?)').run(id,JSON.stringify(p),p.status,p.updatedAt);
    }
    assert.equal((await page('/api/posts/delete')).status,405);
    assert.equal((await remove({csrf:''})).status,403);
    assert.equal((await remove({confirmDelete:''})).status,400);
    assert.equal((await remove({}, {origin:'https://attacker.example'})).status,403);
    const html=await (await page('/admin/delete/delete-fixture/')).text();
    assert.match(html,/delete-fixture/);assert.match(html,/복구할 수 없습니다/);assert.match(html,/name="confirmDelete" value="yes" required/);assert.match(html,/name="csrf" value="delete-csrf"/);
    assert.match(await (await page('/admin/posts/')).text(),/href="\/admin\/delete\/delete-fixture\/"/);
    assert.match(await (await page('/admin/edit/delete-fixture/')).text(),/href="\/admin\/delete\/delete-fixture\/"/);
    for(const path of ['/','/health/','/health/delete-fixture/'])assert.doesNotMatch(await (await page(path)).text(),/href="\/admin\//,path+' has no admin links when populated');
    for(const path of ['/health/delete-fixture/','/media/delete-fixture/cover','/media/delete-fixture/inline/inline-fixture'])assert.equal((await page(path)).status,200);
    const result=await remove();assert.equal(result.status,200);assert.equal((await result.json()).url,'/admin/posts/?deleted=1');
    assert.equal(db.prepare('SELECT id FROM posts WHERE id = ?').get('delete-fixture'),undefined);
    for(const path of ['/health/delete-fixture/','/media/delete-fixture/cover','/media/delete-fixture/inline/inline-fixture','/admin/edit/delete-fixture/','/admin/delete/delete-fixture/'])assert.equal((await page(path)).status,404,path);
    for(const path of ['/','/health/','/sitemap.xml','/feed.xml','/admin/posts/'])assert.doesNotMatch(await (await page(path)).text(),/delete-fixture/);
    assert.equal((await page('/health/keep-fixture/')).status,200);
    assert.equal((await remove()).status,404);
  }finally{db.close();}
});
