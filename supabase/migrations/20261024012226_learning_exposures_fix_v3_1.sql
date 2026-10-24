-- 제안 패치(v3.1 · 미적용): 20261024100000 learning_exposures 적용 뒤 실제 Supabase 사후 검증에서 드러난 결함 보정.
--  1) learning_exposure_record 가 security invoker 로 service_role 에서 auth.users 를 읽다 권한 오류(42501) — 실제 Supabase 의
--     service_role 에는 auth.users SELECT 가 없다. 존재 확인은 외래 키(learning_exposures.user_id → auth.users)가 이미 보장하므로
--     그 확인 문만 뺀다(없는 사용자 → 23503 FK 위반으로 거부). 서명 · security invoker · search_path · 권한 그대로.
--  2) learning_exposure_tracking 에 service_role INSERT · DELETE 가 Supabase 기본 권한으로 남아 있었다 — 회수(SELECT 만).
-- 데이터 변경 없음 · 표 · 열 · 트리거 변경 없음.

create or replace function public.learning_exposure_record(
  p_user uuid, p_client_exposure_id uuid, p_item_ref text, p_kind text, p_source text,
  p_analysis_version integer, p_lecture_version integer, p_lecture_digest text, p_cue_id text,
  p_occurred_at timestamptz, p_synthetic boolean default false
) returns bigint
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_id bigint;
  v_prev public.learning_exposures;
begin
  if p_user is null or p_client_exposure_id is null or p_occurred_at is null then
    raise exception '사용자 · 요청 id · 발생 시각이 필요하다';
  end if;
  -- 같은 학습자 · 문항의 노출 기록을 직렬화(같은 요청 동시 재전송의 경합 · 시각 순서). 없는 사용자는 외래 키가 거부한다
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || '|' || coalesce(p_item_ref, ''), 0));
  insert into public.learning_exposures (user_id, client_exposure_id, item_ref, kind, source, analysis_version, lecture_version, lecture_digest, cue_id, occurred_at, clock_suspect, synthetic)
  values (p_user, p_client_exposure_id, p_item_ref, p_kind, p_source, p_analysis_version, p_lecture_version, p_lecture_digest, p_cue_id, p_occurred_at,
          abs(extract(epoch from (clock_timestamp() - p_occurred_at))) > 600, coalesce(p_synthetic, false))
  on conflict (user_id, client_exposure_id) do nothing
  returning id into v_id;
  if v_id is not null then return v_id; end if;
  select * into v_prev from public.learning_exposures where user_id = p_user and client_exposure_id = p_client_exposure_id;
  if v_prev.item_ref is distinct from p_item_ref or v_prev.kind is distinct from p_kind or v_prev.source is distinct from p_source then
    raise exception '같은 요청 id 로 다른 노출을 기록할 수 없다';
  end if;
  return v_prev.id;
end $$;

revoke insert, delete, references, trigger on public.learning_exposure_tracking from service_role;
