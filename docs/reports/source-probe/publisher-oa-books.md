<!-- docs/reports/source-probe/publisher-oa-books.md -->
# Cambridge Core OA / Oxford Academic OA / Springer OA Books (+ OAPEN) 확보 정찰

| | |
|---|---|
| 판정 | **채택 — 단, Springer 한 곳만.** Cambridge **반려** · Oxford **반려** |
| 확보 가능 편수 | **≈3,008권** = Springer 영어 3,727 × 상업적 변형 가능 82.7%(표본 n=110) × 평문 존재 97.6%. Cambridge ≈3 · Oxford ≈16 (표본 n=35·39). **권당 10~17만 낱말이므로 300어 발췌 기준으로는 목표 표의 4,500편을 크게 넘는다** — §6 |
| 라이선스 | 항목별로 다름 — **출판사가 곧 라이선스다.** Springer 영어 표본 CC BY 80.9% + CC BY-SA 1.8% → **변형 가능**. Oxford 표본 92% CC BY-NC-ND → **변형 불가**. Cambridge 표본 86% NC/ND → **변형·상업 불가** |
| 전문 | **온다 — 그것도 PDF 가 아니라 추출된 평문으로.** OAPEN 이 항목마다 `<파일명>.pdf.txt` 비트스트림을 함께 보관한다 (Springer 표본 41/42 = 97.6%) |
| 안정 식별자 | OAPEN 핸들 `20.500.12657/<n>` (레코드 주키, 4,275건 페이징에 **중복 0**). DOI `oapen.identifier.doi` 는 Springer 4,157/4,275 = 97.2% |
| 증분 커서 | OAI-PMH `from=` + `resumptionToken`(`oai_dc/<from>//<set>/<offset>`). 실측 `from=2026-06-01` → `completeListSize="3415"` |
| 정찰 일자 | 2026-09-07 |

> **가장 중요한 발견은 편수가 아니다.** 이 저장소의 [doab.md](./doab.md) 는 OAPEN 호스팅
> **40,168권(DOAB 전체의 39%)** 을 「Anubis PoW 게이트 · 헤드리스 브라우저 필요」로 접었다.
> **그 판정은 웹 경로에 대해서만 맞다.** `/rest/` API 는 게이트 뒤에 있지 않다 — 같은 책,
> 같은 파일이 200 으로 내려온다. §2-2 에 재현 절차를 적었다. 이 한 줄이 본 정찰의 대상
> 3,082권보다 훨씬 큰 것을 연다.

---

## 0. 세 출판사를 각각 보았고, 결론은 한 곳으로 모인다

목표 표는 세 출판사를 묶어 4,500편으로 잡았다. 실측하면 **묶으면 안 되는 셋**이다 —
경로는 셋 다 같은 곳(OAPEN)에 있는데 **라이선스가 정반대**다.

| | OAPEN 수록 | 영어 | 상업적 변형 가능 비율 (표본) | 쓸 수 있는 권수 | 판정 |
|---|---|---|---|---|---|
| **Springer Nature** | **4,275** | 3,727 | **82.7%** (n=110) | **≈3,082** | 채택 |
| Oxford University Press | 640 | 634 | 2.6% (n=39) | ≈16 | 반려 |
| Cambridge University Press | 91 | 91 | 2.9% (n=35) | ≈3 | 반려 |
| 합 | 5,006 | 4,452 | — | **≈3,100** | |

Cambridge·Oxford 는 **경로가 막혀서가 아니라 라이선스 때문에** 반려다. 둘 다 전문이 오고
식별자도 멀쩡한데, 표본의 압도적 다수가 **BY-NC-ND** 다 — ND 는 발췌·재조판 자체가 금지고
NC 는 Vocaflow 의 유료화 전제와 충돌한다. **91권·640권 규모에 파이프라인을 따로 만들 이유가 없다.**
(SPEC 판정 기준: 「변형 금지 라이선스면 반려」.)

이하 본문은 **Springer(+OAPEN)** 를 중심으로 적는다.

---

## 1. 대량 접근 경로 — OAPEN 한 곳이면 된다. 출판사별로 긁을 이유가 없었다

질문이었던 **「OAPEN 이 세 곳을 이미 집계하고 있는가」의 답은 "그렇다"** 이다.
셋 다 OAPEN Library 에 `publisher.name` 이 정확히 찍힌 채 들어 있고, 세 출판사 사이트를
각각 긁는 것보다 **엔드포인트 두 개**로 끝난다.

### (a) REST — 출판사별 목록·비트스트림 (주력)

```
GET https://library.oapen.org/rest/search?query=publisher:Springer%20Nature&limit=100&offset=0&expand=metadata
→ HTTP 200, application/json
```

`query=publisher:<이름>` 은 **정확 일치 필터**로 동작한다 — 4,275건을 전부 받아
`publisher.name` 을 집계했더니 **4,275/4,275 가 정확히 `Springer Nature`** 였다(오염 0).
Cambridge 91/91, Oxford 640/640 도 같다.

항목 상세와 파일 목록:
```
GET https://library.oapen.org/rest/handle/20.500.12657/50315?expand=bitstreams,metadata
GET https://library.oapen.org/rest/items/<uuid>?expand=bitstreams
GET https://library.oapen.org/rest/bitstreams/<uuid>/retrieve      ← 실제 파일
```

### (b) OAI-PMH — 라이선스와 증분 커서 (보조)

```
GET https://library.oapen.org/oai/request?verb=Identify
→ repositoryName "OAPEN Library" · earliestDatestamp 2020-03-26T09:27:40Z
  · deletedRecord transient · granularity YYYY-MM-DDThh:mm:ssZ
```

`ListSets` → **22개 세트.** 이 정찰에 쓸 것은 둘이다:

| setSpec | 이름 | `completeListSize` (실측) |
|---|---|---|
| `com_20.500.12657_5` | Books | **49,817** |
| `com_20.500.12657_10` | Book chapters | **7,200** |

