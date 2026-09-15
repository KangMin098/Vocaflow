<!-- docs/reports/source-probe/oer-textbooks.md -->
# OER 교과서 6곳 확보 정찰 — OpenStax · LibreTexts · BCcampus · OER Commons · Open Textbook Library · Pressbooks Directory

> 목표 표 13·26·27·28위 합계 추정 2,100편 · 현재 확보 0편.
> 규격: [SPEC.md](./SPEC.md). **적재하지 않았다** — 표본 외 대량 내려받기 없음, DB 미기록.
> 정찰 일자 **2026-09-07**. 모든 수치는 이날 실제 호출한 결과다.

## 0. 한 줄 요약

| 소스 | 판정 | 확보 가능 편수 (실측) | 라이선스 | 전문 | 안정 식별자 | 증분 커서 |
|---|---|---|---|---|---|---|
| **OpenStax** | **채택(한정)** | 장 도입부 **474편** / CC BY 26권 7,190쪽 | 항목별 — CC BY 4.0 46 · **BY-NC-SA 72** · 없음 11 (전수 129) | 온다 (REX 서버렌더) | `openstax.org/books/<slug>/pages/<page>` (**리디렉션 후** URL) | CMS API 1콜 전수 재대조 |
| **BCcampus (opentextbc.ca)** | **채택** | CC BY계열 **59권 · 389만 어** (열거 90권 중) | 책마다 `metadata.license.url` — 열거분 66% 가 BY/BY-SA/CC0 | 온다 (**REST 가 챕터 HTML 을 직접 준다**) | `opentextbc.ca/<book>/chapter/<slug>` + REST `id` | REST `X-WP-Total` + 책별 TOC 대조 |
| **Pressbooks Directory** | **보류** | 3,496권 중 CC BY **약 13%** (표본 23) ≈ 450권 | ⚠️ **피드에 라이선스 필드가 없다** — 책마다 2차 호출 필요 | 피드엔 없음 (책 호스트에 있음) | `urn:pressbooks.directory:book:<id>` | OPDS `page=` + `modified` |
| **Open Textbook Library** | **보류 (카탈로그 전용)** | 자체 전문 **0** · 색인 2,005권 | 문자열 — 표본 50 중 자유 15(30%) · NC 33 | **안 온다** (외부 링크) | 숫자 `id` + `textbooks.json` | `links.next` (201쪽) |
| **LibreTexts** | **반려** | — | NC 지배 + **라벨 오기 실측** | (미확인 — 반려로 중단) | — | — |
| **OER Commons** | **반려** | — | 패싯은 있으나 항목 전문 없음 | **안 온다** (집합소) | — | API **403** |

**라이선스가 실제로 허용하는 곳: OpenStax CC BY 26권 · BCcampus CC BY계열 59권 · (2차 확인 후) Pressbooks Directory CC BY 약 450권.**

---

## 1. ⚠️ `probe-openstax.mjs` 가 이미 밝힌 것 — 그리고 왜 확보로 이어지지 않았는가

`scripts/csat/probe-openstax.mjs` (2026-09-03) 는 OpenStax 4권의 **본문 추출 가능성과 지문 적합률**을
쟀고, 그 결과가 [csat-source-fit-20260903.md](../csat-source-fit-20260903.md) §8 이다:

| 교재 | 전체 쪽 | 적합률 | 추정 적합 |
|---|---|---|---|
| Introduction to Philosophy | 135 | 36% | 48 |
| World History, Volume 1 | 207 | 50% | 104 |
| Introduction to Anthropology | 219 | 50% | 110 |
| Business Ethics | 122 | 67% | 81 |

**추출은 된다는 것이 이미 증명돼 있다.** 다시 재지 않았다. 그런데 확보로 이어지지 않은 이유는
적합률이 아니었다 — **저 4권이 전부 CC BY-NC-SA 4.0 이다.**

- `probe-openstax.mjs` 에는 **라이선스를 읽는 코드가 한 줄도 없다.** `lib-fit.mjs`·`lib-topic.mjs`
  두 자만 대고 끝난다.
