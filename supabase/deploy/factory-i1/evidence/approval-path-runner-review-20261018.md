# Factory I1 러너 승인 창 경로 — 독립 검증 · DB-1 게이트 (2026-10-18)

## 독립 검증 (맥락 없는 Claude 서브에이전트 · 읽기 전용 · 실제 DB 미접속)
- 대상: `0270eefe4` (러너 `deploy.mjs` · `deploy.test.mjs` · 패키지 §8)
- 판정: **ACCEPT_WITH_LIMITS**
- 점검 7항목 모두 통과
  1. 비TTY 차단 순서: 자동실행/CI/isolated → SHA → 정본 파일 → 티켓 소비. 앞 단계에서 막히면 티켓이 타지 않는다.
  2. TTY 경로 불변.
  3. 자동 실행 계열은 두 모드 모두 차단.
  4. 난수가 로그·이력에 남지 않는다.
  5. 접속 문자열을 어디서 읽어도 `targetOf`·TLS 검사가 그대로 돈다.
  6. Windows 경로 비교에서 잘못 받아들이는 경우가 없다.
  7. DB-2 의 DB-1 선행 조건 유지.
- P3(받아들임): 접속 전에 티켓을 소비하므로 `--deps` 누락 등으로 실패하면 승인 창을 다시 받아야 한다. 안전한 쪽(fail-closed)이다.
- 재실행 결과: `deploy.test.mjs` 10/10 · `agents/scripts/__tests__` 150/150 · 격리 PostgreSQL 17.10 배포 절차 47/47 · `deploy.mjs check` OK. DB-1 `061a48a8…c624` · DB-2 `2165015d…896b` 불변.
- PR #287 리뷰 기록: `docs/research/db-approval-287-review/ACCEPTANCE.md` (REWORK 2회 → ACCEPT_WITH_LIMITS)

## DB-1 실제 적용 게이트 — **BLOCKED**
| 조건 | 상태 |
|---|---|
| 승인형 배포 통합 독립 검증 | 통과 (ACCEPT_WITH_LIMITS) |
| 훅 실제 활성화 | **미충족** — 세션 훅은 메인 worktree `D:\workspace\Vocaflow`(design/replica-first, origin/main 보다 624커밋 뒤)의 `.claude/settings.json` · `guard.mjs` 로 돈다. 그 worktree 에 `db-approval-hook` 이 없고, 다른 세션의 커밋 안 된 `guard.mjs` 가 있어 동기화하지 않았다 |
| 실제 승인 창 재현 (`updatedInput` 반영 · 두 훅 합성 · 거부 뒤 transcript) | 미실측 — 훅 활성화가 먼저다 |
| 대상 DB · SQL SHA · DB-1 하나 · 원격 이력 | 일치 (722행 · 최댓값 `20261014091841` · DB-1 0행) |
| 당일 checkpoint · preflight | 적용 직전에 다시 확인한다 |

## 다음 순서
1. 메인 worktree 소유 세션이 `guard.mjs` 변경을 정리한다. 그 내용은 origin/main 의 2026-10-10 ask 동작과 같다. 정리 후 `git merge origin/main` 하고 Claude Code 세션을 다시 시작한다(훅 설정은 세션 시작 때 읽힌다).
2. 접속 문자열을 메인 worktree `.env.local` 의 `VF_DEPLOY_DB_URL` 에 넣는다(사용자가 1회).
3. 새 세션에서 Claude 가 preflight → `node scripts/db/factory-i1/deploy.mjs apply --stage db1 --deps <deps> --confirm-sha 061a48a8b50b956762dedf171d3a8949d4f9bae4da4058b41d52227eb767c624` 를 실행한다. 사용자는 승인 창에서 SHA 를 확인하고 허용한다. 이어서 verify 와 마감을 진행한다.
