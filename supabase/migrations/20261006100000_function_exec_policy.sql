-- supabase/migrations/20261006100000_function_exec_policy.sql
--
-- G2 — public 함수 EXECUTE 정책 정리. 정본 scripts/db/function-exec-manifest.json · 가드 scripts/db/check-function-exec.mjs(기본 거부).
-- 생성: scripts/db/drafts/gen-g2-migration.mjs (live 정의 · ACL 2026-10-06 추출). 손으로 고치지 말고 다시 생성한다.
-- 근거: docs/reports/function-execute-audit-2026-10-05.md · docs/reports/function-execute-decisions-2026-10-06.md
--
-- ① 검사 헬퍼 2개(SECURITY INVOKER) — JWT role 이 anon/authenticated 인 요청만 검사하고, JWT 없는 호출(cron · 소유자 내부)과
--    service_role 은 통과시킨다(G1 과 같은 규칙). invoker 함수가 호출자 권한으로 부르므로 모든 역할에 EXECUTE.
-- ② 본문 검사 22개 — 각 함수 본문 맨 앞 한 줄만 더한다(나머지는 live 정의 그대로).
-- ③ 권한 — 함수마다 PUBLIC · anon · authenticated 를 회수하고 class 가 요구하는 역할만 다시 준다. service_role 은 회수하지 않는다.
-- ④ 앞으로 만드는 함수에 authenticated 기본 EXECUTE 를 주지 않는다(anon · PUBLIC 은 2026-09-19 에 이미).
-- 되돌리기: scripts/db/rollback-20261006100000.sql

create or replace function public._assert_admin_or_service()
returns void language plpgsql stable security invoker set search_path = public as $fn$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') and not coalesce(public.is_admin(), false) then
    raise exception '관리자만 호출할 수 있다' using errcode = '42501';
  end if;
end $fn$;
comment on function public._assert_admin_or_service() is
  'G2(2026-10-06) 관리자 검사 — anon/authenticated JWT 요청은 is_admin() 이어야 한다. JWT 없는 호출(cron · 소유자)과 service_role 은 통과.';

create or replace function public._assert_self_or_service(p_user_id uuid)
returns void language plpgsql stable security invoker set search_path = public as $fn$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') and (auth.uid() is null or auth.uid() is distinct from p_user_id) then
    raise exception '본인 데이터만 다룰 수 있다' using errcode = '42501';
  end if;
end $fn$;
comment on function public._assert_self_or_service(uuid) is
  'G2(2026-10-06) 본인 검사 — anon/authenticated JWT 요청은 auth.uid() = 대상 user_id 여야 한다(대상이 없으면 거부). JWT 없는 호출과 service_role 은 통과.';

revoke execute on function public._assert_admin_or_service() from public;
revoke execute on function public._assert_self_or_service(uuid) from public;
grant execute on function public._assert_admin_or_service() to anon, authenticated, service_role;
grant execute on function public._assert_self_or_service(uuid) to anon, authenticated, service_role;

-- ② 본문 검사

CREATE OR REPLACE FUNCTION public.publish_article_word_set(p_article_id uuid, p_cap integer DEFAULT 40)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_art RECORD;
  v_set_id uuid;
  v_count int;
