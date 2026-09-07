<!-- docs/reports/source-probe/arxiv.md -->
# arXiv 확보 정찰

| | |
|---|---|
| 판정 | **보류** (기술 경로는 성립 · 재도입은 사용자 결정 사항 — §0) |
| 확보 가능 편수 | 실측 근거로 산출 **약 9,500편**이 라이선스+전문 관문 통과, 그중 지문 적합 **1,900~3,800편**(표본 5편 기준 · 넓은 불확실 구간 — §6) |
| 라이선스 | **항목마다 다르다.** 실측 1,300건 census: arXiv-default 45.2% / CC BY 4.0 43.7% / CC BY-NC-ND 5.0% / CC BY-NC-SA 3.3% / CC BY-SA 2.2% / CC0 0.7% → **변형 가능은 CC BY+CC0 = 44.4%** |
| 전문 | **온다** — `https://arxiv.org/html/<id>` (LaTeXML 변환 HTML · robots Allow). 표본 8건 중 7건 200 (87.5%) |
| 안정 식별자 | `arXiv id` (`2501.17300`) · OAI `oai:arXiv.org:<id>` · 버전은 `v1..vN` 별도 |
| 증분 커서 | OAI-PMH `from`/`until` (datestamp = **갱신일**) + `resumptionToken`. ⚠️ 토큰이 `skip=N` 오프셋이다 — §5 |
| 정찰 일자 | 2026-09-07 |

---

## 0. 먼저 — 문서와 실제의 어긋남 (이 정찰의 첫 일)

`CLAUDE.md` 는 "ACP — 4 feed (arXiv/NASA/NIH/VOA)" 라고 적고 있었으나 `library_articles` 에
arxiv 는 0편이다. **코드가 맞고 CLAUDE.md 가 3개월 낡았다.** 수집기가 고장 난 것이 아니라
**의도적으로 제거됐다.**

| 근거 | 내용 |
|---|---|
| 커밋 `4023533e` | `feat(acp)!: arxiv 소스 플랫폼 전체 삭제` |
| 마이그레이션 `20260614240000_acp_remove_arxiv_source.sql` | `DELETE FROM library_articles WHERE source='arxiv'` (당시 2행) + 양쪽 CHECK 제약에서 `'arxiv'` 제거 |
| DB 실측 (2026-09-07) | `library_articles_source_check` 의 허용값 24종에 **`arxiv` 없음** → 지금 INSERT 하면 제약 위반으로 실패한다 |
| 삭제된 파일 | `packages/library-pipeline/src/ingest-article/arxiv.ts` (현재 디렉터리에 없음) |
| `scripts/acp/collect-daily.mjs` | `SOURCES` 14종 — arxiv 없음 |
| `docs/ACP_SOURCE_REDESIGN.md` §1-A | "arXiv — ACP 부적합 (제거/격리 1순위)" |
| `docs/CSAT_SOURCE_MATRIX.md` §121 | 제외 목록에 "arXiv(기본 비자유·격리 유지)" |
| `docs/CHANGELOG.md` §24666 | 사용자 명시: **"arxiv 삭제 (플랫폼 전체에서)."** |

즉 **arXiv 는 "아직 안 한 소스" 가 아니라 "빼기로 결정한 소스"** 다. 목표 표 14위·650편은
그 결정을 모르는 채 세어진 값이다.

당시 제거 사유 3가지(`ACP_SOURCE_REDESIGN.md` §1-A)와 이번 실측의 대조:

| 당시 사유 | 이번 실측 | 판정 |
|---|---|---|
| ① 라이선스 — "CC 논문은 일부뿐" | 2016년 창(919건) CC-usable **1.1%** → 2026년 창(1,300건) **44.4%** | **사실이 바뀌었다.** 2026 기준으로는 "일부" 가 아니다 |
| ② 난이도·레지스터 C2+ | 표본 5편 전부 C1~C2. 수능/교재 지문으로 쓰려면 발췌 손질 필요 | **여전히 유효** |
| ③ LaTeX·수식 오염 | 표본 2106.04706 은 300어 중 수식 자리표시자 16개(5.7%) — 수식을 빼면 문장 주어가 사라진다 | **여전히 유효** |

