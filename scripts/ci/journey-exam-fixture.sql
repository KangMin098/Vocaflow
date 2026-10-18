-- scripts/ci/journey-exam-fixture.sql
--
-- ⚠️ CI 격리 DB 전용 fixture — 개발 DB · 운영 DB 에 적용하지 않는다(마이그레이션이 아니다 · supabase/migrations 밖).
-- 한 학습자 종단 e2e(journey.isolated.spec.ts)의 「시험 기록」 단계용 **합성 회차**. 실제 기출 · 실제 정답표가 아니다(정답은 규칙으로 만든 값).
-- 문항 · 유형 · 속성 태깅이 없으므로 이 기록은 As-Is 의 축 기록 근거를 만들지 않는다 — 시험 기록 저장 · 스냅샷 · 지도 기록 줄만 본다.
insert into public.csat_exams (id, label, kind, year, month, item_count, has_answer_key, diagnosis_ready, source_note)
values ('ISO-J1', '격리 합성 회차(e2e)', 'mock', 2099, 1, 45, true, true, 'CI 격리 fixture — 실제 시험 아님')
on conflict (id) do nothing;

insert into public.csat_dx_answer_key (exam_id, no, answers, points, source)
select 'ISO-J1', n, array[((n % 5) + 1)]::smallint[], case when n % 7 = 0 then 3 else 2 end, 'CI 격리 fixture'
from generate_series(1, 45) as n
on conflict (exam_id, no) do nothing;
