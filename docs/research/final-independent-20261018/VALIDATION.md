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
