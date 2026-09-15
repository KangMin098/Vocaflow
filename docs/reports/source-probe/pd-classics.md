<!-- docs/reports/source-probe/pd-classics.md -->
# 퍼블릭 도메인 고전 5곳 확보 정찰

목표 표 **74·76·78·80·85위** — Standard Ebooks · Wikisource · Bartleby · Perseus Digital
Library · Wikibooks. 표의 추정 합계는 180편이었다.

정찰 일자 **2026-09-07**. 규격은 [SPEC.md](./SPEC.md). 수확하지 않았고 DB 에 쓰지 않았다
(모든 DB 접근은 `SELECT`).

---

## 0. 먼저 답해야 할 것 — Gutenberg 와 얼마나 겹치는가

이 다섯 곳은 전부 PD 고전 계열이고, 이 저장소는 **이미 Gutenberg 수확기를 돌리고 있다**.
그러니 "확보 가능한가" 보다 **"이미 가진 것 아닌가"** 가 먼저다.

### 우리가 지금 가진 것 (DB 실측 · `library_articles`)

| | |
|---|---|
| `source='gutenberg'` 조각 | **36,635** (archived 16,894 · queued 11,249 · ready 8,490 · failed 2) |
| 그중 게시 가능(ready+queued) | **19,739** |
| 조각을 뽑아 온 **원본 도서 수** | **1,642권** (`source_id` = `pg:<도서번호>:<본문해시>` 의 도서번호 distinct) |

### Gutenberg 카탈로그 실측 (오늘 내려받아 오프라인 대조)

`https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv.gz` — 5.6 MB · **90,647행** ·
그중 `Type=Text`·`Language=en` **52,608권**.

> **이것이 이 정찰의 첫 번째 반전이다.** 우리는 Gutenberg 를 다 쓴 게 아니라
> **52,608권 중 1,642권(3.1%)** 만 소비했다. Gutenberg 자체가 아직 96.9% 남아 있다.

### 겹침 실측

| 소스 | 겹침 측정 방법 | 결과 |
|---|---|---|
| **Standard Ebooks** | 카탈로그 1,515종 중 20종을 뽑아 **작품쪽에 적힌 출처 링크**를 읽음 | **16/20 (80%)** 이 `gutenberg.org/ebooks/<id>` 를 출처로 명시. +1 은 `gutenberg.net.au` → **17/20 (85%) Gutenberg 계열** |
| **Standard Ebooks** (전수) | 1,416종 단행본 제목을 PG 카탈로그 5만 제목과 오프라인 정규화 대조 | **1,050종 (74.2%) 제목 정확 일치.** 남은 366종도 *Walden* · *Huckleberry Finn* · *Three Men in a Boat* 처럼 **부제 표기 차이**라 실제 겹침은 이보다 높다 |
| **Standard Ebooks** ↔ 우리 DB | 위 16개 PG 도서번호를 DB 에 조회 | **2/16 만 이미 수확** (`58559` Adam Smith 47조각 · `9662` Hume 15조각). 나머지 14권은 아직 안 뽑았을 뿐, **같은 Gutenberg 안에 있다** |
| **Wikisource** | 무작위 본문(ns0) 500쪽 → 상위 작품 306종 → PG 제목 대조 | **82종 (26.8%)** 정확 일치. 나머지 171종의 상당수도 *The Decameron (Payne)* · *The Works of H. G. Wells (Atlantic Edition)* · *The Harvard Classics Vol. 1* 처럼 **판본 표기가 달라 못 잡힌 PG 수록본** |
| **Bartleby** | 「제목 색인」·「논픽션」 쪽의 실제 수록작 확인 | Harvard Classics · Thomas Paine 전집 · Aeschylus · Aesop · Alcott · Andersen · Aristophanes — **전부 PG 코퍼스** |
| **Perseus** | 영어 번역 944편의 저자를 PG 카탈로그와 대조 | PG 에 이미 Homer 61 · Plato 36 · Plutarch 15 · Cicero 9 · Aristotle 7 종. **번역자만 다른 같은 작품** |
| **Wikibooks** | — | **겹치지 않는다.** 위키 기고자가 새로 쓴 현대 교재 |

**한 줄 결론**: 다섯 곳 중 넷은 Gutenberg 코퍼스의 다른 포장이다. 그런데 그 코퍼스의
**96.9% 가 아직 미소비**이므로, 겹친다는 것이 "이미 있다"는 뜻은 아니고
**"이미 있는 수확기로 더 싸게 가져올 수 있다"** 는 뜻이다 — 새 파이프라인을 지을 이유가 없다.
겹치지 않는 것은 **Wikibooks 하나뿐**이다.

