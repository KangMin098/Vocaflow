<!-- docs/reports/source-probe/oa-humanities-presses.md -->
# 인문·사회 OA 단행본 5곳 (OBP · ANU Press · MIT Press · OHP · punctum) 확보 정찰

| | |
|---|---|
| 판정 | **OBP 보류(조건부 채택) · 나머지 4곳 반려** |
| 확보 가능 편수 | DOAB 색인 **2,809권** 실측(publisher 관계 수) · 그중 라이선스·언어·전문이 **모두** 통과하는 것은 **약 190권**(OBP 145 + OHP 45 · 폭 145~320) · 권당 20창 상한이면 **약 3,800편** |
| 라이선스 | 곳마다 다르고 **책마다 다르다**(표본 25권씩). 변형 허용: **OHP 92% · OBP 44% · MIT 4% · punctum 0% · ANU 0%**. ⚠️ 이건 라이선스만 본 값 — **전문까지 오는 비율은 OBP 24%**(§6) |
| 전문 | **온다 — 단 DOAB 가 아니라 OAPEN Library 의 REST API 에서.** `book.pdf` + **`book.pdf.txt`(추출 완료 평문)**. 브라우저 경로(`/handle/`·`/bitstream/`)는 Anubis **403** 이지만 `/rest/…` 는 **200** — §2 는 같은 날 [`doab.md`](./doab.md) 의 「OAPEN 차단」 판정을 정정한다. MIT Press 는 미러가 아예 없고, OBP 도 **18% 는 미러가 없다** |
| 안정 식별자 | DOAB handle `20.500.12854/NNNNNN` + DOI + ISBN (셋 다 항목마다 고정) |
| 증분 커서 | OAI-PMH `from`/`until` + `resumptionToken` (`https://directory.doabooks.org/oai/request`) |
| 정찰 일자 | 2026-09-07 |

---

## 0. 첫 줄에 답할 것 — **DOAB 하나로 흡수되는가**

**메타데이터는 그렇다. 전문은 아니다. 그리고 흡수해도 라이선스 때문에 대부분 못 쓴다.**

다섯 곳 전부 DOAB 에 들어 있다 — 개별 정찰 5벌은 낭비가 맞았다. 그러나 그 사실이
"DOAB 하나만 뚫으면 된다" 로 이어지지 않는다. 실측으로 갈라진 것은 셋이다:

1. **DOAB 에는 전문이 없다.** DOAB 항목의 bitstream 은 표지 jpg 와 서지 파일
   (`.marc.xml`·`.onix_3.0.xml`·`.ris`·`.tsv`) 뿐이다. 본문 PDF 는 **한 건도 없다.**
2. **전문은 OAPEN Library 에 있다.** DOAB 와 OAPEN 은 **같은 DSpace 한 벌**이다 —
   DOAB 의 OAI 응답이 자기 `baseURL` 을 `http://library.oapen.org/oai/request` 라고
   적는다. DOAB 항목의 `dc.identifier` 에 OAPEN handle 이 들어 있고, 그 OAPEN 항목에
   `book.pdf` 와 **`book.pdf.txt`(OAPEN 이 이미 뽑아 둔 평문)** 가 붙어 있다.
   ⚠️ 단 **`/rest/…` 로 불러야 한다** — 브라우저 경로는 Anubis 403 이다(§2 정정).
3. **그런데 미러가 없는 곳이 있다.** MIT Press 표본은 `dc.identifier` 에 OAPEN handle 이
   **없다**. 전문 경로가 `direct.mit.edu` 뿐인데 거기가 **403**(Cloudflare)이다.

### 다섯 곳 · DOAB 실측

| 곳 | DOAB publisher handle | DOAB 수록 | 전문 경로 | 변형 허용 라이선스 비율(표본 25) |
|---|---|---|---|---|
| **Open Book Publishers** | `20.500.12854/25330` | **730** | OAPEN `.pdf.txt` ✅ | **CC BY 11/25 (44%)** |
| **ANU Press** | `20.500.12854/25390` | **914** | OAPEN `.pdf.txt` ✅ | **0/25** |
| **The MIT Press** | `20.500.12854/25593` | **641** | ❌ 없음 (direct.mit.edu 403) | **0/25** |
| **punctum books** | `20.500.12854/25376` | **457** | OAPEN `.pdf.txt` ✅ | **0/25** (BY-NC-SA 19 · BY-NC-ND 3) |
| **Open Humanities Press** | `20.500.12854/25328` | **67** | OAPEN `.pdf.txt` ✅ | **23/25 (92%)** — 다만 거의 전부 SA |
| 합계 | | **2,809** | | |

