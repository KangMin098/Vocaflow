<!-- docs/reports/source-probe/preprints.md -->
# 프리프린트 5곳 확보 정찰 (OSF · PsyArXiv · SSRN · bioRxiv · medRxiv)

정찰 일자 **2026-09-07** · 규격 [SPEC.md](./SPEC.md) · 표본 5편 · DB 미기록 · 대량 수확 없음.

## 곳별 요약

| 소스 | 판정 | 확보 가능 편수(실측) | 라이선스 | 전문 | 안정 식별자 | 증분 커서 |
|---|---|---|---|---|---|---|
| **bioRxiv** | **채택** | 6,670 (EPMC `SRC:PPR PUBLISHER:"bioRxiv" OPEN_ACCESS:Y` 중 cc by 6,556 + cc0 114) | 항목별 · CC BY / CC0 만 채택 · 변형 **가능** | **온다** — Europe PMC JATS XML | DOI (`10.1101/…`·`10.64898/…`) + EPMC `PPR` id | 날짜 창 (`FIRST_PDATE:[a TO b]`) + `cursorMark` |
| **medRxiv** | **채택** | 5,624 (같은 질의 medRxiv · cc by 5,493 + cc0 131) | 항목별 · 동일 | **온다** — Europe PMC JATS XML | DOI + `PPR` id | 동일 |
| **PsyArXiv** | **보류** | 63,559 중 CC BY/CC0 **95%** ≈ 60,000 (표본 100편) | 항목별 · CC BY 85 · CC0 10 · No license 5 | **PDF 만** (JATS 없음) | OSF GUID (`f2srv_v1`) — DOI 는 **4% 만 채워짐** | `filter[date_published][gte/lt]` 1일 창 |
| **OSF Preprints (전체)** | **보류** | 200,892 중 CC BY/CC0 **89.5%** ≈ 179,000 (표본 200편) | 항목별 · CC BY 158 · CC0 21 · 나머지 21(ND·NC·AFL·무라이선스) | **PDF/DOCX 만** | OSF GUID — DOI 4% | 동일 |
| **SSRN** | **반려** | 못 셌다 — 호출이 막혔다 | 기본 "no reuse"(CC 없음) | 확인 불가 | — | — |

**목표 표 24·66위 합계 550편**은 bioRxiv+medRxiv 만으로 **12,294편의 CC BY/CC0 전문 모집단**에서 뽑으면
채택률 5%만 나와도 채워진다. 병목은 공급이 아니라 §7 지문 적합성이다.

---

## 1. 대량 접근 경로 (실측 호출)

### bioRxiv / medRxiv — 두 겹으로 쓴다

`api.biorxiv.org` 는 **목록·라이선스**를 주고, **전문은 안 준다**. 전문은 Europe PMC 가 준다.

```
# ① 목록 + 라이선스 (무인증, 날짜 구간)
GET https://api.biorxiv.org/details/biorxiv/2026-08-01/2026-08-02/0        → 200, total 109
GET https://api.medrxiv.org/details/medrxiv/2026-08-01/2026-08-02/0        → 200, total 57

# ② 전문 (Europe PMC)
GET https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=SRC:PPR%20AND%20PUBLISHER:%22bioRxiv%22%20AND%20OPEN_ACCESS:Y%20AND%20LICENSE:%22cc%20by%22&format=json&resultType=core
GET https://www.ebi.ac.uk/europepmc/webservices/rest/PPR1216936/fullTextXML → 200, 118 KB, <body> 있음
```

⚠️ **bioRxiv API 가 주는 `jatsxml` URL 은 안 열린다.** 실측 2건 모두 **404**
(`https://www.biorxiv.org/content/early/2026/08/01/2026.07.31.741971.source.xml`, medRxiv 쪽도 동일).
그 필드를 보고 "전문이 온다"고 적으면 틀린다 — 전문 경로는 **Europe PMC 뿐**이다
(또는 AWS `biorxiv-src-monthly` requester-pays 버킷, 결제 수단 필요 → 쓰지 않는다).