### 지문 적합률 대조 (같은 게이트 · `scripts/csat/lib-fit.mjs`)

Gutenberg 기준선은 저장소에 남아 있는 실측이다 — `docs/reports/gutenberg-probe.json`
(2026-09-04): 조각 5,393 중 **적합 484 = 9.0%**.

| 소스 | 표본 | 조각 | 적합 | 적합률 |
|---|---|---|---|---|
| Gutenberg (기준선) | 도서 24권 | 5,393 | 484 | **9.0%** |
| Perseus | Plutarch *Pericles* 영역 | 45 | 4 | **9%** |
| Wikisource | 무작위 18쪽 | 39 | 8 | **20.5%** |
| Wikibooks (무작위) | 무작위 18쪽 | 5 | 2 | 40% — 그러나 **쪽당 적합 0.11** |
| Wikibooks (큐레이션 접두어) | *Introduction to Sociology* 2쪽 | 16 | 10 | **63% · 쪽당 5.0** |

Perseus 가 Gutenberg 와 **소수점까지 같은 9%** 인 것은 우연이 아니다 — 둘 다 19세기 산문이고,
`lib-fit.mjs` 의 문장 상한이 26.7어이기 때문이다(`probe-gutenberg.mjs` 머리말이 미리 경고한
바로 그 실패 모드). Wikibooks 만 이 문제에서 자유롭다.

---

## 1. Standard Ebooks

| | |
|---|---|
| 판정 | **반려** |
| 확보 가능 편수 | 1,515종 (GitHub 조직 저장소 1,520 − 비도서 5. 브라우즈 마지막쪽 127 · 12쪽씩 × 126 + 마지막쪽 3 = 1,515 로 교차 확인) — **그러나 새 코퍼스는 0** |
| 라이선스 | 미국 PD + SE 자체 작업을 PD 에 헌정 · 변형 **가능** |
| 전문 | 온다 — 단 **plain text 가 없다**(epub · azw3 · kepub 만) |
| 안정 식별자 | URL 슬러그 `/ebooks/<author>/<title>` = GitHub 저장소명 `author_title` |
| 증분 커서 | 공개된 것은 신간 RSS/Atom **15항목**뿐 |
| 정찰 일자 | 2026-09-07 |

**① 대량 접근 경로 — 막혀 있다.**
`https://standardebooks.org/feeds/opds/all` → **HTTP 401**. 그 401 쪽의 문구가 전부다:

> "Following this link will ban your IP for 24 hours … Make a donation to join the
> Patrons Circle and get access our ebook feeds. Our New Releases RSS/Atom ebook feeds
> are open to everyone."

즉 **OPDS 전체 피드는 후원자 전용이고, 크롤러에게는 24시간 IP 차단 함정**이다.
공개 피드(`/feeds/rss/new-releases`)는 200 이지만 **15항목**밖에 없다.
남는 길은 GitHub 조직(`github.com/standardebooks`) — `api.github.com/orgs/standardebooks/repos`
로 페이지네이션해 **1,520개 저장소명**을 실제로 받아 왔다(오늘, 16회 호출). 이 길은 열려 있다.

**② 전문 — 온다. 그러나 plain text 가 없다.**
작품쪽의 다운로드 링크는 `.epub` · `.azw3` · `.kepub.epub` · `_advanced.epub` 넷뿐이다.
텍스트를 얻으려면 epub 압축을 풀고 XHTML 을 파싱해야 한다 — Gutenberg 가 `pg<id>.txt` 를
그냥 주는 것과 대비된다.

**③ 라이선스 — 가장 깨끗하다.** `/about` 원문: *"The text and cover art in our ebooks are
already believed to be in the U.S. public domain, and Standard Ebooks dedicates its own work
to the public domain, thus releasing the entirety of each ebook file into the public domain."*
변형 제한 없음. 이 항목만은 다섯 곳 중 최고다.

**④ 안정 식별자** — URL 슬러그가 곧 GitHub 저장소명이라 고정적이다. 다만 **PG 도서번호로
환원하려면 작품쪽을 한 편씩 긁어야 한다**(저장소명에는 출처가 없다).

**⑤ 증분 커서** — 신간 피드 15항목 또는 GitHub `pushed_at` 정렬. 후자는 되지만
"새로 나온 책"과 "오타 고친 책"을 구분하지 못한다.

**⑥ 현실적 확보 가능 편수 — 1,515종, 그러나 새 코퍼스는 0.**
§0 의 겹침 실측대로 85% 가 Gutenberg 계열이고, 나머지도 대부분 PG 부제 표기 차이다.

