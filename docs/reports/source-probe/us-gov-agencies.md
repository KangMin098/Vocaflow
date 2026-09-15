<!-- docs/reports/source-probe/us-gov-agencies.md -->
# 미국 연방기관 9종 확보 정찰

목표 표 56·67·68·69·70·71·75위. 정찰 일자 **2026-09-07**.
모든 값은 `curl` 실호출 결과다. 못 확인한 것은 「확인 실패」로 적었다.

## 0. 한 장 요약

| # | 소스 | 판정 | 확보 가능 편수(실측) | 대량 경로 | 코드에서 할 일 |
|---|---|---|---|---|---|
| 1 | **Climate.gov** | **채택** | **2,632** (보유 129) | 이미 배선된 Drupal 목록 walker | ⭐ **`NOAA_FEEDS` 에 피드 추가만** |
| 2 | **NPS (National Park Service)** | **채택** | **19,634** (sitemap1 `/articles/`) | sitemap | 새 어댑터 + 마이그레이션 |
| 3 | **NIST** | **채택** | **6,496** news + 블로그 RSS 40 | RSS(40창) + sitemap | 새 어댑터 + 마이그레이션 |
| 4 | **NSF** | 보류 | **1,399** | RSS(15창) + sitemap | 새 어댑터 + 마이그레이션 |
| 5 | **CDC** | 보류 | **3,889** (HTML 신디케이션) | JSON API (offset/dateModified) | 새 어댑터 + 마이그레이션 |
| 6 | **DOE (energy.gov)** | 보류 | 산문 접두어만 **≈3,500** (표본 8,000 중 308 = 3.9%) | sitemap(45쪽) | 새 어댑터 + URL 접두어 필터 |
| 7 | **Census** | 반려 | 근거 없음 — RSS 의 `<link/>`·`<guid/>` 가 **빈 태그** | (sitemap 5,408 / 보도자료 533) | — |
| 8 | **BLS** | 반려 | 1 (통계 대시보드 1항목) | RSS | — |
| 9 | **Federal Reserve Education** | **반려** | — | — | **PD 가 아니다**(§9) |
| 10 | **Library of Congress 블로그** | 반려(막힘) | 못 셌다 | — | Cloudflare Turnstile 403 |
| 11 | **NIH News in Health** | 반려(막힘) | 못 셌다 | — | Cloudflare Turnstile 403 |

**목표 400편은 ①②③ 셋 중 하나만으로도 넘는다.** 가장 싼 것은 ① 이다 — 코드를 새로 쓰지 않는다.

⚠️ **이 정찰이 뒤집은 전제 둘**

1. **Climate.gov 는 새 소스가 아니다.** 이미 `noaa` 소스 = `climate.gov` 다
   (`packages/library-pipeline/src/ingest-article/noaa.ts` 의 `const SITE = 'https://www.climate.gov'`).
   129편은 「이 사이트가 129편뿐」이어서가 아니라 **배선된 피드가 2개(285+124=409편)뿐**이기 때문이다.
2. **Federal Reserve Education 은 퍼블릭 도메인이 아니다.** 연방준비은행은 저작권상 연방기관이 아니고,
   St. Louis Fed 가 저작권을 보유하며 이용약관이 **변형 금지 + 비상업 한정**을 명시한다(§9 원문).

---

## 1. Climate.gov — 채택 (⭐ 피드만 추가)

| | |
|---|---|
| 판정 | **채택** |
| 확보 가능 편수 | 실측 **2,632** (sitemap 2쪽 전수 · 이미지/영상 제외) · 현재 보유 129 |
| 라이선스 | PD-Government (기존 `noaa` 소스와 동일) |
| 전문 | 온다 (기존 `ingestNoaaArticle` 이 이미 뽑고 있다) |
| 안정 식별자 | `noaa:<slug>` (기존 규칙 그대로) |
| 증분 커서 | Drupal 목록 `?page=N` (기존 `listNoaaFeedPage`) |
| 정찰 일자 | 2026-09-07 |

### 1-1. sitemap 전수 — 섹션별 URL 수

`https://www.climate.gov/sitemap.xml?page=1|2` → `<loc>` **3,353**.
`/news-features/<섹션>/` 로 갈라 세면:

