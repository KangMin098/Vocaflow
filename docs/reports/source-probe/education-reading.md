<!-- docs/reports/source-probe/education-reading.md -->
# 교육용 읽기자료 5곳 확보 정찰 — ReadWorks · CommonLit · CK-12 · Khan Academy · Frontiers for Young Minds

목표 표 35·50·51·64위. 합계 채택 추정 **675편**(전부 고1·중등 대역).
정찰 일자 **2026-09-07**. `SPEC.md` 규격.

## 한 줄 결론

| 곳 | 접근 | 라이선스 | 판정 |
|---|---|---|---|
| ReadWorks | 로그인 뒤 — 본문이 서버 HTML 에 없다 | 오픈 아님 — **상용 라이선스를 판매**한다 | **반려** |
| CommonLit 무료분 | 로그인 뒤 — `/en/texts/*` → `/user/login` | 개인·비상업 한정 · 최선이 CC BY-NC-SA 4.0 · 자동수집 명시 금지 | **반려** |
| CK-12 | 공개 (기본 UA 403 · 브라우저 UA 200) | **CC BY-NC 3.0** + "상업 목적 접근 금지" + AI 학습용 수집 명시 금지 | **반려** |
| Khan Academy 아티클 | **막혔다** — 전 URL 이 봇 챌린지(3,038 B) | **CC BY-NC-SA** · KA 자신이 "유료 상품 편입은 비상업이 아니다" 라고 적는다 | **반려** |
| Frontiers for Young Minds | Crossref API + `/full` (실측 5/5 200) | **CC BY 4.0** · 글마다 확인 가능 · 변형 **가능** | **채택 (확장)** |

**675편 중 이 5곳에서 나올 수 있는 것은 FrYM 하나뿐이다.** 네 곳은 라이선스가 관문이었고,
그중 셋은 접근까지 막혀 있어 라이선스를 따지기 전에 이미 끝났다.

> ⚠️ 이 정찰의 목표 대역이 **고1** 인데, 우리 사다리(`READING_LEVEL_BANDS`)는 **중3 이 천장**이다
> (초3~4 · 초5~6 · 초6~중1 · 중1~2 · 중3). 고1 칸은 정의 자체가 없다 — 이 정찰로 채울 수 없는
> 부분이며, 소스가 아니라 **사다리를 먼저 늘려야** 하는 문제다.

> SPEC §정찰 중 걸린 벽 두 가지를 적용했다 — WebFetch 가 빈손이거나 403 일 때 `curl` 로 다시 쳤고
> (ReadWorks·Khan Academy·CK-12 모두 그렇게 갈렸다), 라이선스는 약관보다 **항목 메타데이터**를
> 먼저 봤다(FrYM 은 Crossref `license[].URL` 이 글마다 답을 준다).

---

# 1. ReadWorks

| | |
|---|---|
| 판정 | **반려** |
| 확보 가능 편수 | **0** — 사이트맵에 `/article/` 6,457 개가 있으나 본문이 오지 않는다 |
| 라이선스 | 오픈 라이선스 없음 — 콘텐츠를 **유상 라이선싱**한다 · 변형 **불가** |
| 전문 | **오지 않는다** (서버 HTML 에 지문이 없다) |
| 안정 식별자 | URL 안의 UUID (`/article/<slug>/<uuid>`) — 있기는 하다 |
| 증분 커서 | `sitemap.xml` 의 `<lastmod>` — 있으나 쓸 데가 없다 |
| 정찰 일자 | 2026-09-07 |

## 근거

**1. 대량 접근 경로** — `https://www.readworks.org/robots.txt` 는 `Allow: /` 이고
`https://www.readworks.org/sitemap.xml`(1,260,100 B)을 가리킨다. `<loc>` 6,462 개 중
**6,457 개가 `/article/…`** 이고 각각 `<lastmod>` 를 단다. 여기까지는 교과서적이다.

