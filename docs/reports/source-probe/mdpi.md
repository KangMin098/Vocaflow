<!-- docs/reports/source-probe/mdpi.md -->
# MDPI 확보 정찰

| | |
|---|---|
| 판정 | **보류** (MDPI 자체 경로만 보면 **반려** — 전문이 안 온다. Europe PMC 경유로만 전문이 열린다) |
| 확보 가능 편수 | **Sustainability 83 · Societies 12** (Europe PMC 전문 실측) — 목표 1,000편의 **9.5%**. MDPI 전체로는 EPMC 전문 **1,058,400** 이나 이는 사실상 PMC 수확이고 대상 저널이 아니다 |
| 라이선스 | **CC BY 4.0** · 변형 **가능** (OAI 표본 100/100 · JATS 표본 4/4) |
| 전문 | **초록만** (MDPI OAI·Crossref) / **온다** (Europe PMC JATS XML · `res.mdpi.com` PDF) |
| 안정 식별자 | DOI `10.3390/…` (+ OAI `oai:mdpi.com:/<ISSN>/<vol>/<issue>/<page>/`, EPMC 경로는 PMCID) |
| 증분 커서 | OAI `from`/`until`(일 단위) + `resumptionToken` — ⚠️ **datestamp 는 발행일이 아니다**(재스탬프) |
| 정찰 일자 | 2026-09-07 |

---

## 1. 대량 접근 경로 — 넷을 실제로 불렀고, 결과가 갈렸다

| 경로 | 호출 | 결과 |
|---|---|---|
| **OAI-PMH** | `https://oai.mdpi.com/oai/oai2.php?verb=Identify` | **200** · 열려 있다 |
| 웹사이트 | `https://www.mdpi.com/2071-1050/13/13/7263` | **403** |
| Crossref | `https://api.crossref.org/journals/2071-1050/works` | **200** · 메타데이터만 |
| Europe PMC | `…/europepmc/webservices/rest/search?query=PUBLISHER:"MDPI"` | **200** · 전문 있음 |

### 1-1. OAI-PMH — 되는데, 저널로 못 자른다

```
GET https://oai.mdpi.com/oai/oai2.php?verb=ListRecords&metadataPrefix=oai_dc&set=research-article&from=2026-09-01&until=2026-09-01
```

`Identify` 실측: `repositoryName` = Multidisciplinary Digital Publishing Institute ·
`earliestDatestamp` **2012-01-12** · `granularity` YYYY-MM-DD · `deletedRecord` **no** ·
`compression` gzip · `adminEmail` geeks@mdpi.com.
`ListMetadataFormats` = `oai_dc` · `oai_agris` **둘뿐**(JATS·XML 없음).

페이지네이션은 정상이다 — `ListRecords` 50건/쪽 · `ListIdentifiers` 200건/쪽,
`resumptionToken` 에 `completeListSize` 와 `cursor` 가 온다(2026-09-01 하루 = **1,463건**).
정렬 없는 페이지네이션이 아니라 토큰 기반이므로 IA 형 중복·누락 사고는 없다.

⚠️ **`ListSets` 67개는 전부 「글의 종류」다** — `research-article` · `review-article` ·
`editorial` · `case-report` … **저널 set 이 없다.** 즉 "Sustainability 만" 을 서버에 요청할 수
없고, 전량을 훑으며 식별자의 ISSN 으로 클라이언트에서 걸러야 한다.
(식별자에 ISSN 이 박혀 있다: `oai:mdpi.com:/2071-1050/13/13/7263/`.)
실측 표본 200건 중 Sustainability 는 **1건** — 걸러 내는 비용이 200:1 이다.

### 1-2. www.mdpi.com — 403, 그리고 그건 Cloudflare 가 아니다

```
403  https://www.mdpi.com/                      (root)
403  https://www.mdpi.com/2071-1050/13/13/7263  (본문)
403  https://www.mdpi.com/2071-1050/13/13/7263/pdf
403  https://www.mdpi.com/2071-1050/13/13/7263/xml
403  https://www.mdpi.com/robots.txt
403  https://api.mdpi.com/
403  https://doi.org/10.3390/su13137263          (리다이렉트 종착이 위 URL)
```

