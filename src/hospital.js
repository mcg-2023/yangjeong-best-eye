export const hospital = {
  name: '양정베스트안과의원', shortName: '양정베스트안과',
  phone: '051-861-0011', address: '부산광역시 부산진구 중앙대로 915, 호원메디컬타워 4·5층',
  station: '양정역 1번 출구에서 100m',
  businessNumber: '244-90-02138',
  hours: [['평일', '09:00 – 18:00'], ['토요일', '09:00 – 13:00'], ['점심시간', '13:00 – 14:00']],
  closed: '일요일·공휴일 휴진',
  source: 'http://besteye.willstay.co.kr/', verifiedAt: '2026-10-21',
  map: 'https://m.place.naver.com/hospital/1384730840/home?entry=pll',
  googleMap: 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent('양정베스트안과 부산광역시 부산진구 중앙대로 915'),
  // Official Google Maps "Embed a map" URL for the matching clinic listing.
  googleMapEmbed: 'https://www.google.com/maps/embed?pb=!1m5!3m3!1m2!1s0x3568eb4cdab3c88f%3A0x31520a5b08956fde!2z7JaR7KCV67Kg7Iqk7Yq47JWI6rO8!5e0!3m2!1sko!2skr!4v1792647996140!5m2!1sko!2skr',
  reception: '처음 방문하시면 4층에서 접수해주세요.',
  floors: [
    {floor:'4F',name:'접수 · 외래 · 검진',description:'접수 후 진료와 검사 안내를 받으실 수 있습니다.'},
    {floor:'5F',name:'수술센터',description:'수술 관련 방문은 병원에서 안내받은 일정과 동선을 확인해주세요.'},
  ],
};
// Public destinations supplied by the hospital website owner.
export const quickLinks = {
  blog: 'https://blog.naver.com/yjbesteye',
  instagram: 'https://www.instagram.com/yjbesteye/',
  carrot: 'https://www.daangn.com/kr/local-profile/'+encodeURIComponent('양정베스트안과')+'-fuce85bbnbf8/',
  booking: hospital.map,
};
export const medicalTeam = [
  {
    name: '정현철', role: '대표원장', specialty: '안과 전문의',
    image: '/assets/doctor.webp', imageWidth: 600, imageHeight: 742,
    careers: [
      '전) 동아대학교병원 외안부 임상교수 역임',
      '전) 밝은눈안과병원 원장',
      '동아대학교 의과대학 외래교수',
      '대한안과학회(KOS) 정회원',
      '미국안과학회(AAO) 정회원',
      '한국외안부학회(KEEDS) 정회원',
      '한국백내장굴절수술학회(KSCRS) 정회원',
      '한국콘택트렌즈학회(KCLS) 정회원',
      '대한검안학회 정회원',
      'ICL/SMILE 집도의',
    ],
    sourceLabel: '병원 제공 약력', verifiedAt: '2026-10-22',
    qualifications: [{year:'2012',name:'의사 면허 취득'},{year:'2017',name:'안과 전문의 자격 인정'}],
    qualificationsVerifiedAt: '2026-10-22',
  },
];
// Curated from owner-supplied photographs; unrelated clinic reference images are excluded.
export const clinicSpaces = [
  {image:'clinic-lobby.webp',name:'대기 공간',alt:'양정베스트안과 영문 상호가 보이는 로비와 곡선형 대기 소파'},
  {image:'clinic-exam.webp',name:'검사 공간',alt:'양정베스트안과의 굴절검사 장비와 검사 의자'},
  {image:'clinic-consultation.webp',name:'진료 · 상담 공간',alt:'양정베스트안과 상담 데스크와 방문자 의자'},
  {image:'clinic-recovery.webp',name:'휴식 공간',alt:'양정베스트안과 입원실 표지가 있는 개별 휴식 공간'},
];
export const categories = [
  {slug:'cataract',name:'노안·백내장',en:'CATARACT',image:'medical01.webp',summary:'노안과 백내장 · 수술 전후 궁금증',intro:'노안과 백내장은 어떻게 다를까요? 수술 전 검사, 인공수정체, 수술 후 생활에 관한 질문을 다루는 공간입니다.'},
  {slug:'children',name:'소아안과·드림렌즈',en:'CHILDREN’S EYE',image:'medical02.webp',summary:'아이 시력 · 근시·약시 · 렌즈 관리',intro:'아이 시력검사에서 무엇을 확인할까요? 소아 근시·약시와 드림렌즈 착용 전 검사, 렌즈 위생 관리에 관한 질문을 다룹니다.'},
  {slug:'dry-eye',name:'안구건조',en:'DRY EYE',image:'medical03.webp',summary:'눈의 건조함 · 생활환경과 관리',intro:'눈이 자주 건조하고 뻑뻑한 이유가 궁금하신가요? 눈물막, 전자기기 사용, 실내 환경과 건성안 진료에 관한 주제를 살펴봅니다.'},
  {slug:'retina',name:'망막질환',en:'RETINA',image:'medical04.webp',summary:'망막검사 · 비문증 · 당뇨와 눈 건강',intro:'망막검사는 무엇을 살펴볼까요? 비문증, 황반변성, 당뇨망막병증 등 망막과 눈 건강에 관한 질문을 다루는 공간입니다.'},
  {slug:'glaucoma',name:'녹내장',en:'GLAUCOMA',image:'medical05.webp',summary:'안압 · 시신경 · 시야검사',intro:'녹내장 진료에서 안압과 시신경, 시야를 함께 살펴보는 이유는 무엇일까요? 검사와 경과 관찰에 관한 궁금증을 다룹니다.'},
];
export const categoryName = slug => categories.find(c=>c.slug===slug)?.name ?? (slug==='notice'?'병원소식':'전체');
