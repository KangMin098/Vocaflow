<!-- docs/reports/source-probe/wikipedia.md -->
# English Wikipedia (+ Simple English Wikipedia) 확보 정찰

| | |
|---|---|
| 판정 | **보류** — 경로는 넓게 열려 있으나, 목표 표가 지목한 **절(Overview·Criticism) 단위는 반려**다(품질 게이트와 교차하면 11편·7편). 도입부 단위 경로는 편수가 충분하나 **밴드가 고1이 아니고**(실측 FK 중앙 14.4) CC BY-SA 전염 정책이 이 저장소에서 이미 "빼는 쪽"으로 결정돼 있다 |
| 확보 가능 편수 | **51,790** (FA 7,000 + GA 44,790, ns0 검색 실측) · 그중 사회과학·철학·심리 주제 **4,016** · 그중 목표 절을 실제로 가진 것 **287** · Simple 은 **138** 이 전부(이미 99 확보 = 72%) |
| 라이선스 | `CC BY-SA 4.0` (사이트 전역 상수) · 변형 **가능**, 단 **파생물도 SA 로 전염** |
| 전문 | **온다** (`prop=extracts&explaintext=1`, 절 표제 포함 전문) |
| 안정 식별자 | **`pageid`** (제목 변경·넘겨주기에도 불변) — 제목 슬러그는 쓰면 안 된다 |
| 증분 커서 | `list=categorymembers&cmsort=timestamp` + `cmstart` + `cmcontinue`(= `타임스탬프\|pageid`) — **완전 순서**가 있다 |
| 정찰 일자 | 2026-09-07 |

---

## 0. 먼저 — 지금 확보량은 88·105 가 아니다

정찰 지시는 `wikipedia 88 · simple_wikipedia 105` 였다. **DB 직접 질의 결과는 92 · 99 다**
(2026-09-07). 차이는 작지만 다음 절의 산술이 전부 이 분모 위에 서므로 먼저 정정한다.

| source | ready | archived | published | queued | failed | 계 |
|---|---|---|---|---|---|---|
| `wikipedia` | 57 | 29 | 2 | 4 | 0 | **92** |
| `simple_wikipedia` | 30 | 43 | 25 | 0 | 1 | **99** |
| (참고) `wikivoyage` | 0 | 8 | 0 | 0 | 0 | 8 |

92행 **전부** `source_id` 가 `wikipedia:<pageid>` 꼴이다(제목 슬러그 0건).
라이선스는 세 소스 199행이 모두 `CC-BY-SA-4.0` 한 값이다.

---

## 1. 왜 92 에서 멈췄나 — 소스가 아니라 **호출부**다

두 위키가 멈춘 이유가 서로 다르다. 섞으면 둘 다 잘못 고친다.

### Simple English Wikipedia — **상류가 138편뿐이다. 거의 소진됐다**

`SIMPLE_WIKIPEDIA_FEEDS`(`packages/library-pipeline/src/ingest-article/simple-wikipedia.ts:18`)
는 카테고리 두 개만 본다. 오늘 실측:

```
incategory:Very_good_articles   27
incategory:Good_articles       111        →  상류 합계 138
```

확보 99 / 상류 138 = **72%**. 이것은 고장이 아니라 **벽**이다. 여기서 편수를 늘리려면
품질 카테고리를 버리고 다른 축으로 골라야 하며, 그 경로는 **이미 있다** —
`scripts/textbook/mediawiki-lead-ingest.mjs` 가 `list=allpages&apminsize=2000` 으로
전체 **284,862** 편에서 표집한다. 즉 Simple 쪽 "10% 미만" 이라는 인식 자체가 틀렸다.
품질 카테고리 경로는 사실상 다 썼고, 대량 경로는 다른 스크립트에 이미 배선돼 있다.

### English Wikipedia — **상류 51,790 중 0.18% 만 만졌다.** 원인 셋, 전부 코드에 있다

상류는 오늘 실측으로 FA **7,000** · GA **44,790** (`prop=categoryinfo`),
ns0 검색으로 둘의 합집합 **51,790**. 92/51,790 = **0.18%**. 소진과는 거리가 멀다.

