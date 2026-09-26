-- supabase/migrations/20260923105031_drop_dead_views.sql
--
-- **아무도 읽지 않는 뷰 6개.** — **적용 2026-09-23** (사용자 승인 · 원장 20260923105031).
--
-- ── 판정 근거 (2026-09-23 · 157개 객체 전수) ────────────────────────
-- public 스키마의 테이블 139 · 뷰 14 · 머티리얼라이즈드뷰 4 를 전부 셌다.
-- 각 이름에 대해 ① 저장소 코드(`apps/web/src`·`apps/mobile`·`packages`·`scripts`·`agents`·`.claude`)
-- ② DB 내부(FK 양방향 · 뷰 의존 `pg_rewrite` · 트리거 · `pg_proc.prosrc` · `cron.job` 14건)
-- 를 교차 확인했다. `packages/types/src/database.ts` 는 생성물이라 참조로 세지 않았다.
--
-- 아래 6개만 **행 0 + 코드 참조 0 + DB 내부 참조 0** 이었다. 전부 뷰이므로 데이터 손실이 없다
-- (뷰는 정의일 뿐 저장하지 않는다). 회수 용량은 0 KB — 가치는 용량이 아니라
-- 「이 이름이 무엇인지 아무도 모르는 상태」를 없애는 것이다.
--
-- **테이블 중 DROP_SAFE 는 0개였다.** 행이 0인 테이블 6개
-- (`class_assignments`·`class_members`·`class_assignment_progress`·`vocab_raw_texts`·
--  `word_familiarity`·`methodology_relations`)도 전부 코드나 함수가 만진다 —
-- 스키마는 살아 있고 기능만 아직 안 쓰인 것이다. 지우면 안 된다.
--
-- 되돌리기: `git show` 로 원래 CREATE VIEW 문을 찾아 다시 만든다.
-- 정의를 지금 남겨 두려면 적용 전에 `pg_get_viewdef` 스냅샷을 뜬다:
--   SELECT viewname, pg_get_viewdef(('public.'||viewname)::regclass, true)
--     FROM pg_views WHERE schemaname='public' AND viewname IN (...);

DROP VIEW IF EXISTS public.user_vocab_enriched;
DROP VIEW IF EXISTS public.word_mislevel_signal;
DROP VIEW IF EXISTS public.v_dict_pos_sense_gap;
DROP VIEW IF EXISTS public.v_book_extraction_reasons;
DROP VIEW IF EXISTS public.v_user_book_progress;
DROP VIEW IF EXISTS public.v_extraction_quality_audit;

-- ── 적용 뒤 반드시 ──────────────────────────────────────────────────
-- `packages/types/src/database.ts` 를 재생성하고 `pnpm turbo run typecheck` 를 돌린다.
-- 생성 타입에 남아 있는 이름은 컴파일을 깨지 않지만, 다음 세션이 「있는 줄 알고」 쓰게 된다.
