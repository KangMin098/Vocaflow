-- docs/csat-learner/v62/sql/practice-gate-verify.sql
-- v6.2 P-F7a — 승인안 A 적용 **뒤** 개발 DB 검증. 전부 한 트랜잭션 · 마지막에 rollback(운영 상태 변경 없음).
-- 미발행 권이 실제로 없으므로 트랜잭션 안에서만 render 1행을 draft 로 바꾼다.
-- <LEARNER_UUID> 는 검증 계정(시도 기록이 적은 학습자)으로 바꾼다.

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<LEARNER_UUID>', 'role', 'authenticated')::text, true);

-- 1) 발행 권 정상: > 0
select 'published reading/5' c, count(*) from public.textbook_practice_items_for('reading', 5::smallint, 50);
-- 2) 유형 결속: 어휘 권은 재생 유형이 없어 0
select 'vocab/5' c, count(*) from public.textbook_practice_items_for('vocab', 5::smallint, 50);
-- 3) 임의 권: 0
select 'unknown x/9' c, count(*) from public.textbook_practice_items_for('x', 9::smallint, 50);
-- 4) 대응 표 직접 조회: permission denied 기대(아래 줄은 오류가 나야 정상 — 따로 실행)
-- select * from public.textbook_rung_level;

-- 5) 미발행(트랜잭션 안에서만): 0
reset role;
update public.textbook_volume_renders set status = 'draft' where series = 'reading' and band = 5;
set local role authenticated;
select 'draft reading/5' c, count(*) from public.textbook_practice_items_for('reading', 5::smallint, 50);

rollback;

-- 6) rollback 확인: 19권 모두 published
select count(*) filter (where status = 'published') published, count(*) total from public.textbook_volume_renders;

-- 7) 회수(③) 뒤: authenticated 로 옛 함수 → permission denied 기대
-- begin; set local role authenticated; select * from public.textbook_practice_items(5::smallint, 5); rollback;
