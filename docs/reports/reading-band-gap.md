<!-- docs/reports/reading-band-gap.md -->
# 학년 사다리에 고1 칸이 없다 — 조사와 설계 제안

**조사 2026-09-07 · 구현 없음 · 결정 대기.**
발단은 [source-probe/SUMMARY.md §6](./source-probe/SUMMARY.md) 한 줄이다 —
「고1 칸이 `READING_LEVEL_BANDS` 에 아예 없다(중3 이 천장)」.
소스 정찰이 VOA 고1 대역 약 5,500편·Simple Wikipedia·CK-12 를 겨냥해 놓고
**담을 그릇이 없다**고 적었고, 이 문서는 그 그릇을 어떻게 만들지를 잰다.

근거는 전부 이번에 다시 잰 것이다 — 시중 코퍼스 SQLite 직접 질의 ·
`library_articles` 전수 SQL(FK 를 서버에서 계산) · 저장소 grep · 마이그레이션 원문.
**문서의 수치는 근거로 쓰지 않았다.**

---

## 0. 세 줄

1. **고1 칸을 채울 원문은 이미 있다.** 「PD 발췌 · 중3」 칸에 담긴 1,933편 중
   **1,430편이 FK 9.0~11.0**(시중 고1 독해 본책 중앙 9.62)이다. 밴드를 늘리는 일은
   새 수확이 아니라 **이름을 바로잡는 일**에서 시작한다.
2. **그런데 FK 만으로는 고1 위를 못 가른다.** 시중 본책 실측에서 문장 길이가
   고1(19.1어)에서 포화하고 고3(18.4어)에는 오히려 줄어든다. 고1→고3 의 FK 차이
   **0.56** 은 전부 음절/낱말에서 나온다. 사다리를 FK 한 축으로 위로 늘리면
   **세 학년이 한 칸에 뭉친다.**
3. **스키마 마이그레이션은 필요 없다.** 밴드는 코드 상수이고, DB 쪽 표현은
   `library_articles.feed_label` 자유 텍스트다. 필요한 DB 변경은
   `csat_source_targets` 에 행을 더하는 것뿐이고 그것도 선택이다.

---

## 1. 현재 밴드 체계 — 정본과 재고

정본은 **`packages/library-pipeline/src/textbook/readability.ts`** 의
`READING_LEVEL_BANDS` 다. 다섯 칸이고 각각 FK 창 하나 · 어수 창 하나(다섯 칸이 같다) ·
`marketFk`(시중 실측 근거) · `school`(어휘 자를 어느 쪽으로 대는가)을 갖는다.

| 밴드 | FK 창 | 어수 창 | `marketFk` | `school` | 적재 재고 | 조합 가능 | 격리 |
|---|---|---|---|---|---|---|---|
| 초3~4 | 1.5 ~ 4.0 | 100~200 | 3.33 | elementary | 2,027 | 1,428 | 599 |
| 초5~6 | 3.5 ~ 5.5 | 100~200 | 4.42 | elementary | 2,028 | 1,554 | 474 |
| 초6~중1 | 4.5 ~ 7.0 | 100~200 | 5.34 | elementary | 2,312 | 1,941 | 371 |
| 중1~2 | 6.5 ~ 9.0 | 100~200 | 7.60 | middle | 2,341 | 2,022 | 317 |
| **중3** | **8.5 ~ 12.0** | 100~200 | **10.67** | middle | 2,178 | 1,935 | 243 |
| **(고1)** | — | — | — | — | **없음** | — | — |

- 재고는 `library_articles.feed_id='kid-excerpt'` 의 `feed_label` 별 실측(2026-09-07).
  「조합 가능」은 `status in (ready, published)`, 「격리」는 `csat_fit->gate->>'publishable' = 'false'`.
- 어수 창은 **다섯 칸이 같다**(`PASSAGE_WORDS = {100, 200}`). 파일이 그 이유를 적어 뒀다 —
  시중 교재가 스스로 인쇄한 어수 n=59 를 학년대로 갈라 보니 중1~중3 한 밴드가
  97~198어로 전체 범위와 같았다. **길이는 학년을 가르지 못한다.**
- 창 밖은 `bandOf()` 가 `'초3 미만'` 또는 **`'중3 초과'`** 라는 문자열로 답한다.
  즉 지금 사다리에서 고1·고2·고3·수능은 **전부 「중3 초과」 한 덩어리**다.

### 판정 기준은 실제로는 네 축이다

`READING_LEVEL_BANDS` 는 FK 와 어수만 들고 있지만, 이 사다리를 쓰는 자리
(`grade-level-bench.mjs`)는 **네 축을 동시에** 건다. 왜 그런지도 실측으로 적혀 있다.

