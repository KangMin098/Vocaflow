<!-- docs/reports/source-probe/voa.md -->
# VOA Learning English 확보 정찰

| | |
|---|---|
| 판정 | **채택** |
| 확보 가능 편수 | 실측 **67,316** URL 중 전문 보유 **≈33,600** (표본 40편 · 전문률 50.0% · 95% 신뢰구간 23,000–44,000). 현재 보유 266편은 그 **0.8%** |
| 라이선스 | **Public Domain** (미 연방정부) · 변형 **가능** · 출처 표기 요청(의무 아님). 단 AP·Reuters·AFP 인용물은 제외 |
| 전문 | **온다** — `div.wsw` transcript. 표본 어수 중앙값 **668**(최소 400 · 최대 1,513) |
| 안정 식별자 | URL 끝 **숫자 article id** (`/a/…/7886988.html` → `7886988`). 67,316개 전부 고유 · 중복 0 |
| 증분 커서 | sitemap `lastmod` (67,316행 **전부** 보유) + 4개 `.gz` 전량 재열거(합 1.4 MB) |
| 정찰 일자 | 2026-09-07 |
| **구현** | **2026-09-07 완료** — `scripts/acp/harvest-voa-sitemap.mjs` (아래 §수확기를 짠다면 설계대로). 회귀 `packages/library-pipeline/src/ingest-article/voa-sitemap.test.ts` 21종 |

---

## 구현하면서 정찰과 달랐던 것 (실측 2026-09-07)

정찰이 틀린 것은 없었고, **정찰이 아직 못 본 것**이 셋 있었다. 전부 코드에 반영했다.

1. **발행일은 폴백이 「가려 준」 게 아니라 아예 실패했다.** §8 은 「둘 다 폴백이 받아 주고
   있어 조용하다」고 적었는데, DB 를 세니 **266행 중 실제 발행일을 가진 행이 0** 이다 —
   236행 NULL + 30행은 `2026-07-05 01:11:0x` 한 분 안에 찍힌 배치 스탬프(2017년 기사에
   2026년 날짜라 **NULL 보다 나쁘다**). 원인은 `<time datetime>` 값의 엔티티다:
   `2019-06-30T22:02:29&#x2B;00:00` → `new Date()` → Invalid Date → `safeDate` 가 null.
   제목 쪽은 정찰대로 `<title>` 폴백이 받아 주고 있었다(249편 전부 · "| VOA" 접미어 0건).
   → 이제 **JSON-LD 가 정본**이고 메타는 속성 순서와 무관하게 읽는다. 기존 행은
   `--repair-dates` 로 원문에서 되읽는다.
2. **옛 아카이브는 `articleSection` 이 비어서 온다.** §8 은 「기사마다 정확히 온다」고
   적었으나 그건 2012년 이후 얘기다. 그 전 글은 코너가 **제목 앞에 대문자**로 붙어 있다
   (`THIS IS AMERICA - …` · `PEOPLE IN AMERICA - …` · `IN THE NEWS - …`). 첫 회차 적재분의
   **36%** 가 그 자리였고, 안 읽으면 전부 register 기본값 `news` 로 떨어져
   **인물 전기가 시사 뉴스로 안내된다.** → `voaFeedIdFor(section, title)` 이 둘 다 본다.
3. **reference 코너가 섹션만으로는 안 걸린다.** id 608067 「Words and Their Stories:
   In the Red」의 `articleSection` 은 코너가 아니라 `learningenglish` 였다. 제목 앞머리와
   `Slangman:`·`Wordmaster:` 같은 중간 표지도 함께 본다.

---

## 0. 왜 266편에서 멈췄나 (먼저 물은 것)

**대량 접근 경로를 RSS 하나만 쓰고 있고, VOA RSS 는 피드당 200편이 천장이기 때문이다.**
아카이브의 99.2% 는 RSS 창 밖에 있고, 코드는 그 창을 넘어갈 수단을 갖고 있지 않다.