- 그 결과를 옮긴 §4 는 「라이선스는 **CC BY 4.0** — `license_class=cc_by` 로 발행 가능한 등급」이라고
  적었다. **틀렸다.** 오늘 두 경로로 확인했다:
  - OpenStax CMS API — `introduction-philosophy` · `business-ethics` · `world-history-volume-1` ·
    `introduction-anthropology` · `us-history` 전부 `licenses/by-nc-sa/4.0`.
  - 책 자신의 REX 쪽 HTML — `introduction-philosophy/pages/1-introduction` 안의 CC 링크 3개가
    **전부 `by-nc-sa-4.0`** (CC BY 책은 `by-4.0` 2개 + 사이트 공통 `by-nc-sa` 1개가 나온다).
- 그리고 이건 **이미 알려져 있던 사실이다.** [ACP_OPENSTAX_DESIGN.md](../../ACP_OPENSTAX_DESIGN.md)
  (2026-06-28) 가 `osbooks-*` 55 repo 를 전수 스캔해 「41 NC-SA / 13 CC-BY」를 적고 **결정 게이트
  대기**로 얼려 두었다. 9월 정찰은 그 문서를 보지 않고 병목 소재만 보고 「CC BY 4.0」이라 썼다.

> **즉 §8 의 343편은 라이선스 게이트가 막는 편수다.** 병목(철학·윤리 · 역사·인류)을 메우겠다고
> 고른 4권이 하필 전부 NC 였다. 붙일 수 있는 OpenStax 책은 **다른 26권**이고, 그 26권에
> 철학·세계사·인류학은 **없다**(§2 참조). 9월 정찰이 "붙일 만하다" 로 끝난 뒤 아무 일도 일어나지
> 않은 것은 게으름이 아니라, 다음 걸음이 **코드가 아니라 결정**이었기 때문이다 —
> `ACP_OPENSTAX_DESIGN.md` §2 의 옵션 1/2/3.

### 이 정찰이 새로 더한 것

1. **CMS API 에 라이선스 필드가 있다** — `fields=license_name,license_url` 로 129권 전수를
   **한 번의 호출**로 판정할 수 있다. GitHub repo 를 55개 훑을 필요가 없었다.
2. **은퇴판(retired) CC BY 이 아직 살아 있다** — 최신판이 NC-SA 로 갈아탄 책도 이전 CC BY 판이
   REX 에서 그대로 서빙된다(psychology · american-government-3e · introduction-sociology-2e …).
   NC 전환은 소급되지 않는다. 이게 26권의 정체다.
3. **그러나 일부 은퇴 슬러그는 조용히 NC 신판으로 리디렉션한다** — §2 의 함정.

---

## 2. OpenStax — **채택(한정)**

### ① 대량 접근 경로

```
GET https://openstax.org/apps/cms/api/v2/pages/?type=books.Book&limit=200
      &fields=title,slug,license_name,license_url,book_state
→ 200 · meta.total_count 129 · 한 응답에 전권
GET https://openstax.org/books/<slug>/pages/<page-slug>     ← 본문 (REX 서버렌더)
```

쪽 목록은 REX 응답의 `window.__PRELOADED_STATE__` 안 `"slug":"…"` 에서 얻는다.
⚠️ **앵커(`<a href>`)로 뽑으면 안 된다** — 목차는 JS 로 그려서 서버 응답엔 현재 쪽 링크 하나뿐이다
(`probe-openstax.mjs` 주석에 이미 적힌 함정. 실측 재확인: 슬러그 245개 vs 링크 1개).

### ② 전문 — **온다**

문단이 `<p>` 로 서버렌더된다. 실측: `introduction-sociology-2e/pages/preface` 응답에서 쪽 슬러그
**245개** 회수, 본문 쪽에서 산문 추출 성공.

### ③ 라이선스 — **항목마다 다르다. 이게 이 소스의 전부다**

129권 전수 (`license_url` 기준):

| 라이선스 | 권수 |
|---|---|
| `by-nc-sa/4.0` | **72** |
| `by/4.0` | 46 |
| 없음(null) | 11 (스페인어판 대부분) |

영어(`locale=en`) 표기 118권 중 CC BY 45권. 그중 8권은 폴란드어인데 `locale` 이 `en` 으로 잘못
붙어 있다(`fizyka-dla-szkół-wyższych-tom-1` 등) → **영어 CC BY 후보 37권.**

37권을 실제로 호출한 결과:

| 결과 | 권수 | 내용 |
|---|---|---|
| **CC BY 로 실제 서빙** | **26** | 쓸 수 있는 것 |
| **NC 신판으로 리디렉션** | 9 | 아래 함정 |
| 404 (완전 삭제) | 2 | `introduction-sociology` · `life-liberty-and-pursuit-happiness` |

