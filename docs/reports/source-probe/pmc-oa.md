<!-- docs/reports/source-probe/pmc-oa.md -->
# PMC Open Access Subset 확보 정찰

| | |
|---|---|
| 판정 | **채택** (경로 기준) — 단, **지금 수확하지 않는다.** 착수 조건 2개는 §착수 조건 |
| 확보 가능 편수 | 실측 **4,998,523** (CC BY/CC0 ∧ OA ∧ ¬PLOS · E-utilities `<Count>`) · 적합 게이트 50% 반영 시 **약 250만** |
| 라이선스 | **항목별로 다르다.** 기계가독 `license_code` 로 옴 · CC BY/CC0 로 좁히면 변형 **가능** · CC BY-NC(995,888)·NC-ND(1,076,046)·ND(11,976) 는 **제외 대상** |
| 전문 | **온다.** JATS XML `<body>` + **추출 완료된 평문 `.txt`** 둘 다 |
| 안정 식별자 | **PMCID**(`PMC13533779`, 20/20) + **DOI**(20/20) — 둘 다 100% |
| 증분 커서 | `[edat]`(Entry Date) 날짜창 + `usehistory=y` WebEnv |
| 정찰 일자 | 2026-09-07 |

목표 표의 채택 추정 **4,500편은 공급 제약이 아니다** — 공급은 그 **550배**다.
이 소스에서 4,500편을 못 채울 이유는 없다. 막는 것은 §7 의 **수요**와 §8 의 **분류기**다.

---

## 0. 먼저 — 문서에 적힌 경로 3개 중 2개가 죽어 있었다

지시받은 3경로(OA Web Service / FTP 벌크 / OAI)를 그대로 호출한 결과다. **2026년에 구조가 통째로 바뀌었다.**

| 경로 | 실측 결과 |
|---|---|
| **OA Web Service** (`oa.fcgi`) | ❌ **없어졌다.** `www.ncbi.nlm.nih.gov/pmc/utils/oa/oa.fcgi` → **HTTP 404** (NCBI 진단 페이지) · `pmc.ncbi.nlm.nih.gov/utils/oa/oa.fcgi` → 200 이지만 **SPA 예외 페이지**(`exception_style` CSS 로드) — API 응답이 아니다 |
| **FTP 벌크 패키지** | ❌ **없어졌다.** `/pub/pmc/oa_bulk/` → **404**. `/pub/pmc/` 에 남은 것은 `PMC-ids.csv.gz` 와 `readme.txt` **단 둘**뿐 |
| **OAI-PMH** | ✅ 산다. 단 **baseURL 이 이전**됐다 → `https://pmc.ncbi.nlm.nih.gov/api/oai/v1/mh/` |

`readme.txt` 원문(실측):

> **Updated 8/25/2026** — All legacy files for the PMC Article Datasets are in the process of being
> removed from the FTP Service. … All files are now available via the updated **PMC Cloud Service**.

`/tools/cloud/` 도 같은 것을 말한다:

> **August 26, 2026: PMC's Article Dataset Distribution Service Changes Are Complete** …
> All legacy PMC Article Dataset files on the FTP and Cloud Services were removed the week of August 24, 2026.

⚠️ **정찰이 3주만 늦었어도, 3주 일렀어도 답이 달랐다.** 이 소스에 대해 다른 곳에 적힌 경로 설명은
2026-08 이전 것이면 전부 낡았다고 봐야 한다.

### ⚠️ 자동 수집이 허용되는 경로가 **명시적으로 열거**돼 있다

`/tools/openftlist/` 원문:

> **The PMC Cloud Service, PMC OAI-PMH Service, E-Utilities and BioC API are the only services
> that may be used for automated retrieval of PMC content. Systematic retrieval (or bulk retrieval)
> of articles through any other automated process is prohibited.**

FAQ 도 같다 — "Systematic downloading of batches of articles from **the main PMC website**, in any way,
is prohibited". **`pmc.ncbi.nlm.nih.gov` 기사 HTML 을 긁는 수확기는 만들면 안 된다.**
아래 설계는 허용된 4경로 중 **E-Utilities + Cloud Service** 두 개만 쓴다.

---

## 1. 대량 접근 경로 — 셋을 다 불러 보고 **둘을 조합**한다

세 경로 모두 실제로 호출했다. 하나로는 안 되고, **선택(E-utilities) + 수령(S3)** 을 나누는 것이 답이다.

### (a) E-Utilities — **선택** 계층 ✅ 채택

```
https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi
  ?db=pmc&term=<질의>&retmax=200&usehistory=y
```

실측 호출 1개(그대로 재현 가능):

```
term=("cc by license"[filter] OR "cc0 license"[filter]) AND "open access"[filter] NOT PLoS*[Journal]
→ <Count>4998523</Count>
```

**이 계층이 유일하게 라이선스·PLOS·날짜를 한 번에 거른다.** S3 도 OAI 도 못 하는 일이다.

