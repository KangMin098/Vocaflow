# S028 `/hub` — Today 관문 (오늘의 단어 무대 + 오늘의 흐름)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "앱을 열었을 때, 오늘 무엇을 배우고 지금 무엇부터 할지 3초에 알고 싶다, 그래서 바로 시작한다"
- 주 사용자: 학생(가입 직후 포함) · 인지 계층: L 없음(forward 오케스트레이터 — LEARNING_MODEL L7 행 주석)

## 흐름
- 진입: 가입 후 `DEFAULT_LANDING` · 사이드바 Today(`components/layout/sidebar-config.ts:111`) · /dashboard·/reports·/diagnostic 복귀 등 9화면
- **D7 활성화 경로 ①·②** — 가입→/hub, 미진단이면 TodayFocus 1차 CTA가 /diagnostic(`app/__tests__/activation-path.test.ts` ①②)
- 단계: 1. GatewayLead 복귀 인사(조건부) 2. TodayStage 단어+흐름 3. TodayReading 4. NextWordsStrip 5. (계획 있으면 TodayPlanCard / 미진단이면 TodayFocus)
- 완료 조건: 처방 5블록이 모두 done → "오늘 분량은 다 했어요" 문장
- 1차 행동: StartNow 하나("이 단어부터 시작"/"지금 시작") · 보조: 흐름의 남은 블록 건너뛰기, 읽을거리 선택
- 나가는 길: /flashcard/play·/text/[id]/echo·/practice/dcp·/scriptquiz(today-blocks) · /library/books/[id] · /wordvault · /plan · /diagnostic · /library

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 부분 | 단어·블록 모두 없으면 무대 null `components/home/TodayStage.tsx:92`; 미진단은 맛보기 단어+진단 CTA `TodayFocus.tsx:47-112` | 미진단 ○(/diagnostic·/library). 진단완료+처방 0 → 화면이 거의 비는 경로 있음(추정) |
| 로딩 | 전역만 | `app/loading.tsx` (라우트 전용 없음) | — |
| 오류 | 부분 | 처방 계산 실패 고지 `TodayStage.tsx:174-182`; 그 외 throw → `app/error.tsx` | 기본 흐름을 대신 보여줌 |
| 부분 | 있음 | 각 블록이 자기 빈 상태에서 스스로 사라짐 `NextWordsStrip.tsx:38` · `TodayReading.tsx:47` · `TodayPlanCard.tsx:24` | — |
| 완료 | 있음 | "오늘 분량은 다 했어요. 여기서 멈춰도 괜찮아요." `TodayStage.tsx:160` | 없음(멈춤 허용 — Calm 의도) |

## 자산
- N1 자산: FSRS 밀림(overdue) + 사전(뜻·예문·CEFR) + 처방 — 역할: **골격(부분)** — 표제어 60px + DecayUnderline 이 첫 시선(`TodayStage.tsx:115-135`). 단 망각 형태는 한 줄 밑줄뿐
- 형태 씨앗: S2 DecayUnderline(`@form: 망각`, `app/(main)/hub/page.tsx:2`) · 시각대별 지면 톤 `components/home/room-tone.ts:30-44`(환경 변형 성격)
- 학습과학 원칙: #1 Active Recall(복습 직행) · #2 Spaced Repetition(밀린 단어) · #4 Dual Coding · #5 Context(예문) · #6 Cognitive Load(단일 CTA)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 좌 단어(표제어·품사·CEFR·"n일 밀림" 밑줄·뜻·예문) + 우 "오늘의 흐름" 5블록 세로 목록(lg 2열 `TodayStage.tsx:99`)
- 골격 판정: G1 **망각**(약) — 실제 형태는 "사전 표제 지면 + 체크리스트". 곡선/감쇠 형태는 없음
- 평균 신호(정적): 3 (shadow-heavy 1 · float-hover 2). TodayFocus 는 `shadow-ios-2` 카드 + 좌측 3px 액센트 바(`TodayFocus.tsx:42-44`)

## 근거
- `apps/web/src/app/(main)/hub/page.tsx:58-122` — 3분기(계획/처방/미진단) 정본
- `apps/web/src/components/home/TodayStage.tsx:87` — 복습 블록일 때만 단어가 CTA 재료
- `apps/web/src/components/home/TodayFocus.tsx:13-21` — 가입→첫 학습 중앙값 55일 근거로 "지면 먼저"