`ListMetadataFormats` → 13종(`oai_dc` `qdc` `mods` `mets` `marc` `xoai` `dim` `didl` `ore` `rdf`
`etdms` `uketd_dc` `doab_migration`).

⚠️ **OAI 에는 출판사 필터가 없다.** 세트는 커뮤니티/컬렉션 단위뿐이고 출판사는 DSpace 엔티티라
세트가 아니다. 길이 둘 있고 **비용이 7배 차이난다**:

| | 요청 수 | 비고 |
|---|---|---|
| REST 로 출판사별 핸들(43) → 핸들마다 OAI `GetRecord` 로 라이선스(3,727) | **3,770** | 정찰 때 이 방식으로 표본을 냈다 |
| **OAI `ListRecords` 로 Books 세트 49,817건 전량(499) → `dc:publisher` 로 국소 필터** | **499** | ✅ **권장.** 세 출판사가 한 번에 나오고 라이선스·DOI·ISBN 이 같은 레코드에 실려 온다 |

권장안의 함정 하나 — **REST 의 `publisher.name` 과 OAI 의 `dc:publisher` 는 값이 다르다.**
REST 는 `Springer Nature` 로 통일해 주는데 OAI 는 임프린트를 그대로 준다
(실측 동일 항목: REST `Springer Nature` / OAI `Palgrave Macmillan`). **§6 의 임프린트 표를
매칭 목록으로 쓰고**, 계수는 REST 43요청 결과(4,275)와 대조해 검증한다.

### (c) ❌ 쓸 수 없었던 것

`https://library.oapen.org/download-export?format=csv` → HTTP **200 인데 본문 0바이트**.
DOAB 쪽 같은 엔드포인트는 280 MB 를 주는데(doab.md §1) **OAPEN 쪽은 검색 컨텍스트 없이는 빈 응답**이다.
`format=kbart` · `type=csv` 는 **500**. → **OAPEN 에는 쓸 수 있는 전체 덤프가 없다.** 페이징해야 한다.

`https://library.oapen.org/server/api` (DSpace 7 discover API) → **404.** OAPEN·DOAB 둘 다
DSpace 5/6 계열이라 **패싯 집계로 라이선스를 한 방에 세는 길은 없다.** 그래서 §3 은 표본이다.

---

## 2. 전문(full text)이 오는가 — **온다. 초록이 아니라 책 한 권 전체가, 평문으로**

### 2-1. OAPEN 은 PDF 옆에 추출 텍스트를 같이 둔다

`expand=bitstreams` 응답 실측 (`20.500.12657/63709`, Palgrave, CC BY):

```
PUB_943_Tieber_When_Music_Takes_Over_in_Film.pdf        application/pdf  4,817,677
PUB_943_Tieber_When_Music_Takes_Over_in_Film.pdf.txt    text/plain         598,220   ← 이것
....marc.xml / ....onix_3.0.xml / ....ris / ....tsv / ....pdf.jpg
```

```
GET https://library.oapen.org/rest/bitstreams/67126dc0-.../retrieve
→ 200 text/plain 598,220 B
"PALGRAVE STUDIES IN AUDIO-VISUAL CULTURE / When Music Takes Over in Film / Edited by …"
```

**`pdftotext` 를 돌릴 필요가 없다.** doab.md 의 2단 수확기가 PDF 60 GB 를 받아 변환하려던 것을,
여기서는 평문 수백 KB 만 받으면 된다 — 표본 5권 평균 **1.04 MB**, PDF 대비 **1/8**.

가용률 실측 — Springer 목록 **42권 체계 표집**(4,275행에서 100행마다 1건):

| | 건수 |
|---|---|
| `.pdf.txt` 존재 & 2 KB 초과 | **41 / 42 (97.6%)** |
| PDF 없음 | 0 / 42 |
| 텍스트만 없음 | 1 (`20.500.12657/29844`, 챕터 항목) |

앞선 14권 표본에서는 10/14 였으나, 그중 3건은 **핸들 문자열이 깨진 내 스크립트 버그**였고
1건(`102989`)은 `.pdf.txt` 가 **19바이트**(추출 실패 = 이미지 PDF)였다. 수확기는
**크기 하한(≥2 KB)** 을 반드시 걸어야 한다 — 19바이트 파일도 200 으로 정상 응답한다.

### 2-2. ⚠️ [doab.md](./doab.md) 의 「OAPEN = Anubis 로 막힘」 판정을 정정한다

doab.md §2 는 OAPEN 호스팅 **40,168권(DOAB 의 39%)** 을 접근 불가로 분류하고, 이를
「보류 해제 조건 2번」(헤드리스 브라우저로 PoW 통과)에 올려 두었다. **웹 경로만 막혀 있다.**

같은 책(`20.500.12657/50315`, Open Book Publishers, doab.md 가 실패 사례로 든 바로 그 URL)에
네 경로를 같은 세션에서 던진 결과:

| 경로 | 결과 |
|---|---|
| `GET /bitstream/20.500.12657/50315/1/9781800642089.pdf` | ❌ **403** text/html (Anubis) |
| `GET /handle/20.500.12657/50315` | ❌ **403** text/html (Anubis) |
| `GET /rest/handle/20.500.12657/50315?expand=bitstreams` | ✅ **200** JSON — 제목·파일 7종 |
| `GET /rest/bitstreams/150fe292-.../retrieve` | ✅ **200** text/plain **657,544 B** (94,146 낱말) |

레이트리밋도 확인했다 — `/rest/search` **15연속 요청, 전부 200**, 429 없음.
(doab.md 는 `/bitstream/` 4연속에서 429 를 받았다. 게이트와 리밋이 **웹 경로에만** 걸려 있다.)

### 2-2-1. `robots.txt` — **OAPEN 과 DOAB 는 서로 다르다.** 직접 읽었다

정찰 초안에서 나는 「같은 재단이 운영하니 DOAB 와 같은 제약이 걸려 있을 것」이라고 **추정**했다.
읽어 보니 **틀렸다.** 두 파일을 나란히 받아 대조했다:

