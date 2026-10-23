import {createAdminViews} from '../packages/page-manager/src/admin-views.js';
import {pageManagerConfig} from './page-manager-config.js';
export {statuses} from '../packages/page-manager/src/admin-views.js';
export const {adminLayout,loginPage,dashboard,postsPage,editorPage,deletePage,settingsPage}=createAdminViews(pageManagerConfig);
