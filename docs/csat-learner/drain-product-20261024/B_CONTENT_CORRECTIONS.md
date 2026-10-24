# 작업 B — 콘텐츠 정확성 수정 후보 패키지 (2026-10-24)

- 기준: 로컬 main `7f11a8538` · 강의 `apps/web/src/lib/csat/lecture-data/` · DB `jajenrevcbmrpaliomxv` SELECT 만 · T-0140 브랜치 `D:/workspace/Vocaflow-lecture-learner-control` HEAD `94c0170c6`.
- **이 문서의 모든 문안·JSON·패치는 후보다.** 강의 원본·DB·sidecar·disclosure-data 는 고치지 않았고 발행하지 않았다.
- 출발 근거: `docs/csat-learner/drain-followup-20261024/` F3 · F4a · F4b.

---

## 1. 2015#25 — 공식 복수정답 ④·⑤

### 1-0. 최신 기준 재확인(2026-10-24)

| 대상 | 확인 결과 |
|---|---|
| DB `csat_items` | `answer=4` · `answers=[4,5]` (재확인) |
| DB 최신 published 분석 | **v5**(2026-10-11). ⑤ `verdict:"distractor"` · how_to_reject 「18 포인트 증가로 읽으면 … 일치해 답이 아니다」 — 공식 판정과 반대(F3 와 같음). answer_locus `sentence_index:[5]` 단일 |
| main 강의 `2015.json` 2015#25 | version 3 · cue 12 · rubric 91. F3 표와 내용 동일(c1 「답이 아닌 네 선지」, c9 「맞는 진술이고, 답이 아닙니다」, c11 「여기서는 뺄셈」, c12 「증가는 빼서 확인」) |
| T-0140 `disclosure-data.json` | `{version:3, cues:12, stopBefore:3, preStopRisk:"none"}` — 단일 정답 기준 경계(F3 와 같음) |
| sidecar 원본 | `lecture-disclosure-build.mjs` 는 sidecar 폴더를 인자로 받는다. T-0140 워크트리 안에서 `*.disclosure.json` · `official-answers.txt` 를 찾지 못했다 → sidecar 원본 줄 번호 재확인은 **NOT_VERIFIED**(F3 의 37f8b7219 기준 기록을 따른다) |
| 공식 근거 | 평가원 1차 원문 미확보 — F3 의 보도 근거(VERIFIED_PRESS)만. 발행 전 원문 확보 권고 |

### 1-1. (a) 분석 v6 후보 — v5 를 바탕으로 바뀌는 키만

DB 쓰기는 하지 않는다. 적용 시에는 v5 를 읽어 아래 키만 바꾼 새 행(version 6, status 는 감수 전 `draft`)을 만든다 — 통째 덮어쓰기 금지.

```json
{
  "item_id": "2015#25",
  "version": 6,
  "answer_locus": {
    "quote": "three times higher than that of 2006",
    "sentence_index": [5, 6],
    "reasoning": "공식 정답은 ④·⑤ 두 개다(2014-11-24 평가원 이의심사 결과). [5] Email Addresses 29→53 은 약 1.8배라 '세 배'가 도표와 어긋난다. [6] Cell Phone Numbers 2→20 은 18 퍼센트포인트 차이이고 퍼센트로는 900% 증가다. 'eighteen percent increase' 는 증가율 18% 를 뜻하므로 도표와 맞지 않는다."
  },
  "choice_analysis[n=5]": {
    "n": 5,
    "verdict": "correct",
    "official_note": "이의심사 뒤 추가 인정된 공식 정답(복수정답 ④·⑤).",
    "why_correct": "[6] 은 2006년 2%, 2012년 20%다. 두 백분율의 차이 18 은 '18 퍼센트포인트'이고, 'percent increase' 는 처음 값 대비 증가율(18÷2=9, 곧 900%)이다. 그래서 'eighteen percent increase' 는 도표와 일치하지 않는다.",
    "trap": "퍼센트 ↔ 퍼센트포인트 혼동",
    "confirmed_at": { "sentence_index": [6], "note": "v5 confirmed_at 의 원본 도표 판독값(2/20) 재사용" }
  },
  "solve_procedure[1]": {
    "step": "선지마다 비교 종류를 표시한다 — each/highest 는 크기, three times 는 나눗셈, 'N percentage points' 는 뺄셈, 'N percent increase' 는 처음 값 대비 비율이다.",
    "on_fail": "숫자 낱말 뒤가 percent 인지 percentage point 인지부터 본다. 2→20 을 빼면 18, 나누면 10배(900% 증가)다."
  }
}
```

