<!-- docs/reports/source-probe/doab.md -->
# DOAB (Directory of Open Access Books) 확보 정찰

> **2026-09-07 재판정.** 이 문서의 초판은 DOAB 를 **보류**로 적었고 핵심 사유가
> 「최대 호스트 OAPEN 40,168권(39%)이 Anubis PoW 로 403 이라 전문 도달 불가」였다.
> **그 사유가 틀렸다.** Anubis 는 `/handle/`·`/bitstream/` 웹 경로에만 걸려 있고
> `/rest/…` 는 200 이다. 오늘 세 번째로 — 이번엔 이 문서 자신의 손으로 — 재확인했다.
> 무엇이 왜 바뀌었는지는 **§0 정정 기록**에 남긴다. 아래 본문은 전부 재측정한 값이다.

| | |
|---|---|
| 판정 | **채택 (조건부)** — 조건은 라이선스 재확인 게이트와 `lib-topic.mjs` 수정, §판정 근거 |
| 확보 가능 편수 | 실측 **13,735권** (영어 · 상업적 변형 가능 · 중복 제거 · **오늘 코드 없이 닿는 것**). 그중 **인문·사회 2,543권**(주제 분류가 있는 것 기준) |
| 라이선스 | 항목별로 다름. 도달분 13,735 는 CC BY 13,080 · CC BY-SA 651 · PD 4(+B 측 미분류 소수). ⚠️ **메타데이터가 항목 단위 진실이 아니다** — 표본 5권 중 1권에서 판권면과 모순(§4-3) |
| 전문 | **온다. PDF 가 아니라 이미 추출된 평문(`<파일>.pdf.txt`)으로.** 표본 17/17 존재 |
| 안정 식별자 | DOAB 핸들 `20.500.12854/<n>` (행 식별, 102,068/102,078 유일) + **OAPEN 핸들 `20.500.12657/<n>`(전문 키)**. DOI 는 87.1% 라 보조키 |
| 증분 커서 | OAI-PMH `from`/`until` + CSV 덤프 전량 대조(요청 1회 30초) |
| 정찰 일자 | 2026-09-07 (초판 같은 날 · 재판정 같은 날) |

---

## 0. 정정 기록 — 무엇이 왜 바뀌었나

| 초판이 적은 것 | 재판정 실측 | 왜 틀렸나 |
|---|---|---|
| OAPEN 40,168권 **도달 불가**(Anubis PoW · 헤드리스 필요) | **도달 가능.** `/rest/handle/…` 200 · `/rest/bitstreams/<uuid>/retrieve` 200 | 웹 경로 두 개(`/handle/`·`/bitstream/`)만 시험하고 **같은 사이트의 REST API 를 시험하지 않았다.** 게이트를 사이트 전면으로 일반화한 것이 오류 |
| 「오늘 당장 받을 수 있는 수 **6,634권**」 | **13,735권** (6,614 + OAPEN 7,121) | 위 오류의 직접 결과. 6,634 라는 값 자체는 **재현됐다**(§6) — 필터가 틀린 게 아니라 분모에서 뺀 것이 잘못이었다 |
| 「인문·사회는 도달 가능 풀에 **400권 미만**」 | **2,543권** (분류 있는 것만. 미분류 2,772 를 같은 비율로 풀면 ≈3,900) | 같은 원인. 인문·사회는 IntechOpen 이 아니라 **OAPEN 쪽에 몰려 있었다** |
| 전문을 얻으려면 **PDF 60 GB 를 받아 `pdftotext`** | **평문 0.3~0.8 MB/권.** OAPEN 이 `.pdf.txt` 를 이미 붙여 둔다 | `expand=bitstreams` 를 못 봤다. 2단 수확기 설계가 통째로 달라진다 |
| CSV **78 컬럼** | **138 컬럼** | 오기. 행수 102,078 은 정확(재측정 일치) |
| 「`dc.identifier.uri` 100%」 | 채워짐은 100% 지만 유일값은 102,068 — **10건 중복** | 「100%」는 채워짐(non-null)이지 유일성이 아니었다 |
| 중복 배제는 핸들 하나면 된다 | **아니다.** 같은 책이 **DOAB 핸들 두 개**로 들어와 있다 — DOI 로 잡히는 것만 1,706쌍(§5-2) | 초판이 유일성을 검사하지 않았다 |

**바뀌지 않은 것**: 전체 라이선스 분포(오차 ±50), 산문 밀도가 STEM 편집서에서 낮다는 관측,
판권면 모순 사례의 존재, `deletedRecord=transient`, OAI 오프셋 토큰 구조, `BITSTREAM License`
컬럼을 안 읽으면 전량 놓친다는 것. 초판의 나머지는 유효하다.

---

## 1. 대량 접근 경로 — 두 개 있고 둘 다 살아 있다

### (a) 전체 메타데이터 덤프 — 주력

```
GET https://directory.doabooks.org/download-export?format=csv
→ 200, 280,787,618 B (280 MB), 29.6초, 요청 1회
```
**재측정에서 바이트 수가 초판과 정확히 같았다**(같은 판이라는 뜻). 스트리밍 상태기계로 파싱해
**138 컬럼 × 102,078 행** — 행수도 초판과 일치한다. `format=json` 은 500, ONIX 판은 666 MB.

라이선스·언어·주제·다운로드 URL·DOI·**OAPEN 핸들**이 전부 이 한 파일에 있다.
그래서 이 소스는 **「목록 만들기」에 네트워크를 30초만 쓴다.**

### (b) OAI-PMH — 증분용

```
https://directory.doabooks.org/oai/request?verb=ListRecords&metadataPrefix=oai_dc&from=…
```
초판 실측 유지: `earliestDatestamp 2020-04-01T14:43:18Z` · granularity 초 단위 ·
`deletedRecord transient` · 오프셋 토큰(`prefix/from/until/set/offset`) · 5주에 2,693건.

### (c) 전문 — **DOAB 가 아니라 OAPEN REST**

```
GET https://library.oapen.org/rest/handle/20.500.12657/<n>?expand=bitstreams,metadata
GET https://library.oapen.org/rest/bitstreams/<uuid>/retrieve
```

### robots.txt — 두 사이트가 다르다. 둘 다 직접 읽었다

