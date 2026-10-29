import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import {adapt} from './sqlite-adapter.mjs';
const source=await readFile('dist/server/index.js','utf8');
const {default:app}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const db=new DatabaseSync(':memory:');db.exec(await readFile('drizzle/0000_posts.sql','utf8'));
const env={DB:adapt(db),LOCAL_PREVIEW:true},origin='https://clinic.test';
const get=(path,options=env)=>app.fetch(new Request(origin+path),options);
try {
  const visited=new Set(),queue=['/','/admin/'],titles=new Set();
  while(queue.length){
    const path=queue.shift();if(visited.has(path))continue;visited.add(path);
    const response=await get(path);assert.equal(response.status,200,path);
    if(!response.headers.get('content-type')?.includes('text/html'))continue;
    const html=await response.text();
    assert.equal((html.match(/<h1[\s>]/g)??[]).length,1,path);
    const title=html.match(/<title>([^]*?)<\/title>/)?.[1];assert.ok(title,path+' title');assert.ok(!titles.has(title),path+' unique title');titles.add(title);
    if(path.startsWith('/admin/')){
      assert.match(html,/<meta name="robots" content="noindex,nofollow">/,path+' private admin');
      assert.doesNotMatch(html,/data-quick-menu/);
      for(const m of html.matchAll(/(?:href|src)="(\/(?!\/)[^"#?]*)/g)){const link=m[1];if(link&&!visited.has(link))queue.push(link);}
      continue;
    }
    assert.match(html,/<meta name="description" content="[^"]+">/,path);
    assert.ok(html.includes('<link rel="canonical" href="'+origin+path+'">'),path+' canonical');
    const graph=JSON.parse(html.match(/<script type="application\/ld\+json">([^]*?)<\/script>/)[1])['@graph'];
    assert.ok(graph.some(node=>node['@id']===origin+path+'#page'),path+' WebPage');
    const ids=graph.map(node=>node['@id']).filter(Boolean);assert.equal(ids.length,new Set(ids).size,path+' unique schema identities');
    for(const m of html.matchAll(/(?:href|src)="(\/(?!\/)[^"#?]*)/g)){const link=m[1];if(link&&!visited.has(link))queue.push(link);}
    assert.doesNotMatch(html,/SOURCE_EXTRACT/);
  }
  for(const path of ['/robots.txt','/sitemap.xml','/feed.xml'])assert.equal((await get(path)).status,200);
  // Unbundled admin modules must keep their relative imports available after build.
  const modules=['/page-manager/forms.js'],checked=new Set();
  while(modules.length){
    const asset=modules.shift();if(checked.has(asset))continue;checked.add(asset);
    const response=await get(asset);assert.equal(response.status,200,asset+' module dependency');
    assert.match(response.headers.get('content-type'),/javascript/,asset+' JavaScript MIME type');
    for(const match of (await response.text()).matchAll(/from\s+['"]([^'"]+)['"]/g))modules.push(new URL(match[1],origin+asset).pathname);
  }
  const imageStyle=await get('/page-manager/article-images.css');assert.equal(imageStyle.status,200);
  assert.match(await imageStyle.text(),/ql-align-right/);
  const sitemap=await (await get('/sitemap.xml')).text();
  for(const match of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)){
    const response=await app.fetch(new Request(match[1]),{DB:env.DB});assert.equal(response.status,200,match[1]);
    assert.doesNotMatch(await response.text(),/<meta name="robots" content="noindex/,match[1]+' sitemap only indexes useful pages');
  }
  assert.equal((await get('/not-found/')).status,404);
  assert.match(await (await get('/health/?q=test')).text(),/noindex,follow/);
  console.log('PASS: '+visited.size+' internal pages/assets; unique titles, descriptions, canonicals, JSON-LD, sitemap indexability and 404.');
} finally {db.close();}
