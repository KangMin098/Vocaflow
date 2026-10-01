-- supabase/migrations/20261001180000_csat_dx_snapshot_once_per_session.sql
--
-- **기록 한 회 = 진단 스냅샷 한 개.** (PR #135 Codex 10차 리뷰 P2)
-- 같은 제출의 재전송이 동시에 들어오면 둘 다 「스냅샷 없음」을 보고 계산해 같은 기록의 스냅샷이 둘 쌓였다
-- (이력 중복 · 리포트가 같은 진단끼리 비교). 기록 저장으로 생긴 스냅샷(trigger='session')만 세션당 하나로 묶는다.
-- 서버는 충돌(23505)이면 이미 있는 스냅샷을 돌려준다(lib/csat/diagnosis/server.ts snapshotForSession).
--
-- 되돌리기: DROP INDEX public.csat_dx_snapshot_once_per_session;

CREATE UNIQUE INDEX IF NOT EXISTS csat_dx_snapshot_once_per_session
  ON public.csat_dx_snapshot (session_id)
  WHERE trigger = 'session' AND session_id IS NOT NULL;
