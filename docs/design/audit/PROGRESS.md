# UX 감사 진행 기록

## 실행 — 화면 재설계 (2026-09-19~, 이 절이 최신)

> 지시: verdict 의 평균·경계 화면을 priority 순서로 한 화면씩 "서명 있음" 으로(질문 없이 B4 로 선택, 판단은 [DECISIONS](../DECISIONS.md) DD-22~).
> 작업 환경: worktree `D:/workspace/Vocaflow-screen-redesign`(브랜치 `feat/screen-redesign`) · dev 서버 `:3100`(`node --env-file=<메인>/apps/web/.env.local …/next dev -p 3100`) · 캡처 `test:design screens`(`/hub` 등록) · 계측 [tools/measure-screen.mjs](tools/measure-screen.mjs)(감사와 같은 정규식·같은 DOM 계수).
> 잠금: `AGENT_LOCK_FILE=<worktree>/.agent-lock node <메인>/agents/scripts/lock.mjs acquire|release claude` — `agents/` 가 미추적이라 worktree 에 스크립트가 없다.

| 순위 | 화면 | 상태 | 선택안 | 평균 신호(정적 · 렌더 390 카드형) | 기록 |
|--:|---|---|---|---|---|
| 1 | `/fit` | 완료(앞 세션) | A+B | — | [golden/fit.md](../golden/fit.md) · DD-19 |
| 2 | `/hub` | **완료** 2026-09-19 | A 「들어 올리는 곡선」(망각) | 3→**1** · 2→**0** | [compare/hub.md](../compare/hub.md) · [golden/hub.md](../golden/hub.md) · DD-22 |
| 3 | `/diagnostic` | **완료** 2026-09-19 | A 「답할수록 칠해지는 지문」(채색 지문) | 6→**1** · 4→**0** | [compare/diagnostic.md](../compare/diagnostic.md) · [golden/diagnostic.md](../golden/diagnostic.md) · DD-23 |
| 4 | `/flashcard/play` | **다음** | — | — | [briefs/flashcard_play.md](briefs/flashcard_play.md) |
| 5–10 | `/fit/s` · `/signup` · `/text/[id]` · `/wordvault/review` · 회고 · `/text/new` | 대기 | — | — | priority.md |

- **보류**: 없음.
- **라쳇**: average-signal learner `float-hover` 66→**65**(`/hub` — `TodayPlanCard` 칩) · `gradient` 171→**169** · `glass` 52→**50**(`/diagnostic`). form-declaration 무선언 목록 −1(`/diagnostic`). `/hub` 선언은 렌더와 일치하게 정정.
- **승인 대기 마이그레이션**: `supabase/migrations/_pending_funnel_allow_hub_curve.sql`(관측 `hub_curve_interacted`).
- **이 세션이 만난 기존 결함(범위 밖)**: 타입 오류 3(kice item · csat reveal) · 전체 vitest 실패 10(관리자 터치 타깃 78>70 · OFFSET 페이징 190→200 · `.limit` 1000 초과 · 학습자 라우트 매니페스트 textbooks · CSAT 드레인 경로 · 저작권 경계 · `wired.test` CRLF) — 전부 이 세션이 건드리지 않은 파일. DECISIONS DD-22 뒤 목록.

---


> 생성 2026-09-18 · Claude Code. 새 세션은 **이 파일부터** 읽고, 완료된 게이트는 다시 하지 않는다.
> 지시: "전체 화면 UX 감사 + 혁신 설계 준비"(코드·토큰·스킬 수정 0, 시안 0). **최종 상태: 전 게이트 완료.**

## 작업 환경 — 왜 worktree 인가

- 메인 워크트리(`D:/workspace/Vocaflow`, `pc2-20260720-1`)는 2026-09-18 22:43 부터 **Codex 가 잠금 보유**(pid 20676, 실행 중 확인).
  규약상 남의 잠금이면 그 워크트리에서 쓰지 않는다 → 산출물은 **worktree `D:/workspace/Vocaflow-ux-audit`(브랜치 `feat/ux-audit`)** 에 쓰고 커밋했다.
  이 세션은 메인 워크트리의 잠금을 **잡지 않았다**(Codex 소유) — 풀 잠금도 없다.
- 분석 **입력**은 메인 워크트리의 현재 코드(미커밋 변경 포함)를 **읽기만** 했다. 감사 대상은 "지금 화면" 이기 때문이다.
- 캡처는 메인 워크트리에서 떠 있던 dev 서버(`http://localhost:3000`)를 찍었다. 스크린샷·세션 파일은 worktree 의
  `apps/web/test-results/ux-audit/`(gitignore) 에만 있다 — 저장소에 올리지 않았다(A4).
- 기존 검증 세션(`.auth-csat-learner.json`)은 만료 → 저장소 픽스처의 검증 계정으로 1회 로그인해 새 세션을 만들었다.

## 게이트 상태

