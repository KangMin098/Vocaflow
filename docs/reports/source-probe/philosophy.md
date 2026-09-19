<!-- docs/reports/source-probe/philosophy.md -->
# 철학 5개 소스 확보 정찰 (SEP · IEP · PhilArchive · PhilSci-Archive · Philosophers' Imprint)

목표 표 32·42·59위 묶음. 목표 추정 **합계 600편** (SEP·IEP 를 채택률 20% 로 높게 잡은 값).

## 결론 한 줄

**5곳 전부 반려.** 확보 가능 편수 **0**. 걸린 곳은 전부 3번 항목(라이선스)이고,
전문(2번)·대량 접근 경로(1번)에서도 3곳이 추가로 걸린다. 목표 표의 600편은 **회수 불가**로 지운다.

| 소스 | 라이선스 (1차 자료) | 변형 | 전문 | 대량 경로 | 판정 |
|---|---|---|---|---|---|
| Stanford Encyclopedia of Philosophy | 저자 저작권 + Metaphysics Research Lab · **CC 아님** | **불가** | HTML 열람만 | 크롤은 색인 목적만 허용 | **반려** |
| Internet Encyclopedia of Philosophy | IEP + 저자 · **CC 아님** · "not open source or in the public domain" | **불가** | HTML 열람만 | 재게시 명시 금지 | **반려** |
| Philosophers' Imprint | **CC BY-NC-ND 4.0** (Crossref 입고 + DOAJ) | **불가 (ND)** | PDF 온다 | Anubis PoW 차단 | **반려** |
| PhilArchive | 항목별 라이선스 **필드 없음** · 일괄 ToS ("may not modify") | **불가** | **안 온다 (초록만)** | OAI-PMH 있음 | **반려** |
| PhilSci-Archive | 표본 114건 중 CC **0** (null 113 · other-oa 1) | 확인 불가 | 확인 실패 (차단) | **확인 실패 (F5 차단)** | **반려** |

정찰 일자 **2026-09-07**. DB 에 쓰지 않았고, 표본 외 대량 내려받기를 하지 않았다.

---

## 1. Stanford Encyclopedia of Philosophy — 반려 (라이선스)

| | |
|---|---|
| 판정 | **반려** |
| 확보 가능 편수 | **0** (열람 가능 항목은 실측 1,865 — 아래) |
| 라이선스 | 저자 개별 저작권 + 전체는 Metaphysics Research Lab · **CC 아님** · 변형 **불가** |
| 전문 | HTML 로 열람은 되나 재배포 권리 없음 |
| 안정 식별자 | entry slug (`/entries/<slug>/`) — 고정이나 무의미 |
| 증분 커서 | 해당 없음 |
| 정찰 일자 | 2026-09-07 |

**1차 자료**: <https://plato.stanford.edu/info.html> (2026-09-07 취득).

- "Authors contributing an entry or entries to the *Stanford Encyclopedia of Philosophy*,
  except as provided herein, **retain the copyright** to their entry or entries."
- 전체 저작권은 "held by the **Metaphysics Research Lab** at Stanford University."
- 이용자에게 주는 것은 **"royalty-free non-exclusive limited license to read, download,
  make copies, print, search, or link"** 과 **"to crawl each entry for indexing"** 뿐이다.
- 전자 배포는 **본인 기기 · 30명 미만 사적 서신 · 링크**로 제한되고,
  인쇄 배포는 **저자의 사전 서면 허가**를 요구한다.
- **CC 라이선스 문구는 문서 어디에도 없다.**

⚠️ **"무료 열람 = 재배포 허가" 가 아니라는 것이 여기서 문자 그대로 확인된다.** SEP 는
무료·개방으로 널리 알려져 있지만 이용 허가는 "읽고, 내려받고, 색인해라"까지이고
**발췌해 교재에 싣는 것은 명시적으로 저자 허가 사항**이다. 목표 표가 SEP 를 채택률 20% 로
높게 잡은 것은 콘텐츠 품질 판단으로는 옳지만 **권리 확인을 건너뛴 값**이다.

**확보 가능 편수**: `contents.html` 에서 중복 제거한 entry 링크 **1,865개** 실측
(`grep -o 'href="entries/[^"/]*/"' | sort -u | wc -l`). 라이선스가 막으므로 채택 편수는 0.

**색인 크롤은 허용되지만 우리 용도가 아니다** — 우리는 지문을 잘라 교재에 싣는다.

---

## 2. Internet Encyclopedia of Philosophy — 반려 (라이선스)

| | |
|---|---|
| 판정 | **반려** |
| 확보 가능 편수 | **0** |
| 라이선스 | IEP + 저자 공동 저작권 · **CC 아님** · 변형 **불가** |
| 전문 | HTML 열람만 |
| 안정 식별자 | URL slug |
| 증분 커서 | 해당 없음 |
| 정찰 일자 | 2026-09-07 |

