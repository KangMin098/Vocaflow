-- 20260717140000_word_roots.sql — 어원(root) 축 신설
-- 시중 어원 단어장 대응 + 추출 파생어 인식·니모닉 이중배당. reference 데이터(공개 표준 어근).
CREATE TABLE IF NOT EXISTS public.word_roots (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  root       text NOT NULL UNIQUE,          -- 정규형 (예: 'spec', 'port', 'dict')
  origin     text NOT NULL CHECK (origin IN ('latin','greek','other')),
  meaning_en text NOT NULL,                 -- 'to look, see'
  gloss_ko   text NOT NULL,                 -- '보다'
  variants   text[] DEFAULT '{}',           -- 이형 (spec/spect/spic)
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.word_roots IS '라틴/그리스 어근 인벤토리 — 어원 단어장 축 + 파생어 인식. 공개 표준 어근(무저작권).';

CREATE TABLE IF NOT EXISTS public.word_root_links (
  word       text NOT NULL,                 -- shared_dictionary.word 대응
  root_id    bigint NOT NULL REFERENCES public.word_roots(id) ON DELETE CASCADE,
  affix_type text NOT NULL DEFAULT 'root' CHECK (affix_type IN ('prefix','root','suffix')),
  confidence smallint,                      -- 매핑 신뢰(1-5), 검수용
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (word, root_id)               -- 자연 멱등 (한 단어 다중 root 허용)
);
CREATE INDEX IF NOT EXISTS idx_wrl_root ON public.word_root_links(root_id);
COMMENT ON TABLE public.word_root_links IS '단어↔어근 매핑. (word,root_id) PK로 멱등. 한 단어가 여러 어근 가능(con+struct).';

-- RLS: reference 데이터 = 공개 읽기, 쓰기는 service_role만(RLS 우회)
ALTER TABLE public.word_roots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.word_root_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wr_read ON public.word_roots;
CREATE POLICY wr_read ON public.word_roots FOR SELECT USING (true);
DROP POLICY IF EXISTS wrl_read ON public.word_root_links;
CREATE POLICY wrl_read ON public.word_root_links FOR SELECT USING (true);
