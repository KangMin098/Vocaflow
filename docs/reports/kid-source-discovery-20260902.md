# 초·중 지문 소스 발굴 — 문제는 편수가 아니라 **종류**였다

**실측일 2026-09-02** · 도구 `scripts/textbook/kid-source-probe.mjs` · UA 밝힘 · 읽기 전용

---

## 1. 결론부터

**초·중 교재의 원문 재고는 NASA 사진 설명글 하나에 걸려 있다.**

DB 실측(`library_articles`, `ready`+`published`, `display_only` 제외 — 19,350편):

| | 초창 44~121어 | 중창 42~173어 |
|---|---|---|
| 전체 | **141** | **154** |
| 그중 NASA | 98 (70%) | 105 (68%) |

그리고 그 NASA 몫은 전부 `nasa.gov/image-article/…` · `/image-detail/…` — **사진 설명글**이다.
"Starry Chandelier Cluster"(56어) · "Guinea-Bissau Tidal Waters"(102어) 같은 것들이다.

register 를 세면 더 분명하다:

| register | 편수 | 소스 수 |
|---|---|---|
| expository | 126 | 2 |
| news | 62 | 1 |
| reference | 2 | 1 |
| **narrative** | **0** | — |

**이야기 지문이 한 편도 없다.** 시중 초·중 교재에서 이야기가 차지하는 비중을 생각하면
이건 재고 부족이 아니라 **종류 부재**다 — 편수를 늘려도 같은 사진 설명글이 늘 뿐이다.

나머지 19,000편은 초·중 창에 애초에 못 들어온다. PLOS 평균 4,470어 · Wikipedia 3,756어 ·
Wikivoyage 7,822어 — **성인 장문 코퍼스**다.

⚠️ 기존 벤치마크 7축(A1~A7)은 전부 **문항·해설** 축이다. 원문 자체를 재는 축은
A6(어수 규격) 하나뿐이고 그것도 길이만 본다. **"원문이 시중보다 우위인가" 를 묻는 자가 없었다.**

---

## 2. 무엇을 쟀나 — "피드가 열린다" 는 답이 아니다

후보 소스에 물어야 할 것은 셋이다.

1. **어수** — 그 소스의 *본래 단위*가 초창·중창에 드는가. (창은 `market-spec.json` 의
   시중 79종 실측 p10~p90 을 그대로 쓴다. 여기서 새로 만들지 않는다.)
2. **라이선스** — 재배포 가능한 표시가 **그 글 안에** 있는가. 사이트 약관이 아니다.
3. **register** — narrative 인가 expository 인가. **이게 이 조사의 실제 목적이다.**

---

## 3. 실측 — 5개 소스 (표본 16 / 칸)

| 소스 | register | 전체 | 중앙어수 | 초창% | 중창% | CC 확인 | 초창 추정 | 중창 추정 |
|---|---|---|---|---|---|---|---|---|
| **storyweaver:L1** | narrative | 5,281 | 151 | 43.8 | 56.3 | 16/16 | **2,313** | **2,973** |
| storyweaver:L2 | narrative | 5,453 | 351 | 0 | 12.5 | 16/16 | 0 | 682 |
| storyweaver:L3 | narrative | 3,683 | 837 | 0 | 0 | 16/16 | 0 | 0 |
| african_storybook:L1 | narrative | 298 | 170 | 12.5 | 56.3 | 16/16 | 37 | 168 |
| african_storybook:L2 | narrative | 386 | 183 | 0 | 43.8 | 16/16 | 0 | 169 |
| african_storybook:L3 | narrative | 1,881 | 281 | 12.5 | 25 | 16/16 | 235 | 470 |
| vikidia_en | expository | 6,099 | 35 | 12.5 | 18.8 | 16/16 | 762 | 1,147 |
| **frontiers_young_minds** | expository | 1,975 | 139 | 37.5 | **100** | 16/16 | 741 | **1,975** |
| **합계(추정)** | | | | | | | **4,088** | **7,584** |

현재 141 / 154 편과 견주면 **초창 29배 · 중창 49배**다. 그리고 지금 0인
**narrative 가 중창에서만 4,462편**(StoryWeaver 3,655 + ASB 807)으로 생긴다.

### 소스별 성격

