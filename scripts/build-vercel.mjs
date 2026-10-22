import {mkdir,cp} from 'node:fs/promises';

await mkdir('dist/vercel',{recursive:true});
await cp('public/assets','dist/vercel/assets',{recursive:true});
await cp('src/style.css','dist/vercel/style.css');
await cp('src/client.js','dist/vercel/client.js');
console.log('Vercel assets ready. Dynamic pages use api/index.js; posts use Supabase.');
