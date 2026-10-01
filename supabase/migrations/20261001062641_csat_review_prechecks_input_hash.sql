-- supabase/migrations/20261001062641_csat_review_prechecks_input_hash.sql
--
-- 사전 검사 결과를 «검사한 지문 입력»에도 묶는다(Codex PR #129 리뷰).
-- units_hash 는 단위 버전과 경계 오프셋만 해시한다 — 지문 글자가 바뀌어도 경계가 같으면 그대로라서
-- (「Cats sleep.」→「Dogs sleep.」) 옛 사전 검사가 «현재 결과»로 보였다. 단위 목록의 input_hash(지문 해시)를
-- 함께 기록하고 키에 넣어, 화면이 지금 목록의 input_hash 와 다르면 「오래된 결과」로 가린다.
--
-- 기존 283행은 input_hash 를 모르므로 '' 로 남는다 → 화면에서 「사전 검사 다시」 로 보이고,
-- `review-drain.mjs precheck --commit` 을 다시 돌리면 새 키로 채워진다(재실행 안전 · 옛 행은 이력으로 남는다).

begin;

alter table public.csat_review_prechecks
  add column if not exists input_hash text not null default '';  -- 목록이 없으면 '' (PK 에 null 을 두지 않는다)

alter table public.csat_review_prechecks drop constraint if exists csat_review_prechecks_pkey;
alter table public.csat_review_prechecks
  add constraint csat_review_prechecks_pkey primary key (analysis_id, analysis_hash, units_hash, input_hash, precheck_version);

comment on column public.csat_review_prechecks.input_hash is
  '사전 검사 때 쓴 근거 단위 목록의 input_hash(지문 입력 해시). units_hash 만으로는 지문 글자 변경을 못 가른다';

commit;
