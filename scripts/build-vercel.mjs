import {mkdir,cp} from 'node:fs/promises';

await mkdir('dist/vercel',{recursive:true});
await cp('public/assets','dist/vercel/assets',{recursive:true});
await cp('src/style.css','dist/vercel/style.css');
await cp('src/client.js','dist/vercel/client.js');
await cp('src/admin.css','dist/vercel/admin.css');
await cp('src/admin-client.js','dist/vercel/admin.js');
console.log('Vercel assets ready. Dynamic pages use api/index.js; posts use Supabase.');
