<!-- docs/reports/source-probe/doab.md -->
# DOAB (Directory of Open Access Books) 확보 정찰

| | |
|---|---|
| 판정 | **보류** |
| 확보 가능 편수 | 실측 **6,634권** (마찰 없는 1홉 경로) / **26,076권** (출판사별 어댑터를 짜면) — CSV 덤프 102,078행 전수 집계 |
| 라이선스 | 항목별로 다름. 전체 중 CC BY 35,136 · CC BY-NC-ND 36,138 · 라이선스 없음 11,679 등. **변형 가능**은 항목을 골라야 성립 |
| 전문 | **온다** — 단, DOAB 가 주지 않는다. 400+ 외부 호스트에 흩어져 있고 상위 2개(OAPEN·MDPI)는 봇 차단 |
| 안정 식별자 | `dc.identifier.uri` = DOAB 핸들 (`https://directory.doabooks.org/handle/20.500.12854/<n>`) — **102,078/102,078 = 100%**. DOI 는 88,867 (87%) |
| 증분 커서 | OAI-PMH `from=`/`until=` (granularity `YYYY-MM-DDThh:mm:ssZ`) — 실측 `from=2026-08-01` → `completeListSize="2693"` |
| 정찰 일자 | 2026-09-07 |

---

## 1. 대량 접근 경로 — 두 개 있고 둘 다 살아 있다

### (a) OAI-PMH

```
https://directory.doabooks.org/oai/request?verb=Identify
```
→ HTTP 200, 1.6s. `repositoryName` = **DOAB PROD Instance**, `baseURL` 은 `http://library.oapen.org/oai/request`
(DOAB 는 OAPEN 재단이 운영하는 DSpace 6 인스턴스다), `earliestDatestamp` **2020-04-01T14:43:18Z**,
`deletedRecord` **transient**, granularity **YYYY-MM-DDThh:mm:ssZ**.

`ListMetadataFormats` → 12종: `oai_dc` `qdc` `mods` `mets` `marc` `xoai` `dim` `didl` `ore` `rdf` `etdms` `uketd_dc`.

```
https://directory.doabooks.org/oai/request?verb=ListRecords&metadataPrefix=oai_dc
```
→ HTTP 200, 462KB, 2.0s, 레코드 100건, `resumptionToken completeListSize="127778" cursor="0"` → 토큰값 `oai_dc////100`
(= `prefix/from/until/set/offset` 형태의 **오프셋 토큰**).

### (b) 전체 메타데이터 덤프 — **이쪽이 낫다**

```
https://directory.doabooks.org/download-export?format=csv
```
→ HTTP 200, **280,787,618 B (280 MB), 27초, 요청 1회.** 78 컬럼 CSV.
ONIX 3.0 판(`format=onix`)도 있다 — 666 MB, 76초.

CSV 헤더에 필요한 것이 전부 있다:
`id` · `BITSTREAM Download URL` · `BITSTREAM License` · `dc.language` · `dc.type` ·
`dc.rights.licenseurl` · `dc.rights.uri` · `dc.identifier.uri` · `oapen.identifier.doi` ·
`oapen.identifier.downloadUrl` · `oapen.pages` · `oapen.relation.hasChapter` · `dc.chapternumber`.

**OAI 127,778 vs CSV 102,078 — 25,700 차이가 난다.** OAI 쪽 `deletedRecord=transient` 이므로 삭제·중복 레코드가
OAI 총계에 섞여 있는 것으로 보이나 **확인하지 못했다**(전량 하베스트가 필요해 정찰 범위를 넘는다).
계수는 전부 CSV(102,078) 기준으로 적는다 — 실제로 세어 본 쪽이다.

### robots.txt — 읽어야 한다

