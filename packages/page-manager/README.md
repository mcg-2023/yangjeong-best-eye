# Page Manager 1.2.0-clinic.5

한국어 홈페이지에 붙여 쓰는 관리자·게시글 에디터 공통 모듈입니다. Node.js 24의 Fetch Request/Response를 사용합니다. 현재 양정베스트안과도 같은 소스를 사용합니다. PHP·워드프레스용 플러그인은 아닙니다.

## 포함 기능

- 관리자 로그인·로그아웃, 실제 저장된 글 기반 대시보드
- 게시글 검색·주제/상태 필터·페이지 구분
- HTML 화면 편집·코드 편집·기존 Markdown, 링크·목록·표
- 본문 이미지 파일 압축 업로드/URL 삽입, 이미지 설명
- YouTube·Vimeo·HTTPS MP4/WebM 주소 삽입
- 이미지·동영상 선택 후 너비 슬라이더(10~100%)·25/50/75/100%·자동 크기 조절
- 임시저장·검수 대기·발행·보관·초안 복원·삭제 확인
- 작성자·요약·핵심 답변·검색 제목/설명과 선택적인 검수 항목
- 관리자 미리보기, 초안 이미지 접근 제한, 공개 이미지 경로
- 세션·동일 출처·CSRF 검사와 HTML 허용 목록 처리

관리자 주소는 `/admin/`, 글 API는 `/api/posts`, 이미지 경로는 `/media/`를 사용합니다. 사이트의 기존 경로와 겹치는지 먼저 확인하세요. 화면 스타일/스크립트/폰트는 `/page-manager/`에 모았습니다. 관리자 UI는 홈페이지 CSS에 의존하지 않습니다. 본문·대표이미지는 앱에서 장수·파일 크기·해상도를 제한하지 않고 원본으로 저장합니다. 앱의 글 저장 요청 크기 제한도 제거했습니다. 호스팅 서비스의 요청·응답 및 저장소 제한은 별도로 적용됩니다. 영상 파일 업로드 대신 영상 주소를 사용합니다.

## 새 사이트에서 빠르게 시작

함께 제공한 `starter`를 사용하면 됩니다. 설치 가능한 `mcg-page-manager-1.2.0-clinic.5.tgz`와 starter를 같은 압축파일에 포함했습니다.

1. `starter` 폴더에서 `npm install`을 실행합니다.
2. `npm run build`로 공통 자산을 복사합니다.
3. `npm run dev` 후 `http://127.0.0.1:5180/admin/`을 엽니다.
4. `page-manager.config.js`의 사이트명·로고·주제·색상을 바꿉니다.

로컬 저장소는 `starter/.data/posts.sqlite`에 유지됩니다. 이 로컬 서버는 루프백에만 바인딩되는 로그인 생략 미리보기입니다. 운영 서버는 이 미리보기 옵션 없이 실행하며, 관리자 비밀번호가 없으면 관리 기능을 열지 않습니다. 샘플 게시글과 병원 자료는 포함하지 않습니다.

## 이미지·동영상 크기 조절

화면 편집에서 본문의 이미지나 동영상을 클릭하거나 에디터 아래 항목 목록에서 선택합니다. 이미지는 네 모서리의 손잡이를 마우스·터치로 드래그해 크기를 바꿀 수 있습니다. 너비 슬라이더 옆 % 입력 칸에 숫자를 직접 입력하거나 25·50·75·100% 버튼으로 크기를 바꾸고, 자동 버튼으로 기본 크기로 되돌릴 수 있습니다. 높이는 비율에 맞게 자동 조절합니다. 변경한 크기는 저장·미리보기·다시 편집·공개 글에서도 유지됩니다. 작은 화면에서는 본문 너비를 넘지 않습니다. HTML 코드 모드에서는 미디어 태그의 style="width:50%" 또는 style="width:640px" 형식을 사용할 수 있습니다. 허용 너비는 10~100% 또는 1~4096px입니다. 숫자 입력은 10~100% 범위이며 Enter 또는 입력 완료 시 범위를 벗어난 값을 보정합니다. 모서리에 초점을 두고 화살표 키(Shift와 함께 누르면 10%씩)로도 조절할 수 있습니다. Escape로 진행 중인 드래그를 취소하고, 한 번의 드래그는 실행 취소 한 번으로 되돌립니다.

