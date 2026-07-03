-- 20260703120000_p0_security_rls_hardening.sql
-- P0 보안: public 스키마 RLS 비활성 테이블 하드닝 (security advisor ERROR 8건 중 7건).
-- 원인: 대상 테이블 전부 anon 에 SELECT+INSERT 권한이 있는데 RLS 가 꺼져 있어
--       익명 키(anon)로 직접 read/write 가능한 상태였음.
-- 조치: RLS 활성 + 필요한 read 정책만 부여 (INSERT 정책 부재 → 익명 write 차단).

-- 1) 참조 taxonomy 4종 — 앱(DiagnosticClient)·admin 이 read → authenticated read 허용
alter table public.vocaflow_levels  enable row level security;
alter table public.vocaflow_tracks  enable row level security;
alter table public.vocaflow_domains enable row level security;
alter table public.vocaflow_skills  enable row level security;
create policy "vocaflow_levels_auth_read"  on public.vocaflow_levels  for select to authenticated using (true);
create policy "vocaflow_tracks_auth_read"  on public.vocaflow_tracks  for select to authenticated using (true);
create policy "vocaflow_domains_auth_read" on public.vocaflow_domains for select to authenticated using (true);
create policy "vocaflow_skills_auth_read"  on public.vocaflow_skills  for select to authenticated using (true);

-- 2) 내부 QA (분류 의심 단어) — admin 전용 read
alter table public.vrl_data_integrity_concerns enable row level security;
create policy "vrl_concerns_admin_read" on public.vrl_data_integrity_concerns
  for select to authenticated
  using (exists (
    select 1 from public.user_profiles up
    where up.user_id = (select auth.uid()) and up.role = 'admin'
  ));

-- 3) 백엔드 전용 — 클라이언트 직접 read 경로 없음.
--    SECURITY DEFINER RPC(collect_archaic_candidates·inflection lookup 등)와
--    service_role 은 RLS 를 bypass 하므로 기능 영향 없음.
alter table public.noise_blacklist          enable row level security;
alter table public.english_irregular_forms  enable row level security;