| | `library.oapen.org/robots.txt` (3,373 B) | `directory.doabooks.org/robots.txt` |
|---|---|---|
| `Content-Signal` | **없음** | `search=yes,ai-train=no,use=reference` |
| `ClaudeBot`/`GPTBot`/`CCBot` | **언급 없음** | `Disallow: /` |
| `/rest` · `/oai` · `/bitstream` | **언급 없음 → 허용** | — |
| `Disallow` 대상 | `/discover` `/search-filter` `/browse` `/statistics` `/login` `/register` `/contact` `/feedback` `/mapping` | — |
| `Crawl-delay` | **10** (`User-agent: *`) | — |

OAPEN 것은 **DSpace 기본 robots.txt 그대로**다(주석까지 위키백과에서 빌려 온 표준 문구).
AI 학습 유보 선언도, AI 크롤러 차단도 **없다.** 막고 있는 것은 검색·브라우즈 같은
**비싼 동적 페이지**이고, `/rest` 와 `/oai` 는 **아예 언급되지 않는다** — 애초에 기계 수확용으로
만들어진 엔드포인트다.

⚠️ **다만 `Crawl-delay: 10` 은 실재한다.** 곧이곧대로 지키면 §「몇 번에 나눠 돌릴지」의
6,500요청이 **18시간**이 된다. 이 값은 크롤러(사이트 전체를 훑는 봇)를 겨냥한 것이고
OAI-PMH·REST 는 목적이 다르지만, **우리 편의로 해석해서는 안 된다.**
아래 일정은 **초당 1요청**(= 10배 초과)과 **Crawl-delay 준수** 두 가지를 함께 적었다.

수확기는 (a) 정체를 밝히는 자체 UA + 연락처를 쓰고, (b) `429`·`503` 을 받으면 지수 백오프로
물러서고, (c) 항목별 CC 귀속 표시를 보존해야 한다 — 발췌·재조판은 모델 학습이 아니라
CC BY 가 명시적으로 허용하는 편집 행위다.

### 2-3. 챕터 단위 전문 접근 — **이 세 출판사에는 사실상 없다**

OAPEN 에 `Book chapters` 커뮤니티(7,200건)가 따로 있고, 챕터 레코드는 **자기 DOI · 자기 PDF ·
자기 라이선스**를 갖는다(실측 `20.500.12657/60401` → `dc:alternateIdentifier type="DOI"
10.36253/978-88-5518-646-9.13`, `oapen:pages 6`, `oaire:licenseCondition CC BY 4.0`).

그런데 **그 7,200건의 주인이 다르다.** `ListRecords` 로 902건을 표집해 `dc:publisher` 를 셌다:

| 출판사 | 건수 / 902 |
|---|---|
| Firenze University Press | 174 |
| Taylor & Francis | 156 |
| Routledge | 142 |
| IntechOpen | 51 |
| FrancoAngeli | 46 |
| De Gruyter | 13 |
| **Springer Nature + Palgrave Macmillan** | **18 (2.0%)** |

Springer 항목 4,275건의 `dc.type` 도 같은 말을 한다 — **book 4,142 · chapter 133 (3.1%).**

→ **결론: Springer 는 책 단위로 받아 우리가 자른다.** 300어대 발췌가 목적이므로 이것은 손실이
아니다. 러닝 헤더가 챕터 경계를 그대로 노출하기 때문에(실측: `"5 Wind Energy 355"`,
`"140 J. SÖDERLIND ET AL."`, `"Fashion Palimpsests: Fashion Shows and Fashion Communication… 173"`)
챕터 분할 자체는 정규식으로 가능하다. 다만 그 헤더는 **본문 문장 한가운데에 박혀 들어오므로
제거가 필수**다(§7).

---

## 3. 라이선스 — ⚠️ **REST 에는 없다. OAI 에만 있다**

이것이 이 소스의 가장 큰 함정이다.

`/rest/search?expand=metadata` 가 주는 필드를 **전량 덤프**해 보았다(한 항목 26필드):
`dc.contributor.editor` · `dc.date.*` · `dc.identifier.uri` · `dc.description.abstract` ·
`dc.language` · `dc.subject.other` · `dc.title` · `dc.type` · `oapen.identifier.doi` ·
`oapen.relation.isPublishedBy` · `publisher.name` · `publisher.website` · `oapen.imprint` …

**`dc.rights` 도 `licenseCondition` 도 없다.** Cambridge 3건을 추가로 열어 확인했다 — 없다.
**REST 만 보고 만든 수확기는 라이선스를 모른 채 전량 적재한다.**

라이선스는 OAI `oai_dc` 에만 온다:
```xml
<oaire:licenseCondition uri="https://creativecommons.org/licenses/by/4.0/">
  Attribution 4.0 International
</oaire:licenseCondition>
<dc:rights>info:eu-repo/semantics/openAccess</dc:rights>
```
⚠️ `dc:rights` 는 **전 항목이 `openAccess`** 라 아무 정보가 없다. 판정에 쓸 것은
**`oaire:licenseCondition/@uri` 하나뿐**이다.

### 실측 표본 (OAI `GetRecord`, 무작위 핸들)

**Springer Nature · 영어 · n=110**

| 라이선스 | 건수 | 비율 | 변형 | 상업 |
|---|---|---|---|---|
| CC BY 4.0 | 87 | 79.1% | ✅ | ✅ |
| CC BY 3.0 / 3.0 IGO | 2 | 1.8% | ✅ | ✅ |
| CC BY-SA 4.0 / 3.0 | 2 | 1.8% | ✅ | ✅ (결과물 SA 전염) |
| CC BY-NC-ND 4.0 | 12 | 10.9% | ❌ | ❌ |
| CC BY-NC 4.0 | 4 | 3.6% | ✅ | ❌ |
| 라이선스 필드 없음 | 3 | 2.7% | ❌ 판정 불가 | |
| **상업적 변형 가능 소계** | **91** | **82.7%** | | |

