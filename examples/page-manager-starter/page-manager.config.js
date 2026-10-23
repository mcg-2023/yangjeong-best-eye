import {definePageManager} from '@mcg/page-manager';
export default definePageManager({
  id:'my_website',
  siteName:'새 홈페이지',
  // 로고·파비콘을 교체할 때 public 폴더에 넣고 경로를 지정합니다.
  // logo:'/logo.svg', favicon:'/favicon.png',
  publicPostBase:'/articles/',
  categories:[{slug:'notice',name:'공지사항'},{slug:'stories',name:'이야기'}],
  review:{enabled:false},
  theme:{primary:'#213d78',dark:'#172e5c',pale:'#edf1f8'},
});