⚠️ **편수를 `/rest/filtered-items` 로 세면 안 된다.** 같은 OBP 를 그 엔드포인트로 세면
**72권**, publisher 레코드의 `oapen.relation.isPublisherOf` 로 세면 **730권**이다 —
**10배 차이.** `filtered-items` 는 `contains` 가 `equals` 보다 **적게** 나오는 구간까지
있었다(ANU `equals` 154 vs `contains` 99). 스캔 창이 잘리는 것으로 보이며, 이 값을
근거로 쓰면 소스를 10분의 1로 오판한다. **publisher 레코드 관계 수가 정본이다.**

---

## 1. 대량 접근 경로 — **있다. 셋이고, 전부 열려 있다**

| 경로 | URL | 실측 |
|---|---|---|
| **OAI-PMH** (권장) | `https://directory.doabooks.org/oai/request` | `Identify` 200 · `earliestDatestamp 2020-04-01` · `deletedRecord` 지원 · 포맷 10종(`oai_dc`·`qdc`·`mods`·`mets`·`didl`·`dim`·`ore`·`rdf`·`uketd_dc`·`xoai`) |
| **레거시 REST v6** | `https://directory.doabooks.org/rest/...` | `/rest/search` 200 · `/rest/handle/<h>?expand=metadata,bitstreams` 200 |
| **전량 CSV 덤프** | `https://directory.doabooks.org/download-export?format=csv` | 200 · `Content-Length` **280,787,618** (`format=json` 은 **500**) |

호출 예시 하나 — **라이선스가 여기서만 나온다**:

```
https://directory.doabooks.org/oai/request?verb=GetRecord&metadataPrefix=oai_dc
  &identifier=oai:directory.doabooks.org:20.500.12854/158879
```
```xml
<oaire:licenseCondition uri="https://creativecommons.org/licenses/by-nc/4.0/"/>
<dc:rights uri="http://purl.org/coar/access_right/c_abf2">open access</dc:rights>
```

⚠️ **DSpace 7 API 는 여전히 죽어 있다.** `/server/api/discover/search/objects` → **404 (HTML)**.
2026-07-08 진단(`docs/AI_CONTEXT/diagnostics/source_t2_p0_20260708.md` P0-2a)과 **같다** — 14개월 뒤에도 그대로다.
사이트가 스스로 `DSpace 6.3` 이라 적는다. **v7 경로를 전제로 짜면 안 된다.**

### 곳별 전량 열거는 publisher 레코드로 한다

DOAB 는 publisher 를 **항목(`dc.type=publisher`)으로 갖고**, 그 항목이
`oapen.relation.isPublisherOf` 로 자기 책 전부를 가리킨다. 한 번의 GET 으로
그 출판사의 **전량 handle 목록**이 나온다 — OAI 전량 순회(약 9만 레코드)가 필요 없다.

```
GET https://directory.doabooks.org/rest/handle/20.500.12854/25330?expand=metadata
→ oapen.relation.isPublisherOf × 730   (= Open Book Publishers 전량)
```

⚠️ 이 레코드는 크고 **간헐적으로 빈 JSON 을 돌려준다**(실측: 같은 URL 이 성공→실패→성공).
`metadata` 배열이 비어 있으면 **실패로 보고 재시도**해야 한다 — 그냥 받으면
**"이 출판사는 0권" 으로 조용히 오판**한다(실측에서 ANU 가 실제로 `DOABtitles=0` 으로 찍혔다).

## 2. 전문이 오는가 — **온다. DOAB 가 아니라 OAPEN 에서, 그리고 이미 추출돼 있다**