### (b) PMC Cloud Service (AWS S3) — **수령** 계층 ✅ 채택

익명(무자격증명) 접근이 실제로 된다 — 버킷 `pmc-oa-opendata`.

```
GET https://pmc-oa-opendata.s3.amazonaws.com/metadata/PMC13533779.1.json      → 메타 1건
GET https://pmc-oa-opendata.s3.amazonaws.com/PMC13533779.1/PMC13533779.1.txt  → 평문 전문
```

⚠️ **버킷 구조도 2026-08 에 바뀌었다** — 옛 `oa_comm/` `oa_noncomm/` prefix 는 **KeyCount 0**(실측).
지금은 **평평한 `PMC<id>.<ver>/`** 와 별도 `metadata/` prefix 다.

### (c) OAI-PMH — ⚠️ 산다. 그러나 **이 규모에는 못 쓴다**

```
https://pmc.ncbi.nlm.nih.gov/api/oai/v1/mh/?verb=ListRecords&set=pmc-open&metadataPrefix=pmc&from=2026-09-01&until=2026-09-02
→ HTTP 200 · <record> 10건 · <body> 10건 · resumptionToken 있음
```

`ListSets` 에 `pmc-open`(= OA Subset) 이 있고, `metadataPrefix=pmc` 는 **전문 JATS 를 준다**. 여기까지는 좋다.
못 쓰는 이유는 둘이다:

1. **한 쪽에 10건.** 4,500편이면 450 요청, 250만편이면 25만 요청이다.
2. **`resumptionToken` 에 `completeListSize` 속성이 없다**(태그 실측: `<resumptionToken>` 맨몸).
   → **총계를 못 센다.** SPEC §6 을 OAI 로는 답할 수 없다.
3. **라이선스로 못 거른다.** set 은 저널별이거나 `pmc-open` 전체뿐이라, CC BY-NC 를 사전에 뺄 수 없다.

**결론**: OAI 는 "매일 새로 들어온 것만" 훑는 소규모 증분에는 쓸 수 있으나, 초기 확보에는 부적합.

### (d) 안 되는 것 — 일일 CSV 인벤토리는 **기사 목록이 아니다**

`/tools/cloud/` 가 "makes a CSV inventory file available … updated on a daily basis" 라고 해서
라이선스 표가 있는 줄 알고 열어 봤다. 아니었다:

```
inventory-reports/pmc-oa-opendata/metadata/2026-09-04T01-00Z/manifest.json
→ "fileSchema" : "Bucket, Key, LastModifiedDate, ETag"   (gz 5개 · 합계 약 245 MB)
```

**S3 오브젝트 키 목록**일 뿐 DOI·라이선스·제목이 없다. 라이선스로 거르려면 결국
`metadata/PMC*.json` 을 건당 GET 해야 하는데 그게 800만 건이다 → **인벤토리 경로는 버린다.**
(a) 가 필요한 이유가 이것이다.

---

## 2. 전문(full text) — **온다.** 게다가 추출까지 돼서 온다

무작위 20편(2023–2026 CC BY/CC0 ∧ OA ∧ ¬PLOS, `retstart=5000`)을 실제로 받아 셌다:

| 검사 | 결과 |
|---|---|
| efetch 로 `<article>` 회수 | **20 / 20** |
| `<body>` 존재 | **20 / 20** |
| S3 `.txt` 존재 | **20 / 20** (평균 65.7 KB · 합계 1.31 MB) |

**JATS 를 파싱할 필요가 없다.** `.txt` 는 이미 절 제목이 살아 있는 평문이다 — 실측(PMC13533779):

```
ARTICLE INFORMATION
==============================
PMCID: PMC13533779
DOI: 10.1002/open.70282
License: ...
==============================
1 Introduction
As a potential solution to environmental and energy issues, hydrogen energy stands out as …
2 Experimental
```

머리말이 `==============================` 로 닫히고, 본문은 `1 Introduction` / `2 Experimental` 처럼
**번호 붙은 절 제목**으로 나뉜다. → **서론 1~2단락 추출이 정규식 한 줄**이다(§7).

⚠️ 비교: 처음엔 efetch 의 JATS 를 직접 파싱했는데 `<p>` 추출이 20편 중 **2편에서 빈 문자열**을 냈다
(중첩 마크업). 같은 20편을 `.txt` 로 받으니 **0편 실패**. **JATS 를 직접 파싱하지 말 것** —
NLM 이 이미 해 놓은 추출이 우리 정규식보다 낫다.

---

## 3. 라이선스 — ⚠️ **가장 중요한 항목이고, 여기가 이 소스의 함정이다**

### 함정: "PMC OA Subset" 은 **변형 가능하다는 뜻이 아니다**

`open access[filter]` 는 **8,203,807건**(실측)이지만, 이건 그냥 "재배포 조건이 명시된 것" 이다.
안에 **ND 와 NC 가 섞여 있다.** `open access[filter]` 만 걸고 수확하면 **변형 금지 논문을 개작하게 된다.**

