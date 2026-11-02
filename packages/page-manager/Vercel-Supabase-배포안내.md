# Vercel + Supabase 배포 · 1.2.0-clinic.6

## 새 프로젝트

1. Supabase의 SQL Editor에서 `supabase/01-new-project.sql`을 실행합니다. posts와 통계 전용 테이블/RPC를 함께 생성합니다.
2. Vercel에 `starter` 폴더를 Root Directory로 연결합니다. Framework는 Other, Node.js는 24.x, Install은 `npm install`, Build는 `npm run build`, Output은 `public`입니다. `starter/vendor`의 tgz도 Git 저장소에 포함하세요.
3. Vercel Environment Variables에 아래 6개 값을 입력합니다. Production과 Preview는 별도 DB 프로젝트를 권장합니다.
4. Deploy 후 `/admin/`에 로그인하고 **통계 사이트 관리**를 엽니다. `SITE_URL`의 호스트가 기본 등록됩니다. www 등 실제 사용 도메인을 추가하고 저장합니다.
5. starter의 공개 페이지에는 추적 스크립트가 이미 연결되어 있습니다. 다른 홈페이지에 붙이는 경우 아래 코드를 모든 공개 페이지의 `</body>` 앞에 한 번 넣습니다. 사이트 ID는 설정의 `id` 또는 통계 사이트 관리에서 등록한 ID입니다.

| 환경변수 | 설정 |
| --- | --- |
| SITE_URL | 실제 대표 HTTPS 도메인, 예: https://your-clinic-domain.kr |
| SITE_INDEXING | 준비 중 off, 검색 수집 허용 시 on |
| ADMIN_USERNAME | 관리자 아이디 |
| ADMIN_PASSWORD | 관리자 비밀번호 |
| SUPABASE_URL | 프로젝트 HTTPS URL |
| SUPABASE_SECRET_KEY | 서버 전용 sb_secret_ 키 (기존 SUPABASE_SERVICE_ROLE_KEY도 지원) |

`VERCEL`은 플랫폼이 자동 설정합니다. 브라우저 공개 환경변수 이름에 secret 키를 넣지 마세요.

```html
<script defer src="https://관리자도메인/page-manager/tracker.js" data-site-id="my_website"></script>
<a href="tel:전화번호" data-track-event="전화 버튼 클릭">전화문의</a>
```

Vercel의 `api/index.js`는 Node.js Fetch 방식으로 홈페이지와 관리자, 수집 API를 처리합니다. `vercel.json`이 경로를 연결하며 빌드한 `public/page-manager` 파일은 정적 제공됩니다. 운영 데이터는 Supabase에 영구 저장합니다. 로컬 SQLite는 `npm run dev` 미리보기용입니다. 운영 함수는 SQLite나 파일 저장소를 불러오지 않습니다.

## 기존 clinic.5 프로젝트 업데이트

