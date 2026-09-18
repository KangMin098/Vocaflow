# S025 `/dictate/results` — 받아쓰기 결과 (오늘 무엇이 남았나)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "받아쓰기를 마쳤을 때, 점수보다 어떤 단어가 복습에 반영됐고 청취 폭이 늘었는지 보고, 같은 자료로 한 번 더 하거나 쉬고 싶다"
- 주 사용자: 학생 · 인지 계층: L6 완성(회고)

## 흐름
- 진입: /dictate/session 완주 replace(`components/dictation/DictationSessionClient.tsx:150`) · 이미 마친 세션(`:287`) · /dictate 최근 목록 「결과」(`components/dictation/DictationHubClient.tsx:253`)
- 단계: 1. 히어로(60px 정확도 %, 격려 문구) 2. 복습에 반영된 단어 ✓/↻ 3. 청취 폭 4. 문항별 목록 5. CTA 3개
- 완료 조건: 다음 행동 선택
- 1차 행동: **「통계」→ /dashboard**(유일한 채움 그라디언트 버튼, `components/dictation/DictationResultsClient.tsx:369-377`) · 보조: 한 번 더(`:355-361` → `/dictate/setup?text=` 템플릿 `:389`, 정적 그래프 누락), 받아쓰기 홈
- 나가는 길: /dashboard · /dictate/setup · /dictate

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 내 단어 0 → 설명 + 자료 고르기(`DictationResultsClient.tsx:208-221`) · sessionId 없음 → /dictate replace(`:50-52`) | ○ |
| 로딩 | 있음 | Suspense(`app/(main)/dictate/results/page.tsx:12-16`) · 스피너(`:104-120`) | — |
| 오류 | 있음 | 기록 못 찾음 → 안내 + /dictate(`:123-150`) | ○ |
| 부분 | 해당 없음 | 적재는 세션 끝에서 이미 완료(`:9-10`) | — |
| 완료 | 이 화면 자체 | 밴드별 아이콘·격려(`:160-165`) — 폭죽·트로피 없음 | ○ 3 CTA |

## 자산
- N1 자산: FSRS 반영 단어(맞힘=간격↑, 놓침=곧 다시 `:244-245`) · 청취 폭 — 역할: **칩·숫자**
- 형태 씨앗: 없음
- 학습과학 원칙: #2 Spaced(반영 설명) · #7 Emotional(밴드 문구 "천천히 가도 괜찮아요") · Implicit Progress 는 주석뿐(`:249` "게이지 대신 숫자 한 줄")

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: `rounded-2xl` 파란 그라디언트 히어로(`:171-174`, `shadow-md`) 중앙 60px % + `grid-cols-3` 통계(`:192`) → 2열 카드
- 골격 판정: **카드 목록 + 점수 히어로**. **공유 골격 ★** "큰 점수 + 3칸 통계" 결과 틀이 /pairflip/results(`components/pairflip/PairFlipResultScreen.tsx:49,59-78`) · /scriptquiz/play 결과(`components/game/scriptquiz/ScriptQuiz.tsx:859-898`)와 같다 — 헤더 주석은 "몇 점?이 아니다"(`:12`)라면서 첫 시선은 %
- 평균 신호(정적): 9 (gradient 5 · grid-3eq 2 · float-hover 2)

## 근거
- `apps/web/src/components/dictation/DictationResultsClient.tsx:5-8` — localStorage → DB 전환(공유·타기기 결과 유지)
- `apps/web/src/components/dictation/DictationResultsClient.tsx:178-183` — h1 누락 실측 후 보정 주석
