-- scripts/ci/authored-open-fault.sql
--
-- ⚠️ CI 격리 DB 전용 fixture — 개발 DB · 운영 DB 에 적용하지 않는다(마이그레이션이 아니다 · supabase/migrations 밖).
-- FI-010(#302) 브라우저 재현: 「열기(노출) 기록이 실패하는」 상황을 실제 서버 경로에서 만든다.
-- 시험이 e2e_fault_open 에 학습자 id 를 넣으면 그 학습자의 learning_sessions 쓰기가 실패한다. 행을 지우면 정상으로 돌아온다.
-- service_role 만 표를 쓴다(시험의 관리자 클라이언트). 학습자 · anon 권한 없음.
create table if not exists public.e2e_fault_open (user_id uuid primary key);
alter table public.e2e_fault_open enable row level security;
revoke all on public.e2e_fault_open from public, anon, authenticated;
grant select, insert, delete on public.e2e_fault_open to service_role;

create or replace function public.e2e_fault_open_guard()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
begin
  if exists (select 1 from public.e2e_fault_open f where f.user_id = new.user_id) then
    raise exception 'e2e fixture: open record fault';
  end if;
  return new;
end $$;
revoke all on function public.e2e_fault_open_guard() from public, anon, authenticated;

drop trigger if exists e2e_fault_open_guard on public.learning_sessions;
create trigger e2e_fault_open_guard before insert or update on public.learning_sessions
  for each row execute function public.e2e_fault_open_guard();