**(a) 커서가 실행 사이에 남지 않는다.**
`scripts/acp/collect-daily.mjs:288` 이 매 실행마다 `let cursor = null` 로 시작한다.
게다가 `const PAGES = Number(arg('pages') ?? 1)` (55행) — 기본값이 **1페이지**다.
피드 URL 은 `gcmsort=timestamp&gcmdir=desc` 이므로(`wikipedia.ts:84`),
**매 실행이 같은 자리(가장 최근 승격분) 를 다시 읽는다.** 카테고리 안쪽으로는
`--pages` 를 준 그 실행 동안만 들어가고, 다음 실행이면 도로 맨 앞이다.
`listWikipediaFeedPage`(continuation 지원)는 만들어져 있는데 **`--pages` 없이는 안 불린다.**

> 2026-08-30 주석이 "첫 페이지만 보고 있었다" 를 고쳤다고 적고 있으나, 고쳐진 것은
> **함수**이지 **호출 예산과 커서 저장**이 아니다. 조용한 상한이 한 겹 남아 있다.

**(b) 모은 것을 처리 순서에서 뒤로 미뤘다.**
`scripts/acp/process-queue.mjs:135` — 「2026-08-30 실측에서 큐 892편 중 앞머리가 전부
wikipedia(**주제 적합률 5~11%**)였고, 정작 적합률 52~64% 인 usgs·noaa 812편이 뒤에
있었다」. 그래서 `--source` 필터가 생겼고 wikipedia 는 뒤로 갔다. 92편 중 `ready` 57 ·
`archived` 29 · `published` **2** 라는 분포가 그 결정의 자국이다.

**(c) 중복 검사가 구조적으로 못 맞는다 (미보고 결함).**
`apps/web/src/app/api/admin/articles/wikipedia-feed/route.ts:36-39` 은
`items.map(i => i.source_id)` 로 기존 행을 조회한다. 그런데
- 목록기(`shapeWikipediaPages`)는 `wikipedia:<Title_slug>` 를 만들고,
- 적재기(`ingestMediaWikiArticle`)는 `wikipedia:<pageid>` 를 만든다.

DB 92행이 전부 pageid 꼴이므로 **이 `.in(...)` 은 영원히 0건을 돌려준다.**
관리 화면의 `publishedSourceIds` 가 항상 비고, 이미 가진 글이 늘 "새 것" 으로 보인다.
`upsertArticleSeeds(supabase, 'wikipedia', …)` 로 쌓였어야 할 씨앗도
`library_article_seed_catalog` 에 wikipedia **0행**이다(nasa 46 · simple_wikipedia 34 ·
the_conversation 25 · voa 30 만 있다).

---

## 2. 대량 접근 경로 — 넷 다 열려 있다 (전부 호출해 봤다)

| 경로 | 상태 | 실측 |
|---|---|---|
| **action API · 카테고리 순회** | ✅ 상한 없음 | `cmcontinue` 로 무제한 전진 (아래 §5) |
| **action API · CirrusSearch** | ✅ 정밀, 단 **10,000 상한** | `sroffset=9990` 정상 · `sroffset=10000` → `cirrussearch-offset-too-large` |
| **PetScan** (심층 카테고리 교차) | ✅ 200 / 2.1초 | pageid·touched·wikidata Q 반환 |
| **XML 덤프** | ✅ 있음, 크다 | `enwiki-latest-pages-articles.xml.bz2` **25,680,955,982 B (23.9 GiB)** · 2026-09-03 |
| **REST core API** | ✅ | `api.wikimedia.org/core/v1/wikipedia/en/page/<title>/bare` → `id`·`latest.id`·`latest.timestamp`·`license` |

호출 예시 (실제로 쓴 것):

```bash
# 카테고리 순회 — 증분 커서까지 함께
curl "https://en.wikipedia.org/w/api.php?action=query&list=categorymembers\
&cmtitle=Category:Good%20articles&cmtype=page&cmnamespace=0\
&cmsort=timestamp&cmdir=desc&cmlimit=50&cmprop=ids|title|timestamp&format=json"

# 전문 (절 표제를 `== X ==` 로 살려서 받는다)
curl "https://en.wikipedia.org/w/api.php?action=query&format=json&pageids=3295060\
&prop=extracts|info&explaintext=1&exsectionformat=wiki"
```

