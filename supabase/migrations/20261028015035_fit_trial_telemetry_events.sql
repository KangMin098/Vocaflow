-- applied to dev 2026-10-28 via apply_migration; do not re-run
-- public-trial-telemetry-proposal.v2.apply.sql — DRAFT v2 · 미적용 · 사용자 DB 승인 전 실행 금지
-- 목적: funnel_events_event_check 를 「스냅숏 허용 목록 ∪ {fit_trial_opened, fit_trial_answered}」 로 다시 건다. 기존 행 0 변경.
-- 실행: 승인 뒤 apply_migration(한 트랜잭션) 또는 승인형 러너로만.
-- 실패 닫힘(전부 되돌림):
--   · 적용 전 정의 sha256 ≠ 스냅숏(a63bb7ac…a1ed) · check 제약 ≠ 1개 · NOT VALID · 이미 fit_trial_ 포함
--   · 적용 후 정의 sha256 ≠ 기대값(3a5bf338…231d) — 기대 정의 전문은 v2.md 에 있다
-- 메타데이터: 검증 상태(VALID) 유지(일반 ADD) · 제약 설명이 있으면 다시 붙인다(현재 null).

set local lock_timeout = '3s';
set local statement_timeout = '60s';
lock table public.funnel_events in access exclusive mode;

do $$
declare
  v_snapshot_sha constant text := 'a63bb7ac990e4ec96081be4aadb7e4cdf8224132d7601fd765f385fe1580a1ed';
  v_expected_sha constant text := '3a5bf338d85d2cf1ce1aec73210528433eaf855d270e221c4bb30a94beab231d';
  v_oid oid;
  v_def text;
  v_valid boolean;
  v_comment text;
  v_inner text;
  v_n integer;
  v_after text;
  v_after_valid boolean;
begin
  select count(*) into v_n from pg_catalog.pg_constraint c
   where c.conrelid = 'public.funnel_events'::regclass and c.contype = 'c';
  if v_n <> 1 then
    raise exception 'fit trial telemetry v2: funnel_events check 제약이 정확히 1개가 아니다(%)', v_n;
  end if;
  select c.oid, pg_catalog.pg_get_constraintdef(c.oid), c.convalidated, pg_catalog.obj_description(c.oid, 'pg_constraint')
    into strict v_oid, v_def, v_valid, v_comment
    from pg_catalog.pg_constraint c
   where c.conrelid = 'public.funnel_events'::regclass and c.conname = 'funnel_events_event_check' and c.contype = 'c';
  if pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_def, 'UTF8')), 'hex') <> v_snapshot_sha then
    raise exception 'fit trial telemetry v2: 제약 정의가 스냅숏과 다르다(드리프트) — 새 SELECT 로 제안을 다시 만든다';
  end if;
  if not v_valid then
    raise exception 'fit trial telemetry v2: 원래 제약이 NOT VALID';
  end if;
  if pg_catalog.strpos(v_def, 'fit_trial_') > 0 then
    raise exception 'fit trial telemetry v2: fit_trial_ 이 이미 정의에 있다';
  end if;
  v_inner := pg_catalog.substring(v_def, '^CHECK \((.*)\)$');
  if v_inner is null then
    raise exception 'fit trial telemetry v2: CHECK 식을 꺼내지 못했다';
  end if;

  alter table public.funnel_events drop constraint funnel_events_event_check;
  execute 'alter table public.funnel_events add constraint funnel_events_event_check check ('
       || v_inner
       || ' or (event = any (array[''fit_trial_opened''::text, ''fit_trial_answered''::text])))';
  if v_comment is not null then
    execute pg_catalog.format('comment on constraint funnel_events_event_check on public.funnel_events is %L', v_comment);
  end if;

  select pg_catalog.pg_get_constraintdef(c.oid), c.convalidated into strict v_after, v_after_valid
    from pg_catalog.pg_constraint c
   where c.conrelid = 'public.funnel_events'::regclass and c.conname = 'funnel_events_event_check';
  if pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_after, 'UTF8')), 'hex') <> v_expected_sha then
    raise exception 'fit trial telemetry v2: 적용 후 정의가 기대값과 다르다 — 전부 되돌린다(rollback 의 정확 일치 전제가 깨지므로)';
  end if;
  if not v_after_valid then
    raise exception 'fit trial telemetry v2: 적용 후 제약이 VALID 가 아니다';
  end if;
end
$$;
