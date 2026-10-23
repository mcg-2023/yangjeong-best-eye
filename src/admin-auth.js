import {createAdminAccess as createAccess} from '../packages/page-manager/src/admin-auth.js';
import {pageManagerConfig} from './page-manager-config.js';
export const createAdminAccess=options=>createAccess({...options,config:pageManagerConfig});
