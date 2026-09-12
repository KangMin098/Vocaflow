-- supabase/migrations/20260814024656_rpc_inherit_book_gate.sql
-- (파일명 = 실제 적용 버전 supabase_migrations.schema_migrations.version)
--
-- SECURITY DEFINER RPC 3종이 RLS 를 우회해 미발행 원본에 닿던 것 차단 —
-- 20260813110729(세트 RLS) 이 못 막는 나머지 절반.
--
-- 왜 이게 남았나:
--   20260813110729 는 `shared_word_sets`·`shared_words` 의 RLS 를 조여 PostgREST 경로를 막았다.
--   그런데 **SECURITY DEFINER 함수는 정의자 권한으로 돌아 RLS 를 통째로 우회한다.**
--   같은 데이터에 두 개의 문이 있었고 한쪽만 잠근 셈이다.
--
-- 실측 (2026-08-14 · 일반 학습자 계정 role=user 로 직접 호출):
--   deliver_chapter_vocab(Dialogues=미발행 'ready', ch10) → **단어 30개 반환**
--   같은 세트를 PostgREST 로 조회 → 0행 (RLS 는 정상 작동)
--   enroll_library_book(같은 도서)      → 정상 거부 ✓
--   _enroll_book_subscribe_word_sets(...) → **실행됨** (anon·authenticated 에 EXECUTE 부여)
--
-- 기준선: `library_book_vocabularies` · `library_chapters_master` 의 기존 RLS 와 **같은 조건**
--   `EXISTS (library_books … status='published' AND copyright_safe_in_kr)`.
--   이 두 테이블은 처음부터 그렇게 돼 있었다 — 예외였던 건 세트와 이 RPC 들이다.
--
-- ── ① deliver_chapter_vocab ────────────────────────────────────────────────
-- 게이트를 pool 의 WHERE 에 넣어 **0행을 반환**한다. RAISE 로 바꾸지 않는 이유:
--   호출부(chapter-words-queries.ts)가 "0행 = 아직 단어장 없는 도서" 로 읽고 폴백 경로를 타도록
--   설계돼 있다(ChapterLevelWords 주석). 예외를 던지면 정상 폴백이 콘솔 에러로 바뀐다.
--   폴백이 읽는 library_book_vocabularies 는 위 RLS 로 이미 막혀 있어 새는 곳이 없다.