### OSF / PsyArXiv — 같은 API 의 provider 필터

PsyArXiv 는 독립 API 가 아니라 OSF 의 provider 하나다.

```
GET https://api.osf.io/v2/preprints/?page[size]=100&embed=license          → 200, links.meta.total 200,892
GET https://api.osf.io/v2/preprints/?filter[provider]=psyarxiv&…           → 200, total 63,559
GET https://api.osf.io/v2/files/6a9e3190630503f9c8d1e39d/                  → 200, name "manuscript.pdf"
GET https://osf.io/download/6a9d31f51d71042fb03dbb81/                      → 200, 469,994 B (PDF)
```

⚠️ **`embed=primary_file` 은 502 를 낸다** — `page[size]=100` · `page[size]=20` · 단건
(`/preprints/<id>/?embed=primary_file`) 셋 다 502. `embed=license` 는 100건까지 정상.
그래서 파일은 `relationships.primary_file.links.related` 를 **항목마다 한 번 더 호출**해야 한다(항목당 2 요청).

### SSRN — 막혔다 (우회하지 않았다)

```
GET https://api.ssrn.com/content/v1/bindings?index=0&count=5   → 403  Cloudflare "Just a moment..."
GET https://www.ssrn.com/index.cfm/en/                          → 403  동일
GET https://papers.ssrn.com/sol3/papers.cfm?abstract_id=…       → 403  동일
GET https://www.ssrn.com/robots.txt                             → 200
```

`robots.txt` 는 `GPTBot` · `ChatGPT-User` · `Google-Extended` 를 **전면 `Disallow: /`** 로 막고 있다 —
기계 수집 의사가 명시적으로 부정적이다. Cloudflare 챌린지는 **우회하지 않았다.**
Europe PMC 에 SSRN 레코드가 17,659건 있으나 그중 전문 보유는 **2,057건**뿐이고
그마저 SSRN 이 아니라 저널 측 경로다. **반려.**

---

## 2. 전문(full text)이 오는가

| | 형식 | 실측 |
|---|---|---|
| bioRxiv / medRxiv | **JATS XML** | `<body>` 존재 · 70어 이상 문단 **34~38개**/편. xref 를 지운 뒤 문단이 그대로 산문이 된다 |
| PsyArXiv / OSF | **PDF** (표본 10편 중 pdf 9 · docx 1) | `pdftotext` 로 추출됨 (6쪽에 1,350~1,442어) |
| SSRN | 확인 불가 (403) | — |

**PDF 경로의 실제 손상 3종** (표본에서 직접 확인):

- 쪽마다 러닝 헤더가 본문에 섞인다 (`FAMILY AND SCHOOL CONNECTEDNESS` + 쪽번호가 문단 사이에 삽입).
- 표가 통째로 본문에 쏟아진다 (`M (SD) SPQ Total IOR ESA … 15.28 (10.37) 2.22 (1.91) …`).
- **인코딩**: 기본 옵션이면 `1994<?>1995` · `Family <?> School` · 그리스 문자 소실.
  **`pdftotext -enc UTF-8`** 로 `1994–1995` 복구됨 — 이 플래그가 없으면 낱말이 조용히 망가진다.

JATS 경로에도 흠이 하나 있다 — `<xref>` 를 지우면
`…co-occurrences than the general population., One less-studied…` 처럼 **구두점이 남는다**(`.,`·연속 `–`).
인용 제거 뒤 구두점 정규화가 필수다.

---

## 3. 라이선스 — 항목마다 다르다 (이 정찰의 핵심)

**어느 곳도 소스 단위 라이선스가 없다. 전부 항목별 필드를 읽어야 한다.**

### bioRxiv / medRxiv — `license` 필드 (api.biorxiv.org)

2026-08-01~02 실측:

| 값 | bioRxiv (n=30) | medRxiv (n=57) | 쓸 수 있나 |
|---|---|---|---|
| `cc_by` | 7 | 23 | ✅ 변형 가능 |
| `cc0` | 0 | 2 | ✅ 변형 가능 |
| `cc_by_nc` | 7 | 7 | ❌ 상업 교재 불가 |
| `cc_by_nc_nd` | **13** | 8 | ❌ 변형 금지 |
| `cc_by_nd` | 1 | 2 | ❌ **변형 금지** |
| `cc_no` (라이선스 없음) | 2 | 15 | ❌ |

⚠️ **bioRxiv 의 최빈값은 `cc_by_nc_nd`(43%)이고 쓸 수 있는 것은 23% 뿐이다.**
"프리프린트니까 자유롭게 쓸 수 있다"는 통념이 여기서 깨진다. medRxiv 는 `cc_by` 40% 로 낫다.
Europe PMC 쪽 `license` 필드(`cc by`/`cc by-nc`/…)와 값이 일치하므로 **EPMC 질의문에
`AND LICENSE:"cc by"` 를 넣어 라이선스로 먼저 거르는 것이 가장 싸다** — 위 §요약표의 편수는 이미 걸러진 값이다.

### OSF / PsyArXiv — `embeds.license.data.attributes.name` (`?embed=license`)

| 라이선스 | OSF 전체 (n=200) | PsyArXiv (n=100) |
|---|---|---|
| CC-By Attribution 4.0 | 158 | 85 |
| CC0 1.0 Universal | 21 | 10 |
| No license | 7 | 5 |
| CC BY-NC-ND 4.0 | 6 | 0 |
| Academic Free License 3.0 | 3 | 0 |
| CC BY-NC / BY-SA / BY-ND / BY-NC-SA | 각 1~2 | 0 |
| **쓸 수 있는 비율 (BY+CC0)** | **89.5%** | **95%** |

`?embed=license` 를 붙이지 않은 응답에는 라이선스 **id** 만 온다 —
그때는 `/v2/licenses/<id>/` 를 따로 불러야 한다(실측 확인:
`563c1cf88c5e4a3877f9e96a` → `CC-By Attribution 4.0 International`).
`attributes.license_record` 는 저작권자·연도일 뿐 **라이선스 종류가 아니다** — 이것을 라이선스로 읽으면 틀린다.

### SSRN

SSRN 은 저자 업로드 PDF 에 대해 **기본적으로 CC 를 부여하지 않는다**(사이트 전체 저작권 유보).
항목별 라이선스 필드를 확인할 API 가 없고 접근도 막혀 있다 → 라이선스 확인 자체가 불가능 → **반려.**

---

## 4. 안정 식별자

| 소스 | 필드 | 함정 |
|---|---|---|
| bioRxiv/medRxiv | `doi` (`10.1101/…` 구본, `10.64898/…` 신본) | **버전마다 같은 DOI 에 `version` 이 1,2,3…** 으로 붙는다. `doi` 단독 키는 같은 글을 여러 번 판정하게 만든다 → `doi` 로 dedup 하고 최신 `version` 만 채택 |
| Europe PMC | `id` (`PPR1216936`) | 버전마다 별개 PPR id 가 생길 수 있다 → 최종 키는 DOI |
| OSF/PsyArXiv | **GUID** (`f2srv_v1`) | ⚠️ **DOI 는 표본 300편 중 12편(4%)만 채워져 있었다** — DOI 를 키로 쓰면 96%가 키 없음이 된다. GUID 의 `_vN` 접미사가 버전이므로 **밑동 GUID(`f2srv`)로 dedup + `is_latest_version:true` 만 채택** |

---

## 5. 증분 커서

**bioRxiv/medRxiv**: 날짜 구간이 URL 경로에 박힌다(`/details/<server>/<from>/<to>/<cursor>`) —
`messages[0].total` 이 구간 총계, `cursor` 가 30 단위 오프셋. 구간이 고정이면 페이지네이션이 안정적이다.
Europe PMC 쪽은 `FIRST_PDATE:[2026-08-01 TO 2026-08-31]` + **`cursorMark`**(Solr 커서 → 중복·누락 없음).

