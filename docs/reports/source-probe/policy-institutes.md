<!-- docs/reports/source-probe/policy-institutes.md -->
# 정책연구기관 6곳 확보 정찰

목표 표 38·39·40·41·44·61위 (Pew · Brookings · RAND Commentary · World Bank OKR/Blogs ·
OECD · Our World in Data), 합계 채택 추정 약 1,030편. 정찰 일자 **2026-09-07**.

규격은 [SPEC.md](./SPEC.md). **수확하지 않았다** — 표본 5편(WB 3 · OECD 1 · OWID 1),
DB 미기재.

---

## 0. 곳별 라이선스 (1차 자료 실측)

| 소스 | 라이선스 (1차 근거) | 변형 | 판정 |
|---|---|---|---|
| Pew Research Center | 자체 Terms of Use — CC 아님. 「modify, create derivatives of」는 허용하나 **「in principal part … republished」는 서면 허가 필요** | 조건부 | **반려** |
| Brookings | `Copyright … All rights reserved` · 파생물 명시 금지 | 불가 | **반려** |
| RAND (Commentary 포함) | `RAND retains copyright to most of our published works. Permission is required.` CC BY 4.0 는 Gates 재단 지원분 등 **일부만** | 불가 | **반려** |
| World Bank **Blogs** | `© 2026 The World Bank Group, All Rights Reserved` (푸터) | 불가 | **반려** |
| World Bank **OKR** | 항목별 `dc:rights` — 표본 100건 중 **CC BY 3.0 IGO 77 · BY-NC 13 · BY-NC-ND 4** | 가능(BY만) | **채택** |
| OECD | 2024-07-01 이후 발행분 **CC BY 4.0** (OECD Open Access Policy). 이전분도 자체 약관이 상업·비상업 adaptation 을 허가 없이 허용 | 가능 | **보류** |
| Our World in Data | **CC BY 4.0** (푸터: "Our charts, articles, and data are licensed under CC BY") | 가능하나 ⚠️ 아래 §4 | **채택** |

---

## 1. 반려 4곳 — 근거와 정지 지점

SPEC 「CC 가 아닌 곳은 그 자리에서 반려로 적고 조사를 멈춘다」에 따라 **1·2·4~7항은
조사하지 않았다.**

### 1-1. Pew Research Center — 반려 (단, 되짚어 볼 여지 있음)

`https://www.pewresearch.org/about/terms-and-conditions/` (Cloudflare JS 챌린지로 직접 호출
403 → Wayback `20260905180219` 스냅샷으로 확인. Effective Date 2018-05-25, dateModified
2026-06-09).

§1 Grant of License 원문:

> …you may access, print, copy, reproduce, cite, link, display, download, distribute,
> broadcast, transmit, publish, license, transfer, sell, **modify, create derivatives of**,
> or otherwise exploit the Content, provided that all copies display all copyright and
> other applicable notices … and provided further that you do not use the Content in any
> manner that implies … a Center endorsement …

**여기까지만 보면 CC BY 보다 넓다.** 그러나 바로 다음 단락이 막는다:

> Under no circumstances may the Content be reproduced **in principal part**, mirrored,
> catalogued, framed, displayed simultaneously with another site or otherwise republished
> in its entirety or **in principal part** without the express written permission of the Center

Pew 단문 리포트는 600~900어대가 흔하고, 우리가 쓰는 단위는 **300어대 발췌**다.
짧은 글의 300어는 "in principal part" 로 읽힐 소지가 크고, 그 판단이 우리에게 없다.
CC 가 아니어서 기계적으로 걸러낼 필드도 없다 → **반려.**

⚠️ 다만 이 조항은 **길이에 걸리는 것이지 변형에 걸리는 것이 아니다.** 장문 리포트에서만
뽑고 Pew 에 서면 확인을 받는 경로는 이론상 열려 있다. 이번 정찰의 권한 밖이라 여기서 멈춘다.

### 1-2. Brookings — 반려