PMC 자신도 그렇게 경고한다 — `/tools/openftlist/`:

> **License terms vary.** Please refer to the license statement in each article for specific terms of use.

### 라이선스별 실측 (E-utilities `<Count>`, 2026-09-07)

| 필터 질의 | 편수 | 변형 | 상업 | 우리 판정 |
|---|---:|:---:|:---:|---|
| `"cc by license"[filter]` | **5,242,023** | ✅ | ✅ | **채택** |
| `"cc0 license"[filter]` | **169,017** | ✅ | ✅ | **채택** |
| `"cc by-sa license"[filter]` | 2,102 | ✅ | ✅ | 보류 — SA 전염(결과물도 SA) |
| `"cc by-nc license"[filter]` | 995,888 | ✅ | ❌ | **제외** — 유료 교재 불가 |
| `"cc by-nc-sa license"[filter]` | 301,732 | ✅ | ❌ | **제외** |
| `"cc by-nc-nd license"[filter]` | 1,076,046 | ❌ | ❌ | **제외** |
| `"cc by-nd license"[filter]` | 11,976 | ❌ | ✅ | **제외** — The Conversation 과 같은 사유 |

**NC/ND 계열 합계 2,383,642편 = OA Subset 의 29%.** 이것을 안 빼면 3편 중 1편이 못 쓸 물건이다.

### 항목별로 읽는 법 — **두 곳 다 기계가독이다** (실측)

라이선스를 "메타데이터에 필드로 오는가"가 SPEC §3 의 물음이다. **온다. 두 경로 모두.**

**(1) S3 JSON — 가장 깔끔하다.** `PMC13533779.1.json` 전문(media 생략):

```json
{ "pmcid": "PMC13533779", "version": 1, "pmid": 42680592,
  "doi": "10.1002/open.70282",
  "title": "Iron-Based Catalysts on Tailored Alumina Supports for CO x-Free Methane Decomposition…",
  "citation": "ChemistryOpen. 2026 Sep 1;15(9):e70282. doi: 10.1002/open.70282",
  "is_pmc_openaccess": true, "is_manuscript": false,
  "is_historical_ocr": false, "is_retracted": false,
  "license_code": "CC BY",
  "text_url": "s3://pmc-oa-opendata/PMC13533779.1/PMC13533779.1.txt?md5=39b3…" }
```

`license_code` 가 **닫힌 열거형 한 글자열**이다. 20/20 전부 `"CC BY"` 로 왔다(질의가 CC BY 였으므로 일치).

**(2) JATS XML** — `<ali:license_ref specific-use="textmining" content-type="ccbylicense">`.
`content-type` 이 `ccbylicense` / `ccbyncndlicense` / `cc0license` 로 온다(3종 모두 실측).

> **덤 — `is_retracted` 가 공짜로 온다.** 이 저장소는 바로 직전 커밋
> (`1180c070 fix(csat): 철회 논문은 이미 막혀 있었다`)에서 철회 논문 문제를 다뤘다.
> PMC 는 그 판정을 **메타데이터 필드로 준다** — 따로 조회할 필요가 없다.

### 적재 시 반드시

`library_articles` 의 라이선스 컬럼에 **항목별 `license_code` 를 그대로 적는다.** 소스 단위로
`license_class: 'cc_by'` 를 박으면 안 된다 — PLOS(전량 CC BY)와 달리 **PMC 는 소스 단위 단일값이 없다.**
(`measure-source-genre.mjs` 의 `LIC` 상수 방식은 PMC 에 그대로 쓰면 틀린다.)

---

## 4. 안정 식별자 — **두 개가 온다. 둘 다 100%**

20편 전수 검사:

| 필드 | 존재 | 성격 |
|---|---:|---|
| `pmcid` (`PMC13533779`) | **20/20** | PMC 내부 영구 ID. 버전 접미사(`.1`)가 S3 키에 붙는다 |
| `doi` (`10.1002/open.70282`) | **20/20** | 발행사 DOI — **PLOS 중복 배제의 열쇠** (§5) |

⚠️ `doi` 가 **`null` 일 수 있다** — 실측 `PMC10000000` (1867년 Chicago Medical Examiner, 역사 OCR)
은 `"doi": null` 이다. **1차 키는 `pmcid`, 중복 대조 키는 `doi`** 로 나눠 써야 한다.
(`doi` 를 1차 키로 삼으면 역사 OCR 자료에서 null 충돌이 난다.)

`source_id` 는 기존 관례(`plos:${DOI}`)를 따라 **`pmc:${pmcid}`** 를 쓴다 —
pmcid 는 절대 null 이 아니고, 재수확 때마다 같은 값이다.

---

## 5. ⚠️ PLOS 중복 배제 — **핵심 물음. 두 겹으로 막는다**

PLOS 논문은 전부 PMC 에도 있다. 이 저장소엔 이미 PLOS **51,465편**이 있으므로,
막지 않으면 그만큼을 다시 받아 다시 판정한다.

