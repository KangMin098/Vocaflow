<!-- docs/reports/source-probe/muse-jstor-open.md -->
# Project MUSE Open Access / JSTOR Open Access Books 확보 정찰

| | |
|---|---|
| 판정 | **반려** (두 곳 모두) |
| 확보 가능 편수 | **목록 23,649권 / 전문 0권.** MUSE OA 도서 7,425 (KBART·title list 실측) · JSTOR OA 도서 16,224 (title list 실측). 전문(full text)은 **양쪽 다 0** — 봇 차단으로 한 권도 못 받았다 |
| 라이선스 | **소스 메타데이터에 라이선스 필드가 없다.** 양쪽 다 「OA 여부」(`access_type=F` / OA 컬렉션 소속)만 알려주고 CC 종류는 안 알려준다. 제3자(DOAB)로 표본 확인한 것은 **전부 NC 또는 ND** — 변형 **불가/조건부** |
| 전문 | **안 온다.** MUSE 는 FriendlyCaptcha `/verify`, JSTOR 는 "Client Challenge" 인터스티셜. 표본 전량(MUSE 1/1 · JSTOR 4/4) 차단 |
| 안정 식별자 | MUSE = `title_id`(정수, `https://muse.jhu.edu/book/<id>`) + eISBN · JSTOR = `Book ID`(DOI 형태 `10.2307/j.ctv…`) + Stable URL + eISBN |
| 증분 커서 | MUSE = OAI-PMH `from`/`until` (**작동 실측**) 또는 KBART 재내려받기 · JSTOR = 목록 재내려받기 + `Date Available on JSTOR` 컬럼 diff (API 없음) |
| 정찰 일자 | 2026-09-07 |

> 목표 표는 이 소스를 **5위 · 채택 추정 4,500편**으로 잡고 있었다. 정찰 결과 **목록은 추정보다 5배 크지만
> (23,649권) 전문 확보 경로가 없어 실질 확보 가능 편수는 0** 이다. 추정치는 "OA 라고 적혀 있다" 를
> "가져올 수 있다" 로 오해한 값이다.

---

## 1. 대량 접근 경로

### Project MUSE — 메타데이터는 열려 있다

| 경로 | 실제 URL | 실측 결과 |
|---|---|---|
| OAI-PMH | `https://muse.jhu.edu/oai?verb=Identify` | **HTTP 200.** repositoryName `Project MUSE` · protocolVersion 2.0 · granularity `YYYY-MM-DD` · earliestDatestamp `2016-08-31` · deletedRecord `transient` |
| 메타데이터 포맷 | `?verb=ListMetadataFormats` | **`oai_dc` 하나뿐.** MARCXML·ONIX 없음 |
| 세트 | `?verb=ListSets` | **972개.** `books_1900`…`books_2025` (연도별) + 저널 약어 900여 개. **OA 세트는 없다** — OAI 로 OA만 뽑아낼 방법이 없다 |
| 레코드 | `?verb=ListRecords&metadataPrefix=oai_dc&set=books_2023` | HTTP 200 · 989 KB · 1,000 레코드/페이지 · `completeListSize="5040"` · `resumptionToken` 정상 |
| **OA 도서 KBART** | `https://about.muse.jhu.edu/lib/metadata?format=kbart&content=book&include=oa&filename=open_access_books&no_auth=1` | **HTTP 200 · 1,410,007 B · TSV 27열 7,428행.** 인증 불필요 |
| OA 도서 title list | 같은 경로 `format=title_list` | HTTP 200 · xlsx 1,050,668 B · 7,425 데이터행 · **Language·Discipline 컬럼 있음** |
| OA 도서 MARC | 같은 경로 `format=marc` (+ 월별 증분판 별도 링크) | 링크 존재 (본 정찰에서 내려받지 않음) |
| 사이트맵 | `https://muse.jhu.edu/sitemap.xml` | HTTP 200 · sitemapindex (`sitemap_articles_N.xml.gz` 등) |

