# Task Flow PLAN
## 작업 원칙
한 번에 아래 작업 하나만 구현한다. 실제 확인 전에는 완료로 표시하지 않는다.
상태는 [ ] 미완료, [x] 확인 완료로 관리하고 확인 결과를 각 항목 아래 기록한다.
## 2장: 브라우저 앱
- [x] T01: frontend/index.html, styles.css, app.js 생성. 제목 입력·등록·목록만 구현한다.
  확인: `/usr/bin/python3 -m http.server 5501 --bind 127.0.0.1 --directory frontend`로 실행. 두 항목 등록 및 공백 제목 거절 확인. HTML 형태 입력이 글자로 표시되고 새로고침 후 목록이 초기화됨을 확인. 남은 오류 없음.
- [x] T02: localStorage(task-flow-v1) 저장·복원.
  확인: `python3 -m http.server 5502 --bind 127.0.0.1 --directory frontend`로 실행. 두 항목 저장 후 새로고침해도 유지됨을 확인. 손상된 JSON을 넣었을 때 값이 그대로 보존되고 등록이 중지되며 안내가 표시됨을 확인. 남은 오류 없음.
- [x] T03: 상태 변경, 수정, 삭제 확인.
  확인: `python3 -m http.server 5505 --bind 127.0.0.1 --directory frontend`로 실행. 상태 변경과 새로고침 후 유지, 대상 항목만 수정, 삭제 취소 시 유지, 확인 후 삭제를 브라우저에서 확인. T02 형식의 기존 항목에 ID와 TODO 상태가 부여되어 유지됨을 확인. 남은 오류 없음.
- [x] T04: 설명·우선순위·마감일·검색·필터·지연 표시.
  확인: `python3 -m http.server 5506 --bind 127.0.0.1 --directory frontend`로 실행. 설명·우선순위·마감일 저장 및 표시, 제목 검색과 상태·우선순위 필터의 AND 적용을 확인. 필터 결과에서 수정·삭제가 해당 ID에만 적용되고, 어제 마감 TODO는 지연 표시되며 DONE은 지연 표시되지 않음을 확인. 남은 오류 없음.
## 3장: API
- [x] T05: API-SPEC.md 작성, FastAPI /api/health 구현.
  확인: `.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001`로 실행. `curl --fail --include http://127.0.0.1:8001/api/health`에서 200과 `{"status":"ok"}` 확인, `/openapi.json`에 Task Flow health endpoint 확인. 8000 포트는 기존 다른 앱이 사용 중이어서 8001로 검증함. 남은 오류 없음.
- [x] T06: 메모리 기반 /api/tasks GET과 POST.
  확인: `.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8002`로 실행. `/docs`에서 GET·POST 확인. POST 등록 결과 201, 제목 trim 및 기본값 확인, GET 목록에서 등록 항목 확인, 공백 제목 요청에서 422 확인. 메모리 저장은 프로세스 재시작 시 초기화됨. 8000·8001 포트는 이미 사용 중이어서 8002로 검증함. 남은 오류 없음.
- [x] T07: PATCH·DELETE와 필터 구현.
  확인: `.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8005`로 재검증. PATCH에서 미전달 필드 유지 및 마감일 null 처리, 제목·상태·우선순위 필터의 AND 적용을 확인. 빈 PATCH·잘못된 제목·날짜는 422, 없는 ID의 PATCH·DELETE는 404, 정상 DELETE는 204 확인. OpenAPI에 404 응답 문서화를 추가함. 8000~8004 포트가 사용 중이어서 8005로 검증함. 남은 오류 없음.
- [x] T08: 프런트엔드 저장 처리를 API 호출로 교체.
  확인: 프런트엔드에서 작업 등록·수정·상태 변경·삭제 후 API 목록 및 MariaDB 저장 결과가 일치하는지 8080/8001에서 확인. 브라우저 origin localhost:8080과 127.0.0.1:8080만 CORS 허용. 검증용 작업은 삭제함. 남은 오류 없음.
## 4장: DB
- [x] T09: MariaDB 전용 사용자·DB와 .env 준비. 접속 확인.
  확인: `.env`에서 DB 설정을 읽어 비밀번호를 노출하지 않고 접속 테스트. MariaDB TCP 연결 성공, `SELECT DATABASE(), CURRENT_USER(), 1` 결과 `task_flow`, `task_flow_app@localhost`, `1`. `.env` 권한 600 확인. 남은 오류 없음.
- [x] T10: backend/database.py, models.py, init_db.py 생성.
  확인: `.venv/bin/python -m backend.init_db` 실행 후 `task_flow` DB의 `tasks` 테이블과 id, title, description, status, priority, due_date, created_at 컬럼 확인. SQLAlchemy 연결로 `SELECT DATABASE(), CURRENT_USER(), 1`도 확인. Unicode 비밀번호 호환을 위해 MySQL Connector 드라이버 사용. 남은 오류 없음.
- [x] T11: API 메모리 저장을 DB로 교체.
  확인: MariaDB에 등록 행과 필터 결과를 확인하고, API 프로세스를 재시작한 뒤에도 조회되는 것을 확인. PATCH 부분 수정과 마감일 null 처리, 공백 제목 422, 없는 ID의 PATCH·DELETE 404, 정상 DELETE 204 확인. 검증용 행은 삭제함. datetime 타입 import 오류를 수정하고 재기동 후 검증 완료. 남은 오류 없음.
