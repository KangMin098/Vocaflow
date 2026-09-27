<!-- docs/reports/sources-license-restricted.md -->
# 라이선스로 제한했던 원천 전량 — 소스GET 대상 분석 (2026-09-23)

> **읽는 쪽은 다음 세션이다.** 각 항목은 집어서 착수할 수 있는 단위다.
> 정책 DD-75 · 경로표 [sources-register](./sources-register.md) · 작업 순서 [sources-verify-queue](./sources-verify-queue.md).
> 읽기 전용 측정. DB 쓰기 0 · 마이그레이션 0 · 코드 0.

---

## 0. 결론 — 논증문 재고 0 은 발굴 실패가 아니라 **이 정책이 만든 것**이다

이 조사 전체를 끌고 온 진단은 「적격 13,722편 중 140~200어 논증문 **0편**」이었다.
원인을 소재·시장·장르에서 찾았는데, **코드가 이미 답을 적어 놓고 있었다** —
`_curation-spec.ts:1092`:

> `'plos:essay': 'argumentative'` — 이 한 줄이 논증문 재고 0 을 푼다.
> **나머지 논증 후보는 전부 ND/NC 라 붙여도 `display_only` 로 죽는다.**

논증문은 의견·논평·매거진·싱크탱크에서 나오고 **그 장르가 압도적으로 ND/NC** 다.
파생 허용 라이선스만 받는 규칙은 곧 **논증문을 받지 않는 규칙**이었다.
장르 분포가 아니라 **게이트의 모양**이 재고를 만든 것이다.

그 대가가 코드에 두 번 더 적혀 있다:

| 증거 | 무엇 |
|---|---|
| `owid.ts:5` | 「유일한 argumentative 소스 the_conversation 이 CC-BY-ND(display_only) 라, OWID 가 argumentative register 를 **발행 가능** 콘텐츠로 채운다」 |
| `europe-pmc.ts:8` | 「둘 다 **라이선스 때문이었다** — The Conversation 은 CC BY-ND 라 `display_only` 로 들어가…」 |

**어댑터 두 개가 ND 를 피해 가려고 만들어졌다.** 우회로를 짓는 비용이 원천을
재저작으로 쓰는 비용보다 컸다.

---

## 1. 배제가 실제로 사는 곳 — 문서가 아니라 코드 5곳 (★이번 턴 실측)

앞선 턴에 리포트의 「실격」 표기를 고쳤지만 **운영은 하나도 안 바뀐다.**
판정은 여기서 난다:

| # | 위치 | 코드 | 효과 |
|---|---|---|---|
| **E1** | `textbook/source-eligibility.ts:337` | `if (row.displayOnly === true)` → `done('blocked','legal', …, **false**)` | 「문항을 만들 수 없다」 · **`recoverable: false`** |
| **E2** | `source-eligibility.ts:345` | `if (licenseClass && !DERIVABLE_LICENSE.has(…))` | `DERIVABLE_LICENSE = {public_domain, cc0, cc_by, cc_by_sa}` — **정확히 R0·R1·R2** |
| **E3** | `compose/drain-activities.mjs:82` | `if (a.display_only) gate.push('display_only')` + 같은 4개 화이트리스트 | 구문 재배열 입력 차단 |
| **E4** | DB 트리거 `acp_apply_license_gate` | `license` 문자열 → `license_class` → `display_only` · `copyright_safe_in_kr` | 적재 시점에 자동 낙인 |
| **E5** | `admin/help/textbook.ts:198` | 「라이선스가 파생을 막거나(`cc_by_nd`·`restricted`·`display_only`) … **고칠 방법이 없으므로 빼는 것이 유일한 처방**이다」 | **다른 세션이 제일 먼저 읽는 줄** (AGENTS.md ②) |

**E5 가 가장 위험하다.** 파이프라인 수치가 나빠지면 코드보다 먼저 읽는 것이 이 도움말인데,
거기에 「빼는 것이 유일한 처방」이 적혀 있다. 지금은 **틀린 지시**다.

### E1·E2 는 절반만 틀렸다 — 정확히 어디가 틀렸나

`judgeSource` 의 docstring 은 「**이 원문을 교재에 실을 수 있는가**」다.
그 질문에 대해서는 **ND/NC = 아니오가 맞다.** 남의 문장을 싣거나 재배열하는 것은 파생물이다.

틀린 것은 **하나의 판정을 모든 하류가 쓰는 것**이다. 두 질문이 섞여 있다:

