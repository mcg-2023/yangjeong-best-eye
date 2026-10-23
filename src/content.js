export * from '../packages/page-manager/src/content.js';
import {validatePost as validate,coverUrl as imageUrl} from '../packages/page-manager/src/content.js';
import {validationOptions} from '../packages/page-manager/src/config.js';
import {pageManagerConfig} from './page-manager-config.js';
export const validatePost=(post,publishing=false)=>validate(post,publishing,validationOptions(pageManagerConfig));
export const coverUrl=post=>imageUrl(post)||'/assets/main_sd1.webp';