(95% 신뢰구간 대략 ±7pp → **76~89%**. 별도 표본 n=45 에서도 CC BY 36 + BY-SA 2 = 84% 로 일치했다.)

⚠️ **표집 방법을 밝힌다** — 영어 3,727행에서 고정 시드로 3.2%를 뽑으면 119건이 나오는데
앞에서 110건만 잘라 썼다. 즉 목록 **뒤쪽 9건이 빠진 편향**이 있다. OAPEN 기본 정렬이
라이선스와 상관있다고 볼 이유는 없으나, **전수가 아니라 표본이고 완전 무작위도 아니다.**
수확기 1회차(§「수확기를 짠다면」 1단, 499요청)가 이 값을 **전수로 확정한다.**

**Oxford University Press · n=39** — BY-NC-ND 36 · CC BY 1 · BY-NC-SA 4.0 1 · 없음 1.
BY-NC-SA 3.0 IGO 도 2건 별도 표본에서 나왔다. → **상업적 변형 가능 ≈ 2.6%.**

**Cambridge University Press · n=35** — BY-NC-ND 4.0/3.0 21 · BY-NC 4.0 9 · CC BY 1 ·
**BY-ND 3.0 1** · **All rights reserved 1** · 없음 2. → **상업적 변형 가능 ≈ 2.9%.**

### 여기서 나오는 세 가지 규칙

1. **라이선스는 책마다 다르다 — 출판사 단위로 가정하면 안 된다.** Springer 안에도 BY-NC-ND 가
   10.9% 섞여 있고, Cambridge 안에 **"All rights reserved"** 가 실재한다(OA 라이브러리에 들어와
   있는데도). 항목마다 `licenseCondition` 을 읽어 통과시킨 것만 적재한다.
2. **DOAB 가 이미 준 라이선스와 대조할 것.** DOAB 는 출판사 프로필에
   `publisher.oalicense = "Springer Nature books are published under the Creative Commons
   Attribution 4.0 (CC BY) license…"` 라고 **출판사 단위 선언**을 싣는다 — 위 실측(10.9%가 BY-NC-ND)이
   보여주듯 **이 선언은 항목 단위 진실이 아니다. 절대 근거로 쓰지 말 것.**