- **StoryWeaver**(Pratham Books, 인도) — 영어책 16,779권(L1 5,281 · L2 5,453 · L3 3,683 · L4 2,362).
  라이선스가 책 뒷장에 **글로 박혀 있다**("Released under CC BY 4.0 license"). 읽기 수준이
  메타데이터에 있어 창 맞추기가 API 파라미터 하나(`levels[]`)로 끝난다.
  영어가 제2언어인 독자를 상정하고 쓰인 글이라 한국 초·중 학습자와 전제가 같다.
- **African Storybook**(Saide, 남아공) — 영어책 3,182권. 수준 1~5. 이용자 투고본이 섞여
  길이 분포가 넓다(63~921어). L1·L2 가 중창에 잘 든다.
- **Vikidia**(영어판) — 8~13세 백과 6,099항목, CC BY-SA 3.0. 도입부(`exintro`)가 본래
  짧다. MediaWiki API 라 표집이 공짜다.
- **Frontiers for Young Minds** — 8~15세 대상 **심사받는** 과학지 1,975편, CC BY 4.0.
  Crossref(ISSN 2296-6846)로 목록·라이선스·초록이 한꺼번에 나온다.
  **초록이 곧 지문 단위**이고 중창 적중이 **100%** 다(89~153어, 중앙 139어).

---

## 4. 못 연 곳 — 이유와 함께

다시 두드리지 않도록 남긴다.

| 소스 | 왜 |
|---|---|
| Science Journal for Kids | HTTP 403(봇 차단). 라이선스는 CC BY 로 명시돼 있어 **협의 여지는 있다** |
| Library of Congress `free-to-use` | 403 — Cloudflare 관문. UA 를 위장하지 않는다 |
| NIH News in Health | 403 — Cloudflare 관문. PD 라 아깝다 |
| Global Digital Library | `api.digitallibrary.io` 연결 실패, `content.digitallibrary.io/api` 404 — API 가 사라진 듯 |
| Bloom Library | `api.bloomlibrary.org/v1/classes/books` 404 — 주소가 바뀐 듯 |
| Let's Read Asia | `api.letsreadasia.org` 연결 실패 |
| NASA Space Place | `spaceplace.nasa.gov/rss.xml` 연결 실패 |
| NPS.gov | `/rss/news.xml` 404 |
| Wikijunior | `Category:Wikijunior` 가 0건 — 분류명이 다르다 |

---

## 5. 재면서 프로브가 스스로 틀린 것 넷 — 남겨 둘 값어치가 있다

이 조사에서 가장 위험했던 것은 소스가 아니라 **자를 잘못 읽는 것**이었다.

1. **`<script>` 를 안 지우고 셌다** — 231어짜리 그림책이 **997어**로 나왔다.
   교재 창 밖으로 밀려나 "쓸 수 없는 소스"가 될 뻔했다.
2. **수준을 섞어 쟀다** — StoryWeaver 가 "중앙 193어 · 초창 적중 20%"로 나왔다.
   쪼개 보니 수준이 어수를 거의 결정하고 있었다(L1 68~231 · L3 552~935 · L4 1,054).
   **평균이 답을 가렸다.** 이 소스는 "너무 길다"가 아니라 어느 수준을 가져오느냐의 문제였다.
3. **라이선스를 `/CC/i` 로만 셌다** — Crossref 는 라이선스를 URL
   (`creativecommons.org/licenses/by/4.0`)로 준다. **CC BY 4.0 인 20건을 0건으로** 적을 뻔했다.
4. **영어를 ASCII *비율*로 골랐다** — 아프리카 언어 중에도 ASCII 만 쓰는 것이 여럿이라
   100%짜리 소수 언어가 1등이 됐고, 영어 재고 3,182권이 **144권으로 보였다.** 개수로 고쳐야 했다.

그리고 하나 더 — **`fetch` 의 timeout 은 연결을 못 늘린다.** `africanstorybook.org` 는
TLS 악수에 10초가 넘게 걸리는데 Node(undici)의 `connectTimeout` 기본값이 정확히 10초이고
`AbortController` 로는 그 값을 못 바꾼다. `timeout: 180_000` 을 줘도 10초에 끊긴다.
같은 주소를 curl 은 받아 왔다 — **소스가 죽은 게 아니라 클라이언트가 못 기다린 것**이다.
`node:https` 로 받는 `getSlow()` 를 따로 뒀다.

---

## 6. 표본이 작다 — 이 표의 오차

칸마다 표본 16이다. 비율의 95% 신뢰구간이 대략 **±12%p** 이고, 실제로 Vikidia 가
연속 두 번 실행에서 초창 43.8% → 12.5% 로 흔들렸다(무작위 표집이고 토막글이 섞인다).

