<!-- docs/reports/source-probe/tech-media.md -->
# 「기술·매체」 칸을 채울 소스 — 정찰

[gutenberg-remainder.md](./gutenberg-remainder.md) 가 정직한 반려를 냈다: 이 칸은 Gutenberg 로
못 채운다(겨냥해도 조각의 **1.2%**). 그래서 다른 소스를 찾는 것이 이 정찰의 일이다.

규격은 [SPEC.md](./SPEC.md), 이미 결론 난 86곳은 [SUMMARY.md](./SUMMARY.md).
자는 `scripts/csat/lib-topic.mjs`(**v2** · 오분류 8.3%) — 재고를 재는 것과 같은 것을 쓴다.
정찰 일자 **2026-09-08** · 전부 읽기 전용(DB 쓰기 0 · 대량 내려받기 0).

---

## 0. 한 줄

**편수는 급하지 않다. 급한 것은 등록(register)이다.** 이 칸의 재고 3,169편 중 **90%가
PLOS 한 소스의 공학 논문**이고(안테나 설계·로봇 경로계획), 「매체」 반쪽 — 인터넷·플랫폼·
저널리즘 산문 — 은 거의 비어 있다. 그리고 가장 싼 답은 새 소스가 아니라 **이미 채택해
놓고 한 편도 안 받은 NIST**(PD · 6,990편 · 명중률 26.7% = PLOS 의 3.7배)다.

---

## 1. 먼저 잰 것 — 이미 가진 소스가 이 칸을 얼마나 주는가

### 1-1. ⚠️ DB 의 라벨을 그대로 세면 틀린다

`library_articles.csat_fit.topic` 을 그대로 세면 `기술·매체` 가 **6,097편**으로 보인다.
그중 **`topicV=2` 는 63편뿐**이다 — 나머지 96%는 2026-09-07 에 고치기 전 자(v1, 오분류
23.6%)로 찍힌 라벨이다. PLOS 만 놓고 보면 v1 라벨 **5,475** 대 v2 재분류 **2,843** —
**두 배 차이**다. 아래 수치는 전부 표본을 **v2 로 다시 태워** 얻은 값이다.

### 1-2. 소스별 기술·매체 (v2 재분류 · 글 단위)

표본은 `csat_fit.pass > 0` 인 행에서, 큰 두 소스는 **고정 시드 무작위 창 8×300 = 2,400편**,
나머지는 최대 900편(모수가 작으면 전수).

| 소스 | 적합 편수 | 표본 | 기술·매체 비율 | **추정 편수** |
|---|---|---|---|---|
| **plos** | 39,904 | 2,400 | **7.1%** | **2,843** |
| futurity | 1,848 | 900 | 8.0% | 148 |
| gutenberg | 29,624 | 2,400 | 0.3% | 99 |
| usgs | 436 | 436(전수) | 9.4% | 41 |
| voa | 155 | 155(전수) | 11.0% | 17 |
| nasa | 113 | 113(전수) | 12.4% | 14 |
| the_conversation | 62 | 62(전수) | 8.1% | 5 ⚠️ ND — 쓸 수 없다 |
| elife · owid · original | 1,096 | 전수 | ≤0.6% | 3 |
| wikipedia · noaa · simple_wikipedia · wikivoyage · factbook | 227 | 전수 | 0% | 0 |
| | | | **합** | **≈ 3,169** |

**한 소스가 90%다.** 그리고 그 2,843편의 표본을 눈으로 읽으면 등록이 좁다 —
「Miniaturized shared aperture multiband antenna」 · 「Trajectory planning method for pipeline
installation robots based on AS-DTRRT」 · 「HDS-Net: fine-grained skin lesion segmentation」.
PLOS ONE 의 공학·전산 논문이다.

### 1-3. 「매체」 반쪽은 비어 있다

분류표의 이름은 **기술·매체**인데, 재고는 기술뿐이다. 기술·매체로 분류된 글 중
매체어(`media`·`internet`·`online`·`platform`·`smartphone`·`chatbot`·`journalis*`·
`broadcast*`·`newspaper`·`television`)가 **3회 이상** 나오는 비율:

| 소스 | 기술·매체 표본 | 매체어 3회+ | 비율 |
|---|---|---|---|
| plos | 171 | 47 | **27%** |
| futurity | 229 | 43 | **19%** |
| gutenberg | 10 | 1 | 10% (『The Hacker Crackdown』) |

즉 실질적인 「매체」 지문은 재고 전체에서 **900편 안팎**이다.

### 1-4. 그래서 편수는 부족한가 — **3단계(5만) 기준으로는 부족 0**

같은 표본으로 8칸 전부를 다시 재고 [topic-distribution.json](../../../scripts/csat/data/topic-distribution.json)
(기출 302지문)과 견주면:

| 칸 | 추정 재고 | 재고 비율 | 기출 목표 | 재고/목표 | 균형 사정권 |
|---|---|---|---|---|---|
| 과학·자연 | 23,958 | 34.6% | 23.4% | 1.48 | 102,407 |
| 역사·인류 | 6,898 | 10.0% | 5.5% | 1.81 | 125,309 |
| 철학·윤리 | 3,428 | 4.9% | 3.2% | 1.54 | 106,753 |
| **기술·매체** | **3,274** | 4.7% | 6.0% | **0.79** | **54,909** |
| 사회·경제 | 9,642 | 13.9% | 18.3% | 0.76 | 52,548 |
| 교육·언어 | 5,929 | 8.6% | 11.5% | 0.75 | 51,700 |
| 심리·인지 | 7,385 | 10.7% | 14.2% | 0.75 | 51,936 |
| **예술·문화** | 8,784 | 12.7% | 17.9% | **0.71** | **49,100** |

⚠️ **기술·매체는 병목이 아니다.** 5만 목표에서 이 칸이 요구하는 것은 2,980편이고 우리는
3,169~3,274편을 갖고 있다. **지금 병목은 예술·문화**(49,100)다. 이 정찰의 전제였던
「기술·매체를 채워야 한다」는 편수로는 성립하지 않는다 — 성립하는 것은 **§1-2 의 단일
소스 의존**과 **§1-3 의 빈 매체 반쪽**이다.

(표본 기반 추정이라 ±가 있다. `topic-gap.mjs --all` + `backfill-topic.mjs --commit` 으로
전수 재분류하면 확정된다 — 이 정찰은 DB 에 쓰지 않으므로 여기서 멈춘다.)

---

## 2. 새 소스가 필요한가 — **조건부 예. 다만 1순위는 새 소스가 아니다**

| 순위 | 할 일 | 근거 |
|---|---|---|
| 1 | **NIST 수확** — 이미 「채택」인데 `library_articles` 에 **0행** | PD · 뉴스 6,990 + 블로그 2,022 · 창 명중률 **26.7%**(PLOS 7.3%의 3.7배) |
| 2 | **Internet Policy Review** 신규 | CC BY · 창 명중률 **43.4%**(실측 1위) · **매체 반쪽을 유일하게 채운다** |
| 3 | **PeerJ Computer Science** 신규 | CC BY 4.0 3,814편 · **PMC 미수록 확인** · 창 명중률 33.3% |
| 4 | **NASA Spinoff** 신규(소량) | PD · 웹판 171편 · 창 명중률 27.9% · 산문 등록이 교재에 가장 가깝다 |

---

## 3. 실측 명중률 — 권수가 아니라 이것이 답이다

두 자로 쟀다. **창(window) 단위가 정본**이다 — 파이프라인이 지문으로 자르는 단위가
180어 안팎의 창이기 때문이다(`corpus-window-yield.mjs`).

