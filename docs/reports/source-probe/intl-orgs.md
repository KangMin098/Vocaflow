<!-- docs/reports/source-probe/intl-orgs.md -->
# 국제기구·전문가 백과 7개 확보 정찰

목표 표 55·73·79·82위 묶음. **7곳 중 6곳이 반려**, 채택은 **UNESCO Courier 한 곳**이다.
목표 합계 200편은 Courier 단독으로 채운다.

## 0. 곳별 라이선스 (1차 자료 실측 · 2026-09-07)

| 소스 | 라이선스 (출처) | 변형 | 상업 | 판정 |
|---|---|---|---|---|
| **UNESCO Courier** | **CC BY-SA 3.0 IGO** — `courier.unesco.org/en/about` "Periodical available in Open Access under the Attribution-ShareAlike 3.0 IGO (CC-BY-SA 3.0 IGO) license" | **가능** (SA 전염) | 가능 | **채택** |
| UN News | 저작권 유보 — 푸터가 `un.org/en/about-us/copyright` 로 링크, "None of the materials … may be used, reproduced or transmitted, in whole or in part … without permission in writing from the publisher" | 불가 | 불가 | **반려** |
| UNEP | 저작권 유보 — `unep.org/terms-and-conditions` "for the User's personal, **non-commercial** use, without any right to resell or redistribute them or to **compile or create derivative works** therefrom" | **불가** | 불가 | **반려** |
| WHO fact sheet | **CC BY-NC-SA 3.0 IGO** — `who.int/about/policies/publishing/copyright` "all publications published by WHO CC BY-NC-SA 3.0 IGO" | 가능 | **불가(NC)** | **반려** |
| Encyclopedia of Earth | CC BY-SA 3.0 (문서 푸터 `creativecommons.org/licenses/by-sa/3.0`, 2024-03 스냅샷) · 사이트 자체 약관은 EOL 약관으로 위임 | 가능 | 가능 | **반려**(접근 차단) |
| Citizendium | CC BY-SA 3.0 Unported — `CZ:Reusing_Citizendium_Content` "all its original articles, are under the Creative Commons Attribution-Share Alike-3.0 Unported license … also hosts some articles under the GFDL" | 가능 | 가능 | **반려**(접근 차단) |
| Scholarpedia | **CC BY-NC-SA 3.0** — `Scholarpedia:Terms_of_Use` 가 `creativecommons.org/licenses/by-nc-sa/3.0` 전문을 싣는다 | 가능 | **불가(NC)** | **반려** |

> ⚠️ EoE·Citizendium 두 곳의 라이선스는 **Wayback 스냅샷**(각 2024-03-27 / 2025-06-09)에서 읽었다.
> 라이브 사이트가 이 머신에서 Cloudflare 챌린지로 막혀 원문을 직접 못 읽었기 때문이다. 스냅샷은
> 해당 사이트 자신의 페이지이므로 1차 자료로 보되, **실서비스 시점에 다시 확인해야 한다.**

---

# UNESCO Courier 확보 정찰

| | |
|---|---|
| 판정 | **채택** |
| 확보 가능 편수 | 영어 기사 URL **1,446** (사이트맵 실계수) 중 전문 게재분 **약 940** (표본 48편 중 31편이 2017년 이후 = 65%) |
| 라이선스 | CC BY-SA 3.0 IGO · 변형 **가능** (단 **SA 전염** · **본문 텍스트에만 적용, 이미지는 사전 허가 필요**) |
| 전문 | **2017년 이후 온다** (1,100~1,900어) · 2011년 이전 아카이브는 **티저 100~200어 + PDF 링크**뿐 |
| 안정 식별자 | URL 슬러그 (`/en/articles/<slug>`) + 페이지 내 Drupal `uuid` (기사마다 유일) |
| 증분 커서 | 사이트맵 `<lastmod>` (URL 마다 개별 값 · 실측 대조 통과) |
| 정찰 일자 | 2026-09-07 |

## 1. 대량 접근 경로 — 사이트맵 (API·RSS 없음)

```
GET https://courier.unesco.org/sitemap.xml          → sitemapindex, 하위 4장
GET https://courier.unesco.org/sitemap.xml?page=1..4 → 총 <loc> 6,447
```

