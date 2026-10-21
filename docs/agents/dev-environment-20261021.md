# 개발환경 정리 · 브랜치 운영 표준화 — 2026-10-21

이 문서는 1차 정리와 후속 마무리의 실사·실행 기록이다. 최신 현황은 아래 「후속 마무리」 절을 따른다. 앞으로의 절차 정본은 [WORKTREE](../WORKTREE.md)와 [AGENTS](../../AGENTS.md)다. 상태는 확인 시점 기준이며 병렬 세션의 후속 변경은 자동 고정하지 않는다.

## 1. 정리 전·후

최초 로컬 main은 3d3cb47c1, 확인된 원격 main은 0649f8c0b였다(0/832). local/integration은 b4fc9ff83으로 원격 main과 36/163 갈라져 있었다. git fetch와 ls-remote로 원격을 직접 확인했다. 초기 브랜치 조회는 로컬 273개였고 병렬 작업 중 스냅샷에는 276개가 기록됐다. 추적 ref를 최신 원격 그 자체로 가정하지 않았다.

기존 공간 73개를 보존하고 임시 통합 공간 Vocaflow-env-standardize-20261021(chore/dev-environment-20261021)과 main 전용 Vocaflow-main-serving을 추가했다. 미확인 브랜치·worktree 삭제, stash, clean, reset, force push는 실행하지 않았다. 통합된 오래된 브랜치도 원문 복구용으로 유지한다. 브랜치 수 감소를 완료 기준으로 삼지 않는다.

제품 실행 소스 통합 커밋은 3cdb3bc764bd6b7e9e59265ebb7f9e97efef6adf다. 이후 도구·CI·문서 보완 d591b8ab4까지 로컬 main과 local/integration을 안전하게 fast-forward해 두 기준을 맞췄다. 최종 실사에서 worktree 75개·로컬 브랜치 275개였다. 병렬 세션의 변경도 있으므로 브랜치 수 차이를 이 작업의 삭제로 해석하지 않는다. 이 작업의 기존 브랜치 삭제는 0개다. 원격 main은 여전히 0649f8c0b이며 로컬 통합과 구별한다.

## 2. 보존한 작업

기본 Vocaflow는 design/replica-first에 수정 207개·미추적 파일 1,019개·병합 충돌 7개가 있었다. learner-tines-audit는 수정 112개·미추적 파일 92개로 기존 “120개” 보고와 달랐다. 해당 공간과 인덱스를 수정하지 않았다. final-product와 final-independent의 등록 작업/잠금, 학습자 디자인의 잠금, AI-Control의 로컬 상태도 보존했다. PID가 같은 app-server라도 같은 대화 소유로 가정하지 않았다.

## 3. 통합 범위와 남은 코드

최신 main 위에 integration 36커밋의 관리자 7/22 내비·권한 검사·도서/검수 복귀·수행/공급/계보 조회·팝업/사용성/도움말과 D3 이력을 합쳤다. 8개 충돌은 최신 승인/범위/검증 정책과 양쪽 이력을 보존해 해결했다. 추가로 factory-order-lineage의 완료된 4커밋(526d0b226까지)을 합쳐 TCP·VCB·기사·음성·PDCP의 저장/복구와 빌드 병렬도 보정을 포함했다. 이 두 번째 병합은 CHANGELOG만 충돌했다.

PR #244/#315/#122의 유효 동작과 연구 원장을 별도 보존했다. 다른 디자인 공간의 미커밋 결과, #271 시각 동등성, #140 원리 적재, #203 실 DB 검증 도구, #314 미채택 위임과 #323 보호 정책 제안은 자동 채택하지 않았다. #318은 계속 ACTIVE다.

## 4. PR 분류

local 표시는 로컬 main/이번 납품 분기에 포함됐다는 뜻이며 원격 main 병합을 뜻하지 않는다. PR의 기존 본문과 브랜치는 보존한다. 실제 종료/대체 PR 결과는 아래 실행 결과에 별도로 적는다.