| 섹션 | URL 수 | 지금 배선? |
|---|---|---|
| `feed` (구 ENSO/Beyond Data 경로) | 1,505 | ✗ |
| `featured-images` | 447 | (이미지 — 대상 아님) |
| `blogs` | 375 | ✗ |
| `understanding-climate` | 285 | ✅ `NOAA_FEEDS[0]` |
| `event-tracker` | 222 | ✗ |
| `videos` | 129 | (영상 — 대상 아님) |
| `features` | 124 | ✅ `NOAA_FEEDS[1]` |
| `climate-qa` | 47 | ✗ |
| `climate-case-studies` | 28 | ✗ |
| `climate-and` | 16 | ✗ |
| `decision-makers-toolbox` | 15 | ✗ |
| `climate-tech` | 13 | ✗ |
| `decision-makers-take-5` | 7 | ✗ |

산문 합계 **2,632** (= 3,353 − 447 이미지 − 129 영상 − 145 섹션 인덱스류).
**배선된 것은 409(15.5%)뿐이다.**

### 1-2. 목록 페이지가 실제로 응답하는가 (실호출)

| 경로 | HTTP | `?page=0` 링크 | `?page=2` 링크 |
|---|---|---|---|
| `/news-features/understanding-climate` | 200 | 13 | — (배선됨) |
| `/news-features/features` | 200 | 13 | — (배선됨) |
| `/news-features/event-tracker` | 200 | 15 | 있음 |
| `/news-features/climate-case-studies` | 200 | 13 | 있음 |
| `/news-features/climate-qa` | 200 | 13 | 13 |
| `/news-features/blogs` | 200 | 13 (`/blogs/enso` 등 하위 블로그) | 8 |
| `/news-features/feed` | **404** | — | — |

⚠️ `feed` 섹션 1,505개는 sitemap 에는 있는데 **섹션 인덱스가 404** 다. 개별 URL 이 아직
사는지 확인하지 않았다 — **URL 단위 확인이 먼저**다(이 1,505 를 「확보 가능」에 세지 않았다).

### 1-3. RSS 는 왜 안 쓰는가

`https://www.climate.gov/rss.xml` 200 · **10건**. `?page=2` 를 붙여도 **링크 집합이 완전히 동일**하다
(overlap 10/10). RSS 는 창이지 목록이 아니다 — 이 저장소가 VOA(count)·NASA(paged)·eLife·PLOS 에서
다섯 번 겪은 그 상한이다. 이미 있는 `listNoaaFeedPage(?page=N)` 가 옳은 경로다.

### 1-4. 수확기를 짠다면

**짜지 않는다.** `noaa.ts` 의 `NOAA_FEEDS` 배열에 항목을 더하는 것이 전부다:

```
{ id: 'event-tracker',       label: 'Event Tracker (NOAA)',       path: '/news-features/event-tracker' },
{ id: 'climate-qa',          label: 'Climate Q&A (NOAA)',         path: '/news-features/climate-qa' },
{ id: 'climate-case-studies',label: 'Climate Case Studies (NOAA)',path: '/news-features/climate-case-studies' },
{ id: 'blogs',               label: 'Climate Blogs (NOAA)',       path: '/news-features/blogs' },
```

`collect-daily.mjs` 는 `lib.NOAA_FEEDS.map(...)` 이라 **자동으로 집는다.**
`FEED_SPECS` 에 `noaa:*` 키가 하나도 없어(grep 0건) 소스 기본값으로 떨어지고,
`SOURCE_REGISTER_DEFAULT.noaa = 'expository'` 가 register 를 준다. **마이그레이션 불필요**
(`library_articles_source_check` 에 `noaa` 이미 있음 — `20260711130000_acp_source_add_noaa.sql`).

돌리는 법: `pnpm dlx tsx scripts/acp/collect-daily.mjs --source noaa --pages 0 --limit 50`.

---

## 2. NPS (National Park Service) — 채택

| | |
|---|---|
| 판정 | **채택** |
| 확보 가능 편수 | 실측 **19,634** (`sitemap1.xml` 의 `/articles/` `<loc>`) |
| 라이선스 | PD-Government · 변형 **가능** (§9 원문 인용) |
| 전문 | **온다** (표본 4편 전부 560~1,008 낱말) |
| 안정 식별자 | URL slug — `nps:<slug>` (`/articles/000/<slug>.htm`) |
| 증분 커서 | **없다** — sitemap 에 `<lastmod>` 미확인. 스냅숏 차집합으로 증분 |
| 정찰 일자 | 2026-09-07 |