RSS 는 **없다** — `/rss`, `/en/rss.xml`, `/en/feed` 전부 404(Drupal 404 HTML 1.79 MB 반환).
API 도 공개되지 않는다. 사이트맵 → 기사 HTML 파싱이 유일한 경로다.

⚠️ **robots.txt 를 반드시 읽고 짤 것** (`courier.unesco.org/robots.txt`, 2026-08-24 갱신):

- `ClaudeBot` · `anthropic-ai` · `GPTBot` · `CCBot` 등 **AI 크롤러 UA 16종은 `Disallow: /`**.
- `User-agent: *` 에는 기사 경로 차단이 **없다** (`/core/` `/profiles/` `/admin/` `/*/files/css/` 등만 금지).
- `Content-Signal: search=yes,ai-input=yes,**ai-train=no**,use=reference`.

→ 수확기는 **Vocaflow 를 밝히는 자체 UA** 로 `User-agent: *` 규칙을 따르고,
받은 텍스트를 **모델 학습에 쓰지 않는다**(지문 코퍼스 적재는 CC BY-SA 3.0 IGO 가 허용하는 재배포다).
이 구분을 수확기 주석에 남긴다 — 나중에 "왜 AI UA 를 안 썼나" 를 되짚을 수 있어야 한다.

## 2. 전문이 오는가 — 시대에 따라 갈린다

기사 본문은 `class="main-node-content"` ~ `class="content-tags"` 사이에 있다.
표본 12편의 본문 어수와 `datePublished`:

| 발행 | 어수 | PDF 링크 |
|---|---|---|
| 2018-03 · 2018-06 · 2019-10 · 2021-06 | 1,446 / 1,938 / 1,554 / 1,131 | 없음 |
| 1953 · 1954 · 1958 · 1963 · 1970 · 1974 · 2001 | 9 / 45 / 97 / 102 / 135 / 153 / 164 / 203 | 있음 |

→ **2017년 재창간 이후 = HTML 전문**, 그 이전 = **티저 + UNESDOC PDF**.
아카이브분을 쓰려면 PDF 를 따로 뜯어야 하므로 **1차 수확 대상에서 뺀다.**

또 `/en/articles/` 네임스페이스에는 **호(issue) 랜딩 페이지**도 섞여 있다
(예: `20000-worlds-under-sea`, 본문 59어 · "Discover this issue. Download the PDF").
**본문 400어 미만은 버린다** 는 규칙 하나로 아카이브와 호 랜딩이 함께 걸러진다.

## 3. 라이선스 — 텍스트만 CC, 이미지는 아니다

`courier.unesco.org/en/about` 원문:

> Periodical available in Open Access under the Attribution-ShareAlike 3.0 IGO (CC-BY-SA 3.0 IGO) license.
> … The present license applies exclusively to the texts. **For the use of images, prior permission shall be requested.**

- 기사 HTML 에 **항목별 라이선스 필드는 없다** — 간행물 전체에 일괄 적용이다.
  따라서 항목마다 라이선스를 확인할 필요는 없으나, 반대로 **예외 항목을 기계로 잡을 방법도 없다.**
- **SA 전염**: 발췌를 실은 화면·산출물이 CC BY-SA 로 묶인다. `The Conversation`(ND)과 달리 변형은 되지만,
  PLOS(CC BY)와 달리 **자유롭지 않다.** 적재 시 `license='CC-BY-SA-3.0-IGO'` 를 행에 남기고
  학습자 화면에 출처·라이선스 표기를 띄울 자리가 있는지 먼저 확인할 것.
- **이미지는 가져오지 않는다.** 텍스트만 적재한다.

## 4. 안정 식별자

URL 슬러그가 고정이다(`/en/articles/threat-killer-robots`). 추가로 페이지 안 Drupal 설정에
기사마다 유일한 `uuid` 가 있다 — 실측 3편 모두 서로 다른 36자 UUID
(`7c78afd7-…` · `62573c3a-…` · `36465288-…`). 슬러그가 바뀔 경우를 대비해 **둘 다 저장**한다.
사이트맵의 `xhtml:link hreflang` 로 7개 언어판이 같은 기사임을 알 수 있으므로,
영어판만 적재하고 나머지는 무시하면 중복이 생기지 않는다.