| 소스 | 상태 | 글 단위 | **창 180어 단위** | 창 상위 칸 |
|---|---|---|---|---|
| **Internet Policy Review** | 신규 | 0 / 5 (0%) | **43.4%** (창 235) | 기술·매체 43% · 사회·경제 31% |
| **PeerJ Computer Science** | 신규 | 6 / 8 (75%) | **33.3%** (창 330) | 기술·매체 33% · 교육·언어 21% |
| **NASA Spinoff** | 신규 | 8 / 12 (67%) | **27.9%** (창 68) | 과학·자연 44% · 기술·매체 28% |
| **NIST** | 채택·미수확 | 3 / 10 (30%) | **26.7%** (창 30) | 과학·자연 30% · 기술·매체 27% |
| CORDIS | 신규 | 1 / 4 (25%) | 9.1% (창 11) | 과학·자연 64% |
| *futurity* | 보유 | 8.0% | *9.3%* (창 1,321) | 과학·자연 55% |
| *PLOS* | 보유 | 7.1% | *7.3%* (창 7,745) | 과학·자연 38% |
| *Gutenberg* | 보유 | 0.3% | *0.7%* (창 438) | 예술·문화 24% |

**새 후보 넷이 보유 소스보다 3~6배 잘 맞는다.**

### ⚠️ 이 표를 만들면서 두 번 틀렸다 — 다음 정찰이 쓸 것

1. **글 단위로 재면 IPR 은 0%다.** 5편 전부 `사회·경제` 로 갔다(78.3 대 46.3 처럼 큰 차로).
   8,000~10,000어 논문 전체를 한 덩이로 재면 정책·규제 어휘가 이기기 때문이다.
   **창으로 자르면 43.4%.** Gutenberg 정찰이 옳게 한 일이 이것이었다 — 파이프라인이
   자르는 단위로 재라. 글 단위로 쟀다면 이 정찰은 1위 후보를 반려했을 것이다.
2. **`<title>` 을 그대로 얹으면 명중률이 조작된다.** `lib-topic.mjs` 는 제목을 본문에
   **3번**(`TITLE_REPEAT`) 얹는다. IPR 의 HTML `<title>` 꼬리 `| Internet Policy Review` 안의
   **`Internet` 이 창마다 3번 들어가** 명중률이 **51.1%** 로 나왔다. 사이트명 꼬리를 떼자
   43.4%. 정찰 표본에서는 `<title>` 을 쓰기 전에 `|`·`–` 뒤를 반드시 자를 것.

---

## 4. 후보별 정찰 — SPEC 7항목

### 4-1. Internet Policy Review — **채택**

| | |
|---|---|
| 판정 | **채택** |
| 확보 가능 편수 | **397**(analysis · 라이선스 확인됨) — news 303 은 §아래 사유로 제외 |
| 라이선스 | **CC BY 3.0 Germany** · 변형 **가능** |
| 전문 | **온다** (기사 HTML `<p>` 에 8,000~10,800어) |
| 안정 식별자 | **DOI** — `<meta name="dcterms.identifier" content="info:doi:10.14763/2026.3.2111">` |
| 증분 커서 | `sitemap.xml?page=1` 의 `<lastmod>`(4,978/4,979 에 존재) · `/feed`(200) |
| 정찰 일자 | 2026-09-08 |

1. **대량 접근 경로** — `https://policyreview.info/sitemap.xml` → `?page=1` (4,979 loc) ·
   `?page=2` (752 loc). 경로별 계수: `articles/analysis` **397** · `articles/news` **303** ·
   `taxonomy/term` 3,861 · `essays/scifi` 4.
2. **전문** — 온다. 표본 5편 8,038~10,799어. Drupal 렌더 HTML 에 본문 전체가 있다(JS 불필요).
3. **라이선스** — 기사 HTML 의 `<meta name="dcterms.rights">` 가 **"Creative Commons
   Attribution 3.0 Germany"** + `https://creativecommons.org/licenses/by/3.0/de/`. NC·ND·SA
   없음 → 레벨 조정·빈칸·번역 전부 가능.
   ⚠️ **DOAJ 는 같은 저널을 CC BY 4.0 이라 적는다**(`doaj.org/api/search/journals/issn:2376...`
   아니라 `issn:2197-6775`). 둘 다 BY 라 결론은 같지만, SPEC §「집계 API 의 라이선스 필드는
   그 사본의 라이선스가 아니다」에 따라 **기사 meta 를 정본으로 삼는다**.
   ⚠️ **news 303편에는 라이선스 메타가 아예 없다**(실측 2편: `dcterms.rights` 0개 ·
   `creativecommons` 문자열 0개). 그래서 편수에서 뺐다. 편집부에 물어 확인되면 +303.