### ⚠️ 여기서 나온 하드한 상한 하나 — **전문은 요청당 1편이다**

`exlimit=20` 으로 20편의 **전문**을 한 번에 요청했더니 API 가 경고를 붙여 돌려줬다:

```json
"warnings": {"extracts": {"*": "\"exlimit\" was too large for a whole article extracts request, lowered to 1."}}
```

20편 중 **1편만** `extract` 가 채워졌다(나머지 19편은 빈 값 + `excontinue`).
같은 20편을 `exintro=1` 로 부르면 **20/20 이 채워진다.**

→ **도입부는 요청당 20편, 전문은 요청당 1편.** 1,000편 전문 수확 = 최소 1,000 왕복이다.
(`wikipedia.ts` 의 `EXTRACT_CAP = 20` 주석은 `exintro` 목록 질의에 대해서만 맞다.
전문 적재기에 그 상수를 옮겨 쓰면 19/20 을 조용히 잃는다.)

---

## 3. 전문이 오는가 — **온다. 그리고 절 경계까지 온다**

`explaintext=1&exsectionformat=wiki` 는 평문 전문을 주면서 절 표제를 `== X ==` 로
남긴다. 그래서 절을 골라내는 데 별도 파싱이 필요 없다 — 실측:

```
Christian ethics (pageid 3295060, rev 1351493289) — 전체 10,700어
  top-level: Definition and sources | Historical background | Philosophical core
             | Applied ethics | Criticism | See also | References | External links
  >> Criticism 128어 · lead 315어
```

> ⚠️ 저장소는 `exsectionformat=plain` 을 쓴다(`_mediawiki.mjs` 주석이 그 이유를 길게
> 적어 뒀다 — `== Plot ==` 이 본문에 섞여 들어온 사고). **절을 잘라 쓰려면 그 결정을
> 뒤집어야 한다**: `plain` 은 `==` 를 지워 표제를 본문 줄과 구별할 수 없게 만든다.
> 두 목적이 정면으로 충돌하므로, 절 수확기는 `wiki` 로 받아 **표제를 잘라낸 뒤** 버려야지
> `plain` 으로 받아서는 안 된다. 같은 파일에서 두 규약을 섞지 말 것.

---

## 4. 목표 표가 지목한 **"Overview·Criticism 절"** — 여기가 무너진다

목표 표는 "사회과학·철학·심리 문서의 Overview·Criticism 절" 을 골라내라고 한다.
그 교집합을 실제로 세어 봤다. 주제 축은 CirrusSearch 의 `articletopic:` 키워드다
(ORES 주제 모델 — 사람 손 카테고리가 아니라 분류기라 커버리지가 넓다).

**주제 풀 (ns0, 실측):**

| 질의 | 편수 |
|---|---|
| `articletopic:philosophy-and-religion` | 180,952 |
| `articletopic:education` | 86,287 |
| `articletopic:society` | 69,680 |
| 5주제 합집합 (`philosophy-and-religion\|society\|education\|politics-and-government\|business-and-economics`) | **791,490** |
| 5주제 ∩ `Good articles` | 3,464 |
| 5주제 ∩ `Good\|Featured articles` | **4,016** |

**절 이름 × 주제 (품질 게이트 없음 / 있음) — 정규식 `insource:/\n== X ==\n/`:**

| 절 | 주제만 | 주제 ∩ GA\|FA |
|---|---|---|
| `== Background ==` | 13,553 | 336 |
| `== Overview ==` | 3,576 | **7** |
| `== Reception ==` | 3,238 | 76 |
| `== Legacy ==` | 3,153 | 139 |
| `== Criticism ==` | 1,678 | **11** |
| `== Impact ==` | 804 | 21 |
| `== Analysis ==` | 612 | 37 |
| `== Influence ==` | 354 | — |
| `== Interpretation ==` | 194 | — |
| `== Debate ==` | 52 | — |
| **8개 합집합** | **13,235** | **287** |