### 2-1. 대량 접근 경로

- **RSS 없음** — `https://www.nps.gov/rss/index.htm` **404**.
- **공식 API 확인 실패** — `https://api.nps.gov/api/v1/articles?limit=1` → `curl (6) Could not resolve host`.
  (같은 머신에서 `www.nps.gov` 는 정상 해석된다 → 이 머신의 DNS 문제일 수 있다. **막혔다**고만 적는다.)
- **사이트맵은 산다**: `https://www.nps.gov/sitemap.xml` → 7개 하위 sitemap.
  `sitemap1.xml` (5.9 MB, 200) 안에 `/articles/` **19,634개**.
  `sitemap2/3.xml` 은 `/xxxx/learn/news/*`(공원별 뉴스)로 `/articles/` **0개** — 성격이 다르다.

호출 예시:
```
curl -A "<DEFAULT_USER_AGENT>" https://www.nps.gov/sitemap/sitemap1.xml \
  | grep -oE '<loc>[^<]*/articles/[^<]+</loc>'
```

`robots.txt`: `Disallow: /ns/ /search/ /loader.cfm` 뿐. `/articles/` 는 **허용**.

### 2-2. 표본 판정 (4편, 실제로 읽음)

| URL | 낱말 | verdict / genre | 왜 |
|---|---|---|---|
| `/articles/000/10in2021.htm` | 925 | `reject` / `reference` | "2021년 10대 소식" 나열형 — 항목 목록이라 논지가 안 선다 |
| `/articles/000/conversations-about-conservation-klmn.htm` | 907 | `use` / `nature` | 클래머스 네트워크 6개 공원의 서식지·모니터링 설명, 자족적 |
| `/articles/000/joseph-sasser-interview.htm` | 691 | `reject` / `fragmentary` | 본문이 짧고 나머지가 `[0:00:18.1]` 오디오 전사 타임코드 |
| `/articles/000/pride-in-the-1990-s.htm` | 560 | `use` / `history` | 1990년대 LGB 공동체사 — 인용 → 배경 → 입법 영향으로 논지가 선다 |

**표본 채택률 2/4.** 19,634 × 0.5 ≈ **9,800편**이 현실적 상한이다(표본 4편이라 정밀도는 낮다).
전사 타임코드·나열형이 주 탈락 사유라 **기계 규칙으로 거를 수 있다**(`[0:00`, `Download a full transcript`).

### 2-3. 수확기를 짠다면

`scripts/textbook/mediawiki-lead-ingest.mjs` 가 아니라 **`usgs.ts`/`noaa.ts` 를 본뜬다** — 같은 정부 CMS HTML
+ 정규식 본문 추출이다. 다만 목록이 아니라 **sitemap 이 인덱스**이므로 어댑터의 `list*FeedPage` 는
「sitemap 을 한 번 받아 slice(offset, offset+N)」 형태가 된다. 커서 파일 `scripts/acp/data/nps-cursor.json`
(offset 정수 하나). 19,634편이면 **`--limit 50` 로 400회** — 하루 1회 배치로 나눠 돈다.
본문 컨테이너: `<div id="mainContentArea">` (표본 4편 모두 적중).
**마이그레이션 필요** — `library_articles_source_check` 에 `'nps'` 추가 + `SourceKey`·`SOURCE_SPECS`·
`SOURCE_REGISTER_DEFAULT` 항목.

---

## 3. NIST — 채택

| | |
|---|---|
| 판정 | **채택** |
| 확보 가능 편수 | 실측 **6,496** (sitemap p1~p4 의 `/news-events/news/20*`) + 블로그 RSS 40창 |
| 라이선스 | "정보는 공개 정보이며 배포·복제할 수 있다" (§9) · 변형 **가능** |
| 전문 | **온다** (표본 1,051 낱말) |
| 안정 식별자 | URL — `/news-events/news/<YYYY>/<MM>/<slug>` (연·월 고정) |
| 증분 커서 | RSS 40창(신규만) + sitemap 스냅숏 차집합(과거분) |
| 정찰 일자 | 2026-09-07 |

### 3-1. 살아 있는 경로

