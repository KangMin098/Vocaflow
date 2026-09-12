-- supabase/migrations/20260808160000_comic_read_progress.sql
--
-- CCP P3 — 만화 진도 영속(기기 간 이어보기 + 완독 추적).
--   리더 위치를 서버에 저장(현재 localStorage=기기 로컬만) → 연속성.
--   RLS user-owns · save RPC(auth.uid() 내부 처리). 적용: 사용자 승인 후.

CREATE TABLE IF NOT EXISTS comic_read_progress (
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  library_book_id uuid NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  last_index      int NOT NULL DEFAULT 0,
  panels_total    int NOT NULL DEFAULT 0,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, library_book_id)
);

ALTER TABLE comic_read_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_comic_progress ON comic_read_progress;
CREATE POLICY own_comic_progress ON comic_read_progress FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT ON comic_read_progress TO authenticated;

-- 저장(upsert) — auth.uid() 내부 처리. 완독 시각은 최초 1회 고정(COALESCE).
CREATE OR REPLACE FUNCTION public.save_comic_progress(p_book_id uuid, p_last_index int, p_total int, p_completed boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO comic_read_progress (user_id, library_book_id, last_index, panels_total, completed_at, updated_at)
  VALUES (auth.uid(), p_book_id, greatest(coalesce(p_last_index, 0), 0), coalesce(p_total, 0),
          CASE WHEN p_completed THEN now() ELSE NULL END, now())
  ON CONFLICT (user_id, library_book_id) DO UPDATE SET
    last_index = EXCLUDED.last_index,
    panels_total = EXCLUDED.panels_total,
    completed_at = COALESCE(comic_read_progress.completed_at, EXCLUDED.completed_at),
    updated_at = now();
END $fn$;
REVOKE ALL ON FUNCTION public.save_comic_progress(uuid, int, int, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_comic_progress(uuid, int, int, boolean) TO authenticated;

COMMENT ON TABLE comic_read_progress IS 'CCP 만화 진도(기기 간 이어보기) — user_owns RLS';
