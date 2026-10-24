# C-D2 — 원문 정정 2건(2014B#36 · 2017#42) · 승인됨 · **미적용(러너 접속 정보 없음)**

사용자 결정(2026-10-25): 2014B#36 · 2017#42 우선 DB 정정 승인 · D-three 3행 forward 는 실행하지 않음 · 2023#32 는 분석 v5 와 별도.
정정 내용은 D-three 와 같다(생성기 `make-package.mjs` 가 D-three 에서 2023#32 만 뺐다).

| PK | 바꿀 것 | passage md5 전 → 후 |
|---|---|---|
| 2014B#36 | 끝 ` [3점] (A) (B) (A) (B)` 제거 | `4910c6d0824e9e5b8e1a29265b29659d` → `0b6a803ce0d702594d3d85705013be45` |
| 2017#42 | 끝 `\n\n(A) (B) (A) (B)` 제거 | `5bb996e451c82758a15c4fe0e5b00ea2` → `ac52fa4ae3dae03384dc2983a4fb6430` |

| 파일 | sha256 |
|---|---|
| `forward.sql` | `a358a7d717a7d3d14dbfcc6d3c231bb3b089c1c989bcf292077443393a762e9a` |
| `recovery.sql` | `6b052d33a3db31ac21aed3f55a2d4796cb5a6e5fa32c0f86f259772b577168ea` |
| `check.sql` | `c690716d4a269c76a478465da85ca2d97832ddc575be5c41ed9227c288f6d356` |
| `recipe-D-two.json` | `db4514e17337a9bc7703974f30c694cd2bc225fa448ee33203f1b3b1531ca2ff` |
| `manifest.json` | `0ce2c8ff255b375992c5199790372b10db84fafd936c10a510ebd4b4616276af` |

## 러너 결속

- 승인형 러너 `scripts/db/csat-content-fix/deploy.mjs` 단계 **`c-src2`** = forward sha256 `a358a7d7…` · 검증 SQL(정정 뒤 md5 2행). 로컬 main `0d3d24659`.
- forward: compare-and-set(md5) · 2행이 아니면 예외 → 전체 롤백. 재실행하면 0행 → 예외(멱등).
- 실행(승인 창 티켓 경로, Claude Code 세션에서):
  `node scripts/db/csat-content-fix/deploy.mjs apply --stage c-src2 --sql <D-two/forward.sql 절대경로> --deps D:/workspace/Vocaflow-ec-smoke/scripts/csat/error-evidence/isolated-pg --ca D:/workspace/Vocaflow-factory-order-lineage-20261020/.agent-logs/d3-approved-supabase-ca.crt --confirm-sha a358a7d717a7d3d14dbfcc6d3c231bb3b089c1c989bcf292077443393a762e9a`
- **막힌 곳:** 러너는 Postgres 접속 문자열 `VF_DEPLOY_DB_URL`(셸 환경 또는 worktree 루트 `.env.local`)이 필요한데 이 환경에 없다(`apps/web/.env.local` 키 목록은 API 키뿐). preflight 단계에서 「접속 문자열 … 가 없다」로 멈췄다 — DB 에는 접속하지 않았다.
- 적용 뒤: check.sql(after 2) · 수리 기록 `recipe-D-two.json` 을 `kice-source-repairs.json` 에 mergeSourceRepair · 결속 감사 2문항 · 원장 재생성 대조.