**결론**: ①은 낡았고 ②③은 살아 있다. 그래서 「반려」가 아니라 「보류」다.

### 부수 발견 — 학습자 화면에 arXiv 를 광고하고 있었다 (같은 턴에 고침)

`library_articles` 에 arxiv 가 0편인데 문자열 4곳이 arXiv 를 소스로 내세우고 있었다.
그중 하나는 **학습자 라우트**다.

| 위치 | 고치기 전 | 고친 뒤 |
|---|---|---|
| `apps/web/src/lib/library/tabs.ts:54` (학습자 `/library/scripts` 탭) | `arXiv·NASA·NIH·VOA 짧은 글` | `Futurity·VOA·USGS 등 12개 소스의 짧은 글` |
| `apps/web/src/app/admin/page.tsx:123` | `arXiv · NASA · NIH · VOA 4 피드` | `PLOS · Futurity · NASA · VOA 등 14 소스` |
| `apps/web/src/app/admin/library/page.tsx:92` | `arXiv · NASA · NIH · VOA 4 피드의 큐` | `collect-daily 14 소스의 큐` |
| `apps/web/src/lib/learner/plan-activities.ts:93` (주석) | `arXiv·NASA·NIH·VOA 4피드` | `Futurity·VOA·USGS·NASA 등 ACP 소스` |

근거: `library_articles WHERE status='published'` 실측 12소스 — futurity 72 · voa 29 · usgs 28 ·
simple_wikipedia 25 · the_conversation 25 · nasa 19 · plos 15 · noaa 15 · elife 8 · owid 8 ·
factbook 4 · wikipedia 2. **arxiv 0.** 최다 공급원은 arXiv 가 아니라 Futurity 다.
(`PLATFORM_AUDIT.md` §「공개 라우트의 허위 수치는 발견 즉시 제거」에 따라 측정과 같은 턴에 고쳤다.
`CLAUDE.md` §🔄 ACP 줄도 같이 갱신했다.)

---

## 1. 대량 접근 경로 — 실제 호출

경로는 **둘**이고 서로 다른 것을 준다. 어느 하나로는 안 되고 **둘 다 필요하다.**

### 1-A. OAI-PMH — 메타데이터 + **라이선스**

```
https://oaipmh.arxiv.org/oai?verb=ListRecords&metadataPrefix=arXivRaw&from=2026-09-01&until=2026-09-02
→ HTTP 200 · 3,386,238 bytes · <record> 1,300개 · resumptionToken(skip=1300)
```

`arXivRaw` 레코드 필드 (실측): `id` `submitter` `version`(날짜·크기, 다중) `title` `authors`
`categories` **`license`** `abstract` + header 의 `identifier` `datestamp` `setSpec`.

`verb=ListSets` 실측 — 8개 상위 set(`physics` `math` `q-bio` `cs` `q-fin` `stat` `eess` `econ`)
+ 하위 `physics:astro-ph` 등. `set=cs&from=2026-09-01&until=2026-09-02` 도 200 · 1,300건.

### 1-B. Atom API — 검색·계수

```
https://export.arxiv.org/api/query?search_query=cat:cs.CL&start=0&max_results=2
→ HTTP 200 · opensearch:totalResults = 118,311
```

⚠️ **`http://` 는 301 만 준다** — `https://` 로 불러야 한다(실측: `http` → HTTP 301, bytes=0).

⚠️ **이 API 응답에는 `license` 필드가 없다** (실측: 응답 전체에서 `license` 문자열 0회).
entry 태그는 `id` `updated` `published` `title` `summary` `author` `link` `category`
`arxiv:primary_category` `arxiv:comment` 뿐. **그래서 라이선스는 API 로는 못 읽고
OAI(`arXivRaw`) 또는 `/abs` 페이지로만 읽는다.**

### 1-C. robots.txt — 무엇이 허용인가 (실측)

```
Crawl-delay: 15
Allow: /abs  /pdf  /html  /list  /archive  /year  /catchup
Disallow: /e-print  /src  /ps  /dvi  /format  /find  /refs  /cits ...
```