**2. 전문이 오는가 — 오지 않는다.** 사이트맵의 5번째 글
`/article/A-Baby-Polar-Bear-Grows-Up/4da831d5-0f0a-4e86-9cc7-fc7d66567e92` 를 받으면
200 · **172,125 B** 인데, `/terms` 를 받아도 **172,125 B** 다. `cmp` 로 대조한 결과
**바이트 단위로 동일**하다 — 모든 경로가 같은 SPA 껍데기를 돌려준다. 본문 확인:

```
grep -c -i 'polar bear' <article html>   →  0
```

없는 경로도 200 을 준다(`/api/article/<uuid>` → 같은 172,125 B 껍데기). 즉 **200 이 "있다"
를 뜻하지 않는다** — 여기서 상태 코드로 판정하면 6,457편을 확보했다고 착각한다.
서버 HTML 에 API 주소도 노출되지 않는다(`"/api/…` 패턴 0건).

**3. 라이선스 — 가장 중요한 것이 여기 있다.** ReadWorks 는 오픈 라이선스를 걸지 않고
**콘텐츠 라이선스를 판다.** `https://about.readworks.org/licensing.html` 원문:

> "Licensing Opportunity for K-12 Content — Are you looking to enhance your edtech offerings
> with trusted, high-quality reading content? Now's your chance to license evidence-based
> content from ReadWorks! … By integrating ReadWorks content into your platform, you'll provide
> schools and districts with K-12 texts … **contact us about licensing today!**"

Vocaflow 가 하려는 것(edtech 플랫폼에 지문을 편입)이 **이 페이지가 팔고 있는 바로 그것**이다.
정찰이 아니라 **계약 협상**의 대상이지, 수확기의 대상이 아니다.

⚠️ **약관 본문은 읽지 못했다(확인 실패).** `/terms` 도 같은 SPA 껍데기라
`redistribut|non-commercial|scrap|derivative` 어느 낱말도 HTML 에 없다(grep 0건).
그러나 위 라이선싱 페이지만으로 판정은 갈린다 — **파는 물건을 무상으로 가져다 쓸 근거가 없다.**

**4·5. 식별자·커서** — UUID 와 `<lastmod>` 가 둘 다 있다. **본문이 오지 않으므로 쓸 곳이 없다.**

**7. 지문 적합성** — **판정 불가.** 본문을 한 편도 읽지 못했으므로 표본 판정을 만들지 않는다.
(사이트맵 제목만 보면 논픽션 설명문이 많아 `use` 가 나올 법하나, 그것은 추정이다.)

**계정을 만들지 않았다.** 로그인 뒤에 있어 프로그램 접근 불가로 적는다.

---

# 2. CommonLit (무료분)

| | |
|---|---|
| 판정 | **반려** |
| 확보 가능 편수 | **0** — 편수를 **못 셌다**(목록이 로그인 뒤에 있다) |
| 라이선스 | 개인·**비상업** 한정 이용허락 · 요청 시에만 **CC BY-NC-SA 4.0** · 상업 기준 변형 **불가** |
| 전문 | **확인 불가** (로그인 벽) |
| 안정 식별자 | `/en/texts/<slug>` — 있으나 접근 불가 |
| 증분 커서 | 확인 실패 (`sitemap.xml` 301) |
| 정찰 일자 | 2026-09-07 |

## 근거

**1·2. 접근 — 로그인 벽이 명시적이다.** 리다이렉트 종착지를 실측했다:

```
https://www.commonlit.org/en/library   → 200  33,660 B  종착 https://www.commonlit.org/user/login
https://www.commonlit.org/en/texts/…   → 200  33,660 B  종착 https://www.commonlit.org/user/login
```

목록도 개별 지문도 **같은 로그인 화면**으로 간다(바이트 수까지 같다). `sitemap.xml` 은 301.
**계정을 만들거나 우회하지 않았다** — 로그인 뒤에 있어 프로그램 접근 불가로 적는다.
그래서 편수도 못 셌다. **목표 표의 추정치를 대신 적지 않는다.**

**3. 라이선스 — 네 겹으로 막혀 있다.**

① 이용약관(`/en/terms`) 원문:

> "non-exclusive, revocable, limited license to use and access the Services solely for your own
> **personal, noncommercial use**"
> "except as expressly permitted, no part of the Services may be **copied, reproduced,
> distributed, republished, downloaded, displayed, posted or transmitted** in any form or by any means"
> "you shall not **license, sell, rent, lease, transfer, assign, distribute, host, or otherwise
> commercially exploit** the Services"

② 자동 수집 금지가 별도로 있다:

> "you shall not use any manual or automated software, devices or other processes (including but not
> limited to **spiders, robots, scrapers, crawlers, avatars, data mining tools**, or the like) to
> 'scrape' or download data" — 예외는 검색엔진 색인뿐이다.

③ `robots.txt` 가 Content-Signal 로 권리를 유보한다(EU DSM 지침 4조를 명시적으로 원용):

```
User-agent: *
Content-Signal: search=yes,ai-train=no,use=reference
```

④ 오픈 라이선스분이 있더라도 **CC BY-NC-SA 4.0** 이다("upon request"). **NC 는 상업 교재에 못 쓴다**
(그 위에 SA 전염까지 겹친다).

**7. 지문 적합성** — **판정 불가.** 한 편도 못 읽었다.

---

# 3. CK-12

| | |
|---|---|
| 판정 | **반려** |
| 확보 가능 편수 | 못 셌다 — 사이트맵 색인 4종은 공개지만 **세도 쓸 수 없다** |
| 라이선스 | **CC BY-NC 3.0** (CK-12 Curriculum Materials License) · 변형 가능하나 **상업 불가** |
| 전문 | **온다** — 브라우저 UA 로 레슨 페이지 102,628 B |
| 안정 식별자 | 레슨 URL (`/c/<subject>/<concept>/lesson/<slug>/`) |
| 증분 커서 | `sitemapindex.xml` 외 3종(`sitemap_subjects_index` · `sitemap_fsp_index` · `sitemap_adaptive_practice_index`) |
| 정찰 일자 | 2026-09-07 |

## 근거

**1. 접근은 된다 — 다만 UA 로 가른다.** 기본 curl UA 는 CloudFront **403**("Request blocked")
이고, 브라우저 UA 를 주면 `robots.txt` 200(3,346 B) · 레슨 페이지
(`/c/biology/photosynthesis/lesson/Photosynthesis-BIO/`) 200(**102,628 B**)이다.
`robots.txt` 는 사이트맵 4종을 공개하고 `/api/` · `/flx/show/pdf/` · `/editor/` · `/my/` 만 막는다.
**UA 하나로 「접근 불가」가 「접근 가능」이 됐다** — SPEC §걸린 벽의 사례가 여기서 또 나왔다.

**2. 전문은 온다.** 레슨 페이지가 10만 바이트대라 본문이 실려 있다.
**즉 이 곳은 「경로가 없어서」 반려되는 것이 아니다 — 경로는 멀쩡하고 라이선스가 막는다.**

**3. 라이선스 — 두 겹이다.** 이용약관(`www.ck12info.org/terms-of-use` → 301 → `info.ck12.org/terms-of-use`):

> 플랫폼을 "**for any commercial purposes**" 로 이용할 수 없고,
> "for-profit educational institution or multi-tutor tutoring business" 는 자료를 쓸 수 없다.
> 커리큘럼 자료는 별도의 "CK-12 Curriculum Materials License" 를 따르며(약관에 참조로 편입),
> 그 라이선스가 **CC BY-NC 3.0 Unported** 다. 재현물마다 `http://www.ck12.org/saythanks`
> 링크를 눈에 띄는 곳에 넣어야 한다.

그리고 **우리 용법을 정확히 겨냥한 조항**이 하나 더 있다:

> "**scraping** or otherwise collecting any content from the Platform for the purpose of
> **training, developing, or improving any machine learning or artificial intelligence models**
> … without explicit written permission from CK-12"

**NC 하나만으로 반려**다(Vocaflow 는 유료 전환을 전제한 상업 서비스 — CLAUDE.md §4️⃣ 의 산술이
가입 10만 → 유료 500~1,800 을 전제한다). AI 조항은 그 위에 겹친다.

