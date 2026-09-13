# 교재 지문 원문 소스 재검증 — 실측 판정

측정 2026-09-13 · 후보 **121항목** 전수 프로브 · 판정 스크립트
`scripts/textbook/passage-source-verdict.mjs` · 원자료 `scripts/textbook/passage-source-probe.json`

**● = 이미 배선된 소스**(`library_articles_source_check`). 실측 상류는 **소스가 스스로 말한 수**이고
교재에 실을 수 있는 수가 아니다 — 감쇠는 `source-eligibility-scan.mjs` 소관.

## 등급 요약

| 등급 | 뜻 | 소스 | 상류 합 (총량 공표분만) | 그중 배선됨 |
|---|---|---:|---:|---:|
| A | 즉시 착수 — 열거 ⭕ 변형 ⭕ | 32 | 11,920,587 | 20 |
| B | 편당 라이선스 필터가 먼저 | 10 | 8,347,234 | 0 |
| C | 비개방 파이프라인 — 원문 확보 ⭕ 문항 0 | 1 | 0 | 1 |
| N | **비상업 전용(NC)·미확인** — 유료 플랫폼 사용 불가 | 9 | 0 | 0 |
| F | **본문 저장 불가** — 제목·URL·출처만 | 14 | 0 | 0 |
| D | 열거 수단 개발 필요 (피드 없음) | 25 | 0 | 0 |
| E | 지금은 불가 (차단·죽음·제외·색인) | 30 | 190,157,896 | 2 |

## 핵심 발견 — 사용자 표와 어긋나는 곳

0. **「논증문이 부족하다」가 이 목표의 전제였는데, 그것이 라벨링의 결과였다.**
   `register` 는 `resolveArticleRegister(source, feedId)` → 조회표에서 나온다 — **본문을 한 글자도
   보지 않는다.** 그래서 frontiers 1,958편이 내용과 무관하게 전부 expository 로 들어갔다.
   평가원 기출 **796편**을 담화 표지로 재서 눈금을 잡고(중앙 **5.33**/1,000어) 같은 자로 재고를 재니:

   | | 값 |
   |---|---|
   | 선언 argumentative (변형 가능 행) | **1,485편** |
   | 측정 기준 기출 중앙 이상 (변형 가능 행) | **≈ 23,405편** |
   | 배수 | **≈ 15.8배** |

   소스별 통과율: plos **72%** · frontiers **70%** · elife 53% · gutenberg 43% —
   그런데 **선언이 argumentative 인 owid 는 0%**, the_conversation 은 33% 였다.
   선언 expository 행 중 **38%** 가 선언 argumentative 의 중앙값을 넘었다(무작위면 50%).
   → **선언은 측정을 갈라 주지 않는다.** 새 소스를 붙이는 일보다 **이미 가진 것을 재는 일**이 먼저였다.
   자 `packages/library-pipeline/src/textbook/register-signal.ts` · 계측 `scripts/textbook/register-measure-probe.mjs`.

   ⚠️ 이 자는 논증의 **형태**를 재며 **질**을 재지 않는다. 후보 선별용이고 최종 판정은 사람·LLM 몫이다.

0-2. **「pd 외 별도 파이프라인」에 새로 붙일 수 있는 소스가 없다 — 그것이 이 사이클의 답이다.**
   비개방(원문 확보 O · 문항 0) 파이프라인은 이미 있고 실제로 소비된다 —
   `lib/articles/source-map.ts` 가 `derivation=display_only` 를 **`read_nd` 학습 경로**로 보내고,
   `/library/scripts/[bookId]` 에 ND 25편이 라이선스 표기와 함께 살아 있다. 문제는 공급이었다:

   | 축 | 실측 |
   |---|---|
   | 재배포 가능(ND·NC) | 18곳 |
   | 그중 **상업 이용 가능** | **2곳** (the_conversation · knowable) |
   | 그중 열거 가능 + 미배선 | **0곳** |

   **NC 는 ND 와 다르다.** ND 는 상업적 재배포가 되고(변형만 막힌다) NC 는 상업적 이용 자체를
   막아 **표시조차** 안 된다. 이 플랫폼은 유료 결제를 향하므로 NC 는 비개방 파이프라인에도
   들어갈 수 없다. 그런데 실측해 보니 **RSS 에 전문을 싣는 4곳이 전부 NC** 였다 —
   propublica 5,366어 · nieman_lab 3,564 · ideas_ted 1,583 · mit_news 1,175.
   축을 쪼개지 않았다면 그 넷을 그대로 배선했을 것이다.
   나머지는 RSS 에 본문이 없다(quanta 63어 · undark 51 · rand 39 · inside_climate 77).
   mongabay·undark 는 CC BY-ND 로 주장되지만 **자기 약관 페이지에서 CC 링크를 찾지 못했다** —
   Aeon 을 'cc' 로 적었던 2026-08-19 과 같은 일을 반복하지 않으려고 `unknown` 으로 남긴다.

   → 남은 길은 코드가 아니다: **발행사에 직접 라이선스를 확인**하거나, ND 가 확인된 뒤
     사이트별 본문 추출기를 만드는 것. 어댑터를 9개 짜는 일은 필요하지 않았다.
