-- supabase/migrations/_pending_lcp_story_s3_quarantine.sql
-- ⚠️ 보류(적용 안 함) — LCP Story S3 복구(격리) SQL. _pending_lcp_story_s3_schema.sql 을 적용한 뒤 문제가 생겼을 때만,
--    별도 사용자 대화 승인 뒤 승인형 배포 러너(scripts/db/lcp-story-s3/deploy.mjs apply --stage quarantine --confirm-sha <SHA>)로 쓴다.
--
-- 무엇: 모든 public.story_* RPC 의 실행 권한을 anon · authenticated · service_role · PUBLIC 에서 회수한다.
--   · 표 · 행 · 함수 정의는 그대로 둔다(DROP · DELETE · TRUNCATE 없음) — 원천 · 판본 · 검수 · 발행 · 철회 · 학습자 진도 이력이 남는다.
--   · story 스키마는 처음부터 anon · authenticated · service_role 에 USAGE · 표 권한이 없으므로 회수 뒤에는 RPC 경로까지 모두 닫힌다.
--   · 기존 원본 도서 객체 · 행은 건드리지 않는다.
-- 다시 열기: _pending_lcp_story_s3_schema.sql 의 「8. 실행 권한」 grant 문을 같은 승인 절차로 다시 실행한다.
-- 완전 제거(DROP SCHEMA story CASCADE)는 이력 삭제라 이 파일에 넣지 않는다 — 필요하면 내용을 따로 밝혀 별도 명시 승인을 받는다.

do $$
begin
  if to_regnamespace('story') is null then
    raise exception 'lcp story quarantine: schema story does not exist — 적용된 S3 가 없다';
  end if;
end
$$;

revoke all on function public.story_admin_register_source(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.story_admin_register_policy(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.story_admin_submit_edition(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.story_admin_submit_review(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.story_admin_record_rights(uuid, text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.story_admin_publish(uuid) from public, anon, authenticated, service_role;
revoke all on function public.story_admin_withdraw(text, text) from public, anon, authenticated, service_role;
revoke all on function public.story_admin_list_slots() from public, anon, authenticated, service_role;
revoke all on function public.story_admin_get_bundle(uuid) from public, anon, authenticated, service_role;
revoke all on function public.story_catalog() from public, anon, authenticated, service_role;
revoke all on function public.story_read_unit(text, integer) from public, anon, authenticated, service_role;
revoke all on function public.story_record_progress(text, integer) from public, anon, authenticated, service_role;
revoke all on function public.story_my_progress() from public, anon, authenticated, service_role;