**이것이 이 정찰의 핵심 사실이다.** 품질 게이트(GA·FA)와 목표 절은 **거의 배타적**이다.
철학·종교 ∩ GA ∩ `== Criticism ==` 은 전 위키에 **5편**뿐이고, 그 다섯은
`Islam` · `Christian ethics` · `Sixto-Clementine Vulgate` · `Jerry Fodor` · `Logic translation` 이다.

원인은 위키 자신의 편집 규범이다 — MOS 는 독립된 "Criticism" 절과 "Overview" 절을
권장하지 않으므로, **심사를 통과한 글일수록 그 절이 없다.** 목표 표는 위키가
스스로 지우고 있는 구조를 지목한 셈이다.

따라서 실제로 가능한 조합은 둘 중 하나이고, 셋 다는 못 가진다:

| | 편수 | 잃는 것 |
|---|---|---|
| 주제 + 품질 게이트 (절 무시) | **4,016** | 「Overview·Criticism 절」 지정 |
| 주제 + 절 (품질 게이트 없음) | **13,235** | GA/FA 검수 — 저품질·토막글이 섞인다 |
| 주제 + 품질 + 절 | 287 | 목표 1,000 에 못 미친다 |

### 심리(psychology) 는 `articletopic:` 에 없다

`articletopic:psychology` → **0**. 대안 둘을 재 봤다:

- `deepcat:Psychology` → **117,967** — 하위 카테고리가 인터넷·기업까지 번져 쓸 수 없다
  (상위 결과가 YouTube · Internet · Facebook 이다).
- **WikiProject 평가 카테고리** — `Category:GA-Class psychology articles` **128** ·
  `B-Class` **1,115** · `C-Class` **4,327** · `GA-Class sociology` 145 · `B-Class sociology` 1,317.
  ⚠️ 이 카테고리들은 **Talk 문서(ns=1)** 에 붙는다. `srnamespace=1` 로 찾은 뒤
  `Talk:` 를 떼어 본문으로 옮겨야 한다. 그리고 표기가 흔들린다 —
  `Category:GA-Class philosophy articles` 는 검색으로는 196건이 잡히는데
  `prop=categoryinfo` 로는 **MISSING** 이다(대소문자 이형/넘겨주기). **목록을 손으로
  적어 두면 조용히 0건이 된다** — `categoryinfo` 로 존재를 먼저 확인할 것.

---

## 5. 안정 식별자 · 증분 커서

### 식별자 = `pageid` (제목 아님)

```
titles=Marxist|Marxism  →  redirects: [{"from":"Marxist","to":"Marxism"}]
                            1904053  Marxism        ← 둘 다 같은 pageid
```

제목은 이동(rename)으로 바뀌고 넘겨주기가 생긴다. `pageid` 는 문서가 삭제되지 않는 한
불변이다. DB 92행이 이미 pageid 꼴이니 **그 규약을 유지**하고, §1(c) 의 목록기 쪽을
pageid 로 고쳐 맞춰야 한다(반대 방향으로 고치면 92행이 전부 중복 적재된다).

### 증분 커서 = `cmsort=timestamp` + `cmstart` (+ 재판정용 `lastrevid`)

**두 층이 필요하다.**

1. **새로 승격된 글** — 카테고리 가입 시각으로 자른다. 완전 순서가 있어
   2026-08-16 IA 사고(정렬 없는 페이지네이션 → 214건 중복 + 동수 누락)가 재현되지 않는다.

   ```
   &cmsort=timestamp&cmdir=newer&cmstart=2026-08-01T00:00:00Z
   → continue.cmcontinue = "20260801024605|53668895"   (타임스탬프|pageid)
   ```

   실측으로 GA 카테고리는 하루 **약 8~10편** 늘어난다(2026-09-06 14:26 → 09-07 04:45 사이 5편).

