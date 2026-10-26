import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {articleHtml,videoSource,mediaWidth} from '../src/html-content.js';
import {createApp} from '../src/app.js';
import {adapt} from '../scripts/sqlite-adapter.mjs';
import {homeMetadata,hospital} from '../src/hospital.js';
import {articleSchema} from '../src/seo.js';

test('HTML supports useful formatting while dropping scripts, foreign namespaces, unsafe URLs and event attributes',()=>{
  const raw='<h1 onclick="bad()">제목</h1><p style="color:navy;font-size:8px;position:fixed;background:url(https://evil.example)">본문 <strong>강조</strong></p><script>bad()</script><svg><a href="javascript:bad()">숨김</a></svg><math><mtext>숨김</mtext></math><a href="java&#x73;cript:bad()">링크</a><a href="/location/" onmouseover="bad()">위치</a><img src="data:text/html;base64,PHNjcmlwdD4=" onerror="bad()"><iframe src="https://evil.example/"></iframe><table><tr><th>항목</th><td>내용</td></tr></table>';
  const result=articleHtml(raw);
  assert.match(result.html,/<h2 id="section-1">제목<\/h2>/);
  assert.match(result.html,/<strong>강조<\/strong>/);assert.match(result.html,/<a href="\/location\/">위치<\/a>/);
  assert.match(result.html,/color:navy/);assert.match(result.html,/<table>/);
  assert.doesNotMatch(result.html,/script|onclick|onerror|onmouseover|javascript|position|background:url|font-size:8|<svg|<math|evil\.example|data:text/);
  assert.deepEqual(result.headings,[{id:'section-1',text:'제목'}]);
  assert.equal(articleHtml(result.html).html,result.html,'sanitization stays safe when an article is reopened');
  const faq=articleHtml('<details><summary>어디에서 접수하나요?</summary><p>4층에서 접수합니다.</p><script>숨김</script></details>');
  assert.deepEqual(faq.faq,[{question:'어디에서 접수하나요?',answer:'4층에서 접수합니다.'}]);
});
test('video embeds accept only HTTPS provider URLs and direct video files',()=>{
  assert.deepEqual(videoSource('https://youtu.be/dQw4w9WgXcQ?feature=share'),{kind:'iframe',src:'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'});
  assert.equal(videoSource('https://vimeo.com/123456789').src,'https://player.vimeo.com/video/123456789');
  assert.equal(videoSource('https://media.example/clip.mp4').kind,'video');
  for(const url of ['javascript:alert(1)','http://youtu.be/dQw4w9WgXcQ','https://www.youtube.com.evil.example/embed/dQw4w9WgXcQ','https://name:password@media.example/clip.mp4'])assert.equal(videoSource(url),null);
  const html=articleHtml('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" onload="bad()"></iframe><video src="https://media.example/clip.webm" autoplay onerror="bad()"></video>').html;
  assert.match(html,/youtube-nocookie\.com/);assert.match(html,/controls playsinline/);assert.doesNotMatch(html,/onload|onerror|autoplay/);
  assert.match(html,/<iframe[^>]+referrerpolicy="strict-origin-when-cross-origin"/);
  const supplied=articleHtml('<iframe src="https://youtu.be/IG97gwUDYos" referrerpolicy="no-referrer"></iframe>').html;
  assert.match(supplied,/src="https:\/\/www.youtube-nocookie.com\/embed\/IG97gwUDYos"/);
  assert.match(articleHtml(supplied).html,/referrerpolicy="strict-origin-when-cross-origin"/);
});

