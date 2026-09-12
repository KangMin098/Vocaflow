-- supabase/migrations/20260822100000_dictionary_categories_public_read.sql
--
-- **분류 트리를 비로그인에게도 연다** — 이름만, 활성 항목만.
--
-- ── 왜 필요한가 (실측 2026-08-22) ───────────────────────────────────
-- `/library/vocab` 은 공개 표면이다(발견·SEO — apps/web/CLAUDE.md 공개 표면 표).
-- 익명 방문자는 발행 세트 **747개를 정상적으로 본다.** 그런데 세트에 붙는 큐레이션 라벨은
-- `dictionary_categories` 에서 오고, 그 표의 정책이 `authenticated` 하나뿐이라
-- **익명에게는 0행**이 내려간다. 화면은 그것을 "아직 매핑 안 됨"(`categoryNode: null`)으로 읽고
-- legacy 자유문구로 조용히 내려앉는다.
--
-- ⚠️ 수치를 속이지는 않지만 **권한 실패를 데이터 사실로 인쇄**하는 것이라, 이 저장소가
--    CONVENTIONS §조용한 실패에 못 박은 유형이다("RLS 는 오류를 내지 않는다. 행을 지운다").
--
-- ── 무엇을 여는가 ───────────────────────────────────────────────────
-- 분류 트리 566행의 **이름·이모지·깊이**뿐이다. 낱말도, 세트 소유자도, 학습 기록도 아니다.
-- 이미 공개된 세트에 **붙는 라벨**이므로, 세트가 공개인데 라벨만 가리는 지금 상태가 더 이상하다.
--
-- ⚠️ 기존 정책의 조건을 **그대로** 쓴다(`is_active = true`). anon 에게 더 넓게 열지 않는다 —
--    비활성 분류는 로그인 사용자도 못 본다.
--
-- 되돌리기: `DROP POLICY "anon read active categories" ON public.dictionary_categories;`
--           (기존 `authenticated read categories` 는 건드리지 않았으므로 로그인 경로는 무영향)

CREATE POLICY "anon read active categories"
  ON public.dictionary_categories
  FOR SELECT
  TO anon
  USING (is_active = true);

COMMENT ON TABLE public.dictionary_categories IS
  '어휘 분류 트리. 활성 항목은 비로그인도 읽는다 — 공개 서가의 세트 라벨이 여기서 온다(20260822100000).';
