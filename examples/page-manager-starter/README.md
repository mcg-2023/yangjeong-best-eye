# 새 홈페이지 시작 프로젝트

1. 이 `starter` 폴더 안의 `vendor`에 설치용 tgz가 있습니다. 다른 위치로 옮길 때도 vendor를 함께 옮깁니다.
2. Node.js 24 설치 후 이 폴더에서 `npm install`, `npm run build`, `npm run dev`를 실행합니다.
3. `http://127.0.0.1:5180/admin/`에서 글을 작성합니다. 로컬 파일 `.data/posts.sqlite`에 저장됩니다.
4. 사이트 이름·로고·색상·글 주제는 `page-manager.config.js`에서 변경합니다.
5. 운영 배포는 공통 패키지 README의 Supabase SQL과 Vercel 환경변수 설정을 따릅니다.

현재 폴더의 홈페이지 디자인은 연결 예시입니다. 기존 홈페이지에 적용할 때는 관리자 모듈과 공개 게시글 데이터만 연결하고 기존 디자인을 유지할 수 있습니다. 개발 서버는 로컬 확인용이며 운영에서는 Vercel 진입점을 사용합니다. 실제 관리자 비밀번호나 secret 키는 파일/공개 저장소에 넣지 마세요. `.env.example`은 항목 안내이며 비밀 값을 포함하지 않습니다.