1. **표 1위가 이 플랫폼에서는 문항 0이다.** The Conversation(채택추정 6,000)은 CC BY-ND →
   `display_only` → 문항 생성기가 통째로 건너뛴다. 실측 2026-08-21 에 논증문 신규 46편이
   전부 이 이유로 문항 0이 됐다. **원문은 확보하되(비개방 파이프라인) 문항 공급선으로 세지 않는다.**

2. **표가 0점을 준 Europe PMC 가 실제로는 최대 공급선이다.** 표는 「색인·집계용, 원문 아님」으로
   뺐지만 실측은 반대다:
   - `LICENSE:"cc by" AND LANG:"eng" AND IN_EPMC:y` → **5,218,944편** · 그중 `PUB_TYPE:"review"` **618,178편**
   - **라이선스 필터가 질의 파라미터**다 — DOAB 처럼 편당 판정을 만들 필요가 없다
   - 본문이 PDF 가 아니라 `/{PMCID}/fullTextXML` 로 바로 나온다 (표본 40편 전부 200)
   - 서론 발췌 **규격 수확률 97.5%** → 약 **602,724편 지문 후보**
   - 생의학 전용도 아니다: Frontiers in Psychology **4,951** · language/learning **6,319** ·
     social/cultural **3,575** · climate/environment **3,183** · education **2,583**
   어댑터 `packages/library-pipeline/src/ingest-article/europe-pmc.ts`(라이선스 관문 3겹).

3. **DOAB 수치를 정정한다.** Cycle 1 의 「변형 가능 42,899권」은 **언어 축을 빼고 센 수**다.
   전 구간 균등 표본 1,500건 실측: 변형 가능 33.6% · **영어는 51.1% 뿐** →
   「변형 가능 × 영어」 **22.7%(약 28,983권)** · 단위 book **81.5%** / chapter 8.1% →
   대부분 **OAPEN 의 PDF 를 장으로 쪼개야** 지문이 된다. 그래도 **인문·사회 단행본은
   Europe PMC 로 대체되지 않아** 가치는 남는다. 다만 획득 비용이 가장 높다.

4. **권리는 한 축이 아니라 두 축이었다.** 직전 판까지 `derivClaim: 'no'` 한 칸에 38곳이 섞여 있었다:
   - **CC BY-ND·NC (18곳)** — 원문을 **그대로 실을 수 있다**(출처 표시). 파생만 불가 → **C 등급**
   - **© 전부유보 (20곳)** — **본문 저장 자체가 불가**. 제목·URL·출처만 → **F 등급(신설)**
   이 상태로 「비개방 파이프라인」을 만들면 **© 본문을 DB 에 담는 코드**가 된다.
   실제로 규칙을 처음 쓸 때 「CC 아님」이라는 문구를 CC 로 읽어 Aeon·SEP 이 재배포 허용으로
   넘어갔다 — 회귀가 그 둘을 이름으로 못 박는다.

5. **설명문 상류는 이미 남아돈다.** MDPI 2,035,254(CC BY) · PMC OA 8,219,033 · Wikipedia 7,239,062.
   병목은 **수량이 아니라 라벨과 라이선스**였다.

6. **표가 0점을 준 StoryWeaver 는 이 저장소가 의도적으로 붙인 것이다** — 초·중 창 154편의 register 를
   세니 narrative 0 이었고, 편수로는 해결되지 않는 결핍이었다(2026-09-02). 다만 목록 페이지가
   JS 껍데기(링크 0)라 **맨 GET 으로는 열거되지 않는다**.

