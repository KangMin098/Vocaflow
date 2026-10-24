# 대량작업 K — 기출분석 통합 회귀 위험 대응표 (2026-10-24 · r2)

**기준 스냅샷:** 로컬 main `3fa3b3415`(D 판단 도구 병합).
**참조 브랜치(읽기만):** `feat/lecture-learner-control@e77c48f94`(T-0140·T-0147 공식 COMPLETED, T-0152 READY).
**개발 DB:** `jajenrevcbmrpaliomxv`, 읽기 전용 질의만 했다.

## 상태 어휘
아래 상태는 서로 승격하지 않는다.

| 상태 | 뜻 |
|---|---|
| PASS | 실행해서 계약이 지켜짐 |
| KNOWN_GAP | 실행해서 결함을 재현함. 재현 테스트 PASS 는 결함이 있다는 뜻이고, 해결이 아니다 |
| NOT_IN_BASELINE | 기능은 다른 브랜치에 구현돼 있고, 공식 완료일 수도 있다. 기준 스냅샷에만 없다 |
| NOT_IMPLEMENTED | 제품 어디에도 아직 구현되지 않았다 |
| NOT_RUN | 대상은 있지만 실행하지 않았다 |

## 검증 층
U=단위 · I=격리 · L=실계정/개발 DB · C=콘텐츠 승인 · E=학습 효과.
이번 회차는 U와 L(읽기)만 실행했다. I·C·E 는 NOT_RUN 이다.

## 하네스 구성
경로: `apps/web/src/lib/csat/k-regression/`

| 파일 | 역할 |
|---|---|
| `gaps.ts` | 결함 등록부(open / fixed) |
| `k-contracts.test.ts` | 지금 지켜지는 계약. PASS 만 담는다 |
| `k-repro.test.ts` | open 결함 재현. 결함이 있다는 것을 직접 단언한다 |
| `k-targets.test.ts` | 고친 뒤의 목표 동작. open 동안 skip 이다 |
| `k-registry.test.ts` | 등록부 · 재현 · 목표 · 이 표의 정합 |

## 대응표

| K | 위험 | 상태 | 층 | 근거 |
|---|---|---|---|---|
| K1 | 문항·원문·분석·강의·앵커·노출·지도 계약 통합 | NOT_IN_BASELINE | — | 강의·정답 지연은 공식 완료(T-0140·0147)지만 main 에 없다. 34번 연결 T-0152 는 READY(리뷰 반려 뒤) |
| K2 | 초기 props 정답 키(D 픽스처 13건) | PASS | U | `leakedAnswerKeys` = [] |
| K2 | 정답 근거·소거 문장이 초기 자료에 값으로 없다 | PASS | U | 이름 목록이 아니라 값 대조로 확인 |
| K2-a | 정답 키 검사가 이름 목록에만 의존한다 | KNOWN_GAP | U | `is_correct` · `answer_no` · `correctIndex` · `correct_choice` 를 놓친다 |
| K2 | 첫 HTML·RSC 정답 분리, cue·강조 누출 | NOT_IN_BASELINE | U(브랜치) | 참조 브랜치 테스트 86/86. 실제 HTML·RSC 응답 대조는 NOT_RUN |
| K3 | 판본(analysis/units)·id·형식 불일치 거절 | PASS | U | `checkReveal` |
| K3-a | units 해시가 달라도 판본 번호만 같으면 통과 | KNOWN_GAP | U | `RevealData` 에 해시 칸이 없다 |
| K3 | 픽스처 13건과 개발 DB 현재 판본·해시 | PASS | L | 13/13 일치 |
| K4-a | 정답 번호와 선지 판정이 어긋나도 거절하지 않는다 | KNOWN_GAP | U·L | 아래 「K4-a 상세」 |
| K5 | D 6종 판단 도구 근거 데이터 결속 | PASS | U·L | D 테스트 145/145, 픽스처 DB 결속 |
| K5 | D 도구 제품 화면 연결 | NOT_IMPLEMENTED | — | 어느 제품 라우트에도 마운트가 없다 |
| K5 | 34번 판단 도구 제품 연결, c3 UNKNOWN 경계 | NOT_IN_BASELINE | — | T-0145 BLOCKED, T-0152 READY. 검증된 통합 커밋이 없어 격리 통합 검사는 NOT_RUN |
| K6 | P6 v3.1 개발 DB 적용 | PASS | L | 아래 「K6 근거」 |
| K6 | 기록 실패 시 정답 미전달(503) | NOT_IN_BASELINE | U(브랜치) | 참조 브랜치 judgment route 테스트 |
| K6 | 노출·도움 뒤 시도의 독립 판정 실측 | NOT_RUN | L | 추적 시작 뒤 시도 0건. 노출은 71행, 3문항 |
| K6-a | DB·앱 노출 기준 불일치 | KNOWN_GAP | U·L | 아래 「K6-a 상세」 |
| K6-b | 앱 평가용 노출 원장이 P6 정답 노출을 읽지 않는다 | PASS | U | T-0164(2026-10-25) 수정 — `loadExposureLedger` 가 `learning_exposures` 를 7번째 원장으로 읽는다. 목표 테스트 `k-targets` K6-b 가 실제 단언으로 돈다. 아래 「K6-b 상세」 |
| K7 | PDF·강의·근거 동시 사용 성능·장애 | NOT_RUN | — | 통합 화면이 기준에 없다 |
| K7 | 1280/1440 통합 화면 | NOT_RUN | — | 같은 이유 |
| K8 | 검증 상태 구별 | PASS | U | `k-registry.test.ts` 가 이 표와 등록부를 맞춘다 |

