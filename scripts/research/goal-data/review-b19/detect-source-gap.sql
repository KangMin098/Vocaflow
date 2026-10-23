-- scripts/research/goal-data/review-b19/detect-source-gap.sql
-- Claude 추가 조회 필요: read-only triage. Confirm table existence before querying.
select to_regclass('public.csat_items') as csat_items;

-- Run only after the table exists. Signals are review candidates, not rejection labels.
with normalized as (
  select id, exam_id, no, type_id, body_ok,
         regexp_replace(coalesce(passage, ''), '[[:space:]]+', ' ', 'g') as p
  from public.csat_items
), length_baseline as (
  select no, count(*) as n,
         percentile_cont(0.5) within group (order by length(p)) as median_len
  from normalized where length(p) > 0 group by no
), flagged as (
  select x.id, x.exam_id, x.no, x.type_id, x.body_ok, length(x.p) as chars,
         b.n, b.median_len,
         x.p ~ '[.!?]["”’)]?[[:space:]]+[a-z]{2,20}[.][[:space:]]+[A-Z]' as orphan_word,
         (b.n >= 4 and length(x.p) < b.median_len * 0.5) as short_for_no,
         x.p ~* '\m(a|an|the|of|to|in|on|at|for|with|and|or|but|which|because)[[:space:]]*$' as function_tail,
         (length(x.p) > 0 and x.p !~ '[.!?"”’)][[:space:]]*$') as no_sentence_end
  from normalized x left join length_baseline b using (no)
)
select * from flagged
where body_ok and (orphan_word or short_for_no or function_tail or no_sentence_end)
order by orphan_word desc, short_for_no desc, id;

-- Separate the narrow comparable count from broader low-specificity signals.
-- Abbreviations (a.m./p.m./etc.), list labels and signatures need manual review.
-- Parser-level rule: compare original English operational footnote lines and their
-- wrapped continuations with passage; do not infer missing text from choices.
-- No UPDATE, inferred repair or automatic body_ok=false is authorized here.
