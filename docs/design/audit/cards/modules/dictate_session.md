# S062 `/dictate/session` — 받아쓰기 진행 (듣고 적고 채점)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "한 문장씩 들을 때, 적고 나서 어디를 놓쳤는지·내 단어를 잡았는지 바로 보고 다음 문장으로 가고 싶다"
- 주 사용자: 학생 · 인지 계층: L6 완성(자유 재생산)

## 흐름
- 진입: /dictate(`components/dictation/DictationHubClient.tsx:103,152`) · /dictate/setup(`DictationSetupClient.tsx:212`) · SessionFrame 「단계」 콤보(`components/layout/SessionFrame.tsx:80` — sessionId 없이 오면 not-found 추정)
- 단계: 1. 재생(자동 반복) 2. 입력 3. 제출 → 단어별 채점 칩·정답·내 단어 ✓/↻ 4. 다음 — 힌트·Focus 모드 선택
- 완료 조건: 마지막 문항 후 `router.replace('/dictate/results')`(`components/dictation/DictationSessionClient.tsx:148-152`)
- 1차 행동: 재생 → 제출/다음(키보드 포함 `:235-269`) · 보조: 힌트, Focus(`:397-410`), 음성 내려받기(`:449-457`)
- 나가는 길: /dictate/results · /dictate(나가기 `:366-377`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 세션 못 찾음(`DictationSessionClient.tsx:299-326`) · 이미 마친 세션(`:274-296`) | ○ 받아쓰기로 돌아가기 / 결과 보기 |
| 로딩 | 있음 | Suspense(`app/(main)/dictate/session/page.tsx:12-17`) · "불러오는 중..."(`:328-334`) · 음성 준비 중(`:430`) | — |
| 오류 | 부분 | 영어 음성 없음 경고 + 대안(`:440-460`) — 세션 저장 실패 UI 는 이 파일에서 확인 못 함(추정: 훅 내부) | ○ |
| 부분 | 있음 | 진행률 `n / N`(`:383-394`) · SessionFrame 진행도 주입(`:132-145`) | — |
| 완료 | 위임 | 결과 화면으로 이동 | — |

## 자산
- N1 자산: 문항의 타깃 단어(FSRS 복습 대상) — 역할: **칩**(✓/↻ `:754-775`) · 재도전 전후 % 비교(`:731-750`)
- 형태 씨앗: 없음(✓·↻ 기호는 S6 기록 지도와 같은 문자지만 지도 형태는 아님)
- 학습과학 원칙: #1 Free Recall · #4 Dual Coding(청각+철자) · #7 Empathetic 비교 카피(`:744-749`)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 나가기·자료명·얇은 진행 바·Focus → 그라디언트 오디오 카드(56px 원형 재생 `:462-470`) → 입력창
- 골격 판정: **카드 목록**(오디오 카드 · 입력 · 결과 카드 세로). 채점 칩 줄(`WordChip :858-859`)이 가장 고유한 형태
- 모션: 진행률 바 width 300ms ○ · Focus 모드 배경 transition-colors 300ms + 사이드 aside opacity(`:347-361`) △ 목록 밖 · 재생 버튼 `active:scale-95`(`:466`) △ 목록 밖 · 정답 scale/오답 shake **없음** — 결과는 모션 없이 카드 교체
- 평균 신호(정적): 11 (gradient 7 — 진행 바·재생 버튼·버튼들 `linear-gradient` · float-hover 4)

## 근거
- `apps/web/src/components/dictation/DictationSessionClient.tsx:703-716` — 결과 섹션 `role=status` + sr-only 요약(색·숫자에만 기대지 않음)
- `apps/web/src/components/dictation/DictationSessionClient.tsx:388` — 진행 바도 하드코딩 그라디언트 `#1D4ED8`
