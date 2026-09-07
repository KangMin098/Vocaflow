<!-- docs/reports/source-probe/nature-oa-bmc.md -->
# Nature Communications · Scientific Reports (+ BMC · Cogent OA) 확보 정찰

| | |
|---|---|
| 판정 | **채택 — 단, 3개 저널은 별도 소스가 아니라 「PMC 경로 하나」로 흡수** (Cogent 만 **반려**) |
| 확보 가능 편수 | 실측 **325,163편** (CC BY × Europe PMC 안에 실재. NatComm 68,010 · SciRep 229,110 · BMC Public Health 28,043) — 목표 1,100 의 **295배** |
| 라이선스 | **항목별로 다르다.** CC BY 는 변형 **가능**, 그러나 NatComm 의 **17.9%(16,283편)** · SciRep 의 **22.3%(68,289편)** 가 **CC BY-NC-ND = 변형 불가**. `LICENSE:"cc by"` 필터가 **필수** |
| 전문 | **온다** — JATS XML 전문 (표본 5편 78–241 KB, HTTP 200) |
| 안정 식별자 | `pmcid` (PMC12209421) 주키 · `doi` 보조키 — 둘 다 항목마다 고정 |
| 증분 커서 | `FIRST_PDATE:[YYYY-MM-DD TO YYYY-MM-DD]` + `nextCursorMark` (Solr 커서 — 정렬 결정적, 2026-08-16 IA 사고 유형 없음) |
| 정찰 일자 | 2026-09-07 |

---

## 이 정찰의 핵심 질문에 먼저 답한다 — **PMC 로 흡수된다 (99.2~99.6%)**

목표 표가 이 셋을 서로 다른 소스로 세고 있으나, **셋 다 같은 문 하나로 들어온다.**

| 저널 | 총 레코드 | Europe PMC 안 | CC BY | **CC BY ∧ IN_EPMC** | 흡수율 |
|---|---|---|---|---|---|
| Nature Communications | 91,122 | 85,638 (94.0%) | 68,564 | **68,010** | **99.2%** |
| Scientific Reports | 306,112 | 297,975 (97.3%) | 230,222 | **229,110** | **99.5%** |
| BMC Public Health | 33,982\* | 33,982 | 28,163 | **28,043** | **99.6%** |

\* BMC Public Health 는 `IN_EPMC:Y AND OPEN_ACCESS:Y` 기준. **BMC 계열 전체는 못 셌다** — 아래 §6.

즉 **Springer Nature 전용 수확기를 짤 이유가 없다.** 저널명 하나만 바꿔 넣는
`JOURNAL:` 파라미터가 세 소스를 전부 대신한다. 목표 표에서 18·21위를 각각의 행으로 남기되,
**구현은 한 스크립트 · 커서도 하나**여야 한다 — 그러지 않으면 같은 PMCID 를 세 번 판정한다.

---

## 1. 대량 접근 경로 — Europe PMC REST (키 없음)

실제로 호출한 것:

```
GET https://www.ebi.ac.uk/europepmc/webservices/rest/search
      ?query=JOURNAL:"Nature Communications" AND LICENSE:"cc by" AND IN_EPMC:Y
      &format=json&resultType=core&pageSize=25&cursorMark=*
→ 200 · hitCount 68010 · nextCursorMark "AoIIP8YlPSg1MjM1MjcyNA=="
```

```
GET https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11785988/fullTextXML
→ 200 · 241,721 bytes · <license> 요소 포함 · <sec> 6개
```

**API 키·등록·서명 전부 불필요.** 표본 5편 전부 200.

### 막힌 것 두 개 (실측)

| 경로 | 결과 |
|---|---|
| **Springer Nature OA API** `api.springernature.com/openaccess/json` | **401** — `"API key is invalid or missing"`. 무료 키 발급은 가능하나 **이 정찰에서는 못 뚫었다**. 뚫어도 이 API 는 초록+메타를 주지 JATS 전문을 주지 않는다 → EPMC 보다 나쁜 경로 |
| **PMC 레거시 FTP 벌크** `ftp.ncbi.nlm.nih.gov/pub/pmc/oa_comm/` | **404**. `readme.txt` 실측: *"All legacy files for the PMC Article Datasets are in the process of being removed from the FTP Service"* (2026-08-25 갱신). 남은 것은 `PMC-ids.csv.gz` 뿐 |

레거시 FTP 를 대신하는 것은 **AWS Open Data 버킷**이다 — 로그인 없이 목록·GET 가능:

```
GET https://pmc-oa-opendata.s3.amazonaws.com/?list-type=2&delimiter=/&max-keys=20
→ 200 · <Prefix>PMC10000000.1/</Prefix> … PMCID 단위 prefix
```