`scripts/acp/collect-daily.mjs` 의 voa 항목은 `runPage(cursor)` 가 **첫 호출에서 곧바로
`cont: null`** 을 돌려준다 — 즉 페이지네이션이 없다. 주석이 그 이유를 정직하게 적어 뒀다:
"VOA 는 페이지가 아니라 **창 크기**가 파라미터다 — `?count=N`. 한 번에 다 받아오고 바로 끝낸다."

그 창 크기의 실제 상한을 이번에 쟀다:

| `count=` | HTTP | `<item>` 수 |
|---|---|---|
| 200 | 200 | **200** |
| 500 | 200 | **20** |
| 1000 | 200 | **20** |
| 5000 | 200 | **20** |

⚠️ **200 을 넘기면 오류가 아니라 기본값 20 으로 조용히 되돌아간다.** 200 이 하드 천장이다.
(실측 zoneid=1579. 200 요청 시 창은 2024-10-31 ~ 2025-03-17.)

따라서 배선된 14 피드 × 최대 200 = **이론 상한 2,800**, 2026-08-30 실측 목록 합계 **936**,
큐레이션 spec·본문 200자 미만 거절을 지나 **249편**이 남았다(+ 사실 재저작분 `adapted` 17 = 266).

즉 **266 은 "다 걷었다" 가 맞다 — 다만 RSS 창 안에서만 그렇다.** 배치 표에는
`창 전량 소진` 으로 찍히는데, 그 말이 "아카이브를 다 봤다" 로 읽히는 것이 문제였다.
아카이브는 67,316편이고 RSS 는 그중 1.4% 만 보여 준다.

> **310 이 아니라 266 이다.** DB 실측(`library_articles where source='voa'`) 266
> (`ready` 230 · `published` 29 · `archived` 7). 목표 표의 310 이 어디서 왔는지는 확인 못 했다.
> 피드별: education 99 · science-technology 94 · adapted 17 · american-stories 14 ·
> lets-learn-english 13 · health-lifestyle 10 · words-and-their-stories 9 · arts-culture 7 · as-it-is 3.
> ⚠️ 배선된 14 피드 중 **5개(everyday-grammar · ask-a-teacher · education-tips ·
> all-about-america · us-history)는 DB 에 0행**이다.

**어느 피드를 받고 있나 — Learning English 다, 일반 뉴스가 아니다.** 14 피드 전부
`learningenglish.voanews.com` 의 z-코드다. 일반 뉴스(`www.voanews.com`)는 배선돼 있지 않다(§8).

---

## 1. 대량 접근 경로 — 사이트맵 (실측)

`robots.txt` 가 스스로 광고한다. 그리고 **RSS 를 대체할 유일한 경로**다.

```
GET https://learningenglish.voanews.com/robots.txt
  Sitemap: https://learningenglish.voanews.com/sitemap.xml
  Disallow: /*?p=*        ← 목록 화면의 "더 보기" 페이지네이션은 금지다
  Disallow: /s?k=*        ← 검색도 금지다
```

⚠️ 금지 목록에 `/*?p=*` 가 있다 — **z-코너 목록을 페이지로 걸어 들어가는 방식은 쓰면 안 된다.**
사이트맵은 반대로 명시 허용이고, robots 가 직접 가리킨다.

```
GET https://learningenglish.voanews.com/sitemap.xml   →  200 · sitemapindex 8개
      sitemap_428_1..4.xml.gz      기사 67,316 (20,000+20,000+20,000+7,316)
      sitemap_428_latest.xml.gz    7      (최근 7일)
      sitemap_428_news.xml.gz      2      (Google News 용)
      sitemap_428_sections.xml.gz  126    (/p/ · /z/ 코너 쪽)
      sitemap_428_videos.xml.gz    8,364  (영상 — 지문 아님)
```

호출 예시 1개(실행한 그대로):

