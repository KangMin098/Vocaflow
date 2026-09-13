-- supabase/migrations/20260913013946_csat_exams_paper_form.sql
--
-- 문항 추출에 쓴 문제지의 인쇄 형(홀수/짝수). `form` 과 다른 축이다.
--
-- 왜 필요한가: `choices` 순서와 `answer` 번호는 **형마다 다르다.** 선지를 자리로 가리키는
-- 화면(예: 평가원 PDF 위에 오답 박스를 얹는 것)은 학습자가 연 문제지의 형과 분석의 형이
-- 같은지 확인해야 한다. 지금까지 DB 는 그 사실을 들고 있지 않았다 —
-- 파이프라인은 `scripts/csat/data/answers.json` 의 `form_used` 로 알고 있었는데
-- DB 사본에는 없어서, 화면이 확인할 방법이 없었다.
--
-- ⚠️ `form` 컬럼에 넣으면 안 된다. 그것은 2014학년도 **수준별 A/B** 축이고
--    (`2014A`·`2014B`), 홀수/짝수와 섞으면 두 축이 한 칼럼에서 겹친다.

alter table csat_exams
  add column if not exists paper_form text
    check (paper_form in ('홀수', '짝수', '단일'));

comment on column csat_exams.paper_form is
  '문항 추출에 쓴 문제지의 인쇄 형. form(2014 수준별 A/B)과 다른 축이다. '
  'choices 순서와 answer 번호가 형마다 다르므로, 선지를 자리로 가리키는 화면은 '
  '이 값과 학습자가 연 문제지의 형이 같은지 확인해야 한다. '
  '정본은 scripts/csat/data/answers.json 의 form_used. '
  '모의평가는 형 구분이 없어 단일 (실측 2026-09-13: 모평 문제지 18개에 홀수형/짝수형 표기 0건).';

update csat_exams set paper_form = '홀수'
  where id in ('2014A', '2014B', '2015', '2016', '2023', '2024', '2026');

update csat_exams set paper_form = '짝수'
  where id in ('2017', '2018', '2019', '2020', '2021', '2022');

update csat_exams set paper_form = '단일'
  where id = '2025' or id like 'M%';

-- M2009 는 뺀다 — 문제지 PDF 가 M2106 과 md5 동일인 무효 회차로 자기 문제지가 없다
-- (`csat_exams.source_note` 에 경위가 있다). 형을 적으면 없는 문제지에 형을 주는 것이 된다.
update csat_exams set paper_form = null where id = 'M2009';