- v5 ④ 항목(`correct`, 배수 과장)은 그대로 둔다.
- 하지 말 것: ⑤ 를 「참고·논란」 처럼 정답 아닌 범주로 두는 문안, 「정답은 ④」 단독 문구(축소 금지).

### 1-2. (b) 강의 cue 교체 후보 — version 3 → 4

| cue | role · target | 현재 요지(≤40자) | 교체 후보 낭독(ko-KR) |
|---|---|---|---|
| c1 | intro · head | 「답이 아닌 네 선지는 도표와 맞는 진술」 | 「여러분, 도표와 맞지 않는 진술을 고르는 문제예요. 발문의 '않는 것은'에 표시하세요. 이 문항은 공식 정답이 사 번과 오 번, 두 개로 인정된 문항입니다.」 |
| c2 | strategy · procedure | 「몇 포인트 증가는 뺄셈」 | 「선지마다 비교 종류를 먼저 표시하세요. 가장 높다는 크기, 세 배는 나눗셈이에요. 퍼센트포인트는 빼고, 퍼센트 증가는 처음 값으로 나눕니다.」 |
| c4 | evidence · sentence:4 | 「사 번이 정답입니다」 | 「여기 다섯 번째 문장, 사 번이 공식 정답 가운데 하나입니다. 이메일 주소는 이천육 년 이십구, 이천십이 년 오십삼이에요.」 |
| c9 | **eliminate → evidence** · `anchor:sentence:5` | 「증가는 값의 차이 … 답이 아닙니다」 | 「여기 여섯 번째 문장, 오 번도 공식 정답입니다. 이에서 이십은 빼면 십팔 퍼센트포인트, 나누면 열 배, 곧 구백 퍼센트 증가예요. 십팔 퍼센트 증가라는 말은 도표와 맞지 않습니다.」 |
| c10 | trap · sentence:4 | 「휴대폰 번호가 열 배로 늘어」 | 「여기 다섯 번째 문장이 배수 과장 함정입니다. 배수가 나오면 작은 값에 배수를 곱해 큰 값과 직접 견주세요.」(⑤ 언급 삭제 — c9 로 이동) |
| c11 | vocab · vocab | 「increase — 여기서는 뺄셈」 | 「어휘를 보세요. [three times higher] 세 배, 나눗셈으로 확인합니다. [percent increase] 처음 값 대비 증가율, [percentage point] 백분율끼리의 차이예요. [category] 항목, [overall] 전반적인.」 |
| c12 | wrapup · procedure | 「증가는 빼서 확인한다, 이것이 규칙」 | 「정리할게요. 배수는 곱해서, 퍼센트포인트는 빼서, 퍼센트 증가는 나눠서 확인합니다. 이 문항은 그 구분으로 공식 정답이 둘이 됐어요. 실전에서는 정답 하나를 전제로 풀되, 선지의 단위 낱말부터 표시하세요.」 |

- c3 · c5–c8 유지. c9 의 role 변경으로 `validate.ts` 의 「오답 배제 — 선지마다 한 큐」 검사가 ⑤ 를 `eliminate-missing` 으로 잡는다 → 1-4 의 `wrongChoices` 를 정답 집합 기준으로 고친 뒤에만 통과한다(코드 선행 조건).
- 교체 후 `withFocus` 재계산 필요(c9 는 anchor 로 바뀌어 focus 가 빠진다), version 4, rubric 재채점.

### 1-3. (c) 공개 경계 재계산 규칙(복수정답)

