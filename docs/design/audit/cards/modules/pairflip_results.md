# S042 `/pairflip/results` — PairFlip 결과 (점수 링 + 다음 행동)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "한 판을 끝냈을 때, 몇 짝을 얼마나 빨리 맞췄는지 보고 정확도에 맞는 다음 행동(한 번 더·난이도·다른 모듈)을 고르고 싶다"
- 주 사용자: 학생 · 인지 계층: L4a(회고)

## 흐름
- 진입: /pairflip/play 완주 후 replace 만(`components/pairflip/PairFlipGameScreen.tsx:111`)
- 단계: 1. 마스코트 + 점수 링 + 결과 문구 2. 3칸 통계 3. 맞춘 단어 목록(접힘) 4. 다음 액션 카드 5. PairFlip 홈으로
- 완료 조건: 다음 행동 선택
- 1차 행동: 정확도 분기 다음 액션 첫 항목(≥80: 한 번 더 / ≥40: 한 번 더 / 그 외: Flashcard — `components/pairflip/PairFlipNextActionCard.tsx:8-90`) · 보조: 홈 링크(`PairFlipResultScreen.tsx:94-99`)
- 나가는 길: /pairflip/play · /pairflip · /flashcard · /wordvault

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | sessionStorage 결과 없음 → /pairflip replace(`app/(main)/pairflip/results/page.tsx:24-27`) | ○(자동 이동) |
| 로딩 | 있음 | "결과 불러오는 중..."(`results/page.tsx:31-37`) | — |
| 오류 | 없음 | JSON 파싱 실패도 빈 상태로(`:21-23`) | ○ |
| 부분 | 없음 | 결과는 탭 sessionStorage 에만 — 새 탭·공유 시 소실(`:19`) | — |
| 완료 | 이 화면 자체 | 문구 `getResultCopy`(`PairFlipResultScreen.tsx:25`) · 마스코트 clap/happy/cheer(`:27,48`) | ○ |

## 자산
- N1 자산: 없음 — 결과 저장 `saveLearningRecords` 는 **콘솔 로그 목업**(`lib/pairflip/learning-records.ts:38-47` "Phase 2"). 실제 FSRS 반영은 판에서 이미 flush(`PairFlipGameScreen.tsx:58-71`)되지만 화면은 그 결과(다음 복습)를 말하지 않음
- 형태 씨앗: 정적 도구의 S2 는 오탐 — `SealMark`(`components/ui/press`) import(`PairFlipNextActionCard.tsx:9`), DecayUnderline 아님
- 학습과학 원칙: #7 Emotional(마스코트·문구) · 다음 모듈 연결(재인 → Flashcard)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 크림 그라디언트 전면(`PairFlipResultScreen.tsx:38-44`) · `rounded-2xl shadow-md` 히어로 카드 안 96px 마스코트 + 점수 링(1s stroke transition `PairFlipScoreRing.tsx:60`) → `grid-cols-3` 통계(`:59-78`)
- 골격 판정: **점수 히어로 + 카드 목록** — **공유 골격 ★** 큰 점수 + 3칸 통계 결과 틀(dictate/results `DictationResultsClient.tsx:185-196` · ScriptQuiz 결과 `ScriptQuiz.tsx:859-898`)
- 평균 신호(정적): 6 (grid-3eq 2 · shadow-heavy 2 · gradient 1 · float-hover 1) · 마스코트 clap `infinite`(`PairFlipMascot.tsx:172-175`) 는 신호에서 누락
- 모듈 원색 하드코딩: `#EC4899`·`#F59E0B` 아이콘(`PairFlipResultScreen.tsx:69,74`)

## 근거
- `apps/web/src/components/pairflip/PairFlipResultScreen.tsx:93` — 결과가 sessionStorage 라 스코프/from 유실 → 허브 복귀 주석
