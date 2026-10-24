# 대량작업 K — 결함 4건 인계 (2026-10-24)

K 세션은 공유 제품 파일 · DB 를 고치지 않는다. 각 owner 가 고친 뒤 `apps/web/src/lib/csat/k-regression/gaps.ts` 의 해당 id 를 `fixed` 로 바꾸면 `k-targets.test.ts` 가 회귀 검사로 돈다.
전달 상태: 이 문서와 브랜치 `test/csat-k-regression-20261024` 로 기록했다. 각 owner 세션이 받았다는 증거는 없다.

## K2-a → csat-lecture-disclosure (정답 공개)
- 재현: `leakedAnswerKeys` 가 `is_correct` · `answer_no` · `correctIndex` · `correct_choice` 를 놓친다(이름 목록 의존).
- 실제 누출 재현 여부: **재현하지 못했다.** 현재 D 초기 props 에는 이런 키가 없다. 결함은 검사기의 탐지 범위다.
- 요청:
  - 공개 전 HTML · RSC · API 응답의 실제 노출 여부를 확인한다.
  - 필드명 목록에만 의존하지 않는 검사를 마련한다. 예: 정답 근거 문장 · 정답 번호 값을 직렬화 결과와 대조하는 방식. K 하네스 `k-contracts` 의 값 대조가 그 예다.

## K3-a → G 데이터 정합성
- 재현: `RevealData` 에 units 해시가 없다. 그래서 판본 번호가 같고 본문만 다른 공개 자료가 `checkReveal` 을 통과한다.
- 실제 오판 재현 여부: **재현하지 못했다.** 현재 픽스처 13건은 개발 DB 의 판본 · 해시와 모두 일치한다. 결함은 결속 계약의 빈칸이다.
- 요청: 원문 본문 해시 · 분석 revision · 근거 앵커를 함께 결속한다.

## K4-a → 문항 데이터 · 판단 도구 (csat-judgment-d)
- 재현:
  - `checkReveal` 은 `answer` 와 어긋나는 `verdict=correct` 선지가 있는 자료를 거절하지 않는다. 정답 번호 4 · 판정 2번 같은 경우다.
  - 복수 판정(4 · 5) 자료도 거절하지 않는다.
- 데이터: 개발 DB 2015#25 는 `answer=4`, `answers={4,5}` 다. 복수 정답 문항은 이 1건이다.
- 단일 정답 비교 코드:
  - `components/csat/session/ItemScreen.tsx:100`
  - `components/csat/authored/AuthoredRunner.tsx:466`
  - `lib/csat/evidence.ts:323`
- 실제 오판 재현 여부: **화면에서는 재현하지 않았다(NOT_RUN).** 2015#25 를 이 화면들로 여는 실계정 E2E 는 하지 않았다.
- 요청:
  - 공식 복수 정답 근거(평가원 정답 정정 공지)와 DB 정본을 대조한다.
  - 단일 정답 가정 코드의 영향 범위를 확정한다.

## K6-a → P6 · 학습기록
- 재현:
  - DB 함수 `learning_attempt_independence` 의 노출 조건은 `e.item_ref = a.item_ref` 뿐이다. 개발 DB `pg_get_functiondef` 로 확인했다.
  - 앱 `exposure-ledger.ts` 는 같은 지문 해시를 쓰는 문항까지 노출로 본다.
- 실제 오판 재현 여부: **재현하지 못했다.** 추적 시작 뒤 시도가 0건이고, 지문을 공유하는 다른 문항의 노출이 있는데 독립으로 판정된 시도도 0건이다.
- 요청:
  - 동일 지문 공유 문항 간 노출의 의미를 정의한다.
  - DB · 앱에서 같은 판정 계약을 쓴다.
- DB 변경 조건: SQL 전문 · SHA-256 · 영향 분석 · 복구 절차를 제출하고 사용자 승인을 받기 전에는 실행하지 않는다.
- 목표 테스트: DB·앱 행동을 비교하는 PGlite 테스트를 고치는 owner 가 `k-targets` 에 `target('K6-a', …)` 로 넣는다. 목표 없이 fixed 로 바꾸면 결속 테스트가 실패한다.

## K6-b → P6 · 학습기록 (T-0155 run 2 에서 추가)
- 재현: `loadExposureLedger` 가 `learning_exposures` 를 읽지 않는다. 정답 직접 노출이 있어도 그 문항은 `unseen` 이다. 가짜 DB 로 행동을 단언했다.
- 실제 오판 재현 여부: **재현하지 못했다(NOT_RUN).** 실계정에서 정답을 연 뒤 독립 평가 후보에 오르는지는 보지 않았다.
- 요청: 앱 평가용 원장에 P6 노출을 포함한다. K6-a 의 공유 지문 정의와 함께 정한다. 앱 코드만 고치면 되고 DB 변경은 필요 없다.
