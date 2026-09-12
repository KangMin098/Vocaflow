-- supabase/migrations/20260808200000_comic_gen_models.sql
--
-- CCP 이미지 생성 모델 레지스트리 — 시장 조사 기반 모델 카탈로그(선택·비교·테스트).
--   백엔드/호스팅/비용/능력(다중참조·텍스트제어·캐릭터/화풍 일관성·4090 적합)·comic 적합도·상태.
--   테스트 모드가 이 카탈로그에서 모델을 선택. RLS admin. 적용: 사용자 승인 후.

CREATE TABLE IF NOT EXISTS comic_gen_models (
  key                text PRIMARY KEY,          -- 'gpt-image-2' | 'flux2-dev' | 'qwen-image-2512' ...
  name               text NOT NULL,
  provider           text,
  site               text,                      -- 'openai-api' | 'runpod-comfyui' | 'dashscope' | 'replicate' | 'fal'
  hosting            text CHECK (hosting IS NULL OR hosting IN ('api','self-host','hybrid')),
  cost_per_image_usd numeric,
  cost_note          text,
  multiref           boolean,                   -- 다중 참조 이미지 조건화
  text_control       text,                      -- 'none'|'weak'|'strong' (텍스트-free 제어)
  char_consistency   text,                      -- 'low'|'medium'|'high'
  style_consistency  text,
  vram_fit_4090      boolean,                   -- 24GB 자가호스트 적합(self-host)
  license            text,
  comic_fit          int,                       -- 0-100 우리 만화 용도 적합도
  strengths          text,
  weaknesses         text,
  source_url         text,
  status             text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','testing','adopted','rejected')),
  sort               int NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cgm_fit ON comic_gen_models (comic_fit DESC NULLS LAST);
CREATE TRIGGER trg_cgm_updated BEFORE UPDATE ON comic_gen_models FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE comic_gen_models ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_curator_cgm_models ON comic_gen_models;
CREATE POLICY admin_curator_cgm_models ON comic_gen_models FOR ALL
  USING (is_admin_or_curator()) WITH CHECK (is_admin_or_curator());

COMMENT ON TABLE comic_gen_models IS 'CCP 이미지 생성 모델 레지스트리 — 시장 조사 카탈로그(선택/비교/테스트)';