> ⚠️ **함정 — CMS 는 CC BY 라는데 본문은 NC 다.**
> `GET /books/american-government/pages/1-introduction` 은 200 을 주지만 최종 URL 이
> `…/american-government-4e/pages/1-introduction?message=retired` 다. 4e 는 **BY-NC-SA** 다.
> CMS 레코드(1e = CC BY)만 믿고 수확하면 **NC 본문이 CC BY 딱지를 달고 들어온다.**
> 걸린 9권: `american-government` · `-2e` · `principles-economics` · `principles-macroeconomics`
> (+`-ap-courses`, `-ap-courses-2e`) · `principles-microeconomics` (+`-ap-courses`, `-ap-courses-2e`).
> **방어**: 라이선스를 CMS 가 아니라 **받아 온 쪽 HTML 에서** 읽는다 (CC BY 책은 `licenses/by/4.0`
> 2회 + `by-nc-sa` 1회(사이트 공통), NC 책은 `by-nc-sa` 만 3회 — 실측으로 구분된다).

### ④ 안정 식별자

`openstax.org/books/<book-slug>/pages/<page-slug>` — **리디렉션을 따른 뒤의** URL 을 키로 쓴다.
리디렉션 전 슬러그를 키로 쓰면 1e·2e·4e 가 같은 본문을 세 번 적재한다.

### ⑤ 증분 커서

책은 거의 안 바뀐다. **날짜 커서가 필요 없다** — CMS API 1콜(129행)로 `book_state`·`license_url`
전수를 다시 받아 지난번 스냅샷과 diff 하는 편이 싸고 정확하다. 개정판이 나오면
`book_state: live → retired` 로 잡히고, 그때가 리디렉션 함정이 새로 생기는 시점이다.

### ⑥ 현실적 확보 가능 편수 — **장 도입부 474편**

CC BY 26권 = **7,190쪽**. 그중 「장 도입부」 꼴(`^\d+-(introduction|thinking-ahead|…)`) 쪽 **474개**
(전수 실측 — 26권 각각 목차를 받아 셌다):

| 갈래 | 권수 | 쪽 | 장 도입부 |
|---|---|---|---|
| 인문·사회 | 8 | 2,043 | **152** |
| 자연과학 | 6 | 2,332 | 154 |
| 수학·통계 | 12 | 2,815 | 168 |

인문·사회 8권: `psychology` 17 · `american-government-3e` 17 · `introduction-sociology-2e` 21 ·
`introduction-business` 17 · `principles-economics-2e` 34 · `principles-macroeconomics-2e` 21 ·
`principles-microeconomics-2e` 20 · `introduction-intellectual-property` 5.

> **철학·윤리 · 역사·인류 칸은 CC BY 로 못 채운다.** Philosophy · Business Ethics · World History ·
> Anthropology · U.S. History 가 전부 NC-SA 다. §1 이 말한 그대로다. `psychology`(심리·인지) ·
> `principles-economics-2e`(사회·경제) 는 채운다.

장 도입부 외에 절(section) 쪽 6,700여 개가 남는다. `probe-openstax.mjs` 실측 적합률 36~67% 를
그대로 대면 2,400~4,500편이지만 **그 적합률은 NC 4권에서 잰 값**이라 26권에 그대로 옮기면 안 된다
(수학·통계 12권은 수식 밀집이라 훨씬 낮을 것이다). **세지 않고 미측정으로 남긴다.**

### ⑦ 표본 판정 — 300어대로 잘리는가

`lib-fit.mjs`(재고 채점과 같은 자) + `lib-topic.mjs` 로 채점한 실표본:

| 표본 | 어수 | shape | pass | 소재 | 판정 |
|---|---|---|---|---|---|
| `psychology/2-introduction` | **324** | 2 | 1 | 심리·인지 | **use** — 미디어 폭력 연구를 묻는 설명문. 자족적 |
| `american-government-3e/5-introduction` | **321** | 1 | 1 | 철학·윤리 | **use** — 시민권 확장 논증. 미국 특수 맥락이라 배경지식 요구가 약간 있다 |
| `psychology/1·3·4-introduction` | 295·286·201 | — | — | — | 200~330어 대역 |
| `biology/1~4-introduction` | 188·313·168·273 | — | — | — | 자연과학은 편차가 크고 짧은 쪽이 섞인다 |
| `introduction-business/4-introduction` | **998** | 3 | 1 | 사회·경제 | **부분 reject** — 「After reading this chapter, you should be able to…」 학습목표가 남고 인물 프로필(narrative)이 섞인다. 앞머리를 더 잘라야 한다 |

