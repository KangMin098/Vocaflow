# S047 `/scriptquiz` — 읽은 것 확인하기 (ScriptQuiz 대기열)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "책을 읽고 며칠 지났을 때, 읽은 챕터 중 아직 확인 안 한 것 하나를 골라 주면 바로 이해를 점검하고 싶다"
- 주 사용자: 학생 · 인지 계층: L5 정복(`docs/MODULES.md:27`)

## 흐름
- 진입: 사이드바(`components/layout/sidebar-config.ts:248`) · /hub-lab · /text/[id]/comic · /about · 세션 닫기(`components/layout/SessionFrame.tsx:45`)
- 단계: 1. 제목 + "읽은 N챕터 · 확인 안 한 M개" 2. 다음 한 걸음 카드(며칠 전에 읽었나) 3. 확인 시작 — 또는 책 행 펼쳐 챕터 칩 선택
- 완료 조건: `/scriptquiz/play?book=&ch=` 이동 — **템플릿 문자열이라 정적 그래프에 안 잡힘**(`components/game/scriptquiz/ScriptQuizQueue.tsx:53`)
- 1차 행동: 「확인 시작」(`ScriptQuizQueue.tsx:143-150`) — 하나만 제시 · 보조: 책 행 펼치기, 한국어 번역 토글(`:90-112`)
- 나가는 길: /scriptquiz/play · /library/books

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 3갈래: 다 확인함 / 읽은 것 없음 / 퀴즈 자체 없음(`ScriptQuizQueue.tsx:156-177`) | ○ 각각 읽으러 가기·책 고르기·샘플 체험 링크 |
| 로딩 | 전역만 | `app/loading.tsx` | — |
| 오류 | 부분 | 조회 실패 → 빈 상태로 degrade + console.warn(`app/(main)/scriptquiz/page.tsx:42-45`) — 화면에는 "읽은 챕터가 없어요"로 보여 실패와 빈 상태가 구별 안 됨 | ✗ 다시 시도 없음 |
| 부분 | 있음 | 안 읽은 챕터는 숨기고 "빼 뒀어요" 명시(`ScriptQuizQueue.tsx:236`) | ○ 다음 읽을 챕터 링크(`:275-285`) |
| 완료 | 해당 없음 | — | — |

## 자산
- N1 자산: `library_chapter_quiz` + 읽은 시각(간격) — 역할: **숫자·문장**("N일 전에 읽었어요" `:31-41`). FSRS 와 결합 없음(`docs/design/00-form-seeds.md` 계보 축 코드 0)
- 형태 씨앗: 없음 — G1 「계보」 축의 자리인데 비어 있음
- 학습과학 원칙: #2 Spaced(사이를 둔 인출 카피 `:139-141`) · #6 Cognitive Load(한 걸음만)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 30–36px 세리프 제목 → 흰 카드 1장(책 제목·챕터·문항 수·버튼) → 책 행 목록(접힘)
- 골격 판정: **카드 목록**(단일 카드 + 아코디언). 모듈 허브 중 유일하게 ModuleHero 를 쓰지 않아 공유 골격에서 벗어남(`:57-58` 주석)
- 평균 신호(정적): 1 (float-hover 1 — 버튼 translate)

## 근거
- `apps/web/src/app/(main)/scriptquiz/page.tsx:3-5` — 129챕터 전량 나열 → 읽은 것만 대기열로 재설계 이력
- `apps/web/src/components/game/scriptquiz/ScriptQuizQueue.tsx:176` — 「샘플 체험」은 params 없는 /scriptquiz/play → 목업 세션(`ScriptQuiz.tsx:70`)