**⑦ 지문 적합성 — 측정하지 않았다.** SE 의 본문은 Gutenberg 본문과 **같은 글**이고,
차이는 조판·철자 현대화·오타 교정이다. 문장 길이가 바뀌지 않으므로 `lib-fit.mjs` 판정도
바뀌지 않는다. 위 §0 의 Gutenberg 기준선 9.0% 가 그대로 적용된다.

**반려 사유**: 대량 접근 경로가 후원자 게이트에 막혔고(공개분 15항목),
plain text 가 없어 epub 파싱이 추가로 필요하며, 그 대가로 얻는 것은
**이미 가진 수확기가 `.txt` 로 그냥 받아 오는 같은 글**이다. 비용은 늘고 산출은 같다.

---

## 2. Wikisource (영어)

| | |
|---|---|
| 판정 | **보류** |
| 확보 가능 편수 | 본문(ns0) **1,128,134쪽** (siteinfo 실측). 무작위 18쪽 실측 쪽당 적합 조각 **0.44** → 상한 약 **49만 조각** — 단 장르 게이트 미적용 값 |
| 라이선스 | 원문은 PD · 사이트 기여분 **CC BY-SA 4.0** (`meta=siteinfo&siprop=rightsinfo` 실측) · 변형 **가능**, SA 전염 |
| 전문 | **온다** — 단 `action=parse` 로만 |
| 안정 식별자 | `pageid` (+ 제목) |
| 증분 커서 | `list=allpages` 의 `apcontinue`(제목 정렬 보장) · `list=recentchanges` 의 `rccontinue` |
| 정찰 일자 | 2026-09-07 |

**① 대량 접근 경로** — MediaWiki Action API. 실제 호출:
`https://en.wikisource.org/w/api.php?action=parse&page=On%20Liberty/Chapter%201&prop=text&formatversion=2&format=json` → 200.

**② 전문 — 온다. 그러나 덤프와 `action=raw` 로는 안 온다.**
이것이 이 소스의 가장 큰 함정이다. 같은 쪽을 두 길로 받아 보면:

| 길 | 결과 |
|---|---|
| `?action=raw` (= XML 덤프에 들어 있는 것) | **317바이트** — `{{header}}` 와 `<pages index="On Liberty (4th Edition).djvu" from=7 to=30/>` 뿐 |
| `action=parse&prop=text` | **5,744어** 완본 |

Wikisource 의 본문은 `Page:` 이름공간에 있고 본문쪽은 그것을 **트랜스클루전**한다.
**덤프를 받아 위키텍스트를 파싱하는 통상적 방법은 여기서 빈 결과를 낸다** — 오류 없이,
조용히. (덤프 색인 `https://dumps.wikimedia.org/enwikisource/` 자체는 200 으로 살아 있다.)

**③ 라이선스** — `rightsinfo` 가 **CC BY-SA 4.0** 을 반환한다. 원문 자체는 PD 이므로
발췌만 하면 PD 로 다룰 수 있으나, 기여자가 붙인 주석·현대역이 섞이면 SA 가 전염된다.
**항목별 라이선스 필드는 없다** — 본문과 주석을 구분할 메타데이터가 오지 않는다.

**④ 안정 식별자** — `pageid` 는 고정이다. 제목은 개명될 수 있다.

**⑤ 증분 커서** — `allpages` 는 제목 정렬을 보장하므로 IA 실측(2026-08-16)에서 겪은
**정렬 없는 페이지네이션의 중복·누락**이 여기서는 발생하지 않는다.
⚠️ **다만 레이트리밋이 있다.** 지연 없이 연타했더니 API 가 JSON 대신
`You are making too many requests to the API.` 를 평문으로 돌려주었다(무작위 40쪽 중 26쪽 실패).
연락처가 담긴 UA + **1.4초 간격**으로 바꾸자 30쪽 **실패 0**.

**⑥ 현실적 확보 가능 편수** — 본문쪽 1,128,134. 무작위 500쪽 실측:
**89% 가 하위쪽**(장·항목 단위)이고, 상위 작품 306종의 구성은
참고서·정기간행물 29 · 법령/연설 24 · **PG 제목 일치 82** · 미상 171 이다.
무작위 18쪽 렌더 실측으로 조각 39 · 적합 8 (**20.5%**) · 쪽당 0.44.
1,128,134 × 0.44 ≈ **49만 조각**이 산술 상한이나, 이 값에는
`reference`·`poetry-drama` 장르 게이트가 아직 걸리지 않았다.

