-- 20260811135625_commit_chapter_vocab.sql
-- deliver_chapter_vocab 의 commit 경로 버그 수정 — 출력 파라미터 이름 충돌.
--
-- 증상: p_commit=true 로 부르면
--     ERROR 42702: column reference "word" is ambiguous
--     DETAIL: It could refer to either a PL/pgSQL variable or a table column.
--   RETURNS TABLE(word text, ...) 의 `word` 가 함수 스코프의 변수라, INSERT 의 컬럼
--   리스트와 ON CONFLICT (user_id, word) 에서 컬럼과 구별되지 않는다.
--   런타임에만 터지므로 정적 검사로는 안 잡히고, 클라이언트가 예외를 삼키면
--   "담았어요" 를 보여주면서 실제로는 아무것도 저장하지 않는다 — 이 함수가 없애려던
--   바로 그 "표시 전용" 결함을 스스로 재현한 셈이다.
--   e2e DB 단언(tests/e2e/16-chapter-vocab-delivery.spec.ts)이 잡았다.
--
-- 수정: #variable_conflict 지시자로 덮는 대신 쓰기를 별도 함수로 분리한다.
--   · 출력 파라미터가 없으니 모호성이 원천적으로 생기지 않는다
--   · 자기 자신을 재귀 호출하지 않아 읽기 경로가 단순해진다 (STABLE 로 승격)
--   · 삽입 건수를 돌려주므로 클라이언트가 성공을 확인할 수 있다 —
--     건수를 안 돌려주면 호출부가 또 낙관적으로 성공을 표시하게 된다

DROP FUNCTION IF EXISTS public.deliver_chapter_vocab(uuid, integer, boolean);

CREATE OR REPLACE FUNCTION public.deliver_chapter_vocab(
  p_book_id      uuid,
  p_chapter_idx  integer
)
RETURNS TABLE(
  word text, meaning_ko text, source_sentence text, example_en text,
  pronunciation text, part_of_speech text, cefr_level text, v_level smallint,
  composite_score numeric, reason text, delivered_rank integer,
  target_count integer, pool_size integer, chapter_word_count integer,
  effective_v_level smallint, level_source text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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

COMMENT ON FUNCTION public.deliver_chapter_vocab(uuid, integer) IS
  'L2 개인화 전달(읽기 전용) — 챕터 후보 풀에서 기보유 제외 + i+1 재랭킹 + 밀도 기반 분량(8~30). 담기는 commit_chapter_vocab.';

CREATE OR REPLACE FUNCTION public.commit_chapter_vocab(
  p_book_id      uuid,
  p_chapter_idx  integer
)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_set  uuid;
  v_n    integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다'; END IF;

  SELECT s.id INTO v_set FROM shared_word_sets s
   WHERE s.curation_query->>'book_id' = p_book_id::text
     AND (s.curation_query->>'chapter_idx')::int = p_chapter_idx
   LIMIT 1;

  WITH ins AS (
    INSERT INTO vocabularies (user_id, word, meaning, example_sentence,
                              pronunciation, pos, cefr_level, origin, shared_set_id)
    SELECT v_user, d.word, d.meaning_ko, COALESCE(d.source_sentence, d.example_en),
           d.pronunciation, d.part_of_speech, d.cefr_level, 'shared_set', v_set
    FROM public.deliver_chapter_vocab(p_book_id, p_chapter_idx) d
    ON CONFLICT (user_id, word) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int INTO v_n FROM ins;

  RETURN v_n;
END;
$function$;

COMMENT ON FUNCTION public.commit_chapter_vocab(uuid, integer) IS
  'L2 전달 결과를 vocabularies 에 담는다(멱등). 삽입 건수를 반환 — 호출부가 성공을 확인할 수 있게.';

REVOKE ALL ON FUNCTION public.deliver_chapter_vocab(uuid, integer) FROM public;
REVOKE ALL ON FUNCTION public.commit_chapter_vocab(uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.deliver_chapter_vocab(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.commit_chapter_vocab(uuid, integer) TO authenticated;
