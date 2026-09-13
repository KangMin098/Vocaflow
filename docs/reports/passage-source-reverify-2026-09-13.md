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
| C | 비개방 파이프라인 (표시 전용) | 24 | 0 | 1 |
| D | 열거 수단 개발 필요 (피드 없음) | 25 | 0 | 0 |
| E | 지금은 불가 (차단·죽음·제외·색인) | 30 | 190,157,896 | 2 |

## 핵심 발견 — 사용자 표와 어긋나는 곳

1. **표 1위가 이 플랫폼에서는 문항 0이다.** The Conversation(채택추정 6,000)은 CC BY-ND →
   `display_only` → 문항 생성기가 통째로 건너뛴다. 실측 2026-08-21 에 논증문 신규 46편이
   전부 이 이유로 문항 0이 됐다. **원문은 확보하되(비개방 파이프라인) 문항 공급선으로 세지 않는다.**

2. **표가 0점을 준 Europe PMC 가 실제로는 최대 공급선이다.** 표는 「색인·집계용, 원문 아님」으로
   뺐지만 실측은 반대다(2026-09-13):
   - `LICENSE:"cc by" AND LANG:"eng" AND IN_EPMC:y` → **5,218,944편** · 그중 `PUB_TYPE:"review"` **618,178편**
   - **라이선스 필터가 질의 파라미터**다 — DOAB 처럼 편당 판정을 만들 필요가 없다
   - 본문이 PDF 가 아니라 `/{PMCID}/fullTextXML` 로 바로 나온다 (표본 40편 전부 200)
   - 서론 발췌 **규격 수확률 97.5%**(짧은 지문 95.0% · 장문 82.5%) → 약 **602,724편 지문 후보**
   - 생의학 전용도 아니다: Frontiers in Psychology **4,951** · language/learning **6,319** ·
     social/cultural **3,575** · climate/environment **3,183** · education **2,583**
     (전부 CC BY 영어 review 실측) — 수능 최빈출 소재가 실재한다
   측정 근거 `scripts/textbook/epmc-yield-probe.mjs` · `scripts/textbook/epmc-yield.json`

3. **DOAB 수치를 정정한다.** Cycle 1 에서 「변형 가능 42,899권」이라 적었는데 그것은 **언어 축을
   빼고 센 수**다. 전 구간 균등 표본 1,500건 실측:
   변형 가능 33.6% · **영어는 51.1% 뿐** → 「변형 가능 × 영어」 **22.7%(약 28,983권)** ·
   단위는 book **81.5%** / chapter 8.1% → 대부분 **OAPEN 의 PDF 를 장으로 쪼개야** 지문이 된다.
   그래도 가치는 남는다 — **인문·사회 단행본은 Europe PMC 로 대체되지 않는다.** 다만 획득 비용이 가장 높다.

4. **논증문 A 등급 공급선이 3곳 → 4곳이 됐고, 상류가 38어에서 618,182편이 됐다.**
   기존 셋(grist 20 · owid 10 · hss_communications 8)은 전부 RSS 한 페이지 분량이 상류의 전부였다.
   현재 DB 의 변형 가능 논증문은 **1,485편 · 소스 2곳**(plos 1,476 · owid 9)이다.

5. **설명문 상류는 이미 남아돈다.** MDPI 2,035,254(CC BY) · PMC OA 8,219,033 · Wikipedia 7,239,062.
   즉 이 작업의 병목은 **수량이 아니라 장르와 라이선스**다.

6. **표가 0점을 준 StoryWeaver 는 이 저장소가 의도적으로 붙인 것이다** — 초·중 창 154편의 register 를
   세니 narrative 0 이었고, 편수로는 해결되지 않는 결핍이었다(2026-09-02). 다만 오늘 실측에서
   목록 페이지가 JS 껍데기(링크 0)라 **맨 GET 으로는 열거되지 않는다**.

7. **적체가 새 소스보다 먼저였다 — 그리고 막힌 게 아니라 아무도 안 돌린 것이었다.**
   큐 47,486편이 전부 **본문은 있고 분석만 없는** 상태였다(`article_v_level`·`register`·`word_count` null).
   `ANTHROPIC_API_KEY` 없이도 degraded 모드로 돈다(CEFR 신뢰도 0.732 → 0.725). 처리량 **약 1.2초/편**.
   VOA 를 4갈래로 드레인해 `ready` **230 → 3,607편**(+3,377)을 올렸고, 그 전부가 얇던 밴드로 들어갔다:
   V4 **+2,116** · V3 **+688** · V2 **+405** · V5 +491. 새 소스 0개로 얻은 재고다.

