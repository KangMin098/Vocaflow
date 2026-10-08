-- supabase/migrations/_pending_20261008140100_learning_task_attempts_idempotency.sql
--
-- **제안 · 미적용(승인 대기).** 수행 기록 멱등 키 — 같은 제출이 두 번 들어와도(중복 클릭 · 재시도 · 새로 고침 재전송) 한 행만 남게.
-- 왜: learning_task_attempts 에는 유일 키가 없다. 지금 첫 수직 경로는 practice 기록만 하고 효과 집계를 하지 않아 중복이 판정을 바꾸지 않지만,
--     효과 검증(사전 · 사후 · 첫 시도 집계)으로 넘어가면 중복 행이 표본을 부풀린다.
-- 변경: client_attempt_id uuid(널 허용 — 기존 행 · 합성 기록 호환) + (user_id, client_attempt_id) 부분 유일 인덱스.
--       앱은 화면에서 제출마다 uuid 를 만들어 보내고, 서버는 INSERT … ON CONFLICT DO NOTHING 후 기존 행을 돌려준다(다음 단위 구현).
-- 기존 데이터 영향: 없음(컬럼 추가 · 기존 행 null · 백필 없음). 잠금: ADD COLUMN(널 · 기본값 없음)은 메타데이터만.
--   인덱스는 표가 작아(2026-10-08 기준 수십 행 미만) 일반 CREATE INDEX 로 충분 — 커지면 CONCURRENTLY 로 따로.
-- 되돌리기: 맨 끝 주석 블록.

begin;
alter table public.learning_task_attempts add column client_attempt_id uuid;
create unique index learning_task_attempts_client_attempt_uniq
  on public.learning_task_attempts (user_id, client_attempt_id) where client_attempt_id is not null;
commit;

-- rollback:
-- begin; drop index public.learning_task_attempts_client_attempt_uniq; alter table public.learning_task_attempts drop column client_attempt_id; commit;