1. 정답 집합 `A = answers ?? [answer]`. 정답표는 `2015#25:4|5` 형식, sidecar 에 `official_answers:[4,5]`.
2. **R1(직접 번호)**: cue 가 A 의 **어느 원소든** 정답으로 낭독하면 경계. 2015#25 → 첫 경계는 c4(「사 번이 공식 정답 가운데 하나」), `stopBefore=3` 유지 예상.
3. **R2(정답 블록 강조)**: `analysis:answer` 또는 A 원소의 정답 근거 문장 anchor(후보 c9 → `sentence:5`) 강조도 경계.
4. **R3' 금지 규칙(신설)**: A 의 원소를 「오답/답이 아님」으로 소거하는 cue 는 공개 수준과 무관하게 **오류**(예: `R_ELIMINATE_OFFICIAL`) — 현재 c9 가 해당.
5. **R7(누적 소거)**: 「A 밖 선지 전부(=5−|A|개) 소거」 시점이 경계. 2015#25 는 ①②③ 소거(c6–c8)에서 성립 — 현재 R7 의 「4개」 하드코딩으로는 못 잡는다.
6. 경계 앞 cue 가 「정답은 하나」를 전제하는 진술(현 c1)도 정확성 오류로 따로 표시(공개 위험과 별개).
7. 재계산 산출 `stopBefore = min(R1, R2, R7 첫 성립 index)`; digest 는 v4 cue 원문으로 새로 계산.

### 1-4. (d) 코드 수정 지점 — owner 별 handoff

**`csat-lecture-disclosure` (T-0140/0146/0147)** — 강의·경계·판단 장면

| 파일:줄(main 7f11a8538, ※는 T-0140 HEAD) | 단일 정답 가정 | 수정 방향 |
|---|---|---|
| `lib/csat/lecture/validate.ts:25` | `answer: number \| null` | `answers: number[]` 추가 |
| `lib/csat/lecture/validate.ts:236` | `n === ctx.answer` 만 `eliminate-answer` | A 의 원소면 오류 |
| `lib/csat/lecture/validate.ts:224` | evidence 필요 판정이 answer 단일 | A 비어있지 않으면 |
| `lib/csat/lecture/targets.ts:15·39-40·50` | `answer` 단일 → `analysis:answer` 하나 | 정답 블록 집합 |
| `lib/csat/theater.ts:136·175-176·180·215` | 「정답 ④」 배지 하나 | 「정답 ④·⑤(복수 인정)」 |
| ※`lib/csat/judgment-reveal.ts:54-55·121` | 정답 하나만 reveal | A 전체 |
| ※`scripts/csat/lecture-disclosure-build.mjs:25` | R1/R2/R7 규칙 정규식, 정답 집합 없음 | 1-3 규칙 |
| sidecar-build(`cue-audit/sidecar-build.mjs:16`, 37f8b7219 기준) | `Number(v)` 파싱 | `4\|5` 파싱 — NOT_VERIFIED(현 위치 미확인) |

**`csat-v4-s0` (T-0145)**

| `lib/csat/learner.ts:560·624` | 학습자 모델에 `answer` 만 싣는다 | `answers` 동반 |

**owner 미지정(학습자 세션·공용) — 총괄 배정 필요**

| `lib/csat/overlay-reveal.ts:25·89·115-135·201-217` | 정답 오버레이 하나 · `n === answer` 만 제외 | A 전체 |
| `components/csat/session/ItemScreen.tsx:100-101` | `n === item.answer` 만 「정답」 표시 | A 원소 모두 |
| `components/csat/session/AnalysisWorkbench.tsx:47` | 「정답 {answer}번」 + 선지 하나 | 복수 표시 |
| `components/csat/session/QuestionArchitecture.tsx:24·37` | 「정답 {answer}번」 | 복수 표시 |
| `lib/csat/items.ts:108·198` | `answer` 만 공급 | `answers` 동반 |
| 공용 헬퍼(신설 후보) | — | `officialAnswers(item) = answers?.length ? answers : [answer]` — `diagnosis/admin.ts:160` 이 이미 같은 규칙 |

- 이미 맞는 곳: `lib/csat/diagnosis/admin.ts:48·69·160`(채점 키 `answers ?? [answer]`).
- 회귀 테스트 후보: F3 §6-5 (a)–(e) 그대로.

