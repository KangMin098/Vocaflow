-- supabase/migrations/20260920014500_revoke_video_job_writers_from_clients.sql
--
-- 발견 104 · 112 (critical, 7일째) — 익명 사용자가 영상 큐에 **쓸 수** 있었다.
--
-- 두 함수 다 VOLATILE SECURITY DEFINER(owner=postgres)이고 **권한 가드가 하나도 없다**
-- (`is_admin_or_curator()` 도 `auth.uid()` 검사도 없다. 2026-09-20 prosrc 확인):
--   video_job_advance  : 본문 첫 동작이 `INSERT INTO video_jobs … ON CONFLICT DO NOTHING`.
--                        임의 video_id 행을 새로 만들 수 있고, 기존 편의 stage·kind·지표를 덮는다.
--   video_job_evaluate : 곧바로 `UPDATE video_jobs SET eval_*`.
--
-- 유일한 호출자는 packages/video-factory/src/jobs/client.ts 이고 SUPABASE_SERVICE_ROLE_KEY
-- 로만 붙는다(파일 주석: "service_role 로만 쓴다"). 브라우저에서 부르는 곳은 없다.
--
-- authenticated 까지 걷는 이유 — docs/DB_SCHEMA.md 가 두 RPC 를 **`→ service_role`** 로 적고 있다.
-- anon 만 걷으면 문서화된 설계와 계속 어긋나고, 로그인한 학습자가 영상 큐 상태를 쓸 수 있다.
--
-- proacl 에 PUBLIC(`=X/postgres`) 항목은 없다 → `FROM PUBLIC` 은 불필요하다.
-- (기본 권한 자체는 20260919231528·232557 에서 이미 닫았다. 그 조치는 **미래 함수**에만 적용되므로
--  이미 만들어진 이 둘은 이렇게 따로 걷어야 한다.)
--
-- 검증은 마이그레이션 성공이 아니라 **anon 키로 실제 호출**해서 한다
-- (DB_SCHEMA §v06.34 무가드 쓰기 DEFINER 27종 의 경고).
--
-- 되돌리기:
--   GRANT EXECUTE ON FUNCTION public.video_job_advance(text,text,text,jsonb,text) TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.video_job_evaluate(text,integer,integer,integer,jsonb) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.video_job_advance(text, text, text, jsonb, text)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.video_job_evaluate(text, integer, integer, integer, jsonb)
  FROM anon, authenticated;