⚠️ 약관 본문에는 CC 버전이 적혀 있지 않고 "CK-12 Curriculum Materials License" 로 참조만 한다.
**CC BY-NC 3.0** 이라는 버전은 CK-12 도움말·FlexBook 판권면 표기에서 나온 값이다 — 버전이
3.0 이냐 4.0 이냐로 판정이 바뀌지 않으므로(둘 다 NC) 더 파지 않았다.

**7. 지문 적합성** — 표본을 읽지 않았다. **라이선스에서 이미 끝났으므로 읽지 않는 것이 옳다** —
쓸 수 없는 글을 "적합" 으로 적어 두면 나중에 그 줄을 근거로 되살아난다.

---

# 4. Khan Academy 아티클

| | |
|---|---|
| 판정 | **반려** |
| 확보 가능 편수 | **못 셌다** — 봇 챌린지로 목록조차 못 받았다 |
| 라이선스 | **CC BY-NC-SA** · 변형 가능하나 **상업 불가** (⚠️ 1차 자료 확인 실패 — 아래) |
| 전문 | **확인 불가** |
| 안정 식별자 | 확인 불가 |
| 증분 커서 | 확인 불가 |
| 정찰 일자 | 2026-09-07 |

## 근거

**1. 막혔다.** 모든 경로가 Fastly 봇 챌린지 페이지(**3,038 B**, `<title>Client Challenge</title>`,
JS 필수 · CSP `script-src 'self'`)를 돌려준다:

```
https://www.khanacademy.org/robots.txt                       → 200  3,038 B  챌린지
https://www.khanacademy.org/sitemap.xml                      → 200  3,038 B  챌린지
https://www.khanacademy.org/science/biology/…/a/intro-to-photosynthesis → 200  3,038 B  챌린지
```

브라우저 UA 를 줘도 **그대로 3,038 B** 다. `robots.txt` 조차 못 읽는다.
로그인 벽이 아니라 **봇 차단**이므로 계정으로도 해결되지 않는다.
SPEC §걸린 벽 — "봇 차단이 곧 반려다. 프로그램 접근 경로가 없으면 라이선스가 무엇이든 쓸 수 없다."

**3. 라이선스 — ⚠️ 1차 자료 확인에 실패했다.** `support.khanacademy.org` 의 해당 도움말은
**403**, `khanacademy.org/about/tos` 는 챌린지 뒤에 있다. 아래는 **2차 자료**이며 그렇게 적는다:

> KA 는 대부분의 콘텐츠를 **CC BY-NC-SA** 로 낸다. KA 자신의 비상업 정의가 우리 경우를
> 직접 다룬다 — "**the use of content by an organization that is incorporating it into a paid
> offering is NOT 'non-commercial'**". 약관에도 "The Licensed Educational Content may not be
> used, distributed or otherwise exploited for any commercial purpose, commercial advantage or
> private monetary compensation, unless otherwise previously agreed in writing by Khan Academy"
> 가 있다고 인용된다.

**판정은 이 값에 기대지 않는다.** 접근이 막힌 것만으로 반려가 성립하고, 그쪽은 실측이다.
라이선스가 설령 허용해도 대량 접근 경로가 없다.

**7. 지문 적합성** — **판정 불가.** 한 편도 못 읽었다.

---

# 5. Frontiers for Young Minds — **확장 여지 있음**

| | |
|---|---|
| 판정 | **채택** (이미 쓰는 곳 · 확장 대상) |
| 확보 가능 편수 | 미방문 **1,667편** (CC BY 4.0 1,820 − 소진 153) · 게이트 통과 추정 **≈670** (표본 2/5) |
| 라이선스 | **CC BY 4.0** · 변형 **가능** · Crossref 가 **글마다** 준다 |
| 전문 | **온다** — 본문 987~1,448어 (실측 5편) |
| 안정 식별자 | **DOI** (`source_id` = `frym:<DOI>#p<시작>-<끝>`) |
| 증분 커서 | Crossref `cursor=*` 딥페이징 또는 `filter=from-pub-date:` — **둘 다 실측 확인** |
| 정찰 일자 | 2026-09-07 |