| 질문 | ND/NC 답 | 지금 코드 |
|---|---|---|
| 이 원문의 **문장을** 교재에 실을 수 있나 | **아니오** | ✅ 맞다 |
| 이 원문을 **재저작 입력**(사실·논지만)으로 쓸 수 있나 | **예** — 사실·아이디어는 저작물이 아니다 | ❌ 같은 `blocked/legal` 로 죽는다 |

그래서 `recoverable: false`(「고칠 방법이 없다」)가 찍히고, 감사는 이 행들을
`policy_exclusion`(「자동 변경 없음·수리 큐가 아님」)으로 분류한다.
**처방이 있는데 처방 없음으로 기록된다.**

---

## 2. 기존 재고에서 라이선스로 막힌 것 — 150편 (스냅샷 실측)

`source-eligibility-snapshot.json` · 측정 **2026-09-23T01:43Z** · spec 3 · scope `ready`·`published`:

```
total 87,720
byBlockedAxis  judgement 58,777 · format 14,525 · safety 374 · gate 164 · legal 150
```

**legal 은 87,720 중 150 (0.17%) 뿐이다.** 그리고 이 세션 앞부분에서 확인했듯
**그중 80편은 법이 아니라 문자열 서식**이다 — 각색 경로 2곳(`adapt-drain-import.mjs:193`·
`drain-adapt.mjs:225`)이 `license` 칸에 등급 슬러그(`public_domain`·`cc_by`)를 써서
`acp_classify_license` 가 전부 `restricted` 로 떨어뜨렸다(부모가 전부 PD/CC-BY 라 **오탐 0**).

**→ 실제 라이선스 차단은 약 70편이다.**

### 이 숫자가 작은 것이 좋은 소식이 아닌 이유

**막을 것이 없어서 작은 게 아니라, 막힐 것을 애초에 안 가져와서 작다.**
`the_conversation` 이 그 증거다.

---

## 3. 진짜 손실 — 세 가지 형태 (전부 코드로 확인)

### 3-1. 스로틀 — 가져올 수 있는데 조금만 가져온다

`the_conversation` 설정(`_curation-spec.ts:279`·`726`):

| 항목 | 값 | 뜻 |
|---|---|---|
| `recencyDays` | **21** | 3주보다 오래된 글은 안 본다 |
| `maxItems` / `maxItemsPerBatch` | **20** / **20** | 한 번에 20편 |
| `bulkPriority` | **6** | 뒷순위 |
| `styleGuide` | 「학자 논증문 (CSAT **최난이도 지문과 최유사**) · 본문 **verbatim only**」 | |
| `register` | **`argumentative`** | 몇 안 되는 논증 소스 |
| `targetCefr` | **B2~C1** | 기출 상단과 일치 |

**가용 6만+ · 보유 70편.** 발췌 수율 실측 **82%** — 조사 전체 최고다.
품질도 register 도 난이도도 맞는데 **`verbatim only` 라서 조금만 가져온다.**
R4 에서는 verbatim 을 안 쓰므로 그 제약이 사라진다.

### 3-2. 미배선 — 어댑터를 써 놓고 안 쓴다

`openstax.ts:10` — 「§18 `acp_classify_license` 가 NC → `'restricted'`(copyright_safe=false) **차단**」.
**어댑터가 있고, 그 어댑터의 주석이 자기가 막힌다고 적고 있다.** 재고 0.

### 3-3. 우회 비용 — ND 를 피해 어댑터 두 개를 새로 지었다

`owid.ts` · `europe-pmc.ts`(§0 인용). 그리고 europe_pmc 는 인용 잔해 **78%** 로
지금도 품질 문제를 안고 있다(frontiers 14%). **우회로가 원래 길보다 나빴다.**

---

## 4. 소스GET 대상 전량 — 라이선스 제한 원천 분석

**제외 0건.** 경로는 DD-75 의 R3(NC) · R4(ND·ARR·미확정).
우선순위는 **(논증 밀도 × 길이 적합 × 막힌 칸 기여) ÷ 취득 비용**이다.

### 4-A. 이미 저장소 안에 있는 것 — 가장 싸다 (새 어댑터 0)

