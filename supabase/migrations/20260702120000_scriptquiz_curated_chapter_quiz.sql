-- 20260702120000_scriptquiz_curated_chapter_quiz.sql
-- ScriptQuiz 큐레이션 챕터 퀴즈 — 도서 챕터별 "스토리 기반 질의/선지" 공유 콘텐츠.
--
-- 배경: 기존 quiz_questions 는 (user_id, text_id) 스코프 = 학습자 개인 소유(RLS own data).
--   LCP 큐레이션 드레인에서 생성하는 퀴즈는 모든 학습자 공유여야 하므로
--   챕터 키(library_book_id + chapter_idx)로 잡는 별도 공유 테이블이 필요.
--   (라이브러리 챕터 단어장이 개인 word_vault 가 아닌 별도 공유 테이블인 것과 동일 SSoT 패턴.)
--
-- 흐름: /admin/curation Curated Books 에서 발행/검토대기 도서를 다건 선택 → enqueue_quiz_jobs
--   → book_quiz_jobs(pending). 드레인(= Claude Code 배치, MCP)이 책별로 챕터 본문
--   (library_chapters_master → content_chunks)을 읽어 스토리 기반 MCQ 를 생성,
--   library_chapter_quiz 에 INSERT 하고 book_quiz_jobs 진행(chapters_done/questions_created)을 갱신.
--
-- 챕터당 문항 수 = quiz_target_per_chapter(book_v_level) — V-Level 별 3~10 곡선(단일 출처).
-- 런타임 LLM 미사용 — 생성은 드레인 시 사전 수행, 앱은 select_book_chapter_quiz 로 read 만.
-- 이 마이그레이션은 큐 '계약'(테이블 + RPC)만 만든다. 문항 INSERT 는 별도(드레인 승인).

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. quiz_target_per_chapter — 도서 V-Level → 챕터당 목표 문항 수 (SSoT 곡선)
--    V-Level 이 높을수록(어려운 책) 문항↑ (고급 학습자 인출 지속력) — 3~10 범위.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION quiz_target_per_chapter(p_v_level smallint)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_v_level IS NULL THEN 5        -- 미산정 도서 기본값(중앙)
    WHEN p_v_level <= 1 THEN 3
    WHEN p_v_level <= 3 THEN 4
    WHEN p_v_level <= 5 THEN 5
    WHEN p_v_level  = 6 THEN 6
    WHEN p_v_level  = 7 THEN 7
    WHEN p_v_level  = 8 THEN 8
    WHEN p_v_level  = 9 THEN 9
    ELSE 10                              -- 10, 11
  END
$$;

GRANT EXECUTE ON FUNCTION quiz_target_per_chapter(smallint) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 2. library_chapter_quiz — 공유 큐레이션 챕터 퀴즈 (챕터 키)
--    row 형태는 quiz_questions 와 평행(UI 매핑 최소화): type/question/options/correct_index/snippet.
--    options: [{ text, textKo? }] · question_ko: 한국어 보조.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS library_chapter_quiz (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_book_id uuid NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  chapter_idx int NOT NULL,
  q_order int NOT NULL,                          -- 1..N 챕터 내 문항 순서
  type text NOT NULL DEFAULT 'multiple'
    CHECK (type IN ('multiple', 'truefalse', 'blank')),
  question text NOT NULL,
  question_ko text,
  options jsonb NOT NULL,                        -- [{ text, textKo? }]
  correct_index int NOT NULL,
  source_snippet text,                           -- 본문 근거 문장 (Lora italic)
  source_sentence_idx int,
  book_v_level smallint,                         -- 생성 시점 도서 V-Level 스냅샷
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- 재드레인 idempotent — (책, 챕터, 순서) 자연키
  CONSTRAINT library_chapter_quiz_uniq UNIQUE (library_book_id, chapter_idx, q_order),
  CONSTRAINT library_chapter_quiz_correct_idx_chk CHECK (correct_index >= 0)
);

CREATE INDEX IF NOT EXISTS idx_lcq_book_chapter
  ON library_chapter_quiz(library_book_id, chapter_idx);

DROP TRIGGER IF EXISTS trg_lcq_updated ON library_chapter_quiz;
CREATE TRIGGER trg_lcq_updated BEFORE UPDATE ON library_chapter_quiz
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS — 직접 접근은 admin/curator 전용. 학습자 read 는 SECURITY DEFINER RPC 경유(아래).
ALTER TABLE library_chapter_quiz ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_curator_lcq ON library_chapter_quiz;
CREATE POLICY admin_curator_lcq ON library_chapter_quiz FOR ALL
  USING (is_admin_or_curator()) WITH CHECK (is_admin_or_curator());

-- ────────────────────────────────────────────────────────────
-- 3. book_quiz_jobs — 퀴즈 생성 작업 큐 (book_curation_jobs 와 대칭 · 별 테이블)
--    UNIQUE(book_id) 충돌 회피 위해 큐레이션 큐와 분리. 드레인이 진행률을 갱신.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS book_quiz_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'done', 'failed')),
  book_v_level smallint,                         -- enqueue 시점 스냅샷
  target_per_chapter int,                        -- quiz_target_per_chapter(book_v_level) 스냅샷
  chapters_total int NOT NULL DEFAULT 0,
  chapters_done int NOT NULL DEFAULT 0,
  questions_created int NOT NULL DEFAULT 0,
  error text,
  note text,
  claimed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT book_quiz_jobs_book_uniq UNIQUE (book_id)
);