다만 `oa_comm/xml/metadata/csv/oa_comm.filelist.csv` 는 **404**(구 경로). 벌크가 필요할 만큼
많이 가져올 일이 아니므로(목표 1,100편) **REST 하나로 충분하다** — S3 는 기록만 남긴다.

## 2. 전문(full text) — 온다

표본 5편 모두 `fullTextXML` 200. `<body>` 안에 `Introduction`/`Background` 절이 통째로 있다.

| PMCID | 저널 | XML 크기 |
|---|---|---|
| PMC11785988 | Nat Commun | 242 KB |
| PMC12209421 | Nat Commun | 219 KB |
| PMC12209464 | Nat Commun | 158 KB |
| PMC12188667 | BMC Public Health | 117 KB |
| PMC12205038 | Sci Rep | 78 KB |

PLOS Solr 처럼 **목록 응답에 본문이 실려 오지는 않는다** — 목록 1회 + 편당 XML GET 1회다.
1,100편이면 GET 약 1,150회. `harvest-plos.mjs` 머리말이 지적한 "편당 GET" 비효율이 여기서는
되살아나지만, 규모가 5만이 아니라 1천대라 문제가 되지 않는다.

## 3. 라이선스 — ⚠️ **항목별로 다르다. 이 정찰의 두 번째 발견**

`resultType=core` 응답에 **`license` 필드가 항목마다 온다**. 2025-01 Nature Communications
연속 3편 실측:

| PMCID | license |
|---|---|
| PMC11785988 | `cc by` |
| PMC11785801 | **`cc by-nc-nd`** |
| PMC11785995 | **`cc by-nc-nd`** |

**"Nature Communications 는 CC BY" 는 틀린 문장이다.** 전수 집계:

| 저널 | `cc by` | `cc by-nc-nd` (**변형 금지**) | `cc0` |
|---|---|---|---|
| Nature Communications | 68,564 | **16,283 (17.9%)** | 0 |
| Scientific Reports | 230,222 | **68,289 (22.3%)** | — |
| BMC Public Health | 28,163 | — | — |

저널 단위로 수확하면 **다섯 편 중 한 편이 변형 금지 저작물**이다. 지문은 300어대로 **잘라
쓰는** 것이므로 ND 는 곧바로 위반이다. 따라서 질의에 `LICENSE:"cc by"` 를 **항상** 넣고,
적재기는 응답의 `license` 값을 그대로 행에 남겨 **나중에 되짚을 수 있게** 해야 한다.
(NatComm 은 `cc0` 이 0건 — CC0 를 기대하지 말 것.)

`Author Correction`·`Publisher Correction` 도 섞여 있다 — CC BY 68,564 중 **2,794편**이
정정문이다(`NOT TITLE:"Author Correction" NOT TITLE:"Publisher Correction"` → 65,770).
이것들은 본문이 두세 문단이라 지문이 못 된다. 질의에서 미리 뺀다.

## 4. 안정 식별자 — `pmcid`

`pmcid`(`PMC12209421`)가 EPMC·NCBI·AWS S3 세 경로에서 같은 값이다. `doi`
(`10.1038/s41467-025-56221-1`)도 항목마다 온다. 기존 PLOS 적재가 `source_id` 로 dedup 하므로
`source_id = pmcid` 로 두면 커서를 지워도 중복이 안 생긴다(`harvest-plos.mjs` 와 동일 구조).

## 5. 증분 커서 — `FIRST_PDATE` 범위 + `nextCursorMark`

응답에 `nextCursorMark` 가 항상 실려 온다(실측값 `AoIIQCTC+ig1NjA5MTU5NQ==`). Solr 커서라
**정렬이 결정적**이므로 SPEC §5 가 경고한 「정렬 없는 페이지네이션 → 중복+누락 동시 발생」
(2026-08-16 IA 214건) 유형의 사고가 구조적으로 안 난다. 여기에 더해
`FIRST_PDATE:[2025-06-01 TO 2025-06-30]` 로 창을 잘라 월 단위로 나눠 돌릴 수 있다
(실측: NatComm 2025-01 한 달 = 1,211건).

## 6. 현실적 확보 가능 편수 — 실측 325,163 (목표의 295배)

`CC BY ∧ IN_EPMC` 합계 **325,163편**(68,010 + 229,110 + 28,043). 목표 1,100편은
**공급 문제가 아니다.**

**BMC 계열 전체는 못 셌다.** Europe PMC 의 `JOURNAL:` 필드는 와일드카드를 안 받는다 —
`JOURNAL:"BMC*"` 는 **0건**, 따옴표 없는 `JOURNAL:BMC*` 는 **367,520건**이 나오는데 이는
토큰 매칭이라 BMC 계열이 아닌 것을 포함한다(신뢰 불가). BMC 는 저널이 250종 이상이므로
**저널명 목록을 먼저 확보한 뒤 저널별로 세야 한다**. 이 정찰에서는 대표 1종
(BMC Public Health)만 실측했다.