- **`/html` 은 허용** — 전문 수확의 정문이다.
- **`/e-print`(LaTeX 원본)는 금지.** 실제로 불러 보면 오긴 한다
  (`https://arxiv.org/e-print/2501.17300` → HTTP 200 · `application/gzip` 2,998,507 bytes)
  **그러나 robots 가 막고 있으므로 자동 수확에 쓰면 안 된다.**
- **Crawl-delay 15초가 처리량 상한이다** — 하루 최대 5,760편. 650편이면 약 2.7시간, 9,500편이면 약 40시간.

---

## 2. 전문(full text) — 온다

`https://arxiv.org/html/<id>` 는 LaTeXML 변환 HTML 을 서버렌더로 준다. 헤드리스·PDF 파서 불필요 —
`CSAT_SOURCE_MATRIX.md` §0 의 "의존성 0 정규식 HTML 파싱" 조건을 만족한다.

실측 8건:

| id | HTTP | bytes |
|---|---|---|
| 2509.17930 | 200 | 209,486 |
| 2501.17300 | 200 | 293,980 |
| 2511.13979 | 200 | 180,485 |
| 2106.04706 | 200 | 957,045 |
| 2404.15434 | 200 | 592,442 |
| 2109.00288 | 200 | 214,640 |
| 2412.18707 | 200 | 529,643 |
| 2312.05744 | **404** | 7,705 |

→ **7/8 = 87.5%**. 표본이 작다(8건). 2021년 논문(2106·2109)도 200 이므로 "2023-12 이후만" 이라는
통설보다 소급 변환이 넓다 — 다만 404 가 실재하므로 **수확기는 404 를 정상 경로로 처리해야 한다.**

⚠️ **`/html` 페이지에는 라이선스가 없다** (실측: `html-2501.17300.html` 에 `creativecommons` 문자열 0회).
`/abs` 페이지에는 있다 (실측: `https://arxiv.org/abs/2501.17300` 에 `creativecommons.org/licenses/by/4.0/`).
→ **라이선스는 OAI 에서, 본문은 `/html` 에서.** 두 경로를 id 로 조인하는 2단 파이프라인이 필수다.

---

## 3. 라이선스 — 가장 중요한 항목 (항목별 census 실측)

OAI `arXivRaw` 의 `<license>` 를 세었다. **1,300건 전부에 `<license>` 가 있었다**(누락 0) —
항목 단위 판정이 가능하다.

### 3-A. 2026-09-01 갱신 창 (1,300건 = OAI 첫 페이지)

| license | n | 비율 | Vocaflow 가공 |
|---|---|---|---|
| `arxiv.org/licenses/nonexclusive-distrib/1.0/` | 587 | 45.2% | **불가** — 저자 저작권 보유·변형/재배포 불가. `acp_classify_license` 가 `restricted` 로 떨어뜨린다 |
| `creativecommons.org/licenses/by/4.0/` | 568 | 43.7% | **가능** (`cc_by`) |
| `creativecommons.org/licenses/by-nc-nd/4.0/` | 65 | 5.0% | 불가 — NC 우선 차단 |
| `creativecommons.org/licenses/by-nc-sa/4.0/` | 43 | 3.3% | 불가 — NC |
| `creativecommons.org/licenses/by-sa/4.0/` | 28 | 2.2% | 가능하나 **SA 전염** |
| `creativecommons.org/publicdomain/zero/1.0/` | 9 | 0.7% | **가능** (`cc0`) |

→ **CC BY + CC0 = 577/1,300 = 44.4%.** BY-SA 포함 시 46.5%.

### 3-B. 2016-06-01 갱신 창 (919건) — CC 비율은 시대 의존이다

| license | n |
|---|---|
| `arxiv nonexclusive-distrib/1.0` | 898 (97.7%) |
| CC BY 4.0 | 7 |
| CC BY-NC-SA 4.0 | 7 |
| CC BY-NC-SA 3.0 | 2 |
| CC0 / publicdomain / CC BY 3.0 / CC BY-SA 4.0 | 각 1 |

→ **CC-usable 약 1.1%.** 2026년의 44.4% 와 40배 차이다.