BEGIN
  PERFORM public._assert_admin_or_service();  -- 2026-10-06 G2 접근 검사
  SELECT id, title, cefr_level, source INTO v_art
  FROM library_articles WHERE id = p_article_id;
  IF v_art IS NULL THEN RAISE EXCEPTION 'Article % not found', p_article_id; END IF;

  IF NOT content_gate_publishable('article', p_article_id) THEN
    RAISE EXCEPTION 'Article % 콘텐츠 품질 게이트 FAIL — 게시 차단', p_article_id;
  END IF;

  SELECT id INTO v_set_id FROM shared_word_sets
   WHERE category = 'library_article'
     AND (curation_query->>'article_id') = p_article_id::text;
  IF v_set_id IS NOT NULL THEN RETURN v_set_id; END IF;

  -- 2026-09-24 가드: 어휘 행이 없으면 빈 단어장을 공개하지 않는다.
  IF NOT EXISTS (SELECT 1 FROM library_article_vocabularies WHERE library_article_id = p_article_id) THEN
    RAISE EXCEPTION 'Article % 어휘 행이 없다 — 빈 단어장 공개 차단', p_article_id
      USING ERRCODE = 'check_violation',
            HINT = '글을 다시 분석(analyzeArticle → compute_article_vrl)한 뒤 발행할 것';
  END IF;

  INSERT INTO shared_word_sets (
    title, description, category, cefr_level, is_published, auto_curated,
    slug, cover_emoji, version, curation_query
  ) VALUES (
    v_art.title,
    '스크립트 핵심 어휘 — ' || COALESCE(v_art.source, 'article'),
    'library_article', v_art.cefr_level, true, true,
    'article-' || v_art.id::text,
    '📄', 1,
    jsonb_build_object(
      'article_id', v_art.id,
      'filter', 'select_article_vocab',
      'cap', p_cap,
      'selection', 'v06.79 learning-optimal (P1+P2+P3: floor=V6, composite=4-axis, cap)'
    )
  ) RETURNING id INTO v_set_id;

  INSERT INTO shared_words (
    set_id, word, lemma, meaning_ko, cefr_level, sort_order,
    source_sentence, part_of_speech, example_en
  )
  SELECT v_set_id, s.word, s.lemma, s.meaning_ko, s.cefr_level, s.sort_order,
         s.first_sentence, s.pos, s.example_en
  FROM select_article_vocab(p_article_id) s
  WHERE s.sort_order <= p_cap
  ORDER BY s.sort_order;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE shared_word_sets SET word_count = v_count WHERE id = v_set_id;

  RETURN v_set_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_vrl_track_distribution()
 RETURNS TABLE(track_id text, level integer, user_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public._assert_admin_or_service();  -- 2026-10-06 G2 접근 검사(결과문은 아래 마지막 문장)
  WITH expanded AS (
    SELECT 'csat_korean' AS track_id,
           COALESCE((current_track_levels->>'csat_korean')::int, 0) AS level
    FROM public.user_profiles
    UNION ALL
    SELECT 'business_english',
           COALESCE((current_track_levels->>'business_english')::int, 0)
    FROM public.user_profiles
    UNION ALL
    SELECT 'academic_english',
           COALESCE((current_track_levels->>'academic_english')::int, 0)
    FROM public.user_profiles
  )
  SELECT track_id, level, COUNT(*)::bigint AS user_count
  FROM expanded
  WHERE level > 0  -- 미진단 (0) 제외
  GROUP BY track_id, level
  ORDER BY track_id, level;
$function$;

CREATE OR REPLACE FUNCTION public.admin_vrl_v_level_distribution()
 RETURNS TABLE(v_level smallint, count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public._assert_admin_or_service();  -- 2026-10-06 G2 접근 검사(결과문은 아래 마지막 문장)
  SELECT p.current_v_level AS v_level, COUNT(*)::bigint
  FROM public.user_profiles p
  GROUP BY p.current_v_level
  ORDER BY p.current_v_level NULLS FIRST;
$function$;

CREATE OR REPLACE FUNCTION public.admin_vrl_cron_jobs()
 RETURNS TABLE(jobid bigint, jobname text, schedule text, active boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public._assert_admin_or_service();  -- 2026-10-06 G2 접근 검사(결과문은 아래 마지막 문장)
  SELECT j.jobid, j.jobname, j.schedule, j.active
  FROM cron.job j
  WHERE j.jobname LIKE 'vrl-%'
  ORDER BY j.jobid;
$function$;

CREATE OR REPLACE FUNCTION public.admin_vrl_cron_runs()
 RETURNS TABLE(runid bigint, job_name text, status text, return_message text, start_time timestamp with time zone, end_time timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public._assert_admin_or_service();  -- 2026-10-06 G2 접근 검사(결과문은 아래 마지막 문장)
  SELECT d.runid, j.jobname, d.status, d.return_message, d.start_time, d.end_time
  FROM cron.job_run_details d
  JOIN cron.job j ON j.jobid = d.jobid
  WHERE j.jobname LIKE 'vrl-%'
  ORDER BY d.start_time DESC LIMIT 10;
$function$;

CREATE OR REPLACE FUNCTION public.admin_vrl_diagnostic_use()
 RETURNS TABLE(test_id uuid, name_ko text, test_type text, taken_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public._assert_admin_or_service();  -- 2026-10-06 G2 접근 검사(결과문은 아래 마지막 문장)
  SELECT t.id, t.name_ko, t.test_type, COUNT(r.id)::bigint
  FROM public.vrl_diagnostic_tests t
  LEFT JOIN public.user_diagnostic_results r ON r.test_id = t.id
  WHERE t.is_active = true
  GROUP BY t.id, t.name_ko, t.test_type, t.created_at
  ORDER BY t.created_at;
$function$;

CREATE OR REPLACE FUNCTION public.admin_vrl_snapshot_counts()
 RETURNS TABLE(taken_reason text, scope text, count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public._assert_admin_or_service();  -- 2026-10-06 G2 접근 검사(결과문은 아래 마지막 문장)
  SELECT s.taken_reason, s.snapshot_meta->>'scope' AS scope, COUNT(*)::bigint
  FROM public.user_level_snapshots s
  GROUP BY s.taken_reason, s.snapshot_meta->>'scope'
  ORDER BY COUNT(*) DESC;
$function$;

CREATE OR REPLACE FUNCTION public.content_gate_publishable(p_scope text, p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '60000'
AS $function$
BEGIN
  PERFORM public._assert_admin_or_service();  -- 2026-10-06 G2 접근 검사
  RETURN NOT EXISTS (
    SELECT 1 FROM run_content_quality_gates(p_scope, p_id) g
    WHERE g.severity='critical' AND g.verdict='FAIL' AND g.invariant NOT LIKE 'I10%'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.dict_polysemy_count()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSONB;
BEGIN
  PERFORM public._assert_admin_or_service();  -- 2026-10-06 G2 접근 검사
  SELECT jsonb_build_object(
    'total_rows', COUNT(*),
    'senses_is_array', COUNT(*) FILTER (
      WHERE jsonb_typeof(senses) = 'array'
    ),
    'senses_single', COUNT(*) FILTER (
      WHERE jsonb_typeof(senses) = 'array'
        AND jsonb_array_length(senses) = 1
    ),
    'polysemic_2plus', COUNT(*) FILTER (
      WHERE jsonb_typeof(senses) = 'array'
        AND jsonb_array_length(senses) >= 2
    ),
    'high_polysemy_5plus', COUNT(*) FILTER (
      WHERE jsonb_typeof(senses) = 'array'
        AND jsonb_array_length(senses) >= 5
    )
  ) INTO result
  FROM public.shared_dictionary;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.dict_inflections_by_pos()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSONB;
BEGIN
  PERFORM public._assert_admin_or_service();  -- 2026-10-06 G2 접근 검사
  SELECT jsonb_object_agg(
    primary_pos,
    jsonb_build_object(
      'total', total_count,
      'with_inflections', filled_count,
      'pct', CASE
        WHEN total_count > 0
        THEN ROUND(100.0 * filled_count / total_count, 2)
        ELSE 0
      END
    )
  ) INTO result FROM (
    SELECT
      primary_pos,
      COUNT(*) AS total_count,
      COUNT(*) FILTER (
        WHERE inflections IS NOT NULL
          AND inflections::text NOT IN ('{}', 'null')
      ) AS filled_count
    FROM public.shared_dictionary
    WHERE primary_pos IS NOT NULL
    GROUP BY primary_pos
  ) sub;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.dict_categorical_distributions()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  result JSONB;
BEGIN
  PERFORM public._assert_admin_or_service();  -- 2026-10-06 G2 접근 검사
  WITH src AS MATERIALIZED (
    SELECT primary_pos, v_level, v_level_rule_v1, source, cefr_level, frequency_band, verified
    FROM public.shared_dictionary
  )
  SELECT jsonb_build_object(
    'by_primary_pos', (
      SELECT jsonb_object_agg(primary_pos, n)
      FROM (
        SELECT primary_pos, COUNT(*) AS n
        FROM src
        WHERE primary_pos IS NOT NULL
        GROUP BY primary_pos
      ) x
    ),
    'by_v_level', (
      SELECT jsonb_object_agg(v_level::text, n)
      FROM (
        SELECT v_level, COUNT(*) AS n
        FROM src
        WHERE v_level IS NOT NULL
        GROUP BY v_level
      ) x
    ),
    'by_v_level_rule_v1', (
      SELECT jsonb_object_agg(v_level_rule_v1::text, n)
      FROM (
        SELECT v_level_rule_v1, COUNT(*) AS n
        FROM src
        WHERE v_level_rule_v1 IS NOT NULL
        GROUP BY v_level_rule_v1
      ) x
    ),
    'by_source', (
      SELECT jsonb_object_agg(source, n)
      FROM (
        SELECT source, COUNT(*) AS n
        FROM src
        WHERE source IS NOT NULL
        GROUP BY source
      ) x
    ),
    'by_cefr_level', (
      SELECT jsonb_object_agg(cefr_level, n)
      FROM (
        SELECT cefr_level, COUNT(*) AS n
        FROM src
        WHERE cefr_level IS NOT NULL
        GROUP BY cefr_level
      ) x
    ),
    'verified_by_v_level', (
      SELECT jsonb_object_agg(
        v_level::text,
        jsonb_build_object(
          'total', total,
          'verified', verified_count,
          'pct', CASE WHEN total > 0
                      THEN ROUND(100.0 * verified_count / total, 2)
                      ELSE 0 END
        )
      )
      FROM (
        SELECT v_level,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE verified = true) AS verified_count
        FROM src
        WHERE v_level IS NOT NULL
        GROUP BY v_level
      ) x
    ),
    'by_frequency_band', (
      SELECT jsonb_object_agg(frequency_band, n)
      FROM (
        SELECT frequency_band, COUNT(*) AS n
        FROM src
        WHERE frequency_band IS NOT NULL
        GROUP BY frequency_band
      ) x
    )
  ) INTO result;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.select_article_vocab(p_article_id uuid)
 RETURNS TABLE(word text, lemma text, meaning_ko text, v_level smallint, cefr_level text, pos text, example_en text, word_register text, frequency_rank integer, frequency_in_article integer, skill_level smallint, composite_score numeric, sort_order integer, first_sentence text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
 SET statement_timeout TO '30000'
AS $function$
  SELECT public._assert_admin_or_service();  -- 2026-10-06 G2 접근 검사(결과문은 아래 마지막 문장)
  WITH art AS (SELECT la.id, la.article_v_level FROM library_articles la WHERE la.id = p_article_id),
  cand AS (
    SELECT DISTINCT ON (sd.word)
      lower(av.word) AS surface, sd.word AS headword,
      COALESCE(cs.sense_meaning, sd.meaning_ko) AS meaning_ko,
      COALESCE(cs.sense_v, sd.v_level) AS v_level,
      sd.cefr_level AS cefr_level, COALESCE(cs.sense_pos, sd.pos) AS pos,
      sd.example_en AS example_en, sd.verified AS verified,
      COALESCE(sd.word_register, 'standard') AS word_register,
      sd.frequency_rank AS frequency_rank, av.frequency_in_article AS frequency_in_article,
      sd.skill_level AS skill_level, av.first_sentence AS first_sentence,
      art.article_v_level AS avl
    FROM art
    JOIN library_article_vocabularies av ON av.library_article_id = art.id
    JOIN shared_dictionary sd ON sd.word = CASE
      WHEN EXISTS (SELECT 1 FROM shared_dictionary x
                   WHERE x.word = lower(av.word)
                     AND x.classified_by IS NOT NULL
                     AND NOT x.archived
                     AND x.meaning_ko IS NOT NULL AND length(x.meaning_ko) > 0)
      THEN lower(av.word)
      ELSE resolve_dict_headword(av.word)
    END
    LEFT JOIN LATERAL (
      SELECT (s->>'v_level')::smallint AS sense_v, s->>'meaning' AS sense_meaning, s->>'pos' AS sense_pos
      FROM jsonb_array_elements(sd.meanings_ko) s
      WHERE s->>'pos' = COALESCE(av.context_pos, infer_form_pos(lower(av.word), sd.word))
      ORDER BY ((s->>'v_level') IS NOT NULL) DESC LIMIT 1
    ) cs ON true
    WHERE COALESCE(cs.sense_v, sd.v_level) >= 6
      AND sd.classified_by IS NOT NULL
      AND NOT sd.archived
      AND COALESCE(cs.sense_meaning, sd.meaning_ko) IS NOT NULL
      AND length(COALESCE(cs.sense_meaning, sd.meaning_ko)) > 0
      AND COALESCE(sd.word_register, 'standard') NOT IN ('archaic_literary', 'period_cultural', 'phrase_unit', 'brand', 'abbreviation', 'proper_noun')
    ORDER BY sd.word, av.frequency_in_article DESC NULLS LAST
  ),
  norm AS (SELECT c.*, MAX(c.frequency_in_article) OVER () AS article_max_freq FROM cand c),
  scored AS (SELECT n.*, public._extract_composite_score(n.frequency_rank, n.frequency_in_article, n.article_max_freq::int, n.v_level, n.verified, n.example_en, n.skill_level, n.avl) AS composite_score FROM norm n)
  SELECT s.surface AS word, s.headword AS lemma, s.meaning_ko, s.v_level, s.cefr_level, s.pos, s.example_en, s.word_register,
    s.frequency_rank, s.frequency_in_article, s.skill_level, s.composite_score,
    ROW_NUMBER() OVER (ORDER BY s.composite_score DESC, s.frequency_in_article DESC NULLS LAST, s.v_level ASC, s.surface)::int AS sort_order,
    s.first_sentence
  FROM scored s
$function$;

CREATE OR REPLACE FUNCTION public.acp_article_rollup()
 RETURNS TABLE(register text, cefr_level text, items bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30000'
AS $function$
  SELECT public._assert_admin_or_service();  -- 2026-10-06 G2 접근 검사(결과문은 아래 마지막 문장)
  select a.register, a.cefr_level, count(*) as items
  from public.library_articles a
  where a.status = 'published'
  group by a.register, a.cefr_level
$function$;

CREATE OR REPLACE FUNCTION public.db_health_anomalies(p_window_days integer DEFAULT 30, p_min_samples integer DEFAULT 5)
 RETURNS TABLE(axis text, metric text, subject text, latest numeric, prev numeric, median_value numeric, mad numeric, robust_z numeric, pct_change numeric, samples integer, latest_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT public._assert_admin_or_service();  -- 2026-10-06 G2 접근 검사(결과문은 아래 마지막 문장)
  with pts as (
    select m.axis, m.metric, m.dims->>'table' as subject, m.value, m.measured_at
    from db_health_metrics m
    where m.measured_at > now() - make_interval(days => greatest(p_window_days, 1))
  ),
  agg as (
    select p.axis, p.metric, p.subject,
           count(*)::int as samples,
           max(p.measured_at) as latest_at,
           percentile_cont(0.5) within group (order by p.value) as median_value
    from pts p
    group by 1, 2, 3
  ),
  dev as (
    select a.axis, a.metric, a.subject, a.samples, a.latest_at, a.median_value,
           percentile_cont(0.5) within group (order by abs(p.value - a.median_value)) as mad
    from agg a
    join pts p on p.axis = a.axis and p.metric = a.metric
              and p.subject is not distinct from a.subject
    group by 1, 2, 3, 4, 5, 6
  ),
  ends as (
    select d.axis, d.metric, d.subject,
           (select p.value from pts p
             where p.axis = d.axis and p.metric = d.metric
               and p.subject is not distinct from d.subject
             order by p.measured_at desc limit 1) as latest,
           (select p.value from pts p
             where p.axis = d.axis and p.metric = d.metric
               and p.subject is not distinct from d.subject
             order by p.measured_at desc offset 1 limit 1) as prev
    from dev d
  ),
  scored as (
    select d.axis, d.metric, d.subject,
           e.latest, e.prev,
           round(d.median_value::numeric, 3) as median_value,
           round(d.mad::numeric, 3) as mad,
           case when d.mad > 0
                then round((abs(e.latest - d.median_value) / (1.4826 * d.mad))::numeric, 2)
                else null end as robust_z,
           case when e.prev is not null and e.prev <> 0
                then round((100.0 * (e.latest - e.prev) / abs(e.prev))::numeric, 2)
                else null end as pct_change,
           d.samples, d.latest_at
    from dev d
    join ends e on e.axis = d.axis and e.metric = d.metric
               and e.subject is not distinct from d.subject
    where d.samples >= greatest(p_min_samples, 2)
  )
  select s.axis, s.metric, s.subject, s.latest, s.prev, s.median_value, s.mad,
         s.robust_z, s.pct_change, s.samples, s.latest_at
  from scored s
  order by s.robust_z desc nulls last, abs(coalesce(s.pct_change, 0)) desc;
$function$;

CREATE OR REPLACE FUNCTION public.recommend_word_sets_for_user(p_user_id uuid, p_interests text[] DEFAULT NULL::text[])
 RETURNS TABLE(set_id uuid, slug text, title text, category text, word_count integer, cover_emoji text, recommendation_type text, reason text, priority integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_level SMALLINT;
  v_primary_slug TEXT;
  v_stretch_slug TEXT;
  v_review_slug TEXT;
  v_track_levels JSONB;
  v_csat_level INT;
  v_business_level INT;
  v_academic_level INT;
BEGIN
  PERFORM public._assert_self_or_service(p_user_id);  -- 2026-10-06 G2 접근 검사
  SELECT current_v_level, current_track_levels INTO v_current_level, v_track_levels
  FROM public.user_profiles WHERE user_id = p_user_id;

  v_csat_level     := COALESCE((v_track_levels->>'csat_korean')::int, 0);
  v_business_level := COALESCE((v_track_levels->>'business_english')::int, 0);
  v_academic_level := COALESCE((v_track_levels->>'academic_english')::int, 0);

  IF v_current_level IS NULL OR v_current_level = 0 THEN
    RETURN QUERY
    WITH cand AS (
      SELECT ws.id AS set_id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
             'fallback'::TEXT AS recommendation_type,
             '진단 미완료 — 한국 학습자 평균 entry point V3 추천'::TEXT AS reason,
             1 AS priority
      FROM public.shared_word_sets ws
      WHERE ws.slug = 'auto-vlevel-v3' AND ws.is_published
      UNION ALL
      SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
             'specialty'::TEXT,
             ('관심 도메인 — ' || ws.title)::TEXT,
             4
      FROM public.shared_word_sets ws
      WHERE p_interests IS NOT NULL AND array_length(p_interests, 1) > 0
        AND ws.slug = ANY(SELECT 'specialty-' || unnest(p_interests))
        AND ws.is_published
      UNION ALL
      SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
             'topic'::TEXT,
             ('관심 주제 — ' || ws.title)::TEXT,
             5
      FROM public.shared_word_sets ws
      WHERE p_interests IS NOT NULL AND array_length(p_interests, 1) > 0
        AND ws.slug = ANY(SELECT 'topic-' || unnest(p_interests))
        AND ws.subcategory = 'topic' AND ws.is_published
    ),
    dedup AS (
      SELECT DISTINCT ON (c.set_id) c.* FROM cand c ORDER BY c.set_id, c.priority
    )
    SELECT d.set_id, d.slug, d.title, d.category, d.word_count, d.cover_emoji,
           d.recommendation_type, d.reason, d.priority
    FROM dedup d ORDER BY d.priority, d.slug LIMIT 8;
    RETURN;
  END IF;

  v_current_level := LEAST(v_current_level, 9);
  v_primary_slug := 'auto-vlevel-v' || v_current_level::TEXT;
  IF v_current_level < 9 THEN v_stretch_slug := 'auto-vlevel-v' || (v_current_level + 1)::TEXT; END IF;
  IF v_current_level > 1 THEN v_review_slug := 'auto-vlevel-v' || (v_current_level - 1)::TEXT; END IF;

  RETURN QUERY
  WITH cand AS (
    SELECT ws.id AS set_id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
           'primary'::TEXT AS recommendation_type,
           ('현재 V-Level (V' || v_current_level || ') 단어장 — 메인 학습')::TEXT AS reason,
           1 AS priority
    FROM public.shared_word_sets ws
    WHERE ws.slug = v_primary_slug AND ws.is_published
    UNION ALL
    SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
           'stretch'::TEXT,
           ('Krashen i+1 — V' || (v_current_level + 1) || ' 진입 도전')::TEXT,
           2
    FROM public.shared_word_sets ws
    WHERE v_stretch_slug IS NOT NULL AND ws.slug = v_stretch_slug AND ws.is_published
    UNION ALL
    SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
           'review'::TEXT,
           ('V' || (v_current_level - 1) || ' 보강 — 이전 단계 견고화')::TEXT,
           3
    FROM public.shared_word_sets ws
    WHERE v_review_slug IS NOT NULL AND ws.slug = v_review_slug AND ws.is_published
    UNION ALL
    SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
           'specialty'::TEXT,
           ('관심 도메인 — ' || ws.title)::TEXT,
           4
    FROM public.shared_word_sets ws
    WHERE p_interests IS NOT NULL AND array_length(p_interests, 1) > 0
      AND ws.slug = ANY(SELECT 'specialty-' || unnest(p_interests))
      AND ws.is_published
    UNION ALL
    SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
           'track_csat'::TEXT,
           ('수능 강화 — csat_korean L' || v_csat_level || ' (수능 진단 결과)')::TEXT,
           5
    FROM public.shared_word_sets ws
    WHERE v_csat_level >= 6 AND ws.slug LIKE 'kice-%' AND ws.is_published
    UNION ALL
    SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
           'track_business'::TEXT,
           ('TOEIC 강화 — business_english L' || v_business_level || ' (비즈니스 진단 결과)')::TEXT,
           5
    FROM public.shared_word_sets ws
    WHERE v_business_level >= 6 AND ws.slug = 'specialty-business' AND ws.is_published
    UNION ALL
    SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
           'track_academic'::TEXT,
           ('TOEFL 강화 — academic_english L' || v_academic_level || ' (학술 진단 결과)')::TEXT,
           5
    FROM public.shared_word_sets ws
    WHERE v_academic_level >= 6 AND ws.slug = 'specialty-academic' AND ws.is_published
    UNION ALL
    SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
           'book_iplus1'::TEXT,
           ('i+1 도서 — ' || lb.title || ' (내 레벨 기지어 '
             || round((lb.lexical_coverage->>v_current_level::text)::numeric) || '%)')::TEXT,
           6
    FROM (
      SELECT b.id, b.title, b.lexical_coverage
      FROM public.library_books b
      WHERE b.status = 'published' AND b.copyright_safe_in_kr AND b.published_at IS NOT NULL
        AND (b.lexical_coverage->>v_current_level::text)::numeric >= 85
        AND (b.lexical_coverage->>v_current_level::text)::numeric < 95
      ORDER BY (b.lexical_coverage->>v_current_level::text)::numeric DESC
      LIMIT 2
    ) lb
    JOIN LATERAL (
      SELECT s.id, s.slug, s.title, s.category, s.word_count, s.cover_emoji
      FROM public.shared_word_sets s
      WHERE s.category = 'library_book'
        AND s.curation_query->>'book_id' = lb.id::text
        AND s.is_published
      ORDER BY (s.curation_query->>'chapter_idx')::int
      LIMIT 1
    ) ws ON TRUE
    UNION ALL
    SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
           'etymology'::TEXT,
           '어근으로 어휘 계열 확장 — 하나의 어근에서 여러 단어를 묶어 기억'::TEXT,
           7
    FROM public.shared_word_sets ws
    WHERE v_current_level >= 5 AND ws.slug = 'etymology-core' AND ws.is_published
    UNION ALL
    SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
           'topic'::TEXT,
           ('관심 주제 — ' || ws.title)::TEXT,
           8
    FROM public.shared_word_sets ws
    WHERE p_interests IS NOT NULL AND array_length(p_interests, 1) > 0
      AND ws.slug = ANY(SELECT 'topic-' || unnest(p_interests))
      AND ws.subcategory = 'topic' AND ws.is_published

    -- ── 컴포저 산출물 (2026-08-15) — 슬러그가 아니라 세트가 선언한 것으로 고른다 ──
    -- 각 분기는 괄호로 감싼다: UNION ALL 안에서 괄호 없는 ORDER BY/LIMIT 은 union 전체에 걸린다.

    UNION ALL
    (SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
            'composer_level'::TEXT,
            ('내 레벨(V' || v_current_level || ')을 포함한 단어장 — 지금 딱 맞는 난이도')::TEXT,
            2
     FROM public.shared_word_sets ws
     WHERE ws.is_published
       AND ws.curation_query->>'blueprint' = 'level-band'
       AND (ws.curation_query->'recipe'->'select'->'filters'->>'v_level_min')::int <= v_current_level
       AND (ws.curation_query->'recipe'->'select'->'filters'->>'v_level_max')::int >= v_current_level
     ORDER BY ws.word_count DESC
     LIMIT 1)

    UNION ALL
    (SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
            'track_csat'::TEXT,
            ('수능 강화 — 기출 출제 근거로 뽑은 어휘 (csat_korean L' || v_csat_level || ')')::TEXT,
            5
     FROM public.shared_word_sets ws
     WHERE v_csat_level >= 6 AND ws.is_published
       AND ws.curation_query->>'blueprint' IN ('exam-items', 'exam-list')
     ORDER BY (ws.curation_query->>'blueprint' = 'exam-items') DESC, ws.word_count DESC
     LIMIT 1)

    UNION ALL
    (SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
            'track_academic'::TEXT,
            ('학술 강화 — 논문·교재에 반복되는 어휘 (academic_english L' || v_academic_level || ')')::TEXT,
            5
     FROM public.shared_word_sets ws
     WHERE v_academic_level >= 6 AND ws.is_published
       AND ws.curation_query->>'blueprint' = 'academic-awl'
     ORDER BY ws.word_count DESC
     LIMIT 1)

    UNION ALL
    (SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
            'track_business'::TEXT,
            ('실무 강화 — 분야 전문 어휘 (business_english L' || v_business_level || ')')::TEXT,
            5
     FROM public.shared_word_sets ws
     WHERE v_business_level >= 6 AND ws.is_published
       AND ws.curation_query->>'blueprint' = 'domain-specialty'
     ORDER BY ws.word_count DESC
     LIMIT 1)

    UNION ALL
    (SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
            'etymology'::TEXT,
            '어근 하나에서 여러 단어로 — 조각을 알면 처음 보는 단어도 읽힌다'::TEXT,
            7
     FROM public.shared_word_sets ws
     WHERE v_current_level >= 5 AND ws.is_published
       AND ws.curation_query->>'blueprint' IN ('root-etymology', 'word-family')
     ORDER BY ws.word_count DESC
     LIMIT 1)

    UNION ALL
    (SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
            'unlock'::TEXT,
            ('이 단어들을 알면 「' || lb.title || '」의 문장이 열린다')::TEXT,
            6
     FROM (
       SELECT b.id, b.title
       FROM public.library_books b
       WHERE b.status = 'published' AND b.copyright_safe_in_kr AND b.published_at IS NOT NULL
         AND (b.lexical_coverage->>v_current_level::text)::numeric >= 85
         AND (b.lexical_coverage->>v_current_level::text)::numeric < 95
       ORDER BY (b.lexical_coverage->>v_current_level::text)::numeric DESC
       LIMIT 2
     ) lb
     JOIN LATERAL (
       SELECT s.id, s.slug, s.title, s.category, s.word_count, s.cover_emoji
       FROM public.shared_word_sets s
       WHERE s.is_published
         AND s.curation_query->>'blueprint' = 'unlock'
         AND s.curation_query->>'source_book_id' = lb.id::text
       LIMIT 1
     ) ws ON TRUE
     LIMIT 1)

    UNION ALL
    (SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
            'uncovered'::TEXT,
            '다른 단어장이 다루지 않는 말 — 남들이 비워 둔 자리를 메운다'::TEXT,
            9
     FROM public.shared_word_sets ws
     WHERE ws.is_published
       AND ws.curation_query->>'blueprint' = 'uncovered'
     ORDER BY ws.word_count DESC
     LIMIT 1)
  ),
  dedup AS (
    SELECT DISTINCT ON (c.set_id) c.* FROM cand c ORDER BY c.set_id, c.priority
  )
  SELECT d.set_id, d.slug, d.title, d.category, d.word_count, d.cover_emoji,
         d.recommendation_type, d.reason, d.priority
  FROM dedup d
  ORDER BY d.priority, d.slug
  LIMIT 8;
END;
$function$;

CREATE OR REPLACE FUNCTION public.extract_vocabulary_for_user(p_user_id uuid, p_words text[], p_level_strategy text DEFAULT 'auto'::text)
 RETURNS TABLE(text_v_level smallint, user_v_level smallint, effective_user_v smallint, level_source text, gap integer, auto_n integer, word text, meaning_ko text, v_level smallint, cefr_level text, pos text, example_en text, frequency_rank integer, skill_level smallint, track_levels jsonb, composite_score numeric, score_breakdown jsonb, rank integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_v INT; v_text_v INT; v_eff_v INT; v_target_v INT;
  v_gap INT; v_auto_n INT;
  v_csat INT; v_biz INT; v_acad INT;
  v_level_source TEXT;
BEGIN
  PERFORM public._assert_self_or_service(p_user_id);  -- 2026-10-06 G2 접근 검사
  IF p_level_strategy NOT IN ('user', 'text', 'auto') THEN
    RAISE EXCEPTION 'invalid p_level_strategy: %, expected user|text|auto', p_level_strategy;
  END IF;

  SELECT current_v_level,
    COALESCE((current_track_levels->>'csat_korean')::int, 0),
    COALESCE((current_track_levels->>'business_english')::int, 0),
    COALESCE((current_track_levels->>'academic_english')::int, 0)
  INTO v_user_v, v_csat, v_biz, v_acad
  FROM public.user_profiles WHERE user_id = p_user_id;

  -- text P75 (V11 제외) — 항상 계산 (UI에서 비교 표시 가능)
  WITH input_words AS (
    SELECT DISTINCT LOWER(TRIM(w)) AS w FROM unnest(p_words) AS w WHERE LENGTH(TRIM(w)) >= 2
  ),
  word_levels AS (
    SELECT d.v_level::int AS vl
    FROM input_words iw
    JOIN public.shared_dictionary d ON d.word = iw.w
    WHERE d.v_level IS NOT NULL AND d.v_level < 11 AND d.classified_by IS NOT NULL
  )
  SELECT COALESCE(
    (SELECT percentile_disc(0.75) WITHIN GROUP (ORDER BY vl) FROM word_levels), 5
  ) INTO v_text_v;

  -- strategy에 따라 effective level + source 결정
  IF p_level_strategy = 'user' THEN
    IF v_user_v IS NULL OR v_user_v = 0 THEN
      RAISE EXCEPTION '본인 레벨 기준 선택했으나 진단 미완료 — /diagnostic 진단 후 시도 또는 text 모드 사용';
    END IF;
    v_eff_v := v_user_v;
    v_level_source := 'user_diagnostic';
  ELSIF p_level_strategy = 'text' THEN
    v_eff_v := GREATEST(v_text_v - 1, 1);  -- 글 직전 단계로 가정 → target=P75
    v_level_source := 'text_p75';
  ELSE  -- 'auto'
    IF v_user_v IS NOT NULL AND v_user_v > 0 THEN
      v_eff_v := v_user_v;
      v_level_source := 'auto_user_diagnostic';
    ELSE
      v_eff_v := GREATEST(v_text_v - 1, 1);
      v_level_source := 'auto_text_p75_fallback';
    END IF;
  END IF;

  v_target_v := LEAST(v_eff_v + 1, 10);
  v_gap := GREATEST(v_text_v - v_eff_v, 0);
  v_auto_n := LEAST(GREATEST(8 + v_gap * 4, 5), 30);

  RETURN QUERY
  WITH input_words AS (
    SELECT DISTINCT LOWER(TRIM(w)) AS w FROM unnest(p_words) AS w WHERE LENGTH(TRIM(w)) >= 2
  ),
  candidates AS (
    SELECT d.word AS c_word, d.meaning_ko AS c_meaning, d.v_level AS c_vl,
           d.cefr_level AS c_cefr, d.pos AS c_pos, d.example_en AS c_ex,
           d.frequency_rank AS c_freq, d.skill_level AS c_skill, d.track_levels AS c_tracks
    FROM input_words iw
    JOIN public.shared_dictionary d ON d.word = iw.w
    LEFT JOIN public.vocabularies v ON v.user_id = p_user_id AND LOWER(v.word) = d.word
    WHERE v.id IS NULL AND d.v_level IS NOT NULL
      AND d.meaning_ko IS NOT NULL AND LENGTH(d.meaning_ko) > 0
      AND d.classified_by IS NOT NULL
  ),
  scored AS (
    SELECT c.*,
      EXP(-((c.c_vl::numeric - v_target_v)^2) / 4.5) AS c_vprox,
      GREATEST(
        CASE WHEN v_csat >= 4 AND (c.c_tracks->>'csat_korean')::int >= 4
             THEN 1.0 - ABS((c.c_tracks->>'csat_korean')::int - v_csat)::numeric / 10.0 ELSE 0 END,
        CASE WHEN v_biz >= 4 AND (c.c_tracks->>'business_english')::int >= 4
             THEN 1.0 - ABS((c.c_tracks->>'business_english')::int - v_biz)::numeric / 10.0 ELSE 0 END,
        CASE WHEN v_acad >= 4 AND (c.c_tracks->>'academic_english')::int >= 4
             THEN 1.0 - ABS((c.c_tracks->>'academic_english')::int - v_acad)::numeric / 10.0 ELSE 0 END,
        0.0
      ) AS c_track,
      1.0 / LOG(10, COALESCE(c.c_freq, 50000)::numeric + 10) AS c_freqb,
      CASE WHEN c.c_skill = 4 AND v_eff_v < 6 THEN -0.10 ELSE 0 END AS c_skillp,
      CASE WHEN c.c_vl >= 11 THEN -0.50 WHEN c.c_vl >= 10 THEN -0.20 ELSE 0 END AS c_arch
    FROM candidates c
  ),
  composite AS (
    SELECT s.*,
      ROUND(0.50*s.c_vprox + 0.25*s.c_track + 0.15*s.c_freqb + s.c_skillp + s.c_arch, 4) AS c_score,
      ROW_NUMBER() OVER (
        ORDER BY (0.50*s.c_vprox + 0.25*s.c_track + 0.15*s.c_freqb + s.c_skillp + s.c_arch) DESC,
                 s.c_freq ASC NULLS LAST
      ) AS c_rn
    FROM scored s
  )
  SELECT
    v_text_v::smallint, v_user_v::smallint, v_eff_v::smallint, v_level_source,
    v_gap, v_auto_n,
    c.c_word, c.c_meaning, c.c_vl::smallint, c.c_cefr, c.c_pos, c.c_ex,
    c.c_freq, c.c_skill::smallint, c.c_tracks,
    c.c_score,
    jsonb_build_object(
      'user_v_level', v_eff_v, 'target_v_level', v_target_v,
      'v_proximity', ROUND(c.c_vprox, 4),
      'track_boost', ROUND(c.c_track, 4),
      'frequency_boost', ROUND(c.c_freqb, 4),
      'skill_penalty', c.c_skillp, 'archaic_penalty', c.c_arch,
      'weights', jsonb_build_object('v_proximity', 0.50, 'track_boost', 0.25, 'frequency_boost', 0.15),
      'reasoning', CASE
        WHEN c.c_vl = v_target_v THEN 'i+1 zone — 최적 도전'
        WHEN c.c_vl BETWEEN v_eff_v - 1 AND v_eff_v THEN '현재 V-Level — 견고화'
        WHEN c.c_vl > v_target_v THEN 'i+2 이상 — 도전적'
        WHEN c.c_vl < v_eff_v - 1 THEN 'i-2 이하 — 보강'
        ELSE 'mid-range'
      END
    ),
    c.c_rn::int
  FROM composite c
  WHERE c.c_rn <= v_auto_n
  ORDER BY c.c_rn;
END;
$function$;

CREATE OR REPLACE FUNCTION public.extract_vocabulary_for_user_v2(p_user_id uuid, p_words text[], p_level_strategy text DEFAULT 'auto'::text, p_limit integer DEFAULT NULL::integer)
 RETURNS TABLE(text_v_level smallint, user_v_level smallint, effective_user_v smallint, level_source text, gap integer, auto_n integer, v_threshold smallint, total_candidates integer, word text, meaning_ko text, v_level smallint, cefr_level text, pos text, example_en text, frequency_rank integer, skill_level smallint, track_levels jsonb, composite_score numeric, score_breakdown jsonb, rank integer, match_layer smallint, matched_via_surface text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_v INT; v_text_v INT; v_eff_v INT; v_gap INT; v_auto_n INT;
  v_csat INT; v_biz INT; v_acad INT; v_level_source TEXT; v_thresh INT; v_effective_limit INT;
BEGIN
  PERFORM public._assert_self_or_service(p_user_id);  -- 2026-10-06 G2 접근 검사
  IF p_level_strategy NOT IN ('user', 'text', 'auto') THEN
    RAISE EXCEPTION 'invalid p_level_strategy: %, expected user|text|auto', p_level_strategy;
  END IF;
  SELECT current_v_level,
    COALESCE((current_track_levels->>'csat_korean')::int, 0),
    COALESCE((current_track_levels->>'business_english')::int, 0),
    COALESCE((current_track_levels->>'academic_english')::int, 0)
  INTO v_user_v, v_csat, v_biz, v_acad
  FROM public.user_profiles WHERE user_id = p_user_id;

  WITH input_words AS (SELECT DISTINCT LOWER(TRIM(w)) AS w FROM unnest(p_words) AS w WHERE LENGTH(TRIM(w)) >= 2),
  word_levels AS (
    SELECT d.v_level::int AS vl FROM input_words iw
    JOIN public.shared_dictionary d ON d.word = public.resolve_dict_headword(iw.w)
    WHERE d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
  )
  SELECT COALESCE((SELECT percentile_disc(0.75) WITHIN GROUP (ORDER BY vl) FROM word_levels), 5) INTO v_text_v;

  IF p_level_strategy = 'user' THEN
    IF v_user_v IS NULL OR v_user_v = 0 THEN RAISE EXCEPTION '본인 레벨 기준 선택했으나 진단 미완료 — /diagnostic 진단 후 시도 또는 text 모드 사용'; END IF;
    v_eff_v := v_user_v; v_thresh := v_user_v + 1; v_level_source := 'user_diagnostic';
  ELSIF p_level_strategy = 'text' THEN
    v_eff_v := GREATEST(v_text_v - 1, 1); v_thresh := v_text_v; v_level_source := 'text_p75';
  ELSE
    IF v_user_v IS NOT NULL AND v_user_v > 0 THEN v_eff_v := v_user_v; v_thresh := v_user_v + 1; v_level_source := 'auto_user_diagnostic';
    ELSE v_eff_v := GREATEST(v_text_v - 1, 1); v_thresh := v_text_v; v_level_source := 'auto_text_p75_fallback'; END IF;
  END IF;
  v_thresh := GREATEST(1, LEAST(v_thresh, 11));
  v_gap := GREATEST(v_text_v - v_eff_v, 0); v_auto_n := 30;
  v_effective_limit := CASE WHEN p_limit IS NULL THEN 30 WHEN p_limit = 0 THEN 9999 ELSE GREATEST(1, LEAST(p_limit, 9999)) END;

  RETURN QUERY
  WITH input_words AS (SELECT DISTINCT LOWER(TRIM(w)) AS w FROM unnest(p_words) AS w WHERE LENGTH(TRIM(w)) >= 2),
  resolved AS (SELECT iw.w AS surface, public.resolve_dict_headword(iw.w) AS hw FROM input_words iw),
  cand AS (
    SELECT DISTINCT ON (d.word)
      r.surface AS c_surface, d.word AS c_word,
      COALESCE(cs.sense_meaning, d.meaning_ko) AS c_meaning,
      COALESCE(cs.sense_v, d.v_level) AS c_vl,
      d.cefr_level AS c_cefr, COALESCE(cs.sense_pos, d.pos) AS c_pos, d.example_en AS c_ex,
      d.frequency_rank AS c_freq, d.skill_level AS c_skill, d.track_levels AS c_tracks,
      (CASE WHEN d.word = r.surface THEN 1 ELSE 2 END)::smallint AS c_layer
    FROM resolved r
    JOIN public.shared_dictionary d ON d.word = r.hw
    LEFT JOIN LATERAL (
      SELECT (s->>'v_level')::smallint AS sense_v, s->>'meaning' AS sense_meaning, s->>'pos' AS sense_pos
      FROM jsonb_array_elements(d.meanings_ko) s
      WHERE s->>'pos' = infer_form_pos(r.surface, d.word)
      ORDER BY ((s->>'v_level') IS NOT NULL) DESC LIMIT 1
    ) cs ON true
    WHERE COALESCE(cs.sense_v, d.v_level) >= v_thresh
      AND d.classified_by IS NOT NULL
      AND COALESCE(cs.sense_meaning, d.meaning_ko) IS NOT NULL AND LENGTH(COALESCE(cs.sense_meaning, d.meaning_ko)) > 0
      AND COALESCE(d.word_register, 'standard') NOT IN ('archaic_literary','period_cultural','phrase_unit','brand','abbreviation','proper_noun')
    ORDER BY d.word, (CASE WHEN d.word = r.surface THEN 0 ELSE 1 END), r.surface
  ),
  filtered AS (
    SELECT c.* FROM cand c
    LEFT JOIN public.vocabularies v ON v.user_id = p_user_id AND LOWER(v.word) = c.c_word
    LEFT JOIN public.word_familiarity wf ON wf.user_id = p_user_id AND wf.lemma = c.c_word AND wf.verdict = 'known'
    WHERE v.id IS NULL AND wf.lemma IS NULL
  ),
  scored AS (
    SELECT f.*,
      GREATEST(
        CASE WHEN v_csat >= 4 AND (f.c_tracks->>'csat_korean')::int >= 4 THEN 1.0 - ABS((f.c_tracks->>'csat_korean')::int - v_csat)::numeric / 10.0 ELSE 0 END,
        CASE WHEN v_biz >= 4 AND (f.c_tracks->>'business_english')::int >= 4 THEN 1.0 - ABS((f.c_tracks->>'business_english')::int - v_biz)::numeric / 10.0 ELSE 0 END,
        CASE WHEN v_acad >= 4 AND (f.c_tracks->>'academic_english')::int >= 4 THEN 1.0 - ABS((f.c_tracks->>'academic_english')::int - v_acad)::numeric / 10.0 ELSE 0 END,
        0.0
      ) AS c_track,
      1.0 / LOG(10, COALESCE(f.c_freq, 50000)::numeric + 10) AS c_freqb,
      CASE WHEN f.c_skill = 4 AND v_eff_v < 6 THEN -0.10 ELSE 0 END AS c_skillp
    FROM filtered f
  ),
  composite AS (
    SELECT s.*, ROUND(0.70*s.c_freqb + 0.30*s.c_track + s.c_skillp, 4) AS c_score,
      ROW_NUMBER() OVER (ORDER BY (0.70*s.c_freqb + 0.30*s.c_track + s.c_skillp) DESC, s.c_vl ASC, s.c_freq ASC NULLS LAST) AS c_rn,
      COUNT(*) OVER () AS c_total
    FROM scored s
  )
  SELECT
    v_text_v::smallint, v_user_v::smallint, v_eff_v::smallint, v_level_source,
    v_gap, v_auto_n, v_thresh::smallint, c.c_total::int,
    c.c_surface, c.c_meaning, c.c_vl::smallint, c.c_cefr, c.c_pos, c.c_ex,
    c.c_freq, c.c_skill::smallint, c.c_tracks, c.c_score,
    jsonb_build_object(
      'user_v_level', v_eff_v, 'v_threshold', v_thresh,
      'track_boost', ROUND(c.c_track, 4), 'frequency_boost', ROUND(c.c_freqb, 4), 'skill_penalty', c.c_skillp,
      'weights', jsonb_build_object('frequency_boost', 0.70, 'track_boost', 0.30),
      'match_layer', c.c_layer, 'matched_via_surface', c.c_word,
      'method', 'unified_resolve_dict_headword',
      'reasoning', 'V' || c.c_vl || ' ≥ threshold V' || v_thresh || CASE WHEN c.c_vl = v_thresh THEN ' (정확히 threshold)' ELSE '' END
    ),
    c.c_rn::int, c.c_layer, c.c_word
  FROM composite c
  WHERE c.c_rn <= v_effective_limit
  ORDER BY c.c_rn;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_pending_words(p_user_id uuid, p_lemmas text[], p_text_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_recorded INT := 0;
BEGIN
  PERFORM public._assert_self_or_service(p_user_id);  -- 2026-10-06 G2 접근 검사
  WITH input AS (
    SELECT DISTINCT LOWER(TRIM(w)) AS lemma 
    FROM unnest(p_lemmas) AS w 
    WHERE LENGTH(TRIM(w)) >= 2
  ),
  upserted AS (
    INSERT INTO public.pending_words (lemma, user_id, text_id, encounter_count)
    SELECT i.lemma, p_user_id, p_text_id, 1 FROM input i
    ON CONFLICT (lemma) DO UPDATE 
      SET encounter_count = pending_words.encounter_count + 1,
          updated_at = now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_recorded FROM upserted;
  
  RETURN v_recorded;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_user_known_word_count(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count integer;
BEGIN
  PERFORM public._assert_self_or_service(p_user_id);  -- 2026-10-06 G2 접근 검사
  SELECT count(*) INTO v_count FROM vocabularies WHERE user_id = p_user_id AND stability >= 21;
  INSERT INTO user_stats (user_id, known_word_count, updated_at) VALUES (p_user_id, v_count, now())
  ON CONFLICT (user_id) DO UPDATE SET known_word_count = v_count, updated_at = now();
  RETURN v_count;
END $function$;

CREATE OR REPLACE FUNCTION public.analyze_and_apply_diagnostic_result(p_result_id uuid)
 RETURNS TABLE(snapshot_id uuid, estimated_v_level smallint, confidence numeric, per_level jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_est_level SMALLINT;
  v_conf NUMERIC;
  v_per_level JSONB;
  v_snap_id UUID;
BEGIN
  PERFORM public._assert_self_or_service((select r.user_id from public.user_diagnostic_results r where r.id = p_result_id));  -- 2026-10-06 G2 접근 검사
  -- 1. analyze
  SELECT a.estimated_v_level, a.confidence, a.per_level
  INTO v_est_level, v_conf, v_per_level
  FROM public.analyze_diagnostic_result(p_result_id) a;

  -- 2. SET estimated values on user_diagnostic_results
  UPDATE public.user_diagnostic_results
  SET estimated_v_level = v_est_level,
      confidence = v_conf
  WHERE id = p_result_id;

  -- 3. apply (existing function handles user_profiles + snapshot via update_user_v_level)
  SELECT public.apply_diagnostic_result(p_result_id) INTO v_snap_id;

  RETURN QUERY SELECT v_snap_id, v_est_level, v_conf, v_per_level;
END;
$function$;

CREATE OR REPLACE FUNCTION public.analyze_and_apply_track_diagnostic_result(p_result_id uuid)
 RETURNS TABLE(user_id uuid, track_id text, estimated_track_level smallint, confidence numeric, per_level jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID; v_track_id TEXT; v_test_id UUID;
  v_est_level SMALLINT; v_conf NUMERIC; v_per_level JSONB;
  v_current_v SMALLINT; v_merged_tracks JSONB;
  v_previous_track_level INT; v_track_delta INT; v_prev_snapshot_id UUID;
BEGIN
  PERFORM public._assert_self_or_service((select r.user_id from public.user_diagnostic_results r where r.id = p_result_id));  -- 2026-10-06 G2 접근 검사
  SELECT a.estimated_track_level, a.track_id, a.confidence, a.per_level
  INTO v_est_level, v_track_id, v_conf, v_per_level
  FROM public.analyze_track_diagnostic_result(p_result_id) a;

  SELECT r.user_id, r.test_id INTO v_user_id, v_test_id
  FROM public.user_diagnostic_results r WHERE r.id = p_result_id;

  SELECT current_v_level, COALESCE((current_track_levels->>v_track_id)::int, 0)
  INTO v_current_v, v_previous_track_level
  FROM public.user_profiles WHERE user_profiles.user_id = v_user_id;

  v_track_delta := v_est_level - v_previous_track_level;

  UPDATE public.user_diagnostic_results
  SET estimated_track_levels = jsonb_build_object(v_track_id, v_est_level), confidence = v_conf
  WHERE id = p_result_id;

  UPDATE public.user_profiles
  SET current_track_levels = COALESCE(current_track_levels, '{}'::jsonb)
                             || jsonb_build_object(v_track_id, v_est_level),
      updated_at = now()
  WHERE user_profiles.user_id = v_user_id
  RETURNING current_track_levels INTO v_merged_tracks;

  SELECT s.id INTO v_prev_snapshot_id
  FROM public.user_level_snapshots s
  WHERE s.user_id = v_user_id ORDER BY s.taken_at DESC LIMIT 1;

  INSERT INTO public.user_level_snapshots (
    user_id, v_level, v_level_meta, previous_v_level, track_levels,
    taken_reason, taken_at, diagnostic_result_id,
    snapshot_meta, snapshot_type, triggered_by, trigger_details, previous_snapshot_id
  ) VALUES (
    v_user_id, COALESCE(v_current_v, 0),
    jsonb_build_object(
      'level', COALESCE(v_current_v, 0),
      'source', 'track_diagnostic_unchanged',
      'confidence', v_conf,
      'estimated_at', now(),
      'status', 'active',
      'track_id', v_track_id
    ),
    v_current_v, v_merged_tracks,
    'diagnostic', now(), p_result_id,
    jsonb_build_object(
      'test_id', v_test_id, 'track_id', v_track_id,
      'estimated_track_level', v_est_level,
      'previous_track_level', v_previous_track_level,
      'track_delta', v_track_delta,
      'confidence', v_conf, 'per_level', v_per_level,
      'scope', 'track'
    ),
    'level_change', 'internal',
    jsonb_build_object('caller', 'analyze_and_apply_track_diagnostic_result', 'result_id', p_result_id, 'track_id', v_track_id),
    v_prev_snapshot_id
  );

  RETURN QUERY SELECT v_user_id, v_track_id, v_est_level, v_conf, v_per_level;
END;
$function$;

CREATE OR REPLACE FUNCTION public.analyze_and_apply_comprehensive_diagnostic_result(p_result_id uuid)
 RETURNS TABLE(user_id uuid, estimated_v_level smallint, estimated_track_levels jsonb, confidence numeric, per_level jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_responses JSONB;
  v_test_id UUID;
  v_per_level JSONB;
  v_v_est SMALLINT;
  v_conf NUMERIC;
  v_track_csat INT;
  v_track_biz INT;
  v_track_acad INT;
  v_tracks JSONB;
  v_prev_v SMALLINT;
  v_prev_snapshot_id UUID;
BEGIN
  PERFORM public._assert_self_or_service((select r.user_id from public.user_diagnostic_results r where r.id = p_result_id));  -- 2026-10-06 G2 접근 검사
  SELECT r.user_id, r.responses, r.test_id INTO v_user_id, v_responses, v_test_id
  FROM public.user_diagnostic_results r WHERE r.id = p_result_id;

  -- base V-Level analysis (standard)
  WITH resp AS (
    SELECT (r->>'question_id')::uuid AS qid, (r->>'knew')::bool AS knew
    FROM jsonb_array_elements(v_responses) r
  ),
  joined AS (
    SELECT q.target_v_level AS vl, r.knew, q.word
    FROM resp r JOIN public.vrl_diagnostic_questions q ON q.id = r.qid
    WHERE q.target_v_level IS NOT NULL
  ),
  per_level_calc AS (
    SELECT vl,
      COUNT(*) FILTER (WHERE knew) AS correct, COUNT(*) AS total,
      ROUND(COUNT(*) FILTER (WHERE knew)::numeric / NULLIF(COUNT(*),0), 3) AS acc
    FROM joined GROUP BY vl
  )
  SELECT jsonb_object_agg(vl::text, jsonb_build_object('correct', correct, 'total', total, 'accuracy', acc))
  INTO v_per_level FROM per_level_calc;

  IF v_per_level IS NULL THEN v_per_level := '{}'::jsonb; END IF;

  WITH arr AS (SELECT (key::int) AS vl, (value->>'accuracy')::numeric AS acc FROM jsonb_each(v_per_level))
  SELECT COALESCE(MAX(vl), 1)::smallint INTO v_v_est FROM arr WHERE acc >= 0.70;

  WITH c AS (SELECT SUM((value->>'correct')::numeric) AS tc, SUM((value->>'total')::numeric) AS tt FROM jsonb_each(v_per_level))
  SELECT ROUND(CASE WHEN tt > 0 THEN tc/tt ELSE 0 END, 3) INTO v_conf FROM c;

  -- per-track analysis (JOIN shared_dictionary to filter by tag)
  WITH resp AS (
    SELECT (r->>'question_id')::uuid AS qid, (r->>'knew')::bool AS knew
    FROM jsonb_array_elements(v_responses) r
  ),
  joined AS (
    SELECT q.target_v_level AS vl, r.knew, sd.list_tags
    FROM resp r
    JOIN public.vrl_diagnostic_questions q ON q.id = r.qid
    JOIN public.shared_dictionary sd ON sd.word = q.word
    WHERE q.target_v_level IS NOT NULL
  ),
  -- csat
  csat_level AS (
    SELECT MAX(vl) AS lvl FROM (
      SELECT vl, COUNT(*) FILTER (WHERE knew)::numeric / NULLIF(COUNT(*),0) AS acc
      FROM joined
      WHERE list_tags @> ARRAY['csat-prep-core-2k'] OR list_tags @> ARRAY['csat-prep-ext-1.8k']
      GROUP BY vl
    ) sub WHERE acc >= 0.70
  ),
  biz_level AS (
    SELECT MAX(vl) AS lvl FROM (
      SELECT vl, COUNT(*) FILTER (WHERE knew)::numeric / NULLIF(COUNT(*),0) AS acc
      FROM joined WHERE list_tags @> ARRAY['bsl_1.20']
      GROUP BY vl
    ) sub WHERE acc >= 0.70
  ),
  acad_level AS (
    SELECT MAX(vl) AS lvl FROM (
      SELECT vl, COUNT(*) FILTER (WHERE knew)::numeric / NULLIF(COUNT(*),0) AS acc
      FROM joined WHERE list_tags @> ARRAY['nawl_1.2']
      GROUP BY vl
    ) sub WHERE acc >= 0.70
  )
  SELECT COALESCE((SELECT lvl FROM csat_level), 0),
         COALESCE((SELECT lvl FROM biz_level), 0),
         COALESCE((SELECT lvl FROM acad_level), 0)
  INTO v_track_csat, v_track_biz, v_track_acad;

  v_tracks := jsonb_build_object(
    'csat_korean', v_track_csat,
    'business_english', v_track_biz,
    'academic_english', v_track_acad
  );

  -- previous v_level
  SELECT current_v_level INTO v_prev_v FROM public.user_profiles WHERE user_profiles.user_id = v_user_id;

  -- UPDATE user_diagnostic_results
  UPDATE public.user_diagnostic_results
  SET estimated_v_level = v_v_est,
      estimated_track_levels = v_tracks,
      confidence = v_conf
  WHERE id = p_result_id;

  -- UPDATE user_profiles (base + all tracks)
  UPDATE public.user_profiles
  SET current_v_level = v_v_est,
      current_track_levels = COALESCE(current_track_levels, '{}'::jsonb) || v_tracks,
      current_v_level_meta = jsonb_build_object(
        'source', 'comprehensive_diagnostic',
        'diagnostic_result_id', p_result_id,
        'confidence', v_conf,
        'per_level', v_per_level,
        'set_at', now()
      ),
      diagnostic_completed_at = now(),
      updated_at = now()
  WHERE user_profiles.user_id = v_user_id;

  -- snapshot 생성 (base + tracks 동시)
  SELECT s.id INTO v_prev_snapshot_id
  FROM public.user_level_snapshots s
  WHERE s.user_id = v_user_id ORDER BY s.taken_at DESC LIMIT 1;

  INSERT INTO public.user_level_snapshots (
    user_id, v_level, v_level_meta, previous_v_level, track_levels,
    taken_reason, taken_at, diagnostic_result_id,
    snapshot_meta, snapshot_type, triggered_by, trigger_details, previous_snapshot_id
  ) VALUES (
    v_user_id, v_v_est,
    jsonb_build_object(
      'level', v_v_est, 'source', 'comprehensive_diagnostic',
      'confidence', v_conf, 'estimated_at', now(),
      'status', 'active'
    ),
    v_prev_v, v_tracks,
    'diagnostic', now(), p_result_id,
    jsonb_build_object(
      'test_id', v_test_id, 'scope', 'comprehensive',
      'v_level', v_v_est, 'track_levels', v_tracks,
      'confidence', v_conf, 'per_level', v_per_level
    ),
    'level_change', 'internal',
    jsonb_build_object('caller', 'analyze_and_apply_comprehensive_diagnostic_result', 'result_id', p_result_id),
    v_prev_snapshot_id
  );

  RETURN QUERY SELECT v_user_id, v_v_est, v_tracks, v_conf, v_per_level;
END;
$function$;

-- ③ 권한 (manifest class 기준)
revoke execute on function bulk_compute_cefrj_for_all_sources() from public, anon, authenticated;
grant execute on function bulk_compute_cefrj_for_all_sources() to service_role;
revoke execute on function knowledge_import_claim(jsonb,jsonb) from public, anon, authenticated;
grant execute on function knowledge_import_claim(jsonb,jsonb) to service_role;
revoke execute on function trg_lcm_chunk_refs() from public, anon, authenticated;
revoke execute on function trg_require_article_audio() from public, anon, authenticated;
revoke execute on function pgmq_archive(text,bigint) from public, anon, authenticated;
grant execute on function pgmq_archive(text,bigint) to service_role;
revoke execute on function auto_curate_book(uuid) from public, anon, authenticated;
grant execute on function auto_curate_book(uuid) to service_role;
revoke execute on function csat_ec_capture_close(uuid,text,text) from public, anon, authenticated;
grant execute on function csat_ec_capture_close(uuid,text,text) to authenticated;
revoke execute on function select_book_chapter_vocab(uuid) from public, anon, authenticated;
grant execute on function select_book_chapter_vocab(uuid) to service_role;
revoke execute on function admin_vrl_track_distribution() from public, anon, authenticated;
grant execute on function admin_vrl_track_distribution() to authenticated;
revoke execute on function admin_vrl_v_level_distribution() from public, anon, authenticated;
grant execute on function admin_vrl_v_level_distribution() to authenticated;
revoke execute on function csat_map_recompute_node() from public, anon, authenticated;
revoke execute on function calc_track_level(text,text) from public, anon, authenticated;
grant execute on function calc_track_level(text,text) to service_role;
revoke execute on function publish_book_word_sets(uuid,integer) from public, anon, authenticated;
grant execute on function publish_book_word_sets(uuid,integer) to service_role;
revoke execute on function record_db_health_checkpoint(text,text,text) from public, anon, authenticated;
grant execute on function record_db_health_checkpoint(text,text,text) to service_role;
revoke execute on function knowledge_links_check_layer() from public, anon, authenticated;
revoke execute on function csat_ec_close_tombstone(bigint,text) from public, anon, authenticated;
grant execute on function csat_ec_close_tombstone(bigint,text) to authenticated;
revoke execute on function csat_hold_on_item_change() from public, anon, authenticated;
revoke execute on function derive_learner_stage(uuid) from public, anon, authenticated;
grant execute on function derive_learner_stage(uuid) to service_role;
revoke execute on function csat_analysis_hash(csat_item_analyses) from public, anon, authenticated;
grant execute on function csat_analysis_hash(csat_item_analyses) to service_role;
revoke execute on function auto_promote_v_level_for_user(uuid) from public, anon, authenticated;
grant execute on function auto_promote_v_level_for_user(uuid) to authenticated;
revoke execute on function csat_ec_blind_queue(bigint) from public, anon, authenticated;
grant execute on function csat_ec_blind_queue(bigint) to authenticated;
revoke execute on function select_book_chapter_quiz(uuid,integer) from public, anon, authenticated;
grant execute on function select_book_chapter_quiz(uuid,integer) to authenticated;
revoke execute on function admin_vrl_diagnostic_use() from public, anon, authenticated;
grant execute on function admin_vrl_diagnostic_use() to authenticated;
revoke execute on function admin_delete_article(uuid) from public, anon, authenticated;
grant execute on function admin_delete_article(uuid) to authenticated;
revoke execute on function csat_demote_on_review_change() from public, anon, authenticated;
revoke execute on function csat_visual_head_guard() from public, anon, authenticated;
revoke execute on function csat_ec_my_key() from public, anon, authenticated;
revoke execute on function find_derivational_candidates() from public, anon, authenticated;
grant execute on function find_derivational_candidates() to service_role;
revoke execute on function select_pd_comic_info(text) from public, anon, authenticated;
grant execute on function select_pd_comic_info(text) to anon, authenticated;
revoke execute on function enrich_shared_dictionary(jsonb) from public, anon, authenticated;
grant execute on function enrich_shared_dictionary(jsonb) to service_role;
revoke execute on function csat_ec_pilot_eligible(uuid,smallint) from public, anon, authenticated;
revoke execute on function recommend_word_sets_for_user(uuid,text[]) from public, anon, authenticated;
grant execute on function recommend_word_sets_for_user(uuid,text[]) to authenticated;
revoke execute on function incr_chunk_refs(text[]) from public, anon, authenticated;
grant execute on function incr_chunk_refs(text[]) to service_role;
revoke execute on function knowledge_items_track() from public, anon, authenticated;
revoke execute on function admin_run_db_health_action(text,text,text,bigint) from public, anon, authenticated;
grant execute on function admin_run_db_health_action(text,text,text,bigint) to authenticated;
revoke execute on function process_library_pipeline_batch(integer) from public, anon, authenticated;
grant execute on function process_library_pipeline_batch(integer) to service_role;
revoke execute on function csat_ec_round_assign(bigint,uuid,text,text[]) from public, anon, authenticated;
grant execute on function csat_ec_round_assign(bigint,uuid,text,text[]) to authenticated;
revoke execute on function csat_is_hakpyeong_item(text) from public, anon, authenticated;
grant execute on function csat_is_hakpyeong_item(text) to service_role;
revoke execute on function join_class_by_code(text) from public, anon, authenticated;
grant execute on function join_class_by_code(text) to authenticated;
revoke execute on function select_book_chapter_coverage(uuid,integer) from public, anon, authenticated;
grant execute on function select_book_chapter_coverage(uuid,integer) to service_role;
revoke execute on function vcb_publish_commit(bigint,text,integer,text,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function vcb_publish_commit(bigint,text,integer,text,text,jsonb,jsonb,text) to service_role;
revoke execute on function unresolved_dict_words(text[]) from public, anon, authenticated;
grant execute on function unresolved_dict_words(text[]) to authenticated;
revoke execute on function csat_publish_hakpyeong(uuid[]) from public, anon, authenticated;
grant execute on function csat_publish_hakpyeong(uuid[]) to service_role;
revoke execute on function csat_ec_canonical_input(uuid,smallint) from public, anon, authenticated;
revoke execute on function enforce_source_eligibility_freshness() from public, anon, authenticated;
revoke execute on function calc_v_level(text) from public, anon, authenticated;
grant execute on function calc_v_level(text) to anon, authenticated;
revoke execute on function csat_chart_analysis_bindable(uuid,text) from public, anon, authenticated;
grant execute on function csat_chart_analysis_bindable(uuid,text) to service_role;
revoke execute on function csat_item_input_hash(text) from public, anon, authenticated;
grant execute on function csat_item_input_hash(text) to service_role;
revoke execute on function books_needing_audit(integer) from public, anon, authenticated;
grant execute on function books_needing_audit(integer) to service_role;
revoke execute on function agg_daily_activity_from_learning_record() from public, anon, authenticated;
revoke execute on function list_book_comic_catalog() from public, anon, authenticated;
grant execute on function list_book_comic_catalog() to anon, authenticated;
revoke execute on function deliver_chapter_vocab(uuid,integer) from public, anon, authenticated;
grant execute on function deliver_chapter_vocab(uuid,integer) to authenticated;
revoke execute on function select_coverage_for_words(text[]) from public, anon, authenticated;
grant execute on function select_coverage_for_words(text[]) to service_role;
revoke execute on function sync_cefr_from_v_level() from public, anon, authenticated;
revoke execute on function csat_ec_item_input_hash(uuid,smallint) from public, anon, authenticated;
revoke execute on function claim_topic_corpus_batch(text,integer) from public, anon, authenticated;
grant execute on function claim_topic_corpus_batch(text,integer) to service_role;
revoke execute on function surface_variants(text) from public, anon, authenticated;
grant execute on function surface_variants(text) to anon, authenticated;
revoke execute on function csat_ec_round_advance(bigint,text,text) from public, anon, authenticated;
grant execute on function csat_ec_round_advance(bigint,text,text) to authenticated;
revoke execute on function trg_lb_enqueue_pipeline() from public, anon, authenticated;
revoke execute on function enforce_archaic_not_in_shared() from public, anon, authenticated;
revoke execute on function csat_ec_judgment_input_hash(uuid,smallint) from public, anon, authenticated;
revoke execute on function book_comic_available(uuid) from public, anon, authenticated;
grant execute on function book_comic_available(uuid) to service_role;
revoke execute on function csat_guard_published() from public, anon, authenticated;
revoke execute on function csat_hold_on_analysis_change() from public, anon, authenticated;
revoke execute on function csat_ec_my_pending_probes(uuid) from public, anon, authenticated;
grant execute on function csat_ec_my_pending_probes(uuid) to authenticated;
revoke execute on function guard_ai_generated_license() from public, anon, authenticated;
revoke execute on function insert_book_analysis(uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function insert_book_analysis(uuid,jsonb,jsonb) to service_role;
revoke execute on function admin_enqueue_book(text,text,text,text,integer,integer,text) from public, anon, authenticated;
grant execute on function admin_enqueue_book(text,text,text,text,integer,integer,text) to authenticated;
revoke execute on function tg_maintain_set_subscriber_count() from public, anon, authenticated;
revoke execute on function csat_ec_boundary_guard() from public, anon, authenticated;
revoke execute on function curriculum_bands(text[]) from public, anon, authenticated;
grant execute on function curriculum_bands(text[]) to anon, authenticated;
revoke execute on function subscribe_article_word_set(uuid) from public, anon, authenticated;
grant execute on function subscribe_article_word_set(uuid) to authenticated;
revoke execute on function csat_ec_capture_finish(uuid) from public, anon, authenticated;
grant execute on function csat_ec_capture_finish(uuid) to authenticated;
revoke execute on function get_chapter_content(uuid) from public, anon, authenticated;
grant execute on function get_chapter_content(uuid) to authenticated;
revoke execute on function admin_enqueue_article(text,text,text,text,text,timestamp with time zone,text,text,text,text,text) from public, anon, authenticated;
grant execute on function admin_enqueue_article(text,text,text,text,text,timestamp with time zone,text,text,text,text,text) to authenticated;
revoke execute on function commit_article_analysis(uuid,timestamp with time zone,text,jsonb) from public, anon, authenticated;
grant execute on function commit_article_analysis(uuid,timestamp with time zone,text,jsonb) to service_role;
revoke execute on function csat_hold_on_blind_exclusion() from public, anon, authenticated;
revoke execute on function csat_ec_add_detector_signal(uuid,smallint,text,text,text,boolean,uuid[]) from public, anon, authenticated;
grant execute on function csat_ec_add_detector_signal(uuid,smallint,text,text,text,boolean,uuid[]) to service_role;
revoke execute on function trg_require_compose_gates() from public, anon, authenticated;
revoke execute on function republish_article_word_set(uuid,integer) from public, anon, authenticated;
grant execute on function republish_article_word_set(uuid,integer) to service_role;
revoke execute on function enqueue_review_jobs(uuid[],text) from public, anon, authenticated;
grant execute on function enqueue_review_jobs(uuid[],text) to authenticated;
revoke execute on function csat_independent_review_stamp() from public, anon, authenticated;
revoke execute on function csat_ec_canonical_input(uuid,smallint,text) from public, anon, authenticated;
revoke execute on function effective_confidence(jsonb) from public, anon, authenticated;
grant execute on function effective_confidence(jsonb) to anon, authenticated;
revoke execute on function sync_published_set_examples(uuid) from public, anon, authenticated;
grant execute on function sync_published_set_examples(uuid) to authenticated;
revoke execute on function is_admin() from public, anon, authenticated;
grant execute on function is_admin() to anon, authenticated;
revoke execute on function trg_publish_book_word_sets() from public, anon, authenticated;
revoke execute on function video_jobs_overview() from public, anon, authenticated;
grant execute on function video_jobs_overview() to service_role;
revoke execute on function apply_topic_categories(text,integer,numeric,integer,boolean) from public, anon, authenticated;
grant execute on function apply_topic_categories(text,integer,numeric,integer,boolean) to service_role;
revoke execute on function library_seed_dedup_key(text,text) from public, anon, authenticated;
grant execute on function library_seed_dedup_key(text,text) to authenticated;
revoke execute on function compute_article_syntax(uuid) from public, anon, authenticated;
grant execute on function compute_article_syntax(uuid) to service_role;
revoke execute on function textbook_shelf_refreshed_at() from public, anon, authenticated;
grant execute on function textbook_shelf_refreshed_at() to service_role;
revoke execute on function commit_chapter_vocab(uuid,integer) from public, anon, authenticated;
grant execute on function commit_chapter_vocab(uuid,integer) to authenticated;
revoke execute on function csat_ec_supersede_guard() from public, anon, authenticated;
revoke execute on function list_book_chapter_quiz_catalog() from public, anon, authenticated;
grant execute on function list_book_chapter_quiz_catalog() to authenticated;
revoke execute on function csat_ec_round_set_targets(bigint,jsonb) from public, anon, authenticated;
grant execute on function csat_ec_round_set_targets(bigint,jsonb) to authenticated;
revoke execute on function csat_review_sources_overlap(text,text) from public, anon, authenticated;
grant execute on function csat_review_sources_overlap(text,text) to service_role;
revoke execute on function csat_ec_submit_adjudication(bigint,uuid,smallint,text,text,text[],text[],text) from public, anon, authenticated;
grant execute on function csat_ec_submit_adjudication(bigint,uuid,smallint,text,text,text[],text[],text) to service_role;
revoke execute on function game_rank_window(text) from public, anon, authenticated;
grant execute on function game_rank_window(text) to service_role;
revoke execute on function is_class_member(uuid,uuid) from public, anon, authenticated;
grant execute on function is_class_member(uuid,uuid) to anon, authenticated;
revoke execute on function get_lcp_config() from public, anon, authenticated;
grant execute on function get_lcp_config() to service_role;
revoke execute on function unenroll_library_book(uuid) from public, anon, authenticated;
grant execute on function unenroll_library_book(uuid) to authenticated;
revoke execute on function select_pd_comic(text) from public, anon, authenticated;
grant execute on function select_pd_comic(text) to anon, authenticated;
revoke execute on function classify_archaic_candidates() from public, anon, authenticated;
grant execute on function classify_archaic_candidates() to service_role;
revoke execute on function stage_book_dict_candidates(uuid) from public, anon, authenticated;
grant execute on function stage_book_dict_candidates(uuid) to authenticated;
revoke execute on function apply_diagnostic_result(uuid) from public, anon, authenticated;
grant execute on function apply_diagnostic_result(uuid) to service_role;
revoke execute on function infer_form_pos(text,text) from public, anon, authenticated;
grant execute on function infer_form_pos(text,text) to anon, authenticated;
revoke execute on function list_book_support_vocab(uuid,integer) from public, anon, authenticated;
grant execute on function list_book_support_vocab(uuid,integer) to anon, authenticated;
revoke execute on function video_request_cancel(uuid) from public, anon, authenticated;
grant execute on function video_request_cancel(uuid) to authenticated;
revoke execute on function admin_vrl_cron_jobs() from public, anon, authenticated;
grant execute on function admin_vrl_cron_jobs() to authenticated;
revoke execute on function csat_review_visual_bind_analysis(uuid,text) from public, anon, authenticated;
grant execute on function csat_review_visual_bind_analysis(uuid,text) to service_role;
revoke execute on function csat_ec_round_reveal(bigint) from public, anon, authenticated;
grant execute on function csat_ec_round_reveal(bigint) to authenticated;
revoke execute on function knowledge_items_require_evidence() from public, anon, authenticated;
revoke execute on function csat_current_chart_asset(text) from public, anon, authenticated;
grant execute on function csat_current_chart_asset(text) to service_role;
revoke execute on function analyze_track_diagnostic_result(uuid) from public, anon, authenticated;
grant execute on function analyze_track_diagnostic_result(uuid) to service_role;
revoke execute on function analyze_and_apply_track_diagnostic_result(uuid) from public, anon, authenticated;
grant execute on function analyze_and_apply_track_diagnostic_result(uuid) to authenticated;
revoke execute on function textfit_resolve_levels_public(text[]) from public, anon, authenticated;
grant execute on function textfit_resolve_levels_public(text[]) to anon, authenticated;
revoke execute on function regexp_quote(text) from public, anon, authenticated;
grant execute on function regexp_quote(text) to service_role;
revoke execute on function csat_ec_valid_process_evidence(uuid,smallint,text) from public, anon, authenticated;
revoke execute on function list_pd_comic_shelf() from public, anon, authenticated;
grant execute on function list_pd_comic_shelf() to anon, authenticated;
revoke execute on function update_user_v_level(uuid,smallint,text,numeric,text,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function update_user_v_level(uuid,smallint,text,numeric,text,uuid,text,jsonb) to service_role;
revoke execute on function maintain_reference_stats() from public, anon, authenticated;
grant execute on function maintain_reference_stats() to service_role;
revoke execute on function csat_ec_add_student_claim(uuid,smallint,text,text,text,uuid) from public, anon, authenticated;
grant execute on function csat_ec_add_student_claim(uuid,smallint,text,text,text,uuid) to authenticated;
revoke execute on function dict_inflections_by_pos() from public, anon, authenticated;
grant execute on function dict_inflections_by_pos() to authenticated;
revoke execute on function calc_skill_level(text) from public, anon, authenticated;
grant execute on function calc_skill_level(text) to service_role;
revoke execute on function admin_collect_db_health_integrity() from public, anon, authenticated;
grant execute on function admin_collect_db_health_integrity() to authenticated;
revoke execute on function compute_book_coverage(uuid) from public, anon, authenticated;
grant execute on function compute_book_coverage(uuid) to service_role;
revoke execute on function csat_drain_runs_stamp_finished() from public, anon, authenticated;
revoke execute on function enforce_domain_levels_keys() from public, anon, authenticated;
revoke execute on function article_seed_set_updated_at() from public, anon, authenticated;
revoke execute on function guard_user_profiles_privileged_columns() from public, anon, authenticated;
revoke execute on function admin_delete_comic(uuid) from public, anon, authenticated;
grant execute on function admin_delete_comic(uuid) to authenticated;
revoke execute on function csat_ec_judgment_insert_guard() from public, anon, authenticated;
revoke execute on function admin_bulk_requeue_books(uuid[]) from public, anon, authenticated;
grant execute on function admin_bulk_requeue_books(uuid[]) to authenticated;
revoke execute on function csat_ec_ai_taxonomy(text) from public, anon, authenticated;
grant execute on function csat_ec_ai_taxonomy(text) to service_role;
revoke execute on function admin_set_db_health_finding_status(bigint,text,text) from public, anon, authenticated;
grant execute on function admin_set_db_health_finding_status(bigint,text,text) to authenticated;
revoke execute on function csat_ec_reveal_view(bigint) from public, anon, authenticated;
grant execute on function csat_ec_reveal_view(bigint) to authenticated;
revoke execute on function analyze_diagnostic_result(uuid) from public, anon, authenticated;
grant execute on function analyze_diagnostic_result(uuid) to service_role;
revoke execute on function upsert_db_health_finding(text,text,text,text,text,jsonb,text) from public, anon, authenticated;
grant execute on function upsert_db_health_finding(text,text,text,text,text,jsonb,text) to service_role;
revoke execute on function extract_vocabulary_for_user_v2(uuid,text[],text,integer) from public, anon, authenticated;
grant execute on function extract_vocabulary_for_user_v2(uuid,text[],text,integer) to authenticated;
revoke execute on function trg_shared_words_sync_pronunciation() from public, anon, authenticated;
revoke execute on function csat_ec_record_session_held(jsonb,jsonb,boolean,text,jsonb,smallint[],boolean) from public, anon, authenticated;
grant execute on function csat_ec_record_session_held(jsonb,jsonb,boolean,text,jsonb,smallint[],boolean) to service_role;
revoke execute on function csat_ec_cancel_rounds_on_response_delete() from public, anon, authenticated;
revoke execute on function acp_apply_license_gate() from public, anon, authenticated;
revoke execute on function peek_class_by_code(text) from public, anon, authenticated;
grant execute on function peek_class_by_code(text) to anon, authenticated;
revoke execute on function db_health_run_action(text,text,text,bigint,uuid) from public, anon, authenticated;
grant execute on function db_health_run_action(text,text,text,bigint,uuid) to service_role;
revoke execute on function extract_book_vocabulary_admin(uuid,smallint) from public, anon, authenticated;
grant execute on function extract_book_vocabulary_admin(uuid,smallint) to authenticated;
revoke execute on function csat_hold_on_units_change() from public, anon, authenticated;
revoke execute on function csat_dx_activate_settings(jsonb,text,uuid) from public, anon, authenticated;
grant execute on function csat_dx_activate_settings(jsonb,text,uuid) to service_role;
revoke execute on function db_health_anomalies(integer,integer) from public, anon, authenticated;
grant execute on function db_health_anomalies(integer,integer) to authenticated;
revoke execute on function grade_dcp_item(uuid,jsonb) from public, anon, authenticated;
grant execute on function grade_dcp_item(uuid,jsonb) to authenticated;
revoke execute on function csat_ec_submit_verify(bigint,uuid,text,text) from public, anon, authenticated;
grant execute on function csat_ec_submit_verify(bigint,uuid,text,text) to authenticated;
revoke execute on function methodology_read(text) from public, anon, authenticated;
grant execute on function methodology_read(text) to service_role;
revoke execute on function csat_rereview_parent(text,text,text) from public, anon, authenticated;
grant execute on function csat_rereview_parent(text,text,text) to service_role;
revoke execute on function run_content_quality_gate_details(text,uuid) from public, anon, authenticated;
grant execute on function run_content_quality_gate_details(text,uuid) to authenticated;
revoke execute on function game_rank_summary(text) from public, anon, authenticated;
grant execute on function game_rank_summary(text) to anon, authenticated;
revoke execute on function csat_ec_capture_event(uuid,text,jsonb) from public, anon, authenticated;
revoke execute on function repair_vocab_first_sentences(text,jsonb) from public, anon, authenticated;
grant execute on function repair_vocab_first_sentences(text,jsonb) to service_role;
revoke execute on function csat_ec_attach_judgment_boundaries(bigint,text[],boolean) from public, anon, authenticated;
revoke execute on function save_comic_progress(uuid,integer,integer,boolean) from public, anon, authenticated;
grant execute on function save_comic_progress(uuid,integer,integer,boolean) to authenticated;
revoke execute on function calculate_user_v_level_from_mastery(uuid) from public, anon, authenticated;
grant execute on function calculate_user_v_level_from_mastery(uuid) to service_role;
revoke execute on function csat_source_snapshot_take(text) from public, anon, authenticated;
grant execute on function csat_source_snapshot_take(text) to service_role;
revoke execute on function csat_source_inventory_live() from public, anon, authenticated;
grant execute on function csat_source_inventory_live() to service_role;
revoke execute on function audit_book_extraction(uuid) from public, anon, authenticated;
grant execute on function audit_book_extraction(uuid) to service_role;
revoke execute on function csat_current_units_many(text[]) from public, anon, authenticated;
grant execute on function csat_current_units_many(text[]) to service_role;
revoke execute on function republish_book_word_sets(uuid,integer) from public, anon, authenticated;
grant execute on function republish_book_word_sets(uuid,integer) to service_role;
revoke execute on function csat_ec_reveal_state(uuid) from public, anon, authenticated;
grant execute on function csat_ec_reveal_state(uuid) to service_role;
revoke execute on function textbook_shelf_inventory() from public, anon, authenticated;
grant execute on function textbook_shelf_inventory() to anon, authenticated;
revoke execute on function find_unbound_book_lemmas(uuid,integer) from public, anon, authenticated;
grant execute on function find_unbound_book_lemmas(uuid,integer) to authenticated;
revoke execute on function video_retire(text,text) from public, anon, authenticated;
grant execute on function video_retire(text,text) to authenticated;
revoke execute on function csat_item_answer_hash(text) from public, anon, authenticated;
grant execute on function csat_item_answer_hash(text) to service_role;
revoke execute on function release_topic_corpus_claim(uuid,text,text) from public, anon, authenticated;
grant execute on function release_topic_corpus_claim(uuid,text,text) to service_role;
revoke execute on function dictation_overview() from public, anon, authenticated;
grant execute on function dictation_overview() to authenticated;
revoke execute on function set_word_familiarity(text,text,smallint) from public, anon, authenticated;
grant execute on function set_word_familiarity(text,text,smallint) to authenticated;
revoke execute on function csat_source_rollup() from public, anon, authenticated;
grant execute on function csat_source_rollup() to service_role;
revoke execute on function refresh_user_known_word_count(uuid) from public, anon, authenticated;
grant execute on function refresh_user_known_word_count(uuid) to authenticated;
revoke execute on function video_request_advance(uuid,text,text,text) from public, anon, authenticated;
grant execute on function video_request_advance(uuid,text,text,text) to service_role;
revoke execute on function collect_db_health_queues() from public, anon, authenticated;
grant execute on function collect_db_health_queues() to service_role;
revoke execute on function csat_ec_submit_adjudication(bigint,uuid,smallint,text,text,text[],text[],text,text[],text[],boolean) from public, anon, authenticated;
grant execute on function csat_ec_submit_adjudication(bigint,uuid,smallint,text,text,text[],text[],text,text[],text[],boolean) to authenticated;
revoke execute on function csat_units_build_input() from public, anon, authenticated;
grant execute on function csat_units_build_input() to service_role;
revoke execute on function compute_syntax_score(text) from public, anon, authenticated;
grant execute on function compute_syntax_score(text) to anon, authenticated;
revoke execute on function lb_compute_search_vector() from public, anon, authenticated;
revoke execute on function admin_force_publish_book(uuid) from public, anon, authenticated;
grant execute on function admin_force_publish_book(uuid) to authenticated;
revoke execute on function dict_polysemy_count() from public, anon, authenticated;
grant execute on function dict_polysemy_count() to authenticated;
revoke execute on function en_inflection_bases(text) from public, anon, authenticated;
grant execute on function en_inflection_bases(text) to anon, authenticated;
revoke execute on function csat_ec_outcomes(text) from public, anon, authenticated;
revoke execute on function list_pd_comics(text) from public, anon, authenticated;
grant execute on function list_pd_comics(text) to anon, authenticated;
revoke execute on function is_class_teacher(uuid,uuid) from public, anon, authenticated;
grant execute on function is_class_teacher(uuid,uuid) to anon, authenticated;
revoke execute on function is_valid_assignment_words(jsonb) from public, anon, authenticated;
grant execute on function is_valid_assignment_words(jsonb) to service_role;
revoke execute on function resolve_dict_headword(text) from public, anon, authenticated;
grant execute on function resolve_dict_headword(text) to anon, authenticated;
revoke execute on function quiz_target_per_chapter(smallint) from public, anon, authenticated;
grant execute on function quiz_target_per_chapter(smallint) to service_role;
revoke execute on function csat_chart_receipt_valid(uuid,timestamp with time zone) from public, anon, authenticated;
grant execute on function csat_chart_receipt_valid(uuid,timestamp with time zone) to service_role;
revoke execute on function textbook_shelf_sources() from public, anon, authenticated;
grant execute on function textbook_shelf_sources() to anon, authenticated;
revoke execute on function csat_visual_record_guard() from public, anon, authenticated;
revoke execute on function csat_ec_choice_trap_map_approved(text) from public, anon, authenticated;
revoke execute on function count_article_vocab_prunable(double precision) from public, anon, authenticated;
grant execute on function count_article_vocab_prunable(double precision) to service_role;
revoke execute on function select_book_comic_all(uuid) from public, anon, authenticated;
grant execute on function select_book_comic_all(uuid) to authenticated;
revoke execute on function compute_book_difficulty(uuid) from public, anon, authenticated;
grant execute on function compute_book_difficulty(uuid) to service_role;
revoke execute on function video_request_create(text,text,text,text,text,text[],text,text) from public, anon, authenticated;
grant execute on function video_request_create(text,text,text,text,text,text[],text,text) to authenticated;
revoke execute on function select_book_comic(uuid,integer) from public, anon, authenticated;
grant execute on function select_book_comic(uuid,integer) to authenticated;
revoke execute on function csat_ec_boundary_signal_guard() from public, anon, authenticated;
revoke execute on function video_request_add_revision(uuid,jsonb,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function video_request_add_revision(uuid,jsonb,jsonb,jsonb,text) to service_role;
revoke execute on function content_gate_publishable(text,uuid) from public, anon, authenticated;
grant execute on function content_gate_publishable(text,uuid) to authenticated;
revoke execute on function csat_ec_ai_export(bigint,uuid,smallint) from public, anon, authenticated;
grant execute on function csat_ec_ai_export(bigint,uuid,smallint) to service_role;
revoke execute on function lookup_word_meaning(text) from public, anon, authenticated;
grant execute on function lookup_word_meaning(text) to anon, authenticated;
revoke execute on function csat_current_units_hash(text) from public, anon, authenticated;
grant execute on function csat_current_units_hash(text) to service_role;
revoke execute on function csat_ec_add_probe_response(uuid,smallint,jsonb,integer) from public, anon, authenticated;
grant execute on function csat_ec_add_probe_response(uuid,smallint,jsonb,integer) to authenticated;
revoke execute on function video_job_restart(text,text) from public, anon, authenticated;
grant execute on function video_job_restart(text,text) to service_role;
revoke execute on function enforce_track_levels_keys() from public, anon, authenticated;
revoke execute on function csat_review_visual_ack(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function csat_review_visual_ack(uuid,uuid,text,text) to service_role;
revoke execute on function en_derivational_bases(text) from public, anon, authenticated;
grant execute on function en_derivational_bases(text) to service_role;
revoke execute on function csat_blind_protocol_valid(uuid) from public, anon, authenticated;
grant execute on function csat_blind_protocol_valid(uuid) to service_role;
revoke execute on function csat_visual_analysis_binding_guard() from public, anon, authenticated;
revoke execute on function csat_source_is_gradeable(uuid) from public, anon, authenticated;
grant execute on function csat_source_is_gradeable(uuid) to service_role;
revoke execute on function csat_valid_review_personas_many(uuid[]) from public, anon, authenticated;
grant execute on function csat_valid_review_personas_many(uuid[]) to service_role;
revoke execute on function calculate_next_review_due(uuid) from public, anon, authenticated;
grant execute on function calculate_next_review_due(uuid) to service_role;
revoke execute on function book_quiz_coverage(uuid) from public, anon, authenticated;
grant execute on function book_quiz_coverage(uuid) to service_role;
revoke execute on function collect_content_gate_metrics() from public, anon, authenticated;
grant execute on function collect_content_gate_metrics() to service_role;
revoke execute on function list_comic_catalog() from public, anon, authenticated;
grant execute on function list_comic_catalog() to anon, authenticated;
revoke execute on function csat_chart_analysis_ready(uuid) from public, anon, authenticated;
grant execute on function csat_chart_analysis_ready(uuid) to service_role;
revoke execute on function acp_compose_shelf_candidates(uuid) from public, anon, authenticated;
grant execute on function acp_compose_shelf_candidates(uuid) to service_role;
revoke execute on function decode_html_entities(text) from public, anon, authenticated;
grant execute on function decode_html_entities(text) to service_role;
revoke execute on function csat_dx_record_session(jsonb,jsonb) from public, anon, authenticated;
grant execute on function csat_dx_record_session(jsonb,jsonb) to service_role;
revoke execute on function get_judgment_sample(text,uuid,integer) from public, anon, authenticated;
grant execute on function get_judgment_sample(text,uuid,integer) to authenticated;
revoke execute on function textbook_practice_items(smallint,integer) from public, anon, authenticated;
grant execute on function textbook_practice_items(smallint,integer) to authenticated;
revoke execute on function topic_corpus_overview() from public, anon, authenticated;
grant execute on function topic_corpus_overview() to service_role;
revoke execute on function admin_collect_db_health_metrics() from public, anon, authenticated;
grant execute on function admin_collect_db_health_metrics() to authenticated;
revoke execute on function csat_ec_confirm_session(uuid,boolean,boolean) from public, anon, authenticated;
grant execute on function csat_ec_confirm_session(uuid,boolean,boolean) to authenticated;
revoke execute on function ingest_topic_corpus_doc(text,text,text,text,jsonb,integer,integer,text,text,timestamp with time zone,text[]) from public, anon, authenticated;
grant execute on function ingest_topic_corpus_doc(text,text,text,text,jsonb,integer,integer,text,text,timestamp with time zone,text[]) to service_role;
revoke execute on function csat_item_text_input_hash(text) from public, anon, authenticated;
grant execute on function csat_item_text_input_hash(text) to service_role;
revoke execute on function analyze_and_apply_diagnostic_result(uuid) from public, anon, authenticated;
grant execute on function analyze_and_apply_diagnostic_result(uuid) to authenticated;
revoke execute on function game_leaderboard(text,text,integer) from public, anon, authenticated;
grant execute on function game_leaderboard(text,text,integer) to anon, authenticated;
revoke execute on function csat_ec_round_create(text,text,text,jsonb,text) from public, anon, authenticated;
grant execute on function csat_ec_round_create(text,text,text,jsonb,text) to authenticated;
revoke execute on function csat_source_pipeline_live() from public, anon, authenticated;
grant execute on function csat_source_pipeline_live() to service_role;
revoke execute on function csat_ec_taxonomy_seal(text) from public, anon, authenticated;
grant execute on function csat_ec_taxonomy_seal(text) to authenticated;
revoke execute on function csat_ec_judgment_input_hash(uuid,smallint,text) from public, anon, authenticated;
revoke execute on function csat_ec_round_guard() from public, anon, authenticated;
revoke execute on function csat_valid_review_personas(uuid) from public, anon, authenticated;
grant execute on function csat_valid_review_personas(uuid) to service_role;
revoke execute on function prescribe_today(uuid,integer[]) from public, anon, authenticated;
grant execute on function prescribe_today(uuid,integer[]) to authenticated;
revoke execute on function select_pd_comic_provenance(text) from public, anon, authenticated;
grant execute on function select_pd_comic_provenance(text) to service_role;
revoke execute on function csat_map_node_source_touch() from public, anon, authenticated;
revoke execute on function refresh_textbook_shelf_stats() from public, anon, authenticated;
grant execute on function refresh_textbook_shelf_stats() to service_role;
revoke execute on function admin_collect_quality_metrics() from public, anon, authenticated;
grant execute on function admin_collect_quality_metrics() to authenticated;
revoke execute on function video_restore(text) from public, anon, authenticated;
grant execute on function video_restore(text) to authenticated;
revoke execute on function csat_source_live_rollup() from public, anon, authenticated;
grant execute on function csat_source_live_rollup() to service_role;
revoke execute on function csat_map_edge_source_touch() from public, anon, authenticated;
revoke execute on function enforce_base_word_depth1() from public, anon, authenticated;
revoke execute on function video_request_record_evaluation(uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function video_request_record_evaluation(uuid,jsonb,jsonb) to service_role;
revoke execute on function auto_promote_track_level_for_user(uuid,text) from public, anon, authenticated;
grant execute on function auto_promote_track_level_for_user(uuid,text) to service_role;
revoke execute on function csat_ec_my_process_evidence(uuid) from public, anon, authenticated;
grant execute on function csat_ec_my_process_evidence(uuid) to authenticated;
revoke execute on function csat_hold_on_review_withdraw() from public, anon, authenticated;
revoke execute on function decr_chunk_refs(text[]) from public, anon, authenticated;
grant execute on function decr_chunk_refs(text[]) to service_role;
revoke execute on function admin_requeue_article(uuid) from public, anon, authenticated;
grant execute on function admin_requeue_article(uuid) to authenticated;
revoke execute on function admin_revert_published_article(uuid) from public, anon, authenticated;
grant execute on function admin_revert_published_article(uuid) to authenticated;
revoke execute on function analyze_and_apply_comprehensive_diagnostic_result(uuid) from public, anon, authenticated;
grant execute on function analyze_and_apply_comprehensive_diagnostic_result(uuid) to authenticated;
revoke execute on function csat_ec_capture_guard() from public, anon, authenticated;
revoke execute on function admin_delete_book(uuid) from public, anon, authenticated;
grant execute on function admin_delete_book(uuid) to authenticated;
revoke execute on function csat_ec_record_quality_rq1(uuid) from public, anon, authenticated;
revoke execute on function _extract_composite_score(integer,integer,integer,smallint,boolean,text,smallint,smallint) from public, anon, authenticated;
grant execute on function _extract_composite_score(integer,integer,integer,smallint,boolean,text,smallint,smallint) to anon, authenticated;
revoke execute on function save_extraction_judgment(text,uuid,integer,text,text,text,text,boolean) from public, anon, authenticated;
grant execute on function save_extraction_judgment(text,uuid,integer,text,text,text,text,boolean) to authenticated;
revoke execute on function csat_review_ledgers_import(jsonb,jsonb) from public, anon, authenticated;
grant execute on function csat_review_ledgers_import(jsonb,jsonb) to service_role;
revoke execute on function regenerate_auto_curated_set(uuid) from public, anon, authenticated;
grant execute on function regenerate_auto_curated_set(uuid) to service_role;
revoke execute on function admin_vrl_snapshot_counts() from public, anon, authenticated;
grant execute on function admin_vrl_snapshot_counts() to authenticated;
revoke execute on function acp_article_rollup() from public, anon, authenticated;
grant execute on function acp_article_rollup() to authenticated;
revoke execute on function collect_quality_metrics() from public, anon, authenticated;
grant execute on function collect_quality_metrics() to service_role;
revoke execute on function methodology_import(jsonb,text,text) from public, anon, authenticated;
grant execute on function methodology_import(jsonb,text,text) to service_role;
revoke execute on function admin_force_publish_article(uuid) from public, anon, authenticated;
grant execute on function admin_force_publish_article(uuid) to authenticated;
revoke execute on function validate_axis_level_entry(text,text,smallint) from public, anon, authenticated;
grant execute on function validate_axis_level_entry(text,text,smallint) to service_role;
revoke execute on function lb_compute_kr_safe() from public, anon, authenticated;
revoke execute on function find_unmatched_lemmas(text[]) from public, anon, authenticated;
grant execute on function find_unmatched_lemmas(text[]) to service_role;
revoke execute on function extract_vocabulary_for_user(uuid,text[],text) from public, anon, authenticated;
grant execute on function extract_vocabulary_for_user(uuid,text[],text) to authenticated;
revoke execute on function csat_map_seed(jsonb) from public, anon, authenticated;
grant execute on function csat_map_seed(jsonb) to service_role;
revoke execute on function run_content_quality_gates(text,uuid) from public, anon, authenticated;
grant execute on function run_content_quality_gates(text,uuid) to authenticated;
revoke execute on function dictation_weakness(integer) from public, anon, authenticated;
grant execute on function dictation_weakness(integer) to authenticated;
revoke execute on function prune_article_vocab_sentences(integer) from public, anon, authenticated;
grant execute on function prune_article_vocab_sentences(integer) to service_role;
revoke execute on function update_pending_word_status(uuid,text,text) from public, anon, authenticated;
grant execute on function update_pending_word_status(uuid,text,text) to authenticated;
revoke execute on function acp_classify_license(text) from public, anon, authenticated;
grant execute on function acp_classify_license(text) to anon, authenticated;
revoke execute on function preview_book_comic(uuid,integer) from public, anon, authenticated;
grant execute on function preview_book_comic(uuid,integer) to anon, authenticated;
revoke execute on function collect_archaic_candidates(uuid) from public, anon, authenticated;
grant execute on function collect_archaic_candidates(uuid) to service_role;
revoke execute on function csat_ec_tombstone_guard() from public, anon, authenticated;
revoke execute on function dictation_recent_misses(integer) from public, anon, authenticated;
grant execute on function dictation_recent_misses(integer) to authenticated;
revoke execute on function get_comic_format(uuid) from public, anon, authenticated;
grant execute on function get_comic_format(uuid) to authenticated;
revoke execute on function cron_auto_promote_all_users() from public, anon, authenticated;
grant execute on function cron_auto_promote_all_users() to service_role;
revoke execute on function csat_ec_round_inputs_intact(bigint,uuid,smallint) from public, anon, authenticated;
revoke execute on function video_job_advance(text,text,text,jsonb,text) from public, anon, authenticated;
grant execute on function video_job_advance(text,text,text,jsonb,text) to service_role;
revoke execute on function video_retire_rerendered(text) from public, anon, authenticated;
grant execute on function video_retire_rerendered(text) to service_role;
revoke execute on function csat_ec_capture_write_guard() from public, anon, authenticated;
revoke execute on function collect_db_health_integrity() from public, anon, authenticated;
grant execute on function collect_db_health_integrity() to service_role;
revoke execute on function compute_book_cefrj(uuid) from public, anon, authenticated;
grant execute on function compute_book_cefrj(uuid) to service_role;
revoke execute on function csat_ec_only_reviewer_null() from public, anon, authenticated;
revoke execute on function knowledge_csat_origin_regrade() from public, anon, authenticated;
revoke execute on function csat_review_run_check() from public, anon, authenticated;
revoke execute on function agg_daily_activity_from_score() from public, anon, authenticated;
revoke execute on function compute_book_chapter_v_levels(uuid) from public, anon, authenticated;
grant execute on function compute_book_chapter_v_levels(uuid) to service_role;
revoke execute on function enqueue_topic_corpus_docs(text,jsonb) from public, anon, authenticated;
grant execute on function enqueue_topic_corpus_docs(text,jsonb) to service_role;
revoke execute on function is_quoted_foreign_citation(text,text) from public, anon, authenticated;
grant execute on function is_quoted_foreign_citation(text,text) to service_role;
revoke execute on function admin_db_health_live() from public, anon, authenticated;
grant execute on function admin_db_health_live() to authenticated;
revoke execute on function admin_collect_content_gate_metrics() from public, anon, authenticated;
grant execute on function admin_collect_content_gate_metrics() to authenticated;
revoke execute on function video_is_admin() from public, anon, authenticated;
grant execute on function video_is_admin() to anon, authenticated;
revoke execute on function en_spelling_variants(text) from public, anon, authenticated;
grant execute on function en_spelling_variants(text) to service_role;
revoke execute on function trg_publish_article_word_set() from public, anon, authenticated;
revoke execute on function dict_categorical_distributions() from public, anon, authenticated;
grant execute on function dict_categorical_distributions() to authenticated;
revoke execute on function csat_ec_effective_answer(uuid,smallint) from public, anon, authenticated;
revoke execute on function admin_bulk_set_books_curating(uuid[]) from public, anon, authenticated;
grant execute on function admin_bulk_set_books_curating(uuid[]) to authenticated;
revoke execute on function csat_review_reveal(uuid) from public, anon, authenticated;
grant execute on function csat_review_reveal(uuid) to service_role;
revoke execute on function game_rank_alias(uuid) from public, anon, authenticated;
grant execute on function game_rank_alias(uuid) to service_role;
revoke execute on function csat_map_recompute_edge() from public, anon, authenticated;
revoke execute on function queue_seed_catalog_for_curation(integer,text,boolean) from public, anon, authenticated;
grant execute on function queue_seed_catalog_for_curation(integer,text,boolean) to authenticated;
revoke execute on function admin_revert_published_book(uuid) from public, anon, authenticated;
grant execute on function admin_revert_published_book(uuid) to authenticated;
revoke execute on function compute_book_vrl(uuid) from public, anon, authenticated;
grant execute on function compute_book_vrl(uuid) to service_role;
revoke execute on function csat_ec_round_create(text,text,text,jsonb) from public, anon, authenticated;
grant execute on function csat_ec_round_create(text,text,text,jsonb) to authenticated;
revoke execute on function csat_ec_submit_blind(bigint,uuid,smallint,text,text,text[],text[],text,text[],text[],boolean) from public, anon, authenticated;
grant execute on function csat_ec_submit_blind(bigint,uuid,smallint,text,text,text[],text[],text,text[],text[],boolean) to authenticated;
revoke execute on function admin_record_db_health_checkpoint(text,text,text) from public, anon, authenticated;
grant execute on function admin_record_db_health_checkpoint(text,text,text) to authenticated;
revoke execute on function admin_archive_book(uuid) from public, anon, authenticated;
grant execute on function admin_archive_book(uuid) to authenticated;
revoke execute on function lsc_compute_composite() from public, anon, authenticated;
revoke execute on function compute_book_syntax(uuid) from public, anon, authenticated;
grant execute on function compute_book_syntax(uuid) to service_role;
revoke execute on function admin_bulk_requeue_articles(uuid[]) from public, anon, authenticated;
grant execute on function admin_bulk_requeue_articles(uuid[]) to authenticated;
revoke execute on function archive_book_pipeline_messages(uuid) from public, anon, authenticated;
grant execute on function archive_book_pipeline_messages(uuid) to authenticated;
revoke execute on function video_request_review(uuid,integer,text,text) from public, anon, authenticated;
grant execute on function video_request_review(uuid,integer,text,text) to authenticated;
revoke execute on function csat_ec_my_capture_state(uuid) from public, anon, authenticated;
grant execute on function csat_ec_my_capture_state(uuid) to authenticated;
revoke execute on function video_eval_overview() from public, anon, authenticated;
grant execute on function video_eval_overview() to service_role;
revoke execute on function knowledge_evidence_sync_csat_grade() from public, anon, authenticated;
revoke execute on function _enroll_book_subscribe_word_sets(uuid,uuid) from public, anon, authenticated;
grant execute on function _enroll_book_subscribe_word_sets(uuid,uuid) to service_role;
revoke execute on function csat_ec_round_material(bigint) from public, anon, authenticated;
grant execute on function csat_ec_round_material(bigint) to authenticated;
revoke execute on function admin_requeue_book(uuid) from public, anon, authenticated;
grant execute on function admin_requeue_book(uuid) to authenticated;
revoke execute on function csat_ec_round_start_blind(bigint) from public, anon, authenticated;
grant execute on function csat_ec_round_start_blind(bigint) to authenticated;
revoke execute on function admin_vrl_cron_runs() from public, anon, authenticated;
grant execute on function admin_vrl_cron_runs() to authenticated;
revoke execute on function admin_collect_db_health_queues() from public, anon, authenticated;
grant execute on function admin_collect_db_health_queues() to authenticated;
revoke execute on function acp_batch_independent_lines(uuid) from public, anon, authenticated;
grant execute on function acp_batch_independent_lines(uuid) to service_role;
revoke execute on function close_missing_db_health_findings(text[]) from public, anon, authenticated;
grant execute on function close_missing_db_health_findings(text[]) to service_role;
revoke execute on function csat_dx_save_item_tagging(text,jsonb,jsonb,numeric,boolean,uuid) from public, anon, authenticated;
grant execute on function csat_dx_save_item_tagging(text,jsonb,jsonb,numeric,boolean,uuid) to service_role;
revoke execute on function select_article_vocab(uuid) from public, anon, authenticated;
grant execute on function select_article_vocab(uuid) to authenticated;
revoke execute on function retain_source_eligibility_history() from public, anon, authenticated;
revoke execute on function knowledge_grade_rank(text) from public, anon, authenticated;
grant execute on function knowledge_grade_rank(text) to service_role;
revoke execute on function enqueue_curation_jobs(uuid[]) from public, anon, authenticated;
grant execute on function enqueue_curation_jobs(uuid[]) to authenticated;
revoke execute on function video_job_evaluate(text,integer,integer,integer,jsonb) from public, anon, authenticated;
grant execute on function video_job_evaluate(text,integer,integer,integer,jsonb) to service_role;
revoke execute on function csat_ec_taxonomy_guard() from public, anon, authenticated;
revoke execute on function csat_ec_record_quality_rq1_signals(uuid) from public, anon, authenticated;
revoke execute on function knowledge_evidence_bump_version() from public, anon, authenticated;
revoke execute on function video_retire_mark_purged(text) from public, anon, authenticated;
grant execute on function video_retire_mark_purged(text) to service_role;
revoke execute on function purge_ghost_vocab(uuid) from public, anon, authenticated;
grant execute on function purge_ghost_vocab(uuid) to service_role;
revoke execute on function csat_valid_review_personas_row(csat_item_analyses) from public, anon, authenticated;
grant execute on function csat_valid_review_personas_row(csat_item_analyses) to service_role;
revoke execute on function csat_ec_forbid_update() from public, anon, authenticated;
revoke execute on function textfit_resolve_levels(text[]) from public, anon, authenticated;
grant execute on function textfit_resolve_levels(text[]) to authenticated;
revoke execute on function csat_ec_ai_import(bigint,jsonb,jsonb) from public, anon, authenticated;
grant execute on function csat_ec_ai_import(bigint,jsonb,jsonb) to service_role;
revoke execute on function backfill_book_lemmas(uuid) from public, anon, authenticated;
grant execute on function backfill_book_lemmas(uuid) to service_role;
revoke execute on function csat_source_is_eligible(uuid) from public, anon, authenticated;
grant execute on function csat_source_is_eligible(uuid) to service_role;
revoke execute on function admin_archive_article(uuid) from public, anon, authenticated;
grant execute on function admin_archive_article(uuid) to authenticated;
revoke execute on function csat_coverage_scoped(text,integer) from public, anon, authenticated;
grant execute on function csat_coverage_scoped(text,integer) to service_role;
revoke execute on function fix_chapter_html_entities(uuid) from public, anon, authenticated;
grant execute on function fix_chapter_html_entities(uuid) to service_role;
revoke execute on function csat_item_units_guard() from public, anon, authenticated;
revoke execute on function analyze_book_vrl(uuid) from public, anon, authenticated;
grant execute on function analyze_book_vrl(uuid) to service_role;
revoke execute on function lookup_lexicon_clean(text) from public, anon, authenticated;
grant execute on function lookup_lexicon_clean(text) to service_role;
revoke execute on function enroll_library_book(uuid) from public, anon, authenticated;
grant execute on function enroll_library_book(uuid) to authenticated;
revoke execute on function compute_article_vrl(uuid) from public, anon, authenticated;
grant execute on function compute_article_vrl(uuid) to service_role;
revoke execute on function admin_set_comic_published(uuid,boolean) from public, anon, authenticated;
grant execute on function admin_set_comic_published(uuid,boolean) to authenticated;
revoke execute on function csat_review_solve(uuid,smallint,text) from public, anon, authenticated;
grant execute on function csat_review_solve(uuid,smallint,text) to service_role;
revoke execute on function auto_compute_freq_fields() from public, anon, authenticated;
revoke execute on function csat_ec_cancel_rounds_on_confirmation() from public, anon, authenticated;
revoke execute on function csat_source_eligibility_tally() from public, anon, authenticated;
grant execute on function csat_source_eligibility_tally() to service_role;
revoke execute on function handle_new_user() from public, anon, authenticated;
revoke execute on function csat_visual_source_changed() from public, anon, authenticated;
revoke execute on function calculate_next_review_due(text,numeric,numeric) from public, anon, authenticated;
grant execute on function calculate_next_review_due(text,numeric,numeric) to service_role;
revoke execute on function compute_frequency_tier(integer) from public, anon, authenticated;
grant execute on function compute_frequency_tier(integer) to anon, authenticated;
revoke execute on function publish_article_word_set(uuid,integer) from public, anon, authenticated;
grant execute on function publish_article_word_set(uuid,integer) to authenticated;
revoke execute on function en_negation_preserved(text,text) from public, anon, authenticated;
grant execute on function en_negation_preserved(text,text) to service_role;
revoke execute on function csat_blind_exclusion_immutable() from public, anon, authenticated;
revoke execute on function record_pending_words(uuid,text[],uuid) from public, anon, authenticated;
grant execute on function record_pending_words(uuid,text[],uuid) to authenticated;
revoke execute on function csat_coverage() from public, anon, authenticated;
grant execute on function csat_coverage() to service_role;
revoke execute on function db_health_checkpoint_diff(text) from public, anon, authenticated;
grant execute on function db_health_checkpoint_diff(text) to service_role;
revoke execute on function funnel_summary(integer) from public, anon, authenticated;
grant execute on function funnel_summary(integer) to service_role;
revoke execute on function csat_review_visual_input(uuid) from public, anon, authenticated;
grant execute on function csat_review_visual_input(uuid) to service_role;
revoke execute on function csat_ec_submit_blind(bigint,uuid,smallint,text,text,text[],text[],text) from public, anon, authenticated;
grant execute on function csat_ec_submit_blind(bigint,uuid,smallint,text,text,text[],text[],text) to service_role;
revoke execute on function decode_entities_in_stored_sentences(uuid) from public, anon, authenticated;
grant execute on function decode_entities_in_stored_sentences(uuid) to service_role;
revoke execute on function textbook_curriculum_vocab_counts() from public, anon, authenticated;
grant execute on function textbook_curriculum_vocab_counts() to anon, authenticated;
revoke execute on function knowledge_evidence_after_delete() from public, anon, authenticated;
revoke execute on function csat_ec_embargoed_exams(text[]) from public, anon, authenticated;
grant execute on function csat_ec_embargoed_exams(text[]) to service_role;
revoke execute on function acp_prune_compose_candidates(integer) from public, anon, authenticated;
grant execute on function acp_prune_compose_candidates(integer) to service_role;
revoke execute on function collect_db_health_metrics() from public, anon, authenticated;
grant execute on function collect_db_health_metrics() to service_role;
revoke execute on function csat_ec_valid_process_evidence(uuid,smallint) from public, anon, authenticated;
revoke execute on function csat_ec_embargoed_items(text[]) from public, anon, authenticated;
grant execute on function csat_ec_embargoed_items(text[]) to service_role;
revoke execute on function csat_ec_add_process_evidence(uuid,smallint,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function csat_ec_add_process_evidence(uuid,smallint,text,jsonb,uuid) to authenticated;
revoke execute on function csat_ec_assignment_insert_guard() from public, anon, authenticated;
revoke execute on function record_funnel_event(text,text,jsonb) from public, anon, authenticated;
grant execute on function record_funnel_event(text,text,jsonb) to anon, authenticated;
revoke execute on function csat_ec_capture_open(uuid) from public, anon, authenticated;
grant execute on function csat_ec_capture_open(uuid) to authenticated;
revoke execute on function csat_ec_code_guard() from public, anon, authenticated;
revoke execute on function get_category_path(text) from public, anon, authenticated;
grant execute on function get_category_path(text) to service_role;
revoke execute on function trg_lbv_fill_lemma() from public, anon, authenticated;
revoke execute on function store_content_chunk(text) from public, anon, authenticated;
grant execute on function store_content_chunk(text) to service_role;
revoke execute on function csat_chart_review_run_guard() from public, anon, authenticated;
revoke execute on function is_admin_or_curator() from public, anon, authenticated;
grant execute on function is_admin_or_curator() to anon, authenticated;
revoke execute on function tg_study_plan_items_touch() from public, anon, authenticated;
revoke execute on function csat_review_visual_register(text,text,text,integer,text,text,text,uuid) from public, anon, authenticated;
grant execute on function csat_review_visual_register(text,text,text,integer,text,text,text,uuid) to service_role;
revoke execute on function calc_domain_level(text,text) from public, anon, authenticated;
grant execute on function calc_domain_level(text,text) to service_role;
revoke execute on function refresh_lemma_dominant_pos() from public, anon, authenticated;
grant execute on function refresh_lemma_dominant_pos() to service_role;
revoke execute on function set_updated_at() from public, anon, authenticated;
revoke execute on function enqueue_comic_jobs(uuid[]) from public, anon, authenticated;
grant execute on function enqueue_comic_jobs(uuid[]) to authenticated;
revoke execute on function enqueue_quiz_jobs(uuid[]) from public, anon, authenticated;
grant execute on function enqueue_quiz_jobs(uuid[]) to authenticated;
revoke execute on function fill_lbv_resolution(uuid,boolean) from public, anon, authenticated;
grant execute on function fill_lbv_resolution(uuid,boolean) to service_role;
revoke execute on function csat_blind_source_unseen(text,text,timestamp with time zone) from public, anon, authenticated;
grant execute on function csat_blind_source_unseen(text,text,timestamp with time zone) to service_role;
revoke execute on function acp_claim_compose_jobs(text,integer,integer) from public, anon, authenticated;
grant execute on function acp_claim_compose_jobs(text,integer,integer) to service_role;
revoke execute on function db_health_live_snapshot() from public, anon, authenticated;
grant execute on function db_health_live_snapshot() to service_role;

-- ④ 신규 함수 기본 권한
alter default privileges in schema public revoke execute on functions from authenticated;
