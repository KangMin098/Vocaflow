-- supabase/migrations/20260905160000_shared_words_pronunciation_sync.sql
--
-- **발음이 없는 게 아니라 옆 칸에 있었다.**
--
-- `shared_words` 에는 발음을 담는 칸이 둘이다 — `ipa` 와 `pronunciation`. 그런데
-- **쓰는 쪽과 읽는 쪽이 서로 다른 칸을 쓴다.**
--
--   쓰는 쪽  `publish_book_word_sets` / `republish_book_word_sets` — 둘 다 어느 칸도 안 넣는다
--            (도서 세트의 `ipa` 는 별도 백필로 채워졌다)
--            `vcb/compose/publish.ts` — `pronunciation` 과 `ipa` **둘 다** 넣는다
--   읽는 쪽  `workspace/scoped-words.ts` · `game/record-result.ts` · `deliver_chapter_vocab`
--            — 전부 **`pronunciation` 만** select 한다. `shared_words.ipa` 를 읽는
--            학습자 코드는 저장소에 **0곳**(전수 확인).
--
-- 실측 2026-09-05 (`shared_words` 681,021행):
--   `ipa` 보유 645,300 (94.8%) · `pronunciation` 보유 44,897 (6.6%)
--   → **603,311행이 옆 칸을 베끼기만 하면 채워진다.**
--
-- 학습자에게 보이는 것: `CardFront.tsx:63` · `CardBack.tsx:38` · `RecallCard.tsx:156` ·
-- `spellforge/MeaningDisplay.tsx:53` 의 발음 줄이 빈 문자열이다. 데이터가 없어서가 아니라
-- 같은 행 옆 칸에 있어서다. 게다가 `commit_chapter_vocab` 이 이 값을 `vocabularies` 로
-- 복사하므로, 챕터에서 담은 단어는 **영구히** 발음이 없다(실측 `origin='library'` 542행 전부).
--
-- ── 왜 RPC 를 고치지 않고 트리거를 두나 ──────────────────────────────
-- 쓰는 쪽이 넷이고(두 RPC + 컴포저 + 백필 스크립트) 앞으로 더 늘어난다. 계약을 각자
-- 정하게 두면 **반드시 다시 어긋난다** — 이 결함이 그 증거다. 그래서 정합을 한 곳,
-- 테이블에 둔다. 한쪽만 있으면 다른 쪽을 채우고, 둘 다 있으면 건드리지 않는다.
--
-- ⚠️ 값을 **만들어 내지 않는다.** 없는 발음을 지어내는 것이 아니라 같은 행의 같은 값을
--    옮겨 적을 뿐이다. 그래서 되돌리기도 쉽다(트리거를 지우고 백필을 NULL 로 되돌리면 된다).
--
-- 기존 603,311행 백필은 여기서 하지 않는다 — `scripts/dict/backfill-pronunciation.mts`
-- 가 배치로 돌린다. 마이그레이션 안에서 60만 행을 한 문장으로 갱신하면 잠금이 길어지고,
-- 바로 앞서 DB 계층이 한 번 넘어간 뒤라 더 그렇다.

CREATE OR REPLACE FUNCTION public.trg_shared_words_sync_pronunciation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.pronunciation IS NULL OR btrim(NEW.pronunciation) = '' THEN
    IF NEW.ipa IS NOT NULL AND btrim(NEW.ipa) <> '' THEN
      NEW.pronunciation := NEW.ipa;
    END IF;
  ELSIF NEW.ipa IS NULL OR btrim(NEW.ipa) = '' THEN
    NEW.ipa := NEW.pronunciation;
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.trg_shared_words_sync_pronunciation() IS
  '발음 두 칸(ipa · pronunciation)의 정합. 쓰는 쪽이 넷이라 계약을 테이블에 둔다. '
  '한쪽만 있으면 다른 쪽을 채우고, 둘 다 있으면 건드리지 않는다. 값을 만들어 내지 않는다.';

DROP TRIGGER IF EXISTS shared_words_sync_pronunciation ON public.shared_words;
CREATE TRIGGER shared_words_sync_pronunciation
  BEFORE INSERT OR UPDATE OF ipa, pronunciation ON public.shared_words
  FOR EACH ROW EXECUTE FUNCTION public.trg_shared_words_sync_pronunciation();
