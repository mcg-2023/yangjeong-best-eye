export const hospital = {
  name: '양정베스트안과의원', shortName: '양정베스트안과',
  phone: '051-861-0011', address: '부산광역시 부산진구 중앙대로 915, 호원메디컬타워 4·5층',
  station: '양정역 1번 출구에서 100m',
  businessNumber: '244-90-02138',
  hours: [['평일', '09:00 – 18:00'], ['토요일', '09:00 – 13:00'], ['점심시간', '13:00 – 14:00']],
  closed: '일요일·공휴일 휴진',
  source: 'http://besteye.willstay.co.kr/', verifiedAt: '2026-10-21',
  map: 'https://m.place.naver.com/hospital/1384730840/home?entry=pll',
};
// Public destinations supplied by the hospital website owner.
export const quickLinks = {
  blog: 'https://blog.naver.com/yjbesteye',
  instagram: 'https://www.instagram.com/yjbesteye/',
  carrot: 'https://www.daangn.com/kr/local-profile/'+encodeURIComponent('양정베스트안과')+'-fuce85bbnbf8/',
  booking: hospital.map,
};
export const categories = [
  {slug:'cataract',name:'노안·백내장',en:'CATARACT',image:'medical01.webp',intro:'노안과 백내장에 관한 질문부터 진료 전 확인할 내용까지, 필요한 정보를 차근차근 살펴보세요.'},
  {slug:'children',name:'소아안과·드림렌즈',en:'CHILDREN’S EYE',image:'medical02.webp',intro:'아이의 시력과 눈 건강, 드림렌즈에 관해 궁금했던 내용을 모아보는 공간입니다.'},
  {slug:'dry-eye',name:'안구건조',en:'DRY EYE',image:'medical03.webp',intro:'일상 속 눈의 불편함을 이해하고, 건성안 진료에 관해 알아보세요.'},
  {slug:'retina',name:'망막질환',en:'RETINA',image:'medical04.webp',intro:'망막과 관련된 눈 건강 정보를 찾아보는 공간입니다.'},
  {slug:'glaucoma',name:'녹내장',en:'GLAUCOMA',image:'medical05.webp',intro:'녹내장 진료와 눈 건강 관리에 관한 이야기를 모아봅니다.'},
];
export const categoryName = slug => categories.find(c=>c.slug===slug)?.name ?? (slug==='notice'?'병원소식':'전체');
