-- supabase/migrations/20260808220000_comic_gen_models_run_envs.sql
--
-- CCP 모델 실행환경 제약(선택 제약조건) — 모든 모델은 자가호스트(RunPod/Kaggle) 우선.
--   run_envs: 이 모델이 실행 가능한 환경 화이트리스트 → 테스트/생성 시 환경 선택을 제약.
--     'runpod-4090'(24GB) · 'kaggle-t4'(16GB) · 'api'(폐쇄 모델).
--   min_vram_gb: 자가호스트 최소 VRAM(양자화 기준). 적용: 사용자 승인 후.

ALTER TABLE comic_gen_models ADD COLUMN IF NOT EXISTS run_envs text[] NOT NULL DEFAULT '{}';
ALTER TABLE comic_gen_models ADD COLUMN IF NOT EXISTS min_vram_gb int;

COMMENT ON COLUMN comic_gen_models.run_envs IS '실행 가능 환경 화이트리스트(runpod-4090/kaggle-t4/api) — 자가호스트 우선 선택 제약';
COMMENT ON COLUMN comic_gen_models.min_vram_gb IS '자가호스트 최소 VRAM(GB, 양자화 기준)';