1. 기존 Supabase SQL Editor에서 **supabase/02-analytics-upgrade.sql**만 실행합니다. 기존 게시글과 이미지는 유지됩니다.
2. 새 tgz를 프로젝트 vendor 폴더로 복사하고 `npm install ./vendor/mcg-page-manager-1.2.0-clinic.6.tgz`를 실행합니다. package-lock.json 변경도 함께 배포합니다.
3. 기존 `page-manager.config.js`·홈페이지 코드·환경변수는 유지합니다. 빌드에서 `copyPageManagerAssets('public/page-manager')`를 실행해 tracker.js/statistics.js/statistics.css를 포함합니다.
4. 공개 템플릿에 추적 스크립트를 추가합니다. 기존 라우터가 /admin, /api/posts만 전달한다면 **/api/public/track 및 /api/statistics/** 도 `manager.fetch(request)`에 전달하도록 변경합니다. 동봉 starter는 이미 연결되어 있습니다.
5. Vercel 재배포 후 통계 사이트 관리에서 허용 도메인을 확인합니다. 변경 전 PHP/MySQL 통계 자료의 이관은 별도 작업이며 이 패키지는 설치 이후 방문부터 수집합니다.

## 포함 기능

- 오늘/어제/7일/30일/90일/이번 달/지난달/직접 기간, 사이트별·사람/봇/전체 필터
- 방문자, 페이지뷰, 평균 페이지 체류, 이탈률, 신규/재방문, 일별 추이
- 유입경로(검색·SNS·AI 링크 포함), 디바이스/OS/브라우저/봇, UTM 캠페인
- 인기 페이지 검색, 클릭/스크롤 이벤트별 발생 페이지, 최근 세션과 페이지 이동 상세
- 통계 사이트·허용 도메인·수집 중지 설정, 관리자 로그인 및 CSRF 보호
- Vercel 접속 IP: VERCEL=1 환경에서 플랫폼의 x-vercel-forwarded-for를 우선 사용

기존 패키지는 소유자 1계정 모델이라 통계도 동일한 관리자 로그인으로 보호합니다. PHP 버전의 MASTER/ADMIN 역할 구분이나 역DNS 회선 표시는 포함하지 않습니다.

## 저장 구조와 집계 기준

`pm_analytics_sites`, `pm_analytics_hits`, `pm_analytics_visitors`와 서버 전용 RPC `pm_analytics_ingest`를 사용합니다. 테이블은 RLS를 켜고 anon/authenticated 접근을 제거하며 service_role만 사용합니다. 수집은 RPC 한 번의 트랜잭션으로 저장하고, 체류시간 체크포인트는 페이지당 한 행에 최댓값만 갱신해 Vercel 동시 요청의 순서 역전과 중복을 처리합니다. 재배포·콜드스타트 후에도 동일 DB에서 이어서 조회합니다.

한국시간 기준입니다. 페이지뷰는 해당 기간에 시작한 페이지 수, 세션은 그 기간에 페이지뷰가 있는 세션 수입니다. 이탈률은 조회에 포함된 세션 중 수집된 페이지가 1개인 세션 비율입니다. 신규 방문자는 사이트별 식별자의 최초 수집 시각이 해당 기간에 있는 방문자이며 나머지는 재방문자입니다. 동일인이 다른 기기/브라우저/사이트를 사용하면 별도 방문자로 계산됩니다. 평균 페이지 체류는 체크포인트가 도착한 페이지의 화면이 보인 시간 평균입니다. 하트비트는 30초 간격이며 페이지를 숨기거나 떠날 때도 전송합니다. 전송 실패 시 실제 체류시간보다 적게 측정될 수 있습니다.

조회는 날짜 인덱스와 PostgREST 페이지 나눔을 사용하며 Supabase의 반환 행 제한 때문에 통계를 조용히 잘라내지 않습니다. 기간은 최대 366일이고 앞뒤 하루를 포함해 자정을 넘는 세션을 이어 봅니다. 트래픽이 커지면 짧은 기간을 사용하고 DB 집계/보관 정책을 추가하세요. 이 버전은 원시 기록을 Vercel 함수에서 집계하므로 대규모 트래픽용 사전 집계 시스템은 아닙니다. 자동 삭제/보관기간은 설정하지 않았습니다.

URL의 검색어와 해시는 제거하고 UTM 5개만 별도 저장합니다. 방문자·세션 UUID와 URL 경로·페이지 제목·유입 URL 경로·기기·이벤트·Vercel IP를 저장합니다. 폼 입력값은 수집하지 않습니다. 이벤트 속성에 개인정보를 넣지 마세요. Do Not Track=1이면 수집하지 않으며 관리자/API 페이지는 제외합니다. 봇 판별은 추정이고 JS를 실행하지 않는 봇은 집계되지 않습니다.

## 배포 후 확인

1. 관리자 로그아웃 상태에서 /api/statistics/overview가 401인지 확인합니다.
2. 공개 홈페이지를 열고 개발자 도구 Network에서 /api/public/track이 204인지 확인합니다. 403이면 Origin과 허용 도메인을 확인합니다.
3. 관리자 방문통계에서 기록을 확인합니다. 자동화 브라우저 테스트는 방문자 유형을 전체 또는 봇으로 선택합니다.
4. 500이면 Supabase SQL 실행 여부와 서버 secret 키, 프로젝트 URL을 Vercel 로그에서 확인합니다. Preview 보호 화면이 켜져 있으면 먼저 Preview 접근 인증을 완료해야 합니다.

로컬 빌드·통합 테스트와 브라우저 수집/UI 검증을 수행했습니다. 실제 Vercel 프로젝트 배포와 실제 Supabase 프로젝트 SQL 실행은 별도 계정 연결이 필요하므로 이 패키지 작업에는 포함되지 않았습니다.

참고: [Vercel Node.js Fetch 함수](https://vercel.com/docs/functions/runtimes/node-js), [Vercel IP 헤더](https://vercel.com/docs/headers/request-headers), [Supabase API 보안](https://supabase.com/docs/guides/api/securing-your-api).
