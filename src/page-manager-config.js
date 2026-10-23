import {definePageManager} from '../packages/page-manager/src/config.js';
import {hospital,categories} from './hospital.js';

// Site-specific values live here. The administration module contains no clinic data.
export const pageManagerConfig=definePageManager({
  id:'yjbest',storageName:'Supabase',siteName:hospital.shortName,logo:'/assets/logo.svg',favicon:'/assets/favicon.png?v=20261022',
  eyebrow:'YANGJEONG BEST · JOURNAL DESK',copyright:'YANGJEONG BEST EYE CLINIC',monogram:'B',
  welcomeTitle:'눈 건강을 위한 바른 정보, 이곳에서 시작합니다.',policyUrl:'/editorial-policy/',publicPostBase:'/health/',
  categories:[...categories.map(c=>({slug:c.slug,name:c.name,reviewRequired:true})),{slug:'notice',name:'병원소식'}],
  review:{enabled:true,label:'의료 검수',approvalText:'의료 검수자가 본문의 의료정보를 실제 확인하고 승인했습니다.',help:'병원소식에는 의료 검수가 필수가 아닙니다. 의료정보 발행 시 검수 완료를 다시 확인해주세요.'},
  theme:{primary:'#213d78',dark:'#172e5c',pale:'#edf1f8'},
});