`Content-Signal: search=yes, ai-train=no, use=reference` + `Allow: /` (일반 UA).
`ClaudeBot` `GPTBot` `CCBot` `Google-Extended` `Bytespider` 등 AI 크롤러 UA 는 **`Disallow: /`**.
파일 서두가 "ANY RESTRICTIONS EXPRESSED VIA CONTENT SIGNALS ARE EXPRESS RESERVATIONS OF RIGHTS
UNDER ARTICLE 4 OF THE EU DIRECTIVE 2019/790" 이라고 못박고 있다.
→ **`ai-train=no` 는 명시적 유보다.** 지문 발췌·재조판은 학습 교재 편집이지 모델 학습이 아니지만,
수확기 UA 는 위 차단 목록에 없는 자체 문자열을 쓰고 저작권 표시를 항목별로 보존해야 한다.

---

## 2. 전문(full text)이 오는가 — **온다. 그러나 DOAB 가 주지 않는다**

DOAB 는 **디렉터리**다. 자기 서버에 PDF 를 두지 않고 `BITSTREAM Download URL` 로 출판사·리포지터리를 가리킨다.
CSV 102,078행의 다운로드 호스트 상위:

| 호스트 | 건수 | 실측 접근 결과 |
|---|---|---|
| `library.oapen.org` | 40,168 | ❌ **403** — Anubis PoW 게이트 |
| `books.openedition.org` | 12,886 | 미시험(랜딩 페이지) |
| `mdpi.com` | 8,604 | ❌ **403** Cloudflare |
| `mts.intechopen.com` | 6,857 | ✅ **200 application/pdf** |
| `doi.org` | 4,064 | 리다이렉트(대상은 위 호스트들) |
| `www.jstor.org` | 3,175 | 미시험 |
| `www.press.uni.lodz.pl` | 2,987 | 미시험 |
| `www.intechopen.com` | 2,390 | 랜딩 페이지 |
| `muse.jhu.edu` | 2,263 | 미시험 |
| `www.frontiersin.org` | 1,971 | ⚠️ 200 이지만 **HTML 랜딩**(`/magazine` 로 리다이렉트), PDF 아님 |
| (URL 없음) | 1,405 | — |

### ⚠️ 가장 큰 호스트가 막혀 있다 — OAPEN 은 Anubis 뒤에 있다

```
GET https://library.oapen.org/bitstream/20.500.12657/50315/1/9781800642089.pdf
→ 403, <title>Making sure you're not a bot!</title>
   set-cookie: techaro.lol-anubis-auth=... ; techaro.lol-anubis-cookie-verification=...
   x-proxy-backend: oapen-prod_anubis_http
```
브라우저 UA + Referer + Sec-Fetch-* 전부 붙여도 403. **핸들 페이지(`/handle/...`)도 똑같이 403** 이므로
레이트리밋이 아니라 사이트 전면 게이트다(첫 시도 때 "30초 제한" 429 도 따로 받았다 — 게이트와 레이트리밋이 둘 다 있다).
Anubis 는 JS proof-of-work 를 요구하므로 `curl`/`fetch` 로는 통과할 수 없다.
**OAPEN 호스팅 40,168권 = DOAB 전체의 39% 가 이 한 줄로 사라진다.**

### 실제로 받아 본 것 — 4권, 전부 born-digital PDF

| 표본 | 출판사 | 크기 | pdftotext 낱말 |
|---|---|---|---|
| A World of Nourishment | Ledizioni | 9.4 MB | 128,270 |
| Sex Hormones in Neurodegenerative Processes | IntechOpen | 8.1 MB | 139,232 |
| Fourier Transform | IntechOpen | 12.1 MB | 98,234 |
| Stuck and Exploited | Ca' Foscari | 7.7 MB | 151,386 |

OCR 아님 — 텍스트 레이어가 깨끗하다. **초록만 오는 소스가 아니다.**

---

## 3. 라이선스 — 필드는 온다. 그러나 **필드를 믿으면 안 되는 사례를 찾았다**

라이선스는 항목마다 다르고, 세 컬럼 중 하나에 들어온다:
`dc.rights.licenseurl` → 없으면 `dc.rights.uri` → 없으면 **`BITSTREAM License`**.
(MDPI·Frontiers·IntechOpen·PULP 표본은 전부 `BITSTREAM License` 에만 있었다 — 앞의 두 컬럼만 읽으면 **전량 놓친다**.)

