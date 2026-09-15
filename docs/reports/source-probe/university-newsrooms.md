<!-- docs/reports/source-probe/university-newsrooms.md -->
# 대학 뉴스룸 (Harvard Gazette · MIT News · Stanford News 외) 확보 정찰

| | |
|---|---|
| 판정 | **반려** |
| 확보 가능 편수 | MIT News 실측 **33,877 URL**(사이트맵 17쪽 × 2,000 − 마지막 1,877) · Harvard Gazette 실측 **약 27,900편**(post-sitemap 28개) · Stanford News **못 셌다**(기사 사이트맵 없음) — **그러나 라이선스가 전부 막는다** |
| 라이선스 | MIT News **CC BY-NC-ND 3.0**(1차 확인) · Harvard Gazette **표기 없음 = 저작권 유보**(1차 확인) · Stanford News **표기 없음 = 저작권 유보** · Cambridge **CC BY-NC-SA 4.0** — 변형 **불가**(ND) 또는 상업 **불가**(NC) |
| 전문 | **온다** (MIT·Harvard RSS `content:encoded` 에 본문 전량) |
| 안정 식별자 | MIT `<guid>` = 기사 URL(고정) · Harvard `<guid>` = `?p=<post_id>`(WordPress 숫자 ID, 고정) |
| 증분 커서 | RSS 는 **최근 50편 롤링 창**뿐 · 과거분은 사이트맵 `lastmod` |
| 정찰 일자 | 2026-09-07 |

---

## 0. 먼저 답할 것 — Futurity 와 중복인가

**중복이 아니다. 그러나 중복이 아닌 이유가 곧 반려 사유다.**

이 저장소의 Futurity 보유분을 DB 로 직접 셌다.

```sql
select count(*) filter (where author ilike '%harvard%')  harvard,
       count(*) filter (where author ilike '%stanford%') stanford,
       count(*) filter (where author ilike '%MIT%')      mit,
       count(*) total
from library_articles where source='futurity';
```

| 항목 | 실측 |
|---|---|
| `library_articles` 의 `source='futurity'` | **2,885** (⚠️ 과업 지시문의 3,229 와 다르다 — 다른 표에는 futurity 가 없다. `library_article_seed_catalog` 0행, `csat_source_registry` 1행(등록부). **실제 보유는 2,885**) |
| 기사에 붙은 출처 대학 (author `Futurity / <대학>`) | **131개 대학** |
| Harvard | **0** |
| Stanford | **0** |
| MIT | **0** — `ilike '%MIT%'` 는 14건을 맞히지만 전부 오탐이었다: `Katy Smith-U. Arizona` · `Kyle Mittan-U. Arizona` · `Lisa Schmitz - Iowa State` · `Rae Lynn Mitchell-Texas A&M` · `Robin Smith-Duke` · `Kelsie Smith-Hayduk - U. Rochester` |
| Cornell / Princeton / Caltech / Columbia | **각 0** |
| Berkeley / Penn | 34 / 9 |
| 수록 기간 | 2023-09-15 ~ 2026-08-28 · 평균 671어 |

**1차 자료 대조** — futurity.org/about/ 는 회원 대학 **47개**를 명시하고, 그 목록에
Harvard·MIT 는 없다. Stanford 는 추천사(Donna Lovell)만 실려 있고 회원 목록에는 없다.
DB 의 0건은 수확 누락이 아니라 **Futurity 가 애초에 이 세 곳을 담지 않기 때문**이다.

즉 **주제·대학 양쪽에서 중복이 아니다** — 지시문이 물은 "Futurity 에 없는 대학·주제가
실제로 얼마나 되는가" 의 답은 "목표로 지목된 세 곳이 정확히 그 공백" 이다.

**그런데도 반려한다.** 그 세 곳이 Futurity 밖에 있는 이유가 바로 **CC 재게시 프로그램에
참여하지 않기 때문**이기 때문이다. Futurity 회원 대학은 자기 뉴스를 CC BY 로 넘기기로
합의한 곳들이다. 비회원 = 그 합의를 안 한 곳. 공백과 라이선스 장벽이 **같은 원인의
양면**이라, "빈 곳을 채우자" 는 곧 "라이선스 없는 곳을 긁자" 가 된다.

