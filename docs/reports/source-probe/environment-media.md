<!-- docs/reports/source-probe/environment-media.md -->
# 환경·국제 언론 6곳 확보 정찰 (Mongabay · Global Voices · Inside Climate News · Grist · ProPublica · Al Jazeera)

목표 표 46·57·72·81·84위 묶음. **"재게시 허용 CC 를 명시한 언론사"** 라는 전제로 묶였으나,
1차 자료(각 사 라이선스·재게시 페이지) 실측 결과 **6곳 중 5곳이 변형 금지(ND) 또는 무(無)라이선스**였다.

## 곳별 라이선스 실측 (1차 자료)

| 곳 | 라이선스 (실측) | 변형 | 상업 | 근거 URL | 판정 |
|---|---|---|---|---|---|
| **Global Voices** | **CC BY 3.0** (사이트 전역) | **가능** | **가능** | `globalvoices.org/about/global-voices-attribution-policy/` | **채택** |
| Mongabay | **CC BY-ND 4.0** (본지) · 일부 채널 CC BY-NC-ND | **불가** | 조건부 | `news.mongabay.com/copyright/creative-commons/` · `news.mongabay.com/terms` | **반려** |
| Inside Climate News | **CC BY-NC-ND 3.0** | **불가** | **불가** | `insideclimatenews.org/republish/` | **반려** |
| ProPublica | **CC BY-NC-ND 3.0 Unported** | **불가** | **불가** | `propublica.org/steal-our-stories/` | **반려** |
| Grist | **CC 없음** — 개별 재게시 허락(전문 그대로) | **불가** | 불가 | `grist.org/about/promote/` · `grist.org/terms/` | **반려** |
| Al Jazeera | **All rights reserved** (텍스트) | **불가** | **불가** | `aljazeera.com/terms-and-conditions` | **반려** |

### 반려 5곳 — 인용 근거

- **Mongabay** — 본문 라이선스는 `Attribution-NoDerivatives 4.0 International (CC BY-ND 4.0)`.
  재게시 안내가 명시적으로 **"You cannot translate their features or edit/change the material
  except to reflect relative changes in time, location, or basic editorial style"** 라 적는다.
  `news.mongabay.com/terms` 의 기본값은 더 좁다 — *"You may not modify any of the materials and
  you may not … create derivative works from … unless specified otherwise on the web site."*
  실측한 2026-09 기사 1편(`indigenous-knowledge-helps-reveal-the-ties-between-reefs-and-mangroves`)
  HTML 에 `creativecommons.org/licenses/...` 링크가 **0개** — 기사마다 라이선스 표기가 붙는 구조도 아니다.
  하위 채널(GFRN·MRN)은 `CC BY-NC-ND` 로 더 좁다. **발췌·재작성 교재 지문으로 쓸 수 없다.**
  (기술적으로는 WP REST API 가 열려 있고 `content.rendered` 로 전문이 온다 — **막힌 것은 경로가 아니라 라이선스다**.)
- **Inside Climate News** — 페이지 제목 자체가 `Creative Common License (CC BY-NC-ND 3.0)`.
  더해서 **"Bots. Do not republish our material wholesale, or automatically. You must select
  stories to be republished"** — 자동 수확을 명문으로 금지한다.
- **ProPublica** — `CC BY-NC-ND 3.0 Unported`. *"You can't edit our material, except to reflect
  relative changes in time, location and editorial style."* NC + ND 이중 차단.
- **Grist** — CC 라이선스가 **아예 없다**. `grist.org/republish/` 는 404(→ 실경로 `/about/promote/`).
  거기 조건이 *"Don't change anything significant. You can change the headline and/or subheading,
  but articles must be republished **in their entirety**."* — ND 등가. 이용약관은 별도로
  *"You may not modify any of the materials … create derivative works from"* 로 전면 금지.
