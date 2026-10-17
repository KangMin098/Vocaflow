# PR #285 — Codex-R5-285 독립 수용

- 제출: `e5ca18aff089f075176d727b3d1c35bcbbacedca`.
- 기준 main: `732f2bb0f0b4094c175c0b5e8a66c799d704a6a0`(#283 병합 포함). 제출 HEAD는 이 main의 13커밋을 포함하지 않았다. 독립 수정 후 `8eb0e90f3`에서 통합했고 CHANGELOG의 양쪽 항목을 보존했다. 앞선 「이미 포함」 기록은 정정한다.
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

목적 리뷰 3차의 [최초 실패](./reservation-round3-initial.log)에서 미노출 전이 후보 `2020#24`와 예약 지문을 공유하는 다른 문항 ID의 연습 우회를 재현했다. 확인 링크와 출시 풀의 전이 후보를 예약 대상으로 삼고, 같은 정규화 지문의 다른 연습 문항도 보호한다. 이미 노출된 문항의 일반 연습은 유지한다. 이 보수적 보류가 실제 독립 전이 실행 경로나 콘텐츠 자격을 만드는 것은 아니다. 빈 상태는 자료 준비를 확인하도록 안내하며 당장 독립 확인을 실행할 수 있다고 약속하지 않는다.

목적 리뷰 4차에서 이 보류와 Workspace 실행 링크의 불일치를 찾아 [추출한 기존 실행/주소 판정의 최초 실패](./execution-round4-initial.log)를 보존했다(2실패/1통과). 서버는 예약될 미노출 연습 전이를 실행 후보에서 빼고, 이미 노출된 전이의 일반 경험과 별도 문항 화면 경로는 유지한다. 다음 연습 링크도 사용자 예약을 대조한다. 전용 Playwright 설정과 스펙의 서버 주소 판정을 공유해 사용자 지정 주소·포트가 일치한다.

[6차 리뷰](./goal-review-sixth.log)의 [최초 실패](./identity-round6-initial.log)는 과거 노출의 지문 키 누락과 일반 E2E 주소 상속이다. 식별할 수 없는 과거 노출은 unseen이 아니라 unknown이며, 원장을 화면용으로 줄여도 타 문항 ID 없이 불확실성 플래그를 보존한다. 알려진 같은 문항 노출은 계속 exposed다. 설정·스펙은 R5 전용 `R5_READ_ONLY_BASE_URL`/`R5_READ_ONLY_PORT`만 공유하고, 일반 `PLAYWRIGHT_BASE_URL`을 상속하지 않는다.

목적 리뷰 1차에서 추가한 실패는 [리뷰 원문](./goal-review-first.log)과 [2차 반례 최초 실패](./review-round2-initial.log)에 보존했다. 확인 phase도 활동·세션·TASK·현재 주석 hash 없이 독립 표본으로 승격되지 않도록 보완했고, reader가 첫 시도 ID에 맞는 원장 메타데이터를 전달한다. T4는 첫 시도와 수행의 세션·과거 hash를 결속하며, 과거 주석의 독립 관찰 사실과 현재 도구 적격성을 구분한다. 원문 문자열의 줄바꿈·탭은 JSON 인코딩 전에 정규화한다. `A B`, `A\nB`, `A\tB`는 같은 지문이며 빈 문자열은 식별 불가다.

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

설치 판정은 `GET id, exact count`의 실제 배열·숫자 count를 요구한다. 성공 모양이지만 count가 null인 모호한 응답도 error로 남긴다. [최초 실패](./fq-ambiguous-initial.log)를 보존했다.

Inspector는 미설치/오류/설치 및 적격 0건을 후보 유무와 별개로 표시한다. `open_unqualified`는 열람 후보이며 `fulfillmentOf()`의 공급 수는 0이다. 공급 0·자격 없음이 학습 필요 없음으로 바뀌지 않는다. 2020#24는 계속 검수 후보이며 적격 1건으로 올리지 않았다.

## 실제 PC 화면과 안전

[Chromium 결과](./screens/results.json): **1280×900 / 1440×900, 35 PASS / 0 FAIL**. [1280 빈 상태](./screens/1280-no_live.png), [1440 빈 상태](./screens/1440-no_live.png), [1280 FQ 0건](./screens/1280-fq_zero.png), [1440 원장 오류](./screens/1440-ledger_error.png).

실제 Next 화면에서 정상 기존 기록 조회와 로컬 read-only reader fault를 조합했다. 미설치/오류/설치 0건, 예약, 원장 오류, 실제 출시 풀 0건을 각각 시험했다. 두 폭 모두 가로 넘침 0, 지도 복귀 링크는 키보드 Tab/Shift+Tab 초점과 Enter 이동, 보이는 solid outline 및 44px 높이를 확인했다. 모바일은 범위 밖이다.

첫 화면 실행은 로컬 서버 종료로 29통과 뒤 실패했다. [첫 실행 JSON](./screens-first-run.json)과 [로그](./screens-first-run.log)를 보존하고 전체 35조건을 재실행했다. 마지막 캡처는 런타임 수정 커밋 `53c75b585`에서 **35/35 통과**했다([로그](./screens.log)). 전용 서버 포트 3131에서도 [실제 선택 문항 E2E 7/7](./e2e-final.log)을 확인했다. 증거 커밋은 별도로 뒤따르며 [네트워크 감사](./network-audit.json)의 소스별 SHA-256으로 실제 검증 코드를 결속한다.

서버는 `r5-read-only-preload.cjs`로 모든 원격 쓰기를 차단한다. 예외는 로그인 token POST 및 SQL STABLE SELECT-only인 `csat_ec_embargoed_exams/items` 두 read RPC뿐이다. 브라우저도 인증 외 쓰기를 가로챈다. 서버의 `learning_decisions`, hub의 `prescribe_today` 시도까지 차단됐으며 학생 학습·공급·자격·승인 기록을 바꾸지 않았다. `e2e-map-supply.mjs`는 계정 생성/삭제·제출이 있으므로 실행하지 않았다.

재실행 순서: 별도 worktree Next 서버에 `NODE_OPTIONS=--require=<절대 r5-read-only-preload.cjs 경로>`, `R5_REVIEW_FAULT_FILE=<로컬 JSON 경로>`, `R5_REVIEW_AUDIT_FILE=<로컬 jsonl 경로>`, `DEV_ADMIN_BYPASS=0`을 설정한다. 브라우저 runner는 기존 환경 파일을 읽고 `--base`, `--evidence`, `--fault-file`을 지정한다. 인증 정보를 출력하거나 증거에 저장하지 않는다.

단일 E2E 명령은 `pnpm --filter web test:e2e:r5`다. `playwright.r5-read-only.config.ts`와 `r5-read-only-server.cjs`가 preload를 적용한 전용 Next 서버를 자동 기동한다. 기존 서버를 지정하는 경우에도 헤더 검증이 필요하다. 일반 Playwright 서버를 읽기 전용이라고 오인해 통과시키지 않는다.

## 회귀와 남은 차단

자격 결속을 갖춘 기존 양성 fixture 17개를 보완했으며 기존 assertion은 유지했다. 테스트 작성자 독립 실행은 26파일·317통과다. `isEligible`의 최종 반환을 false로 바꾸는 임시 변이에서 find-outcome 5실패·3통과, try/finally 원문 바이트 복구 뒤 8/8통과를 확인했다. 이 변이 기록은 세션 도구 출력에 남아 있으며 별도 로그 파일이 있다고 주장하지 않는다.

광역 T1~T4·PLAN·Workspace·R5 회귀의 첫 실행은 1,359통과, PGlite 5개가 메모리 할당 오류였다([로그](./regressions.log)). 해당 5개를 단독 재실행해 전부 통과했다([재실행](./pglite-retry.log)). 제품 기대값을 약화하거나 실패를 skip으로 바꾸지 않았다. 최종 타입·lint·목적 리뷰·전체 회귀·CI 8종은 PR 검증 기록과 함께 확인한다.

최종 로컬 `pnpm turbo run lint typecheck test`는 **15/15 작업 성공**, 웹 **478파일·5,727테스트 통과**, 환경 의존 **43파일·248테스트 건너뜀**, 타입 오류 0·lint 오류 0이다([원문](./final-local-checks.log)). 기존 lint 경고는 남아 있다. 개발 DB 자격 정보 없이 실행했으며 건너뜀을 검증 성공에 넣지 않는다. 수정 중 결속·정규화 반례 2개가 실패한 전체 실행도 [중간 로그](./intermediate-full-tests.log)에 보존했다. 최종 독립 반례 부분집합은 [98통과](./final-counterexamples.log), 에이전트·공식 원천·쓰기 장벽 회귀는 [142통과](./agent-and-guard.log)다.

목적 리뷰 1~4차의 실제 결함을 수정했다. [5차 리뷰](./goal-review-fifth.log)의 남은 P2는 보고서가 참조한 증거 파일이 HEAD에 없다는 지적이며, 해당 파일들을 증거 커밋에 포함한다. 증거 포함 후 최종 목적 리뷰 결과와 최종 HEAD의 필수 CI 8종·safe-merge 결과는 PR #285의 「검증」 기록에서 확인한다.

계속 차단되는 사항: 납품 `delivery_id`↔G2 수행 결속은 별도 migration 승인 대상. 실제 권리/Gold/FQ 역할 검증과 학생 사전·사후·지연·독립 전이 연구는 미완성이다. 기존 봉인·TASK·PLAN·제품 목표·SQL·운영 데이터는 변경하지 않았다. 이 PR 수용은 실제 적격 콘텐츠 공급 또는 교육 효과 성공 판정이 아니다.

`BLOCKED_APPROVAL`: 납품↔G2 및 최초 노출의 원자적 결속을 위한 DB 변경. 이번 PR에는 새 SQL을 추가하거나 적용하지 않는다. 실제 콘텐츠 자격은 별도의 근거 확보 전까지 차단한다.