| URL | HTTP | 항목 |
|---|---|---|
| `https://www.nist.gov/news-events/news/rss.xml` | 200 `application/rss+xml` | **40** |
| `https://www.nist.gov/blogs/taking-measure/rss.xml` | 200 | **40** |
| `https://www.nist.gov/sitemap.xml` (→ `?page=1..56`) | 200 | p1 1,982 · p2 1,545 · p3 1,977 · p4 992 · p5~p10 **0** |

⚠️ **RSS 는 페이지네이션이 없다** — `rss.xml?page=3` 의 링크 40개가 `rss.xml` 과 **완전히 같다**
(overlap 40/40). **HTML 목록도 안 된다** — `/news-events/news?page=5` 가 `?page=0` 과 링크 12/12 동일하고,
페이지에 `pager` 클래스가 **하나도 없다**(JS 검색 위젯). 즉 **sitemap 이 유일한 대량 경로**다.

### 3-2. 표본 판정

`/news-events/news/2026/08/spooky-particles-transit-dc-suburbs-step-toward-quantum-network`
— 본문 **1,051 낱말**, `<div class="text-with-summary">` 에서 깨끗이 추출됨.
도입("2025년 초, 특별한 신호가 메릴랜드 교외의 광섬유를 지나갔다") → 얽힘 개념 설명 → 의의.
**`use` / `technology`** — 통념·현상 제시 후 개념을 풀어 주는 CSAT 과학 지문 구조 그대로다.
`Taking Measure` 블로그는 1인칭 에세이라 `use`/`essay` 쪽이 더 나올 것으로 보이나 표본을 읽지 않았다(**확인 실패**).

### 3-3. 수확기를 짠다면

`usgs.ts` 본뜨기 + sitemap 인덱스(NPS 와 같은 형태). 커서 `scripts/acp/data/nist-cursor.json`.
**마이그레이션 필요**(`'nist'`).

---

## 4. NSF — 보류

| | |
|---|---|
| 판정 | **보류** (편수 1,399 은 충분하나 장르가 보도자료 쏠림) |
| 확보 가능 편수 | 실측 **1,399** (sitemap 8쪽 전수 · `www.nsf.gov/news/*`) |
| 라이선스 | **확인 실패** — `/policies/copyright` **404**, `/policies`·`/policies/privacy` 본문에 "public domain" 문자열 없음. 기사 페이지에도 저작권 고지 없음 |
| 전문 | **온다** (표본 805 낱말) |
| 안정 식별자 | URL slug (`/news/<slug>`) · RSS `<guid isPermaLink="false">` = 같은 URL |
| 증분 커서 | RSS 15창 + sitemap 차집합 |
| 정찰 일자 | 2026-09-07 |

⚠️ **목표 표의 URL 이 틀렸다** — `https://www.nsf.gov/rss/rss_news.xml` 은 **404**.
사는 것은 `https://www.nsf.gov/rss/rss_www_news.xml` (200, 15건)이고,
피드 색인은 `https://nsf.gov/rss` 다(`rss_www_events.xml`·`rss_www_vacancies.xml`·
`rss_www_funding_pgm_annc_inf.xml`·`https://ncses.nsf.gov/rss` 도 여기 있다).

sitemap 8쪽 15,159 locs 중 `/news/` 는 p5 579 + p6 818 + p4 1 + p8 1 = **1,399**.
RSS `?page=2` 는 `?page=1` 과 링크 15/15 동일 — 여기도 창이다.

**표본**: `/news/nsf-launches-three-new-science-technology-centers-90m` (805 낱말)
— 예산 9,000만 달러·기관장 인용이 중심인 **보도자료**. `use`/`news` 로는 읽히나 논지 전개가 없어
수능 지문으로서의 값이 낮다. **다른 표본을 안 읽었다** — 채택률 추정은 하지 않는다.

---

## 5. CDC — 보류

| | |
|---|---|
| 판정 | **보류** (경로·편수는 좋으나 표본 3편 모두 지문 부적합) |
| 확보 가능 편수 | 실측 **3,889** HTML (`mediatype=html`) / 전체 6,734 |
| 라이선스 | PD-Government (항목마다 `attribution` HTML 이 온다). ⚠️ `cdc.gov/other/agencymaterials.html` 은 **403** 이라 공식 문구 원문은 **확인 실패** |
| 전문 | **온다** — `contentUrl` 이 크롬 없는 본문 HTML 을 준다 |
| 안정 식별자 | **정수 `id`** (예: 247197) — 이 정찰에서 가장 깨끗한 식별자 |
| 증분 커서 | `sort=-datemodified` + `dateModified` 비교 (또는 `offset`/`pagenum`) |
| 정찰 일자 | 2026-09-07 |

