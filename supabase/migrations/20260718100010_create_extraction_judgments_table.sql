-- D2: 판정 하네스(Q3/Q5) 골든 라벨 저장소. composite/sort_order 스냅샷 보존 → 가중 변경 회귀 대조.
-- 근거: docs/AI_CONTEXT/diagnostics/ext_quality_p0_20260718.md §5
-- RLS enabled(정책 없음 = service_role/DEFINER 외 잠금). admin read/write 정책은 하네스 UI(D3) 착수 시 추가.

CREATE TABLE IF NOT EXISTS public.extraction_judgments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind   text NOT NULL CHECK (source_kind IN ('book','article')),
  source_id     uuid NOT NULL,
  chapter_idx   integer,
  word          text NOT NULL,
  headword      text NOT NULL,
  in_cap        boolean NOT NULL,
  sort_order_at integer NOT NULL,
  composite_at  numeric NOT NULL,
  v_level_at    smallint,
  verdict       text NOT NULL CHECK (verdict IN ('valuable','not_valuable','uncertain')),
  judge_kind    text NOT NULL DEFAULT 'human' CHECK (judge_kind IN ('human','llm')),
  mode          text NOT NULL DEFAULT 'absolute' CHECK (mode IN ('absolute','pairwise')),
  pair_word     text,
  pair_wins     boolean,
  judged_by     uuid,
  judged_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ej_source ON public.extraction_judgments(source_kind, source_id, chapter_idx);
CREATE INDEX IF NOT EXISTS idx_ej_word   ON public.extraction_judgments(lower(word));

COMMENT ON TABLE public.extraction_judgments IS 'Q3/Q5 판정 하네스 골든 라벨. blind in-cap/out-of-cap 판정 축적 → precision@40 + 추출 가중 변경 회귀 대조.';

ALTER TABLE public.extraction_judgments ENABLE ROW LEVEL SECURITY;
