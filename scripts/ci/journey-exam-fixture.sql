-- scripts/ci/journey-exam-fixture.sql
--
-- ⚠️ CI 격리 DB 전용 fixture — 개발 DB · 운영 DB 에 적용하지 않는다(마이그레이션이 아니다 · supabase/migrations 밖).
-- 한 학습자 종단 e2e(journey.isolated.spec.ts)의 「시험 기록」 단계용 **합성 회차**. 실제 기출 · 실제 정답표가 아니다(정답은 규칙으로 만든 값).
-- 문항 · 유형 · 속성 태깅이 없으므로 이 기록은 As-Is 의 축 기록 근거를 만들지 않는다 — 시험 기록 저장 · 스냅샷 · 지도 기록 줄만 본다.
insert into public.csat_exams (id, label, kind, year, month, item_count, has_answer_key, diagnosis_ready, source_note, exam_year)
values ('M9901', '격리 합성 회차(e2e)', 'mock', 2099, 1, 45, true, true, 'CI 격리 fixture — 실제 시험 아님', 2098)
on conflict (id) do nothing;

insert into public.csat_dx_answer_key (exam_id, no, answers, points, source)
select 'M9901', n, array[((n % 5) + 1)]::smallint[], case when n % 7 = 0 then 3 else 2 end, 'CI 격리 fixture'
from generate_series(1, 45) as n
on conflict (exam_id, no) do nothing;

-- 목표 연결(relevance) — 「6월 모평」 목표의 기준 시험 범위에 드는 합성 회차 M9906(실제 시험 아님 · 원문 없음).
--   독해 18~45 번에 유형만 붙인다(지문 · 선지 없음). 지도 정의의 유형 연결(reading-types-approved: B6 ← R-GIST 등)로
--   라인 ↔ 문항이 이어지고, 오답률이 없으니 모두 「반드시 맞힐 문항」 — To-Be 가 목표 관련도를 계산할 수 있다.
insert into public.csat_types (id, name, section) values
  ('R-GIST', '요지', '독해'), ('R-TOPIC', '주제', '독해'), ('R-TITLE', '제목', '독해'), ('R-CLAIM', '주장', '독해'),
  ('R-BLANK', '빈칸 추론', '독해'), ('R-ORDER', '순서', '독해'), ('R-SUMMARY', '요약', '독해')
on conflict (id) do nothing;

insert into public.csat_exams (id, label, kind, year, month, item_count, has_answer_key, diagnosis_ready, source_note, exam_year)
values ('M9906', '격리 합성 6월 회차(e2e)', 'mock', 2099, 6, 45, true, true, 'CI 격리 fixture — 실제 시험 아님', 2098)
on conflict (id) do nothing;

insert into public.csat_dx_answer_key (exam_id, no, answers, points, source)
select 'M9906', n, array[((n % 5) + 1)]::smallint[], case when n % 7 = 0 then 3 else 2 end, 'CI 격리 fixture'
from generate_series(1, 45) as n
on conflict (exam_id, no) do nothing;

insert into public.csat_items (id, exam_id, no, section, type_id, stem)
select 'M9906#' || n, 'M9906', n, case when n >= 41 then '장문' else '독해' end,
  case n when 20 then 'R-CLAIM' when 22 then 'R-GIST' when 23 then 'R-TOPIC' when 24 then 'R-TITLE'
         when 31 then 'R-BLANK' when 32 then 'R-BLANK' when 36 then 'R-ORDER' when 40 then 'R-SUMMARY' else null end,
  '합성 문항(e2e · 원문 없음)'
from generate_series(18, 45) as n
on conflict (id) do nothing;