### ⚠️ 그런데 편수가 문제가 아니라는 것이 진짜 결론이다

`scripts/csat/harvest-plos.mjs` 머리말이 이미 못 박아 두었다:

> **PLOS 가 못 채우는 칸이 있다** — 예술·문화 · 철학·윤리 · 역사·인류 · 교육·언어.

`docs/reports/csat-source-fit-20260903.md` 도 같다 — **역사·인류 186편(3.5%)이 병목**이다.
**Nature Communications · Scientific Reports · BMC 는 셋 다 STEM·생의학이다.** 즉 이 소스들은
**이미 넘치는 칸에 32만 편을 더 붓는다.** 목표 표의 1,100편을 채우는 것은 30분이면 되지만,
그것으로 **전수 수율이 오르지 않는다.**

빈 네 칸을 채울 수 있었던 유일한 후보는 **Cogent OA** 였다(Education · Social Sciences ·
Arts & Humanities · Psychology · Economics & Finance). 그래서 그쪽을 따로 팠고 — 막혔다.

## 7. 지문 적합성 표본 판정 — 5편 실독 (300어 서론 창)

`gate-article-drain/JUDGING.md` 어휘를 쓴다.

| PMCID | 저널 | verdict | genre | 300어 지문이 되는가 |
|---|---|---|---|---|
| PMC12205038 | Sci Rep | `use` | `nature` | **된다.** 메뚜기 떼 — 고독상/군집상 전환, ㎢당 4,000만~8,000만 마리, 2019–20 동아프리카 피해 85억 달러. 통념→규모→사건으로 논지가 서고 자족적. 학명 `Schistocerca gregaria (Orthoptera: Acrididae)` 만 정리하면 그대로 쓸 수 있다 |
| PMC12209421 | Nat Commun | `use` | `technology` | **된다.** 뇌-컴퓨터 인터페이스 — 침습/비침습 대비 → 기존 방식의 한계(의도와 동작의 불일치) → 이 연구의 물음. 「통념 제시 → 반전 → 물음」 3단이 교과서적이다 |
| PMC12188667 | BMC Public Health | `use` | `health` | **경계.** 건강정보이해력과 2형 당뇨 — 논지는 서나 **약어 죽**이다(DM · CP · T2DM · HL · SE · HB · DR 7종이 300어 안에 들어온다). 풀어쓰기 없이는 못 쓴다 |
| PMC12209464 | Nat Commun | `use` | `climate` | **경계.** 팔레오세-에오세 극열기 — 소재는 수능이 좋아하나 표기가 막는다(`3–6‰ negative carbon isotope excursion` · `2000 to >13,000 Pg C` · `~56 Ma` · `kyr` · CIE/POE/NAIP). 기호 정리 비용이 크다 |
| PMC11785988 | Nat Commun | `use` | `science` | **안 된다.** 생쥐 사지싹 발생 — 차단 장르는 아니지만 SHH·`Msx1+`·BMP/SOX9/WNT Turing system 이 **설명 없이 전제**된다. 글로는 읽히나 고교 지문 난도를 한참 넘는다 |

**요약: 5편 중 차단 장르 0 · 곧바로 쓸 수 있는 것 2 · 정리 후 가능 2 · 난도 초과 1.**
PLOS ONE 대비 **서론이 전문가 독자를 가정해 쓰였다**는 차이가 뚜렷하다 — Nature 계열은
「분야 동료에게 말 거는 서론」이고, 그래서 약어·기호·선행지식 밀도가 높다.
게이트 통과율은 PLOS 보다 **낮게** 잡아야 한다(표본 5편으로는 수치를 못 낸다 — 추정하지 않는다).

---

## Cogent OA — **반려** (라이선스는 깨끗한데 전문 경로가 없다)

| | |
|---|---|
| 판정 | **반려** — 대량 접근 경로 없음 (SPEC §「반려」 3요건 중 3번) |
| 라이선스 | **CC BY** · 변형 **가능** — DOAJ 12종 전부 `CC BY`(Cogent Mental Health 만 `CC BY, CC BY-NC` 병기), Crossref 항목 라이선스도 `creativecommons.org/licenses/by/4.0/` |
| 편수 | DOAJ 실측 6종 합 **14,165편** (Education 3,604 · Social Sciences 2,980 · Economics & Finance 2,396 · Engineering 2,327 · Arts & Humanities 1,883 · Psychology 975). Crossref ISSN 별 총계도 동수(2331-186X → 3,612) |
| 전문 | **안 온다** |

### 왜 반려인가 — 세 경로 전부 실측으로 막혔다

