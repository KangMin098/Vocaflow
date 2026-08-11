-- supabase/migrations/20260812093000_restore_word_familiarity.sql
--
-- 20260719161409_drop_unused_empty_tables 가 "빈 테이블 정리" 로 13개를 CASCADE 삭제했는데,
-- word_familiarity 는 비어 있었을 뿐 **미사용이 아니었다** — extract_vocabulary_for_user_v2 와
-- set_word_familiarity 가 참조하고 있었고, 함수는 CASCADE 대상이 아니라 살아남았다.
-- 결과:
--   · 학습자 스크립트 추출(/text/new → ExtractionPanel)이 원시 Postgres 에러로 막힘
--   · 알아요/몰라요 판정이 **성공한 것처럼 보이며 유실** (rpc 는 throw 하지 않고 {error} 를
--     반환하는데 호출부에 error 검사가 없다 — ExtractionPanel.tsx:258)
--
-- 원본 DDL(20260715224958)을 그대로 복원한다. RPC 2개는 살아 있어 재생성하지 않는다.
-- 데이터 손실 없는 순수 추가이며, 원래 0행이었으므로 복원 후에도 0행이다.
--
-- 검증(적용 시점 실측):
--   · extract_vocabulary_for_user_v2 5단어 호출 → 2행 반환 (이전에는 relation 부재로 실패)
--   · ON CONFLICT (user_id, lemma) upsert · CHECK(verdict) · v_level COALESCE 보존 확인
--
-- ⚠️ 같은 마이그레이션이 지운 나머지 테이블 중 5개도 여전히 코드/RPC 에 참조돼 있다
--    (vocab_raw_texts · word_lexicon · classes · class_members · pending_words ·
--     csat_item_attempts). 각각 별도 판단이 필요하다 — 이 마이그레이션은 word_familiarity 만 다룬다.

CREATE TABLE IF NOT EXISTS public.word_familiarity (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lemma      text NOT NULL,
  verdict    text NOT NULL CHECK (verdict IN ('known','unknown')),
  v_level    smallint,
  source     text NOT NULL DEFAULT 'extract',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lemma)
);
COMMENT ON TABLE public.word_familiarity IS '학습자 알아요/몰라요 판정 — 추출 교정 + 오난이도 신호. lemma 단위.';
CREATE INDEX IF NOT EXISTS idx_wf_lemma_verdict ON public.word_familiarity(lemma, verdict);

ALTER TABLE public.word_familiarity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wf_own ON public.word_familiarity;
CREATE POLICY wf_own ON public.word_familiarity FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE VIEW public.word_mislevel_signal AS
SELECT wf.lemma,
  count(*) FILTER (WHERE wf.verdict='known')   AS known_ct,
  count(*) FILTER (WHERE wf.verdict='unknown') AS unknown_ct,
  round(avg(wf.v_level) FILTER (WHERE wf.verdict='known'), 1)   AS known_avg_v,
  round(avg(wf.v_level) FILTER (WHERE wf.verdict='unknown'), 1) AS unknown_avg_v,
  d.v_level AS dict_v_level
FROM public.word_familiarity wf
LEFT JOIN public.shared_dictionary d ON d.word = wf.lemma
GROUP BY wf.lemma, d.v_level;
COMMENT ON VIEW public.word_mislevel_signal IS '오난이도 신호: known_ct 높고 dict_v_level 높음=과대난이도 후보 / unknown_ct 높고 dict_v_level 낮음=과소난이도.';
