-- supabase/migrations/20260830140000_textbook_volume_renders.sql
--
-- TBP — **조판 기록.** 교재 한 권을 조판한 사실을 DB 에 남긴다.
--
-- ── 왜 필요한가 (2026-08-30) ──────────────────────────────────────────
-- 브랜딩(`textbook/brand.ts` — 팔레트·서체·판권면)과 조판기(`render-volume.mjs`)는
-- 코드로는 들어갔는데 **관측면이 없었다.** 조판 결과가 `--out volume-v5.html` 로컬
-- 파일에만 떨어져서, /admin/textbook 이 읽을 레코드가 하나도 없었다.
-- 관리자가 "몇 권까지 조판됐고 어느 권이 옛 브랜드 규격이냐" 를 물을 자리가 화면인데
-- 답이 각자 PC 의 HTML 파일에 있으면 아무도 안 본다 — 이 저장소가 이미 겪은 사고다.
--
-- ── 왜 이력이 아니라 권당 한 행인가 ───────────────────────────────────
-- 조판은 **드레인이 아니라 관측**이다. 같은 밴드를 열 번 조판해도 결과가 같아야 하므로
-- (재실행 안전) `band` 를 PK 로 두고 덮어쓴다. 몇 번 찍었는지는 `render_count`,
-- 처음 찍은 때는 `first_rendered_at` 이 지킨다.
--
-- ── brand_fingerprint 가 진짜 하는 일 ─────────────────────────────────
-- `brandFingerprint()` 는 조판 CSS 변수 + 서체 스택을 해시한 값이다. 토큰이 바뀌면
-- 이 값이 바뀌므로, **화면이 "이 권은 옛 규격으로 조판됐다" 를 말할 수 있다.**
-- 색을 여기 저장하지 않는 이유도 같다 — 값의 정본은 `@vocaflow/design-tokens` 하나다.

BEGIN;

CREATE TABLE IF NOT EXISTS public.textbook_volume_renders (
  -- 사다리의 한 권. V-Level 이 곧 권이다(`SERIES_SPINE`).
  band                 smallint PRIMARY KEY CHECK (band BETWEEN 0 AND 11),

  volume_title         text     NOT NULL,
  step                 smallint CHECK (step BETWEEN 1 AND 7),
  school_band          text,

  units                smallint NOT NULL CHECK (units > 0),
  items                smallint NOT NULL CHECK (items >= 0),

  -- 자동 검수 — 판권면에 실리는 그 수치다. 지어내지 않고 채점 결과를 받는다.
  auto_passed          smallint NOT NULL CHECK (auto_passed >= 0),
  auto_total           smallint NOT NULL CHECK (auto_total > 0),
  -- 떨어진 항목의 이름. "8/9" 만 남기면 무엇이 걸렸는지 화면이 말할 수 없다.
  failed_checks        text[]   NOT NULL DEFAULT '{}',

  -- 해설 출처별 수. 없음(= items - batch - rule)이 0 이 아니면 해설 드레인을 더 돌려야 한다.
  explained_batch      smallint NOT NULL DEFAULT 0 CHECK (explained_batch >= 0),
  explained_rule       smallint NOT NULL DEFAULT 0 CHECK (explained_rule >= 0),

  -- 시중 밀도 대비 유형-학년 적합도(0~1). 못 쟀으면 NULL — 0 으로 뭉개지 않는다.
  type_mix_fit         numeric(5,4) CHECK (type_mix_fit BETWEEN 0 AND 1),
  -- 겹치지 않게 줄 수 있는 권수. 학습자가 늘면 여기가 한계가 된다.
  -- ⚠️ 20260830141000 이 NULL 허용으로 고쳤다 — 원글을 안 쓰는 권(초등 3종)은 "해당 없음" 이다.
  distinct_volumes     smallint NOT NULL DEFAULT 0 CHECK (distinct_volumes >= 0),

  -- 조판 당시 브랜드 규격의 지문. 현재 값과 다르면 그 권은 옛 규격이다.
  brand_fingerprint    text     NOT NULL,
  -- 판권면 그대로. 무엇을 찍었는지 화면이 다시 조립하지 않아도 되게.
  colophon             jsonb    NOT NULL,
  out_path             text     NOT NULL,

  render_count         integer  NOT NULL DEFAULT 1 CHECK (render_count > 0),
  first_rendered_at    timestamptz NOT NULL DEFAULT now(),
  rendered_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_tvr_auto_passed_le_total CHECK (auto_passed <= auto_total),
  CONSTRAINT chk_tvr_explained_le_items   CHECK (explained_batch + explained_rule <= items)
);

CREATE INDEX IF NOT EXISTS idx_tvr_rendered_at
  ON public.textbook_volume_renders(rendered_at DESC);

COMMENT ON TABLE public.textbook_volume_renders IS
  'TBP 조판 기록 — 권(band)당 한 행. render-volume.mjs 가 덮어쓴다(재실행 안전). brand_fingerprint 로 옛 규격 조판을 가려낸다.';
COMMENT ON COLUMN public.textbook_volume_renders.brand_fingerprint IS
  'brandFingerprint() — 조판 CSS 변수 + 서체 스택의 해시. 현재 값과 다르면 재조판 대상.';

ALTER TABLE public.textbook_volume_renders ENABLE ROW LEVEL SECURITY;

-- 읽기는 admin/curator 만. 쓰기는 정책으로 열지 않는다 — 조판기(service role)만 쓴다.
DROP POLICY IF EXISTS tvr_select_admin ON public.textbook_volume_renders;
CREATE POLICY tvr_select_admin ON public.textbook_volume_renders
  FOR SELECT USING (public.is_admin_or_curator());

COMMIT;
