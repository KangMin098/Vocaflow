-- supabase/migrations/20260831093427_close_anon_exposure_on_definer_views.sql
--
-- SECURITY DEFINER 뷰 2개의 anon 노출 차단
--
-- 발견: 둘 다 security_invoker 가 꺼진 채(= 뷰 소유자 postgres 권한으로 실행) anon 에
-- GRANT 되어 있었다. 즉 익명 키만으로 PostgREST 를 통해 밑단 테이블의 RLS 를 우회해 읽혔다.
-- 20260614011809_views_security_invoker · 20260709132237_advisor_revoke_anon_definer 가
-- 같은 일을 한 적이 있는데, 이 둘은 그 그물에 걸리지 않았다.
--
--   word_mislevel_signal  → word_familiarity 를 읽는다. 학습자의 known/unknown 응답이다.
--                           lemma 별 집계라 개인 식별은 안 되지만, 가입자가 3명이라
--                           사실상 특정 학습자 한둘의 학습 이력이다.
--   v_topic_word_salience → topic_word_stats. 큐레이션 코퍼스 내부 통계다.
--
-- 안전 근거: 앱 코드 참조 0건(둘 다 진단용 뷰)이고, service_role 은 rolbypassrls = true 라
-- 어드민·스크립트 조회는 security_invoker 를 켜도 그대로 동작한다.
-- 두 겹으로 막는다 — invoker 로 바꿔 RLS 를 태우고, GRANT 자체도 회수한다.

ALTER VIEW public.word_mislevel_signal  SET (security_invoker = on);
ALTER VIEW public.v_topic_word_salience SET (security_invoker = on);

REVOKE ALL ON public.word_mislevel_signal  FROM anon, authenticated;
REVOKE ALL ON public.v_topic_word_salience FROM anon, authenticated;