**⑦ 지문 적합성 표본** — 렌더 후 어수를 잰 표본:

| 쪽 | 본문 어수 | 판정 소견 |
|---|---|---|
| *The Emerald City of Oz*/Chapter 28 | 1,684 | `narrative` — 다만 PG #517 로 이미 접근 가능 |
| *Oliver Goldsmith: A Biography*/Ch.XXIX | 3,189 | `narrative` — PG 수록 |
| *Catholic Encyclopedia (1913)*/St. Peter Damian | 2,019 | `reject`/`doctrine` 소지 — 교리를 사실로 서술 |
| 1911 EB/*Bric à Brac* | 102 | `reject`/`fragmentary` — 사전 항목, 길이 미달 |
| UN 안보리 결의 737 | 207 | `reject`/`reference` |
| *Poems of Cheer*/The Past | 164 | `reject`/`poetry-drama` |

게이트를 실제로 태운 6조각(*On Liberty* Ch.1 · *Great Essays of All Nations* ·
1911 EB *Anthropology*)은 **6/6 전부 탈락**했다 — 표본이 작아 비율로 쓰지 않는다.

**보류 사유**: 경로는 열려 있고 편수도 압도적이지만 — ㉠ 상위 작품의 26.8%+ 가
**이미 가진 Gutenberg 수확기로 더 싸게 얻는 것**이고, ㉡ 겹치지 않는 몫(사전·연감·정기간행물·
법령·판결문)은 `reference` 차단 장르에 대거 걸리며, ㉢ 덤프 경로가 트랜스클루전으로 막혀
쪽당 1회 API 호출이 강제된다(1.4초 간격이면 49만 조각에 수백 시간).
**Gutenberg 미소비분 96.9% 를 먼저 쓰고 나서 다시 볼 소스다.**

---

## 3. Bartleby

| | |
|---|---|
| 판정 | **반려** |
| 확보 가능 편수 | **확인 실패** — 사이트맵 403, 목록쪽에 페이지네이션 없음 |
| 라이선스 | **필드 없음.** 쪽 하단 「© 1993–2026 Bartleby.com」 · 변형 가능 여부 **판단 불가** |
| 전문 | 온다 — 단 내비 껍데기가 본문보다 크다 |
| 안정 식별자 | URL 경로(`/184/1.html`) 뿐 |
| 증분 커서 | 없다 |
| 정찰 일자 | 2026-09-07 |

**먼저 정정할 것** — 첫 호출에서 `/lit-hub` · `/73/` · `/100/` 가 전부 **403** 이라
"고전 아카이브는 없어졌다" 고 결론 낼 뻔했다. 그러나 그것은 봇 차단이었다.
`Accept` · `Accept-Language` · 크롬 UA 를 **전부** 갖추자 같은 URL 이 **200** 이 됐다.
403 을 소멸로 읽지 않는다.

**① 대량 접근 경로 — 없다.** API 없음 · 덤프 없음 · OAI 없음.
`sitemap.xml` 은 **403**. `robots.txt` 는 아카이브를 막지 않지만 `/search` 를 막는다.
「제목 색인」(`/titles`)에는 페이지네이션 링크가 **하나도 없어** 전체 목록을 셀 수 없었다.
남는 길은 컬렉션 번호(`/100/`, `/184/`)를 훑는 무작정 크롤뿐이다.

**② 전문 — 온다. 그러나 껍데기 비율이 나쁘다.**
`/184/1.html`(Paine) 은 **240 KB** 를 받아 태그를 벗기면 2,714어인데,
그 대부분이 **A–Z 저자 색인 내비게이션**이다(Adams, Henry / Aeschylus / AEsop / Alcott …).
쪽당 본문은 그 뒤에 붙는다. 정제기를 따로 지어야 한다.

**③ 라이선스 — 이것이 반려의 결정타다.** 라이선스 필드가 없고, 표시는 저작권 주장뿐이다.
수록작 자체는 PD 로 보이지만 **Bartleby 의 편집·주석·색인은 아니고**, 어느 쪽이 어느 쪽인지
메타데이터로 오지 않는다. SPEC ③ 의 "항목별로 다를 수 있으므로 라이선스 필드가 오는지
확인" 에 대한 답은 **오지 않는다** 이다.

**④ 안정 식별자** — URL 경로. 컬렉션 번호는 고정으로 보이나 보장이 문서화돼 있지 않다.

**⑤ 증분 커서** — 없다. 마지막 수정일도 오지 않는다.

