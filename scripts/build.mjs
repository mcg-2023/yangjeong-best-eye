import {build} from 'vite';
import {mkdir,writeFile,readFile,cp} from 'node:fs/promises';
import {getAssets} from './assets.mjs';
import {buildEditorAssets} from './build-editor.mjs';
await buildEditorAssets();
await mkdir('.generated',{recursive:true});
const assets=await getAssets(),uniqueAssets=[],assetIds=new Map();
const assetEntries=Object.entries(assets).map(([path,asset])=>{
  const signature=asset.type+':'+asset.data;
  if(!assetIds.has(signature)){assetIds.set(signature,uniqueAssets.length);uniqueAssets.push(asset);}
  return [path,assetIds.get(signature)];
});
await writeFile('.generated/worker.js',`import {createApp} from '../src/app.js';\nconst assets=${JSON.stringify(uniqueAssets)};\nexport default createApp(Object.fromEntries(${JSON.stringify(assetEntries)}.map(([path,id])=>[path,assets[id]])));\n`);
await build({configFile:false,publicDir:false,build:{outDir:'dist/server',emptyOutDir:true,lib:{entry:'.generated/worker.js',formats:['es'],fileName:()=> 'index.js'},rollupOptions:{output:{inlineDynamicImports:true}},minify:true}});
await mkdir('dist/.openai',{recursive:true});await cp('.openai/hosting.json','dist/.openai/hosting.json');await cp('drizzle','dist/.openai/drizzle',{recursive:true});
await writeFile('dist/server/wrangler.json',JSON.stringify({name:'yangjeong-best-journal',main:'index.js',compatibility_date:'2026-05-15',d1_databases:[{binding:'DB',database_name:'site-creator-d1',database_id:'00000000-0000-4000-8000-000000000000'}]},null,2));
console.log('Worker build complete. Assets embedded; D1 migrations included.');
