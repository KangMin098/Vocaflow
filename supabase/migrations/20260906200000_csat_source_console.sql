-- supabase/migrations/20260906200000_csat_source_console.sql
--
-- **소스 관리 콘솔의 뼈대** — ④ 소재 화면이 「원문 재고 실측」 리포트를 상시로 답한다.
--
-- ── 왜 필요했나 ──────────────────────────────────────────────────────────
-- 그 리포트(2026-09-06)는 **일회용 커서 페이징**으로 91,358행을 손으로 훑어 냈다.
-- 같은 질문을 다시 하려면 사람이 스크립트를 돌려야 했고, 원래 재는 자리 셋
-- (`kid-inventory.mjs` · `getKidSourcePanel()` · `textbook_shelf_*`)은 8초
-- statement timeout 에 걸려 죽거나 낡아 있었다.
--
-- ── 왜 matview 가 아니라 함수인가 (실측 2026-09-06) ─────────────────────
--   ① `group by source,status,license_class,display_only,jsonb…` 를 그대로 던짐
--        → **27,076ms**. 넓은 행(width 611)을 인덱스 스캔으로 읽고 **디스크 정렬**했다.
--   ② 같은 집계를 `with base as materialized (…)` 로 **좁은 열만 뽑아** 한 번 훑고
--      그 위에서 여러 번 HashAggregate
--        → **2,586ms**. seq scan 19,351 버퍼(content 는 TOAST 라 안 읽는다).
--
-- 2.6초면 함수 한 번으로 족하다. 8초 벽 안이고, matview 를 새로 두면 **갱신 시점이
-- 또 하나 늘어** 「언제 잰 값인가」를 화면이 두 곳에서 말해야 한다.
--
-- ── 그래도 스냅샷 표를 두는 이유 ────────────────────────────────────────
-- ① 화면은 2.6초를 기다리지 않는다 — 마지막 스냅샷 한 행을 읽는다.
-- ② **평가는 차이에서 나온다.** 「지금 21,769편」보다 「어제보다 +312, 초·중은 −14」가
--    관리자에게 쓸모 있다. 한 행짜리 현재값만 두면 그 말을 영영 못 한다.
--
-- ── 목표를 상수에서 표로 옮긴다 (리포트 §7-6) ───────────────────────────
-- `KID_SOURCE_TARGET.highSchoolStock = 18_320` 은 **이틀 만에 20,280** 이 됐다.
-- 상수인 한 달성률은 늘 실제보다 높게 나온다. 그래서 목표를 행으로 두고,
-- 분모를 `ratio_of_pool`(고등 재고의 비율)로 **매 스냅샷 재계산**한다.
-- 고정값이 필요한 목표는 `fixed` 로 둔다 — 어느 쪽인지 화면이 말한다.
--
-- 새 표 3 · 새 함수 2 · cron 1. 기존 표·함수는 건드리지 않는다.

/* ─────────────── ① 스냅샷 ─────────────── */

create table if not exists public.csat_source_snapshots (
  id          uuid primary key default gen_random_uuid(),
  taken_at    timestamptz not null default now(),
  duration_ms integer     not null default 0,
  rows_total  bigint      not null,
  taken_by    text        not null default 'cron',
  payload     jsonb       not null
);

create index if not exists idx_css_taken_at on public.csat_source_snapshots (taken_at desc);

comment on table public.csat_source_snapshots is
  '원문 재고 전수 집계의 시점 기록. payload 는 csat_source_rollup() 산출물 그대로. 화면은 최신 1행만 읽고, 직전 행과 비교해 증감을 말한다. 60행만 남긴다.';

alter table public.csat_source_snapshots enable row level security;
-- 정책을 두지 않는다 = service_role 만 읽고 쓴다. Admin 화면은 서버에서 service_role 로 읽는다.

/* ─────────────── ② 원천 등록부 ─────────────── */

create table if not exists public.csat_source_registry (
  source        text primary key,
  label         text not null,
  license_class text,
  homepage      text,
  role_note     text,
  harvest_cmd   text,
  feed_ids      text[] not null default '{}',
  active        boolean not null default true,
  added_at      timestamptz not null default now(),
  added_by      text,
  note          text,
  updated_at    timestamptz not null default now()
);