7. **적체가 새 소스보다 먼저였다 — 그리고 막힌 게 아니라 아무도 안 돌린 것이었다.**
   큐 47,486편이 전부 **본문은 있고 분석만 없는** 상태였다. `ANTHROPIC_API_KEY` 없이도 degraded 로
   돈다(CEFR 신뢰도 0.732 → 0.725). 처리량 약 **1.2초/편**.
   VOA 4갈래 전량 드레인 `ready` **230 → 10,445편**(+10,215) · frontiers 3갈래 **0 → 1,958편**.
   드레인 전 얇던 칸(V2 1,512 · V3 1,560 · V4 3,116)으로 들어갔다 — **새 소스 0개로 얻은 재고다.**

8. **죽은 것으로 적을 뻔한 것들.** 이 프로브는 처음에 배선된 소스 9곳을 「죽음」으로 냈다. 원인은 소스가
   아니라 ① 내가 짐작한 주소 ② 이 머신의 node TLS(gutenberg.org 는 curl 200 · node ECONNRESET)였다.
   같은 종류의 실수를 세 번 더 했다 — 서론 파서가 중첩 `<sec>` 에서 끊겨 Introduction 이 있는 논문을
   「없음」으로 셌고(깊이 세기로 교체), `<sec>` 없는 문서 15% 를 버렸고(본문 앞머리로 보정),
   논증 표지 임계값을 기출 **p25** 로 뒀더니 0 이라 **21개 소스가 전부 100% 통과**했다(중앙값으로 교체).
   **실측 도구가 틀리면 근거가 통째로 거짓이 된다.**

9. **진짜로 못 쓰는 것.** Wikinews 는 최근 30일 항목 **0건**(사실상 정지) · Census 보도자료 피드는
   `<link/>`·`<guid/>` 가 전부 비어 기사 주소가 없다 · OpenStax·StoryWeaver·CK-12 는 JS 껍데기다.

## A — 즉시 착수

| 등급 | 소스 | 실측 상류 | 센 것 | 열거 | 파이프라인 | 파생 | 재배포 | 상업 | 피드 본문 | register | 밴드 | 라이선스 주장 | 근거(실측) |
|---|---|---:|---|---|---|---|---|---|---|---|---|---|---|
| A | ● wikipedia | 7,239,062 | 총량 | api | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | B2-C1 | CC BY-SA 4.0 | — |
| A | mdpi | 2,035,254 | 총량 | oai | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | C1-C2 | CC BY 4.0 | CC BY · 약관:CC BY |
| A | wikisource | 1,129,178 | 총량 | api | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | C1-C2 | PD 본문 + CC BY-SA 편집분 | — |
| A | europe_pmc | 618,182 | 총량 | api | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | argumentative | C1-C2 | CC BY 4.0 (질의에서 LICENSE:"cc by" 로 고정 — 혼재가 들어올 수 없다) | — |
| A | ● plos | 415,856 | 총량 | api | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | C1-C2 | CC BY 4.0 | — |
| A | ● simple_wikipedia | 284,979 | 총량 | api | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | A2-B1 | CC BY-SA 4.0 | — |
| A | wikibooks | 98,724 | 총량 | api | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | B1-C1 | CC BY-SA 4.0 | — |
| A | ● worldbank | 40,388 | 총량 | oai | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | C1 | CC BY 3.0 IGO | CC BY-NC-ND · CC BY-NC · CC BY |
| A | wikiversity | 37,482 | 총량 | api | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | B2-C1 | CC BY-SA 4.0 | — |
| A | ● elife | 19,503 | 총량 | api | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | B2-C1 | CC BY 4.0 | CC BY |
| A | ● frym | 1,979 | 총량 | api | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | B1-B2 | CC BY 4.0 | — |
| A | ● cdc | 158 | 1페이지(하한) | list | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | B2 | PD (미 연방정부) | — |
| A | ● usgs | 110 | 1페이지(하한) | list | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | B2-C1 | PD (미 연방정부) | — |
| A | ● nih_news_in_health | 54 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | B1-B2 | PD (미 연방정부) | — |
| A | ● factbook | 50 | 1페이지(하한) | list | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | reference | B1-B2 | PD (미 연방정부) | — |
| A | ● noaa | 45 | 1페이지(하한) | list | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | B2-C1 | PD (미 연방정부) | — |
| A | ● nist | 40 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | B2-C1 | PD (미 연방정부) | — |
| A | ● wikivoyage | 32 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | reference | B1-B2 | CC BY-SA 4.0 | — |
| A | ● space_place | 24 | 1페이지(하한) | list | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | A2-B1 | PD (미 연방정부) | — |
| A | nps | 21 | 1페이지(하한) | list | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | B1-B2 | PD (미 연방정부) | "All rights reserved" |
| A | ● frontiers | 20 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | C1-C2 | CC BY 4.0 | — |
| A | ● voa_learning | 20 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | A2-B2 | PD (미 연방정부) | — |
| A | grist | 20 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | argumentative | B2-C1 | CC BY 4.0 주장 | — |
| A | global_voices | 15 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | B2 | CC BY 3.0 | CC BY-SA · CC BY · "public domain" 문구 · 약관:CC BY |
| A | standard_ebooks | 15 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | C1-C2 | PD 본문 + CC0 편집분 | "public domain" 문구 |
| A | ● futurity | 10 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | B2-C1 | CC BY 4.0 | 약관:"All rights reserved" |
| A | ● gutenberg | 10 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | C1-C2 | PD (미국 기준) | — |
| A | ● nasa | 10 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | B1-C1 | PD (미 연방정부) | — |
| A | ● owid | 10 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | argumentative | B2-C1 | CC BY 4.0 | — |
| A | nature_comms | 8 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | C2 | CC BY 4.0 | "All rights reserved" |
| A | scientific_reports | 8 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | C2 | CC BY 4.0 | "All rights reserved" |
| A | hss_communications | 8 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | argumentative | C1-C2 | CC BY 4.0 | "All rights reserved" |