CREATE INDEX IF NOT EXISTS idx_bqj_status ON book_quiz_jobs(status);
CREATE INDEX IF NOT EXISTS idx_bqj_updated ON book_quiz_jobs(updated_at DESC);

DROP TRIGGER IF EXISTS trg_bqj_updated ON book_quiz_jobs;
CREATE TRIGGER trg_bqj_updated BEFORE UPDATE ON book_quiz_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE book_quiz_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_curator_bqj ON book_quiz_jobs;
CREATE POLICY admin_curator_bqj ON book_quiz_jobs FOR ALL
  USING (is_admin_or_curator()) WITH CHECK (is_admin_or_curator());

-- ────────────────────────────────────────────────────────────
-- 4. select_book_chapter_quiz — 학습자 read (SSoT). 챕터 퀴즈 문항 정렬 반환.
--    SECURITY DEFINER (RLS 우회) + authenticated grant. 공유 콘텐츠라 별도 발행 게이트 없음.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION select_book_chapter_quiz(
  p_book_id uuid,
  p_chapter_idx int
)
RETURNS TABLE(
  id uuid,
  q_order int,
  type text,
  question text,
  question_ko text,
  options jsonb,
  correct_index int,
  source_snippet text,
  source_sentence_idx int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.id, q.q_order, q.type, q.question, q.question_ko,
         q.options, q.correct_index, q.source_snippet, q.source_sentence_idx
    FROM library_chapter_quiz q
   WHERE q.library_book_id = p_book_id
     AND q.chapter_idx = p_chapter_idx
   ORDER BY q.q_order
$$;

REVOKE ALL ON FUNCTION select_book_chapter_quiz(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION select_book_chapter_quiz(uuid, int) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 5. book_quiz_coverage — admin 배지용. 책의 챕터 퀴즈 커버리지 집계.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION book_quiz_coverage(p_book_id uuid)
RETURNS TABLE(
  chapters_total int,
  chapters_with_quiz int,
  questions_total int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*)::int FROM library_chapters_master m WHERE m.library_book_id = p_book_id),
    (SELECT count(DISTINCT q.chapter_idx)::int FROM library_chapter_quiz q WHERE q.library_book_id = p_book_id),
    (SELECT count(*)::int FROM library_chapter_quiz q WHERE q.library_book_id = p_book_id)
$$;

REVOKE ALL ON FUNCTION book_quiz_coverage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION book_quiz_coverage(uuid) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 6. enqueue_quiz_jobs — 선택 도서를 퀴즈 생성 큐에 upsert(pending).
--    자격: status IN ('ready','published') AND 챕터(library_chapters_master) 존재.
--    book_v_level / target_per_chapter / chapters_total 스냅샷. 자격 외는 skip.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enqueue_quiz_jobs(p_book_ids uuid[])
RETURNS TABLE(queued int, skipped int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queued int := 0;
  v_skipped int := 0;
  v_uid uuid := auth.uid();
  r record;
  v_chapters int;
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  FOR r IN
    SELECT id, status, book_v_level FROM library_books WHERE id = ANY(p_book_ids)
  LOOP
    SELECT count(*)::int INTO v_chapters
      FROM library_chapters_master m WHERE m.library_book_id = r.id;

    IF r.status NOT IN ('ready', 'published') OR v_chapters = 0 THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO book_quiz_jobs (
      book_id, status, book_v_level, target_per_chapter,
      chapters_total, chapters_done, questions_created, created_by
    )
    VALUES (
      r.id, 'pending', r.book_v_level,
      quiz_target_per_chapter(r.book_v_level),
      v_chapters, 0, 0, v_uid
    )
    ON CONFLICT (book_id) DO UPDATE SET
      status = 'pending',
      book_v_level = EXCLUDED.book_v_level,
      target_per_chapter = EXCLUDED.target_per_chapter,
      chapters_total = EXCLUDED.chapters_total,
      chapters_done = 0,
      questions_created = 0,
      error = NULL,
      note = NULL,
      claimed_at = NULL,
      created_by = EXCLUDED.created_by,
      updated_at = now();

    v_queued := v_queued + 1;
  END LOOP;

  RETURN QUERY SELECT v_queued, v_skipped;
END $$;

REVOKE ALL ON FUNCTION enqueue_quiz_jobs(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION enqueue_quiz_jobs(uuid[]) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 7. list_book_chapter_quiz_catalog — 허브 discovery (SSoT).
--    퀴즈가 있는 (도서, 챕터) 를 문항 수 + 제목과 함께 반환. SECURITY DEFINER + authenticated.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION list_book_chapter_quiz_catalog()
RETURNS TABLE(
  book_id uuid,
  book_title text,
  book_v_level smallint,
  chapter_idx int,
  chapter_title text,
  question_count int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    q.library_book_id,
    b.title,
    b.book_v_level,
    q.chapter_idx,
    max(m.chapter_title) AS chapter_title,
    count(*)::int AS question_count
  FROM library_chapter_quiz q
  JOIN library_books b ON b.id = q.library_book_id
  LEFT JOIN library_chapters_master m
    ON m.library_book_id = q.library_book_id AND m.chapter_idx = q.chapter_idx
  GROUP BY q.library_book_id, b.title, b.book_v_level, q.chapter_idx
  ORDER BY b.title, q.chapter_idx
$$;

REVOKE ALL ON FUNCTION list_book_chapter_quiz_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_book_chapter_quiz_catalog() TO authenticated;

COMMIT;
