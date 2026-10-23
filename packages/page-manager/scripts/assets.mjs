import {cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export async function copyPageManagerAssets(destination){
  await cp(fileURLToPath(new URL('../dist/assets/',import.meta.url)),destination,{recursive:true});
}