4. **안정 식별자** — DOI(`10.14763/<연>.<호>.<노드>`) + Drupal node id. 슬러그는 바뀔 수 있으나
   DOI 는 아니다.
5. **증분 커서** — sitemap `<lastmod>`. `/feed` 도 200 이나 최신분만.
6. **편수** — 실측 397(sitemap 계수). 1996년 창간이 아니라 2012년 창간이라 이 이상 늘지 않는다.
   연 30~40편 증가.
7. **지문 적합성** — 창 235개 중 **기술·매체 43.4%**, `분류불가` 6%(가장 낮다 = 소재가 뚜렷하다).
   표본 제목: 「Community-based policing and emerging informal systems of justice on Twitch」
   ·「Scroll. Like. Divide. The filter bubble effect on electoral perceptions」
   ·「How Brussels reproduces Silicon Valley technosolutionism」. **`use`(설명·논증문)** 이고
   자족적이다. **이 후보만이 「매체」 반쪽을 준다** — 플랫폼·추천알고리즘·콘텐츠 조정·
   허위정보가 소재다.

- **robots.txt** — Drupal 기본. `/articles/` 허용, AI 크롤러 명시 차단·`Content-Signal` **없음**
  (SUMMARY §7-4 의 「넘지 않는다」 결정에 걸리지 않는다).
- **이중 계상 아님** — Europe PMC `ISSN:"2197-6775"` **hitCount 1**(MEDLINE 참조 1건),
  PMC 전문 수록 아님. DOAB·Frontiers 와도 무관.

### 4-2. PeerJ Computer Science — **채택**

| | |
|---|---|
| 판정 | **채택** |
| 확보 가능 편수 | **3,814** (CC BY 3,804 + CC0 10 · 전체 3,950 중) |
| 라이선스 | **CC BY 4.0** 대다수 · 변형 **가능**. ⚠️ **CC BY-NC 109편 혼입 — 항목별 필터 필수** |
| 전문 | **온다** (`https://peerj.com/articles/cs-N.html`, 5,900~11,300어) |
| 안정 식별자 | **DOI** `10.7717/peerj-cs.N` |
| 증분 커서 | Crossref `filter=from-index-date:YYYY-MM-DD` + `cursor=*` |
| 정찰 일자 | 2026-09-08 |

1. **대량 접근 경로** — Crossref API.
   `https://api.crossref.org/journals/2376-5992/works?rows=1000&cursor=*&select=DOI,title,license,type`
   → `total-results` **3,950**, 전부 `type-name: Journal Article`.
2. **전문** — 온다. `.html` 200(469KB). ⚠️ `.xml`·`.json` 은 **400** 을 주는데 오류가 아니라
   "click HERE to continue" 인터스티셜이다 — HTML 을 긁는다.
3. **라이선스** — Crossref `facet=license:*` 실측:
   CC BY 4.0 **3,804**(https 3,626 + http 178) · **CC BY-NC 4.0 109** · CC0 10 · UK OGL 2.
   **내려받기 전에 Crossref 로 걸러진다**(SPEC §「라이선스는 내려받기 전에 항목별로」).
   표본 8편 중 1편이 실제로 `by-nc/4.0` 이었다 — 저널 단위로 "CC BY" 라 믿으면 안 된다.
   DOAJ 도 저널 라이선스를 CC BY 로만 적는다.
4. **안정 식별자** — DOI. URL 슬러그도 `cs-<번호>` 로 DOI 와 1:1.
5. **증분 커서** — `filter=from-index-date:2026-08-01` 실호출 → 1,130건. deep paging 은 `cursor=*`.
6. **편수** — 3,950(Crossref) 중 쓸 수 있는 것 **3,814**. 2015년 창간, 연 300~400편 증가.
7. **지문 적합성** — 창 330개 중 기술·매체 33.3%, 교육·언어 21%(전산교육 논문이 섞인다),
   `분류불가` 21%(수식·표 잔재). 논문이라 `use` 이나 **전문어 밀도가 높다** — 발췌 위치를
   서론·논의로 한정하는 편이 낫다. 등록은 PLOS 공학 논문과 **같은 계열**이라
   §1-2 의 「단일 등록」 문제는 못 푼다. 편수를 푸는 후보다.

