-- scripts/db/factory-i1/d3-package/apply.sql
-- REVIEW ONLY: 사용자 승인 전 공유 DB 실행 금지. 기존 DB1/DB2를 재적용하지 않는다.
-- source sha256=f94bf27f7c00ff5054a7bc2efdf61a55d83aefd98c2502e895c8332001aae3d8; exact source bytes follow VF-D3 markers.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $guard$ declare actual jsonb; begin
  if current_setting('server_encoding') <> 'UTF8' then raise exception 'D3_BLOCKED: UTF8 required'; end if;
  if exists(select 1 from unnest(array['public.factory_product_order','public.factory_order_product_link','public.factory_product_order_withdrawal','public.factory_lineage_request']) n where to_regclass(n) is not null) then raise exception 'D3_BLOCKED: target already exists'; end if;
  if exists(select 1 from supabase_migrations.schema_migrations where version='20261020063000') then raise exception 'D3_BLOCKED: migration history already exists'; end if;
  select baseline into actual from (select coalesce(jsonb_agg(to_jsonb(c) order by k,name),'[]') as baseline from (select 'rel'::text k, n.nspname||'.'||c.relname name,
  c.relkind::text||'|'||coalesce(c.relacl::text,'')||'|'||c.relrowsecurity||'|'||c.relforcerowsecurity||'|'||coalesce(case when c.relkind = 'i' then pg_get_indexdef(c.oid) end,'')
  ||'|'||c.relowner::regrole::text||'|'||coalesce(c.reloptions::text,'')||'|'||coalesce(case when c.relkind in ('v','m') then md5(pg_get_viewdef(c.oid)) end,'') fp
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%' and c.relkind <> 't'
union all
select 'col', n.nspname||'.'||c.relname||'.'||a.attname,
  format_type(a.atttypid, a.atttypmod)||'|'||a.attnotnull||'|'||coalesce(pg_get_expr(d.adbin, d.adrelid),'')||'|'||coalesce(a.attacl::text,'')
  from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attnum > 0 and not a.attisdropped and c.relkind in ('r','p','v','m','f') and n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'typ', n.nspname||'.'||t.typname, t.typtype::text||'|'||t.typowner::regrole::text||'|'||coalesce(t.typacl::text,'')||'|'||format_type(t.typbasetype, t.typtypmod)||'|'||t.typnotnull
  ||'|'||coalesce((select string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid),'')
  ||'|'||coalesce((select string_agg(pg_get_constraintdef(o.oid), ',' order by o.conname) from pg_constraint o where o.contypid = t.oid),'')
  from pg_type t join pg_namespace n on n.oid = t.typnamespace
  where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%' and (t.typtype in ('e','d','r','m') or (t.typtype = 'c' and (select relkind from pg_class where oid = t.typrelid) = 'c'))
union all
select 'dacl', coalesce(d.defaclrole::regrole::text,'')||'.'||coalesce(d.defaclnamespace::regnamespace::text,'*')||'.'||d.defaclobjtype::text, coalesce(d.defaclacl::text,'') from pg_default_acl d
union all
select 'ext', x.extname, x.extversion||'|'||x.extnamespace::regnamespace::text||'|'||x.extowner::regrole::text from pg_extension x
union all
select 'evt', e.evtname, e.evtevent||'|'||e.evtfoid::regproc::text||'|'||e.evtenabled::text||'|'||coalesce(e.evttags::text,'') from pg_event_trigger e
union all
select 'cmt', 'all', coalesce(md5(string_agg(d.classoid::regclass::text||':'||d.objoid||':'||d.objsubid||'='||d.description, E'\n' order by d.classoid, d.objoid, d.objsubid)),'') from pg_description d
union all
select 'con', n.nspname||'.'||c.relname||'.'||o.conname, pg_get_constraintdef(o.oid)
  from pg_constraint o join pg_class c on c.oid = o.conrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'fn', n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
  md5(coalesce(p.prosrc,''))||'|'||coalesce(p.proconfig::text,'')||'|'||coalesce(p.proacl::text,'')||'|'||p.prosecdef||'|'||p.provolatile::text||'|'||p.prokind::text||'|'||p.proowner::regrole::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'pol', n.nspname||'.'||c.relname||'.'||p.polname,
  p.polcmd::text||'|'||p.polpermissive||'|'||p.polroles::text||'|'||coalesce(pg_get_expr(p.polqual, p.polrelid),'')||'|'||coalesce(pg_get_expr(p.polwithcheck, p.polrelid),'')
  from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'trg', n.nspname||'.'||c.relname||'.'||t.tgname, pg_get_triggerdef(t.oid)||'|'||t.tgenabled::text
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%' and not t.tgisinternal
union all
select 'nsp', n.nspname, coalesce(n.nspacl::text,'')||'|'||n.nspowner::regrole::text from pg_namespace n where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%') c
where exists(select 1 from unnest(array['public.factory_order','public.workspace_content_demand','public.workspace_content_demand_line','public.learner_workspace','public.learner_workspace_plan','public.csat_map_goal_version','public.user_profiles','public.forbid_ledger_mutation']) obj
  where name=obj or name like obj||'.%' or name like obj||'(%')) b;
  if actual is distinct from '[{"k":"col","fp":"uuid|true||","name":"public.csat_map_goal_version.client_key"},{"k":"col","fp":"timestamp with time zone|true|now()|","name":"public.csat_map_goal_version.created_at"},{"k":"col","fp":"bigint|true||","name":"public.csat_map_goal_version.id"},{"k":"col","fp":"date|false||","name":"public.csat_map_goal_version.target_date"},{"k":"col","fp":"text|false||","name":"public.csat_map_goal_version.target_exam"},{"k":"col","fp":"smallint|false||","name":"public.csat_map_goal_version.target_grade"},{"k":"col","fp":"smallint|true||","name":"public.csat_map_goal_version.target_score"},{"k":"col","fp":"uuid|true||","name":"public.csat_map_goal_version.user_id"},{"k":"col","fp":"timestamp with time zone|true|now()|","name":"public.factory_order.created_at"},{"k":"col","fp":"integer|true|0|","name":"public.factory_order.event_seq"},{"k":"col","fp":"uuid|true|gen_random_uuid()|","name":"public.factory_order.id"},{"k":"col","fp":"uuid|true||","name":"public.factory_order.line_id"},{"k":"col","fp":"smallint|true||","name":"public.factory_order.order_seq"},{"k":"col","fp":"uuid|false||","name":"public.factory_order.parent_order_id"},{"k":"col","fp":"text|false||","name":"public.factory_order.production_run_id"},{"k":"col","fp":"smallint|true||","name":"public.factory_order.quantity"},{"k":"col","fp":"text|true||","name":"public.factory_order.reason"},{"k":"col","fp":"uuid|true||","name":"public.factory_order.request_key"},{"k":"col","fp":"text|true||","name":"public.factory_order.role"},{"k":"col","fp":"text|true|''requested''::text|","name":"public.factory_order.state"},{"k":"col","fp":"text|true||","name":"public.factory_order.task_id"},{"k":"col","fp":"uuid|true||","name":"public.factory_order.user_id"},{"k":"col","fp":"uuid|true||","name":"public.factory_order.workspace_id"},{"k":"col","fp":"text|true||","name":"public.learner_workspace.canon_version"},{"k":"col","fp":"timestamp with time zone|true|now()|","name":"public.learner_workspace.created_at"},{"k":"col","fp":"uuid|true|gen_random_uuid()|","name":"public.learner_workspace.id"},{"k":"col","fp":"text|true|''active''::text|","name":"public.learner_workspace.status"},{"k":"col","fp":"text|true||","name":"public.learner_workspace.template_id"},{"k":"col","fp":"uuid|true||","name":"public.learner_workspace.user_id"},{"k":"col","fp":"timestamp with time zone|true||","name":"public.learner_workspace_plan.as_of"},{"k":"col","fp":"text|true||","name":"public.learner_workspace_plan.canon_version"},{"k":"col","fp":"uuid|true||","name":"public.learner_workspace_plan.client_key"},{"k":"col","fp":"timestamp with time zone|true|now()|","name":"public.learner_workspace_plan.created_at"},{"k":"col","fp":"bigint|false||","name":"public.learner_workspace_plan.goal_version_id"},{"k":"col","fp":"bigint|true||","name":"public.learner_workspace_plan.id"},{"k":"col","fp":"text|false||","name":"public.learner_workspace_plan.note"},{"k":"col","fp":"jsonb|true||","name":"public.learner_workspace_plan.plan"},{"k":"col","fp":"integer|true||","name":"public.learner_workspace_plan.plan_version"},{"k":"col","fp":"text|true||","name":"public.learner_workspace_plan.reason"},{"k":"col","fp":"integer|false||","name":"public.learner_workspace_plan.restored_from"},{"k":"col","fp":"uuid|true||","name":"public.learner_workspace_plan.user_id"},{"k":"col","fp":"uuid|true||","name":"public.learner_workspace_plan.workspace_id"},{"k":"col","fp":"text|false||{authenticated=aw/postgres}","name":"public.user_profiles.avatar_url"},{"k":"col","fp":"text|false||{authenticated=aw/postgres}","name":"public.user_profiles.cefr_level"},{"k":"col","fp":"timestamp with time zone|false|now()|","name":"public.user_profiles.created_at"},{"k":"col","fp":"jsonb|false|''{}''::jsonb|","name":"public.user_profiles.current_domain_levels"},{"k":"col","fp":"jsonb|false|''{}''::jsonb|","name":"public.user_profiles.current_skill_levels"},{"k":"col","fp":"jsonb|false|''{}''::jsonb|","name":"public.user_profiles.current_track_levels"},{"k":"col","fp":"smallint|false|0|","name":"public.user_profiles.current_v_level"},{"k":"col","fp":"jsonb|false||","name":"public.user_profiles.current_v_level_meta"},{"k":"col","fp":"integer|false|30|{authenticated=aw/postgres}","name":"public.user_profiles.daily_word_goal"},{"k":"col","fp":"timestamp with time zone|false||","name":"public.user_profiles.diagnostic_completed_at"},{"k":"col","fp":"text|false||{authenticated=aw/postgres}","name":"public.user_profiles.display_name"},{"k":"col","fp":"timestamp with time zone|false||","name":"public.user_profiles.last_active_at"},{"k":"col","fp":"text|true|''alias''::text|","name":"public.user_profiles.leaderboard_visibility"},{"k":"col","fp":"numeric(3,2)|false|0.5|","name":"public.user_profiles.learning_activity_score"},{"k":"col","fp":"text|false||{authenticated=aw/postgres}","name":"public.user_profiles.learning_goal"},{"k":"col","fp":"text|false|''ko''::text|{authenticated=aw/postgres}","name":"public.user_profiles.locale"},{"k":"col","fp":"timestamp with time zone|false||","name":"public.user_profiles.next_level_review_due_at"},{"k":"col","fp":"boolean|false|true|{authenticated=aw/postgres}","name":"public.user_profiles.notify_email"},{"k":"col","fp":"boolean|false|false|{authenticated=aw/postgres}","name":"public.user_profiles.notify_push"},{"k":"col","fp":"boolean|false|true|{authenticated=aw/postgres}","name":"public.user_profiles.notify_streak_risk"},{"k":"col","fp":"text|true|''user''::text|","name":"public.user_profiles.role"},{"k":"col","fp":"text|true|''general''::text|{authenticated=aw/postgres}","name":"public.user_profiles.segment"},{"k":"col","fp":"text|true|''active''::text|","name":"public.user_profiles.status"},{"k":"col","fp":"jsonb|false|''{}''::jsonb|{authenticated=aw/postgres}","name":"public.user_profiles.target_track_levels"},{"k":"col","fp":"smallint|false||{authenticated=aw/postgres}","name":"public.user_profiles.target_v_level"},{"k":"col","fp":"jsonb|false||{authenticated=aw/postgres}","name":"public.user_profiles.target_v_level_meta"},{"k":"col","fp":"text|false|''system''::text|{authenticated=aw/postgres}","name":"public.user_profiles.theme"},{"k":"col","fp":"integer|false|0|","name":"public.user_profiles.total_words_mastered"},{"k":"col","fp":"integer|false|0|","name":"public.user_profiles.total_words_seen"},{"k":"col","fp":"numeric(3,2)|false|1.0|{authenticated=aw/postgres}","name":"public.user_profiles.tts_speed"},{"k":"col","fp":"text|false||{authenticated=aw/postgres}","name":"public.user_profiles.tts_voice"},{"k":"col","fp":"timestamp with time zone|false|now()|{authenticated=w/postgres}","name":"public.user_profiles.updated_at"},{"k":"col","fp":"uuid|true||{authenticated=a/postgres}","name":"public.user_profiles.user_id"},{"k":"col","fp":"text|true||","name":"public.workspace_content_demand.canonical"},{"k":"col","fp":"text|true||","name":"public.workspace_content_demand.core_task"},{"k":"col","fp":"timestamp with time zone|true|now()|","name":"public.workspace_content_demand.created_at"},{"k":"col","fp":"text|true||","name":"public.workspace_content_demand.definition_version"},{"k":"col","fp":"bigint|false||","name":"public.workspace_content_demand.goal_version_id"},{"k":"col","fp":"uuid|true|gen_random_uuid()|","name":"public.workspace_content_demand.id"},{"k":"col","fp":"integer|true||","name":"public.workspace_content_demand.plan_version"},{"k":"col","fp":"text|true||","name":"public.workspace_content_demand.signature"},{"k":"col","fp":"uuid|true||","name":"public.workspace_content_demand.user_id"},{"k":"col","fp":"uuid|true||","name":"public.workspace_content_demand.workspace_id"},{"k":"col","fp":"uuid|true||","name":"public.workspace_content_demand_line.demand_id"},{"k":"col","fp":"uuid|true|gen_random_uuid()|","name":"public.workspace_content_demand_line.id"},{"k":"col","fp":"smallint|true||","name":"public.workspace_content_demand_line.line_no"},{"k":"col","fp":"smallint|true||","name":"public.workspace_content_demand_line.quantity"},{"k":"col","fp":"text|true||","name":"public.workspace_content_demand_line.role"},{"k":"col","fp":"text|true||","name":"public.workspace_content_demand_line.task_id"},{"k":"col","fp":"uuid|true||","name":"public.workspace_content_demand_line.user_id"},{"k":"col","fp":"uuid|true||","name":"public.workspace_content_demand_line.workspace_id"},{"k":"con","fp":"UNIQUE (id, user_id)","name":"public.csat_map_goal_version.csat_map_goal_version_id_user_key"},{"k":"con","fp":"PRIMARY KEY (id)","name":"public.csat_map_goal_version.csat_map_goal_version_pkey"},{"k":"con","fp":"CHECK ((target_exam = ANY (ARRAY[''suneung''::text, ''kice6''::text, ''kice9''::text, ''hakpyeong''::text])))","name":"public.csat_map_goal_version.csat_map_goal_version_target_exam_check"},{"k":"con","fp":"CHECK (((target_grade >= 1) AND (target_grade <= 9)))","name":"public.csat_map_goal_version.csat_map_goal_version_target_grade_check"},{"k":"con","fp":"CHECK (((target_score >= 0) AND (target_score <= 100)))","name":"public.csat_map_goal_version.csat_map_goal_version_target_score_check"},{"k":"con","fp":"UNIQUE (user_id, client_key)","name":"public.csat_map_goal_version.csat_map_goal_version_user_id_client_key_key"},{"k":"con","fp":"FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE","name":"public.csat_map_goal_version.csat_map_goal_version_user_id_fkey"},{"k":"con","fp":"CHECK (((reason = ''initial''::text) = (parent_order_id IS NULL)))","name":"public.factory_order.factory_order_check"},{"k":"con","fp":"CHECK (((state <> ''producing''::text) OR (production_run_id IS NOT NULL)))","name":"public.factory_order.factory_order_check1"},{"k":"con","fp":"UNIQUE (line_id, order_seq)","name":"public.factory_order.factory_order_line_id_order_seq_key"},{"k":"con","fp":"FOREIGN KEY (line_id, user_id, workspace_id, role, task_id) REFERENCES workspace_content_demand_line(id, user_id, workspace_id, role, task_id) ON DELETE CASCADE","name":"public.factory_order.factory_order_line_id_user_id_workspace_id_role_task_id_fkey"},{"k":"con","fp":"CHECK (((order_seq >= 1) AND (order_seq <= 100)))","name":"public.factory_order.factory_order_order_seq_check"},{"k":"con","fp":"FOREIGN KEY (parent_order_id) REFERENCES factory_order(id)","name":"public.factory_order.factory_order_parent_order_id_fkey"},{"k":"con","fp":"PRIMARY KEY (id)","name":"public.factory_order.factory_order_pkey"},{"k":"con","fp":"CHECK (((quantity >= 1) AND (quantity <= 50)))","name":"public.factory_order.factory_order_quantity_check"},{"k":"con","fp":"CHECK ((reason = ANY (ARRAY[''initial''::text, ''shortfall''::text, ''retry_after_failure''::text, ''plan_revision''::text])))","name":"public.factory_order.factory_order_reason_check"},{"k":"con","fp":"CHECK ((state = ANY (ARRAY[''requested''::text, ''stock_search''::text, ''awaiting_production''::text, ''producing''::text, ''reviewing''::text, ''delivered''::text, ''partial''::text, ''held''::text, ''failed''::text])))","name":"public.factory_order.factory_order_state_check"},{"k":"con","fp":"UNIQUE (user_id, request_key)","name":"public.factory_order.factory_order_user_id_request_key_key"},{"k":"con","fp":"CHECK ((canon_version ~ ''^[A-Za-z0-9.\\-]{1,64}$''::text))","name":"public.learner_workspace.learner_workspace_canon_version_check"},{"k":"con","fp":"UNIQUE (id, user_id)","name":"public.learner_workspace.learner_workspace_id_user_key"},{"k":"con","fp":"PRIMARY KEY (id)","name":"public.learner_workspace.learner_workspace_pkey"},{"k":"con","fp":"CHECK ((status = ANY (ARRAY[''active''::text, ''paused''::text, ''closed''::text])))","name":"public.learner_workspace.learner_workspace_status_check"},{"k":"con","fp":"CHECK ((template_id ~ ''^ws\\.[a-z0-9-]{1,40}$''::text))","name":"public.learner_workspace.learner_workspace_template_id_check"},{"k":"con","fp":"FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE","name":"public.learner_workspace.learner_workspace_user_id_fkey"},{"k":"con","fp":"CHECK ((canon_version ~ ''^[A-Za-z0-9.\\-]{1,64}$''::text))","name":"public.learner_workspace_plan.learner_workspace_plan_canon_version_check"},{"k":"con","fp":"CHECK (((reason = ''restore''::text) = (restored_from IS NOT NULL)))","name":"public.learner_workspace_plan.learner_workspace_plan_check"},{"k":"con","fp":"FOREIGN KEY (goal_version_id) REFERENCES csat_map_goal_version(id)","name":"public.learner_workspace_plan.learner_workspace_plan_goal_version_id_fkey"},{"k":"con","fp":"CHECK (((note IS NULL) OR (length(note) <= 500)))","name":"public.learner_workspace_plan.learner_workspace_plan_note_check"},{"k":"con","fp":"PRIMARY KEY (id)","name":"public.learner_workspace_plan.learner_workspace_plan_pkey"},{"k":"con","fp":"CHECK (((jsonb_typeof((plan -> ''tasks''::text)) = ''array''::text) AND (jsonb_typeof((plan -> ''order''::text)) = ''array''::text)))","name":"public.learner_workspace_plan.learner_workspace_plan_plan_check"},{"k":"con","fp":"CHECK (((plan_version >= 1) AND (plan_version <= 100000)))","name":"public.learner_workspace_plan.learner_workspace_plan_plan_version_check"},{"k":"con","fp":"CHECK ((reason = ANY (ARRAY[''initial''::text, ''learner_adjust''::text, ''new_exam''::text, ''check_result''::text, ''goal_change''::text, ''definition_change''::text, ''content_change''::text, ''restore''::text])))","name":"public.learner_workspace_plan.learner_workspace_plan_reason_check"},{"k":"con","fp":"CHECK (((restored_from IS NULL) OR (restored_from >= 1)))","name":"public.learner_workspace_plan.learner_workspace_plan_restored_from_check"},{"k":"con","fp":"UNIQUE (user_id, client_key)","name":"public.learner_workspace_plan.learner_workspace_plan_user_id_client_key_key"},{"k":"con","fp":"FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE","name":"public.learner_workspace_plan.learner_workspace_plan_user_id_fkey"},{"k":"con","fp":"FOREIGN KEY (workspace_id) REFERENCES learner_workspace(id) ON DELETE CASCADE","name":"public.learner_workspace_plan.learner_workspace_plan_workspace_id_fkey"},{"k":"con","fp":"UNIQUE (workspace_id, plan_version)","name":"public.learner_workspace_plan.learner_workspace_plan_workspace_id_plan_version_key"},{"k":"con","fp":"UNIQUE (workspace_id, plan_version, user_id)","name":"public.learner_workspace_plan.learner_workspace_plan_ws_ver_user_key"},{"k":"con","fp":"CHECK ((cefr_level = ANY (ARRAY[''A1''::text, ''A2''::text, ''B1''::text, ''B2''::text, ''C1''::text, ''C2''::text])))","name":"public.user_profiles.user_profiles_cefr_level_check"},{"k":"con","fp":"CHECK (((current_v_level >= 0) AND (current_v_level <= 11)))","name":"public.user_profiles.user_profiles_current_v_level_check"},{"k":"con","fp":"FOREIGN KEY (current_v_level) REFERENCES vocaflow_levels(level) ON DELETE SET NULL","name":"public.user_profiles.user_profiles_current_v_level_fk"},{"k":"con","fp":"CHECK ((leaderboard_visibility = ANY (ARRAY[''alias''::text, ''name''::text, ''hidden''::text])))","name":"public.user_profiles.user_profiles_leaderboard_visibility_check"},{"k":"con","fp":"CHECK (((learning_activity_score >= (0)::numeric) AND (learning_activity_score <= (1)::numeric)))","name":"public.user_profiles.user_profiles_learning_activity_score_check"},{"k":"con","fp":"CHECK ((locale = ANY (ARRAY[''ko''::text, ''en''::text])))","name":"public.user_profiles.user_profiles_locale_check"},{"k":"con","fp":"PRIMARY KEY (user_id)","name":"public.user_profiles.user_profiles_pkey"},{"k":"con","fp":"CHECK ((role = ANY (ARRAY[''user''::text, ''admin''::text, ''curator''::text])))","name":"public.user_profiles.user_profiles_role_check"},{"k":"con","fp":"CHECK ((segment = ANY (ARRAY[''middle_school''::text, ''high_school''::text, ''academic''::text, ''business''::text, ''toeic''::text, ''civil_service''::text, ''general''::text, ''book_recommend''::text])))","name":"public.user_profiles.user_profiles_segment_check"},{"k":"con","fp":"CHECK ((status = ANY (ARRAY[''active''::text, ''suspended''::text, ''deleted''::text])))","name":"public.user_profiles.user_profiles_status_check"},{"k":"con","fp":"CHECK (((target_v_level >= 0) AND (target_v_level <= 11)))","name":"public.user_profiles.user_profiles_target_v_level_check"},{"k":"con","fp":"FOREIGN KEY (target_v_level) REFERENCES vocaflow_levels(level) ON DELETE SET NULL","name":"public.user_profiles.user_profiles_target_v_level_fk"},{"k":"con","fp":"CHECK ((theme = ANY (ARRAY[''light''::text, ''dark''::text, ''system''::text])))","name":"public.user_profiles.user_profiles_theme_check"},{"k":"con","fp":"CHECK ((total_words_mastered >= 0))","name":"public.user_profiles.user_profiles_total_words_mastered_check"},{"k":"con","fp":"CHECK ((total_words_seen >= 0))","name":"public.user_profiles.user_profiles_total_words_seen_check"},{"k":"con","fp":"FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE","name":"public.user_profiles.user_profiles_user_id_fkey"},{"k":"con","fp":"CHECK ((length(canonical) <= 20000))","name":"public.workspace_content_demand.workspace_content_demand_canonical_check"},{"k":"con","fp":"CHECK ((signature = encode(sha256(convert_to(canonical, ''UTF8''::name)), ''hex''::text)))","name":"public.workspace_content_demand.workspace_content_demand_check"},{"k":"con","fp":"CHECK ((core_task ~ ''^[a-z]\\.[a-z_]{2,60}$''::text))","name":"public.workspace_content_demand.workspace_content_demand_core_task_check"},{"k":"con","fp":"CHECK (((length(definition_version) >= 1) AND (length(definition_version) <= 64)))","name":"public.workspace_content_demand.workspace_content_demand_definition_version_check"},{"k":"con","fp":"FOREIGN KEY (goal_version_id, user_id) REFERENCES csat_map_goal_version(id, user_id)","name":"public.workspace_content_demand.workspace_content_demand_goal_version_id_user_id_fkey"},{"k":"con","fp":"UNIQUE (id, user_id, workspace_id)","name":"public.workspace_content_demand.workspace_content_demand_id_user_id_workspace_id_key"},{"k":"con","fp":"PRIMARY KEY (id)","name":"public.workspace_content_demand.workspace_content_demand_pkey"},{"k":"con","fp":"CHECK ((signature ~ ''^[0-9a-f]{64}$''::text))","name":"public.workspace_content_demand.workspace_content_demand_signature_check"},{"k":"con","fp":"FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE","name":"public.workspace_content_demand.workspace_content_demand_user_id_fkey"},{"k":"con","fp":"UNIQUE (user_id, signature)","name":"public.workspace_content_demand.workspace_content_demand_user_id_signature_key"},{"k":"con","fp":"FOREIGN KEY (workspace_id, plan_version, user_id) REFERENCES learner_workspace_plan(workspace_id, plan_version, user_id)","name":"public.workspace_content_demand.workspace_content_demand_workspace_id_plan_version_user_id_fkey"},{"k":"con","fp":"FOREIGN KEY (workspace_id, user_id) REFERENCES learner_workspace(id, user_id) ON DELETE CASCADE","name":"public.workspace_content_demand.workspace_content_demand_workspace_id_user_id_fkey"},{"k":"con","fp":"UNIQUE (demand_id, line_no)","name":"public.workspace_content_demand_line.workspace_content_demand_line_demand_id_line_no_key"},{"k":"con","fp":"UNIQUE (demand_id, role, task_id)","name":"public.workspace_content_demand_line.workspace_content_demand_line_demand_id_role_task_id_key"},{"k":"con","fp":"FOREIGN KEY (demand_id, user_id, workspace_id) REFERENCES workspace_content_demand(id, user_id, workspace_id) ON DELETE CASCADE","name":"public.workspace_content_demand_line.workspace_content_demand_line_demand_id_user_id_workspace__fkey"},{"k":"con","fp":"UNIQUE (id, user_id, workspace_id, role, task_id)","name":"public.workspace_content_demand_line.workspace_content_demand_line_id_user_id_workspace_id_role__key"},{"k":"con","fp":"CHECK (((line_no >= 0) AND (line_no <= 99)))","name":"public.workspace_content_demand_line.workspace_content_demand_line_line_no_check"},{"k":"con","fp":"PRIMARY KEY (id)","name":"public.workspace_content_demand_line.workspace_content_demand_line_pkey"},{"k":"con","fp":"CHECK (((quantity >= 1) AND (quantity <= 50)))","name":"public.workspace_content_demand_line.workspace_content_demand_line_quantity_check"},{"k":"con","fp":"CHECK ((role = ANY (ARRAY[''source_analysis''::text, ''model_explanation''::text, ''guided_practice''::text, ''independent_check''::text, ''transfer''::text, ''delayed_check''::text])))","name":"public.workspace_content_demand_line.workspace_content_demand_line_role_check"},{"k":"con","fp":"CHECK ((task_id ~ ''^[a-z]\\.[a-z_]{2,60}$''::text))","name":"public.workspace_content_demand_line.workspace_content_demand_line_task_id_check"},{"k":"fn","fp":"ba47d9e52b7636eac0fd2a375b3ced19|{search_path=public}|{postgres=X/postgres,service_role=X/postgres}|false|v|f|postgres","name":"public.forbid_ledger_mutation()"},{"k":"pol","fp":"r|true|{16485}|(user_id = ( SELECT auth.uid() AS uid))|","name":"public.csat_map_goal_version.csat_map_goal_version_own_select"},{"k":"pol","fp":"r|true|{0}|((( SELECT auth.uid() AS uid) = user_id) OR is_admin_or_curator())|","name":"public.factory_order.fo_owner_read"},{"k":"pol","fp":"r|true|{16485}|(user_id = ( SELECT auth.uid() AS uid))|","name":"public.learner_workspace.learner_workspace_own_select"},{"k":"pol","fp":"r|true|{16485}|(user_id = ( SELECT auth.uid() AS uid))|","name":"public.learner_workspace_plan.learner_workspace_plan_own_select"},{"k":"pol","fp":"*|true|{0}|(( SELECT auth.uid() AS uid) = user_id)|(( SELECT auth.uid() AS uid) = user_id)","name":"public.user_profiles.own data"},{"k":"pol","fp":"r|true|{0}|is_admin()|","name":"public.user_profiles.profiles_admin_read"},{"k":"pol","fp":"r|true|{0}|((( SELECT auth.uid() AS uid) = user_id) OR is_admin_or_curator())|","name":"public.workspace_content_demand.wcd_owner_read"},{"k":"pol","fp":"r|true|{0}|((( SELECT auth.uid() AS uid) = user_id) OR is_admin_or_curator())|","name":"public.workspace_content_demand_line.wcdl_owner_read"},{"k":"rel","fp":"r|{postgres=arwdDxtm/postgres,service_role=rxtm/postgres,authenticated=r/postgres}|true|false||postgres||","name":"public.csat_map_goal_version"},{"k":"rel","fp":"r|{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}|true|false||postgres||","name":"public.factory_order"},{"k":"rel","fp":"r|{postgres=arwdDxtm/postgres,service_role=rwxtm/postgres,authenticated=r/postgres}|true|false||postgres||","name":"public.learner_workspace"},{"k":"rel","fp":"r|{postgres=arwdDxtm/postgres,service_role=rxtm/postgres,authenticated=r/postgres}|true|false||postgres||","name":"public.learner_workspace_plan"},{"k":"rel","fp":"r|{postgres=arwdDxtm/postgres,anon=rDxtm/postgres,authenticated=rDxtm/postgres,service_role=arwdDxtm/postgres}|true|false||postgres||","name":"public.user_profiles"},{"k":"rel","fp":"r|{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}|true|false||postgres||","name":"public.workspace_content_demand"},{"k":"rel","fp":"r|{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}|true|false||postgres||","name":"public.workspace_content_demand_line"},{"k":"trg","fp":"CREATE TRIGGER csat_map_goal_version_append_only BEFORE DELETE OR UPDATE ON public.csat_map_goal_version FOR EACH ROW EXECUTE FUNCTION map_v4_append_only()|O","name":"public.csat_map_goal_version.csat_map_goal_version_append_only"},{"k":"trg","fp":"CREATE TRIGGER factory_order_no_delete BEFORE DELETE ON public.factory_order FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation()|O","name":"public.factory_order.factory_order_no_delete"},{"k":"trg","fp":"CREATE TRIGGER factory_order_state_guard BEFORE UPDATE ON public.factory_order FOR EACH ROW EXECUTE FUNCTION factory_order_state_guard()|O","name":"public.factory_order.factory_order_state_guard"},{"k":"trg","fp":"CREATE TRIGGER factory_order_writer BEFORE INSERT ON public.factory_order FOR EACH ROW EXECUTE FUNCTION supply_writer_guard()|O","name":"public.factory_order.factory_order_writer"},{"k":"trg","fp":"CREATE TRIGGER learner_workspace_plan_append_only BEFORE DELETE OR UPDATE ON public.learner_workspace_plan FOR EACH ROW EXECUTE FUNCTION map_v4_append_only()|O","name":"public.learner_workspace_plan.learner_workspace_plan_append_only"},{"k":"trg","fp":"CREATE TRIGGER guard_user_profiles_privileged_columns BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION guard_user_profiles_privileged_columns()|O","name":"public.user_profiles.guard_user_profiles_privileged_columns"},{"k":"trg","fp":"CREATE TRIGGER trg_sync_cefr_from_v_level BEFORE UPDATE OF current_v_level ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION sync_cefr_from_v_level()|O","name":"public.user_profiles.trg_sync_cefr_from_v_level"},{"k":"trg","fp":"CREATE TRIGGER trg_user_profiles_updated BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at()|O","name":"public.user_profiles.trg_user_profiles_updated"},{"k":"trg","fp":"CREATE TRIGGER workspace_content_demand_no_update BEFORE DELETE OR UPDATE ON public.workspace_content_demand FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation()|O","name":"public.workspace_content_demand.workspace_content_demand_no_update"},{"k":"trg","fp":"CREATE TRIGGER workspace_content_demand_writer BEFORE INSERT ON public.workspace_content_demand FOR EACH ROW EXECUTE FUNCTION supply_writer_guard()|O","name":"public.workspace_content_demand.workspace_content_demand_writer"},{"k":"trg","fp":"CREATE TRIGGER workspace_content_demand_line_no_update BEFORE DELETE OR UPDATE ON public.workspace_content_demand_line FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation()|O","name":"public.workspace_content_demand_line.workspace_content_demand_line_no_update"},{"k":"trg","fp":"CREATE TRIGGER workspace_content_demand_line_writer BEFORE INSERT ON public.workspace_content_demand_line FOR EACH ROW EXECUTE FUNCTION supply_writer_guard()|O","name":"public.workspace_content_demand_line.workspace_content_demand_line_writer"}]'::jsonb then raise exception 'D3_BLOCKED: prerequisite fingerprint changed'; end if;
end $guard$;
create temporary table vf_d3_before on commit drop as select 'rel'::text k, n.nspname||'.'||c.relname name,
  c.relkind::text||'|'||coalesce(c.relacl::text,'')||'|'||c.relrowsecurity||'|'||c.relforcerowsecurity||'|'||coalesce(case when c.relkind = 'i' then pg_get_indexdef(c.oid) end,'')
  ||'|'||c.relowner::regrole::text||'|'||coalesce(c.reloptions::text,'')||'|'||coalesce(case when c.relkind in ('v','m') then md5(pg_get_viewdef(c.oid)) end,'') fp
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%' and c.relkind <> 't'
union all
select 'col', n.nspname||'.'||c.relname||'.'||a.attname,
  format_type(a.atttypid, a.atttypmod)||'|'||a.attnotnull||'|'||coalesce(pg_get_expr(d.adbin, d.adrelid),'')||'|'||coalesce(a.attacl::text,'')
  from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attnum > 0 and not a.attisdropped and c.relkind in ('r','p','v','m','f') and n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'typ', n.nspname||'.'||t.typname, t.typtype::text||'|'||t.typowner::regrole::text||'|'||coalesce(t.typacl::text,'')||'|'||format_type(t.typbasetype, t.typtypmod)||'|'||t.typnotnull
  ||'|'||coalesce((select string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid),'')
  ||'|'||coalesce((select string_agg(pg_get_constraintdef(o.oid), ',' order by o.conname) from pg_constraint o where o.contypid = t.oid),'')
  from pg_type t join pg_namespace n on n.oid = t.typnamespace
  where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%' and (t.typtype in ('e','d','r','m') or (t.typtype = 'c' and (select relkind from pg_class where oid = t.typrelid) = 'c'))
union all
select 'dacl', coalesce(d.defaclrole::regrole::text,'')||'.'||coalesce(d.defaclnamespace::regnamespace::text,'*')||'.'||d.defaclobjtype::text, coalesce(d.defaclacl::text,'') from pg_default_acl d
union all
select 'ext', x.extname, x.extversion||'|'||x.extnamespace::regnamespace::text||'|'||x.extowner::regrole::text from pg_extension x
union all
select 'evt', e.evtname, e.evtevent||'|'||e.evtfoid::regproc::text||'|'||e.evtenabled::text||'|'||coalesce(e.evttags::text,'') from pg_event_trigger e
union all
select 'cmt', 'all', coalesce(md5(string_agg(d.classoid::regclass::text||':'||d.objoid||':'||d.objsubid||'='||d.description, E'\n' order by d.classoid, d.objoid, d.objsubid)),'') from pg_description d
union all
select 'con', n.nspname||'.'||c.relname||'.'||o.conname, pg_get_constraintdef(o.oid)
  from pg_constraint o join pg_class c on c.oid = o.conrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'fn', n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
  md5(coalesce(p.prosrc,''))||'|'||coalesce(p.proconfig::text,'')||'|'||coalesce(p.proacl::text,'')||'|'||p.prosecdef||'|'||p.provolatile::text||'|'||p.prokind::text||'|'||p.proowner::regrole::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'pol', n.nspname||'.'||c.relname||'.'||p.polname,
  p.polcmd::text||'|'||p.polpermissive||'|'||p.polroles::text||'|'||coalesce(pg_get_expr(p.polqual, p.polrelid),'')||'|'||coalesce(pg_get_expr(p.polwithcheck, p.polrelid),'')
  from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'trg', n.nspname||'.'||c.relname||'.'||t.tgname, pg_get_triggerdef(t.oid)||'|'||t.tgenabled::text
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%' and not t.tgisinternal
union all
select 'nsp', n.nspname, coalesce(n.nspacl::text,'')||'|'||n.nspowner::regrole::text from pg_namespace n where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%';
-- >>> VF-D3 SOURCE
-- scripts/db/factory-i1/d3.sql
-- D3 v1: 검토·격리 검증용 정본. supabase/migrations 자동 적용 대상 밖. 공유 DB 적용은 별도 승인.
-- 기존 _pending_workspace_supply_i1_d3_lineage.sql 초안을 대체하며 함께 적용하지 않는다.
-- 계획 계보 ≠ 적합성/생산 실행/출시/개인 납품. 기존 B/C/D2 함수와 데이터는 변경하지 않는다.
-- service_role은 검증된 서버 게이트의 신뢰 주체다. 일반 admin JWT 직접 RPC 실행은 금지한다.

create function public.factory_lineage_canonical(v jsonb, depth integer default 0)
returns text language plpgsql immutable set search_path to 'public', 'pg_temp' as $$
declare result text; k text;
begin
  if depth > 24 then raise exception 'registry_profile_depth'; end if;
  case jsonb_typeof(v)
    when 'object' then
      for k in select jsonb_object_keys(v) loop
        if k !~ '^[A-Za-z_][A-Za-z0-9_.:-]*$' or k='__proto__' then raise exception 'registry_profile_ascii_key_required'; end if;
      end loop;
      select '{' || coalesce(string_agg(to_jsonb(key)::text || ':' || public.factory_lineage_canonical(value,depth+1), ',' order by key collate "C"),'') || '}' into result from jsonb_each(v);
      return result;
    when 'array' then
      select '[' || coalesce(string_agg(public.factory_lineage_canonical(value,depth+1),',' order by ord),'') || ']' into result from jsonb_array_elements(v) with ordinality a(value,ord);
      return result;
    when 'number' then
      if (v::text)::numeric <> trunc((v::text)::numeric) or abs((v::text)::numeric) > 9007199254740991 then raise exception 'registry_profile_integer_required'; end if;
      return trunc((v::text)::numeric)::text;
    else return v::text;
  end case;
end $$;

create function public.factory_lineage_actor(p_actor uuid, p_write boolean)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists(select 1 from public.user_profiles p where p.user_id=p_actor
    and (to_jsonb(p)->>'status') is distinct from 'suspended' and (to_jsonb(p)->>'status') is distinct from 'deleted'
    and case when p_write then p.role='admin' else p.role in ('admin','curator') end)
$$;

create function public.factory_lineage_spec(p_definition text,p_line jsonb)
returns jsonb language sql immutable set search_path to 'public', 'pg_temp' as $$
  select jsonb_build_object('schema','vf.factory-lineage-spec/1','definition',p_definition,'task',p_line->'task','role',p_line->'role',
    'types',(select coalesce(jsonb_agg(x order by x collate "C"),'[]') from (select distinct jsonb_array_elements_text(p_line->'types') x) a),
    'keys',(select coalesce(jsonb_agg(x order by x collate "C"),'[]') from (select distinct jsonb_array_elements_text(p_line->'keys') x) a),
    'requires',p_line->'requires')
$$;

create table public.factory_product_order (
  product_order_id text not null check(product_order_id ~ '^[A-Za-z0-9._:-]{1,200}$'),
  order_revision integer not null check(order_revision>0),
  order_hash text not null check(order_hash ~ '^[0-9a-f]{64}$'),
  canonical_order text not null check(octet_length(canonical_order)<=100000),
  spec jsonb not null,
  spec_hash text not null check(spec_hash ~ '^[0-9a-f]{64}$'),
  quantity integer not null check(quantity between 1 and 10000),
  unit text not null default 'item' check(unit='item'),
  validator text not null default 'factory-sealer@663f2eee8' check(validator='factory-sealer@663f2eee8'),
  reason text not null check(length(btrim(reason)) between 1 and 500),
  registered_by uuid not null references auth.users(id),
  request_key uuid not null unique,
  created_at timestamptz not null default now(),
  primary key(product_order_id,order_revision),
  unique(product_order_id,order_revision,order_hash),
  check(order_hash=encode(sha256(convert_to(canonical_order,'UTF8')),'hex')),
  check(canonical_order=public.factory_lineage_canonical(canonical_order::jsonb)),
  check((canonical_order::jsonb->>'schema')='textbook-product-order/1'),
  check((canonical_order::jsonb->>'product_order_id')=product_order_id),
  check((canonical_order::jsonb->>'order_revision')::integer=order_revision),
  check(spec_hash=encode(sha256(convert_to(public.factory_lineage_canonical(spec),'UTF8')),'hex')),
  check((spec->>'schema')='vf.factory-lineage-spec/1'),
  check((spec->>'role') in ('source_analysis','model_explanation','guided_practice','independent_check','transfer','delayed_check'))
);

create table public.factory_order_product_link (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.factory_order(id),
  product_order_id text not null,
  order_revision integer not null,
  order_hash text not null,
  demand_signature text not null check(demand_signature ~ '^[0-9a-f]{64}$'),
  snapshot jsonb not null,
  snapshot_hash text not null,
  quantity integer not null check(quantity between 1 and 50),
  reason text not null check(length(btrim(reason)) between 1 and 500),
  linked_by uuid not null references auth.users(id),
  request_key uuid not null unique,
  created_at timestamptz not null default now(),
  unique(order_id,product_order_id,order_revision),
  foreign key(product_order_id,order_revision,order_hash) references public.factory_product_order(product_order_id,order_revision,order_hash),
  check(snapshot_hash=encode(sha256(convert_to(public.factory_lineage_canonical(snapshot),'UTF8')),'hex'))
);

create table public.factory_product_order_withdrawal (
  id uuid primary key default gen_random_uuid(),
  product_order_id text not null,
  order_revision integer not null,
  order_hash text not null,
  reason text not null check(length(btrim(reason)) between 1 and 500),
  withdrawn_by uuid not null references auth.users(id),
  request_key uuid not null unique,
  created_at timestamptz not null default now(),
  unique(product_order_id,order_revision),
  foreign key(product_order_id,order_revision,order_hash) references public.factory_product_order(product_order_id,order_revision,order_hash)
);

create function public.factory_product_order_is_current(p_id text,p_revision integer)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists(select 1 from public.factory_product_order f where f.product_order_id=p_id and f.order_revision=p_revision
    and not exists(select 1 from public.factory_product_order n where n.product_order_id=p_id and n.order_revision>p_revision)
    and not exists(select 1 from public.factory_product_order_withdrawal w where w.product_order_id=p_id and w.order_revision=p_revision))
$$;

-- 성공한 자연키 재전송의 별칭 UUID도 보존한다. 모든 action에서 UUID 재사용을 함께 차단한다.
create table public.factory_lineage_request (
  request_key uuid primary key,
  action text not null check(action in ('register','link','withdraw')),
  actor uuid not null references auth.users(id),
  body jsonb not null,
  result text not null,
  created_at timestamptz not null default now()
);
create function public.factory_lineage_replay(p_request uuid,p_action text,p_actor uuid,p_body jsonb)
returns text language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare prev record;
begin
  if p_request is null then raise exception 'lineage: request required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('factory_lineage_request:'||p_request::text,0));
  select * into prev from public.factory_lineage_request where request_key=p_request;
  if found then
    if (prev.action,prev.actor,prev.body) is distinct from (p_action,p_actor,p_body) then raise exception 'lineage: different body' using errcode='23505'; end if;
    return prev.result;
  end if;
  return null;
end $$;

create function public.factory_lineage_snapshot(p_order uuid)
returns jsonb language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select jsonb_build_object('demand_id',d.id::text,'demand_signature',d.signature,'line_id',l.id::text,'line_no',l.line_no,
    'order_id',o.id::text,'order_seq',o.order_seq,'order_quantity',o.quantity,'order_state',o.state,
    'parent_order_id',o.parent_order_id::text,'order_reason',o.reason,'workspace_id',o.workspace_id::text,
    'goal_version',d.goal_version_id,'plan_version',d.plan_version,'definition',d.definition_version)
  from public.factory_order o join public.workspace_content_demand_line l on l.id=o.line_id
    join public.workspace_content_demand d on d.id=l.demand_id where o.id=p_order
$$;

create function public.factory_lineage_personal_current(p_order uuid)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists(select 1 from public.factory_order o join public.workspace_content_demand_line l on l.id=o.line_id
    join public.workspace_content_demand d on d.id=l.demand_id join public.learner_workspace w on w.id=o.workspace_id and w.user_id=o.user_id
    join lateral(select p.plan_version,p.goal_version_id from public.learner_workspace_plan p where p.workspace_id=w.id and p.user_id=w.user_id order by p.plan_version desc limit 1) p on true
    where o.id=p_order and w.status='active' and o.state not in ('delivered','partial','failed')
      and d.plan_version=p.plan_version and d.goal_version_id is not distinct from p.goal_version_id
      and d.goal_version_id is not distinct from (select max(g.id) from public.csat_map_goal_version g where g.user_id=o.user_id))
$$;

create function public.factory_product_order_register(p_actor uuid,p_canonical text,p_hash text,p_spec jsonb,p_quantity integer,p_reason text,p_request uuid)
returns text language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare b jsonb:=p_canonical::jsonb; pid text:=b->>'product_order_id'; rev integer:=(b->>'order_revision')::integer; prev record; mx integer; body jsonb; replay text;
begin
  if public.factory_lineage_actor(p_actor,true) is not true then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_request is null or p_canonical is null or p_spec is null or p_hash is null then raise exception 'registration: required body'; end if;
  body:=jsonb_build_array(p_canonical,p_hash,p_spec,p_quantity,p_reason);
  replay:=public.factory_lineage_replay(p_request,'register',p_actor,body);
  if replay is not null then return replay; end if;
  if (b->>'schema') is distinct from 'textbook-product-order/1' or b->>'sealed_at' is null or b->>'created_at' is null then raise exception 'registration: sealed order required'; end if;
  if p_spec is distinct from public.factory_lineage_spec(p_spec->>'definition',jsonb_build_object('task',p_spec->'task','role',p_spec->'role','types',p_spec->'types','keys',p_spec->'keys','requires',p_spec->'requires'))
    or p_spec->>'definition' is null or p_spec->>'task' is null or p_spec->'requires' is null then raise exception 'registration: invalid spec'; end if;
  perform pg_advisory_xact_lock(hashtextextended('factory_lineage:'||pid,0));
  select * into prev from public.factory_product_order where request_key=p_request or (product_order_id=pid and order_revision=rev) order by (request_key=p_request) desc limit 1;
  if found then
    if (prev.registered_by,prev.canonical_order,prev.order_hash,prev.spec,prev.quantity,prev.reason) is distinct from (p_actor,p_canonical,p_hash,p_spec,p_quantity,p_reason) then raise exception 'registration: different body' using errcode='23505'; end if;
    insert into public.factory_lineage_request(request_key,action,actor,body,result) values(p_request,'register',p_actor,body,prev.product_order_id);
    return prev.product_order_id;
  end if;
  select max(order_revision) into mx from public.factory_product_order where product_order_id=pid;
  if rev is distinct from coalesce(mx,0)+1 then raise exception 'registration: next revision required'; end if;
  if mx is not null and exists(select 1 from public.factory_product_order where product_order_id=pid and (spec->>'task',spec->>'role') is distinct from (p_spec->>'task',p_spec->>'role')) then raise exception 'registration: task/role immutable'; end if;
  insert into public.factory_product_order(product_order_id,order_revision,order_hash,canonical_order,spec,spec_hash,quantity,reason,registered_by,request_key)
  values(pid,rev,p_hash,p_canonical,p_spec,encode(sha256(convert_to(public.factory_lineage_canonical(p_spec),'UTF8')),'hex'),p_quantity,p_reason,p_actor,p_request);
  insert into public.factory_lineage_request(request_key,action,actor,body,result) values(p_request,'register',p_actor,body,pid);
  return pid;
end $$;

create function public.factory_order_link_product(p_actor uuid,p_order uuid,p_id text,p_revision integer,p_hash text,p_signature text,p_quantity integer,p_reason text,p_request uuid)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare o record; f record; d record; l record; prev record; spec jsonb; snap jsonb; assigned integer; result uuid; body jsonb; replay text;
begin
  if public.factory_lineage_actor(p_actor,true) is not true then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_request is null or p_order is null or p_id is null or p_hash is null or p_signature is null then raise exception 'link: required body'; end if;
  body:=jsonb_build_array(p_order,p_id,p_revision,p_hash,p_signature,p_quantity,p_reason);
  replay:=public.factory_lineage_replay(p_request,'link',p_actor,body);
  if replay is not null then return replay::uuid; end if;
  -- 모든 링크는 order 행을 먼저 잠근다. 등록/철회는 product 잠금만 사용하므로 역방향 잠금 없음.
  select * into o from public.factory_order where id=p_order for update;
  if not found then raise exception 'link: order not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('factory_lineage:'||p_id,0));
  select * into prev from public.factory_order_product_link where request_key=p_request or (order_id=p_order and product_order_id=p_id and order_revision=p_revision) order by (request_key=p_request) desc limit 1;
  if found then
    if (prev.linked_by,prev.order_id,prev.product_order_id,prev.order_revision,prev.order_hash,prev.demand_signature,prev.quantity,prev.reason)
      is distinct from (p_actor,p_order,p_id,p_revision,p_hash,p_signature,p_quantity,p_reason) then raise exception 'link: different body' using errcode='23505'; end if;
    insert into public.factory_lineage_request(request_key,action,actor,body,result) values(p_request,'link',p_actor,body,prev.id::text);
    return prev.id; -- 과거 사실만 반환. 현재성은 reader에서 매번 별도 판정.
  end if;
  if public.factory_lineage_personal_current(p_order) is not true then raise exception 'link: personal order not current'; end if;
  select * into l from public.workspace_content_demand_line where id=o.line_id;
  select * into d from public.workspace_content_demand where id=l.demand_id;
  if d.signature is distinct from p_signature then raise exception 'link: demand signature mismatch'; end if;
  spec:=public.factory_lineage_spec(d.definition_version,d.canonical::jsonb->'lines'->l.line_no);
  select * into f from public.factory_product_order where product_order_id=p_id and order_revision=p_revision;
  if not found then raise exception 'link: product not registered'; end if;
  if f.order_hash is distinct from p_hash then raise exception 'link: order hash mismatch'; end if;
  if public.factory_product_order_is_current(p_id,p_revision) is not true then raise exception 'link: product not current'; end if;
  if f.spec is distinct from spec or (f.spec->>'task',f.spec->>'role') is distinct from (o.task_id,o.role) then raise exception 'link: spec mismatch'; end if;
  select coalesce(sum(x.quantity),0) into assigned from public.factory_order_product_link x
    where x.order_id=p_order and public.factory_product_order_is_current(x.product_order_id,x.order_revision);
  if p_quantity is null or p_quantity<1 or p_quantity>f.quantity or assigned+p_quantity>o.quantity then raise exception 'link: coverage quantity exceeded'; end if;
  snap:=public.factory_lineage_snapshot(p_order);
  insert into public.factory_order_product_link(order_id,product_order_id,order_revision,order_hash,demand_signature,snapshot,snapshot_hash,quantity,reason,linked_by,request_key)
  values(p_order,p_id,p_revision,p_hash,p_signature,snap,encode(sha256(convert_to(public.factory_lineage_canonical(snap),'UTF8')),'hex'),p_quantity,p_reason,p_actor,p_request) returning id into result;
  insert into public.factory_lineage_request(request_key,action,actor,body,result) values(p_request,'link',p_actor,body,result::text);
  return result;
end $$;

create function public.factory_product_order_withdraw(p_actor uuid,p_id text,p_revision integer,p_hash text,p_reason text,p_request uuid)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare prev record; result uuid; body jsonb; replay text;
begin
  if public.factory_lineage_actor(p_actor,true) is not true then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_request is null or p_id is null or p_revision is null or p_hash is null then raise exception 'withdraw: required body'; end if;
  body:=jsonb_build_array(p_id,p_revision,p_hash,p_reason);
  replay:=public.factory_lineage_replay(p_request,'withdraw',p_actor,body);
  if replay is not null then return replay::uuid; end if;
  perform pg_advisory_xact_lock(hashtextextended('factory_lineage:'||p_id,0));
  select * into prev from public.factory_product_order_withdrawal where request_key=p_request or (product_order_id=p_id and order_revision=p_revision) order by (request_key=p_request) desc limit 1;
  if found then
    if (prev.withdrawn_by,prev.product_order_id,prev.order_revision,prev.order_hash,prev.reason) is distinct from (p_actor,p_id,p_revision,p_hash,p_reason) then raise exception 'withdraw: different body' using errcode='23505'; end if;
    insert into public.factory_lineage_request(request_key,action,actor,body,result) values(p_request,'withdraw',p_actor,body,prev.id::text);
    return prev.id;
  end if;
  insert into public.factory_product_order_withdrawal(product_order_id,order_revision,order_hash,reason,withdrawn_by,request_key)
  values(p_id,p_revision,p_hash,p_reason,p_actor,p_request) returning id into result;
  insert into public.factory_lineage_request(request_key,action,actor,body,result) values(p_request,'withdraw',p_actor,body,result::text);
  return result;
end $$;

create function public.factory_lineage_read(p_actor uuid,p_user uuid,p_workspace uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare result jsonb; total integer;
begin
  if public.factory_lineage_actor(p_actor,false) is not true then raise exception 'Forbidden' using errcode='42501'; end if;
  if not exists(select 1 from public.learner_workspace where id=p_workspace and user_id=p_user) then raise exception 'lineage: workspace not owned'; end if;
  select count(*) into total from public.factory_order_product_link l join public.factory_order o on o.id=l.order_id where o.workspace_id=p_workspace and o.user_id=p_user;
  select coalesce(jsonb_agg(row),'[]') into result from (
    select l.id,l.order_id,l.product_order_id,l.order_revision,l.order_hash,l.quantity,l.created_at,
      f.quantity as product_quantity,
      public.factory_product_order_is_current(l.product_order_id,l.order_revision) as product_current,
      public.factory_lineage_personal_current(l.order_id) as personal_current,
      case when exists(select 1 from public.factory_product_order_withdrawal w where w.product_order_id=l.product_order_id and w.order_revision=l.order_revision) then 'withdrawn'
        when not public.factory_product_order_is_current(l.product_order_id,l.order_revision) then 'superseded'
        when not public.factory_lineage_personal_current(l.order_id) then 'personal_order_changed' else 'current' end as status
    from public.factory_order_product_link l join public.factory_order o on o.id=l.order_id
      join public.factory_product_order f using(product_order_id,order_revision,order_hash)
    where o.workspace_id=p_workspace and o.user_id=p_user order by l.created_at desc,l.id limit 100
  ) row;
  return jsonb_build_object('rows',result,'total',total,'limited',total>100);
end $$;

-- 명시적 ACL. default privilege ALL 및 service_role BYPASSRLS에 기대지 않는다.
do $$ declare t text; f record; begin
  foreach t in array array['factory_product_order','factory_order_product_link','factory_product_order_withdrawal','factory_lineage_request'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy lineage_admin_read on public.%I for select to authenticated using (public.factory_lineage_actor(auth.uid(),false))',t);
    execute format('create trigger lineage_append_only before update or delete on public.%I for each row execute function public.forbid_ledger_mutation()',t);
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('factory_lineage_canonical','factory_lineage_actor','factory_lineage_spec','factory_lineage_snapshot','factory_lineage_personal_current','factory_lineage_replay','factory_product_order_is_current','factory_product_order_register','factory_order_link_product','factory_product_order_withdraw','factory_lineage_read') loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
  end loop;
end $$;
grant execute on function public.factory_lineage_actor(uuid,boolean) to authenticated;
grant execute on function public.factory_product_order_register(uuid,text,text,jsonb,integer,text,uuid),
  public.factory_order_link_product(uuid,uuid,text,integer,text,text,integer,text,uuid),
  public.factory_product_order_withdraw(uuid,text,integer,text,text,uuid),
  public.factory_lineage_read(uuid,uuid,uuid) to service_role;
-- <<< VF-D3 SOURCE
do $guard$ declare actual jsonb; begin
  select to_jsonb(x) into actual from (with a as (select 'rel'::text k, n.nspname||'.'||c.relname name,
  c.relkind::text||'|'||coalesce(c.relacl::text,'')||'|'||c.relrowsecurity||'|'||c.relforcerowsecurity||'|'||coalesce(case when c.relkind = 'i' then pg_get_indexdef(c.oid) end,'')
  ||'|'||c.relowner::regrole::text||'|'||coalesce(c.reloptions::text,'')||'|'||coalesce(case when c.relkind in ('v','m') then md5(pg_get_viewdef(c.oid)) end,'') fp
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%' and c.relkind <> 't'
union all
select 'col', n.nspname||'.'||c.relname||'.'||a.attname,
  format_type(a.atttypid, a.atttypmod)||'|'||a.attnotnull||'|'||coalesce(pg_get_expr(d.adbin, d.adrelid),'')||'|'||coalesce(a.attacl::text,'')
  from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attnum > 0 and not a.attisdropped and c.relkind in ('r','p','v','m','f') and n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'typ', n.nspname||'.'||t.typname, t.typtype::text||'|'||t.typowner::regrole::text||'|'||coalesce(t.typacl::text,'')||'|'||format_type(t.typbasetype, t.typtypmod)||'|'||t.typnotnull
  ||'|'||coalesce((select string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid),'')
  ||'|'||coalesce((select string_agg(pg_get_constraintdef(o.oid), ',' order by o.conname) from pg_constraint o where o.contypid = t.oid),'')
  from pg_type t join pg_namespace n on n.oid = t.typnamespace
  where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%' and (t.typtype in ('e','d','r','m') or (t.typtype = 'c' and (select relkind from pg_class where oid = t.typrelid) = 'c'))
union all
select 'dacl', coalesce(d.defaclrole::regrole::text,'')||'.'||coalesce(d.defaclnamespace::regnamespace::text,'*')||'.'||d.defaclobjtype::text, coalesce(d.defaclacl::text,'') from pg_default_acl d
union all
select 'ext', x.extname, x.extversion||'|'||x.extnamespace::regnamespace::text||'|'||x.extowner::regrole::text from pg_extension x
union all
select 'evt', e.evtname, e.evtevent||'|'||e.evtfoid::regproc::text||'|'||e.evtenabled::text||'|'||coalesce(e.evttags::text,'') from pg_event_trigger e
union all
select 'cmt', 'all', coalesce(md5(string_agg(d.classoid::regclass::text||':'||d.objoid||':'||d.objsubid||'='||d.description, E'\n' order by d.classoid, d.objoid, d.objsubid)),'') from pg_description d
union all
select 'con', n.nspname||'.'||c.relname||'.'||o.conname, pg_get_constraintdef(o.oid)
  from pg_constraint o join pg_class c on c.oid = o.conrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'fn', n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
  md5(coalesce(p.prosrc,''))||'|'||coalesce(p.proconfig::text,'')||'|'||coalesce(p.proacl::text,'')||'|'||p.prosecdef||'|'||p.provolatile::text||'|'||p.prokind::text||'|'||p.proowner::regrole::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'pol', n.nspname||'.'||c.relname||'.'||p.polname,
  p.polcmd::text||'|'||p.polpermissive||'|'||p.polroles::text||'|'||coalesce(pg_get_expr(p.polqual, p.polrelid),'')||'|'||coalesce(pg_get_expr(p.polwithcheck, p.polrelid),'')
  from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'trg', n.nspname||'.'||c.relname||'.'||t.tgname, pg_get_triggerdef(t.oid)||'|'||t.tgenabled::text
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%' and not t.tgisinternal
union all
select 'nsp', n.nspname, coalesce(n.nspacl::text,'')||'|'||n.nspowner::regrole::text from pg_namespace n where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'),
 b as (select * from vf_d3_before),
 added_rel as (select a.name from a where a.k = 'rel' and not exists (select 1 from b where b.k = a.k and b.name = a.name))
select
 coalesce((select array_agg(a.k||':'||a.name order by a.k||':'||a.name) from a
   where not exists (select 1 from b where b.k = a.k and b.name = a.name)
     and not (a.k = 'col' and split_part(a.name,'.',1)||'.'||split_part(a.name,'.',2) in (select name from added_rel))), '{}') added,
 coalesce((select array_agg(b.k||':'||b.name order by b.k||':'||b.name) from b
   where not exists (select 1 from a where a.k = b.k and a.name = b.name)), '{}') removed,
 coalesce((select array_agg(a.k||':'||a.name order by a.k||':'||a.name) from a join b on b.k = a.k and b.name = a.name
   where a.fp is distinct from b.fp), '{}') changed) x;
  if actual is distinct from '{"added":["con:public.factory_lineage_request.factory_lineage_request_action_check","con:public.factory_lineage_request.factory_lineage_request_actor_fkey","con:public.factory_lineage_request.factory_lineage_request_pkey","con:public.factory_order_product_link.factory_order_product_link_check","con:public.factory_order_product_link.factory_order_product_link_demand_signature_check","con:public.factory_order_product_link.factory_order_product_link_linked_by_fkey","con:public.factory_order_product_link.factory_order_product_link_order_id_fkey","con:public.factory_order_product_link.factory_order_product_link_order_id_product_order_id_order__key","con:public.factory_order_product_link.factory_order_product_link_pkey","con:public.factory_order_product_link.factory_order_product_link_product_order_id_order_revision_fkey","con:public.factory_order_product_link.factory_order_product_link_quantity_check","con:public.factory_order_product_link.factory_order_product_link_reason_check","con:public.factory_order_product_link.factory_order_product_link_request_key_key","con:public.factory_product_order.factory_product_order_canonical_order_check","con:public.factory_product_order.factory_product_order_canonical_order_check1","con:public.factory_product_order.factory_product_order_canonical_order_check2","con:public.factory_product_order.factory_product_order_check","con:public.factory_product_order.factory_product_order_check1","con:public.factory_product_order.factory_product_order_check2","con:public.factory_product_order.factory_product_order_check3","con:public.factory_product_order.factory_product_order_order_hash_check","con:public.factory_product_order.factory_product_order_order_revision_check","con:public.factory_product_order.factory_product_order_pkey","con:public.factory_product_order.factory_product_order_product_order_id_check","con:public.factory_product_order.factory_product_order_product_order_id_order_revision_order_key","con:public.factory_product_order.factory_product_order_quantity_check","con:public.factory_product_order.factory_product_order_reason_check","con:public.factory_product_order.factory_product_order_registered_by_fkey","con:public.factory_product_order.factory_product_order_request_key_key","con:public.factory_product_order.factory_product_order_spec_check","con:public.factory_product_order.factory_product_order_spec_check1","con:public.factory_product_order.factory_product_order_spec_hash_check","con:public.factory_product_order.factory_product_order_unit_check","con:public.factory_product_order.factory_product_order_validator_check","con:public.factory_product_order_withdrawal.factory_product_order_withdra_product_order_id_order_revis_fkey","con:public.factory_product_order_withdrawal.factory_product_order_withdra_product_order_id_order_revisi_key","con:public.factory_product_order_withdrawal.factory_product_order_withdrawal_pkey","con:public.factory_product_order_withdrawal.factory_product_order_withdrawal_reason_check","con:public.factory_product_order_withdrawal.factory_product_order_withdrawal_request_key_key","con:public.factory_product_order_withdrawal.factory_product_order_withdrawal_withdrawn_by_fkey","fn:public.factory_lineage_actor(p_actor uuid, p_write boolean)","fn:public.factory_lineage_canonical(v jsonb, depth integer)","fn:public.factory_lineage_personal_current(p_order uuid)","fn:public.factory_lineage_read(p_actor uuid, p_user uuid, p_workspace uuid)","fn:public.factory_lineage_replay(p_request uuid, p_action text, p_actor uuid, p_body jsonb)","fn:public.factory_lineage_snapshot(p_order uuid)","fn:public.factory_lineage_spec(p_definition text, p_line jsonb)","fn:public.factory_order_link_product(p_actor uuid, p_order uuid, p_id text, p_revision integer, p_hash text, p_signature text, p_quantity integer, p_reason text, p_request uuid)","fn:public.factory_product_order_is_current(p_id text, p_revision integer)","fn:public.factory_product_order_register(p_actor uuid, p_canonical text, p_hash text, p_spec jsonb, p_quantity integer, p_reason text, p_request uuid)","fn:public.factory_product_order_withdraw(p_actor uuid, p_id text, p_revision integer, p_hash text, p_reason text, p_request uuid)","pol:public.factory_lineage_request.lineage_admin_read","pol:public.factory_order_product_link.lineage_admin_read","pol:public.factory_product_order.lineage_admin_read","pol:public.factory_product_order_withdrawal.lineage_admin_read","rel:public.factory_lineage_request","rel:public.factory_lineage_request_pkey","rel:public.factory_order_product_link","rel:public.factory_order_product_link_order_id_product_order_id_order__key","rel:public.factory_order_product_link_pkey","rel:public.factory_order_product_link_request_key_key","rel:public.factory_product_order","rel:public.factory_product_order_pkey","rel:public.factory_product_order_product_order_id_order_revision_order_key","rel:public.factory_product_order_request_key_key","rel:public.factory_product_order_withdra_product_order_id_order_revisi_key","rel:public.factory_product_order_withdrawal","rel:public.factory_product_order_withdrawal_pkey","rel:public.factory_product_order_withdrawal_request_key_key","trg:public.factory_lineage_request.lineage_append_only","trg:public.factory_order_product_link.lineage_append_only","trg:public.factory_product_order.lineage_append_only","trg:public.factory_product_order_withdrawal.lineage_append_only"],"removed":[],"changed":[]}'::jsonb then raise exception 'D3_BLOCKED: catalog diff outside measured allowlist: %',actual; end if;
end $guard$;
insert into supabase_migrations.schema_migrations(version,name,statements)
values('20261020063000','factory_product_order_lineage_v1',array[$vf_d3_source$-- scripts/db/factory-i1/d3.sql
-- D3 v1: 검토·격리 검증용 정본. supabase/migrations 자동 적용 대상 밖. 공유 DB 적용은 별도 승인.
-- 기존 _pending_workspace_supply_i1_d3_lineage.sql 초안을 대체하며 함께 적용하지 않는다.
-- 계획 계보 ≠ 적합성/생산 실행/출시/개인 납품. 기존 B/C/D2 함수와 데이터는 변경하지 않는다.
-- service_role은 검증된 서버 게이트의 신뢰 주체다. 일반 admin JWT 직접 RPC 실행은 금지한다.

create function public.factory_lineage_canonical(v jsonb, depth integer default 0)
returns text language plpgsql immutable set search_path to 'public', 'pg_temp' as $$
declare result text; k text;
begin
  if depth > 24 then raise exception 'registry_profile_depth'; end if;
  case jsonb_typeof(v)
    when 'object' then
      for k in select jsonb_object_keys(v) loop
        if k !~ '^[A-Za-z_][A-Za-z0-9_.:-]*$' or k='__proto__' then raise exception 'registry_profile_ascii_key_required'; end if;
      end loop;
      select '{' || coalesce(string_agg(to_jsonb(key)::text || ':' || public.factory_lineage_canonical(value,depth+1), ',' order by key collate "C"),'') || '}' into result from jsonb_each(v);
      return result;
    when 'array' then
      select '[' || coalesce(string_agg(public.factory_lineage_canonical(value,depth+1),',' order by ord),'') || ']' into result from jsonb_array_elements(v) with ordinality a(value,ord);
      return result;
    when 'number' then
      if (v::text)::numeric <> trunc((v::text)::numeric) or abs((v::text)::numeric) > 9007199254740991 then raise exception 'registry_profile_integer_required'; end if;
      return trunc((v::text)::numeric)::text;
    else return v::text;
  end case;
end $$;

create function public.factory_lineage_actor(p_actor uuid, p_write boolean)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists(select 1 from public.user_profiles p where p.user_id=p_actor
    and (to_jsonb(p)->>'status') is distinct from 'suspended' and (to_jsonb(p)->>'status') is distinct from 'deleted'
    and case when p_write then p.role='admin' else p.role in ('admin','curator') end)
$$;

create function public.factory_lineage_spec(p_definition text,p_line jsonb)
returns jsonb language sql immutable set search_path to 'public', 'pg_temp' as $$
  select jsonb_build_object('schema','vf.factory-lineage-spec/1','definition',p_definition,'task',p_line->'task','role',p_line->'role',
    'types',(select coalesce(jsonb_agg(x order by x collate "C"),'[]') from (select distinct jsonb_array_elements_text(p_line->'types') x) a),
    'keys',(select coalesce(jsonb_agg(x order by x collate "C"),'[]') from (select distinct jsonb_array_elements_text(p_line->'keys') x) a),
    'requires',p_line->'requires')
$$;

create table public.factory_product_order (
  product_order_id text not null check(product_order_id ~ '^[A-Za-z0-9._:-]{1,200}$'),
  order_revision integer not null check(order_revision>0),
  order_hash text not null check(order_hash ~ '^[0-9a-f]{64}$'),
  canonical_order text not null check(octet_length(canonical_order)<=100000),
  spec jsonb not null,
  spec_hash text not null check(spec_hash ~ '^[0-9a-f]{64}$'),
  quantity integer not null check(quantity between 1 and 10000),
  unit text not null default 'item' check(unit='item'),
  validator text not null default 'factory-sealer@663f2eee8' check(validator='factory-sealer@663f2eee8'),
  reason text not null check(length(btrim(reason)) between 1 and 500),
  registered_by uuid not null references auth.users(id),
  request_key uuid not null unique,
  created_at timestamptz not null default now(),
  primary key(product_order_id,order_revision),
  unique(product_order_id,order_revision,order_hash),
  check(order_hash=encode(sha256(convert_to(canonical_order,'UTF8')),'hex')),
  check(canonical_order=public.factory_lineage_canonical(canonical_order::jsonb)),
  check((canonical_order::jsonb->>'schema')='textbook-product-order/1'),
  check((canonical_order::jsonb->>'product_order_id')=product_order_id),
  check((canonical_order::jsonb->>'order_revision')::integer=order_revision),
  check(spec_hash=encode(sha256(convert_to(public.factory_lineage_canonical(spec),'UTF8')),'hex')),
  check((spec->>'schema')='vf.factory-lineage-spec/1'),
  check((spec->>'role') in ('source_analysis','model_explanation','guided_practice','independent_check','transfer','delayed_check'))
);

create table public.factory_order_product_link (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.factory_order(id),
  product_order_id text not null,
  order_revision integer not null,
  order_hash text not null,
  demand_signature text not null check(demand_signature ~ '^[0-9a-f]{64}$'),
  snapshot jsonb not null,
  snapshot_hash text not null,
  quantity integer not null check(quantity between 1 and 50),
  reason text not null check(length(btrim(reason)) between 1 and 500),
  linked_by uuid not null references auth.users(id),
  request_key uuid not null unique,
  created_at timestamptz not null default now(),
  unique(order_id,product_order_id,order_revision),
  foreign key(product_order_id,order_revision,order_hash) references public.factory_product_order(product_order_id,order_revision,order_hash),
  check(snapshot_hash=encode(sha256(convert_to(public.factory_lineage_canonical(snapshot),'UTF8')),'hex'))
);

create table public.factory_product_order_withdrawal (
  id uuid primary key default gen_random_uuid(),
  product_order_id text not null,
  order_revision integer not null,
  order_hash text not null,
  reason text not null check(length(btrim(reason)) between 1 and 500),
  withdrawn_by uuid not null references auth.users(id),
  request_key uuid not null unique,
  created_at timestamptz not null default now(),
  unique(product_order_id,order_revision),
  foreign key(product_order_id,order_revision,order_hash) references public.factory_product_order(product_order_id,order_revision,order_hash)
);

create function public.factory_product_order_is_current(p_id text,p_revision integer)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists(select 1 from public.factory_product_order f where f.product_order_id=p_id and f.order_revision=p_revision
    and not exists(select 1 from public.factory_product_order n where n.product_order_id=p_id and n.order_revision>p_revision)
    and not exists(select 1 from public.factory_product_order_withdrawal w where w.product_order_id=p_id and w.order_revision=p_revision))
$$;

-- 성공한 자연키 재전송의 별칭 UUID도 보존한다. 모든 action에서 UUID 재사용을 함께 차단한다.
create table public.factory_lineage_request (
  request_key uuid primary key,
  action text not null check(action in ('register','link','withdraw')),
  actor uuid not null references auth.users(id),
  body jsonb not null,
  result text not null,
  created_at timestamptz not null default now()
);
create function public.factory_lineage_replay(p_request uuid,p_action text,p_actor uuid,p_body jsonb)
returns text language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare prev record;
begin
  if p_request is null then raise exception 'lineage: request required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('factory_lineage_request:'||p_request::text,0));
  select * into prev from public.factory_lineage_request where request_key=p_request;
  if found then
    if (prev.action,prev.actor,prev.body) is distinct from (p_action,p_actor,p_body) then raise exception 'lineage: different body' using errcode='23505'; end if;
    return prev.result;
  end if;
  return null;
end $$;

create function public.factory_lineage_snapshot(p_order uuid)
returns jsonb language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select jsonb_build_object('demand_id',d.id::text,'demand_signature',d.signature,'line_id',l.id::text,'line_no',l.line_no,
    'order_id',o.id::text,'order_seq',o.order_seq,'order_quantity',o.quantity,'order_state',o.state,
    'parent_order_id',o.parent_order_id::text,'order_reason',o.reason,'workspace_id',o.workspace_id::text,
    'goal_version',d.goal_version_id,'plan_version',d.plan_version,'definition',d.definition_version)
  from public.factory_order o join public.workspace_content_demand_line l on l.id=o.line_id
    join public.workspace_content_demand d on d.id=l.demand_id where o.id=p_order
$$;

create function public.factory_lineage_personal_current(p_order uuid)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists(select 1 from public.factory_order o join public.workspace_content_demand_line l on l.id=o.line_id
    join public.workspace_content_demand d on d.id=l.demand_id join public.learner_workspace w on w.id=o.workspace_id and w.user_id=o.user_id
    join lateral(select p.plan_version,p.goal_version_id from public.learner_workspace_plan p where p.workspace_id=w.id and p.user_id=w.user_id order by p.plan_version desc limit 1) p on true
    where o.id=p_order and w.status='active' and o.state not in ('delivered','partial','failed')
      and d.plan_version=p.plan_version and d.goal_version_id is not distinct from p.goal_version_id
      and d.goal_version_id is not distinct from (select max(g.id) from public.csat_map_goal_version g where g.user_id=o.user_id))
$$;

create function public.factory_product_order_register(p_actor uuid,p_canonical text,p_hash text,p_spec jsonb,p_quantity integer,p_reason text,p_request uuid)
returns text language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare b jsonb:=p_canonical::jsonb; pid text:=b->>'product_order_id'; rev integer:=(b->>'order_revision')::integer; prev record; mx integer; body jsonb; replay text;
begin
  if public.factory_lineage_actor(p_actor,true) is not true then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_request is null or p_canonical is null or p_spec is null or p_hash is null then raise exception 'registration: required body'; end if;
  body:=jsonb_build_array(p_canonical,p_hash,p_spec,p_quantity,p_reason);
  replay:=public.factory_lineage_replay(p_request,'register',p_actor,body);
  if replay is not null then return replay; end if;
  if (b->>'schema') is distinct from 'textbook-product-order/1' or b->>'sealed_at' is null or b->>'created_at' is null then raise exception 'registration: sealed order required'; end if;
  if p_spec is distinct from public.factory_lineage_spec(p_spec->>'definition',jsonb_build_object('task',p_spec->'task','role',p_spec->'role','types',p_spec->'types','keys',p_spec->'keys','requires',p_spec->'requires'))
    or p_spec->>'definition' is null or p_spec->>'task' is null or p_spec->'requires' is null then raise exception 'registration: invalid spec'; end if;
  perform pg_advisory_xact_lock(hashtextextended('factory_lineage:'||pid,0));
  select * into prev from public.factory_product_order where request_key=p_request or (product_order_id=pid and order_revision=rev) order by (request_key=p_request) desc limit 1;
  if found then
    if (prev.registered_by,prev.canonical_order,prev.order_hash,prev.spec,prev.quantity,prev.reason) is distinct from (p_actor,p_canonical,p_hash,p_spec,p_quantity,p_reason) then raise exception 'registration: different body' using errcode='23505'; end if;
    insert into public.factory_lineage_request(request_key,action,actor,body,result) values(p_request,'register',p_actor,body,prev.product_order_id);
    return prev.product_order_id;
  end if;
  select max(order_revision) into mx from public.factory_product_order where product_order_id=pid;
  if rev is distinct from coalesce(mx,0)+1 then raise exception 'registration: next revision required'; end if;
  if mx is not null and exists(select 1 from public.factory_product_order where product_order_id=pid and (spec->>'task',spec->>'role') is distinct from (p_spec->>'task',p_spec->>'role')) then raise exception 'registration: task/role immutable'; end if;
  insert into public.factory_product_order(product_order_id,order_revision,order_hash,canonical_order,spec,spec_hash,quantity,reason,registered_by,request_key)
  values(pid,rev,p_hash,p_canonical,p_spec,encode(sha256(convert_to(public.factory_lineage_canonical(p_spec),'UTF8')),'hex'),p_quantity,p_reason,p_actor,p_request);
  insert into public.factory_lineage_request(request_key,action,actor,body,result) values(p_request,'register',p_actor,body,pid);
  return pid;
end $$;

create function public.factory_order_link_product(p_actor uuid,p_order uuid,p_id text,p_revision integer,p_hash text,p_signature text,p_quantity integer,p_reason text,p_request uuid)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare o record; f record; d record; l record; prev record; spec jsonb; snap jsonb; assigned integer; result uuid; body jsonb; replay text;
begin
  if public.factory_lineage_actor(p_actor,true) is not true then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_request is null or p_order is null or p_id is null or p_hash is null or p_signature is null then raise exception 'link: required body'; end if;
  body:=jsonb_build_array(p_order,p_id,p_revision,p_hash,p_signature,p_quantity,p_reason);
  replay:=public.factory_lineage_replay(p_request,'link',p_actor,body);
  if replay is not null then return replay::uuid; end if;
  -- 모든 링크는 order 행을 먼저 잠근다. 등록/철회는 product 잠금만 사용하므로 역방향 잠금 없음.
  select * into o from public.factory_order where id=p_order for update;
  if not found then raise exception 'link: order not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('factory_lineage:'||p_id,0));
  select * into prev from public.factory_order_product_link where request_key=p_request or (order_id=p_order and product_order_id=p_id and order_revision=p_revision) order by (request_key=p_request) desc limit 1;
  if found then
    if (prev.linked_by,prev.order_id,prev.product_order_id,prev.order_revision,prev.order_hash,prev.demand_signature,prev.quantity,prev.reason)
      is distinct from (p_actor,p_order,p_id,p_revision,p_hash,p_signature,p_quantity,p_reason) then raise exception 'link: different body' using errcode='23505'; end if;
    insert into public.factory_lineage_request(request_key,action,actor,body,result) values(p_request,'link',p_actor,body,prev.id::text);
    return prev.id; -- 과거 사실만 반환. 현재성은 reader에서 매번 별도 판정.
  end if;
  if public.factory_lineage_personal_current(p_order) is not true then raise exception 'link: personal order not current'; end if;
  select * into l from public.workspace_content_demand_line where id=o.line_id;
  select * into d from public.workspace_content_demand where id=l.demand_id;
  if d.signature is distinct from p_signature then raise exception 'link: demand signature mismatch'; end if;
  spec:=public.factory_lineage_spec(d.definition_version,d.canonical::jsonb->'lines'->l.line_no);
  select * into f from public.factory_product_order where product_order_id=p_id and order_revision=p_revision;
  if not found then raise exception 'link: product not registered'; end if;
  if f.order_hash is distinct from p_hash then raise exception 'link: order hash mismatch'; end if;
  if public.factory_product_order_is_current(p_id,p_revision) is not true then raise exception 'link: product not current'; end if;
  if f.spec is distinct from spec or (f.spec->>'task',f.spec->>'role') is distinct from (o.task_id,o.role) then raise exception 'link: spec mismatch'; end if;
  select coalesce(sum(x.quantity),0) into assigned from public.factory_order_product_link x
    where x.order_id=p_order and public.factory_product_order_is_current(x.product_order_id,x.order_revision);
  if p_quantity is null or p_quantity<1 or p_quantity>f.quantity or assigned+p_quantity>o.quantity then raise exception 'link: coverage quantity exceeded'; end if;
  snap:=public.factory_lineage_snapshot(p_order);
  insert into public.factory_order_product_link(order_id,product_order_id,order_revision,order_hash,demand_signature,snapshot,snapshot_hash,quantity,reason,linked_by,request_key)
  values(p_order,p_id,p_revision,p_hash,p_signature,snap,encode(sha256(convert_to(public.factory_lineage_canonical(snap),'UTF8')),'hex'),p_quantity,p_reason,p_actor,p_request) returning id into result;
  insert into public.factory_lineage_request(request_key,action,actor,body,result) values(p_request,'link',p_actor,body,result::text);
  return result;
end $$;

create function public.factory_product_order_withdraw(p_actor uuid,p_id text,p_revision integer,p_hash text,p_reason text,p_request uuid)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare prev record; result uuid; body jsonb; replay text;
begin
  if public.factory_lineage_actor(p_actor,true) is not true then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_request is null or p_id is null or p_revision is null or p_hash is null then raise exception 'withdraw: required body'; end if;
  body:=jsonb_build_array(p_id,p_revision,p_hash,p_reason);
  replay:=public.factory_lineage_replay(p_request,'withdraw',p_actor,body);
  if replay is not null then return replay::uuid; end if;
  perform pg_advisory_xact_lock(hashtextextended('factory_lineage:'||p_id,0));
  select * into prev from public.factory_product_order_withdrawal where request_key=p_request or (product_order_id=p_id and order_revision=p_revision) order by (request_key=p_request) desc limit 1;
  if found then
    if (prev.withdrawn_by,prev.product_order_id,prev.order_revision,prev.order_hash,prev.reason) is distinct from (p_actor,p_id,p_revision,p_hash,p_reason) then raise exception 'withdraw: different body' using errcode='23505'; end if;
    insert into public.factory_lineage_request(request_key,action,actor,body,result) values(p_request,'withdraw',p_actor,body,prev.id::text);
    return prev.id;
  end if;
  insert into public.factory_product_order_withdrawal(product_order_id,order_revision,order_hash,reason,withdrawn_by,request_key)
  values(p_id,p_revision,p_hash,p_reason,p_actor,p_request) returning id into result;
  insert into public.factory_lineage_request(request_key,action,actor,body,result) values(p_request,'withdraw',p_actor,body,result::text);
  return result;
end $$;

create function public.factory_lineage_read(p_actor uuid,p_user uuid,p_workspace uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare result jsonb; total integer;
begin
  if public.factory_lineage_actor(p_actor,false) is not true then raise exception 'Forbidden' using errcode='42501'; end if;
  if not exists(select 1 from public.learner_workspace where id=p_workspace and user_id=p_user) then raise exception 'lineage: workspace not owned'; end if;
  select count(*) into total from public.factory_order_product_link l join public.factory_order o on o.id=l.order_id where o.workspace_id=p_workspace and o.user_id=p_user;
  select coalesce(jsonb_agg(row),'[]') into result from (
    select l.id,l.order_id,l.product_order_id,l.order_revision,l.order_hash,l.quantity,l.created_at,
      f.quantity as product_quantity,
      public.factory_product_order_is_current(l.product_order_id,l.order_revision) as product_current,
      public.factory_lineage_personal_current(l.order_id) as personal_current,
      case when exists(select 1 from public.factory_product_order_withdrawal w where w.product_order_id=l.product_order_id and w.order_revision=l.order_revision) then 'withdrawn'
        when not public.factory_product_order_is_current(l.product_order_id,l.order_revision) then 'superseded'
        when not public.factory_lineage_personal_current(l.order_id) then 'personal_order_changed' else 'current' end as status
    from public.factory_order_product_link l join public.factory_order o on o.id=l.order_id
      join public.factory_product_order f using(product_order_id,order_revision,order_hash)
    where o.workspace_id=p_workspace and o.user_id=p_user order by l.created_at desc,l.id limit 100
  ) row;
  return jsonb_build_object('rows',result,'total',total,'limited',total>100);
end $$;

-- 명시적 ACL. default privilege ALL 및 service_role BYPASSRLS에 기대지 않는다.
do $$ declare t text; f record; begin
  foreach t in array array['factory_product_order','factory_order_product_link','factory_product_order_withdrawal','factory_lineage_request'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy lineage_admin_read on public.%I for select to authenticated using (public.factory_lineage_actor(auth.uid(),false))',t);
    execute format('create trigger lineage_append_only before update or delete on public.%I for each row execute function public.forbid_ledger_mutation()',t);
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('factory_lineage_canonical','factory_lineage_actor','factory_lineage_spec','factory_lineage_snapshot','factory_lineage_personal_current','factory_lineage_replay','factory_product_order_is_current','factory_product_order_register','factory_order_link_product','factory_product_order_withdraw','factory_lineage_read') loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
  end loop;
end $$;
grant execute on function public.factory_lineage_actor(uuid,boolean) to authenticated;
grant execute on function public.factory_product_order_register(uuid,text,text,jsonb,integer,text,uuid),
  public.factory_order_link_product(uuid,uuid,text,integer,text,text,integer,text,uuid),
  public.factory_product_order_withdraw(uuid,text,integer,text,text,uuid),
  public.factory_lineage_read(uuid,uuid,uuid) to service_role;
$vf_d3_source$]);
commit;