## B — 편당 라이선스 판정이 먼저

| 등급 | 소스 | 실측 상류 | 센 것 | 열거 | 파이프라인 | 파생 | 재배포 | 상업 | 피드 본문 | register | 밴드 | 라이선스 주장 | 근거(실측) |
|---|---|---:|---|---|---|---|---|---|---|---|---|---|---|
| B | pmc_oa | 8,219,033 | 총량 | api | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | no | unknown | expository | C1-C2 | OA subset — 논문별 CC (상업/비상업 구획 분리) | — |
| B | doab | 127,788 | 총량 | oai | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | no | unknown | argumentative | C1-C2 | 책별 CC (BY · BY-SA · BY-NC · BY-ND 혼재) | CC BY-NC-ND · CC BY-NC-SA · CC BY-ND · CC BY-NC · CC BY-SA · CC BY |
| B | biorxiv | 413 | 총량 | api | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | no | unknown | expository | C2 | 저자 선택 (CC BY · CC BY-NC-ND · 미지정 혼재) | — |
| B | sage_open | 344 | 1페이지(하한) | rss | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | no | unknown | expository | C1-C2 | CC BY / CC BY-NC 혼재 | — |
| B | pew | 100 | 1페이지(하한) | rss | 라이선스 확인 후 결정 | unknown | yes | no | unknown | argumentative | B2-C1 | 비상업 재사용 허용 주장 — 상업 교재는 확인 필요 | — |
| B | pnas | 85 | 1페이지(하한) | rss | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | yes | unknown | expository | C2 | 논문별 (CC BY 일부 · 6개월 후 무료열람) | — |
| B | jstor_open_books | 30 | 1페이지(하한) | rss | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | unknown | unknown | argumentative | C1-C2 | 책별 CC | "All rights reserved" |
| B | un_news | 30 | 1페이지(하한) | rss | 라이선스 확인 후 결정 | unknown | yes | no | unknown | expository | B2 | UN 저작물 — 비상업 재사용 조건 | — |
| B | au_press | 10 | 1페이지(하한) | rss | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | no | unknown | argumentative | C1-C2 | CC BY-NC-ND 다수 | — |
| B | manchester_hive | 5 | 1페이지(하한) | rss | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | unknown | unknown | argumentative | C1-C2 | CC 혼재 | — |

## C — 비개방 파이프라인 (원문은 확보하되 문항은 못 만든다)

CC BY-ND·NC 계열. **원문을 그대로 실을 수 있고**(출처 표시) 문항 변형만 못 한다.

| 등급 | 소스 | 실측 상류 | 센 것 | 열거 | 파이프라인 | 파생 | 재배포 | 상업 | 피드 본문 | register | 밴드 | 라이선스 주장 | 근거(실측) |
|---|---|---:|---|---|---|---|---|---|---|---|---|---|---|
| C | ● the_conversation | 50 | 1페이지(하한) | rss | 비개방 파이프라인 (원문 확보 ⭕ · 문항 0) | no | yes | yes | full | argumentative | B2-C1 | CC BY-ND 4.0 | CC BY-NC · CC BY-SA · 약관:CC BY-ND |