comment on table public.csat_source_registry is
  '원천 18곳의 관리자 메타 — 라이선스·쓰이는 자리·수확 명령. 이 표는 재고의 근거가 아니다(재고는 library_articles 가 답한다). 등록부에 없는 원천이 적재되면 화면이 「미등록」으로 잡는다 — 그것이 이 표의 쓸모다.';

alter table public.csat_source_registry enable row level security;

/* ─────────────── ③ 소스 타겟 ─────────────── */

create table if not exists public.csat_source_targets (
  key          text primary key,
  label        text not null,
  scope        text not null check (scope in ('kid', 'high', 'custom')),
  match        jsonb not null default '{}'::jsonb,
  mode         text not null check (mode in ('fixed', 'ratio_of_pool')),
  target_value numeric not null check (target_value > 0),
  basis        jsonb,
  sort_order   integer not null default 100,
  active       boolean not null default true,
  note         text,
  created_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.csat_source_targets is
  '「이 칸에 원문이 몇 편 있어야 하나」의 정본. match = {feedId, feedLabel, source, status[]} 로 셀 대상을 고르고, mode=fixed 면 target_value 가 곧 목표, ratio_of_pool 이면 basis={vMin,vMax} 재고의 target_value 배. 상수로 두면 분모가 낡는다 — 18,320 이 이틀 만에 20,280 이 된 전례가 이 표의 근거다.';

alter table public.csat_source_targets enable row level security;

/* ─────────────── ④ 집계 함수 ─────────────── */

create or replace function public.csat_source_rollup()
returns jsonb
language sql
stable
security definer
set search_path = public
set statement_timeout to '30000'
as $fn$
  with base as materialized (
    select
      source,
      status,
      coalesce(feed_id, '—')            as fid,
      coalesce(feed_label, '')          as lab,
      coalesce(license_class, '—')      as lic,
      coalesce(display_only, false)     as dio,
      coalesce(copyright_safe_in_kr, true) as krsafe,
      article_v_level                   as v,
      cefr_level                        as cefr,
      register                          as reg,
      word_count                        as wc,
      (status in ('ready', 'published') and not coalesce(display_only, false)) as in_pool,
      (vrl_components is not null)      as h_vrl,
      (syntax_score is not null)        as h_syn,
      (lexical_noise is not null)       as h_noise,
      (csat_fit ? 'pass')               as h_pass,
      (csat_fit ? 'topic')              as h_topic,
      (csat_fit->'make' ? 'windows')    as h_win,
      (csat_fit ? 'gate')               as h_gate,
      csat_fit->>'topic'                as topic,
      csat_fit->'gate'->>'purpose'      as purpose,
      csat_fit->'gate'->>'verdict'      as verdict,
      csat_fit->'gate'->>'by'           as judge,
      csat_fit->'gate'->>'blockedBy'    as blocked,
      (csat_fit->'gate'->>'publishable')::boolean as pub,
      csat_fit->'gate'->'codes'         as codes
    from public.library_articles
  )
  select jsonb_build_object(
    'v', 1,
    'rows', (select count(*) from base),
    'byStatus', (select jsonb_object_agg(status, n)
                 from (select status, count(*) n from base group by 1) t),
    'pool', (select jsonb_build_object(
               'n', count(*),
               'inMarket', count(*) filter (where wc between 40 and 250),
               'inRepo', count(*) filter (where wc between 100 and 200),
               'wcMedian', percentile_cont(0.5) within group (order by wc))
             from base where in_pool),
    -- 이 한 배열이 §1 관문 · §2 원천 · §4 충전율 · §6 초·중 목표를 전부 답한다.
    -- (source, feed_id, feed_label, status) 칸마다 「몇 편이고 무엇이 채워졌나」.
    'feeds', (select jsonb_agg(x order by (x->>'n')::bigint desc)
              from (select jsonb_build_object(
                      'src', source, 'fid', fid, 'lab', lab, 'st', status,
                      'n', count(*),
                      'dio', count(*) filter (where dio),
                      'v', count(v), 'cefr', count(cefr), 'wc', count(wc), 'reg', count(reg),
                      'syn', count(*) filter (where h_syn),
                      'vrl', count(*) filter (where h_vrl),
                      'noise', count(*) filter (where h_noise),
                      'pass', count(*) filter (where h_pass),
                      'topic', count(*) filter (where h_topic),
                      'win', count(*) filter (where h_win),
                      'gate', count(*) filter (where h_gate),
                      -- pub / notpub 을 **따로** 센다. 미판정(null)은 어느 쪽도 아니다 —
                      -- 한쪽만 세면 방금 담은 행이 조용히 격리로 세어진다.
                      'pub', count(*) filter (where pub is true),
                      'notpub', count(*) filter (where pub is false),
                      'ruleOnly', count(*) filter (where judge = 'rule'),
                      'inMarket', count(*) filter (where wc between 40 and 250)) x
                    from base group by source, fid, lab, status) f),
    'sources', (select jsonb_agg(jsonb_build_object(
                  'src', source, 'n', n, 'queued', q, 'ready', r, 'published', p,
                  'archived', a, 'failed', f, 'dio', d, 'lics', l) order by n desc)
                from (select source, count(*) n,
                        count(*) filter (where status = 'queued') q,
                        count(*) filter (where status = 'ready') r,
                        count(*) filter (where status = 'published') p,
                        count(*) filter (where status = 'archived') a,
                        count(*) filter (where status = 'failed') f,
                        count(*) filter (where dio) d,
                        array_agg(distinct lic) l
                      from base group by 1) t),
    'licenses', (select jsonb_agg(jsonb_build_object('lic', lic, 'n', n, 'dio', d, 'unsafe', u) order by n desc)
                 from (select lic, count(*) n, count(*) filter (where dio) d,
                              count(*) filter (where not krsafe) u
                       from base group by 1) t),
    'vlevels', (select jsonb_agg(jsonb_build_object(
                  'v', v, 'n', n, 'wcMed', m, 'inMarket', im, 'inRepo', ir) order by v nulls last)
                from (select v, count(*) n,
                        percentile_cont(0.5) within group (order by wc) m,
                        count(*) filter (where wc between 40 and 250) im,
                        count(*) filter (where wc between 100 and 200) ir
                      from base where in_pool group by v) t),
    'registers', (select jsonb_agg(jsonb_build_object('reg', coalesce(reg, '—'), 'n', n) order by n desc)
                  from (select reg, count(*) n from base where in_pool group by 1) t),
    'cefrs', (select jsonb_agg(jsonb_build_object('cefr', coalesce(cefr, '—'), 'n', n) order by n desc)
              from (select cefr, count(*) n from base where in_pool group by 1) t),
    'topics', (select jsonb_agg(jsonb_build_object('topic', coalesce(topic, '—'), 'n', n) order by n desc)
               from (select topic, count(*) n from base where in_pool group by 1) t),
    'purposes', (select jsonb_agg(jsonb_build_object(
                   'purpose', coalesce(purpose, '—'), 'n', n, 'archived', a, 'pub', p, 'notpub', np) order by n desc)
                 from (select purpose, count(*) n,
                         count(*) filter (where status = 'archived') a,
                         count(*) filter (where pub is true) p,
                         count(*) filter (where pub is false) np
                       from base group by 1) t),
    -- 차단은 두 갈래로 기록된다 — `blockedBy`(그 행을 실제로 막은 하나)와
    -- `codes`(붙은 표식 전부). 둘을 합치면 합계가 안 맞는다. 그래서 따로 낸다.
    'blockedBy', (select jsonb_agg(jsonb_build_object('code', blocked, 'n', n) order by n desc)
                  from (select blocked, count(*) n from base where blocked is not null group by 1) t),
    'codes', (select jsonb_agg(jsonb_build_object('code', c, 'n', n) order by n desc)
              from (select c.value c, count(*) n
                    from base, lateral jsonb_array_elements_text(coalesce(codes, '[]'::jsonb)) c
                    group by 1) t),
    'verdicts', (select jsonb_agg(jsonb_build_object('verdict', coalesce(verdict, '—'), 'n', n) order by n desc)
                 from (select verdict, count(*) n from base group by 1) t),
    'judges', (select jsonb_agg(jsonb_build_object('by', coalesce(judge, '—'), 'n', n) order by n desc)
               from (select judge, count(*) n from base group by 1) t)
  )
$fn$;

comment on function public.csat_source_rollup() is
  '원문 재고 전수 집계 — 한 번의 seq scan(materialized CTE) 위에서 12갈래 HashAggregate. 실측 2,586ms / 91,360행. 같은 집계를 정렬 기반으로 하면 27,076ms 라 8초 벽에 죽는다. admin 게이트 뒤 service_role 만 부른다.';

revoke all on function public.csat_source_rollup() from public;
grant execute on function public.csat_source_rollup() to service_role;

/* ─────────────── ⑤ 스냅샷 뜨기 ─────────────── */

create or replace function public.csat_source_snapshot_take(p_by text default 'cron')
returns public.csat_source_snapshots
language plpgsql
security definer
set search_path = public
set statement_timeout to '60000'
as $fn$
declare
  t0   timestamptz := clock_timestamp();
  pl   jsonb;
  snap public.csat_source_snapshots;
begin
  pl := public.csat_source_rollup();

  insert into public.csat_source_snapshots (duration_ms, rows_total, taken_by, payload)
  values (
    (extract(epoch from (clock_timestamp() - t0)) * 1000)::int,
    coalesce((pl->>'rows')::bigint, 0),
    coalesce(nullif(p_by, ''), 'cron'),
    pl
  )
  returning * into snap;

  -- 최근 60개만 남긴다. 시계열은 「어제 대비」를 말할 만큼만 있으면 되고,
  -- payload 가 30KB 대라 무한히 쌓으면 표가 재고보다 커진다.
  delete from public.csat_source_snapshots s
  where s.id in (
    select id from public.csat_source_snapshots
    order by taken_at desc offset 60
  );

  return snap;
end;
$fn$;

comment on function public.csat_source_snapshot_take(text) is
  '집계를 떠서 csat_source_snapshots 에 한 행 남기고 60행 넘는 과거를 지운다. cron(6시간) 과 Admin ④ 소재의 「지금 다시 잰다」 가 같은 함수를 부른다 — 두 경로가 다른 셈법을 쓰지 않게 하려는 것이다. 재실행 안전(같은 시점을 여러 번 떠도 행만 는다).';

revoke all on function public.csat_source_snapshot_take(text) from public;
grant execute on function public.csat_source_snapshot_take(text) to service_role;

/* ─────────────── ⑥ 등록부·타겟 초기값 ─────────────── */

insert into public.csat_source_registry (source, label, license_class, homepage, role_note, harvest_cmd, feed_ids, added_by)
values
  ('plos','PLOS','cc_by','https://plos.org','고등 V6·V7 논문 전문 — 발췌해야 지문이 된다','node scripts/csat/harvest-plos.mjs',array['recent','harvest','essay','plos-extract'],'seed'),
  ('gutenberg','Project Gutenberg','public_domain','https://gutenberg.org','초·중 발췌 + 수능 수확 두 갈래','node scripts/textbook/harvest-gutenberg-kid.mjs',array['kid-excerpt','harvest'],'seed'),
  ('futurity','Futurity','cc_by','https://futurity.org','V4·V5 설명문 주력','node scripts/acp/collect-daily.mjs',array['all'],'seed'),
  ('original','우리 저작','cc0',null,'V2~V5 작문 드레인 산출 — 수확이 아니라 생성','node scripts/csat/compose-drain-export.mjs',array['compose-drain'],'seed'),
  ('usgs','USGS','public_domain','https://usgs.gov','V5 지구과학','node scripts/acp/collect-daily.mjs',array['featured','snippets'],'seed'),
  ('nasa','NASA','public_domain','https://nasa.gov','전 밴드 과학','node scripts/acp/collect-daily.mjs',array['news','iotd','apod'],'seed'),
  ('elife','eLife','cc_by','https://elifesciences.org','digest 만 — 편집자 저작 요약','node scripts/acp/collect-daily.mjs',array['default'],'seed'),
  ('voa','VOA Learning English','public_domain','https://learningenglish.voanews.com','V2~V4 news·narrative','node scripts/acp/collect-daily.mjs',array['education','science-technology','as-it-is'],'seed'),
  ('frym','Frontiers for Young Minds','cc_by','https://kids.frontiersin.org','초등 과학 — 아동 대상 편집본','node scripts/textbook/frym-ingest.mjs',array['—'],'seed'),
  ('storyweaver','StoryWeaver','cc_by','https://storyweaver.org.in','초등 narrative — 이 칸의 유일 공급','node scripts/textbook/storyweaver-ingest.mjs',array['—'],'seed'),
  ('noaa','NOAA','public_domain','https://noaa.gov','V5 기후','node scripts/acp/collect-daily.mjs',array['understanding-climate','features'],'seed'),
  ('simple_wikipedia','Simple Wikipedia','cc_by_sa','https://simple.wikipedia.org','V2~V4 reference','node scripts/textbook/mediawiki-lead-ingest.mjs',array['good','very-good'],'seed'),
  ('wikipedia','Wikipedia','cc_by_sa','https://wikipedia.org','V6 expository','node scripts/textbook/mediawiki-lead-ingest.mjs',array['featured','good'],'seed'),
  ('the_conversation','The Conversation','cc_by_nd','https://theconversation.com','읽기 전용 — 파생 불가(display_only)','node scripts/acp/collect-daily.mjs',array['all','science','health'],'seed'),
  ('space_place','NASA Space Place','public_domain','https://spaceplace.nasa.gov','초등 — 어휘 난도가 시중에 가장 근접','node scripts/textbook/space-place-ingest.mjs',array['—','adapted'],'seed'),
  ('owid','Our World in Data','cc_by','https://ourworldindata.org','argumentative 유일 공급','node scripts/acp/collect-daily.mjs',array['default'],'seed'),
  ('wikivoyage','Wikivoyage','cc_by_sa','https://wikivoyage.org','여행 reference','node scripts/textbook/mediawiki-lead-ingest.mjs',array['—','star'],'seed'),
  ('factbook','CIA World Factbook','public_domain','https://cia.gov/the-world-factbook','reference 칸','node scripts/acp/collect-daily.mjs',array['—'],'seed')
on conflict (source) do nothing;

insert into public.csat_source_targets (key, label, scope, match, mode, target_value, basis, sort_order, note, created_by)
values
  ('kid:elem34','초3~4','kid','{"feedId":"kid-excerpt","feedLabel":"PD 발췌 · 초3~4"}','ratio_of_pool',0.1,'{"vMin":5,"vMax":9}',10,'고등 재고의 절반을 다섯 칸에 고르게 → 칸마다 1/10','seed'),
  ('kid:elem56','초5~6','kid','{"feedId":"kid-excerpt","feedLabel":"PD 발췌 · 초5~6"}','ratio_of_pool',0.1,'{"vMin":5,"vMax":9}',20,'같음','seed'),
  ('kid:elem6mid1','초6~중1','kid','{"feedId":"kid-excerpt","feedLabel":"PD 발췌 · 초6~중1"}','ratio_of_pool',0.1,'{"vMin":5,"vMax":9}',30,'같음','seed'),
  ('kid:mid12','중1~2','kid','{"feedId":"kid-excerpt","feedLabel":"PD 발췌 · 중1~2"}','ratio_of_pool',0.1,'{"vMin":5,"vMax":9}',40,'같음','seed'),
  ('kid:mid3','중3','kid','{"feedId":"kid-excerpt","feedLabel":"PD 발췌 · 중3"}','ratio_of_pool',0.1,'{"vMin":5,"vMax":9}',50,'같음','seed'),
  ('kid:adapted','각색 (칸 밖 경로)','kid','{"feedId":"adapted"}','fixed',200,null,60,'레벨 적응본 — 칸 몫에 안 들어가고 따로 센다','seed')
on conflict (key) do nothing;

/* ─────────────── ⑦ 주기 갱신 ─────────────── */

-- 6시간. 전수 훑기라 725MB 를 읽는다 — 오늘(2026-09-06) 이 DB 는 읽기 포화로
-- 한 번 멈춘 적이 있어 30분 주기로 걸지 않는다. 급하면 화면 버튼이 즉시 뜬다.
select cron.schedule(
  'csat-source-snapshot',
  '20 */6 * * *',
  'select public.csat_source_snapshot_take(''cron'')'
);