| 축 | 자 | 어디 | 한 축만 믿었을 때 실제로 난 사고 |
|---|---|---|---|
| ① 어수 | `PASSAGE_WORDS` 100~200 | `readability.ts` | FK 15.37 짜리 NASA 사진설명이 초6 자리를 통과(45% 오분류) |
| ② 난이도 | `READING_LEVEL_BANDS` FK 창 | `readability.ts` | Little Women(1868)·Tom Sawyer(1876)가 초6~중1 로 판정 |
| ③ 어휘 | 2022 개정 별표 3,000 **밖 %** ≤ 시중 p90 | `curriculum.ts` | — (이 축이 ②의 19세기 어휘를 잡는다) |
| ④ 자립성 | 대명사 시작·인용 비율 등 | `standalone.ts` | 세 축만 통과한 PD 발췌 906편 중 **69%가 소설 대화 장면** |

**③이 고1 확장의 진짜 병목이다** — 뒤 §3 에서 다시 본다.

---

## 2. 왜 중3 이 천장인가 — 확인한 것

**의도적 설계도, 확장하다 만 것도 아니다. 다른 목표를 위해 만든 자를 그대로 쓰고 있는 것이다.**
세 갈래로 확인했고 셋 다 같은 곳을 가리킨다.

### ① 사다리는 「초·중 부족분 프로젝트」의 부품으로 태어났다

`textbook/kid-source.ts` 가 목표를 숫자로 적어 두었다:

```
KID_SOURCE_TARGET = { highSchoolStock: 18_320, total: 9_160, quotaPerBand: 1_832 }
```

주석: 「목표 = **고등 재고의 절반**. 고등(V5~V9 · ready+published) 18,320편을 실측하고
그 절반을 잡았다.」 즉 이 사다리를 만들 때의 전제가 **「고등은 이미 재고가 있다」** 였고,
그래서 칸을 초·중에만 팠다. `KID_BANDS` 는 다섯 칸을 **한 번 더 문자열로** 들고 있다
(정본의 사본이다 — 확장 시 두 곳이 갈릴 자리).

⚠️ **그 전제는 어수 창을 안 본 값이다.** 오늘 다시 세면 고등(V5~V9 · ready+published ·
display_only 제외)은 **32,446편**이지만, 지문 어수 창(100~200어)에 드는 것은
**4,307편**뿐이고 그중 FK 고1 대역에 드는 것의 **97%가 Gutenberg 19세기 서사**다.
「고등 재고는 충분하다」는 **긴 논문·긴 기사를 세어서 나온 말**이지 지문을 센 값이 아니다.

### ② 자를 만든 쪽에 리터럴 `9` 가 하나 박혀 있다

어휘 축의 시중 분포(`CURRICULUM_SPEC.outside`)를 만드는 도구:

```
scripts/textbook-corpus/passage-mine.mjs:161
  WHERE d.category='독해' AND d.grade_min <= 9
```

`grade_min` 은 초1=1 … 고3=12 눈금이므로 **`<= 9` 가 곧 「중3까지」**다.
자료가 없어서가 아니다 — 같은 코퍼스에 **고등 독해·기출 51종 3,225쪽**이 이미 들어 있다.
한 줄이 문을 닫고 있었다.

### ③ 「고등은 어휘 자를 안 쓴다」가 코드에 명시돼 있다

```
source-eligibility.ts:240
  export function schoolOfVLevel(v) {
    if (v <= 2) return 'elementary'
    if (v <= 4) return 'middle'
    return null // 고등은 교육과정 3,000 밖 비율 자를 쓰지 않는다 — 시중 분포를 안 쟀다
  }
```

그리고 `judgeSource()` 의 ⑦어휘 축은 그 `null` 을 받으면
**「고등 밴드 — 시중 어휘 분포 미측정」으로 적고 `usable` 을 돌려준다.**
즉 지금 고등 원문은 **어휘 축을 통과한 것이 아니라 재지 않은 것**이고, 그 사실이
등급에는 안 남는다. 밴드를 FK 만 늘리고 이걸 그대로 두면 **새 칸은 자 없이 열린다.**

### ④ 문서에는 「중3까지로 한다」는 결정이 없다

`docs/` 와 `CHANGELOG.md` 를 훑었으나 상한을 정한 기록이 없다.
`READING_LEVEL_BANDS` 를 만든 커밋(2026-09-02, 「초5~6 칸의 유일한 답」)은
발췌 경로를 여는 작업이었고 대상이 초·중이었다. **상한은 결정된 적이 없다 — 범위가
거기까지였을 뿐이다.**

---

## 3. FK 는 고1 위를 못 가른다 — 이번 실측의 핵심

