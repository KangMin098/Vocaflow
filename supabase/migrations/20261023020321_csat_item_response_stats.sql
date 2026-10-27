CREATE TABLE public.csat_item_response_stats (
  exam_id                text        NOT NULL REFERENCES public.csat_exams (id),
  no                     smallint    NOT NULL CHECK (no BETWEEN 1 AND 45),
  source_id              text        NOT NULL CHECK (source_id IN ('megastudy')),
  correct_rate           numeric     NOT NULL CHECK (correct_rate BETWEEN 0 AND 1),
  choice_rates           numeric[]   NOT NULL CHECK (array_length(choice_rates, 1) = 5),
  unreported_choice_rate numeric     CHECK (unreported_choice_rate BETWEEN 0 AND 1),
  difficulty             text,
  points                 smallint    CHECK (points BETWEEN 1 AND 4),
  answer                 smallint    CHECK (answer BETWEEN 1 AND 5),
  paper_form             text        CHECK (paper_form IN ('odd', 'even')),
  verified               boolean     NOT NULL DEFAULT true,
  source_exam_ref        text,
  retrieved_at           date        NOT NULL,
  PRIMARY KEY (exam_id, no, source_id)
);

COMMENT ON TABLE public.csat_item_response_stats IS
  '출처별 문항 응답 통계(사설 응답자 집계 · 공식값 아님). 오답률 = 1 - correct_rate. 적재: scripts/csat/rates/import-megastudy.mjs';

ALTER TABLE public.csat_item_response_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY csat_item_response_stats_read ON public.csat_item_response_stats FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.csat_item_response_stats FROM anon, authenticated;
GRANT SELECT ON public.csat_item_response_stats TO authenticated;