- **Al Jazeera** — 본문 텍스트에 CC 없음. 약관이 *"copy, reproduce, download, post, store,
  distribute, transmit, broadcast, commercially exploit or **modify in any way**"* 를 금지하고
  **자동 추출·스크래핑·데이터마이닝을 별도로 금지**한다. 2009년의 `cc.aljazeera.net` CC BY 는
  **영상 푸티지 한정**이었고 현재 운영되지 않는다 — 기사 텍스트와 무관하다.

**⚠️ 목표 표의 전제가 틀렸다.** 이 묶음은 "CC 명시 = 쓸 수 있다" 로 묶였으나, 언론사 CC 는
**거의 예외 없이 ND** 다(전문 그대로 재게시로 트래픽·크레딧을 얻는 것이 목적이므로 변형을 막는 것이 당연하다).
합계 추정 340편 중 **Global Voices 몫만 남는다.**

---

# Global Voices 확보 정찰

| | |
|---|---|
| 판정 | **채택** |
| 확보 가능 편수 | 실측 상한 **104,352** (`X-WP-Total`) · 실사용 후보 **약 7,000~9,000** (2017~2026 · 파트너 재게시·링크뭉치 제외 후 추정) |
| 라이선스 | **CC BY 3.0** · 변형 **가능** · 상업 **가능** |
| 전문 | **온다** (`content.rendered`, 최근분 중앙값 1,232어) |
| 안정 식별자 | `id` (WP post ID, 정수) · 보조 `guid.rendered`(`?p=<id>`) · `link` |
| 증분 커서 | `modified_after` + `orderby=modified&order=asc` (증분) · `after`/`before` 월 단위 창 + `orderby=date&order=asc` (백필) |
| 정찰 일자 | 2026-09-07 |

## 1. 대량 접근 경로 — WordPress REST API (공개, 무인증)

```
https://globalvoices.org/wp-json/wp/v2/posts?per_page=100&page=1&orderby=date&order=asc
  &_fields=id,date,modified,link,title,content,excerpt,categories,tags
```

- 루트 `wp-json` 실측: `name: "Global Voices"` · 네임스페이스에 `wp/v2` 존재.
- `per_page` **최대 100** (101 요청 시 `rest_invalid_param` 400).
- **총계는 응답 헤더로 온다** — `X-WP-Total: 104352` · `X-WP-TotalPages: 1044`.
- 커스텀 네임스페이스 `gv/v1` 도 있으나 `gv/v1/posts/<id>` 는 **`rest_forbidden` 403** — 쓸 수 없다. `wp/v2` 만 쓴다.
- 인증·API 키 불필요. 표본 호출 전량 200.

## 2. 전문이 오는가 — 온다

`content.rendered` 에 본문 HTML 전체가 실린다. 실측(2025-01 이후 60편 표본):

| | 값 |
|---|---|
| 중앙값 | **1,232어** |
| p25 / p75 | 905 / 1,352어 |
| 최소 / 최대 | 583 / 3,003어 |
| **300어 미만** | **0편** |

`excerpt.rendered` 는 28~30어짜리 요약이라 별개다. **PLOS 와 같은 급으로 전문이 온다.**

## 3. 라이선스 — CC BY 3.0, 변형 가능 (⚠️ 항목별 예외 3종)

기사 HTML 푸터에 `creativecommons.org/licenses/by/3.0` 링크 **5회** 및
*"This site is licensed as Creative Commons Attribution 3.0"*. 정책 페이지 원문:

> **Unless otherwise stated, all content created by Global Voices is published under a
> Creative Commons Attribution-Only license.** … Adapt — remix, transform, and build upon the
> material **for any purpose, even commercially**. … Attribution — You must give appropriate
> credit, provide a link to the license, and **indicate if changes were made**.

**변형 가능 · 상업 가능 · SA 전염 없음.** 6곳 중 유일하다.