## YouTube 재생 확인

플레이어 구성 오류 153은 유튜브에 필요한 출처 정보가 누락될 때 발생합니다. 1.1.0은 편집기와 저장된 본문에서 iframe의 referrerpolicy="strict-origin-when-cross-origin"을 유지합니다. 기존 사이트 업데이트 시 npm run build로 정적 자산을 다시 복사하고 다시 배포하세요. 원본 영상의 오류 101·150은 영상 소유자가 외부 사이트 재생을 허용하지 않는 경우입니다. 이런 영상은 원본 영상 열기를 이용하거나 외부 재생을 허용한 영상으로 교체하세요. 본인 소유 영상이라면 YouTube Studio에서 퍼가기 허용 설정을 확인하세요.

## 다른 홈페이지에 연결

`npm install ./mcg-page-manager-1.2.0-clinic.5.tgz`로 설치한 뒤 서버의 요청 처리기에 연결합니다.

```js
import {createPageManager} from '@mcg/page-manager';

const manager = createPageManager({
  id: 'my_website',
  siteName: '새 홈페이지',
  logo: '/logo.svg',
  favicon: '/favicon.png',
  publicPostBase: '/articles/',
  categories: [
    {slug:'notice', name:'공지사항'},
    {slug:'stories', name:'이야기'},
  ],
  review: {enabled:false},
  theme: {primary:'#213d78', dark:'#172e5c', pale:'#edf1f8'},
});

export async function handle(request) {
  const managed = await manager.fetch(request);
  if (managed) return managed;
  return existingWebsite(request);
}
```

`manager.fetch()`가 처리하지 않는 경로는 `null`을 반환합니다. `createPageManager()`는 자체 인증을 거칩니다. 환경변수나 요청 헤더의 `LOCAL_PREVIEW`, `ADMIN_AUTHENTICATED`로 인증을 생략하지 않습니다. 별도 `localPreview:true` 옵션도 개발 환경의 루프백 주소에서만 허용합니다. 내부 `src/routes.js`는 인증된 호스트 컨텍스트용 구현이므로 직접 공개 요청에 연결하지 마세요.

정적 자산은 다음으로 복사하고 `/page-manager/`에서 제공하세요.

```js
import {copyPageManagerAssets} from '@mcg/page-manager/assets';
await copyPageManagerAssets('public/page-manager');
```

기본 Pretendard 폰트와 라이선스를 함께 배포합니다. 기본 Page Manager 로고는 설정에서 교체할 수 있습니다. 글 주소를 바꾸면 공개 홈페이지도 `publicPostBase`에 맞는 페이지를 구현해야 합니다. 메뉴 항목이나 경로 자체를 임의의 위치로 바꾸는 기능은 1.0에 포함하지 않았습니다.

## 사이트별 설정

`storageName`은 연결 상태 화면에 표시할 저장소 이름입니다. `id`는 사이트마다 다른 영문 식별자를 지정하세요. 세션 쿠키와 서명 키의 구분에 사용합니다. `siteName`, `logo`, `favicon`, `eyebrow`, `copyright`, `monogram`, `welcomeTitle`, `policyUrl`, `publicPostBase`, `categories`, `review`, `theme`를 설정할 수 있습니다. 주제 slug는 영문 소문자·숫자·하이픈이며 중복될 수 없습니다. 색상은 6자리 HEX 값입니다.

검수가 필요한 주제에는 `reviewRequired:true`를 넣습니다. 해당 글은 작성자·핵심 답변·실제 검수자·유효한 검수일·검수 승인 없이는 발행할 수 없습니다. `review.label`, `approvalText`, `help`로 안내 문구도 바꿉니다. 단순 회사 소식 사이트에서는 검수를 끌 수 있습니다. HTML의 `<details><summary>`·표는 코드 모드로 편집·저장하세요. 화면 편집기에서 실제로 내용을 변경하면 화면 편집기가 지원하는 서식으로 바뀝니다.

## 저장소와 운영 배포

사이트마다 별도 Supabase 프로젝트/저장소와 관리자 비밀번호를 사용하세요. 이 모듈은 여러 사이트의 데이터를 한곳에 합치거나 계정을 공유하는 중앙 관리 서비스가 아닙니다. 기존 사이트 데이터에 새 사이트를 덮어쓰지 마세요.