## 5장: 서버 분리
- [x] T12: DB 서버 구성 후 App 서버에서 SELECT 1 확인.
  확인: 현재 WSL의 MariaDB를 DB 서버로 사용. `.env`(DB_HOST=127.0.0.1, 포트 3306)로 App의 SQLAlchemy 엔진에서 TCP 접속해 `SELECT 1, @@hostname, DATABASE(), CURRENT_USER()` 결과 `1`, `DESKTOP-KRHCJE6`, `task_flow`, `task_flow_app@localhost` 확인. `tasks` 테이블 존재와 `/api/tasks` 200 확인. DB와 App이 같은 WSL이라 별도 머신 간 네트워크 접속은 검증하지 않았고 bind-address는 127.0.0.1 그대로임. 남은 오류 없음.
- [x] T13: App 서버 코드·가상환경·환경변수·systemd 구성.
  확인: 현재 WSL을 임시 App 서버로 설정하고 `deploy/systemd/user/task-flow-api.service`를 user-level systemd에 등록·활성화. 서비스 상태 `active`, `http://127.0.0.1:8003/api/health`에서 200과 `{"status":"ok"}` 확인. 환경변수는 `.env`를 EnvironmentFile로 연결하며 파일 권한 600 유지. 기존 API가 8001을 사용 중이어서 서비스 포트는 8003으로 분리함. 별도 DB 서버는 아직 준비되지 않아 현재 로컬 MariaDB 설정을 임시 사용하며, T12 이후 `.env`의 DB_HOST를 갱신해야 함. 남은 오류 없음.
- [x] T14: Web 서버 Nginx와 정적 파일·/api 프록시 구성.
  확인: 시스템 nginx(root 마스터, www-data 워커)가 8080을 받고 있고 `/etc/nginx/conf.d/flow-task.conf`가 `deploy/nginx/flow-task.conf`와 동일함을 `diff`로 확인(정적 파일 root는 frontend, `/api/` 프록시는 127.0.0.1:8000). `http://127.0.0.1:8080`에서 `/`, `/api/health`, `/api/tasks` 200 확인. 앞서 사용자 권한으로 `deploy/nginx/nginx.conf`를 8080에서 실행해 `/`·`/app.js`·`/styles.css` 200, Nginx 경유 POST 등록 후 MariaDB 행 확인, `task-flow-api.service` 재시작 후 유지, DELETE 204 후 제거를 확인함(검증용 행 삭제). 프런트는 same-origin `/api`를 사용함. 한계: 시스템 nginx 적용 후 정적 파일 403 여부와 Nginx 경유 등록·수정·삭제는 브라우저에서 직접 조작해 확인하지 않았고 curl 위주로 확인함. 사용자 권한 nginx(`deploy/nginx/nginx.conf`)는 종료되어 현재 사용되지 않음. 남은 오류 없음.
## 6장: 다중 사용자 (회원가입·로그인/로그아웃)
인증은 서버 세션 방식이다. 로그인 시 무작위 토큰을 HttpOnly·SameSite=Lax 쿠키로 보내고 DB에는 토큰 해시만 저장한다. 비밀번호 해시는 표준 라이브러리 hashlib.scrypt를 사용해 새 패키지를 추가하지 않는다. 기존 tasks 행은 삭제하지 않고 user_id를 비워 둔다.
- [x] T15: users·sessions 테이블과 tasks.user_id 컬럼 추가(DB 전용, API 동작 변경 없음).
  확인: `.venv/bin/python -m backend.init_db`를 두 번 실행(재실행해도 오류 없음). `users`(id, username, password_hash, created_at), `sessions`(token_hash, user_id, created_at, expires_at) 생성과 `tasks.user_id`(NULL 허용, 인덱스, users 외래키 ON DELETE CASCADE) 추가를 확인. 기존 tasks 2행은 삭제 없이 보존되고 user_id는 NULL임. 임시 사용자로 중복 사용자명 거절, 존재하지 않는 user_id 거절, 사용자 삭제 시 세션·할 일 연쇄 삭제를 확인한 뒤 검증용 행은 모두 삭제함. `task-flow-api.service` 재시작 후 `/api/tasks` GET 200, POST·DELETE(201→204)가 기존처럼 동작함. 아직 인증은 적용되지 않음. 남은 오류 없음.
- [ ] T16: POST /api/auth/register 회원가입(사용자명·비밀번호 검증, 중복 거절, 해시 저장).
- [ ] T17: POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me (세션 쿠키).
- [ ] T18: /api/tasks 전체를 로그인 필수로 바꾸고 user_id로 소유자 격리(401, 타인 항목 404).
- [ ] T19: 프런트 로그인·회원가입 화면, 사용자명 표시, 로그아웃 버튼, 401 처리.
- [ ] T20: API-SPEC.md 갱신, 두 사용자 격리와 Nginx 경유 전체 흐름 검증.
## 실행 기준
T01~T04: python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
T05~T11: 가상환경에서 python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
T08: App 서버에서 API를 8001로 실행하고 Web 서버에서 프런트엔드를 8080으로 제공.
T13 임시 WSL App 서비스: `systemctl --user status task-flow-api.service`, `/api/health` 포트 8003.
실제 존재하는 파일을 확인한 뒤 명령을 실행한다.
## 기록
각 작업에 변경 파일, 실행 명령, 실제 확인 결과, 남은 오류를 기록한다.
정상 동작을 확인한 작업 단위로 Git 커밋한다.