| 게이트 | 상태 | 산출물 | 메모 |
|---|---|---|---|
| 0 화면 전수 | **완료** | [screens.json](screens.json) · [screens.md](screens.md) | 157 = 대상 127 + 제외 30(redirect 5 · 게임 21 · 개발 4). ROUTES.md 대비 코드에만 27 · 문서에만 7 |
| 1 연결 | **완료** | [flows.md](flows.md) | 여정 4 · 고아/막다른 · 퍼널(**표본 부족** — 계정 3) · 통합 후보 |
| 2 UX 카드 | **완료** | [cards/](cards/) | 카드 67(공개 14 · 허브 12 · 읽기 5 · CSAT 3 · 모듈 18 · 라이브러리 15) + 관리자 압축 표 60. 헤더 검사 67/67 통과, 40줄 초과 0 |
| 3 평균 판정 | **완료** | [verdict.md](verdict.md) | 127 = 서명 있음 **2**(`/` · `/csat`) · 경계 5(관리자) · 평균 **104** · 보류 14 · 경유 2 |
| 4 참고 자료 | **완료** | [references-additions.md](references-additions.md) | Mobbin 403 · Page Flows 유료 · Figma MCP 미연결 · NN/g · Baymard · Laws of UX 열람 |
| 5 브리프·우선순위 | **완료** | [priority.md](priority.md) · [briefs/](briefs/) | 상위 10 = /fit · /hub · /diagnostic · /flashcard/play · /fit/s · /signup · /text/[id] · /wordvault/review · 회고 · /text/new |

## 서브에이전트 배정 (실행 기록)

| 단계 | 영역 | 결과 |
|---|---|---|
| Gate 2 카드 | public · home · reading+csat · modules · library · admin(표) | 6개 전부 완료. home 의 `reports.md` 는 하네스가 서브에이전트의 파일 쓰기를 막아(파일 이름) 메인이 저장 |
| Gate 3 판정 | public · home · reading+csat · modules · library · admin ×2 | 7개 전부 완료 — 판정 행은 텍스트로 받아 메인이 verdict.md 로 합침. 2차 캡처 5화면은 메인이 직접 판정 |

## FAIL · 미해결

| 항목 | 원인 | 재현 · 조치 |
|---|---|---|
| `/fit` 의 `@form` 선언이 코드와 다르다 | 2026-09-18 앞선 세션(Claude)이 "붙여 넣은 지문이 칠해지고 고스트가 선다" 로 적었으나 입력은 무채색 textarea(`PublicFitClient.tsx:227`), 고스트는 import 안 하는 `TextFitVerdict` 에만 | 선언을 고치거나 화면을 선언대로 — 사용자 결정(A1 로 코드 수정 안 함). `/hub` · `/dashboard` · `/text/[id]` 도 같은 불일치(verdict.md) |
| 동적 param 샘플 없음 — 관리자 상세 8 | 부모 화면에 `<a>` 자식 링크가 없다(클릭 핸들러 이동 추정) | `tools/capture.mjs` 에 `override` 로 DB 샘플을 넣어 재실행(2차 캡처 방식) |
| 상태 의존 4 — `/dictate/results` · `/dictate/setup` · `/pairflip/play` · `/pairflip/results` | 직접 진입 시 허브로 되돌림(설계) | 세션을 실제로 진행한 뒤 캡처해야 한다 — 코드 추정으로만 판정 |
| `/fit/s` · `/join` 정상 상태 미캡처 | 유효 payload 없음 / 실제 코드는 가입 부작용(DD-16) | 유효 payload 는 `/fit` 공유 버튼으로 생성 · join 은 전용 테스트 학급 필요 |
| dev 서버 중단 1회(22:5x 무렵) | 원인 미상 — 90초 뒤 복구(재시작 주체 미확인) | 연결 거부 항목만 지우고 재실행. 결과 파일 경쟁 쓰기(1차 프로세스 종료 시 덮어씀)를 재실행으로 복구 |
| 데이터가 찬 상태의 본 골격 미판정 | 검증 계정 단어 8 · 텍스트 1(DB) | 데이터 있는 계정으로 재캡처 필요 — 판정은 "찍힌 상태" 기준으로 명시 |
| 원격 push 안 함 | 커밋과 push 를 한 명령으로 묶었다가 자동 권한 분류기가 거부 | 로컬 커밋만. `git push -u origin feat/ux-audit` 는 사용자가 결정 |

## 잠금 해제 후 메인 워크트리에 옮길 것

1. `references-additions.md` 의 두 표 → `docs/design/references.md` 끝.
2. `DECISIONS-additions.md` → `docs/design/DECISIONS.md`(DD-13~18 + 보강 + 사용자 결정 대기).
3. `docs/CHANGELOG.md` Unreleased 한 줄:
   `- UX 감사(설계 준비) — 화면 157 전수·대상 127 판정(서명 2·경계 5·평균 104·보류 14), 여정 4·카드 67·관리자 표 60·브리프 10·우선순위(docs/design/audit/, 브랜치 feat/ux-audit). 코드 수정 0.`

## 재현

스크립트는 `tools/` 에 있다(각 파일 머리에 사용법). 순서:
`inventory.mjs <메인>/apps/web > screens.raw.json` → (링크 그래프 사본으로 `edges.json`) → `screen-graph.mjs` → `gate0-write.mjs` → `login.mjs` → `capture.mjs`.
링크 그래프 사본은 저장소의 `scripts/audit/learner-linkgraph.mjs` 에 **출력 경로만 환경변수로 바꾸고 파일별 간선(EDGES)을 내보내는 3줄**을 더한 것이다(저장소 result.json 을 덮지 않기 위해).
