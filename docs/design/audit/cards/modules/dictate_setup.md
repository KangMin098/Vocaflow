# S026 `/dictate/setup` — 받아쓰기 준비 (분량·순서·채점 설정)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "고른 자료로 받아쓰기 전에, 몇 문항·몇 분이고 내 단어가 몇 개 들어 있는지 보고 조건을 맞춰 시작하고 싶다"
- 주 사용자: 학생 · 인지 계층: L6 완성

## 흐름
- 진입: /dictate 자료 탭(`components/dictation/SourcePicker.tsx:150,161,172` — `?text=`/`?set=` 템플릿) · /hub-lab · 결과 「한 번 더」(`components/dictation/DictationResultsClient.tsx:389`)
- 단계: 1. 미리보기 3칸(문항·분·복습 이어질 단어) 2. 분량(1~3문장) 3. 문항 수 4. 순서 5. 채점 6. (접힘) 고급 7. 시작
- 완료 조건: 세션 생성 → `/dictate/session?sessionId=`(`components/dictation/DictationSetupClient.tsx:212`)
- 1차 행동: 하단 시작 버튼(`DictationSetupClient.tsx:552`) · 보조: 설정 7종(`:89-97`)
- 나가는 길: /dictate/session · /dictate(뒤로 `:314-320`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 파라미터 없음(`DictationSetupClient.tsx:218-233`) · 자료 없음/붙여넣기 소실(`:280-292`) · 문장 0(`:294-306`) | ○ 모두 /dictate 로 돌아가기 |
| 로딩 | 있음 | Suspense fallback(`app/(main)/dictate/setup/page.tsx:12-18`) · loadState 스피너(`:235-248`) | — |
| 오류 | 있음 | 로드 실패 alert(`:250-278`) · 시작 실패 사유(`:538-545`) | ○ |
| 부분 | 있음 | 청취 폭으로 문장 밴드 우선 선택 설명(`:361-365`) | — |
| 완료 | 해당 없음 | — | — |

## 자산
- N1 자산: 내 단어(FSRS) 포함 수 · 청취 폭(span) · CEFR 추천 분량(`:373`) — 역할: **숫자**(미리보기 3칸 `:337-351`)
- 형태 씨앗: 없음
- 학습과학 원칙: #6 Cognitive Load(분량 1~3) · #3 Desirable Difficulty(섞기 "더 어렵게" `:446`) · #2(복습 간격 늘어남 카피 `:355-356`)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 뒤로 버튼 + 자료 제목 → 그라디언트 카드 안 숫자 3칸(`grid-cols-3` `:337`) → 파란 안내 띠 → 분량 3칸 버튼
- 골격 판정: **폼**(버튼 격자 4묶음: 3열·4열·2열·2열 `:370,408,429,455`) — 설정이 화면의 주인, 문장 자체는 보이지 않음
- 평균 신호(정적): 7 (gradient 3 · grid-3eq 2 · float-hover 2)

## 근거
- `apps/web/src/components/dictation/DictationSetupClient.tsx:105-110` — 네트워크 실패 시 'loading' 에 갇히던 결함 수정 주석
- `apps/web/src/components/dictation/DictationSetupClient.tsx:382` — 선택 칸 `shadow-[var(--sh-sm)]`
