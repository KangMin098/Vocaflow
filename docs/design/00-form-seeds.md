# 00 — 형태 씨앗 (Form Seeds)

> 2026-09-18 인벤토리. **이 제품만 그릴 수 있는 형태가 이미 저장소 어디에 있는가.**
> vocaflow-design §G(형태 발명)의 G1 축은 새로 지어낸 것이 아니라 여기 있는 것을 골격으로 승격한 것이다.
> 경로는 전부 존재 검사를 통과했다(`ls` 실측). 수치는 각 파일 머리 주석이 적은 실측을 옮겼다.

## 판정 기준

씨앗 = **N1 자산(R(t) · 커버리지 · CSAT 코퍼스 · FSRS 상태 · 사전 빈도) 없이는 그릴 수 없는 형태**.
자산을 *숫자로 표시만* 하는 곳(카드 안 카운트)은 씨앗이 아니다 — 형태가 데이터에서 나와야 한다.

## 씨앗 목록

| # | 씨앗 | G1 축 | 형태 | 코드 | 쓰이는 화면 | 골격인가 |
|---|---|---|---|---|---|---|
| S1 | **망각 곡선 7일** | 망각 | R(t) 를 앞으로 7일 풀어 "버티는 단어 수" 선. 내려가는 만큼이 잃을 양 | `apps/web/src/components/layout/MemorySparkline.tsx` (R(t) 는 `apps/web/src/lib/srs/fsrs.ts`) | 사이드바 길잡이 `WayfinderPanel` | ❌ 곁가지 — 사이드바 패널 안의 작은 선 |
| S2 | **DecayUnderline — 밑줄 두께 = 망각도** | 망각 | risk 3px · shaky 2px · stable 1px · new 2px dotted | `apps/web/src/components/ui/press/index.tsx` | 홈 `components/home/TodayStage.tsx` · `NextWordsStrip.tsx` | △ 단어 줄 단위 — 화면 골격까지는 아님 |
| S3 | **채색 지문 + 레벨 슬라이더** | 채색 지문 | 지문 위 아는/모르는 단어가 칠해지고 레벨을 움직이면 색·숫자가 함께 변한다(8레벨 사전 계산) | `apps/web/src/components/marketing/CoverageHero.tsx` (계산 `apps/web/src/lib/textfit/coverage.ts` · 데모 `apps/web/src/lib/marketing/hero-demo.ts`) | 랜딩 `app/page.tsx` 히어로 | ✅ **유일하게 골격인 씨앗** — 첫 시선이 곧 이 형태 |
| S4 | **적합도 눈금 + 고스트 마커** | 채색 지문 × 망각 | 커버리지 눈금 위 현재 위치와 "복습을 미루면 갈 자리"를 고스트로 | `apps/web/src/components/textfit/TextFitVerdict.tsx` | 추출 패널 `components/text-extract/ExtractionPanel.tsx` | △ 카드 안 눈금 |
| S5 | **주묵 관계 선 — 지지/배제/유인/합류** | 주묵 문법 | 실선+화살표=지지 · 점선+막대=배제 · 점선+화살표=유인 · 연결선+`=`=합류 | `apps/web/src/components/csat/session/visual-analysis.module.css` · `apps/web/src/components/csat/PassageMap.tsx` · 모델 `apps/web/src/lib/csat/passage-map-model.ts` | `/csat` 분석 워크벤치 · 패턴 비교 · 관리자 `app/admin/kice/item/[slug]` | ✅ CSAT 분석 화면의 골격 |
| S6 | **기록 지도 ○•✓↻** | 주묵 문법 | 탐색 전 ○/점선 · 살펴봄 •/실선 · 공식 보관 ✓/이중선 · 재확인 ↻/라벨 | `apps/web/src/components/csat/session/visual-analysis.module.css` | `/csat` 세션 | △ 보조 지도 |
| S7 | **비교 판면 — 두 소재 → 한 공식** | 주묵 문법 × 시험지 사물 | CSS Grid + 괘선으로 두 문항을 나란히, 공식으로 합류 | `apps/web/src/components/csat/session/learning-home.module.css` · `SessionHome.tsx` | `/csat` 홈 | ✅ |
| S8 | **기억이 버티는 시간 사다리** | 환경 변형 | 단어가 버티는 기간별 층 — "0개" 대신 사다리 위 위치 | `apps/web/src/components/dashboard/DurabilityLadder.tsx` | `/dashboard` 히어로 | △ 히어로 자리지만 형태는 막대 층 |
| S9 | **어휘의 무게중심** | 환경 변형 | `shared_dictionary.frequency_rank` 위 내 단어들의 분포·중심 | `apps/web/src/components/dashboard/LexicalReach.tsx` | `/dashboard` | ❌ 카드 하나 |
| S10 | **Memory Decay 4색 · 나침반 띠** | 망각 | 4색 합계 띠(risk·shaky 는 「다시 볼」로 합산) | `apps/web/src/components/layout/CompassRibbon.tsx` · 이름 `apps/web/src/lib/framework/memory-labels.ts` | 전역 상단 띠 | ❌ 색 막대 — 형태보다 표지 |

`var(--memory-*)` 를 쓰는 학습자 `.tsx` 는 34개(2026-09-18 grep) — 4색은 **어디에나 있지만 대부분 점·칩**이다.

## 비어 있는 축 (씨앗 0)

| G1 축 | 상태 |
|---|---|
| **계보** (오답 → 다음 문항 사슬, 챕터 퀴즈 × FSRS) | 코드 0. `library_chapter_quiz` 는 ScriptQuiz(`app/(main)/scriptquiz/`)가 읽지만 FSRS 상태와 결합하지 않는다(grep `fsrs|memory|stability` 0) — §C 렌즈 5 가 이름만 있다 |
| **서가가 차오른다** (Implicit Progress 의 원형) | 코드 0. 매대 격자(`BooksExplorer`)는 **남의 책**을 진열할 뿐 내 서가가 변형되지 않는다 |
| **시험지 사물** (2단 격자 · 문항 번호 · 출제자 펜 · 정오표 · 바를 정 회독) | S7 이 가장 가깝다. 시험지의 물성을 골격으로 쓴 화면은 없다 |

## 읽는 법 — 무엇이 문제였나

씨앗 10개 중 **화면의 골격인 것은 3개(S3 · S5 · S7)**, 나머지 7개는 사이드바·카드·띠 안에 갇혀 있다.
자산은 이미 형태를 갖고 있는데 화면의 첫 시선은 카드 목록·표가 차지한다 — 이것이 "규정 위반 없는 평범한 화면"의 구조적 원인이다.
§G2 의 골격 선언은 **S1 · S2 · S4 · S8 을 곁가지에서 골격으로 끌어올리는 일**부터 시작한다(예: 복습 화면의 첫 시선 = S1 곡선).