8. **죽은 것으로 적을 뻔한 것들.** 이 프로브는 처음에 배선된 소스 9곳을 「죽음」으로 냈다. 원인은 소스가
   아니라 ① 내가 짐작한 주소 ② 이 머신의 node TLS(gutenberg.org 는 curl 200 · node ECONNRESET)였다.
   지금은 배선표의 주소를 쓰고 curl 로 한 번 더 묻는다. **실측 도구가 틀리면 근거가 통째로 거짓이 된다.**
   같은 종류의 실수를 서론 파서에서도 했다 — 중첩 `<sec>` 를 비탐욕 정규식으로 잡아 Introduction 이
   있는 논문을 「없음」으로 셌고(깊이 세기로 교체), `<sec>` 이 아예 없는 문서 15% 를 버렸다(본문 앞머리로
   보정). 두 수정으로 수확률이 82.5% → **97.5%** 가 됐다 — 소스가 좋아진 것이 아니라 **내 자가 나아졌다**.

9. **진짜로 못 쓰는 것.** Wikinews 는 최근 30일 항목 **0건**(사실상 정지) · Census 보도자료 피드는
   `<link/>`·`<guid/>` 가 전부 비어 기사 주소가 없다 · OpenStax·StoryWeaver·CK-12 는 JS 껍데기다.

## A — 즉시 착수

| 등급 | 소스 | 실측 상류 | 센 것 | 열거 | 파이프라인 | register | 밴드 | 라이선스 주장 | 근거(실측) |
|---|---|---:|---|---|---|---|---|---|---|
| A | ● wikipedia | 7,239,062 | 총량 | api | 개방 파이프라인 (문항 변형 가능) | expository | B2-C1 | CC BY-SA 4.0 | — |
| A | mdpi | 2,035,254 | 총량 | oai | 개방 파이프라인 (문항 변형 가능) | expository | C1-C2 | CC BY 4.0 | CC BY · 약관:CC BY |
| A | wikisource | 1,129,178 | 총량 | api | 개방 파이프라인 (문항 변형 가능) | expository | C1-C2 | PD 본문 + CC BY-SA 편집분 | — |
| A | europe_pmc | 618,182 | 총량 | api | 개방 파이프라인 (문항 변형 가능) | argumentative | C1-C2 | CC BY 4.0 (질의에서 LICENSE:"cc by" 로 고정 — 혼재가 들어올 수 없다) | — |
| A | ● plos | 415,856 | 총량 | api | 개방 파이프라인 (문항 변형 가능) | expository | C1-C2 | CC BY 4.0 | — |
| A | ● simple_wikipedia | 284,979 | 총량 | api | 개방 파이프라인 (문항 변형 가능) | expository | A2-B1 | CC BY-SA 4.0 | — |
| A | wikibooks | 98,724 | 총량 | api | 개방 파이프라인 (문항 변형 가능) | expository | B1-C1 | CC BY-SA 4.0 | — |
| A | ● worldbank | 40,388 | 총량 | oai | 개방 파이프라인 (문항 변형 가능) | expository | C1 | CC BY 3.0 IGO | CC BY-NC-ND · CC BY-NC · CC BY |
| A | wikiversity | 37,482 | 총량 | api | 개방 파이프라인 (문항 변형 가능) | expository | B2-C1 | CC BY-SA 4.0 | — |
| A | ● elife | 19,503 | 총량 | api | 개방 파이프라인 (문항 변형 가능) | expository | B2-C1 | CC BY 4.0 | CC BY |
| A | ● frym | 1,979 | 총량 | api | 개방 파이프라인 (문항 변형 가능) | expository | B1-B2 | CC BY 4.0 | — |
| A | ● cdc | 158 | 1페이지(하한) | list | 개방 파이프라인 (문항 변형 가능) | expository | B2 | PD (미 연방정부) | — |
| A | ● usgs | 110 | 1페이지(하한) | list | 개방 파이프라인 (문항 변형 가능) | expository | B2-C1 | PD (미 연방정부) | — |
| A | ● nih_news_in_health | 54 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | expository | B1-B2 | PD (미 연방정부) | — |
| A | ● factbook | 50 | 1페이지(하한) | list | 개방 파이프라인 (문항 변형 가능) | reference | B1-B2 | PD (미 연방정부) | — |
| A | ● noaa | 45 | 1페이지(하한) | list | 개방 파이프라인 (문항 변형 가능) | expository | B2-C1 | PD (미 연방정부) | — |
| A | ● nist | 40 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | expository | B2-C1 | PD (미 연방정부) | — |
| A | ● wikivoyage | 32 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | reference | B1-B2 | CC BY-SA 4.0 | — |
| A | ● space_place | 24 | 1페이지(하한) | list | 개방 파이프라인 (문항 변형 가능) | expository | A2-B1 | PD (미 연방정부) | — |
| A | nps | 21 | 1페이지(하한) | list | 개방 파이프라인 (문항 변형 가능) | expository | B1-B2 | PD (미 연방정부) | "All rights reserved" |
| A | ● frontiers | 20 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | expository | C1-C2 | CC BY 4.0 | — |
| A | ● voa_learning | 20 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | expository | A2-B2 | PD (미 연방정부) | — |
| A | grist | 20 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | argumentative | B2-C1 | CC BY 4.0 주장 | — |
| A | global_voices | 15 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | expository | B2 | CC BY 3.0 | CC BY-SA · CC BY · "public domain" 문구 · 약관:CC BY |
| A | standard_ebooks | 15 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | expository | C1-C2 | PD 본문 + CC0 편집분 | "public domain" 문구 |
| A | ● futurity | 10 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | expository | B2-C1 | CC BY 4.0 | 약관:"All rights reserved" |
| A | ● gutenberg | 10 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | expository | C1-C2 | PD (미국 기준) | — |
| A | ● nasa | 10 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | expository | B1-C1 | PD (미 연방정부) | — |
| A | ● owid | 10 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | argumentative | B2-C1 | CC BY 4.0 | — |
| A | nature_comms | 8 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | expository | C2 | CC BY 4.0 | "All rights reserved" |
| A | scientific_reports | 8 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | expository | C2 | CC BY 4.0 | "All rights reserved" |
| A | hss_communications | 8 | 1페이지(하한) | rss | 개방 파이프라인 (문항 변형 가능) | argumentative | C1-C2 | CC BY 4.0 | "All rights reserved" |

