-- supabase/migrations/_pending_20261008190000_learning_records_append_only.sql
--
-- **F7 — 학습 기록 3표 추가 전용화 · 안전한 테스트 정리 경로.** 미적용 · 승인 대기(M8 과 별도 승인). 전제: M8(20261008180000).
-- 실측(개발 DB 2026-10-08 읽기 전용): service_role 이 learning_mutations · learning_sessions · learning_task_attempts 에
--   UPDATE · DELETE · TRUNCATE 를 갖는다(160000 은 SELECT · INSERT 만 의도했지만 Supabase 기본 GRANT 가 남음).
--   TRUNCATE 는 행 트리거를 건너뛰므로 표본 고정(M5d) · synthetic 불변(M8)을 한 문장으로 우회한다.
-- 바꾸는 것
--   F7-1 세 표 TRUNCATE 회수(service_role · authenticated · anon).
--   F7-2 요청 원장은 고치지 않는다 — UPDATE 회수 + 트리거 거부(소유자 역할 포함).
--   F7-3 삭제는 합성 행만 · 분석 완료 실검증 표본 밖에서만 — 테스트 정리 경로(시도 → 세션 → 원장 순, PK 로).
--        실제 학습자 기록 삭제는 언제나 거부한다(계정 삭제의 on delete cascade 는 auth.users 쪽이라 이 트리거가 막는다 — 아래 주의).
-- 주의: auth.users 삭제 cascade 도 실제 학습자 행이면 거부된다 — 계정 삭제는 먼저 별도 절차(보관 · 익명화)를 거친다. 현재 실행 중인 계정 삭제 경로가 있으면 승인 전 확인할 것.
-- 기존 데이터 영향: 행 변경 없음(권한 · 트리거만). 세 표 모두 0행(2026-10-08 실측).
-- 검증: scripts/knowledge/g2-f7-test.mjs(격리 PostgreSQL) · 되돌리기 블록도 그 하네스가 실행한다.

revoke truncate on public.learning_mutations, public.learning_sessions, public.learning_task_attempts from service_role, authenticated, anon;
revoke update on public.learning_mutations from service_role, authenticated, anon;

create function public.learning_mutations_append_only() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    raise exception '요청 원장은 고칠 수 없다(추가 전용)';
  end if;
  if not coalesce((old.payload->>'synthetic')::boolean, false) then
    raise exception '실제 학습자의 요청 원장은 지울 수 없다 — 합성 기록만 정리할 수 있다';
  end if;
  return old;
end $$;
create trigger learning_mutations_append_only before update or delete on public.learning_mutations
  for each row execute function public.learning_mutations_append_only();

create function public.learning_records_delete_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if not old.synthetic then
    raise exception '실제 학습자 기록은 지울 수 없다 — 합성 기록만 정리할 수 있다';
  end if;
  if tg_table_name = 'learning_task_attempts' and exists (
       select 1 from public.knowledge_trials t where t.id = old.trial_id and t.status = 'analyzed' and not t.synthetic) then
    raise exception '분석 완료된 검증의 표본은 지울 수 없다';
  end if;
  return old;
end $$;
create trigger learning_task_attempts_delete_guard before delete on public.learning_task_attempts
  for each row execute function public.learning_records_delete_guard();
create trigger learning_sessions_delete_guard before delete on public.learning_sessions
  for each row execute function public.learning_records_delete_guard();

-- ── 되돌리기(한 트랜잭션 · 각 줄 앞의 「-- 」를 벗겨 실행) ────────────────────
-- 검증: scripts/knowledge/g2-f7-test.mjs 가 이 블록을 격리 DB 에서 실제로 실행한다.
-- begin;
-- drop trigger learning_sessions_delete_guard on public.learning_sessions;
-- drop trigger learning_task_attempts_delete_guard on public.learning_task_attempts;
-- drop function public.learning_records_delete_guard();
-- drop trigger learning_mutations_append_only on public.learning_mutations;
-- drop function public.learning_mutations_append_only();
-- grant update on public.learning_mutations to service_role;
-- grant truncate on public.learning_mutations, public.learning_sessions, public.learning_task_attempts to service_role;
-- commit;
