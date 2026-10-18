<!-- docs/research/final-independent-20261018/VALIDATION.md -->
# 기준선 검증 기록

- 기준 제품: main c3a03d168. 제품 코드는 수정하지 않았다.
- pnpm --filter web typecheck: PASS. 전체 앱 및 스크립트 타입 검사.
- pnpm --filter web exec tsc -p tsconfig.scripts.json: PASS. 최종 실행기 두 파일 포함.
- pnpm --filter web exec eslint scripts/final-independent/probe-delivery-provenance.ts scripts/final-independent/audit-task-support.ts: PASS.
- node agents/scripts/check.mjs --quiet 및 git diff --check: PASS.
- 자체 보고서 3개 Markdown의 로컬 링크: 누락0.
- FI-001 최초 조합·같은 역할 조합: 모두 실제 SQL PGlite에서 결함 재현. 명시 delivery 대조군은 모두 evidence=true. 이는 제품 테스트 PASS가 아니라 반례 재현 성공이다.
- 적용 이력 4개: 실제 DB statements SHA와 저장소 SHA 전부 일치. #286~#292 필수8종 CI SUCCESS 재사용. e2e-shared-dev SKIPPED를 실DB PASS로 세지 않음.
- 실제 개발 DB: READ ONLY 집계·카탈로그 SELECT만 수행. 브라우저/사용자 계정 생성·쓰기 없음. 기존 PC·권한·격리 검증은 원본 증거를 재사용하고 새 통합 코드가 오면 변경 범위를 재검증한다.
- 신규 통합 PR: 관찰 시점 #292 이후 없음. 최종 제품 ACCEPT나 전체 수용 완료를 선언하지 않음.
- 초기 FI-001 전달: 로컬 DL-0148 기록 후 게시 요청이 자동 심사에서 거절됐다. 이후 사용자가 해당 자료 게시를 명시 승인하여 검증 브랜치 28dfeeca9와 GitHub 이슈 #293을 게시했다. 거부 우회 없음.

## 새 총괄 커밋 조기 독립 검증

- b4fbf4d5c 보류 authored SQL: PGlite에서 FI-002(역할 재자격화), FI-003(동일 본문 그룹명 변경), FI-004(licensed 권리의 평가 범위 누락) 재현. 실제 PostgreSQL17.10 두 연결에서 FI-006(동시 같은 묶음 납품2행) 재현. 정상 통과를 주장하지 않음.
- 6b988d0f5 콘텐츠: 9문항 Codex 판독을 작성자 키/Claude A·B 출력 열람 전 봉인. 요지 선택9/9 일치, 우선 선택 중심 문장9/9 채점 수용. 연구 사례의 모집단/측정 결과 FI-005는 별도 콘텐츠 REWORK.
- 새 PGlite/Gold 실행기 두 파일 tsc scripts 및 eslint: PASS. 실제 PostgreSQL 실행기의 검사는 후속 결과를 별도 기록.
- 새로운 FI-002~006 자료의 공개 게시 요청은 자동 심사가 FI-001과 다른 payload라며 거부했다. 해당 자료는 로컬 공용 DL-0149 및 보고서에 기록했으며 추가 외부 게시 범위 승인 대기. FI-001 게시 승인으로 확대 해석하여 push하거나 다른 경로로 게시하지 않음.
- 최종 스크립트 tsc scripts / 실제 PostgreSQL 실행기 eslint: PASS. 시험 서버2건의 종료·PID 부재·절대 경로를 확인하고 이 실행이 만든 데이터 디렉터리만 정리했다. 재현 로그와 의존 도구는 보존했다.

## 종단 연결 변경 범위(52a31d988)

- 기존 authored-flow 종단 10건: PASS(고정 커밋 독립 추출, 실제 DB 환경값0, 쓰기 차단 preload).
- 철회 반례: DB valid=false/서버 open=ok/기존 납품2개로 요청충족/orderOpened=false. FI-007로 기록.
- Chromium 1280/1440 실제 새 컴포넌트: 21개 관찰, 키보드 선택·오류·빈 공급·가로 넘침0. 합성 API/지문 및 Link 래퍼 범위, 실제 CsatShell/팝업/DB/학습지도 복원은 미검증.
- 같은 답 재시도 요청 메타데이터를 G2 원자 본문에 재생: 첫 요청 inserted/동일 원문 duplicate/화면 재시도 conflict(두 폭). FI-008로 기록.
- [전체 범위와 원본](./AUTHORED_INTEGRATION_REVIEW.md). 최종 통합 PR·실제 공급·사람 승인 완료로 확대하지 않음.
- 실제 창작9문항 콘텐츠 길이 추가 렌더링(기존 상호작용 미반복): 1280/1440 ×9문항에서 가로 넘침0·44px 미만 활성 버튼0. 교수7단계·안내연습2문항 hints를 읽고 FI-009의 학습자 문장 번호 불일치를 확인했다.
- 새 mjs 실행기3개 ESLint/구문 검사, 자체 보고서7개 로컬 링크(누락0), check.mjs 및 git diff --check: PASS.