⚠️ `/lib/metadata` 는 **`about.muse.jhu.edu` 호스트에서만** 200 이다. `muse.jhu.edu/lib/metadata` 는 404 를
HTML 로 돌려준다(200 아님, 404 — 그런데 본문은 정상 페이지처럼 생겼다. 스크립트가 `content_type` 만 보고
성공으로 세면 조용히 빈 결과가 된다).

### JSTOR — 목록 파일 하나뿐, API 는 없다

| 경로 | 실제 URL | 실측 결과 |
|---|---|---|
| **OA 도서 목록** | `https://www.jstor.org/titlelists/books/open_access_collection/?fileFormat=csv` | **HTTP 200 · 8,728,292 B · TSV 22열 16,224행.** 파일명에 생성일이 박힌다(`Books_at_JSTOR_Open_Access_Collection_2026-09-07.txt`) — 챌린지 없이 통과 |
| 같은 목록 xlsx | `…?fileFormat=xlsx` | HTTP 200 · 4,156,393 B |
| API | — | **없다.** `robots.txt` 가 `/api` 를 전 UA 에 Disallow. Constellate(구 Data for Research) 는 공개 API 가 아니며 본 정찰 시점에 대체 경로를 못 찾았다 |
| 사이트맵 | `https://www.jstor.org/sitemap.xml` | HTTP 200 · gzip · sitemapindex 2,048개 하위 사이트맵. 다만 그 안의 `/stable/*` URL 은 아래 §2 처럼 전부 차단 |
| OAI-PMH | — | **없다** (`/oai` 계열 엔드포인트 미발견) |

---

## 2. 전문(full text)이 오는가 — **안 온다. 이것이 반려 사유다**

### MUSE: 전문 URL 은 HTML 안에 있는데, 요청하면 캡차로 간다

OA 도서 페이지(`https://muse.jhu.edu/book/146663`, *Meet Me at the Library*, Princeton UP)는 200 으로 잘 뜬다.
그 HTML 안에 전문 링크가 **실제로 들어 있다**:

```
<meta name="citation_pdf_url" content="https://muse.jhu.edu/pub/267/edited_volume/book/146663/pdf">
/pub/267/edited_volume/chapter/4362295        ← 챕터 본문 HTML
/pub/267/edited_volume/chapter/4362295/pdf    ← 챕터 PDF
```

그런데 그 링크를 실제로 호출하면:

```
$ curl -D - https://muse.jhu.edu/pub/267/edited_volume/chapter/4362295/pdf
HTTP/1.1 302 Found
Location: /verify?url=%2Fpub%2F267%2Fedited_volume%2Fchapter%2F4362295%2Fpdf&r=1627137
```

`/verify` 는 **FriendlyCaptcha 작업증명 위젯** 페이지이고, 본문에 이렇게 적혀 있다:

> "Verification required! In order to better serve you and keep this site secure, please complete this
> challenge. **If you are trying to perform text/data mining, please contact Customer Service** for assistance."

즉 **TDM 은 사전 허가 사항**이라고 소스가 명시하고 있다. 챕터 HTML(`/chapter/…`)도 같은 302 를 받는다.
`robots.txt` 도 `User-agent: *` 에 대해 `/chapter`·`/chapter/`·`/pub`·`/pub/`·`/search` 를 Disallow 한다 —
**전문이 있는 경로가 통째로 차단 대상**이다. 우회는 시도하지 않았다.

### JSTOR: 도서 페이지 자체가 안 열린다

OA 목록에서 뽑은 영어 OA 도서 4권의 Stable URL 을 그대로 호출한 결과, **4/4 전부** 3,038 바이트짜리
`Client Challenge` 인터스티셜이 돌아왔다(HTTP 200 이지만 내용은 봇 검문 페이지다 — 상태코드만 보면
성공으로 오인한다):

| Stable URL | 출판사 | 결과 |
|---|---|---|
| `/stable/10.2307/jj.28526493` | Punctum Books | Client Challenge |
| `/stable/10.3998/mpub.12986336` | University of Michigan Press | Client Challenge |
| `/stable/10.2307/j.ctt24hdz7` | ANU Press | Client Challenge |
| `/stable/10.2307/j.ctt5hgz91` | ANU Press | Client Challenge |

