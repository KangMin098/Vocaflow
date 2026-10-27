-- supabase/migrations/_pending_lcp_story_w2_context_notes_recovery.sql
-- ⚠️ 보류(적용 안 함) — LCP Story D3 W2(T-0189) 복구 SQL. _pending_lcp_story_w2_context_notes.sql 을 적용한 뒤 되돌려야 할 때만,
--    사용자 승인을 받아 승인형 러너 또는 apply_migration 으로 한 트랜잭션 안에서 실행한다.
--
-- 무엇: 새 학습자 RPC public.story_unit_context_notes(text, integer) 의 실행 권한만 회수한다(authenticated 및 혹시 있을 PUBLIC · anon · service_role).
--   파괴 없음 — 함수 정의 · story 표 · 발행본 · 진도 · 권리 · 이벤트 데이터는 그대로다(DROP · DELETE · TRUNCATE 없음).
--   다른 story_* RPC 의 권한은 건드리지 않는다.
-- 결과: 화면의 맥락 설명 조회가 권한 거부(42501)로 실패하고 「시대적 맥락 설명을 불러오지 못함」으로 보인다. 본문 · 진도 · 완료는 기존 그대로 동작한다.
-- 멱등: 함수가 있으면 몇 번 실행해도 같은 상태(권한 없음)다. 함수가 없으면(forward 미적용) 실패하고 아무것도 바꾸지 않는다.
-- PostgREST 알림 없음: 실행 권한은 호출마다 DB 가 검사하므로 회수는 캐시와 무관하게 즉시 효력이 있다.
-- 다시 여는 것: 새 SQL 파일 + 새 사용자 승인이 필요하다(이 파일에는 GRANT 가 없다).

do $$
begin
  if pg_catalog.to_regprocedure('public.story_unit_context_notes(text,integer)') is null then
    raise exception 'lcp story w2 recovery: public.story_unit_context_notes(text,integer) does not exist — forward 가 적용되지 않았다';
  end if;
end
$$;

revoke execute on function public.story_unit_context_notes(text, integer) from public, anon, authenticated, service_role;

do $$
declare
  v_fn oid := pg_catalog.to_regprocedure('public.story_unit_context_notes(text,integer)');
begin
  if pg_catalog.has_function_privilege('anon', v_fn, 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', v_fn, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', v_fn, 'EXECUTE')
     or pg_catalog.has_function_privilege('public', v_fn, 'EXECUTE') then
    raise exception 'lcp story w2 recovery postcheck: EXECUTE still granted to a client role';
  end if;
end
$$;