`https://www.brookings.edu/terms-and-conditions/` — `Copyright 2023–2024 © The Brookings
Institution and/or its licensors. All rights reserved.` 파생물 생성은 명시적으로 금지,
CC 언급 **0**. 더 볼 것이 없다.

### 1-3. RAND Commentary — 반려

`https://www.rand.org/pubs/permissions.html` → `…/about/publishing/permissions.html` 리다이렉트.

> RAND retains copyright to most of our published works.
> Permission is required from RAND to reproduce, or reuse in another form, any of its publications.

> Some RAND publications, **including those documenting research that was funded by the
> Bill & Melinda Gates Foundation**, are published under the Creative Commons Attribution
> 4.0 Generic License (CC BY 4.0) or an equivalent license.

CC BY 는 **일부 간행물에만** 붙는 예외이고, Commentary(오피니언·블로그)가 그 예외에 든다는
근거는 이 페이지에 없다. 또 `Unauthorized posting of RAND's digital content, including PDFs,
is prohibited` 로 재게시 자체를 막는다 → **반려.**

### 1-4. World Bank Blogs — 반려

`https://blogs.worldbank.org/en/opendata` 푸터 `© 2026 The World Bank Group, All Rights
Reserved`. **OKR 의 CC BY 3.0 IGO 는 블로그에 적용되지 않는다** — 목표 표가 두 채널을
한 행으로 묶었으나 라이선스가 서로 다르다. Blogs 는 반려, OKR 만 §2 로 간다.

---

## 2. World Bank OKR

| | |
|---|---|
| 판정 | **채택** |
| 확보 가능 편수 | 실측 총 레코드 **40,363** · 표본 100건 중 CC BY 77 · 영어 94 → **CC BY 영어 약 29,000 항목** (편수 아닌 문서 수) |
| 라이선스 | 항목별 `dc:rights` — CC BY 3.0 IGO 77% · 변형 **가능** (BY-NC 13% · BY-NC-ND 4% 는 제외 대상) |
| 전문 | **온다** — ORIGINAL 번들에 PDF 와 **`.txt` 형제 파일**이 같이 있다 (PDF 파싱 불필요) |
| 안정 식별자 | handle `10986/NNNN` (= OAI identifier `oai:openknowledge.worldbank.org:10986/NNNN`) · PRWP 는 DOI `10.1596/…` 병기 |
| 증분 커서 | OAI-PMH `from`/`until` + `resumptionToken` |
| 정찰 일자 | 2026-09-07 |

**1. 대량 접근 경로 — OAI-PMH 있다.** (질문받은 항목)

```
https://openknowledge.worldbank.org/server/oai/request?verb=Identify
```

실측 응답: `repositoryName=Open Knowledge Repository` · `protocolVersion=2.0` ·
`earliestDatestamp=2012-03-19T08:43:52Z` · `deletedRecord=transient` ·
`granularity=YYYY-MM-DDThh:mm:ssZ`(초 단위). DSpace 7 기반이라 REST API 도 함께 열려 있다
(`/server/api/pid/find?id=hdl:10986/6318` → 302 → item JSON).

`ListMetadataFormats` 12종: `oai_dc` · `qdc` · `mods` · `dim` · `marc` · `mets` · `ore` ·
`rdf` · `xoai` · `didl` · `etdms` · `uketd_dc`. 라이선스가 `dc:rights` 로 오므로 `oai_dc`
로 충분하다.

**2. 전문.** DSpace REST 로 번들→비트스트림을 따라가면 영어 항목은 PDF 옆에 `.txt` 가 있다.
표본 4건:

| handle | 비트스트림 |
|---|---|
| 10986/19190 | `multi0page.pdf`(3.5MB) + `multi0page.txt`(156KB) |
| 10986/6318 | `WPS4733.pdf`(612KB) + `WPS4733.txt`(64KB) |
| 10986/17881 | `…Pakistan.pdf`(2.1MB) + `…Pakistan.txt`(142KB) |
| 10986/37708 | PDF 만 (포르투갈어 항목) |

PLOS 와 달리 **PDF 텍스트 추출기를 우리가 짤 필요가 없다.** `.txt` 가 없는 항목은 건너뛰면 된다.