시중 코퍼스(`d:/workspace/textbook-corpus/corpus.db`)를 **역할별로** 갈라 재면
사다리의 성질이 드러난다. 아래는 `category IN ('독해','기출')` 의 평균이다.

| 학년 | 역할 | n | FK | 평균 문장(어) | **음절/낱말** |
|---|---|---|---|---|---|
| 초 | 본책 | 2 | 6.15 | 12.8 | 1.417 |
| 중1~2 | 본책 | 1 | 7.15 | 13.2 | 1.492 |
| 중3 | 본책 | **0** | — | — | — |
| **고1** | 본책 | 7 | **9.87** | **19.1** | 1.527 |
| **고3** | 본책 | 16 | **10.43** | **18.4** | **1.598** |

- **문장 길이가 고1 에서 포화한다** (19.1 → 18.4로 **줄어든다**).
  FK = `0.39·문장길이 + 11.8·음절당` 이므로, 고1→고3 의 FK 차이 **0.56** 은
  **전부 음절/낱말**에서 나온다.
- 수능 기출 15개년 본책의 FK 중앙은 **10.52**(범위 6.96~11.56), EBS 수능특강은 **11.53**.
  둘 다 **현재 「중3」 칸(8.5~12.0) 안**이다. 지금 `bandOf()` 는 수능 지문을 「중3」이라 답한다.
- 그러므로 **FK 창을 위로 이어 붙이는 방식으로는 고1·고2·고3 을 못 가른다.**
  세 학년의 FK 폭이 1.0 미만인데 기존 칸 폭이 2.0~3.5 다.

### 곁가지로 나온 것 — 현재 `중3` 의 `marketFk` 는 이상값 하나가 만든다

`marketFk` 는 그 학년대 문서들의 **평균**이다. 중3 은 문서가 넷뿐이다:

```
정답해설 7.87 · 정답해설 9.33 · 미리보기 9.57 · 미리보기 15.90  →  평균 10.67
```

15.90 은 리딩튜터 챌린저 **미리보기 23쪽**(평균 문장 27.5어)이다. 미리보기 쪽에는
지문 말고 표제·홍보 문구가 섞인다. **중앙값을 쓰면 9.45** 이고, 그 값은 고1 본책
중앙(9.62)과 사실상 같다 — 즉 **지금의 중3 칸은 이름만 중3이고 실제로는 고1 칸이다.**
(고2 도 같은 병을 앓는다 — 고2 는 본책이 하나도 없고 미리보기·정답해설만 있어
평균 FK 12.4~12.7 로 수능 기출보다 높게 나온다.)

⚠️ 이건 「고쳐야 할 버그」로 단정하지 않는다. `marketFk` 는 창을 정한 **근거 표기**이고
창 자체는 이웃까지 넓혀 손으로 잡은 값이다. 다만 **밴드를 늘리려면 이 셈법을
먼저 정해야 한다** — 새 칸에도 같은 평균을 쓰면 같은 이상값 문제를 물려받는다.

---

## 4. 고1 칸을 채울 원문이 이미 있는가 — 있다, 다만 이름이 틀렸다

`library_articles` 전수에 대해 **서버에서 FK 를 계산**했다
(`readability.ts` 와 같은 식·같은 음절 근사를 SQL 로 옮겨 검산).
대상: `status in (ready, published)` · `display_only = false` · 어수 100~200 → **9,510편**.

| FK 구간 | 편수 |
|---|---|
| < 1.5 | 25 |
| 1.5 ~ 4.0 | 1,505 |
| 4.0 ~ 5.5 | 1,702 |
| 5.5 ~ 7.0 | 2,130 |
| 7.0 ~ 8.5 | 1,578 |
| 8.5 ~ 9.0 | 530 |
| **9.0 ~ 10.0** | **790** |
| **10.0 ~ 11.0** | **698** |
| 11.0 ~ 12.0 | 526 |
| 12.0 ~ 13.5 | 19 |
| ≥ 13.5 | 7 |

**고1 후보(FK 9.0~11.0) = 1,488편**, 고2 후보(11.0~12.0) = 526편.

그리고 그것들이 지금 어느 칸에 들어 있는지가 결정적이다:

| 현재 라벨 | FK 8.5~9.0 | **FK 9.0~11.0** | FK ≥ 11.0 |
|---|---|---|---|
| PD 발췌 · 중3 (1,933편) | **0** | **1,430** | 503 |
| PD 발췌 · 중1~2 (525편) | 519 | 6 | 0 |
| 라벨 없음 (102편) | 11 | 52 | 39 |

