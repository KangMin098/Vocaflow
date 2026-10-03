-- scripts/csat/error-evidence/verify-schema.sql
--
-- 오답 원인 Evidence 스키마 — 적용 전 · 후 검증 쿼리(읽기 전용). 각 쿼리는 기대값을 주석으로 적는다.
-- 적용 전: [PRE] 만 · 적용 뒤: [POST] 전부. 하나라도 기대와 다르면 적용 결과를 받아들이지 않는다.

-- [PRE-1] 이름 충돌 없음 — 기대: 0행
select table_name from information_schema.tables where table_schema = 'public' and table_name like 'csat\_ec\_%';
-- [PRE-2] 기존 응답 테이블에 같은 이름 트리거 없음 — 기대: 0행
select tgname from pg_trigger where tgrelid = 'public.csat_dx_response'::regclass and tgname like 'csat_ec_%';
-- [PRE-3] 의존 함수 존재 — 기대: is_admin · digest 둘 다 1 이상
select (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'is_admin') as is_admin,
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'extensions' and p.proname = 'digest') as digest;
-- [PRE-4] 기존 행 수 기록(적용 뒤 같아야 한다) — 응답 · 세션
select (select count(*) from public.csat_dx_session) as sessions, (select count(*) from public.csat_dx_response) as responses;

-- [POST-1] 테이블 9개 · 전부 RLS + FORCE — 기대: 9행, relrowsecurity = relforcerowsecurity = true
select c.relname, c.relrowsecurity, c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname like 'csat\_ec\_%' and c.relkind = 'r' order by 1;
-- [POST-2] 초기 행 수 전부 0 — 기대: 모든 값 0
select (select count(*) from public.csat_ec_taxonomy_version) tv, (select count(*) from public.csat_ec_code) code,
       (select count(*) from public.csat_ec_ai_run) run, (select count(*) from public.csat_ec_claim) claim,
       (select count(*) from public.csat_ec_review_round) round, (select count(*) from public.csat_ec_review_assignment) asg,
       (select count(*) from public.csat_ec_judgment) j, (select count(*) from public.csat_ec_session_confirmation) conf,
       (select count(*) from public.csat_ec_process_evidence) pe;
-- [POST-3] 직접 DELETE · TRUNCATE · UPDATE 권한이 어떤 역할에도 없다 — 기대: 0행
select c.relname, r.rolname, p.priv
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  cross join (values ('anon'), ('authenticated'), ('service_role')) r(rolname)
  cross join (values ('DELETE'), ('TRUNCATE'), ('UPDATE'), ('INSERT')) p(priv)
 where n.nspname = 'public' and c.relname like 'csat\_ec\_%' and c.relkind = 'r'
   and has_table_privilege(r.rolname, c.oid, p.priv);
-- [POST-4] SELECT 권한은 정해진 곳만 — 기대: authenticated × (taxonomy_version, code, session_confirmation, process_evidence, claim) 5행, service_role 0행
select c.relname, r.rolname from pg_class c join pg_namespace n on n.oid = c.relnamespace
 cross join (values ('anon'), ('authenticated'), ('service_role')) r(rolname)
 where n.nspname = 'public' and c.relname like 'csat\_ec\_%' and c.relkind = 'r' and has_table_privilege(r.rolname, c.oid, 'SELECT') order by 1, 2;
-- [POST-5] 함수 실행 권한 — 기대: ai_import · ai_export 는 service_role 만, 학습자 · 판정자 · 관리자 RPC 는 authenticated 만, 트리거 함수 · my_key 는 아무도
select p.proname, r.rolname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 cross join (values ('public'), ('anon'), ('authenticated'), ('service_role')) r(rolname)
 where n.nspname = 'public' and p.proname like 'csat\_ec\_%' and r.rolname <> 'public' and has_function_privilege(r.rolname, p.oid, 'EXECUTE') order by 1, 2;
-- [POST-6] definer 함수 search_path 고정 — 기대: 0행
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname like 'csat\_ec\_%' and p.prosecdef and not exists (
   select 1 from unnest(p.proconfig) c where c like 'search_path=%');
-- [POST-7] 기존 행 수 그대로 — 기대: PRE-4 와 같음
select (select count(*) from public.csat_dx_session) as sessions, (select count(*) from public.csat_dx_response) as responses;
-- [POST-8] advisor — get_advisors(security) 에 csat_ec_* 새 경고 0