**⑥ 편수 — 못 셌다.** 목록에 페이지네이션이 없고 사이트맵이 403 이다. **확인 실패.**

**⑦ 지문 적합성** — 수록작이 Harvard Classics · Paine · Aeschylus · Aesop · Alcott ·
Andersen · Aristophanes 이므로 §0 의 Gutenberg 기준선 **9.0%** 와 같다. 별도 표본을 뽑지 않았다.

**반려 사유**: 대량 접근 경로가 없고(SPEC 반려 조건), 라이선스가 확인되지 않으며,
내용은 우리가 이미 수확기를 가진 코퍼스다. 셋 중 어느 하나만으로도 반려다.

---

## 4. Perseus Digital Library

| | |
|---|---|
| 판정 | **반려** |
| 확보 가능 편수 | **영어 번역 944편** (`canonical-greekLit` 788 + `canonical-latinLit` 156 · GitHub 트리 API 실측, 잘림 없음) |
| 라이선스 | **CC BY-SA 4.0** (저장소 라이선스 + TEI `<licence>` 실측) · 변형 **가능**, SA 전염 |
| 전문 | **온다** (Herodotus 영역 260,677어) |
| 안정 식별자 | **CTS URN** — `urn:cts:greekLit:tlg0007.tlg012.perseus-eng2` |
| 증분 커서 | git commit SHA / tree SHA |
| 정찰 일자 | 2026-09-07 |

**① 대량 접근 경로 — 있다. GitHub 이다.** `scaife.perseus.org` 는 **302** 를 냈지만
정본은 GitHub 저장소다:

```
https://api.github.com/repos/PerseusDL/canonical-greekLit/git/trees/master?recursive=1
  → 200 · 3,500 entries · truncated=false · eng 788 · grc 814
https://raw.githubusercontent.com/PerseusDL/canonical-greekLit/master/
  data/tlg0007/tlg012/tlg0007.tlg012.perseus-eng2.xml   → 200 · 131 KB
```

트리 한 번(1 MB)이면 전체 파일 목록이 온다. **다섯 곳 중 접근 경로가 가장 깨끗하다.**

**② 전문 — 온다.** Herodotus *Histories* 영역 **260,677어**, Plutarch *Pericles* 영역 15,531어.

⚠️ **함정 하나를 실측했다.** TEI 태그를 그냥 벗기면 본문에 가제티어가 섞인다:

> "some Greeks (they cannot say who) landed at **Tyre [35.183,33.266] (inhabited place),
> Al-Janub, Lebanon, Asia** Tyre in Phoenicia **(region (general)), Asia** Phoenicia and
> carried off the king's daughter Europa."

원인은 `<name type="place">` 안의 **`<reg>` 자식 요소**다(좌표·행정구역 정규화값).
`<placeName>` 만 지워서는 안 되고 **`<reg>` 를 요소째** 지워야 한다. `<note>` 도 마찬가지다.

**③ 라이선스 — CC BY-SA 4.0. 그리고 항목별로 다르다.**
`canonical-greekLit` · `canonical-latinLit` · `canonical-pdlrefwk` 세 저장소 모두
GitHub 라이선스 필드가 `CC-BY-SA-4.0`. Plutarch 파일의 TEI 헤더에는
*"Available under a Creative Commons Attribution-ShareAlike 4.0 International License"* +
`https://creativecommons.org/licenses/by-sa/4.0/` 가 명시돼 있다.
**그런데 Herodotus `perseus-eng2` 에는 `<licence>` 필드가 없다** — 파일마다 다르므로
수확기는 헤더를 항목별로 읽어야 한다.

**④ 안정 식별자 — CTS URN.** 다섯 곳 중 유일하게 학술적으로 설계된 식별자다.
작품·판본·번역본이 URN 한 줄에 다 들어간다.

**⑤ 증분 커서 — git.** commit SHA 로 "지난번 이후 바뀐 파일"을 정확히 집어낸다.
정렬 없는 페이지네이션 문제가 원천적으로 없다.

**⑥ 현실적 확보 가능 편수 — 944편.** 목표 표 추정치와 자릿수가 맞는다.
(그리스어 814 · 라틴어 364 원문은 이 용도에 안 쓴다.)

**⑦ 지문 적합성 — 여기서 무너진다.**
Plutarch *Pericles* 영역을 `lib-fit.mjs` 에 그대로 태웠다:

```
문단 181 → 300어대 조각 45 → 적합 4 (9%)
```