test('media sizes survive sanitization and reopening without accepting arbitrary CSS',()=>{
  const input='<img src="https://media.example/photo.png" alt="설명" style="width:50%;height:10px;position:fixed">'+
    '<iframe src="https://youtu.be/dQw4w9WgXcQ" width="75%" height="20"></iframe>'+
    '<video src="https://media.example/clip.mp4" style="width:640px;position:absolute"></video>';
  const html=articleHtml(input).html;
  assert.match(html,/<img[^>]+style="width:50%"/);assert.match(html,/<iframe[^>]+style="width:75%"/);assert.match(html,/<video[^>]+style="width:640px"/);
  assert.doesNotMatch(html,/height=|height:|position/);assert.equal(articleHtml(html).html,html);
  for(const width of ['0%','101%','-20px','4097px','100vw','50%;position:fixed','expression(bad())','calc(100% - 1px)','url(https://evil.example)'])assert.equal(mediaWidth(width),'');
  for(const width of ['10%','100%','1px','4096px'])assert.equal(mediaWidth(width),width);
  assert.equal(mediaWidth('640'),'640px');
  assert.doesNotMatch(articleHtml('<img src="https://media.example/a.png" alt="설명" style="width:calc(100%);position:fixed">').html,/style=/);
});
test('inline uploads stay private in drafts, publish as separate images, and survive edits without resending their bytes',async()=>{
  const sqlite=new DatabaseSync(':memory:');sqlite.exec(await readFile('drizzle/0000_posts.sql','utf8'));
  const app=createApp(),env={DB:adapt(sqlite),LOCAL_PREVIEW:true},origin='https://clinic.test';
  const data='data:image/png;base64,'+(await readFile('public/assets/favicon.png')).toString('base64');
  const base={title:'HTML 글 확인',category:'notice',author:'운영자',excerpt:'요약',bodyFormat:'html',status:'draft'};
  const save=fields=>app.fetch(new Request(origin+'/api/posts',{method:'POST',headers:{origin,Accept:'application/json'},body:new URLSearchParams({...base,...fields})}),env);
  const get=(path,extra={})=>app.fetch(new Request(origin+path),{...env,...extra});
  try{
    let response=await save({body:'<h2>질문</h2><p>안내 <strong>내용</strong></p><img src="'+data+'" alt="로고" style="width:50%"><iframe src="https://youtu.be/dQw4w9WgXcQ" style="width:75%"></iframe><video src="https://media.example/clip.webm" style="width:25%"></video><details><summary>어디에서 접수하나요?</summary><p>4층에서 접수합니다.</p></details>'});assert.equal(response.status,200);
    const {id}=await response.json();let post=JSON.parse(sqlite.prepare('SELECT data FROM posts WHERE id=?').get(id).data);
    assert.equal(post.inlineImages.length,1);assert.doesNotMatch(post.body,/data:image/);
    assert.match(post.body,/<img[^>]+style="width:50%"/);assert.match(post.body,/<iframe[^>]+style="width:75%"/);assert.match(post.body,/<video[^>]+style="width:25%"/);
    const imagePath='/media/'+id+'/inline/'+post.inlineImages[0].id;
    assert.equal((await get(imagePath)).status,404);
    response=await get(imagePath,{ADMIN_AUTHENTICATED:true});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
    response=await save({id,status:'published',body:post.body});assert.equal(response.status,200);
    response=await get('/health/'+id+'/');const html=await response.text();
    assert.equal(response.status,200);assert.match(html,/<strong>내용<\/strong>/);assert.ok(html.includes(imagePath));assert.doesNotMatch(html,/data:image/);
    assert.match(html,/<img[^>]+style="width:50%"/);assert.match(html,/<iframe[^>]+style="width:75%"/);assert.match(html,/<video[^>]+style="width:25%"/);
    assert.match(html,/"@type":"FAQPage"/);assert.match(html,/<summary>어디에서 접수하나요\?<\/summary>/);
    assert.equal((await get(imagePath)).status,200);
    post=JSON.parse(sqlite.prepare('SELECT data FROM posts WHERE id=?').get(id).data);assert.equal(post.inlineImages.length,1);
    assert.equal((await save({id,status:'archived',body:post.body})).status,200);assert.equal((await get(imagePath)).status,404);
    assert.equal((await save({body:'<img src="'+data+'">'})).status,422,'image descriptions are required');
    assert.equal((await save({body:'<script>unsafe()</script>'})).status,422,'an empty sanitized body cannot be published');
    assert.equal((await save({body:('<img src="'+data+'" alt="로고">').repeat(5)})).status,422,'upload count is bounded');
  }finally{sqlite.close();}
});
test('home uses the exact supplied title and description and corporate authors reference the clinic entity',async()=>{
  const app=createApp(),response=await app.fetch(new Request('https://clinic.test/'),{DB:{posts:{list:async()=>[]}},SITE_INDEXING:'on'}),html=await response.text();
  assert.ok(html.includes('<title>'+homeMetadata.title+'</title>'));
  assert.ok(html.includes('<meta name="description" content="'+homeMetadata.description+'">'));
  assert.ok(html.includes('property="og:title" content="'+homeMetadata.title+'"'));
  assert.match(html,/type="image\/png" sizes="180x180" href="\/assets\/favicon\.png/);
  assert.deepEqual(articleSchema({id:'example',title:'안내',author:hospital.shortName},'https://clinic.test','/health/example/').author,{'@id':'https://clinic.test/#clinic'});
});