3. **판권면 대조는 여기서도 필요하다.** doab.md §3 이 찾아낸 「메타데이터 CC BY-NC-SA vs PDF 판권면
   전면 복제 금지」 유형을 이 정찰에서 재현하지는 못했다(평문 표본 5권의 판권면은 모두
   `licenseCondition` 과 일치했다 — 실측 s2 판권면: *"This book is licensed under the terms of the
   Creative Commons Attribution 4.0 International License … permits use, sharing, adaptation"*).
   그러나 표본 5권으로 없다고 말할 수는 없다. **`.pdf.txt` 앞 3,000낱말에 라이선스 문구가 그대로
   들어 있으므로 대조 비용이 사실상 0 이다** — 걸어라.

---

## 4. 안정 식별자 — OAPEN 핸들. 중복 0 을 실측했다

- **주키 = 핸들 `20.500.12657/<n>`.** REST 응답의 `handle`, OAI 헤더의
  `oai:library.oapen.org:20.500.12657/<n>`, `dc.identifier.uri` 가 **모두 같은 값**이다.
  Springer 4,275건을 43페이지로 받아 `sort | uniq -d` → **중복 0건.**
- **DOI** `oapen.identifier.doi` — Springer 4,157/4,275 (**97.2%**) · Oxford 557/640 (87.0%) ·
  Cambridge 85/91 (93.4%). **13% 가 비므로 단독 키로 못 쓴다.** 보조 키로만.
  ⚠️ 정규화 필요 — DOAB 쪽은 같은 필드에 `http://dx.doi.org/10.1007/...` 로 접두사를 붙여 주고
  OAPEN 쪽은 `10.1007/...` 로 준다.
- **ISBN** `dc:alternateIdentifier type="ISBN"` — OAI 에만 오고, 표본에서 빠진 항목이 있다
  (Cambridge 8건 중 2건 없음). **DOAB REST 쪽 Springer 100건 표본에는 ISBN 필드가 0건**이었다
  → **양쪽을 잇는 키로 부적합.**
- ❌ **비트스트림 UUID 는 키로 쓰지 말 것.** `retrieveLink` 의 UUID 는 파일 재업로드 시 바뀐다.
  매번 `expand=bitstreams` 로 다시 조회한다.

---

## 5. 증분 커서 — OAI `from=` + 오프셋 토큰. 정렬 사고는 관측되지 않았다

```
GET .../oai/request?verb=ListIdentifiers&metadataPrefix=oai_dc
    &set=com_20.500.12657_5&from=2026-06-01T00:00:00Z
→ 200, <resumptionToken completeListSize="3415" cursor="0">
        oai_dc/2026-06-01T00:00:00Z//com_20.500.12657_5/100
```

- 토큰 형식 = `prefix/from/until/set/offset` — **오프셋 토큰**이다(DOAB 와 동일 구조).
- **3개월에 3,415건**(전 출판사·전 언어). 월 ~1,100건 규모.
- `granularity=YYYY-MM-DDThh:mm:ssZ` 이므로 초 단위로 이어붙일 수 있다.
  커서에는 **마지막으로 본 `datestamp` 에서 1초 뺀 값**을 적는다(같은 초에 여러 건이 있을 수 있다).

**⚠️ 2026-08-16 IA 사고(정렬 없는 페이지네이션 → 214건 중복 + 동수 누락)의 재현 여부**:
Springer 4,275건을 REST 오프셋으로 43페이지 받아 대조한 결과 **중복 0 · 총계 안정**.
OAI 쪽도 오프셋 토큰이므로 같은 위험이 이론적으로는 있으나 **관측되지 않았다.**
그래도 수확기는 **핸들 집합으로 멱등**하게 짠다 — 이미 본 핸들은 건너뛴다. 그러면
중복이 나도 무해하고, 누락은 다음 회차 `from` 겹치기(안전 여유 1일)로 메워진다.

⚠️ `deletedRecord=transient` — **철회를 OAI 로 알 수 없다.** OAPEN 에는 쓸 수 있는 전체 덤프가
없으므로(§1-c) 철회 감지는 **분기 1회 `publisher:` 전량 재페이징**(Springer 43요청)으로 한다. 싸다.

---

## 6. 현실적 확보 가능 편수 — **3,027권** (권수로는 목표 표 4,500 의 67%. 발췌 편수로는 초과)

정찰로 센 값이다. 조건을 하나씩 좁혔다:

| 필터 | Springer | Oxford | Cambridge |
|---|---|---|---|
| OAPEN 수록 (REST 전량 페이징) | **4,275** | **640** | **91** |
| ↳ 영어 | 3,727 | 634 | 91 |
| ↳ + 상업적 변형 가능 (표본 비율 적용) | **≈3,082** | ≈16 | ≈3 |
| ↳ + `.pdf.txt` 존재 (97.6%) | **≈3,008** | — | — |

**합계 ≈ 3,027권.** 실질 전부가 Springer 다.

> 목표 표의 4,500 은 **권수로도 편수로도 과대**다. 다만 이것은 「덜 얻는다」는 뜻만은 아니다 —
> **책 한 권은 평균 10~17만 낱말**(표본 5권: 267k · 153k · 161k · 108k · 174k, 중앙값 161k)이라
> 300어 발췌 후보가 권당 수백 개다. 산문 밀도 필터(§7)를 통과하는 비율을 doab.md 가 실측한
> 인문·사회 70% / STEM 30% 로 잡아도 **권당 채택 가능 발췌는 두 자릿수**다.
> **편수(발췌) 기준으로는 4,500 을 크게 넘는다.** 병목은 편수가 아니라 **주제 편중**이다.

### Springer 4,275권의 정체 — 임프린트와 언어

| 임프린트 | 건수 | | 언어 | 건수 |
|---|---|---|---|---|
| (없음) | 944 | | English | **3,727** |
| Palgrave Macmillan | 855 | | German | 543 |
| Springer | 562 | | Italian | 5 |
| Springer International Publishing | 515 | | | |
| Springer Nature Switzerland | 429 | | | |
| Springer Nature Singapore | 283 | | | |
| Springer Fachmedien Wiesbaden | 211 | | | |
| Springer VS / Gabler / Vieweg / Spektrum / J.B. Metzler | 248 | | | |
| Apress | 36 | | | |

**Palgrave Macmillan 855권이 이 소스의 값어치다.** doab.md 가 「도달 가능 풀에 400권 미만」이라고
적은 인문·사회 학술서가 바로 여기 있다 — 그리고 §2-2 로 **도달 가능해졌다.**
독일어 543권은 버린다(Springer VS·Fachmedien·Gabler 계열이 대부분).

---

## 7. 지문 적합성 표본 판정 — CC BY Springer 5권

`scripts/csat/gate-article-drain/JUDGING.md` 어휘. 5권을 실제로 받아
(평문 합계 5.47 MB · 863,277낱말) **문서 45% 지점에서 300낱말**을 그대로 잘라 읽었다.
25~30% 지점은 앞표지·판권면이 나와 못 쓴다 — **표제지·판권면·시리즈 소개가 앞 3,000낱말을 먹는다.**

**① Designing Renewable Energy Systems within Planetary Boundaries** (267k낱말) — **`use` / `environment`**
> "Collisions can be mitigated by not routing new power lines through important bird areas, like
> wetlands or migration corridors [22]. Bernardino et al. [23] concluded in their meta-analyses
> that wire-marking power lines reduced bird collisions globally by 50% on average. Burying power
> lines is also an effective measure … but excavation can destroy or fragment important habitats."

자족적 설명문. 논지가 서고 발췌해도 지시대상이 살아 있다. 인용 마커 `[22]` 는 기계 규칙 소관.
⚠️ 창 한가운데에 **러닝 헤더 `316 M. Järvinen et al.` 가 문장 사이에 박혀 있다** — 제거 필수.
어휘 수준이 높다(mitigation · meta-analyses · bifacial · decommissioning) → **V-Level 상단**.

**② Fashion Communication in the Digital Age** (161k낱말) — **`use` / `culture`**
> "As fashion shows became more complex and financially demanding, sponsorship from major brands
> like Shiseido, Adidas, and Renault became increasingly common. … The public can no longer pay
> for a ticket to attend the big show. However, with the emergence of social media, the
> possibilities of sharing and fruition are multiplying…"

**이 정찰에서 가장 좋은 표본.** 통념 → 변화 → 함의 구조가 그대로 수능 사회 지문이다.
고유명사(J.W. Anderson · TikTok)가 있으나 맥락으로 풀린다. 러닝 헤더 1건 혼입.

**③ Reforms, Organizational Change and Performance in Higher Education** (108k낱말) — **`use` / `education`**
> "There are clear examples of this in Norway, where the interviewees mention the importance of
> the publication outlet levels … Finally, the Danish case shows that the PRFS has led to less
> Danish publications … In Sweden, we have instead noted scattered voices of criticism against
> the implementation of local PRFSs."

비교 논증문. 읽히지만 **약어 `PRFS` 가 발췌 안에서 정의되지 않는다** → 그대로 쓰면 자족성 위반.
초출 정의가 포함된 창을 고르는 필터가 있으면 `use`, 없으면 `reject`/`fragmentary`.
러닝 헤더 `140 J. SÖDERLIND ET AL.` 혼입.

**④ From the Past to the Future: 300 Years of Sámi Reindeer Herding Knowledge** (153k낱말) — **경계선**
> "This arch, which the hut of the maritime Laplander forms on the inside, is so low that you
> cannot stand upright … Where the arch touches the ground, there too are the seats in the hut
> of a maritime Laplander, for so sunk and low is it that you must sit on the very ground itself.
> (Fig. 3.45)"

1725년 Knud Leem 원문의 번역이라 **고문 어투**(`inclosure` · `fitly correspond` · 도치)이고
`(Fig. 3.45)` 참조가 문장에 붙어 있다. 현대 영어 지문으로는 부적합 —
`reject`/`fragmentary` 쪽에 가깝다. **책 안에 현대 해설 장이 따로 있으므로 권 단위 배제가 아니라
창 단위 판정이어야 한다.**

**⑤ Innovations in Derivatives Markets** (174k낱말) — **`reject` / `reference`**
> "18. Kalotay, A.J., Williams, G.O., Fabozzi, F.J.: A model for valuing bonds and embedded
> options. Financ. Anal. J. 49(3), 35–46 (1993) 19. Longstaff, F.A., Schwartz, E.S.: …"

45% 지점이 **참고문헌 목록 한가운데**였고, 이어서 다음 논문 초록이 붙었다.
게다가 문자 단위 손상이 보인다 — `"Gaussianexpon·entially quadratic m· odels"`,
`"deriva-tives"`. **수학·금융 proceedings 는 이 소스에서 가장 나쁜 축이다.**

### 종합 — 3/5 `use`, 1 경계선, 1 `reject`

doab.md 가 실측한 것과 같은 결론에 도달한다: **판정을 가르는 것은 출판사가 아니라 분과다.**
- **Palgrave Macmillan · Springer VS 계열의 인문·사회 단행본** → 산문 밀도 높음, 권당 두 자릿수 발췌.
- **Springer Proceedings / Lecture Notes 계열(수학·전산·공학)** → 참고문헌·수식이 본문을 먹는다.
  `dc.relation`(시리즈명)에 `Proceedings` · `Lecture Notes` 가 있으면 **후순위**로 미룬다.

그리고 **PLOS 51,465편과 겹치지 않는다** — 이것이 DOAB(IntechOpen 의학·공학 93%)와의 결정적 차이다.
Palgrave 855권은 문화·사회·교육·문학 축이라 **현재 코퍼스에 없는 다양성**을 준다.

---

## 8. DOAB 와의 중복 배제 — **키는 있다. 그런데 중복률이 30%가 아니다**

목표 표는 「DOAB 와 약 30% 중복」이라고 적고 있다. **Springer 구간 실측은 93~97% 다.**
(⚠️ **DOAB→OAPEN 한 방향** 표본이다. 역방향은 못 셌다 — §「막힌 것」.)

### 실측

DOAB REST 로 `publisher:Springer Nature` 100건을 받아 `dc.identifier` 를 뒤졌다:

```
dc.identifier = 1007300
dc.identifier = OCN: 1118695196
dc.identifier = http://library.oapen.org/handle/20.500.12657/22861   ← 이것
dc.identifier.uri = https://directory.doabooks.org/handle/20.500.12854/38158
```

| | 건수 / 100 |
|---|---|
| **OAPEN 핸들 포인터를 실은 DOAB 레코드** | **97** |
| DOI 를 실은 것 | 100 |
| ISBN 을 실은 것 | **0** |
| 그 97개 핸들 중 내 OAPEN Springer 목록(4,275)에 있는 것 | **93** |

DOAB 와 OAPEN 은 **같은 재단이 운영하는 자매 DSpace** 다(doab.md §1 이 확인한 대로 DOAB 의
OAI `baseURL` 이 `http://library.oapen.org/oai/request` 로 찍힌다). 그래서 Springer 구간은
**사실상 같은 서가**다. 「30% 중복」은 **DOAB 전체**에 대한 값이지 이 세 출판사 구간의 값이 아니다.

### 배제 키 — 우선순위대로

| 순위 | 키 | 방법 | 실측 적중 |
|---|---|---|---|
| **1** | **OAPEN 핸들** | DOAB 레코드의 `dc.identifier` 중 `library\.oapen\.org/handle/(20\.500\.12657/\d+)` 를 정규식으로 뽑아 OAPEN 핸들과 직접 대조 | **97%** |
| 2 | DOI | `oapen.identifier.doi` 를 소문자화하고 `^https?://(dx\.)?doi\.org/` 접두사 제거 후 대조 | Springer 97.2% |
| 3 | 제목 정규화 | 소문자 + 구두점·부제 제거 + 저자 성 | 최후 수단 |
| ❌ | ISBN | **DOAB REST 표본 0건.** 쓸 수 없다 | — |
| ❌ | 다운로드 URL | doab.md §4 대로 같은 책이 여러 호스트로 흩어진다 | — |

### 실무 결론 — **순서를 뒤집는 게 맞다**

doab.md 는 OAPEN 40,168권을 접근 불가로 접고 IntechOpen 6,634권을 「오늘 당장 받을 수 있는 수」로
남겼다. §2-2 로 그 전제가 바뀌었다. 그러므로:

1. **OAPEN 을 먼저 수확한다.** 핸들이 곧 주키다. 중복 배제 문제 자체가 생기지 않는다.
2. **DOAB 는 나중에, OAPEN 핸들을 가진 레코드를 먼저 버리고** 나머지(OpenEdition · JSTOR ·
   MUSE · MDPI 등 외부 호스트)만 남긴다. 그러면 DOAB 수확기가 다뤄야 할 호스트 어댑터가 줄어든다.
3. 두 소스를 **같은 핸들 테이블**에 적재한다 — `oapen_handle` 을 유니크 키로.

---

## 막힌 것 (정직하게)

| 못 한 것 | 왜 |
|---|---|
| **라이선스 전수 집계** | OAPEN 에 쓸 수 있는 덤프가 없고(§1-c) DSpace 7 패싯 API 도 없다(404). REST 에는 라이선스 필드가 아예 없다(§3). 항목당 OAI `GetRecord` 1회가 유일한 길이라 **표본 n=110/39/35 로 추정**했다. 82.7%·2.6%·2.9% 는 **표본값**이지 전수값이 아니다 — 수확기 1회차가 전수를 확정한다 |
| **Cambridge Core / Oxford Academic 자체 사이트 정찰** | 하지 않았다. OAPEN 경유로 라이선스가 이미 반려선을 넘었으므로(ND·NC 86~92%) 자체 API 를 뚫어도 **같은 라이선스가 나온다** — 라이선스는 채널이 아니라 출판사 정책이다. 다만 **Cambridge Elements 중 CC BY 소수**가 OAPEN 밖에 더 있을 가능성은 배제하지 못했다 |
| **DOAB 쪽 세 출판사 총계** | **못 셌다.** DOAB `/rest/search` 를 100건씩 페이징했더니 10분이 넘도록 첫 출판사도 못 끝내 중단했다(OAPEN 쪽은 같은 페이징이 4,275건에 ~4분). 그래서 §8 의 중복률은 **DOAB→OAPEN 방향 100건 표본**(97건이 OAPEN 핸들 보유, 그중 93건이 내 OAPEN Springer 목록과 일치)으로만 말한다. **역방향**(OAPEN Springer 4,275권 중 몇 권이 DOAB 에 없는가)은 확인하지 못했다 — 배제 키의 유효성에는 영향이 없지만, 「OAPEN 에만 있는 책」의 규모는 모른다. doab.md 가 쓴 CSV 덤프(102,078행, 27초)로 세는 편이 훨씬 싸다 |
| **OAI 총계 49,817 의 검증** | Books 세트 `completeListSize` 값을 그대로 적었다. DOAB 에서 OAI 총계(127,778)와 CSV 실계수(102,078)가 25,700 어긋난 전례가 있으므로(doab.md §1) **이 49,817 도 삭제·중복이 섞였을 수 있다.** 출판사별 4,275·640·91 은 REST 전량 페이징으로 **직접 센 값**이라 이 의심에서 자유롭다 |
| **이용약관(robots.txt 외) 검토** | `robots.txt` 는 직접 읽어 §2-2-1 에 적었다(추정이었던 초안을 정정했다). 그러나 OAPEN 웹사이트의 **이용약관·API 이용정책 문서는 찾지 않았다** — `/rest` 에 공개된 사용 한도 문서가 있는지 확인하지 못했다 |
| **판권면 모순 사례 탐색** | 표본 5권에서는 `licenseCondition` 과 판권면이 일치했다. doab.md 가 찾은 Ledizioni 유형이 Springer 에 없다고 말하기에는 **표본이 너무 작다** |

---

## 수확기를 짠다면

### 본뜰 것

`scripts/csat/harvest-plos.mjs` (API 형). PLOS 와 구조가 거의 같다 — **차이는 두 엔드포인트를
합쳐야 한다는 것 하나**다(REST 는 목록·파일, OAI 는 라이선스).
doab.md 가 설계한 2단(메타데이터/전문 분리)은 **여기서는 필요 없다** — 전문이 같은 서버에 있다.

```
scripts/csat/harvest-oapen.mjs      # 1단: REST 페이징 → 핸들 목록 + OAI GetRecord 로 라이선스
scripts/csat/oapen-extract.mjs      # 2단: .pdf.txt 받아 산문 발췌
scripts/csat/lib-oapen.mjs          # 라이선스 정규화 + 러닝헤더 제거 + 산문 밀도 필터
```

`lib-doab.mjs` 를 먼저 짰다면 **라이선스 정규화 표는 그대로 재사용**한다 — 같은 DSpace 라
같은 오표기가 나온다(실측: `by-nc-nd/4.0/)` 처럼 **닫는 괄호가 붙은 값**, `/legalcode` 접미,
`http`/`https` 혼용, 후행 슬래시 유무).

### 1단 — 후보 뽑기 (`harvest-oapen.mjs`)

**⚠️ 순진한 설계는 요청을 두 배로 쓴다.** REST 로 출판사별 목록(43요청)을 뽑은 뒤 핸들마다
`GetRecord` 로 라이선스를 채우면 **3,770요청**이다. 그런데 OAI `ListRecords` 는 **100건/페이지에
라이선스·출판사·DOI·ISBN·언어를 한꺼번에** 준다. Books 세트 전량이 **499요청**이고,
그 안에 Springer·Oxford·Cambridge 가 **전부 들어 있다**(세 번 돌 필요도 없다).

1. `GET /oai/request?verb=ListRecords&metadataPrefix=oai_dc&set=com_20.500.12657_5`
   → `resumptionToken` 을 따라 끝까지. **499요청** (49,817건 ÷ 100).
   레코드마다 뽑을 것:
   `dc:title` · `dc:publisher` · `dc:language` · `oaire:resourceType` ·
   **`oaire:licenseCondition/@uri`** · `dc:alternateIdentifier[@type="DOI"]` ·
   `dc:alternateIdentifier[@type="ISBN"]` · `dc:relation`(시리즈명) · 헤더의 `identifier`(=핸들).
   ⚠️ **`dc:rights` 를 읽지 말 것** — 전 항목 `openAccess` 라 아무 정보가 없다.
2. `dc:publisher` 로 거른다. ⚠️ **REST 의 `publisher.name` 과 OAI 의 `dc:publisher` 는 값이 다르다** —
   REST 는 `Springer Nature` 로 통일해 주는데 OAI 는 임프린트를 그대로 준다
   (실측: `Springer` · `Palgrave Macmillan` · `J.B. Metzler` …). **임프린트 목록으로 매칭할 것**
   (§6 표가 그 목록이다). 계수 검증은 REST 43요청으로 뽑은 4,275건과 대조해서 한다.
3. `dc:language == "English"` 만 남긴다 (3,727).
4. 라이선스 정규화 후 `by` · `by-sa` · `zero` · `mark` 만 통과. 정규화 실패값은 **버리지 말고
   `unknown` 으로 남겨 사람이 본다**(조용히 떨어뜨리면 구멍이 영영 남는다 — CLAUDE.md §🤖).
5. `dc:relation` 에 `Proceedings` · `Lecture Notes` 가 있으면 `priority: low` 로 표시(§7).
6. **커서**: `scripts/csat/data/oapen-harvest-cursor.json` —
   `{ lastDatestamp, seenHandles[], resumptionToken }`.
   2회차부터는 **`from=<lastDatestamp - 1일>`** 을 붙여 §5 의 증분 경로로 돌린다
   (3개월치가 3,415건이므로 **35요청**). **이미 본 핸들은 건너뛴다 → 재실행 안전.**

### 2단 — 전문 받기 (`oapen-extract.mjs`)

1. `GET /rest/handle/<handle>?expand=bitstreams` → `name` 이 `.txt` 로 끝나는 비트스트림.
   **없거나 `sizeBytes < 2000` 이면 스킵**(이미지 PDF. 19바이트 사례 실측).
   **UUID 를 캐시하지 말 것** — 재업로드 시 바뀐다(§4).
2. `GET /rest/bitstreams/<uuid>/retrieve` → 평문. **`pdftotext` 불필요.**
   평균 1.1 MB 이므로 3,000권 ≈ **3.3 GB** (doab.md 의 60 GB 대비 1/18).
3. **판권면 대조** — 앞 3,000낱말에서 `creativecommons.org/licenses/(\S+)` 를 찾아
   메타데이터 라이선스와 대조. 불일치 시 **드롭 + 사유 로그**.
4. **앞 3,000낱말은 통째로 버린다** — 표제지·시리즈 소개·판권면이다(§7 실측).
   뒤쪽 참고문헌 구간도 잘라낸다.
5. **러닝 헤더 제거** — 이 소스 고유의 필수 단계다. 실측 패턴:
   `^\d+\s+[A-Z]\.\s+[A-Z][a-z]+\s+et al\.$` · `^\d+\s+[A-Z][a-z].*\s+\d+$` ·
   `<책 제목의 앞 몇 낱말>…\s+\d+`. **문장 한가운데에 박혀 들어오므로** 줄 단위가 아니라
   **낱말열에서 지워야 한다.**
6. **하이픈 복원** — `-\n` → `` (실측: `distribu- tion` · `deriva-tives` · `recogni- tion`).
   ⚠️ 다중 컬럼 PDF 는 **낱말이 뒤섞여 복원 불가**다(실측 s4 부록 인터뷰 표). 같은 짧은 어구가
   3회 이상 반복되면 컬럼 붕괴로 보고 그 구간을 버린다.
7. **산문 밀도 필터** — doab.md §7 과 같은 규칙(40낱말 이상 · 숫자비 <4% · 인용마커 ≤2 ·
   대문자비 <9% · `Fig.`/`Table`/`[숫자` 로 시작 안 함). **이걸 안 걸면 참고문헌이 지문으로 나온다**
   — 표본 5권 중 2권에서 실제로 그렇게 나왔다(⑤, 그리고 Open Book Publishers 검증본).
8. 출력에 **핸들 · 라이선스 URI · 저자 · 출판사 · 임프린트 · DOI** 를 함께 실어
   CC BY 귀속 표시를 만들 수 있게 한다. **BY-SA 항목은 별도 버킷**(결과물 전염).

### 몇 번에 나눠 돌릴지

| | 요청 수 | 초당 1요청 | `Crawl-delay: 10` 준수 |
|---|---|---|---|
| 1단 (OAI `ListRecords` 499 + REST 검증 43) | **542** | 9분 | 1.5시간 |
| 2단 (3,000권 × `expand=bitstreams` + `retrieve`) | **6,000** | 100분 | 17시간 |
| **합** | **6,542** · 다운로드 **3.3 GB** | **~2시간** | **~18시간** |

- `/rest` **15연속 요청 전부 200 · 429 없음**을 실측했으나, 그것이 허락은 아니다(§2-2-1).
  **1회차는 `Crawl-delay` 를 지켜 하룻밤에 돌리는 쪽을 권한다** — 한 번 차단당하면
  이 소스 전체를 잃는다. 2회차부터는 증분(35요청 + 신규분)이라 몇 분이면 끝난다.
- doab.md 의 **6~7일 분할이 필요 없다** — 병목이던 PDF 60 GB 다운로드와 `pdftotext` 변환이
  통째로 사라졌기 때문이다(§2-1). 여기서는 평문 3.3 GB 뿐이다.
- 커서: `scripts/csat/data/oapen-extract-cursor.json` 에 처리 완료 핸들 집합.
  PLOS 가 16분할한 것처럼 호스트별로 나눌 이유가 없다(단일 호스트 · 단일 어댑터).
  다만 **중단 지점에서 정확히 재개**되어야 한다 — 18시간짜리 작업은 반드시 한 번은 끊긴다.

### 먼저 할 것 (파일럿)

**Palgrave Macmillan 855권 중 CC BY 만 골라 100권 파일럿.** §7 이 보여주듯 이 소스의 값어치는
권수가 아니라 **인문·사회 축의 다양성**이고, 그 축이 몰려 있는 곳이 Palgrave 다.
여기서 게이트 통과율이 PLOS 대비 유의미하게 높으면 Springer 전량으로 넓히고,
그 다음이 §8-3 의 **OAPEN 전체(49,817권)** 다 — Cambridge·Oxford 가 아니다.

### 그리고 doab.md 를 고쳐야 한다

§2-2 는 [doab.md](./doab.md) 의 세 곳을 무효화한다:
- §2 표의 `library.oapen.org 40,168 → ❌ 403 Anubis`
- §6 「6,634 (마찰 없음)」 — OAPEN 7,445권이 여기 더해진다
- §「보류 해제 조건」 2번(헤드리스로 Anubis 통과) — **불필요해졌다**

DOAB 의 판정이 「보류」였던 이유가 **인문·사회 도달 불가**였으므로, 이 정정은 DOAB 재판정을
요구한다. **이 정찰의 범위를 넘으므로 여기서는 고치지 않고 기록만 남긴다** —
CLAUDE.md §4️⃣ 「측정 → 기록 → (별도 결정) → 수정. 같은 턴에 고치면 측정이 오염된다」.