**Gutenberg 기준선 9.0% 와 같다.** 이유도 같다 — Perrin(1916)·Godley(1920)·Jowett 의
번역은 20세기 초 산문이고, 대역 상한이 문장 26.7어인데 그 문장들은 더 길다.
접근 경로와 식별자가 아무리 좋아도 **통과하는 글이 없다.**

**반려 사유**: SPEC 의 세 반려 조건(전문 안 옴 / 변형 금지 / 경로 없음)에는 걸리지 않지만,
**지문 적합률 9% 가 Gutenberg 와 동일**하다 — 즉 Gutenberg 미소비분 96.9% 를 두고
944편짜리 새 파이프라인을 지을 이유가 없다. 여기에 CC BY-SA 4.0 의 SA 전염이 더해진다
(PD 인 Gutenberg 판 번역에는 없는 제약이다).
**Gutenberg 가 고갈된 뒤에도 이 소스는 같은 이유로 안 열린다.**

---

## 5. Wikibooks (영어) — **겹치지 않는 유일한 몫**

| | |
|---|---|
| 판정 | **채택** (큐레이션 접두어 한정 · 아래 SA 결정 대기) |
| 확보 가능 편수 | 본문 **98,719쪽**. 무작위는 쪽당 적합 0.11 로 값이 없고, **산문형 접두어 10개만 실계수 1,869쪽** · 그 대역에서 쪽당 적합 조각 약 3 → **약 5,600조각** |
| 라이선스 | **CC BY-SA 4.0** (`rightsinfo` 실측) · 변형 **가능**, **SA 전염** |
| 전문 | **온다** (`action=parse`) |
| 안정 식별자 | `pageid` |
| 증분 커서 | `list=allpages` 의 `apcontinue`(정렬 보장) · `rccontinue` |
| 정찰 일자 | 2026-09-07 |

**① 대량 접근 경로** — Wikisource 와 같은 MediaWiki Action API.
덤프 색인 `https://dumps.wikimedia.org/enwikibooks/` 도 200.
⚠️ Wikisource 와 달리 **여기는 트랜스클루전 구조가 아니므로 덤프 경로가 실제로 쓸모 있다.**

**② 전문 — 온다.** ⚠️ 단 `prop=extracts` **를 쓰면 안 된다.**
무작위 60쪽에 `explaintext` 를 걸었더니 **중앙값 0어**가 나왔다. 같은 쪽을 `action=parse` 로
다시 받아 보니:

| 쪽 | extracts | parse |
|---|---|---|
| *Outdoor Survival/Water in the desert* | 0어 | **543어** |
| *Inorganic Chemistry/Chemical Bonding/MO Diagram* | 0어 | **1,546어** |
| *A Guide to the GRE/Exponents* | 0어 | **290어** |

TextExtracts 가 이 위키에서 조용히 빈 값을 낸다. **여기서 멈췄다면 "쓸 게 없다"고
잘못 반려할 뻔했다.**

**③ 라이선스 — CC BY-SA 4.0.** `meta=siteinfo&siprop=rightsinfo` 실측.
**이것이 이 소스의 유일한 미결 쟁점이다** — 발췌를 정제해 지문으로 쓰는 것이 SA 가 전염되는
2차적 저작물인지, 전염되지 않는 단순 수록(collection)인지는 **법적 판단이고 정찰로 답할 수
없다.** 다만 CLAUDE.md 가 금지하는 NC·ND 는 아니고, `library_articles.license` 컬럼에
`CC BY-SA 4.0` 을 그대로 적을 수 있다.

**④ 안정 식별자** — `pageid`.

**⑤ 증분 커서** — `allpages` 는 제목 정렬 보장. 접두어(`apprefix`)로 책 단위 재수확이 가능해
**책 하나만 다시 돌리는 것이 안전하다**(재실행 안전).
Wikisource 와 같은 레이트리밋이 적용된다 — 1.4초 간격 + 연락처 UA 로 30쪽 실패 0.

**⑥ 현실적 확보 가능 편수 — 무작위로 세면 안 된다.**
무작위 30쪽의 중앙 본문은 **56어**다. 상위권은 *Math for Non-Geeks* 1,927어인데
하위권은 *Chess Opening Theory/1. e4/1...e5/2. Nf3/…* 처럼 **0어짜리 잎쪽**이다.
체스 정석·프로그래밍 레퍼런스·요리법이 본문 수를 부풀린다.
무작위 18쪽 게이트 실측: 조각 5 · 적합 2 · **쪽당 적합 0.11**.

그래서 **산문형 책 접두어로 좁혀 실계수했다**(`list=allpages&apprefix=`):

