-- scripts/audit/csat-corpus-coverage.sql
-- Read-only, one-statement snapshot. Unknown classifications remain unknown.
with base as materialized (
  select a.id,a.source,a.status,a.title,a.source_url,a.content_hash,a.created_at,a.source_fetched_at,
    a.author,a.published_at,a.license_class,a.language,a.word_count,a.cefr_level,a.article_v_level,
    a.register,a.feed_id,a.feed_label,a.category_tags,
    a.csat_fit->>'topic' topic,a.csat_fit->>'topicV' topic_version,
    a.csat_fit->>'type' measured_type,a.csat_fit->'gate'->>'genre' content_genre,
    a.csat_fit->'gate'->>'purpose' purpose,a.csat_fit->'gate'->>'verdict' verdict,
    a.csat_fit->'gate'->>'publishable' content_publishable,
    a.syntax_score->>'score' syntax_score,
    a.status in ('ready','published') candidate,
    c.article_id is not null and c.source_updated_at=a.updated_at and c.policy_version=3 current_cache,
    c.result->>'grade' grade,c.result->>'status' eligibility_status,
    coalesce(cardinality(c.quality_flags),0)>0 quality_flagged
  from public.library_articles a left join public.csat_source_eligibility c on c.article_id=a.id
), sources as (
  select source,count(*) articles,count(*) filter(where candidate) candidates,
    count(*) filter(where candidate and current_cache and grade='usable') usable,
    count(*) filter(where candidate and current_cache and grade='excerpt') conditional,
    count(*) filter(where candidate and current_cache and grade='blocked') rejected,
    count(*) filter(where candidate and not current_cache) stale_or_missing,
    count(*) filter(where candidate and current_cache and grade in ('unjudged','unknown','excerpt-blind')) review,
    count(*) filter(where candidate and article_v_level between 0 and 11 and cefr_level in ('A1','A2','B1','B2','C1','C2') and syntax_score is not null) analysis_present,
    count(*) filter(where candidate and verdict is not null) content_judged,
    count(*) filter(where candidate and content_publishable='true') content_pass,
    count(*) filter(where candidate and quality_flagged and current_cache) quality_flagged,
    count(*) filter(where status='failed') failed_rows,
    count(*) filter(where nullif(author,'') is null) missing_author,
    count(*) filter(where published_at is null) missing_publication_date,
    count(*) filter(where nullif(source_url,'') is null) missing_url,
    count(*) filter(where source_fetched_at is null) missing_fetch_time,
    max(source_fetched_at) last_fetch,max(created_at) last_created,
    count(*) filter(where created_at>=now()-interval '7 days') created_last_7d,
    count(*) filter(where topic is null or topic='분류불가') unknown_topic,
    count(*) filter(where register is null) unknown_format,
    round(avg(word_count) filter(where candidate and current_cache and grade='usable'),1) usable_mean_words
  from base group by source
), cells as (
  select source,cefr_level,article_v_level,topic,topic_version,register,purpose,
    case when feed_id='kid-excerpt' then feed_label else null end explicit_school_feed,
    count(*) candidates,
    count(*) filter(where current_cache and grade='usable') usable,
    count(*) filter(where current_cache and grade='excerpt') conditional,
    count(*) filter(where current_cache and grade='blocked') rejected
  from base where candidate group by source,cefr_level,article_v_level,topic,topic_version,register,purpose,case when feed_id='kid-excerpt' then feed_label else null end
), duplicates as (
  select content_hash,count(*) n,count(distinct source) providers from base where content_hash is not null group by content_hash having count(*)>1
), url_duplicates as (
  select source_url,count(*) n from base where nullif(source_url,'') is not null group by source_url having count(*)>1
), domains as (
  select source,lower(substring(source_url from '^https?://([^/]+)')) domain,count(*) articles,
    count(*) filter(where candidate and current_cache and grade='usable') usable
  from base group by source,lower(substring(source_url from '^https?://([^/]+)'))
)
select jsonb_build_object(
  'measuredAt',now(),'schemaVersion',1,
  'scope','All library_articles; coverage only ready/published. Usable excludes conditional excerpts; current revision + policy 3 required.',
  'sources',(select jsonb_agg(to_jsonb(s) order by articles desc) from sources s),
  'cells',(select jsonb_agg(to_jsonb(c) order by source,cefr_level,article_v_level,topic,register,purpose,explicit_school_feed) from cells c),
  'domains',(select jsonb_agg(to_jsonb(d) order by articles desc) from domains d),
  'duplicateHashGroups',(select count(*) from duplicates),
  'duplicateHashExcessRows',(select coalesce(sum(n-1),0) from duplicates),
  'crossProviderHashGroups',(select count(*) from duplicates where providers>1),
  'repeatedUrlGroups',(select count(*) from url_duplicates),
  'repeatedUrlExcessRows',(select coalesce(sum(n-1),0) from url_duplicates),
  'registry',(select jsonb_agg(to_jsonb(r) order by source) from public.csat_source_registry r),
  'limitations',jsonb_build_array('Age suitability is not measured per article. School-feed labels are intended audience, not content validation.','csat_fit.type is a shape measurement, not proof of suitability for that question type.','Missing acquisition event logs prevent fetch/parser failure rate estimates. Failed rows are not extraction attempts.','Stored content_hash is exact only; repeated URLs may be distinct excerpts. Near-duplicates need separate inspection.','Topic is the existing keyword classifier, not an independently reviewed content label.','Conditional excerpts require item-level validation; usable counts do not imply every question type is possible.')
) as coverage;
