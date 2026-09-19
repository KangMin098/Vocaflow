-- supabase/migrations/20260814015130_quality_metrics_ssot_drift.sql
-- (파일명 = 실제 적용 버전 supabase_migrations.schema_migrations.version)
--
-- M7 추가 — 발행 도서 SSoT 드리프트를 야간 상시 측정한다.
--
-- 왜:
--   추출 로직(`select_book_chapter_vocab`)이 바뀌어도 **이미 발행된 세트는 따라가지 않는다**.
--   재발행해야 반영되는데, 그 사실을 알려 주는 I10 게이트는 `run_content_quality_gates('book', id)`
--   에만 있다 — 전역 게이트에도 없고, /admin/quality 에도 없고, `content_gate_publishable` 도
--   I10 을 제외한다. **어느 화면에도 안 뜬다.**
--   그 결과 발행 도서 전권이 어긋난 채로 몇 주가 지났고, 2026-08-12 에 통합 테스트를 되살리다
--   우연히 발견됐다. 우연에 기대는 감지는 감지가 아니다.
--
-- 무엇을 재나:
--   발행 도서(status='published') 중 발행 세트를 가진 책마다
--   `(chapter_idx, word)` 집합을 현 select 결과와 대칭차집합으로 비교한 건수.
--   I10 과 같은 정의다(20260813 cap 40 제거 반영). 미발행 도서는 제외한다 —
--   RLS(20260813110729)가 미발행 원본의 세트를 anon 에게 가리므로 학습자에게 닿지 않는다.
--
-- 지표 2행 (M2 의 p50/p90 과 같은 형태):
--   · published_set_ssot_drift_books — 어긋난 도서 수
--   · published_set_ssot_drift_words — 어긋난 (챕터,단어) 쌍 수
--   dims 에 `drifted` = {도서명: 건수} 를 실어 어느 책인지 바로 보이게 한다.
--
-- 비용: `select_book_chapter_vocab` 를 도서당 1회. 발행 12권 기준 실측 ~19초
--   (temp table 로 1회만 평가. CTE 로 두면 참조 횟수만큼 재실행돼 37.9초까지 늘어난다).
--   pg_cron jobid=12 · KST 03:10 야간 배치라 감당 범위.
--
-- M1~M6 은 원문 그대로다.

CREATE OR REPLACE FUNCTION public.collect_quality_metrics()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_now timestamptz := now();
  v_rows integer := 0;