> **장 도입부는 설계상 300어대다.** OpenStax 의 장 도입부는 「이 장에서 다룰 것을 실생활 장면으로
> 여는 한 쪽」이고 실측 200~330어에 몰린다. 별도 요약·발췌 없이 **쪽 하나가 지문 하나**가 된다.
> 예외는 `introduction-business` 처럼 학습목표 목록과 인물 소개를 도입부에 넣는 편집 스타일이다 —
> `probe-openstax.mjs` 의 `extractProse` 가 이미 `learning-objectives`·`os-eoc` 를 지우지만
> **`<p>` 로 쓰인 학습목표 문장은 못 걸러낸다**(실측: 998어 표본의 첫 문단이 그것이다).
> 수확기에서 「After reading this chapter」류 첫 문단 컷을 추가해야 한다.

---

## 3. BCcampus / opentextbc.ca — **채택** (가장 실용적인 경로)

이 저장소에 **이미 Pressbooks ingester 가 있다** — `packages/library-pipeline/src/ingest/pressbooks.ts`
(v06.163, 23챕터 발행). 허용 호스트에 `opentextbc.ca` 가 이미 들어 있다. 즉 **포맷 문제는 풀려 있다.**

### ① 대량 접근 경로 — REST

```
GET https://opentextbc.ca/wp-json/pressbooks/v2/books?per_page=10&page=N
    → 헤더 X-WP-Total: 212 · X-WP-TotalPages: 22   ⚠️ per_page 상한이 10 이다(11 이상은 400)
GET https://opentextbc.ca/<book>/wp-json/pressbooks/v2/metadata     → schema.org Book + license
GET https://opentextbc.ca/<book>/wp-json/pressbooks/v2/toc          → parts[] · chapters[] · link
GET https://opentextbc.ca/<book>/wp-json/pressbooks/v2/chapters?per_page=8&_fields=id,title,link,content
```

### ② 전문 — **온다. 그것도 HTML 을 긁지 않고**

`chapters?_fields=content` 가 **챕터 본문을 렌더된 HTML 로 응답에 직접 담아 준다**
(실측: `preconfederation` 8챕터 = 54,575 bytes 한 번에). 쪽마다 GET 하는 지금의 Pressbooks
ingester 방식보다 싸고, 테마 HTML 파싱 위험이 없다.

### ③ 라이선스 — **책마다 권위 있게 온다**

`metadata.license` 가 `{"@type":"CreativeWork","url":"…/licenses/by-sa/4.0/","code":"CC BY-SA", …}`
로 온다(실측 `hcasupplement`). 열거한 **90권**(22쪽을 돌았으나 중간에 레이트리밋으로 90권에서
멈췄다 — 전체는 212권)의 분포:

- **CC BY / CC BY-SA / CC0 = 59권 (66%)** · 그 59권 합계 **3,892,731 어**
- 90권 전체 합계 6,665,799 어 · 언어 en 37 · en-ca 52 · fr-ca 1

> BCcampus 는 주(州) 예산 OER 라 자유 라이선스 비율이 일반 Pressbooks(§4 의 13%)보다 **5배 높다.**
> 여기가 이번 정찰의 최대 수확이다.

### ④ 안정 식별자

`opentextbc.ca/<book-slug>/chapter/<chapter-slug>` (사람이 읽는 키) + REST `id` (수치 키).
둘 다 책 안에서 고정이다. `<book-slug>` 는 개정 때 `…2ndedition` 처럼 새 슬러그를 받으므로
OpenStax 같은 리디렉션 함정이 없다.

### ⑤ 증분 커서

`X-WP-Total` 로 책 수를 대조하고(212), 책별 `toc` 의 챕터 목록을 지난번과 diff 한다.
⚠️ **정렬 없는 페이지네이션 함정**: `books?page=N` 은 정렬 파라미터가 없다. 2026-08-16 IA 사고
(214건 중복·동수 누락)와 같은 모양이다. **페이지 순회 결과를 그대로 믿지 말고 `id` 로 중복 제거**하고,
회수한 고유 책 수가 `X-WP-Total` 과 맞는지 매번 대조할 것. (오늘 90 ≠ 212 였다 — 레이트리밋 때문인지
페이지네이션 불안정 때문인지 **구분하지 못했다.** 수확기 1회차에서 확인해야 한다.)

