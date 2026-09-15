<!-- docs/reports/source-probe/the-conversation.md -->
# The Conversation 확보 정찰

| | |
|---|---|
| 판정 | **반려** (변형 용도) / 현행 verbatim `display_only` 경로만 **유지** |
| 확보 가능 편수 | **변형 가능 0편.** verbatim 표시용 상한은 영어판 사이트맵 실측 **172,500 URL** 이나, 발행사 지침이 "전량 체계적 전재" 를 금지하므로 실사용 상한은 **정의 불가**(협의 필요) |
| 라이선스 | **CC BY-ND 4.0** · 변형 **불가** (1차 확인 2건: 지침 페이지 본문 + atom `<rights>` 25/25) |
| 전문 | **온다** (기사 HTML 전문 · atom `<content type="html">` 도 전문 ~17KB/건) |
| 안정 식별자 | URL 말미 **숫자 기사 ID** (`…-271070`) = atom `<id>tag:theconversation.com,2011:article/289647` · 2025년 이후 글은 **자체 DOI**(`10.64628/AAI.*`) 도 있음 |
| 증분 커서 | 사이트맵 `<lastmod>` (판·연도별 파일). atom `?page=` 는 **무시된다**(실측) |
| 정찰 일자 | 2026-09-07 |

---

## 0. 결론부터 — 왜 반려인가

**1위 소스인데 목표한 용도로는 쓸 수 없다.** 라이선스가 문제이지 접근 경로가 문제가 아니다.
경로는 오히려 아주 좋다(연도별 사이트맵 172,500 URL · 전문 · 안정 ID · lastmod 커서).