2026-07-08 에 OBP 를 접은 사유는 **"Read Online 은 JS 렌더 · 전문은 PDF"** 였고,
해소 조건으로 「(β) PDF 추출 계층 신설」 또는 「(γ) OAPEN 의 전문 deposit 실재 여부
재정찰(미확인)」을 남겨 뒀다. **(γ) 를 확인했고, 답은 (β) 가 이미 남의 손으로 끝나 있다는 것이다.**

OAPEN 항목의 bitstream 에 원본 PDF **와 함께 `<파일>.pdf.txt` 가 붙어 있다** — OAPEN 이
자기 색인용으로 뽑아 둔 평문이다. 우리가 PDF 추출기를 만들 필요가 없다.

| 표본 | OAPEN handle | `.pdf.txt` | 낱말 |
|---|---|---|---|
| OBP *Tragedy and the Witness* | `20.500.12657/101094` | `obp.0435.pdf.txt` 566,628B | **92,612** |
| ANU *Fijians in Transnational Pentecostal Networks* | `20.500.12657/63884` | `book.pdf.txt` 414,172B | **65,783** |
| OHP *Masked Media* | `20.500.12657/100096` | `Hall_2025_Masked-Media.pdf.txt` 717,883B | **106,430** |
| punctum *Imaginary Death* | `20.500.12657/106170` | `9781685712372.pdf.txt` 494,941B | **86,490** |
| **MIT Press** *Critical Perspectives on Open Development* | **미러 없음** | — | — |

품질은 좋다. 하드랩(줄바꿈이 문단이 아니라 **줄 끝**)과 하이픈 분철만 되돌리면 바로 산문이다.
다만 **문단 경계가 소실**돼 있다(빈 줄이 566KB 문서에 12개뿐) — 문단 단위가 필요하면
휴리스틱을 짜야 하고, 지문 창(窓) 단위로 쓸 거면 문제되지 않는다.

⚠️ **Range 요청이 무시된다.** `-r 40000-52000` 을 줘도 566,628B 전량이 온다 —
표본 조사도 책 한 권을 통째로 받는다. 수확기는 이 비용을 전제해야 한다.

### ⚠️⚠️ OAPEN 의 Anubis 게이트는 **REST 경로에 걸려 있지 않다** — 같은 날 다른 정찰의 정정

같은 날 나온 [`doab.md`](./doab.md) 는 OAPEN 을 **"Anubis PoW 게이트 · 헤드리스 브라우저 필요"** 로
적고 **40,168권(DOAB 전체의 39%)을 확보 불가로 뺐다.** 그 판정의 근거 URL 을 그대로 다시 호출하고,
**같은 책을 REST 경로로도 호출해** 비교했다(2026-09-07, 같은 머신·같은 UA):

| 경로 | 결과 |
|---|---|
| `library.oapen.org/bitstream/20.500.12657/50315/1/9781800642089.pdf` | **403** 4,419B (Anubis) |
| `library.oapen.org/handle/20.500.12657/101094` | **403** 4,418B (Anubis) |
| `library.oapen.org/rest/handle/20.500.12657/101094?expand=bitstreams` | **200** JSON |
| `library.oapen.org/rest/bitstreams/<uuid>/retrieve` (`.pdf.txt`) | **200** 566,628B `text/plain` |
| `library.oapen.org/rest/bitstreams/<uuid>/retrieve` (원본 PDF) | **200** 3,305,829B `application/pdf` |

**Anubis 는 사람이 보는 경로(`/handle/`·`/bitstream/`)에만 걸려 있고 REST API 는 그대로 열려 있다.**
`doab.md` 가 막혔다고 든 바로 그 책(`20.500.12657/50315` *Human Cultures through the Scientific Lens*,
OBP)도 REST 로는 서지·`9781800642089.pdf`(17MB)·**`9781800642089.pdf.txt`(657,544B)** 가 전부 나온다.

**그러므로 "헤드리스 브라우저로 PoW 를 푼다" 는 대책은 필요 없다.** 우회가 아니다 —
같은 사이트가 공개한 다른 공식 API 를 쓰는 것뿐이고, 로그인·토큰·PoW 를 건드리지 않는다.
⚠️ 다만 `doab.md` 가 함께 관측한 **429("30초 제한")는 실재한다** — 이번 정찰에서도 큰 레코드 GET 이
간헐 실패했다. **경로 문제가 아니라 속도 문제이므로 간격과 재시도로 다룬다.**