본문은 `Reference #18.8e023517…` / `errors.edgesuite.net` — **Akamai** 엣지 차단이다.
`docs/reports/csat-source-fit-20260903.md` 와 `CHANGELOG.md` 가 "MDPI 403 **Cloudflare**"
라고 적고 있는데 **틀렸다.** 차단은 사실이고 벤더만 다르다.
브라우저 UA·Accept 헤더를 붙여도 같은 403 이었다. **우회하지 않았다.**

`robots.txt` 자체가 403 이라 **MDPI 의 크롤링 허용 범위를 읽을 수 없다** — "금지라고 적혀
있더라" 도 "허용이더라" 도 말할 수 없는 상태다. 이것 자체가 판정 근거의 일부다.

### 1-3. ⚠️ 막히지 않은 자산 호스트가 있다 — 쓰지 않았고, 결정은 사용자 몫이다

```
200 application/pdf 549,991B  https://res.mdpi.com/d_attachment/sustainability/sustainability-13-07263/article_deploy/sustainability-13-07263.pdf
200 application/pdf 549,991B  https://mdpi-res.com/…(같은 파일, 별칭 호스트)
200 application/pdf 598,309B  https://res.mdpi.com/d_attachment/societies/societies-15-00333/article_deploy/societies-15-00333.pdf
200 application/pdf 26,037,958B https://res.mdpi.com/d_attachment/arts/arts-13-00001/article_deploy/arts-13-00001.pdf
```

URL 은 OAI 식별자에서 기계적으로 만들어진다 — ISSN→저널 슬러그 매핑 + `<슬러그>-<권>-<쪽 5자리 0채움>`.
3개 저널 3/3 적중. 응답 크기까지 실측했으므로 **경로가 있다는 것은 확인된 사실**이다.

**그럼에도 이 경로를 채택안으로 올리지 않는다.** 이유 셋:
① 발행사가 `www` 를 엣지에서 막아 두었는데 자산 호스트로 대량 수확하는 것은
   **차단 우회로 읽힌다**(이번 정찰의 명시 금지 사항). 표본 4회 GET 외에 아무것도 받지 않았다.
② `robots.txt` 가 403 이라 **허용 여부를 확인할 방법이 없다.**
③ PDF 다. 저장소는 이미 "DOAJ 는 PDF 다" 를 탈락 사유로 적었고(§9), 예술 저널 1편이
   **26MB** 인 것에서 보듯 이미지 비중이 커 본문 추출 비용이 PLOS·EPMC 대비 한 자릿수 크다.

**사용자가 「자산 호스트 수확 허용」을 명시하면 그때 편수를 다시 센다.** 지금은 안 센다.

---

## 2. 전문이 오는가 — MDPI 자체 경로에서는 **안 온다**

| 경로 | 본문 | 근거 |
|---|---|---|
| MDPI OAI `oai_dc` | ❌ **초록만** | `dc:description` = 초록 1문단 · `dc:format` = `application/pdf` · `dc:identifier` = DOI 링크. 본문 필드가 스키마에 없다 |
| Crossref | ❌ | `link` 는 `intended-application: similarity-checking` 인 `www.mdpi.com/…/pdf`(=403). 회원 1968 의 `resource-links-current` **0.049%** |
| **Europe PMC** | ✅ **전체 JATS XML** | 4편 GET 전부 200 (121KB~304KB) |
| res.mdpi.com | ✅ PDF | §1-3 — 채택안 아님 |

Europe PMC 전문 호출 예시(실측 200):

```
GET https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12774332/fullTextXML
```

SPEC §2 의 기준("초록만 오면 지문으로 못 쓴다")에 **MDPI 직접 경로는 그대로 걸린다.**

---

## 3. 라이선스 — CC BY 4.0, 변형 가능, 그리고 **항목마다 필드가 온다**

- OAI: 레코드마다 `<dc:rights>`. 두 날짜 표본 **100건 100%** `https://creativecommons.org/licenses/by/4.0/`.
- Crossref: 항목마다 `license[].URL` + `content-version: vor` + `delay-in-days: 0`.
  회원 1968 커버리지 `licenses-current` **99.35%** · `licenses-backfile` **97.19%**.
