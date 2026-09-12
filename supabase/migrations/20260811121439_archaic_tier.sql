-- 20260811121439_archaic_tier.sql
-- archaic_dictionary(810건)를 lookup_word_meaning 티어에 연결 — 만들어놓고 소비 경로가 없던 자산.
--
-- 실태: archaic_dictionary 를 참조하는 함수가 3개뿐이고 전부 소비가 아니다 —
--   enforce_archaic_not_in_shared(등재 금지 트리거) · find_derivational_candidates(후보 탐색) ·
--   find_unbound_book_lemmas(진단 라벨). **읽기 중 단어 탭도 학습 세트 선정도 고어 사전을 안 본다.**
--
-- 티어 위치 = dialect **앞** (수기 큐레이션 중 가장 정밀하므로):
--   direct → inflection → variant → cluster → derivation
--   → **archaic(신규)** → dialect → proper_noun 가드 → coverage-clean → …
--
--   dialect 뒤에 두려다 실측으로 뒤집었다. 두 사전이 25건 겹치는데 **14건이 불일치이고
--   전부 archaic 이 정확**하다. dialect_map 은 표제어 결합용이라 base form 만 담아
--   시제·인칭·부정을 버린다:
--       hath   archaic=has      dialect=have      spake  archaic=spoke   dialect=speak
--       didst  archaic=did      dialect=do        holp   archaic=helped  dialect=help
--       tis    archaic="it is"  dialect=be        thine  archaic=yours   dialect=your
--       agin   archaic=against  dialect=again   ← 의미 자체가 다르다
--       couldna archaic=couldn't dialect=could  ← **부정이 사라진다**
--   couldna→could 는 en_negation_preserved 가 잡아야 할 유형인데 dialect_map 경유라 안 걸린다.
--   archaic 을 앞세우면 삭제 없이 무력화된다(dialect_map 은 표제어 결합 용도로 계속 유효).
--
-- 품질 근거 — lexicon_clean 과 596건 겹치는데 archaic 쪽이 압도적이다:
--       superintend  archaic="감독하다, 관리하다"  lexicon="보고 직접"
--       whilst       archaic="동안, ~하는 한편"    lexicon="…황제가 안디옥에 누워 있는 동안. 긴팔 원숭이."
--       cabman       archaic="마차꾼, 마부"        lexicon="생계를 위해 **택시**를 운전하는 사람"
--   cabman→"택시 운전사" 는 시대 배경이 통째로 어긋난다.
--
-- 응답: match_via='archaic', resolved_word=modern_equivalent, word_register='archaic_literary'.
--   modern_equivalent 를 실어 리더가 "whilst = while (고어)" 로 보여줄 수 있게 한다.
--   v_level/cefr/example 은 archaic_dictionary 에 없으므로 NULL (coverage-clean 과 동일 패턴).
--
-- 구현: 함수 본문을 손으로 옮겨쓰지 않는다(티어 14개 장문 — 이전에 normalized/suggestion 을
--   잘못 복원한 전례). pg_get_functiondef 로 원본을 읽어 dialect 티어 **앞에 삽입**하고
--   치환이 실제로 일어났는지 단언한다.

DO $mig$
DECLARE def text; out text; tier text; anchor text;
BEGIN
  def := pg_get_functiondef('public.lookup_word_meaning(text)'::regprocedure);

  anchor :=
    '  RETURN QUERY SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, ''dialect''::text';

  tier :=
    '  RETURN QUERY SELECT true, p_surface, COALESCE(a.modern_equivalent, a.word), a.meaning_ko, a.pos, NULL::text, NULL::smallint, NULL::text, ''archaic''::text, ''archaic_literary''::text, NULL::text, ''en''::text' || E'\n' ||
    '    FROM archaic_dictionary a' || E'\n' ||
    '    WHERE a.word = s AND a.meaning_ko IS NOT NULL AND length(a.meaning_ko) > 0 LIMIT 1;' || E'\n' ||
    '  IF FOUND THEN RETURN; END IF;' || E'\n' || E'\n';

  out := replace(def, anchor, tier || anchor);
  IF out = def THEN RAISE EXCEPTION 'archaic 티어 삽입 실패 — dialect 티어 앵커 불일치'; END IF;

  EXECUTE out;
END $mig$;

COMMENT ON FUNCTION public.lookup_word_meaning(text) IS
  '티어: direct→inflection→variant→cluster→derivation→**archaic**→dialect→proper_noun 가드→coverage-clean→…→not_found. 수기 큐레이션(archaic 810 · dialect 161)이 자동 임포트(lexicon_clean)보다 앞.';