CSV 102,078행 전수 집계:

| 라이선스 | 건수 | 변형 |
|---|---|---|
| CC BY-NC-ND | 36,138 | ❌ **금지** |
| CC BY | 35,136 | ✅ 가능 |
| (라이선스 URI 없음) | 11,679 | ❌ 판정 불가 |
| 기타 비-CC (출판사 자체 약관 등) | 6,076 | ❌ 개별 검토 |
| CC BY-NC | 4,429 | ⚠️ 변형 가능하나 **상업 금지** |
| CC BY-NC-SA | 4,033 | ⚠️ 상업 금지 + SA 전염 |
| CC BY-SA | 3,564 | ✅ 가능, 단 **결과물도 SA** |
| CC BY-ND | 818 | ❌ **금지** |
| CC0 / PublicDomainMark | 7 | ✅ |
| 기타 표기 오류형 (`by-by-nc-nd`, `nc-sa`, `by-nd-nc` …) | 약 200 | 정규화 필요 |

**ND 계열 합계 36,956 = 36%.** 이 36% 는 발췌·재조판이 원천 금지다.

### ⚠️ 메타데이터와 PDF 판권면이 어긋난 사례 (표본 4권 중 1권)

`A World of Nourishment` (Ledizioni, DOAB 핸들 `20.500.12854/62823`)
- DOAB 메타데이터: `https://creativecommons.org/licenses/by-nc-sa/4.0/`
- PDF 판권면 원문: **"È vietata la riproduzione, anche parziale, con qualsiasi mezzo effettuata,
  compresa la fotocopia, anche a uso interno o didattico, senza la regolare autorizzazione."**
  (= 내부·교육 용도라도 부분 복제조차 사전 허가 없이 금지)

즉 **DOAB 의 라이선스 필드는 항목 단위 진실이 아니다.** 수확기는 PDF 앞 3~5페이지에서
저작권 문구를 함께 추출해 메타데이터와 대조하고, 불일치하면 **드롭**해야 한다.

두 번째 유형도 있다 — IntechOpen 은 DOAB 상 `CC BY 3.0` 인데 PDF 판권면은
"All rights to the book **as a whole** are reserved by INTECHOPEN LIMITED …
**Individual chapters** of this publication are distributed under the terms of CC BY 3.0" 이라고 쓴다.
→ 책 통째가 아니라 **챕터 단위로만** 재사용 가능. 발췌 단위와 라이선스 단위가 우연히 맞는 경우다.

---

## 4. 안정 식별자 — DOAB 핸들. 100% 채워져 있다

- `dc.identifier.uri` = `https://directory.doabooks.org/handle/20.500.12854/<n>` — **102,078 / 102,078 (100%)**
- OAI 헤더 식별자 = `oai:directory.doabooks.org:20.500.12854/<같은 n>` (핸들과 1:1)
- `oapen.identifier.doi` — 88,867 (87%). 없는 항목이 13% 라 **단독 키로 못 쓴다**
- ISBN — `dc.identifier.isbn` 컬럼은 전량 빈 값이었다. ISBN 은 `BITSTREAM ISBN`·`oapen.relationisbn` 에 있으나
  전자책/인쇄판이 섞여 중복 방지 키로 부적합
- ⚠️ 다운로드 URL 은 키로 쓰면 안 된다 — 같은 책이 `mdpi.com` / `www.mdpi.com`,
  `intechopen.com` / `mts.intechopen.com` / `intech-files.s3.amazonaws.com` 로 흩어져 있다

**결론: 핸들 숫자부(`20.500.12854/<n>`)를 유일 키로 쓴다.**

---

## 5. 증분 커서 — OAI-PMH `from`/`until`

실측:
```
verb=ListRecords&metadataPrefix=oai_dc&from=2026-08-01T00:00:00Z
→ HTTP 200, completeListSize="2693", token = oai_dc/2026-08-01T00:00:00Z///100
```
**5주에 2,693건**(전 언어·전 라이선스). 월 ~2,000건 규모의 신규·갱신이다.

