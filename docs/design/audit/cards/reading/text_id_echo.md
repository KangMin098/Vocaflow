# S067 `/text/[id]/echo` — EchoMatch 따라읽기

> 생성 2026-09-18 · Claude Opus 5 (서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "읽은 문장을 소리 내 따라 할 때, 원어민 억양과 내 억양이 어디서 다른지 보고 싶다, 그래서 문장마다 다시 해 본다"
- 주 사용자: 학생 · 인지 계층: L4c (청각·발화)

## 흐름
- 진입: **사실상 고아.** 템플릿 링크 grep 결과 `/hub-lab` 변형 `hub-lab/_variants/VariantA.tsx:112` 하나뿐. 읽기 모드 알약에 echo 없음(`ModePills.tsx:28-44`, shadow 는 같은 페이지 `?mode=shadow` `:133`). 레지스트리에만 존재 `lib/framework/registry.ts:230-232`
- 단계: 1. 마이크 허용(`EchoMatchPlayer.tsx:351-357`) 2. 시작 → 듣기 → 녹음 → 비교 → 점수(`:552-610`) 3. 다음 문장(`:526-532`)
- 완료 조건: 명시적 완료 없음 — 마지막 문장에서 「다음」 disabled(`:528`), 세션 마감은 떠날 때 `finalizeEchoSession`(`:347`)
- 1차 행동: 「시작」(주묵 `--ju` 채움 `EchoMatchPlayer.tsx:560-566`) · 보조: 다시 · 이전/다음
- 나가는 길: 「본문으로」 `echo/page.tsx:140-146` · `/dictate`(미지원 `EchoMatchPlayer.tsx:424` · 마이크 거부 `MicPermissionGate.tsx:72`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | ○ | 「연습할 문장이 없어요. 본문을 확인해주세요.」 `EchoMatchPlayer.tsx:360-368` | △ 링크 없음(위 「본문으로」만 `echo/page.tsx:140`) |
| 로딩 | ○ | 음성 모델 다운로드 진행률 `EchoMatchPlayer.tsx:430-460` · 듣기/비교 스피너 `:569-610` | — |
| 오류 | ○ | 오류 패널 + 종류별 복구 `EchoMatchPlayer.tsx:390-430` · 마이크 게이트 오류 `:353-356` | ✓ 다시 시도 · `/dictate` |
| 부분 | ○ | 단어 인식률 낮으면 안내 `EchoMatchPlayer.tsx:493-500` | — |
| 완료 | ✗ | 완료 화면 없음(`:528` 다음 비활성으로 끝) | ✗ |

## 자산
- N1 자산: 없음(골격 기준). 음높이 곡선(`PitchVisualizer` `EchoMatchPlayer.tsx:487-489`)은 학습자 음성 vs TTS 로 그리며 R(t)·커버리지·사전과 무관. 발음 기록은 남기지만 FSRS 는 안 건드린다(`registry.ts:241-243`, `EchoMatchPlayer.tsx:289-296`)
- 형태 씨앗: 없음
- 학습과학 원칙: #4 Dual Coding(소리+곡선) · #3 Desirable Difficulty(따라 말하기)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 「본문으로」 + 마이크 허용 게이트(첫 진입, `MicPermissionGate.tsx:25`) → 허용 후 책 맥락 줄 + 모델 진행 + 문장 카드 + 「① Listen → ② Repeat → ③ Compare → ④ Score」 카드(`EchoMatchPlayer.tsx:552-567`)
- 골격 판정(코드 추정): **단계 카드 세로 스택** — 평균. 음높이 곡선은 점수 뒤에만 나온다
- 평균 신호(정적, 자기 트리): 3 (infinite-anim 2 — `pulse-soft` 무한 `:448`(로더, 허용) · `:589`(녹음 표시, 녹음 끝나면 사라짐 — 허용 추정) · grid-3eq 1)
- 서버 page 에 디버그 `console.log` 다수(`echo/page.tsx:41,44,65,97,132`)

## 근거
- `apps/web/src/app/(main)/text/[id]/echo/page.tsx:117-131` — sentence_offsets 우선, 없으면 분할