⚠️ **다만 라이선스 필드가 API 메타데이터에 없다.** `meta` 는 `{_acf_changed, footnotes}` 뿐이고
`acf` 는 빈 배열이다. 그래서 **예외 3종을 본문 문자열로 걸러야 한다**:

| 예외 | 정책 원문 / 실측 | 수확기 처리 |
|---|---|---|
| **파트너 재게시본** (Nepali Times · Groundviews · portalb.mk 등) | 본문 머리에 *"originally published by … An edited version is republished on Global Voices as part of a **content-sharing agreement**"*. "Unless otherwise stated" 의 **그 "otherwise stated" 에 해당** — GV 가 CC BY 로 재하위허락한다는 근거가 없다 | **전량 제외.** 아카이브 전체 검색 `search="content-sharing agreement"` → **1,015편** · `"originally published"` → 1,912 · `"republished"` → 2,095. 최근 표본에선 **13/60 = 22%** |
| **사진·영상·음성** | *"Photos, video, audio sourced from other creators may not always be available on the same terms."* | 텍스트만 쓰므로 **무해** — `<img>`/`<figure>`/캡션 통째 제거 |
| 자매 사이트 (Advox · Rising Voices · Lingua) | 별도 서브도메인. `globalvoices.org` posts 엔드포인트에 섞이지 않음 | 해당 없음 |

## 4. 안정 식별자 — `id`

- `id`: 정수 WP post ID (`857683`). **항목마다 고정**, 재수확에 그대로 쓴다. 중복 차단 키.
- `guid.rendered`: `https://globalvoices.org/?p=857683` — `id` 의 URL 형태, 정보량 동일.
- `link`: `https://globalvoices.org/2026/09/06/<slug>/` — 사람이 읽는 출처 표기용. **슬러그는 편집 시 바뀔 수 있으므로 키로 쓰지 않는다.**
- `date`(발행) 와 `modified`(최종수정)가 **따로 온다** — 실측상 `modified < date` 인 경우가 흔하다(예약 발행). 증분은 `modified` 로 잡는다.

## 5. 증분 커서 — 실측 확인

| 방법 | 호출 | 결과 |
|---|---|---|
| 증분 | `?modified_after=2026-09-01T00:00:00&orderby=modified&order=asc` | `X-WP-Total: 44` |
| 연도 창 | `?after=2026-01-01T00:00:00` | `X-WP-Total: 403` |
| 깊은 페이지 | `?per_page=100&page=501&orderby=date&order=asc` | 200 · **1.75초** |
| 마지막 페이지 | `?per_page=100&page=1043` | 200 · **1.41초** |

**깊은 오프셋(104,200)에서도 1.4초** — 페이지네이션이 끝까지 살아 있다.

⚠️ **정렬을 반드시 고정한다.** 2026-08-16 IA 실측(정렬 없는 페이지네이션 → 214건 중복 + 동수 누락)의 재발을
막기 위해, 백필은 `orderby=date&order=asc` 를 **월 단위 `after`/`before` 창과 함께** 쓴다.
창을 쓰면 수확 도중 새 글이 발행돼도 이미 지난 창의 오프셋이 밀리지 않는다.
증분은 `modified_after` + `orderby=modified&order=asc` 로 **수정된 글도 다시 집는다**.

## 6. 현실적 확보 가능 편수 — 실측 104,352, 그러나 시대가 갈린다

연도별 실측(`after`/`before` 창의 `X-WP-Total`):

| 연도 | 편수 | | 연도 | 편수 |
|---|---|---|---|---|
| 2005 | 4,811 | | 2020 | 1,198 |
| 2008 | **13,707** | | 2022 | 1,111 |
| 2011 | 8,903 | | 2023 | 1,204 |
| 2014 | 3,573 | | 2024 | 1,070 |
| 2017 | 1,652 | | 2025 | 1,006 |
| | | | 2026(9월까지) | 403 |

