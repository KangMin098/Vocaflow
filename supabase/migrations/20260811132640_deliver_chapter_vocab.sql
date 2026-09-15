-- 20260811132640_deliver_chapter_vocab.sql
-- L2 개인화 전달 계층 — "이 학습자에게 이 챕터에서 지금 몇 개, 무엇을".
--
-- 왜 새 계층인가 (79권 실측):
--   같은 챕터 세트가 경로마다 다른 정책으로 전달되고 있었다 —
--     · enroll(_enroll_book_subscribe_word_sets): 책 전체 50개 · v±1 · 챕터 무관
--         → Les Misérables 364챕터를 등록해도 평생 50단어. 챕터 30을 읽을 때 그 챕터 단어가 없다.
--     · 세트 구독 버튼(actions.ts): 세트 전량 · 레벨 필터 없음 · 기보유 제외 없음
--         → V6 학습자가 V8 도서 세트를 구독하면 V11 단어까지 그대로 받는다.
--     · 리더 i+1 패널(extract_vocabulary_for_user): 가장 좋은 로직인데 표시 전용, FSRS 와 단절.
--
--   그리고 발행 cap 40 은 챕터 길이를 무시한다. 993챕터 실측:
--       밀도 2% 초과(과부하) 241 (24%)  ·  0.3% 미만(희박) 130 (13%)
--       1,000단어 챕터 22.6개/1000  vs  12,000단어 챕터 1.4개/1000  = 16배 격차
--   인지부하(Sweller)와 이해 커버리지(Nation 98%)는 개수가 아니라 밀도로 결정된다.
--
-- 설계: 계층을 나눈다.
--   L1 콘텐츠 = shared_words (사용자 무관·캐시 가능한 정제 후보 풀. 기존 발행 그대로)
--   L2 전달   = 이 함수 (학습자별 분량·선별. 매 호출 재계산, 저장은 p_commit 일 때만)
--   cap 40 이 두 역할을 겸하던 것을 분리하는 게 핵심이다.
--
-- 분량 공식: target = clamp(round(chapter_word_count / 1000 * 8), 8, 30)
--   · 0.8%/1000단어 — 실측 중앙 밀도 1.14% 보다 낮게 잡아 과부하 241챕터를 걷어낸다.
--   · 하한 8 — p10(477단어) 챕터도 학습 가치를 남긴다.
--   · 상한 30 — extract_vocabulary_for_user 의 auto_n 상한과 같은 값. 한 챕터 30 초과는
--     작업기억 한계상 의미가 없고, UI 의 DAILY_NEW=22 안내와도 어긋나지 않는다.
--   실측(Les Misérables): ch1 1,067단어→9 · ch20 2,141→17 · ch100 6,425→30 · ch50 316→8(하한)
--
-- 점수: extract_vocabulary_for_user 와 같은 공식을 쓴다 (두 화면이 다른 순서를 보이면 안 된다).
--   0.50*i+1근접 + 0.25*트랙 + 0.15*빈도 + skill/고어 페널티
--   실측 개인화 확인 — Treasure Island(V7) 챕터1에서
--     미진단 학습자(도서 폴백 V7): grumbling(V8) "i+1 — 지금 딱 한 걸음" 이 1위
--     V11 학습자:                 magistrate(V9) "쉬운 편 — 빈틈 메우기" 가 1위
--
-- 되돌리기: p_commit=false(기본)면 읽기 전용 — 몇 번 호출해도 부작용이 없다.
--   p_commit=true 는 vocabularies INSERT ... ON CONFLICT DO NOTHING 이라 재실행 안전(멱등).
--   기존 세 경로는 이 마이그레이션에서 건드리지 않는다 — 배선은 UI 전환과 함께 별도 커밋.

CREATE OR REPLACE FUNCTION public.deliver_chapter_vocab(
  p_book_id      uuid,
  p_chapter_idx  integer,
  p_commit       boolean DEFAULT false
)
RETURNS TABLE(
  word text, meaning_ko text, source_sentence text, example_en text,
  pronunciation text, part_of_speech text, cefr_level text, v_level smallint,
  composite_score numeric, reason text, delivered_rank integer,
  target_count integer, pool_size integer, chapter_word_count integer,
  effective_v_level smallint, level_source text
)
LANGUAGE plpgsql
VOLATILE
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

  -- 레벨 근거: 진단값 → 도서 레벨 → 5. V0 = 미진단이므로 NULLIF 로 흘려보낸다.
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

  -- 밀도 기반 분량 (위 주석). word_count 미상이면 중앙 챕터(1,706단어) 기준 14.
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
      -- 이미 보유한 단어 제외 — 다시 주는 것은 학습이 아니라 소음이다
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

  -- 저장은 명시적으로 요구할 때만. 멱등(ON CONFLICT DO NOTHING).
  IF p_commit THEN
    INSERT INTO vocabularies (user_id, word, meaning, example_sentence,
                              pronunciation, pos, cefr_level, origin, shared_set_id)
    SELECT v_user, d.word, d.meaning_ko, COALESCE(d.source_sentence, d.example_en),
           d.pronunciation, d.part_of_speech, d.cefr_level, 'shared_set',
           (SELECT s.id FROM shared_word_sets s
             WHERE s.curation_query->>'book_id' = p_book_id::text
               AND (s.curation_query->>'chapter_idx')::int = p_chapter_idx
             LIMIT 1)
    FROM public.deliver_chapter_vocab(p_book_id, p_chapter_idx, false) d
    ON CONFLICT (user_id, word) DO NOTHING;
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.deliver_chapter_vocab(uuid, integer, boolean) IS
  'L2 개인화 전달 — 챕터 정제 후보 풀에서 학습자 i+1·기보유 제외·밀도 기반 분량(8~30)으로 선별. p_commit=false 는 읽기 전용.';

REVOKE ALL ON FUNCTION public.deliver_chapter_vocab(uuid, integer, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.deliver_chapter_vocab(uuid, integer, boolean) TO authenticated;