**OSF/PsyArXiv**: ⚠️ **`sort` 파라미터가 듣지 않는다.** 실측 —
`sort=date_published` 와 `sort=-date_published` 가 **같은 순서**를 돌려줬다(둘 다 최신 2026-08-07부터).
SPEC §5 가 경고한 「정렬 없는 페이지네이션」 상황 그대로다(2026-08-16 IA 사고와 동형).
→ **정렬에 기대지 않는다.** `filter[date_published][gte]` / `[lt]` 로 **하루 창**을 잘라
한 창을 한 페이지(`page[size]=100`)에 담는다. PsyArXiv 는 1주 창이 **278편**(≈40편/일)이므로
하루면 100 안에 들어와 **페이지네이션 자체가 필요 없다.** 커서 파일에는 「마지막으로 끝낸 날짜」만 적는다.

---

## 6. 현실적 확보 가능 편수 (정찰로 센 값)

| 질의 | 실측 |
|---|---|
| OSF 전체 preprints `links.meta.total` | **200,892** |
| PsyArXiv `filter[provider]=psyarxiv` | **63,559** |
| bioRxiv 2026-01-01~09-06 신규 | **36,366** (구간 total 50,074) |
| EPMC `PUBLISHER:"bioRxiv" HAS_FT:Y` | 19,723 |
| EPMC bioRxiv OA + **cc by** | **6,556** (+ cc0 114) |
| EPMC `PUBLISHER:"medRxiv" HAS_FT:Y` | 21,829 |
| EPMC medRxiv OA + **cc by** | **5,493** (+ cc0 131) |
| EPMC 프리프린트 전체 OA + cc by | 41,895 |
| EPMC `PUBLISHER:"PsyArXiv"` | 64,418 — 그러나 `HAS_FT:Y` 는 **1,436**(2.2%) |
| EPMC `PUBLISHER:"SSRN"` | 17,659 — `HAS_FT:Y` **2,057** |
| EPMC `PUBLISHER:"Open Science Framework"` | **0** |

**읽는 법 두 가지.**
① PsyArXiv 를 Europe PMC 로 가져오려 하면 **2.2% 밖에 못 가져온다** — PsyArXiv 전문은 OSF PDF 경로뿐이다.
② 「CC BY/CC0 + 전문 XML」을 모두 만족하는 프리프린트는 bio+med 합쳐 **12,294편**.
목표 550편 대비 **22배**이므로 라이선스·적합성으로 걸러도 목표는 달성 가능하다.

---

## 7. 지문 적합성 표본 판정 (5편)

`scripts/csat/gate-article-drain/JUDGING.md` 어휘 사용.

| # | 소스 | 글 | 판정 | 이유 |
|---|---|---|---|---|
| 1 | bioRxiv (EPMC PPR1216936, cc by) | Synthetic lumen rounding directs neural progenitor… | **reject** | 전문 용어 밀도가 지문 한계를 넘는다 (`organoids`·`neuroepithelial`·`radial glial`·`abventricular` 가 한 문단에 몰림). 300어로 잘라도 배경 지식 없이는 못 읽는다 |
| 2 | medRxiv (EPMC PPR1308921, cc by) | Does genetic liability for autism influence alcohol use? | **경계(보류)** | 도입 첫 문단은 평이하나 두 번째 문단부터 `LDSC`·`polygenic score`·`genetic correlation` 이 나온다. **도입 1문단만** 쓰면 use 가능 |
| 3 | PsyArXiv (f2srv_v1, cc by) | Hasty Decision-Making, Trust and Schizotypy | **use (가공 후)** | 설명·논증문 · 자족적. 다만 `(Fett et al., 2011; Green et al., 2015)` 형 인용이 문장마다 붙어 **인용 제거 없이는 지문이 안 된다** |
| 4 | PsyArXiv (n7hwm_v1, cc by) | Family and School Connectedness → Depressive Symptoms | **use (가공 후)** | 청소년·가족·학교라는 **고교생이 아는 소재** + 논증 구조가 뚜렷. 초록은 통계치 범벅이라 못 쓰고 **도입부**가 지문감 |
| 5 | OSF 전체 (rgz9t_v2, cc by) | Religious Leaders and Distributive Politics in Postwar Italy | **use (가공 후)** | 사회과학 논증문. 계량경제 용어(`difference-in-differences`)가 나오는 절은 잘라야 함 |