| | `directory.doabooks.org` | `library.oapen.org` (3,373 B) |
|---|---|---|
| `Content-Signal` | `search=yes, ai-train=no, use=reference` | **없음** |
| ClaudeBot·GPTBot·CCBot·Amazonbot·Applebot-Extended | **`Disallow: /`** | **언급 없음** |
| `Crawl-delay` | 없음 | **10** (`User-agent: *`) |
| `Disallow` 대상 | — | `/discover` `/search-filter` `/browse` `/statistics` `/login` `/register` `/contact` `/feedback` `/mapping` |
| `/rest` · `/oai` | — | **언급 없음 → 허용** |

OAPEN 것은 DSpace 기본 robots.txt 그대로다(위키백과에서 빌려 온 "misbehaving bots" 목록까지 그대로).
DOAB 것은 Cloudflare Managed 블록이고 서두에 *"ANY RESTRICTIONS EXPRESSED VIA CONTENT SIGNALS ARE
EXPRESS RESERVATIONS OF RIGHTS UNDER ARTICLE 4 OF THE EU DIRECTIVE 2019/790"* 이 박혀 있다.

⚠️ **이 재판정은 그 선을 넘지 않았고, 넘을 권한도 없다.**
전문은 전부 **OAPEN**(AI 유보 선언 없음)에서 받았다. 다만 **목록의 근거인 CSV 덤프는
DOAB 것**이고, DOAB 는 ClaudeBot 을 이름으로 차단한다. 우리는 ClaudeBot 이 아닌 자체 UA
(`VocaflowSourceProbe/1.0` + 연락처)로 요청 **1회**를 보냈고 이는 `User-agent: *` 의 `Allow: /`
아래 있다 — 그러나 `ai-train=no` 라는 **명시적 유보가 이 사이트에 존재한다는 사실 자체**는
지워지지 않는다. 발췌·재조판은 모델 학습이 아니지만 **그 해석을 우리가 임의로 확정하지 않는다.**
→ **[SUMMARY.md](./SUMMARY.md) §7 「결정 대기」 4번에 그대로 남긴다.**

**우회로가 있다는 것도 함께 적는다**: 목록을 DOAB CSV 대신 **OAPEN 쪽 OAI-PMH**
(`library.oapen.org/oai/request`, AI 유보 없음)로 만들면 DOAB 를 한 번도 건드리지 않고 파이프라인이 선다.
비용은 요청 1회 → 약 500회, 그리고 **DOAB 가 하는 OA 심사 필터를 잃는 것**이다.
사용자가 §7-4 를 「넘지 않는다」로 정하면 **이 경로를 쓴다** — 막히는 것이 아니다.

---

## 2. 전문(full text)이 오는가 — **온다. 그리고 이미 평문이다**

### 2-1. 웹 경로와 REST 경로를 같은 세션에서 비교했다 (2026-09-07 재확인)

초판이 실패 사례로 든 **바로 그 책**(`20.500.12657/50315`, *Human Cultures through the
Scientific Lens*, Open Book Publishers):

| 경로 | 결과 |
|---|---|
| `GET /handle/20.500.12657/50315` | ❌ **403** `text/html` 4,454 B (Anubis) |
| `GET /bitstream/20.500.12657/50315/1/9781800642089.pdf` | ❌ **403** `text/html` 4,454 B (Anubis) |
| `GET /rest/handle/20.500.12657/50315?expand=bitstreams` | ✅ **200** `application/json` 4,795 B |

**전언을 믿지 않고 직접 던진 결과다.** 우회가 아니다 — 같은 사이트가 공개한 다른 공식
엔드포인트이고, 로그인·토큰·PoW·쿠키를 하나도 건드리지 않는다. robots.txt 가 `/rest` 를
언급조차 하지 않는다(§1).

### 2-2. 표본 17권 — REST 200 **17/17**, `.pdf.txt` **17/17**, 429 **0회**

전량 서로 다른 출판사가 되도록 인문·사회 풀에서 균등 간격으로 뽑았다.

| OAPEN 핸들 | 출판사 | 라이선스 | `.pdf.txt` |
|---|---|---|---|
| 98487 *The Brazilian Amazonia in Change I* | transcript Verlag | BY-SA | 670,618 B |
| 61278 *The Ethical Spirit of EU Values* | Springer Nature | BY | 830,284 B |
| 27185 *Laughter in the Void* | Peter Lang | BY(메타) | 390,214 B |
| 51814 *On Boredom* | UCL Press | BY | 308,568 B |
| 52055 *Retreat or Entrenchment?* | Stockholm University Press | BY | 656,719 B |
| 22337 · 63266 · 104526 · 64079 · 42449 · 49744 · 90231 · 26881 · 23142 · 37333 · 63255 · 90666 | UCL · Language Science · Firenze · African Minds · OBP · Peter Lang · Springer · Arc Humanities · InTechOpen · transcript | BY×11 · BY-SA×1 | 399 KB ~ 1.77 MB — **전부 존재 · 2 KB 미만 0건** |

`.pdf.txt` 는 **평균 0.3~0.8 MB**다. 초판이 계획한 「PDF 6,634 × 9 MB ≈ 60 GB 를 받아 `pdftotext`」는
**필요 없다.** 같은 물량이 **약 8 GB**이고 변환 단계가 사라진다.

### 2-3. ⚠️ 챕터 항목은 **이미 잘려서** 온다

도달 풀 7,121 중 **1,552(21.8%)가 `dc.type=chapter`** 이고, 챕터도 자기 OAPEN 핸들과
자기 `.pdf.txt` 를 갖는다(실측 `20.500.12657/74918` → `9791221501063-46.pdf.txt`
**23,931 B ≈ 3,600낱말**). **챕터 경계 휴리스틱 없이 도입부를 자를 수 있는 몫이 1,552권치 있다** —
§3-2-③ 의 난제를 우회하는 가장 싼 길이다.

---

## 3. `.pdf.txt` 는 쓸 만한 평문인가 — **이번 재판정의 실질**

REST 가 열려 있어도 평문이 쓰레기면 소용없다. 표본 5권 전문을 실제로 읽고 쟀다.

### 3-1. 산문 밀도 — 인문·사회는 **61~79%**

줄 단위 분류(45자 미만 · 점선 목차 · 숫자비 >15% · 대문자비 >25% · 참고문헌 항목형
`Smith, J.` · `Fig.`/`Table`/URL 시작 · 알파벳비 <72% 를 비산문으로) 후 연속 산문 줄을 이었다:

| 표본 | 전체 낱말 | 산문 낱말 | 밀도 | 250낱말↑ 연속 산문 | **깨끗한 300낱말 창** |
|---|---|---|---|---|---|
| *On Boredom* (UCL) | 49,016 | 38,661 | **79%** | 37 | **24** |
| *Retreat or Entrenchment?* (Stockholm) | 99,767 | 76,490 | **77%** | 14 | 5 |
| *Brazilian Amazonia* (transcript) | 109,644 | 84,109 | **77%** | 28 | **18** |
| *Laughter in the Void* (Peter Lang) | 60,778 | 40,207 | **66%** | 5 | 2 |
| *Ethical Spirit of EU Values* (Springer) | 129,590 | 78,863 | **61%** | 24 | 9 |

**초판이 IntechOpen STEM 편집서에서 잰 29~38% 의 두 배다.** 초판이 「인문·사회는 밀도 70%,
책당 10편 이상」이라 예측한 것이 맞았다 — 다만 그 책들을 도달 불가라고 적었을 뿐이다.

**5권 합계 깨끗한 300낱말 창 58개, 권당 중앙값 12.** (창을 겹치지 않게 잘랐다.
슬라이딩 창을 쓰면 더 나오지만 서로 겹친 것을 편수로 세지 않는다.)

### 3-2. 그러나 결함이 다섯 있다 — 전부 실측

**① 문단 경계가 없다.** 빈 줄이 문서당 **1~23개**뿐이다(670 KB 문서에 23개). 줄바꿈은
문단이 아니라 **줄 끝**이고 줄 끝 하이픈 분철(`literatu-\nre`)이 그대로 남는다.
→ 문단 단위가 필요하면 휴리스틱을 짜야 한다. **창(窓) 단위로 쓸 거면 문제되지 않는다.**

**② 판권면·목차가 앞 1,700~6,700낱말을 먹는다.** 실측 첫 산문 위치:
1,740 / 2,526 / 6,748낱말. 「문서 25% 지점에서 자른다」 같은 고정 오프셋은 초판이
경고한 대로 못 쓴다.

**③ ⚠️ 읽기 순서가 항상 선형이 아니다 — 이번에 새로 잡은 것.**
「챕터 표제를 찾아 그 다음 300낱말」로 자르면 **3권 중 2권에서 다른 단(段)·다른 쪽 글이 섞여 들어온다**:

> "…and the dangers of the tropical jungle. Many perished; their places were taken by other
> **erage of 38 600 tons per year was exported.** Rubber supplied more than a third of…"
> (*Brazilian Amazonia*, 챕터 도입 창 — 문장 한가운데에 다른 단의 조각이 박혔다)

> "3 See, for example, Hassan, *The Age of Distraction*. … Merrifield, Andy. *Metromarxism*
> (New York and London: Routledge, 2002). **'Isn't "not to be bored" one of the principal
> goals of life?'** This was one of the questions Gustave Flaubert asked himself…"
> (*On Boredom*, 챕터 도입 창 — 각주와 참고문헌이 본문 앞에 붙었다)

→ **결론: 추출 단위는 「챕터 오프셋」이 아니라 「연속 긴 산문 런(run)」이어야 한다.**
런 방식으로 자른 창 58개에는 이 증상이 없었다(§7 인용이 그 창들이다).
**이 한 줄이 수확기 설계를 가른다.**

**④ 각주 번호가 낱말에 붙는다** — `illiberal717`, `fiction'.24`. 실측 빈도
**1,000낱말당 0.9개**(창 하나에 0.3개꼴). 정규식 한 줄로 떨어진다 — 값싼 결함이다.

**⑤ OCR 레트로 디지털판이 섞여 있다.** *Laughter in the Void*(1982년 판 스캔)는
`LAUGHTEE IN THE VOID` · `DaniilKliarms` · 키릴 잡음이 그대로이고, 페이지마다
`Downloaded from PubFactory at 01/11/2019 09:53:59AM / via free access` 워터마크가
본문에 주입돼 있다. **이 권이 창을 2개밖에 못 낸 이유다.** 수확기는 OCR 판을 걸러야 한다
(워터마크 반복 문자열 + 사전 밖 토큰 비율).

---

## 4. 라이선스 — 도달분에 한정해 다시 셌다

라이선스는 세 컬럼 중 하나에 온다: `dc.rights.licenseurl` → `dc.rights.uri` → **`BITSTREAM License`**.
(앞의 둘만 읽으면 MDPI·Frontiers·IntechOpen·Peter Lang 을 전량 놓친다 — 초판 관측 유효.)

### 4-1. OAPEN 도달 가능분 41,417권 전수

| 라이선스 | 전체 41,417 | 영어 27,306 | 변형 | 상업 |
|---|---|---|---|---|
| CC BY-NC-ND | 18,729 (45.2%) | 13,843 | ❌ | ❌ |
| **CC BY** | **12,834 (31.0%)** | **6,791** | ✅ | ✅ |
| CC BY-NC | 3,162 | 2,740 | ✅ | ❌ |
| **CC BY-SA** | **2,200** | **689** | ✅ | ✅ (결과물 SA 전염) |
| (없음) | 1,825 | 1,314 | ❌ 판정 불가 | |
| CC BY-NC-SA | 1,303 | 1,007 | ✅ | ❌ |
| 기타 비-CC | 688 | 662 | ❌ 개별 검토 | |
| CC BY-ND | 639 | 225 | ❌ | ❌ |
| 표기 오류형 | 31 | 31 | 정규화 필요 | |
| PD Mark / CC0 | 6 | 4 | ✅ | ✅ |

**ND 계열 = 19,368 (46.8%)** — 전체 DOAB(36%)보다 **OAPEN 쪽이 ND 비율이 높다.**
(전체 102,078 재집계는 초판과 일치: BY-NC-ND 36,183 · BY 35,136 · 없음 11,679 · BY-NC 4,431 ·
BY-NC-SA 4,041 · BY-SA 3,566 · BY-ND 821 · 기타 6,183. 오차 ±50 은 정규화 규칙 차이다.)

### 4-2. 오늘 실제로 쓸 수 있는 것 — 13,735권

