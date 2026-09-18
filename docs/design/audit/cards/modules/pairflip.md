# S041 `/pairflip` — PairFlip 허브 (짝맞추기 대기실)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "짝맞추기 한 판 전에, 어떤 단어로 노는지 보고 난이도·모드를 골라 시작하고 싶다"
- 주 사용자: 학생 · 인지 계층: L4a 공간기억(`docs/MODULES.md:26`)

## 흐름
- 진입: /practice · /pairflip/results · /pairflip/play(설정 없을 때 되돌림 `app/(main)/pairflip/play/page.tsx:68-70`) · 세션 닫기(`components/layout/SessionFrame.tsx:47`)
- 단계: 1. quiet 히어로(Best·최고 콤보·게임 수) 2. 이번 판 단어 3. (접힘) 설명 4. 난이도 5. 매칭 모드 6. 시작하기
- 완료 조건: config 를 sessionStorage 에 쓰고 `/pairflip/play`(`components/pairflip/PairFlipHub.tsx:72-80`)
- 1차 행동: 「시작하기」(`PairFlipHub.tsx:247-265`) · 보조: 난이도·모드 선택기
- 나가는 길: /pairflip/play · /library/books(풀 부족)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 풀 < 4 → 문장 + /library/books(`components/hub/GamePoolPanel.tsx:77-88`) · 첫 판 문구(`PairFlipHub.tsx:67-70`) | △ 링크는 있으나 **「시작하기」는 막히지 않고** play 가 MOCK_PAIRS 로 폴백(`hooks/usePairFlipSession.ts:45`) — 화면이 "못 만든다"고 말한 판이 목업 단어로 열린다 |
| 로딩 | 전역만 | `app/loading.tsx` | — |
| 오류 | 부분 | 보유 수 count 오류 → 0(`app/(main)/pairflip/page.tsx:42`) | ✗ |
| 부분 | 비로그인 | STATS_ZERO + 빈 풀(`pairflip/page.tsx:44`) — Best 0점 표시(`PairFlipHub.tsx:94-99`, '—' 처리 없음) | ✗ |
| 완료 | 해당 없음 | — | — |

## 자산
- N1 자산: FSRS 임박 페어(`lib/pairflip/due-pairs` via `pairflip/page.tsx:36`) — 역할: **칩**(단어 알약)
- 형태 씨앗: 없음
- 학습과학 원칙: 카드가 주장만 함(재인·공간·작업기억 `PairFlipHub.tsx:40-44`) — 화면이 원칙을 수행하지는 않음

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: quiet 히어로 → 단어 알약 → summary 한 줄 → 「시작 설정」 카드(난이도 칩 줄 + 모드 칩 줄 + 네이비 그라디언트 풀폭 버튼)
- 골격 판정: **카드 목록 + 폼**. **공유 골격 ★** /wordblitz 와 동형(`app/(main)/wordblitz/page.tsx:189-263`), 히어로는 /flashcard·/spellforge·/dictate 와 같은 `ModuleHero`(`PairFlipHub.tsx:85`)
- 평균 신호(정적): 11 (gradient 5 — CTA `PairFlipHub.tsx:253` · float-hover 3 · grid-3eq 2 · shadow-heavy 1 — CTA 3중 box-shadow `:255`)

## 근거
- `apps/web/src/components/pairflip/PairFlipHub.tsx:2-9` — "다른 hub 들과 동일 구조" 가 목표로 명시됨(평균화가 설계 의도)
- `apps/web/src/components/pairflip/PairFlipHub.tsx:200-206` — 마스코트가 규칙 카드 안 장식