### ⑥ 현실적 확보 가능 편수

실측한 것:

| 책 | 챕터 | 파트 | 라이선스 |
|---|---|---|---|
| `preconfederation` (캐나다사) | 134 | 14 | CC BY |
| `englishliterature` | 213 | 28 | CC BY |
| `geography` | 72 | 8 | CC BY |
| `introtourism` | 14 | 1 | CC BY |
| `caregivers` | 14 | 2 | CC BY |
| `accessibilitytoolkit` | 11 | 2 | CC BY |

6권 458챕터 · 55파트. 편차가 크다(11~213).

- **파트 도입부**(「N.1 Introduction」꼴) = 파트 수와 거의 같다. 6권에서 **55편**.
  59권 환산 **약 540편** — 다만 6권 표본의 분산이 커서 이 환산은 **약한 근거**다.
  확실한 것은 실제로 센 55편뿐이다.
- 챕터 전체는 6권 458편 → 59권 환산 약 4,500편. 자유분 389만 어를 300어 창으로 자르면
  **상한 약 13,000창** (전량이 지문감이라는 뜻은 아니다).

### ⑦ 표본 판정

`preconfederation`(CC BY · 캐나다 선주민/식민사 — **역사·인류 병목 칸**) 파트 도입부 5편:

| 챕터 | 어수 | shape | pass | 소재 | 판정 |
|---|---|---|---|---|---|
| 1.1 Introduction | **498** | 3 | **3** | 역사·인류 | **use** — 「역사가는 무엇을 근거로 아는가」 사료론. 자족적 설명·논증문 |
| 3.1 Introduction | **405** | 2 | 2 | 역사·인류 | **use** — 15세기 항해 확장의 동기 분석 |
| 8.1 Introduction | **354** | 2 | 1 | 사회·경제 | **use** — 환경과 인구 분포 |
| 7.1 Introduction | 336 | 1 | 0 | 사회·경제 | 경계 — 고유명사(미국 독립전쟁·13개 식민지) 밀도가 높다 |
| 5.1 Introduction | 166 | 0 | 0 | 사회·경제 | **너무 짧다** — 300어 창이 하나도 안 나온다 |

**5편 중 3편 통과.** OpenStax 장 도입부보다 조금 길고(330~500어) 논증 밀도가 높다.
⚠️ 캐나다·영국사 고유명사가 많아 **수능 지문으로는 배경지식 부담**이 걸리는 편이 섞인다 —
`lib-fit` 은 이걸 안 본다. 실제 채택률은 여기서 더 깎일 것이다.

### ⑧ 운영 함정 — UA 와 레이트리밋 (실측)

- `pressbooks.pub` 계열은 `User-Agent: Vocaflow/1.0 …` 에 **403** 을 준다. 브라우저 UA 로 바꾸면
  200. 현행 `pressbooks.ts` 의 `Vocaflow-LCP/2.0 (research)` 도 같은 벽에 걸릴 가능성이 높다.
- `opentextbc.ca` 는 250ms 간격 20여 요청 뒤 **403 으로 전환**되고 몇 분 뒤 회복했다.
  **간격을 1초 이상으로 두고, 403 을 「막힘」이 아니라 「쉬라」로 처리**해야 한다.

---

## 4. Pressbooks Directory — **보류** (발견 경로로는 유효, 수확 경로로는 미완)

### ① 접근 경로 — 문서화된 API 는 없다. `/opds` 하나뿐

`/api/books` · `/api/v1/books` · `/search` · `/sitemap.xml` **전부 404**. 사이트가 Laravel+Inertia SPA 라
부트스트랩 HTML 의 `data-page` → `props.ziggy.routes` 에 **전체 라우트 표**가 들어 있다. 그 표에서
기계가 읽을 수 있는 유일한 것:

```
GET https://pressbooks.directory/opds?page=N     → application/opds+json
    metadata.numberOfItems 3496 · itemsPerPage 20 · 175 페이지
```

### ② 전문 — **피드엔 안 온다**

레코드에 있는 것: `identifier`(urn) · title · author · language · publisher · description(잘림) ·
subject[] · self 링크(책 호스트) · **EPUB · PDF 취득 링크**. 본문은 책 호스트로 가야 한다.