2. **이미 가진 글이 바뀌었는가** — `prop=info` 의 `lastrevid` 를 행에 남긴다.
   위키는 `published_at` 이 없는(계속 편집되는) 소스라 날짜로는 못 센다.
   실측: `Christian ethics` rev **1351493289** · `Marxism` rev **1372275499**.
   REST `/bare` 도 같은 값을 `latest.id` 로 준다.

   ⚠️ 지금 DB 에는 이 값을 담을 자리가 없다. **없으면 재수확 때마다 전량을 다시 판정한다.**

### 검색 경로를 쓸 때의 주의

`sroffset` 상한이 **10,000** 이다(`cirrussearch-offset-too-large`). 8개 절 합집합
13,235 는 이 상한을 넘으므로 **한 질의로는 끝까지 못 걷는다** — 주제별·절 이름별로
쪼개 각 질의를 10,000 아래로 두어야 한다(위 표의 모든 칸이 10,000 미만이다).
그리고 `srsort=relevance` 는 순서가 흔들리므로 **`srsort=create_timestamp_asc`**
(문서 생성 시각, 불변)로 고정한다 — 실측으로 세 정렬이 각각 다른 앞머리를 준다.

---

## 6. 현실적 확보 가능 편수

| 대상 | 실측 | 근거 |
|---|---|---|
| en.wikipedia ns0 전체 | 7,236,399 | `meta=siteinfo&siprop=statistics` |
| FA + GA (품질 검수분) | **51,790** | `incategory:Good_articles\|Featured_articles` |
| ↳ 사회과학·철학 5주제 | **4,016** | 위 + `articletopic:` |
| ↳ + 목표 절 8종 | 287 | 위 + `insource:/\n== X ==\n/` |
| 품질 게이트 없이 5주제 ∩ 절 8종 | 13,235 | 〃 |
| Simple ns0 전체 | 284,862 | `siprop=statistics` |
| Simple 품질 카테고리 | **138** | Very good 27 + Good 111 |

**목표 표 7위(1,000편)** 는 「주제 + 품질」 조합(4,016)으로 도달 가능하다 —
단 **절 지정을 포기**해야 한다.
**목표 표 25위(500편, 고1용)** 는 아래 §7 때문에 이 소스로는 **도달 못 한다**.

수용률은 못 쟀다. 이 저장소에 있는 유일한 실측치는 `process-queue.mjs:135` 의
**주제 적합률 5~11%**(2026-08-30, 주제 필터 없는 wikipedia 큐 기준)뿐이다.
`articletopic:` 를 걸면 이 값이 오를 것이라고 **추정은 하지만 재지 않았다** —
정찰 규격이 표본을 3~5편으로 묶어 두었기 때문이다. 재려면 표본 100편 채점이 필요하다.

---

## 7. 지문 적합성 표본 판정 — **절이 아니라 문단이 단위다**

절 5편을 실제로 받아 읽고, 저장소 자(`readability` · `standaloneFit`)로 재고,
`gate-article-drain/JUDGING.md` 어휘로 판정했다.

| # | 문서 · 절 | 어수 | FK | 300어 발췌 FK | `standaloneFit` | verdict / genre |
|---|---|---|---|---|---|---|
| 1 | Christian ethics §Criticism | 128 | 9.53 | 9.53 | PASS | **reject** / `fragmentary` |
| 2 | Jerry Fodor §Criticism | 686 | 13.37 | 12.47 | **FAIL** | **reject** / `fragmentary` |
| 3 | Marxism §Overview | 2,591 | 15.40 | 17.14 | **FAIL** | **use** / `social` (밴드 밖) |
| 4 | Great Depression §Overview | 454 | 11.34 | 10.07 | PASS | **narrative** / `history` |
| 5 | Psychological egoism §Criticism | 677 | 11.71 | 12.04 | PASS | **use** / `psychology` |
| (참) | Simple: Evolution 도입부 | 349 | 7.60 | 7.85 | PASS | **use** / `science` |

**왜 그렇게 판정했나:**

1. **Christian ethics §Criticism** — 128어에 Preston·Leys·Kant·Nietzsche 네 이름이
   눌려 들어가고, "the first of those four objections" 가 이 절 안에서 정의되지 않은
   목록을 가리킨다. 한 편의 글로 논지가 서지 않는다.
   ⚠️ `standaloneFit` 은 **PASS** 를 줬다 — 기계 자가 못 잡는 자리다. 절 단위 수확을
   한다면 이 게이트만 믿으면 안 된다.
