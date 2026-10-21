import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from '../src/app.js';
import {adapt} from '../scripts/sqlite-adapter.mjs';
import {coverUrl,relatedPosts} from '../src/content.js';
import {siteOrigin} from '../src/seo.js';

const sql=await readFile('drizzle/0000_posts.sql','utf8');
const bytes=await readFile('public/assets/medical05.webp');
const fixture={id:'seo-fixture',title:'검증용 게시글',category:'dry-eye',status:'published',author:'작성 확인용',reviewer:'검수 확인용',reviewApproved:true,reviewedAt:'2026-01-02',
  publishedAt:'2026-01-01T03:00:00Z',updatedAt:'2026-01-02T04:00:00Z',body:'## 검증용 질문\n의료정보가 아닌 자동 검증 자료입니다.',excerpt:'검색 메타정보 검증용 요약',
  answer:'검증용 답변',imageAlt:'검증용 대표이미지',cover:'data:image/webp;base64,'+bytes.toString('base64'),tags:['검증'],
  sources:[{title:'출처 확인용',url:'https://www.nei.nih.gov/'}],faq:[{question:'검증 질문',answer:'검증 답변'}]};
function setup(){const db=new DatabaseSync(':memory:');db.exec(sql);const env={DB:adapt(db)},app=createApp();
  return {db,env,put(p){db.prepare('INSERT INTO posts VALUES (?,?,?,?)').run(p.id,JSON.stringify(p),p.status,p.updatedAt);},get(path,options={}){return app.fetch(new Request('https://clinic.test'+path),{...env,...options});}};}
const graph=html=>JSON.parse(html.match(/<script type="application\/ld\+json">([^]*?)<\/script>/)[1])['@graph'];

