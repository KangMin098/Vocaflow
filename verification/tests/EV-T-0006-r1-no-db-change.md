# EV-T-0006-r1 — DB 스키마·데이터 변경 0

- 커밋 cfc1833b9 (feat/qa-account-separation, 기준 origin/main bc7cd0340)
- `git diff --stat origin/main -- supabase` → 출력 없음(마이그레이션·SQL 변경 0)
- 이 작업 중 DB 접근은 SELECT 2회뿐(계정 도메인·역할·학습기록 수 확인 — 이메일 원문 미출력). INSERT/UPDATE/DELETE/DDL 0. apply_migration 호출 0.
- 코드 변경은 읽기 경로뿐: `retention.ts` 가 `user_profiles(user_id, role)` 을 추가로 **읽는다**.