- **robots.txt** — `/articles/` 허용, `Crawl-delay: 2`. AI 크롤러 차단 없음.
- **이중 계상 아님** — Europe PMC `ISSN:"2376-5992" AND SRC:PMC` **hitCount 0**
  (전체 색인은 2,941건이나 PMC 전문 수록은 0). PMC OA 4,998,523 과 겹치지 않는다.

### 4-3. NASA Spinoff — **채택(소량)**

| | |
|---|---|
| 판정 | **채택(소량)** |
| 확보 가능 편수 | **171**(웹판 실측) + 연간 PDF **49권**(1976–2024 · 내부 편수 **못 셈**) |
| 라이선스 | **PD**(NASA Media Usage Guidelines) · 변형 **가능** |
| 전문 | **온다** (617~2,747어, 중간 1,031어) |
| 안정 식별자 | URL 슬러그 (`/Equalizing_Internet_Access`) — DOI 없음 |
| 증분 커서 | **연 1회 발간** — 카테고리 페이지 7개를 매년 다시 훑는다 |
| 정찰 일자 | 2026-09-08 |

1. **대량 접근 경로** — sitemap **없다**(404) · `/search/node` 는 결과를 안 준다.
   **카테고리 페이지 7개가 전체 목록이다**: `/category/Computer%20Technology` ·
   `Consumer Home Recreation` · `Environment and Resource Management` ·
   `Health and Medicine` · `Industrial Productivity` · `Public Safety` · `Transportation`.
   합집합 **171** 고유 슬러그(실측).
2. **전문** — 온다. `<p>` 만 긁으면 본문이 그대로 나온다.
3. **라이선스** — 1차 확인: nasa.gov Media Usage Guidelines — *"NASA content … generally are
   not subject to copyright in the United States. … News outlets, schools, and **text-book
   authors may use NASA content without needing explicit permission**."* 단 **NASA 인시그니아·
   로고타입은 PD 가 아니다**(텍스트만 쓰면 무관). Spinoff 기사는 기업 제공 이미지·인용이
   섞이므로 **이미지는 받지 않는다**.
4. **안정 식별자** — 슬러그뿐이다. DOI·핸들 없음 → `source_id = 'spinoff:<슬러그>'` 로 두고
   슬러그 변경은 감수한다.
5. **증분 커서** — 연간지다. 매년 1월 카테고리 7쪽을 다시 읽고 **새 슬러그만** 넣는다.
   ⚠️ 정렬 없는 페이지네이션 문제는 없다(한 쪽에 전부 있다).
6. **편수** — 웹판 **171 실측**. 그 이전은 `/spinoff/archives` 의 **연간 PDF 49권**
   (1976–1995 `back_issues_archives/<연>.pdf` · 1996–2020 `spinoff<연>/…pdf` ·
   2021–2024 `sites/default/files/…pdf`). **PDF 내부 편수는 세지 않았다**(대량 내려받기 금지).
   호당 40~50편이라는 통설은 확인하지 않았다 — 쓰려면 먼저 1권을 세어 볼 것.
   ⚠️ 옛 HTML 판 일부가 살아 있다(`/Spinoff2008/ct_1.html` 200 · `/spinoff2005/ct_1.html` 200,
   `/Spinoff2012/ct_1.html` 은 404) — **연도마다 다르므로 실측 없이 규칙을 가정하지 말 것.**
7. **지문 적합성** — 창 68개 중 기술·매체 27.9%(과학·자연 44%). 표본 제목:
   「'Digital Winglets' for Real-Time Flight Paths」·「Humanoid Robots Assist Assembly Lines」
   ·「Equalizing Internet Access」. **등록이 교재에 가장 가깝다** — 600~1,500어의 설명문이고
   전문어 밀도가 낮다. 편수는 작지만 **PLOS 논문이 못 주는 결을 준다**.

### 4-4. NIST — **이미 채택인데 0행. 실측 정정 포함**

