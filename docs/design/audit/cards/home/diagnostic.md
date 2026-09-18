# S022 `/diagnostic` — 어휘 진단 (V-Level 측정 → 추천 세트 직행)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "처음 시작할 때, 몇 분 안에 내 어휘 수준을 알고 싶다, 그래서 맞는 단어장으로 바로 첫 학습을 한다"
- 주 사용자: 학생(신규·재진단) · 인지 계층: 없음(L0 앞 배치 단계 — 추정)

## 흐름
- 진입: /hub TodayFocus CTA(`components/home/TodayFocus.tsx:103`) · 사이드바 Growth 소관(`sidebar-config.ts:119`) · /dashboard·/library/* 등 9화면
- **D7 활성화 경로 ③** — 추천 세트 구독 후 /flashcard/play 직행(`components/diagnostic/DiagnosticClient.tsx:517-535`)
- 단계(phase `DiagnosticClient.tsx:31`): 1. start — 추천 진단 히어로 + 목표별 보조 2. question — 단어별 모른다/안다(`:858,864`) 3. submitting 4. results — 레벨·평가·맞춤 단어장·관심사
- 완료 조건: results 에서 「…」 담고 첫 카드 학습 시작(`:1112`)
- 1차 행동: start=「진단 시작」, results=「담고 첫 카드 학습 시작」 · 보조: 이어서 하기, 기록 보기, 안내 모달
- 나가는 길: /flashcard/play · /hub(실패·추천 없음) · /diagnostic/history · /library/vocab#set-

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | "사용 가능한 진단이 없어요." `DiagnosticClient.tsx:763` | ✗ 링크·행동 없음 |
| 로딩 | 있음 | 목록 로딩 `:758-761` · 제출 중 스피너 `:799-806` | — |
| 오류 | 있음 | 같은 답으로 재제출 `:552-590` | ○ 재제출 + 처음으로 |
| 부분 | 있음 | 하다 만 진단 이어하기(localStorage) `:696-729` | — |
| 완료 | 있음 | 결과 헤더 `:916-918` + 직행 CTA `:1112` | ○ 학습 화면 직행 |

## 자산
- N1 자산: V-Level(VRL 4축) · 추천 세트(shared_word_sets) — 역할: **숫자** — 결과가 72px "V{n}" 한 글자(`:917-918`)
- 형태 씨앗: S2 로 태깅됐으나 이 트리에서 DecayUnderline 사용 확인 못 함(추정: 공용 import) — 형태 선언 없음
- 학습과학 원칙: #3 Desirable Difficulty(i+1 안내) · #6 Cognitive Load(한 문항 한 단어) · #7 Emotional(정답률 아닌 위치 문구)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 제목 "어휘 진단" + `bg-gradient-to-br from-p-dark to-p` 히어로 카드(`:615`) 안 「진단 시작」 + 목표별 카드 목록
- 골격 판정: **그라디언트 히어로 + 카드 목록**(start) / 그라디언트 결과 배너 + 섹션 카드(results `:916`) — G1 축 없음
- 평균 신호(정적): 6 (gradient 2 · glass 2 — `bg-white/15` `:622` · shadow-heavy 1 · float-hover 1 — `hover:scale-[1.01]`)

## 근거
- `apps/web/src/app/(main)/diagnostic/page.tsx:17-23` — 클라이언트 단일 컴포넌트(1,413줄)
- `apps/web/src/app/__tests__/activation-path.test.ts` ③ — startWithRecommendation 이 학습 라우트로 push