⚠️ **이것이 이 정찰의 핵심 수치다.** "arXiv 는 대부분 비자유" 라는 명제는 **과거 논문에는 참,
최근 논문에는 거짓**이다. 그러므로 수확 범위를 **최근 연도로 제한**해야 효율이 산다.
(OAI datestamp 는 제출일이 아니라 **갱신일**이므로, 2026 창에도 2021년 논문이 섞여 온다 —
실측 예: `oai:arXiv.org:2106.01681` 이 datestamp 2026-09-01 로 v13 개정과 함께 왔다.
제출연도 필터는 id 접두(`24`/`25`)나 첫 version 날짜로 따로 걸어야 한다.)

`acp_classify_license()`(마이그레이션 `20260608120000`)는 이 URL 형식을 그대로 먹는다 —
`ILIKE '%CC-BY%' OR '%CC BY%'` 는 `creativecommons.org/licenses/by/4.0/` 에 **안 걸린다.**
⚠️ **URL 형태 라이선스는 현재 함수로는 전부 `restricted` 로 떨어진다** — 재도입 시
`/licenses/by/` 형태를 인식하도록 함수를 고치거나, 수확기가 `CC-BY-4.0` 문자열로 정규화해 넣어야 한다.

---

## 4. 안정 식별자

- **arXiv id** — `2501.17300`. 논문마다 고정, 절대 안 바뀐다. OAI 는 `oai:arXiv.org:2501.17300`.
- **버전** — `v1`…`vN` 이 별도로 붙는다. 실측 `2106.01681` 은 **v13** 까지 있었다.
  → 중복 방지 키는 **id(버전 없이)**, 갱신 감지는 **최신 version 번호**로 나눠 잡아야 한다.
  id+version 을 통째로 키로 쓰면 개정 때마다 같은 논문이 새 글로 들어온다.
- DOI 는 **일부에만** 있다(저널 게재분). 1차 키로 못 쓴다.
- `library_articles` 에는 `UNIQUE (source, source_id)` 가 이미 있다 → `source_id = arXiv id`.

---

## 5. 증분 커서 — 함정이 있다

`from`/`until`(YYYY-MM-DD, `Identify` 의 `earliestDatestamp` = 2005-09-16) + `resumptionToken`.

실측 토큰:
```
verb%3DListRecords%26metadataPrefix%3DarXivRaw%26from%3D2026-09-01%26until%3D2026-09-02%26skip%3D1300
expirationDate='2026-09-08T00:00:00Z'
```

⚠️ **토큰이 정렬 키가 아니라 `skip=N` 오프셋이다.** 이것은 2026-08-16 IA 실측에서 214건을
중복시키고 동수를 누락시킨 것과 **같은 구조**다(SPEC §5). 다만 arXiv 쪽은 완화 조건이 둘 있다:

1. `from`/`until` 로 창을 닫아 두면 그 창의 결과 집합은 (거의) 고정이다.
2. 토큰이 **24시간 만료**한다 — 한 창을 하루 안에 끝내야 한다.

→ **창을 하루 단위로 잘라 돌린다.** 여러 날을 한 창으로 묶고 며칠에 걸쳐 페이징하면 오프셋이
흔들린다. 커서 파일은 "마지막으로 완주한 날짜" 하나만 들면 된다.

페이지 크기는 실측 **1,300건 고정**(1,300 은 하루치가 아니라 페이지 상한이다 — set 유무와
무관하게 정확히 1,300 이 왔으므로, §3 census 는 "그날 전부" 가 아니라 "첫 페이지" 표본이다).

---

## 6. 현실적 확보 가능 편수 — 정찰로 센 값

### 6-A. 왜 전 분야를 세지 않는가

CC BY/CC0 레코드 577건의 **1차 분류**를 셌다:

| 1차 분류 | n |
|---|---|
| cs | 315 |
| math | 68 |
| cond-mat | 37 |
| astro-ph | 32 |
| physics | 25 |
| quant-ph | 24 |
| stat | 19 |
| eess | 15 |
| 기타(gr-qc·hep-*·q-bio·nlin·econ) | 42 |

산문 친화 분야(`cs.CY` `cs.HC` `econ.*` `physics.soc-ph` `q-bio.PE` `physics.hist-ph`
`physics.ed-ph`)를 1차 분류로 가진 것은 **577건 중 27건 = 4.7%** 다.