게다가 `https://www.jstor.org/robots.txt` 는 주석과 함께 **모델 학습 목적 크롤링을 명시적으로 금지**한다:

```
# Disallow crawling for the purposes of training models
User-agent: ClaudeBot
User-agent: CCBot
User-agent: GPTBot
User-agent: Google-Extended
Disallow: /
```

`/stable/full`·`/api`·`/action` 도 전 UA Disallow. **JSTOR 는 프로그램 접근을 원하지 않는다고 명문화한
소스다.** 우회는 시도하지 않았다.

---

## 3. 라이선스 — 소스가 안 알려준다. 알아낸 것은 전부 NC/ND

**두 소스 모두 라이선스 필드가 없다.** 이것 자체가 결정적 결함이다 — 항목마다 라이선스가 다른데
(MUSE 안내문: "The publishers of the books determine the licensing terms under which the books are made
available") 소스는 「무료인가 아닌가」만 알려준다.

| 소스 | 라이선스 관련 필드 | 실측 |
|---|---|---|
| MUSE KBART (27열) | `access_type` | 값이 `F` 뿐 — Free 라는 뜻이지 CC 종류가 아니다 |
| MUSE title list (23열) | `Open Access`=`Y` · `Copyright`=연도 | CC 정보 없음 |
| MUSE OAI `oai_dc` | — | **`dc:rights` 자체가 없다** (레코드는 title/description/publisher/date/identifier/type/format/creator 뿐) |
| MUSE 도서 페이지 | — | 기계가 읽을 라이선스 마크업 없음. `citation_*` 메타태그에도 rights 없음 |
| JSTOR title list (22열) | — | **라이선스 컬럼 없음** (Print ISBN·eISBN·Title·Subtitle·Authors·Editors·Publisher·Disciplines·Copyright Year·Publication Date·Frontlist/Backlist·Language·BISAC·LC·Date Available·Series·Stable URL·Book ID·Subject Collections·CATS ID) |

그래서 DOAB 로 제목을 되짚어 항목별 라이선스를 확인했다. **직접 확인된 3건이 전부 NC 또는 ND 였다**:

| 도서 | 소스 | `dc.rights.uri` |
|---|---|---|
| Jews in the Gym | JSTOR OA | `CC BY-NC-ND 4.0` — **변형 금지** |
| The Other Garment Industry | JSTOR OA | `CC BY-NC 4.0` — 상업 교재 불가 |
| Understanding the Rights of Nature | JSTOR OA | `CC BY-NC-ND 3.0` — **변형 금지** |

표본을 32건으로 넓히자 DOAB 항목 레코드 다수에 `dc.rights.uri` 가 아예 없었고(29/32), 대신 딸려 온
**출판사 기본 라이선스 문구**가 이 모집단의 성격을 보여준다 — 확인된 것은 예외 없이 비상업이다:

- digitalculturebooks (Michigan): "Attribution-Noncommercial-No Derivative Works 3.0"
- Brill: "Attribution-NonCommercial 3.0"
- Amherst College Press / Lever: "Attribution-NonCommercial-NoDerivatives 4.0"
- Brown Judaic Studies: "CC-BY-NC-ND"
- OAPEN-UK: "Attribution-NonCommercial-NoDerivs (CC BY-NC-ND)"
- Punctum Books (자사 사이트 실측): `by-nc-nd/3.0` · `by-nc-sa/3.0` · `by-nc-sa/4.0`
- **ANU Press** (JSTOR OA 3위 출판사 752권): CC 가 아니다 — "non-commercial use… **Readers may not
  redistribute** … **Commercial redistribution is strictly prohibited**". 재배포 자체가 금지다
- 예외적으로 UC Press Luminos 만 저자 선택에 따라 CC BY 가능성을 언급한다

**결론**: 이 모집단은 학술 단행본 OA 의 전형 — **NC(상업 교재 불가) + ND(발췌·개작 불가)** 가 기본값이다.
`docs/reports/source-probe/SPEC.md` §3 기준으로 The Conversation(ND) 과 같은 사유의 반려 대상이며,
설령 전문을 받을 수 있었더라도 **항목별로 라이선스를 하나씩 확인해야만 쓸 수 있다.** 그 확인용 필드를
두 소스 다 제공하지 않는다.

---

## 4. 안정 식별자

| 소스 | 필드 | 예 | 평가 |
|---|---|---|---|
| MUSE | `title_id` (KBART) / `Content ID` (title list) | `146663` | 정수. `https://muse.jhu.edu/book/146663` 로 1:1 대응 |
| MUSE | OAI identifier | `oai:muse.jhu.edu:/book/125074` | 위와 같은 id |
| MUSE | `print_identifier` / `online_identifier` | ISBN13 | 존재. **DOI 는 KBART 에 없다** |
| JSTOR | `Book ID` | `10.2307/j.ctv2jn92fk` · `10.3998/mpub.12986336` | **DOI 형태 — 최상.** 교차 중복 판정에 그대로 쓸 수 있다 |
| JSTOR | `Stable URL` | `https://www.jstor.org/stable/10.2307/…` | Book ID 에서 결정적으로 생성됨 |
| JSTOR | `eISBN` · `CATS ID` | `978-1-64469-845-7` · `22573/ctv2jm3r4g` | 보조 키 |

중복 방지 관점에서는 **JSTOR 쪽이 낫다**(DOI). MUSE 는 ISBN 으로 교차해야 한다.

---

## 5. 증분 커서

- **MUSE / OAI-PMH — 작동 확인.** `verb=ListRecords&set=books_2023&from=2026-09-01&until=2026-09-07`
  → 193건. 같은 세트에 `from=2020-01-01&until=2020-01-31` → `noRecordsMatch`. **날짜 필터가 실제로
  좁힌다.** 페이지네이션은 `resumptionToken` + `completeListSize` 로 정렬이 보장돼, 2026-08-16 IA 사고
  (정렬 없는 페이지네이션 → 214건 중복·동수 누락) 같은 위험은 없다.
  ⚠️ 단 datestamp 는 **콘텐츠 변경일이 아니라 재색인일**로 보인다 — books_2023 세트 5,040건 중 첫 1,000건이
  모두 `2026-09-06` 이었다. 「지난번 이후 새로 나온 책」이 아니라 「지난번 이후 손댄 레코드」가 나온다.
- **MUSE / KBART — 대안.** `date_monograph_published_online` 컬럼으로 신규분을 가른다. 파일이 1.4 MB 라
  통째 재내려받기가 부담이 없다.
- **JSTOR — 목록 diff 뿐.** API 가 없으므로 `Date Available on JSTOR` 컬럼을 기준으로 이전 스냅숏과
  diff 한다. 파일명에 생성일이 들어가므로 스냅숏 보관이 쉽다. 8.7 MB / 16,224행이면 매번 전량 diff 가 현실적이다.

---

## 6. 현실적 확보 가능 편수 — 목록 23,649 / 전문 **0**

| | 총 권수 | 영어 | 근거 |
|---|---|---|---|
| **MUSE OA 도서** | **7,425** | **6,394** | title list xlsx 데이터행 계수 (2026-09-07 생성). 스페인어 757 · 프랑스어 230 · 네덜란드어 19 · 그 외 25 |
| **JSTOR OA 도서** | **16,224** | **11,818** | title list TSV 행 계수 (2026-09-07 생성). 독일어 2,189 · 스페인어 1,476 · 노르웨이어 204 · 포르투갈어 165 · 프랑스어 95 · 그 외 |
| 합계(중복 미제거) | 23,649 | 18,212 | |

출판사 상위(JSTOR): RAND 1,200 · Duncker & Humblot 1,058 · ANU Press 752 · El Colegio de México 693 ·
Brill 683 · Amsterdam UP 673 · transcript 582 · Michigan 579 · Barbara Budrich 516 · Punctum 474 ·
UCL Press 469 · CLACSO 441 (171개 출판사).
상위(MUSE): El Colegio de México 684 · Michigan 560 · Johns Hopkins 361 · Ohio State 359 · Cornell 324 ·
NYU 323 · Punctum 311 · Duke 257 (127개 출판사).

**그러나 전문 확보 가능 편수는 0 이다.** 표본 5권(MUSE 1 · JSTOR 4) 전량이 봇 검문에서 막혔고,
두 소스 모두 프로그램 접근을 명문으로 거부한다.

### DOAB / OAPEN 중복 — 사실상 같은 서가다

두 목록에서 층화 추출한 제목을 DOAB REST(`https://directory.doabooks.org/rest/search?query=…`)로 조회했다
(제목 정규화 후 앞 22자 일치를 HIT 로 셈, 2회 표본 합산):

| 소스 | DOAB 에 있음 | 비율 |
|---|---|---|
| JSTOR OA (영어) | **20 / 27** | 74% |
| MUSE OA | **16 / 27** | 59% |

miss 중 상당수는 실제 부재가 아니라 **제목 표기 차이**였다(예: MUSE `Hokum!` → DOAB
`Hokum! The Early Sound Slapstick Short and Depression-Era Mass Culture` 는 같은 책인데 앞 22자 규칙에서
탈락). 즉 실제 중복률은 위 수치보다 높다. **이 소스가 가진 것의 대부분은 DOAB 에 이미 있고, DOAB 는
항목별 `dc.rights.uri` 를 준다** — 즉 MUSE/JSTOR 를 뚫을 이유 자체가 약하다.

다만 DOAB 도 만능이 아니다: 표본 32건 중 29건에 `dc.rights.uri` 가 없었고, DOAB 의 bitstream 은 표지
JPEG 뿐이며(실측: `The Other Garment Industry` 의 bitstream 2건이 전부 7,576 B JPEG), 본문은 OAPEN 등
외부로 나간다. 그리고 **OAPEN 도 막혔다** — `https://library.oapen.org/handle/20.500.12657/113243` → **HTTP 403**
(OAI-PMH `library.oapen.org/oai/request?verb=Identify` 는 200 으로 살아 있다).

---

## 7. 지문 적합성 표본 판정 — **확인 실패 (소스에서 전문을 못 읽었다)**

⚠️ **SPEC 이 요구한 「표본 3~5편을 실제로 읽고」 를 수행하지 못했다.** 읽으려면 §2 의 봇 검문을 우회해야
하는데, 그것은 이번 작업의 금지 사항이다. 추정으로 채우지 않고 확인 실패로 적는다.

메타데이터로만 말할 수 있는 것(이것도 근거는 실측 컬럼이다):

- 이 모집단은 **학술 단행본**이다. JSTOR 목록의 Disciplines·BISAC 상위는 Language & Literature ·
  History · Slavic Studies · Religion 류이고, 최상위 출판사는 RAND(정책 보고서 1,200) ·
  Duncker & Humblot(독일 법·경제) · Archaeopress(고고학 333) 다. 300어 발췌로 잘랐을 때 자족적인
  설명문이 되기 어려운 장르 — 각주 표지·인용 장치·앞 장에 의존하는 지시어가 많다.
- 영어 비율은 MUSE 86% · JSTOR 73% 로 나쁘지 않으나, **비영어 5,437권**이 섞여 있어 언어 필터가 필수다.
- 판정에 필요한 것은 「이 서가가 좋은 지문을 담고 있는가」가 아니라 **「그 지문을 합법적으로 잘라 쓸 수
  있는가」**인데, §3 이 그것을 이미 부정한다(NC/ND 지배). 따라서 §7 의 미확인은 판정을 바꾸지 않는다 —
  전문이 온다 해도 반려다.

---

## 판정 근거 요약

| SPEC 반려 조건 | MUSE | JSTOR |
|---|---|---|
| 전문이 안 온다 | ✅ 해당 (`/verify` 캡차) | ✅ 해당 (Client Challenge) |
| 변형 금지 라이선스 | ✅ 해당 (표본 전량 NC/ND, 소스에 필드 없음) | ✅ 해당 (동일) |
| 대량 접근 경로가 없다 | ❌ 메타데이터 경로는 있다 (OAI + KBART) | ⚠️ 목록 파일만, API 없음 |

**세 조건 중 둘에 해당 → 반려.** 「보류」로 남길 이유도 없다. 편수(23,649)나 지문 적합성 때문이 아니라
**접근과 라이선스라는, 우리 쪽 노력으로 바뀌지 않는 두 축에서 막혔기** 때문이다.

### 되살릴 수 있는 조건 (그때 재정찰)

1. **MUSE 에 TDM 허가를 서면으로 받는다** — `/verify` 페이지가 스스로 안내하는 유일한 정규 경로다
   (musetech@jh.edu). 허가가 나오면 §3(라이선스)만 남는다.
2. 그 경우에도 **항목별 라이선스는 DOAB 로 되짚어야 한다** — 소스가 안 주기 때문이다.
3. JSTOR 는 robots 로 모델 학습 크롤링을 명시 거부했으므로, 별도 계약 없이는 재정찰해도 결과가 같다.

---

## 수확기를 짠다면

**이 소스에는 짜지 않는다.** 대신 **DOAB 를 1차 채널로 삼는 별도 정찰**을 권한다 — 같은 책의 60~74% 를
덮으면서, 두 소스가 안 주는 **항목별 라이선스(`dc.rights.uri`)를 준다.** 아래는 그 전제의 설계다.

- **본뜰 스크립트**: `scripts/acp/collect-daily.mjs` 가 아니라 `scripts/csat/harvest-plos.mjs`(API 형).
  DOAB REST 는 PLOS 와 같은 「검색 → 항목 상세 → 본문」 3단이다.
- **1단 (목록)**: MUSE KBART TSV + JSTOR title list TSV 를 **후보 명부로만** 내려받는다
  (합쳐 10 MB, 각 1회 GET). 여기서 `Language == English` 로 걸러 18,212권을 만든다.
  → 커서 파일 `scripts/csat/data/oabooks-titlelist-cursor.json` (소스별 마지막 생성일 + 행 해시).
- **2단 (라이선스 판정)**: 제목+ISBN 으로 DOAB REST 를 조회해 `dc.rights.uri` 를 받는다.
  **`by` 또는 `by-sa` 또는 `zero` 만 통과**시키고 `nc`·`nd` 는 그 자리에서 버린다.
  ⚠️ `dc.rights.uri` 가 없는 항목은 **통과시키지 말 것** — 「모르면 버린다」가 라이선스의 기본값이다
  (표본 32건 중 29건이 여기 해당하므로, 이 게이트만으로 후보가 한 자릿수 %로 줄 것을 각오해야 한다).
  → 커서 `scripts/csat/data/oabooks-license-cursor.json`.
- **3단 (본문)**: 통과분만 DOAB `dc.identifier.uri` → 출판사 사이트에서 PDF 를 받는다.
  **OAPEN 은 403 이므로 경유지로 쓰지 말 것.** PDF → `pdftotext` → 문단 분해 →
  `scripts/csat/gate-article-drain/JUDGING.md` 어휘로 `use`/`narrative`/`reject` 판정.
- **분할**: 2단은 항목당 2회 GET(검색 1 + 상세 1) × 18,212 = 약 36,000 요청. 0.4초 간격이면 4시간.
  **하룻밤 1회가 아니라 하루 2,000건 × 9회**로 나눈다. 3단은 통과 편수를 본 뒤 다시 잡는다.
- **재실행 안전**: 1·2단 모두 커서 파일에 「이미 판정한 식별자」를 적고 export 가 그것을 건너뛴다
  (JSTOR 은 `Book ID` = DOI, MUSE 는 ISBN13 을 키로). 몇 번을 돌려도 결과가 같아야 한다.

### 이번 정찰에서 내려받은 것 (DB 미기록 · 임시 디렉터리)

`open_access_books.txt`(MUSE KBART 1.4 MB) · `open_access_books.xlsx`(MUSE title list 1.0 MB) ·
`Books_at_JSTOR_Open_Access_Collection_2026-09-07.txt`(8.7 MB) — 전부 공개 목록 파일이며 본문은 없다.
**저장소에도 DB 에도 넣지 않았다.**