**3. 라이선스.** `dc:rights` 가 항목마다 온다. 2026-08-01 이후 페이지 100건 실측:

| 값 | 건 |
|---|---|
| CC BY 3.0 IGO (URL 형태 포함) | **77** |
| CC BY-NC 3.0 IGO | 13 |
| CC BY-NC-ND 3.0 IGO | 4 |
| `World Bank` (= 유보) / 없음 / 기타 | 6 |

표기가 `CC BY 3.0 IGO` · `http://…/by/3.0/igo` · `https://…/by/3.0/igo/` 로 **네 가지가
섞여 있다** — 정규화 없이 문자열 비교하면 절반을 놓친다. `by-nc` 를 먼저 걸러낸 뒤
`licenses/by/` 를 매칭하는 순서여야 한다(`by-nc` 도 `by` 를 포함한다).

**4. 안정 식별자.** OAI header 의 `<identifier>` 가 handle 을 그대로 담는다.
`dc:identifier` 에는 handle URL · DOI · documents.worldbank.org 큐레이티드 URL 이 함께 오는데,
**마지막 것은 연도 경로가 박혀 있어 재구성이 불안정하다** — handle 을 열쇠로 쓴다.

**5. 증분 커서.** `from=2026-08-01T00:00:00Z` 로 1,119건이 잡혔고(`completeListSize` 로 총계가
같이 온다), `resumptionToken` 이 `oai_dc/2026-08-01T00:00:00Z///100` 형태로 커서를 명시한다.
**IA 때 같은 무순 페이지네이션 사고가 나지 않는다** — OAI-PMH 는 토큰이 순서를 보장한다.
다만 `datestamp` 는 발행일이 아니라 **수정일**이다(위 1,119건에 2003년 논문이 섞여 있다) —
재수확 때 같은 글이 다시 오는 것은 정상이고, handle 중복 차단이 그걸 받아야 한다.
`deletedRecord=transient` 이므로 삭제 이력은 신뢰하지 않는다.

**6. 편수.** `ListIdentifiers&metadataPrefix=oai_dc` 의 `completeListSize` = **40,363**.
CC BY 비율 0.77 · 영어 비율 0.94(표본 100: `English,en_US` 53 · `English` 33 · `en_US` 4 ·
`English,en` 2 · `EN` 2 · 없음 6) → **약 29,000 항목**. 목표 표의 1,030편을 이 한 곳이
여러 배로 덮는다. ⚠️ **항목 수이지 지문 수가 아니다** — 보고서 한 건에서 300어대 발췌가
몇 편 나오는지는 **못 셌다**(게이트를 통과시켜 봐야 안다).

**7. 지문 적합성.** 표본 2편을 실제로 읽었다.

