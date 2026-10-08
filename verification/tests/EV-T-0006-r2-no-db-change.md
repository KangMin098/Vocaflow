# EV-T-0006-r2 — DB 스키마·데이터 변경 0 (run 2)

- 커밋 6165b7160 (feat/qa-account-separation, 기준 origin/main bc7cd0340) — run 1 cfc1833b9 + run 2 수정
- `git diff --stat bc7cd0340..6165b7160 -- supabase` → 0 줄(변경 없음)
- run 2 중 DB 접근 0. 코드의 DB 접근은 읽기뿐(user_profiles 조회에 정렬만 추가).