## 지금 상태 (DB 실측 · 읽기만)

`library_articles where source='frym'` → **ready 119 · archived 34 = 153**,
distinct DOI **153**, `word_count` 평균 **136**, 발행일 2017-09-28 ~ 2026-08-05.

평균 136어는 **옛 초록 적재분**이라는 뜻이다(초록이 98~165어였다). 즉 `/full` 전문 발췌 경로
(`frym-ingest.mjs`·`frontiers-young-minds.ts` 2026-09-07 개정)는 **아직 규모로 돌지 않았다.**

## 1. 대량 접근 경로 — 있다

```
목록: https://api.crossref.org/journals/2296-6846/works   (ISSN 2296-6846)
본문: https://kids.frontiersin.org/articles/<DOI>/full
```

실측 호출과 결과:

```
?rows=0                                           → total-results 1977
?rows=0&facet=type-name:*                         → Journal Article 1977 (다른 유형 0)
?rows=0&filter=license.url:https://creativecommons.org/licenses/by/4.0/   → 1820
?rows=0&filter=from-pub-date:2026-01-01           → 146
?rows=0&filter=from-pub-date:2025-01-01           → 340
?rows=2&cursor=*                                  → next-cursor 반환 (딥페이징 가능)
```

⚠️ 라이선스 필터는 **`https://` 로 써야 한다** — `http://` 로 쓰면 **0 건**이 나온다(실측 대조).
0 건은 "라이선스가 없다" 로 오독되기 쉽다.

## 2. 전문이 오는가 — 온다

offset 600(2023–24년) 에서 5편을 받아 전부 확인: **5/5 HTTP 200** · 페이지 87,436~93,694 B.
`ingestFrymArticle` 로 본문만 떼면 **987 · 1,237 · 1,297 · 1,381 · 1,448어**.
(`/xml/nlm`·`/pdf` 는 404 이고 `/full` 만 200 이라는 기존 기록도 이번 표본에서 유지된다.)

## 3. 라이선스 — CC BY 4.0, 글마다 확인된다

Crossref `license[].URL` 에 `https://creativecommons.org/licenses/by/4.0/` 이 온다.
표본 5/5 가 CC BY 4.0(파이프라인 표기 `CC-BY-4.0`). 전체로는 **1,977 중 1,820(92.1%)** 이
이 값을 갖고, **157편은 없다** — `frymLicenseUrl` 이 null 을 돌려주고 `ingestFrymArticle` 이
그 편을 거절하므로 **이미 안전하다**(SPEC §"CC 라고 알려져 있다를 믿지 않는다" 를 코드가 지키고 있다).

CC BY 는 **변형 허용**이고 SA 전염도 NC 제한도 없다 — **다섯 곳 중 유일하게 상업 교재에 쓸 수 있다.**
발췌는 변경이므로 제목에 "…(N문단부터 발췌)" 를 적는 현행 규칙을 유지한다.

## 4. 안정 식별자 — DOI

`frym:10.3389/frym.2023.1055909#p3-6` 꼴. 발췌 범위가 열쇠에 들어 있어 같은 글에서
**다른 창을 떼면 다른 행**이 된다(재수확 안전 + "이게 전문인가 조각인가" 를 나중에 물을 수 있다).

## 5. 증분 커서 — ⚠️ **여기가 지금 확장을 막는 곳**

`listFrymFeed`(`packages/library-pipeline/src/ingest-article/frontiers-young-minds.ts:324`)는
`sort=published&order=desc` + **offset** 으로 훑고 `offset < 2_000` 에서 멈춘다.
커서 파일이 없고 `scripts/textbook/frym-ingest.mjs` 에 `--offset` 도 없다.