| | CC BY | CC BY-SA | PD | 합 |
|---|---|---|---|---|
| **A. OAPEN REST** | 6,466 | 651 | 4 | **7,121** |
| **B. 직접 PDF (비-OAPEN)** | 6,614 | 0 | 0 | **6,614** |
| 합 (중복 제거 후) | **13,080** | **651** | **4** | **13,735** |

⚠️ **CC BY-SA 651권은 결과물이 SA 로 전염된다.** [SUMMARY.md](./SUMMARY.md) §7-1 의
「SA 전염」 결정이 나기 전까지 **별도 버킷**이다. SA 를 빼면 도달분은 **13,084권**.

### 4-3. ⚠️ 메타데이터와 판권면이 어긋난 사례를 **또 잡았다 (표본 5권 중 1권)**

`20.500.12657/27185` *Laughter in the Void* (Peter Lang / Verlag Otto Sagner, DOAB `20.500.12854/26388`)

- DOAB 메타데이터 `BITSTREAM License`: **`https://creativecommons.org/licenses/by/4.0/legalcode`** (CC BY 4.0)
- PDF 판권면 원문: **"© bei Verlag Otto Sagner. Eine Verwertung oder Weitergabe der Texte und
  Abbildungen, insbesondere durch Vervielfältigung, ist ohne vorherige schriftliche Genehmigung
  des Verlages unzulässig."** (= 텍스트·도판의 이용이나 전달, 특히 복제는 출판사의 사전 서면
  허가 없이 **불허**)

초판의 Ledizioni 사례(표본 4중 1)와 **같은 유형이 다른 출판사에서 재현**됐다.
[oa-humanities-presses.md](./oa-humanities-presses.md) §3 도 Open Humanities Press 에서
반대 방향(메타데이터 CC BY ↔ 본문 CC4r)의 같은 병을 잡았다. **세 정찰이 독립적으로 같은 결론에 닿는다:**

> **라이선스는 두 번 읽는다. 메타데이터와 `.pdf.txt` 앞머리 판권면. 다르면 본문이 권위이고, 드롭한다.**

대조 비용은 사실상 0 이다 — 표본 5권 중 **4권의 판권면 문구가 앞 3,000낱말 안에** 그대로 있었다
(*"licensed under the Creative Commons Attribution 4…"* · *"…Attribution-ShareAlike 4.0 (BY-SA)…"* ·
*"Open Access This book is licensed under the terms of…"*). 문구가 **없는** 5번째 권이 바로 위
모순 사례였다 — **「라이선스 문구 부재」 자체가 위험 신호다.**

---

## 5. 안정 식별자 · 중복 배제 키 — **초판보다 나빠졌다. 실측이 그렇다**

### 5-1. 세 키의 실측 성질

| 키 | 채워짐 | 유일성 | 역할 |
|---|---|---|---|
| **DOAB 핸들** `20.500.12854/<n>` | 102,078 / 102,078 (100%) | **102,068 유일 — 10건 중복** | 레코드(행) 식별 |
| **OAPEN 핸들** `20.500.12657/<n>` | **41,417 (40.6%)** | 사실상 유일(다중 기재 41행) | **전문 취득 키 · 「OAPEN 소관」 플래그** |
| DOI (`oapen.identifier.doi`) | 88,867 (87.1%) · 유일값 82,335 | ❌ **12,685행(12.4%)이 중복군** | 작품(work) 동일성 **판정용** |
| ISBN (`dc.identifier.isbn`) | 전량 공란 | — | 못 씀 (초판과 동일) |

### 5-2. ⚠️ 같은 책이 DOAB 핸들 두 개로 들어와 있다

초판은 「핸들 숫자부를 유일 키로 쓴다」로 끝냈다. **그것만으로는 중복이 안 잡힌다.**
DOI 로 잡히는 것만 **1,706쌍**이 「OAPEN 핸들 있는 행」과 「없는 행」에 갈라져 있다:

```
DOI 10.1007/978-3-319-63295-7  Lone Parenthood in the Life Course (Springer Nature)
  ├ DOAB …54/30018  ← OAPEN 핸들 있음
  └ DOAB …54/51972  ← 없음. link.springer.com 으로 감
DOI 10.1525/luminos.160  Sounding the Indian Ocean (Univ. of California Press)
  ├ DOAB …4/121469  ← OAPEN 핸들 있음
  └ DOAB …4/118537  ← 없음
```
제목 정규화로 세면 **14,708행이 중복군**(초과분 8,154)이다. DOI 가 없는 13% 는 이 검사를 못 받는다.

### 5-3. 확정안 — 세 겹

```
1차 (행 식별)   DOAB 핸들 숫자부            재수확 멱등성. 이미 처리한 행은 건너뛴다
2차 (작품 식별) 정규화 DOI                  접두사 제거(dx.doi.org · doi:) + 소문자
                └ 없으면 정규화 제목+출판사   DOI 결측 13% 를 덮는다
3차 (전문 소관) OAPEN 핸들 유무             있으면 REST, 없으면 호스트 어댑터
```
실측 효과: 도달 후보 14,118행 → **13,735 작품**(383행이 접혔다).

**어느 것도 단독으로는 못 쓴다** — DOAB 핸들은 같은 책을 두 번 세고, DOI 는 13% 가 없고,
OAPEN 핸들은 40.6% 에만 있다.
[publisher-oa-books.md](./publisher-oa-books.md) 가 「조인 키는 OAPEN 핸들」이라 적은 것은
**전문 쪽에 대해 맞고**, 등록부(중복 방지) 키로는 위 세 겹이 필요하다.

---

## 6. 현실적 확보 가능 편수 — **13,735권** (초판 6,634 의 2.07배)

CSV 102,078행 전수 집계. 초판과 **같은 순서로** 좁혀 재현성을 보였다.

| 필터 | 남는 수 |
|---|---|
| 전체 항목 | **102,078** (book 92,260 · chapter 9,818) |
| ↳ 영어 (`dc.language` 에 eng) | **59,160** (초판 59,159) |
| ↳ + 상업적 변형 가능 (CC BY / BY-SA / CC0 / PDM) | 26,140 |
| **↳ + 오늘 코드 없이 닿는 것** | **14,118행 → 중복 제거 13,735 작품** |
| ┣ **A. OAPEN 핸들 있음 → `/rest/` 로 평문** | 7,484행 → **7,121** |
| ┗ **B. 비-OAPEN 직접 `.pdf`** | 6,634행 → **6,614** |