## N — 비상업 전용(NC) · 라이선스 미확인

ND 는 상업적 재배포가 되지만 **NC 는 상업적 이용 자체를 막는다** — 파생이 아니라 표시조차 안 된다.
이 플랫폼은 유료 결제를 향하므로 비개방 파이프라인에도 넣을 수 없다.
⚠️ 실측 2026-09-13: RSS 에 **전문을 싣는 4곳이 전부 여기 있다**(propublica 5,366어 ·
nieman_lab 3,564 · ideas_ted 1,583 · mit_news 1,175). 축이 없었다면 그대로 배선했을 것이다.

| 등급 | 소스 | 실측 상류 | 센 것 | 열거 | 파이프라인 | 파생 | 재배포 | 상업 | 피드 본문 | register | 밴드 | 라이선스 주장 | 근거(실측) |
|---|---|---:|---|---|---|---|---|---|---|---|---|---|---|
| N | mit_news | 50 | 1페이지(하한) | rss | 비상업 전용 · 라이선스 미확인 — 유료 플랫폼에서는 쓰지 않는다 | no | yes | no | full | expository | B2-C1 | CC BY-NC-ND 3.0 (MIT News 명시) | — |
| N | mongabay | 32 | 1페이지(하한) | rss | 비상업 전용 · 라이선스 미확인 — 유료 플랫폼에서는 쓰지 않는다 | no | yes | unknown | summary | expository | B2-C1 | CC BY-ND 4.0 | — |
| N | nieman_lab | 30 | 1페이지(하한) | rss | 비상업 전용 · 라이선스 미확인 — 유료 플랫폼에서는 쓰지 않는다 | no | yes | no | full | argumentative | C1 | CC BY-NC-SA 3.0 | CC BY-NC-SA · "public domain" 문구 |
| N | rand | 20 | 1페이지(하한) | rss | 비상업 전용 · 라이선스 미확인 — 유료 플랫폼에서는 쓰지 않는다 | no | yes | no | none | argumentative | C1 | CC BY-NC-ND 다수 | — |
| N | propublica | 20 | 1페이지(하한) | rss | 비상업 전용 · 라이선스 미확인 — 유료 플랫폼에서는 쓰지 않는다 | no | yes | no | full | argumentative | C1 | CC BY-NC-ND 3.0 | — |
| N | undark | 10 | 1페이지(하한) | rss | 비상업 전용 · 라이선스 미확인 — 유료 플랫폼에서는 쓰지 않는다 | no | yes | unknown | none | argumentative | C1 | CC BY-ND 4.0 | — |
| N | inside_climate_news | 10 | 1페이지(하한) | rss | 비상업 전용 · 라이선스 미확인 — 유료 플랫폼에서는 쓰지 않는다 | no | yes | no | none | argumentative | C1 | CC BY-NC-ND 4.0 | — |
| N | ideas_ted | 7 | 1페이지(하한) | rss | 비상업 전용 · 라이선스 미확인 — 유료 플랫폼에서는 쓰지 않는다 | no | yes | no | full | argumentative | B2-C1 | CC BY-NC-ND 4.0 (TED 다수) | "All rights reserved" |
| N | quanta | 5 | 1페이지(하한) | rss | 비상업 전용 · 라이선스 미확인 — 유료 플랫폼에서는 쓰지 않는다 | no | yes | no | none | argumentative | C1 | CC BY-NC-ND 3.0 | — |

## F — 본문 저장 불가 (제목·URL·출처만)

© 전부유보 · 협약 재게시 · 가입 필요. **본문을 DB 에 담지 않는다.** 소재 참고용 메타데이터만 남긴다.
직전 판까지 이 14곳이 C 와 같은 칸에 있었다 — 그 상태로 파이프라인을 만들면
© 본문을 저장하는 코드가 된다.