---

## 1. 대량 접근 경로 — 있다(두 곳), 막혔다(한 곳)

실제 호출 결과:

| 경로 | HTTP | 크기 | 비고 |
|---|---|---|---|
| `https://news.mit.edu/rss/feed` | **200** `application/rss+xml` | 522,529 B | item 50 |
| `https://news.harvard.edu/gazette/feed/` | **200** `application/rss+xml` | 775,687 B | item 50 |
| `https://news.stanford.edu/feed/` | **403** `text/html` | 5,422 B | 차단 |
| `https://news.stanford.edu/rss` · `/rss.xml` | 404 | — | 없음 |
| `https://news.mit.edu/sitemap.xml` | 200 | 2,322 B | sitemapindex, 하위 17쪽 |
| `https://news.harvard.edu/gazette/sitemap_index.xml` | 200 | 5,676 B | Yoast, post-sitemap 28개 |
| `https://news.stanford.edu/sitemap.xml` | 200 | **1,442 B** | **섹션 11개뿐 — 기사 URL 0** |

호출 예시 1개:

```bash
curl -sSL -A "Mozilla/5.0" https://news.mit.edu/rss/feed
# → <item> 50개, 각 item 에 <content:encoded> 본문 전량
```

**Stanford 는 경로가 없다.** 피드 403, 기사 사이트맵 없음, `robots.txt` 는
`Crawl-delay: 10` + `/search` 차단. 기사 페이지(`/stories/2026/03/...`)는 200 을 주지만
본문이 JS 로 그려지고(퍼소나 선택 게이트 + `__dxp/cdp` 동의 POST) `curl` 로 받은 HTML 에
`<p>` 가 **0개**였다. 헤드리스 브라우저 없이는 본문을 못 얻는다.

## 2. 전문(full text) — 온다

RSS `content:encoded` 에 본문이 통째로 들어온다. 실측 어수:

- MIT: 1,455 / 844 / 2,312 어
- Harvard Gazette: 981 / 872 / 1,061 어

초록·요약이 아니다. **이 항목만 놓고 보면 PLOS 급 소스**다. 그래서 아깝지만,
3번이 이를 무효로 만든다.

## 3. 라이선스 — ⚠️ 여기서 전부 죽는다

**항목별 라이선스 필드는 어느 피드에도 없다.** MIT·Harvard RSS 원문에서
`creativecommons` 문자열 검색 결과 **0건**. 라이선스는 기사 HTML 푸터에만 있다.

| 뉴스룸 | 1차 확인 결과 | 근거 |
|---|---|---|
| **MIT News** | **CC BY-NC-ND 3.0** | 기사 HTML 에 `Creative Commons Attribution Non-Commercial No Derivatives license` + `href="http://creativecommons.org/licenses/by-nc-nd/3.0/"` |
| **Harvard Gazette** | **CC 없음 = 저작권 유보** | 기사 HTML 전체에서 `creative commons` **0건**. schema.org 는 `copyrightHolder: The Harvard Gazette` · `copyrightYear: 2026` 만 선언 |
| **Stanford News** | **CC 없음 = 저작권 유보** | 섹션·기사 HTML 에 CC 표기 0건. 푸터 링크는 `uit.stanford.edu/security/copyright-infringement`(침해 신고) |
| **University of Cambridge** (`cam.ac.uk/research/news`) | **CC BY-NC-SA 4.0** | 기사 HTML 에 `creativecommons.org/licenses/by-nc-sa/4.0` + 배지 이미지 |
| UNSW Newsroom · Monash Lens · ETH News | **CC 표기 못 찾았다** | 랜딩·기사 HTML `creativecommons.org/licenses` 검색 0건 (기사 단위로 다를 수 있으나 **확인 실패**) |
| Oxford (`ox.ac.uk/news`) · Melbourne Pursuit · MPG | **확인 실패** | 403 / 404 |

**SPEC 3번 기준 적용**:

- **MIT = ND** → 변형 금지. SPEC 이 The Conversation 을 반려한 것과 같은 사유다.
  이 저장소는 이미 그 판정을 코드로 갖고 있다 — `library_articles` 의
  `license_class='cc_by_nd'` 71행은 전부 `display_only=true` 다(The Conversation).
  MIT 은 거기에 **NC 까지 얹힌다.** Vocaflow 는 상업 학습 서비스이므로 NC 단독으로도 탈락.
- **Harvard·Stanford = 표기 없음** → 저작권 유보. 재게시 허가 페이지를 찾지 못했다
  (`news.harvard.edu/gazette/about/` 에 copyright/라이선스 문구 0건,
  `news.harvard.edu/robots.txt` 는 robots 가 아니라 WordPress 404 HTML 을 반환).
- **Cambridge = NC + SA** → 변형은 되지만 상업 이용 불가 + 결과물 SA 전염.

**라이선스가 허용하는 대학 뉴스룸은 이번 정찰에서 0곳이었다.**
가장 관대한 것이 Cambridge 의 BY-NC-SA 였고, 그것도 NC 로 막힌다.

## 4. 안정 식별자 — 있다

- MIT: `<guid>` = 기사 URL(`https://news.mit.edu/2026/<slug>-MMDD`). `<link>` 와 동일값.
  URL 에 날짜와 슬러그가 박혀 있어 재수확에도 고정.
- Harvard: `<guid>` = `https://news.harvard.edu/gazette/?p=432329` — **WordPress post ID**.
  슬러그가 바뀌어도 이 숫자는 안 변한다. `<link>` 보다 나은 키.
- 둘 다 `<dc:date>` 는 없고 `<pubDate>` 만 있다.

## 5. 증분 커서 — RSS 는 50편 창, 과거는 사이트맵

- RSS 는 **최근 50편 롤링**. 하루 5~10편 발행이면 5~10일치. 매일 돌리면 증분은 되지만
  **한 번이라도 열흘을 건너뛰면 그 구간이 영영 빠진다.** `pubDate` 로 "지난번 이후" 를
  집는 형태(`scripts/acp/collect-daily.mjs` 와 같은 꼴).
- 소급 수확은 사이트맵. MIT `sitemap.xml?page=1..17` 은 **연도 오름차순**으로 정렬돼
  있었다(page=1 이 2013년) — SPEC 5번이 경고한 "정렬 없는 페이지네이션" 문제는 없다.
  Harvard `post-sitemap1..28` 도 고정 분할이다.
- Stanford: **커서를 만들 재료가 없다.**

## 6. 현실적 확보 가능 편수 — 실측

| 소스 | 실측 | 세는 법 |
|---|---|---|
| MIT News | **33,877 URL** | `sitemap.xml` 의 sitemapindex `<loc>` **17개** · `?page=1` 의 `<loc>` **2,000** · `?page=17` 의 `<loc>` **1,877** → 16×2,000+1,877. 기사 외 페이지 포함(상한값) |
| Harvard Gazette | **약 27,900편** | `post-sitemap.xml` **1,001** · `post-sitemap28.xml` **866** · 총 28쪽 → 27×1,000+866 |
| Stanford News | **못 셌다** | 기사 사이트맵 없음 · 피드 403 |
| 목표 표의 추정 1,000편 | — | 편수는 문제가 아니었다. **30배 있다.** 문제는 전량이 못 쓰는 라이선스라는 것 |

## 7. 지문 적합성 표본 판정 — 6편

RSS `content:encoded` 에서 뽑아 앞 320어로 자른 뒤 `JUDGING.md` 어휘로 판정했다.

