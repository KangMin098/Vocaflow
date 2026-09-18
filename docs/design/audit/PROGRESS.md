# UX 감사 진행 기록

> 생성 2026-09-18 · Claude Code. 새 세션은 **이 파일부터** 읽고, 완료된 게이트는 다시 하지 않는다.
> 지시: "전체 화면 UX 감사 + 혁신 설계 준비"(코드·토큰·스킬 수정 0, 시안 0).

## 작업 환경 — 왜 worktree 인가

- 메인 워크트리(`D:/workspace/Vocaflow`, `pc2-20260720-1`)는 2026-09-18 22:43 부터 **Codex 가 잠금 보유**(pid 20676, 실행 중 확인).
  규약상 남의 잠금이면 그 워크트리에서 쓰지 않는다 → 산출물은 **worktree `D:/workspace/Vocaflow-ux-audit`(브랜치 `feat/ux-audit`)** 에 쓰고 커밋한다.
- 분석 **입력**은 메인 워크트리의 현재 코드(미커밋 변경 포함)를 **읽기만** 한다. 감사 대상은 "지금 화면" 이기 때문이다.
- 캡처는 메인 워크트리에서 이미 떠 있던 dev 서버(`http://localhost:3000`)를 찍는다. 스크린샷·세션 파일은 worktree 의
  `apps/web/test-results/ux-audit/`(gitignore) 에만 있다 — 저장소에 올리지 않는다(A4).
- 기존 검증 세션(`.auth-csat-learner.json`)은 만료돼 `/login` 으로 튕겼다 → 저장소 픽스처(`tests/e2e/fixtures/test-user.ts`)의 검증 계정으로 1회 로그인해 새 세션을 만들었다.

## 게이트 상태

| 게이트 | 상태 | 산출물 | 메모 |
|---|---|---|---|
| 0 화면 전수 | **완료** | [screens.json](screens.json) · [screens.md](screens.md) | 157 = 대상 127 + 제외 30. 로그인 필요 여부는 캡처(Gate 3) 결과로 채운다 |
| 1 연결 | **완료** | [flows.md](flows.md) | 여정 4 · 고아/막다른 · 퍼널(표본 부족) · 통합 후보. 여정 ③ 모듈 세부는 cards/modules |
| 2 UX 카드 | 진행 | cards/ | public 14 · home 12 · reading 5 · csat 3 · library 15 · admin 표 60 완료. modules 18 진행 중 |
| 3 평균 판정 | 캡처 진행 중 | verdict.md | 화면당 약 50초(dev 서버 첫 컴파일) |
| 4 참고 자료 | **완료** | [references-additions.md](references-additions.md) | references.md 는 메인 워크트리의 미추적 파일(다른 세션) — 잠금 해제 후 합친다. Mobbin 403 · Page Flows 유료 · Figma MCP 미연결 |
| 5 브리프·우선순위 | 대기 | briefs/ · priority.md | |

## 서브에이전트 배정 (Gate 2 · 3)

| 영역 | 화면 수 | 쓰기 허용 폴더 |
|---|---|---|
| public | 14 | `cards/public/` |
| home (허브·대시보드·계획·설정·교사·진단·연습) | 12 | `cards/home/` |
| reading + csat | 5 + 3 | `cards/reading/` · `cards/csat/` |
| modules (플래시카드·페어플립·스펠포지·스크립트퀴즈·받아쓰기·워드블리츠·단어금고) | 18 | `cards/modules/` |
| library (도서·스크립트·교재·단어장·만화·영상·내 서재) | 15 | `cards/library/` |
| admin | 60 | `cards/admin/` (압축 표) |

화면 ID 목록은 `screens.json` 의 `area` 필드. 서브에이전트는 git · lock · DECISIONS 를 만지지 않는다(A8).

## FAIL · 미해결

| 항목 | 원인 | 재현 |
|---|---|---|
| `/fit` 의 `@form` 선언이 코드와 다르다 | 2026-09-18 앞선 세션(Claude)이 "붙여 넣은 지문이 칠해지고 고스트가 선다" 로 적었으나 입력은 무채색 textarea(`components/textfit/PublicFitClient.tsx:227`), 고스트는 `TextFitVerdict` 에만 있고 /fit 은 그것을 import 하지 않는다 | 선언을 사실대로 고치거나 화면을 선언대로 만든다 — 사용자 결정. 이 감사는 코드를 고치지 않는다(A1) |
| (Gate 3 에서 채움) | | |

## 재현

스크립트는 세션 scratchpad 에 있었다(저장소 밖). 같은 결과를 다시 만들려면 이 디렉터리의 `tools/` 사본을 쓴다:
`node tools/inventory.mjs <메인>/apps/web` → `tools/screen-graph.mjs` → `tools/capture.mjs`. 각 파일 머리에 사용법이 있다.