이 정정이 서는 한, `doab.md` 의 「오늘 당장 받을 수 있는 수 **6,634권**」은 **OAPEN 40,168권을
되돌려 다시 계산해야 한다.** 두 정찰이 갈린 지점이 여기 하나뿐이므로 **먼저 이것부터 맞출 것.**

---

## 3. 라이선스 — ⚠️ **여기서 넷이 죽는다**

**곳 단위로 "이 출판사는 CC BY 다" 라고 적으면 안 된다.** 다섯 곳 모두 자기 안내문과
실제 책이 다르다. 곳마다 **책 25권을 균등 간격으로 뽑아** DOAB OAI 의
`oaire:licenseCondition uri` 를 읽었다(2026-09-07).

| 곳 | CC BY | CC BY-SA | BY-NC | BY-NC-SA | BY-NC-ND | BY-ND | CC 아님·표기 없음 | **변형 허용** |
|---|---|---|---|---|---|---|---|---|
| **Open Book Publishers** | **11** | – | 7 | – | 2 | – | 없음 5 | **11/25 (44%)** |
| **Open Humanities Press** | 2 | **21** | – | 2 | – | – | – | **23/25 (92%)** |
| **The MIT Press** | – | 1 | 1 | – | **14** | 1 | 없음 8 | 1/25 (4%) |
| **punctum books** | – | – | – | **19** | 3 | – | 없음 3 | **0/25** |
| **ANU Press** | – | – | – | – | 9 | – | **ANU 자체 약관 16** | **0/25** |

### 곳별로 짚을 것

- **OBP** — 출판사 안내문(`publisher.oalicense`)은 *"대부분 CC-BY-ND-NC"* 라고 적고 있는데
  **실측은 반대다.** ND 는 25권 중 2권뿐이고 **CC BY 가 11권으로 최다**다. 안내문이 낡았다.
  ⚠️ 2026-07-08 진단이 OBP 를 *"CC-BY-NC 다수"* 로 적은 것도 **표본이 작았던 탓으로 보인다** —
  지금 자로 다시 재면 다르다. **곳 단위 판정을 책 단위 판정으로 바꿔야 한다.**
  독립 표본을 한 벌 더 뽑아(다른 간격, 성공 17권) **CC BY 7/17 = 41%** 로 재확인했다 —
  두 표본이 44%·41% 로 겹치니 **OBP 의 CC BY 비율은 4할 언저리로 봐도 된다.**
- **OHP** — 다섯 중 유일하게 **변형 허용이 다수(92%)**. 다만 거의 전부 **CC BY-SA** 라
  **결과물도 SA 로 전염된다**(SPEC §3). 그리고 총량이 **67권**뿐이다.
  ⚠️ **메타데이터가 틀린 예를 이 곳에서 잡았다.** 표본 *Masked Media* 의 DOAB 레코드는
  `licenseCondition uri="https://creativecommons.org/licenses/by/4.0/"` — 즉 **CC BY** 라고 적혀 있는데,
  책 판권장은 *"licensed under the Collective Conditions for Re-Use (**CC4r**)"* 이고
  본문은 한술 더 떠 *"CC4r 은 그 자체로 어쩌면 너무 잠정적이라 실제 라이선스라 하기 어렵다"* 고 적는다.
  **CC 가 아닌 것이 메타데이터에서는 CC BY 로 보인다** — 메타데이터만 믿고 걸러 담으면
  변형 허용이 아닌 책이 CC BY 통에 섞인다. **판권장을 반드시 다시 읽어야 한다.**
- **MIT Press** — `BY-NC-ND` 가 14/25. 게다가 전문이 안 온다(§2·§7). **두 겹으로 반려.**
- **punctum** — **BY-NC-SA 19 · BY-NC-ND 3.** 전량이 NC 다. 표본 *Imaginary Death* 판권장도
  `CC BY-NC-SA 4.0`. 출판사 안내문의 *"저자가 더 느슨한 라이선스를 고를 수도 있다"* 는
  25권 표본에서 **한 건도 관측되지 않았다.**