- JATS: `<license xlink:href>` + `<license-p>` — 표본 4/4 "Creative Commons Attribution (CC BY) license".

**변형 가능**(ND 아님 · NC 아님 · SA 아님). 항목별 필드가 있으므로 예외(일부 MDPI 저널의
CC BY-NC-ND 특약)는 **수확 시점에 기계적으로 걸러진다** — 표본에서 NC·ND 는 나오지 않았으나
"전량 CC BY" 라고 단정하지 않는다. 필드를 믿고 필드로 거르면 된다.

---

## 4. 안정 식별자

| 경로 | 필드 | 예 |
|---|---|---|
| 전 경로 공통 | **DOI** | `10.3390/su13137263` |
| OAI | `header/identifier` | `oai:mdpi.com:/2071-1050/13/13/7263/` (ISSN·권·호·쪽 = 구조화되어 있어 파생 가능) |
| Europe PMC | `pmcid` | `PMC12774332` |

DOI 가 세 경로를 잇는 열쇠다. **Europe PMC 로 받은 뒤에도 `10.3390/` 접두로 MDPI 임을
식별할 수 있으므로**, 나중에 PMC 수확을 별도로 하더라도 이 소스와의 중복은 DOI 로 막힌다.

---

## 5. 증분 커서 — OAI 는 되지만 **날짜의 뜻이 다르다**

- 방법: `from` / `until`(YYYY-MM-DD) + `resumptionToken`. 토큰 기반이라 정렬 사고는 없다.
- ⚠️ **`datestamp` 는 발행일이 아니라 레코드 갱신일이고, MDPI 는 옛 글을 대량 재스탬프한다.**
  실측: `from=until=2025-01-02` 배치 50건의 `dc:date` 는 **2016·2017년**,
  `from=until=2026-09-01` 배치의 `dc:date` 는 **2024년**이었다.
  즉 "지난번 이후 나온 새 글" 이 아니라 "지난번 이후 손댄 레코드" 가 온다 —
  **누락은 없고 중복이 많은** 커서다. DOI 로 upsert 하면 안전하지만 GET 은 낭비된다.
- 발행일로 자르려면 Crossref 쪽 커서(`filter=from-pub-date`)를 쓰는 편이 정확하다.
- Europe PMC 경로: `cursorMark` + `sort=P_PDATE_D desc` — PLOS 수확기가 이미 쓰는 형태.

---

## 6. 현실적 확보 가능 편수 — 정찰로 센 값

| 저널 | Crossref 총계 | **Europe PMC 전문**(`HAS_FT:Y`) | 비 |
|---|---|---|---|
| **Sustainability** (2071-1050) | 108,659 | **83** | 0.08% |
| **Societies** (2075-4698) | 2,055 | **12** | 0.58% |
| Arts (2076-0752) | 1,529 | **0** | — |
| Humanities (2076-0787) | 1,777 | **1** | — |
| Philosophies (2409-9287) | 1,054 | **0** | — |
| Religions (2077-1444) | 10,635 | **15** | — |
| Education Sciences (2227-7102) | 8,727 | **18** | — |
| **MDPI 전체** | **2,195,088** (회원 1968) | **1,058,400** | 48% |

**목표 표의 1,000편은 대상 저널로는 안 나온다.** Sustainability + Societies 의 접근 가능
전문은 **95편**이고, MDPI 가 목표 표에 오른 진짜 이유였던 인문 저널
(Arts·Humanities·Philosophies·Religions — `csat-source-fit-20260903.md` §9·§14 의 병목 칸)은
**합쳐서 16편**이다. 인문 결손 11,000편에 대해 **0.15%** 다.

한편 MDPI 전체는 Europe PMC 에 **1,058,400편**이 전문으로 있고 전부 `10.3390` 접두다
(`PUBLISHER` 필드 유효성 확인: 오타 발행사 질의 = 0건 · `Public Library of Science` = 126,332
로 PLOS 실적과 정합). 그러나 그 100만편은 IJERPH 66,626 · Sensors 80,054 · Nutrients 39,097
같은 **의생명·공학**이고, 저장소가 이미 PLOS 47,939편으로 채우고 있는 칸이다.
**병목 칸(예술·문화)에는 한 편도 보태지 않는다.**