## B — 편당 라이선스 판정이 먼저

| 등급 | 소스 | 실측 상류 | 센 것 | 열거 | 파이프라인 | register | 밴드 | 라이선스 주장 | 근거(실측) |
|---|---|---:|---|---|---|---|---|---|---|
| B | pmc_oa | 8,219,033 | 총량 | api | 개방 파이프라인 + 편당 라이선스 필터 | expository | C1-C2 | OA subset — 논문별 CC (상업/비상업 구획 분리) | — |
| B | doab | 127,788 | 총량 | oai | 개방 파이프라인 + 편당 라이선스 필터 | argumentative | C1-C2 | 책별 CC (BY · BY-SA · BY-NC · BY-ND 혼재) | CC BY-NC-ND · CC BY-NC-SA · CC BY-ND · CC BY-NC · CC BY-SA · CC BY |
| B | biorxiv | 413 | 총량 | api | 개방 파이프라인 + 편당 라이선스 필터 | expository | C2 | 저자 선택 (CC BY · CC BY-NC-ND · 미지정 혼재) | — |
| B | sage_open | 344 | 1페이지(하한) | rss | 개방 파이프라인 + 편당 라이선스 필터 | expository | C1-C2 | CC BY / CC BY-NC 혼재 | — |
| B | pew | 100 | 1페이지(하한) | rss | 라이선스 확인 후 결정 | argumentative | B2-C1 | 비상업 재사용 허용 주장 — 상업 교재는 확인 필요 | — |
| B | pnas | 85 | 1페이지(하한) | rss | 개방 파이프라인 + 편당 라이선스 필터 | expository | C2 | 논문별 (CC BY 일부 · 6개월 후 무료열람) | — |
| B | jstor_open_books | 30 | 1페이지(하한) | rss | 개방 파이프라인 + 편당 라이선스 필터 | argumentative | C1-C2 | 책별 CC | "All rights reserved" |
| B | un_news | 30 | 1페이지(하한) | rss | 라이선스 확인 후 결정 | expository | B2 | UN 저작물 — 비상업 재사용 조건 | — |
| B | au_press | 10 | 1페이지(하한) | rss | 개방 파이프라인 + 편당 라이선스 필터 | argumentative | C1-C2 | CC BY-NC-ND 다수 | — |
| B | manchester_hive | 5 | 1페이지(하한) | rss | 개방 파이프라인 + 편당 라이선스 필터 | argumentative | C1-C2 | CC 혼재 | — |

