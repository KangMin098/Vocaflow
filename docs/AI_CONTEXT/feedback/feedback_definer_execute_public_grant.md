> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/feedback_definer_execute_public_grant.md
> category: feedback

---

Supabase 보안 하드닝 교훈 (2026-07-08, v06.164).

**Why:** Postgres 는 함수 생성 시 EXECUTE 를 **PUBLIC 에 자동 grant**(ACL `=X/postgres`). anon·authenticated 는 PUBLIC 멤버라 여기서 상속받음 — 따라서 `REVOKE EXECUTE ... FROM anon` 은 **명시 grant 가 있을 때만** 유효하고, PUBLIC 상속인 경우엔 무효(has_function_privilege 여전히 true). 실제로 v06.164 1차 마이그(`FROM anon, authenticated`)에서 명시 grant 있던 2종만 잠기고 PUBLIC 상속 7종은 안 잠겨 보정 마이그(`FROM PUBLIC`)가 필요했음.

**How to apply:**
- SECURITY DEFINER 함수를 anon 에서 잠글 때: `REVOKE EXECUTE ON FUNCTION x FROM PUBLIC;` (service_role·authenticated 는 **명시 grant** 돼 있으면 유지됨 — Supabase 는 대개 이 세 role 에 명시 grant + PUBLIC).
- 검증은 `has_function_privilege('anon'|'authenticated'|'service_role', oid, 'EXECUTE')` 3종 + ACL 직접 확인(`pg_proc.proacl`, `=X/...` = PUBLIC).
- service_role 은 명시 grant 로 유지되므로 백엔드(service_role 클라)는 REVOKE 무영향. LCP 파이프라인 등 server route 는 SUPABASE_SERVICE_ROLE_KEY 사용 확인 후 회수.
- get_advisors 결과가 크면(>토큰) tool-results 파일을 node 로 파싱: `.result.lints[]` level/name 집계. `anon_security_definer_function_executable` = 이 케이스.

관련: [[feedback-supabase-migrations]] [[project-vrl-phase2j-admin-dashboard]]

