# R5 중심 의미 — 첫 공급 최소 8문항 사람 검토 패킷

> **상태: 검토 준비만.** 이 문서는 승인이 아니다. 아래 「제안 Gold」는 AI 가 만든 값이고, 사람의 Gold(B) · 권리(C) · 출시 결정은 **모두 미기록 · 미승인**이다. CONTENT_RELEASE_APPROVED = false · 실제 공급 = 없음 · 학습 효과 = 미검증.

## 0. 입력(이 revision 만 검토 대상)

- 파일: `apps/web/src/lib/knowledge/authored/r5-central-meaning.v1.json` — **로컬 main(`D:/workspace/Vocaflow-main-serving`, HEAD `d726c5d07`) 의 바이트**
- 내부 revision: `r5-central-meaning.v3` · 파일 SHA-256 `682dfbd97fa8c2317315f3458d11d24033364afee980d78331c03da5563e2846` · 34093 bytes
- TASK `r.central_meaning` (task_key `authored-central-meaning`) · Workspace `ws.central-meaning` · 문장 번호 규약 `1-based`
- ⚠️ 작업 브랜치(feat/vocaflow-final-product)의 같은 경로는 옛 **v2**(SHA `78ddc60e5f10dde35c6838b3df211f9a566ddd076bf15e6a7b8ee0b203505d2f`)다 — 그 바이트로 검토 · 승인하지 않는다. SHA 가 위와 다르면 이 패킷은 무효이며 다시 만든다.
- 재사용한 선택 근거: `docs/final/review/FINAL_CONTENT_DECISION_MANIFEST_20261022.json`(main) · `Vocaflow-AI-Control/verification/reviews/T-0045-next-product-20261022/first-r5-review-package.json`(Codex 최소 8 선택)
- 해시 규약(manifest 그대로): file_sha256: exact bytes. body/gold_js_canonical_sha256: UTF-8 JSON with object keys recursively sorted, array order preserved. NOT PostgreSQL jsonb revision/gold hashes. DB revision remains NOT_REGISTERED until actual registration.

## 1. 구성 — 교수 2 · 평가 6 · 서로 다른 지문 8

흐름: ① 초기 확인 → ② 바로잡기(원리 설명 · 안내 연습) → ③ 적용(전이) → ④ 새 확인. 실행기 화면의 문장 · 선택지 번호는 1부터(① ~ ⑤), 원자료 JSON 의 값은 0부터(raw)다 — 아래 모든 번호는 둘을 함께 적는다.

| # | ID | role | 단계 | 지문 그룹 | 원자료 위치 | 사람 Gold | 권리 작업 | 출시 범위 | body SHA | gold SHA |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `r5-cm-teach-1` | model_explanation | ② 바로잡기 — 원리 설명 | `r5cm-t1` | `/items/0` | 해당 없음(교수 자료) | store · display · transmit | public | `68dc5d1ed235…` | `d4d407199b4a…` |
| 2 | `r5-cm-guided-1` | guided_practice | ② 바로잡기 — 안내 연습 | `r5cm-p1` | `/items/1` | 해당 없음(교수 자료) | store · display · transmit | public | `370d823765c1…` | `fd779eb465c8…` |
| 3 | `r5-cm-ind-1` | independent_check | ① 초기 확인(혼자 확인) | `r5cm-i1` | `/items/3` | 필요(평가) | store · display · transmit · assess | public · assessment | `66a0e4c67768…` | `ee52e461aec4…` |
| 4 | `r5-cm-ind-2` | independent_check | ① 초기 확인(혼자 확인) | `r5cm-i2` | `/items/4` | 필요(평가) | store · display · transmit · assess | public · assessment | `4c0bc5ffcbda…` | `548575cb5ad0…` |
| 5 | `r5-cm-transfer-1` | transfer | ③ 적용(전이) | `r5cm-x1` | `/items/5` | 필요(평가) | store · display · transmit · assess | public · assessment | `b19885df5942…` | `1a0800018bc6…` |
| 6 | `r5-cm-transfer-2` | transfer | ③ 적용(전이) | `r5cm-x2` | `/items/6` | 필요(평가) | store · display · transmit · assess | public · assessment | `a57379d8818a…` | `83bc5d57a477…` |
| 7 | `r5-cm-ind-3` | independent_check | ④ 새 확인(혼자 확인 · 다른 지문) | `r5cm-i3` | `/items/9` | 필요(평가) | store · display · transmit · assess | public · assessment | `c542bcb6cce1…` | `5a313b22ec51…` |
| 8 | `r5-cm-ind-4` | independent_check | ④ 새 확인(혼자 확인 · 다른 지문) | `r5cm-i4` | `/items/10` | 필요(평가) | store · display · transmit · assess | public · assessment | `40ad4c5e7d5d…` | `1964dbf57a9f…` |

- 처음 8 승인에 **포함하지 않음**: `r5-cm-delayed-1`(원자료 `/items/7`, 다른 날 확인 · 선택) — 간격 · 도구 기준이 정해지지 않아 별도 검토가 필요하다. 나머지 155 문항 전체 승인을 요구하지 않는다.

## 2. 결속 대조(자동 · 읽기 전용)

8개 모두 원자료 body/gold 의 JS canonical 해시 = manifest = Codex 패키지, 원자료 위치 · role 일치, 정답 · 문장 번호가 범위 안: **통과**. 이 대조는 바이트 결속 확인이지 정답 타당성의 사람 검수가 아니다. JS canonical 해시는 PostgreSQL jsonb revision/gold 해시와 같은 알고리즘이 아니다 — DB revision 은 실제 등록 전까지 NOT_REGISTERED.