| 등급 | 소스 | 실측 상류 | 센 것 | 열거 | 파이프라인 | 파생 | 재배포 | 상업 | 피드 본문 | register | 밴드 | 라이선스 주장 | 근거(실측) |
|---|---|---:|---|---|---|---|---|---|---|---|---|---|---|
| F | sep | 1,888 | 1페이지(하한) | list | 본문 저장 불가 — 제목·URL·출처만 | no | no | no | unknown | argumentative | C2 | © Metaphysics Research Lab (CC 아님) | — |
| F | brookings | 51 | 1페이지(하한) | list | 본문 저장 불가 — 제목·URL·출처만 | no | no | no | unknown | argumentative | C1 | ©  | — |
| F | harvard_gazette | 50 | 1페이지(하한) | rss | 본문 저장 불가 — 제목·URL·출처만 | no | no | no | unknown | expository | B2-C1 | © 전부 유보 추정 | "All rights reserved" |
| F | greater_good | 50 | 1페이지(하한) | rss | 본문 저장 불가 — 제목·URL·출처만 | no | no | no | unknown | argumentative | B2-C1 | © UC Berkeley | CC BY-ND |
| F | al_jazeera | 25 | 1페이지(하한) | rss | 본문 저장 불가 — 제목·URL·출처만 | no | no | no | unknown | expository | B2 | © (CC 저장소는 중단됨) | — |
| F | aeon | 20 | 1페이지(하한) | rss | 본문 저장 불가 — 제목·URL·출처만 | no | no | no | unknown | argumentative | C1-C2 | 협약 후 재게시 (CC 아님 — 2026-08-19 이 저장소가 'cc' 로 잘못 적은 적 있음) | "All rights reserved" |
| F | mit_press_reader | 20 | 1페이지(하한) | rss | 본문 저장 불가 — 제목·URL·출처만 | no | no | no | unknown | argumentative | C1 | ©  | — |
| F | smithsonian_mag | 10 | 1페이지(하한) | rss | 본문 저장 불가 — 제목·URL·출처만 | no | no | no | unknown | argumentative | B2-C1 | © Smithsonian (전부 유보 추정) | — |
| F | big_think | 10 | 1페이지(하한) | rss | 본문 저장 불가 — 제목·URL·출처만 | no | no | no | unknown | argumentative | B2-C1 | © (전부 유보 추정) | — |
| F | nautilus | 10 | 1페이지(하한) | rss | 본문 저장 불가 — 제목·URL·출처만 | no | no | no | unknown | argumentative | C1 | © (유료 구간 존재) | — |
| F | jstor_daily | 10 | 1페이지(하한) | rss | 본문 저장 불가 — 제목·URL·출처만 | no | no | no | unknown | argumentative | B2-C1 | © ITHAKA | — |
| F | iep | 10 | 1페이지(하한) | rss | 본문 저장 불가 — 제목·URL·출처만 | no | no | no | unknown | argumentative | C2 | © (저자 유보) | — |
| F | behavioral_scientist | 10 | 1페이지(하한) | rss | 본문 저장 불가 — 제목·URL·출처만 | no | no | no | unknown | argumentative | C1 | ©  | "All rights reserved" |
| F | edge_org | 3 | 1페이지(하한) | rss | 본문 저장 불가 — 제목·URL·출처만 | no | no | no | unknown | argumentative | C2 | ©  | "All rights reserved" |

## D — 페이지는 살아 있고 피드가 없다 (목록 파서 필요)

