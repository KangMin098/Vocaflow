-- docs/proposals/vcb-drop-filter-rpcs.sql
-- 마이그레이션 제안(미적용) — 승인 후 apply_migration 으로 반영.
--
-- 배경: 결정 A(위저드 필터 기능 제거)로 필터 프리뷰 UI(FilterPanel/LiveCountBadge/
--       DistributionChart/SampleWords) + 서버 액션(lib/vcb/server/filter-actions.ts)을
--       전량 삭제함. 아래 3개 RPC는 그 UI 전용 백엔드였으며 현재 코드 참조 0.
--       (grep: docs/proposals + 자동생성 packages/types/src/database.ts 타입 정의뿐)
--
-- 안전성: IF EXISTS + 정확 시그니처. 데이터 손실 없음(함수 정의만 제거).
--         DB 검증 시그니처 —
--           vcb_count_words_matching(jsonb)
--           vcb_distribution_for_filters(jsonb)
--           vcb_sample_words_for_filters(jsonb, integer)
--
-- 반영 후 후속: (1) database.ts 타입 재생성  (2) DB_SCHEMA.md 함수 카운트 -3
--              (3) CHANGELOG.md Unreleased 한 줄

DROP FUNCTION IF EXISTS public.vcb_count_words_matching(jsonb);
DROP FUNCTION IF EXISTS public.vcb_distribution_for_filters(jsonb);
DROP FUNCTION IF EXISTS public.vcb_sample_words_for_filters(jsonb, integer);