- **ANU Press** — 16/25 가 CC 가 아니라 `press.anu.edu.au/about/conditions-use` 를 가리킨다.
  그 문서 실측: *"2018년 이전 전량 all rights reserved. 2018년 1월부터 대다수 **CC BY-NC-ND 4.0**"*.
  즉 CC 인 쪽도 NC+ND 다. **전량 반려.**

### 표기 없음(none) 은 "없다" 가 아니다

OBP 5 · MIT 8 은 OAI 에 라이선스 URI 가 아예 없다. 그러나 **책 본문 판권장에는 적혀 있다** —
OBP 표본은 PDF 추출 평문 첫 1,500자 안에
*"licensed under the Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)"* 가 그대로 있었다.
**`.pdf.txt` 앞머리에서 라이선스를 다시 읽는 것이 폴백이 된다** — 메타데이터가 빈 20~32% 를 이걸로 건진다.
(반대로 §3 OHP 사례처럼 **본문이 메타데이터를 뒤집기도 한다.** 둘이 다르면 본문이 권위다.)

## 4. 안정 식별자 — 셋 다 있다

| 필드 | 예 | 성질 |
|---|---|---|
| DOAB handle | `20.500.12854/158879` | 항목마다 고정 · OAI identifier 로 그대로 쓰임 |
| OAPEN handle | `20.500.12657/101094` | 전문 쪽 키 |
| DOI | `10.11647/OBP.0435` · `10.22459/FTPN.2023` · `10.53288/0531.1.00` · `10.7551/mitpress/11480.001.0001` | 출판사별 접두사가 갈려 **출판사 판별에도 쓸 수 있다** |
| ISBN | `dc:alternateIdentifier type="ISBN"` 다중 | 판형별로 여러 개 — 유일키로 쓰면 안 된다 |

중복 방지는 **DOAB handle 을 1차 키, DOI 를 2차 키**로 잡으면 된다.

## 5. 증분 커서 — OAI 날짜 + `resumptionToken`

`https://directory.doabooks.org/oai/request?verb=ListRecords&metadataPrefix=oai_dc&from=YYYY-MM-DD`.
`earliestDatestamp 2020-04-01T14:43:18Z` · `deletedRecord` 지원(철회 감지 가능).

⚠️ **`ListSets` 는 12개뿐이고 전부 커뮤니티/컬렉션이다** — **출판사 set 이 없다.**
그러니 OAI 로는 "OBP 만 받기" 가 안 되고, 전량을 훑어 `dc:publisher` 로 걸러야 한다.
**그래서 §1 의 publisher 레코드 경로가 더 싸다** — 그쪽은 GET 한 번에 전량 handle 이 나오고,
그 목록의 차집합이 곧 증분이다(신간이 목록에 붙는다).
정렬 없는 페이지네이션(2026-08-16 IA 사고)과 달리 **관계 목록은 집합이라 중복·누락이 구조적으로 안 생긴다.**

---

## 6. 현실적 확보 가능 편수 — **목표 표 2,100 은 성립하지 않는다. 단위가 다르다**

### 권(book) 으로 세면

⚠️ **라이선스만 세면 안 된다.** 변형 허용이면서 **전문까지 오는** 것만이 실수확분이다.
OBP 20권을 뽑아 라이선스와 전문 유무를 **한 번에** 재 봤더니(성공 17), 둘이 **역상관**이었다 —
OAPEN 미러가 없는 3권이 **공교롭게 전부 CC BY** 였다.

| OBP 표본 17권 | 수 | 비율 |
|---|---|---|
| 변형 허용(CC BY) | 7 | 41% |
| OAPEN 미러 있음 | 14 | 82% (미러만 있으면 `.pdf.txt` 는 **14/14 = 100%**) |
| **변형 허용 AND 전문 있음** | **4** | **24%** |

| 곳 | DOAB 수록 | × 실수확률 | × 영어 비율(표본) | = 쓸 수 있는 권수 |
|---|---|---|---|---|
| Open Book Publishers | 730 | **24%**(실측 4/17) | 84% (eng 21/25) | **≈ 145권** |
| Open Humanities Press | 67 | 92%(라이선스만 · 미러율 미측정) | 80% (eng 20/25) | **≈ 45권** (전부 SA 전염) |
| The MIT Press | 641 | 4% | — | **0** (전문 403) |
| punctum books | 457 | 0% | — | **0** |
| ANU Press | 914 | 0% | — | **0** |
| **합계** | **2,809** | | | **≈ 190권** |

