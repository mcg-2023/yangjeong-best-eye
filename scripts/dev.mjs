import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from '../src/app.js';
import {getAssets} from './assets.mjs';
import {adapt} from './sqlite-adapter.mjs';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir('.data',{recursive:true});const sqlite=new DatabaseSync('.data/journal.sqlite');
sqlite.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY)');
if(!sqlite.prepare('SELECT name FROM _migrations WHERE name=?').get('0000_posts')){sqlite.exec(await readFile('drizzle/0000_posts.sql','utf8'));sqlite.prepare('INSERT INTO _migrations (name) VALUES (?)').run('0000_posts');}
const db=adapt(sqlite),port=Number(process.env.PORT??5173);
const mobilePreview = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="robots" content="noindex"><title>모바일 화면 검증</title><style>body{margin:0;background:#e9ecf2;display:flex;justify-content:center}iframe{width:390px;height:844px;border:0;background:white;box-shadow:0 0 30px #0001}</style><iframe title="390px 모바일 홈페이지 미리보기" src="/"></iframe></html>';
const server=createServer(async(req,res)=>{try{if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)){res.writeHead(403);res.end('Forbidden host');return;}if(req.url.split('?')[0]==='/__preview/mobile'){const paths={admin:'/admin/',posts:'/admin/posts/',editor:'/admin/new/',login:'/admin/login/'};const path=paths[new URL(req.url,'http://localhost').searchParams.get('screen')]||'/';res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(mobilePreview.replace('src="/"','src="'+path+'"'));return;}const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1200000){res.writeHead(413);res.end('Too large');return;}chunks.push(chunk);}const request=new Request('http://'+req.headers.host+req.url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});const app=createApp(await getAssets());const response=await app.fetch(request,{DB:db,LOCAL_PREVIEW:true,SITE_URL:process.env.SITE_URL,SITE_INDEXING:process.env.SITE_INDEXING,GOOGLE_SITE_VERIFICATION:process.env.GOOGLE_SITE_VERIFICATION,NAVER_SITE_VERIFICATION:process.env.NAVER_SITE_VERIFICATION});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(req.method==='HEAD'?null:Buffer.from(await response.arrayBuffer()));}catch(e){console.error(e);res.writeHead(500);res.end('Server error');}});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}/\nEditor: http://127.0.0.1:${port}/admin/\nStorage: .data/journal.sqlite`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{sqlite.close();process.exit(0);}));