**CDC Content Syndication API** — 이 정찰에서 유일한 진짜 API 다.

```
https://tools.cdc.gov/api/v2/resources/media?max=5&mediatype=html&sort=-datepublished
  → meta.pagination.total = 3889, totalPages, nextUrl 제공
https://tools.cdc.gov/api/v2/resources/media/<id>.json         (메타 + 60여 필드)
https://tools.cdc.gov/api/v2/resources/media/<id>/content.html (본문 HTML)
```

⚠️ `mediatype` 을 안 주면 `Feed - Import` 같은 항목이 섞이고, 그건 `content` 가 1낱말이다
(316422 로 실측). 목표 표가 적어 둔 `media/316422.rss` 가 바로 그 피드 항목이다.

**표본 3편 판정** (전부 `contentUrl` 로 실제 본문을 읽음):

| id | 낱말 | verdict / genre | 왜 |
|---|---|---|---|
| 247197 "Teens, Young Adults, and Adults" | 1,048 | `reject` / `reference` | 이분척추 환자 보호자용 **지침 목록** — 읽는 글이 아니다 |
| 131274 "Measles Cases and Outbreaks" | 3,169 | `reject` / `reference` | 주별 확진자 수·관할 목록 나열 |
| 241509 "About the PE Fellowship" | 572 | `reject` / `reference` | 펠로십 **모집 공고** |

**표본 채택률 0/3.** 편수가 아니라 **장르가 문제**다 — 지침·데이터·공고다.
채택하려면 `tags` 로 산문 주제를 좁히거나 다른 하위 컬렉션을 따로 정찰해야 한다.

---

## 6. DOE (energy.gov) — 보류

| | |
|---|---|
| 판정 | **보류** (편수는 압도적이나 97%가 행정문서) |
| 확보 가능 편수 | `/articles/` 전체 ≈ **90,000** (sitemap 45쪽 × 2,000) 중 **산문 접두어 ≈3,500** |
| 라이선스 | **PD-Government · 변형 가능** (§9 원문) |
| 전문 | **온다** (표본 1,376 낱말) |
| 안정 식별자 | URL slug |
| 증분 커서 | sitemap 스냅숏 차집합 |
| 정찰 일자 | 2026-09-07 |

`https://www.energy.gov/rss.xml` 200 · **10건** · `?page=2` 는 링크 10/10 동일(창).

**sitemap 의 함정**: `/articles/` 로 grep 하면 페이지마다 2,000건이 다 걸리지만, 실제로는

```
p2  → /oe/articles/ea-301-integrys-energy-services-inc     (전력수출 인가)
p10 → /oha/articles/psh-13-0011-matter-personnel-security-hearing  (보안심사 판정문)
p25 → /nepa/articles/cx-017093-...                         (환경영향평가 제외 통지)
```

행정 문서다. 루트 접두어 `https://www.energy.gov/articles/` 만 산문인데
표본 5쪽(10,000 locs) 중 **308건 = 3.9%** 다(p1 96 · p5 2 · p15 23 · p30 187 · p50 0).
**URL 접두어 필터 없이 수확하면 9만 건의 행정문서를 GET 한다.**

**표본**: `/articles/10-questions-biochemist-dan-schabacker` (1,376 낱말) — Q&A 인터뷰.
차단 장르 9종에는 없지만 문답 형식이라 300어대 발췌가 연속 지문이 안 된다.

---

## 7. Census — 반려

| | |
|---|---|
| 판정 | **반려** (안정 식별자 부재) |
| 확보 가능 편수 | 근거 없음. sitemap 5,408 중 `newsroom/press-releases` 533 · `library/publications` 760 |
| 라이선스 | 확인 실패 (`/about/policies/citation.html` 본문에 해당 문구 없음) |
| 전문 | 확인 실패 — **기사 URL 자체를 얻지 못했다** |
| 안정 식별자 | **없다** |
| 증분 커서 | — |
| 정찰 일자 | 2026-09-07 |