표본이 작아 **145~320권** 폭으로 읽는 것이 정직하다(라이선스 표본 두 벌이 44%·41% 로 겹친 반면,
「전문까지」 조건은 17권에서 한 번만 쟀다). 미러 없는 CC BY 3권은 OBP 자체 사이트에
있을 수 있으나 거기는 **429** 다(§8) — **세지 않았다.**

### 지문(passage) 으로 세면 — **여기가 진짜 값이다**

책 한 권은 지문 한 편이 아니다. 저장소의 같은 자(`scripts/csat/lib-fit.mjs`,
`SCORER_VERSION 1` · `R-BLANK` 대역)로 표본 4권의 전문을 재면:

| 표본 | 낱말 | 모양 통과 창 | **담화까지 통과** | 통과율 | 소재(`lib-topic.mjs`) |
|---|---|---|---|---|---|
| OBP *Tragedy and the Witness* | 92,612 | 195 | **108** | 55% | 예술·문화 |
| ANU *Fijians in…Pentecostal Networks* | 65,783 | 139 | **92** | 66% | 과학·자연 |
| OHP *Masked Media* | 106,430 | 152 | **110** | 72% | 기술·매체 |
| punctum *Imaginary Death* | 86,490 | 42 | **20** | 48% | 예술·문화 |

**책 한 권이 대역 통과 창 20~110개를 낸다.** 실수확 가능한 **190권**만 잡아도
**창 기준 1만 3천~2만.** 목표 표의 2,100 은 이 소스에 대해서는 **한참 낮게 잡힌 값**이다 —
다만 그 1만 3천~2만이 전부 서로 다른 지문은 아니다(한 권 안에서 소재·필자가 겹친다).
**권당 상한을 두는 편이 맞다**(예: 권당 20창 → 190권 × 20 = **3,800편**).

### ⚠️ 그런데 이 소스가 지금 필요한가 — 소재 병목은 이미 닫혔다

`docs/reports/topic-gap.json`(2026-09-04 실측, 재고 **57,545편**) 을 5만 기준으로 다시 풀면
**여덟 칸 전부 부족 0**이다(ratio 0.87~1.23).
2026-09-03 에 OLH·OJS 를 시험하게 만든 「예술·문화 6,172편 부족」은 **더 이상 없다.**
그러니 이 다섯 곳의 값은 *"빈 칸 메우기"* 가 아니라 **"결이 다른 원문"** 이다 —
학술 논문(PLOS)·백과(위키)·교재(OpenStax) 와 달리 **단행본 산문**이고,
표본 통과율 48~72% 는 지금까지 잰 어느 소스보다 높은 축이다.
**착수 우선순위는 낮고, 품질 상한을 올리고 싶을 때 꺼내 쓸 카드다.**

## 7. 지문 적합성 표본 판정 (`gate-article-drain/JUDGING.md` 어휘)

| 표본 | 판정 | 근거 |
|---|---|---|
| OBP *Tragedy and the Witness* (CC BY-NC) | **use** | 비극의 '결함' 은유를 논증한다. 자족적 · 연결어·대용 조밀 |
| OHP *Masked Media* (CC4r/BY-SA) | **use** | 백신 개발 유인과 공공재를 논증. 시사·사회 설명문 결 |
| ANU *Fijians…* (CC BY-NC-ND) | **narrative** | 현지조사 일화가 시간순으로 이어진다 — 통과창은 많으나 결이 이야기다 |
| punctum *Imaginary Death* (CC BY-NC-SA) | **narrative** | 형제의 마지막 밤. 소설적 산문 · 통과창 42로 넷 중 가장 적다 |
| MIT *Critical Perspectives on Open Development* | **판정 불가** | 전문을 못 얻었다(§2) |

실제 통과창 하나(OBP · 127어) — 300어대로 이어 붙이면 그대로 지문이 된다:

> Catastrophe now makes sense because it follows intelligibly from the psychology of the
> protagonist. If the 'flaw' metaphor has exerted a compelling (often pernicious) influence,
> that is because it so perfectly conveys the necessity of the disaster—and so, in a certain
> sense, its rightness. …

### 챕터 도입부 접근

**챕터 단위 레코드는 DOAB 에도 OAPEN 에도 없다** — 항목은 전부 `dc.type=book` 이고
bitstream 도 책 통짜 하나다. 그래서 챕터 도입부는 **평문에서 직접 찾아야 한다.**
표본 4권에 단순 규칙(`^\d+\.\s+대문자` · `^Chapter \d+` · `^[IVX]+\.`)만 걸어 봤을 때
후보 표제 **OBP 120 · ANU 73 · OHP 16 · punctum 5** 가 잡힌다 — **목차와 본문에 두 번씩**
나오므로 실제 장 수는 그 절반이고, punctum 처럼 표제 관습이 다른 책은 거의 안 잡힌다.
**쓸 수는 있으나 공짜는 아니다.** 챕터 경계가 꼭 필요하면 `.pdf.txt` 대신
ONIX(`.onix_3.0.xml`)에 목차가 있는지부터 확인할 것 — 이번 정찰에서 **확인하지 않았다.**

---

## 8. 막힌 것 · 함정 (전부 실측)

| 무엇 | 실측 | 뜻 |
|---|---|---|
| `direct.mit.edu` 챕터 페이지 | **403** (브라우저 UA 로도) | MIT Press 전문 경로가 없다. MDPI(2026-09-03)와 같은 자리 — **우회하지 않는다** |
| `doi.org/10.7551/mitpress/…` | **403** (DOI 가 위로 리다이렉트) | 같은 벽 |
| DSpace 7 `/server/api/discover/…` | **404 (HTML)** | 2026-07-08 진단과 동일. v6 레거시 REST 만 쓴다 |
| `/rest/filtered-items` 편수 | OBP **72** vs 실제 **730** · ANU `contains`(99) < `equals`(154) | **편수 근거로 쓰면 안 된다** |
| `download-export?format=json` | **500** | CSV(280MB)만 가능 |
| OAPEN bitstream Range 요청 | `-r 40000-52000` 줘도 **전량 566,628B** | 표본 조사도 통짜 받는다 |
| DOAB publisher 레코드 GET | 같은 URL 이 성공→**빈 JSON**→성공 | `metadata` 가 비면 재시도. 안 하면 **"0권" 으로 오판**(실측 발생) |
| `www.openbookpublishers.com` | **429** | 출판사 사이트는 긁지 않는다 — OAPEN 으로 충분하다 |
| `library.oapen.org/handle/…` · `/bitstream/…` | **403** (Anubis PoW) | **`/rest/…` 는 200** — §2 정정. 브라우저 경로만 게이트돼 있다 |
| `punctumbooks.com/titles/` | **404** | 경로가 바뀌었다. 역시 OAPEN 으로 우회 |
| OAI `ListSets` | **12개** (커뮤니티/컬렉션뿐) | 출판사 set 이 없다 → OAI 로 곳별 증분 불가 |
| `.pdf.txt` 문단 경계 | 566KB 에 빈 줄 **12개** | 줄바꿈이 문단이 아니라 줄 끝이다 |

### 확인하지 못한 것 (추정하지 않는다)

- **ONIX 에 목차가 있는가** — `.onix_3.0.xml` 을 열어 보지 않았다.
- **MIT Press 를 다른 경로로 얻을 수 있는가** — JSTOR·Knowledge Unlatched 미러 확인 안 했다.
- **ANU·punctum·OHP 의 OAPEN 미러율** — 각 1권 표본에서 미러 있음을 봤을 뿐 **비율은 못 셌다**.
  ANU·punctum 은 라이선스에서 이미 죽어 재도 소용없지만, **OHP 45권 추정은 이 미측정 위에 서 있다.**
- **미러 없는 CC BY 3권을 다른 경로로 얻을 수 있는가** — OBP 자체 사이트가 **429** 라 확인 못 했다.
  이 3권이 살아나면 OBP 실수확률이 24% → 41% 로 올라 **145권 → 250권**이 된다.
  ⚠️ **가장 값싼 다음 측정이고, OBP 를 「보류」에서 「채택」으로 올릴 값이다.**