[SUMMARY.md](./SUMMARY.md) §2 가 `NIST 6,496(sitemap) · PD` 로 채택해 뒀는데
`library_articles` 에 **`source='nist'` 가 한 행도 없다**(DB 실측).

- **sitemap 실측 정정** — `https://www.nist.gov/sitemap.xml` = **56 페이지 × 2,000 loc**.
  `/news-events/news/` **6,990** (page1 1,997 · page2 2,000 · page3 1,999 · page4 994) ·
  `/blogs/` **2,022** (page4 101 · page5 1,921). 기존 문서의 6,496 은 **낮게 잡혀 있었다**.
- **창 명중률 26.7%** (창 30 · 표본 12편 중 2편은 150어 미만이라 제외).
  중간 어수 569. 「NIST Team Demystifies Utility of Power Factor Correction Devices」
  ·「New NIST Pub Can Help IT Managers Assess Security Controls」 계열.
- **라이선스** PD(연방정부 저작물) · **식별자** URL · **증분** sitemap `<lastmod>`.
- ⚠️ 짧은 글이 많아 `THIN` 이 나온다(87어·139어 실측). **150어 미만은 버리는 필터가 필요하다.**

### 4-5. CORDIS (EU 연구성과 뉴스) — **보류**

| | |
|---|---|
| 판정 | **보류** |
| 확보 가능 편수 | **못 셈** — 목록 라우트를 못 찾았다 |
| 라이선스 | **확인 실패** — 기사 HTML 에 `rel="license"`·CC 문자열 **0** |
| 전문 | 온다 (489~599어) |
| 안정 식별자 | `article/id/<번호>` |
| 증분 커서 | 미확인 |

- `/news` 200 · `/article/id/<번호>-<슬러그>` 200 이나 **`/article` 은 404**, `/search` 는
  JS 렌더라 서버 HTML 에 목록이 없다(실측: `<p>` 추출 **55어** = 껍데기).
- **창 명중률 9.1%**(창 11 중 1). 과학·자연 64% — EU 연구 뉴스는 과학이 대부분이다.
  이미 과잉인 칸(1.48)을 더 채운다.
- EU 위원회 문서 재사용 결정(2011/833/EU)이 CC BY 4.0 을 정하지만 **CORDIS 기사에 그
  표시가 붙어 있지 않다.** SPEC §「"CC 라고 알려져 있다" 를 믿지 않는다」에 따라 보류.

### 4-6. First Monday — **반려 (NC)**

- OAI-PMH 가 열려 있고 **`completeListSize=2,777`** · 1996년 창간 · 인터넷 연구 전문지 —
  소재로는 이 칸의 정중앙이다.
- 그런데 `oai_dc` 의 `<dc:rights>` 가 **`http://creativecommons.org/licenses/by-nc-sa/4.0/`**.
  **NC 는 상업 교재에 못 쓰고 SA 는 전염된다.** 반려.
- (옛 레코드에는 `dc:rights` 자체가 없다 — 없는 것을 「제한 없음」으로 읽지 않는다.)

### 4-7. GAO (Science & Technology Assessment) — **반려 (봇 차단)**

- PD 이고 기술영향평가 보고서라 소재가 맞지만, **`gao.gov` 6경로 전부 403**:
  `/science-technology-assessment` · `/products/gao-25-107237` · `/reports-testimonies`,
  UA 를 Chrome 으로 바꾸고 `Accept`·`Accept-Language` 헤더를 붙여도 동일.
  응답 402바이트 = 엣지 차단 페이지. **우회하지 않는다** → 프로그램 접근 경로 없음 = 반려.

---

## 5. 소스가 아니라 분류표를 봐야 하는 것 — 「매체」가 구조적으로 사회·경제로 간다

IPR 논문 3편의 **글 단위** 점수:

| 글 | 1위 | 2위 |
|---|---|---|
| How Brussels reproduces Silicon Valley technosolutionism | 사회·경제 **78.3** | 기술·매체 46.3 |
| Community-based policing … on Twitch | 사회·경제 **68.1** | 기술·매체 39.2 |
| The filter bubble effect on electoral perceptions | 사회·경제 **42.8** | 기술·매체 39.1 |

