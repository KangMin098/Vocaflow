<!-- docs/reports/source-probe/frontiers.md -->
# Frontiers 확보 정찰

| | |
|---|---|
| 판정 | **채택** (단, **PMC 로 흡수하지 말 것** — 아래 §PMC) |
| 확보 가능 편수 | 실측 **약 80,000편** (PMC 에 없는 Frontiers 저널 18종 Crossref 합 79,956 · 사설/정정 제외 ≈ **75,000**). Psychology 를 포함한 전체 Frontiers 는 Crossref 회원 1965 기준 1,477,068 |
| 라이선스 | **CC BY 4.0** · 변형 **가능**. 항목별 필드가 온다(JATS `<ali:license_ref>` · Crossref `license[].URL` · Europe PMC `license`) |
| 전문 | **온다** — `/xml/nlm` 이 JATS 전문 XML (실측 11/11 · 53KB~281KB) |
| 안정 식별자 | **DOI** (`10.3389/<저널약칭>.<연도>.<원고번호>`) |
| 증분 커서 | Crossref `cursor=*` + `filter=from-created-date:` (실측: fevo 2026-01-01 이후 311편 · 커서 반환) |
| 정찰 일자 | 2026-09-07 |

> ⚠️ **Frontiers for Young Minds(`frym`, 123편 확보)와 다른 것이다.** 그쪽은 `kids.frontiersin.org` ·
> ISSN 2296-6846 · 어린이 독자용이고 **`/xml/nlm` 이 404** 라 `/full` HTML 만 쓴다.
> 본 정찰 대상은 `www.frontiersin.org` 의 성인 학술지 200+종이며 **`/xml/nlm` 이 200** 이다.
> 두 경로는 호스트·본문 형식·발췌 난이도가 모두 다르므로 수확기를 공유할 수 없다.

---

## 1. 대량 접근 경로

**Frontiers 자체에는 API 도 OAI-PMH 도 덤프도 없다.** 실측:

- `https://www.frontiersin.org/sitemap.xml` → 200 이지만 **research-topics 5개뿐**, 논문 사이트맵이 없다.
- `robots.txt` 가 광고하는 `articles/sitemap-index.xml` → 200 · `<loc>` **205개**, 그런데 전부
  `pdf-sitemap_N.xml`(PDF URL). `sitemap-article-pages-2024.xml` 은 200(15KB)이나
  **2023·2025·2026 은 404** — 연도 파티션이 한 해만 살아 있다. 목록 경로로 못 쓴다.

그래서 **목록은 Crossref, 본문은 Frontiers** 2단으로 간다 — `frym-ingest` 와 같은 구조다.

```
목록:  https://api.crossref.org/journals/2296-701X/works
         ?rows=500&cursor=*&select=DOI,title,license,type,created,published
         &filter=type:journal-article,from-created-date:2026-01-01
본문:  https://doi.org/<DOI>  →  .../journals/<슬러그>/articles/<DOI>/full
        그 URL 의 /full 을 /xml/nlm 으로 바꾼다
```

실호출 예 (2026-09-07):

```
$ curl -L "https://doi.org/10.3389/fevo.2026.1928946"
→ https://www.frontiersin.org/journals/ecology-and-evolution/articles/10.3389/fevo.2026.1928946/full
$ curl ".../10.3389/fevo.2026.1928946/xml/nlm"   → 200, 82,261 bytes (JATS)
```

`/xml/nlm` 200 실측 **11/11** (fevo · feduc · fenvs · fcomm · fmars · feart · fpos · fclim · frwa · fhumd 등).
HTML `/full` 은 1.2MB 인데 같은 글의 JATS 는 82KB — **본문은 반드시 `/xml/nlm` 으로 받는다.**
`robots.txt` 는 `/xml/` 을 막지 않는다(`Disallow` 는 images·production·review·mail·admin 뿐).
정찰 중 `www.frontiersin.org` 에 25회가량 요청했으나 차단·챌린지 없음.