### PMC 와의 중복 — 물었던 질문에 대한 답

| | |
|---|---|
| MDPI 전체 | Crossref 2,195,088 중 **1,058,400(48%)** 이 PMC/Europe PMC 에도 있다 → **중복 매우 큼** |
| **Sustainability** | 108,659 중 **83(0.08%)** → **사실상 중복 없음**(= 전문도 없음) |
| **Societies** | 2,055 중 **12(0.58%)** → 사실상 중복 없음 |
| 현재 저장소 | `library_articles` 에 PMC·EPMC 출처 **0행** (source: plos 47,939 · gutenberg 36,635 · futurity 2,885 · original 1,419 · usgs 738 · nasa 422 · elife 301 …) — **지금은 중복이 발생하지 않는다** |

⚠️ **그러나 나중에 "Europe PMC" 를 별도 소스로 채택하면 이 100만편과 정면 충돌한다.**
MDPI 를 EPMC 경유로 담으면 그건 이름만 MDPI 이고 실체는 PMC 수확이다. **둘 중 하나만 판다.**

---

## 7. 지문 적합성 표본 판정 — 4편

접근 가능한 전문이 Europe PMC 뿐이라 **표본도 그 안에서만 뽑을 수 있었다**
(= 대상 저널의 PMC 노출분은 보건·의료 인접 주제로 치우쳐 있다. 아래 판정의 편향 원인).
각 편의 `<body>` 첫 문단들을 280어 넘을 때까지 이어 붙여 봤다.

| # | 저널 · DOI | 첫 문단 어수 | verdict | genre | why |
|---|---|---|---|---|---|
| 1 | Sustainability `10.3390/su17094177` (PMC12774332) | 435 | `use` | `environment` | 통념(협력적 환경 거버넌스 틀)을 세우고 "틀이 실제로 설명하는가" 로 반전한 뒤 이 연구의 물음으로 닫는다 — 서론 정석 구조 |
| 2 | Sustainability `10.3390/su17094080` (PMC12802863) | 439 | `use` | `environment` | 타이어 마모 입자의 발생·이동·독성을 단계로 설명하는 자족적 해설문이나, `6PPD-quinone`·`N-(1,3-dimethylbutyl)-N'-phenyl-p-phenylenediamine` 같은 화학명이 낱말 길이 상한을 밀어 올린다 |
| 3 | Societies `10.3390/soc15120333` (PMC12826567) | 346 | `reject` | `polemic` | "White supremacy continues to undermine…" 로 시작해 미국 인종 정치의 한 입장을 전제로 깔고 논지를 세운다 — 학술문이지만 고교 교재 지문으로는 일방적이다 |
| 4 | Societies `10.3390/soc16040112` (PMC13229574) | 396 | `reject` | `polemic` | 3번과 같은 전제 위에 서 있고, 셋째 문단부터 `(1)(2)(3)` 개입 유형 나열로 넘어가 읽는 글이 아니라 목록이 된다(`reference` 성격도 겹침) |

**2/4 `use`.** 구조 자체는 좋다 — MDPI 서론은 PLOS 와 같은 「통념 → 간극 → 이 연구」 형태라
300어대로 자르면 지문이 된다. 걸리는 것은 둘이다:

- **어휘 대역.** 2번처럼 화학·공학 전문어가 박히면 `lib-fit.mjs` 의 평균 낱말 길이 상한
  (5.36자 — §15 실측)을 넘길 가능성이 크다. 실제 채점은 하지 않았다(수확 금지 범위).
- **소재 편향.** 접근 가능한 Societies 12편이 전부 미국 보건 형평·인종 주제 쪽이다.
  이건 저널의 성격이 아니라 **PMC 에 실리는 것만 보이기 때문**이다 —
  Societies 본편 2,055편의 소재 분포는 이 표본으로 추정하면 안 된다.