발행사 지침 원문(https://theconversation.com/us/republishing-guidelines · 실측 2026-09-07)에서
목표를 직접 막는 문장 네 개:

1. > We … publish all our work under a Creative Commons — **Attribution/No Derivatives** license.
2. > **You can't edit our material**, except to reflect relative changes in time, location and
>    editorial style. If you do wish to make material edits, you will need to run them by the
>    author for approval prior to publication.
3. > **You can't systematically republish all of our articles.**
4. > **You can't sell our material separately** … / **Commercial, non-journalism usage: license
>    fees may apply.** Contact us to discuss.

`Translations: a derivative under our Creative Commons license and so require author approval` —
번역조차 저자 개별 승인 대상이라고 명시한다. **"확보 후 변형해서 저작권을 회피한다" 는 전제가
이 소스에서는 성립하지 않는다.** 변형물을 만드는 순간 라이선스 밖이고, 저자 승인은 편당·개인별이라
172,500편 규모로는 절차가 존재하지 않는다.

### 다만 정확히 해 둘 것 — 「발췌」 자체는 금지가 아니다

CC BY-ND 4.0 법문(§2(a)(1)(A))은 `reproduce and Share the Licensed Material, **in whole or in
part**` 를 허용한다. **원문을 손대지 않은 부분 인용은 ND 위반이 아니다.** 금지되는 것은
`Adapted Material`(개작물)이다. 그래서 경계는 이렇게 갈린다:

| 하려는 일 | ND 하에서 |
|---|---|
| 300어 구간을 **한 글자도 안 고치고** 출처·저자·링크 달아 지문으로 보여 주기 | 법문상 가능 · **단** 지침은 발췌를 "첫 몇 단락 + 「전문 보기」 링크" 로 좁혀 놓았다 |
| 문장 단순화 · 어휘 교체 · 레벨 하향 · 문장 분할 | **불가** (개작) |
| 빈칸 뚫기(cloze) · 어순 뒤섞기 · 문장 삽입 유형 만들기 | **불가** — 본문 자체를 변형한다 |
| 한국어 번역·요약본 | **불가** (지침이 번역=derivative 로 명시, 저자 승인 필요) |
| 지문은 그대로 두고 **문항만** 따로 만들기 (내용일치·주제추론) | 개작은 아니나, 상업 교재 배포는 위 4번(비저널리즘 상업 이용 = 유료 협의)에 걸린다 |

즉 **CSAT 문항 제작 파이프라인(발췌→가공→변형)의 2단계부터 전부 막힌다.**
이 저장소가 이미 그렇게 판단하고 있었다 — `scripts/acp/collect-daily.mjs` 주석:
"논증문은 The Conversation 이 CC BY-ND 라 문항을 못 만드는 자리를 메우는…"

### 기존 코드는 이미 옳게 막고 있다

| 위치 | 하는 일 |
|---|---|
| `packages/library-pipeline/src/ingest-article/the-conversation.ts` | `license: 'CC-BY-ND-4.0'` 로 적재 |
| `supabase/migrations/20260608120000_acp_license_register_gate.sql` | `license_class='cc_by_nd'` → `display_only=true` 자동 도출 (BEFORE INSERT/UPDATE 트리거) |
| `supabase/migrations/20260608123000_acp_nd_display_only_gate.sql` | `display_only` 면 단어세트 **발행 SKIP** · `subscribe_article_word_set` **no-op** |

그리고 이 결론은 이미 한 번 실측으로 확인된 것이다 —
`packages/library-pipeline/src/ingest-article/argumentative-supply.test.ts` 머리말(2026-08-21):
교재 재고에 **논증문 문항이 0개**였는데 어느 지표도 깨지지 않았다. 논증문 **지문은 84편**
있었고 소스 GET 도 정상이었다. 틀린 것은 하나 — **그중 71편이 The Conversation(ND) →
`display_only` → 문항 생성기가 통째로 건너뛴다.** 지문은 쌓이는데 문항은 0이 되는,
**조용한 실패**다. 같은 주석이 대체 후보로 검토했던 **Aeon·Quanta·Knowable 이 전부 ND/NC 라
붙여도 결과가 같았다**고 기록한다 — 이 정찰의 결론을 "다른 논평지로 갈아타면 된다" 로
읽으면 안 된다는 뜻이다.

DB 실측(2026-09-07): `library_articles` 중 `source='the_conversation'` **71행 · 전부
`license_class='cc_by_nd'` · `display_only=true`** · `published_at` 2026-07-06 ~ 2026-08-19.
**6주치밖에 없다 = RSS 창 그 자체.** 이 문서의 나머지는 "그 창을 넓힐 수 있는가" 에 대한 답이다
(넓힐 수 있지만, 넓혀도 쓸 수 있는 것이 늘지는 않는다).

---

## 1. 대량 접근 경로 — 사이트맵 (API·덤프·OAI 없음)

**있다.** `robots.txt` 가 스스로 알려 준다.

```
$ curl -s https://theconversation.com/robots.txt
Sitemap: https://theconversation.com/sitemap.xml
Sitemap: https://theconversation.com/us/sitemap_news.xml     (판별 15개)
```

`sitemap.xml` = 사이트맵 인덱스, `<loc>` **225개**. 구성은 `sitemap_general.xml` 1개 +
**14개 판(edition) × 16개 연도 아카이브**(`<판>/sitemap_archive_<2011..2026>.xml`).

```
$ curl -s https://theconversation.com/us/sitemap_archive_2025.xml | head
<url>
  <loc>https://theconversation.com/west-coast-levee-failures-…-272556</loc>
  <lastmod>2025-12-29T16:08:41Z</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.8</priority>
```

**없는 것 (전부 실제 호출로 확인):**

| 시도한 URL | 결과 |
|---|---|
| `/api/v1/articles` | **404** |
| `/articles/271070.json` | **404** |
| `/us/technology/articles.rss` | **406** |
| `/us/articles.atom?page=2` · `?page=500` | **200 · 그러나 언제나 같은 최신 50건**(첫 `<published>` 동일 · 바이트 수 동일). 페이지 파라미터가 무시된다 |
| `/us/sitemap_news.xml` | 200 이나 `<urlset>` **비어 있음**(0건) |
| `/us/articles.json` | 200 · 최신분 목록만 · `title`/`url`/`summary_html`/`byline_html` 뿐 — **본문 없음 · 라이선스 필드 없음 · 페이지네이션 없음** |

⚠️ **RSS 로만 걷던 것이 왜 71편에서 멈췄는지가 여기서 설명된다.**
`listTheConversationFeed()` 는 atom 1페이지만 읽고, atom 은 **페이지 파라미터를 무시한다.**
VOA(`count`)·NASA(`paged`)·PLOS(`start`) 처럼 창을 넓히는 손잡이가 **이 소스에는 없다.**
과거분을 얻는 길은 사이트맵뿐이다.

### ⚠️ robots.txt 가 AI 크롤러를 명시적으로 막는다

`robots.txt` 후반부는 `User-agent:` **168줄**을 나열한 뒤 마지막에 `Disallow: /` 하나를 둔다.
그 목록에 **`ClaudeBot` · `Claude-Code` · `Claude-User` · `Claude-Web` · `Claude-SearchBot` ·
`anthropic-ai` · `GPTBot` · `CCBot` · `PerplexityBot` · `Scrapy`** 가 들어 있다(줄 64·82·87–91·129·174–175).
일반 `User-Agent: *` 는 `/metrics/ /auth/ /content/ /comments/* …` 만 막으므로 기사 본문 자체는
허용이지만, **이 발행사는 AI 목적 수집을 거부한다고 기계가 읽는 형식으로 선언해 두었다.**
라이선스와 별개의 축이고, 대량 수확기를 짤 근거를 더 약하게 만든다.

---

## 2. 전문이 오는가 — **온다**

- 기사 HTML: 표본 4편 모두 `itemprop="articleBody"` 안에 전문. 본문만 뽑아 약
  **800~1,300 words**. 기존 어댑터 `ingestTheConversationArticle()` 가 이미 이 경로로 뽑고 있다.
- atom: `<content type="html">` 에 **전문**이 실린다(`/us/technology/articles.atom` = 25 entries · 432KB → 약 17KB/건).

초록만 오는 소스가 아니다. 지문 재료로서의 결격은 없다.

---

## 3. 라이선스 — 메타데이터로 오는가

| 경로 | 라이선스 필드 | 실측 |
|---|---|---|
| **atom** | **온다** | `<rights>Licensed as Creative Commons – attribution, no derivatives.</rights>` — **25/25 전건 동일**(uniq 1종) |
| **기사 HTML** | **안 온다** | 표본 4편에서 `creativecommons` 0회 · `licen[cs]e` **0회** · `rel="license"` 없음 · JSON-LD `"license"` 키 없음 |
| **사이트맵** | 없음 | `<loc>` / `<lastmod>` / `<changefreq>` / `<priority>` / `<xhtml:link>` 뿐 |

⚠️ **사이트맵 경로로 수확하면 라이선스가 항목별로 따라오지 않는다.** 사이트 전체 정책
(지침 페이지)에서 유추해 `CC-BY-ND-4.0` 을 상수로 박아야 한다 — 현행 어댑터가 하는 그대로다.
항목별로 다른 라이선스가 존재하는지는 **확인 실패**(항목 메타데이터에 필드 자체가 없어 확인할 방법이 없다).
지침 본문은 "**all** our work" 라고 쓴다.

---

## 4. 안정 식별자 — 숫자 기사 ID (그리고 DOI)

- URL 말미 숫자: `…-271070` · `…-263610` · `…-255825` · `…-248957`. 슬러그가 바뀌어도 이 숫자가 정본.
- atom `<id>` = `tag:theconversation.com,2011:article/289647` — **같은 숫자**.
- **DOI**: 표본 4편 모두 자체 DOI 보유(prefix `10.64628`) — `10.64628/AAI.rjp95mqr5` ·
  `AAI.3tfsp36vv` · `AAI.9jtvkaj65` · `AAI.377jrv6yr`. 기사 HTML 안에 있다.
- 현행 `slugFromUrl()` 은 **슬러그 전체를 60자로 잘라** `source_id` 를 만든다
  (`the_conversation:midlife-weight-gain-can-start-long-before-menopause-b`).
  숫자 ID 를 쓰지 않으므로 **슬러그가 바뀌면 같은 글이 새 글로 들어온다.** 수확기를 늘릴
  일이 생긴다면 여기부터 고쳐야 한다(→ `the_conversation:271070`).

### 판 사이 중복은 없다 (실측)

기사 URL 은 판 접두어 없는 정본 하나뿐이라 판별 사이트맵이 겹칠 수 있어 보이지만,
2025년 5개 영어판(us·uk·au·africa·ca)의 URL 을 합치면 **13,462건**, 기사 ID 로 유일화해도
**13,462건** — **중복 0.** 판별 합계를 그대로 더해도 된다.

---

## 5. 증분 커서 — 사이트맵 `<lastmod>`

- 각 `<url>` 에 `<lastmod>`(ISO8601 Z)가 있다. 인덱스의 `<sitemap>` 에도 `<lastmod>` 가 있으나
  **전부 오늘 날짜로 갱신된다**(225개 전건 `2026-09-07T00:00:00Z`) → **인덱스 lastmod 는 커서로 못 쓴다.**
  연도 파일을 열어 `<url><lastmod>` 를 봐야 한다.
- 실무 커서: `{판, 연도, 마지막으로 본 lastmod}`. 올해 파일만 매일 다시 읽고, 지난 연도 파일은
  한 번만 읽으면 된다.
- ⚠️ **atom `?page=` 로 과거를 걸어 들어가려 하면 안 된다** — 200 을 주면서 같은 50건을 반복한다.
  2026-08-16 IA 사고(정렬 없는 페이지네이션 → 214건 중복 + 동수 누락)와 **같은 함정이고, 더 나쁘다**
  (오류도 없고 새 항목도 0이라 walker 가 "끝" 으로 착각하고 정상 종료한다).
  사이트맵은 순서가 고정된 정적 파일이라 이 문제가 없다.

---

## 6. 현실적 확보 가능 편수 — 영어판 172,500 URL (사이트맵 실측)

`<loc>` 개수를 세었다(2026-09-07 · 연도 2011–2026 전량):

| 판 | URL 수 | 비고 |
|---|---:|---|
| au | **74,008** | 전 연도 실측 |
| uk | **48,519** | 전 연도 실측 |
| us | **25,936** | 전 연도 실측 (2011–2013 = 0 · 2014 부터 시작) |
| africa | **13,156** | 전 연도 실측 |
| ca | **10,143** | 전 연도 실측 (ca-fr 은 별도 판이라 제외) |
| global | **729** | 전 연도 실측 |
| nz | **9** | 전 연도 실측 — 판은 있으나 아카이브가 비어 있다 |
| europe | **0** | 전 연도 실측 |
| **영어판 합계** | **172,500** | 판 사이 중복 0 (§4) |

비영어판(br·es·fr·ca-fr·catalan·id)은 세지 않았다 — 이 서비스 용도 밖이다.

**그러나 이 172,500 은 "기술적으로 URL 이 존재하는 수" 이지 "쓸 수 있는 수" 가 아니다.**

| 용도 | 편수 |
|---|---:|
| 변형(발췌 가공·레벨 조정·cloze·번역) | **0** — 라이선스가 막는다 |
| verbatim 표시 전용(현행 `display_only` 경로) | 상한 172,500 이나 지침의 "전량 체계적 전재 금지" 에 걸린다. **협의 없이 정할 수 없다** |
| 목표 표의 "채택 추정 6,000편" | **근거 없음** — 이 추정치는 라이선스를 반영하지 않은 값이다 |

---

## 7. 지문 적합성 표본 판정 — 4/4 `use` (그래서 더 아깝다)

US 2025 사이트맵에서 400건 간격으로 뽑아 실제로 읽었다.

| # | 기사 ID | 제목(줄임) | verdict | genre | why |
|---|---|---|---|---|---|
| 1 | 271070 | Midlife weight gain can start long before menopause | `use` | health | 통념(폐경 후 살찐다) → 반전(폐경 전 대사 전환) → 근거(SWAN 연구) 구조가 수능 지문 그대로. 다만 후반 "Lift weights / Prioritize protein" 조언 목록에서 300어를 뜨면 `reference` 가 되므로 **앞 3~4단락에서만 잘라야 한다** |
| 2 | 263610 | Monsoon flooding … Pakistan | `use` | climate | "Why Pakistan gets such extreme floods" 이하는 자족적 설명문이나, 도입 3단락이 2025년 사망자 수 보도라 시의성이 강하다 — 도입을 포함하면 `news` 성격이 된다 |
| 3 | 255825 | Outsourcing cost of impact data … charitable buck | `use` | economics | 표본 중 최상. 통념 → 실험 설계(N≈2,000) → 결과(13%) → 사회적 함의가 800어 안에 다 있고 그림·표 의존이 0이다 |
| 4 | 248957 | Brutalism, the architectural style … | `use` | art | 영화 훅으로 시작하지만 "What you see is what you get" 이후 건축사 서술이 자족적. 인명·연도가 많아 어휘 부담은 C1 쪽 |

**적합률은 정찰한 소스 중 최상급이다.** 학자가 일반 독자에게 쓰는 논증문 — 도입 통념 제시,
중간 반전, 마무리 함의라는 수능 지문의 뼈대를 **편집 없이** 갖추고 있다. 그림·표 의존이 없고
`[12]` 같은 인용 표기 대신 본문 링크를 쓴다.

**바로 그래서 반려가 아프다.** 재료의 문제가 아니라 권리의 문제다.

---

## 8. 막힌 것 / 확인 실패

- **항목별 라이선스 차이 여부**: 확인 실패. 기사 HTML·사이트맵에 라이선스 필드가 아예 없고,
  atom 은 25건 전부 동일 문구라 "다른 값이 존재하는가" 를 표본으로는 증명할 수 없다.
- **"license fees" 의 실제 조건**: 확인 실패. 지침은 `Contact us to discuss` 로만 끝난다.
  교육·발췌 목적의 명시적 예외 조항은 **지침·약관 어디에도 없다**(약관 페이지 전문 grep:
  `artificial intelligence`·`data mining`·`derivative`·`scrap`·`crawl` **전부 0회**;
  약관에 있는 license 문장은 *기고자가 TC 에 주는* 라이선스 한 줄뿐).
- **`/us/sitemap_news.xml` 이 빈 이유**: 확인 실패(0건 응답). news 사이트맵은 통상 최근 48시간용이라
  일시적일 수 있으나 실측값은 0이다. 아카이브 사이트맵이 살아 있으므로 경로 판단에는 영향 없다.

---

## 9. 수확기를 짠다면

**짜지 않기를 권한다.** 아래는 "그럼에도 verbatim 표시용으로 창을 넓히기로 결정할 경우" 의 설계다.
**결정 전에 `us-republish@theconversation.com` 과 협의하는 것이 순서다** — 지침 3·4번을
정면으로 건드리는 일이라, 코드가 아니라 허락이 선행 조건이다.

| | |
|---|---|
| **본뜰 것** | `scripts/textbook/mediawiki-lead-ingest.mjs`(목록→상세 2단 · 커서 파일) 구조에 `scripts/acp/collect-daily.mjs` 의 `ingest` 어댑터 호출을 얹는다. `scripts/csat/harvest-plos.mjs` 는 API 형이라 안 맞는다 |
| **1단계** | 사이트맵 인덱스 → 영어판 8개 × 연도 16개 = 128 파일. `<loc>` + `<lastmod>` 만 뽑아 `scripts/acp/data/the-conversation-urls.jsonl` 로. **기사 본문은 아직 안 받는다** |
| **2단계** | jsonl 을 URL 말미 숫자 ID 로 유일화 → 이미 있는 71편(그리고 이후 적재분) 제외 → 남은 것만 `ingestTheConversationArticle(url)` 로 편당 GET |
| **커서 파일** | `scripts/acp/data/the-conversation-cursor.json` — `{ "<판>": { "<연도>": "<마지막 lastmod>" } }`. 다른 ACP·CSAT 커서와 같은 관례(`scripts/csat/data/plos-*-cursor.json`) |
| **선행 수정** | `slugFromUrl()` → **숫자 ID 기반 `source_id`**(§4). 안 고치면 슬러그 변경분이 중복 적재된다 |
| **나눠 도는 단위** | 판 × 연도 = 128 배치. 한 배치가 최대 4,658편(au 2025)이므로 편당 1req 이면 배치 하나가 수십 분. **동시 1 · 간격 ≥1초** |
| **하지 말 것** | atom `?page=` 순회(§5 — 조용히 같은 50건 반복) · `User-Agent` 를 비우거나 브라우저로 위장하기(§1 robots 주석) · 단어세트 발행 게이트(`display_only`) 우회 |
