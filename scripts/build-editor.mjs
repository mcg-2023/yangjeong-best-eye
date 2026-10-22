import {build} from 'vite';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export async function buildEditorAssets(){
  await build({configFile:false,publicDir:false,logLevel:'warn',build:{outDir:'.generated/editor-assets',emptyOutDir:true,lib:{entry:'src/editor-client.js',formats:['es'],fileName:()=> 'rich-editor.js',cssFileName:'rich-editor'},minify:true}});
}
if(resolve(process.argv[1]??'')===fileURLToPath(import.meta.url))await buildEditorAssets();