| 경로 | 결과 |
|---|---|
| Europe PMC | `JOURNAL:"Cogent Education"` → **1건**. `JOURNAL:"Cogent*"` → 0건. **PMC 에 없다**(생의학이 아니므로 당연) |
| DOAJ articles API | 200 · 3,604건 — 그러나 **초록만**. `link` 는 tandfonline 랜딩 URL 하나뿐 |
| tandfonline PDF | `doi/pdf/...?download=true` → **403** (`text/html` 5,928 B = Cloudflare 챌린지). 브라우저 UA 를 넣어도 403 |
| tandfonline ePDF | `doi/epdf/...` → 200 이지만 **`text/html` 104,718 B = 뷰어 껍데기**, 본문 텍스트 없음 |
| Crossref TDM | `link` 1개뿐이고 `intended-application: "similarity-checking"` — 표절검사용이라 재사용 근거가 안 된다. 게다가 가리키는 URL 이 위의 403 PDF 다 |
| OpenAlex | `is_oa: true` · `oa_status: gold` · `license: cc-by` 이나 `locations` 어디에도 **`pdf_url` 이 없다** |

⚠️ **함정 기록**: `curl -o /dev/null -w %{http_code}` 로만 보면 ePDF 가 **200** 이라 "뚫렸다" 고
적기 쉽다. 실제로 파일로 저장해 보면 첫 8바이트가 `<!DOCTYP` 다. **`content_type` 을 같이
찍지 않으면 이 소스를 「채택」으로 잘못 적는다.**

### 그럼에도 별도 정찰이 필요한 이유

Cogent 는 **이 저장소가 못 채우고 있는 네 칸(예술·문화 · 철학·윤리 · 역사·인류 · 교육·언어)을
정확히 겨냥하는 유일한 CC BY 후보**다. 14,165편이 라이선스상 전부 사용 가능한데 **HTTP 하나에
막혀 있다.** 안 해 본 경로 셋을 다음 정찰에 넘긴다 — **여기서는 시도하지 않았다(확인 실패)**:
① T&F TDM 협약 / `text-mining` 헤더, ② CORE API(키 필요), ③ 기관 리포지터리 사본
(OpenAlex `any_repository_has_fulltext: true` 라고 답하나 `locations` 에는 안 보였다 — 모순).

---

## 수확기를 짠다면

**새 스크립트를 3개 만들지 않는다. `scripts/csat/harvest-epmc.mjs` 하나다.**

| 항목 | 결정 |
|---|---|
| 본뜰 것 | **`scripts/csat/harvest-plos.mjs`** — 「적재 전 채점, 통과한 것만 적재」 구조를 그대로. `lib-fit.mjs` 의 `fitRecord`·`scoreArticle` 재사용 |
| 다른 점 | PLOS 는 Solr 가 `fl=body` 로 본문을 목록에 실어 주지만 EPMC 는 **목록 1회 + 편당 `fullTextXML` GET 1회**다. 채점은 XML 을 받은 뒤에 한다 |
| 질의 | `JOURNAL:"<저널>" AND LICENSE:"cc by" AND IN_EPMC:Y NOT TITLE:"Author Correction" NOT TITLE:"Publisher Correction"` — **`LICENSE:"cc by"` 를 빼면 변형 금지물 20%가 섞인다** |
| 저널 목록 | 상수 배열 하나 (`Nature Communications` · `Scientific Reports` · BMC 계열 N종). 목표 표 18·21위가 **같은 스크립트의 인자**가 된다 |
| 본문 추출 | JATS `<body>` 에서 `Introduction`/`Background` `<sec>` 만. `<xref>` 는 제거(인용 표시는 기계 규칙이 따로 본다), `<fig>`·`<table-wrap>`·`<disp-formula>` 는 통째로 버린다 — 표본 5편 중 2편이 기호·약어로 걸렸다 |
| 커서 파일 | `scripts/csat/data/epmc-harvest-cursor.json` — `{ journal: { window: "2025-06", cursorMark: "..." } }`. **커서는 최적화일 뿐** — dedup 키는 `source_id = pmcid` |
| 나눠 돌리기 | `FIRST_PDATE` **월 단위**(NatComm 한 달 ≈ 1,200건). 목표 1,100편이면 최근 몇 달이면 끝나므로 1~2회 실행. 전량(32만)은 **돌릴 이유가 없다** |
| 재실행 안전 | `--commit` 없이는 읽기 전용 · `pmcid` 로 DB 대조 후 건너뜀 · 커서 삭제해도 중복 없음 (PLOS 와 동일 계약) |
| 예의 | EPMC 는 키가 없는 대신 속도 제한이 있다. `User-Agent` 에 연락처를 넣고 초당 3회 이하로 |

**하지 않을 것**: Springer Nature OA API 키 발급. 401 을 뚫어도 얻는 것은 메타데이터인데
EPMC 가 같은 것을 키 없이 주고 **전문까지 준다**. 키 관리 비용만 는다.
