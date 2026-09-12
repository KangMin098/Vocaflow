-- supabase/migrations/20260808162601_pdcp_queue_states_and_monitoring.sql
--
-- PDCP 큐 상태 + 드레인 관측 컬럼.
--
-- 왜 필요한가: 최초 스키마는 취득이 끝난 뒤의 상태(acquired~published)만 있었다.
-- Admin 콘솔이 "아직 아무것도 받지 않은 대기 항목"을 담으려면 `queued` 가 필요하고,
-- 드레인이 실패했을 때 무엇이 왜 멈췄는지 남기려면 관측 컬럼이 필요하다.
--
-- ⚠️ 이 파일은 **이미 적용된 변경을 사후 기록**한 것이다(2026-08-09, MCP `apply_migration`
--    으로 먼저 적용하고 파일을 남기지 않아 새 환경에서 재현되지 않는 상태였다).
--    파일명 버전은 DB `supabase_migrations.schema_migrations` 에 기록된 값과 맞췄다 —
--    어긋나면 `db push` 가 같은 변경을 다시 적용하려 든다.
--    전부 멱등(IF NOT EXISTS / DROP·ADD CONSTRAINT)이라 재적용해도 안전하다.

-- ── 상태 추가: queued(취득 대기) · failed(레거시) ─────────────────────
--
-- `failed` 는 CHECK 에는 남겨두되 **드레인이 더는 쓰지 않는다**. 실패 시 status 를 덮으면
-- 어느 단계에서 멈췄는지가 사라져 재시도 지점을 복원할 수 없기 때문(실측 후 설계 변경).
-- 실패는 `last_error` 로만 표시하고 단계는 보존한다. 값은 과거 행 호환을 위해 유지.
ALTER TABLE pd_comic_issues DROP CONSTRAINT IF EXISTS pd_issues_status_chk;
ALTER TABLE pd_comic_issues ADD CONSTRAINT pd_issues_status_chk CHECK (
  status IN ('queued', 'acquired', 'restored', 'segmented', 'ocr', 'review', 'published', 'archived', 'failed')
);

-- ── 드레인 관측 ───────────────────────────────────────────────────────
ALTER TABLE pd_comic_issues
  ADD COLUMN IF NOT EXISTS last_error    text,
  ADD COLUMN IF NOT EXISTS last_run_at   timestamptz,
  ADD COLUMN IF NOT EXISTS attempts      integer NOT NULL DEFAULT 0,
  -- 테스트 모드 — 전권(50p+) 대신 앞 N장만 취득해 파라미터를 먼저 확인한다. NULL = 전권.
  ADD COLUMN IF NOT EXISTS acquire_pages integer;

COMMENT ON COLUMN pd_comic_issues.last_error IS
  'PDCP 드레인 실패 사유. status 는 멈춘 단계를 그대로 유지하므로, 실패 여부는 이 컬럼으로만 판단한다(재시도 = 이 값을 지우는 것).';
COMMENT ON COLUMN pd_comic_issues.acquire_pages IS
  'PDCP 테스트 모드 — 취득할 앞쪽 페이지 수. NULL 이면 전권.';

-- ── 큐 인덱스 ─────────────────────────────────────────────────────────
-- 드레인은 "처리 대상 중 가장 오래된 1건"만 반복 조회한다. 부분 인덱스로 발행·보관본을 뺀다.
CREATE INDEX IF NOT EXISTS pd_issues_queue_idx
  ON pd_comic_issues (status, created_at)
  WHERE status IN ('queued', 'acquired', 'restored', 'segmented', 'ocr');