**⚠️ 슬러그를 유추하지 말 것** — 저널 슬러그(`ecology-and-evolution` · `environmental-science`)는
DOI 약칭(`fevo` · `fenvs`)에서 규칙적으로 나오지 않는다. **doi.org 리다이렉트로 받아야 한다**(요청 1회 추가).

## 2. 전문(full text)이 오는가 — 온다

JATS `<body>` 에 절 구조가 그대로 온다. 실측 절 제목:
`Introduction | Methods | Study site: … | Data analysis | Results | … | Discussion`.
서론만으로 **300~450어**가 나온다(실측 5편: 303 · 339 · 348 · 368 · 447). 발췌 창 하나가 서론에서 바로 떨어진다.

**⚠️ 파싱 함정 3개 (전부 실측)**

1. **구조화 초록이 `<title>Introduction</title>` 을 재사용한다.** `<abstract>` 안에도
   Introduction/Methods/Results/Discussion 이 있어, 문서 전체에서 첫 "Introduction" 절을 찾으면
   **초록의 62어짜리 조각**을 집는다(fenvs 실측). **`<body>` 안만 훑어야 한다.**
2. **`<xref>` 를 통째로 지우면 문장이 깨진다.** 사회과학·교육 계열은 인용을 **문장 성분**으로 쓴다 —
   `<xref>Wood et al. (1976)</xref>, who coined the term "scaffolding," identified…` 에서 xref 를 지우면
   `", who coined the term…"` 만 남아 `fragmentary` 가 된다(feduc 실측). 괄호 인용
   `( <xref>Smith, 2019</xref> )` 은 괄호째 지우면 되지만, **주어 자리 인용은 지우지 말고 그 문장을 버린다.**