```js
const r = await fetch('https://learningenglish.voanews.com/sitemap_428_1.xml.gz',
  { headers: { 'User-Agent': BROWSER_UA } })          // ⚠️ UA 필수 — WAF 가 봇 UA 를 403 한다
const xml = zlib.gunzipSync(Buffer.from(await r.arrayBuffer())).toString('utf8')
// → <url><loc>…/a/…/7886988.html</loc><lastmod>2024-12-07T…Z</lastmod></url> × 20,000
```

**4 요청 · 1.4 MB(gz) 로 아카이브 전체 목록이 손에 들어온다.** RSS 는 14 요청으로 936편이었다.

### 사이트가 얼어 있는 줄 알았는데 아니었다

`lastmod` 를 월별로 세니 **2025-03 → 2026-03 사이 12개월이 통째로 비어 있다**(VOA 운영 중단기).
2026-03 부터 다시 채워지는데 **하루 1편 · 8월분 23편**, 최신은 **2026-08-24**(정찰일 기준 2주 전).

| | 2025-01 | 2025-02 | 2025-03 | 2025-05 | 2026-03 | 04 | 05 | 06 | 07 | 08 |
|---|---|---|---|---|---|---|---|---|---|---|
| 편 | 211 | 213 | 137 | 1 | 22 | 30 | 31 | 30 | 31 | 23 |

⚠️ **재개분은 지문이 아니다.** 2026년치 표본 2편(`/a/8189634.html` · `/a/8189362.html`)은
`div.wsw` 자체가 없고 `articleSection` 도 비어 있다 — 오디오 뉴스캐스트 쪽이다.
**신규 유입은 사실상 0 으로 보고 계획해야 한다.** 이 소스는 살아 있는 피드가 아니라 **정지한 서고**다
(코드가 이미 `frozen: true` 로 그렇게 다루고 있다 — 그 판단이 맞았다).

---

## 2. 전문(full text)이 오는가 — 온다. 다만 절반만

균등 간격 **표본 40편**을 실제로 GET 해 `div.wsw` 의 `<p>` 만 뽑아 셌다:

| 결과 | 편 | 비율 |
|---|---|---|
| transcript 200어 이상 | **20** | **50.0%** |
| transcript 있으나 200어 미만 | 2 | 5.0% |
| `wsw` 없음(오디오·영상 전용 쪽) | 18 | 45.0% |
| 요청 실패 | 0 | 0% |

어수 중앙값 **668** · 최소 400 · 최대 1,513. **300어 발췌 기준으로 편당 2조각**이 나온다.

⚠️ **URL 모양으로는 전문 유무를 못 가른다.** 처음에 `/a/<숫자>.html`(34,579) = 오디오,
`/a/<슬러그>/<숫자>.html`(32,681) = 기사 로 가르려 했으나 **양쪽 다 반례가 나왔다** —
숫자형 `/a/3657588.html` 이 835어 transcript 였고, 슬러그형 `/a/quinceanera-party-usa/1821068.html`
은 본문 5어였다. **GET 해 봐야 안다.** 수확기는 이 45% 실패를 정상 동작으로 세야 한다.

→ **확보 가능 편수 67,316 × 50.0% ≈ 33,600편** (95% 신뢰구간 23,000–44,000).

---

## 3. 라이선스 — PD · 변형 가능

`/p/6861.html` (Request Our Content) 원문:

> "Learning English texts, MP3s, photos and videos are **in the public domain**."
> 재게시 시 "with credit to learningenglish.voanews.com."
> "Stories, photos and video images from news agencies such as **AP, Reuters and AFP are
> copyrighted, so you are not allowed to republish them.**"

- **변형 가능** — PD 라 ND·SA 전염이 없다. 발췌·재편집·문항화 전부 열려 있다.
- 출처 표기는 **요청**이지 조건이 아니다(PD 에는 조건을 붙일 수 없다). 그래도 표기한다.
- ⚠️ **통신사 혼입이 유일한 위험이다.** Learning English 본문은 VOA 직원이 다시 쓴 글이라
  대개 안전하지만, `articleSection` 이 비고 author 가 `Voice of America`(≠ `VOA Learning English`)
  인 쪽은 걸러 두는 편이 안전하다. 저자를 기록한 표본 6편은 전부 `VOA Learning English` 였고
  `Voice of America` 로 나온 것은 본문 없는 2026년 뉴스캐스트 쪽뿐이었다 —
  **다만 40편 전체의 저자 분포는 세지 않았다.**
