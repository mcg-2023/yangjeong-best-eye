# Page Manager clinic.6 적용 · 2026-11-02

사용자 제공 `page-manager-kit-v1.2.0-clinic.6-vercel-supabase.zip`의 tgz를 VERSION.json의 SHA-512와 대조한 후 기존 공통 모듈에 적용했습니다. 기존 사이트는 패키지 소스를 직접 참조하므로 `packages/page-manager`를 갱신하고 자산을 다시 빌드합니다. 추가 외부 의존성은 없습니다.

## 적용

- 관리자 방문통계·사이트 설정·세션 상세 화면과 Supabase 어댑터를 추가했습니다.
- 홈페이지 호스트가 통계 화면/API를 전달하도록 연결했습니다. `/api/public/track`만 로그인 없이 수집을 허용하며, 통계 조회·사이트 설정·게시글 API는 기존 세션 인증과 CSRF 검사를 유지합니다.
- `SITE_URL`의 검증된 대표 도메인을 기본 수집 대상으로 등록합니다. 미리보기 도메인은 운영 허용 목록에 자동 추가하지 않습니다.
- 공개 페이지에 `yjbest` 추적 스크립트, 전화문의·빠른 메뉴 클릭 이벤트를 연결하고 개인정보 안내를 수집 동작에 맞게 갱신했습니다.
- 신규 자산 tracker.js, statistics.js/css와 업로드 모듈의 빌드 포함 여부를 확인했습니다.
- 기존 원본 이미지 업로드의 직렬 처리, 삽입하지 않은 이미지 보존, 공개 글에서 제거한 이미지의 비공개 캐시 처리, 관리자·공개 글 이미지 정렬 CSS를 유지했습니다. 제공 패키지에서 빠진 이 보완사항은 덮어쓰지 않았습니다.

## 운영 DB

`yangjeong-best-eye` 프로젝트에 추가 마이그레이션 `page_manager_clinic_6_analytics`를 적용했습니다. 동일 SQL은 `supabase/migrations/202611020001_analytics.sql`에 보관합니다.

통계용 sites/hits/visitors 테이블과 원자적 수집 RPC를 추가했습니다. 새 테이블의 RLS를 켜고 anon/authenticated의 접근을 차단했으며 service_role만 서버에서 사용합니다. 로컬 미리보기는 `drizzle/0001_analytics.sql`을 한 번 적용합니다.

적용 전후 기존 posts 레코드 11개(글 9개·이미지 레코드 2개)의 개수와 전체 내용 해시가 같았습니다. 운영 글·이미지는 변경하지 않았습니다.

## 검증

- 자동 테스트 41개 통과: 기존 인증·검수·HTML·원본 이미지 회귀 검사, 패키지 통계 검사 7개, 실제 홈페이지 호스트 연결 검사 2개를 포함합니다.
- Vercel 빌드 통과. 통계·업로드·이미지 정렬 자산과 상대 import가 모두 포함됐습니다.
- 운영 DB에서 anon/authenticated의 통계 조회 불가, 서버 수집 RPC 실행 권한 및 테이블 RLS를 확인했습니다.
- 브라우저 화면 직접 검수는 로컬 연결 시간 초과와 Windows 브라우저 URL 인식 실패로 완료하지 못했습니다.

Supabase 보안 권고에서 기존 `rls_auto_enable()` 함수의 브라우저 역할 실행 권한이 감지됐습니다. 이번 통계 마이그레이션에서 만든 함수가 아니며 변경하지 않았습니다. [Supabase의 권한 점검 안내](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)를 참고하세요. 새 통계 테이블에 정책 없이 RLS를 켠 상태는 브라우저 직접 접근을 막고 서버 역할만 사용하는 설계에 따른 것입니다.