**요약: 5편 중 use 3 · 경계 1 · reject 1.** 채택률 추정 **40~60%**(심리·사회과학),
**5~15%**(bio/med 생명과학). 목표 550편이면 **PsyArXiv·OSF 사회과학 쪽이 실은 더 효율적**인데,
그쪽은 전문이 PDF 라 추출 비용이 든다 — 이것이 이 정찰의 진짜 교환 관계다.

### 프리프린트 특유의 문제 — 동료심사 전

**이것이 이 5곳을 다른 소스와 다르게 취급해야 하는 유일한 이유다.** 판단은 다음과 같다.

1. **교재 지문으로서의 위험은 생각보다 낮다.** 수능·교재 지문은 「그 주장이 참인가」를 묻지 않고
   **「이 글이 무엇을 말하는가」**를 묻는다. 지문에 실린 논증의 내부 정합성만 있으면 문항은 성립한다.
   PLOS(동료심사 완료)와 달리 프리프린트는 **철회·수정 이력이 표면에 없다**는 점만 다르다.
2. **그러나 실패 모드가 하나 있다 — 사실 주장을 뽑아 쓰는 순간.** 「연구에 따르면 X 다」 형태로
   지문이 수치를 단언하면, 그 프리프린트가 나중에 반증·철회되었을 때 교재가 틀린 것을 가르친다.
   → **완화책**: 표본 4번처럼 **도입부(선행연구 개관·문제 제기)만** 쓰고 결과·수치 절은 버린다.
   도입부는 이미 출판된 문헌의 요약이라 프리프린트 고유의 미검증 주장이 없다.
3. **의학(medRxiv)은 한 겹 더 위험하다** — 건강 조언으로 읽힐 수 있는 문장은
   동료심사 전 단계에서 특히 위험하다. medRxiv 는 **결과·권고 절을 통째로 제외**하는 규칙을 둔다.
4. **버전 드리프트**: 같은 DOI 의 v1 과 v3 은 결론이 뒤집힐 수 있다. 채택 시
   **버전 번호와 수확 일자를 함께 기록**하고, 재수확에서 버전이 올라간 항목은 재판정 대상으로 표시한다
   (OSF 는 `is_latest_version`, bioRxiv 는 `version` 필드가 이미 있다).
5. **동료심사 통과 여부를 공짜로 아는 길이 있다**: bioRxiv/medRxiv 는 `published` 필드에
   저널 게재 DOI 가 채워진다(미게재는 `"NA"`). **`published != "NA"` 인 항목을 우선 채택**하면
   프리프린트 위험이 사실상 사라진다. 이 필터는 편수를 크게 줄이므로 목표 550편 범위 안에서만 쓴다.

---

## 수확기를 짠다면

**`scripts/csat/harvest-plos.mjs` 를 본뜬다**(API 형 · 커서 파일 · 라이선스 필드 검사가 이미 있다).
두 갈래를 별도 스크립트로 짠다 — 형식이 달라 한 파일에 합치면 둘 다 지저분해진다.

### ① `scripts/csat/harvest-preprints-epmc.mjs` (bioRxiv + medRxiv) — 먼저 짠다