2. **Jerry Fodor §Criticism** — 본문 안에 `=== Simon Blackburn ===` 등 3층 표제 셋이
   그대로 남고, LOT(language of thought)이 정의되지 않은 채 반론만 나열된다.
   **그런데** Dennett 문단 하나(≈190어, 체스 두는 컴퓨터에 지향적 태도를 귀속시키는
   이야기)는 그 자체로 `use`/`psychology` 다.
3. **Marxism §Overview** — 글로서는 `use` 다. 그러나 2,591어이고 300어로 자르면
   FK 가 **17.14 로 올라간다**(앞이 더 어렵다). 인용문이 앞 문장을 받아서
   `standaloneFit` 도 FAIL. 이 절은 밴드가 아니라 **책 한 장**이다.
4. **Great Depression §Overview** — 첫 줄부터 `=== The economic picture… ===` 표제이고
   Dow 381→198→294→41 수치가 이어진다. 시간순 경제사 — `narrative`.
   300어 발췌 FK **10.07** 로 다섯 중 밴드에 가장 가깝다.
5. **Psychological egoism §Criticism** — 목표 표가 원한 모양이 실제로 나온 유일한 표본이다.
   순환논증 반박 문단(≈180어)이 「주장 → 반례 → 왜 순환인가」로 닫힌다.
   다만 이 문서는 **GA 가 아니다**(§4 의 게이트 없는 13,235 쪽에서 나왔다).
   그리고 절 전체를 쓰면 Feinberg 의 **대화체 문답 블록**이 섞여 지문이 깨진다.

**공통 결론 — 3/5 에서 같은 모양이 나왔다: 쓸 만한 것은 절 안의 한 문단(150~200어)이고,
절 전체가 아니다.** 이것은 이 저장소가 Simple Wikipedia 에서 이미 배운 교훈
(「놓치고 있던 건 사이트가 아니라 **단위**였다」 — `grade-level-source-list-20260902.md:83`)의
반복이다. 절은 하위 표제·대화체·수치표를 품고 있어 그대로는 지문이 아니다.

### 밴드 — **고1 이 아니다** (표본 20편 실측)

목표 표 25위가 「고1용 500편」을 요구하므로, 목표 풀(5주제 ∩ GA|FA)에서
`srsort=create_timestamp_asc` 로 20편을 뽑아 **도입부**를 재 봤다
(Logic · Metaphysics · Truth · Epistemology · Political philosophy · US 수정헌법 8편 ·
Ronald Reagan · Al Gore · Whorf · Harding · Allah · Existence · Politics of Botswana).

- 300어 발췌 FK **중앙 ≈ 14.4** · 최소 8.43(Al Gore) · 최대 16.21(Political philosophy)
- FK ≤ 13 은 **20편 중 6편**(Truth 12.59 · 3rd 12.59 · 4th 12.55 · 14th 12.56 ·
  Harding 10.84 · Logic 10.57), FK < 10 은 **1편**
- 철학 쪽이 가장 어렵다 — Epistemology 15.11 · Political philosophy 16.21 · Metaphysics 14.32
- `standaloneFit` 은 **20/20 PASS** — 도입부는 정의문으로 시작해 구조적으로 자족적이다

저장소 자신의 등록부도 같은 말을 한다:
`csat_source_registry` 는 `wikipedia` 를 **'V6 expository'** 로 적어 뒀고
(`supabase/migrations/20260906200000_csat_source_console.sql:287`),
이 저장소에서 **V5 = 고1 · V6 = 고2** 다(`packages/library-pipeline/src/textbook/series.ts:19`).

→ **en.wikipedia 는 고1 위, Simple 은 고1 아래**(FK 7.85)다. 25위(고1 500편)를 이 소스로
채우려면 **각색**이 필요하고, 각색은 다음 절 때문에 막힌다.

---

## 8. CC BY-SA 가 교재 발행에 갖는 뜻 — **이미 이 저장소가 답을 정해 뒀다**

### 라이선스 사실 (실측)