### 겹침의 규모 (실측)

```
term=PLoS*[Journal]  →  <Count>412670</Count>
```

**PMC 안에 PLOS 가 412,670편.** 우리 재고 51,465편은 전부 이 안에 있다.

### 1겹 — 상류에서 안 받는다 (esearch 질의)

```
NOT PLoS*[Journal]
```

`QueryTranslation` 이 `NOT "plos*"[Journal]` 로 확장되는 것을 확인했다(와일드카드가 실제로 먹는다).
효과 실측:

```
"cc by license"[filter]                        → 5,242,023
"cc by license"[filter] NOT PLoS*[Journal]     → 4,847,842      (차이 394,181)
```

**검증 — 진짜로 빠졌는가.** 이 질의로 뽑은 20편의 **논문 자신의 DOI**(참고문헌이 아니라 front matter)를 전수 확인:

```
own DOIs starting 10.1371:  0 / 20
실제 값: 10.7586/jkbns.26.025 · 10.1002/open.70282 · 10.1136/bmjpo-2026-004575 · 10.1002/jev2.70366 …
```

> ⚠️ **여기서 한 번 틀릴 뻔했다.** 처음에 XML 전체를 `10.1371` 로 grep 했더니 **17건**이 나와서
> "PLOS 제외가 안 먹는다" 고 볼 뻔했다. 그 17건은 전부 **참고문헌 목록의 인용 DOI** 였다.
> **반드시 `</front>` 앞의 article-meta DOI 만 봐야 한다.** 본문 전체 grep 은 오답을 준다.

### 2겹 — 적재 직전 DOI 대조 (저널명을 못 믿는 경우 대비)

저널명 기반 배제는 **PLOS 가 저널 표기를 바꾸면 조용히 뚫린다**(`PLoS One` → `PLOS ONE` → 신규지).
그래서 `harvest-plos.mjs` 가 이미 하는 것과 같은 대조를 **DOI prefix 로** 한 겹 더 건다:

```js
// 우리 재고의 PLOS 키는 `plos:10.1371/...` 다 (harvest-plos.mjs:324 `source_id: `plos:${d.id}``)
if (meta.doi?.startsWith('10.1371/')) continue          // PLOS 는 DOI prefix 가 고정이다
const { data: dup } = await db.from('library_articles')
  .select('source_id').eq('feed_id','harvest').in('source_id', [`plos:${meta.doi}`, `pmc:${meta.pmcid}`])
if (dup?.length) continue
```

**`10.1371/` 은 PLOS 의 Crossref 등록 prefix 라 저널명과 달리 안 바뀐다.**
1겹이 저널명(바뀔 수 있음), 2겹이 DOI prefix(안 바뀜) — **둘 중 하나만으로는 안 한다.**

### 3겹은 필요 없다

PMC 에 있는 PLOS 는 **전부** `10.1371/` DOI 를 갖는다(발행사가 하나이므로). 별도 목록 대조는 불필요.

---

## 6. 증분 커서 — ⚠️ **정렬이 없다. 그래서 WebEnv 를 쓴다**

SPEC §5 가 경고한 정확히 그 함정이 여기 있다.

### 함정 실측 — **db=pmc 에는 쓸 수 있는 정렬이 없다**

```
sort=pub_date  → Unknown sort schema 'pub_date' ignored
sort=pub date  → Unknown sort schema 'pub date' ignored
sort=Journal   → Unknown sort schema 'journal' ignored
sort=relevance → (경고 없음 · 기본값)
```

**`retstart` 를 늘리며 도는 순진한 페이지네이션은 금지다.** 상류 색인이 갱신되면
(PMC 는 "Continuous" 갱신이라고 스스로 밝힌다) 순서가 밀려 **중복과 누락이 동시에** 난다 —
2026-08-16 IA 사고와 같은 구조다.

### 답 1 — 한 번의 실행 안에서는 **WebEnv 로 결과를 얼린다**

```
esearch.fcgi?...&usehistory=y   → <QueryKey>1</QueryKey><WebEnv>MCID_6a9e412cdf2b2d586c04d8cc</WebEnv>
efetch/esummary?...&query_key=1&WebEnv=MCID_…&retstart=N&retmax=200
```

WebEnv 는 **서버가 결과 집합을 저장해 둔 것**이라, 그 안에서의 `retstart` 는 안정적이다.
(`retstart=5000` 이 실제로 동작하는 것도 확인했다.)

### 답 2 — 실행과 실행 사이는 **`[edat]` 날짜창**

WebEnv 는 오래 못 산다. 다음 실행이 "지난번 이후" 를 집으려면 날짜 필드가 필요하다.