| # | 원천 | 라이선스 | 경로 | 가용 / 보유 | 왜 1순위인가 |
|---|---|---|---|---|---|
| **A1** | **The Conversation** | CC-BY-ND | **R4** | **6만+ / 70** | **어댑터·스펙·열쇠 전부 있다.** `argumentative` · B2~C1 · 발췌 수율 **82%** · 「CSAT 최난이도 지문과 최유사」. 스로틀 3개(`recencyDays 21`·`maxItems 20`·`bulkPriority 6`)만 풀면 된다 |
| **A2** | **OpenStax** | CC-BY-NC-SA | **R3** | 1,422섹션 / **0** | 어댑터 `openstax.ts` 존재. Philosophy·Psychology·Sociology·World History = **막힌 두 칸을 정확히 겨냥** |
| **A3** | **각색 80편** | (오판정) | — | 80 / 80 | **법이 아니라 문자열 서식이다.** `license` 칸에 등급 슬러그를 쓴 두 경로를 고치면 80편이 즉시 풀린다. 오탐 0 확인 |
| **A4** | **실제 ND/NC 재고 ~70편** | 혼재 | **R3·R4** | ~70 | 재저작 입력으로 전환 |

### 4-B. 외부 — R4 (ND · ARR · 미확정) · 논지 구조가 이미 만들어진 것

| 원천 | 규모 | 길이 | 논증 | 막힌 칸 | 취득 |
|---|---:|---|---|---|---|
| **args.me** | **31,700편이 정확히 140~200어** | ★규격 | 상 | 전역 | 덤프 |
| **AJOL** | **174,201 OA 전문** | 초록 중앙 **162어**(목표 164 최근접) · 영어 100% | 25% | 인문사회 | **202 레이트리밋 · 사람 문의** |
| **Britannica ProCon** | — | — | **쟁점별 찬반이 이미 표** | 사회·경제 | 크롤 |
| **Gale Opposing Viewpoints** | **20,000+** | — | viewpoint 에세이 | 사회·경제 | 기관 계약 |
| **Issues in Science and Technology** | ≥2,000 | 문단 **57~81** | **최상** — 「이 정책은 틀렸다 + 근거 3개」 | 과학·정책 | 크롤 |
| **IDEA Debatabase** | **700 논제** | — | 찬반 | 전역 | 크롤 |
| **Phi Delta Kappan** | ≥1,000 | — | 상 | 교육 | **copyright.com 구매 가능** |
| **Aeon / Psyche** | 수천 | — | **최상** | 철학·심리 | 크롤 |
| **SEP / IEP** | ~1,800 / ~900 | 단락 **126~135어** ★규격 | 서베이 | **철학** | 크롤(재배포 금지 — R4 라 무관) |
| **PhilPapers / PhilArchive** | 135,836 초록 | **150~300어** | 상 | **철학** | API |
| **Érudit** | 영어 ≈44% | — | 상 | **기호학·연극학·건축사** | OAI |
| **Project MUSE · JSTOR** | — | — | 상 | 인문 — **기출 실제 출처 계열** | **robots·접근 먼저** |
| **RePEc / EconPapers** | 550만+ | 초록 | 중 | 경제 | API |
| **World History Encyclopedia** | 5,245 | — | 중 | **역사·인류** | 크롤 |
| **EBSCO Research Starters** | 수십만 | — | 서베이 | 역사 외 | 기관 계약 |
| **SAPIENS** | 1,540 | — | 상 | **인류학** | 크롤 |
| **Dialnet · Redalyc · LA Referencia · J-STAGE · VJOL** | 773,161 등 | — | — | 광역 | 미확정 → R4 |
| **국내 ELT 교재** | — | — | **장르 적합도 조사 최고** | 전역 | 보유 79종 |
| **KCI** | 182지 중 NC 148 | — | 상 | **한국 학습자 배경지식과 맞는다** | API |

### 4-C. 외부 — R3 (NC) · 막힌 칸을 정면으로 겨냥

| 원천 | 규모 | 여는 칸 |
|---|---:|---|
| **Smarthistory** | 2,500~3,000 | **예술·문화** — 예술 논증 내용 최상위 |
| **Noba Project** | 105모듈 | **심리·인지** — 심리학 교재 전량 |
| **punctum books** | 452권(BY-NC-SA 412) | Thema **예술 70 · 문학 64 · 철학 40** |
| **LibreTexts NC** | **775권 ≈ 63,300섹션** | 전역 — CC-BY 분의 **2배** |
| **ANU Press** | **936권** | 사회 240 · 역사 135 |
| **Athabasca UP** | 180권 | 인문 (Manifold HTML) |
| **Cochrane PLS · IZA World of Labor** | 20,079 · 3,719 | 과학·경제 (IZA 는 「one-page summary」 포맷) |
| **Nieman Lab · Tax Foundation · Mises · Hechinger** | — | 매체·조세·경제·교육 |
| **MIT OCW · Kialo Edu** | — | 전역 · 논증 매핑 |
| ⚠️ **PERSUADE · ELLIPSE** | 25,996 · 6,500 | **함정** — 140~200어 대역이 가장 못 쓴 슬라이스(소문자 시작 10.3% vs 400~600어 3.4%) |