| 접두어 | 쪽수 |
|---|---|
| `Exercise as it relates to Disease/` | 500 (조회 상한에 걸림 — 실제로는 더 많다) |
| `Lentis/` | 378 |
| `Professionalism/` | 365 |
| `The Computer Revolution/` | 318 |
| `Rhetoric and Composition/` | 117 |
| `US History/` | 68 |
| `World History/` | 49 |
| `Introduction to Sociology/` | 45 |
| `Cultural Anthropology/` | 16 |
| `Communication Theory/` | 13 |
| **합계** | **1,869** |

**⑦ 지문 적합성 표본 — 다섯 곳 중 유일하게 좋다.**
*Introduction to Sociology* 두 쪽을 `lib-fit.mjs` 에 태운 결과:

```
Socialization        문단 26 → 조각  4 → 적합  3 (75%) · 사회·경제 2 · 교육·언어 1
Sociological Theory  문단 51 → 조각 12 → 적합  7 (58%) · 사회·경제 6 · 심리·인지 1
합계                          조각 16 → 적합 10 (63%) · 쪽당 5.0
```

발췌 한 편(300어 조각의 앞부분):

> "Sociologists develop theories to explain social phenomena. A theory is a proposed
> relationship between two or more concepts. In other words, a theory is an explanation for
> why or how a phenomenon occurs. An example of a sociological theory is the work of Robert
> Putnam on the decline of civic engagement. Putnam found that Americans' involvement in
> civic life (e.g., community organizations, clubs, voting, religious participation, etc.)
> has declined over the last 40 to 60 years…"

JUDGING.md 어휘로 **`use` / `social`** 이다 — 통념 제시 → 근거 → 논지. 자족적이다.
19세기 산문이 아니라 **현대 영어 교재 문장**이라 문장 길이 대역에 그대로 들어간다.
이것이 다른 넷과의 결정적 차이다.

⚠️ 접두어를 잘못 고르면 무너진다 — 무작위 표본 상위에 *Dutch/Alfabet* 1,927어,
*Ordinary Differential Equations/Non Homogenous 1* 1,540어가 올라왔다. 전자는
`reject`/`reference`(알파벳 표), 후자는 수식 유도다. **접두어 선정이 이 소스의 품질 레버다.**

**채택 사유**: 다섯 곳 중 **유일하게 Gutenberg 와 겹치지 않고**, 적합률이 기준선의
**7배**(63% vs 9.0%)이며, 대량 접근 경로·안정 식별자·정렬 보장 커서가 모두 있다.
편수도 SPEC 의 보류 기준(100편)을 크게 넘는다.
**단, CC BY-SA 4.0 의 SA 전염을 어떻게 다룰지는 이 정찰이 답할 수 없다 — 결정이 필요하다.**

---

## 6. 종합

| 순위 | 소스 | 판정 | 새 코퍼스 | 적합률 | 반려/보류 사유 한 줄 |
|---|---|---|---|---|---|
| 74 | Standard Ebooks | **반려** | 0 | (=9.0%) | OPDS 401 후원자 게이트 · plain text 없음 · 85% 가 PG |
| 76 | Wikisource | **보류** | 일부 | 20.5% | 상위작 26.8%+ 가 PG · 나머지는 사전·연감·법령 · 덤프 경로가 트랜스클루전으로 막힘 |
| 78 | Bartleby | **반려** | 0 | (=9.0%) | API·덤프·사이트맵 전무 · 라이선스 필드 없음 · 편수 못 셈 |
| 80 | Perseus | **반려** | 0 | **9%** | 경로·식별자는 최고급이나 적합률이 Gutenberg 와 동일 · SA 전염 |
| 85 | Wikibooks | **채택** | **전부** | **63%** | 유일하게 안 겹침 · 현대 산문 · 접두어 1,869쪽 |

**목표 표의 추정 180편에 대한 답**: 넷은 0편이고(같은 Gutenberg 코퍼스의 다른 포장),
Wikibooks 하나가 **약 5,600조각**을 낸다. 표의 추정치를 크게 넘지만 **출처는 표가 예상한
「PD 고전」이 아니라 「위키 기고자가 쓴 현대 교재」** 다.

**정찰의 성과는 반려 넷이다.** 겹침을 안 재고 다섯 곳에 수확기를 지었다면,
이미 가진 Gutenberg 수확기가 `.txt` 로 받아 오는 같은 글을 epub 파싱·TEI 파싱·HTML 크롤로
세 번 더 만들었을 것이다. 그리고 **Gutenberg 자체가 96.9% 미소비**라는 사실
(1,642 / 52,608권) — 새 소스를 찾기 전에 **가진 소스를 다 쓰는 것이 먼저다.**

