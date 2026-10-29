import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {crc32} from 'node:zlib';
import {createVercelHandler} from '../src/vercel-runtime.js';
import {login} from './admin-helper.mjs';
import {storeImageData} from '../packages/page-manager/src/image-transfer.js';

test('clinic.5 transfers large originals in small requests through the Vercel/Supabase adapter, preserves edits, and deletes associated media',async t=>{
  const origin='https://clinic.vercel.app',rows=new Map(),queries=[],requests=[];
  const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test_only',ADMIN_USERNAME:'editor',ADMIN_PASSWORD:'example-password-for-tests'};
  const fetchImpl=async(input,options)=>{
    const url=new URL(input);queries.push(url);
    if(options.method==='POST'){
      const row=JSON.parse(options.body);assert.equal(row.id,row.data.id);assert.equal(row.status,row.data.status);
      rows.set(row.id,row);return new Response(null,{status:204});
    }
    const id=url.searchParams.get('id')?.slice(3);
    if(options.method==='DELETE'){rows.delete(id);return new Response(null,{status:204});}
    const all=[...rows.values()].filter(row=>url.searchParams.get('data->>recordType')==='is.null'?!row.data.recordType:true);
    return Response.json(id?(rows.has(id)?[rows.get(id)]:[]):all.slice(Number(url.searchParams.get('offset')||0),Number(url.searchParams.get('offset')||0)+Number(url.searchParams.get('limit')||100)));
  };
  const handler=createVercelHandler({environment:()=>env,fetchImpl});
  const {cookie,csrf}=await login(handler,origin);
  const send=(path,fields,headers={})=>handler(new Request(origin+path,{method:'POST',headers:{origin,cookie,Accept:'application/json',...headers},body:new URLSearchParams(fields)}));
  const uploadFields={csrf,postId:'',uploadId:'invalid-image',kind:'inline',part:'0',parts:'1',data:'not an image'};
  assert.equal((await send('/api/posts/images',uploadFields,{cookie:''})).status,401);
  assert.equal((await send('/api/posts/images',{...uploadFields,csrf:''})).status,403);
  assert.equal((await send('/api/posts/images',uploadFields,{origin:'https://other.test'})).status,403);
  assert.equal((await send('/api/posts/images',{...uploadFields,part:'1',parts:'2'})).status,409);
  assert.equal((await send('/api/posts/images',uploadFields)).status,422);
  const png=await readFile('public/assets/favicon.png');
  const payload=Buffer.concat([Buffer.from('Comment\0'),Buffer.alloc(5*1024*1024,120)]),type=Buffer.from('tEXt'),length=Buffer.alloc(4),crc=Buffer.alloc(4);
  length.writeUInt32BE(payload.length);crc.writeUInt32BE(crc32(Buffer.concat([type,payload])));
  const original=Buffer.concat([png.subarray(0,-12),length,type,payload,crc,png.subarray(-12)]);
  const data='data:image/png;base64,'+original.toString('base64'),coverData='data:image/png;base64,'+png.toString('base64');
  const idField={value:''},tokenField={value:csrf};
  const form={querySelector:selector=>selector.includes('name="id"')?idField:tokenField};
  t.mock.method(globalThis,'fetch',async(path,options)=>{
    const body=options.body.toString();requests.push(body);
    assert.ok(Buffer.byteLength(body)<2*1024*1024,'every encoded request stays below the platform payload limit');
    return handler(new Request(origin+path,{...options,headers:{...options.headers,origin,cookie}}));
  });
  // Simultaneous cover/body selection must reserve one post, even on the new-post screen.
  const [src,cover]=await Promise.all([storeImageData(data,{form}),storeImageData(coverData,{form,kind:'cover'})]);
  const id=idField.value;assert.ok(src.startsWith('/media/'+id+'/inline/'));assert.ok(cover.startsWith('/media/'+id+'/inline/'));
  assert.ok(requests.length>10);assert.ok(data.length>4.5*1024*1024);
  const imageRecords=()=>[...rows.values()].filter(row=>row.data.recordType);
  assert.equal(imageRecords().length,2);assert.ok(imageRecords().every(row=>row.data.postId===id));
  assert.equal(rows.get(id).data.pendingMedia,true);
  assert.doesNotMatch(await (await handler(new Request(origin+'/admin/posts/',{headers:{cookie}}))).text(),new RegExp(id));
  assert.equal((await handler(new Request(origin+src))).status,404);
  const privateImage=await handler(new Request(origin+src,{headers:{cookie}}));assert.equal(privateImage.headers.get('cache-control'),'private, no-store');
  assert.deepEqual(Buffer.from(await privateImage.arrayBuffer()),original);
  const first=new URLSearchParams(requests[0]);
  const retry=await send('/api/posts/images',{...Object.fromEntries(first),postId:id});
  assert.equal(retry.status,200);assert.equal((await retry.json()).src,src);
  const body='<p class="ql-align-right"><img src="'+src+'" alt="큰 원본" style="width:57%"></p>';
  const fields={id,csrf,title:'분할 업로드 확인',category:'notice',bodyFormat:'html',body,cover,imageAlt:'대표이미지',author:'운영자',excerpt:'원본 확인',status:'published'};
  let result=await send('/api/posts',fields);assert.equal(result.status,200);
  const saved=rows.get(id).data;assert.equal(saved.coverRef,cover);assert.equal(saved.cover,'');assert.equal(saved.pendingMedia,undefined);
  assert.equal(saved.inlineImages.length,0);assert.equal(saved.mediaIds.length,2);assert.ok(JSON.stringify(saved).length<5000);
  const reopened=createVercelHandler({environment:()=>env,fetchImpl});
  const page=await reopened(new Request(origin+'/health/'+id+'/'));assert.equal(page.status,200);
  const html=await page.text();assert.ok(html.includes(cover));assert.match(html,/ql-align-right/);assert.match(html,/width:57%/);
  const streamed=await reopened(new Request(origin+src));assert.equal(streamed.headers.get('content-type'),'image/png');
  assert.deepEqual(Buffer.from(await streamed.arrayBuffer()),original);
  assert.deepEqual(Buffer.from(await (await reopened(new Request(origin+cover))).arrayBuffer()),png);
  const editor=await (await handler(new Request(origin+'/admin/edit/'+id+'/',{headers:{cookie}}))).text();
  assert.ok(editor.includes(cover));assert.doesNotMatch(editor,/data:image\/png/);
  assert.equal((await send('/api/posts',{...fields,body:'<p>이미지 제외</p>',cover:''})).status,200);
  assert.equal((await handler(new Request(origin+src))).status,404);
  const retained=await handler(new Request(origin+src,{headers:{cookie}}));assert.equal(retained.status,200);assert.equal(retained.headers.get('cache-control'),'private, no-store');await retained.body.cancel();
  assert.equal((await send('/api/posts',fields)).status,200,'previous editor content can restore retained media');
  const missing=body.replace(src,'/media/'+id+'/inline/missing');assert.equal((await send('/api/posts',{...fields,body:missing})).status,422);
  // A completed upload is also deleted if the user never inserts it into the post.
  const unused=await send('/api/posts/images',{csrf,postId:id,uploadId:'unused-upload',kind:'inline',part:0,parts:1,data:coverData});assert.equal(unused.status,200);
  assert.equal((await send('/api/posts/delete',{id,csrf,confirmDelete:'yes'})).status,200);
  assert.ok(!rows.has(id));assert.equal(imageRecords().length,0);
  assert.ok(queries.some(url=>url.searchParams.get('data->>recordType')==='is.null'),'image blobs are excluded from Supabase post lists');
});