### ③ 라이선스 — ⚠️ **필드가 없다**

OPDS 레코드 메타 키 전량: `@type, identifier, title, author, translator, language, publisher,
modified, description, belongsTo, subject`. **라이선스가 없다.** 따라서 디렉터리만으로는
CC BY 와 NC 를 가를 수 없고, 책마다 `<book>/wp-json/pressbooks/v2/metadata` 를 한 번 더 쳐야 한다.

그 2차 호출로 실제 판정한 표본 24권 (23권 응답 · 1권 410):

| | CC BY | CC BY-NC-SA | CC BY-NC | CC BY-NC-ND |
|---|---|---|---|---|
| 권수 | **3** | 17 | 1 | 2 |

**CC BY 13%** → 3,496권 중 **약 450권** 추정. (n=23 이라 신뢰구간이 넓다 — 「약」을 지울 수 없다.)

### ④ 안정 식별자

`urn:pressbooks.directory:book:430-6` — 디렉터리 내부에서 고정. 다만 실제 본문 키는 책 호스트 URL 이라
**둘을 같이 저장**해야 한다(디렉터리에서 빠져도 책은 남는다).

### ⑤ 증분 커서

`modified` 필드가 있고 `?page=` 가 있다. ⚠️ **정렬 파라미터가 없어** IA 사고와 같은 형태다.
`identifier` 로 중복 제거하고 회수 고유 건수를 `numberOfItems`(3,496)와 대조해야 한다.

### ⑥ 현실적 확보 가능 편수 — **셀 수 없었다**

표본 80권(4페이지)에서 **호스트가 43개** 나왔다: `ecampusontario.pressbooks.pub` 11 ·
`milnepublishing.geneseo.edu` 10 · `usq.pressbooks.pub` 5 · `www.saskoer.ca` 3 · `viva.pressbooks.pub` 3 ·
`pressbooks.umn.edu` 3 · `books.lib.uoguelph.ca` 3 … 언어는 en 79 / es 1.

> **호스트가 흩어진 것 자체는 §9(DOAJ) 같은 치명상이 아니다** — 43개 전부 같은 Pressbooks 를 돌리므로
> **파서 하나가 전부를 커버한다.** 진짜 비용은 두 가지다:
> ① `pressbooks.ts` 의 호스트 allowlist 를 4개 패턴에서 **수백 호스트로** 넓혀야 하고
>    (그건 SSRF 방어를 느슨하게 하는 일이라 설계 결정이 필요하다),
> ② 라이선스 2차 호출이 **책 수만큼**(3,496회) 필요하다.

### ⑦ 표본 판정

본문 표본은 **BCcampus(§3)로 대신했다** — 같은 Pressbooks 소프트웨어이고 챕터 구조가 동일하다.
디렉터리 고유의 지문 적합성 위험은 소재(대학 강의용 실무 교재·간호·경영 실습이 다수)이지 포맷이 아니다.

### ⑧ 막힌 것

Cloudflare 가 `/opds` 를 **4페이지쯤 뒤 403** 으로 막았다(13페이지를 요청해 4페이지만 받았다).
전수 3,496건을 받으려면 175요청을 **긴 간격으로 나눠** 돌려야 한다. 오늘은 표본만 받고 멈췄다.

---

## 5. Open Textbook Library (open.umn.edu) — **보류 (카탈로그 전용)**

```
GET https://open.umn.edu/opentextbooks/textbooks.json?page=N
→ 200 · links.total_count 2005 · total_pages 201 · links.next 로 이어진다
```

- **전문은 안 온다.** `formats[]` 가 밖을 가리킨다 — 표본 50권의 「Online」 호스트:
  `(Online 포맷 자체가 없음) 15` · `pressbooks.lib.vt.edu` 4 · `biz.libretexts.org` 3 ·
  `rotel.pressbooks.pub` 3 · `openstax.org` 2 · `open.bccampus.ca` 2 · `milnepublishing.geneseo.edu` 2 …
  즉 **§2·§3·§4 로 되돌아온다.** 15/50 은 온라인판이 아예 없다(PDF·인쇄만).
- 라이선스는 문자열로 온다. 표본 50권: `Attribution` 11 · `Attribution-ShareAlike` 4
  (= 자유 15권 **30%**) · `Attribution-NonCommercial-ShareAlike` 24 · `Attribution-NonCommercial` 9 ·
  `Attribution-NoDerivs` 1 · GFDL 1.