**1차 자료**: <https://iep.utm.edu/copyright/> (2026-09-07 취득).

- "All articles are **copyrighted by The IEP and the authors** of the original articles"
- 자료는 **"not open source or in the public domain"** 이라고 스스로 못박는다.
- **"Copies of IEP articles cannot be posted elsewhere on the Internet"** — 인터넷 재게시 명시 금지.
  우리 서비스는 웹이므로 이 한 줄이 그대로 차단이다.
- ISBN 이 붙는 출판물에 쓰려면 general editor 에게 연락해 개별 허가를 받아야 한다.
- 허용되는 것은 **교육용 코스팩(오프라인)** 과 **350단어 이하 인용(출처 표기)** 뿐.

우리 지문은 300어대로 자른다 — 350단어 인용 예외에 걸쳐 보이지만, **인터넷 게시 금지**가
별도 조항으로 걸려 있어 예외가 되지 않는다. 게다가 "인용"이 아니라 **본문을 지문으로 싣는 것**은
fair use 인용의 성격이 아니다.

---

## 3. Philosophers' Imprint — 반려 (ND)

| | |
|---|---|
| 판정 | **반려** |
| 확보 가능 편수 | **0** (Crossref 실측 170편이 존재하나 라이선스가 막음) |
| 라이선스 | **CC BY-NC-ND 4.0** · 변형 **불가** (ND) · 상업 이용 **불가** (NC) |
| 전문 | PDF 로 온다 (galley download URL) |
| 안정 식별자 | **DOI** (`10.3998/phimp.<n>`) |
| 증분 커서 | Crossref `from-index-date` 사용 가능 (미사용) |
| 정찰 일자 | 2026-09-07 |

**1차 자료 2종이 일치한다** (2026-09-07 취득):

1. **Crossref** — 출판사가 직접 입고한 라이선스 필드.
   `https://api.crossref.org/journals/1533-628X/works?select=DOI,title,license,link`
   → `total-results: **170**`, 표본 6편 **전부**
   `"URL":"https://creativecommons.org/licenses/by-nc-nd/4.0"`, `delay-in-days: 0`.
2. **DOAJ** — `https://doaj.org/api/search/journals/issn%3A1533-628X`
   → `{"NC":true,"ND":true,"BY":true,"type":"**CC BY-NC-ND**","SA":false}`.

**ND 는 SPEC §3 이 명시한 반려 사유다** — The Conversation 과 같은 사유. 300어대로 자르는 것
자체가 파생물 제작(abridgement)이고, 우리 파이프라인은 여기에 더해 문항·주석·난이도 조정을 붙인다.
**NC 도 함께 걸린다** — 목표 표의 용도는 상업 교재다. 두 겹으로 막혀 협상 여지가 없다.

부차 확인: 사이트가 **Anubis proof-of-work 챌린지**로 봇을 차단한다
(`/about/` · `/oai?verb=Identify` 둘 다 `"Making sure you're not a bot!"` HTML 반환, version 1.25.0).
라이선스가 통과했더라도 **대량 접근 경로를 따로 뚫어야 했을 것**이다. 지금은 무의미하다.

---

## 4. PhilArchive — 반려 (전문이 안 옴 + 라이선스 필드 없음)

| | |
|---|---|
| 판정 | **반려** |
| 확보 가능 편수 | **0** (아카이브 규모는 144,101 works — 사이트 자체 카운터) |
| 라이선스 | **항목별 필드 없음.** 일괄 ToS 참조 — "Users **may not modify** or sell" · 변형 **불가** |
| 전문 | **안 온다** — OAI 는 초록까지 (999건 중 PDF 링크 **0**) |
| 안정 식별자 | `oai:philarchive.org/rec/<REC>` · `https://philarchive.org/rec/<REC>` |
| 증분 커서 | `from`/`until` (초 단위) + `resumptionToken` — **작동 확인** |
| 정찰 일자 | 2026-09-07 |

### 실제 호출 (2026-09-07)

```
GET https://philarchive.org/oai.pl?verb=Identify                → 200 text/xml
GET https://philarchive.org/oai.pl?verb=ListMetadataFormats     → oai_dc 하나뿐
GET https://philarchive.org/oai.pl?verb=ListSets                → setSpec 0개 (세트 없음)
GET https://philarchive.org/oai.pl?verb=ListRecords&metadataPrefix=oai_dc  → 999 records / 2.28 MB
```

`Identify` 응답: `earliestDatestamp 2008-01-01` · `deletedRecord **transient**` ·
`granularity YYYY-MM-DDThh:mm:ssZ` · `compression deflate`.

### 걸린 것 ① — 전문이 안 온다 (SPEC §2)