> ⚠️ **B 의 6,634 는 초판 값과 정확히 일치한다.** 같은 필터를 다시 짜서 같은 수가 나왔다 —
> 초판의 계산이 틀린 게 아니라 **A 를 0 으로 놓은 것**이 틀렸다.
> NC 를 허용하면(비상업 한정) 더 늘지만 Vocaflow 는 유료화 전제이므로 **세지 않는다.**
> Frontiers 랜딩 2,948권은 1홉이 더 필요하므로 위 수에 **넣지 않았다.**

### 6-1. 주제 분포 — **여기가 판정을 뒤집는다**

thema EDItEUR / BIC 최상위 문자로 셌다(한 책이 여러 축을 갖는다).
「순인문·사회」= 인문·사회 축이 있고 **STEM 축(M 의학 · P 수학과학 · R 지구환경 · T 공학 ·
U 컴퓨팅 · V 건강)이 없는 것**.

| | A. OAPEN 7,121 | B. 직접PDF 6,614 | 합 13,735 |
|---|---|---|---|
| 주제 분류 있음 | 4,448 | 6,515 | 10,963 |
| **순인문·사회** | **2,214** | 329 | **2,543** |
| 인문·사회 축 포함 | 2,847 | 331 | 3,178 |
| 순 STEM | 1,386 | 5,916 | 7,302 |
| 분류 없음 | 2,673 | 99 | 2,772 |

**순인문·사회 2,214권(A)의 세부** — 초판이 「N 역사 25 · 문학 2」라 적은 자리다:

| thema | 뜻 | 초판(도달분) | **재판정(A)** |
|---|---|---|---|
| J | 사회·사회과학 | 273 | **1,284** |
| N | 역사·고고 | **25** | **383** |
| C | 언어·언어학 | — | **350** |
| D | 전기·문학·문학연구 | **2** | **251** |
| A | 예술 | — | **217** |
| Q | 철학·종교 | — | **203** |
| K | 경제·경영 | 223 | 183 |
| L | 법 | — | 134 |
| G | 참고·학제 | — | 128 |

**이 저장소의 병목(역사·인류·철학)에 정확히 해당하는 N+Q+D+A = 1,054권**이 열렸다.
PLOS 51,465편(학술 STEM)과 **문체도 분과도 겹치지 않는 몫**이다.

