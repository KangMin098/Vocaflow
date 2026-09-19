-- supabase/migrations/20260808240000_comic_styles.sql
--
-- CCP 만화 스타일 선택 — 생성 만화의 디자인을 포맷(웹툰/만화)×연령×장르×난이도로 선택.
--   comic_styles: 국내외 딥서치 기반 스타일 프리셋 카탈로그(각 프리셋 = 모델-레디 아트 프롬프트).
--   comic_books.style_key: 도서별 선택된 스타일(생성 드레인이 이 art_prompt 로 생성).
--   RLS admin/curator. 적용: 사용자 승인 후.

CREATE TABLE IF NOT EXISTS comic_styles (
  key             text PRIMARY KEY,          -- 'webtoon-romance-soft' | 'gonick-factual-bw' ...
  name            text NOT NULL,
  format          text,                      -- webtoon | manhwa-page | comic-page | graphic-novel | manga-page
  age_band        text,                      -- kids | teen | all | mature
  genre           text,                      -- romance|action|fantasy|slice-of-life|comedy|thriller|mystery|historical|educational|horror|literary|adventure
  difficulty_min  smallint,                  -- 적합 V-Level 하한(낮을수록 단순 아트·짧은 대사)
  difficulty_max  smallint,
  palette         text,                      -- color | bw | duotone | pastel | sepia
  art_prompt      text,                      -- 모델-레디 positive 아트 디렉션(생성 프롬프트에 그대로)
  negative_prompt text,
  lettering       text,
  reference       text,
  source_url      text,
  status          text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','adopted','rejected')),
  is_default      boolean NOT NULL DEFAULT false,
  sort            int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cst_dims ON comic_styles (format, age_band, genre);
CREATE TRIGGER trg_cst_updated BEFORE UPDATE ON comic_styles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE comic_styles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_curator_comic_styles ON comic_styles;
CREATE POLICY admin_curator_comic_styles ON comic_styles FOR ALL
  USING (is_admin_or_curator()) WITH CHECK (is_admin_or_curator());

-- 도서별 선택 스타일
ALTER TABLE comic_books ADD COLUMN IF NOT EXISTS style_key text REFERENCES comic_styles(key) ON DELETE SET NULL;

COMMENT ON TABLE comic_styles IS 'CCP 만화 스타일 프리셋(포맷/연령/장르/난이도 → 모델-레디 아트 프롬프트)';
COMMENT ON COLUMN comic_books.style_key IS 'CCP 도서별 선택 스타일(comic_styles.key) — 생성 드레인이 art_prompt 로 생성';
