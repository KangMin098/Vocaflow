-- CTP DCP T2 — csat_dcp_items (공유 배치 order/insert 문항)
-- quiz_questions(user_id·text_id NOT NULL · MC 전용)는 공유 order/insert 에 부적합 → 신규 테이블.
-- payload/answer_key 구조가 MC 와 다름(order: presented[]/source_order · insert: remaining[]/position).
CREATE TABLE public.csat_dcp_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('article','chapter')),
  ref_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('order','insert')),
  item_role text NOT NULL DEFAULT 'practice' CHECK (item_role IN ('practice','verify')),
  payload jsonb NOT NULL,
  answer_key jsonb NOT NULL,
  paragraph_idx int NOT NULL,
  v_level smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, ref_id, type, paragraph_idx)
);
ALTER TABLE public.csat_dcp_items ENABLE ROW LEVEL SECURITY;
-- admin write · 학습자는 RPC 로 answer_key 제외 read (library_chapter_quiz 패턴)
CREATE POLICY dcp_admin ON public.csat_dcp_items FOR ALL
  USING (is_admin_or_curator()) WITH CHECK (is_admin_or_curator());
COMMENT ON TABLE public.csat_dcp_items IS 'CTP DCP T2 — 결정론 order/insert 문항(공유 배치). quiz_questions(per-user·MC)와 별개.';