| ID | manifest body | manifest gold | 패키지 body | 패키지 gold | 위치 | role | 정답 범위 | 문장 번호 범위 |
|---|---|---|---|---|---|---|---|---|
| `r5-cm-teach-1` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `r5-cm-guided-1` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `r5-cm-ind-1` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `r5-cm-ind-2` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `r5-cm-transfer-1` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `r5-cm-transfer-2` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `r5-cm-ind-3` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `r5-cm-ind-4` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## 3. 원천 · 권리 · AI 검토 범위(원자료 provenance 그대로 — 권리 확인 사실이 아니다)

- author: Claude Opus 5.5 (Claude Code agent, Vocaflow FINAL session)
- method: Vocaflow 자체 창작 — 기출 지문을 옮기거나 고쳐 쓰지 않았다. 평가원 문항의 '형식'(요지·제목·주제 5지선다)만 따랐다.
- derivedFrom: [] · createdAt: 2026-10-18
- humanGold: pending — 사람 Gold 확정 전(검수 패킷 docs/final/review/r5-authored-gold-packet.md)
- rights: pending — 사람 원저작 확인 전(같은 패킷)
- aiReviewScope: `r5-cm-guided-1`, `r5-cm-ind-2`, `r5-cm-ind-3`, `r5-cm-transfer-1`, `r5-cm-delayed-1` — 이 중 처음 8 에 든 것: `r5-cm-guided-1`, `r5-cm-ind-2`, `r5-cm-ind-3`, `r5-cm-transfer-1`. 나머지 처음 8(`r5-cm-teach-1`, `r5-cm-ind-1`, `r5-cm-transfer-2`, `r5-cm-ind-4`)은 현재 AI 검토 범위 밖이다.
- revisionNote(원문): v2(2026-10-18): 정답 선택지 3건 바꿔 쓰기(ind-2 · transfer-2 · delayed-1, 맹검 C 단서 노출 지적) · transfer-1 약한 오답 2건 강화. 사람 Gold 전. · 오답 근거 감사 반영(guided-1 요지 과장 수정 · guided-2 오답① 유형 · 설명 문구 4건) · delayed-1 정답 재표현. · FI-005(#297): ind-1 5번 문장을 원논문(성인 · 응답 수 증가 · 독창성 차이 비유의)에 맞게 수정 — 아동 · 독창성 서술 제거. · v3 candidate 2026-10-21 Codex: independent AI reviews c0b6f657/fde8422c identified logical/distractor defects. Correct selected five items; remove untraced statistics, global legal assertion and invented office-worker experiment. ind-3 is an explicitly hypothetical baker example about selecting task-relevant memory, not a claim that detailed memory prevents recognition. Only these five are submitted for current AI review; all other items remain outside this review scope. · candidate R2: independent Claude/Codex both found stale GPS distractor explanation; remove it. Accept delayed sentence 3 as a restated claim and probe its explicitly hypothetical example at sentence 4. Remove baker no-longer presupposition and use example relation for its concrete case. Earlier candidate and both dissenting reviews preserved.

「자체 창작 · derivedFrom 없음」은 작성자 진술이다. 원저작 확인 · 권리(C) 결정이 아니며, 이 문서는 그것을 사실로 올리지 않는다.

## 4. 설치(A)와 실제 등록 · 결정 · 공급의 구별

- A(스키마 · 정책 함수 설치): manifest 기록 `APPLIED_VERIFIED_READ_ONLY` · migration `20261021175340` — Schema/policy functions and two rationale strings applied by separately recorded direct approval; content approvals and actual supply not included
- 최신 설치 wrapper 는 기술적으로 `human OR ai OR source_policy` 경로를 허용한다. 그것은 설치 사실일 뿐이다 — FINAL 이 그 AI · source_policy 경로를 쓰기로 정했다는 기록, 또는 이 8 문항의 사람 Gold · 권리 승인 경위는 **확인되지 않았다**. 어느 대체 분기로도 등록 · 결정 · 출시 · 공급 쓰기를 하지 않았다.
- DB 관측(과거 증거 · 관측 시각 `2026-10-21T18:21:08.26823Z` · 실시간 조회 아님): authored_items 0 · human_decisions 0 · ai_decisions 0 · qualifications 0 · release_approvals 0 · deliveries 0. 이 패킷 작성은 DB 를 읽거나 쓰지 않았다.

## 5. 사람 결정 요약 기록란(세트 단위 · manifest decision_form 과 같은 칸)

| 칸 | 값 |
|---|---|
| file_sha256 | (결정자가 위 `682dfbd97fa8c2317315f3458d11d24033364afee980d78331c03da5563e2846` 와 같은지 확인 후 기입) |
| item_ids | (승인할 ID 를 사람이 고른다 — 비어 있음) |
| gold.decision · reviewer · notes | PENDING · · |
| rights.decision · reviewer · basis · operations | PENDING · · · |
| release.decision · scopes | PENDING · |
| approved_db_write_scope | NONE |

## 6. 문항별 전문

### 1. `r5-cm-teach-1` — ② 바로잡기 — 원리 설명

- 역할 `model_explanation` · 지문 그룹 `r5cm-t1` · 원자료 위치 `/items/0`(raw index 0)
- body JS canonical SHA-256 `68dc5d1ed235452677d01eb49be550693b85c81f30093376b9764d9afda4e91c`
- gold JS canonical SHA-256 `d4d407199b4a89c8da07786a43e6dd2acc227d1a830dc64dcfdb01f917036198`
- 권리 작업(manifest): store · display · transmit · 출시 범위(manifest): public · 사람 Gold 필요: 아니오 — 평가 Gold 가 아니라 교수 자료 내용 검토

**지문** (표시 번호 = 1부터 · 괄호 안 = 원값 raw index)

1. (raw 0) Many learners treat errors during practice as signs that they are not yet ready to perform.
2. (raw 1) They slow down, choose only easy tasks, and feel relieved when nothing goes wrong.
3. (raw 2) Yet a practice session without mistakes usually teaches very little.
4. (raw 3) In fact, errors made while practicing are among the most useful information a learner can get.
5. (raw 4) Each mistake shows exactly where current skill ends, so attention can be directed to that point instead of being spread over what is already known.
6. (raw 5) Researchers who study musicians, for example, find that the best performers spend most of their practice time on the passages they still play poorly.
7. (raw 6) In other words, a mistake in practice is not a failure but a map of what to learn next.

**발문** 다음 글의 요지로 가장 적절한 것은?

**선택지** (표시 ①–⑤ · 괄호 안 = 원값 raw index)

- ① (raw 0) 연습 중의 실수는 다음에 배울 지점을 알려 주는 유용한 정보이다.
- ② (raw 1) 실수를 줄이려면 쉬운 과제부터 차근차근 연습해야 한다.
- ③ (raw 2) 뛰어난 음악가는 연습 시간의 대부분을 어려운 부분에 쓴다.
- ④ (raw 3) 연습의 양보다 실전 경험이 실력 향상에 더 중요하다.
- ⑤ (raw 4) 학습자는 실수를 했을 때 감정을 잘 다스려야 한다.

**원리 설명(body.teach — 원문 그대로)**

```json
[
  {
    "step": "흔한 생각부터 찾기",
    "text": "첫 두 문장은 많은 학습자가 하는 생각(실수 = 준비 부족)을 소개한다. 'Many learners ...'처럼 '많은 사람이 ~한다'로 시작하는 문장은 필자가 뒤집으려는 생각일 때가 많다.",
    "sentences": [
      0,
      1
    ]
  },
  {
    "step": "방향 전환 신호",
    "text": "'Yet'(3번)에서 글의 방향이 바뀐다. 이 문장은 아직 이유를 대지 않은 예고다 — 주장 자체는 다음 문장에서 더 분명해진다.",
    "sentences": [
      2
    ]
  },
  {
    "step": "주장 문장",
    "text": "'In fact'(4번) 뒤에서 필자가 가장 말하고 싶은 판단이 나온다: 연습 중 실수는 가장 쓸모 있는 정보다. 이 문장이 다른 문장들의 '이유가 되는 대상'이다.",
    "sentences": [
      3
    ]
  },
  {
    "step": "떠받치는 문장 가르기",
    "text": "5번은 왜 쓸모 있는지 이유를 대고, 6번은 음악가 연구로 예를 든다. 둘 다 4번 주장을 받쳐 준다 — 주장이 아니라 근거다.",
    "sentences": [
      4,
      5
    ]
  },
  {
    "step": "다시 말하기로 확인",
    "text": "'In other words'(7번)는 주장을 다른 말로 다시 한다. 주장 문장과 다시 말하기 문장이 같은 뜻이면 중심을 제대로 잡은 것이다.",
    "sentences": [
      6
    ]
  },
  {
    "step": "정답 설계",
    "text": "정답 ①은 4번(주장)과 7번(다시 말하기)의 공통 의미를 우리말로 바꿔 쓴 것이다. 출제자는 정답을 본문 표현 그대로 쓰지 않고 '다음에 배울 지점'처럼 바꿔 쓴다.",
    "sentences": [
      3,
      6
    ]
  },
  {
    "step": "오답 설계",
    "text": "② 필자가 반박하는 생각(2번)을 그대로 옮겼다. ③ 예시(6번) 하나만 옮긴 지나치게 좁은 선택지다. ④⑤ 글에 없는 내용이지만 주제와 가까워 그럴듯해 보이게 만들었다.",
    "sentences": [
      0,
      1,
      5
    ]
  }
]
```

**제안 Gold (AI 작성 · 사람 미확정)**

- 정답: ① (raw 0) — 연습 중의 실수는 다음에 배울 지점을 알려 주는 유용한 정보이다.
- 요지(gist): 연습 중 실수는 실패가 아니라 다음에 배울 곳을 보여 주는 정보다.
- 주장 문장(claim): 4번(raw 3) · 주장 재진술: 7번(raw 6)
- 뒷받침(support): 5번(raw 4), 6번(raw 5) · 뒷받침 이견(supportDisputed): 3번(raw 2) · 반대 견해(opposed): 1번(raw 0), 2번(raw 1)
- 관계 확인(relationProbe): 6번(raw 5) = `example`

**오답 설계 · 피드백 문구(gold.distractors — 원문 그대로)**

- ② (raw 1) `opposed_view` — 필자가 반박하는 흔한 생각(2번)을 정답처럼 옮겼다.
- ③ (raw 2) `too_narrow` — 예시(6번) 하나만 담은 세부 내용이다.
- ④ (raw 3) `off_text` — 실전 경험은 글에 나오지 않는다.
- ⑤ (raw 4) `off_text` — 감정 조절은 글에 나오지 않는다.

**사람 결정 기록란 (미기록 · 미승인 — AI 가 채우지 않는다)**

| 항목 | 결정(선택 · 거절 · 보류) | 결정자 | 날짜 | 근거 · 메모 |
|---|---|---|---|---|
| 교수 자료 내용 검토 | 미기록 | | | |
| 권리(C) — store · display · transmit | 미기록 | | | |
| 출시 — public | 미기록 | | | |


---

### 2. `r5-cm-guided-1` — ② 바로잡기 — 안내 연습

- 역할 `guided_practice` · 지문 그룹 `r5cm-p1` · 원자료 위치 `/items/1`(raw index 1)
- body JS canonical SHA-256 `370d823765c1716e937633d3654249795c42255ae5f59bf3390ca333e6178963`
- gold JS canonical SHA-256 `fd779eb465c83a3eb78f2fed06fe708e9e3ea5bb80315921f78acdd28ac92a18`
- 권리 작업(manifest): store · display · transmit · 출시 범위(manifest): public · 사람 Gold 필요: 아니오 — 평가 Gold 가 아니라 교수 자료 내용 검토

**지문** (표시 번호 = 1부터 · 괄호 안 = 원값 raw index)

1. (raw 0) On a hot summer afternoon, the air above a parking lot can be several degrees warmer than the air in a nearby park.
2. (raw 1) This difference is not simply a matter of shade.
3. (raw 2) Trees also release water vapor through their leaves, and this process uses heat from the surrounding air.
4. (raw 3) This cooling can therefore come from the use of heat to evaporate water as well as from blocked sunlight.
5. (raw 4) For this reason, planting trees can be a useful way for cities to cool outdoor spaces.
6. (raw 5) Air conditioners, by contrast, cool the inside of buildings while pushing even more heat into the streets.
7. (raw 6) A city that wants cooler summers should therefore think of its trees as part of its infrastructure, not as decoration.

**발문** 다음 글의 요지로 가장 적절한 것은?

**선택지** (표시 ①–⑤ · 괄호 안 = 원값 raw index)

- ① (raw 0) 도시의 주차장은 공원보다 기온이 높다.
- ② (raw 1) 나뭇잎에서 물이 증발할 때 주위 공기의 열이 쓰인다.
- ③ (raw 2) 도시의 나무는 도심 공간의 열을 줄이는 기반 시설로 다룰 필요가 있다.
- ④ (raw 3) 에어컨 사용을 줄이면 도시 전체의 에너지를 아낄 수 있다.
- ⑤ (raw 4) 도시의 아름다움을 위해 나무를 장식으로 활용해야 한다.

**안내 연습 힌트(body.hints — 원문 그대로)**

```json
[
  "For this reason이 앞의 설명을 어떤 판단으로 잇는지 살펴보세요.",
  "증발과 그늘은 냉각 방법이 유용하다는 판단을 뒷받침하는 기제예요.",
  "마지막 문장이 앞의 판단을 도시의 선택으로 다시 말하는지 확인하세요."
]
```

**제안 Gold (AI 작성 · 사람 미확정)**

- 정답: ③ (raw 2) — 도시의 나무는 도심 공간의 열을 줄이는 기반 시설로 다룰 필요가 있다.
- 요지(gist): 도시의 나무는 그늘과 증발에 의한 냉각을 제공하므로 장식 이상의 기반 시설로 볼 필요가 있다.
- 주장 문장(claim): 5번(raw 4) · 주장 재진술: 7번(raw 6)
- 뒷받침(support): 3번(raw 2), 4번(raw 3) · 뒷받침 이견(supportDisputed): 1번(raw 0), 2번(raw 1), 6번(raw 5) · 반대 견해(opposed): 없음
- 관계 확인(relationProbe): 3번(raw 2) = `reason`

**오답 설계 · 피드백 문구(gold.distractors — 원문 그대로)**

- ① (raw 0) `too_narrow` — 도입부의 관찰(1번)만 옮겼다.
- ② (raw 1) `too_narrow` — 증발에 열이 쓰인다는 설명은 나무의 냉각 기능을 뒷받침하는 기제 하나이며, 도시가 나무를 어떻게 다룰지에 대한 중심 판단 전체가 아니다.
- ④ (raw 3) `distorted` — 6번(에어컨)의 소재를 가져와 글에 없는 에너지 절약 주장으로 비약했다.
- ⑤ (raw 4) `reversed` — 필자는 나무를 장식이 아니라 기반 시설로 보라고 한다(7번).

**사람 결정 기록란 (미기록 · 미승인 — AI 가 채우지 않는다)**

| 항목 | 결정(선택 · 거절 · 보류) | 결정자 | 날짜 | 근거 · 메모 |
|---|---|---|---|---|
| 교수 자료 내용 검토 | 미기록 | | | |
| 권리(C) — store · display · transmit | 미기록 | | | |
| 출시 — public | 미기록 | | | |


---

### 3. `r5-cm-ind-1` — ① 초기 확인(혼자 확인)

- 역할 `independent_check` · 지문 그룹 `r5cm-i1` · 원자료 위치 `/items/3`(raw index 3)
- body JS canonical SHA-256 `66a0e4c6776869b433673871302db05e24e17841225d13139d6cb279131eb8f3`
- gold JS canonical SHA-256 `ee52e461aec4926c657d30a2ecc5d44b205855a0280464d079b12164fac89946`
- 권리 작업(manifest): store · display · transmit · assess · 출시 범위(manifest): public · assessment · 사람 Gold 필요: 예(평가 문항)

**지문** (표시 번호 = 1부터 · 괄호 안 = 원값 raw index)

1. (raw 0) Parents often rush to fill every empty moment of a child's day with activities.
2. (raw 1) The intention is good, but it may take away something valuable.
3. (raw 2) Periods of boredom push children to invent their own games, stories, and projects.
4. (raw 3) When nothing is provided, the mind starts to look for something to do, and that search is where creativity often begins.
5. (raw 4) In one study, adults who first spent fifteen minutes copying numbers from a list later listed more uses for a paper cup than those who had not.
6. (raw 5) A certain amount of unplanned, even dull, time is therefore something children need rather than something to be avoided.

**발문** 다음 글의 요지로 가장 적절한 것은?

**선택지** (표시 ①–⑤ · 괄호 안 = 원값 raw index)

- ① (raw 0) 아이들의 하루를 다양한 활동으로 채워 주어야 한다.
- ② (raw 1) 지루한 반복 작업은 아이들의 집중력을 높인다.
- ③ (raw 2) 아이들에게는 계획되지 않은 지루한 시간이 어느 정도 필요하다.
- ④ (raw 3) 창의성은 타고난 재능보다 노력으로 길러진다.
- ⑤ (raw 4) 부모는 아이와 함께 놀이를 만들어야 한다.

**제안 Gold (AI 작성 · 사람 미확정)**

- 정답: ③ (raw 2) — 아이들에게는 계획되지 않은 지루한 시간이 어느 정도 필요하다.
- 요지(gist): 아이에게는 계획되지 않은 지루한 시간이 어느 정도 필요하다.
- 주장 문장(claim): 6번(raw 5) · 주장 재진술: 없음
- 뒷받침(support): 3번(raw 2), 4번(raw 3), 5번(raw 4) · 뒷받침 이견(supportDisputed): 2번(raw 1) · 반대 견해(opposed): 1번(raw 0)
- 관계 확인(relationProbe): 5번(raw 4) = `example`

**오답 설계 · 피드백 문구(gold.distractors — 원문 그대로)**

- ① (raw 0) `opposed_view` — 필자가 문제 삼는 부모의 행동(1번)을 그대로 권했다.
- ② (raw 1) `distorted` — 실험(5번)의 결과(쓰임새를 더 많이 떠올림)를 집중력이 높아진 것으로 바꿨다.
- ④ (raw 3) `off_text` — 재능과 노력의 비교는 글에 없다.
- ⑤ (raw 4) `off_text` — 부모가 놀이를 만들어 주라는 말은 없다 — 오히려 아이가 스스로 만든다(3번).

**사람 결정 기록란 (미기록 · 미승인 — AI 가 채우지 않는다)**

| 항목 | 결정(선택 · 거절 · 보류) | 결정자 | 날짜 | 근거 · 메모 |
|---|---|---|---|---|
| Gold(B) — 정답 · 근거 문장 타당성 | 미기록 | | | |
| 권리(C) — store · display · transmit · assess | 미기록 | | | |
| 출시 — public · assessment | 미기록 | | | |


---

### 4. `r5-cm-ind-2` — ① 초기 확인(혼자 확인)

- 역할 `independent_check` · 지문 그룹 `r5cm-i2` · 원자료 위치 `/items/4`(raw index 4)
- body JS canonical SHA-256 `4c0bc5ffcbda9310620faf3049ed3ac0d02081bf466d7ae9777e22e950912227`
- gold JS canonical SHA-256 `548575cb5ad089792b5de6aa3f5a6bc6e4430cdc6f8cab84abbc1b8ed297bb87`
- 권리 작업(manifest): store · display · transmit · assess · 출시 범위(manifest): public · assessment · 사람 Gold 필요: 예(평가 문항)

**지문** (표시 번호 = 1부터 · 괄호 안 = 원값 raw index)

1. (raw 0) Relying on turn-by-turn directions may be weakening our ability to understand the places we live in.
2. (raw 1) When a device tells us where to turn, we no longer need to build a mental picture of how streets connect.
3. (raw 2) Following these instructions can leave a driver with less knowledge of how the parts of a route fit together.
4. (raw 3) Some people argue that this hardly matters, since the device is always available.
5. (raw 4) But devices fail, batteries die, and signals disappear, and a person with no sense of direction is then truly lost.
6. (raw 5) Moreover, finding our own way requires us to attend to landmarks and their connections.

**발문** 다음 글의 요지로 가장 적절한 것은?

**선택지** (표시 ①–⑤ · 괄호 안 = 원값 raw index)

- ① (raw 0) 길 안내 기기는 운전자의 안전을 높여 준다.
- ② (raw 1) 스스로 길을 찾지 않으면 주변 공간을 이해하는 힘이 줄어들 수 있다.
- ③ (raw 2) 배터리와 신호 문제 때문에 길 안내 기기는 믿을 수 없다.
- ④ (raw 3) 기억력을 높이려면 지도를 직접 그려 보아야 한다.
- ⑤ (raw 4) 기기는 늘 쓸 수 있으므로 방향 감각은 중요하지 않다.

**제안 Gold (AI 작성 · 사람 미확정)**

- 정답: ② (raw 1) — 스스로 길을 찾지 않으면 주변 공간을 이해하는 힘이 줄어들 수 있다.
- 요지(gist): 길 안내 기기에 기대면 우리가 사는 곳을 이해하는 능력이 약해질 수 있다.
- 주장 문장(claim): 1번(raw 0) · 주장 재진술: 없음
- 뒷받침(support): 2번(raw 1), 3번(raw 2), 5번(raw 4), 6번(raw 5) · 뒷받침 이견(supportDisputed): 없음 · 반대 견해(opposed): 4번(raw 3)
- 관계 확인(relationProbe): 4번(raw 3) = `opposed`

**오답 설계 · 피드백 문구(gold.distractors — 원문 그대로)**

- ① (raw 0) `off_text` — 안전은 글에 나오지 않는다.
- ③ (raw 2) `too_narrow` — 반론을 반박하는 근거 하나(5번)만 옮기고 ‘믿을 수 없다’로 단정해 과장했다.
- ④ (raw 3) `off_text` — 글은 지도를 직접 그리라는 방법이나 일반 기억력 향상이라는 목표를 제시하지 않는다. 길 안내 의존과 공간 이해에 관한 논의를 글에 없는 처방으로 바꿨다.
- ⑤ (raw 4) `opposed_view` — 필자가 반박하는 생각(4번)이다.

**사람 결정 기록란 (미기록 · 미승인 — AI 가 채우지 않는다)**

| 항목 | 결정(선택 · 거절 · 보류) | 결정자 | 날짜 | 근거 · 메모 |
|---|---|---|---|---|
| Gold(B) — 정답 · 근거 문장 타당성 | 미기록 | | | |
| 권리(C) — store · display · transmit · assess | 미기록 | | | |
| 출시 — public · assessment | 미기록 | | | |


---

### 5. `r5-cm-transfer-1` — ③ 적용(전이)

- 역할 `transfer` · 지문 그룹 `r5cm-x1` · 원자료 위치 `/items/5`(raw index 5)
- body JS canonical SHA-256 `b19885df5942c5a6521754e9d87f8040ff204be84f87f6385ff79075beddb67c`
- gold JS canonical SHA-256 `1a0800018bc69ca3455343b1f7c4351dbd5eb46c8d9fa83569055aecdf2a8662`
- 권리 작업(manifest): store · display · transmit · assess · 출시 범위(manifest): public · assessment · 사람 Gold 필요: 예(평가 문항)

**지문** (표시 번호 = 1부터 · 괄호 안 = 원값 raw index)

1. (raw 0) Imagine a group of shoppers who trust a drink more after seeing the word "natural" on its label.
2. (raw 1) They treat the word as if it guaranteed that the drink were healthier or safer.
3. (raw 2) The word alone, however, does not describe which ingredients are inside the drink.
4. (raw 3) The imagined drink could still contain a long list of sweeteners and additives.
5. (raw 4) The word, in short, tells buyers far less than they believe it does.
6. (raw 5) Reading the list of ingredients is a much more reliable way to judge what is inside the package.

**발문** 다음 글의 제목으로 가장 적절한 것은?

**선택지** (표시 ①–⑤ · 괄호 안 = 원값 raw index)

- ① (raw 0) Why Shoppers Should Avoid Natural Foods
- ② (raw 1) The Empty Promise of the "Natural" Label
- ③ (raw 2) How Additives Make Drinks Sweeter
- ④ (raw 3) Reading Ingredients: The Key to Healthy Eating
- ⑤ (raw 4) Natural or Artificial: Which Food Is Safer?

**제안 Gold (AI 작성 · 사람 미확정)**

- 정답: ② (raw 1) — The Empty Promise of the "Natural" Label
- 요지(gist): 'natural' 표시는 소비자가 믿는 것보다 훨씬 적은 것을 알려 준다.
- 주장 문장(claim): 5번(raw 4) · 주장 재진술: 없음
- 뒷받침(support): 3번(raw 2), 4번(raw 3) · 뒷받침 이견(supportDisputed): 1번(raw 0), 6번(raw 5) · 반대 견해(opposed): 2번(raw 1)
- 관계 확인(relationProbe): 4번(raw 3) = `example`

**오답 설계 · 피드백 문구(gold.distractors — 원문 그대로)**

- ① (raw 0) `distorted` — 표시를 믿지 말라는 글을 자연식품을 피하라는 주장으로 넘겨 확대했다.
- ③ (raw 2) `off_text` — 글은 가상의 음료에 감미료와 첨가물이 들어갈 수 있다고 예를 들지만, 첨가물이 음료를 달게 만드는 과정은 설명하지 않는다.
- ④ (raw 3) `too_narrow` — 성분표 읽기는 마지막의 후속 조언이며 글 전체의 중심인 표시의 정보 한계를 대신하지 못한다. 건강한 식사 전반의 열쇠라는 제목은 본문의 범위도 넘어선다.
- ⑤ (raw 4) `off_text` — 글은 자연식품과 인공식품의 안전성을 비교하지 않는다 — 표시의 의미를 따질 뿐이다(소재는 같지만 질문이 다르다).

**사람 결정 기록란 (미기록 · 미승인 — AI 가 채우지 않는다)**

| 항목 | 결정(선택 · 거절 · 보류) | 결정자 | 날짜 | 근거 · 메모 |
|---|---|---|---|---|
| Gold(B) — 정답 · 근거 문장 타당성 | 미기록 | | | |
| 권리(C) — store · display · transmit · assess | 미기록 | | | |
| 출시 — public · assessment | 미기록 | | | |


---

### 6. `r5-cm-transfer-2` — ③ 적용(전이)

- 역할 `transfer` · 지문 그룹 `r5cm-x2` · 원자료 위치 `/items/6`(raw index 6)
- body JS canonical SHA-256 `a57379d8818abedbbd97021b7a859eb0c8071f147122d1f23550cb8504eca599`
- gold JS canonical SHA-256 `83bc5d57a47751e48b17149409badc819eb727e3477591f76d0059467f0f3b6c`
- 권리 작업(manifest): store · display · transmit · assess · 출시 범위(manifest): public · assessment · 사람 Gold 필요: 예(평가 문항)

**지문** (표시 번호 = 1부터 · 괄호 안 = 원값 raw index)

1. (raw 0) Most students study in order to pass an exam.
2. (raw 1) A different goal, however, may lead to deeper learning: preparing to explain the material to someone else.
3. (raw 2) To teach, one must organize ideas into a clear order and find the links between them.
4. (raw 3) Gaps in understanding become obvious when one tries to put an idea into simple words.
5. (raw 4) In experiments, students told they would have to teach a passage remembered more of it than students told they would be tested, even though no one actually taught.
6. (raw 5) The expectation of teaching, it seems, changes the way people study.

**발문** 다음 글의 주제로 가장 적절한 것은?

**선택지** (표시 ①–⑤ · 괄호 안 = 원값 raw index)

- ① (raw 0) the stress students feel before exams
- ② (raw 1) the difficulty of explaining ideas in simple words
- ③ (raw 2) how expecting to explain something can deepen your own understanding
- ④ (raw 3) the best way for teachers to design tests
- ⑤ (raw 4) why exams are a poor way to measure learning

**제안 Gold (AI 작성 · 사람 미확정)**

- 정답: ③ (raw 2) — how expecting to explain something can deepen your own understanding
- 요지(gist): 남에게 설명할 준비를 하며 공부하면 더 깊이 배운다.
- 주장 문장(claim): 2번(raw 1) · 주장 재진술: 6번(raw 5)
- 뒷받침(support): 3번(raw 2), 4번(raw 3), 5번(raw 4) · 뒷받침 이견(supportDisputed): 1번(raw 0) · 반대 견해(opposed): 없음
- 관계 확인(relationProbe): 5번(raw 4) = `example`

**오답 설계 · 피드백 문구(gold.distractors — 원문 그대로)**

- ① (raw 0) `off_text` — 시험 스트레스는 글에 없다.
- ② (raw 1) `too_narrow` — 근거 하나(4번)를 주제로 삼았다.
- ④ (raw 3) `off_text` — 교사의 시험 설계는 글에 없다.
- ⑤ (raw 4) `distorted` — 시험 대비와 가르칠 준비를 비교한 글을 시험 자체를 비판하는 글로 바꿨다.

**사람 결정 기록란 (미기록 · 미승인 — AI 가 채우지 않는다)**

| 항목 | 결정(선택 · 거절 · 보류) | 결정자 | 날짜 | 근거 · 메모 |
|---|---|---|---|---|
| Gold(B) — 정답 · 근거 문장 타당성 | 미기록 | | | |
| 권리(C) — store · display · transmit · assess | 미기록 | | | |
| 출시 — public · assessment | 미기록 | | | |


---

### 7. `r5-cm-ind-3` — ④ 새 확인(혼자 확인 · 다른 지문)

- 역할 `independent_check` · 지문 그룹 `r5cm-i3` · 원자료 위치 `/items/9`(raw index 9)
- body JS canonical SHA-256 `c542bcb6cce123783711694baf5bd27f213c6271f87cd484fc6c4df255dca390`
- gold JS canonical SHA-256 `5a313b22ec511ea616e95b2d81152b9e9c94c22e5e9ee11ce84f90e7751cc593`
- 권리 작업(manifest): store · display · transmit · assess · 출시 범위(manifest): public · assessment · 사람 Gold 필요: 예(평가 문항)

**지문** (표시 번호 = 1부터 · 괄호 안 = 원값 raw index)

1. (raw 0) Some people judge a good memory by how many exact details a person can reproduce.
2. (raw 1) Imagine a baker who memorizes the color of every bowl and the position of every spoon used to make a cake.
3. (raw 2) When the kitchen is rearranged, those incidental details do not tell her which mixing and baking steps to follow.
4. (raw 3) Remembering the order of the mixing and baking steps would still help her make the cake in the new kitchen.
5. (raw 4) She need not forget the bowls and spoons; she can set them aside in thought while recalling the steps that matter.
6. (raw 5) Useful remembering, then, involves selecting information for the present task rather than reproducing every detail of a past scene.

**발문** 다음 글의 요지로 가장 적절한 것은?

**선택지** (표시 ①–⑤ · 괄호 안 = 원값 raw index)

- ① (raw 0) 좋은 기억력은 모든 일을 정확하게 떠올리는 능력이다.
- ② (raw 1) 기억은 현재 과제에 필요한 정보를 골라 쓸 때 더 유용해질 수 있다.
- ③ (raw 2) 사람의 얼굴을 잘 기억하려면 반복해서 보아야 한다.
- ④ (raw 3) 나이가 들수록 기억력이 떨어지는 것은 자연스럽다.
- ⑤ (raw 4) 기억을 정확하게 하려면 세부 사항에 집중해야 한다.

**제안 Gold (AI 작성 · 사람 미확정)**

- 정답: ② (raw 1) — 기억은 현재 과제에 필요한 정보를 골라 쓸 때 더 유용해질 수 있다.
- 요지(gist): 유용한 기억은 과거의 모든 세부를 그대로 재현하기보다 현재 과제에 맞는 정보를 선택해 쓰는 데 달려 있다.
- 주장 문장(claim): 6번(raw 5) · 주장 재진술: 없음
- 뒷받침(support): 3번(raw 2), 4번(raw 3), 5번(raw 4) · 뒷받침 이견(supportDisputed): 2번(raw 1) · 반대 견해(opposed): 1번(raw 0)
- 관계 확인(relationProbe): 4번(raw 3) = `example`

**오답 설계 · 피드백 문구(gold.distractors — 원문 그대로)**

- ① (raw 0) `opposed_view` — 필자가 반박하는 통념(1번)을 그대로 옮겼다.
- ③ (raw 2) `off_text` — 같은 얼굴을 반복해서 보라는 방법은 글에 없다. 글은 제빵사의 가상 사례로 과제에 필요한 기억을 선택하는 일을 설명한다.
- ④ (raw 3) `off_text` — 나이와 기억력의 관계는 글에 없다.
- ⑤ (raw 4) `distorted` — 세부에 주의를 기울여 정확한 회상을 높이라는 처방은 현재 과제에 맞춰 정보를 고르는 유용성의 논점을 다른 목표로 바꾼다.

**사람 결정 기록란 (미기록 · 미승인 — AI 가 채우지 않는다)**

| 항목 | 결정(선택 · 거절 · 보류) | 결정자 | 날짜 | 근거 · 메모 |
|---|---|---|---|---|
| Gold(B) — 정답 · 근거 문장 타당성 | 미기록 | | | |
| 권리(C) — store · display · transmit · assess | 미기록 | | | |
| 출시 — public · assessment | 미기록 | | | |


---

### 8. `r5-cm-ind-4` — ④ 새 확인(혼자 확인 · 다른 지문)

- 역할 `independent_check` · 지문 그룹 `r5cm-i4` · 원자료 위치 `/items/10`(raw index 10)
- body JS canonical SHA-256 `40ad4c5e7d5d6a243912410279a4c048dce656c545093658e709b862936fb2fd`
- gold JS canonical SHA-256 `1964dbf57a9fed5c3ff1689e273c33f4601b86255215a38456b8b46f5d29d9f4`
- 권리 작업(manifest): store · display · transmit · assess · 출시 범위(manifest): public · assessment · 사람 Gold 필요: 예(평가 문항)

**지문** (표시 번호 = 1부터 · 괄호 안 = 원값 raw index)

1. (raw 0) A city that wants fewer traffic jams usually decides to build more roads.
2. (raw 1) For a short while, driving does become faster on the new lanes.
3. (raw 2) But the easier trips soon persuade more people to drive, and some who used to take the bus switch to their cars.
4. (raw 3) Within a few years the new roads are as crowded as the old ones were.
5. (raw 4) When one city closed a busy highway for repairs, many drivers simply chose other routes or other ways to travel, and overall traffic did not get worse.
6. (raw 5) Adding road space, then, tends to create more traffic rather than reduce it.

**발문** 다음 글의 요지로 가장 적절한 것은?

**선택지** (표시 ①–⑤ · 괄호 안 = 원값 raw index)

- ① (raw 0) 도로를 늘리면 교통 체증이 줄기보다 오히려 교통량이 늘어난다.
- ② (raw 1) 도로 공사 기간에는 운전자들이 불편을 겪는다.
- ③ (raw 2) 대중교통 요금을 낮추면 버스 이용자가 늘어난다.
- ④ (raw 3) 새 도로는 처음 몇 년 동안 운전을 빠르게 해 준다.
- ⑤ (raw 4) 도시는 교통 체증을 줄이기 위해 도로를 더 지어야 한다.

**제안 Gold (AI 작성 · 사람 미확정)**

- 정답: ① (raw 0) — 도로를 늘리면 교통 체증이 줄기보다 오히려 교통량이 늘어난다.
- 요지(gist): 도로 공간을 늘리면 교통이 줄기보다 오히려 더 많은 교통이 생긴다.
- 주장 문장(claim): 6번(raw 5) · 주장 재진술: 없음
- 뒷받침(support): 3번(raw 2), 4번(raw 3), 5번(raw 4) · 뒷받침 이견(supportDisputed): 2번(raw 1) · 반대 견해(opposed): 1번(raw 0)
- 관계 확인(relationProbe): 3번(raw 2) = `reason`

**오답 설계 · 피드백 문구(gold.distractors — 원문 그대로)**

- ② (raw 1) `off_text` — 공사 기간의 불편은 글이 다루지 않는다 — 5번은 오히려 교통이 나빠지지 않았다고 한다.
- ③ (raw 2) `off_text` — 버스 요금 이야기는 글에 없다.
- ④ (raw 3) `too_narrow` — 잠깐 빨라진다는 부분(2번)만 떼어 내 결론처럼 만들었다.
- ⑤ (raw 4) `opposed_view` — 필자가 문제 삼는 도시의 선택(1번)을 그대로 권했다.

**사람 결정 기록란 (미기록 · 미승인 — AI 가 채우지 않는다)**

| 항목 | 결정(선택 · 거절 · 보류) | 결정자 | 날짜 | 근거 · 메모 |
|---|---|---|---|---|
| Gold(B) — 정답 · 근거 문장 타당성 | 미기록 | | | |
| 권리(C) — store · display · transmit · assess | 미기록 | | | |
| 출시 — public · assessment | 미기록 | | | |
