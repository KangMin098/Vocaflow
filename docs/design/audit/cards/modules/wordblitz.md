# S056 `/wordblitz` — WordBlitz 허브 (속사 게임 대기실)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "짧게 한 판 하기 전에, 내 어떤 단어로 노는지 보고 바로 시작하고 싶다"
- 주 사용자: 학생 · 인지 계층: L4a 자동화(`docs/MODULES.md:25`)

## 흐름
- 진입: /practice 만(정적 그래프) — 사이드바 없음
- 단계: 1. 히어로 한 줄 + 「바로 시작」 2. 「이번 판 단어」 칩 6개 3. (접힘) 이 게임이 뭘 하는지 4. 기록 5. 하단 「지금 한 판」
- 완료 조건: `/play/wordblitz` 이동
- 1차 행동: 「바로 시작」(`app/(main)/wordblitz/page.tsx:140-148`) — **같은 href 의 두 번째 CTA**「지금 한 판」(`:324-330`, `--ju` 채움·`shadow-md`)가 더 크다
- 나가는 길: /play/wordblitz · /library/books(풀 부족 시, `components/hub/GamePoolPanel.tsx:82`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 풀 < 6 → "단어가 6개 이상 필요해요" + 읽으러 가기(`GamePoolPanel.tsx:77-88`) · 기록 0 → 한 줄(`wordblitz/page.tsx:267-270`) | ○ 풀 부족은 /library/books. 단 「바로 시작」은 그대로 활성(게임이 거절 — `app/(app)/play/wordblitz/page.tsx:108`) |
| 로딩 | 전역만 | `app/loading.tsx` | — |
| 오류 | 부분 | 보유 수 count 오류는 0 으로 삼킴(`wordblitz/page.tsx:77`) — AGENTS.md「count ?? 0」 금지와 같은 계열 | ✗ |
| 부분 | 비로그인 | 빈 배열로 렌더(`:79`), 로그인 유도 없음 | ✗ |
| 완료 | 해당 없음 | — | — |

## 자산
- N1 자산: FSRS 복습 임박순 풀(`lib/game/due-words` via `:71`) — 역할: **칩**(단어 알약 6개, `GamePoolPanel.tsx:55-69`)
- 형태 씨앗: 없음
- 학습과학 원칙: #7 Emotional Encoding(카피 `:217`) · #1 Active Recall(설명 카드 속 주장)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: quiet 히어로 행(`:100-149`) → 단어 알약 패널 → 접힌 summary 한 줄 → 기록 카드 2장(`lg:grid-cols-3`, `:272`)
- 골격 판정: **카드 목록**. **공유 골격 ★** /pairflip 과 같은 "hero 행 + GamePoolPanel + `<details>` 학습효과/규칙 3단 카드" — 문구 "이 게임이 뭘 하는지"·「3단계」 규칙 `sm:grid-cols-3`까지 동일(`wordblitz/page.tsx:189-263` vs `components/pairflip/PairFlipHub.tsx:121-209`). ModuleHero 를 안 쓰고 같은 모양을 손으로 복제(`:102` 주석)
- 평균 신호(정적): 4 (grid-3eq 3 — 규칙·기록 3열 · gradient 1)

## 근거
- `apps/web/src/app/(main)/wordblitz/page.tsx:5-11` — 가짜 기록(1410점·콤보) 제거 이력
- `apps/web/src/app/(main)/wordblitz/page.tsx:117` — 부제 "정글 어드벤처" — 학습 내용이 아니라 테마 이름
