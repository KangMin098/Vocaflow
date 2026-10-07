-- scripts/db/rollback-seed-20261007-find-tasks.sql — FIND 과제 20개를 지운다(완료 기록이 있으면 멈춘다 — 학습자 기록을 지우지 않는다).
begin;
do $$ begin
  if exists (select 1 from public.csat_map_task_done where task_id in ('A3-4', 'A4-4', 'A5-4', 'B2-4', 'B4-4', 'B7-4', 'B8-4', 'B11-4', 'B12-4', 'B13-4', 'C8-4', 'D1-4', 'D3-4', 'D9-4', 'I5-4', 'I7-4', 'I10-4', 'J1-4', 'J2-4', 'J5-4')) then
    raise exception 'FIND 과제 완료 기록이 있다 — 되돌리지 않는다';
  end if;
end $$;
delete from public.csat_map_task where id in ('A3-4', 'A4-4', 'A5-4', 'B2-4', 'B4-4', 'B7-4', 'B8-4', 'B11-4', 'B12-4', 'B13-4', 'C8-4', 'D1-4', 'D3-4', 'D9-4', 'I5-4', 'I7-4', 'I10-4', 'J1-4', 'J2-4', 'J5-4');
commit;
