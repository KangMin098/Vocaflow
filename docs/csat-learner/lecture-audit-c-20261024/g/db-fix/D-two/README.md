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

## 적용 기록 (2026-10-25)

- 1차 apply(sha `a358a7d7…`, 티켓 3b09ea29a03a): 빈 문자열 `$q$$q$` 의 `$$` 가 바깥 `DO $$` 를 닫아 구문 오류 → 러너 롤백 · DB 무변경(SELECT 확인).
- 생성기 수정(빈 문자열 = `''`) → forward sha **`9e68f0ec32e82eefb2398920a3f19aa3da745ba6b557c3aff7e1e8a56d1708aa`** · 러너 단계 갱신(로컬 main 2690618d6).
- 2차 apply(티켓 bfac52eb32f5): 적용 · 러너 검증 ok(2014B#36 0b6a803c · 2017#42 ac52fa4a) · choices 불변.
- 수리 기록 2건 병합(로컬 main 0ce09ed6d) · 재생성 원장 지문 = DB 2/2 · 수리 테스트 16/16.
- G 결속 감사: 두 문항 결함 0(이전 지문 끝 표 머리 잔여 없음) · 차단 이유는 수능·모평 공통(no_current_units · analysis_unbound)만.
- 접속: 러너가 `VF_DEPLOY_ENV_FILE`(D:/workspace/Vocaflow-db1-apply/apps/web/.env.local) · `--db-url-env SUPABASE_DB_URL` 로 실행 프로세스에만 읽음. 값은 출력·기록하지 않음.