CREATE OR REPLACE FUNCTION public.deliver_chapter_vocab(p_book_id uuid, p_chapter_idx integer)
 RETURNS TABLE(word text, meaning_ko text, source_sentence text, example_en text, pronunciation text, part_of_speech text, cefr_level text, v_level smallint, composite_score numeric, reason text, delivered_rank integer, target_count integer, pool_size integer, chapter_word_count integer, effective_v_level smallint, level_source text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_eff int; v_target_v int; v_src text;
  v_csat int; v_biz int; v_acad int;
  v_wc int; v_n int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다'; END IF;

  SELECT NULLIF(up.current_v_level, 0),
         COALESCE((up.current_track_levels->>'csat_korean')::int, 0),
         COALESCE((up.current_track_levels->>'business_english')::int, 0),
         COALESCE((up.current_track_levels->>'academic_english')::int, 0)
    INTO v_eff, v_csat, v_biz, v_acad
  FROM user_profiles up WHERE up.user_id = v_user;

  IF v_eff IS NOT NULL THEN
    v_src := 'user_diagnostic';
  ELSE
    SELECT lb.book_v_level INTO v_eff FROM library_books lb WHERE lb.id = p_book_id;
    v_src := CASE WHEN v_eff IS NOT NULL THEN 'book_v_level_fallback' ELSE 'default' END;
    v_eff := COALESCE(v_eff, 5);
  END IF;
  v_target_v := LEAST(v_eff + 1, 10);

  SELECT m.word_count INTO v_wc
  FROM library_chapters_master m
  WHERE m.library_book_id = p_book_id AND m.chapter_idx = p_chapter_idx;

  v_n := LEAST(GREATEST(round(COALESCE(v_wc, 1706) / 1000.0 * 8)::int, 8), 30);

  RETURN QUERY
  WITH pool AS (
    SELECT sw.word AS p_word, sw.meaning_ko AS p_meaning, sw.source_sentence AS p_sent,
           sw.example_en AS p_ex, sw.pronunciation AS p_pron, sw.part_of_speech AS p_pos,
           sw.cefr_level AS p_cefr, COALESCE(sw.v_level, sd.v_level) AS p_vl,
           sd.frequency_rank AS p_freq, sd.skill_level AS p_skill, sd.track_levels AS p_tracks
    FROM shared_word_sets s
    JOIN shared_words sw ON sw.set_id = s.id
    LEFT JOIN shared_dictionary sd ON sd.word = COALESCE(sw.lemma, sw.word)
    WHERE s.is_published
      -- ★ 2026-08-14 추가: DEFINER 라 RLS 가 안 걸린다 — 원본 발행 게이트를 여기서 직접 건다.
      AND EXISTS (SELECT 1 FROM library_books lb2
                  WHERE lb2.id = p_book_id
                    AND lb2.status = 'published'
                    AND lb2.copyright_safe_in_kr)
      AND s.category = 'library_book'
      AND s.curation_query->>'book_id' = p_book_id::text
      AND (s.curation_query->>'chapter_idx')::int = p_chapter_idx
      AND NOT EXISTS (SELECT 1 FROM vocabularies v
                      WHERE v.user_id = v_user AND lower(v.word) = lower(sw.word))
  ),
  scored AS (
    SELECT p.*,
      EXP(-((COALESCE(p.p_vl, v_target_v)::numeric - v_target_v)^2) / 4.5) AS s_vprox,
      GREATEST(
        CASE WHEN v_csat >= 4 AND (p.p_tracks->>'csat_korean')::int >= 4
             THEN 1.0 - ABS((p.p_tracks->>'csat_korean')::int - v_csat)::numeric / 10.0 ELSE 0 END,
        CASE WHEN v_biz >= 4 AND (p.p_tracks->>'business_english')::int >= 4
             THEN 1.0 - ABS((p.p_tracks->>'business_english')::int - v_biz)::numeric / 10.0 ELSE 0 END,
        CASE WHEN v_acad >= 4 AND (p.p_tracks->>'academic_english')::int >= 4
             THEN 1.0 - ABS((p.p_tracks->>'academic_english')::int - v_acad)::numeric / 10.0 ELSE 0 END,
        0.0) AS s_track,
      1.0 / LOG(10, COALESCE(p.p_freq, 50000)::numeric + 10) AS s_freqb,
      CASE WHEN p.p_skill = 4 AND v_eff < 6 THEN -0.10 ELSE 0 END AS s_skillp,
      CASE WHEN p.p_vl >= 11 THEN -0.50 WHEN p.p_vl >= 10 THEN -0.20 ELSE 0 END AS s_arch
    FROM pool p
  ),
  ranked AS (
    SELECT sc.*,
      ROUND(0.50*sc.s_vprox + 0.25*sc.s_track + 0.15*sc.s_freqb + sc.s_skillp + sc.s_arch, 4) AS s_score,
      ROW_NUMBER() OVER (
        ORDER BY (0.50*sc.s_vprox + 0.25*sc.s_track + 0.15*sc.s_freqb + sc.s_skillp + sc.s_arch) DESC,
                 sc.p_freq ASC NULLS LAST, sc.p_word) AS s_rn,
      COUNT(*) OVER () AS s_pool
    FROM scored sc
  )
  SELECT r.p_word, r.p_meaning, r.p_sent, r.p_ex, r.p_pron, r.p_pos, r.p_cefr,
         r.p_vl::smallint, r.s_score,
         CASE
           WHEN r.p_vl = v_target_v                    THEN 'i+1 — 지금 딱 한 걸음'
           WHEN r.p_vl BETWEEN v_eff - 1 AND v_eff     THEN '현재 수준 — 다지기'
           WHEN r.p_vl > v_target_v                    THEN '조금 어려움 — 맥락으로 만나기'
           WHEN r.p_vl < v_eff - 1                     THEN '쉬운 편 — 빈틈 메우기'
           ELSE '중간'
         END,
         r.s_rn::int, v_n, r.s_pool::int, v_wc, v_eff::smallint, v_src
  FROM ranked r WHERE r.s_rn <= v_n ORDER BY r.s_rn;
END;
$function$;

-- ── ② _enroll_book_subscribe_word_sets — 내부 헬퍼를 외부에 열어 두지 않는다 ──────
-- `p_user_id` 를 **호출자가 지정**하는 SECURITY DEFINER 쓰기 함수인데 anon·authenticated 에
-- EXECUTE 가 부여돼 있었다. 즉 학습자 A 가 학습자 B 의 계정에 구독·단어를 밀어 넣을 수 있었다.
-- 유일한 정당한 호출자 enroll_library_book 은 DEFINER 라 소유자 권한으로 호출한다 —
-- 호출자에게 EXECUTE 가 없어도 정상 동작한다(회수해도 정상 경로는 영향 없음).
REVOKE EXECUTE ON FUNCTION public._enroll_book_subscribe_word_sets(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._enroll_book_subscribe_word_sets(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public._enroll_book_subscribe_word_sets(uuid, uuid) FROM authenticated;

-- ── ③ subscribe_article_word_set — 같은 종류를 글 쪽에서도 닫는다 ────────────────
-- 지금은 발행 글 135/135 라 노출 0 이지만, 미발행 글이 하나 생기는 순간 같은 구멍이 된다.
-- display_only 와 같은 계약(조용히 아무것도 안 함)을 따른다 — 호출부가 실패를 기대하지 않는다.
CREATE OR REPLACE FUNCTION public.subscribe_article_word_set(p_article_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF EXISTS (SELECT 1 FROM library_articles WHERE id = p_article_id AND display_only) THEN
    RETURN;
  END IF;

  -- ★ 2026-08-14 추가: DEFINER 라 RLS 가 안 걸린다 — 원본 발행 게이트를 직접 건다.
  IF NOT EXISTS (
    SELECT 1 FROM library_articles
    WHERE id = p_article_id AND status = 'published' AND copyright_safe_in_kr
  ) THEN
    RETURN;
  END IF;

  INSERT INTO user_word_set_subscriptions (user_id, set_id)
  SELECT v_uid, sws.id
    FROM shared_word_sets sws
   WHERE sws.is_published = true
     AND sws.category = 'library_article'
     AND sws.curation_query->>'article_id' = p_article_id::text
  ON CONFLICT (user_id, set_id) DO NOTHING;

  INSERT INTO vocabularies (
    user_id, word, meaning, example_sentence,
    pronunciation, pos, cefr_level, origin, shared_set_id
  )
  SELECT
    v_uid, sw.word, sw.meaning_ko, sw.example_en,
    sw.pronunciation, sw.part_of_speech, sw.cefr_level, 'shared_set', sw.set_id
  FROM shared_words sw
   JOIN shared_word_sets sws ON sws.id = sw.set_id
  WHERE sws.is_published = true
    AND sws.category = 'library_article'
    AND sws.curation_query->>'article_id' = p_article_id::text
  ON CONFLICT (user_id, word) DO NOTHING;
END $function$;