- 안정 식별자: 숫자 `id` + ISBN. 증분 커서: `links.next` (10건/쪽 · 201쪽).

> **판정 근거**: 자체 전문 0 이므로 SPEC 의 「반려」 조건(전문이 안 온다)에 해당한다. 다만
> **라이선스가 붙은 2,005권짜리 색인**이라는 가치가 따로 있다 — Pressbooks Directory(§4)가
> 라이선스 필드를 안 주는 것을 여기가 메운다. **소스가 아니라 라이선스 선별기로 보류**한다.

---

## 6. LibreTexts — **반려**

- `@api/deki/…` (MindTouch API) 는 우리 UA 로 **403**. 브라우저 UA 로는 책 HTML 200 (135KB).
- [CSAT_SOURCE_MATRIX](../../CSAT_SOURCE_MATRIX.md) §4-C 가 이미 「대부분 CC BY-NC-SA → 읽기용만」으로
  분류해 둔 곳이다. 오늘 그걸 뒤집을 근거를 찾지 못했고, **오히려 반려 근거가 하나 늘었다**:

> ⚠️ **LibreTexts 의 라이선스 라벨을 신뢰할 수 없다.**
> `human.libretexts.org/…/Introduction_to_Philosophy_(OpenStax)/01:_Introduction_to_Philosophy`
> 는 쪽에 **CC BY 4.0** 이라고 붙어 있다. 그런데 원본 OpenStax 는 같은 책을 **CC BY-NC-SA 4.0**
> 이라고 한다(§2 실측). 어느 쪽이 맞든 **미러의 라벨을 근거로 파생물을 만들면 안 된다** —
> NC 책을 CC BY 로 세탁하는 경로가 된다.

전문 추출 가능성은 **재지 않았다**(반려로 중단). 재검토 트리거: LibreTexts 가 라이선스를 항목별로
권위 있게 주는 API 를 공개할 때.

---

## 7. OER Commons — **반려**

- `https://www.oercommons.org/api/search?…` → **403** (`oercommons.org` · `www.` 둘 다).
  `robots.txt` 조차 호출에 따라 200/403 이 갈린다.
- 검색 화면은 서버렌더된다: `/search?f.search=history&f.general_subject=arts-and-humanities`
  → 200 · 315KB · **3368 Results** · 라이선스 패싯 존재(Public Domain / CC BY / BY-SA / BY-NC /
  BY-NC-SA / BY-ND / BY-NC-ND / Educational Use / All Rights Reserved).
- 그러나 **집합소다** — 항목 레코드가 밖(LibreTexts·Pressbooks·대학 사이트·PDF)을 가리키고
  전문을 담지 않는다. Open Textbook Library(§5)와 같은 성격인데 **API 가 막혀 있고 라이선스가
  문자열이 아니라 패싯이라 기계 판독이 더 어렵다.**

**판정**: SPEC 「반려」 두 조건(전문이 안 온다 · 대량 접근 경로가 없다)에 동시에 걸린다.
§5 가 같은 일을 더 잘 한다.

---

## 8. 목표 2,100편 대비 — 실측으로 세어지는 것

| 출처 | 실측 근거 있는 편수 | 성격 |
|---|---|---|
| OpenStax CC BY 장 도입부 | **474** (전수 계수) | 200~330어 · 인문사회 152 |
| BCcampus CC BY계열 파트 도입부 | **55 실측** / 59권 환산 ~540 (약한 근거) | 330~500어 · 역사·인류 포함 |
| Pressbooks Directory CC BY | 약 450**권** (편수 아님 · n=23 추정) | 미확보 |
| **합계 (도입부만)** | **약 1,000편** | 목표의 **48%** |

절 단위까지 내려가면 OpenStax 6,700쪽 · BCcampus 자유분 389만 어가 남아 있어 2,100편은
**도달 가능한 수**다. 다만 **도입부만으로는 절반**이고, 절 단위 적합률은 CC BY 책에서
**아직 재지 않았다**(§2⑥). 그 측정이 다음 걸음이다.

그리고 **철학·윤리 · 역사·인류 병목은 이 여섯 곳으로 완전히 안 메워진다** —
OpenStax 의 해당 교재가 전부 NC 이고, BCcampus 의 역사책은 캐나다사에 치우친다.

---

## 9. 수확기를 짠다면