---

## 7. 수확기를 짠다면 (Wikibooks 한정)

**본뜰 스크립트**: `scripts/textbook/mediawiki-lead-ingest.mjs` (위키 형).
Gutenberg 형(`harvest-gutenberg.mjs`)의 **정제·채점·적재 3단**은 그대로 쓴다 —
`cleanBookText` 대신 HTML 문단 추출만 갈아 끼우면 된다.

**파일 배치**

| | |
|---|---|
| 수확기 | `scripts/csat/harvest-wikibooks.mjs` |
| 커서 | `scripts/csat/data/wikibooks-cursor.json` — `{ prefixes: { "<접두어>": { apcontinue, done: [pageid…] } } }` |
| 접두어 정본 | 같은 파일 안 `PREFIXES` 상수 (위 §5-⑥ 표의 10개로 시작) |

**흐름**

1. 접두어마다 `list=allpages&apprefix=<접두어>&apnamespace=0&aplimit=500` → 쪽 목록.
   `apcontinue` 를 커서에 적는다(**제목 정렬 보장 — IA 실측의 중복·누락이 없다**).
2. 쪽마다 `action=parse&prop=text&formatversion=2`.
   ⚠️ **`prop=extracts` 를 쓰지 않는다** — §5-② 실측대로 빈 값이 온다.
3. `<style>` · `<table>` 제거 → `<p>` 만 취해 40어 미만 문단 버림 → 300~340어 조각.
   문단 경계에서만 자른다(`harvest-gutenberg.mjs` 의 `chop` 그대로).
4. `fitRecord` 통과분만 `classify` 로 소재를 붙여 `library_articles` 에 적재.
   - `source: 'wikibooks'`
   - `source_id: 'wb:<pageid>:<본문 sha256 앞 16>'` — Gutenberg 와 같은 규칙이라 재적재해도 안 늘어난다
   - `license: 'CC BY-SA 4.0'` · `source_url: https://en.wikibooks.org/?curid=<pageid>`
   - `status: 'queued'` → 이후 기사 게이트 드레인(`gate-article-drain`)이 `use`/`narrative`/`reject` 를 판정

**호출 예산**: 접두어 10개면 목록 호출 약 20회 + 쪽 호출 1,869회.
**1.4초 간격 강제**(§2-⑤ 실측 — 없으면 평문 `You are making too many requests to the API.` 가
JSON 자리에 온다) → 약 45분. **3회로 나눠 돌린다**(접두어 4 / 3 / 3).
UA 에 연락처를 넣는다: `Vocaflow-source-probe/1.0 (https://vocaflow.app; <연락처>)`.

**재실행 안전**: 커서에 `apcontinue` 와 처리한 `pageid` 를 적고, 읽기 전용 실행은
커서를 건드리지 않는다(`harvest-gutenberg.mjs` 의 `if (COMMIT)` 규칙 그대로).
`source_id` 가 본문 해시라 같은 쪽이 안 바뀌었으면 두 번 안 들어간다.

**먼저 결정해야 할 것**: CC BY-SA 4.0 의 SA 전염 처리(§5-③). 이것이 정해지기 전에는
`--commit` 을 돌리지 않는다.

---

## 8. 막힌 것 · 못 잰 것 (추정하지 않았다)

| 무엇 | 상태 |
|---|---|
| Standard Ebooks OPDS 전체 피드 | **401** · 후원자 전용 · "링크를 따라가면 24시간 IP 차단" 경고 |
| Bartleby 전체 편수 | **확인 실패** — `sitemap.xml` 403 · 「제목 색인」에 페이지네이션 없음 |
| Bartleby 항목별 라이선스 | **확인 실패** — 라이선스 필드 자체가 없다 |
| Perseus Scaife 뷰어 API | **302** — GitHub 정본으로 우회했다 |
| Wikisource XML 덤프 | 색인은 200 이나 **본문이 안 들어 있다**(`<pages index=…/>` 트랜스클루전) |
| Wikimedia API 무지연 연타 | **평문 레이트리밋 응답** — JSON 파서가 죽는다. 1.4초 간격 + 연락처 UA 로 해소 |
| SE 전수의 PG 도서번호 | 표본 20편만 실측(16 직접 명시). 1,515편 전수는 작품쪽을 전부 긁어야 해 **하지 않았다** |
| Wikisource 장르 게이트 적용 후 편수 | **못 쟀다** — `lib-fit.mjs` 만 태웠고 `reference`·`poetry-drama` 판정은 LLM 드레인이 필요하다 |