결과: **매 실행이 최신 `--limit` 편만 본다.** 이미 소진된 153편을 다시 보고 "이미 있음" 만 센다 —
**1,667편은 호출 자체가 닿지 않는다.** 스크립트는 오류 없이 정상 종료하므로 조용하다.

또 `published desc` + offset 은 새 글이 실릴 때마다 창이 밀린다 —
2026-08-16 IA 실측(214건 중복 · 동수 누락)과 같은 꼴이다. 중복은 `(source, source_id)` 가 잡지만
**누락은 아무것도 잡지 않는다.** → `cursor=*` 딥페이징으로 바꾸고 커서를 파일에 남기는 것이 답이다.

## 6. 현실적 확보 가능 편수

| | |
|---|---|
| Crossref 총 works | 1,977 |
| 그중 CC BY 4.0 | **1,820** |
| 이미 소진(DB distinct DOI) | 153 |
| **미방문** | **1,667** |
| 표본 게이트 통과율 | **2/5 = 40%** |
| 추정 산출 | **≈ 670편** |

⚠️ **40% 는 표본 5편에서 나온 값**이다 — 오차가 크다. 그리고 **글당 발췌 1편** 규칙을 전제한
수치다(§확장 여지). 목표 표의 675 와 숫자가 비슷한 것은 **우연**이지 근거가 아니다.

## 7. 지문 적합성 표본 판정 (n=5 · offset 600 · 실제 게이트 통과)

`ingestFrymArticle` → `fitExcerptToAnyBand` → `curriculumFit` → `standaloneFit` 를 그대로 돌렸다
(DB 에는 쓰지 않았다).

| DOI | 본문 | 발췌 | 칸 | 어휘 | 자립 | 판정 |
|---|---|---|---|---|---|---|
| `10.3389/frym.2023.1055909` | 1,448어 / 17문단 | 114어 FK 7.94 | 중1~2 | 통과 (밖 22.2% · 자리 22.5) | 통과 | **use** |
| `10.3389/frym.2023.1096038` | 1,297어 / 16문단 | 155어 FK 7.36 | 중1~2 | **✗ 밖 45.9%** (중등 p90 41.6) · 자리 95.6 | 통과 | reject (어휘) |
| `10.3389/frym.2023.1209980` | 1,237어 / 17문단 | 145어 FK 7.78 | 중1~2 | 통과 (밖 33.7% · 자리 68.8) | 통과 | **use** |
| `10.3389/frym.2023.1175538` | 1,381어 / 12문단 | 141어 FK 8.32 | 중1~2 | **✗ 밖 45.3%** · 자리 95.4 | 통과 | reject (어휘) |
| `10.3389/frym.2023.1212262` | 987어 / **7문단** | — | — | — | — | reject (창에 드는 조각 없음) |

읽어 본 소감: 전부 **설명·논증문이고 자족적**이다(`use`). 차단 장르 9종에 걸리는 것은 없었다.
`standaloneFit` 은 **5/5 통과** — 막는 것은 자립성이 아니라 **어휘 밀도**다(심사받은 과학지라
전문어가 많다).

그리고 **5편 모두 중1~2 로 떨어졌다.** 이 소스를 넣던 원래 명분(비어 있던 **중3** 칸 채우기)은
`--band 중3` 을 명시해야 살아난다 — `fitExcerptToAnyBand` 는 **쉬운 칸부터** 보고 먼저 드는 칸에서
멈추기 때문이다. 목표 표가 요구하는 **고1** 칸은 사다리에 아예 없다(머리말 참조).

## 확장 여지 — 소스가 아니라 **우리 코드**에 남아 있다

정찰의 결론은 "FrYM 을 더 캘 수 있다" 보다 구체적이다. 막는 것 셋이 전부 우리 쪽에 있다:

| 막는 것 | 지금 | 고치면 |
|---|---|---|
| **커서 없음** | 최신 `--limit` 편만 본다 | `cursor=*` + 커서 파일 → **1,667편**에 닿는다 |
| **글당 발췌 1편** | `fitExcerptToAnyBand` 가 첫 창에서 멈춘다 | 본문 987~1,448어에 100~200어 창이 **5~9개** — 겹치지 않게 N개를 떼면 공급이 배가 된다 |
| **칸 지정 없음** | 쉬운 칸부터 봐서 전부 중1~2 로 간다 | `--band 중3` 로 돌리면 원래 목적(중3 칸)에 맞는다 |