- **라이선스 URI 정규화** — 표본에 `licenses/by-/…` 처럼 **끝이 깨진 URI** 가 1건 있었다(handle 36998).
  정규식으로 자르면 `by-` 라는 없는 코드가 나온다. 이번엔 보수적으로 **변형 불가 쪽에 넣었다** —
  실제로 무엇인지는 판권장을 봐야 안다. 수확기는 이런 값을 조용히 버리지 말고 **따로 세야 한다.**

## 9. 수확기를 짠다면

**본뜰 것**: `scripts/csat/harvest-plos.mjs` (API 형 — 적재 전 채점 경로가 이미 붙어 있다).
OLH·OJS 탐색기(`probe-olh.mjs`·`probe-ojs.mjs`)의 「적재 전에 잰다」 구조를 그대로 쓴다.

**3단으로 나눈다** — 통짜 다운로드가 비싸니 단계마다 커서를 남긴다.

| 단계 | 하는 일 | 커서 파일 |
|---|---|---|
| ① 목록 | publisher 레코드 GET → handle 전량 (OBP 730 · OHP 67) | `scripts/csat/data/oabooks-roster.json` (handle → 최종확인일) |
| ② 선별 | handle 마다 OAI `GetRecord` → `oaire:licenseCondition` · `dc:language` · OAPEN handle. **`by`/`by-sa` + `eng` 만 남긴다** | `scripts/csat/data/oabooks-license.json` |
| ③ 본문 | 남은 것만 OAPEN `.pdf.txt` GET → 판권장 재확인 → `lib-fit.mjs` 채점 → 통과창만 저장 | `scripts/csat/data/oabooks-text-cursor.json` |

**반드시 지킬 것**

- **②를 ③ 앞에 둔다.** 라이선스로 59% 가 떨어지는데(실측 7/17 만 통과) 먼저 받으면 그만큼 헛일이다.
  (`docs/CHANGELOG.md` 의 *"철회 논문은 이미 막혀 있었다 — 헛일을 시킨 것은 뽑기였다"* 와 같은 실수.)
- **라이선스는 두 번 읽는다** — 메타데이터(`oaire:licenseCondition`) + `.pdf.txt` 앞머리 판권장.
  **둘이 다르면 본문이 권위**이고, 메타데이터가 비어 있어도(OBP 20% · MIT 32%) 본문으로 건진다.
- **재실행 안전** — ②·③ 은 커서에 있는 handle 을 건너뛴다. ①은 매번 전량을 받되
  **차집합만 ②로 넘긴다**(관계 목록은 집합이라 IA 식 중복·누락이 안 생긴다).
- **권당 상한**(예: 통과창 20)을 둔다 — 안 두면 한 권이 100편을 내면서 코퍼스가 한 저자로 기운다.
- **SA 는 따로 표시한다.** OHP 는 거의 전부 CC BY-SA 라 **산출물이 SA 로 전염**된다 —
  `license_class` 를 `cc_by_sa` 로 남겨 발행 단계에서 가를 수 있게 한다.
- **②에서 미러 없는 책을 표시해 둔다** — 실측에서 미러 없는 3권이 전부 CC BY 였다.
  버리지 말고 「전문 미확보 · 라이선스 통과」 통에 남겨야 나중에 경로가 열릴 때 되찾는다.
- 회차는 **①1회 → ②약 800회 GET → ③약 190회 통짜 다운로드**. ③이 권당 0.4~0.7MB 이므로
  **총 80~130MB**. 하루 한 번 50권씩 나흘이면 끝난다.

**짜지 않을 것**: ANU Press · punctum books · MIT Press 전용 수확기. 앞의 둘은 라이선스에서,
MIT 은 라이선스와 접근 양쪽에서 죽는다. **DOAB 를 훑는 수확기 하나가 다섯 곳을 다 덮고,
그 필터가 셋을 자동으로 버린다** — 이것이 이 정찰의 결론이다.

---

*정찰 2026-09-07 · DB write 0 · 표본 다운로드 5권(각 0.4~0.7MB) · 나머지는 메타데이터 GET.*