### 4-D. 자동화 함정 — 라이선스+길이만 보면 1위로 올라온다

| 원천 | 왜 걸러야 하나 |
|---|---|
| **AAAC / DeepA2** | CC-BY-SA + 합성 + 길이 정확 → **라이선스·길이만 자동 판정하면 1위**. 내용은 템플릿 논리 퍼즐이다 |
| **EconStor** | 초록 **167어**로 길이 게이트 통과 · **주장동사 1.5%** |

**→ V5(논증·자족)를 V3(길이)와 같은 표본에서 함께 재는 이유다.**

---

## 5. 설계 수정 — 플래그 하나를 두 질문으로

```
지금:  display_only ──────────────► 모든 하류가 "쓸 수 없음"

바꿀 것:
  verbatimOk   = R0·R1·R2        → 문장을 싣는다 · 구문 재배열 (E3 그대로 유지)
  reauthorOk   = 전부 true        → 사실·논지만 읽고 새로 쓴다 (R3·R4)
```

| 대상 | 바꿀 것 |
|---|---|
| **E1·E2** `judgeSource` | `blocked/legal` 에 **경로**를 실어 돌려준다(`route: 'R3'|'R4'`) · `recoverable: **true**`(처방 = 재저작) |
| **감사** | 이 행들을 `policy_exclusion`(손대지 말 것) 이 아니라 **`reauthor_queue`** 로 분류 |
| **E3** `drain-activities.mjs` | **그대로 둔다** — 구문 재배열은 문장을 쓰므로 파생물이 맞다 |
| **E4** DB 트리거 | **그대로 둔다** — `display_only` 의 뜻(verbatim 재배포 금지)은 여전히 옳다 |
| **E5** Admin 도움말 | 「고칠 방법이 없으므로 빼는 것이 유일한 처방」 → **「verbatim 은 불가 · 재저작(R3·R4) 입력으로는 가능」** (AGENTS.md ② — 화면 바꾸는 **같은 커밋**에서) |
| **`source-policy.test.ts`** | 「SOURCE_SPECS 에 restricted 등급 소스가 없다」는 **깨지지 않는다** — R3·R4 의 등록 소스는 `original`(CC0)이고 NC/ND 원천은 **소스가 아니라 입력**이다 |

**법적으로 바뀌는 것이 없다.** ND/NC 문장은 여전히 학습자에게 안 나간다.
바뀌는 것은 **그 글을 읽고 우리가 새로 쓸 수 있는가**이고, 답은 원래부터 예였다.

---

## 6. 착수 순서 — 싼 것부터

| # | 할 일 | 비용 | 되돌리기 |
|---|---|---|---|
| **1** | **A3 각색 80편** — `license` 칸에 등급 슬러그 쓰는 두 경로 수정 | 2줄 | 가능 |
| **2** | **E5 Admin 도움말** — 틀린 지시부터 내린다 | 1줄 | 가능 |
| **3** | **A1 The Conversation 스로틀 해제** — `recencyDays`·`maxItems`·`bulkPriority` | 3줄 | 가능 |
| **4** | **E1·E2 경로 반환 + 감사 `reauthor_queue`** + 회귀 | 코드 2 · 회귀 2 | 가능 |
| **5** | **R4 파일럿 20편** — A1 · args.me · ProCon · Issues | 드레인 1 | — |
| **6** | **R3 파일럿 20편** — Smarthistory · Noba (A2 OpenStax 포함) | 드레인 1 | — |
| **7** | 통과율이 `original` 70% 근처면 4-B·4-C 전량 온보딩 | — | — |

**1·2 는 오늘 할 수 있다.** 3 은 A1 이 이미 배선돼 있어 새 코드가 0 이다.

⚠️ **5·6 전에 [sources-verify-queue](./sources-verify-queue.md) 5단계(compose 게이트)를 먼저 해야 한다** —
선언 CEFR 불일치 29/50 · `A2` 발주 12편 전부 B1 이상인 상태에서는 파일럿 통과율이
**게이트 결함인지 재저작 한계인지 구분되지 않는다.**

---

*정책 DD-75 · 원천 정본 [sources-register](./sources-register.md) · 작업 순서 [sources-verify-queue](./sources-verify-queue.md)*
