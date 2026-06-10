-- 20260608120000_texts_user_book_group_id.sql
--
-- /text/new 챕터 모드 — 사용자 직접 입력 도서의 챕터 그룹 식별자.
--
-- 배경:
--   기존 chapter_idx / chapter_title 은 library_book_id (curated) 인 경우만 활용.
--   사용자가 책을 챕터별로 직접 입력할 때 그룹 식별 token 필요.
--
-- 정책:
--   - library_book_id IS NOT NULL  → curated 도서 챕터 (기존)
--   - user_book_group_id IS NOT NULL → 사용자 직접 입력 도서 그룹 (신규)
--   - 둘 다 NULL                   → 단일 스크립트 (기존)
--   - 두 필드 동시 NOT NULL 금지 (CHECK constraint)
--
-- FK 없음 — 단순 UUID grouping token. user 단위 격리는 user_id 와 같이 INDEX.

ALTER TABLE public.texts
  ADD COLUMN IF NOT EXISTS user_book_group_id UUID;

-- 두 그룹 식별자 동시 사용 차단 (mutual exclusive)
ALTER TABLE public.texts
  ADD CONSTRAINT texts_book_group_exclusive
  CHECK (library_book_id IS NULL OR user_book_group_id IS NULL);

-- (user_id, user_book_group_id) 부분 인덱스 — group 멤버 조회 hot path
CREATE INDEX IF NOT EXISTS idx_texts_user_book_group
  ON public.texts(user_id, user_book_group_id, chapter_idx)
  WHERE user_book_group_id IS NOT NULL;

COMMENT ON COLUMN public.texts.user_book_group_id IS
'User-direct-input book grouping token. chapters share same UUID. NULL if standalone script or library book chapter.';