**그래서 4절의 추정치는 자릿수를 보는 값이지 계획에 그대로 넣을 값이 아니다.**
배선 전에 소스당 표본 100 이상으로 다시 재야 한다 — 그러면 ±5%p 안으로 들어온다.

---

## 7. 다음

1. 표본 100 으로 재측정(위 §6).
2. 상위 3곳 배선 — **Frontiers for Young Minds**(중창 100%·CC BY·심사물)를 먼저,
   다음이 **StoryWeaver L1**(narrative 0 을 깨는 유일한 대량 소스), 그다음 ASB L1·L2.
3. **원문 축(B1~) 정의** — 지금 벤치마크에는 원문을 재는 자가 없다. "원문이 시중보다
   120% 우위" 를 판정하려면 진본성 · 출처 추적성 · 라이선스 청결도 · register 다양성 ·
   신선도를 축으로 세우고 시중 79종 코퍼스에서 같은 축의 기준선을 실측해야 한다.
   **이 보고서는 그 축을 아직 만들지 않았다** — 만들기 전에 재고부터 확인한 것이다.

```bash
pnpm dlx tsx scripts/textbook/kid-source-probe.mjs                    # 전부
pnpm dlx tsx scripts/textbook/kid-source-probe.mjs --source storyweaver
pnpm dlx tsx scripts/textbook/kid-source-probe.mjs --sample 100       # 오차 ±5%p
```

---

## 8. 2차 실측 (표본 100) — 자릿수 확인

| 소스 | 표본 | 초창% | 중창% | 초창 추정 | 중창 추정 |
|---|---|---|---|---|---|
| storyweaver:L1 | 24 | 41.7 | 62.5 | 2,202 | 3,301 |
| storyweaver:L2 | 24 | 0 | 8.3 | 0 | 453 |
| storyweaver:L3 | 24 | 0 | 0 | 0 | 0 |
| african_storybook:L1 | 100 | 24 | 69 | 72 | 206 |
| african_storybook:L2 | 100 | 6 | 34 | 23 | 131 |
| african_storybook:L3 | 100 | 15 | 26 | 282 | 489 |
| vikidia_en | 50 | 34 | 42 | 2,074 | 2,562 |
| frontiers_young_minds | 50 | 30 | **100** | 593 | **1,975** |
| **합계** | | | | **5,246** | **9,117** |

1차(표본 16) 4,088 / 7,584 → **5,246 / 9,117.** 자릿수가 유지된다.
**FrYM 의 중창 100% 는 n=50 에서도 그대로다** — 초록이 규격 안에 설계돼 있다는 뜻이다.

⚠️ `--sample 100` 을 줬지만 실제로 100을 받은 것은 ASB 셋뿐이다. StoryWeaver 는
`per_page` 가 24 에서 잘리고 Vikidia `rnlimit` · Crossref `rows` 는 50 이 상한이다.
**요청한 표본과 받은 표본이 다르다** — 페이지네이션이 있어야 100 이 진짜 100이 된다.

---

## 9. 원문 축(B1~B5) — 자를 만들고 양쪽을 쟀다

`scripts/textbook/passage-axis-bench.mjs`. 우리 228편(42~173어) vs 시중 초·중 독해 37종 1,924쪽.

| 축 | 이름 | 우리 | 시중 | 판정 |
|---|---|---|---|---|
| B1 | 지문 출처 명시율 | 73.7% | **0/1,924쪽** | 범주차 |
| B2 | 재배포 가능 라이선스 비율 | 83.3% | 0% (전량 ©) | 범주차 |
| B4 | 진본 원문 비율(자작 아님) | 72.8% | 0% | 범주차 |
| B3 | register 다양성 | 3종 (**narrative 0**) | — | **FAIL** |
| B5 | 발행일 명시율 | **15.8%** | — | **FAIL** |

### 지수를 내지 않는 축이 있다

시중 기준선이 0 이면 나눗셈이 뜻을 잃는다. 실제로 사진 크레딧 2쪽을 출처로 오인했을 때
**250.772×** 가 표에 찍혔는데, 이건 우위가 아니라 **표본 잡음의 역수**다(몇 쪽 더 걸리느냐에
따라 400배도 90배도 된다). 기준선이 1% 미만인 축은 지수 대신 `범주차` 로 적는다.

