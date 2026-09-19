# S063 `/flashcard/play` — Flashcard 세션 (떠올리기 → 뒤집기 → FSRS 평가)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "복습할 때, 뜻을 먼저 머릿속으로 떠올려 본 뒤 뒤집어 확인하고 정직하게 평가해 다음 간격을 받고 싶다"
- 주 사용자: 학생 · 인지 계층: L4a 재인 + 메타인지

## 흐름
- 진입: /flashcard(`?limit=`) · 워크스페이스 카드 pill(`?set=`/`?text=`) · /wordvault·/library/vocab·/practice 등 30곳 · SessionFrame 단계 콤보(`components/layout/SessionFrame.tsx:75`)
- 단계: 1. recall 게이지(떠올리기, `components/flashcard/RecallPhase.tsx:13-35`) 2. 1차 판단(`FirstJudge`) 3. 뒤집기 4. SRS 4단 평가(`SRSBar.tsx:63-106`) 5. 주기적 MicroPause 6. 완료
- 완료 조건: 큐 소진 → CompletionState(`components/flashcard/FlashcardSession.tsx:236-245`)
- 1차 행동: 평가 4버튼(다음 간격 표시 `formatNextReview` `SRSBar.tsx:79,97`) · 보조: 발음 재생, 키보드
- 나가는 길: SessionFrame 닫기 → backHref(`app/(main)/flashcard/play/page.tsx:39`) · 어려웠던 단어 → /wordvault/browse?q=(`CompletionState.tsx:96`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 비로그인·큐 0(`flashcard/play/page.tsx:82-85,106-128`) · 스코프 0(`:73,130-150`) | ○ 로그인 / 내 단어장으로 |
| 로딩 | 전역만 | 서버 조회 — `app/loading.tsx` | — |
| 오류 | 없음 | 조회 실패 분기 없음(`:84`) → `app/error.tsx` | 전역 |
| 부분 | 있음 | `?limit` 앞에서 자르기(`:35-37`) · ResourceContext 진행 주입(`:90-100`) | — |
| 완료 | 있음 | ✨ + "오늘의 학습이 완료됐어요" + 3칸 통계 + 어려웠던 단어(`CompletionState.tsx:61-120`) | ○ |

## 자산
- N1 자산: FSRS 다음 간격(평가 버튼 아래 작은 글씨) — 역할: **칩·숫자**. R(t) 4색은 카드에 없음. `ForgettingCurve.tsx` 는 **0바이트 빈 파일**(`components/flashcard/ForgettingCurve.tsx`)
- 형태 씨앗: 정적 도구는 S2 로 잡았으나 `ui/press` import(`CardBack.tsx`) 오탐 — DecayUnderline 사용 0
- 학습과학 원칙: #1 Active Recall(recall 게이트) · #2 FSRS 4단(`FlashcardSession.tsx:26-31`) · 메타인지(HonestyHint)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: `--bg2` 위 중앙 380px 카드(`Card.tsx:60`, `rounded-2xl shadow-card`) + 위 recall 게이지 + 아래 `n / N`
- 골격 판정: **단일 카드(플래시카드 관습)** — G1 축 없음
- 모션: 카드 뒤집기 rotateY ○(`Card.tsx:62-64`) · 진행 게이지 ○ · 카드 in/out 스와이프(`Card.tsx:60`, `app/globals.css:902-913` translateX 100vw·rotate 15°) ✗ 목록 밖·이동 16px 초과 · SRSBar 등장 translate-y(`SRSBar.tsx:66-67`) △ · MicroPause 전면 오버레이 페이드(`MicroPause.tsx:19`) △ 학습 중단 오버레이 · 완료 ✨ `celebrate` scale 0→1 + rotate −180°, 1s(`CompletionState.tsx:63`, `globals.css:897-900`) ✗ 배지 팝업류·회전
- 평균 신호(정적): 14 (gradient 6 · glass 2 · infinite-anim 2 · grid-3eq 1 · shadow-heavy 1 · ai-purple 1 · float-hover 1)

## 근거
- `apps/web/src/app/(main)/flashcard/play/page.tsx:94-96` — "오늘 N개" 가 due 가 아니라 급한 순 상한이라 문구 교정
