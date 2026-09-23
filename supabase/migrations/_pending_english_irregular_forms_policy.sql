-- supabase/migrations/<ts>_english_irregular_forms_policy.sql
--
-- **불규칙 활용형 표가 정책이 없어 화면에 조용히 빈 결과를 준다.** — 승인 대기(적용하지 않았다).
--
-- ── 무엇이 어긋나 있나 (2026-09-23 실측) ────────────────────────────
-- `public.english_irregular_forms`(337행)은 RLS 가 켜져 있고 **정책이 0개**다.
-- 그런데 이 표를 읽는 `en_inflection_bases()` 는 SECURITY **INVOKER** 이고
-- anon·authenticated 가 EXECUTE 할 수 있다. SELECT 권한도 있다.
--
-- 권한이 있으니 오류가 나지 않는다. RLS 가 정책 없이 켜져 있으면 **0행**이 돌아올 뿐이다.
-- 그래서 실패가 보이지 않는다 — `lib/textfit/inflect.ts` 는 이미 이 사실을 주석에 적어 두고
-- 불규칙형(went → go)을 **포기**한 채 레벨 미상으로 남긴다.
--
-- 이 표는 공개 참고 데이터다(영어 불규칙 활용 사전). 개인정보가 아니다.
--
-- ── 조치 ────────────────────────────────────────────────────────────
-- 되돌리기: `drop policy english_irregular_forms_read on public.english_irregular_forms;`

CREATE POLICY english_irregular_forms_read ON public.english_irregular_forms
  FOR SELECT TO anon, authenticated
  USING (true);

-- ── 같은 커밋에서 함께 고칠 것 ──────────────────────────────────────
-- `apps/web/src/lib/textfit/inflect.ts` — "이 표는 어차피 0행이라 쓰지 않는다" 취지의 주석과
-- 그 우회 로직을 걷어내고 불규칙형 역추적을 되살린다. 그렇지 않으면 정책만 생기고
-- 코드가 여전히 표를 안 읽어 **아무것도 달라지지 않는다.**
--
-- 적용 뒤 확인(anon 역할로):
--   SET LOCAL ROLE anon;
--   SELECT count(*) FROM public.english_irregular_forms;  -- 337 이어야 한다(전에는 0)
--   RESET ROLE;