⚠️ **글당 여러 발췌는 공짜가 아니다** — 같은 글의 조각들이 학습자에게 연달아 뜨면 반복으로 느껴진다.
쿼터(글당 최대 2~3편)와 배분 규칙을 먼저 정하고 늘려야 한다.
**여기서는 여지만 기록하고 정하지 않는다**(SPEC: 이 단계에서는 수확기를 짜지 않는다).

---

# 수확기를 짠다면

**네 곳(ReadWorks · CommonLit · CK-12 · Khan Academy)은 짜지 않는다.** 라이선스가 반려이거나
접근이 막혔다. 나중에 "경로가 있었던 것 같다" 로 되살아나지 않게 위 근거를 남겨 둔다.

**FrYM 은 새로 짜지 않는다 — 이미 있는 것을 고친다.**

| 무엇 | 어디 |
|---|---|
| 본뜰 것 | 없음. `scripts/textbook/frym-ingest.mjs` 가 이미 그 수확기다(API 형이므로 `scripts/csat/harvest-plos.mjs` 와 같은 계열) |
| 고칠 곳 ① | `packages/library-pipeline/src/ingest-article/frontiers-young-minds.ts` 의 `listFrymFeed` — offset 루프를 Crossref `cursor=*` 로 바꾸고 `next-cursor` 를 함께 돌려준다 |
| 고칠 곳 ② | `scripts/textbook/frym-ingest.mjs` — `--cursor-file` 을 받아 `scripts/textbook/data/frym-cursor.json` 에 남긴다 (`scripts/csat/data/plos-harvest-cursor.json` 과 같은 꼴) |
| 고칠 곳 ③ (선택) | 글당 발췌 N개 — `excerptForBand` 의 내부 열거를 노출하는 `excerptsForBand(paragraphs, band, max)` 를 더한다. **쿼터 규칙을 정한 뒤에** |
| 몇 번에 나눠 | 본문 1편당 `/full` 1회 + 600ms 대기이므로 **1,667편 ≈ 17분 순수 대기** + Crossref 목록. `--limit 100` × 17회로 나눈다. 회차마다 커서가 남으므로 중간에 끊겨도 이어진다 |
| 재실행 안전 | **그렇다** — `(source, source_id)` 로 먼저 조회해 건너뛰고, 발췌본은 열쇠가 달라 다시 검사한다. 건너뛴 수를 출력한다. 기본이 dry-run 이고 `--commit` 없이는 쓰지 않는다 |
| 반드시 지킬 것 | 라이선스를 **글마다** 읽고 못 읽으면 넣지 않는다(157편이 그렇다). Crossref 호출에 `Accept: application/json` 을 명시한다(기본값이면 **406**) |

---

## 이 정찰에서 확인하지 못한 것 (추정으로 메우지 않는다)

- **ReadWorks 이용약관 본문** — SPA 라 서버 HTML 에 없다. 판정은 라이선싱 **판매** 페이지에 근거한다.
- **Khan Academy 라이선스의 1차 자료** — `about/tos` 와 도움말이 모두 봇 챌린지/403.
  2차 자료만 있고, 그렇게 적었다. 판정은 접근 차단(실측)만으로 성립한다.
- **CommonLit·Khan Academy 편수** — 목록에 닿지 못해 세지 못했다. 목표 표의 추정치를 옮겨 적지 않았다.
- **CK-12 CC 버전(3.0)의 1차 확인** — 약관은 별도 라이선스 문서를 참조로만 편입한다.
  3.0 이든 4.0 이든 **NC** 라 판정이 바뀌지 않아 더 파지 않았다.
- **FrYM 게이트 통과율** — 표본 5편(2/5)이다. 1,667편의 실제 수율은 회차를 돌려야 안다.