---

## 2. 강의 규칙 4건 — cue 교체 · solve_procedure 후보

구조 = **표지 관찰 → 의미 범위 확인 → 근거 관계 판단**. 판정은 F4a 를 따른다(재판정 아님).

### 2-1. 2021#45 (CONFIRMED) — 분석 v4

| cue | 후보 |
|---|---|
| c13 wrapup | 「정리합니다. 선지에서 '말했다'인지 '실제로 그랬다'인지 표시하세요(표지). 말했다는 선지라면 대사가 곧 근거예요(범위). 실제로 그랬다는 선지인데 근거가 다른 인물을 겨냥한 대사뿐이면, 서술이나 상대의 반응으로 한 번 더 확인합니다(관계).」 |
| c11 trap | 「고발하는 대사는 말한 사람의 주장이에요. 그 대사가 사실인지 묻는 선지라면 인용부호 밖 서술을 한 번 더 찾으세요.」(조건 추가) |

solve_procedure[2] 후보: step 「인용부호 안 대사가 근거로 잡히면, 선지가 발화 사실(누가 ~라고 말했다)을 묻는지 실제 사건을 묻는지 먼저 가른다. 발화 사실이면 대사가 근거다. 실제 사건이면 같은 사실을 말하는 서술 문장을 한 번 더 찾는다」 · on_fail 「서술이 없으면 상대 인물의 반응·이어진 행동으로 판정하고, 그래도 없을 때만 보류한다」.

### 2-2. 2021#34 (**PARTIAL — 전이 규칙만**) — 분석 v4

이 문항의 정답(⑤)과 해설 추론은 성립한다. 고칠 것은 「내용보다 부호」 일반화와 무조건 뒤집기뿐이다. 답 판정 문안은 바꾸지 않는다.

| cue | 후보 |
|---|---|
| c1 intro | 「조건절 빈칸입니다. 표지 하나와 정의 문장 하나를 맞대어 보는 문항이에요.」 |
| c2 strategy | 「주절의 not 을 표시하세요. 그다음 이 not 이 '그렇다고 결론짓지 말라'처럼 판단을 미루는 말인지, '그렇지 않다'고 단정하는 말인지 확인합니다.」 |
| c5 | 「여기 주절은 판단을 미루는 부정이에요. 그래서 성공 조건이 빠진 상태가 빈칸에 와야 하죠.」(「조건도 뒤집혀야」의 범위 한정) |
| c13 wrapup | 「정리합니다. 주절의 부정어를 표시하고, 판단 보류인지 단정인지 범위를 확인한 뒤, 지문의 성공 조건이 빠진 상태가 왜 그 판단을 낳는지 근거로 연결해 고릅니다.」 |

분석 후보: design_intent 의 「내용이 아니라 문장 부호의 셈」 → 「주절의 판단 보류(not conclude)와 지문의 성공 조건을 의미로 맞대는 문항」. solve_procedure[2] step 「주절이 판단 보류형(ought not to conclude)이면, 성공 조건이 빠진 상태를 빈칸 후보로 적는다. 주절이 단정형 부정이면 조건을 기계적으로 뒤집지 않고 지문의 조건 관계를 다시 확인한다」. [3] 은 유지하되 「뒤집기를 안 한 것」 → 「성공 조건을 그대로 담아 판단 보류와 맞지 않는 것」.

### 2-3. M2706#29 (CONFIRMED) — 분석 v5

| cue | 후보 |
|---|---|
| c10 | 「왓을 보면 왼쪽 명사를 짚고, 그 명사가 뒤 절의 빈자리를 채우는 선행사인지 확인하세요. 기브 뎀 왓처럼 목적어일 뿐이면 왓이 맞아요.」 |
| c12 wrapup | 「정리할게요. 왼쪽 명사를 표시하고, 그 명사가 뒤 절의 빈 주어나 목적어로 들어가는지 확인합니다. 들어가면 선행사이니 왓 대신 [which] 나 [that] 이에요.」(which·that 은 en-US segment) |

