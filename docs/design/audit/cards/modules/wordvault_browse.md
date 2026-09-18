# S058 `/wordvault/browse` — WordVault 둘러보기 (내 단어 목록·듣기)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "모은 단어를 훑어볼 때, 기억 상태·자료·수준으로 거르고 소리로 듣다가 흔들리는 묶음으로 바로 학습에 들어가고 싶다"
- 주 사용자: 학생 · 인지 계층: L3 능동 부호화

## 흐름
- 진입: /wordvault CTA·세그먼트(`components/wordvault/hub/VaultIdentity.tsx:57-72`, `WordVaultHubChrome.tsx:41`) · 도서 워크스페이스 `?filter=set:&book=&chapter=`(`app/(main)/wordvault/browse/page.tsx:4-7`) · Flashcard 완료 「어려웠던 단어」 `?q=`(`components/flashcard/CompletionState.tsx:96`) · 풀스크린 세션 라우트(`lib/layout/full-screen-routes.ts:61`)
- 단계: 1. 도구 판면(기억 필터 바·자료 칩/챕터 바·듣기 패널·검색/수준/정렬·가리기) 2. 괘선 「단어 N개」 3. 목록 행 선택·재생
- 완료 조건: 없음(탐색 화면) — 전환은 「이 단어로 학습 시작」
- 1차 행동: 기억 필터가 걸렸을 때만 학습 진입 링크(`components/wordvault/MemoryFilterBar.tsx:77-78` `/wordvault/study?filter=`) — 필터 없으면 명시적 1차 없음 · 보조: 듣기 재생, 검색
- 나가는 길: /wordvault/study · /text/[id] · /library/books/[bookId] · SessionFrame 닫기 → /wordvault(`components/layout/SessionFrame.tsx:48`) · 단계 콤보 6모듈(`:75-80`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 보유 0 → EmptyAll(`components/wordvault/WordVaultBrowseClient.tsx:413-438`) | ○ 공용 단어장 / 내 스크립트 — 단 버튼 `h-10`=40px(`:426,432`) < 44px |
| 로딩 | 전역만 | 서버 조회(`browse/page.tsx:45-49`) | — |
| 오류 | 없음 | 조회 실패 분기 없음 → `app/error.tsx` | 전역 |
| 부분 | 있음 | 필터 결과 0 → "이 필터에 해당하는 단어가 없어요"(`WordVaultBrowseClient.tsx:391-394`) | ✗ 필터 지우기 등 다음 행동 없음 |
| 완료 | 해당 없음 | — | — |

## 자산
- N1 자산: R(t) 상태(`lib/srs/state.ts:55` getMemoryState) — 역할: **칩보다 약함**: 행 왼쪽 1px 세로선 opacity .5(`components/wordvault/WordRow.tsx:73-80`) · 필터 바 문장
- 형태 씨앗: 정적 도구의 S2 는 오탐 — `Rule` import(`WordVaultBrowseClient.tsx:21`), 밑줄 두께=망각도 미사용
- 학습과학 원칙: #4 Dual Coding(듣기) · #1(가리기 토글로 자가 인출 `HideToggleBar`) · #2(상태 필터)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 최대 1200px 폭 한 테두리 판면 안 괘선으로 나뉜 도구 4–5줄(`:306-380`) → 괘선 → 8열 행 표(`WordRow.tsx:82`)
- 골격 판정: **표**(단어 행 목록). 도구를 한 판면으로 합친 v07 개선(`:290-305`)은 있으나 첫 단어는 여전히 도구 아래
- 평균 신호(정적): 13 (shadow-heavy 3 · gradient 3 · rounded-big 2 · ai-purple 2 · infinite-anim 2 — 재생 중 `soft-pulse`·`pulse-dot`(`ListenPanel.tsx:129,148`) · glass 1)

## 근거
- `apps/web/src/components/wordvault/WordVaultBrowseClient.tsx:292-297` — 390px 에서 첫 단어 전 카드 5장·5,154px 실측 기록
