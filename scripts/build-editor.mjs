import {buildPageManagerAssets} from '../packages/page-manager/scripts/build.mjs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export const buildEditorAssets=()=>buildPageManagerAssets({outDir:resolve('.generated/editor-assets')});
if(resolve(process.argv[1]??'')===fileURLToPath(import.meta.url))await buildEditorAssets();
