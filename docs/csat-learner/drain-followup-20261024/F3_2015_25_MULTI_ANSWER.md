# F3 — 2015학년도 수능 영어 25번 복수정답(④·⑤)

작성 2026-10-24 · 읽기 전용 조사(제품 코드·강의 JSON·sidecar·DB 수정 없음; DB 는 SELECT 만).

## 1. 공식 근거 — 보도로 확인(VERIFIED_PRESS), 평가원 1차 원문은 확보 못 함

| 출처 | 날짜 | 내용(요약·짧은 인용) |
|---|---|---|
| 아주경제 https://www.ajunews.com/view/20141124104332823 | 2014-11-24 | 평가원 최종 정답 발표: 영어 25번은 ④ 외에 ⑤도 정답. 사유: ⑤가 "'퍼센트'라는 용어가 잘못 사용돼" 도표와 맞지 않음 |
| 서울신문 https://m.seoul.co.kr/news/2014/11/24/20141124800103 | 2014-11-24 | 생명과학Ⅱ·영어 복수정답, 평가원장 사퇴(제목) |
| 세계일보 https://www.segye.com/newsView/20141124004057 · 동해신문 https://dhnews.co.kr/news/view/179513489139189 | 2014-11-24 | 같은 내용 |

- 사유(보도 기준): 이의심사실무위원회(통계·영어 전문가)는 "'퍼센트(%)'는 백분율", "'퍼센티지 포인트(%p)'는 백분율 간의 차이"라고 보아, ⑤의 `eighteen percent increase`(2%→20%, 차이 18%p, 증가율은 900%)가 도표와 맞지 않는다고 판단해 ⑤도 정답으로 인정했다.
- 보도된 응답 분포 추정: ④ 79%, ⑤ 5%.
- 한계: kice.re.kr 의 공식 보도자료·정답표 원문 URL 은 이번 조사에서 확보하지 못했다. 공식 정답이 복수정답이라는 사실은 여러 주요 보도가 같은 날 일치해 신뢰도가 높다. 제품 문구에 쓰기 전에 평가원 원문을 한 번 더 확인하는 것을 권한다.

## 2. DB 대조(vocaflow-dev, 2026-10-24 SELECT)

- `csat_items` 2015#25: `answer=4`, `answers=[4,5]`, type `R-CHART`, 발문 「다음 도표의 내용과 일치하지 않는 것은?」. DB 전체에서 answers 길이가 2 이상인 문항은 이것 하나다.
- 선지 ⑤: `Compared to 2006, 2012 recorded an eighteen percent increase…`
- `csat_item_analyses` 최신 published 버전은 **v5**(2026-10-11)이다. ⑤ `verdict: "distractor"`, how_to_reject 는 「20−2=18 … 도표와 일치해 답이 아니다(이 선지의 percent 는 백분율 값의 차이)」 → **공식 판정과 반대다.**
- v4(published, 2026-09-13)도 ⑤ 를 distractor/「단위 혼동」으로 두고 "도표 문항에서 이 표현은 … 퍼센트포인트를 뜻한다"고 서술한다. 이 역시 공식 판정과 반대다. answer_locus·solve_procedure 마지막 단계("X 가 둘이면 ⑤를 곱셈으로 처리하지 않았는지")도 단일 정답을 전제한다.

## 3. 강의(main e3e0a6a0e `lecture-data/2015.json`, 2015#25)

version 3 · cue 12개(c1–c12) · rubric 91.

| cue | role | 단일 정답 / ⑤ 관련 |
|---|---|---|
| c1 | intro | 「답이 아닌 네 선지는 도표와 맞는 진술」 — **단일 정답 전제** |
| c2 | strategy | 「몇 포인트 증가는 뺄셈」 — ⑤ 를 %p 로 읽는 틀을 미리 심음 |
| c3 | structure | 중립 |
| c4 | evidence | 「사 번이 정답입니다」 — 정답 공개(④ 만) |
| c5 | evidence | ④ 계산(53÷29≈1.8) — 사실상 문제없음 |
| c6–c8 | eliminate | ①②③ 소거 — 문제없음 |
| **c9** | eliminate(reject:5) | 「차이가 십팔 … 증가는 값의 차이를 말하니 맞는 진술이고, 답이 아닙니다」 — **공식 판정과 정면 충돌** |
| c10 | trap | 「휴대폰 번호가 열 배로 늘어」 — 오히려 ⑤ 가 틀린 근거(10배=900% 증가)를 스스로 말함 |
| c11 | vocab | 「increase — 여기서는 뺄셈」 — ⑤ 해석 고착 |
| c12 | wrapup | 「증가는 빼서 확인한다, 이것이 규칙」 — **잘못된 일반 규칙**(퍼센트 증가는 비율) |

