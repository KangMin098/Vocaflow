# S064 `/pairflip/play` — PairFlip 판 (카드 뒤집어 짝 찾기)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "영단어와 뜻 카드를 뒤집어 위치를 기억하며 짝을 맞추고, 시간 안에 다 맞춰 보고 싶다"
- 주 사용자: 학생 · 인지 계층: L4a 공간기억

## 흐름
- 진입: /pairflip 시작(`components/pairflip/PairFlipHub.tsx:79`) · 계획 launch `?set=`/`?text=`(`app/(main)/pairflip/play/page.tsx:44-58`) · 결과 「한 번 더」 · SessionFrame 단계 콤보(`components/layout/SessionFrame.tsx:77`)
- 단계: 1. (config 없으면 허브로 replace `:68-70`) 2. 카드 격자 뒤집기 3. 짝 → 매칭/불일치 피드백 4. 힌트 5. 다 맞추면 1.4s 뒤 결과
- 완료 조건: 전 짝 매칭 → FSRS push+flush(`components/pairflip/PairFlipGameScreen.tsx:58-71`) → `/pairflip/results`(`:109-111`)
- 1차 행동: 카드 탭 · 보조: 힌트(HUD)
- 나가는 길: /pairflip/results · SessionFrame 닫기 → /pairflip(`SessionFrame.tsx:47`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | **목업으로 덮음** | 비로그인·풀 부족·조회 실패 모두 `setPairs([])`(`pairflip/play/page.tsx:53-55,81-88`) → MOCK_PAIRS 로 판을 연다(`hooks/usePairFlipSession.ts:45`) — 화면 알림 없음 | ✗ 학습자는 남의 단어로 논 줄 모른다(점수는 기록 `mockFallback` 메타만 `PairFlipGameScreen.tsx:100`) |
| 로딩 | 있음 | "세션을 준비하고 있어요" 스피너(`pairflip/play/page.tsx:93-99`) | — |
| 오류 | 없음 | 위 목업 폴백이 오류를 삼킴 | ✗ |
| 부분 | 있음 | 중도 이탈 시 부분 점수·FSRS flush(`PairFlipGameScreen.tsx:131-161`) · 진행 주입(`:163-176`) | — |
| 완료 | 위임 | 결과 화면 | — |

## 자산
- N1 자산: FSRS 임박 페어(`lib/pairflip/due-pairs`) — 역할: **없음**(판 위에 기억 상태·출처 표시 0; 셸 라벨 "내 단어 자산" `:170-171`)
- 형태 씨앗: 없음
- 학습과학 원칙: #7 Emotional(콤보·마스코트) · 공간기억 — 원칙 1–7 중 #1 인출은 약함(재인만)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 하드코딩 크림 그라디언트 전면(`PairFlipGameScreen.tsx:206-211`) + HUD(시간·점수·콤보·힌트) + 카드 격자 + 우하단 고정 마스코트(`:231-233`)
- 골격 판정: **격자**(메모리 게임 관습) — G1 축 없음
- 모션: 카드 뒤집기 rotateY ○(`PairFlipCard.tsx:70`) · 불일치 shake ○(`:55,210`) · 진행 바 ○(`PairFlipProgress.tsx:22`) · **대기 카드 `pf-card-idle` 4s infinite**(`PairFlipCard.tsx:59,257-258`) ✗ 루프 · 마스코트 bob/clap/zzz infinite(`PairFlipMascot.tsx:169-178`) ✗ 루프 · 타이머 `pf-pulse` infinite(`PairFlipHUD.tsx:90-102`) ✗ · 매칭 팝 scale 1.15 + 콤보 문구 32px(`PairFlipFeedback.tsx:53,77,98-126`) △ · 콤보≥3 **SparkleParticles**(`:95,133-160`) ✗ 폭죽류 · 매칭 카드 회전 scale 1.08(`PairFlipCard.tsx:228-241`) ✗ — 학습 모듈이라 아케이드 예외 아님(`components/__tests__/learning-tone.test.ts:18-24`), 테스트는 무한 루프를 검사하지 않음
- 평균 신호(정적): 20 (gradient 16 · glass 2 · shadow-heavy 1 · float-hover 1) — `style jsx` 안 infinite 는 신호 0 으로 누락

## 근거
- `apps/web/src/components/pairflip/PairFlipGameScreen.tsx:32-37` — "부족하면 hook 이 mock 폴백" 설계 주석