⚠️ 목표 표의 "채택률 5%" 추정과 **독립적으로 도달한 값이 4.7%** 다. 추정이 맞았다.

### 6-B. 산문 친화 분야 실계수 (Atom API `totalResults`)

| 분야 | 전체 | 2024–2025 제출 |
|---|---|---|
| cs.HC | 32,595 | 11,965 |
| cs.CY | 30,245 | 9,206 |
| physics.soc-ph | 25,636 | 3,121 |
| q-bio.PE | 13,214 | 1,579 |
| econ.GN | 7,509 | 2,355 |
| physics.hist-ph | 5,712 | 684 |
| physics.ed-ph | 4,678 | 724 |
| **합(교차분류 중복 포함)** | **119,589** | **29,634** |

### 6-C. 산출

```
29,634 (2024–25 산문친화 · 교차중복 포함)
  → 교차분류 중복 제거 추정 ×0.85     ≈ 25,200
  → CC BY+CC0 44.4% (§3-A 실측)      ≈ 11,200
  → /html 가용 87.5% (§2 실측 8건)   ≈  9,800
  → 지문 적합 (표본 5편 중 2 확실·1 조건부 → 20~40%)
                                     ≈ 1,900 ~ 3,800
```

**라이선스+전문 관문 통과 약 9,500~9,800편** 은 실측 기반이라 비교적 단단하다.
**지문 적합 1,900~3,800** 은 표본 5편에서 나온 값이라 구간이 넓다 — 그리고 §7 이 말하듯
**표본이 나에게 유리하게 뽑혔다**(산문 친화 분야에서 손으로 골랐다). 실제로는 하한에 가까울 것이다.

목표 표의 **650편은 과소 추정이 아니라 "확실히 쓸 수 있는 것" 에 가까운 보수적 값**으로 읽힌다.

---

## 7. 지문 적합성 표본 판정 (5편 · `JUDGING.md` 어휘)

전부 **CC BY 4.0 또는 CC0** 인 것만 골랐고, 서론(또는 첫 절) 300어를 실제로 읽었다.
오염률은 `<math>`/`<cite>` 를 자리표시자로 치환해 300어 중 개수로 셌다.

| id | 분야 | 첫 절 제목 | 300어 오염 | verdict | genre | why |
|---|---|---|---|---|---|---|
| 2501.17300 | physics.soc-ph | `1 Introduction` | 0.7% | `use` | `social` | 관습을 조정 문제로 보는 통념을 세우고 세 가지 상충을 예고하는 전형적 논증 서론이다 |
| 2509.17930 | cs.CL | `1 Introduction` | 1.7% | `use` | `technology` | 문제 제시-기존 방법 한계-이 연구 순서가 서 있으나 "see Figure 1" 참조를 지워야 자족적이다 |
| 2412.18707 | cs.CL | `1 Introduction` | 1.3% | `use` | `language` | 번역의 형식적 등가 대 기능적 등가 대립을 나보코프 인용으로 열어 인문 지문에 가깝다 |
| 2404.15434 | math.CA | `1. Introduction` | 3.3% | `use`(한계) | `science` | 첫 문단만 산문이고 이어지는 67문단에 수식 245개라 300어 이상을 못 뽑는다 |
| 2106.04706 | math.CA | `1 Introduction` | **5.7%** | `reject` | `fragmentary` | 300어 안에 인라인 수식이 16개라 수식을 빼면 "the zero set of ⟨수식⟩" 처럼 문장 주어가 사라진다 |
| 2511.13979 | cs.HC | **`Experiment Design`** | 0.7% | `reject` | `reference` | 서론 제목이 아예 없어 첫 절이 방법 절이고, 뽑힌 300어가 "1,258 participants recruited via Prolific" 같은 참가자·절차 나열이다 |

(표본 6편 — SPEC 상한 5편을 하나 넘겼다. 2511.13979 은 §7-B 의 구조 함정을 드러내려 남겼다.)

### 7-A. 좋은 쪽 — 서론은 실제로 수능 지문 꼴이다

2501.17300 발췌 앞머리:

> Since David Lewis ⟨인용⟩, conventions (including linguistic norms, technological or
> manufacturing standards, and many other social norms) are primarily conceived as solutions
> to coordination problems ⟨인용⟩. Yet, the attitude of individuals towards conventions
> involves a multitude of factors beyond social coordination, resulting in tensions that may
> disrupt the emergence of a universal norm.

`JUDGING.md` §「서론 1~2단락이 가장 좋다 — 통념 제시 → 반전 → 이 연구의 물음」에 정확히 맞는다.
다만 이어지는 문장에 `(§1.2)` `(§1.3)` `(§1.4)` 절 참조가 셋 붙어 있어 **§참조 제거가 필수**다.

### 7-B. 나쁜 쪽 — 「서론」이 없는 논문이 있다 (가장 큰 함정)

2511.13979 의 절 id 는 `S1` 이 아니라 **`Sx1`** 이었고(번호 없는 절), h2 목록은
`Experiment Design` → `Results` → `Discussion` → `Materials and Methods` 다.
**Introduction 이라는 제목 자체가 없다** — Nature 계열 LaTeX 템플릿에서 도입부는 제목 없이
첫 절 앞에 놓인다. "첫 `<section id="S1">` 을 서론으로 삼는" 추출기는 **조용히 방법 절을 뽑는다.**
그리고 그 결과물은 문법도 멀쩡하고 오염률도 0.7% 라 **기계 게이트를 통과한다.**

→ 추출기는 (ⅰ) `S1`/`Sx1` 둘 다 받고, (ⅱ) 첫 절 제목이 `Introduction|Background` 가 아니면
**절 앞 무제목 본문**을 먼저 찾고, (ⅲ) 그래도 없으면 **버려야** 한다.

### 7-C. 기존 `lexical_noise <= 0.08` 게이트로는 못 거른다

2106.04706 의 수식 밀도는 **5.7%** 로 임계 8% 아래다. 그런데 읽어 보면 못 쓴다
("the zero set of ⟨수식⟩ is finite in any bounded disk of ⟨수식⟩"). **수식 개수가 아니라
"수식이 문장성분인가" 가 기준이어야 한다** — 인라인 `<math>` 가 명사구 자리에 오면 탈락.
재도입 시 이 판정을 새로 만들어야 한다(기존 게이트 재사용 불가).

---

## 8. 판정 — 보류

| SPEC 반려 조건 | 해당? |
|---|---|
| 전문이 안 온다 | 아니다 — `/html` 로 온다 (87.5%) |
| 변형 금지 라이선스 | 부분적 — 55.6% 는 불가하나 **44.4% 는 CC BY/CC0 로 가능** |
| 대량 접근 경로 없음 | 아니다 — OAI-PMH 가 있다 |

→ 반려 조건에 걸리지 않는다. 그러나 **채택**도 아니다:

1. **사용자가 명시적으로 삭제를 지시한 소스다**(§0). 정찰 한 번으로 뒤집을 사안이 아니고,
   되살리려면 CHECK 제약 마이그레이션 + `acp_classify_license` 수정 + 추출기 신설이 필요하다.
2. **지문 적합성이 낮다**(SPEC 「보류」 조건 그대로) — 전부 C1~C2, 서론 절만 쓸 수 있고,
   CC BY 스트림의 1차 분류는 cs 315/577 로 STEM 편중이라 `ACP_SOURCE_REDESIGN.md` §1-B 가
   지적한 **"레지스터 단일·STEM 편중"을 오히려 악화**시킨다.
3. **한계 효용이 낮다** — 같은 자리(과학 설명문)를 PLOS 47,939편·eLife 301편·Futurity 2,885편이
   이미 메우고 있고, 그쪽은 심사를 거친 데다 HTML 이 훨씬 깨끗하다. arXiv 는 **미심사 프리프린트**라
   `obsolete-fact` 위험도 더 크다.

**다시 볼 조건**: 논증문·인문사회 공급이 모자라고(`the_conversation` 이 published 25편뿐),
`cs.CY`/`econ.GN`/`physics.soc-ph` 만 좁게 긁는 격리 큐를 원할 때. 그때는 §6 의 하한
**약 1,900편** 중 사회·경제 계열만 골라 수백 편 규모가 현실적이다.