수정 필요 cue: c1, c2, c9, c11, c12(필수) · c4(복수정답 표기) · c10(연결 문장 활용 가능).

## 4. 공개 경계

- `official-answers.txt`(37f8b7219): `2015#25:4` — 단일 숫자. `sidecar-build.mjs:16` 이 `k:v` 를 `Number(v)` 로 읽어 복수정답을 표현할 수 없다.
- sidecar-v2 `2015.disclosure.json`(줄 3380~): `official_answer: 4`, first_certain_answer_index 3(c4, R1_DIRECT_OFFICIAL_NUMBER). c6–c9 는 R3_ELIMINATION/HINT, c9 누적 수준 ANSWER. c5·c10–c12 는 UNKNOWN/needs_review.
- `disclosure-data.json`(6eb6f3451): `2015#25 {version:3, cues:12, stopBefore:3, preStopRisk:"none"}` → 「정답 직전까지」 경로는 c1–c3 만 보여 준다.
- 판단: **c9 는 경계 뒤(index 8)라 정답 직전 경로에서는 나오지 않는다.** 경계 계산은 ⑤ 언급 cue 를 정답 공개로 인식하지 않는다(⑤ 는 「소거=오답」 HINT로만 분류). 복수정답 기준이면 c9 는 「정답 ⑤ 를 오답이라고 부정하는 cue」인데, 이를 잡는 규칙이 없다. 다만 경계 앞 c1 「답이 아닌 네 선지」는 NONE 으로 판정됐다 — 복수정답 기준에서는 사실과 틀린 진술이 경계 앞에 노출된다(공개 위험이 아니라 정확성 문제).
- R7(오답 4개 누적 소거)은 「정답 1개」를 전제한다. 복수정답이면 「정답 아닌 3개 소거」에서 이미 정답 집합이 확정된다.

### 단일 정답 가정 코드 위치

| 파일:줄 | 가정 |
|---|---|
| cue-audit/sidecar-build.mjs:16 (37f8b7219) | 정답표를 `Number(v)` 로 파싱 |
| scripts/csat/lecture-disclosure-build.mjs:24·41 (6eb6f3451) | R1/R7 규칙만 경계로 씀, 정답 집합 개념 없음 |
| apps/web/src/lib/csat/theater.ts:136·175-176·180·215 (main) | `answer: number \| null`, 「정답 ④」 단일 표시 |
| apps/web/src/lib/csat/lecture/validate.ts:25·236 | `n === ctx.answer` 로만 「정답을 지우는 큐」 검사 → c9(⑤ 소거)를 못 잡음 |
| apps/web/src/lib/csat/lecture/targets.ts:15 | `answer: number \| null` |
| apps/web/src/lib/csat/overlay-reveal.ts:25·135·201·211 | `n === answer` 만 정답 처리 |
| AnalysisTheater.tsx(6eb6f3451) | `answer` 문자열 키만 확인됨 — 정답 비교는 theater.ts 의 모델을 통해 받음 |

## 5. 제품 전반의 `answers` / `answer` 사용(main e3e0a6a0e)

`answers` 를 쓰는 곳(복수정답 반영): `lib/csat/diagnosis/admin.ts:48·69·160`(채점 키 `answers ?? [answer]`) · `diagnosis/engine/scoring.ts`(rule-v1 테스트 102행이 `[2,4]` 채점 확인) · `admin/csat/diagnosis/.../TaggingBoard.tsx:72` · `lib/csat/evidence.ts:337`(answerCount>1 → evidence-fold.ts:289 에서 'conflict').

`answer` 만 쓰는 곳(⑤ 를 정답으로 보지 못함):
- 학습자 정답 표시: `components/csat/session/ItemScreen.tsx:100-101` · `AnalysisWorkbench.tsx:47` · `QuestionArchitecture.tsx:24·37` · `authored/AuthoredRunner.tsx:466·469`
- 데이터 공급: `lib/csat/learner.ts:397·407·503·560·601·624` · `items.ts:36·108·129·198` · `items-fold.ts:92` · `evidence.ts:323·365` · `client.ts:143·175` · `dissect-catalog.ts:23·29·104·122` · `dissect.ts:10·204`
- 강의·오버레이: `lecture/validate.ts:236` · `lecture/targets.ts:15` · `overlay-reveal.ts:135·211` · `theater.ts:175·215`
- 공장 경로: `map/v62/factory-bridge/dcp-admission.ts:174` · `dcp-reuse.ts:86` · `fast-worksheet.ts:293·295` · `local-production.ts:373`