begin
  -- M1 (extract) — published 책의 챕터별 word set 보유율
  with pb as (
    select id, title from library_books where status = 'published'
  ),
  ch as (
    select m.library_book_id, count(*) as n
    from library_chapters_master m join pb on pb.id = m.library_book_id
    group by 1
  ),
  st as (
    select (s.curation_query->>'book_id')::uuid as book_id,
           count(distinct s.curation_query->>'chapter_idx') as n
    from shared_word_sets s
    where s.category = 'library_book'
      and (s.curation_query->>'book_id')::uuid in (select id from pb)
    group by 1
  ),
  agg as (
    select count(*)::int as books_total,
           coalesce(sum(ch.n), 0)::int as chapters_total,
           coalesce(sum(st.n), 0)::int as chapters_with_set,
           coalesce(jsonb_agg(pb.title) filter (where coalesce(st.n,0) < coalesce(ch.n,0)), '[]'::jsonb)
             as books_below_100
    from pb
    left join ch on ch.library_book_id = pb.id
    left join st on st.book_id = pb.id
  )
  insert into quality_metrics (measured_at, stage, metric, value, dims)
  select v_now, 'extract', 'published_chapter_set_coverage_pct',
         round(100.0 * chapters_with_set / nullif(chapters_total, 0), 2),
         jsonb_build_object('books_total', books_total, 'chapters_total', chapters_total,
                            'chapters_with_set', chapters_with_set, 'books_below_100', books_below_100)
  from agg where chapters_total > 0;

  -- M2 (publish) — set 크기 분포 (p50 / p90 행 2개, min·max·sets 는 dims)
  with sizes as (
    select s.id, count(w.set_id) as n
    from shared_word_sets s left join shared_words w on w.set_id = s.id
    where s.category = 'library_book'
    group by s.id
  ),
  stat as (
    select count(*)::int as sets,
           percentile_cont(0.5) within group (order by n) as p50,
           percentile_cont(0.9) within group (order by n) as p90,
           min(n)::int as min_n, max(n)::int as max_n
    from sizes
  )
  insert into quality_metrics (measured_at, stage, metric, value, dims)
  select v_now, 'publish', m.metric, m.val,
         jsonb_build_object('sets', sets, 'min', min_n, 'max', max_n)
  from stat,
  lateral (values ('set_size_p50', p50), ('set_size_p90', p90)) as m(metric, val)
  where sets > 0;

  -- M3 (publish) — shared_words meaning_ko 충전율 (library_book set 한정)
  insert into quality_metrics (measured_at, stage, metric, value, dims)
  select v_now, 'publish', 'shared_words_meaning_ko_pct',
         round(100.0 * count(*) filter (where w.meaning_ko is not null and length(w.meaning_ko) > 0)
               / nullif(count(*), 0), 2),
         jsonb_build_object('total', count(*),
                            'filled', count(*) filter (where w.meaning_ko is not null and length(w.meaning_ko) > 0))
  from shared_words w join shared_word_sets s on s.id = w.set_id
  where s.category = 'library_book'
  having count(*) > 0;

  -- M4 (deliver) — 책 librivox 오디오 매핑률 (published / ready 각 1행)
  insert into quality_metrics (measured_at, stage, metric, value, dims)
  select v_now, 'deliver', 'book_librivox_audio_pct',
         round(100.0 * count(*) filter (where librivox_audio is not null) / nullif(count(*), 0), 2),
         jsonb_build_object('status', status, 'books', count(*),
                            'with_librivox', count(*) filter (where librivox_audio is not null))
  from library_books
  where status in ('published', 'ready')
  group by status;

  -- M5 (analyze) — book_v_level V7+V8 쏠림 (published / ready 각 1행 · 분포는 dims)
  insert into quality_metrics (measured_at, stage, metric, value, dims)
  select v_now, 'analyze', 'book_v7_v8_share_pct',
         round(100.0 * count(*) filter (where book_v_level in (7, 8)) / nullif(count(*), 0), 2),
         jsonb_build_object('status', status, 'books', count(*),
                            'v_dist', (select jsonb_object_agg(coalesce(v::text, 'null'), c)
                                       from (select book_v_level as v, count(*) as c
                                             from library_books b2
                                             where b2.status = b.status
                                             group by 1) d))
  from library_books b
  where status in ('published', 'ready')
  group by status;

  -- M6 (ingest) — 글 lexical_noise 분포 (books 에는 컬럼 없음 → 글 전용, P0 확정)
  insert into quality_metrics (measured_at, stage, metric, value, dims)
  select v_now, 'ingest', 'article_lexical_noise_p90',
         round((percentile_cont(0.9) within group (order by lexical_noise))::numeric, 3),
         jsonb_build_object('articles', count(*), 'with_noise', count(lexical_noise),
                            'p50', round((percentile_cont(0.5) within group (order by lexical_noise))::numeric, 3),
                            'max', max(lexical_noise))
  from library_articles
  having count(lexical_noise) > 0;

  -- M7 (publish) — 발행 세트 SSoT 드리프트 (I10 과 동일 정의 · 발행 도서 한정)
  -- ⚠️ temp table 로 1회만 평가한다. CTE 로 두면 outer 참조 횟수만큼 재실행된다(실측 19초 → 37.9초).
  drop table if exists _drift;
  create temp table _drift on commit drop as
    select b.title,
           (select count(*) from (
              (select chapter_idx as ci, word as w from select_book_chapter_vocab(b.id)
               except
               select (s.curation_query->>'chapter_idx')::int, lower(sw.word)
               from shared_word_sets s join shared_words sw on sw.set_id = s.id
               where s.category = 'library_book' and s.is_published
                 and (s.curation_query->>'book_id') = b.id::text)
              union all
              (select (s.curation_query->>'chapter_idx')::int, lower(sw.word)
               from shared_word_sets s join shared_words sw on sw.set_id = s.id
               where s.category = 'library_book' and s.is_published
                 and (s.curation_query->>'book_id') = b.id::text
               except
               select chapter_idx, word from select_book_chapter_vocab(b.id))
            ) d)::int as drift
    from library_books b
    where b.status = 'published'
      and exists (select 1 from shared_word_sets s
                  where s.category = 'library_book' and s.is_published
                    and (s.curation_query->>'book_id') = b.id::text);

  insert into quality_metrics (measured_at, stage, metric, value, dims)
  select v_now, 'publish', m.metric, m.val,
         jsonb_build_object(
           'books_checked', (select count(*) from _drift),
           -- 어긋난 책이 없으면 {} — null 로 두면 화면이 "측정 안 됨" 과 구별하지 못한다.
           'drifted', coalesce((select jsonb_object_agg(title, drift) from _drift where drift > 0), '{}'::jsonb)
         )
  from (select count(*) filter (where drift > 0)::numeric as books,
               coalesce(sum(drift), 0)::numeric as words
        from _drift) t,
  lateral (values ('published_set_ssot_drift_books', t.books),
                  ('published_set_ssot_drift_words', t.words)) as m(metric, val)
  where exists (select 1 from _drift);

  drop table if exists _drift;

  select count(*)::int into v_rows from quality_metrics where measured_at = v_now;
  return v_rows;
end $function$;
