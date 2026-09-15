-- supabase/migrations/20260830141000_tvr_distinct_volumes_nullable.sql
--
-- `distinct_volumes` 를 NULL 허용으로. **0 과 "못 잼" 은 다른 말이다.**
--
-- 직전 마이그레이션(20260830140000)은 이 컬럼을 `NOT NULL DEFAULT 0` 으로 뒀는데,
-- 초등 저학년 권(파닉스 운율·기본어휘 뜻·철자 완성)은 원글을 한 편도 쓰지 않는다 —
-- 문항이 사전에서 나오기 때문이다(`volume-pool.ELEMENTARY_TYPES`).
-- 그런 권에서 "겹치지 않는 권수" 는 **0 이 아니라 해당 없음**이고, 0 으로 적으면
-- 화면이 "한 권도 못 준다" 는 거짓 경보를 낸다. 조판기가 같은 함정을 이미 한 번
-- 밟았다(2026-08-30 V1: "쓴 원글 33편 · 재고 22편 → 0권" — 실제로는 원글을 안 썼다).

BEGIN;

ALTER TABLE public.textbook_volume_renders
  ALTER COLUMN distinct_volumes DROP NOT NULL,
  ALTER COLUMN distinct_volumes DROP DEFAULT;

COMMENT ON COLUMN public.textbook_volume_renders.distinct_volumes IS
  '겹치지 않게 줄 수 있는 권수. 원글을 쓰지 않는 권(초등 3종)은 NULL — 원글 재고가 상한이 아니다.';

COMMIT;