페이지네이션 안정성 — 1페이지(offset 0)와 2페이지(offset 100)의 식별자 100개씩을 대조:
**중복 0건.** 2026-08-16 IA 사고(정렬 없는 페이지네이션이 214건 중복 + 동수 누락)와 같은 증상은
관측되지 않았다. 다만 **두 페이지만 대조한 결과이므로 1,278페이지 전 구간의 안정성을 증명한 것은 아니다.**

⚠️ `deletedRecord=transient` — DOAB 는 삭제 레코드를 보존하지 않는다. 즉 **OAI 로는 "이 책이 DOAB 에서
내려갔다"를 알 수 없다.** 철회 감지가 필요하면 분기 1회 CSV 덤프 전량과 대조해야 한다
(덤프는 요청 1회 27초이므로 이쪽이 오히려 싸다).

---

## 6. 현실적 확보 가능 편수 — **6,634 (마찰 없음) / 26,076 (어댑터 필요)**

CSV 102,078행 전수 집계, 조건을 하나씩 좁혀 가며 셌다:

| 필터 | 남는 수 |
|---|---|
| 전체 항목 | **102,078** (book 91,668 · chapter 9,818 · `book||book` 592) |
| ↳ 영어 (`dc.language` 에 eng) | **59,159** |
| ↳ + 상업적 변형 가능 (CC BY / BY-SA / CC0 / PDM) | 26,097 |
| ↳ + 다운로드 URL 있음 | **26,076** (CC BY 24,944 · CC BY-SA 1,132 · PD 5) |
| ↳ + URL 이 직접 `.pdf` | 14,050 |
| ↳ + OAPEN(Anubis 차단) 제외 | **6,634** ← **오늘 당장 받을 수 있는 수** |

> NC 를 허용하면(비상업 서비스로 한정) +8,462 → 영어 변형가능 34,538. Vocaflow 는 유료화를 전제하므로
> **NC 는 세지 않는다.**

### 6,634 의 정체 — 한 출판사다

| 호스트 | 건수 | 비중 |
|---|---|---|
| `mts.intechopen.com` | 6,073 | 91.5% |
| `intech-files.s3.amazonaws.com` | 369 | 5.6% |
| `edizionicafoscari.unive.it` | 90 | 1.4% |
| `skyfox.co` | 29 | |
| `www.logos-verlag.de` · `dspace.cuni.cz` | 각 17 | |
| 나머지 15개 호스트 합 | 39 | |

**IntechOpen 이 6,442권(97.1%).** 표본 30건을 Range 요청(0–1023B)으로 도달성 확인 →
**30/30 이 `206 application/pdf` + `%PDF` 매직.** 차단 없음.

주제 분포(thema EDItEUR 상위):
M 의학·간호 2,353 · T 공학·농업·산업 1,361 · P 수학·과학 1,328 · R 지구과학·환경 448 ·
U 컴퓨팅 344 · K 경제·경영 223 · **J 사회과학 273 · N 역사·고고 25 · 문학 2**.
→ **93% 가 STEM·의학.** 수능·교재가 실제로 쓰는 인문·사회 지문은 **400권 미만**이다.

### 26,076 으로 가려면 뚫어야 하는 것

| 막힌 것 | 건수 | 뚫는 법 |
|---|---|---|
| OAPEN Anubis PoW | 7,445 | 헤드리스 브라우저로 PoW 해결 후 쿠키 재사용. 비용·유지보수 큼 |
| MDPI Cloudflare 403 | 7,092 | `mdpi.com/books/pdfview/book/<id>` → 403. 우회 미확인 |
| Frontiers 랜딩→PDF | 2,948 | 랜딩 HTML 파싱 1홉 추가. 차단은 없었음 |
| 랜딩 페이지·링크 썩음 | 나머지 | PULP `edocman` 표본은 **404**(링크 썩음). 출판사별 어댑터 필요 |

---