그리고 그 2쪽은 열어 보니 **같은 책 사본 2벌의 `Photo Credits` 쪽**이었다 — 사진 촬영자
크레딧이지 지문 출처가 아니다. 상대에게 없는 공을 주는 방향의 오류였지만 틀린 건 같다.
(검출된 "출처" 9쪽 · "Source" 58쪽 · "adapted" 8쪽도 전부 지문·해설 **본문 안의 낱말**이었다 —
"신뢰할 수 있는 출처를 식별한다" · `resource` · `has adapted to`. 낱말로 세면 안 된다.)

### 이 자는 우리에게 유리하게만 나오지 않았다

첫 실행에서 **우리 쪽 결함이 넷** 나왔다:

- **narrative 0편** — 이야기 지문이 없다 (B3 FAIL)
- **자작 지문 62편(27%)** — `source='original'`. 시중을 "자작"이라 부르며 우리도 하고 있었다
- **발행일 미상 192편(84%)** — NASA 110편 중 92편이 날짜가 없다 (B5 FAIL)
- **재배포 불가 라이선스 38편** — `restricted` (voa 16 · nasa 12 · usgs 8 · noaa 1 · futurity 1),
  전부 `register` 가 null 인 100어 언저리 토막이라 따로 봐야 한다

**즉 "원문 120% 우위" 는 3축에서 이미 범주적으로 넘어섰고, 2축에서는 아직 미달이다.**
넘어선 셋은 시중이 안 하는 일(출처·라이선스·진본)이라 우리가 더 잘한 게 아니라 **종류가 다르다.**
미달인 둘은 우리가 고쳐야 할 것이고, B3 는 §3 의 소스 배선이 그대로 답이다.

---

## 10. 확정 실측 — 6소스 · 표본 499 · 페이지네이션 적용

**표본이 요청과 같아진 뒤의 표다.** 앞 표들은 `--sample` 을 줘도 API 상한에서 잘려
(StoryWeaver `per_page` 24 · MediaWiki `rnlimit` 50 · Crossref `rows`) 실제 표본이 더 작았고,
그러면 함께 적은 오차 폭이 거짓이 된다. 쪽을 넘겨 가며 모으도록 고친 뒤 다시 쟀다.

| 소스 | register | 전체 | 표본 | 중앙어 | 초창% | 중창% | CC | 초창 추정 | 중창 추정 |
|---|---|---|---|---|---|---|---|---|---|
| **storyweaver:L1** | narrative | 5,281 | 49 | 122 | 49 | 69.4 | 49/49 | **2,588** | **3,665** |
| storyweaver:L2 | narrative | 5,453 | 50 | 335 | 2 | 14 | 50/50 | 109 | 763 |
| storyweaver:L3 | narrative | 3,683 | 50 | 738 | 0 | 0 | 50/50 | 0 | 0 |
| african_storybook:L1 | narrative | 298 | 50 | 148 | 24 | 72 | 50/50 | 72 | 215 |
| african_storybook:L2 | narrative | 386 | 50 | 204 | 0 | 34 | 50/50 | 0 | 131 |
| african_storybook:L3 | narrative | 1,881 | 50 | 284 | 12 | 22 | 50/50 | 226 | 414 |
| vikidia_en | expository | 6,099 | 50 | 39 | 38 | 42 | 50/50 | 2,318 | 2,562 |
| **simple_wikipedia_lead** | reference | **284,757** | 50 | 54 | 46 | 50 | 50/50 | **130,988** | **142,379** |
| noaa_ocean_facts | expository | 117 | 50 | 439 | 0 | 0 | 50/50 | 0 | 0 |
| **frontiers_young_minds** | expository | 1,976 | 50 | 138 | 28 | **100** | 50/50 | 553 | **1,976** |
| **합계(추정)** | | | **499** | | | | **499/499** | **136,854** | **152,105** |

**표본 499건 전부 라이선스가 글 안에서 확인됐다(499/499).** 사이트 약관이 아니라
그 글에 붙은 표시를 본 수치다.

### 세 가지가 이 표에서 읽힌다

1. **narrative 가 0 에서 중창 5,188편**이 된다(초창 2,995). 이 조사의 실제 목적이었다.
2. **Simple Wikipedia 도입부 하나가 나머지 전부의 15배다** — 그리고 이건 *새 소스가 아니라
   이미 배선된 소스*다. 글 전체로 받아 평균 2,526어(창 밖)였을 뿐이고, **같은 소스라도
   어느 단위를 가져오느냐가 다른 소스를 만든다.** 놓치고 있던 것은 사이트가 아니라 단위였다.