분석 후보: answer_locus.reasoning 「앞에 명사를 둘 수 없다」 → 「앞 명사 styles 가 뒤 절의 빈 주어 자리를 채우는 선행사이므로 what 을 둘 수 없다」. solve_procedure[1] step 「what 밑줄은 바로 왼쪽 명사가 **뒤 절 빈자리를 채우는 선행사인지** 본다. 동사의 목적어(give them what)로 끝난 명사면 what 이 맞다」.

### 2-4. M2509#34 (CONFIRMED) — 분석 v4

| cue | 후보 |
|---|---|
| c2 | 「여섯 번째 문장 첫머리 [But] 에 표시하세요. 이 역접이 뒤집는 범위가 어디까지인지 먼저 정합니다. 여기서는 루소의 바람을 말한 다섯 번째 문장 하나예요.」 |
| c10 | 「소설 제목에 끌리기 쉽죠. 그 낱말이 뒤집히는 범위인 다섯 번째 문장에 속하는지 확인하고, 그 범위의 주장을 그대로 담은 선지만 의심하세요.」 |
| c12 wrapup | 「정리합니다. 역접을 표시하고, 뒤집히는 범위를 정하고, 빈칸 뒤 풀이와 같은 관계를 말하는 선지를 고릅니다. 낱말이 겹친다는 이유만으로 지우지 않아요.」 |

분석 후보: solve_procedure[0] step 「빈칸 문장이 But · However 로 시작하면 표지에 표시하고, 그 역접이 뒤집는 **양보 범위**(여기서는 5문장)를 정한다. 그 범위의 주장을 담은 선지만 의심한다 — 낱말 겹침만으로 지우지 않는다」 · on_fail 「범위가 안 정해지면 But 뒤 문장이 앞 진술을 뒤집는지, 앞 진술의 한계를 말하는지부터 가른다」. design_intent 유지.

- 2-1~2-4 의 c 번호 cue 낭독 서수(「다섯 번째 문장」 등)는 교체 시 3 의 가드를 함께 통과해야 한다.

---

## 3. 서수 155 — 자동 교정 가능 여부 · 후보 생성기

### 3-1. 재확인 결과(dry-run, main 7f11a8538 lecture-data · skeleton-data)

```
node scripts/csat/lecture-ordinal-fix.mjs --out <scratchpad>/ordinal-fix
→ {"anchorCues":2590,"auto":147,"staleReview":4,"manual":12,"manualReasons":{"split-suspect":12}}
```

