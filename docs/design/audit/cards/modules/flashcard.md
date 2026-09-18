# S027 `/flashcard` — Flashcard 허브 (복습 카드 대기실)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "복습을 시작하기 직전에, 오늘 어떤 상태의 단어가 몇 장 담기는지 보고 길이만 골라 바로 들어가고 싶다"
- 주 사용자: 학생 · 인지 계층: L4a 재인(`docs/MODULES.md:23`)

## 흐름
- 진입: /practice · /dashboard · /pairflip/results · 세션 닫기(`components/layout/SessionFrame.tsx:43` closeHref) — 사이드바 직접 진입 없음(`/practice` 가 흡수, `app/(main)/practice/page.tsx:12-13`)
- 단계: 1. 히어로 한 줄(이번 세션·Overdue·Streak) 2. 오늘의 큐 4버킷 확인 3. 길이 10/20/30/전체 선택 4. 시작하기
- 완료 조건: `/flashcard/play?limit=N` 이동(`app/(main)/flashcard/FlashcardHubClient.tsx:44`)
- 1차 행동: 「시작하기」(`FlashcardHubClient.tsx:104-110`) · 보조: 길이 선택, 「내 자료」 링크(`:98`)
- 나가는 길: /flashcard/play · /text

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 큐 0 → 버튼 disabled + 사유(`FlashcardHubClient.tsx:108-109`), 큐 안내문(`components/hub/TodayQueue.tsx:164-167`) | ✗ — "단어장을 추가하면" 문장뿐, 단어를 모으러 갈 링크 없음(「내 자료」 링크는 extras 안 부차) |
| 로딩 | 전역만 | `app/loading.tsx` (서버 컴포넌트, 자체 스켈레톤 없음) | — |
| 오류 | 없음 | 조회 실패 분기 없음 — `app/(main)/flashcard/page.tsx:43-46` 이 throw 시 `app/error.tsx` | 전역 오류 화면 |
| 부분 | 비로그인 | 비로그인도 빈 큐로 렌더(`flashcard/page.tsx:44`) — 로그인 유도 없음 | ✗ |
| 완료 | 해당 없음 | — | — |

## 자산
- N1 자산: R(t) 4색(`lib/learner/session-queue-query.ts:48` getMemoryState) + FSRS 급한 순 큐 — 역할: **칩·숫자**(8px 누적 막대 + 4칸 숫자 카드, `TodayQueue.tsx:97-161`)
- 형태 씨앗: S10 에 가까운 4색 띠(골격 아님)
- 학습과학 원칙: #2 Spaced Repetition(급한 순) · #6 Cognitive Load(기본 20장, `FlashcardHubClient.tsx:35`)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 테두리 한 줄 히어로(`components/hub/ModuleHero.tsx:74-75` quiet) → 「오늘의 큐」 카드(2×2/4열 숫자 카드) → 「세션 길이」 카드
- 골격 판정: **카드 목록**(세로 3장). **공유 골격 ★** ModuleHero+TodayQueue+HubStartCard 가 /spellforge 와 동일(`app/(main)/spellforge/SpellForgeHubClient.tsx:56-90` vs `FlashcardHubClient.tsx:48-75`) — 모듈 색·문구만 다름
- 평균 신호(정적): 2 (gradient 2 — ModuleHero 의 비-quiet 분기 정의 `ModuleHero.tsx:84`)

## 근거
- `apps/web/src/app/(main)/flashcard/page.tsx:4-18` — 목업(큐·정확도·ContinueRow) 제거 이력, 남은 것은 실측만
- `apps/web/src/components/hub/TodayQueue.tsx:117` — 4버킷 `grid-cols-2 md:grid-cols-4` 균등 칸