| PR | 상태 | 근거/처리 |
|---|---|---|
| [#323](https://github.com/KangMin098/Vocaflow/pull/323) | BLOCKED | 필수 체크 축소/보호 정책 제안. 현 8개 보호 유지. |
| [#318](https://github.com/KangMin098/Vocaflow/pull/318) | ACTIVE | 학습자 디자인 공간의 진행 중 변경 보존. CI 변경만의 PR로 보지 않음(160경로). |
| [#317](https://github.com/KangMin098/Vocaflow/pull/317) | READY | 전체 변경과 후속 수정은 로컬 main에 포함. 원격 main 병합 대기. |
| [#315](https://github.com/KangMin098/Vocaflow/pull/315) | INTEGRATED (local) | 선택 라우터/등록부/가짜 세션 회귀 14개 보존. 자동 호출·실제 전송 없음. |
| [#314](https://github.com/KangMin098/Vocaflow/pull/314) | BLOCKED | 미채택 위임 정책/미적용 SQL. 채택/권한 완화하지 않음. |
| [#284](https://github.com/KangMin098/Vocaflow/pull/284) | INTEGRATED (local) | 봉인된 R1/R2 검토 원문 6파일 보존. 새 제품 수용으로 승격하지 않음. |
| [#278](https://github.com/KangMin098/Vocaflow/pull/278) | INTEGRATED (local) | DRAFT 문맥 주석 파일럿 4파일 보존. DB 적재/Gold 승격 없음. |
| [#271](https://github.com/KangMin098/Vocaflow/pull/271) | BLOCKED | 후속 지도 구현과 18경로 차이. 시각적 동등성 미검증으로 폐기하지 않음. |
| [#244](https://github.com/KangMin098/Vocaflow/pull/244) | INTEGRATED (local) | 폭 fallback·게임 설명 이력 중복·Esc 초기 등록 보존. 최신 중첩 팝업 구현 유지. |
| [#237](https://github.com/KangMin098/Vocaflow/pull/237) | INTEGRATED | 핵심 7파일 일치 및 후속 v3.2 구현 확인. README/이력은 후속 수정. |
| [#231](https://github.com/KangMin098/Vocaflow/pull/231) | INTEGRATED | 현 데이터/서버 projection의 상대 유형 계약을 기존 회귀 6개로 확인. |
| [#228](https://github.com/KangMin098/Vocaflow/pull/228) | ACTIVE | 미커밋 변경 2개, 소유 미확인. 임의 수정/종료 안 함. |
| [#223](https://github.com/KangMin098/Vocaflow/pull/223) | SUPERSEDED | 현재 v3.1/v3.2 교수 설계/구현으로 이어진 과거 설계안. 원문 브랜치 보존. |
| [#203](https://github.com/KangMin098/Vocaflow/pull/203) | BLOCKED | 실 DB 동시성 도구의 현 계약/승인 범위 미검증. 공유 DB에서 실행하지 않음. |
| [#140](https://github.com/KangMin098/Vocaflow/pull/140) | BLOCKED | 원리 데이터 적재와 현 정본 대응/승인 미확인. 자동 적재하지 않음. |
| [#122](https://github.com/KangMin098/Vocaflow/pull/122) | INTEGRATED (local) | 기존 D10 중복 버전 라쳇과 3회귀 복원. 낡은 강제 시작/인계 절차는 되살리지 않음. |
| [#117](https://github.com/KangMin098/Vocaflow/pull/117) | INTEGRATED (DB/local) | 적용 SQL을 실제 이력 버전/바이트로 복원, env fallback 보존. 현재 authenticated도 후속 정책으로 거부됨. |
| [#116](https://github.com/KangMin098/Vocaflow/pull/116) | INTEGRATED (DB/local) | 영상 writer의 anon/authenticated 권한 거부 확인. 실제 적용 버전의 SQL 바이트 복원. |
| [#303](https://github.com/KangMin098/Vocaflow/pull/303) | INTEGRATED | GitHub에서 병합 완료 및 원격 main 조상 확인. |
| [#250](https://github.com/KangMin098/Vocaflow/pull/250) | INTEGRATED | GitHub에서 병합 완료 및 원격 main 조상 확인. |
| [#326](https://github.com/KangMin098/Vocaflow/pull/326) | INTEGRATED | GitHub에서 병합 완료 및 원격 main 조상 확인. |

실제 정리: #116/#117/#122/#223/#231/#237/#244/#278/#284/#315 총 10개를 닫았다. 각 기존 본문을 보존하고 위 근거·대체 #327·원격 main 미병합 상태를 덧붙였다. 원본 원격 브랜치 10개의 SHA가 그대로 남은 것을 ls-remote로 재확인했다. 오래된 구현의 재적용을 막기 위한 중복 정리이며, 초안 #327의 통과/병합 완료로 표시하지 않는다. 남은 열린 PR은 #327 포함 9개다. ACTIVE/미검증 작업과 #317의 원격 통합 대기는 유지했다.

## 5. 포트와 실제 실행 기준

3000 목표는 main, 3001 목표는 임시 integration 검증이다. 처음 3000은 PID 12144, learner-tines-audit/apps/web의 개발 서버(HEAD 8f6c12eab + 미커밋)였다. 도중 PID 10300으로 재기동됐고 실제 경로는 기본 Vocaflow로 바뀌었다. 이 작업은 이 두 프로세스를 종료하지 않았다. 이후 재확인에서 3000/3001이 모두 비어 있었고, 3000 비점유를 다시 확인한 뒤 main 전용 공간에서 서버를 시작했다. 새 PID는 22436, cwd는 Vocaflow-main-serving/apps/web이며 소유 표식과 실제 리스너를 대조했다. 화면 확인 당시 main은 45affc5b0이며, 이후 도구·CI·문서 보완 d591b8ab4까지 fast-forward했다(제품 실행 코드 동일). 미커밋 디자인 원본 공간은 그대로다.

초기 3001은 PID 26244, factory-order-lineage의 next start였다. 해당 실행의 기존 기록은 BUILD_ID/13:07 KST와 HEAD 526d0b226에 결속돼 있다. 현재 HEAD만으로 빌드 동일성을 새로 단정하지 않는다. 후속 확인에서는 비점유이며 불필요한 서버를 추가하지 않았다. 3100은 전환 전 확인용으로만 사용했으며 최종 main 확인은 3000에서 한다. 화면 확인 결과는 아래에 기록한다.

## 6. 공통 규칙과 도구

AGENTS.md, CLAUDE.md, agents/router.md, docs/WORKTREE.md, PR_AUTOMATION_POLICY.md와 DECISIONS를 정리했다. 같은 목적/단계/AI 교대는 브랜치 유지, 기존 공간 재사용 우선, 독립 쓰기에만 분리한다. 일반 작업에 승인·큐·교차 리뷰를 추가하지 않았다. wt new는 기존 공간을 재사용하고 main/origin/main의 조상 관계로 뒤처지지 않은 통합본을 기본 base로 쓴다(자동 fetch 없음). LOCAL_FAST의 로컬 통합을 원격의 뒤처진 참조로 잃지 않는다. wt remove는 실제 브랜치·잠금·미통합 커밋을 확인하며 강제 삭제를 없앴다.

이미 켜진 다른 세션은 지침을 자동 재독하지 않는다. 그 공간의 파일은 강제 수정하지 않았다. 후속 작업은 최신 통합본의 공통 정본을 읽는다. 중앙 dev-mode.json은 다른 담당자 공간의 파일이므로 수정하지 않았다.

## 7. 검증과 적용 이력

| 항목 | 결과 |
|---|---|
| 브랜치 도구 | 8 통과 · 생략 0 (로컬 통합본 유지/기준 분기 포함) |
| 승인/모드/병합/범위/인계 회귀 | 40 통과 · 생략 0 |
| 선택 라우터 | 가짜 세션 14 통과, 실제 전송/게시 없음 |
| 마이그레이션 버전 라쳇 | 3 통과 · 에이전트 설정 검사 13/13 |
| 첫 통합 web 회귀 | 36파일/393 통과 · live 2개는 제외 후 실행(실 DB 시험으로 주장하지 않음) |
| 기존 상대 유형/원문 폭 | 2파일/7 통과 |
| 파이프라인 web 회귀 | 3파일/13 통과 |
| 기사/음성/PDCP | 4 + 4 + 2 통과; 첫 package 실행은 worker 상한/하한 충돌로 미실행 후 옵션 수정 |
| Chromium | 팝업 22 + TCP 4 통과 · 생략 0. 첫 팝업 실행은 CSS 준비 30초 초과로 실패, 120초 제한으로 재실행 |
| 타입 | 첫 통합 web 정규 두 tsconfig 통과. 최종 통합은 빌드의 타입 검사로 별도 확인 |
| 집중 lint | 첫 통합 오류 0/기존 ref 정리 경고 1. 전체 빌드 경고는 별도 |
| 전체 격리 DB E2E | 로컬 Docker 미설치로 미실행. Chromium UI 격리와 구별 |
| 후속 검사기/라우트 | 3파일/25 통과 · CI loopback/정본 함수 가드 4 통과 · 집중 lint 오류 0 |
| 최종 코드 CI | d591b8ab4: 필수 8개 성공·고장 E2E 추가 성공. web 6,479 통과/252 생략, turbo 15작업 성공. 일반 격리 E2E 31/31·고장 2/2 통과 |
| 원격 build | 95728f7a2와 d591b8ab4 각각 성공. 아래 CI 전체 상태와 구별 |

개발 DB는 읽기만 했다. DB1/DB2/I2/G2/D3 적용 이력 5개를 확인했고 D3 SQL은 실제 이력과 SHA-256 f94bf27f…aae3d8이 일치했다. #116/#117도 실제 적용 버전 20260920014828/20260920023713의 statements 바이트로 복원했다(각 e3a81fcc…901a39, 6a614002…ea1712). SQL을 적용/재적용하거나 데이터를 삭제하지 않았다. FINAL 창작 공급 등의 _pending_는 계속 미적용 제안이다.

## 8. 실제 제약과 실행 결과

GitHub 인증과 fetch는 가능하다. safe-merge가 개발 DB 적용 이력 해시를 읽을 때 필요한 SUPABASE_ACCESS_TOKEN은 현재 셸과 기존 web 환경 파일에 없다. MCP의 읽기 결과를 CLI 승인 게이트에 위조 입력하거나 병합 API로 우회하지 않는다. 원격 병합은 해당 정상 인증과 필수 CI/범위 계약이 충족돼야 한다. 3000은 비점유가 확인된 후에만 main 서버를 시작했다.

최종 코드 d591b8ab4의 필수 CI 8개 통과 후 `safe-merge.mjs 327 --scope-file <정확한 HEAD/45커밋/338경로 계약> --dry-run`을 재실행했다. 종료 3이며 차단 사유는 이미 적용된 SQL 3개의 DB 이력 읽기 인증 부재뿐이었다. PR #327은 초안으로 남기고 원격 main은 병합하지 않았다. 이력을 읽을 수 있는 기존 정상 인증 설정 경로가 필요하며, 토큰 값을 대화에 보내도록 요청하지 않는다.

<!-- final-execution:start -->
납품은 [초안 PR #327](https://github.com/KangMin098/Vocaflow/pull/327)에 푸시했다. 95728f7a2와 d591b8ab4의 GitHub Actions build는 각각 성공했다. 로컬 최종 빌드는 디스크 ENOSPC로 실패했으며 세션 중단 실행과 함께 성공으로 계산하지 않는다. 이 작업의 실패 빌드 캐시 19파일(1,730,848,778바이트)을 SHA-256을 보존해 `C:/Users/Administrator/AppData/Local/Temp/Vocaflow-env-cache-20261021`로 옮겼고 당시 D: 여유는 약 2.09GB가 됐다. 이후 재조회에서 약 32.6GB였으며 다른 세션의 정리 여부를 이 작업의 결과로 주장하지 않는다. 다른 공간 파일은 삭제하지 않았다.

3000의 실제 Chromium 확인은 /hub·/csat 200, 1440px 가로 넘침/JS 오류 0이다. 일반 계정의 /admin은 /hub로 이동했다. 인증된 관리자 전수 QA로 주장하지 않는다.

첫 CI verify의 세 실패는 계보 API의 명시적 HTTP 자동화 호출과 검사기의 오탐/줄바꿈 문제로 수정했다. 수정 검사기는 40줄 밖의 실제 바깥 루프도 검출한다. 전량 대조는 origin/main 150·통합본 151(차이는 제한된 TCP claim 종료 1곳), 재검출 19·오탐 제외 12를 모두 읽었다. 집중 3파일/25회귀를 통과했다. E2E의 신규 migration 실패는 빈 DB에 누락된 정본 trigger 함수 정의를 CI loopback fixture에만 복구해 조치했고 가드 4회귀를 통과했다. 운영 SQL 바이트·기존 실패 기준선을 바꾸지 않았다. [후속 코드 CI](https://github.com/KangMin098/Vocaflow/actions/runs/39550845789)는 d591b8ab4에서 성공했다. web 543파일/6,479회귀 통과·44파일/252회귀 생략, turbo 15작업 성공이며 build·타입·일반 격리 E2E·고장 E2E가 통과했다. 별도 sync-check의 문서/마이그레이션/manifest 검사도 성공했다. e2e-shared-dev는 생략이며 실 개발 DB 쓰기 시험으로 계산하지 않는다. 이 뒤 최종 보고서만 갱신한 커밋의 CI는 새 실행으로 구별한다. DB 이력 인증 부재로 원격 main 병합은 대기한다.
<!-- final-execution:end -->

## 후속 마무리 — 2026-10-21 (이번 요청)

이 절은 위 1차 정리 이력보다 최신이다. 원격 쓰기·push·PR 병합·PR 종료·브랜치 생성/전환·제품 전체 재병합은 이번에 0회다. 변경은 기존 정리 브랜치의 이 보고서와 CHANGELOG뿐이며 제품 코드·공통 운영 규칙을 다시 설계하지 않았다.

### 1. main과 실제 통합 화면

인테이크 main/local\/integration은 모두 e23e32cd8, origin/main은 원격 직접 조회와 같은 0649f8c0b였다. 로컬은 46 ahead/0 behind이며 서로 0/0이다. main-serving은 깨끗하고 3000 리스너 PID 22436, 부모 next dev PID 15732, 실제 cwd는 Vocaflow-main-serving/apps/web이다. workspace 의존성 7개도 모두 같은 main-serving/packages를 가리킨다. 3001은 재조회 당시 비점유이며 다른 세션용으로 그대로 둔다.

| 요청한 확인 | 이번 판정 | 실제 범위/남은 조건 |
|---|---|---|
| 학습자 진입 /hub | 화면 BLOCKED | 앞선 45affc5b0에서 실제 Chromium 200·렌더·오류/넘침 0의 증거는 기존 기록. 이번 새 화면 검증으로 계산하지 않음 |
| /csat/diagnosis?tab=map&view=full | BLOCKED | 이번 브라우저 도구가 첫 화면 관측 전에 종료. 요청 URL의 렌더/조작 미확인 |
| 지도↔Workspace 연결 | BLOCKED | 기반 learner_workspace/납품 관계 존재만 DB에서 읽음. 열기·복귀·기록 결속의 새 동작 검증 미실행 |
| 기출분석·학습자 설명 | BLOCKED | 현재 소스와 과거 코드 CI 증거는 재사용 가능. 실제 문항/설명 화면의 새 조작 결과 없음 |
| /admin/csat/sources | BLOCKED | 소스는 requireAdmin과 실 DB 조회 사용. 실제 관리자 세션의 렌더/탭·필터 미실행 |
| 관리자 메뉴·주요 공간 | BLOCKED | 기존 관리자 검증 문서는 과거 증거. 새 3000의 실제 메뉴 조작으로 승격하지 않음 |
| 교재공장↔Product Order | 부분 DB 확인 / 화면 BLOCKED | factory_order/factory_product_order와 계보 RPC 4종 존재 확인. 등록·연결·철회·생산·납품은 실행하지 않음 |

computer-use는 창 선택 후 “could not determine the current browser URL on Windows with enough confidence to enforce policy”로 자동 종료했다. 스킬이 참조하는 중단 지침의 “stop issuing app input”에 따라 앱 입력을 중단했다. 다른 자동화로 같은 차단 동작을 우회하지 않았다. 정상 URL을 확인할 수 있는 브라우저 연결이 복구된 다음 턴에 위 조작 확인이 필요하다. 이는 제품 결함 재현이나 전체 정상 판정이 아니다.

DB는 SELECT만 사용했다. 실제 to_regclass로 library_articles, learner_workspace, factory_order, factory_product_order, workspace_content_delivery, workspace_delivery_attempt 6개 관계를 확인했다. factory_lineage_read, factory_order_link_product, factory_product_order_register, factory_product_order_withdraw 4종 함수도 존재했다. 보안 PR #116/#117의 함수 4종은 현재 anon/authenticated EXECUTE가 모두 false다. 관계/함수 존재와 MCP 연결은 사용자의 실제 화면 권한·RLS·조작 성공을 입증하지 않는다.

### 2. PR 전체 분류

예전 21건 전체와 이후 #327/#328/#329를 합친 24건을 확인했다. 현재 OPEN 11, CLOSED 10, MERGED 3이다. 모든 PR의 변경 경로는 페이지를 끝까지 읽었다(#327 338경로, #329 312경로). 충돌 열은 GitHub의 **현재 원격 base** 기준이며 로컬에서 새 병합을 시험하지 않았다. 원 PR HEAD 조상 관계가 아닌 기능 포팅·후속 구현은 따로 썼다. 오래된 보안 PR도 실제 DB 권한을 다시 확인했다. 이번 PR 상태 변경은 0건이다.

| PR · 목적 | 상태 | 현재 담당 | 로컬 main | 원격 main | 원격 충돌 | DB | 실제 화면 영향 | 후속 |
|---|---|---|---|---|---|---|---|---|
| [#323](https://github.com/KangMin098/Vocaflow/pull/323) chore(ci): 필수 체크 8 → 3(verify · build · e2e) (OPEN) | BLOCKED | 미확인 | 미반영 | 미반영 | 있음 | 없음 | 직접 화면 없음 | 필수 체크 축소는 현 정책과 충돌. 이번에 채택/병합하지 않음 |
| [#318](https://github.com/KangMin098/Vocaflow/pull/318) ci: optimize LOCAL_FAST workflow (OPEN) | SUPERSEDED / ACTIVE | Claude · learner-tines, PID 11308 | 일부 정책은 후속 정본; 전체 PR 미반영 | 미반영 | 있음 | 없음 | 학습자 화면 59경로 | 후속 #329 본문이 #318 Draft 유지·비병합을 명시. 기존 PR/브랜치 유지 |
| [#317](https://github.com/KangMin098/Vocaflow/pull/317) 관리자 업무 메뉴 재구성 및 교재·연구·학습자 흐름 연결 (OPEN) | LOCAL_INTEGRATED / BLOCKED | 원담당 미확인; 관리자 인계 기록 존재 | 전체 HEAD 조상 | 미반영 | 있음 | 없음 | 관리자 메뉴·주문·학습자 연결 | 원격 충돌은 재병합 사유가 아님. 이미 로컬에 포함, 원격 작업은 별도 |
| [#315](https://github.com/KangMin098/Vocaflow/pull/315) feat(agents): 지정 Codex 대화 세션 라우터 · Claude×Codex 양방향 협업 계약 (CLOSED) | LOCAL_INTEGRATED / SUPERSEDED | 과거 라우터 담당 미확인 | 유효 동작 포팅 | 미반영 | 현재 병합 대상 아님 | 없음 | 직접 화면 없음 | 기존 PR 종료 유지. 같은 로컬 브랜치의 후속 418220e34는 미통합, 원담당 확인 후 별도 범위 수용 |
| [#314](https://github.com/KangMin098/Vocaflow/pull/314) feat(agents): AUTONOMOUS_DELEGATED 위임 정책 제안(미채택) — 판정기·보호 경로·AI_VERIFIED 원장 (OPEN) | BLOCKED | 미확인 | 미반영 | 미반영 | 있음 | 보류 SQL · 미적용 제안 | 직접 화면 없음 | 미채택 위임 정책. SQL/자동 위임을 실행하지 않음 |
| [#284](https://github.com/KangMin098/Vocaflow/pull/284) docs: preserve V2-F2 Codex-G sealed R1/R2 review (CLOSED) | LOCAL_INTEGRATED | 과거 봉인 검토자; 현재 세션 미확인 | 원문 6파일 보존 | 미반영 | 현재 병합 대상 아님 | 없음 | 연구 검토 원장 | 종료 상태 유지. 새 수용 판정으로 승격하지 않음 |
| [#278](https://github.com/KangMin098/Vocaflow/pull/278) docs(csat): V2 문맥 의미 주석 파일럿 — 평가원 12문항 DRAFT 원장 (연구) (CLOSED) | LOCAL_INTEGRATED | 과거 연구 담당 미확인 | 원문 4파일 보존 | 미반영 | 현재 병합 대상 아님 | DB 적재는 실행 작업 | 화면 없음 · DRAFT 연구 | 종료 상태 유지, DB 적재/Gold 승격 없음 |
| [#271](https://github.com/KangMin098/Vocaflow/pull/271) style(map): LM-W1 지도 스킨을 3B Access map 실측 계산 스타일로 (OPEN) | BLOCKED | 미확인 | 미반영 | 미반영 | 있음 | 없음 | 학습지도 스킨 | 후속 구현과 시각적 동등성·의도 검증 전 보존 |
| [#244](https://github.com/KangMin098/Vocaflow/pull/244) fix(ui): 팝업 뒤로가기 · Esc 간헐 실패와 원문 폭 384 간헐 실패 원인 수정 (CLOSED) | LOCAL_INTEGRATED | 과거 수정 담당 미확인 | 최신 Dialog에 유효 동작 포팅 | 미반영 | 현재 병합 대상 아님 | 없음 | 팝업·뒤로가기·원문 폭 | 종료 유지. 기존 브라우저/단위 증거 재사용, 새 UI PASS를 주장하지 않음 |
| [#237](https://github.com/KangMin098/Vocaflow/pull/237) docs(csat): v3.1 원문 이해 교수 설계와 Claude 실행 지시문 (CLOSED) | REMOTE_INTEGRATED / SUPERSEDED | 과거 설계자; 현재 세션 미확인 | 핵심 계약 보존 | 후속 #250에 기능/계약 반영 | 현재 병합 대상 아님 | 없음 | v3.1 이해 교수 설계 | 원 PR SHA의 조상 관계와 후속 구현 보존을 구별. 종료 유지 |
| [#231](https://github.com/KangMin098/Vocaflow/pull/231) fix(csat): M4 비교749쌍 상대 유형 결손 복구 (CLOSED) | REMOTE_INTEGRATED | 과거 데이터 수정 담당 미확인 | 현재 데이터/projection 계약 보존 | 현재 구현에 기능 보존 | 현재 병합 대상 아님 | 없음 | 기출 비교 상대 유형 | 원 PR SHA 자체는 조상이 아님. 이전 6회귀 증거를 재사용; 종료 유지 |
| [#228](https://github.com/KangMin098/Vocaflow/pull/228) design(shell): 로그인 후 상단 메뉴·/hub 를 공개 랜딩 수준으로 (OPEN) | ACTIVE / BLOCKED | 미확인 · learner-shell-polish DIRTY | 미반영 | 미반영 | 없음 | 없음 | 상단 메뉴·홈 | 소유와 후속 Tines 범위 확인 전 수정/종료하지 않음 |
| [#223](https://github.com/KangMin098/Vocaflow/pull/223) docs(csat): 기출분석 v3 설계와 Claude 구현 지시문 (CLOSED) | SUPERSEDED | 과거 설계자; 현재 세션 미확인 | 후속 v3.1/v3.2가 목적 승계 | 후속 #250에 구현 | 현재 병합 대상 아님 | 없음 | 기출분석 설계 문서 | 종료 유지, 과거 설계를 현재 코드에 다시 덮지 않음 |
| [#203](https://github.com/KangMin098/Vocaflow/pull/203) docs/tools(knowledge): vNext 실DB 동시성 시험 도구 · 감사 · 수용 기준 문서(보존용) (OPEN) | BLOCKED | 과거 종료 세션; 현재 담당 미확인 | 미반영 | 미반영 | 있음 | 실 DB 동시성/SQL 도구 | 직접 화면 없음 | 원문에 미병합 검증 자산 보존 명시. 실제 DB 시험은 승인/격리 범위 확정 뒤 별도 작업 |
| [#140](https://github.com/KangMin098/Vocaflow/pull/140) feat: 학습 원리 등록부에 영역별 본질 지도 적재 (OPEN) | BLOCKED | 미확인 | 미반영 | 미반영 | 있음 | 원리 데이터 import 실행 | 학습 원리 데이터 간접 영향 | 정본 대응·중복 검증과 DB 데이터 쓰기 승인 없이 적재하지 않음 |
| [#122](https://github.com/KangMin098/Vocaflow/pull/122) feat(agents): Claude ↔ Codex 왕복 안전장치 — 낡은 가드 경고 · 마이그레이션 번호 중복 검사 (CLOSED) | LOCAL_INTEGRATED / SUPERSEDED | 과거 안전장치 담당 미확인 | D10·3회귀 포팅 | 미반영 | 현재 병합 대상 아님 | 스키마 변경 없음 | 직접 화면 없음 | 낡은 강제 시작/인계 규칙은 dev-minimal로 대체. 종료 유지 |
| [#117](https://github.com/KangMin098/Vocaflow/pull/117) fix(db): 신설 정의자 함수 2종의 anon 노출을 걷는다 (발견 160·161) (CLOSED) | LOCAL_INTEGRATED | 과거 보안 담당 미확인 | 실제 적용 버전 SQL/도구 보존 | 파일 복원은 미반영; DB 적용 이력은 별개 | 현재 병합 대상 아님 | 권한 SQL · 과거 적용 | 원문 적격 함수 접근 | 현재 DB 함수 2종의 anon/authenticated EXECUTE false 재확인. 재적용 없음 |
| [#116](https://github.com/KangMin098/Vocaflow/pull/116) fix(db): 익명 사용자가 영상 큐에 쓰던 구멍을 막는다 (발견 104·112) (CLOSED) | LOCAL_INTEGRATED | 과거 보안 담당 미확인 | 실제 적용 버전 SQL 보존 | 파일 복원은 미반영; DB 적용 이력은 별개 | 현재 병합 대상 아님 | 권한 SQL · 과거 적용 | 영상 writer 접근 | 현재 DB writer 2종의 anon/authenticated EXECUTE false 재확인. 재적용 없음 |
| [#303](https://github.com/KangMin098/Vocaflow/pull/303) feat(final): R5 창작 공급 종단 · FI-001 결속 출처 · 격리 e2e (미적용 SQL · 실제 공급 대기) (MERGED) | REMOTE_INTEGRATED | FINAL 원소유 Claude | 전체 HEAD 조상 | 전체 HEAD 조상 · MERGED | 현재 병합 대상 아님 | 보류 공급 SQL/격리 fixture 포함 | 창작 공급·납품·학습 기록 | 코드 병합과 운영 SQL 적용은 별개. 기병합분 재병합 없음 |
| [#250](https://github.com/KangMin098/Vocaflow/pull/250) feat(csat): v3.2 「내 말로 이해하기」 + 원문 이해 27문항 감사 · 보강 (MERGED) | REMOTE_INTEGRATED | 기출 v3.2 원담당 | 전체 HEAD 조상 | 전체 HEAD 조상 · MERGED | 현재 병합 대상 아님 | 이벤트 허용 migration 포함 | 내 말로 이해하기 | 기병합분 재병합 없음 |
| [#326](https://github.com/KangMin098/Vocaflow/pull/326) feat(map): 목표→TASK 근거·학습량·지금 할 행동 요약 + Workspace 원리 노트 다시 찾기(T-0070+T-0071) (MERGED) | REMOTE_INTEGRATED | FINAL 원소유 Claude | 전체 HEAD 조상 | 전체 HEAD 조상 · MERGED | 현재 병합 대상 아님 | 없음 | 목표·PLAN·Workspace 노트 | 기병합분 재병합 없음 |
| [#327](https://github.com/KangMin098/Vocaflow/pull/327) chore(dev): 분산 통합본 수렴과 브랜치 운영 표준화 (OPEN) | LOCAL_INTEGRATED / BLOCKED | 이번 Codex · PID 16328 · 동일 정리 브랜치 | 전체 HEAD 조상 | 미반영 · Draft | 없음 | 기적용 SQL 3개/보류 SQL 포함 | 관리자 통합·안전 보완 | 이전 원격 게이트는 DB 이력 인증 대기. 이번 요청은 원격 push/병합을 실행하지 않음 |
| [#328](https://github.com/KangMin098/Vocaflow/pull/328) fix(map): reconfirm PLAN after target goal changes (OPEN) | ACTIVE / BLOCKED | FINAL 원담당 Claude; 현재 쓰기 세션 미확인 | 미반영 | 미반영 | 없음 | 없음 | 목표 변경 뒤 PLAN 재확인 | 10경로의 신규 수정. 원담당 수용·검증 상태 확인 전 임의 통합/종료하지 않음 |
| [#329](https://github.com/KangMin098/Vocaflow/pull/329) feat(design): PC 학습자 Tines 화면·삽화 품질 전달 (OPEN) | ACTIVE | Claude · learner-tines · 살아 있는 잠금 PID 11308 | 미반영 | 미반영 | 없음 | 없음 | PC 학습자 Tines 화면·삽화 | 312경로 신규 납품. 원담당 검증/통합 작업을 보존 |

#315의 원 PR은 이전에 보존됐지만 같은 로컬 브랜치에는 추가 커밋 418220e34(판정 문장의 P0/P1 잔여 결함 없음 오인식 수정)가 있다. 원담당 확인과 해당 1커밋의 범위 수용이 남았으며 이번에 전체 브랜치를 다시 병합하지 않았다. 신규 #328/#329 역시 현재 통합본에 포함됐다고 보고하지 않는다.

### 3. 전체 작업트리 판정

실제 등록은 71개가 아닌 75개다. 분류 우선순위는 CONFLICTED → ACTIVE → DIRTY → CLEAN_IDLE/REVIEW_REQUIRED이며 ACTIVE에도 미추적 파일이 있을 수 있다. 잠금·등록 작업·실제 프로세스 경로·세션 로그 수정 시점을 대조했다. 두 오래된 서버 표식은 PID가 살아 있어도 실제 다른 프로세스였으므로 ACTIVE로 세지 않았다. final-independent는 등록 PID가 죽었지만 정확한 등록 UUID의 재개 로그가 06:22Z에 갱신돼 ACTIVE로 보호했다.

| 상태 | 개수 | 처리 |
|---|---:|---|
| ACTIVE | 3 | 전부 유지 |
| DIRTY | 41 | 전부 유지 |
| CONFLICTED | 1 | 전부 유지 |
| CLEAN_IDLE | 1 | 이번 정리 공간 1개. PR #327·연속 개발 재사용을 위해 유지 |
| REVIEW_REQUIRED | 29 | 전부 유지 |

최종 집계는 이번 담당의 보고서 커밋·잠금 해제·깨끗함 확인을 반영한 상태다. 그 전 인테이크 집계는 ACTIVE 4/DIRTY 41/CONFLICTED 1/CLEAN_IDLE 0/REVIEW_REQUIRED 29였다. 깨끗하고 main의 조상이라는 이유만으로 미사용이 입증되지는 않는다. 소유/필요가 불명확한 29개를 CLEAN_IDLE로 낮추거나 지우지 않았다. 삭제 0개.

### 4. 기존 충돌 폴더의 처리 확정

D:/workspace/Vocaflow는 design/replica-first, HEAD 8cd15b7b6, MERGE_HEAD fbe532ae3이다. tracked 207/untracked 1,019/충돌 7이며 소유자는 확인되지 않았다. 충돌 파일의 실제 수정 시각은 모두 2026-10-08 02:12Z, 현재 변경 파일 중 가장 늦은 시각은 multi-grade-order.ts의 2026-10-19 04:41Z다. 3000 실행/의존성 경로와 분리돼 있어 현재 통합 플랫폼을 막지 않는다.

충돌: `docs/ACADEMIC_READING_BENCHMARK.md`, `docs/ACADEMIC_READING_ENGINE.md`, `docs/CHANGELOG.md`, `scripts/textbook/frym-benchmark/README.md`, `scripts/textbook/frym-benchmark/local-admission-run.mjs`, `scripts/textbook/frym-benchmark/local-admission.mjs`, `scripts/textbook/frym-benchmark/local-admission.test.mjs`.

207개 추적 변경을 main의 현재 파일과 전량 대조했다(텍스트 CRLF 정규화): 같음 54, 다름 70, main에 없는 경로 82, 작업 파일 삭제 1. 미추적 1,019개는 코드 확장자 0/Markdown 5/기타 1,014로, 이름만으로 산출물 폐기를 승인하지 않는다. 특히 frym-benchmark 38경로/4,611줄의 main 대비 차이에는 벤치마크·승인·정책·생산 자료가 있어 기능별 수용 검토가 필요하다. 다름/없음은 “모두 유효” 판정이 아니다.

처리는 **백업 후 격리 유지**로 확정한다. 원본에서 reset/clean/merge --abort/강제 switch/삭제를 하지 않는다. 소유자가 확인되면 백업을 별도 복구 폴더에 복원하고 충돌의 base/ours/theirs를 검토한 뒤 필요한 변경만 해당 기능 담당의 기존 브랜치로 옮긴다. 원본 미검토 변경을 폐기하는 복구는 승인하지 않았다.

### 5. 담당·중복 작업 방지와 기존 규칙

이번 담당은 Codex(pid 16328), 쓰기 범위는 기존 chore/dev-environment-20261021의 보고서/CHANGELOG와 자체 tmp뿐이다. 첫 읽기에서 같은 환경 정리 작업은 기존 등록부에 없었고, 기존 lock.mjs로 이 공간만 잠갔다. main-serving은 서버 유지/읽기 확인, 다른 모든 기능 공간은 읽기 전용으로 조사했다. 대규모 새 등록부/오케스트레이터·자동 라우터·다른 세션 호출은 만들지 않았다. 완료 후 자기 잠금만 해제한다.

공유 원담당은 learner-tines의 Claude 잠금(PID 11308, #329), final-independent의 final-independent-accept/T-0045/등록 UUID 재개 로그로 확인한다. final-product는 현재 PID 결속이 낡았으므로 #328/미커밋을 보존하고 임의 인수하지 않는다. AGENTS의 브랜치 연속성, CLAUDE의 @AGENTS 참조, router/WORKTREE의 동일 목적 유지·독립 동시 쓰기만 분리·AI 교대 유지·LOCAL_FAST 통합·포트 역할·남의 변경 보호가 이미 충족돼 운영 규칙 파일을 추가/수정하지 않았다. 기존 다른 공간의 낡은 파일을 강제 덮지 않았다.

### 6. 로컬 main과 충돌 작업의 독립 백업

보관 경로: `C:/Users/Administrator/Vocaflow-backups/environment-followup-20261021T062245`. Git 번들 459,987,642바이트의 SHA-256은 `59346d269ed0e6694f25aa3293f0b6595c6c60afefc586056b918b61d6eed5f3`이다. main e23e32cd8, local/integration e23e32cd8, root HEAD 8cd15b7b6, MERGE_HEAD fbe532ae3의 완전 이력을 담았고 외부 prerequisite가 없다.

빈 bare 저장소에서 bundle verify 후 별도 restoration.git으로 실제 clone·git fsck --full을 통과했고 복원 main SHA가 e23e32cd8로 일치했다. fsck의 dangling commit 1개는 별도 MERGE_HEAD 객체 fbe532ae3이며 손상이 아니다. 원본 변경 1,226항목 중 현재 존재하는 파일 1,225개(약 128MB), 삭제 기록 1개, 인덱스·양쪽 diff·충돌 stage blob 18개도 보존했다. manifest는 각 파일 해시와 백업 전후 HEAD/main/integration/MERGE_HEAD/index/status가 같음을 기록한다. 이번 최종 보고서 커밋은 같은 폴더의 추가 bundle로 별도 보존한다. 기존 Git 이력·인덱스·작업 파일에 복원/초기화를 적용하지 않았다.

### 7. 검증과 남은 차단

이번 새 제품 코드 변경은 없다. 기존 코드 CI d591b8ab4의 필수 8개·격리 E2E 31·고장 2 통과는 같은 실행 소스의 과거 증거로 재사용한다. 이번 L1은 수정 문서 링크/공백과 자체 복원 검증이며 전체 회귀/원격 CI를 반복하지 않는다. DB 쓰기/스키마 적용/데이터 삭제/실 납품은 미실행이다. 원격 push·PR 병합은 이번 정책상 실행 범위에서 제외했다.

실제 BLOCKED는 (1) Computer Use의 URL 확인 정책 실패로 인한 새 화면·조작 검증, (2) 충돌/미확인 공간의 실제 소유자와 유효 변경 수용, (3) 신규 PR #328/#329 및 라우터 후속 수정의 원담당 통합/수용이다. 기존 원격 납품의 DB 이력 인증 부재는 #327의 참고 상태이며 이번 LOCAL_FAST 작업을 원격으로 전환하는 사유가 아니다.

### 8. 연속 개발 최종 판정

같은 목적의 분석·설계·구현·수정은 현재 브랜치에서 이어갈 수 있다. 이번에도 신규 브랜치·전환 없이 기존 정리 공간을 재사용했고 최신 main과 integration의 제품 코드를 보존했다. 독립 쓰기가 필요한 경우에만 기존 기능 공간/담당부터 확인한다. **운영 지속 가능**, 단 이번 요청의 새 실제 화면 수용은 위 브라우저 차단 해제 후 마무리해야 한다. 플랫폼 전체 기능 정상이나 과거 21 PR의 원격 통합 완료로 판정하지 않는다.

## 부록. 현재 등록 작업트리 75개

main 반영은 커밋 조상 여부이며 미커밋·기능 포팅의 포함 여부와 다르다. 상태는 위 시점의 관측이며 다른 세션의 후속 변경을 자동 고정하지 않는다.

| 공간 | 브랜치 | HEAD | 상태 | 추적/미추적/충돌 | local main / remote main 조상 | 보존·정리 판정 |
|---|---|---|---|---|---|---|
| Vocaflow | design/replica-first | 8cd15b7b6 | CONFLICTED | 207/1019/7 | 아니오 / 아니오 | MERGE_HEAD와 충돌 7파일 보존 · 유지 |
| Vocaflow-admin-dashboard-v2 | design/admin-dashboard-v2 | 898ce5b28 | DIRTY | 2/0/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-admin-restructure-20261019 | feat/admin-restructure-20261019 | a46db1e21 | REVIEW_REQUIRED | 0/0/0 | 예 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-AI-Control | ai-control | 14756db7c | DIRTY | 2/1308/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-AI-Control-continuity | fix/localfast-continuity-20261020 | 8a9d2596d | DIRTY | 0/6/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-AI-Control-dynamic-roles | feat/ai-control-dynamic-roles | 5d3a333b2 | REVIEW_REQUIRED | 0/0/0 | 아니오 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-AI-Control-localfast | ai-control-localfast | 5d3a333b2 | DIRTY | 0/12/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-ai-control-ref | chore/ai-control-goal-ref | e6e99948d | DIRTY | 0/1/0 | 예 / 예 | 미커밋 보존 · 유지 |
| Vocaflow-AI-Control-statesplit | ai-control-statesplit | 226e19479 | REVIEW_REQUIRED | 0/0/0 | 아니오 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-anchor-study | feat/anchor-study | e70a0c0d5 | REVIEW_REQUIRED | 0/0/0 | 아니오 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-benchmark-admission-integration-20261006 | feat/textbook-factory-main | 663f2eee8 | DIRTY | 0/1/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-body-composition | design/illo-quality | 0c52f52d3 | DIRTY | 3/0/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-codex-pr142-144 | review/csat-pr142-144-20261002 | 194805900 | DIRTY | 0/1/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-csat-corpus-expansion | feat/csat-corpus-expansion | b7f9cf167 | DIRTY | 1/94/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-csat-design-learning | revert/csat-rail-trim | 6b37bb6ea | DIRTY | 4/0/0 | 예 / 예 | 미커밋 보존 · 유지 |
| Vocaflow-csat-on-replica | integrate/csat-on-replica | a396206ee | DIRTY | 1/0/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-csat-reading-research | research/csat-reading-20261012 | 0810d44ef | DIRTY | 0/1/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-csat-reading-v14 | research/csat-reading-v14 | 67070e430 | DIRTY | 1/0/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-csat-reading-v15 | research/csat-reading-v15 | 56876763a | REVIEW_REQUIRED | 0/0/0 | 아니오 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-csat-review-drain | feat/csat-review-drain | 42897f21c | DIRTY | 5/1/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-csat-source-policy-v3 | feat/csat-source-policy-v3 | 98b24044a | DIRTY | 0/57/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-csat-sources | feat/csat-sources-workspace | bf9703605 | REVIEW_REQUIRED | 0/0/0 | 아니오 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-csat-v32-mywords | feat/csat-v32-mywords | aab0c918c | DIRTY | 2/0/0 | 예 / 예 | 미커밋 보존 · 유지 |
| Vocaflow-csat-vnext2 | feat/csat-v31-meaning | 22e2e698a | DIRTY | 3076/7/0 | 예 / 예 | 미커밋 보존 · 유지 |
| Vocaflow-db-anon-160-161 | feat/db-anon-160-161 | 340545e06 | DIRTY | 0/1/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-db1-accept-286 | review/factory-db1-accept-286 | a456def43 | REVIEW_REQUIRED | 0/0/0 | 아니오 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-db1-apply | (detached) | 00ba6381c | DIRTY | 1/1/0 | 예 / 예 | 미커밋 보존 · 유지 |
| Vocaflow-dev-simplify | chore/required-checks-3 | 7fb0014af | REVIEW_REQUIRED | 0/0/0 | 아니오 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-ec-detector | feat/ec-detector | b589d04a8 | DIRTY | 3/0/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-ec-e2e | test/ec-pilot-e2e | 602e5836a | REVIEW_REQUIRED | 0/0/0 | 아니오 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-ec-gate | feat/ec-pilot-gate | 93d534ed3 | REVIEW_REQUIRED | 0/0/0 | 아니오 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-ec-smoke | feat/ec-smoke | 9380c68c8 | DIRTY | 7/4/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-env-standardize-20261021 | chore/dev-environment-20261021 | e23e32cd8 | CLEAN_IDLE | 0/0/0 | 예 / 아니오 | 이번 정리 공간; 완료 후 재사용 대기 · 유지 |
| Vocaflow-evidence | design/evidence-v2 | bc0ef2b5a | DIRTY | 2/0/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-factory-i1-deploy-review | (detached) | eccb5b6a6 | REVIEW_REQUIRED | 0/0/0 | 예 / 예 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-factory-integration-review-v1 | review/factory-integration-contract-v1 | 8e705307b | REVIEW_REQUIRED | 0/0/0 | 아니오 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-factory-integration-v11-final | review/factory-integration-contract-v11-final | aa73fac39 | REVIEW_REQUIRED | 0/0/0 | 아니오 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-factory-integration-v12-final | review/factory-integration-v12-final | 9733a7003 | REVIEW_REQUIRED | 0/0/0 | 아니오 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-factory-learning-runtime-v1 | research/factory-learning-runtime-v1 | a42b1ccc8 | REVIEW_REQUIRED | 0/0/0 | 아니오 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-factory-order-lineage-20261020 | feat/factory-order-lineage-20261020 | 526d0b226 | REVIEW_REQUIRED | 0/0/0 | 예 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-factory-qualification-v1 | research/factory-qualification-v1 | e5b24b1eb | REVIEW_REQUIRED | 0/0/0 | 아니오 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-factory-qualification-v11 | research/factory-qualification-v11 | a658fa39a | REVIEW_REQUIRED | 0/0/0 | 아니오 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-final-independent | review/final-independent-20261018 | 90336bd9f | ACTIVE | 0/0/0 | 아니오 / 아니오 | 등록 UUID 세션 재개 로그 최근 갱신 · 유지 |
| Vocaflow-final-product | feat/vocaflow-final-product | ac9f309dc | DIRTY | 2/1/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-g2-int | (detached) | d5fea7ec7 | DIRTY | 3/1/0 | 예 / 예 | 미커밋 보존 · 유지 |
| Vocaflow-hakpyeong | fix/hakpyeong-resume-20261010 | 8f7ad5a88 | DIRTY | 0/1/0 | 예 / 예 | 미커밋 보존 · 유지 |
| Vocaflow-integration | local/integration | e23e32cd8 | REVIEW_REQUIRED | 0/0/0 | 예 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-knowledge-verify | feat/knowledge-verify | 1d4062250 | DIRTY | 0/1/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-knowledge-vnext | feat/knowledge-vnext | 08f2dffb8 | DIRTY | 2/1/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-learner-shell-polish | feat/learner-shell-polish | 8c9af8f6b | DIRTY | 2/0/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-learner-tines-audit | design/learner-tines-delivery-20261021 | 6fc87a10e | ACTIVE | 0/3/0 | 아니오 / 아니오 | 살아 있는 담당 잠금 · 유지 |
| Vocaflow-learning-outcomes-20261021-work | feat/learning-outcomes-20261021 | 1c17a0a01 | DIRTY | 3/8/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-lf-demo | lf-demo/reasoning-note-test | 8c03d68e7 | REVIEW_REQUIRED | 0/0/0 | 아니오 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-lf-demo2 | lf-demo/map-return-test | e983e5007 | REVIEW_REQUIRED | 0/0/0 | 예 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-lm-g1-goal-gap | audit/lm-g1-goal-gap | c5f255fba | DIRTY | 1/0/0 | 예 / 예 | 미커밋 보존 · 유지 |
| Vocaflow-main-serving | main | e23e32cd8 | ACTIVE | 0/0/0 | 예 / 아니오 | 실제 main 서버 PID·경로 일치 · 유지 |
| Vocaflow-main-view | (detached) | 5e1415a91 | DIRTY | 1/0/0 | 예 / 예 | 미커밋 보존 · 유지 |
| Vocaflow-map-core | feat/map-core | a2dd93d3a | DIRTY | 3/1/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-map-feedback | feat/map-grade-guide | c309961e9 | DIRTY | 2/0/0 | 예 / 예 | 미커밋 보존 · 유지 |
| Vocaflow-map-goal-first | feat/map-goal-first | 38526f1cf | DIRTY | 0/1/0 | 예 / 예 | 미커밋 보존 · 유지 |
| Vocaflow-map-v62 | feat/lm-g1-5a-v2 | 4064c002b | DIRTY | 3201/63/0 | 예 / 예 | 미커밋 보존 · 유지 |
| Vocaflow-map-v62-pm4-ux-final | review/map-v62-pm4-ux-final | dbdfc7a81 | REVIEW_REQUIRED | 0/0/0 | 아니오 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-map-v62-pm4b-final | review/map-v62-pm4b-final | 7c0ff5b05 | REVIEW_REQUIRED | 0/0/0 | 아니오 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-map-vnext | feat/map-vnext | 981e75083 | DIRTY | 2/1/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-map-vnext-integration | feat/map-vnext-integration | 1169b1c14 | DIRTY | 0/1/0 | 예 / 예 | 미커밋 보존 · 유지 |
| Vocaflow-methodology | feat/methodology-intelligence | d8bfc6219 | DIRTY | 1/12/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-motion-d | feat/motion-d | 898aefb2a | DIRTY | 2/0/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-practice-verify2 | (detached) | 54aa73186 | DIRTY | 2/0/0 | 예 / 예 | 미커밋 보존 · 유지 |
| Vocaflow-r5-original-supply-e2e | feat/r5-original-supply-e2e | c3a03d168 | REVIEW_REQUIRED | 0/0/0 | 예 / 예 | 등록/잠금은 있으나 실제 사용 재확인 필요 · 유지 |
| Vocaflow-router | feat/codex-session-router | 418220e34 | REVIEW_REQUIRED | 0/0/0 | 아니오 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-screen-redesign | feat/screen-redesign | df6a599f1 | DIRTY | 22/1/0 | 아니오 / 아니오 | 미커밋 보존 · 유지 |
| Vocaflow-tines-instructions-20261018 | docs/tines-instructions-20261018 | 9a656da2e | REVIEW_REQUIRED | 0/0/0 | 아니오 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-v2-annotation-pilot | research/v2-annotation-pilot | b5b666551 | REVIEW_REQUIRED | 0/0/0 | 아니오 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-v2-d2-stage1 | review/v2-d2-stage1-20261017 | 9ec2b9c3b | REVIEW_REQUIRED | 0/0/0 | 아니오 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
| Vocaflow-wf7-ug | feat/wf7-ug-sandbox | 61ff72bac | REVIEW_REQUIRED | 0/0/0 | 아니오 / 아니오 | 깨끗하지만 미사용·소유 확인 부족 · 유지 |