## C — 비개방 파이프라인 (원문은 확보하되 문항은 못 만든다)

| 등급 | 소스 | 실측 상류 | 센 것 | 열거 | 파이프라인 | register | 밴드 | 라이선스 주장 | 근거(실측) |
|---|---|---:|---|---|---|---|---|---|---|
| C | sep | 1,888 | 1페이지(하한) | list | 비개방 파이프라인 (표시 전용 · 문항 0) | argumentative | C2 | © Metaphysics Research Lab (CC 아님) | — |
| C | brookings | 51 | 1페이지(하한) | list | 비개방 파이프라인 (표시 전용 · 문항 0) | argumentative | C1 | ©  | — |
| C | ● the_conversation | 50 | 1페이지(하한) | rss | 비개방 파이프라인 (표시 전용 · 문항 0) | argumentative | B2-C1 | CC BY-ND 4.0 | CC BY-NC · CC BY-SA · 약관:CC BY-ND |
| C | harvard_gazette | 50 | 1페이지(하한) | rss | 비개방 파이프라인 (표시 전용 · 문항 0) | expository | B2-C1 | © 전부 유보 추정 | "All rights reserved" |
| C | mit_news | 50 | 1페이지(하한) | rss | 비개방 파이프라인 (표시 전용 · 문항 0) | expository | B2-C1 | CC BY-NC-ND 3.0 (MIT News 명시) | — |
| C | greater_good | 50 | 1페이지(하한) | rss | 비개방 파이프라인 (표시 전용 · 문항 0) | argumentative | B2-C1 | © UC Berkeley | CC BY-ND |
| C | mongabay | 32 | 1페이지(하한) | rss | 비개방 파이프라인 (표시 전용 · 문항 0) | expository | B2-C1 | CC BY-ND 4.0 | — |
| C | nieman_lab | 30 | 1페이지(하한) | rss | 비개방 파이프라인 (표시 전용 · 문항 0) | argumentative | C1 | CC BY-NC-SA 3.0 | CC BY-NC-SA · "public domain" 문구 |
| C | al_jazeera | 25 | 1페이지(하한) | rss | 비개방 파이프라인 (표시 전용 · 문항 0) | expository | B2 | © (CC 저장소는 중단됨) | — |
| C | aeon | 20 | 1페이지(하한) | rss | 비개방 파이프라인 (표시 전용 · 문항 0) | argumentative | C1-C2 | 협약 후 재게시 (CC 아님 — 2026-08-19 이 저장소가 'cc' 로 잘못 적은 적 있음) | "All rights reserved" |
| C | rand | 20 | 1페이지(하한) | rss | 비개방 파이프라인 (표시 전용 · 문항 0) | argumentative | C1 | CC BY-NC-ND 다수 | — |
| C | mit_press_reader | 20 | 1페이지(하한) | rss | 비개방 파이프라인 (표시 전용 · 문항 0) | argumentative | C1 | ©  | — |
| C | propublica | 20 | 1페이지(하한) | rss | 비개방 파이프라인 (표시 전용 · 문항 0) | argumentative | C1 | CC BY-NC-ND 3.0 | — |
| C | smithsonian_mag | 10 | 1페이지(하한) | rss | 비개방 파이프라인 (표시 전용 · 문항 0) | argumentative | B2-C1 | © Smithsonian (전부 유보 추정) | — |
| C | big_think | 10 | 1페이지(하한) | rss | 비개방 파이프라인 (표시 전용 · 문항 0) | argumentative | B2-C1 | © (전부 유보 추정) | — |
| C | nautilus | 10 | 1페이지(하한) | rss | 비개방 파이프라인 (표시 전용 · 문항 0) | argumentative | C1 | © (유료 구간 존재) | — |
| C | jstor_daily | 10 | 1페이지(하한) | rss | 비개방 파이프라인 (표시 전용 · 문항 0) | argumentative | B2-C1 | © ITHAKA | — |
| C | iep | 10 | 1페이지(하한) | rss | 비개방 파이프라인 (표시 전용 · 문항 0) | argumentative | C2 | © (저자 유보) | — |
| C | behavioral_scientist | 10 | 1페이지(하한) | rss | 비개방 파이프라인 (표시 전용 · 문항 0) | argumentative | C1 | ©  | "All rights reserved" |
| C | undark | 10 | 1페이지(하한) | rss | 비개방 파이프라인 (표시 전용 · 문항 0) | argumentative | C1 | CC BY-ND 4.0 | — |
| C | inside_climate_news | 10 | 1페이지(하한) | rss | 비개방 파이프라인 (표시 전용 · 문항 0) | argumentative | C1 | CC BY-NC-ND 4.0 | — |
| C | ideas_ted | 7 | 1페이지(하한) | rss | 비개방 파이프라인 (표시 전용 · 문항 0) | argumentative | B2-C1 | CC BY-NC-ND 4.0 (TED 다수) | "All rights reserved" |
| C | quanta | 5 | 1페이지(하한) | rss | 비개방 파이프라인 (표시 전용 · 문항 0) | argumentative | C1 | CC BY-NC-ND 3.0 | — |
| C | edge_org | 3 | 1페이지(하한) | rss | 비개방 파이프라인 (표시 전용 · 문항 0) | argumentative | C2 | ©  | "All rights reserved" |