**초기 아카이브는 쓸 수 없다.** 2012년 60편 표본 실측 — 중앙값 **378어**, **28/60(47%)이 300어 미만**,
27/60(45%)이 링크 밀집. 실제로 2009-06 표본 2편은 **11어·15어짜리 링크 토막**이었다
(*"Balkans via Bohemia compares the current situation in Iran with the 2000 election in Serbia."*)
→ `reject`/`fragmentary`.

**쓸 수 있는 구간은 2017~2026 ≈ 11,700편.** 여기서
파트너 재게시 22% 와 소셜 임베드 밀집 20%(일부 중복)를 빼면 **깨끗한 산문 약 7,000~9,000편**.
최근 60편 표본에서 **파트너도 인터뷰도 아닌 순수 산문이 47/60 = 78%**.

**목표 340편은 2024~2026 세 해분(2,479편)만으로도 충족된다** — 초기 아카이브를 건드릴 이유가 없다.

## 7. 지문 적합성 표본 판정 (5편 실독)

| # | 글 | 판정 | genre | why |
|---|---|---|---|---|
| 1 | *Maternity leave is expanding in Bangladesh, but garment workers still struggle for childcare* (id 857018, 1,368어) | **use** | `social` | 통념(제도 개선) → 반전(그 다음이 문제) → 현장 증언 순으로 논지가 서고 도입 300어가 그대로 수능 도입부다 |
| 2 | *The people who live in cities must have a say in how they are shaped* (id 857537, 1,513어) | **use**(도입부만) / 이후 **reject** | `social` / `reference` | 앞 2단락은 자족적 논설이나 이후 전부 `JS:`/`KA:` 문답 전사라 발췌 위치가 뒤로 밀리면 읽는 글이 아니다 |
| 3 | *What does folklore have to say?* (id 857006, 905어) | **narrative** | `culture` | 1인칭 회상으로 시간순 전개 — 심경·장문형 후보. 다만 Tharu·Morangsair·Saptari 등 고유명사 밀도가 높아 어휘 부담이 크다 |
| 4 | *Singapore Plans to Pull the Plug on Internet Access for Public Servants* (2016, 697어) | **use** | `technology` | 정책 하나를 놓고 찬반이 정리된 설명문이나 인용 블록 5개를 걷어내면 본문이 400어대로 줄어든다 |
| 5 | *Israelis React With Outpouring of Support for LGBTQ Community* (2016, 1,228어) | **reject** | `mixed` | 트윗·인스타 임베드 10개를 이어 붙인 반응 모음이라 태그를 벗기면 서로 다른 목소리가 병렬로 남는다 |
| — | *Iran: "Iran 2009 vs. Serbia 2000"* (2009, 15어) | **reject** | `fragmentary` | 외부 블로그를 가리키는 한 문장 링크 토막이라 앞뒤가 없다 |

**요약**: 2020년 이후 GV 오리지널 산문은 **`use` 적합성이 높다** — 국제 사회·환경·인권 주제의
1,000~1,400어 설명·논증문이고, 도입부가 「통념 → 반전 → 물음」 구조를 자주 취해 CSAT 지문형과 잘 맞는다.
**탈락 축은 셋** — (a) Q&A 전사, (b) 소셜 임베드 반응 모음, (c) 고유명사·지명 밀도.

---

## 수확기를 짠다면

**본뜰 것: `scripts/csat/harvest-plos.mjs`** (API 형 — 페이지 커서 + `_fields` 축소 + 청크 저장 구조가
그대로 대응된다). RSS 형인 `scripts/acp/collect-daily.mjs` 는 전문이 안 와서 맞지 않는다.

**커서 파일**: `scripts/csat/data/globalvoices-harvest-cursor.json`
(`{ mode: 'backfill'|'incremental', window: '2026-08', page: 3, lastModifiedGmt: '...', seenIds: [...] }`).
PLOS 가 `plos-harvest-cursor.json` · `plos-extract-cursor.json` 를 나눠 쓰는 것과 같이
**수확 커서와 발췌 커서를 분리**한다.