⚠️ **분류 없음 2,673권(A 의 37.6%)을 세지 않았다.** 표본 제목은 인문·사회가 많다
(*A Life Course Perspective on Chinese Youths* · *The Gender Regime of Anti-Liberal Hungary* ·
*A Connected Curriculum for Higher Education* · *Between Kafka and Gogol'*). 분류 있는 것의
순인문·사회 비율 49.8% 를 그대로 적용하면 **A 의 순인문·사회는 ≈3,545, 합계 ≈3,874** 다 —
**추정이므로 판정에는 실측 2,543 만 쓴다.**

### 6-2. 도달분의 정체 — 초판은 한 출판사, 지금은 여럿

| A. OAPEN 7,121 | 권 | | A 중 순인문·사회 2,214 | 권 |
|---|---|---|---|---|
| Springer Nature | 2,590 | | Springer Nature | 517 |
| Firenze University Press | 773 | | Language Science Press | 186 |
| InTechOpen | 571 | | Firenze University Press | 164 |
| Taylor & Francis | 298 | | Taylor & Francis | 134 |
| transcript Verlag | 227 | | transcript Verlag | 113 |
| Language Science Press | 225 | | Open Book Publishers | 103 |
| Open Book Publishers | 202 | | Peter Lang | 91 |
| Peter Lang | 187 | | De Gruyter | 89 |
| KIT Scientific Publishing | 187 | | UCL Press | 59 |
| De Gruyter 165 · UCL Press 115 · Göttingen 90 · Budrich 67 · Brill 66 | | | Budrich 48 · Göttingen 42 · African Minds 37 · Ubiquity 29 · meson 27 · heiUP 22 | |

**B 6,614 는 여전히 IntechOpen 이다**(mts.intechopen 6,073 + s3 369 = 97.4%, 순 STEM 89%).
초판의 「6,634 의 97%가 한 출판사」는 **B 에 대해서만 맞는 말**이었다.

### 6-3. 편수(발췌)로 세면

권당 깨끗한 300낱말 창 **중앙값 12**(§3-1, 표본 5권 58창). 순인문·사회 2,543권만 잡아도
**≈30,000창**이고, 권당 상한 20창을 두면 그 안이다. **목표표의 5,250 편은 인문·사회 몫만으로 넘는다.**
(한 권 안에서 필자·소재가 겹치므로 권당 상한은 선택이 아니라 필수다.)

---

## 7. 지문 적합성 표본 판정

`scripts/csat/gate-article-drain/JUDGING.md` 어휘. 런(run) 방식으로 자른 실제 창이다.

**① *On Boredom* (UCL Press · CC BY · 예술·문화)** — **use**
> "As we have seen, Demand appropriates hyper-mediated but personally affecting photographic
> images and transforms them into objects of long experience. … This series engages with the
> ubiquitous, banal, everyday practice of taking photographs with one's smartphone. The device
> makes possible the habit of snapping, sharing and saving fairly inconsequential images which
> then serve as a little archive of personal memories."

통념 → 사례 → 함의. 자족적이고 연결어가 조밀하다. **이 재판정의 최상 표본.**
각주 번호가 낱말에 붙는다(`experience.24`) — 정규식 소관.

**② *Retreat or Entrenchment?* (Stockholm UP · CC BY · 사회·정책)** — **use**
> "Whereas the state takes a keen interest in the health of the population at large, the
> equivalent interest in the health of drug users is conspicuously absent. To make sense of the
> divide between drug policy and other areas of the welfare state, I highlight an understanding
> of the welfare state as an 'institution of curtailment'."

논증문 그대로다. 다만 자기지시("In the next section I present…")가 창 앞머리에 섞였다 —
**창 선택기가 메타담화 문장을 감점해야 한다.**

**③ *The Brazilian Amazonia in Change I* (transcript · CC BY-SA · 지리·역사)** — **use**
> "The comparison that was made more than once, in official publications and elsewhere, between
> the Transamazônica and the Belém–Brasília highway and the conclusions which were drawn in
> respect of the future development of the Amazon region were highly disputable, since the
> Belém–Brasília highway connected totally different regions."

수능 사회·지리 지문 결. **다만 CC BY-SA — SA 전염 결정(SUMMARY §7-1) 대기.**

**④ *The Ethical Spirit of EU Values* (Springer · CC BY · 법)** — **경계선**
> "Certain illiberal717 tendencies have made clear that EU membership is no guarantee for the
> continued commitment to EU values. … Based on this pacta sunt servanda perspective of
> obligations committed without coercion ('free and voluntarily'), the Court has addressed a
> possible reduction of the level of protection of EU values compared to the time of accession."

법학 산문이라 어휘·구문 난도가 고등학교 상단을 넘고 라틴 법률어가 각주 없이는 안 풀린다.
**V-Level 상단 전용.** 각주 번호 혼입이 다섯 중 가장 심하다.

**⑤ *Laughter in the Void* (Peter Lang · 메타데이터 CC BY)** — **라이선스 사유로 제외**
문학연구 산문 자체는 `use` 급이나 **§4-3 판권면 모순 + OCR 손상 + 워터마크 주입**으로 쓸 수 없다.

### 종합

- **3/5 `use`, 1 경계선, 1 라이선스 제외.** 초판의 4권 표본(1 use · 1 부분 use · 2 제외)보다 낫다.
  **표본 구성이 달라졌기 때문이다** — 초판은 도달 가능하다고 믿은 IntechOpen STEM 을 봤고,
  이번엔 열린 OAPEN 인문·사회를 봤다.
- 판정을 가르는 것은 **소스도 출판사도 아니고 분과**다. 이 점은 초판 ·
  [publisher-oa-books.md](./publisher-oa-books.md) · [oa-humanities-presses.md](./oa-humanities-presses.md)
  셋이 독립적으로 같은 말을 한다.

---

## 8. 세 정찰을 한 그림으로 — **수확기는 하나면 된다**

같은 날 세 정찰이 서로 다른 문으로 들어가 **같은 방**에 도착했다.

| 정찰 | 대상 | 실측 결론 | 이 문서와의 관계 |
|---|---|---|---|
| [publisher-oa-books.md](./publisher-oa-books.md) | Cambridge · Oxford · Springer | Springer ≈3,008권만 채택. 나머지 둘 라이선스 반려 | **Springer 는 본 문서 A 의 부분집합**(A 안의 Springer 2,590) |
| [oa-humanities-presses.md](./oa-humanities-presses.md) | OBP · ANU · MIT · punctum · OHP | OBP ≈145~320 + OHP ≈45 만 생존 | **다섯 곳 전부 본 문서 A 의 부분집합** |
| **본 문서** | DOAB 전량 | **13,735권** | 위 둘을 **포함한다** |

⚠️ **SUMMARY §2 에서 「Springer OA ≈3,027권」과 「DOAB」를 더하면 안 된다 — 이중 계상이다.**

### 8-1. 다섯 인문 출판사 — 표본 추정을 **전수로 확정했다**

[oa-humanities-presses.md](./oa-humanities-presses.md) 는 25권 표본으로 비율을 재고 곱했다.
CSV 전수로 같은 것을 세면:

| 곳 | DOAB 행 | OAPEN 핸들 있음 | 영어 + 변형가능 + OAPEN **전부 통과** | 그쪽 표본 추정 |
|---|---|---|---|---|
| Open Book Publishers | 539 | 415 (77%) | **203** | ≈145 (폭 145~320) |
| Open Humanities Press | 64 | 64 (100%) | **54** | ≈45 |
| ANU Press | 869 | 721 (83%) | **0** | 0 ✅ |
| punctum books | 456 | 429 (94%) | **0** | 0 ✅ |
| The MIT Press | 281 | **2 (0.7%)** | **0** | 0 ✅ |

**표본 판정 셋이 전수와 정확히 일치하고**(ANU·punctum 은 라이선스에서 전멸, MIT 은 라이선스와
미러 양쪽에서), OBP·OHP 는 그쪽 추정 범위 안에서 **정확한 값 203·54** 로 확정된다.
⚠️ 총량이 그쪽(730·914·641·457·67)과 다른 것은 **세는 근거가 달라서다** — 그쪽은 DOAB
publisher 레코드의 `oapen.relation.isPublisherOf` 관계 수, 이쪽은 CSV 의
`oapen.relation.isPublishedBy_publisher.name` 값이다. **어느 쪽이 정본인지 확정하지 못했다**
(OBP 539 vs 730 · MIT 281 vs 641 은 차이가 크다). 다만 **「전부 통과」 열은 두 방식 어느 쪽으로
세도 같은 결론**을 준다.

### 8-2. 수확 순서 — 「OAPEN 먼저, DOAB 는 핸들 있는 것 버림」은 **거꾸로다**

그 표현대로 하면 라이선스를 잃는다. **REST 응답에는 라이선스 필드가 없다**
([publisher-oa-books.md](./publisher-oa-books.md) §3 실측 — 26필드에 `dc.rights` 도
`licenseCondition` 도 없다). 라이선스는 OAI `GetRecord` 나 **DOAB CSV** 에만 있고,
CSV 는 **요청 1회 30초에 102,078행의 라이선스를 준다.** 옳은 순서는:

```
① 목록·라이선스  DOAB CSV 1회 (30초)   → 언어 · 라이선스 · 주제 · DOI · OAPEN 핸들
② 중복 제거      §5-3 세 겹 키          → 14,118행 → 13,735 작품
③ 갈래짓기       OAPEN 핸들 유무
     ├ 있음 (7,121) → OAPEN /rest/ 로 .pdf.txt      ← 인문·사회 2,214 가 여기
     └ 없음 (6,614) → 호스트 어댑터(IntechOpen 97%) ← STEM 5,916
④ 판권면 대조    .pdf.txt 앞 3,000낱말 vs 메타데이터. 모순이면 드롭
⑤ 산문 런 추출   챕터 오프셋 아님(§3-2-③). 챕터 항목 1,552 는 이미 잘려 있음
```

**「DOAB 는 핸들 있는 것을 버린다」가 맞는 대상은 딱 하나** — **OAPEN 쪽 REST 를 따로
페이징해 목록을 다시 만드는 일**이다. 그건 하지 않는다(출판사당 43회 × N, 게다가 라이선스가 없다).
**DOAB 가 목록, OAPEN 이 창고다.**

⚠️ **DOAB 가 OAPEN 을 전부 덮지는 않는다.** CSV 의 OAPEN 핸들은 41,417 인데
[publisher-oa-books.md](./publisher-oa-books.md) 가 잰 OAPEN OAI 세트는 Books 49,817 +
Chapters 7,200 이다. 차이 약 1.5만은 **DOAB 미색인분**으로 보이나 **확인하지 못했다.**
그쪽까지 원하면 ①을 OAPEN OAI 로 바꾼다(§1 의 robots 우회로와 같은 선택).

---

## 판정 근거 — 왜 「보류」에서 「채택 (조건부)」로 올리는가

초판의 보류 사유는 **하나**였다: *"도달 가능한 6,634권의 93%가 STEM 편집서라 PLOS 와 겹친다."*
그 사유의 두 항이 모두 무너졌다 — 도달 가능은 6,634 가 아니라 **13,735** 이고,
STEM 비중은 93% 가 아니라 **53%**(7,302/13,735)이며, PLOS 와 안 겹치는 **순인문·사회가 2,543권**이다.

초판이 스스로 적은 **「보류 해제 조건 2번 — OAPEN 을 통과하면 +7,445권, 그리고 여기에 Open Book
Publishers·UCL Press 등 인문 학술서가 몰려 있다」가 그대로 충족됐다.** 헤드리스 브라우저도
필요 없었다 — 그 대책이 애초에 불필요했다.

| SPEC 반려 사유 | 해당? |
|---|---|
| 전문이 안 온다 | ❌ 온다. 그것도 추출 완료 평문으로 17/17 |
| 변형 금지 라이선스 | ❌ 항목별. CC BY 13,080권을 골라낼 수 있다 |
| 대량 접근 경로 없음 | ❌ 요청 1회 30초 덤프 + 열린 REST |
| (보류) 편수 100 미만 | ❌ 13,735 |
| (보류) 지문 적합성 낮음 | ❌ 산문 밀도 61~79% · 5권 중 3 `use` |

### 「조건부」인 이유 — 조건 넷. 넷 다 우리 쪽 일이다

1. **라이선스 이중 확인 게이트가 코드에 있을 것.** 메타데이터 + 판권면. 실측 모순율
   **표본 5중 1**이고 다른 두 정찰도 각각 잡았다. 이 게이트 없이 적재하면
   *Laughter in the Void* 처럼 **명시적으로 금지된 책이 CC BY 통에 들어간다.**
2. **`lib-topic.mjs` 를 먼저 고칠 것.** [SUMMARY.md](./SUMMARY.md) §5 — 분류기가 STEM 을
   「예술·문화」로 보낸다. **인문·사회 2,543권은 정확히 그 칸을 겨냥한 물량**이라
   고장난 자로 재면 칸을 오염시킨다.
3. **SA 결정(SUMMARY §7-1) 전까지 CC BY-SA 651권은 별도 버킷.**
4. **robots 결정(SUMMARY §7-4) 을 넘지 않을 것.** DOAB 는 `ai-train=no` + ClaudeBot 차단이다.
   §1 의 「OAPEN OAI 로 목록을 만드는 우회로」가 있으므로 **결정이 어느 쪽이든 파이프라인은 선다.**

**착수 우선순위**: [SUMMARY.md](./SUMMARY.md) §8 의 1·2번(분류기 · 중복키) 뒤. PMC·Frontiers 보다
편수는 작지만 **「단행본 인문·사회 산문」은 다른 소스가 주지 않는 결**이고, 산문 밀도 61~79% 는
지금까지 잰 어느 소스보다 높은 축이다.

---

## 수확기를 짠다면

### 본뜰 것

`scripts/csat/harvest-plos.mjs`(API 형). **2단이 아니라 3단**이다 — 초판 설계와 달라진다.

```
scripts/csat/harvest-doab.mjs     # ① CSV 1회 → 필터 → 후보 목록(라이선스 포함)
scripts/csat/doab-fulltext.mjs    # ② OAPEN /rest/ 로 .pdf.txt / 호스트 어댑터로 PDF
scripts/csat/lib-doab.mjs         # 라이선스 정규화 + 판권면 대조 + 산문 런 추출
```

### ① 목록 (`harvest-doab.mjs`) — 요청 **1회**

1. `GET https://directory.doabooks.org/download-export?format=csv` (280 MB, 30초).
   `scripts/csat/data/doab-harvest-cursor.json` 에 덤프의 `date` 헤더 · 바이트 수 · 행수를 적어
   같은 판인지 확인한다. (⚠️ robots 결정이 「DOAB 를 안 건드린다」로 나면 이 단계를
   `library.oapen.org/oai/request` `ListRecords`(set `com_20.500.12657_5`, 약 500회)로 갈아끼운다.)
2. **스트리밍 CSV 상태기계**로 읽는다 — 따옴표 안 개행이 있어 `split(',')` 은 깨진다. 138 컬럼.
3. 필터 순서(이 순서라야 §6 표가 재현된다):
   `dc.language` 에 eng → 라이선스 정규화(`dc.rights.licenseurl` ‖ `dc.rights.uri` ‖ **`BITSTREAM License`**)
   → `by`/`by-sa`/`zero`/`mark` 만 → §5-3 세 겹 키로 중복 제거 → OAPEN 핸들 유무로 갈래.
4. 정규화 못 한 라이선스 값은 **버리지 말고 `unknown` 으로 남긴다**(실측 31건 — 조용히 떨어뜨리면 구멍이 남는다).
   실측 오표기: `by-by-nc-nd` · `nc-sa` · `by-nd-nc` · `by-nc/4.0/)/` · `/legalcode` 접미 ·
   `http`/`https` 혼용 · `4.0` vs `4.0/`.
5. **재실행 안전** — 처리 완료 키를 건너뛴다. 덤프는 매번 통째로 받되 **차집합만 ②로 넘긴다.**

### ② 전문 (`doab-fulltext.mjs`)

| 어댑터 | 대상 | 상태 |
|---|---|---|
| **`oapen-rest`** | OAPEN 핸들 있는 **7,121권** | ✅ **실측 17/17 200 · `.pdf.txt` 17/17** |
| `direct-pdf` | `mts.intechopen.com` · `intech-files.s3` · `edizionicafoscari` 등 **6,614권** | ✅ 초판 실측 30/30 206 |
| `frontiers` | `frontiersin.org` 랜딩 → PDF (2,948권, 위 수에 미포함) | 미구현. 차단은 없음 |
| `mdpi` | `mdpi.com` | ❌ Cloudflare 403. **우회하지 않는다** |

`oapen-rest` 절차:
```
GET /rest/handle/20.500.12657/<n>?expand=bitstreams
  → bitstreams 에서 이름이 /\.pdf\.txt$/ 인 것 선택
  → 크기 < 2 KB 이면 스킵 (추출 실패 PDF. 19바이트 파일도 200 으로 온다 — 실측 사례 존재)
GET /rest/bitstreams/<uuid>/retrieve
```
⚠️ **비트스트림 UUID 를 키로 저장하지 말 것** — 재업로드 시 바뀐다. 매번 다시 조회한다.
⚠️ **Range 요청이 무시된다** — 부분 취득 불가, 통짜로 받는다(0.3~0.8 MB).

각 평문마다:
1. **판권면 대조**(§4-3) — 앞 3,000낱말에서 라이선스 문구를 뽑아 메타데이터와 비교.
   모순이면 드롭, **문구가 아예 없으면 보류 통**(부재 자체가 신호였다). 드롭 사유를 로그에 남긴다.
2. **OCR 판 배제**(§3-2-⑤) — 워터마크 반복 문자열 + 사전 밖 토큰 비율.
3. **줄 단위 산문 판정 → 연속 런 결합** — 45자 미만 · 점선 목차 · 숫자비 >15% ·
   대문자비 >25% · `Smith, J.` 형 · `Fig.`/`Table`/URL 시작 · 알파벳비 <72% 를 끊는다.
   하이픈 분철(`-\n[a-z]`)을 되붙인다.
4. **250낱말 이상 런에서만** 300낱말 창을 뜬다. **챕터 표제 기준으로 자르지 않는다**(§3-2-③).
   챕터 항목(`dc.type=chapter`, 1,552권)은 파일 자체가 한 챕터이므로 이 단계가 필요 없다.
5. 각주 번호 제거(`([a-z’'”)])\d{1,3}([.,]?)` 어미형) · 러닝 헤더 제거.
6. 출력에 **DOAB 핸들 · OAPEN 핸들 · DOI · 라이선스 · 저작자 · 출판사**를 실어 CC BY 귀속
   표시를 만든다. **SA 는 `license_class=cc_by_sa` 로 별도 버킷**(SUMMARY §7-1 대기).

### 몇 번에 나눠 돌릴지

- ①은 **1회 30초.** 나눌 필요 없다.
- ②는 **13,735 작품 × 2회**(handle + retrieve). 평문 총량 약 **8 GB**(초판 계획 60 GB 의 1/7).
  - OAPEN robots 의 **`Crawl-delay: 10`** 을 곧이곧대로 지키면 14,242요청 = **40시간**.
  - 초당 1요청이면 4시간이나 **그 값을 우리 편의로 해석하지 않는다.**
    → **하루 1,000권 상한 · 요청 간 2초 · 429/503 지수 백오프**로 **7~8일 분할**을 기준으로 잡는다.
    (재판정 중 17요청 연속에 429 는 없었다. 없다고 밀어붙일 근거는 아니다.)
- 커서: `scripts/csat/data/doab-fulltext-cursor.json` — 처리 완료 **작품 키**(§5-3 2차) 집합.
  PLOS 가 16분할한 것처럼 **어댑터별로 쪼개면 한 호스트가 막혀도 나머지가 돈다.**
- 철회 감지: `deletedRecord=transient` 라 OAI 로는 못 본다. **분기 1회 CSV 덤프 전량 대조**(30초).

### 먼저 할 것 (파일럿)

초판의 「인문·사회 400권 파일럿」을 **순인문·사회 2,214권 중 300권**으로 다시 잡는다 —
N(역사 383) · Q(철학·종교 203) · D(문학 251) · A(예술 217) 에서 균등 표집.
**게이트 통과율을 PLOS 와 비교**해 권당 창 수(§3-1 중앙값 12)와 `use` 비율(5중 3)이
표본 밖에서도 유지되는지 본다. 유지되면 나머지를 돌린다.

---

## 확인하지 못한 것 (추정하지 않는다)

- **분류 없음 2,772권의 실제 주제.** 제목으로는 인문·사회가 많아 보이나 **세지 않았다.**
  §6-1 의 ≈3,874 는 추정이고, 판정 근거로 쓴 것은 실측 2,543 뿐이다.
- **DOAB 미색인 OAPEN 약 1.5만권** — 존재는 두 세트 크기 차이로 추론되나 **확인 못 했다.**
- **`.pdf.txt` 가용률의 모집단 값.** 표본 17/17 이고
  [publisher-oa-books.md](./publisher-oa-books.md) 가 Springer 42권에서 41/42(97.6%)를 쟀다.
  **7,121권 전수로는 안 쟀다.**
- **판권면 모순의 모집단 비율.** 두 정찰에서 각각 1/4·1/5 가 나왔을 뿐 **분모가 9권이다.**
  게이트를 「있으면 좋은 것」이 아니라 **필수**로 두는 이유가 이 불확실성이다.
- **B(직접 PDF) 6,614권의 평문 품질** — 초판이 IntechOpen 4권으로 산문 밀도 29~38% 를 쟀고
  이번엔 **다시 재지 않았다.** 이번 재판정의 품질 수치는 전부 A 측(OAPEN 평문)이다.
- **OAPEN 의 실제 레이트리밋 한계.** 17요청에서 429 를 못 봤을 뿐 **한계선을 찾지 않았다.**
  초판이 웹 경로 4연속에서 받은 429 는 실재한다.

---

*재판정 2026-09-07 · DB write 0 · 코드 변경 0 · 네트워크: CSV 덤프 1회 + robots 2 +
REST 메타데이터 18 + 평문 표본 5권(0.3~0.8 MB) · 429 관측 0.*
