# 개발환경 정리 · 브랜치 운영 표준화 — 2026-10-21

이 문서는 이번 요청의 실사·실행 기록이다. 앞으로의 절차 정본은 [WORKTREE](../WORKTREE.md)와 [AGENTS](../../AGENTS.md)다. 상태는 확인 시점 기준이며 병렬 세션의 후속 변경은 자동 고정하지 않는다.

## 1. 정리 전·후

최초 로컬 main은 3d3cb47c1, 확인된 원격 main은 0649f8c0b였다(0/832). local/integration은 b4fc9ff83으로 원격 main과 36/163 갈라져 있었다. git fetch와 ls-remote로 원격을 직접 확인했다. 초기 브랜치 조회는 로컬 273개였고 병렬 작업 중 스냅샷에는 276개가 기록됐다. 추적 ref를 최신 원격 그 자체로 가정하지 않았다.

기존 공간 73개를 보존하고 임시 통합 공간 Vocaflow-env-standardize-20261021(chore/dev-environment-20261021)과 main 전용 Vocaflow-main-serving을 추가했다. 미확인 브랜치·worktree 삭제, stash, clean, reset, force push는 실행하지 않았다. 통합된 오래된 브랜치도 원문 복구용으로 유지한다. 브랜치 수 감소를 완료 기준으로 삼지 않는다.

실행 소스 통합 커밋: 3cdb3bc764bd6b7e9e59265ebb7f9e97efef6adf. 로컬 main은 이 소스로 fast-forward했다. 원격 main 반영과 별도로 기록한다.

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

## 5. 포트와 실제 실행 기준

3000 목표는 main, 3001 목표는 임시 integration 검증이다. 처음 3000은 PID 12144, learner-tines-audit/apps/web의 개발 서버(HEAD 8f6c12eab + 미커밋)였다. 도중 PID 10300으로 재기동됐고 실제 경로는 기본 Vocaflow로 바뀌었다. 이 작업은 이 두 프로세스를 종료하지 않았다. 이후 재확인에서 3000/3001이 모두 비어 있었고, 3000 비점유를 다시 확인한 뒤 main 전용 공간에서 서버를 시작했다. 새 PID는 22436, cwd는 Vocaflow-main-serving/apps/web이며 소유 표식과 실제 리스너를 대조했다. 개발 서버의 소스 기준은 로컬 main 45affc5b0이다. 미커밋 디자인 원본 공간은 그대로다.

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

개발 DB는 읽기만 했다. DB1/DB2/I2/G2/D3 적용 이력 5개를 확인했고 D3 SQL은 실제 이력과 SHA-256 f94bf27f…aae3d8이 일치했다. #116/#117도 실제 적용 버전 20260920014828/20260920023713의 statements 바이트로 복원했다(각 e3a81fcc…901a39, 6a614002…ea1712). SQL을 적용/재적용하거나 데이터를 삭제하지 않았다. FINAL 창작 공급 등의 _pending_는 계속 미적용 제안이다.

## 8. 실제 제약과 실행 결과

GitHub 인증과 fetch는 가능하다. safe-merge가 개발 DB 적용 이력 해시를 읽을 때 필요한 SUPABASE_ACCESS_TOKEN은 현재 셸과 기존 web 환경 파일에 없다. MCP의 읽기 결과를 CLI 승인 게이트에 위조 입력하거나 병합 API로 우회하지 않는다. 원격 병합은 해당 정상 인증과 필수 CI/범위 계약이 충족돼야 한다. 3000은 비점유가 확인된 후에만 main 서버를 시작했다.