**「중3」 칸에 8.5~9.0 이 한 편도 없다.** 그 칸은 통째로 고1~고2 대역이다.
즉 **밴드만 늘리면 채워지는가 → 상당 부분 그렇다.** 새 수확 없이 1,430편이 옮겨 온다.

### ⚠️ 그런데 그 1,430편은 장르가 한쪽으로 쏠려 있다

FK 8.5~11.0 후보 2,018편의 출처:

| 출처 | 편수 | 라이선스 |
|---|---|---|
| **gutenberg** | **1,955 (97%)** | public_domain |
| frym | 55 | cc_by |
| simple_wikipedia | 7 | cc_by_sa |
| original | 1 | cc0 |

**전부 19세기 PD 서사**다. 이 저장소는 그 위험을 이미 두 번 기록했다 —
「FK 가 19세기 어휘를 못 거른다」, 「세 축을 통과한 PD 발췌 906편 중 69%가 소설 대화 장면」.
고1 은 학평·수능 대비 구간이라 **설명문·논증문이 주력**이어야 하는데(`series.ts` step 5 의
유형이 순서·삽입이다), 그 결이 재고에 거의 없다.

설명문 쪽 실측(전문 FK, 어수 200 초과 = 발췌 대상):

| 출처 | n | FK p25 | 중앙 | p75 | FK 8.5~11.0 | 11.0~13.5 |
|---|---|---|---|---|---|---|
| **voa** | 213 | 8.12 | **9.05** | 9.94 | **140** | 7 |
| wikipedia | 57 | 10.82 | 11.84 | 13.25 | 15 | 28 |
| noaa | 33 | 11.43 | 13.05 | 14.33 | 4 | 17 |
| usgs | 519 | 12.34 | 13.65 | 14.83 | 45 | 202 |
| futurity | 2,771 | 13.11 | 14.67 | 16.18 | 140 | 712 |

**VOA 는 전문 그대로가 고1 대역이다**(중앙 9.05 vs 시중 고1 본책 9.62).
정찰이 「VOA 가 고1 5,500편」이라 적은 것을 **우리 쪽 자로 재서** 확인한 셈이다 —
그리고 이 값은 VOA 의 선언 Level 1/2/3 을 **한 번도 쓰지 않고** 나왔다.
반대로 futurity·usgs 는 전문이 고2~성인 대역이라 **발췌해야** 고1 칸에 들어온다.

**결론: 칸을 열면 1,430편이 즉시 들어오지만 그것만으로는 서사 편중이 그대로 옮겨 온다.
설명·논증 공급은 VOA(사이트맵 미확보 33,300) 와 futurity 발췌가 따로 채워야 한다.**

---

## 5. 다른 난이도 축과 어떻게 맞물리나

이 저장소에는 난이도 축이 **다섯**이고, 넷은 이미 고3까지 올라가 있다.
**아래에서 두 번째 칸만 중등에서 멈춰 있다.**

| 축 | 정본 | 범위 | 고1 을 아는가 |
|---|---|---|---|
| V-Level 0–11 | DB `vocaflow_levels` | V5 고1 · V6 고2 · V7 고3/수능 · V8+ 성인 | **안다** |
| 교재 계단 | `textbook/series.ts` `SERIES_SPINE` | step 5 = V5 = **고1**(순서·삽입) · step 6 고2 · step 7 고3 | **안다** |
| 재저작 학령 지시 | `compose/spine.ts` `GRADE_BANDS` | elementary · middle · **high**(V5~8) · exam(V7~11) | **안다** |
| 수능 유형별 문체 대역 | `scripts/csat/data/type-bands-all.json` | 유형별 글자수·TTR·낱말길이·문장길이 (기출 표본) | **안다** (다른 축) |
| **원문 선별 FK 사다리** | **`textbook/readability.ts`** | **초3~4 … 중3** | **모른다** |
| **어휘 밖% 시중 분포** | **`textbook/curriculum.ts`** | **elementary · middle** | **모른다** |

### 중요 — 조판(출고)은 이 사다리를 안 쓴다

`scripts/textbook/volume-pool.mjs:709` 가 원문을 고르는 조건은
`status in ('ready','published') AND article_v_level = <밴드>` 하나다.
FK 창도 어수 창도 어휘 자도 안 본다. 그래서:

- **고1 권(step 5)은 이미 조판되고 있다.** 다만 **자 없이** 뽑는다.
- `READING_LEVEL_BANDS` 는 **입고(수확·발췌·적재) 쪽 자**다 —
  `harvest-gutenberg-kid.mjs` · `storyweaver-ingest.mjs` · `space-place-ingest.mjs` ·
  `frym-ingest.mjs` · `write-drain-import.mjs` 가 이걸로 칸을 정해 담는다.