**단계**

1. **수확** — `after`/`before` **월 단위 창** × `orderby=date&order=asc` × `per_page=100`.
   2024-01 ~ 2026-09 = 33창 · 편수 2,479 → **25 호출** 남짓. 한 번에 돈다.
   더 필요하면 2017 까지 창을 뒤로 늘린다(총 ~11,700편 → 120 호출).
   `_fields=id,date,modified,link,title,content,excerpt,categories` 로 응답을 줄인다.
2. **라이선스 게이트 (수확 즉시, DB 진입 전)** — 본문 평문에
   `content-sharing agreement` · `originally published (by|on|in)` · `first published (in|on|by)` ·
   `republished (here|on Global Voices)` 중 하나라도 걸리면 **제외하고 사유를 기록**한다.
   ⚠️ 이 게이트는 **라이선스 게이트이므로 조용히 통과시키면 안 된다** — 제외 편수를 반드시 출력한다.
3. **본문 정제** — `<figure>`·`<img>`·`<blockquote class="twitter-tweet">`·`<iframe>`·캡션 제거 후
   재계수. 정제 후 **600어 미만이면 임베드 모음**이므로 탈락(표본 #5 유형).
   `\b[A-Z]{2,4}\s?\):` 가 3회 이상이면 Q&A 전사이므로 도입부만 남긴다(표본 #2 유형).
4. **발췌** — PLOS 와 같이 300어대로 자르되, GV 는 **도입 2~3단락이 가장 좋다**(표본 #1·#4).
5. **판정 드레인** — `scripts/csat/gate-article-drain/` 규칙 그대로. 청크 100편 단위.
6. **증분** — 이후는 `modified_after=<lastModifiedGmt>` + `orderby=modified&order=asc` 한 호출.
   주 1회면 40~50편(실측 2026-09-01 이후 6일간 44편).

**재실행 안전** — 키는 `id`. 이미 적재된 `id` 는 export 가 건너뛴다. 창 단위 백필은 창마다 완결되므로
중간에 끊겨도 그 창부터 다시 돌리면 된다.

**출처 표기 의무** — CC BY 3.0 은 (a) 저자명, (b) GV 링크, (c) **라이선스 링크**,
(d) **변경했다는 사실 표시**를 요구한다. 이 프로젝트는 발췌·변형해 쓰므로 (d)가 반드시 필요하다 —
기사 행에 `author` · `source_url` · `license: 'CC BY 3.0'` · `license_url` · `modified: true` 를
같이 저장해야 지문 하단 출처 문구를 자동 생성할 수 있다. **수확기 설계 시점에 컬럼을 잡는다.**

---

## 확인 실패 / 확인하지 않은 것

- **파트너 재게시본의 실제 라이선스 지위** — GV 가 원매체에서 어떤 조건으로 들여오는지는 공개돼 있지 않다.
  "Unless otherwise stated" 의 문언과 기사 머리 고지를 근거로 **보수적으로 전량 제외**하기로 한 것이며,
  개별 허락을 받으면 쓸 수 있을 가능성은 남는다.
- **104,352 의 언어 구성** — `class_list` 에 `category-english` 가 붙는 것은 확인했으나,
  전체 중 영어 아닌 글의 비율은 세지 않았다(Lingua 번역본은 서브도메인이므로 섞이지 않는 것으로 보이나 **미확인**).
  어차피 2017년 이후 구간만 쓸 계획이라 결정에 영향이 없어 세지 않았다.
- **robots.txt / rate limit** — 확인하지 않았다. 수확기 착수 시 확인하고 호출 간격을 둔다.
- 표본은 **총 11편**(최근 5 + 2009/2016/2024 각 2)을 실독했고, 통계는 60편 × 2구간의
  메타데이터·본문 계수로 냈다. DB 에는 아무것도 쓰지 않았다.