---

## 9. 확인 실패 / 못 한 것

- **AWS S3 대량 덤프**(`s3://arxiv/`, requester-pays)는 **호출하지 못했다** — 자격증명이 없다.
  존재는 arXiv 문서에 적혀 있으나 **이 정찰에서 확인한 바 없다.** 비용도 못 셌다.
- **Kaggle arXiv 메타데이터 덤프**(CC0)는 로그인이 필요해 **확인하지 못했다.**
- §3 census 는 **각 창의 OAI 첫 페이지 1,300건**이다(그날 전체가 아니다). 두 창(2016·2026)만 쟀다.
- `/html` 가용률 87.5% 는 **표본 8건**이다. 신뢰구간이 넓다.
- 표본 6편은 **산문 친화 분야에서 손으로 골랐다.** 무작위 표본이 아니므로 §6-C 의 20~40% 는
  낙관 쪽으로 치우쳐 있다.
- 2026-09-01 창에서 `set=cs` 와 무필터가 **둘 다 정확히 1,300건**이라 두 census 가 서로
  독립 표본인지 확인하지 못했다(페이지 상한에 걸렸다).

---

## 10. 수확기를 짠다면

**전제**: 위 §8 의 보류를 뒤집는 사용자 결정이 먼저다. 그 없이는 짜지 않는다.

### 본뜰 스크립트

`scripts/csat/harvest-plos.mjs`(API 형)를 뼈대로 한다. **RSS 형(`collect-daily.mjs`)은 안 맞는다** —
arXiv 는 날짜창 페이징이지 피드가 아니다. 다만 collect-daily 의
`(source, source_id)` 선(先)조회 중복 제거(§260~323행)는 그대로 가져온다.

### 2단 구조 (§1 의 두 경로가 각각 다른 것을 주므로)

| 단계 | 하는 일 | 산출 |
|---|---|---|
| `arxiv-harvest-meta.mjs` | OAI `ListRecords` 를 **하루 창**으로 돌려 `id·title·categories·license·abstract` 수집. 여기서 **CC BY/CC0 만 통과**시키고 산문 친화 분야만 남긴다 | `scripts/acp/arxiv/meta-YYYY-MM-DD.json` |
| `arxiv-harvest-html.mjs` | 통과분만 `https://arxiv.org/html/<id>` 를 **15초 간격**으로 GET → 서론 절 추출 → 300~500어 발췌 | `library_articles` queued |

**라이선스 필터를 1단에 두는 것이 핵심이다** — 2단에서 걸면 못 쓸 글을 55.6% 만큼 헛으로
내려받고, robots crawl-delay 15초 때문에 그 낭비가 그대로 시간이 된다.

### 커서

`scripts/acp/arxiv/cursor.json` — `{ "lastCompletedDay": "2026-09-01" }` 하나.
**하루를 완주했을 때만 쓴다**(§5 의 토큰 24시간 만료·skip 오프셋 때문).
재실행 안전: 같은 날을 다시 돌려도 `(source, source_id)` 중복 제거가 막는다.

### 나눠 돌리기

2024–2025 = 730일. 1단(OAI)은 하루당 1~3 요청이라 **하루치 2~5초**, 전체 **1시간 내외**.
2단(HTML)은 crawl-delay 15초 × 통과분. 9,800편이면 **약 41시간** — 하루 3시간씩 14회로 나눈다.
한 번에 몰아 돌리면 arXiv 가 차단한다.

### 재도입 시 함께 고쳐야 하는 것

1. `library_articles_source_check` + `library_article_seed_catalog_source_check` 에 `'arxiv'` 추가 (마이그레이션)
2. `acp_classify_license()` — URL 형태(`creativecommons.org/licenses/by/4.0/`)를 인식하도록 (§3-B 말미)
3. 인라인 수식이 문장성분인지 보는 새 게이트 (§7-C — 기존 `lexical_noise` 로는 못 거른다)
4. `Sx1`/무제목 서론을 다루는 추출기 (§7-B)
5. `ArticleSource` · `SourceKey` · `SeedSource` 타입 3곳 + `SOURCE_META` 복원