**본뜰 것**: `scripts/csat/harvest-plos.mjs`(API 형)를 뼈대로, 본문 추출은
`scripts/csat/probe-openstax.mjs` 의 `extractProse`·`pageSlugs` 를 그대로 옮긴다
(두 함정 — 앵커 대신 슬러그, 학습목표·연습문제 선제거 — 이 이미 들어 있다).
BCcampus 는 `packages/library-pipeline/src/ingest/pressbooks.ts` 가 이미 있으므로
**쪽 GET 대신 `chapters?_fields=content` REST 로 갈아타는 것**이 실제 작업이다.

### A. `scripts/csat/harvest-openstax.mjs` — 3회로 나눠 돌린다

| 회차 | 하는 일 | 요청 수 |
|---|---|---|
| 1 | CMS API 1콜 → 129권 라이선스 스냅샷 → CC BY 후보 37권 | 1 |
| 2 | 후보마다 목차 1쪽 GET → **최종 URL 과 쪽 HTML 의 CC 링크로 라이선스 재판정** → 26권 확정 + 쪽 슬러그 전량 | 37 |
| 3 | 장 도입부 474쪽 GET → `lib-fit` 채점 → 통과분만 적재 | 474 (0.5s 간격 ≈ 4분) |

- 커서: `scripts/csat/data/openstax-cursor.json` — `{ bookSlug: { license, state, pages[], done[] } }`.
  **재실행 안전**: `done[]` 에 있는 쪽은 건너뛴다. 2회차를 다시 돌리면 라이선스 변동만 잡힌다.
- ⚠️ **2회차의 재판정을 생략하면 안 된다.** 생략하면 §2 의 리디렉션 9권이 NC 본문을 CC BY 로
  적재한다. 이건 조용히 실패한다 — 200 이 오고 본문도 멀쩡하다.
- 첫 문단이 `/^After reading this chapter|^By the end of this section|should be able to/` 면 버린다
  (실측 `introduction-business`).

### B. `scripts/csat/harvest-bccampus.mjs` — 2회

| 회차 | 하는 일 | 요청 수 |
|---|---|---|
| 1 | `books?per_page=10&page=1..22` → 212권 열거 → `metadata.license.url` 로 CC BY/BY-SA/CC0 선별 | 22 + 212 |
| 2 | 선별된 책마다 `chapters?per_page=10&_fields=id,title,link,content` 순회 → 채점 → 적재 | 책당 약 10 |

- 커서: `scripts/csat/data/bccampus-cursor.json` — `{ bookSlug: { license, total, lastChapterId } }`.
- **반드시**: 회수한 고유 책 수를 `X-WP-Total`(212)과 대조해 출력한다. 안 맞으면 멈춘다
  (정렬 없는 페이지네이션 — 2026-08-16 IA 사고와 같은 모양).
- UA 는 브라우저 UA, 간격 **1초 이상**, 403 은 실패가 아니라 백오프.

### C. Pressbooks Directory — 아직 짜지 않는다

먼저 결정할 것 두 가지가 남아 있다:
1. `pressbooks.ts` 의 호스트 allowlist 를 수백 호스트로 넓힐 것인가 (SSRF 방어 완화 — 설계 결정).
2. 3,496권 × 라이선스 2차 호출을 감당할 것인가.

정찰 단계에서 결정할 일이 아니다. **§5(Open Textbook Library)를 라이선스 선별기로 먼저 붙여
CC BY 후보를 좁히는 편이 싸다** — 2,005권 색인에 라이선스가 이미 붙어 있다.

---

## 10. 확인하지 못한 것 (정직하게)

- BCcampus 212권 중 **90권만** 열거했다. 나머지 122권의 라이선스 분포는 **모른다** —
  66% 는 90권 표본값이다.
- BCcampus 파트 도입부 편수는 **6권 55편만 실측**했다. 59권 환산 540편은 분산이 큰 환산이다.
- Pressbooks Directory CC BY 13% 는 **n=23**. 3,496권 중 450권은 넓은 구간의 점추정이다.
- OpenStax **절(section) 쪽의 CC BY 책 적합률을 재지 않았다.** §8 의 36~67% 는 NC 4권 값이다.
- LibreTexts 의 전문 추출 가능성을 재지 않았다 (반려로 중단).
- BCcampus 에서 90 ≠ 212 가 **레이트리밋 때문인지 페이지네이션 불안정 때문인지 못 갈랐다.**