3. Simple Wikipedia 를 빼도 **초창 5,866 · 중창 9,726** — 현재 141/154 의 **42배·63배**다.
   한 소스에 기대지 않아도 되는 크기다.

### 안 되는 것도 적는다 — NOAA Ocean Facts

"한 물음에 한 편" 이라 짧을 줄 알고 넣었는데 **중앙 439어, 적중 0%** 였다.
다만 그 쪽들은 `<main>` 도 `<article>` 도 없고 본문이 `<p>` 에도 없어 추출이 거칠다 —
**이 어수는 상한이다.** 껍데기를 다 걷어도 200~600어대로 보여 재수정해도 창에 들기 어렵다.
목록에서 지우지 않고 남긴다. 다음 사람이 같은 기대로 다시 넣지 않도록.

### 못 연 곳이 11 로 늘었다

새로 확인한 셋:

| 소스 | 왜 |
|---|---|
| Wikijunior | 분류가 아니라 **책 구조**(`Wikijunior/…` 접두사). `Category:Wikijunior` 는 0건, 검색 215건은 대부분 책의 속장이라 독립된 짧은 글이 적다 |
| Gutendex (Project Gutenberg) | **열린다** — 영어 아동물 **7,634권** · PD. 다만 본래 단위가 **책 한 권**이라 발췌해야 창에 든다. 발췌 경로가 생기면 **가장 큰 PD 서사 재고**다 |
| Storybooks Canada | `storybookscanada.ca` 는 200 이나 `global-asp.github.io/storybooks-canada` 는 404 — 목록 받는 경로를 못 찾았다 |

---

## 11. B5 결함의 원인과 수정 — 그리고 축이 두 번 더 틀렸다

### 원인: NASA 이미지 쪽은 날짜를 **다른 이름**으로 싣는다

`ingest-article/nasa.ts` 가 `article:published_time` 과 `<time datetime>` 만 봤다.
그 둘은 기사 쪽에는 있지만 `image-article`·`image-detail` 쪽에는 **없다** — 실측:

```
image-article   parsely-pub-date + og:updated_time
image-detail    og:updated_time 만
```

**이 결함은 아무 오류도 내지 않는다.** 글은 정상으로 들어오고 본문도 멀쩡하고
`published_at` 만 null 이다. 원문 축을 만들고 나서야 보였다.

- 패턴 4개로 확장. **순서가 뜻을 정한다** — `og:updated_time` 은 *고친* 시각이라 맨 뒤에 뒀다.
  없는 것보다 낫지만 같은 값은 아니다.
- 패턴 목록을 `NASA_DATE_PATTERNS` 로 빼서 **망 없이** 회귀 테스트를 걸었다
  (`nasa-dates.test.ts` 5종 — 예전 두 패턴으로는 못 찾는다는 **결함 재현**까지).
  `ingest-article` 126 tests 통과 · `tsc --noEmit` exit 0.
- 되메움 `scripts/textbook/nasa-date-backfill.mjs` — **146편 채움 · 실패 0**
  (그중 54편은 수정시각이라 따로 셈 · 1편은 끝내 날짜를 못 찾음).
  `published_at IS NULL` 인 것만 고르고 쓰기 시점에도 같은 조건을 다시 건다
  (워크스페이스를 여러 세션이 나눠 쓴다). 몇 번 돌려도 결과가 같다.

### 축이 두 번 더 틀렸다 — 한 번은 우리에게 유리한 쪽으로

**B4 진본성 72.8% → 56.1% (하향).** 우리가 쓴 글은 두 갈래인데 한 갈래만 빼고 있었다:

| | 편수 | |
|---|---|---|
| `source='original'` | 62 | 아예 자작 |
| `license_class='restricted'` | 38 | **재저작** — 원문 게재 권리가 없어 사실만 뽑아 다시 썼다 |

둘째 갈래는 `source_url` 이 **진짜 VOA 주소**를 가리켜서 진본처럼 보인다. 하지만 제목도
본문도 우리 것이다 — *"Australian Navy Rescues Rower Crossing Pacific from California"* 가
*"A Man Rows Across the Sea"* 로 바뀌어 있다. **자를 우리에게 유리한 쪽으로 잘못 읽고 있었다.**
(38편이 한 무리라는 근거: `restricted` 는 전체 38행뿐이고 register 가 **0/38**, 평균 107어다.)