## 5. 증분 커서 — `<lastmod>`

사이트맵 6,447 개 `<loc>` 중 **6,431 개에 `<lastmod>`** 가 붙어 있고, 서로 다른 값 1,189 종이다
(전부 같은 값이면 쓸모없는데 그렇지 않다). 실측 대조: `threat-killer-robots` 의 `<lastmod>` 는
`2023-10-16T02:21:49+02:00`, 기사 화면 표기는 "Last update: 16 October 2023" — **일치**.

→ 커서는 `{ "lastRunLastmod": "<ISO>" }` 하나면 된다. 사이트맵은 정렬이 보장되지 않으므로
**페이지 토큰으로 이어받지 말고 4장을 매번 통째로 받아**(합계 5.7 MB) `lastmod > 커서` 만 고른다.
2026-08-16 IA 사고(정렬 없는 페이지네이션이 214건 중복·동수 누락)를 여기서 되풀이하지 않는 방법이다.

## 6. 현실적 확보 가능 편수

| | 값 | 근거 |
|---|---|---|
| 영어 기사 URL | **1,446** | 사이트맵 4장 실계수 (`/en/articles/` 1,446 · fr 1,425 · es 1,389 · ru 635 · zh 619 · ar 611 · pt 258) |
| 그중 전문 게재 | **약 940** | 표본 48편(체계추출 2회: 12 + 36)의 `datePublished` 중 2017년 이후 **31/48 = 65%**. 표본이 48편이라 오차가 크다 — 대략 **800~1,080** 으로 읽을 것 |
| `use`/`narrative` 로 남을 것 | **약 750** | 아래 표본 판정에서 5편 중 4편이 `use`/`narrative` |

목표 200편의 **3배 이상**이다. 초회 수확을 2017년 이후로만 한정해도 목표를 넘긴다.

## 7. 지문 적합성 표본 판정 (실제로 읽은 5편)

| 기사 | 어수 | verdict | genre | 왜 |
|---|---|---|---|---|
| `threat-killer-robots` (2018-06) | 1,938 | **use** | `technology` | 자율무기 규제 논쟁을 통념→쟁점→각국 입장 순으로 세운 논설. 300어 발췌로 잘라도 논지가 선다 |
| `essential-tool-understanding-world` (2022) | 1,198 | **use** | `science` | GPS·JPEG·오류정정부호로 수학의 편재를 예시하는 전형적 설명문. 수능 41~42번형에 그대로 맞는다 |
| `protecting-cetaceans-yangtze` (2021-06) | 1,131 | **narrative** | `nature` | 연구자 1인칭 회고로 시작해 뒤에서 보전 설명으로 넘어간다 — 앞부분은 시간순 이야기다 |
| `turkish-coffee-not-just-drink-culture` (2024) | 1,124 | **narrative** | `culture` | 시장 현장 묘사와 인용이 절반이라 자족적 논증이 아니다. 뒤쪽 관습 설명 단락만 떼면 `use` 가 된다 |
| `nelly-minyersky-green-queen` (2019-10) | 1,554 | **reject** | `reference` | "Interview by …" 로 시작하는 Q&A 나열이다 — 읽는 글이 아니라 문답 목록이라 발췌가 성립하지 않는다 |

**수확기가 반드시 거를 것 두 가지**:
1. 본문에 `Interview by` 또는 `Interview with` 가 있으면 버린다 (Courier 의 고정 꼭지다).
2. 본문 400어 미만은 버린다 (아카이브 티저 · 호 랜딩 페이지).

---

## 반려한 6곳 — 근거 한 줄씩

