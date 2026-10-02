-- supabase/migrations/20261002060000_csat_type_reports_scope_pk.sql
--
-- P4 — csat_type_reports 의 기본 키를 (type_id) → (type_id, organizer, grade) 로 넓힌다.
-- 20261001101635 가 organizer·grade 열과 scope CHECK 를 더했지만 키는 type_id 하나로 남겼다 —
-- 그 키로는 한 유형에 평가원(kice·0)과 학평(edu_office·1~3) 리포트가 함께 있을 수 없다.
-- 이 키가 넓어져야 학평 유형 리포트를 평가원 행을 덮지 않고 학년별로 쓸 수 있다(사용자 결정: 통계는 집합별로 따로).
--
-- 영향: 기존 행 26개는 전부 (kice, 0) 라 키가 겹치지 않는다(적용 전 실측).
--   type_id → csat_types FK 는 그대로. 읽는 쪽은 이미 organizer·grade 를 지정한다(exam-id.test 가드).
--   analysis-drain-import.mjs 의 upsert 는 onConflict 를 'type_id,organizer,grade' 로 같은 PR 에서 바꾼다 —
--   이 마이그레이션 뒤 옛 'type_id' 충돌 대상은 존재하지 않는 유일 제약이라 오류가 난다.
--
-- 되돌리기(학평 행이 없을 때만): alter table csat_type_reports drop constraint csat_type_reports_pkey,
--   add constraint csat_type_reports_pkey primary key (type_id);

begin;

alter table public.csat_type_reports drop constraint csat_type_reports_pkey;
alter table public.csat_type_reports add constraint csat_type_reports_pkey primary key (type_id, organizer, grade);

commit;