| # | 기사 | verdict / genre | why |
|---|---|---|---|
| 1 | MIT — Arctic under-ice sounds ([링크](https://news.mit.edu/2026/researchers-tune-into-arctic-under-ice-sounds-test-through-ice-communication-0904)) | `use` / `science` | 통념→물음 구조가 서고 자족적이나, 300어 안에 FY2027 연방 R&D 예산 우선순위 인용 한 단락이 통째로 들어와 그 부분은 읽는 글이 아니다 |
| 2 | MIT — 살아 있는 세포의 전사체 ([링크](https://news.mit.edu/2026/new-method-allows-following-gene-activity-over-time-same-cells-0904)) | `use` / `science` (전제: 첫 줄 제거) | 첫 문장이 **"The following press release was issued Sept. 1 by the Broad Institute"** — 보도자료임을 스스로 밝히는 머리글이 본문에 남아 있다. 지우지 않으면 `reject`/`fragmentary` |
| 3 | MIT — 벽돌 창고를 학사동으로 ([링크](https://news.mit.edu/2026/how-architects-turned-hulking-brick-box-newest-academic-hub-0904)) | `narrative` / `culture` — **지문 부적합** | 캠퍼스 건물 리모델링 홍보. `SA+P`·`DS+R`·`Met Warehouse` 등 고유명사에 의존하고 "9월 8일 입주식" 이라는 **교내 행사 일정**으로 끝난다. 자족적이지 않다 |
| 4 | Harvard — 젊은 연구자 설문 ([링크](https://news.harvard.edu/gazette/story/2026/09/survey-of-young-researchers-raises-concerns-over-future-of-science-in-u-s/)) | `use` / `education` (전제: 앞머리 제거) | 논지가 서는 좋은 설명문. 다만 `content:encoded` 가 **사진 캡션 + 크레딧 + 섹션명 + 표제 + 부제 + 기자명 + "5 min read"** 를 맨 앞에 평문으로 붙여 준다 — 그대로 자르면 `fragmentary` |
| 5 | Harvard — Garber 총장 Morning Prayers ([링크](https://news.harvard.edu/gazette/story/2026/09/our-university-is-at-its-heart-an-affirmation-of-humanity/)) | **지문 부적합** | 총장 연설 중계. 300어 중 직접인용이 절반을 넘고 논지가 아니라 **의례**다 |
| 6 | Harvard — 암 백신 인터뷰 ([링크](https://news.harvard.edu/gazette/story/2026/08/pioneering-cancer-fighter-sees-promise-beyond-melanoma-breakthrough-vaccine/)) | **지문 부적합** | `Gazette:` / `Catherine Wu:` 대담 축자록. 설명문이 아니다 |

**"보도자료체 감점" 이 실제로 나타나는 방식** — 목표 표의 감점은 문체 인상이 아니라
네 가지 **측정 가능한 형태**로 나온다:

1. **자기 홍보 인용** — 표본 2의 "Our lab focuses our time and resources on developing
   tools that will actually get used and make real impact on the broader field."
   PI 가 자기 연구실을 칭찬하는 문장. `JUDGING.md` 의 `reference`(자기 인용·연구비 명시)에
   해당하는 덩어리가 본문 한복판에 박힌다.
2. **기관 고유명사 밀도** — 연구소·그룹·건물·직함 정식 명칭이 문장마다 들어간다.
   수능 지문은 고유명사를 최소화한다.
3. **교내 사건 의존** — 입주식·기념식·임명 등 그 대학 구성원에게만 뜻이 있는 글이
   상당수다. 표본 6편 중 3편(3·5·6)이 여기 걸렸다.
4. **피드 자체의 껍데기** — Harvard 는 캡션·바이라인·읽기시간이, MIT 은 보도자료 머리글이
   본문 문자열에 섞여 온다. 자동 수확이면 이걸 걸러 낼 전처리가 별도로 필요하다.

**표본 채택률: 6편 중 2편(33%)** — 그것도 앞머리 제거를 전제로 한 값이다.
Futurity(2,885편, 평균 671어)는 같은 재료를 **편집자가 이미 한 번 다듬은 것**이라,
같은 대학 보도자료를 원본으로 긁으면 이 33% 를 우리가 다시 걸러야 한다.

---

## 판정 근거 요약

SPEC 의 「반려」 조건 — *전문이 안 오거나 · 변형 금지 라이선스거나 · 대량 접근 경로가
없을 때* — 중 **둘이 동시에** 성립한다.

- MIT News: 경로 O · 전문 O · **라이선스 X**(BY-NC-ND, 변형 금지 + 상업 금지)
- Harvard Gazette: 경로 O · 전문 O · **라이선스 X**(유보)
- Stanford News: **경로 X**(403 + JS 렌더) · **라이선스 X**(유보)
- Cambridge: 경로 O · 전문 O · **라이선스 △**(BY-NC-SA — 변형은 되나 NC 로 상업 불가)

**라이선스가 허용하는 곳: 0곳.**

## 대신 할 것 (권고, 이 정찰의 범위 밖)

Futurity 를 **더 파는 것**이 같은 수요를 더 싸게 채운다. 보유 2,885편은
2023-09-15 ~ 2026-08-28 구간이고, 등록부에 이미 수확기가 있다
(`csat_source_registry`: `futurity` → `node scripts/acp/collect-daily.mjs`, `license_class: cc_by`).
**대학 131곳 · CC BY · 편집자가 다듬은 설명문**이라는 조건은 원본 뉴스룸이 못 준다.
2023년 이전 소급이 얼마나 되는지는 **이 정찰에서 세지 않았다**.

## 수확기를 짠다면

**짜지 않는 것을 권한다.** 그럼에도 라이선스가 바뀌어 재검토할 일이 생기면:

- 본뜰 것: `scripts/acp/collect-daily.mjs` (RSS 형). MIT·Harvard 둘 다 표준 RSS 2.0 +
  `content:encoded` 라 이 스크립트의 파서를 거의 그대로 쓴다.
  API 형(`scripts/csat/harvest-plos.mjs`)은 필요 없다 — API 가 없다.
- 소급 수확만 별도: 사이트맵 → 기사 HTML. `scripts/textbook/mediawiki-lead-ingest.mjs` 의
  "URL 목록을 받아 본문만 뽑는" 꼴에 가깝다.
- 커서 파일: `scripts/acp/data/newsroom-<slug>-cursor.json` — RSS 는 `pubDate` 최댓값,
  사이트맵 소급은 `sitemapPage` + `lastIndex` 두 키. MIT 사이트맵은 연도 오름차순
  고정 분할이라 페이지 번호가 커서로 안전하다.
- 분할: MIT 33,877 URL 을 사이트맵 17쪽 = **17회**. Harvard 28쪽 = **28회**.
  `Crawl-delay` 는 MIT·Harvard robots.txt 에 없으나 1 req/s 이하로.
- **반드시 넣을 전처리 2종**(표본 판정에서 나온 것): ① Harvard `content:encoded`
  앞머리(캡션·크레딧·섹션·표제·바이라인·읽기시간) 절단 ② MIT "The following press
  release was issued …" 머리글 줄 제거. 없으면 게이트가 `fragmentary` 로 대량 탈락시킨다.
- 적재 시 `license_class`: MIT 은 `cc_by_nd` 가 아니라 **NC 가 더해진 값**이 필요하다.
  현재 스키마에 그 값이 없다 — The Conversation 처럼 `display_only=true` 로 넣더라도
  NC 는 표시조차 상업 서비스에서 논란이 될 수 있어 **적재 자체를 권하지 않는다.**

## 확인 실패로 남긴 것 (정직하게)

- Stanford News 의 총 기사 수 — 세지 못했다.
- Stanford 의 명시적 재게시 정책 — `/contact` 403, 정책 페이지를 찾지 못했다.
  "표기 없음" 은 관측이고, "금지" 는 그로부터의 기본값 추정이다.
- UNSW Newsroom · Monash Lens · ETH News — HTTP 200 은 받았으나 랜딩·기사 HTML 에서
  CC 표기를 찾지 못했다. **기사 단위로 다를 수 있어 "없다" 가 아니라 "못 찾았다".**
- Oxford (403) · Melbourne Pursuit (403) · Max Planck (404) — 호출이 막혔다.
- 지시문의 "Futurity 3,229편" 과 DB 실측 2,885 의 차이 — 원인을 찾지 못했다.
  `library_articles` 외에 futurity 를 담은 표는 없었다.