| 소스 | 반려 사유 (SPEC 판정 기준) |
|---|---|
| **UN News** | 라이선스 유보. 푸터가 UN 본체 저작권 고지로 링크하고, 그 고지가 "written permission" 을 요구한다. `news.un.org/en/content/terms-and-conditions` 는 404 — **UN News 자체 약관은 없다** |
| **UNEP** | 약관이 파생물 생성을 **명시적으로 금지**("without any right to … compile or create derivative works therefrom"). ND 와 같은 취급이다. 문서 저장소 `wedocs.unep.org`(DSpace 8.2)에 별도 경로가 있을 수 있으나 OAI 엔드포인트 `/server/oai/request` 는 404 — **확인 실패**, 별건으로 남긴다 |
| **WHO fact sheet** | **CC BY-NC-SA 3.0 IGO** — NC 라 상업 교재에 못 쓴다. WHO 자신이 "Permission is required for commercial uses" 라고 적는다. (fact sheet HTML 안에 CC 표기가 없어 정책 페이지에서 확인했다) |
| **Scholarpedia** | 이중 반려. ① **CC BY-NC-SA 3.0** (NC) ② **사이트가 죽어 있다** — HTTPS 는 연결 자체가 안 되고(포트 443 타임아웃 21초), HTTP 는 모든 문서·API 요청에 **502 Bad Gateway**(3회 재시도 · Main_Page · Deep_Learning · `w/api.php` 전부). 라이선스는 Wayback 2026-08-30 스냅샷에서 읽었다 |
| **Citizendium** | 라이선스는 쓸 수 있으나(CC BY-SA 3.0) **대량 접근 경로가 없다** — 라이브 사이트·`api.php` 모두 **Cloudflare 챌린지 403**(브라우저 UA·전체 헤더 세트·WebFetch 전부 실패). 편수도 못 셌다. 챌린지 우회는 정찰 범위 밖이다 |
| **Encyclopedia of Earth** | 같은 이유로 **Cloudflare 403**. 더해 **콘텐츠가 얼었다** — 약관 문서가 2016년 이후 수정되지 않았고 사이트 약관이 EOL 약관으로 위임돼 있어 항목별 라이선스가 EOL 기여자마다 갈린다. 개별 문서 푸터는 CC BY-SA 3.0 이지만 **원문이 미국 정부 보고서 전재인 경우가 많아** 항목별 확인이 필요하다 |

---

## 수확기를 짠다면

**본뜰 것**: `scripts/acp/collect-daily.mjs`(RSS형)가 가장 가깝다 — 목록에서 URL 을 모으고
개별 페이지를 파싱하는 구조가 같다. 다만 RSS 대신 **사이트맵 XML** 을 읽으므로
목록 단계만 갈아 끼운다. `scripts/csat/harvest-plos.mjs` 의 커서·중복 방지 골격은 그대로 쓴다.

```
scripts/csat/harvest-courier.mjs
scripts/csat/data/courier-cursor.json   ← { "lastmod": "<ISO>", "seen": <n> }
```

**단계**

1. 사이트맵 4장을 받아 `/en/articles/` `<loc>` + `<lastmod>` 를 뽑는다 (1 요청 + 4 요청 · 5.7 MB).
2. `lastmod > cursor.lastmod` 만 남기고 **`lastmod` 오름차순으로 정렬**한다 (정렬은 우리가 한다).
3. 기사 HTML 을 받아 `main-node-content` ~ `content-tags` 를 잘라 태그를 벗긴다.
   `datePublished` · `uuid` · 저자(`By …` / `Interview by …`)를 함께 뽑는다.
4. **버린다**: 본문 400어 미만 · `Interview by|with` 포함 · `datePublished < 2017`.
5. 남은 것을 300어대 발췌로 자르고 `gate-article-drain` 청크로 내보낸다
   (판정은 기존 드레인 3단 구조를 그대로 탄다).
6. 성공한 마지막 `lastmod` 로 커서를 갱신한다 — 중간에 죽어도 그 지점부터 재개된다.

**요청 예절**: 요청 간 1초 간격. UA 는 `VocaflowHarvester/1.0 (+연락처)` — AI 크롤러 UA 를 쓰면
robots.txt 의 `Disallow: /` 에 걸린다.

**분할**: 초회 약 940편을 **3회**(회당 ~320편 · 약 30 MB · 1초 간격이면 6분)로 나눈다.
이후는 증분이라 회당 수십 편이다.

**적재 시 남길 것**: `license='CC-BY-SA-3.0-IGO'` · `attribution='The UNESCO Courier'` ·
원문 URL · `uuid`. **이미지는 가져오지 않는다** (라이선스가 텍스트에만 적용된다).