`기술·매체` 표는 **인공물**에 강하고(`computer`·`robot`·`sensor`·`semiconductor`),
`사회·경제` 표는 `policy`·`government`·`social`·`political`·`law`·`institution` 로 넓다.
그래서 **인터넷·플랫폼·미디어를 논하는 산문은 소재가 매체여도 사회·경제로 간다.**

표에 **없는** 매체어(실측): `streaming` · `moderation`(content moderation) ·
`disinformation` · `misinformation` · `surveillance` · `privacy` · `encryption` ·
`cybersecurity` · `app` · `website` · `browser` · `bandwidth` · `journalism` ·
`newspaper` · `television` · `broadcast`.

⚠️ **이것은 이 정찰의 권고가 아니라 관측이다.** 표를 고치면 `TOPIC_V` 를 올려야 하고
(`lib-topic.mjs` §분류판 번호), 기존 라벨 6.9만 행이 전부 옛 자가 되며,
`topic-accuracy.mjs --score`(손판독 144편)가 같이 움직여야 한다. **별도 결정 사안이다** —
여기서는 「기술·매체 부족」이 소스만의 문제가 아니라는 것까지만 기록한다.
(SUMMARY §5 「막는 것은 대부분 우리 코드다」의 연장선이다.)

---

## 6. 수확기를 짠다면

| 소스 | 본뜰 것 | 커서 파일 | 나누기 |
|---|---|---|---|
| **NIST** | `scripts/acp/collect-daily.mjs`(sitemap→HTML 형) | `scripts/csat/data/nist-cursor.json` (`<lastmod>` 최댓값) | sitemap 5쪽 × 2,000 → 5회. `Crawl-delay` 없음이나 1req/s |
| **IPR** | 같은 sitemap 형 | `data/ipr-cursor.json` (DOI 집합 + lastmod) | 397편 = 1회 |
| **PeerJ CS** | `scripts/csat/harvest-plos.mjs`(API 형) — Crossref 로 **목록·라이선스**를 먼저 받고, 통과분만 HTML | `data/peerj-cs-cursor.json` (`from-index-date`) | 목록 4회(rows=1000, cursor) → 본문 3,814 ÷ 500 = 8회. `Crawl-delay: 2` 준수 |
| **NASA Spinoff** | `scripts/csat/harvest-frontiers.mjs`(목록 페이지 형) | `data/spinoff-cursor.json` (슬러그 집합) | 카테고리 7쪽 + 본문 171 = 1회 |

**공통으로 반드시 넣을 것** (SUMMARY §5 가 기록한 「조용히 0건이 되는」 결함들):

1. **`sourceKey()` 를 목록기와 적재기가 공유한다.** 키가 어긋나면 중복 검사가 영구 0건이
   되고 오류 없이 정상 종료한다(FrYM·Wikipedia·VOA 실측). 권장:
   `nist:<URL 경로>` · `ipr:<DOI>` · `peerj-cs:<DOI>` · `spinoff:<슬러그>`.
2. **라이선스를 항목별로 내려받기 전에 건다.** PeerJ 는 Crossref `license[].URL` 에
   `by-nc` 가 있으면 **받지 않는다**(109편). IPR 은 `dcterms.rights` 가 없으면 받지 않는다
   (news 303편이 여기 걸린다).
3. **150어 미만은 버린다.** NIST 표본 12편 중 2편이 87어·139어였다.
4. **`<title>` 의 사이트명 꼬리를 자르고 저장한다** — §3 의 두 번째 함정. 저장 단계에서
   자르지 않으면 나중에 분류기가 매 창마다 그것을 3번 읽는다.
5. **재실행 안전** — 커서를 갱신하기 전에 적재가 끝났는지 확인한다. 몇 번 돌려도 결과가
   같아야 한다(CLAUDE.md §🤖).

---

## 7. 커밋하지 않았다

이 파일 하나만 만들었다. `git add` 하지 않았고, DB 에 쓰지 않았고(읽기 전용 질의만),
수확기도 짜지 않았다. 표본은 후보당 4~12편, 대량 내려받기 없음.