test('canonical origin, verification and preview indexing controls agree across HTML, sitemap and RSS',async()=>{
  const {db,get,put}=setup();try{
    put(fixture);
    const env={SITE_URL:'https://journal.example/',GOOGLE_SITE_VERIFICATION:'google-token',NAVER_SITE_VERIFICATION:'"><script>bad</script>'};
    let r=await get('/clinic/?utm_source=test',env),html=await r.text();
    assert.match(html,/<link rel="canonical" href="https:\/\/journal.example\/clinic\/">/);
    assert.match(html,/<meta property="og:url" content="https:\/\/journal.example\/clinic\/">/);
    assert.match(html,/name="google-site-verification" content="google-token"/);
    assert.doesNotMatch(html,/<script>bad/);assert.equal(r.headers.get('x-robots-tag'),'noindex, follow');
    const sitemap=await (await get('/sitemap.xml',env)).text(),feed=await (await get('/feed.xml',env)).text();
    assert.match(sitemap,/https:\/\/journal.example\/health\/seo-fixture\//);assert.doesNotMatch(sitemap,/clinic.test/);
    assert.match(feed,/<atom:link href="https:\/\/journal.example\/feed.xml"/);assert.doesNotMatch(feed,/clinic.test/);
    html=await (await get('/clinic/',{SITE_URL:'https://clinic.test',SITE_INDEXING:'on'})).text();assert.match(html,/index,follow,max-image-preview:large/);
    r=await get('/clinic/',{LOCAL_PREVIEW:true,SITE_INDEXING:'on'});assert.equal(r.headers.get('x-robots-tag'),'noindex, follow');
    r=await get('/clinic/',{SITE_INDEXING:'off'});assert.equal(r.headers.get('x-robots-tag'),'noindex, follow');
    for(const value of ['javascript:alert(1)','https://example.org/path','https://user:pass@example.org/','https://example.org/?a=1'])assert.throws(()=>siteOrigin(value,'https://clinic.test'));
  }finally{db.close();}
});

test('permanent redirects and pagination keep distinct useful URLs, with 404 for nonexistent pages',async()=>{
  const {db,get,put}=setup();try{
    for(let i=0;i<7;i++)put({...fixture,id:'page-'+i,title:'페이지 검증 '+i});
    for(const [path,status,location] of [['/contact/?from=footer',301,'/location/?from=footer'],['/health/page-0',308,'/health/page-0/'],['/health/category/dry-eye',308,'/health/category/dry-eye/'],['/editorial-policy',308,'/editorial-policy/']]){
      const r=await get(path);assert.equal(r.status,status);assert.equal(r.headers.get('location'),location);
    }
    const html=await (await get('/health/?page=2&utm_source=test')).text();
    assert.match(html,/rel="canonical" href="https:\/\/clinic.test\/health\/\?page=2"/);assert.match(html,/index,follow,max-image-preview:large/);assert.match(html,/<title>건강정보 · 2페이지/);
    assert.match(html,/<a href="\/health\/" >1<\/a>/);
    const search=await (await get('/health/?q=검증&page=2')).text();assert.match(search,/noindex,follow/);
    for(const path of ['/health/?page=3','/health/?page=0','/health/?page=1.2','/health/?page=abc','/care/','/doctor/test/'])assert.equal((await get(path)).status,404,path);
    const empty=await (await get('/health/category/retina/')).text();assert.match(empty,/noindex,follow/);
    assert.doesNotMatch(await (await get('/sitemap.xml')).text(),/\/category\/retina\//);
  }finally{db.close();}
});

test('article identity, image, review, citations and breadcrumbs match visible content; images stay private until publication',async()=>{
  const {db,get,put}=setup();try{
    put(fixture);put({...fixture,id:'private-image',status:'draft'});
    const html=await (await get('/health/seo-fixture/')).text(),nodes=graph(html);
    const article=nodes.find(n=>n['@type']==='BlogPosting'),page=nodes.find(n=>n['@type']==='MedicalWebPage'),crumb=nodes.find(n=>n['@type']==='BreadcrumbList');
    assert.equal(nodes.find(n=>n['@type']==='MedicalClinic').medicalSpecialty,'https://schema.org/Ophthalmology');
    assert.equal(article.author.name,fixture.author);assert.equal(page.reviewedBy.name,fixture.reviewer);assert.equal(page.lastReviewed,fixture.reviewedAt);
    assert.deepEqual(article.citation,[{'@type':'CreativeWork',name:fixture.sources[0].title,url:fixture.sources[0].url}]);
    assert.equal(article.image[0],'https://clinic.test'+coverUrl(fixture));assert.equal(article.mainEntityOfPage['@id'],page['@id']);
    assert.equal(crumb.itemListElement.length,4);assert.equal(crumb.itemListElement[2].item,'https://clinic.test/health/category/dry-eye/');
    assert.match(html,/property="og:type" content="article"/);assert.match(html,/name="twitter:card" content="summary_large_image"/);
    assert.match(html,/datetime="2026-01-01T03:00:00Z"/);assert.doesNotMatch(html,/data:image\//);assert.match(html,/검증 질문/);
    const image=await get(coverUrl(fixture));assert.equal(image.headers.get('content-type'),'image/webp');assert.deepEqual(Buffer.from(await image.arrayBuffer()),bytes);
    assert.equal((await get('/media/private-image/cover')).status,404);
    db.prepare("UPDATE posts SET status='draft',data=? WHERE id=?").run(JSON.stringify({...fixture,status:'draft'}),fixture.id);
    assert.equal((await get(coverUrl(fixture))).status,404);
  }finally{db.close();}
});

test('TEST content has noindex metadata and image headers, no snippets, no feed entries and no recommendations from real articles',async()=>{
  const {db,get,put}=setup();try{
    const sample={...fixture,id:'test-journal-01'};put(sample);
    let r=await get('/health/test-journal-01/');assert.equal(r.headers.get('x-robots-tag'),'noindex, follow');
    r=await get(coverUrl(sample));assert.equal(r.headers.get('x-robots-tag'),'noindex');
    assert.match(await (await get('/')).text(),/class="latest-slide" data-nosnippet/);
    assert.doesNotMatch(await (await get('/sitemap.xml')).text(),/\/health\//);
    assert.doesNotMatch(await (await get('/feed.xml')).text(),/<item>/);
    assert.deepEqual(relatedPosts(fixture,[sample]),[]);
  }finally{db.close();}
});
