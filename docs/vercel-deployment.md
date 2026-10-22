# Vercel · Supabase 연결

GitHub 저장소: `mcg-2023/yangjeong-best-eye` (공개)

## Vercel 프로젝트

- 저장소 루트: `.` — GitHub 저장소 안에서는 website 하위 폴더를 선택하지 않습니다.
- Framework Preset: Other. `vercel.json`의 `framework: null`을 사용합니다.
- Build Command: `npm run build:vercel`.
- Output Directory: `dist/vercel`.
- Node.js: 24.x.
- API 진입점: `api/index.js`. 정적 자산은 출력 폴더에서, 나머지 경로는 같은 서버 렌더링 앱에서 제공합니다.
- Git 연동 후 main에 push하면 Vercel에서 자동 배포합니다.

## 게시글 저장소

Supabase 프로젝트에서 `supabase/migrations/202610220001_posts.sql`을 적용합니다. 기존 SQLite 파일과 Cloudflare D1은 Vercel의 영구 저장소로 사용할 수 없습니다. 로컬 `.data/journal.sqlite`는 유지되며 자동으로 외부 업로드하지 않습니다.

Supabase 연결은 서버에서만 사용합니다. `posts` 테이블은 RLS를 켜고 anon/authenticated의 직접 접근을 허용하지 않습니다. 서버의 secret key(또는 기존 service-role 키)로 접근하고, 공개 화면은 발행 글만 표시합니다. 검수·CSRF·발행 조건은 기존 앱과 같습니다.

## Vercel 환경변수

| 이름 | 용도 |
|---|---|
| `SUPABASE_URL` | Supabase 프로젝트의 HTTPS 주소 |
| `SUPABASE_SECRET_KEY` | 서버 전용 secret key. 브라우저나 Git에 저장하지 않습니다. |
| `SUPABASE_SERVICE_ROLE_KEY` | secret key가 없을 때만 쓰는 기존 서버 키 |
| `ADMIN_USERNAME` | 관리자 아이디. 기본값 admin |
| `ADMIN_PASSWORD` | 길고 추측하기 어려운 관리자 비밀번호. 설정 전에는 관리자 기능이 열리지 않습니다. |
| `SITE_URL` | `https://yangjeong-best-eye.vercel.app`처럼 최종 홈페이지 주소만 입력. 경로·쿼리 제외 |
| `SITE_INDEXING` | 검증 중 off. 공개 운영과 최종 주소 확인 후 on |
| `GOOGLE_SITE_VERIFICATION` / `NAVER_SITE_VERIFICATION` | 검색 서비스 소유권 인증 값. 필요한 경우에만 사용 |

비밀번호와 서버 키는 Vercel의 비공개 환경변수에만 입력합니다. 관리 페이지는 HTTPS Basic 인증을 요구하며 외부에서 보낸 기존 플랫폼 인증 헤더를 신뢰하지 않습니다. 미설정 상태에서 메모리나 임시 파일로 저장한 것처럼 응답하지 않고 503을 반환합니다.

`SITE_URL`의 앞뒤 공백·따옴표와 생략된 `https://`는 서버에서 보정합니다. 잘못된 주소 또는 이 프로젝트의 임시 배포·브랜치 주소는 `VERCEL_PROJECT_PRODUCTION_URL`, 그 값도 사용할 수 없으면 현재 공개 주소 `https://yangjeong-best-eye.vercel.app`로 대체합니다. 미리보기 주소를 대표 주소로 사용하지 않으며, 미리보기의 검색 제외 설정을 유지합니다. 커스텀 도메인을 연결하면 `SITE_URL`도 실제 대표 주소로 변경하세요. 환경변수 변경은 새 배포부터 적용됩니다.

## 확인

```sh
npm test
npm run build:vercel
```

Supabase 연결 후 실제 배포에서 비공개 초안 작성, 공개 목록 제외, 발행·수정·보관, 재요청 후 데이터 유지까지 확인합니다. 미설정 상태의 503이나 단순 빌드 성공은 게시판 연결 완료가 아닙니다.

참고: [Vercel Node.js 함수](https://vercel.com/docs/functions/runtimes/node-js), [Vercel 설정](https://vercel.com/docs/project-configuration/vercel-json), [Supabase API](https://supabase.com/docs/guides/api/creating-routes), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
