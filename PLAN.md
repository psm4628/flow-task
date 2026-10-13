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
- [ ] T06: 메모리 기반 /api/tasks GET과 POST.
  확인: /docs에서 등록 후 조회. 입력 위반은 422.
- [ ] T07: PATCH·DELETE와 필터 구현.
  확인: 미전달 필드 유지, 없는 ID 404, 삭제 204.
- [ ] T08: 프런트엔드 저장 처리를 API 호출로 교체.
  확인: 화면과 curl 목록이 같음. API 중지 시 오류 표시.
## 4장: DB
- [ ] T09: MariDB 전용 사용자·DB와 .env 준비. 접속 확인.
- [ ] T10: backend/database.py, models.py, init_db.py 생성.
  확인: python -m backend.init_db 실행 후 tasks 테이블 확인.
- [ ] T11: API 메모리 저장을 DB로 교체.
  확인: 등록한 행을 SQL로 조회. API 재시작 후 데이터 유지.
## 5장: 서버 분리
- [ ] T12: DB 서버 구성 후 App 서버에서 SELECT 1 확인.
- [ ] T13: App 서버 코드·가상환경·환경변수·systemd 구성.
  확인: App에서 /api/health 응답.
- [ ] T14: Web 서버 Nginx와 정적 파일·/api 프록시 구성.
  확인: Web 주소로 등록, DB 저장, App 재시작 후 유지.
## 실행 기준
T01~T04: python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
T05~T11: 가상환경에서 python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
실제 존재하는 파일을 확인한 뒤 명령을 실행한다.
## 기록
각 작업에 변경 파일, 실행 명령, 실제 확인 결과, 남은 오류를 기록한다.
정상 동작을 확인한 작업 단위로 Git 커밋한다.