- **그래서 확장의 위험이 겉보기보다 작다** — 밴드를 늘려도 이미 돌고 있는 조판이
  즉시 바뀌지 않는다. 대신 **고1 권은 계속 자 없이 조판된다**는 문제는 남는다.

### 함께 움직여야 하는 것

밴드에 `school: 'high'` 를 더하면 **타입이 강제로 끌고 가는 곳**이 있다:

1. `curriculum.ts` 의 `SchoolLevel = 'elementary' | 'middle'` → `'high'` 추가.
   그 순간 `CURRICULUM_SPEC.outside` · `CURRICULUM_GATE` · `AUTHORED_VOCAB_BAND` ·
   `marketPercentile()` · `curriculumFit()` 이 **전부 `high` 값을 요구한다**(컴파일이 막는다).
   그 값은 `passage-mine.mjs` 의 `grade_min <= 9` 를 풀어야 나온다.
2. `source-eligibility.ts` 의 `schoolOfVLevel` — V≥5 가 `null` 이 아니게 되면
   지금 「미측정」으로 통과하던 고등 원문이 **실제로 어휘 축 판정을 받는다.**
   ⚠️ **이건 게이트가 갑자기 조여지는 변경이다.** 지금 `usable` 인 고등 재고 일부가
   `blocked` 로 바뀔 수 있다 — 몇 편인지는 `high` 분포를 재기 전에는 알 수 없다.
3. `kid-source.ts` 의 `KID_BANDS`(사본) · `KID_SOURCE_TARGET`(9,160 = 5칸 × 1,832).
   칸이 여섯이 되면 **몫 산술이 통째로 바뀐다.**

### 곁가지로 발견한 축 불일치 (이 작업과 별개, 확인 필요)

`apps/web/src/lib/textfit/profile.ts` 의 `LEVEL_LABEL` 은 **V5 = 중3 · V6 = 고1** 이다.
DB `vocaflow_levels` 는 **V5 = 고1 · V6 = 고2** 이고 `series.ts` 도 그렇다.
`/fit` 화면이 한 칸 낮게 부르고 있다. 그 파일은 `CATEGORY_VLEVEL` 을 따랐다고 적어 두었으니
어느 쪽이 정본인지는 **별도 결정**이다 — 여기서 고치지 않는다. 다만 **고1 밴드를 V-Level 로
정의하면 이 불일치가 즉시 사용자에게 보이는 값이 된다.**

---

## 6. 제안

### 6-1. 어디까지 늘리는가 — **고1 하나만. 고2·고3 은 열지 않는다.**

| | |
|---|---|
| **고1 은 연다** | 수요가 실측됐다(VOA 5,500 · 재고 1,430 즉시 이관) · 시중 표본이 본책 7종으로 가장 두껍다 · `series.ts` step 5 가 이미 그 칸의 권을 조판하고 있다 |
| **고2 는 보류** | 시중 코퍼스에 고2 **본책이 0종**이다(미리보기 5 · 정답해설 4뿐). 그 역할의 FK 는 지문이 아닌 것이 섞여 12.4~12.7 로 부풀어 있다. **자를 만들 자료가 없다** |
| **고3 은 보류** | 자료는 있으나(수능 기출 15개년 · EBS 수능특강) **이 사다리가 필요 없다** — 수능 대역은 이미 `type-bands-all.json` 이 유형별로 더 정밀하게 재고 있다. 두 자를 겹치면 갈린다 |

즉 사다리는 **여섯 칸**이 된다: 초3~4 · 초5~6 · 초6~중1 · 중1~2 · 중3 · **고1**.
그 위는 「고1 초과」로 남기고, 그 구간은 수능 축이 맡는다.

### 6-2. 판정 기준 — **FK 단독을 그만두고, 위쪽은 세 축을 AND 로 건다**

⚠️ **쓰지 않는 것부터 적는다.**
- **VOA 의 선언 Level 1/2/3 은 쓰지 않는다.** 정찰이 세 쪽이 같은 목록을 나열하는 것을
  확인했고, 이 저장소는 과거에 실측으로 **선언 Level 3(CEFR 지수 1.85)이 Level 2(2.38)보다
  쉬웠다**며 그 축을 이미 철회했다(`voa.ts` 주석 · [voa.md](./source-probe/voa.md) §8).
- **소스가 스스로 붙인 학년 표기 일반**을 쓰지 않는다. StoryWeaver Level 1 도 같은 이유로
  실측 FK 1.42 였다(초4 교재 1.81 보다 아래).

**제안하는 고1 칸의 정의** — 시중 고1 **본책 7종**(미리보기·정답해설 제외) 실측 기준:

| 축 | 값 | 근거 |
|---|---|---|
| FK 창 | **9.0 ~ 11.5** | 본책 FK 중앙 9.62 · 평균 9.87. 아래는 중3 과 겹치게, 위는 수능특강(11.53) 직전까지 |
| **음절/낱말 하한** | **≥ 1.50** | 본책 평균 1.527. 초 1.417 · 중1~2 1.492 · 고1 1.527 · 고3 1.598 로 **유일하게 단조**인 축. 문장 길이는 고1에서 포화한다 |
| 어수 창 | 100 ~ 200 (기존 그대로) | 학년을 가르지 못하므로 칸마다 다르게 두지 않는다 |
| 어휘 밖 % | **`CURRICULUM_SPEC.outside.high.p90` 이하** | 값이 아직 **없다**. §6-4 1단계 산출물 |
| 자립성 | 기존 `standalone.ts` 그대로 | 서사 편중을 잡는 유일한 축 |

**음절/낱말 하한을 새로 넣는 것이 이 제안의 핵심**이다. 그것 없이 FK 창만 위로 이으면
고1·고2·고3 이 한 칸에 뭉치고(§3), 「중3 칸이 실은 고1 칸이었다」와 같은 사고가
한 단 위에서 반복된다. `compose/spine.ts` 의 `REGISTER_FLOOR` 가 **이미 같은 축을
같은 방향으로 쓰고 있다**(평균 낱말 길이 하한 — high 5.16) — 새 발명이 아니라
쓰던 축을 선별 쪽으로 가져오는 것이다.

**함께 정해야 할 것 — `marketFk` 셈법.** 지금은 그 학년대 전 역할의 **평균**이고,
중3 이 미리보기 이상값 하나로 9.45 → 10.67 이 됐다(§3). 여섯 칸을 한 규칙으로 두려면
**중앙값 + 역할 가중**(본책·본문 우선)으로 바꿔야 하고, 그러면 **기존 다섯 칸의
`marketFk` 도 함께 움직인다.** 회귀 `excerpt.test.ts` 의 「marketFk 단조 증가」 단언이
그 변화를 잡는다 — 그래서 조용히 지나가지 않는다.

### 6-3. 마이그레이션이 필요한가 — **스키마는 아니다**

확인한 것:

- `library_articles.feed_label` 은 **제약 없는 `text`** 다. `'PD 발췌 · 고1'` 을 넣는 데
  DDL 이 필요 없다. 인덱스 `idx_la_feed (feed_id, feed_label)` 도 새 값을 그대로 받는다.
- `idx_la_band_id (article_v_level, id)` 는 **V-Level 인덱스**지 이 밴드와 무관하다.
- 밴드 값을 검사하는 `CHECK` 제약·`enum`·도메인은 **DB 에 없다**(마이그레이션 전수 확인).

**선택적으로 필요한 것 하나** — `csat_source_targets` 에 칸 몫이 seed 로 들어 있다
(`20260906200000_csat_source_console.sql`):

```sql
-- 되돌리기: delete from public.csat_source_targets where key = 'kid:high1';
insert into public.csat_source_targets
  (key, label, scope, match, mode, target_value, basis, sort_order, note, created_by)
values
  ('kid:high1', '고1', 'kid',
   '{"feedId":"kid-excerpt","feedLabel":"PD 발췌 · 고1"}',
   'ratio_of_pool', 0.1, '{"vMin":5,"vMax":9}', 60,
   '고1 칸 신설 — 몫은 기존 다섯 칸과 같은 1/10 로 두고, 여섯 칸 합계 재산정은 별도 결정',
   'reading-band-gap')
on conflict (key) do nothing;
```

⚠️ 기존 다섯 행이 각각 `ratio_of_pool 0.1`(= 고등 재고의 절반을 다섯으로)이다.
여섯 번째를 같은 0.1 로 넣으면 **합계가 0.5 → 0.6 이 된다.** 그대로 둘지
다섯 칸을 0.0833 으로 내릴지는 **목표량 결정**이지 이 문서가 정할 것이 아니다.
(위 SQL 은 「그대로 둔다」 쪽이다.)

### 6-4. 단계 — 무엇을 먼저 하면 나머지가 쉬워지는가

**순서의 원칙: 되돌릴 수 없는 것(적재된 라벨)을 가장 뒤로 민다.**

