# S021 `/dashboard` — Growth 회고 (기억이 버티는 시간)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "공부를 돌아볼 때, 내 기억이 얼마나 오래 버티고 이번 주에 무엇을 되찾았는지 알고 싶다, 그래서 계속할 이유를 확인한다"
- 주 사용자: 학생 · 인지 계층: L7 Reflect(`docs/LEARNING_MODEL.md` L7 행, `/dashboard` 단독)

## 흐름
- 진입: 사이드바 Growth(`components/layout/sidebar-config.ts:113`) · /hub·/wordvault·/dictate/results 등 7화면
- D7 활성화 경로 밖(첫 학습 이후 화면)
- 단계: 1. 헤더(날짜+이름) 2. 01 DurabilityLadder 3. 02 RescuedWords + ActivityTrace 4. 03 LexicalReach 5. 04 ManageSection + RecentActivity
- 완료 조건: 없음(읽기 화면) — 닫는 문장 `app/(main)/dashboard/page.tsx:143-150`
- 1차 행동: 명시적 1차 없음 — 가장 강한 CTA 는 RescuedWords 빈 상태의 /flashcard(추정) · 보조: 진단·계획·리포트 3카드
- 나가는 길: /flashcard · /wordvault · /diagnostic · /plan · /reports · /hub · /library

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 사다리 0 → 문장 `components/dashboard/DurabilityLadder.tsx:41-59` · RescuedWords `RescuedWords.tsx:41-47` · RecentActivity `RecentActivity.tsx:139-142` · LexicalReach 소멸 `LexicalReach.tsx:20` | 사다리·최근 활동은 **링크 없음**("첫 학습을 시작해보세요" 텍스트만) ✗ · RescuedWords 만 /flashcard ○ |
| 로딩 | 전역만 | `app/loading.tsx` | — |
| 오류 | 부분 | 최근 활동 실패+다시 시도 `RecentActivity.tsx:85-108`; horizon 조회 실패는 throw(`lib/supabase/paged-select.ts:33`) → `app/error.tsx` 전면 | 전면 오류 화면 |
| 부분 | 있음 | 비로그인 문장 `dashboard/page.tsx:72-80`(로그인 링크 없음 ✗) · horizon null 이면 01–03 통째 생략 `page.tsx:106-134` | — |
| 완료 | 해당 없음 | — | — |

## 자산
- N1 자산: FSRS stability(S) — `lib/learner/memory-horizon.ts:144` · 사전 frequency_rank(LexicalReach) — 역할: **칩·숫자에 가까운 골격** — 히어로가 중앙값 숫자 54px + 12px 누적 막대 한 줄(`DurabilityLadder.tsx:76-104`)
- 형태 씨앗: S8(사다리) · S9(무게중심) · S2 — `@form: 환경 변형`(`page.tsx:2`). 실제 환경(배경·서가)은 변하지 않음
- 학습과학 원칙: #2 Spaced Repetition(S 가시화) · #7 Emotional Encoding(되찾은 단어·격려 문구)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 헤더 + Rule 01 + `shadow-ios-2` 카드 안 큰 숫자·막대·5칸 dl 격자(`DurabilityLadder.tsx:110`)
- 골격 판정: **카드 목록**(번호 괘선 4구획, 카드 6장 이상 동일 `rounded-ios-2xl shadow-ios-2`) — 환경 변형 축은 선언만
- 평균 신호(정적): 5 (grid-3eq 2 — ManageSection `sm:grid-cols-3` `ManageSection.tsx:36` · shadow-heavy 1 · ai-purple 1 · float-hover 1)

## 근거
- `apps/web/src/app/(main)/dashboard/page.tsx:98-103` — "일곱 블록이 같은 무게" 자기진단 후 괘선만 추가
- `apps/web/src/app/(main)/dashboard/layout.tsx:2-6` — 낡은 주석("페이지가 use client") + title '대시보드' vs page 'Growth'(`page.tsx:48`) 불일치
