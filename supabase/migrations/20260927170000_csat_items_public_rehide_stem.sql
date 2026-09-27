-- supabase/migrations/20260927170000_csat_items_public_rehide_stem.sql
--
-- **20260927161216 을 되돌린다 — 발문(stem) 차단 원복.** (SQL Editor 직접 실행 — auto 모드가 MCP 적용을 막음)
--
-- 경위(2026-09-28): 학평 브랜치의 옛 copyright-boundary 테스트가 `select('*')` 로 뷰를 읽다
-- permission denied 로 떨어졌고, 이를 «권한 유실» 로 오판해 table-level SELECT 를 복구했다.
-- 실제로는 20260925120000(hide_stem, 사용자 승인)이 **일부러** table-level 을 빼고 컬럼 단위로
-- stem 만 닫은 상태였다. table-level GRANT 는 그 차단을 무력화해 144문항 발문의 영어 원문을 다시 열었다.
--
-- 교훈: 권한이 «빠져 있다» 고 보이면 main 의 최신 마이그레이션과 컬럼 ACL(`pg_attribute.attacl`)부터 본다.
-- ⚠️ table-level REVOKE 는 컬럼 권한도 함께 회수한다 — 그래서 컬럼 GRANT 를 다시 준다.

REVOKE SELECT ON TABLE public.csat_items_public FROM authenticated;

GRANT SELECT (id, exam_id, no, section, in_scope, type_id, answer, points, high_score)
  ON public.csat_items_public TO authenticated;