### K4-a 상세
- 2015#25 의 DB 값은 `answer=4`, `answers={4,5}` 이다. 개발 DB 에서 복수 정답 문항은 이것 하나다.
- `checkReveal` 은 정답 번호와 어긋나는 `verdict=correct` 선지가 있어도 거절하지 않는다.
- 정답 하나만 비교하는 코드:
  - `session/ItemScreen.tsx:100`
  - `authored/AuthoredRunner.tsx:466`
  - `lib/csat/evidence.ts:323`

### K6 근거
- 마이그레이션 2건 적용 이력이 있다.
- authenticated 에 기록 권한이 없다.
- service_role 의 추적 표 INSERT 가 회수됐다.
- 기록 함수가 `auth.users` 를 더 읽지 않는다.

### K6-a 상세
- DB 함수 `learning_attempt_independence` 는 같은 `item_ref` 의 노출만 본다. 2026-10-24 `pg_get_functiondef` 로 확인했다.
- 앱 노출 원장은 같은 지문 해시를 쓰는 문항까지 노출로 본다.
- DB 쪽 재현 테스트는 P6 마이그레이션이 기준에 없어 skip 이다(NOT_IN_BASELINE). 앱 쪽 재현만 실행된다(`exposureOf` 행동 단언).
- 목표 테스트는 아직 없다(NOT_IMPLEMENTED). DB·앱 행동 비교는 P6 스키마를 PGlite 에 올려야 해서, 고치는 owner 가 `target('K6-a', …)` 로 작성한다. 그 전에 fixed 로 바꾸면 `k-targets` 끝의 결속 테스트가 실패한다. SQL 문자열 검사는 목표가 될 수 없다(T-0155 K-R1).

### K6-b 상세
- `loadExposureLedger` 는 원장 6종만 읽는다: G2 시도·세션, 함정, 문제지, 복습 큐, 진단.
- P6 `learning_exposures` 는 읽지 않는다. main · 강의 브랜치 · P6 브랜치 모두 0건이다.
- 그래서 판단 장면에서 정답을 직접 연 문항(answer_direct)도 독립 평가 후보 선정에서는 `unseen` 이다.
- 재현은 가짜 DB 로 행동을 단언한다. 실계정 오판 재현은 NOT_RUN 이다.

## 재발 사례 대응