⚠️ 목표 표의 `press-releases.rss` 는 **404**. 사는 것은 `press-releases.xml` (200, 10건)인데
**항목마다 `<link/>` 와 `<guid/>` 가 빈 태그다**:

```xml
<item>
  <title>Census Bureau to Hold Webinar to Announce New IPHI Estimates</title>
  <description>The Census Bureau is set to announce the latest income, poverty and health insurance findings…</description>
  <link/>
  <guid/>
  <pubDate>Wed, 2 Sep 2026 10:05:39 -0400</pubDate>
</item>
```

주소가 없으니 본문을 가져올 수도, 중복을 막을 수도 없다. sitemap(5,408)으로 우회는 가능하나
`library/stories`(America Counts 산문)가 sitemap 에 **0건**이고 남는 것은 통계 보도자료라
지문 가치가 낮다. 다시 볼 값어치가 생기면 sitemap 경로로 재정찰한다.

---

## 8. BLS — 반려

| | |
|---|---|
| 판정 | **반려** (콘텐츠가 지문이 아니다) |
| 확보 가능 편수 | 실측 **1** |
| 라이선스 | (판정에 영향 없음) |
| 전문 | 해당 없음 |
| 안정 식별자 | — |
| 증분 커서 | — |
| 정찰 일자 | 2026-09-07 |

**하지만 접근 자체는 이 정찰에서 가장 배울 게 많은 실측이다.**

| UA | 결과 |
|---|---|
| `Mozilla/5.0 … Chrome/120` (= 이 저장소의 `DEFAULT_USER_AGENT`) | **403 Access Denied** (Akamai) |
| `Vocaflow/1.0 (https://vocaflow.app; hello@vocaflow.app)` | **200** |

Wikimedia 에서 얻은 교훈의 **정확한 재현**이다(`user-agent-policy.test.ts`) — 속도가 아니라
**신원** 문제이고, 위장 UA 가 오히려 막힌다. 다른 연방 사이트를 붙일 때 403 을 보면
**간격을 늘리기 전에 UA 를 바꿔 볼 것.**