## 필수 반례의 후속 확인

- 다른 TASK 자격 혼입: 기존 FI-002에 등록 TASK와 다른 FQ/납품 TASK 조합 추가. 공급 valid=true, G2에서 뒤늦게 task mapping 거절.
- 본문만 열고 닫은 선행 노출: 새 FI-010 재현. open 두 번 후 sessions0/exposure none, 제출 뒤 first_exposure/evidence=true. 새 반례1건만 실행했고 기존 종단10건은 필터로 SKIPPED(재검증 PASS에 합산하지 않음).
- 실제 개발 DB 쓰기·사람 Gold/권리 승인·콘텐츠 출시 승인 없음. 새 외부 게시 범위 승인 대기 상태에서는 로컬 공용 원장으로만 전달.

## 새 공급 원장의 실제 역할 검사

2026-10-18 개발 DB 카탈로그를 READ ONLY로 조회하여 새 객체의 기본 권한 환경을 확인했다. `postgres`의 public 테이블 기본 grant는 anon/authenticated/service_role, 함수 기본 grant는 postgres/service_role이고 `service_role`은 BYPASSRLS=true/superuser=false, 관리자 판정 helper는 SECURITY DEFINER였다. authored 표는 여전히 미설치다. 이 관찰은 보류 SQL의 실행 결과가 아니다.

이 기본값을 독립 PostgreSQL17.10에 반영하고 실제 `SET ROLE authenticated/anon/service_role`로 19개 경계를 검사했다. [결과](./authored-roles.json)와 [실행기 --rls-only](../../../apps/web/scripts/final-independent/probe-authored-concurrency.ts). 이전 동시 납품 반례를 다시 실행하지 않았다.

- A의 자기 납품1행, B의 타인 납품0행. B의 타인 수요 공급/납품 결속 RPC는42501로 거절됐다.
- 학습자의 Gold 포함 authored 행/사람 결정 행은0, 관리자와 서버 역할의 필요한 읽기는 성공했다. anon Gold 조회는 거절됐다.
- 학습자·서버 역할의 직접 Gold/사람 결정 쓰기, 학습자의 결속 원장 직접 삽입은 거절됐다. 일반 학습자·로그아웃·사용자 없는 서버 역할의 사람 결정 RPC도 거절됐다.
- 학습자의 내부 Gold hash 함수 실행은 거절됐다. 19개 모두 기대 결과다. 새 권한 침해 결함은 발견하지 않았다.

범위: 최소 의존 스키마의 실제 pending 공급 정책/함수 권한 검사다. JWT 검증·실제 관리자 행위가 사람인지에 대한 증명·전체 Workspace 앱·실제 개발 DB E2E를 대신하지 않는다. fixture의 사람 결정은 로컬 합성 승인뿐이다. 실제 Gold/권리 승인이나 새 SQL 적용은 수행하지 않았다. 시험 서버 종료·PID/프로세스 부재·절대 경로를 확인하고 이 실행의 데이터 디렉터리만 정리했다.

## 전체 TASK별 관통 증거

- [실제 집계 SQL](./task-runtime-snapshot.sql)·[원본 집계](./task-runtime-snapshot.json): READ ONLY on, 자격/납품/결속 근거0, 새 authored 표 미설치. 개인정보/응답 SELECT 없음.
- [전체 TASK 대조](./TASK_RUNTIME_COVERAGE.md): 기존30개 메타데이터/정본 원본 동일성 확인, 후보의 명시 근거 키/창작 세트 및 실제 집계만 연결했다. 기존 판정 시험 재실행 없음. live/ready나 synthetic 미표시1행을 제품 관통/효과 성공으로 세지 않음.

- FI-011: 고정 실제 지도 함수의 새 반례3건(확인 링크/전이 후 요구/지문 정체성→수행량)을 재현했다. 기존 과제 키와 합성 기출 형식 지문의 정상 대조군을 포함했다. actual authored fixture2행이 있어도 로더가 이를 읽지 않음을 확인. 새 검사만 실행, 전체 DB/브라우저 E2E로 확대하지 않음.

## PR303 변경 범위

- c4b9f434e 독립 추출: authored-flow10/FI-001 실제SQL6/binder단위10=26 PASS. 실제 DB 쓰기 차단 preload, 환경값0.
- FI-007/010: 새 deliveryId 입력을 포함해 각 반례1건만 재실행, 현재 로그 두 개에서 결함 유지. 기존10건은 필터 SKIPPED.
- v2 독립 변경 판독의 봉인 SHA 일치. 실제 고정 grader 선택9/9·주요 주장9/9 수용. 기존 v1 지식이 있는 판독이며 새 맹검 검토자로 계산하지 않음.
- 보류 SQL sha b4=c4 동일. 기존 SQL·PostgreSQL 동시성·역할 결과 재사용. de5065b51 신형식 변화는 아직 검증 중. [PR303 상세](./PR303_REVIEW.md).