| 단계 | 하는 일 | 되돌릴 수 있는가 |
|---|---|---|
| **1. 자를 먼저 잰다** | `passage-mine.mjs` 의 `grade_min <= 9` 를 인자로 빼고 고등 51종에 돌려 `CURRICULUM_SPEC.outside.high` 의 p05~p95 를 낸다. 같은 실행에서 고등 본책의 FK·음절/낱말 분포도 낸다 | **되돌릴 것이 없다** — 읽기 전용, 리포트만 |
| **2. `marketFk` 셈법을 정한다** | 평균 → 중앙값(+역할 가중). 다섯 칸의 값이 함께 움직이고 `excerpt.test.ts` 단조 단언이 그것을 보인다 | 코드만 — revert |
| **3. 밴드를 늘린다** | `READING_LEVEL_BANDS` 에 고1 한 칸 + `ReadingLevelBand` 에 음절/낱말 하한 필드 + `SchoolLevel` 에 `'high'`. 타입이 §5 의 연쇄를 강제한다 | 코드만 — revert |
| **4. 게이트 조임 폭을 먼저 잰다** | `schoolOfVLevel` 이 V≥5 에 `high` 를 돌려주게 되면 지금 `usable` 인 고등 재고 몇 편이 `blocked` 이 되는가. **`source-eligibility-scan.mjs` 로 세어 보고 나서** 반영 | 측정 단계 — 되돌릴 것 없음 |
| **5. 이름을 바로잡는다** | 「PD 발췌 · 중3」 1,933편을 실측 FK 로 재판정해 1,430편을 「PD 발췌 · 고1」로 옮긴다 | **UPDATE 지만 가역** — `feed_label` 은 파생값이라 반대 UPDATE 로 복구된다. 다만 **가장 되돌리기 번거로운 단계라 마지막** |
| **6. 장르 편중을 푼다** | VOA 사이트맵(미확보 33,300 · 전문 FK 중앙 9.05) → 고1 칸의 설명문. futurity 발췌(전문 중앙 14.67)는 발췌기로 내려 붙인다 | 적재 — 소스 단위로 되돌릴 수 있다 |

**1번이 없으면 3번을 할 수 없다.** `SchoolLevel` 에 `'high'` 를 더하는 순간
`CURRICULUM_GATE.high.maxOutsidePct` 가 필요한데 그 값이 없기 때문이다.
값을 짐작으로 채우면 이 파일이 스스로 경고한 실수를 반복한다 —
「이전 판은 문턱이 40 하나였고, 그 값은 **재서 정한 것이 아니라 정한 것**이었다」.

### 6-5. 되돌릴 수 있는가 — 항목별

| 바꾸는 것 | 되돌리기 | 위험 |
|---|---|---|
| `READING_LEVEL_BANDS` 에 칸 추가 | git revert | 없음. 조판(출고)은 이 표를 안 본다 |
| `marketFk` 셈법 변경 | git revert | 다섯 칸의 창 근거가 함께 움직인다 — 회귀가 보여 준다 |
| `SchoolLevel` 에 `'high'` | git revert | **게이트가 조여진다** — 되돌리면 다시 느슨해지므로 4단계 측정이 먼저 |
| `csat_source_targets` 행 추가 | `delete … where key='kid:high1'` | 없음 |
| **`feed_label` 재라벨 UPDATE** | 반대 UPDATE(파생값이라 원본 손실 없음) | **중간에 다른 세션이 그 칸을 세면 수치가 흔들린다** — 스냅샷(`csat_source_snapshot_take`)을 앞뒤로 뜨고 하는 것이 안전 |
| 새 밴드로 적재한 행 | 밴드를 철회하면 그 행들은 **어느 칸에도 안 드는 유령이 된다** | 그래서 6단계를 3~5단계 뒤에 둔다 |

### 6-6. 영향 받는 코드 — 실측 목록

**정본·타입 (반드시 함께)**

- `packages/library-pipeline/src/textbook/readability.ts` — `READING_LEVEL_BANDS` · `ReadingLevelBand` · `bandOf()` (`'중3 초과'` 문자열)
- `packages/library-pipeline/src/textbook/curriculum.ts` — `SchoolLevel` · `CURRICULUM_SPEC.outside` · `CURRICULUM_GATE` · `AUTHORED_VOCAB_BAND` · `marketPercentile()` · `curriculumFit()`
- `packages/library-pipeline/src/textbook/source-eligibility.ts` — `schoolOfVLevel()` · `judgeSource()` ⑦어휘 축 · `ELIGIBILITY_BAND_LABELS`
- `packages/library-pipeline/src/textbook/kid-source.ts` — **`KID_BANDS`(밴드 목록 사본)** · `KID_SOURCE_TARGET` · `kidFeedLabel()`
- `packages/library-pipeline/src/textbook/excerpt.ts` — `options.bands` 기본값
- `packages/library-pipeline/src/index.ts` — 배럴 재수출

**화면**