- 질의: `SRC:PPR AND PUBLISHER:"<server>" AND OPEN_ACCESS:Y AND (LICENSE:"cc by" OR LICENSE:"cc0") AND FIRST_PDATE:[<from> TO <to>]`
- 페이지네이션: **`cursorMark`**(Solr) · `pageSize=100`. 정렬 없는 오프셋 페이지네이션 금지.
- 전문: `/{PPR_ID}/fullTextXML` → `<body>` 만 취해 `<xref>` 제거 → **구두점 정규화**(`.,` → `.`, 연속 `–` 제거) → `<sec>` 단위로 자른다.
- 절 필터: `Introduction`/`Background`/`Discussion` 만 채택. `Methods`·`Results`·`Supplementary` 는 버린다(표·통계 범벅).
- medRxiv 는 결과·권고 절 제외 규칙을 코드에 박는다(§7-3).
- 커서: `scripts/csat/data/preprint-epmc-cursor.json` — `{ "biorxiv": {"lastDate":"…","cursorMark":"…"}, "medrxiv": {…} }`.
- 분할: 라이선스 통과분 12,294편 → **월 단위 창 × 약 60회**. 한 번에 1개월씩.
- 재실행 안전: DOI 로 dedup, 이미 있는 DOI 는 `version` 이 올랐을 때만 재처리.

### ② `scripts/csat/harvest-preprints-osf.mjs` (PsyArXiv + OSF) — 뒤에 짠다

- 목록: `/v2/preprints/?filter[provider]=<p>&filter[date_published][gte]=D&filter[date_published][lt]=D+1&page[size]=100&embed=license`
- **`embed=primary_file` 을 쓰지 말 것 (502).** 파일은 `relationships.primary_file.links.related` 를 항목마다 따로 호출.
- 라이선스 게이트: `embeds.license.data.attributes.name` 이 `CC-By Attribution 4.0 International` 또는
  `CC0 1.0 Universal` 일 때만 내려받는다. **다운로드 전에 거른다** — 11%가 못 쓰는 라이선스다.
- 전문: `https://osf.io/download/<file_id>/` → **`pdftotext -enc UTF-8 -nopgbrk`** →
  러닝 헤더(쪽마다 반복되는 줄) 제거 → 표 블록(숫자·괄호 비율이 높은 줄) 제거 → 인용 `(Author et al., YYYY)` 제거.
- `.docx` 는 표본 10편 중 1편 — 1차에서는 **건너뛴다**(별도 경로).
- 식별자: 밑동 GUID(`_vN` 제거) · `is_latest_version` 만.
- 커서: `scripts/csat/data/preprint-osf-cursor.json` — `{ "psyarxiv": "2026-08-07", "osf": "…" }`(마지막으로 끝낸 날짜).
- 분할: **하루 창**. PsyArXiv 40편/일 → 1일 = 1페이지. 한 번에 30일씩, 약 12회면 1년치.
- 요청량 주의: 항목당 목록 1 + 파일메타 1 + 다운로드 1 = **3요청**. OSF 는 100건 embed 에서도 502 를 내므로
  **동시성 1~2 · 요청 사이 간격**을 둔다.

### ③ SSRN — 짜지 않는다

접근이 Cloudflare 로 막혀 있고 `robots.txt` 가 기계 수집을 명시적으로 거부한다.
라이선스도 기본 유보다. **우회 시도 없이 반려로 닫는다.**

---

## 확인하지 못한 것 (정직 기록)

- **SSRN 의 전문·라이선스**: 403 으로 한 건도 못 봤다. "PDF 가 온다/안 온다"를 적지 않는다.
- **AWS `biorxiv-src-monthly`(requester-pays) 실제 크기·비용**: 결제 수단이 필요해 호출하지 않았다.
- **OSF 의 `.docx` 비율**: 표본 10편에서 1편이었을 뿐 — 전수 비율은 못 셌다.
- **`published != "NA"` 필터 통과 편수**: 세려면 대량 조회가 필요해 이번 단계에서는 세지 않았다.