**B5 발행일 61.0% → 99.2% (분모 정정).** 자작·재저작 글에 발행일이 없는 것은 **맞다** —
어디에도 발행된 적이 없으니까. 그걸 분모에 넣으면 고칠 수 없는 몫이 영영 미달로 남고,
정말 고쳐야 할 "진본인데 날짜를 못 읽은" 몫이 그 안에 묻힌다. 진본만 분모로 삼으니
**128편 중 127편**이고 남은 1편이 실제 결함이다.

### 지금 축 (2026-09-02 확정)

| 축 | 우리 | 시중 | 판정 |
|---|---|---|---|
| B1 지문 출처 명시율 | 73.7% | 0/1,924쪽 | 범주차 |
| B2 재배포 가능 라이선스 | 83.3% | 0% | 범주차 |
| B4 진본 원문 비율 | **56.1%** | 0% | 범주차 |
| B3 register 다양성 | 3종 (**narrative 0**) | — | **FAIL** |
| B5 발행일 명시율(진본 기준) | **99.2%** | — | ok |

남은 결함 셋 — **narrative 0** · 우리가 쓴 글 100편(44%) · 재배포 불가 38편.
셋 다 §10 의 소스를 배선하면 분모가 커지며 함께 옅어진다. **B3 는 배선 말고는 답이 없다.**

---

## 12. 배선 — StoryWeaver (코드 완료 · 마이그레이션 승인 대기)

**B3(narrative 0)는 소스를 배선하지 않으면 풀 수 없는 축이다.** 그래서 배선했다.

| | |
|---|---|
| 어댑터 | `packages/library-pipeline/src/ingest-article/storyweaver.ts` |
| 피드 | `level-1`(중앙 122어 · 초창 49% · 중창 69%) · `level-2`(중앙 335어 · 중창 14%) |
| 정책 | `SOURCE_SPECS` · `SOURCE_DEFAULT_SPEC` · `SOURCE_POLICIES` · `SOURCE_REGISTER_DEFAULT`(**narrative**) · `beginner` 랭킹 1순위 |
| 회귀 | `storyweaver.test.ts` **13종** — 망을 안 탄다 |
| 검증 | 패키지 전체 **1,188 tests 통과 (87 파일)** · `tsc --noEmit` exit 0 |

### 배선에서 지킨 것 셋

1. **적중 0% 인 Level 3 이상은 피드 목록에 넣지 않았다.** 목록에 두면 대량 GET 화면에서
   고를 수 있게 되고, 고르면 창 밖 글만 쌓인다. 테스트가 이 목록을 잠근다.
2. **라이선스를 못 읽으면 `restricted` 로 떨어뜨린다.** 못 읽었다는 것은 "CC 다" 가 아니라
   "모른다" 이고, 모르는 것을 발행하면 그때는 되돌릴 수 없다. `SOURCE_SPECS` 에 적힌
   `CC-BY-4.0` 은 **다수값**이지 그 책의 값이 아니다 — 정본은 책 뒷장의 표시다.
3. **`recencyDays: null`.** 그림책에는 발행일이 없다. recency 를 켜 두면 전량이 0점이 되어
   큐레이션이 통째로 걸러 낸다 — **소스를 넣고도 한 편도 안 들어오는 실패**다.

타입체커가 빠진 registry 하나(`SOURCE_POLICIES`)를 잡아 줬다. 이 저장소의 소스 배선은
`Record<SourceKey, …>` 가 여섯 군데라 하나만 빠져도 컴파일이 막힌다 — 좋은 설계다.

### 막고 있는 것 — CHECK 제약 하나

`library_articles.source` 에 CHECK 제약이 있고 거기에 `storyweaver` 가 없다.
**마이그레이션은 자동 적용하지 않는다**(저장소 규칙) — SQL 을 `supabase/migrations/
_pending_storyweaver_source.sql` 에 두고 승인을 기다린다.

`NOT VALID` → `VALIDATE` 2단으로 나눴다. `ALTER TABLE ... ADD CONSTRAINT` 는
ACCESS EXCLUSIVE 를 잡고 CHECK 검증이 24,738행 전수 스캔이라, 한 번에 하면 그동안 표가 멈춘다.

**적용 뒤 순서**: 마이그레이션 → `listStoryweaverFeed('level-1')` 로 소량 GET →
`passage-axis-bench` 재실행해 B3 가 실제로 바뀌었는지 확인. 그 전에는 "narrative 를 메웠다"
고 적지 않는다 — 코드가 있는 것과 재고가 생긴 것은 다르다.