| 사례 | 항목 | 상태 |
|---|---|---|
| 34번 c3 UNKNOWN 경계 | K5 | NOT_IN_BASELINE |
| cue 이동·강조로 정답 누출 / 초기 HTML·RSC 간접 공개 | K2 | NOT_IN_BASELINE (브랜치 단위 PASS) |
| 2015#25 복수 정답 | K4-a | KNOWN_GAP |
| 35번 근거 강조 불일치 | K3·K5 | 픽스처 결속 PASS(H2609G1/G2#35) · 강조 화면 NOT_IN_BASELINE |
| 문항 조건·한정의 과도한 일반화 | — | NOT_RUN (탐지기 T-0148 BLOCKED) |
| 원문 누락·도표 수치·각주 | — | NOT_RUN |
| P6 기록 실패 이후 정답 전달 | K6 | NOT_IN_BASELINE (브랜치 단위 PASS) |
| 도움 받은 학습의 독립 수행 오판 | K6·K6-a·K6-b | 실측 NOT_RUN · 기준 불일치 KNOWN_GAP · P6 원장 반영 PASS(T-0164) |
| 분석 판본 변경 후 근거 앵커 불일치 | K3·K3-a | 판본 번호 PASS · 해시 KNOWN_GAP |

## 결론
- 수용 대상은 K 회귀 하네스뿐이다.
- 전체 제품 수용은 보류한다. 강의·34번 연결의 main 통합, 1280/1440 통합 E2E, 결함 4건 수정이 남았다.

## r3 — 최신 로컬 main `0430c9ece` 재확인 (2026-10-24)
T-0140·T-0147 검증 커밋(`253a6f34e`·`59a981a04`)이 로컬 main 에 들어왔다.
판단 도구 제품 연결부(`feat/csat-judgment-bridge`)도 들어왔다.
P6 마이그레이션(`e9c2fe99c`)은 아직 없다.

검사 방법: main `0430c9ece` 위에 하네스 `1d1c6596a` 를 얹은 임시 detached worktree 에서 실행했다(main-serving 무변경).
결과: 291 passed · 20 skipped. 로그는 AI-Control `runtime/k-regression/on-main-0430c9ece.log` 다.

| 항목 | 최신 main 상태 |
|---|---|
| K 재현 10건 | 그대로 PASS. 결함 5건 모두 최신 main 에서도 open 이다 |
| K2 첫 응답 정답 분리 · K6 기록 실패 503 | 이제 기준 안. main 에서 judgment route · lecture 테스트 PASS(단위). 실제 HTML·RSC 응답 대조는 NOT_RUN |
| K6 DB 재현 | 여전히 NOT_IN_BASELINE(P6 마이그레이션 미포함) |
| `judgment/__tests__/server.live.test.ts` 8건 | 라이브 DB 환경 미설정으로 skip. K 소관 아님, NOT_RUN |
| T-0152 · T-0145 | 공식 미완료 그대로(READY · BLOCKED) |

## skip 12건의 공식 처리 (DL-0208)
- 목표 11건은 open 결함의 적용 제외다. 결함을 고친 뒤 fixed 로 바꿔야만 돈다. PASS 가 아니다.
- DB 재현 1건은 NOT_RUN 이다. P6 마이그레이션이 기준에 들어오면 자동 실행된다.
- AI-Control 완료 게이트는 범위 안 skip 을 통과로 세지 않고, 공식 적용 제외 기능이 없다. 게이트를 고치거나 우회하지 않았다. 그래서 T-0155 는 REVIEW 다.

## r4 — 실행 구조 정리 (skip 12 → 0, 2026-10-24)
r3 의 「skip 12건 처리」 를 대체한다. 테스트를 빼거나 게이트를 고치지 않고, **실행하지 않는 것을 테스트로 등록하지 않는다**.

| 구분 | 수 | 처리 |
|---|---|---|
| 실제 실행 PASS | 39 | 계약 13 · 재현 10 · 기준 부재 사실 1 · 목표 보관/결속 4 · 등록부 11 |
| 조건부 미실행 목표(open 결함) | 10 | K2-a 4 · K3-a 2 · K4-a 4(K6-b 1 은 T-0164 로 fixed — 실제 단언으로 전환). `k-targets` 의 `TARGETS` 표에 보관하고 테스트로 등록하지 않는다. PASS 아님. 결함을 fixed 로 바꾸면 자동 등록되어 실제 단언으로 돈다 |
| DB 재현 NOT_RUN | 1 | P6 마이그레이션이 기준에 없어 등록하지 않는다. 대신 「기준에 없다」를 단언하는 테스트 1건(위 39 중 1)이 돈다. 이것은 재현 PASS 가 아니다 |
| 목표 NOT_IMPLEMENTED | 1 | K6-a. `NOT_IMPLEMENTED` 목록에 있는 동안 fixed 전환은 실패한다 |

**검증력 유지:** 변이 시험 7건(`runtime/k-regression/mutation-r5.mjs` · `mutation-r5.log`)이 모두 기대대로 판정됐다.

| 변이 | 결과 |
|---|---|
| m0 기준 상태 | 통과 |
| m1 NOT_IMPLEMENTED 결함을 fixed 로 | 실패로 검출 |
| m2 빈 본문 목표 | 실패로 검출 |
| m3 표 밖 일반 it 로 우회 | 실패로 검출 |
| m4 제품 미수정 상태로 fixed | 제품 결함으로 실패 |
| m5 open 결함의 보관 목표 삭제 | 실패로 검출 |
| m6 목표 있는 결함을 NOT_IMPLEMENTED 로 | 실패로 검출 |
