-- supabase/migrations/20261005170100_csat_ec_reveal_gate_revoke.sql
--
-- Reveal Gate ② — 정오 · 점수의 학습자 직접 조회 **영구 회수**(2026-10-05 · 초안 · 미적용).
-- 설계 V1: 참가자인데 capture 행이 빠진 버그가 있어도 학습자 JWT 로는 정오 · 점수가 새지 않게(fail-closed). 앱 서버만 단일 gate 를 거쳐 준다.
--
-- ⚠️ 적용 순서: 앱이 이 컬럼을 학습자 클라이언트로 읽지 않게 바꾼 **뒤**(lib/csat/diagnosis/learner.ts 의 홈 카드 raw_score · grade —
--    서버 gate 경로로). 앞에 적용하면 홈 카드가 조회 오류로 「불러오지 못함」이 된다.
-- 되돌리기: scripts/csat/error-evidence/rollback-reveal-gate.sql 의 ② 절.

begin;

-- csat_dx_session: raw_score · grade 회수(나머지 컬럼은 그대로 — 기록 목록 · 시험 id 는 정답 민감이 아니다)
revoke select on public.csat_dx_session from authenticated;
grant select (id, user_id, exam_id, mode, taken_at, total_minutes, entered_by, client_key, created_at) on public.csat_dx_session to authenticated;

-- csat_dx_response: is_correct 회수(고른 답은 본인 입력이라 남긴다)
revoke select on public.csat_dx_response from authenticated;
grant select (session_id, item_no, item_id, chosen_option, confidence) on public.csat_dx_response to authenticated;

-- csat_dx_snapshot: 전부 회수(점수 · 예측 · 함정 취약도 — 모두 정오 파생)
revoke select on public.csat_dx_snapshot from authenticated;

commit;