<!-- final-execution:start -->
납품은 [초안 PR #327](https://github.com/KangMin098/Vocaflow/pull/327)에 푸시했다. 95728f7a2의 GitHub Actions build는 성공했다. 로컬 최종 빌드는 디스크 ENOSPC로 실패했으며 세션 중단 실행과 함께 성공으로 계산하지 않는다. 이 작업의 실패 빌드 캐시 19파일(1,730,848,778바이트)을 SHA-256을 보존해 C:의 임시 보관 폴더로 옮겼고 D: 여유는 약 2.09GB가 됐다. 다른 공간 파일은 삭제하지 않았다.

3000의 실제 Chromium 확인은 /hub·/csat 200, 1440px 가로 넘침/JS 오류 0이다. 일반 계정의 /admin은 /hub로 이동했다. 인증된 관리자 전수 QA로 주장하지 않는다.

첫 CI verify의 세 실패는 계보 API의 명시적 HTTP 자동화 호출과 검사기의 오탐/줄바꿈 문제로 수정했다. 수정 검사기는 40줄 밖의 실제 바깥 루프도 검출한다. 전량 대조는 origin/main 150·통합본 151(차이는 제한된 TCP claim 종료 1곳), 재검출 19·오탐 제외 12를 모두 읽었다. 집중 3파일/25회귀를 통과했다. E2E의 신규 migration 실패는 빈 DB에 누락된 정본 trigger 함수 정의를 CI loopback fixture에만 복구해 조치했고 가드 4회귀를 통과했다. 운영 SQL 바이트·기존 실패 기준선을 바꾸지 않았다. 후속 필수 CI와 DB 이력 인증은 아직 최종 확인 전이다.
<!-- final-execution:end -->

## 부록. 보존한 기존 공간 전체

인테이크 스냅샷. 수정/미추적/충돌은 개별 파일 수이며 미추적 디렉터리 한 줄로 세지 않았다. “기준에 포함”은 당시 원격 main의 조상 여부만 뜻하고 미커밋 결과까지 통합됐다는 의미가 아니다.

| 공간 | 브랜치 | HEAD | 수정/미추적/충돌 | 보존 판단 |
|---|---|---|---|---|
| Vocaflow | design/replica-first | 8cd15b7b6 | 207/1019/7 | 고유 이력 보존 |
| Vocaflow-admin-dashboard-v2 | design/admin-dashboard-v2 | 898ce5b28 | 2/0/0 | 고유 이력 보존 · 소유 표식 보존 |
| Vocaflow-admin-restructure-20261019 | feat/admin-restructure-20261019 | a46db1e21 | 0/0/0 | 고유 이력 보존 |
| Vocaflow-AI-Control | ai-control | a61b82b1b | 2/1150/0 | 고유 이력 보존 |
| Vocaflow-AI-Control-continuity | fix/localfast-continuity-20261020 | 8a9d2596d | 0/6/0 | 고유 이력 보존 |
| Vocaflow-AI-Control-dynamic-roles | feat/ai-control-dynamic-roles | 5d3a333b2 | 0/0/0 | 고유 이력 보존 |
| Vocaflow-AI-Control-localfast | ai-control-localfast | 5d3a333b2 | 0/12/0 | 고유 이력 보존 |
| Vocaflow-ai-control-ref | chore/ai-control-goal-ref | e6e99948d | 0/1/0 | 기준에 포함 |
| Vocaflow-AI-Control-statesplit | ai-control-statesplit | 226e19479 | 0/0/0 | 고유 이력 보존 |
| Vocaflow-anchor-study | feat/anchor-study | e70a0c0d5 | 0/0/0 | 고유 이력 보존 |
| Vocaflow-benchmark-admission-integration-20261006 | feat/textbook-factory-main | 663f2eee8 | 0/1/0 | 고유 이력 보존 |
| Vocaflow-body-composition | design/illo-quality | 0c52f52d3 | 3/0/0 | 고유 이력 보존 |
| Vocaflow-codex-pr142-144 | review/csat-pr142-144-20261002 | 194805900 | 0/1/0 | 고유 이력 보존 |
| Vocaflow-csat-corpus-expansion | feat/csat-corpus-expansion | b7f9cf167 | 1/94/0 | 고유 이력 보존 |
| Vocaflow-csat-design-learning | revert/csat-rail-trim | 6b37bb6ea | 4/0/0 | 기준에 포함 |
| Vocaflow-csat-on-replica | integrate/csat-on-replica | a396206ee | 1/0/0 | 고유 이력 보존 |
| Vocaflow-csat-reading-research | research/csat-reading-20261012 | 0810d44ef | 0/1/0 | 고유 이력 보존 |
| Vocaflow-csat-reading-v14 | research/csat-reading-v14 | 67070e430 | 1/0/0 | 고유 이력 보존 |
| Vocaflow-csat-reading-v15 | research/csat-reading-v15 | 56876763a | 0/0/0 | 고유 이력 보존 |
| Vocaflow-csat-review-drain | feat/csat-review-drain | 42897f21c | 5/1/0 | 고유 이력 보존 · 소유 표식 보존 |
| Vocaflow-csat-source-policy-v3 | feat/csat-source-policy-v3 | 98b24044a | 0/57/0 | 고유 이력 보존 |
| Vocaflow-csat-sources | feat/csat-sources-workspace | bf9703605 | 0/0/0 | 고유 이력 보존 |
| Vocaflow-csat-v32-mywords | feat/csat-v32-mywords | aab0c918c | 2/0/0 | 기준에 포함 |
| Vocaflow-csat-vnext2 | feat/csat-v31-meaning | 22e2e698a | 3076/7/0 | 기준에 포함 · 소유 표식 보존 |
| Vocaflow-db-anon-160-161 | feat/db-anon-160-161 | 340545e06 | 0/1/0 | 고유 이력 보존 · 소유 표식 보존 |
| Vocaflow-db1-accept-286 | review/factory-db1-accept-286 | a456def43 | 0/0/0 | 고유 이력 보존 |
| Vocaflow-db1-apply | detached | 00ba6381c | 1/1/0 | 고유 이력 보존 |
| Vocaflow-dev-simplify | chore/required-checks-3 | 7fb0014af | 0/0/0 | 고유 이력 보존 |
| Vocaflow-ec-detector | feat/ec-detector | b589d04a8 | 3/0/0 | 고유 이력 보존 |
| Vocaflow-ec-e2e | test/ec-pilot-e2e | 602e5836a | 0/0/0 | 고유 이력 보존 |
| Vocaflow-ec-gate | feat/ec-pilot-gate | 93d534ed3 | 0/0/0 | 고유 이력 보존 |
| Vocaflow-ec-smoke | feat/ec-smoke | 9380c68c8 | 7/4/0 | 고유 이력 보존 |
| Vocaflow-evidence | design/evidence-v2 | bc0ef2b5a | 2/0/0 | 고유 이력 보존 |
| Vocaflow-factory-i1-deploy-review | detached | eccb5b6a6 | 0/0/0 | 고유 이력 보존 |
| Vocaflow-factory-integration-review-v1 | review/factory-integration-contract-v1 | 8e705307b | 0/0/0 | 고유 이력 보존 |
| Vocaflow-factory-integration-v11-final | review/factory-integration-contract-v11-final | aa73fac39 | 0/0/0 | 고유 이력 보존 |
| Vocaflow-factory-integration-v12-final | review/factory-integration-v12-final | 9733a7003 | 0/0/0 | 고유 이력 보존 |
| Vocaflow-factory-learning-runtime-v1 | research/factory-learning-runtime-v1 | a42b1ccc8 | 0/0/0 | 고유 이력 보존 |
| Vocaflow-factory-order-lineage-20261020 | feat/factory-order-lineage-20261020 | 526d0b226 | 0/0/0 | 고유 이력 보존 |
| Vocaflow-factory-qualification-v1 | research/factory-qualification-v1 | e5b24b1eb | 0/0/0 | 고유 이력 보존 |
| Vocaflow-factory-qualification-v11 | research/factory-qualification-v11 | a658fa39a | 0/0/0 | 고유 이력 보존 |
| Vocaflow-final-independent | review/final-independent-20261018 | fb98f1f96 | 0/0/0 | 고유 이력 보존 · 소유 표식 보존 |
| Vocaflow-final-product | feat/vocaflow-final-product | 0649f8c0b | 9/2/0 | 기준에 포함 · 소유 표식 보존 |
| Vocaflow-g2-int | detached | d5fea7ec7 | 3/1/0 | 고유 이력 보존 · 소유 표식 보존 |
| Vocaflow-hakpyeong | fix/hakpyeong-resume-20261010 | 8f7ad5a88 | 0/1/0 | 기준에 포함 |
| Vocaflow-integration | local/integration | b4fc9ff83 | 0/0/0 | 고유 이력 보존 |
| Vocaflow-knowledge-verify | feat/knowledge-verify | 1d4062250 | 0/1/0 | 고유 이력 보존 |
| Vocaflow-knowledge-vnext | feat/knowledge-vnext | 08f2dffb8 | 2/1/0 | 고유 이력 보존 |
| Vocaflow-learner-shell-polish | feat/learner-shell-polish | 8c9af8f6b | 2/0/0 | 고유 이력 보존 |
| Vocaflow-learner-tines-audit | design/learner-tines-audit | 8f6c12eab | 112/93/0 | 고유 이력 보존 · 소유 표식 보존 |
| Vocaflow-lf-demo | lf-demo/reasoning-note-test | 8c03d68e7 | 0/0/0 | 고유 이력 보존 |
| Vocaflow-lf-demo2 | lf-demo/map-return-test | e983e5007 | 0/0/0 | 고유 이력 보존 |
| Vocaflow-lm-g1-goal-gap | audit/lm-g1-goal-gap | c5f255fba | 1/0/0 | 기준에 포함 |
| Vocaflow-main-sync | integrate/main-sync-20261021 | 0649f8c0b | 282/0/0 | 기준에 포함 |
| Vocaflow-main-view | detached | 5e1415a91 | 1/0/0 | 고유 이력 보존 |
| Vocaflow-map-core | feat/map-core | a2dd93d3a | 3/1/0 | 고유 이력 보존 · 소유 표식 보존 |
| Vocaflow-map-feedback | feat/map-grade-guide | c309961e9 | 2/0/0 | 기준에 포함 |
| Vocaflow-map-goal-first | feat/map-goal-first | 38526f1cf | 0/1/0 | 기준에 포함 |
| Vocaflow-map-v62 | feat/lm-g1-5a-v2 | 4064c002b | 3201/63/0 | 기준에 포함 |
| Vocaflow-map-v62-pm4-ux-final | review/map-v62-pm4-ux-final | dbdfc7a81 | 0/0/0 | 고유 이력 보존 |
| Vocaflow-map-v62-pm4b-final | review/map-v62-pm4b-final | 7c0ff5b05 | 0/0/0 | 고유 이력 보존 |
| Vocaflow-map-vnext | feat/map-vnext | 981e75083 | 2/1/0 | 고유 이력 보존 |
| Vocaflow-map-vnext-integration | feat/map-vnext-integration | 1169b1c14 | 0/1/0 | 기준에 포함 |
| Vocaflow-methodology | feat/methodology-intelligence | d8bfc6219 | 1/12/0 | 고유 이력 보존 · 소유 표식 보존 |
| Vocaflow-motion-d | feat/motion-d | 898aefb2a | 2/0/0 | 고유 이력 보존 |
| Vocaflow-practice-verify2 | detached | 54aa73186 | 2/0/0 | 고유 이력 보존 |
| Vocaflow-r5-original-supply-e2e | feat/r5-original-supply-e2e | c3a03d168 | 0/0/0 | 기준에 포함 · 소유 표식 보존 |
| Vocaflow-router | feat/codex-session-router | 418220e34 | 0/0/0 | 고유 이력 보존 |
| Vocaflow-screen-redesign | feat/screen-redesign | df6a599f1 | 22/1/0 | 고유 이력 보존 · 소유 표식 보존 |
| Vocaflow-tines-instructions-20261018 | docs/tines-instructions-20261018 | 9a656da2e | 0/0/0 | 고유 이력 보존 |
| Vocaflow-v2-annotation-pilot | research/v2-annotation-pilot | b5b666551 | 0/0/0 | 고유 이력 보존 |
| Vocaflow-v2-d2-stage1 | review/v2-d2-stage1-20261017 | 9ec2b9c3b | 0/0/0 | 고유 이력 보존 |
| Vocaflow-wf7-ug | feat/wf7-ug-sandbox | 61ff72bac | 0/0/0 | 고유 이력 보존 |