| 후보 | 실측 | 채택 |
|---|---|---|
| `[crdt]` (Date - Create) | `2026/09/01:2026/09/03[crdt]` → **Count 0** | ❌ db=pmc 에선 안 채워진다 |
| `[edat]` (Date - Entry) | `2026/09/01:2026/09/03[edat]` → **Count 5,260** | ✅ **채택** |
| `[pdat]` (발행일) | 동작하나 **소급 등록**을 놓친다 | ❌ 커서로는 부적합 |

**`[edat]` = PMC 에 들어온 날.** 1970년 논문이 오늘 등록되면 `edat` 는 오늘이다 —
그래서 소급 등록을 놓치지 않는다. `[pdat]` 를 커서로 쓰면 그것들이 영영 안 잡힌다.

측정된 유입 속도: **CC BY 기준 3일에 5,260편 (하루 약 1,750편).**

### 커서 파일

`scripts/csat/data/pmc-harvest-cursor.json` — `{ "edatUntil": "2026-09-04", "webEnv": null }`.
`plos-harvest-cursor.json` 과 같은 자리·같은 규칙이다.
⚠️ **커서는 최적화일 뿐 안전장치가 아니다** — 지워도 `pmc:${pmcid}` dedup 이 막는다(PLOS 와 동일 계약).

---

## 7. 지문 적합성 표본 판정 — **기계 게이트 50%, 그러나 소재가 한 덩어리다**

### (a) 기계 채점 — 이 저장소의 자로 쟀다

표본을 눈으로만 보지 않고 **`scripts/csat/lib-fit.mjs` 의 `fitRecord()` 를 그대로 돌렸다**
(재고 채점·PLOS 적재 게이트와 **같은 자**. `SCORER_VERSION 1` · `bandsHash 773d679f463c`).
본문은 제안하는 파이프라인 그대로 S3 `.txt` 에서 뽑았다.

**20편 중 적합(`pass>0`) 10편 = 50.0%**

| PMCID | license | shape | pass | chars | 분류 |
|---|---|---:|---:|---:|---|
| PMC13533632 | CC BY | 23 | **19** | 39,488 | 예술·문화 |
| PMC13533779 | CC BY | 37 | **12** | 57,268 | 과학·자연 |
| PMC13533795 | CC BY | 23 | **6** | 86,543 | 과학·자연 |
| PMC13533780 | CC BY | 22 | **3** | 69,810 | 과학·자연 |
| PMC13534335 | CC BY | 35 | **3** | 112,740 | 과학·자연 |
| PMC13533608 | CC BY | 3 | **2** | 57,133 | 심리·인지 |
| PMC13533818 | CC BY | 12 | **2** | 71,486 | 과학·자연 |
| PMC13536097 | CC BY | 3 | **2** | 40,268 | 교육·언어 |
| PMC13536170 | CC BY | 4 | **2** | 32,687 | 예술·문화 |
| PMC13533602 | CC BY | 3 | **1** | 43,474 | 심리·인지 |
| *나머지 10편* | CC BY | 0–10 | **0** | — | — |

**비교 기준**: `harvest-plos.mjs` 주석의 PLOS 실측은 "Psychology 질의 200편 중 적합 125편" = **62.5%**.
PMC 50% 는 그보다 낮지만 **같은 자릿수**다 — SPEC 의 「보류」 사유인 "적합성이 낮다" 에는 해당하지 않는다.

### (b) 사람 판정 — 서론 1~2단락, `JUDGING.md` 어휘로

표본 5편의 서론을 실제로 읽었다.

| PMCID | 저널 / 주제 | verdict | genre | 근거 |
|---|---|---|---|---|
| PMC13546084 | J Biomedical Optics · 뇌종양 수술 중 라만분광 | `use` | `health` | 통념(수술 중 경계 판별의 어려움) → 이 연구의 물음. 자족적 설명문 |
| PMC7619452 | J Syst Palaeontology · 백악기 담수 가오리 | `use` | `nature` | "화석 기록은 풍부하나 **편향돼 있다**" 는 반전으로 열린다 — 서론 정석 |
| PMC13546129 | Cureus · 레이저 치주치료 | `use` | `health` | 설명문이나 임상 약어(CAL·SRP) 밀도가 높다 |
| PMC13546121 | Cureus · 페리틴·헤모글로빈 | `use` | `health` | 자족적. 다만 국가 통계 나열이 절반 |
| PMC7619451 | Comput Stat Data Anal · 베이지안 FPCA | `use` | `technology` | 장르로는 설명문이나 **FDA·FPCA·직교기저** 등 개작 없이는 못 쓴다 |

**5/5 `use`.** 차단 장르 9종에 걸린 것은 없다 — `JUDGING.md` 의 reject 는 **장르** 기준이고
전문용어 밀도는 reject 사유가 아니기 때문이다.

⚠️ **그래서 LLM 게이트는 PMC 를 거의 안 거른다.** 실질 필터는 (a) 의 기계 게이트와 §8 의 소재다.
"게이트를 통과한다" 를 "지문으로 좋다" 로 읽으면 안 된다.

### (c) 서론 추출 — 실제로 되는 것을 확인했다