- **자동 후보 147 cue**(전부 장문 43~45). 규칙: anchor `sentence:k` 의 「여기 N 문장」이 하나뿐이고 N = k(낭독이 1 작음), 문지도 범위 안, 분할 의심 문항 아님 → 낭독 수사만 k+1 로. target 불변.
  - F4b 의 B 143 과 **4건 차이**. 이 스캐너는 「여기」형만 보며 수사 1~49 를 쓴다. F4b 원장이 cue id 로 남아 있지 않아 어느 4건이 갈리는지 **NOT_VERIFIED** — 적용 전 cue id 대조로 맞춘다. F4b 판정 보류 2건(2017#45 c12, M2706#45 c11)은 자동 후보에 들어 있다 → 수동 확인 목록으로 옮겨 적용.
  - **설명 문장 재검토 4**(서수만 고치면 내용이 낡은 채 남음): 2025#43 c5 · M2606#43 c6 · M2706#43 c2 · M2706#44 c6.
- **수동 12** = F4b A 12 와 정확히 일치: 2015#34 c6·c11 · 2019#28 c5·c6·c11 · M2106#27 c5·c6·c11 · M2109#28 c5·c6·c11·c12. 2015#34·2019#28·M2109#28 은 겉보기 차이가 −1 이지만 원인이 문지도 분할(합쳐진 막대·목록 번호)이고, M2106#27 은 차이 −2(조각 막대 「Operation 1.」)다. 수사 +1 로 고치면 분할이 고쳐질 때 다시 어긋난다 → **수동 대조 필요 확인**(분할 규칙 결정이 먼저).
- 결론: **B 는 기계 교정 가능**(단 147 중 보류 2 + 재검토 4 는 사람/Codex 확인), **A 12 는 수동**(문장 분할 결정 선행).

### 3-2. 생성기 `scripts/csat/lecture-ordinal-fix.mjs`

- 입력: `--data`(기본 main lecture-data) · `--skeleton`(문장 수). 출력: `--out` 폴더의 `ordinal-fix.candidates.json`(cue 별 before/after·segments_after) · `ordinal-fix.manual.json` · `ordinal-fix.summary.md`. `--out` 없거나 lecture-data 안이면 exit 2. 원본은 읽기만.
- 「첫 문장」 → 「두 번째 문장」 처리(「두 문장」 개수 오독 방지).
- 테스트 `scripts/csat/__tests__/lecture-ordinal-fix.test.mjs` — `node --test` **9/9 PASS**(수사 1~49 왕복, 「여기」 없는 서수 제외, 수동 분기 4종, 원본 불변, --out 거부).

### 3-3. 회귀 가드 설계안(미구현 — owner `csat-lecture-disclosure`)

1. `apps/web/src/lib/csat/lecture/__tests__/lecture-pointing.test.ts`: 모든 lecture-data 에 `validateLecture` 의 `pointing` 규칙만 적용.
2. **선행 결함**: `validate.ts:97-103` `ORDINAL` 이 1~13 까지만 있다 → 장문 「열네 번째」 이상은 지금 `pointing` 이 아예 못 센다. `focus.ts` 의 `ORDINALS`(1~49)를 export 해 같은 표를 쓰게 한다(두 벌 금지).
3. 원장 `PENDING`: 자동 147 + 수동 12 cue id 로 시작, 양방향(새 불일치 = 실패, 고쳐졌는데 원장에 남음 = 실패).
4. `remap-lecture-sentences.mts` 류 `--write` 전에 `validateLecture` 통과 필수.
5. 「여기」 없는 서수는 가드 밖(오탐 17).

---

## 4. 승인된 수정 경로

| # | 단계 | owner | 도구 | 통과 조건 |
|---|---|---|---|---|
| 0 | 후보 확정(이 문서·생성기 산출) | 총괄 | 본 문서 · `lecture-ordinal-fix.mjs --out` | 사용자가 후보 범위 승인 |
| 1 | 코드 선행(정답 집합·ORDINAL 1~49·R3'/R7 일반화) | csat-lecture-disclosure (+미지정 화면 owner) | 단위 테스트 · tsc | 1-4·3-3 테스트 PASS |
| 2 | 강의 JSON 수정 — 기능 브랜치에서만, version +1 · `withFocus` 재계산 | csat-lecture-disclosure | 후보 JSON 을 적용하는 일회 스크립트(cue id·before 일치 확인 후 교체) | before 불일치 0 |
| 3 | 검사 | 같은 owner | `validate.ts` `validateLecture`(drain-import · final-checks 경로) + `lecture-pointing` 가드 | issue 0(pointing·focus·eliminate-answer 포함) |
| 4 | sidecar · disclosure 재생성 | csat-lecture-disclosure | sidecar 재판정(독립 2인+3자) → `lecture-disclosure-build.mjs <sidecar> ` → `--check` | digest·version·cues 결속 일치 |
| 5 | 공개 경계 재검증 | 같은 owner | 1-3 규칙 · `preStopRisk` 확인 | 2015#25 stopBefore 기대값 · 경계 앞 정답 낭독 0 |
| 6 | 분석 v6(2015#25 · 4건) | 분석 owner(총괄 배정) | SQL **작성만** → 사용자 승인 → `apply_migration`/승인형 러너 | 사용자 대화 승인 |
| 7 | 독립 감수 | Codex(AI-Control TASK 등록: 작업 owner 와 분리) 또는 사람 | 강의·분석 정합 · 반례(F4a) 재적용 | 다른 owner 의 complete |
| 8 | 발행 | 총괄 | 로컬 통합(lock→merge --no-ff 검증 SHA) · 분석 status published | 3–7 증거가 같은 commit |

승인 필요: 6(DB 쓰기), 0(후보 범위), 2015#25 공식 원문 확보 여부.
