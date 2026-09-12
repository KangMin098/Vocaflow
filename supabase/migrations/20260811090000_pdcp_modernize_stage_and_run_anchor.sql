-- supabase/migrations/20260811090000_pdcp_modernize_stage_and_run_anchor.sql
--
-- PDCP 현대화 단계 + 트랙 기록 + run 관측 앵커 (2026-08-11, 사용자 승인 후 적용).
-- 설계: scripts/comic/docs/PD_MODERNIZE_MODEL.md §7

-- ① 선택 단계 'modernized' — ocr 과 review 사이. 건너뛸 수 있고(ocr→review 직행이 기본),
--    산출물은 panels/ 를 덮지 않고 modern/ 에 따로 쓰므로 되돌릴 수 있다.
ALTER TABLE pd_comic_issues DROP CONSTRAINT IF EXISTS pd_issues_status_chk;
ALTER TABLE pd_comic_issues ADD CONSTRAINT pd_issues_status_chk CHECK (
  status IN ('queued', 'acquired', 'restored', 'segmented', 'ocr',
             'modernized',
             'review', 'published', 'archived', 'failed')
);

-- ② 어떤 트랙·모델로 현대화했는지. 없으면 재현도 라이선스 감사도 불가능하다 —
--    'AI 리스타일'로 만든 컷이 어느 모델 산출물인지 나중에 알 방법이 없어진다.
ALTER TABLE pd_comic_issues
  ADD COLUMN IF NOT EXISTS modernize_track text,
  ADD COLUMN IF NOT EXISTS modernize_model text,
  ADD COLUMN IF NOT EXISTS modernize_env   text;

ALTER TABLE pd_comic_issues DROP CONSTRAINT IF EXISTS pd_issues_modernize_track_chk;
ALTER TABLE pd_comic_issues ADD CONSTRAINT pd_issues_modernize_track_chk CHECK (
  modernize_track IS NULL OR modernize_track IN ('preserve', 'restyle')
);

-- 모델 트랙이면 모델·환경이 반드시 남아야 한다. 보존 트랙(CPU)은 해당 없음.
ALTER TABLE pd_comic_issues DROP CONSTRAINT IF EXISTS pd_issues_modernize_model_chk;
ALTER TABLE pd_comic_issues ADD CONSTRAINT pd_issues_modernize_model_chk CHECK (
  modernize_track <> 'restyle' OR (modernize_model IS NOT NULL AND modernize_env IS NOT NULL)
);

COMMENT ON COLUMN pd_comic_issues.modernize_track IS
  'PDCP 현대화 트랙. preserve=원작 작화 보존(CPU/ffmpeg) · restyle=모델 재작화(GPU). NULL=미수행.';
COMMENT ON COLUMN pd_comic_issues.modernize_model IS
  'restyle 트랙이 쓴 comic_gen_models.key (재현·라이선스 감사용).';

-- ③ CCP run 관측 테이블을 PDCP 도 쓰게 한다. PDCP 는 도서 앵커가 없다.
ALTER TABLE comic_gen_runs ALTER COLUMN library_book_id DROP NOT NULL;
ALTER TABLE comic_gen_runs
  ADD COLUMN IF NOT EXISTS pd_issue_id uuid REFERENCES pd_comic_issues(id) ON DELETE CASCADE;

-- 둘 중 하나는 반드시 있어야 한다 — 앵커 없는 고아 run 을 막는다.
ALTER TABLE comic_gen_runs DROP CONSTRAINT IF EXISTS comic_gen_runs_anchor_chk;
ALTER TABLE comic_gen_runs ADD CONSTRAINT comic_gen_runs_anchor_chk CHECK (
  library_book_id IS NOT NULL OR pd_issue_id IS NOT NULL
);

CREATE INDEX IF NOT EXISTS comic_gen_runs_pd_issue_idx
  ON comic_gen_runs (pd_issue_id) WHERE pd_issue_id IS NOT NULL;