**인용 표시(`[12]`)는 JATS 의 `<xref>` 를 지우면 깨끗이 빠진다**(위 발췌가 그 결과다).
PLOS 발췌의 최대 탈락 사유였던 그림 캡션 조각은 `<body>` 의 `<p>` 만 뽑으면 섞이지 않았다.

---

## 8. 수확기를 짠다면

**지금은 짜지 않는 것을 권한다.** 대상 저널의 접근 가능 전문이 95편이라 어떤 수확기를
짜도 목표(1,000편)의 10%에서 멈춘다. 그래도 길을 셋으로 적어 둔다.

### A안 — Europe PMC 경유 (지금 유일하게 정당하고 작동하는 길)

- **본뜰 것**: `scripts/csat/harvest-plos.mjs`. 구조가 그대로 맞는다 —
  cursorMark 기반 목록 → 전문 GET → **적재 전 `lib-fit.mjs` 채점**(§10 의 "버릴 것을 담지 않는다").
- 목록: `…/europepmc/webservices/rest/search?query=ISSN:"2071-1050" AND HAS_FT:Y&cursorMark=…&format=json&pageSize=100`
- 전문: `…/europepmc/webservices/rest/<PMCID>/fullTextXML` → `<body>` 의 `<p>` 만, `<xref>` 제거.
- ⚠️ PLOS 수확기가 실측으로 잡은 함정 ①(정렬키를 id 로 두면 적합률 2.5%)이 여기도 그대로다.
  `sort=P_PDATE_D desc` 로 고정할 것.
- 커서 파일: `scripts/csat/data/mdpi-epmc-cursor.json` (`{ issn, cursorMark, seenDois }`).
- **1회에 끝난다** — 95편이다. 나눌 필요가 없다.

### B안 — OAI-PMH 로 메타데이터만 (지문 수확이 아니다)

전문이 안 오므로 **지문 소스로는 성립하지 않는다.** 다만 "MDPI 전체에 어떤 글이 있는가" 를
DOI·ISSN·CC BY 라이선스와 함께 훑는 데는 유효하다(장래 판단 근거용).
`scripts/acp/collect-daily.mjs` 형(날짜 커서)에 가깝고, 커서는
`scripts/csat/data/mdpi-oai-cursor.json` 에 `{ lastDatestamp, resumptionToken }`.
⚠️ 재스탬프 때문에 **한 바퀴가 2.2M 을 훨씬 넘는다**(2026-09-01 하루만 1,463건).
저널 set 이 없어 전량을 훑어야 하고 Sustainability 는 200:1 로 걸러진다 — **비용이 성과를 넘는다.**

### C안 — res.mdpi.com PDF (사용자 승인 없이는 짜지 않는다)

경로는 확인됐다(§1-3). 짠다면 `scripts/textbook/` 의 PDF 처리 계열을 본뜨고,
ISSN→슬러그 매핑표를 정본으로 두고(`taxonomy.mjs` 형 순서 있는 규칙표),
`www` 는 **한 번도 건드리지 않는다**. 다만 위 세 가지 이유로 **제안하지 않는다.**

---

## 9. 확인 실패로 남긴 것 (추정하지 않았다)

| 항목 | 왜 못 했는가 |
|---|---|
| MDPI 의 크롤링 허용 범위 | `robots.txt` 가 403 이다 — 읽을 방법이 없다 |
| OAI 전체 레코드 총계 | 저널 set 이 없고 `ListIdentifiers` 전량 훑기가 대량 수확에 해당한다. 하루치 `completeListSize`(1,463)만 실측했고 **거기서 총계를 추정하지 않았다** |
| MDPI 전체의 CC BY 비율 | 표본 100/100 이 CC BY 4.0 이었을 뿐이다. NC·ND 특약 저널의 존재 여부는 안 셌다 |
| 표본의 `lib-fit.mjs` 점수 | 채점하려면 본문을 더 받아야 해 정찰 범위를 넘는다. §7 의 어휘 대역 우려는 **읽고 판단한 것이지 잰 것이 아니다** |
| Sustainability 본편의 소재 분포 | PMC 노출 83편으로는 108,659편을 대표하지 못한다 |
