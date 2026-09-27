-- supabase/migrations/20260925120000_csat_items_public_hide_stem.sql
--
-- **학습자 뷰에서 발문(stem)을 가린다.** — **적용 2026-09-25** (사용자 승인 · SQL Editor 직접 실행)
--
-- ── 무엇을 봤나 (2026-09-25 실측) ───────────────────────────────────
-- `csat_items_public` 은 security_invoker = false 라 로그인 사용자 누구나 REST 로 802문항 `stem` 을 받는다.
-- 앞선 결정(copyright-boundary 테스트 83-85행)은 「발문 = 기능 문구라 공개 가능」이었으나,
-- **144문항의 발문에 영어 원문이 들어 있다** — 문장 삽입 유형의 「주어진 문장」(지문 한 문장 전체) ·
-- 밑줄 친 구절 · 최장 254자. 그 결정의 전제가 이 문항들에서 성립하지 않는다.
-- 화면 코드는 이 컬럼을 읽지 않는다(select 8곳 모두 stem 없음 · 2026-09-25 grep).
--
-- ── 왜 컬럼 권한인가 ────────────────────────────────────────────────
-- 뷰를 DROP/CREATE 하면 security_invoker 옵션 · db_health_exceptions 면제 · 권한을 다시 맞춰야 한다.
-- 컬럼 단위 SELECT 권한은 뷰를 그대로 두고 `stem` 만 닫는다. `select('*')` 는 권한 오류가 되므로
-- 학습자 코드는 컬럼을 이름으로 적는다(이미 그렇다).
--
-- 되돌리기: GRANT SELECT ON public.csat_items_public TO authenticated;

REVOKE SELECT ON TABLE public.csat_items_public FROM authenticated;

GRANT SELECT (id, exam_id, no, section, in_scope, type_id, answer, points, high_score)
  ON public.csat_items_public TO authenticated;