## D — 페이지는 살아 있고 피드가 없다 (목록 파서 필요)

| 등급 | 소스 | 실측 상류 | 센 것 | 열거 | 파이프라인 | register | 밴드 | 라이선스 주장 | 근거(실측) |
|---|---|---:|---|---|---|---|---|---|---|
| D | cambridge_core_oa | 0 | 1페이지(하한) | html | 개방 파이프라인 + 편당 라이선스 필터 | argumentative | C1-C2 | CC BY / CC BY-NC / CC BY-NC-ND 혼재 | — |
| D | springer_oa_books | 0 | 1페이지(하한) | html | 개방 파이프라인 + 편당 라이선스 필터 | argumentative | C1-C2 | CC BY / CC BY-NC-ND 혼재 | — |
| D | muse_oa | 0 | 1페이지(하한) | html | 개방 파이프라인 + 편당 라이선스 필터 | argumentative | C1-C2 | 책별 CC | — |
| D | degruyter_oa | 0 | 1페이지(하한) | html | 개방 파이프라인 + 편당 라이선스 필터 | argumentative | C1-C2 | CC 혼재 | — |
| D | libretexts | 0 | 1페이지(하한) | html | 개방 파이프라인 + 편당 라이선스 필터 | expository | B2-C1 | CC BY-NC-SA 다수 (NC 주의) | "All rights reserved" |
| D | oer_commons | 0 | 1페이지(하한) | html | 개방 파이프라인 + 편당 라이선스 필터 | expository | B1-C1 | 자료별 CC | CC BY-NC-SA |
| D | anu_press | 0 | 1페이지(하한) | html | 개방 파이프라인 + 편당 라이선스 필터 | argumentative | C1-C2 | CC BY-NC-ND 다수 | — |
| D | bmc | 0 | 1페이지(하한) | html | 개방 파이프라인 (문항 변형 가능) | expository | C1-C2 | CC BY 4.0 | — |
| D | open_textbook_library | 0 | 1페이지(하한) | html | 개방 파이프라인 + 편당 라이선스 필터 | expository | B2-C1 | 교재별 CC | CC BY |
| D | philosophers_imprint | 0 | 1페이지(하한) | html | 비개방 파이프라인 (표시 전용 · 문항 0) | argumentative | C2 | CC BY-NC-ND 주장 | — |
| D | open_humanities_press | 0 | 1페이지(하한) | html | 개방 파이프라인 + 편당 라이선스 필터 | argumentative | C2 | CC 혼재 | CC BY |
| D | punctum_books | 0 | 1페이지(하한) | html | 개방 파이프라인 + 편당 라이선스 필터 | argumentative | C2 | CC BY-NC-SA 다수 | CC BY-NC-ND · CC BY-NC-SA |
| D | commonlit | 0 | 1페이지(하한) | html | 라이선스 확인 후 결정 | expository | B1-B2 | 가입 필요 · 자료별 상이 | "All rights reserved" |
| D | readworks | 0 | 1페이지(하한) | html | 비개방 파이프라인 (표시 전용 · 문항 0) | expository | B1-B2 | 가입 필요 · ©  | — |
| D | khan_academy | 0 | 1페이지(하한) | html | 비개방 파이프라인 (표시 전용 · 문항 0) | expository | B1-B2 | CC BY-NC-SA 4.0 | — |
| D | unep | 0 | 1페이지(하한) | html | 라이선스 확인 후 결정 | expository | B2 | UN 저작물 | — |
| D | unesco_courier | 0 | 1페이지(하한) | html | 개방 파이프라인 (문항 변형 가능) | argumentative | B2-C1 | CC BY-SA 3.0 IGO | — |
| D | jep_aea | 0 | 1페이지(하한) | html | 비개방 파이프라인 (표시 전용 · 문항 0) | argumentative | C1-C2 | CC BY-NC 4.0 | "All rights reserved" |
| D | doe_science | 0 | 1페이지(하한) | html | 개방 파이프라인 (문항 변형 가능) | expository | B2-C1 | PD (미 연방정부) | — |
| D | nsf | 0 | 1페이지(하한) | html | 개방 파이프라인 (문항 변형 가능) | expository | B2-C1 | PD (미 연방정부) | — |
| D | fed_education | 0 | 1페이지(하한) | html | 라이선스 확인 후 결정 | expository | B2 | 미 연방기관 — PD 추정(확인 필요) | — |
| D | scholarpedia | 0 | 1페이지(하한) | html | 비개방 파이프라인 (표시 전용 · 문항 0) | expository | C2 | CC BY-NC-SA 3.0 | CC BY-NC-SA · CC BY |
| D | who_factsheets | 0 | 1페이지(하한) | html | 비개방 파이프라인 (표시 전용 · 문항 0) | expository | B2 | CC BY-NC-SA 3.0 IGO | — |
| D | bartleby | 0 | 1페이지(하한) | html | 개방 파이프라인 + 편당 라이선스 필터 | argumentative | C1-C2 | 본문 PD · 사이트 © 혼재 | — |
| D | perseus | 0 | 1페이지(하한) | html | 개방 파이프라인 (문항 변형 가능) | argumentative | C2 | CC BY-SA 3.0 | — |