`.txt` 의 절 제목에서 바로 잘린다. 실측 결과(PMC13536097, `Introduction` 절 첫 단락):

> Internationally, medical schools increasingly use standardised selection assessments to select
> applicants. The University Clinical Aptitude Test (UCAT) is the most popular standardised medical
> selection assessment across Europe and Australasia. … Hence, this study aims to evaluate whether
> UCAT scores offer incremental predictive validity for doctors' performance in UK post-qualification
> practical clinical examinations.

**인용 표시(`[1]`)가 이미 없다** — NLM 의 평문 추출이 떼고 준다. PLOS Solr `body` 보다 깨끗하다.

---

## 8. ⚠️ 착수 조건 — 경로가 아니라 **여기가 진짜 관문이다**

7항목은 전부 통과했다. 그런데 **지금 수확기를 돌리면 안 된다.** 이유 둘 다 정찰 중에 실측됐다.

### 조건 1 — 수요가 0 이다 (소재 몫이 이미 다 찼다)

`docs/reports/topic-gap.json` (2026-09-04 실측) + `harvest-plos.mjs --stage 3` 몫 계산 실행 결과:

| 소재 | 3단계 목표 | 재고 | **부족** | PMC 가 채울 수 있나 |
|---|---:|---:|---:|---|
| 과학·자연 | 15,789 | 19,691 | **0** | ✅ 가장 잘 |
| 심리·인지 | 7,895 | 7,895 | **0** | ✅ |
| 사회·경제 | 7,719 | 8,207 | **0** | △ 보건정책 한정 |
| 기술·매체 | 3,684 | 4,523 | **0** | △ 의공학 한정 |
| 예술·문화 | 7,018 | 7,215 | **0** | ❌ |
| 역사·인류 | 1,754 | 2,464 | **0** | ❌ 의학사 149편뿐 |
| 교육·언어 | 3,509 | 4,021 | **0** | ❌ 의학교육 8,671편뿐 |
| 철학·윤리 | 2,632 | 3,145 | **0** | ❌ 생명윤리 1,970편뿐 |

**여덟 칸 전부 부족 0.** 그리고 PMC 가 유일하게 잘 채우는 칸(과학·자연)은 **재고가 목표의 1.25배**다.

인문 칸을 PMC 로 메울 수 있는지도 실제로 세어 봤다(CC BY/CC0 ∧ OA ∧ ¬PLOS 교집합):

```
생명윤리 3지 (Bioethics · BMC Med Ethics · J Med Ethics)  → 1,970
의학교육 2지 (BMC Med Educ · Med Educ Online)             → 8,671
의학사 (Med Hist)                                          →   149
```

**부족한 칸에 PMC 가 줄 수 있는 것은 전부 「의학 문맥의」 인문학이다.** 수능의 철학·윤리 지문이
생명윤리 논문으로 대체되지 않는다. §7 의 4권고와 같은 결론 — **PMC 는 과학·자연 소스이지 인문 소스가 아니다.**

### 조건 2 — ~~소재 분류기가 PMC 에서 오작동한다~~ ✅ **해소 2026-09-07**

> **고쳤다.** 아래 20편 진단은 그대로 두되(무엇이 어떻게 틀렸는지가 기록이다), 원인과 결과를
> 먼저 적는다. 원인은 PMC 도 생의학도 아니라 **정규식에 오른쪽 경계가 없었던 것**이다 —
> `\bart` 가 **article · artery · arthritis** 를 먹었고, 여기에 `design`(study design)과
> `culture`(cell culture)가 얹혔다. 같은 결함이 반대 방향으로도 작동해
> `\bgene` 이 **general** 을 먹어 타키투스 『역사』를 과학·자연으로 보냈다.
> 손판독 144편 기준 오분류 **23.6% → 8.3%**, 예술·문화 정밀도 **80% → 94%**.
> 회귀 `apps/web/src/lib/csat/__tests__/topic-classifier.test.ts`(48종)가 잠갔고
> `article·artery·arthritis` 는 그 시험의 첫 항목이다.
> **착수 전제 ②는 충족됐다. ①(수요)은 아래 조건 1 이 바뀌었으니 다시 읽을 것** —
> 「8칸 전부 부족 0」은 고장 난 자로 잰 값이었고, 지금은 3단계 기준 **부족 3,010편**이다.


`lib-topic.mjs` 의 `classify()` 를 표본 20편에 돌린 결과, **9편이 `예술·문화`로 분류됐다.**
제목을 확인했다:

| PMCID | 제목 (실측) | 분류 | 맞나 |
|---|---|---|---|
| PMC13536086 | Cardiovascular disease and amyloidosis in phase III multiple myeloma trials | 예술·문화 | ❌ 심장학 |
| PMC13533800 | Small Extracellular Vesicle and Total Lipid Profiles Provide a Diagnostic Advantage | 예술·문화 | ❌ 세포생물학 |
| PMC13533601 | Predictive performance of an extended NEWS model for acute deterioration | 예술·문화 | ❌ 중환자의학 |
| PMC13533606 | Comparative analysis of ventilator-associated pneumonia | 예술·문화 | ❌ 감염관리 |
| PMC13536044 | Seasonal 25-hydroxyvitamin D levels in new childhood-onset SLE | 예술·문화 | ❌ 류마티스학 |
| PMC13536075 | …quality improvement initiative for central venous catheter… | 예술·문화 | ❌ 의료질관리 |
| PMC13536130 | Hospitalisations for respiratory tract infections in preterm children | 예술·문화 | ❌ 소아과 |
| PMC13536170 | High-intensity treatment … at the end of life among children | 예술·문화 | ❌ 완화의료 |
| PMC13533632 | **Holding Two Worlds, Keeping Art Alive: ArtVoice … Indigenous Knowledge** | 예술·문화 | ✅ **유일하게 맞다** |

**9편 중 8편이 오분류 — 정확도 11%.** 그리고 하필 **`예술·문화`** 로 쏠린다.

이게 왜 위험한가: `harvest-plos.mjs` 는 **분류기가 준 칸의 몫이 남아 있으면 담는다**(`harvest-plos.mjs:310-315`).
같은 구조로 PMC 수확기를 만들면, **인공호흡기 폐렴 논문이 「예술·문화」 몫으로 적재된다.**
그 칸은 PLOS 가 못 채워서 남겨 둔 바로 그 칸이고, 겉으로는 "예술·문화 재고가 늘었다" 로 보인다 —
**조용히 오염된다.** 이 저장소가 이미 겪은 실패 방식이다
(`lib-fit.mjs` 주석: 소재 게이트의 "확신도를 올릴수록 오히려 앨범 문서가 올라왔다").

> `lib-fit.mjs` 는 스스로 "이 채점기가 재지 않는 축: 소재" 라고 계약을 밝혀 놓았다.
> **자가 못 재는 것을 재는 척하지 않는 것이 그 파일의 계약**이라면, 이 정찰도 같은 정직함을 지킨다 —
> **분류기를 고치기 전에는 PMC 를 담으면 안 된다.**

**착수 전제**: ① 부족한 칸이 실제로 생길 것(4단계 목표 상향 또는 재고 소진) ·
② `lib-topic.mjs` 가 생의학 문서를 `예술·문화` 로 보내지 않을 것.

---

## 9. 조사했으나 못 답한 것 (정직성 기록)

- **OAI 총 레코드 수** — `resumptionToken` 에 `completeListSize` 가 없어 **못 셌다.** §6 의 편수는
  전부 E-utilities `<Count>` 이지 OAI 근거가 아니다.
- **API 키 없이 실제 허용 속도** — NCBI 문서상 무키 3 req/s · 유키 10 req/s 이나, **부하를 걸어
  확인하지 않았다**(대량 호출 금지 지침 준수). 정찰 중 총 호출은 60여 회이며 429 는 한 번도 안 받았다.
- **`.txt` 절 제목의 표기 흔들림** — `1 Introduction` · `Introduction` · `Background` ·
  `1 | INTRODUCTION` 4종을 봤으나 **전수 조사는 안 했다.** 수확기는 이 넷을 다 받고,
  **못 찾으면 첫 본문 단락으로 떨어지게(fallback)** 짜야 한다.
- **`review[filter]`** — 존재하지 않는 필터다(Count 0). 종설만 고르는 방법은 **못 찾았다.**
  `[pt]` 도 db=pmc 에선 무시된다. 종설 선별이 필요하면 별도 조사가 필요하다.
- **버전 접미사** — S3 키가 `.1` 이 아닌 논문(개정판 `.2` 등)의 비율을 **안 셌다.**
  표본 20편은 전부 `.1` 이었다. 수확기는 `metadata/` 목록으로 최신 버전을 확인해야 한다.

---

## 10. 수확기를 짠다면

### 본뜰 것

**`scripts/csat/harvest-plos.mjs`** 를 거의 그대로 따른다 — **API 형**이고, 무엇보다
**"적재하기 전에 채점한다"** 는 계약이 그대로 성립한다(S3 `.txt` 가 본문을 주므로).
`lib-fit.mjs` · `lib-topic.mjs` · `cleanBody` · dedup · 몫 계산은 **전부 재사용**한다.

⚠️ **다른 점 하나** — PLOS 는 Solr 한 번에 본문까지 오지만, PMC 는 **2단계**다
(esearch 로 id 목록 → S3 로 본문). 대신 **글마다 HTML GET 하는 게 아니라** 200건 목록 1회 +
본문 200회(작은 정적 파일)라, PLOS 이전 구조가 가진 "글마다 GET" 문제와는 다르다.

| 계층 | PLOS | **PMC** |
|---|---|---|
| 목록 | Solr `fl=body` (본문 포함) | esearch (id 만) |
| 본문 | 같은 응답 | S3 `.txt` 건당 GET |
| 라이선스 | 소스 단일값 CC BY | **항목별 `license_code`** |
| 커서 | `cursorMark` | **`[edat]` + WebEnv** |