결론: 진단 채점은 복수정답을 맞게 처리하지만, 학습자 해설·강의·분석 화면은 모두 ④ 하나만 정답으로 보여 준다. ⑤ 를 고른 학습자는 진단에서는 정답, 해설 화면에서는 오답 표시를 받는 불일치가 생긴다(세션 채점 경로 `ItemScreen` 의 hit 판정이 `item.answer` 기반인지는 추가 확인 필요).

## 6. 수정 후보(원본 수정 안 함, 후보만)

1. **분석(DB, 승인 필요)**: v6 를 만들어 ⑤ verdict 를 `correct`(공식 복수정답)로 바꾼다. why_correct: 2→20 은 18%p 이고 증가율은 900%이므로 `eighteen percent increase` 는 도표와 맞지 않는다. answer_locus 에 [5]·[6] 두 문장을 둔다. solve_procedure 마지막 단계 「X 가 둘이면」을 「percent 와 percentage point 를 구분하라」로 바꾼다.
2. **강의 cue 방향**: c1 「답이 아닌 네 선지」 → 「출제 당시 정답은 ④였고, 이의신청 뒤 ⑤도 정답으로 인정됐어요」. c4 「사 번이 정답」 + 「오 번도 공식 정답」. c9 를 eliminate 에서 evidence 로 바꾸어 「18은 퍼센트포인트, 증가율로는 900%」. c2·c11·c12 의 「증가=뺄셈」 규칙을 「포인트 차이는 빼고, 퍼센트 증가는 나눈다」로 바꾼다. version 4 로 올리고 sidecar 를 다시 판정한다.
3. **sidecar/경계**: official-answers.txt 형식을 `2015#25:4|5` 로 넓히고 sidecar `official_answers:[4,5]` 를 둔다. R1 은 정답 집합의 어느 원소든 낭독하면 성립하게 하고, R3 소거가 정답 집합의 원소를 지우면 새 오류 규칙(예: `R_ELIMINATE_OFFICIAL`)으로 막는다. R7 은 「집합 밖 선지 전부 소거」로 일반화한다.
4. **코드**: `theater.ts`·`overlay-reveal.ts`·`lecture/validate.ts`·`ItemScreen`·`QuestionArchitecture`·`AnalysisWorkbench`·`learner.ts`·`items.ts` 에서 `answers ?? [answer]` 를 쓰는 공용 헬퍼(예: `officialAnswers(item)`)를 쓰게 한다. 표시는 「정답 ④·⑤(복수 인정)」.
5. **회귀 테스트**: (a) `validate.ts` — answers=[4,5] 에서 ⑤ 를 eliminate 하는 cue 가 `eliminate-answer` 로 걸리는지 · (b) theater/overlay — 정답 배지 두 개 · (c) disclosure-build — 복수정답 sidecar 에서 stopBefore 가 첫 원소 공개 직전인지 · (d) DB 정합 가드 — answers 길이>1 인 문항의 published 분석이 해당 선지 전부를 `correct` 로 두는지 · (e) 강의-분석 정합 가드 — 공식 정답 집합의 선지를 「답이 아닙니다」라고 말하는 cue 를 금지.

## 7. 교육적 사례로 쓰는 문제

쓸 수 있다. 도표 문항에서 「percent increase(비율)」와 「percentage-point 차이(뺄셈)」를 구분하는 일은 실제로 시험에 나오는 판단 기준이다. 이 문항은 그 차이가 공식 정답을 바꾼 실제 사례다. 학습자가 2→20 을 두 가지로 계산해 비교하는 활동(빼면 18, 나누면 10배 = 900% 증가)은 선택과 근거를 추적하는 상호작용으로 만들 수 있다. 긴 설명을 덧붙이지 않아도 된다.

위험:
- 혼란: 「도표 문항에서 increase 는 늘 뺄셈」 같은 현재 강의의 잘못된 규칙이 이미 들어가 있다. 사례로 쓰기 전에 이 규칙부터 걷어내야 한다.
- 권위 훼손: 「시험이 틀린다」는 인상을 줄 수 있다. 출제 오류로 몰아가지 말고, 「공식 이의심사가 용어의 정확한 뜻으로 판정했다」는 사실 중심으로 제시한다.
- 실제 수능 전략과 충돌: 실전에서는 정답이 하나라는 전제로 풀어야 한다. 「둘 다 고르라」로 가르치면 안 된다.

조건:
1. 공식 판정(④·⑤)과 출처·날짜를 함께 보여 준다. 평가원 원문을 확보하는 것이 좋다.
2. 분석 v6 와 강의 v4 로 먼저 정합을 맞춘다.
3. 이 사례를 숙달 산입이나 채점 근거로 쓰지 않는다.
4. 학습 효과는 학습자 검증 전에는 주장하지 않는다.
