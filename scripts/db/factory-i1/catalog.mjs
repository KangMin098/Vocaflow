// scripts/db/factory-i1/catalog.mjs
//
// Factory I1 배포 — 카탈로그 지문(kind · name · fp). migration 의 전후 diff 가드와 격리 시험이 **같은 SQL** 을 쓴다.
//   · 이름은 search_path 에 기대지 않게 스키마를 붙여 만든다(regclass/regprocedure 출력은 search_path 따라 바뀐다).
//   · fp 는 바뀌면 「기존 객체 변경」으로 읽히는 속성: 함수 본문 md5 · 설정 · ACL · 정의자 여부 / 표 ACL · RLS / 인덱스 · 제약 · 정책 · 트리거 정의.
//   · 열(col)은 public 표만 본다. 새로 생긴 표의 열은 diff 에서 「표 추가」에 흡수한다(목록이 수백 줄이 되지 않게).
//   · pg_temp* · pg_toast* · pg_catalog · information_schema 는 보지 않는다(가드 자신의 임시 표가 잡히지 않게).

const SYS = `n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\\_temp\\_%' and n.nspname not like 'pg\\_toast\\_temp\\_%'`

export const CATALOG_SQL = `select 'rel'::text k, n.nspname||'.'||c.relname name,
  c.relkind::text||'|'||coalesce(c.relacl::text,'')||'|'||c.relrowsecurity||'|'||c.relforcerowsecurity||'|'||coalesce(case when c.relkind = 'i' then pg_get_indexdef(c.oid) end,'')
  ||'|'||c.relowner::regrole::text||'|'||coalesce(c.reloptions::text,'')||'|'||coalesce(case when c.relkind in ('v','m') then md5(pg_get_viewdef(c.oid)) end,'') fp
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where ${SYS} and c.relkind <> 't'
union all
select 'col', n.nspname||'.'||c.relname||'.'||a.attname,
  format_type(a.atttypid, a.atttypmod)||'|'||a.attnotnull||'|'||coalesce(pg_get_expr(d.adbin, d.adrelid),'')||'|'||coalesce(a.attacl::text,'')
  from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attnum > 0 and not a.attisdropped and c.relkind in ('r','p','v','m','f') and ${SYS}
union all
select 'typ', n.nspname||'.'||t.typname, t.typtype::text||'|'||t.typowner::regrole::text||'|'||coalesce(t.typacl::text,'')||'|'||format_type(t.typbasetype, t.typtypmod)||'|'||t.typnotnull
  ||'|'||coalesce((select string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid),'')
  ||'|'||coalesce((select string_agg(pg_get_constraintdef(o.oid), ',' order by o.conname) from pg_constraint o where o.contypid = t.oid),'')
  from pg_type t join pg_namespace n on n.oid = t.typnamespace
  where ${SYS} and (t.typtype in ('e','d','r','m') or (t.typtype = 'c' and (select relkind from pg_class where oid = t.typrelid) = 'c'))
union all
select 'dacl', coalesce(d.defaclrole::regrole::text,'')||'.'||coalesce(d.defaclnamespace::regnamespace::text,'*')||'.'||d.defaclobjtype::text, coalesce(d.defaclacl::text,'') from pg_default_acl d
union all
select 'ext', x.extname, x.extversion||'|'||x.extnamespace::regnamespace::text||'|'||x.extowner::regrole::text from pg_extension x
union all
select 'evt', e.evtname, e.evtevent||'|'||e.evtfoid::regproc::text||'|'||e.evtenabled::text||'|'||coalesce(e.evttags::text,'') from pg_event_trigger e
union all
select 'cmt', 'all', coalesce(md5(string_agg(d.classoid::regclass::text||':'||d.objoid||':'||d.objsubid||'='||d.description, E'\\n' order by d.classoid, d.objoid, d.objsubid)),'') from pg_description d
union all
select 'con', n.nspname||'.'||c.relname||'.'||o.conname, pg_get_constraintdef(o.oid)
  from pg_constraint o join pg_class c on c.oid = o.conrelid join pg_namespace n on n.oid = c.relnamespace where ${SYS}
union all
select 'fn', n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
  md5(coalesce(p.prosrc,''))||'|'||coalesce(p.proconfig::text,'')||'|'||coalesce(p.proacl::text,'')||'|'||p.prosecdef||'|'||p.provolatile::text||'|'||p.prokind::text||'|'||p.proowner::regrole::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where ${SYS}
union all
select 'pol', n.nspname||'.'||c.relname||'.'||p.polname,
  p.polcmd::text||'|'||p.polpermissive||'|'||p.polroles::text||'|'||coalesce(pg_get_expr(p.polqual, p.polrelid),'')||'|'||coalesce(pg_get_expr(p.polwithcheck, p.polrelid),'')
  from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace where ${SYS}
union all
select 'trg', n.nspname||'.'||c.relname||'.'||t.tgname, pg_get_triggerdef(t.oid)||'|'||t.tgenabled::text
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where ${SYS} and not t.tgisinternal
union all
select 'nsp', n.nspname, coalesce(n.nspacl::text,'')||'|'||n.nspowner::regrole::text from pg_namespace n where ${SYS}`

/**
 * 전후 지문 → { added, removed, changed } (정렬된 "kind:name" 목록).
 * added 에서 새 표의 열(col)은 뺀다 — 그 표의 rel 추가가 대표한다.
 */
export function catalogDiff(before, after) {
  const key = (r) => `${r.k}:${r.name}`
  const b = new Map(before.map((r) => [key(r), r.fp]))
  const a = new Map(after.map((r) => [key(r), r.fp]))
  const addedRel = new Set(after.filter((r) => r.k === 'rel' && !b.has(key(r))).map((r) => r.name))
  const added = [...a.keys()].filter((k) => !b.has(k)).filter((k) => {
    if (!k.startsWith('col:')) return true
    const t = k.slice(4).split('.').slice(0, 2).join('.')
    return !addedRel.has(t)
  }).sort()
  const removed = [...b.keys()].filter((k) => !a.has(k)).sort()
  const changed = [...a.keys()].filter((k) => b.has(k) && b.get(k) !== a.get(k)).sort()
  return { added, removed, changed }
}

/** 같은 diff 를 SQL(plpgsql) 안에서 계산하는 식 — before 표 이름과 after CTE 이름을 받는다. migration 가드가 쓴다. */
export function diffSql(beforeTable) {
  return `with a as (${CATALOG_SQL}),
 b as (select * from ${beforeTable}),
 added_rel as (select a.name from a where a.k = 'rel' and not exists (select 1 from b where b.k = a.k and b.name = a.name))
select
 coalesce((select array_agg(a.k||':'||a.name order by a.k||':'||a.name) from a
   where not exists (select 1 from b where b.k = a.k and b.name = a.name)
     and not (a.k = 'col' and split_part(a.name,'.',1)||'.'||split_part(a.name,'.',2) in (select name from added_rel))), '{}') added,
 coalesce((select array_agg(b.k||':'||b.name order by b.k||':'||b.name) from b
   where not exists (select 1 from a where a.k = b.k and a.name = b.name)), '{}') removed,
 coalesce((select array_agg(a.k||':'||a.name order by a.k||':'||a.name) from a join b on b.k = a.k and b.name = a.name
   where a.fp is distinct from b.fp), '{}') changed`
}