```
en:     rightsinfo = {"url":".../licenses/by-sa/4.0/deed.en", "text":"Creative Commons Attribution-Share Alike 4.0"}
simple: rightsinfo = {"url":".../licenses/by-sa/4.0/deed.simple", ... 같음}
REST /bare 도 문서마다 같은 license 객체를 준다.
```

**항목별 라이선스 필드는 없다** — 사이트 전역 상수다. PLOS·Crossref 처럼 글마다 다를
가능성이 없으므로 항목별 확인이 필요 없다. 뒤집어 말하면 **예외로 빠져나갈 길도 없다.**

### SA 가 뜻하는 것

| | |
|---|---|
| 변형 | **가능** (ND 가 아니다) |
| 상업 이용 | **가능** (NC 가 아니다) |
| 조건 | 출처 표시 + 링크 + **변경 사실 명시** + **파생물을 CC BY-SA 4.0 으로 공개** |
| DRM | **금지** — SA 는 "effective technological measures" 부가를 막는다. DRM 걸린 전자교재에 못 넣는다 |

핵심은 **무엇이 파생물이냐**다. 원문을 그대로 실은 지문을 우리 문항과 나란히 두는 것은
「collection(수집물)」에 가까워 SA 가 책 전체로 번지지 않는다. 그러나 이 파이프라인이
지문에 실제로 하는 일은 —

- 300어대로 **자르고** (`trimToWindow`)
- 빈칸을 **뚫고** · 문장 순서를 **섞고** (`R-BLANK` 등 문항 유형)
- 레벨에 맞게 **다시 쓰는**(`adapt-drain`) 것

— 전부 **각색(adaptation)** 이다. 그러면 그 지문은 CC BY-SA 4.0 으로 나가야 한다.

### 이 저장소는 이미 "빼는 쪽" 으로 결정했다

`scripts/textbook/adapt-drain-export.mjs:74-79`:

```js
/**
 * `cc_by_sa` 는 뺀다 — 파생물도 같은 조건으로 공유해야 하는데 우리 서가의 이용 약관이
 * 그것을 감당하는지 확인되지 않았다. **모르는 채로 쓰는 것보다 빼는 편이 싸다.**
 */
const ADAPTABLE = ['cc_by', 'cc0', 'public_domain']
```

같은 판단이 `scripts/compose/drain-adapt.mjs:60` 에도 있다. 반면
`packages/library-pipeline/src/textbook/source-eligibility.ts:220` 의
`DERIVABLE_LICENSE` 와 마이그레이션 `20260608120000` 의 발행 게이트는
`cc_by_sa` 를 **허용**한다. **두 자가 서로 다르다.**

> 이 불일치가 지금은 아프지 않다 — wikipedia 발행이 2편뿐이기 때문이다.
> 1,000편을 넣으면 아프다. **정찰이 답할 일이 아니고 정책 결정이 필요한 자리다:**
> 「빈칸 뚫린 지문을 CC BY-SA 4.0 으로 공개할 수 있는가」에 예/아니오가 나와야 한다.
> 한국 저작권법 §28(공표 저작물의 인용)로 우회 가능한지도 같은 결정에 속하며,
> 이것은 법률 판단이므로 여기서 답하지 않는다.

### 지금 지켜지고 있는 것 / 빠진 것

- ✅ 변경 명시 — `mediawiki-lead-ingest.mjs:334` 가 제목에 `(도입부 발췌)` 를 붙인다.
- ✅ 출처 링크 — `source_url` 에 `https://…/wiki/<Title>` 이 들어간다(문서 이력 = 저자 목록).
- ❌ **파생물 라이선스 표기** — 발행된 지문 화면에 "이 지문은 CC BY-SA 4.0 으로 제공된다"
  가 없다. `library/scripts/[bookId]/page.tsx:66` 은 원문 라이선스를 **표시**만 한다.
- ❌ `lastrevid` 미저장 — 어느 판본을 각색했는지 남지 않아 귀속이 특정 판을 못 가리킨다.

---

## 수확기를 짠다면