### 파일 배치

```
scripts/csat/harvest-pmc.mjs                  ← 신규 (harvest-plos.mjs 를 본뜬다)
scripts/csat/data/pmc-harvest-cursor.json     ← 커서 (plos-harvest-cursor.json 과 같은 자리)
```

### 스케치

```js
const TERM = [
  '("cc by license"[filter] OR "cc0 license"[filter])',   // 변형·상업 가능한 것만
  'AND "open access"[filter]',
  'NOT PLoS*[Journal]',                                    // PLOS 중복 1겹
  `AND ${cursor.edatFrom}:${cursor.edatUntil}[edat]`,      // 증분 커서
].join(' ')

// 1) 선택 — WebEnv 로 결과를 얼린다
const { webEnv, queryKey, count } = await esearch(TERM, { usehistory: 'y' })
for (let start = 0; start < Math.min(count, MAX); start += 200) {
  const ids = await esearchPage({ webEnv, queryKey, retstart: start, retmax: 200 })

  // 2) 수령 — S3. JATS 를 파싱하지 않는다
  for (const id of ids) {
    const meta = await getJson(`${S3}/metadata/${id}.${ver}.json`)
    if (meta.is_retracted) continue                        // 철회 논문은 여기서 걸린다
    if (!['CC BY', 'CC0'].includes(meta.license_code)) continue   // 항목별 재확인(질의를 믿지 않는다)
    if (meta.doi?.startsWith('10.1371/')) continue         // PLOS 중복 2겹 — prefix 는 안 바뀐다

    const text = cleanBody(bodyOf(await getText(meta.text_url)))
    if (text.length < 800) continue

    // 3) 적재 전 채점 — PLOS 와 같은 자
    const fit = scoreArticle(text)
    if (fit.pass <= 0) continue
    const tp = classify(text.slice(0, 6000))
    if (quota[tp.topic] <= accepted[tp.topic]) continue

    rows.push({
      source_id: `pmc:${meta.pmcid}`,                      // pmcid 는 null 이 안 된다
      source_url: `https://pmc.ncbi.nlm.nih.gov/articles/${meta.pmcid}/`,
      license: meta.license_code,                          // ⚠️ 소스 단일값이 아니다 — 항목별로 적는다
      csat_fit: { ...fitRecord(text), topic: tp.topic },
    })
  }
}
```

### 몇 번에 나눠 돌릴지

유입이 **하루 약 1,750편**(CC BY 기준 실측)이므로, 재고를 훑는 초기 확보와 이후 증분을 나눈다.

| 구간 | 창 | 예상 후보 | 적합 50% | 회당 |
|---|---|---:|---:|---|
| 초기 확보 | `[edat]` 최근 → 과거로 30일씩 | 회당 약 52,000 | 약 26,000 | **`--max 300` 로 상한**을 걸고 10회 |
| 이후 증분 | 지난 커서 → 오늘 | 일 1,750 | 약 875 | 1회 |

⚠️ **`--max` 상한을 반드시 건다.** PLOS 때의 교훈 그대로 — 저장 비용이 편당
**본문 26.2 KB + 파생 어휘 92.3 KB** 라, 상한이 없으면 한 번 돌릴 때 몫만큼 들어간다.
그리고 §8 대로 **지금은 몫이 0 이므로, 이 표는 조건이 갖춰진 뒤에야 의미가 있다.**

### 재실행 안전

- 기본 **읽기 전용** — `--commit` 없이는 아무것도 쓰지 않는다 (PLOS 와 동일)
- `source_id`(`pmc:PMC…`) 대조로 이미 있는 것은 건너뛴다 — **커서를 지워도 중복이 안 생긴다**
- 재시도: 지수 백오프 4회. **NCBI 는 남의 서버이고 한 번 끊기는 것은 정상이다**
  (`harvest-plos.mjs` 가 `UND_ERR_CONNECT_TIMEOUT` 으로 58쪽을 통째로 잃은 전례)
- ⚠️ **`tool=` 과 `email=` 파라미터를 붙인다** — NCBI 가 요구하는 식별이며,
  없으면 차단 시 연락 없이 막힌다

### 이 머신에서의 함정 (실측)

정찰 중 node 의 `fetch()` 로 S3 를 부르니 **응답 없이 멈췄다.** 같은 URL 이 `curl` 로는 즉시 온다 —
메모리에 기록된 **Node TLS ALPN 문제**와 같은 증상이다. 수확기를 이 머신에서 돌린다면
`fetch` 가 아니라 **`curl` 서브프로세스**를 쓰거나, 다른 머신에서 돌린다.
(`harvest-plos.mjs` 는 `api.plos.org` 에 `fetch` 로 붙으므로 호스트별로 다르다 — **PMC 에서 처음 걸렸다.**)
