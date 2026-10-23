import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {createSqliteDatabase} from '@mcg/page-manager/sqlite';
import {createWebsite} from './website.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
const port=Number(process.env.PORT||5180),DB=createSqliteDatabase('.data/posts.sqlite'),site=createWebsite({storage:DB,localPreview:true});
const publicRoot=resolve('public');
const server=createServer(async(req,res)=>{
  try{
    if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)){res.writeHead(403);res.end('Forbidden host');return;}
    const url=new URL(req.url,'http://'+req.headers.host);
    if(url.pathname.startsWith('/page-manager/')){
      const filename=resolve(publicRoot,'.'+decodeURIComponent(url.pathname));
      if(!filename.startsWith(publicRoot+sep)){res.writeHead(404);res.end();return;}
      const content=await readFile(filename),ext=filename.split('.').pop();res.writeHead(200,{'Content-Type':({css:'text/css',js:'text/javascript',svg:'image/svg+xml',woff2:'font/woff2',txt:'text/plain'})[ext]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?null:content);return;
    }
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>3500000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
    const response=await site(new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}));
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(req.method==='HEAD'?null:Buffer.from(await response.arrayBuffer()));
  }catch(error){res.writeHead(error.code==='ENOENT'?404:500);res.end('요청을 처리하지 못했습니다.');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Website: http://127.0.0.1:${port}/\nAdmin: http://127.0.0.1:${port}/admin/`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{DB.close();process.exit(0);}));