| 등급 | 소스 | 실측 상류 | 센 것 | 열거 | 파이프라인 | 파생 | 재배포 | 상업 | 피드 본문 | register | 밴드 | 라이선스 주장 | 근거(실측) |
|---|---|---:|---|---|---|---|---|---|---|---|---|---|---|
| D | cambridge_core_oa | 0 | 1페이지(하한) | html | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | no | unknown | argumentative | C1-C2 | CC BY / CC BY-NC / CC BY-NC-ND 혼재 | — |
| D | springer_oa_books | 0 | 1페이지(하한) | html | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | no | unknown | argumentative | C1-C2 | CC BY / CC BY-NC-ND 혼재 | — |
| D | muse_oa | 0 | 1페이지(하한) | html | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | unknown | unknown | argumentative | C1-C2 | 책별 CC | — |
| D | degruyter_oa | 0 | 1페이지(하한) | html | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | unknown | unknown | argumentative | C1-C2 | CC 혼재 | — |
| D | libretexts | 0 | 1페이지(하한) | html | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | no | unknown | expository | B2-C1 | CC BY-NC-SA 다수 (NC 주의) | "All rights reserved" |
| D | oer_commons | 0 | 1페이지(하한) | html | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | unknown | unknown | expository | B1-C1 | 자료별 CC | CC BY-NC-SA |
| D | anu_press | 0 | 1페이지(하한) | html | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | no | unknown | argumentative | C1-C2 | CC BY-NC-ND 다수 | — |
| D | bmc | 0 | 1페이지(하한) | html | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | C1-C2 | CC BY 4.0 | — |
| D | open_textbook_library | 0 | 1페이지(하한) | html | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | unknown | unknown | expository | B2-C1 | 교재별 CC | CC BY |
| D | philosophers_imprint | 0 | 1페이지(하한) | html | 비상업 전용 · 라이선스 미확인 — 유료 플랫폼에서는 쓰지 않는다 | no | yes | no | unknown | argumentative | C2 | CC BY-NC-ND 주장 | — |
| D | open_humanities_press | 0 | 1페이지(하한) | html | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | unknown | unknown | argumentative | C2 | CC 혼재 | CC BY |
| D | punctum_books | 0 | 1페이지(하한) | html | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | no | unknown | argumentative | C2 | CC BY-NC-SA 다수 | CC BY-NC-ND · CC BY-NC-SA |
| D | commonlit | 0 | 1페이지(하한) | html | 라이선스 확인 후 결정 | unknown | no | no | unknown | expository | B1-B2 | 가입 필요 · 자료별 상이 | "All rights reserved" |
| D | readworks | 0 | 1페이지(하한) | html | 본문 저장 불가 — 제목·URL·출처만 | no | no | no | unknown | expository | B1-B2 | 가입 필요 · ©  | — |
| D | khan_academy | 0 | 1페이지(하한) | html | 비상업 전용 · 라이선스 미확인 — 유료 플랫폼에서는 쓰지 않는다 | no | yes | no | unknown | expository | B1-B2 | CC BY-NC-SA 4.0 | — |
| D | unep | 0 | 1페이지(하한) | html | 라이선스 확인 후 결정 | unknown | yes | unknown | unknown | expository | B2 | UN 저작물 | — |
| D | unesco_courier | 0 | 1페이지(하한) | html | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | argumentative | B2-C1 | CC BY-SA 3.0 IGO | — |
| D | jep_aea | 0 | 1페이지(하한) | html | 비상업 전용 · 라이선스 미확인 — 유료 플랫폼에서는 쓰지 않는다 | no | yes | no | unknown | argumentative | C1-C2 | CC BY-NC 4.0 | "All rights reserved" |
| D | doe_science | 0 | 1페이지(하한) | html | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | B2-C1 | PD (미 연방정부) | — |
| D | nsf | 0 | 1페이지(하한) | html | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | B2-C1 | PD (미 연방정부) | — |
| D | fed_education | 0 | 1페이지(하한) | html | 라이선스 확인 후 결정 | unknown | yes | yes | unknown | expository | B2 | 미 연방기관 — PD 추정(확인 필요) | — |
| D | scholarpedia | 0 | 1페이지(하한) | html | 비상업 전용 · 라이선스 미확인 — 유료 플랫폼에서는 쓰지 않는다 | no | yes | no | unknown | expository | C2 | CC BY-NC-SA 3.0 | CC BY-NC-SA · CC BY |
| D | who_factsheets | 0 | 1페이지(하한) | html | 비상업 전용 · 라이선스 미확인 — 유료 플랫폼에서는 쓰지 않는다 | no | yes | no | unknown | expository | B2 | CC BY-NC-SA 3.0 IGO | — |
| D | bartleby | 0 | 1페이지(하한) | html | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | yes | unknown | argumentative | C1-C2 | 본문 PD · 사이트 © 혼재 | — |
| D | perseus | 0 | 1페이지(하한) | html | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | argumentative | C2 | CC BY-SA 3.0 | — |

## E — 지금은 불가