999 레코드 표본에서 **dc:identifier 중 `.pdf` 를 가리키는 것 0건**. 오는 것은
`title` · `creator` · `subject`(전부 "Philosophy" 고정) · `date` · `language` · `type` ·
`identifier`(레코드 랜딩 URL) 와 **초록**(999건 중 868건)뿐이다.
전문 PDF 는 레코드 페이지 뒤에 있고, 그 페이지는 **Cloudflare 인터스티셜**이 막는다
(`/rec/BRADR` 요청 → `<title>Just a moment...</title>` 5,646바이트).
**초록만 오는 소스는 채택률이 0 에 수렴한다**(SPEC §2, PLOS 대비 근거).

### 걸린 것 ② — 항목별 라이선스 필드가 아예 없다 (SPEC §3)

999 레코드에 **`dc:rights` 0건**. 대신 모든 레코드가 같은 문장을 단다:

```xml
<about><rights><rightsReference>https://philpapers.org/help/terms.html</rightsReference></rights></about>
```

즉 **"항목마다 다르다"는 사실 자체를 메타데이터로 알 수 없다** — CC 인 것만 골라내는
필터를 짤 수가 없다. 그리고 그 참조 대상인 ToS(2026-09-07 취득)가 기본값을 정한다:

- §1 "**Users may not modify or sell these works** unless given permission by the copyright holder."
- §2 PhilPapers Foundation 은 본문에 대해 **아무 지적재산권도 얻지 않는다**(= 재라이선스 불가).
- §10 "**For-profit redistribution** of data from the Services ... is **prohibited**
  unless permission has been granted explicitly by the editors."
- §8 "**Mass-querying of the site using scripts is considered a form of abuse.**"

`robots.txt` 도 같은 방향이다 — `Content-Signal: search=yes,**ai-train=no**,use=reference`,
`User-agent: ClaudeBot / GPTBot / CCBot / Google-Extended → Disallow: /`, 그리고
"The collection of content ... through automated means ... **is prohibited** except
(1) search engine indexing or AI retrieval augmented generation or (2) express written permission."

### 그 밖에 실측한 것 (기록용)

- 아카이브 규모 **144,101 works** · 6,155 topics (홈페이지 카운터).
- `resumptionToken` 에 **`completeListSize` 속성이 없다** → 전수를 세려면 끝까지 페이징해야 하는데,
  그것이 곧 ToS §8 위반이라 **세지 않았다**(SPEC §6 "못 셌으면 못 셌다고 적는다").
- 999건 언어 분포: **en 758 (75.9%)** · es 29 · uk 27 · zh 24 · pt 23 · ar 22 · ru 16 · fr 14.
  영어 비율이 4분의 3이라 언어 필터가 별도로 필요했을 것이다.
- 유형: article 866 · book 100 · review 33.
- `from=2026-08-01` 창의 999건이 **전부 `status="deleted"`** 였다(`deletedRecord: transient`).
  날짜 창을 잘못 잡으면 삭제 표식만 받아 오는 함정이 있다 — 커서 설계 시 주의점이나, 반려라 무의미.

---

## 5. PhilSci-Archive — 반려 (CC 아님) + 접근 확인 실패

| | |
|---|---|
| 판정 | **반려** |
| 확보 가능 편수 | **0** (리포지터리 규모 5,572 works — OpenAlex `S4306401282`) |
| 라이선스 | **표본 114건 중 CC 0건** (null 113 · other-oa 1) · 변형 **근거 없음** |
| 전문 | **확인 실패** — 사이트가 차단 |
| 안정 식별자 | EPrints ID (`philsci-archive.pitt.edu/<n>/`) |
| 증분 커서 | **확인 실패** — OAI 엔드포인트 도달 불가 |
| 정찰 일자 | 2026-09-07 |

### 접근: 막혔다 (추정 아님, 실측)

`philsci-archive.pitt.edu` 는 **F5 TrafficShield(TSPD) 자바스크립트 챌린지** 뒤에 있다.
아래 전부 챌린지 HTML 을 반환했다 (2026-09-07):

| 요청 | 결과 |
|---|---|
| `https://.../cgi/oai2?verb=Identify` (curl, 브라우저 UA, 쿠키 저장, 3회 재시도) | 7,461바이트 챌린지 HTML — 3회 모두 동일 |
| `http://.../cgi/oai2?verb=Identify` | 302 |
| `https://.../robots.txt` | 200이나 **49KB `text/html`** = 챌린지 페이지 |
| `https://.../information.html` (WebFetch) | "requested URL was rejected" |

**OAI-PMH 가 있는지 없는지 나는 확인하지 못했다.** EPrints 관례상 `cgi/oai2` 가 있을 것이라는
추정은 SPEC §정직함이 금지하는 종류의 말이므로 적지 않는다. 다른 망에서 재정찰하면
경로 자체는 확인될 가능성이 높다 — 그러나 **아래 라이선스 실측이 그것과 무관하게 반려를 확정한다.**