- 메타데이터에 **라이선스 필드는 없다** — 항목별로 다르지 않고 사이트 단위 선언 하나뿐이다.
  어댑터가 `license: 'PD-Government'` 를 상수로 넣는 현재 처리가 맞다.

---

## 4. 안정 식별자 — 숫자 article id

`.../a/<슬러그>/<id>.html` · `.../a/<id>.html` 양쪽 다 **마지막 세그먼트가 숫자 id** 다.
67,316 URL 에서 id 를 뽑아 세니 **고유 67,316 · 중복 0**. 슬러그는 바뀔 수 있지만 id 는 안 바뀐다.

### ⚠️ 지금 DB 의 `source_id` 는 이 id 가 아니다 — 재수확 전에 고쳐야 한다

```sql
select count(*) filter (where source_id ~ '^voa:[0-9]+$') from library_articles where source='voa';
→ 0        -- 249편 중 0편
```

실제 값은 `voa:ewolkz` `voa:ypn6n9` 같은 **base36 해시**다. 원인은 `ingestVoaArticle` 의

```ts
const slugMatch = itemUrl.match(/\/([a-z0-9\-]+)\/?(?:\?|$)/i)
const sourceId = `voa:${slugMatch?.[1] ?? hashString(itemUrl).toString(36)}`
```

— 문자 클래스에 `.` 이 없어 `7886988.html` 로 끝나는 URL 에 **한 번도 매치되지 않고 전량 해시로 떨어진다.**
같은 파일의 목록 쪽(`parseRssItems`)은 `voa:7886988` 을 만든다. **한 소스가 두 가지 id 를 쓴다.**

그 결과 `collect-daily.mjs` 의 GET 전 중복 차단(`haveIds`)과 삽입 전 `(source, source_id)`
중복 검사가 **VOA 에서는 한 번도 맞지 않는다** — 지금은 `source_url` 일치가 우연히 막아 주고 있을 뿐이고,
슬러그가 다른 같은 기사(리다이렉트 후 정규 주소)는 **두 번 들어갈 수 있다.**
PLOS 에서 900편을 헛 GET 했던 것과 같은 결의 결함이다(CHANGELOG 2026-08-30).

**수확기를 짜기 전에 `voa:<id>` 로 통일하고 249행을 백필해야 한다.** 안 하면 재수확 때
가진 것을 전부 다시 GET 한다.

---

## 5. 증분 커서 — `lastmod` + 전량 재열거

- `<lastmod>` 가 **67,316행 전부**에 있다(누락 0). 표본에서 `lastmod` 와 JSON-LD `datePublished`
  가 일치했다(예: methane 기사 2019-06 / 2019-06-30).
- **정렬 없는 페이지네이션 위험이 없다.** IA 사고(2026-08-16 · 214건 중복·동수 누락)는
  순서 없는 페이지 넘김에서 났는데, 사이트맵은 **전수 열거**라 페이지 개념이 없다.
  4개 파일을 매번 다 읽고 DB 의 id 집합과 차집합을 내면 중복도 누락도 구조적으로 불가능하다.
- 비용이 싸서 그래도 된다 — **4 요청 · 1.4 MB(gz)**. 커서 파일은 "이미 판정한 id" 만 담으면 된다.
- 매일 도는 경로는 `sitemap_428_latest.xml.gz`(7편) 하나면 충분하다. 다만 §1 대로
  **재개분은 지문이 아니므로 실익이 거의 없다.**

---

## 6. 현실적 확보 가능 편수

| | 편 | 근거 |
|---|---|---|
| 사이트맵 기사 URL | **67,316** | `sitemap_428_1..4` 실측 · 고유 id 67,316 |
| 그중 전문 200어 이상 | **≈33,600** | 표본 40편 중 20편(50.0%) · 95% CI 23,000–44,000 |
| 현재 보유 | 266 | DB 실측 |
| **미확보** | **≈33,300** | |