| 등급 | 소스 | 실측 상류 | 센 것 | 열거 | 파이프라인 | 파생 | 재배포 | 상업 | 피드 본문 | register | 밴드 | 라이선스 주장 | 근거(실측) |
|---|---|---:|---|---|---|---|---|---|---|---|---|---|---|
| E | openalex | 124,316,544 | 총량 | index | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | yes | unknown | expository | C2 | 메타데이터 CC0 | — |
| E | internet_archive | 52,244,306 | 총량 | index | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | unknown | unknown | expository | C1-C2 | 항목별 | — |
| E | doaj | 13,597,046 | 총량 | index | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | unknown | unknown | expository | C2 | 논문별 CC 표기 | — |
| E | ck12 | 3 | 1페이지(하한) | dead | 비상업 전용 · 라이선스 미확인 — 유료 플랫폼에서는 쓰지 않는다 | no | yes | no | unknown | expository | B1-B2 | CC BY-NC 3.0 | — |
| E | oxford_academic_oa | 0 | 1페이지(하한) | blocked | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | no | unknown | argumentative | C1-C2 | CC BY / CC BY-NC-ND 혼재 | — |
| E | stanford_news | 0 | 1페이지(하한) | blocked | 본문 저장 불가 — 제목·URL·출처만 | no | no | no | unknown | expository | B2-C1 | © 전부 유보 추정 | — |
| E | lse_press | 0 | 1페이지(하한) | blocked | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | argumentative | C1-C2 | CC BY 4.0 주장 | — |
| E | ucl_press | 0 | 1페이지(하한) | blocked | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | argumentative | C1-C2 | CC BY 주장 | — |
| E | ubiquity_press | 0 | 1페이지(하한) | blocked | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | argumentative | C1-C2 | CC BY | — |
| E | bccampus | 0 | 1페이지(하한) | blocked | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | yes | unknown | expository | B2-C1 | CC BY 다수 | — |
| E | arxiv | 0 | 1페이지(하한) | excluded | 본문 저장 불가 — 제목·URL·출처만 | no | no | no | unknown | expository | C2 | 저자 선택(대부분 비CC arXiv 라이선스) | — |
| E | obp | 0 | 1페이지(하한) | blocked | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | no | unknown | argumentative | C1-C2 | CC BY / CC BY-NC 혼재 | — |
| E | mit_press_oa | 0 | 1페이지(하한) | blocked | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | no | unknown | argumentative | C1-C2 | CC BY-NC-ND 다수 | — |
| E | cogent_oa | 0 | 1페이지(하한) | blocked | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | C1-C2 | CC BY | — |
| E | osf_preprints | 0 | 1페이지(하한) | dead | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | yes | unknown | expository | C1-C2 | 저자 선택 (CC BY 다수 · 미지정도 있음) | — |
| E | ssrn | 0 | 1페이지(하한) | blocked | 본문 저장 불가 — 제목·URL·출처만 | no | no | no | unknown | expository | C1-C2 | 저자 유보 다수 (© ) | — |
| E | openstax | 0 | 1페이지(하한) | dead | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | B2-C1 | CC BY 4.0 | — |
| E | pressbooks_directory | 0 | 1페이지(하한) | blocked | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | unknown | unknown | expository | B2-C1 | 책별 CC | — |
| E | philarchive | 0 | 1페이지(하한) | blocked | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | unknown | unknown | argumentative | C2 | 저자 유보 다수 | — |
| E | oecd | 0 | 1페이지(하한) | blocked | 비상업 전용 · 라이선스 미확인 — 유료 플랫폼에서는 쓰지 않는다 | no | yes | no | unknown | expository | C1 | CC BY-NC-ND 4.0 (iLibrary 다수) | — |
| E | knowable | 0 | 1페이지(하한) | blocked | 비개방 파이프라인 (원문 확보 ⭕ · 문항 0) | no | yes | yes | unknown | argumentative | C1 | CC BY-ND 4.0 | — |
| E | rsos | 0 | 1페이지(하한) | blocked | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | C2 | CC BY 4.0 | — |
| E | loc_blogs | 0 | 1페이지(하한) | blocked | 개방 파이프라인 + 편당 라이선스 필터 | mixed | yes | yes | unknown | argumentative | B2-C1 | PD 다수 (게시물별 확인) | — |
| E | census_bls | 0 | 1페이지(하한) | dead | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | B2-C1 | PD (미 연방정부) | — |
| E | citizendium | 0 | 1페이지(하한) | blocked | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | C1 | CC BY-SA 3.0 | — |
| E | encyclopedia_of_earth | 0 | 1페이지(하한) | blocked | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | expository | C1 | CC BY-SA 주장 | — |
| E | ● wikinews | 0 | 1페이지(하한) | dead | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | news | B1-B2 | CC BY 2.5 | — |
| E | poetry_foundation | 0 | 1페이지(하한) | excluded | 본문 저장 불가 — 제목·URL·출처만 | no | no | no | unknown | poetry | C2 | ©  | — |
| E | ● storyweaver | 0 | 1페이지(하한) | dead | 개방 파이프라인 (문항 변형 가능) | yes | yes | yes | unknown | narrative | A1-B1 | CC BY 4.0 | — |
| E | hathitrust | 0 | 1페이지(하한) | blocked | 본문 저장 불가 — 제목·URL·출처만 | no | no | no | unknown | expository | C2 | 본문 접근 제한 | — |