Vercel 환경변수:

| 이름 | 값 |
| --- | --- |
| `ADMIN_USERNAME` | 관리자 아이디, 기본값 `admin` |
| `ADMIN_PASSWORD` | 사이트별 관리자 비밀번호, 기본 비밀번호 없음 |
| `SUPABASE_URL` | 해당 사이트 Supabase 프로젝트의 HTTPS URL |
| `SUPABASE_SECRET_KEY` | 서버 전용 secret 키 (`SUPABASE_SERVICE_ROLE_KEY`도 지원) |
| `SITE_URL` | 실제 운영 도메인의 HTTPS 주소 |
| `SITE_INDEXING` | 준비 중에는 `off`, 검색 수집 허용 시 `on` |

새 Supabase 프로젝트에서는 `migrations/supabase.sql`을 SQL Editor에서 실행합니다. 기존 posts 테이블에는 데이터 삭제나 스키마 초기화 없이 `grant select, insert, update, delete on public.posts to service_role;` 권한이 있는지 확인하세요. 브라우저 역할에는 권한을 주지 않습니다. 데이터는 호환되는 `posts` 레코드 구조를 유지합니다.

기존 저장소는 `createPageManager(config, {storage: DB})`로 연결할 수 있습니다. `DB.posts`에 비동기 `list()`, `get(id)`, `save(post)`, `delete(id)`가 있거나, D1 형식의 prepare/bind/all/first/run을 지원하면 됩니다. SQLite 보조 어댑터는 `@mcg/page-manager/sqlite`에서 제공합니다. 운영 환경의 임시 메모리 DB로 대체하는 자동 동작은 없습니다.

starter의 Vercel 프로젝트는 `starter`를 Root Directory로 선택합니다. preset은 Other, Build는 `npm run build`, Output은 `public`입니다. starter/vendor의 tgz 파일도 저장소에 포함해야 상대경로 설치가 됩니다. 로컬 SQLite에 쓴 글을 운영 Supabase로 자동 전송하지 않습니다.

## 공개 홈페이지 데이터

서버에서 `await manager.publishedPosts()`를 호출하면 발행된 글만 반환합니다. 이미지 원본 데이터와 승인 플래그는 제외하고 공개 `coverUrl`을 제공합니다. `postBody(post)`는 정리한 HTML, `postText(post)`는 텍스트, `postHeadings(post)`는 목차를 반환합니다. 관리자·API 경로를 방문자 메뉴나 사이트맵에 넣지 마세요. 공개 템플릿과 SEO 출력은 연결한 홈페이지의 책임이며, starter에는 기본 글 목록·상세·canonical·BlogPosting·사이트맵이 있습니다.

## 범위와 업데이트

현재 소유자 1계정 모델입니다. 다중 관리자·권한 그룹·중앙 멀티사이트 운영·메뉴/일반 페이지 빌더·영상 파일 저장은 포함하지 않습니다. 로그인 제한은 인스턴스별이며 필요 시 호스팅 방화벽이나 공유 제한기를 추가하세요. 기존 서버 보안 동작을 유지합니다.

공통 기능은 이 패키지에서 수정하고 각 사이트에는 버전을 올려 설치합니다. 사이트별 설정 파일과 DB는 유지하세요. 소스 작업 시 `npm install`과 `npm run build`로 자산을 다시 만듭니다. 배포용 tgz에는 자산이 이미 빌드되어 있어 설치한 사이트가 Quill/Vite를 별도로 빌드할 필요가 없습니다. 외부 npm 레지스트리에는 자동 게시하지 않습니다.

## 1.2.0-clinic.5 통합

이미지·문단 정렬과 원본 이미지 업로드를 포함합니다. 공개 사이트에서도 `/page-manager/article-images.css`를 기존 사이트 스타일 뒤에 로드하세요. 빌드 도구는 이 스타일과 원본 업로드 모듈 `image-upload.js`를 함께 복사합니다. 이미지는 512KiB 단위로 나누어 전송하고 기존 posts 테이블의 별도 이미지 레코드로 보존합니다. 글 저장은 이미지 주소만 전송하며, 이미지 응답은 스트림을 사용합니다. 기존 글에 포함된 원본 이미지도 계속 읽고 편집할 수 있습니다. 전송·저장소의 서비스 한도는 계속 적용됩니다.
