import {build} from 'vite';
import {mkdir,cp} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function buildPageManagerAssets({outDir=resolve(root,'dist/assets')}={}){
  outDir=resolve(outDir);
  await build({root,configFile:false,publicDir:false,logLevel:'warn',build:{outDir,emptyOutDir:true,lib:{entry:resolve(root,'src/editor-client.js'),formats:['es'],fileName:()=> 'editor.js',cssFileName:'editor'},minify:true}});
  await mkdir(outDir,{recursive:true});
  for(const [source,target] of [['assets/base.css','base.css'],['assets/article-images.css','article-images.css'],['src/admin.css','admin.css'],['src/admin-client.js','admin.js'],['src/forms-client.js','forms.js'],['src/image-upload.js','image-upload.js'],['assets/brand.svg','brand.svg'],['assets/PretendardVariable.woff2','PretendardVariable.woff2'],['assets/OFL.txt','OFL.txt']])await cp(resolve(root,source),resolve(outDir,target));
  return outDir;
}
if(resolve(process.argv[1]??'')===fileURLToPath(import.meta.url))await buildPageManagerAssets();