- `apps/web/src/lib/textbook/kid-source-stats.ts` · `apps/web/src/lib/textbook/source-eligibility-view.ts`
- `apps/web/src/app/admin/csat/sources/{page.tsx,SourceEligibilityClient.tsx}`
- `apps/web/src/app/admin/csat/sourcing/{page.tsx,SourceClient.tsx}`

**스크립트 (밴드를 읽어 담는 쪽)**

- `scripts/textbook/harvest-gutenberg-kid.mjs`(밴드별 수확 루프) · `storyweaver-ingest.mjs` ·
  `space-place-ingest.mjs` · `frym-ingest.mjs` · `write-drain-import.mjs` · `kid-inventory.mjs`
- `scripts/textbook/grade-level-bench.mjs`(`BAND_SPEC`) · `excerpt-probe.mjs` ·
  `graded-source-probe.mjs` · `kid-source-probe.mjs` · `authored-sweep.mjs` · `source-eligibility-scan.mjs`
- **`scripts/textbook-corpus/passage-mine.mjs`** — `grade_min <= 9` (1단계의 그 한 줄)

**회귀 (깨질 것을 미리 안다)**

- `excerpt.test.ts` — `marketFk` 단조 · `bandOf(20) === '중3 초과'` 단언
- `kid-source.test.ts` — 다섯 칸 전제 · `kidFeedLabel` 라벨 형식
- `source-eligibility.test.ts` — `schoolOfVLevel(6) === null` 단언
- `readability-parity.test.ts` · `level-chart.test.ts`

**영향 없음 (확인함)**

- `scripts/textbook/volume-pool.mjs` — 조판 풀은 `article_v_level` 로만 고른다
- `packages/library-pipeline/src/textbook/series.ts` — step 5~7 이 이미 고1~고3 을 갖고 있다
- `scripts/csat/data/type-bands-all.json` · `check-passage-band.mjs` — 수능 유형별 문체 대역(다른 축)
- `scripts/csat/gate-rules.mjs` — `purposeOf()` 는 `feed_id='kid-excerpt'` 로 가르므로 새 라벨을 그대로 받는다.
  ⚠️ 다만 `PURPOSE_RULE.kids` 는 **서사를 허용**한다 — 고1 이 학평 대비 구간임을 감안하면
  그 규칙을 고1 에도 그대로 적용할지는 **별도 결정**이다

---

## 7. 남은 물음 — 임의로 정하지 않는다

| # | 물음 | 왜 지금 못 정하는가 |
|---|---|---|
| 1 | 고1 칸의 몫을 얼마로 두는가 | `csat_source_targets` 다섯 행이 각 0.1 이다. 여섯째를 더하면 합이 0.6 — 「고등 재고의 절반」이라는 원 근거를 다시 정해야 한다 |
| 2 | `marketFk` 를 평균에서 중앙값으로 바꿀 것인가 | 바꾸면 **다섯 칸의 근거 수치가 전부 움직인다**. 측정이 아니라 규격 변경이다 |
| 3 | 고등 어휘 문턱을 p90 으로 둘 것인가 | 초·중은 p90 이다. 고등은 분포를 아직 안 쟀다(1단계) |
| 4 | 고1 에 서사를 허용할 것인가 | `PURPOSE_RULE.kids` 는 허용, `csat` 는 유형별. 고1 은 두 성격이 겹치는 첫 칸이다 |
| 5 | `/fit` 의 V-Level 라벨(V5=중3)을 DB(V5=고1)에 맞출 것인가 | 이 작업 밖이지만 고1 칸을 열면 사용자에게 보이는 불일치가 된다 |

---

## 8. 이 조사가 쓴 자료

- 시중 코퍼스 `d:/workspace/textbook-corpus/corpus.db` — 문서 94 · 쪽 5,229 ·
  고등 51종 3,225쪽(FK 평균 11.01) · `node scripts/textbook-corpus/query.mjs sql …`
- `library_articles` 전수 SQL — FK 를 `readability.ts` 와 같은 식으로 서버에서 계산
  (음절 근사까지 같은 규칙: `length<=3 → 1`, 어말 `es|ed|e` 절단, 어두 `y` 절단,
  `[aeiouy]{1,2}` 군 세기)
- `vocaflow_levels` 12행 · `csat_source_targets` seed · 마이그레이션 전수 grep
- [source-probe/SUMMARY.md](./source-probe/SUMMARY.md) §6 · [voa.md](./source-probe/voa.md) §8 ·
  [education-reading.md](./source-probe/education-reading.md) 머리말 ·
  [wikipedia.md](./source-probe/wikipedia.md) §7

**이 문서는 아무것도 고치지 않았다.** 밴드 정의·마이그레이션·라벨 어느 것도 건드리지 않았다.