**본뜰 것**: 목록·커서는 `scripts/acp/collect-daily.mjs` 의 `runPage` 구조,
추출·창 맞추기·재실행 안전은 `scripts/textbook/mediawiki-lead-ingest.mjs` 를 그대로.
`_mediawiki.mjs` 를 **다시 쓰지 말 것** — 프로브와 적재기가 한 벌을 쓰는 이유가 거기 적혀 있다.

**단, 두 가지는 그대로 쓰면 안 된다:**

1. `exsectionformat` 은 **`wiki`** 로 받는다(절 경계가 필요하다). `plain` 으로 받으면
   표제가 본문 줄과 구별되지 않는다. 받은 뒤 표제 줄을 **버린다** — 남기면
   `== Plot ==` 사고가 재현된다.
2. **전문은 요청당 1편**이다(§2). `exlimit=20` 을 목록기에서 베껴 오면 19/20 을 잃는다.

**단위**: 절이 아니라 **문단**이다(§7). 절을 받아 문단으로 쪼개고,
150~200어에 드는 문단만 후보로 삼는다. 하위 표제(`=== X ===`) · 대화체 블록 ·
수치 나열 문단은 버린다 — 표본 5편 중 3편이 그것 때문에 떨어졌다.

**커서 파일**: `scripts/textbook/data/wikipedia-cursor.json`
(`scripts/csat/data/plos-harvest-cursor.json` 과 같은 자리·같은 꼴).

```json
{
  "featured": { "cmcontinue": "20260906142611|83665829", "lastSeenTs": "2026-09-06T14:26:11Z" },
  "good":     { "cmcontinue": null, "lastSeenTs": "2026-09-07T04:45:10Z" }
}
```

⚠️ **커서를 파일에 남기는 것이 이 수확기의 존재 이유다.** 지금 코드가 92편에서 멈춘
직접 원인이 "실행마다 `cursor = null`" 이다(§1(a)). 저장하지 않으면 같은 벽을 다시 친다.

**나눠 도는 법** (목표 1,000편 기준):

| 회차 | 하는 일 | 왕복 | 비고 |
|---|---|---|---|
| 0 | `to_regclass` 로 `lastrevid` 컬럼 자리 확인 → 없으면 마이그레이션 **먼저** | — | 없으면 재수확 때 전량 재판정 |
| 1 | 후보 목록만 (`articletopic` × `incategory` × `srsort=create_timestamp_asc`) | ~40 | 4,016편 → pageid 목록. 질의당 10,000 미만 유지 |
| 2 | 이미 가진 92 pageid 제외 → 전문 수확 300편 | 300 | 동시 3 · 간격 120ms(429 회피, `_mediawiki.mjs` 실측) |
| 3~4 | 나머지 700편 | 700 | 회차 사이에 큐 처리 상태 확인 |
| 매일 | `cmstart` = 지난 커서 → 신규 승격분만 | ~5 | 실측 하루 8~10편 |

**먼저 고쳐야 실익이 나는 것 (수확기보다 앞)**

1. `wikipedia-feed/route.ts` 의 `source_id` 를 **pageid** 로 통일 — 지금은 중복 검사가
   구조적으로 0건이라 목록이 늘 "전부 새 것" 으로 보인다(§1(c)).
2. `collect-daily.mjs` 의 커서 영속화 + `--pages` 기본값 재검토(§1(a)).
3. **CC BY-SA 발행 정책 결정**(§8). 이것이 "아니오" 면 1,000편을 모아도 발행 못 하므로
   **수확 전에** 답이 나와야 한다. `ADAPTABLE` 과 `DERIVABLE_LICENSE` 중 하나는 틀렸다.

**목표 표를 고쳐야 할 것**: 7위의 「Overview·Criticism 절」 지정은 실측으로 성립하지
않는다(§4). 「사회과학·철학 주제의 **GA/FA 도입부 + 본문 문단**」으로 바꾸면 4,016편에서
1,000편이 나온다. 25위(고1 500편)는 **다른 소스를 찾는 편이 낫다** — 이 소스의 밴드는
V6(고2) 이고(등록부·FK 실측 일치), 고1로 내리려면 각색이 필요한데 SA 가 그것을 막는다.
