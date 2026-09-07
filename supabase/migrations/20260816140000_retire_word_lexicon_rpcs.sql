-- supabase/migrations/20260816140000_retire_word_lexicon_rpcs.sql
--
-- `word_lexicon` 을 참조하는 마지막 RPC 2개를 **은퇴시킨다. 테이블을 복원하지 않는다.**
--
-- ⚠️ 이 마이그레이션의 요점은 "복원하지 않는다" 는 결정 자체다.
--    `20260719161409_drop_unused_empty_tables` 로 사라진 13개 중 5개는 복원이 정답이었고
--    실제로 복원했다(`word_familiarity` · `csat_item_attempts` · `vocab_raw_texts` ·
--    `classes`/`class_members` · `pending_words`). 그래서 남은 하나도 복원하면 될 것처럼 보인다.
--    **여기서는 복원이 데이터를 파괴한다.**
--
-- 왜 복원이 위험한가 (2026-08-16 실측):
--
--   `regenerate_auto_curated_set(uuid)` 의 본문 순서는 이렇다:
--       ① DELETE FROM shared_words WHERE set_id = p_set_id;
--       ② INSERT INTO shared_words SELECT ... FROM word_lexicon wl JOIN ...
--
--   지금은 ②에서 42P01(relation does not exist)이 나고 트랜잭션이 통째로 롤백된다 —
--   **시끄럽게 실패하므로 안전하다.** 그런데 누군가 "미해결 목록" 을 보고 빈 `word_lexicon`
--   을 복원하면, ②는 후보 0건으로 **정상 종료**한다. 그러면 ①의 DELETE 가 커밋되고
--   `word_count = 0` 으로 업데이트된다. 오류도 경고도 없다.
--   → 조용한 실패가 되는 순간 **shared_words 76,503행 / 1,333세트**가 사라진다.
--     (전체 shared_words 81,413행의 94%)
--
-- 게다가 이 함수는 이미 **의미를 잃었다**:
--   · 복원해도 매핑이 불가능하다 — `lexicon_source_tags(lexicon_id, source, metadata, added_at)`
--     와 `word_frequency_stats` 에 **lemma 가 없다**. 각 5,421행의 `lexicon_id` 는 사라진
--     테이블을 가리키는 고아 키라 단어로 되돌릴 방법이 DB 안에 없다.
--   · `shared_words` 81,413행 중 `lexicon_id` 를 가진 것은 **1,402행뿐**이다. 나머지 98%는
--     애초에 이 경로로 만들어지지 않았다 — 재생성해도 복구되지 않는다.
--   · `auto_curated` / `curation_query` 는 **용도가 바뀌었다.** 이 함수가 기대하는 KICE 필터
--     모양(`filters.raw_count_min` 등)은 24세트뿐이고, **1,129세트는 도서-챕터 모양**
--     (`{book_id, chapter_idx, filter:'select_book_chapter_vocab'}`)이다. 그쪽은
--     `deliver_chapter_vocab` 계열이 담당하며 이 함수와 아무 관계가 없다.
--
-- 호출자: 없다(앱·스크립트 전수 grep — `packages/types/src/database.ts` 의 생성된 타입 선언뿐).
--
-- 그래서: 함수를 지우지 않고 **본문만 명시적 은퇴로 바꾼다.**
--   · DROP 하지 않는 이유 — 생성된 타입(`database.ts`)과 어긋나고, 호출 시 메시지가
--     "함수 없음" 이라 왜 없어졌는지 알 수 없다.
--   · 본문을 RAISE 로 바꾸면 **word_lexicon 이 나중에 복원되더라도 이 함수는 영원히 안전하다.**
--     이 마이그레이션이 제거하는 것은 버그가 아니라 **지뢰**다.
--
-- 순수 안전화 — 테이블·데이터 변경 없음(함수 본문 1개 교체 + 고아 트리거 함수 1개 삭제).

CREATE OR REPLACE FUNCTION public.regenerate_auto_curated_set(p_set_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- 은퇴(20260816140000). 원본은 word_lexicon 에서 shared_words 를 재생성했으나,
  -- ① word_lexicon 이 없고 ② lexicon_source_tags/word_frequency_stats 에 lemma 가 없어
  -- 매핑 복원이 불가능하며 ③ auto_curated 세트의 대부분(1,129/1,333)은 이제 도서-챕터
  -- 세트라 이 함수의 필터 모양과 무관하다.
  --
  -- 무엇보다, 원본은 DELETE 를 먼저 하고 INSERT 를 나중에 한다. word_lexicon 이 빈 채로
  -- 복원되면 오류 없이 shared_words 76,503행이 지워진다. 그 경로를 영구히 막는다.
  RAISE EXCEPTION
    'regenerate_auto_curated_set is RETIRED (20260816140000). '
    'word_lexicon is gone and cannot be remapped (lexicon_source_tags has no lemma). '
    'Restoring word_lexicon would make this function DELETE ~76,503 shared_words silently. '
    'Book-chapter sets are owned by deliver_chapter_vocab instead. Set id was: %', p_set_id;
END;
$function$;

COMMENT ON FUNCTION public.regenerate_auto_curated_set(uuid) IS
  '은퇴(20260816140000). 호출 시 예외. word_lexicon 복원 시 shared_words 대량 삭제를 막는 가드.';

-- 고아 트리거 함수 — 붙어 있던 word_lexicon 이 없어 영원히 발화할 수 없다.
-- (본문이 RAISE 뿐이라 위험하지는 않았지만, 남겨 두면 "참조 중인 RPC" 목록을 계속 오염시킨다.)
DROP FUNCTION IF EXISTS public.reject_word_lexicon_insert();