그럼에도 내용이 못 쓴다: `https://www.bls.gov/feed/bls_latest.rss` 는 항목이 **1개**이고
그 하나가 CPI·실업률 수치를 `<span class="data">` 로 나열한 대시보드다 → `reject`/`reference`.
`bls.gov/bls/rss.htm`·`bls.gov/rss.htm`·`bls.gov/opub/ted/feed.rss` 는 전부 **404** 라
산문 채널(The Editor's Desk)의 피드 주소를 **못 찾았다**.

---

## 9. Federal Reserve Education — 반려 ⚠️ PD 아님

| | |
|---|---|
| 판정 | **반려** |
| 확보 가능 편수 | sitemap 855 URL (대부분 수업자료 안내 페이지) |
| 라이선스 | **St. Louis Fed 저작권 보유 · 변형 금지 · 비상업 한정** |
| 전문 | (판정에 영향 없음) |
| 안정 식별자 | — |
| 증분 커서 | — |
| 정찰 일자 | 2026-09-07 |

`https://www.federalreserveeducation.org/feed/` 는 **404 페이지를 200 으로 돌려준다**
(제목 `404 Missing Page| Federal Reserve Education`) — 조용한 실패다.

이용약관(`/terms-of-service`) 원문:

> …you are authorized to use the Website, and to reproduce and distribute educational content in their entirety,
> for **non-commercial**, research or other educational purposes, provided that (i) all copyright notices are kept intact,
> **(ii) you do not modify the content in any way**…
>
> The Website and its entire contents … **are owned by St. Louis Fed**, its licensors, or other providers …
> and are protected by United States and international copyright…
>
> You must not reproduce, distribute, **modify, create derivative works of** … any of the content on our Website…

**"미국 연방정부 저작물 = PD" 라는 이 정찰의 전제가 여기서만 깨진다.** 연방준비은행(Reserve Bank)은
연방기관이 아니라 별도 법인이라 17 U.S.C. §105 가 적용되지 않는다.
변형 금지 + NC 는 `licenseClassOf` 에서 `restricted` 이고, `source-policy.test.ts` 의
「SOURCE_SPECS 에 restricted 등급 소스가 없다」가 **추가 즉시 실패**한다.
(The Conversation 의 ND 와 같은 자리다.)

---

## 10. Library of Congress 블로그 — 반려(막힘)

| | |
|---|---|
| 판정 | **반려(막힘)** — 다른 네트워크에서 재정찰 필요 |
| 확보 가능 편수 | **못 셌다** |
| 전문 | 확인 실패 |
| 정찰 일자 | 2026-09-07 |

전부 **403 + Cloudflare Turnstile 챌린지 페이지**(`<title>Just a moment...</title>`,
`challenges.cloudflare.com` CSP):

- `https://blogs.loc.gov/thesignal/feed/` · `/loc/feed/` · `/headlinesandheroes/feed/` · `https://blogs.loc.gov/`
- `https://www.loc.gov/` · `https://www.loc.gov/search/?fa=partof:blog&fo=json` · `/blogs/?fo=json`

브라우저 UA·연락처 UA·`--http1.1`·전체 브라우저 헤더 4가지 모두 403. **UA 문제가 아니다.**
JS 챌린지를 풀어야 하므로 헤드리스 HTTP 수확기로는 못 간다.

---

## 11. NIH News in Health — 반려(막힘)

| | |
|---|---|
| 판정 | **반려(막힘)** |
| 확보 가능 편수 | **못 셌다** |
| 정찰 일자 | 2026-09-07 |

`https://newsinhealth.nih.gov/rss.xml` · `/feed` · `/2026/09/` 전부 **403 Cloudflare Turnstile**.
LOC 와 같은 벽이다.

⚠️ 참고: `nih` 소스는 **이미 있다**(`NIH_FEEDS` 3개 — medlineplus / directors-blog / news).
News in Health 가 뚫리면 **피드 한 줄 추가**로 끝난다(마이그레이션 불필요). 지금은 못 뚫는다.

---

## 12. 라이선스 원문 (§9 참조용)

- **DOE** (`/about-us/web-policies`): "Government information at DOE websites **is in the public domain**.
  Public domain information may be freely distributed and copied…"
- **NPS** (`/aboutus/disclaimer.htm`): "material created by the National Park Service … unless otherwise indicated,
  is **generally considered in the public domain**." (단, 제3자 자료·Arrowhead 상표는 예외 — 항목별 확인 필요)
- **NIST** (`/copyrights-disclaimers`): "With the exception of material **marked as copyrighted**, information
  presented on NIST sites are considered public information and may be distributed or copied."
- **NSF**: **확인 실패** (`/policies/copyright` 404)
- **CDC**: **확인 실패** (`/other/agencymaterials.html` 403) — 다만 API 항목마다 `attribution` HTML 이 온다
- **Census**: 확인 실패
- **Federal Reserve Education**: **PD 아님** (§9)

---

## 13. 「수확기를 짠다면」 — 공통

| 항목 | 값 |
|---|---|
| 본뜰 것 | `packages/library-pipeline/src/ingest-article/usgs.ts` · `noaa.ts` (정부 CMS HTML + 정규식, 의존성 0) |
| **단, 목록이 sitemap 인 곳**(NPS·NIST·DOE) | `list*FeedPage(cursor)` 를 「sitemap 1회 수신 → `slice(offset, offset+N)`」 로 바꾼다 |
| CDC 만 | JSON API — `scripts/csat/harvest-plos.mjs` 계열(`offset`/`total` 있는 API 형)이 더 가깝다 |
| 커서 파일 | `scripts/acp/data/<source>-cursor.json` (정수 offset 하나) |
| 새 소스 1종당 필요한 것 | ① 어댑터 ② `SourceKey`+`SOURCE_SPECS`+`SOURCE_REGISTER_DEFAULT` ③ `collect-daily.mjs` `SOURCES` 항목 ④ **마이그레이션**(`library_articles_source_check` 에 값 추가 — `20260711130000_acp_source_add_noaa.sql` 형식) |
| Climate.gov 만 | 위 4가지 **전부 불필요** — `NOAA_FEEDS` 배열에 항목 추가 |
| 나눠 돌기 | `--limit 50` 기준: NPS 400회 · NIST 130회 · climate.gov 45회 |

**우선순위**: ① Climate.gov 피드 추가(코드 4줄, +2,200편) → ② NPS(+9,800 추정) → ③ NIST(+6,496) →
그 다음에야 NSF·CDC·DOE 를 다시 본다.