**목표 750편(고1 대역) 대비**: 기존 249편의 V-Level 실측이 평균 **3.8** · 수능 대역(V5–8)
적중 **16.5%**(41편)였다(CHANGELOG 2026-08-30). 그 비율을 그대로 적용하면 **≈5,500편**이
고1 대역에 든다 — 목표의 7.3배다. **적중률이 1/7 로 떨어져도 750 은 채워진다.**

⚠️ 다만 이 16.5% 는 **현대 학습자 피드 249편에서 잰 값**이고, 아카이브 대부분을 차지하는
옛 Special English 계열(`American Stories`·`U.S. History`·`Explorations`·`This Is America`)은
**1,500 낱말 통제 어휘**로 쓰인 글이라 오히려 더 쉬울 수 있다. **아카이브 전체의 대역 적중률은
못 쟀다** — 표본 40편으로는 V-Level 분포를 말할 수 없다. 첫 1,000편을 담고 다시 재는 것이 맞다.

---

## 7. 지문 적합성 표본 판정

`gate-article-drain/JUDGING.md` 어휘로, 앞 330어를 실제로 읽고 판정했다.

| 표본 | 섹션 · 연 · 어수 | verdict | genre | why |
|---|---|---|---|---|
| [college-textbooks-moving-from-print-to-digital/4779055](https://learningenglish.voanews.com/a/college-textbooks-moving-from-print-to-digital/4779055.html) | Education · 2019 · 1,106 | **use** | `education` | 대학 등록금의 숨은 비용에서 디지털 교재 전환으로 논지가 한 줄로 서고 인용 수치가 자족적이다 |
| [study-drug-could-block-bone-loss…/7278803](https://learningenglish.voanews.com/a/study-drug-could-block-bone-loss-in-astronauts-in-space/7278803.html) | Science & Technology · 2023 · 663 | **use** | `science` | 무중력 골손실이라는 문제 제시 후 대책을 잇는 전형적 설명문이나 「NASA 는 말했다」 인용 사슬이 잦아 논증 밀도는 낮다 |
| [tom-sawyer-and-huck-mark-twain…/2961739](https://learningenglish.voanews.com/a/tom-sawyer-and-huck-mark-twain-american-story/2961739.html) | American Stories · 2015 · 1,473 | **narrative** | `fiction` | 마크 트웨인 「Luck」 각색 1인칭 회고로 사건이 시간순이라 심경·장문 유형 자리다 |
| [show-your-hand-other-card-idioms/7886988](https://learningenglish.voanews.com/a/show-your-hand-other-card-idioms-/7886988.html) | Words and Their Stories · 2024 · 726 | **reject** | `reference` | 관용구 정의를 하나씩 나열하는 코너라 논지가 없고 읽는 글이 아니라 사전 항목이다 |
| [methane-mystery-on-mars…/4976623](https://learningenglish.voanews.com/a/methane-mystery-on-mars-could-it-mean-life-/4976623.html) | Science & Technology · 2019 · 617 | **use** | `space` | 메탄 검출이라는 관측에서 생명 가능성이라는 물음으로 넘어가는 서론형이라 발췌 한 조각이 그대로 선다 |

**가장 중요한 발견 하나** — 학습자 브랜드가 가장 뚜렷한 `Words and Their Stories` 가
**지문으로는 가장 못 쓴다.** `Ask a Teacher`·`Everyday Grammar`·`English in a Minute`·
`How to Pronounce`·`News Words` 도 같은 결(정의·문법 설명 나열)이라 `reference` 로 떨어질
가능성이 높다. 반대로 **`Education`·`Science & Technology`·`As It Is`·`Health & Lifestyle`
이 `use` 의 본진**이고, `American Stories`·`U.S. History` 가 부족한 `narrative` 를 메운다.

표본 40편의 섹션 분포(전문 있는 20편): As It Is 10 · Science & Technology 3 · U.S. History 2 ·
Environment & Science 2 · Education 1 · American Stories 1 · Explorations 1.

---

## 8. 난이도 등급(Level 1/2/3) — **메타데이터로 오지 않는다. 취득 불가.**

기대했던 자동 대역 배정은 성립하지 않는다. 세 겹으로 확인했다.

**(1) 기사 메타데이터에 없다.** 기사 쪽 `<meta>` 28개와 JSON-LD 전체를 훑었다.
있는 것은 `articleSection`·`keywords`·`datePublished`·`author` 뿐이다.

```json
{"articleSection":"Words and Their Stories","keywords":"Lessons of the Day, Words and Their Stories",
 "author":{"name":"VOA Learning English"},"datePublished":"2024-12-07 22:05:00Z","isAccessibleForFree":true}
```

⚠️ `article:published_time` 메타는 **없다** — 어댑터가 그 정규식을 첫 번째로 두고 있는데
언제나 빗나간다. `og:title` 정규식도 속성 순서(`content` 가 먼저 온다)가 달라 안 맞는다.
둘 다 폴백이 받아 주고 있어 조용하지만, 사이트맵 경로로 바꾸면 **JSON-LD 를 정본으로 읽는 편이 낫다.**

**(2) 쪽 단위 Level 구분도 실제로는 구분이 아니다.** 내비게이션의 세 링크
(`/p/5609` Beginning · `/p/5610` Intermediate · `/p/5611` Advanced)를 각각 받아
본문 영역의 코너 링크를 세었다:

| Level 쪽 | 코너 링크 수 | 목록 내용 |
|---|---|---|
| Beginning `/p/5609` | 32 | As It Is · Science & Technology · Words & Their Stories · American Stories … |
| Intermediate `/p/5610` | 30 | **위와 같은 목록** |
| Advanced `/p/5611` | 32 | **위와 같은 목록** |

**세 쪽이 같은 코너 집합을 나열한다.** Level 은 코너를 나누는 축이 아니라 사이트 상단의
표지판일 뿐이다. `rss/?zoneid=5609` 도 항목 0 을 돌려준다(피드가 아니다).

**(3) 저장소가 이미 이걸 실측하고 철회했다.** `voa.ts` 주석 — 선언 Level 2(47편) 평균 CEFR 지수
2.38, Level 3(20편) **1.85**. **더 어렵다고 선언한 쪽이 더 쉽다.** 그 축으로 CEFR 추정을
교차검증하는 모듈을 만들었다가 오탐 6/6 으로 철회했다. **같은 것을 다시 만들지 말 것.**

> **대신 쓸 수 있는 축**: JSON-LD `articleSection`(코너명)은 기사마다 정확히 온다.
> 이것은 난이도가 아니라 **문종·소재** 축이고, §7 이 보여 주듯 `use`/`narrative`/`reject` 를
> 코너 이름만으로 상당 부분 가른다. **대역 배정은 기존 V-Level 분석기가 하고, `articleSection`
> 은 문종 배정에 쓴다** — 이 분업이 실측에 맞는다.

---

## 9. VOA 일반 뉴스(`www.voanews.com`) — **보류(권하지 않는다)**

같은 CMS 라 경로는 똑같이 열려 있다. `robots.txt` 도 문구까지 동일하고
`sitemap.xml` 은 **sitemapindex 51개**(번호 47 + latest/news/sections/videos)다 —
Learning English 의 4개에 대비된다. 규모는 수십만 편 급으로 보이나 **세지 않았다**(내려받지 않았다).

권하지 않는 이유 둘:

1. **통신사 혼입이 여기서는 예외가 아니라 상시다.** PD 선언에서 AP·Reuters·AFP 를 명시적으로
   제외하는데, 일반 뉴스는 그 비중이 크고 **기사 단위로 판별할 메타데이터 필드가 없다.**
   PD 소스의 강점(48시간 보류 없음 · 재저작 게이트 없음)이 바로 이 지점에서 사라진다.
2. **필요가 없다.** Learning English 만으로 미확보 ≈33,300편이고 목표는 750편이다.
   일반 뉴스는 목표의 44배를 이미 확보한 뒤에 볼 카드다.

---

## 수확기를 짠다면

`scripts/csat/harvest-gutenberg.mjs` 를 본뜬다 — **목록 열거 → 커서로 건너뛰기 → 본문 정제 →
채점 → 몫 남은 칸만 적재** 흐름이 그대로 맞는다(PLOS 형은 API 오프셋이라 사이트맵과 안 맞는다).
본문 추출은 `packages/library-pipeline/src/ingest-article/voa.ts` 의 `ingestVoaArticle` 을 그대로 쓴다
(`div.wsw` 균형 추출은 이미 옳다).

**새 파일**: `scripts/acp/harvest-voa-sitemap.mjs`
**커서**: `scripts/acp/data/voa-sitemap-cursor.json` — `{ "seen_ids": [...], "no_transcript_ids": [...], "last_run": "…" }`
전문 없는 45% 를 따로 적어야 **매 실행마다 같은 3만 쪽을 다시 GET 하지 않는다.**

```
1. sitemap_428_1..4.xml.gz 4개 GET (1.4MB) → {id, url, lastmod} 67,316
2. id 로 DB(library_articles.source='voa') · 커서의 seen/no_transcript 와 차집합
3. 남은 것을 --limit 만큼 GET → ingestVoaArticle
     wsw 없음 → no_transcript_ids 에 적고 다음 (실패로 세지 않는다)
     본문 200어 미만 → 같이 적는다
4. JSON-LD 에서 articleSection·datePublished 를 읽어 feed_id·published_at 로 넣는다
     (RSS 가 없으므로 feed_id 는 articleSection 슬러그로 만든다 —
      NULL 로 두면 register 해석이 소스 기본값으로 떨어진다, 2026-08-20 37편 사고와 같은 자리)
5. --commit 없이는 세기만 한다 (collect-daily 와 같은 규약)
```

**선행 조건 2개 — 이걸 안 하면 헛일이 난다.**

1. **`source_id` 를 `voa:<숫자 id>` 로 통일**하고 기존 249행을 백필한다(§4).
   지금 형식으로는 중복 차단이 작동하지 않아 가진 것을 다시 GET 한다.
2. **`library_articles_source_check` 에 새 feed_id 가 걸리지 않는지 확인**한다.
   `futurity` 가 어댑터·spec·테스트를 다 갖추고도 CHECK 제약 하나 때문에 **확보 영구 0** 이었던 전례가 있다.

**분할 실행**: 1회 500편 · 요청 간 700ms → 회당 약 6분. 전문률 50% 이므로 500 GET 당 250편 확보.
**≈33,300편을 다 담으려면 67 회**다. 다만 목표가 750편(고1 대역)이라면
`Education`·`Science & Technology`·`As It Is`·`Health & Lifestyle` 섹션에 한정해
**첫 3~4 회(1,500~2,000 GET)면 닿는다** — §7 의 `reference` 코너를 피하는 것이
편수를 늘리는 것보다 채택률에 크게 기여한다.

⚠️ **UA 필수.** 사이트맵·기사·RSS 전부 브라우저 UA 가 없으면 WAF 가 403 한다
(어댑터의 `USER_AGENT` 상수를 그대로 쓴다).

---

## 부록 — 이번 정찰에서 실제로 호출한 것

| 대상 | 요청 수 |
|---|---|
| RSS `count=` 천장 확인 (zoneid=1579) | 4 |
| `robots.txt` · `sitemap.xml` · `/z/1579` | 3 |
| 사이트맵 `.gz` 8개 (전량 열거) | 8 + HEAD 4 |
| 기사 표본 (전문·메타 확인) | 11 |
| 균등간격 수율 표본 | 40 |
| Level 쪽 `/p/5609·5610·5611` · `/p/6861` · zone RSS | 7 |
| `www.voanews.com` robots·sitemap index | 2 |
| **합** | **79** (본문 저장 0 · DB 쓰기 0) |