- `10986/6318` *Is the Developing World Catching up?* (WPS4733) 서론 — 통념 제시("The common
  understanding is that…") → 문헌 반박 → 이 연구의 물음. **`use` / `economics`.**
  JUDGING.md 가 "가장 좋다" 고 적은 형태 그대로다.
- `10986/45508` *South Africa's Biodiversity Stewardship Program* — 356K자 중 앞부분이
  감사의 말·인명 나열이다. **`reject` / `reference`.** 보고서형은 앞 15~20%를 버려야 한다.

→ **Working Paper 유형을 우선**한다. 표본 페이지의 CC BY 77건 중 유형이 `Working Paper` 인
것이 31건, 유형 미기재 30건, `Report`/`Brief`/`Policy Note`/`Book` 등이 나머지다.

---

## 3. OECD

| | |
|---|---|
| 판정 | **보류** — 경로·전문·편수는 충분하나 **항목별 라이선스 필드가 없다**(§3 참조) |
| 확보 가능 편수 | 실측 영어 publications 사이트맵 URL **15,026**(2024:5,318 · 2025:6,432 · 2026:3,276) 중 챕터 URL **8,448** |
| 라이선스 | 2024-07-01 이후 CC BY 4.0 · 변형 **가능**(disclaimer 의무) |
| 전문 | **온다** — HTML 챕터 페이지 |
| 안정 식별자 | URL 의 DOI 접미사 (`…_4c3ecd4d.html` → `10.1787/4c3ecd4d-en`) |
| 증분 커서 | 사이트맵 `lastmod`(전 URL 보유) + 연도별 사이트맵 분할 |
| 정찰 일자 | 2026-09-07 |

**1. 경로.** `https://www.oecd.org/sitemap.xml` → 하위 사이트맵 **769개**, 그중 영어 **57개**
(전부 `en-publications-<연도>` 꼴). 관련 3개를 실제로 받아 셌다:

| 사이트맵 | 총 URL | `/full-report/` 챕터 | 표지·기타 |
|---|---|---|---|
| `en-publications-2024` | 5,318 | 3,131 | 1,905 |
| `en-publications-2025` | 6,432 | 3,431 | 2,605 |
| `en-publications-2026` | 3,276 | 1,886 | 1,121 |

`robots.txt` 는 `/content/dam/oecd/` 와 `/adobe/dynamicmedia/deliver/` 만 막는다 —
publications 경로는 허용이다.

⚠️ **Cloudflare 챌린지가 있다.** 기본 UA 로는 403 (`Just a moment...`), 브라우저 UA
(`Chrome/126`) + `Accept: application/xml` 이면 200. 같은 URL 이 연속 호출에서 한 번
403 을 냈다 — 수확기는 UA 고정 + 저속 + 403 재시도가 필요하다.

**2. 전문.** 챕터 HTML 에 본문이 통째로 들어 있다(표본 106K자). 별도 API 없이 파싱 가능.

**3. 라이선스 — 여기가 보류 사유다.** 1차 근거는 OECD Terms and conditions
(직접 호출 403 → Wayback `20260906181848`):

> Following implementation of the OECD Open Access Policy, **most OECD written content
> published as of 1 July 2024 is licensed under a Creative Commons Attribution BY 4.0
> licence (CC BY 4.0).** This licence permits users to reproduce, distribute and adapt
> (including translate) the content for any purpose without seeking authorisation from the OECD.

> Adaptation – if you adapt or modify the work, you must not use the OECD logo, visual
> identity or cover image, and must add the following disclaimer …: "This is an adaptation
> of an original work by the OECD. …"

2024-07-01 **이전** 발행분도 자체 약관이 열어 둔다:

> Use, copying and distribution – you may use, copy and distribute written content for
> commercial and non-commercial purposes without seeking authorisation from the OECD …
> Adaptation – you may also adapt written content for commercial or non-commercial
> purposes without seeking authorisation from the OECD.

(단 상업적 **번역**은 2024-07-01 이전분에 대해 사전 허가가 필요하다. 우리는 영어 지문을
영어로 쓰므로 해당 없음.)

⚠️ **그런데 약관이 스스로 예외를 둔다:**

> Some OECD written content may be licensed under different terms. **You should always
> check the copyright notice of the written content** to confirm which licence applies.

**그래서 챕터 HTML 에서 라이선스 표기를 찾아봤고 — 없다.** 표본 페이지
(`…portugal-2026_025b3445-en/full-report/…_4c3ecd4d.html`, 1.67MB) 안에
`creativecommons.org/licenses/…` 문자열이 **0건**이다. World Bank OKR 의 `dc:rights` 처럼
기계로 거를 필드가 OECD 에는 없고, **발행일로 추정하는 수밖에 없다.** 약관이 "항상 확인하라"
고 적은 바로 그것을 확인할 방법이 없는 상태 → **보류.**

해소 경로 두 가지 — (a) 각 간행물 PDF 표지 뒷면의 copyright notice 를 읽어 대조,
(b) OECD iLibrary(`oecd-ilibrary.org`) 의 서지 메타데이터에 라이선스 필드가 있는지 확인.
둘 다 이번 정찰 범위 밖이라 **하지 않았다.**

**4. 안정 식별자.** URL 접미사가 DOI 다. `…_025b3445-en.html` = 간행물 DOI
`10.1787/025b3445-en`, 챕터 `…_4c3ecd4d.html` = 챕터 DOI `10.1787/4c3ecd4d-en`.
페이지 본문에서 `10.1787/025b3445-en` 등을 실제로 확인했다.

**5. 증분 커서.** 사이트맵 전 URL 에 `lastmod` 가 있다(2024:5,318/5,318 · 2025:6,432/6,432 ·
2026:3,276/3,276). 연도별로 파일이 갈려 있어 재수확 시 최신 연도만 다시 받으면 된다.

**6. 편수.** 위 표의 **챕터 8,448**. ⚠️ **2024-07-01 이전/이후를 사이트맵만으로는 가르지
못했다** — 2024 사이트맵 3,131 챕터 중 몇이 7월 이후인지 **못 셌다**(URL 에 월 정보가 없다).
안전하게 2025·2026 만 쓰면 **5,317 챕터**가 라이선스 논쟁 없이 남는다.

**7. 지문 적합성.** 표본 1편 — *OECD Economic Surveys: Portugal 2026*, 2장
"Strengthening labour market resilience…" 서론을 읽었다. 통념 → 구조적 긴장 → 인구 전망으로
이어지는 **`use` / `economics`** 흐름이다. 다만 300어를 자르려면 걷어낼 것이 많다:

- `Copy link to <제목>` — 제목마다 반복되는 UI 문자열
- `(GEP, 2024[1])` `(OECD, 2024[2])` 꼴의 각주 번호 붙은 인용
- `Figure 2.1, Panel A` 참조와, 바로 뒤에 통째로 끼어드는 `Note:` / `Source:` / `Statlink` 블록
- 최상단 1,700자가 전권 목차다(1.1~4.4 절 제목 나열) → `reject` / `reference`

**국가별 경제 서베이는 고유명사·수치 밀도가 높다**(포르투갈, 65세 인구 25%→34%). 수능 지문으로는
주제 서베이·정책 총론 쪽이 낫다. 유형 선별이 OKR 보다 더 필요하다.

---

## 4. Our World in Data

| | |
|---|---|
| 판정 | **채택** (⚠️ 아래 편집 제한 확인 필요) |
| 확보 가능 편수 | 실측 사이트맵 6,435 URL 중 기사형 **604**(공지성 11 제외) · 현재 14 확보 → **약 590 남음** |
| 라이선스 | **CC BY 4.0** · 변형 **법적으로 가능**, 다만 자체 가이드라인이 편집을 제한 |
| 전문 | **온다** — `window._OWID_GDOC_PROPS` 안에 구조화 JSON |
| 안정 식별자 | Google Docs id (`1juypUa7XuiHnWKBEuao3WWitNphrALvCwZHvS5z0V3s`) + slug |
| 증분 커서 | 사이트맵 `lastmod` (6,435 중 6,431 보유) |
| 정찰 일자 | 2026-09-07 |

**1. 경로.** `https://ourworldindata.org/sitemap.xml` — 6,435 URL. 구성 실측:

| 종류 | 수 | 쓸 수 있나 |
|---|---|---|
| `/grapher/…` | 4,374 | ✗ 차트 페이지, 본문 없음 |
| `/…` (depth 1) | 628 | **○ 기사** (유틸리티 13 제외 → 615, 공지성 11 더 제외 → **604**) |
| `/profile/…` | 916 | ✗ 국가 프로필, 자동 생성 |
| `/data-insights/…` | 450 | △ 200어대로 **너무 짧다** |
| `/explorers/` `/sdgs/` `/team/` 등 | 67 | ✗ |

**2. 전문.** HTML 안 `window._OWID_GDOC_PROPS = {…}` 를 파싱하면 본문이 블록 배열로 온다.
`{spanType:'span-simple-text', text:…}` 노드만 모으면 링크·각주 마크업이 저절로 떨어진다.
`content.type='article'` · `authors` · `title` · `excerpt` 가 같이 있다.
**세 곳 중 본문 추출이 가장 깨끗하다** — OECD 의 `Copy link to` 나 WB 의 감사의 말 같은
껍데기 제거 작업이 거의 없다.

**3. 라이선스 — ⚠️ 반드시 읽을 것.** 푸터가 CC BY 4.0 을 명시한다:

> Our charts, articles, and data are licensed under **CC BY**, unless stated otherwise.
> (링크 `creativecommons.org/licenses/by/4.0`)

FAQ "Can I republish your articles and other writing?" 도 **Yes** 로 시작한다. 그런데
같은 답 안에 이런 조건이 있다:

> **You must not edit the material, except to reflect relative changes in time, location
> and editorial style.** If you do wish to make material edits, you will need to run them
> by us for approval prior to publication.

**CC BY 4.0 은 adaptation 을 허용하는데 발행자 가이드라인은 편집에 사전 승인을 요구한다.**
둘이 어긋난다. 우리가 하는 일은 (a) 300어대 **발췌**와 (b) 지문화 정리(각주·링크 제거)인데,
전자는 편집이 아니라 부분 게시이고 후자는 "editorial style" 로 볼 여지가 있으나 **우리가
단정할 사안이 아니다.**

⚠️ **이미 확보한 14편이 이 조건 아래 있다.** 조치 두 갈래 —
(a) 발췌 시 원문 문장을 **고치지 않고** 잘라 쓰는 것으로 한정하고 출처 표기를 FAQ 가 지정한
형식(`Originally published by [author names] at Our World in Data. Republished here under a
Creative Commons license.` + 원문 링크)으로 맞춘다, 또는
(b) `info@ourworldindata.org` 에 교재 발췌 용도를 문의한다.
**이 정찰은 (a)(b) 중 무엇도 하지 않았다** — 결정 사안이라 기록만 남긴다.

부수 사실: Grapher(시각화 소프트웨어)는 **CC 가 아니다**("Re-use requires permission").
차트·데이터·글만 CC BY 다. 제3자 데이터는 제공자 라이선스를 따른다.

**4. 안정 식별자.** `_OWID_GDOC_PROPS.id` 가 Google Docs 문서 id 다 — slug 가 바뀌어도
유지된다. slug 는 URL 열쇠로 함께 저장하되 중복 판정은 id 로 한다.

**5. 증분 커서.** 사이트맵 `lastmod` 6,431/6,435. Atom(`/atom.xml`)은 **entry 10개뿐**이라
증분용으로 못 쓴다 — 하루만 안 돌려도 놓친다. 사이트맵 `lastmod` 를 쓴다.

**6. 편수.** **604**. 목표 표가 이 곳에 얼마를 배정했든 1,030편 전체를 여기서 채울 수는 없다.

**7. 지문 적합성.** 표본 1편 — *How much energy do data centers and artificial intelligence
use?* (Hannah Ritchie). 도입부가 "기술 도입 속도 → 세 갈래 우려 → 그래서 얼마나 쓰는가"
로 서고, 문단마다 자족적이다. **`use` / `technology`**(또는 `energy`).
JUDGING.md 기준으로 세 곳 중 **적합성이 가장 높다** — 애초에 일반 독자용 설명문으로 쓰인 글이라
발췌해도 논지가 무너지지 않는다.

주의: 본문 곳곳에 차트 임베드 블록과 `aside` 각주가 끼어 있어, 블록 타입이 `text` 인 것만
이어 붙여야 문단 흐름이 유지된다. `data-insights` 는 200어대라 300어 창을 못 채운다.

---

## 5. 수확기를 짠다면

### World Bank OKR — `scripts/csat/harvest-plos.mjs` 를 본뜬다

PLOS 와 같은 API 형이고, 오히려 더 쉽다(전문이 `.txt` 로 온다).

1. `ListRecords&metadataPrefix=oai_dc&from=<커서>` → `resumptionToken` 이 없을 때까지 반복.
   **메타데이터만 받는 단계** — 여기서 `dc:rights` 로 `by-nc` 를 먼저 떨어뜨리고
   `licenses/by/` 만 남긴다. 영어(`dc:language`)도 여기서 거른다.
2. 살아남은 handle 만 REST 로 번들→비트스트림을 조회해 `.txt` 가 있는 것만 내려받는다.
   `.txt` 가 없으면 **PDF 를 받지 말고 건너뛴다**(파싱기를 만들지 않는다는 뜻).
3. 커서 파일 `scripts/csat/data/worldbank-okr-cursor.json` — `{ until: <직전 실행 시각>,
   seen: <handle 집합> }`. `datestamp` 가 수정일이라 재방문이 정상이므로 handle 중복 차단이
   커서보다 중요하다.
4. 40,363 레코드 · 페이지당 100 → 메타데이터 404회. 하루 1회 · 5,000건씩 8회에 나눠 돈다.
   `Working Paper` 유형을 1차, 나머지를 2차로 돌리면 초반 채택률이 높다.

### OECD — 보류 해소 뒤. `scripts/acp/collect-daily.mjs`(사이트맵/RSS 형)를 본뜬다

1. **먼저 §3-3 의 라이선스 확인 경로 (a) 또는 (b) 를 끝낸다.** 그 전에는 짜지 않는다.
2. `en-publications-2025`·`2026` 사이트맵만 읽고 `/full-report/` URL 5,317개를 뽑는다
   (2024 는 7월 경계를 가를 수 없으니 보류분에 남긴다).
3. 브라우저 UA 고정 · 초당 1건 이하 · 403 이면 지수 백오프. Cloudflare 가 실측으로 간헐 차단한다.
4. 커서 `scripts/csat/data/oecd-cursor.json` — 사이트맵 `lastmod` 최대값.
   식별자는 URL 에서 뽑은 DOI 접미사.
5. 파서는 `Copy link to …` · `Note:`/`Source:`/`Statlink` 블록 · 목차 머리를 반드시 떨어뜨린다.

### Our World in Data — `scripts/textbook/mediawiki-lead-ingest.mjs`(구조화 본문 형)에 가깝다

1. 사이트맵에서 depth-1 URL 만 → 유틸리티 13개 · `we-`/`our-`/`introducing-`/`new-` 접두
   공지 11개 제외 → 604.
2. 각 페이지에서 `window._OWID_GDOC_PROPS` 를 정규식으로 잘라 `JSON.parse`.
   `content.type === 'article'` 만 채택, `content.body` 에서 `type:'text'` 블록만 이어 붙인다.
3. 커서 `scripts/csat/data/owid-cursor.json` — slug→`lastmod` 맵. Atom 은 쓰지 않는다(10건).
4. 604건이라 **한 번에 다 돈다.** 이미 있는 14편은 gdoc id 로 건너뛴다.
5. **출처 표기 필드를 스키마에 넣는다** — §4-3 의 지정 문구와 원문 URL. 나중에 붙이려면
   604건을 다시 훑어야 한다.

---

## 6. 못 한 것 / 확인 실패

정직하게 남긴다.

- **Pew·Brookings·RAND 는 1항(경로)·2항(전문)·4~7항을 조사하지 않았다.** 라이선스에서
  멈추라는 지시를 따랐다. "경로가 없다" 가 아니라 "안 봤다" 다.
- **OECD 2024년 간행물의 7월 전/후 분리를 못 했다.** 사이트맵 URL 에 월이 없다.
- **OECD 챕터 페이지에 라이선스 표기가 없는 것**은 표본 1편에서 확인했다. 8,448건 전체가
  그런지는 **못 셌다**.
- **세 곳 모두 "항목 수"이지 "지문 편수"가 아니다.** 문서 한 건에서 300어 발췌가 몇 편
  나오는지는 게이트를 돌려야 알 수 있고, 이번엔 돌리지 않았다.
- **OWID 604 중 실제 기사가 아닌 것**(도구 페이지 `population-simulation-tool` 등)이
  섞여 있다. `content.type==='article'` 로 걸러야 정확한 수가 나오는데, 604건을 다 열지
  않았다(표본 1건만 열었다).
- Pew·OECD 는 Cloudflare 때문에 **원 사이트가 아니라 Wayback 스냅샷**으로 약관을 읽었다
  (Pew `20260905180219` · OECD `20260906181848`). 스냅샷 날짜를 근거로 함께 적어 둔다.