## E — 지금은 불가

| 등급 | 소스 | 실측 상류 | 센 것 | 열거 | 파이프라인 | register | 밴드 | 라이선스 주장 | 근거(실측) |
|---|---|---:|---|---|---|---|---|---|---|
| E | openalex | 124,316,544 | 총량 | index | 개방 파이프라인 + 편당 라이선스 필터 | expository | C2 | 메타데이터 CC0 | — |
| E | internet_archive | 52,244,306 | 총량 | index | 개방 파이프라인 + 편당 라이선스 필터 | expository | C1-C2 | 항목별 | — |
| E | doaj | 13,597,046 | 총량 | index | 개방 파이프라인 + 편당 라이선스 필터 | expository | C2 | 논문별 CC 표기 | — |
| E | ck12 | 3 | 1페이지(하한) | dead | 비개방 파이프라인 (표시 전용 · 문항 0) | expository | B1-B2 | CC BY-NC 3.0 | — |
| E | oxford_academic_oa | 0 | 1페이지(하한) | blocked | 개방 파이프라인 + 편당 라이선스 필터 | argumentative | C1-C2 | CC BY / CC BY-NC-ND 혼재 | — |
| E | stanford_news | 0 | 1페이지(하한) | blocked | 비개방 파이프라인 (표시 전용 · 문항 0) | expository | B2-C1 | © 전부 유보 추정 | — |
| E | lse_press | 0 | 1페이지(하한) | blocked | 개방 파이프라인 (문항 변형 가능) | argumentative | C1-C2 | CC BY 4.0 주장 | — |
| E | ucl_press | 0 | 1페이지(하한) | blocked | 개방 파이프라인 (문항 변형 가능) | argumentative | C1-C2 | CC BY 주장 | — |
| E | ubiquity_press | 0 | 1페이지(하한) | blocked | 개방 파이프라인 (문항 변형 가능) | argumentative | C1-C2 | CC BY | — |
| E | bccampus | 0 | 1페이지(하한) | blocked | 개방 파이프라인 + 편당 라이선스 필터 | expository | B2-C1 | CC BY 다수 | — |
| E | arxiv | 0 | 1페이지(하한) | excluded | 비개방 파이프라인 (표시 전용 · 문항 0) | expository | C2 | 저자 선택(대부분 비CC arXiv 라이선스) | — |
| E | obp | 0 | 1페이지(하한) | blocked | 개방 파이프라인 + 편당 라이선스 필터 | argumentative | C1-C2 | CC BY / CC BY-NC 혼재 | — |
| E | mit_press_oa | 0 | 1페이지(하한) | blocked | 개방 파이프라인 + 편당 라이선스 필터 | argumentative | C1-C2 | CC BY-NC-ND 다수 | — |
| E | cogent_oa | 0 | 1페이지(하한) | blocked | 개방 파이프라인 (문항 변형 가능) | expository | C1-C2 | CC BY | — |
| E | osf_preprints | 0 | 1페이지(하한) | dead | 개방 파이프라인 + 편당 라이선스 필터 | expository | C1-C2 | 저자 선택 (CC BY 다수 · 미지정도 있음) | — |
| E | ssrn | 0 | 1페이지(하한) | blocked | 비개방 파이프라인 (표시 전용 · 문항 0) | expository | C1-C2 | 저자 유보 다수 (© ) | — |
| E | openstax | 0 | 1페이지(하한) | dead | 개방 파이프라인 (문항 변형 가능) | expository | B2-C1 | CC BY 4.0 | — |
| E | pressbooks_directory | 0 | 1페이지(하한) | blocked | 개방 파이프라인 + 편당 라이선스 필터 | expository | B2-C1 | 책별 CC | — |
| E | philarchive | 0 | 1페이지(하한) | blocked | 개방 파이프라인 + 편당 라이선스 필터 | argumentative | C2 | 저자 유보 다수 | — |
| E | oecd | 0 | 1페이지(하한) | blocked | 비개방 파이프라인 (표시 전용 · 문항 0) | expository | C1 | CC BY-NC-ND 4.0 (iLibrary 다수) | — |
| E | knowable | 0 | 1페이지(하한) | blocked | 비개방 파이프라인 (표시 전용 · 문항 0) | argumentative | C1 | CC BY-ND 4.0 | — |
| E | rsos | 0 | 1페이지(하한) | blocked | 개방 파이프라인 (문항 변형 가능) | expository | C2 | CC BY 4.0 | — |
| E | loc_blogs | 0 | 1페이지(하한) | blocked | 개방 파이프라인 + 편당 라이선스 필터 | argumentative | B2-C1 | PD 다수 (게시물별 확인) | — |
| E | census_bls | 0 | 1페이지(하한) | dead | 개방 파이프라인 (문항 변형 가능) | expository | B2-C1 | PD (미 연방정부) | — |
| E | citizendium | 0 | 1페이지(하한) | blocked | 개방 파이프라인 (문항 변형 가능) | expository | C1 | CC BY-SA 3.0 | — |
| E | encyclopedia_of_earth | 0 | 1페이지(하한) | blocked | 개방 파이프라인 (문항 변형 가능) | expository | C1 | CC BY-SA 주장 | — |
| E | ● wikinews | 0 | 1페이지(하한) | dead | 개방 파이프라인 (문항 변형 가능) | news | B1-B2 | CC BY 2.5 | — |
| E | poetry_foundation | 0 | 1페이지(하한) | excluded | 비개방 파이프라인 (표시 전용 · 문항 0) | poetry | C2 | ©  | — |
| E | ● storyweaver | 0 | 1페이지(하한) | dead | 개방 파이프라인 (문항 변형 가능) | narrative | A1-B1 | CC BY 4.0 | — |
| E | hathitrust | 0 | 1페이지(하한) | blocked | 비개방 파이프라인 (표시 전용 · 문항 0) | expository | C2 | 본문 접근 제한 | — |
