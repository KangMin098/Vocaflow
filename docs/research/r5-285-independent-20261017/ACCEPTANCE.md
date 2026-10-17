# PR #285 — Codex-R5-285 독립 수용

- 제출: `e5ca18aff089f075176d727b3d1c35bcbbacedca`.
- 기준 main: `732f2bb0f0b4094c175c0b5e8a66c799d704a6a0`(#283 병합 포함). 제출 HEAD가 이미 이 main을 포함했다.
- 작업: `review/r5-285-independent`, 별도 `Vocaflow-r5-assessment-285-review`. 원 작성자 worktree는 수정하지 않았다.
- 최초 판정 **REWORK**. 수정 범위 판정 **ACCEPT_WITH_LIMITS**: 아래 재현 결함을 수정하며 실제 FQ·납품↔G2·학습 효과는 승인하지 않는다. 병합은 최종 HEAD의 CI 8종과 safe-merge 통과를 별도로 요구한다.

## 최초 실패와 동일 반례

| 등급 | 반례 | 제출본 | 수정 뒤 |
|---|---|---|---|
| P1 | 원장 2,001행 중 서버가 1,000/1,999행 반환 또는 exact count 없음 | `ok`로 인정, 누락된 노출을 unseen으로 오판 가능 | exact count = 반환 수 및 LIMIT 미만만 인정, 그 밖 error·예약 유지 |
| 핵심 P2 | 2020#24를 선택했는데 2022#20 답·키로 mock 채점 | 기존 mock `isCorrect=true`, 실제 선택 주석으로는 false | 선택 ID→현재 주석→골격 서명→클릭→채점→응답 결속. 선지 정오도 실제 read-only 키와 대조 |
| 핵심 P2 | G2 첫 전이 시도 `activity=practice` 또는 활동 정보 없음 | `isEligible=true`, 효과 신호의 독립 전이 표본에 포함 | 연습은 제외. 전이는 세션·TASK·현재 hash·활동이 결속돼야 적격 후보 |
| 핵심 P2 | 출시된 실연습 문항 자체가 0건 | `notFound()` | `no_live_items` 안내 및 지도 복귀. 예약 0개라는 잘못된 이유를 말하지 않음 |
| P1(검증 안전) | 브라우저만 쓰기를 막고 RSC 학습지도를 조회 | 서버의 `learning_decisions` POST는 브라우저 가로채기를 우회 | 서버 fetch 장벽이 실제 시도를 차단. 검증기는 장벽 응답 헤더가 없는 서버에 로그인·학습자 조회를 시작하지 않음 |

수정 전 원문 로그: [원장·fixture](./initial-failures.log), [전이](./initial-transfer-failures.log), [0문항 페이지](./initial-page-failures.log). 첫 로그는 원장 3실패/14통과, 전이는 2실패, 페이지는 1실패/5통과다. fixture 반례는 기존 mock 성공과 실제 주석 실패가 동시에 성립함을 단언하는 탐침이라 테스트 자체는 통과한다. 최초 실패 로그를 수정 후 결과로 덮지 않았다.

## 예약 보호 검증

`r5-reader-independent`, `r5-reservation-independent`, `practice-server`, `r5-practice-page`가 다음을 격리 더블로 실행한다(네트워크·DB 쓰기 없음).

- 미노출 확인 문항 목록 제외, 직접 URL 대체, 일반 학습자의 `preview=1` 우회 차단, 실제 관리자 미리보기 구분.
- 제출·판단 전 해설 열람·복습 예약 각각 409, writer/RPC 호출 전 거부.
- 다른 TASK의 확인 예약·노출도 반영. 이미 본 문항은 일반 연습 허용.
- 6원장 각각 실패, 예약 링크 실패, thrown 네트워크 오류는 fail-closed.
- LIMIT 2,000 및 더 낮은 서버 절단·count null. 학습자 5개 직접 필터와 진단 조인 필터 검증, 두 사용자 노출 격리.
- 화면 조회 뒤 예약 상태 변경 시 제출에서 재조회·409. 원장 DB와 제출 사이의 완전한 원자성/납품 결속을 주장하지 않는다.

## G2 → 첫 시도 → T4 → R5 → Workspace → PLAN 실제 연결

1. `submitPractice()`는 G2에 `activity=practice`, 문항 유형에 따른 `phase=transfer`, 주석 hash 및 정오를 남기는 기존 경로다. 이번 검증에서는 writer를 가로채 실제 기록을 만들지 않았다.
2. `learning_first_attempts`의 첫 행 선정 SQL은 그대로다. `loadFindAttempts()`는 연습 기록을 연습 시점으로 읽고 `skillDiagnosis()`는 확인 근거에서 제외한다. 전이 phase도 CHECK의 practice phase와 섞이지 않는다.
3. `loadLifecycleActivity()` → `composeV4()` → `evidenceView()`: 전이 연습은 독립성 `INELIGIBLE`, 현재 주석에서 맞힌 사실은 조건 성공으로 남는다. 독립 CHECK로 승격되지 않는다. 학습 효과는 `NOT_EVALUATED`다.
4. 같은 `composeV4()`가 R5 팝업/Inspector/Workspace의 증거 DTO와 PLAN 운영량을 만든다. `transferDoneOf()`는 서로 다른 지문 경험 수, `transferContract()`는 `experience_only`다. 운영량 완료가 독립 적용 능력이나 숙달을 바꾸지 않는다.
5. `savedTransferOf()`와 PLAN commit은 운영량·버전 정책을 유지한다. 이번 작업에서 `learner_workspace_plan_commit`을 호출하지 않았다. 현/이전 PLAN 수요 key와 canonical 공급 경계는 기존 회귀를 유지한다.
6. 별도 실제 혼입 경로는 `loadEffectSignals()` → `computeSignals()`였다. 이제 원장 ID에 맞는 세션/문항/TASK/hash와 현재 서버 주석을 결속해 `attemptRole()`로 판정한다. 정보가 없거나 stale이면 독립 전이 표본이 아니다.

`r5-transfer-independent`는 연습 전이 2개+반복을 입력해 PLAN 경험 수 2, T4 독립 확인 0, 전이 경험 및 `experience_only`를 함께 검증한다. 납품 영수증 결속과 최초 노출의 원자적 판정을 구현한 것은 아니다.

## FQ 및 공급

`loadFqReader()`는 `42P01/PGRST205=not_installed`, 다른 조회 오류=`error`, 설치 확인 시=`installed, eligible: []`다. 설치됐어도 이 reader에 신뢰된 역할·TASK·hash 자격 검증 경로가 연결되지 않았으므로 적격을 반환하지 않는다. 실제 FQ 행·권리·Gold·자격·승인·공급 행을 생성하지 않았다.

Inspector는 미설치/오류/설치 및 적격 0건을 후보 유무와 별개로 표시한다. `open_unqualified`는 열람 후보이며 `fulfillmentOf()`의 공급 수는 0이다. 공급 0·자격 없음이 학습 필요 없음으로 바뀌지 않는다. 2020#24는 계속 검수 후보이며 적격 1건으로 올리지 않았다.

## 실제 PC 화면과 안전

[Chromium 결과](./screens/results.json): **1280×900 / 1440×900, 35 PASS / 0 FAIL**. [1280 빈 상태](./screens/1280-no_live.png), [1440 빈 상태](./screens/1440-no_live.png), [1280 FQ 0건](./screens/1280-fq_zero.png), [1440 원장 오류](./screens/1440-ledger_error.png).

실제 Next 화면에서 정상 기존 기록 조회와 로컬 read-only reader fault를 조합했다. 미설치/오류/설치 0건, 예약, 원장 오류, 실제 출시 풀 0건을 각각 시험했다. 두 폭 모두 가로 넘침 0, 지도 복귀 링크는 키보드 Tab/Shift+Tab 초점과 Enter 이동, 보이는 solid outline 및 44px 높이를 확인했다. 모바일은 범위 밖이다.

첫 화면 실행은 로컬 서버 종료로 29통과 뒤 실패했다. [첫 실행 JSON](./screens-first-run.json)과 [로그](./screens-first-run.log)를 보존하고, 전체 35조건을 재실행해 통과했다. 제출 HEAD에서 시작한 작업 중 캡처이므로 최초 결과의 `head`는 제출 SHA다. 코드 상태/최종 검증 커밋은 Git 이력 및 PR 최종 HEAD로 함께 확인한다.

서버는 `r5-read-only-preload.cjs`로 모든 원격 쓰기를 차단한다. 예외는 로그인 token POST 및 SQL STABLE SELECT-only인 `csat_ec_embargoed_exams/items` 두 read RPC뿐이다. 브라우저도 인증 외 쓰기를 가로챈다. 서버의 `learning_decisions`, hub의 `prescribe_today` 시도까지 차단됐으며 학생 학습·공급·자격·승인 기록을 바꾸지 않았다. `e2e-map-supply.mjs`는 계정 생성/삭제·제출이 있으므로 실행하지 않았다.

재실행 순서: 별도 worktree Next 서버에 `NODE_OPTIONS=--require=<절대 r5-read-only-preload.cjs 경로>`, `R5_REVIEW_FAULT_FILE=<로컬 JSON 경로>`, `R5_REVIEW_AUDIT_FILE=<로컬 jsonl 경로>`, `DEV_ADMIN_BYPASS=0`을 설정한다. 브라우저 runner는 기존 환경 파일을 읽고 `--base`, `--evidence`, `--fault-file`을 지정한다. 인증 정보를 출력하거나 증거에 저장하지 않는다.

## 회귀와 남은 차단

광역 T1~T4·PLAN·Workspace·R5 회귀의 첫 실행은 1,359통과, PGlite 5개가 메모리 할당 오류였다([로그](./regressions.log)). 해당 5개를 단독 재실행해 전부 통과했다([재실행](./pglite-retry.log)). 제품 기대값을 약화하거나 실패를 skip으로 바꾸지 않았다. 최종 타입·lint·목적 리뷰·전체 회귀·CI 8종은 PR 검증 기록과 함께 확인한다.

계속 차단되는 사항: 납품 `delivery_id`↔G2 수행 결속은 별도 migration 승인 대상. 실제 권리/Gold/FQ 역할 검증과 학생 사전·사후·지연·독립 전이 연구는 미완성이다. 기존 봉인·TASK·PLAN·제품 목표·SQL·운영 데이터는 변경하지 않았다. 이 PR 수용은 실제 적격 콘텐츠 공급 또는 교육 효과 성공 판정이 아니다.