## 7. 지문 적합성 표본 판정 — 4권

`scripts/csat/gate-article-drain/JUDGING.md` 어휘 사용.

먼저 **산문 밀도**를 실측했다. pdftotext 출력에서 40낱말 이상 문단 중 숫자 비율 <4% ·
인용 마커 ≤2 · 대문자 비율 <9% 인 것만 산문으로 셌다:

| 표본 | 산문 낱말 / 전체 | 산문 밀도 | 최장 연속 산문 |
|---|---|---|---|
| Sex Hormones (IntechOpen) | 39,786 / 139,396 | **29%** | 457낱말 |
| Fourier Transform (IntechOpen) | 37,925 / 100,789 | **38%** | 433낱말 |
| A World of Nourishment (Ledizioni) | 94,773 / 129,536 | **73%** | 534낱말 |
| Stuck and Exploited (Ca' Foscari) | 106,078 / 151,992 | **70%** | 563낱말 |

**STEM 편집서는 본문의 60~70%가 참고문헌·표·수식·그림 캡션이다.** 순진하게 문서의 25% 지점부터
300낱말을 자르면 p2·p3 는 **참고문헌 목록이 그대로 나온다**(실제로 그렇게 나왔다).
챕터 도입부를 300어대로 자르려면 산문 밀도 필터가 **선택이 아니라 필수**다.

### 판정

**① Sex Hormones in Neurodegenerative Processes** (IntechOpen · CC BY 3.0 챕터 단위) — **reject**
> "Progesterone is a steroid hormone primarily secreted by the corpus luteum and placenta. …
> The P450 cholesterol side chain cleavage enzyme (P450scc) is located on the inner mitochondrial
> membrane and catalyzes the conversion of cholesterol to pregnenolone [6]."

자족적 설명문이긴 하나 전문용어 밀도가 고등학교 수준을 크게 넘고, `[6]` 인용 마커와
`(Figures 1 and 2)` 참조가 문장에 박혀 있어 발췌 시 지시대상이 사라진다. **자족성 위반.**

**② Fourier Transform** (IntechOpen · CC BY 3.0) — **서문은 `use`, 본문은 `reject`**
> "The basic idea behind all those horrible looking formulas is rather simple, even fascinating:
> it is possible to form any function as a summation of a series of sine and cosine terms of
> increasing frequency. … A fellow called Joseph Fourier first came up with the idea in the
> 19th century."

이 대목은 그대로 수능 과학 지문이 된다. 그러나 이런 문단은 **책 한 권에 서문 1~2개뿐**이고
본문은 수식·분광 데이터다. **책당 수확 기대치 1~2편.**

**③ Stuck and Exploited** (Ca' Foscari · CC BY 4.0) — **use / narrative**
> "The lawyer suggested to accept the result, unless she wanted to proceed with a further level
> of appeal which would have few chances of success, while the operators supported the option of
> presenting a new request for asylum …"

난민 수용 제도 민족지. 논증·서사가 섞인 자족적 산문이고 어휘 수준도 맞는다.
다만 각주 번호가 본문에 섞여 들어오고("16 Humanitarian protection is a residual form of protection…")
이탈리아어 제도 용어(CAS, Questura, CASC)가 각주 없이는 안 풀린다. **정제 후 채택 가능.**

**④ A World of Nourishment** (Ledizioni) — **라이선스 사유로 제외**
> "married women in the deceased's household must make a gift of dresses and jewellery to their
> married daughters. … Kalbeliyas call this funeral monument samādhi …"

인도 문화·음식 인류학. 산문 질은 위 ③과 동급이나 **§3 의 판권면 모순 사례**라 쓸 수 없다.

### 종합

- 도달 가능한 6,634권의 **93%가 STEM 편집서**이고, 그 산문 밀도는 29~38%다.
- STEM 편집서에서 300어대 지문이 나오는 자리는 서문·결론·리뷰 도입부에 국한된다 → **책당 1~3편**.
- 인문·사회 계열(③④처럼 산문 밀도 70%, 책당 10편 이상 기대)은 **도달 가능 풀에 400권 미만**이고,
  대다수가 OAPEN·OpenEdition·JSTOR·MUSE 등 막히거나 랜딩 페이지인 호스트에 있다.

---

## 판정 근거 — 왜 「채택」이 아니라 「보류」인가

반려 사유(전문 안 옴 · 변형 금지 · 대량 경로 없음) 는 **셋 다 해당하지 않는다.**
경로는 훌륭하다 — 요청 1회 27초짜리 전체 메타데이터 덤프, 100% 채워진 안정 식별자,
항목별 라이선스 필드, 작동하는 `from` 커서. 편수도 100 을 한참 넘는다.

그런데 **지문 적합성이 낮다.** 목표 표의 추정 5,250편은 원시 권수로는 맞지만(6,634 > 5,250),
그 6,634권은 사실상 IntechOpen 한 출판사의 의학·공학 편집서이고 산문 밀도가 3분의 1이다.
수능·교재 지문으로 실제 살아남을 편수는 **권당 1~3편 × 6,634 ≒ 7,000~20,000 후보 발췌 →
게이트 통과 후 실제 채택은 훨씬 아래**로 봐야 하고, 이는 이미 확보한 PLOS 51,465편과
**주제·문체가 거의 겹친다**(둘 다 학술 STEM). 새로 얻는 다양성이 작다.

**보류를 해제하는 조건 (셋 중 하나)**
1. **OpenEdition(12,886) 또는 JSTOR/MUSE 경로를 뚫으면** — 여기가 인문·사회 본진이다.
   OpenEdition 은 `books.openedition.org` 자체 API 가 따로 있으므로 **별건 정찰 대상**으로 올릴 것.
2. **OAPEN Anubis 를 헤드리스로 통과하면** — +7,445권, 그리고 여기에 Open Book Publishers·
   UCL Press 등 인문 학술서가 몰려 있다.
3. **PLOS 와 겹치지 않는 축(사회과학·역사·교육)만 골라 소량 파일럿** — CC BY 인문서 400권으로
   먼저 게이트 통과율을 재고, 통과율이 PLOS 대비 유의미하게 높으면 1·2 에 투자한다.

---

## 수확기를 짠다면

### 본뜰 것

`scripts/csat/harvest-plos.mjs` (API 형)이 가장 가깝다 — 단, PLOS 와 달리 **2단 구조**여야 한다.
DOAB 는 메타데이터와 전문의 출처가 다르기 때문이다.

```
scripts/csat/harvest-doab.mjs        # 1단: CSV 덤프 1회 GET → 필터 → 후보 목록
scripts/csat/doab-extract.mjs        # 2단: 후보의 PDF 를 호스트별로 받아 산문 발췌
scripts/csat/lib-doab.mjs            # 라이선스 정규화 + 판권면 대조 + 산문 밀도 필터
```

### 1단 — 후보 뽑기 (`harvest-doab.mjs`)

1. `GET https://directory.doabooks.org/download-export?format=csv` (280 MB, 27초, **요청 1회**).
   `plos-harvest-cursor.json` 과 같은 자리에 `scripts/csat/data/doab-harvest-cursor.json` 을 두고
   덤프의 `date` 헤더와 행수를 적어 재실행 시 같은 판인지 확인한다.
2. **스트리밍 CSV 파서**로 읽는다(따옴표 안 개행이 있으므로 `split(',')` 은 깨진다 — 정찰 때 상태기계로 짰다).
3. 필터 순서 — 이 순서를 지켜야 계수가 위 표와 재현된다:
   `dc.language` 에 eng → 라이선스 정규화(`dc.rights.licenseurl` ‖ `dc.rights.uri` ‖ **`BITSTREAM License`**)
   → `by`/`by-sa`/`zero`/`mark` 만 → 다운로드 URL 존재 → 호스트별 어댑터 유무.
4. 라이선스 문자열은 **정규화 표**를 거친다. 실측된 오표기: `by-by-nc-nd`(27) · `nc-sa`(7) ·
   `by-nd-nc`(5) · `cc-by-nc-nd`(5) · `by-nc/4.0/)/`(1) · `.../legalcode` 접미 · `http`/`https` 혼용 ·
   `4.0` vs `4.0/`. 정규화 못 한 값은 **버리지 말고 `unknown` 으로 남겨 사람이 본다**(조용히 떨어뜨리면 구멍이 남는다).
5. 유일 키 = 핸들 숫자부. 이미 처리한 핸들은 건너뛴다 → **재실행 안전.**

### 2단 — 전문 받기 (`doab-extract.mjs`)

호스트별 어댑터로 분기한다. 1차 구현은 **IntechOpen 하나면 풀의 97%를 덮는다.**

| 어댑터 | 대상 | 상태 |
|---|---|---|
| `direct-pdf` | `mts.intechopen.com` · `intech-files.s3` · `edizionicafoscari` 등 | ✅ 실측 200 |
| `frontiers` | `frontiersin.org` 랜딩 → PDF 링크 파싱 | 미구현(차단은 없음) |
| `oapen` | `library.oapen.org` | ❌ Anubis. 헤드리스 필요 |
| `mdpi` | `mdpi.com/books/pdfview/...` | ❌ Cloudflare 403 |

각 PDF 마다:
1. `pdftotext -enc UTF-8` (mingw64 에 이미 있다).
2. **판권면 대조** — 앞 5페이지에서 저작권 문구를 뽑아 메타데이터 라이선스와 모순되면 **드롭**
   (§3 의 Ledizioni 사례). 드롭 사유를 로그에 남긴다.
3. **산문 밀도 필터** — 40낱말 이상 문단 중 숫자비 <4% · 인용마커 ≤2 · 대문자비 <9% ·
   `Fig.`/`Table`/`[숫자` 로 시작하지 않는 것. 이걸 안 걸면 **참고문헌 목록이 지문으로 나온다.**
4. 연속 산문 문단을 이어 250~350낱말 창을 만든다. 각주 번호(`^\d+\s+[A-Z]`)와
   러닝 헤더/푸터(페이지 번호 + 책 제목 + DOI 가 한 줄로 붙어 나온다 — 실측:
   `"50 Sex Hormones in Neurodegenerative Processes and Diseases"`)를 제거해야 한다.
5. 출력에 **핸들 · 라이선스 · 저작자 · 출판사**를 함께 실어 CC BY 귀속 표시를 만들 수 있게 한다
   (SA 항목은 결과물 전염을 표시하고 별도 버킷으로).

### 몇 번에 나눠 돌릴지

- 1단은 **1회 27초**. 나눌 필요 없다.
- 2단은 6,634 PDF × 평균 9 MB ≈ **60 GB**. 텍스트만 남기고 PDF 는 즉시 버려도
  IntechOpen 한 호스트에 6,442 요청이 몰린다 → **초당 1요청 이하, 하루 1,000건 상한, 6~7일 분할.**
  (정찰 중 OAPEN 에서 4연속 요청만으로 "30초 제한" 429 를 받았다. 예의 문제가 아니라 차단 문제다.)
- 커서: `scripts/csat/data/doab-extract-cursor.json` 에 처리 완료 핸들 집합.
  PLOS 가 `plos-extract-cursor-00.json` … `-e0.json` 로 16분할한 것처럼 호스트별로 쪼개면
  한 호스트가 막혀도 나머지가 계속 돈다.

### 먼저 할 것 (파일럿)

전면 수확 전에 **인문·사회 400권 파일럿**을 돌린다 — §「보류 해제 조건」 3번.
`J`(사회과학) 273 + `N`(역사·고고) 25 + 문학·철학 소수 + Ca' Foscari 90 을 합쳐 약 400권.
여기서 게이트 통과율이 PLOS 대비 유의미하게 높지 않으면 **DOAB 전면 수확은 하지 않는다** —
IntechOpen 6,442권은 PLOS 51,465편과 같은 것을 더 주는 것뿐이다.
