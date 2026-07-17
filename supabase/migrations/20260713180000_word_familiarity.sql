-- 20260713180000_word_familiarity.sql
-- 2단계 "틀려도 괜찮게" — 학습자 "알아요/몰라요" 판정 저장.
--   목적: (1) 학습자가 추출을 직접 교정(알아요→향후 추출 제외) (2) 오난이도 신호 수집
--     (고-V 단어를 많은 학습자가 '안다' = 과대난이도 / 저-V를 '모른다' = 과소난이도).
--   lemma(표제어) 단위로 저장 → 형태 무관 일관.

CREATE TABLE IF NOT EXISTS public.word_familiarity (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lemma      text NOT NULL,
  verdict    text NOT NULL CHECK (verdict IN ('known','unknown')),
  v_level    smallint,               -- 판정 당시 시스템 난이도 (오난이도 신호용)
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

-- upsert RPC (auth.uid() = 호출 학습자)
CREATE OR REPLACE FUNCTION public.set_word_familiarity(p_lemma text, p_verdict text, p_v_level smallint DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $function$
  INSERT INTO public.word_familiarity(user_id, lemma, verdict, v_level, updated_at)
  VALUES (auth.uid(), lower(trim(p_lemma)), p_verdict, p_v_level, now())
  ON CONFLICT (user_id, lemma) DO UPDATE
    SET verdict = EXCLUDED.verdict, v_level = COALESCE(EXCLUDED.v_level, public.word_familiarity.v_level), updated_at = now();
$function$;
REVOKE ALL ON FUNCTION public.set_word_familiarity(text, text, smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_word_familiarity(text, text, smallint) TO authenticated;

-- 오난이도 집계 뷰 (관리/분석용) — 여러 학습자 판정 종합
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