### 라이선스: 우회 경로로 실측했고, CC 가 없다

사이트가 막혀 있으므로 **OpenAlex** 로 리포지터리 사본의 라이선스 필드를 셌다.

```
GET https://api.openalex.org/works?filter=locations.source.id:S4306401282&per-page=100&select=id,locations
→ PhilSci-Archive location 114건: license null 113 · other-oa 1 · CC 0
```

⚠️ **함정 하나를 피했다.** `group_by=best_oa_location.license` 로 세면
cc-by 1,606 · cc-by-nc-nd 772 … 처럼 **CC 가 풍성해 보인다**. 그러나 그 값은 같은 논문의
**저널 판본** 라이선스이지 PhilSci 기탁본의 것이 아니다. 리포지터리 사본만 골라 세면
**113/114 가 라이선스 없음**이다. 이 구분을 놓쳤으면 "CC BY 1,606편 확보 가능" 이라는
틀린 숫자를 보고할 뻔했다.

즉 PhilSci-Archive 기탁본은 **저자가 저작권을 그대로 쥔 프리프린트/포스트프린트**이고,
아카이브는 라이선스를 요구하지도 기록하지도 않는다. **변형 허가의 근거가 없다** → 반려.

(CC BY 인 저널 판본이 실제로 있다면 그것은 PhilSci-Archive 가 아니라
**해당 오픈액세스 저널**을 소스로 잡아야 한다 — 별건이다.)

---

## 지문 적합성 표본 판정 (SPEC §7)

**5곳 전부 라이선스에서 먼저 반려됐으므로 300어대 발췌 판정은 수행하지 않았다.**
권리 없는 본문을 지문으로 잘라 보는 것은 판정에 쓸모가 없고, SPEC §7 은 채택 후보에 적용된다.

다만 메타데이터로 관측한 것 하나는 기록해 둔다 — PhilArchive 표본의 제목·초록은
`Judgment Aggregation with Consistency Alone`, `Two paradoxes of bounded rationality` 처럼
**형식논리·전문 술어가 조밀한 학술 논문**이다. 자족적 논증문이라는 점에서 `use` 장르이긴 하나,
수능/교재 지문으로 쓰려면 **PLOS 급보다 훨씬 강한 난이도 필터와 발췌 지점 선별**이 필요했을 것이다.
목표 표의 채택률 20% 는 SEP·IEP(백과사전 문체, 실제로 지문에 잘 맞는다)를 보고 잡은 값인데,
**정작 그 두 곳이 라이선스로 막힌 곳**이다.

---

## 수확기를 짠다면

**짜지 않는다.** 5곳 전부 반려이므로 `scripts/` 에 아무것도 추가하지 않았고 커서 파일도 두지 않았다.

나중에 조건이 바뀌면 아래가 재검토 지점이다:

| 소스 | 다시 볼 조건 | 그때 본뜰 것 |
|---|---|---|
| Philosophers' Imprint | 저널이 ND 를 떼고 CC BY 로 전환하면 | Crossref API 형 — `scripts/csat/harvest-plos.mjs` (DOI 커서 · `from-index-date`). Anubis 우회는 별도 문제이므로 **PDF 는 Crossref `link` 의 galley URL 로** |
| PhilSci-Archive | 개별 논문의 저널 판본이 CC BY 인 건을 **저널 쪽에서** 잡을 때 | 이 리포지터리가 아니라 해당 저널을 새 소스로 정찰 |
| PhilArchive | ToS §1 의 "may not modify" 가 항목별 CC 필드로 대체되면 | OAI-PMH 형 — `from`/`until` + `resumptionToken`, 커서는 `scripts/csat/data/philarchive-cursor.json`. 단 **초록만 오는 문제는 그대로**라 전문 경로가 따로 필요 |
| SEP · IEP | Metaphysics Research Lab / IEP general editor 와 **개별 서면 허가**를 맺을 때만 | 기술 문제가 아니라 계약 문제 — 수확기 이전에 허가서가 먼저 |

## 목표 표에 반영할 것

- 32위·42위·59위(SEP·IEP·PhilSci-Archive) 및 함께 정찰한 PhilArchive·Philosophers' Imprint —
  **추정 600편 → 실측 0편**.
- 이 묶음의 교훈: **"무료로 읽힌다"를 "쓸 수 있다"로 읽은 항목이 목표 표에 더 있을 수 있다.**
  백과사전·학회지 계열은 전문이 열려 있어도 CC 가 아닌 경우가 많다 —
  다음 정찰부터는 **라이선스를 첫 질문으로** 두고, CC 가 아니면 나머지 6항목을 조사하지 않는 편이 빠르다.
