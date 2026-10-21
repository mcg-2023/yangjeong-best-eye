import {DatabaseSync} from 'node:sqlite';
import {mkdir,readFile} from 'node:fs/promises';
import {adapt} from './sqlite-adapter.mjs';
import {repository} from '../src/repository.js';
import {validatePost} from '../src/content.js';

const examples=[
  {
    title:'[TEST 01] 건강정보에 오신 것을 환영합니다',
    excerpt:'새로운 저널의 첫 페이지입니다. 글 목록과 상세 화면을 확인하기 위한 테스트 게시글입니다.',
    body:'## 눈 건강 이야기가 모이는 공간\n이 글은 홈페이지 디자인과 게시판 기능을 확인하기 위한 테스트 콘텐츠입니다. 실제 병원 공지나 의료정보가 아닙니다.\n\n## 필요한 이야기를 찾아보세요\n주제별 메뉴와 검색을 통해 게시글을 찾아볼 수 있습니다. 목록에서 제목을 선택하면 글 전체를 읽을 수 있습니다.\n\n## 화면 확인 항목\n- 제목과 요약이 목록에 표시되는지 확인합니다.\n- 대표이미지가 자연스럽게 보이는지 확인합니다.\n- 모바일에서도 본문을 편하게 읽을 수 있는지 확인합니다.',
    image:'main_sd1.webp',imageAlt:'양정베스트안과의 접수 공간 · 테스트 글 대표이미지',
  },
  {
    title:'[TEST 02] 새로운 소식을 한눈에 만나보세요',
    excerpt:'최신 글을 크게 보여주는 슬라이드입니다. 이전·다음 버튼으로 다른 게시글을 만나보세요.',
    body:'## 최신 글을 먼저 확인하세요\n이 글은 상단 슬라이드와 게시글 목록의 표시 상태를 확인하기 위한 테스트 글입니다. 실제 진료 일정이나 병원 운영 공지는 포함하지 않습니다.\n\n## 슬라이드를 이용하는 방법\n- 이전·다음 버튼으로 글을 바꿀 수 있습니다.\n- 아래의 번호 버튼으로 원하는 글을 바로 선택할 수 있습니다.\n- 자동 넘김은 일시정지 버튼으로 멈출 수 있습니다.\n\n## 글 관리\n관리 화면에서 이 테스트 글의 제목과 내용을 수정하거나 보관할 수 있습니다.',
    image:'main_sd2_n.webp',imageAlt:'양정베스트안과의 대기 공간 · 테스트 글 대표이미지',
  },
  {
    title:'[TEST 03] 더 넓어진 저널에서 이야기를 읽어보세요',
    excerpt:'사이드바 없이 넓어진 게시글 목록. 큰 이미지와 읽기 편한 글자로 구성한 저널 화면을 확인해보세요.',
    body:'## 읽는 데 집중하는 저널\n이 글은 게시판의 레이아웃과 글자 크기를 확인하기 위한 테스트 콘텐츠입니다. 개인의 눈 상태에 대한 진단이나 치료 안내를 제공하지 않습니다.\n\n## 넓어진 게시글 목록\n왼쪽 사이드바를 제거해 게시글을 더 넓은 영역에서 볼 수 있습니다. 큰 화면에서는 글 세 개를 나란히 보여주고, 작은 화면에서는 화면 폭에 맞춰 배치합니다.\n\n## 새 글을 작성해보세요\n글쓰기에서 제목과 본문을 입력하고 대표이미지를 추가할 수 있습니다. 테스트 글은 게시판 관리에서 보관할 수 있으며 검색용 사이트맵과 RSS에는 포함하지 않습니다.',
    image:'medical05.webp',imageAlt:'눈을 가까이 촬영한 이미지 · 테스트 글 대표이미지',
  },
];

await mkdir('.data',{recursive:true});
const sqlite=new DatabaseSync('.data/journal.sqlite');sqlite.exec('PRAGMA busy_timeout = 5000');
try {
  if(!sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='posts'").get())sqlite.exec(await readFile('drizzle/0000_posts.sql','utf8'));
  const repo=repository(adapt(sqlite)),now=Date.now();let created=0;
  for(const [index,example] of examples.entries()){
    const id=`test-journal-0${index+1}`;
    if(await repo.get(id))continue;
    const timestamp=new Date(now-(examples.length-1-index)*60000).toISOString();
    const bytes=await readFile('public/assets/'+example.image);
    const post={...example,id,category:'notice',status:'published',author:'테스트 작성자',answer:'',takeaways:'',reviewer:'',reviewedAt:'',reviewApproved:false,sources:[],faq:[],tags:['테스트'],cover:'data:image/webp;base64,'+bytes.toString('base64'),seoTitle:example.title,description:example.excerpt,createdAt:timestamp,updatedAt:timestamp,publishedAt:timestamp};
    const errors=validatePost(post,true);if(errors.length)throw new Error(errors.join(' '));
    await repo.save(post);created++;
  }
  console.log(`Test posts: ${created} created. Existing posts were left unchanged.`);
}finally{sqlite.close();}