3. **XML 엔티티가 살아 있다** — `&#x0025;`(%) · `&#x2019;`(') · `&#x2013;`(–). 디코딩 필수.
   한자·키릴이 본문에 섞이기도 한다(실측: `ritual propriety (li 礼)`).

## 3. 라이선스 — CC BY 4.0, 변형 가능

기계 판독 필드가 **세 곳 모두**에 있다:

```xml
<license><ali:license_ref start_date="2026-09-04">https://creativecommons.org/licenses/by/4.0/</ali:license_ref>
```

- Crossref `license[].URL` = `https://creativecommons.org/licenses/by/4.0/` (실측 5건 중 3건.
  **2016~2017년 옛 논문은 license 배열이 비어 있다** — 그때는 JATS `<permissions>` 를 봐야 한다)
- Europe PMC `license` 필드: Front Psychol **`cc by` 50,844 · `cc by-nc` 260**(0.5%).
  → **NC 가 소수 섞인다. 항목별로 읽고 `cc by`/`cc0` 만 통과시킨다.** ND 는 관측되지 않았다.

발췌는 변경이므로 CC BY 의 변경 고지 의무가 붙는다 — `frym-ingest`/`storyweaver-ingest` 와 같은 규칙
(제목에 명시 + `source_id` 에 문단 범위)을 그대로 쓴다.

## 4. 안정 식별자 — DOI

`10.3389/<약칭>.<연도>.<원고번호>` 가 Crossref · Frontiers URL · Europe PMC 셋에서 동일하다.
`source_id` 는 `frontiers:<DOI>#<문단범위>` 를 권한다(frym 이 `frym:<DOI>` 를 쓰고 있다 — 접두어를 갈라야
두 소스가 섞이지 않는다).

## 5. 증분 커서 — Crossref cursor + created-date

```
filter=type:journal-article,from-created-date:2026-01-01  &cursor=*
→ total 311, next-cursor "MTc2NzMzMTQ4ODAwMCwxMC4zMzg5JTJGZmV2by4y…"
```

Crossref 커서는 **정렬이 보장된 딥페이징**이라 2026-08-16 IA 사고(정렬 없는 페이지네이션 →
214건 중복·동수 누락)가 재현되지 않는다. 커서 파일은 저널마다 따로 둔다(약칭 키).
그래도 커서는 최적화일 뿐이므로 **DOI dedup 을 안전장치로 둔다** — `harvest-plos.mjs` 와 같은 규칙.

## 6. 현실적 확보 가능 편수 — 실측

### PMC 에 없는 저널 (= Frontiers 전용 경로가 있어야만 닿는 것)

Europe PMC `JOURNAL:"…"` 히트 / Crossref `container-title` 패싯 (member 1965, 실측 2026-09-07):

| 저널 | Crossref | Europe PMC | PMC 수록률 |
|---|---:|---:|---:|
| Marine Science | 16,081 | 37 | 0.2% |
| Earth Science | 9,432 | 9 | 0.1% |
| Environmental Science | 8,445 | 31 | 0.4% |
| **Education** | 8,079 | 44 | 0.5% |
| Energy Research | 6,796 | 4 | 0.1% |
| **Ecology and Evolution** | 6,201 | 60 | 1.0% |
| Sustainable Food Systems | 6,000 | 28 | 0.5% |
| Physics | 5,777 | 76 | 1.3% |
| **Communication** | 2,288 | 21 | 0.9% |
| Built Environment | 2,273 | 5 | 0.2% |
| Astronomy and Space Sciences | 1,982 | 11 | 0.6% |
| **Political Science** | 1,478 | 2 | 0.1% |
| Water | 1,286 | 3 | 0.2% |
| Climate | 1,260 | 5 | 0.4% |
| Sustainable Cities | 1,091 | 3 | 0.3% |
| Conservation Science | 714 | 3 | 0.4% |
| **Human Dynamics** | 561 | 0 | 0% |
| **Language Sciences** | 212 | 10 | 4.7% |
| **합** | **79,956** | 352 | **0.4%** |

사설·정정 제외 비율 실측(2025년 이후 최근 500편 표본, 제목 접두어로 계수):
fevo 94.2% · feduc 96.6% · fenvs 89.8% · fcomm 95.4% → **약 94%**.
→ **연구 논문 ≈ 75,000편.** 목표 800편의 **94배**다. 편수가 제약이 아니다.

### PMC 에 있는 저널 (참고)

| 저널 | Crossref | Europe PMC | 수록률 |
|---|---:|---:|---:|
| Psychology | 53,076 | 52,328 | **98.6%** |
| Sociology | 2,092 | 1,979 | 94.6% |
| Sports and Active Living | 3,962 | 3,919 | 98.9% |
| Artificial Intelligence | 2,567 | 2,507 | 97.7% |
| Plant Science | 35,562 | 35,434 | 99.6% |

Europe PMC 전체 `PUBLISHER:"Frontiers Media SA"` = **453,410**(전량 `HAS_FT:Y`).

## 7. 지문 적합성 표본 판정 — 5편 (`JUDGING.md` 어휘)

서론 첫 단락들을 300어대로 잘라 실제로 읽었다.

| # | DOI / 저널 | verdict | genre | why |
|---|---|---|---|---|
| 1 | `10.3389/fevo.2026.1928946` 생태·진화 (바다거북 · ORV) | **use** | `nature` | 통념(산란 습성) → 감소 → 원인 → 연구 공백 순서가 그대로 서 있고 전문용어가 문맥으로 풀린다 |
| 2 | `10.3389/fcomm.2026.1869027` 커뮤니케이션 (팟캐스트 신뢰도) | **use** | `social` | 현상 제시 → 평가 과제 → 개념 구분으로 자족하나, 3단락째부터 신뢰·신뢰성 정의가 이어져 발췌 창을 앞 2단락으로 좁혀야 한다 |
| 3 | `10.3389/fenvs.2026.1849853` 환경과학 (MENA 농업·기후) | **use** | `climate` | 논지는 서지만 영어가 비원어민 문체("Worse still," · "we can mention")라 문장 다듬기 전에는 지문으로 못 쓴다 |
| 4 | `PMC13445181` = `10.3389/fpsyg.2026.1879160` 심리 (유교 수양) | **use** | `psychology` | 추상 명사 밀도가 높아 고3 상단이며, 한자(礼·敬·仁)가 본문에 섞여 비ASCII 필터가 필요하다 |
| 5 | `10.3389/feduc.2026.1949299` 교육 (스캐폴딩) | **reject** | `fragmentary` | 인용이 문장 주어라 xref 를 지우면 ", who coined the term…" 만 남아 문장이 무너진다 — 발췌기가 이 문장을 버려야 한다 |

**4/5 `use` · 1/5 `reject`.** 반려 사유가 원문 품질이 아니라 **우리 인용 제거기**라는 점이 핵심이다
(§2 함정 2). 주어 자리 인용 문장을 버리는 규칙을 넣으면 5번도 살릴 수 있으나, 넣기 전 표본을 다시 세야 한다.

**따로 기록해 둘 것 — Frontiers 는 교열이 가볍다.** 1번 논문 원문 XML 에 그대로
`…lead to false crawls. which are instances in which a female comes ashore but aborts nesting.` 이 있다
(마침표가 쉼표 자리에 있다). 우리 파서 탓이 아니라 **발행본 자체의 오류**다.
지문으로 쓰기 전 문장 단위 검사가 필요하다 — PLOS 발췌보다 한 단계 더.

## PMC 로 흡수 가능한가 — **부분만. 이 목표에는 못 쓴다**

- **흡수 가능**: Psychology(98.6%) · Plant Science(99.6%) · Sports(98.9%) · AI(97.7%) · Sociology(94.6%)
  및 모든 의생명 저널. PMC 는 NLM 수집 범위(생명·의학) 안에서만 Frontiers 를 보존한다.
- **흡수 불가**: 이번 목표의 무게중심인 **생태·환경·지구·해양·교육·커뮤니케이션·정치·기후**는
  PMC 수록률 **0.4%**(79,956 중 352). Ecology and Evolution 은 6,201편 중 **60편**뿐이다.
  → **"PMC 경로 하나로 흡수" 는 성립하지 않는다.**
- 그리고 **이 저장소에 PMC/Europe PMC 수확 경로는 아직 없다**(`scripts/` 전량 grep — PLOS Solr ·
  Gutenberg · Crossref+FrYM · MediaWiki · RSS 뿐). 흡수하려면 PMC 수확기를 **새로 짜야** 하고,
  그렇게 해도 위 8만 편은 못 받는다.
- 다만 **Psychology 는 Frontiers 경로로 받지 말 것을 권한다** — 심리 재고는 PLOS 51,465편과
  소재가 겹치고, PMC/Europe PMC 는 목록 응답에 라이선스·전문 링크가 함께 오므로 나중에 PMC 수확기를
  짤 때 한 번에 가져오는 편이 싸다. **Frontiers 전용 수확기는 PMC 밖 18종만 겨냥한다.**

### 왜 이 소스를 채택하나 (편수보다 중요한 이유)

`docs/reports/csat-source-fit-20260903.md` §7·§9 가 **PLOS 가 못 채우는 칸 넷**을 적어 두었다 —
예술·문화 · 철학·윤리 · 역사·인류 · **교육·언어**. Frontiers 는 그중 교육·언어·사회 칸을 직접 겨눈다:

Education 8,079 + Communication 2,288 + Political Science 1,478 + Human Dynamics 561 +
Language Sciences 212 = **12,618편**, 전부 PMC 밖이다.

---

## 수확기를 짠다면

**본뜰 것**: `scripts/textbook/frym-ingest.mjs` + `packages/library-pipeline/src/ingest-article/frontiers-young-minds.ts`
(Crossref 목록 → DOI → Frontiers 본문 → 발췌 → 게이트, 구조가 그대로 같다).
다른 점은 **본문이 HTML 이 아니라 JATS** 라는 것뿐이고, 그 파싱은
`scripts/csat/lib-passage.mjs`/`plos-extract.mjs` 쪽이 이미 하는 일과 같다.
채점 후 적재 순서는 `scripts/csat/harvest-plos.mjs` 를 따른다(**버릴 것을 담지 않는다**).

**새 파일 배치**

| | |
|---|---|
| 수확기 | `scripts/csat/harvest-frontiers.mjs` |
| 본문 파서 | `packages/library-pipeline/src/ingest-article/frontiers.ts` (JATS `<body>` → 절 배열) |
| 커서 | `scripts/csat/data/frontiers-cursor.json` — **저널 약칭별 키** (`{ "fevo": {cursor, from}, "feduc": {…} }`) |

**HTTP**: `curl` 로 낸다 — 이 머신은 node fetch 가 죽는다(`scripts/csat/lib-curl-fetch.mjs`, 메모리
`reference-node-tls-alpn-blocked`). Crossref 는 polite pool 을 위해 `mailto=` 를 붙인다.

**요청 예산**: 논문 1편당 **2 GET**(doi.org 리다이렉트 + `/xml/nlm`) + 목록 500편당 1 GET.
1,000편이면 약 2,002회. 저널 슬러그를 캐시하면 doi.org 왕복을 없앨 수 있다(슬러그는 저널당 1개).
→ **캐시 후 편당 1 GET.**

**나누기**: 저널 단위로 돌린다. 1회차 = 목표 칸에 직결되는 **Education · Communication ·
Political Science · Human Dynamics · Language Sciences**(12,618편 모집단)에서 목표 800편을 채우고,
모자라면 2회차로 Ecology and Evolution · Environmental Science · Climate · Conservation Science 를 연다.
저널당 1회 실행 = Crossref 목록 커서 1개 전진 + 통과분만 적재.

**재실행 안전** — 단계마다 명시:

| 단계 | 재실행 안전한가 |
|---|---|
| Crossref 목록 | **안전**. 커서를 지워도 처음부터 다시 훑을 뿐이고, 결과는 같다 |
| DOI dedup | **안전**. 적재 전 `source_id` 로 DB 조회해 있으면 건너뛴다. 건너뛴 수를 출력한다 |
| 본문 GET | **안전**. 부수효과 없음 |
| 게이트 채점 | **안전**. 통과분만 적재하므로 실패분이 재고로 남지 않는다 |
| 적재 | `--commit` 없이는 쓰지 않는다(기본 dry-run). 빈 본문·300어 미만 발췌는 넣지 않고 건너뛴 수를 출력한다 |

**게이트는 다른 소스와 같은 것을 댄다** — `lib-fit.mjs`(`csat_fit`) + `curriculumFit` + `standaloneFit`.
같은 자를 안 대면 같은 구멍이 생긴다.

**짜기 전에 먼저 넣을 것 (이번 정찰에서 나온 것)**

1. `<body>` 밖(구조화 초록) 절을 무시하는 규칙 — 안 넣으면 62어짜리 조각을 서론으로 집는다.
2. 주어 자리 `<xref>` 가 있는 문장을 **버리는** 규칙 — 안 넣으면 교육·사회 계열이 `fragmentary` 로 샌다.
3. 라이선스 화이트리스트(`cc by` · `cc0`) — Front Psychol 실측 0.5% 가 `cc by-nc` 다.
4. XML 엔티티 디코딩 + 비ASCII 비율 상한(한자·키릴 혼입).
5. 제목 접두어(`Editorial:` `Correction:` `Corrigendum:` `Erratum:` `Retraction`) 배제 — 표본 기준 6%.
