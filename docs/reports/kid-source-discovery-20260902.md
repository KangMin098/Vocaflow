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
