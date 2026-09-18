# S066 `/spellforge/play` — SpellForge 세션 (뜻 보고 철자 쓰기)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "흔들리는 단어를, 뜻과 첫 단서만 보고 철자를 직접 쳐서 손에 익히고 틀린 글자를 바로 알고 싶다"
- 주 사용자: 학생 · 인지 계층: L4b 시각생성(Generation Effect)

## 흐름
- 진입: /spellforge(`?limit=`) · 계획 launch(`?set=`/`?text=`) · /flashcard/play·/scriptquiz/play·/wordvault/browse 의 SessionFrame 단계 콤보(`components/layout/SessionFrame.tsx:78`)
- 단계: 1. 뜻·발음(MeaningDisplay) 2. 모드(실시간·지연·블라인드 `components/spellforge/SpellForge.tsx:455`) 3. 슬롯/단일칸 입력 4. 확인 5. 반성 힌트 6. 다음 — 주기적 MicroPause
- 완료 조건: 전 단어 → SpellForgeCompletion(`SpellForge.tsx:406-417`)
- 1차 행동: 철자 입력 + 확인(`ConfirmButton` `:502`) · 보조: 힌트, 발음, 모드 전환
- 나가는 길: 우상단 ✕ → backHref(`SpellForge.tsx:432-440`) · 완료 후 backHref

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 비로그인·큐 0·스코프 0(`app/(main)/spellforge/play/page.tsx:75,79,82,108-`) · 컴포넌트 내부 "학습할 단어가 없어요"(`SpellForge.tsx:398-404`, 링크 없음 ✗) | ○ 페이지 단 / ✗ 컴포넌트 단 |
| 로딩 | 전역만 | `app/loading.tsx` | — |
| 오류 | 없음 | 조회 실패 분기 없음(`spellforge/play/page.tsx:81`) | 전역 |
| 부분 | 있음 | 진행 `n / N`(`SpellForge.tsx:547`) · IME 한글 감지 표시(`:428-430`) | — |
| 완료 | 있음 | ⚡ + "오늘의 학습이 완료됐어요" + 3칸(`SpellForgeCompletion.tsx:57-70`) | ○ backHref |

## 자산
- N1 자산: FSRS 큐(급한 순) + 힌트→등급 하향(허브 카피 근거 `app/(main)/spellforge/SpellForgeHubClient.tsx:112-115`) — 역할: **없음**(세션 화면에 기억 상태 표시 0, grep `memory` 0)
- 형태 씨앗: 없음
- 학습과학 원칙: #1 Active Recall(생성) · #3 Desirable Difficulty(블라인드 모드) · #4 Dual Coding(발음)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: `--reading-bg` 전면, 중앙 720px 열: 뜻 → 모드 칩 → 글자 슬롯 → 확인 버튼. IME 표시가 `fixed left-[260px]`(`:427`) — 사이드바 없는 풀스크린에서 좌측 여백 가정(추정 위치 어긋남)
- 골격 판정: **폼**(입력 슬롯 중심). 완료 화면은 **공유 골격 ★** Flashcard 와 글자·크기까지 동일(`SpellForgeCompletion.tsx:57,63,70` vs `components/flashcard/CompletionState.tsx:63,69,77`). 빈 상태 `HubEmpty` 도 flashcard/play 와 복제(`spellforge/play/page.tsx:108` vs `app/(main)/flashcard/play/page.tsx:106`)
- 모션: 정답 `correct-pop` scale 1.15(`InputSlots.tsx:64`, `app/globals.css:926`) ○(1.05 기준 초과) · 오답 `error-shake`(`InputSlots.tsx:68`) ○ · 커서 `cursor-blink`/`caret-blink` infinite(`InputSlots.tsx:80,96`) △ 포커스 표시로 볼 수 있으나 끝나지 않음 · 발음 `animate-pulse`(`MeaningDisplay.tsx:75`) △ · `success-glow`·`hint-flash` 1.5s·`gentle-bounce`(`InputSlots.tsx:27,54`, `ReflectionHint.tsx:16`) ✗ 목록 밖 · 완료 `celebrate` 1s 회전(`SpellForgeCompletion.tsx:57`) ✗
- 평균 신호(정적): 11 (gradient 4 · infinite-anim 2 · float-hover 2 · grid-3eq 1 · ai-purple 1 · glass 1)

## 근거
- `apps/web/src/components/spellforge/SpellForge.tsx:115-118` — body `studying` 클래스로 사이드바 dim(`app/globals.css:884-885`)
