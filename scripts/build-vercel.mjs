import {mkdir,cp} from 'node:fs/promises';
import {buildEditorAssets} from './build-editor.mjs';

await buildEditorAssets();

await mkdir('dist/vercel',{recursive:true});
await cp('public/assets','dist/vercel/assets',{recursive:true});
await cp('src/style.css','dist/vercel/style.css');
await cp('src/client.js','dist/vercel/client.js');
await cp('src/admin.css','dist/vercel/admin.css');
await cp('src/admin-client.js','dist/vercel/admin.js');
await cp('.generated/editor-assets/rich-editor.js','dist/vercel/rich-editor.js');
await cp('.generated/editor-assets/rich-editor.css','dist/vercel/rich-editor.css');
console.log('Vercel assets ready. Dynamic pages use api/index.js; posts use Supabase.');
