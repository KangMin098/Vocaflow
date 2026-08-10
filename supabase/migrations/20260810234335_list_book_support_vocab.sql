-- 20260811110000_list_book_support_vocab.sql
-- ADR 0004 D5 — 책 고유 어휘를 "읽기 지원" 으로 제시.
--
-- 문제: Treasure Island 의 crosstrees·keelhauling·deadlight·handspike·afterdeck 같은 항해어는
--   읽기 중 탭하면 뜻이 나오지만(lookup_word_meaning), shared_dictionary 미등재라
--   챕터 단어장·플래시카드·ScriptQuiz 에는 없다. 이 어휘야말로 이 책을 읽게 만드는 말인데
--   학습자가 "이 책에 이런 말이 나온다" 를 미리 훑을 방법이 없다.
--
-- ⚠️ 설계 변경 — shared_word_sets 를 쓰지 않는다.
--   ADR 0004 초안 D5 는 `library_book_support` 카테고리의 word set 발행이었다. 그런데
--   shared_word_sets 의 의미론 자체가 "구독 가능한 학습 목록"이다:
--     · user_word_set_subscriptions 로 구독되고
--     · 구독하면 vocabularies 로 들어가 FSRS 스케줄을 탄다
--   D5 의 요구는 정확히 그 반대(외울 대상 아님, 참고용)라, set 으로 만든 뒤
--   /library/vocab 목록·추천 RPC·구독 액션 세 곳에 "이건 set 이지만 set 처럼 굴면 안 됨"
--   예외를 다는 꼴이 된다. 모델과 싸우는 구조다.
--   → **읽기 전용 RPC + 책 상세의 접힌 패널**로 간다. 새 테이블·세트 행·예외 가드 0.
--
-- 품질 게이트 (뜻이 lexicon_clean 자동 번역이라 그대로 노출하면 안 된다):
--   · 길이 4자 이상 (em·ho·un 같은 2자 토큰 제외 — ho→"홀뮴", un→"국제연합" 오역)
--   · 책 내 2회 이상 (hapax 제외)
--   · resolved_via='coverage-clean' + lang='en' (고어/방언/외국어는 다른 경로 소관)
--   · noise_kind 없음 (인명·지명 제외)
--   · 뜻이 4~90자 + 한글 포함 + 구두점으로 시작 안 함 + 다의어 나열 패턴 아님
--   실측: 이 게이트로 Treasure Island 27건(mutineer·cutlas·deadlight·crosstrees·handspike
--         ·keelhauling·oilskin·pannikin·afterdeck …), Sociology 277 · Dialogues 148 ·
--         Les Misérables 133 · Gibbon 103.
--   게이트 후에도 "seafaring→물로 여행하다" 처럼 거친 번역이 ~18% 남는다. 그래서 UI 문구를
--   "외울 단어가 아니라 읽을 때 참고" 로 명확히 한다.
--
-- RLS: SECURITY INVOKER(기본) — library_book_vocabularies 의 read_vocab_via_published 정책이
--   발행+저작권안전 도서만 읽게 하므로 학습자 호출이 그대로 안전하다.

CREATE OR REPLACE FUNCTION public.list_book_support_vocab(
  p_book_id uuid,
  p_limit   integer DEFAULT 60
)
RETURNS TABLE(word text, meaning_ko text, occurrences integer, first_sentence text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
SET statement_timeout TO '15000'
AS $function$
  WITH cand AS (
    SELECT lower(trim(v.word))                      AS w,
           SUM(COALESCE(v.frequency_in_book, 1))::int AS occ,
           MIN(v.first_sentence)                    AS fs
    FROM library_book_vocabularies v
    WHERE v.library_book_id = p_book_id
      AND v.lemma IS NULL
      AND v.noise_kind IS NULL
      AND COALESCE(v.resolved_via, 'not_found') = 'coverage-clean'
      AND COALESCE(v.resolved_lang, 'en') = 'en'
      AND v.word ~ '^[a-z][a-z''-]{3,}$'
    GROUP BY 1
    HAVING SUM(COALESCE(v.frequency_in_book, 1)) >= 2
  )
  SELECT c.w, l.meaning_ko, c.occ, c.fs
  FROM cand c
  JOIN lexicon_clean l ON l.word = c.w AND l.lang = 'en'
  WHERE l.meaning_ko IS NOT NULL
    AND length(l.meaning_ko) BETWEEN 4 AND 90
    AND l.meaning_ko ~ '[가-힣]'
    AND l.meaning_ko !~ '^[[:punct:][:space:]]'
    AND l.meaning_ko !~ '참조|노래하다|꼬마 도깨비|1차 및'
  ORDER BY c.occ DESC, c.w
  LIMIT GREATEST(1, LEAST(p_limit, 200));
$function$;

COMMENT ON FUNCTION public.list_book_support_vocab(uuid, integer) IS
  'ADR 0004 D5 — 책 고유 어휘(사전 미등재이나 lexicon_clean 으로 해석되는 말) 읽기 지원 목록. 학습 목표 아님 — FSRS·퀴즈 대상 아니고 구독 개념도 없다. 책 상세의 접힌 패널 전용.';

GRANT EXECUTE ON FUNCTION public.list_book_support_vocab(uuid, integer) TO anon, authenticated;
