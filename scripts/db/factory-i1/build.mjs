// scripts/db/factory-i1/build.mjs
//
// Factory I1 배포 migration 생성기 — 원본 SQL 바이트를 고치지 않고 「가드 + 원본 세그먼트 + 가드」 로 감싼다.
//   DB-1 = 프롤로그 → 트립와이어 → C → 트립와이어 → B → 트립와이어 → S → 에필로그(카탈로그 diff = 허용 목록)
//   DB-2 = 프롤로그 → 트립와이어 → P → 에필로그
// 세그먼트는 `-- >>> VF-SEGMENT <id> <file> sha256=<hex> bytes=<n>` 줄 다음부터 `-- <<< VF-SEGMENT <id>` 줄 앞까지가 원본과 바이트까지 같다.
//
//   node scripts/db/factory-i1/build.mjs          # 생성(파일 · MANIFEST.json 기록)
//   node scripts/db/factory-i1/build.mjs --check  # 다시 만들어 저장소 파일과 바이트 비교(다르면 exit 1) — 정본 SHA 검증 포함
import fs from 'node:fs'
import path from 'node:path'
import { CATALOG_SQL, diffSql } from './catalog.mjs'
import { PREFLIGHT_SQL, verifySql } from './sql.mjs'
import { ROOT, sha256, readSource } from './source.mjs'
import { buildRestore } from './restore.mjs'
import { SOURCES, STAGES, ALLOW, HELPERS, DB1_TARGET_TABLES, DB1_TARGET_FUNCTIONS, FOREIGN_TARGETS, WRITER_RPCS,
  REQUIRED_RELATIONS, REQUIRED_FUNCTIONS, PROJECT_REF, PRIOR_MAX_VERSION } from './spec.mjs'

export const MANIFEST_PATH = 'supabase/deploy/factory-i1/MANIFEST.json'
export { ROOT, sha256, readSource }

const lit = (s) => `'${String(s).replaceAll("'", "''")}'`
const arr = (xs) => xs.length ? `array[${xs.map(lit).join(', ')}]::text[]` : `'{}'::text[]`

const tripwire = (stage, where) => `do $vf$ begin
  if coalesce(current_setting('vf.i1_deploy_xid', true), '') <> txid_current()::text
     or coalesce(current_setting('vf.i1_deploy_stage', true), '') <> ${lit(stage)} then
    raise exception 'DEPLOY_BLOCKED[atomicity] ${stage.toUpperCase()} 이 한 트랜잭션으로 실행되지 않았다(%). scripts/db/factory-i1/deploy.mjs apply 로만 적용한다(이력 행을 같은 트랜잭션에 쓴다)', ${lit(where)};
  end if;
end $vf$;
`

function historyGuard(stage) {
  const own = STAGES[stage].version
  const other = STAGES[stage === 'db1' ? 'db2' : 'db1'].version
  // 이력이 하나도 없는 DB(CI 의 빈 Supabase)는 이력 검사를 건너뛴다. 개발 DB 는 722행 — 항상 검사한다.
  // plpgsql 은 IF 조건식을 통째로 계획한다 — 표가 없을 수 있으므로 존재 여부를 먼저 구하고 동적 SQL 로 센다.
  const lines = [`  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute 'select exists (select 1 from supabase_migrations.schema_migrations)' into v_hist;
  end if;
  if v_hist then
    if exists (select 1 from supabase_migrations.schema_migrations where version = ${lit(own)}) then
      raise exception 'DEPLOY_BLOCKED[history] 버전 ${own} 이 이미 이력에 있다';
    end if;`]
  if (stage === 'db1') {
    lines.push(`    if exists (select 1 from supabase_migrations.schema_migrations where version = ${lit(other)}) then
      raise exception 'DEPLOY_BLOCKED[history] DB-2(${other}) 이력이 DB-1 보다 먼저 있다';
    end if;`)
  } else {
    lines.push(`    if not exists (select 1 from supabase_migrations.schema_migrations where version = ${lit(other)}
                   and encode(sha256(convert_to(array_to_string(statements, ''), 'UTF8')), 'hex') = current_setting('vf.i1_db1_sha', true)) then
      raise exception 'DEPLOY_BLOCKED[history] DB-1(${other}) 이 이력에 없거나 본문 sha256 이 패키지와 다르다 — DB-1 실DB 검증 전에는 DB-2 를 적용하지 않는다';
    end if;`)
  }
  lines.push('  end if;')
  return lines.join('\n')
}

function prologue(stage, db1Sha) {
  const relChecks = REQUIRED_RELATIONS.map((r) => `to_regclass(${lit(r)})`).join(', ')
  const fnChecks = REQUIRED_FUNCTIONS.map((f) => `to_regprocedure(${lit(f)})`).join(', ')
  const helperRows = Object.entries(HELPERS).map(([f, h]) =>
    `    (${lit(f)}, ${stage === 'db1' ? `array[${lit(h.before)}, ${lit(h.after)}]` : `array[${lit(h.after)}]`})`).join(',\n')
  const absent = stage === 'db1'
    ? `  select array_agg(n) into v_bad from unnest(${arr([...DB1_TARGET_TABLES, ...FOREIGN_TARGETS])}) n where to_regclass('public.'||n) is not null;
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[target] 이미 있는 대상 표: %', v_bad; end if;
  select array_agg(distinct proname::text) into v_bad from pg_proc where pronamespace = 'public'::regnamespace and proname = any(${arr([...DB1_TARGET_FUNCTIONS, 'workspace_line_fulfillment'])});
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[target] 이미 있는 대상 함수: %', v_bad; end if;`
    : `  select array_agg(n) into v_bad from unnest(${arr(DB1_TARGET_TABLES)}) n where to_regclass('public.'||n) is null;
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[target] DB-1 표가 없다: %', v_bad; end if;
  select array_agg(n) into v_bad from unnest(${arr(FOREIGN_TARGETS)}) n where to_regclass('public.'||n) is not null;
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[target] 승인 밖 D3 표가 있다: %', v_bad; end if;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'workspace_line_fulfillment') then
    raise exception 'DEPLOY_BLOCKED[target] workspace_line_fulfillment 가 이미 있다';
  end if;
  if exists (select 1 from pg_constraint where conname = 'factory_order_state_check' and pg_get_constraintdef(oid) like '%partial%') then
    raise exception 'DEPLOY_BLOCKED[target] factory_order.state 에 partial 이 이미 있다';
  end if;`
  return `-- ── VF 프롤로그: 차단 조건 검사 · 트랜잭션 표식 · 적용 전 카탈로그 지문 ────────────────
set local lock_timeout = '15s';
set local statement_timeout = '120s';
do $vf$
declare v_bad text[]; v_hist boolean := false;
begin
  perform set_config('vf.i1_deploy_xid', txid_current()::text, true);
  perform set_config('vf.i1_deploy_stage', ${lit(stage)}, true);
  perform set_config('vf.i1_db1_sha', ${lit(db1Sha ?? '')}, true);
${historyGuard(stage)}
  select array_agg(x) into v_bad from unnest(${arr(REQUIRED_RELATIONS)}) x where to_regclass(x) is null;
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[prereq] 전제 표가 없다: %', v_bad; end if;
  select array_agg(x) into v_bad from unnest(${arr(REQUIRED_FUNCTIONS)}) x where to_regprocedure(x) is null;
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[prereq] 전제 함수가 없다: %', v_bad; end if;
${absent}
  -- 기존 권한 helper 설정이 실측(또는 DB-1 뒤 값)과 다르면 누군가 승인 밖에서 바꾼 것이다
  select array_agg(h.f||'='||coalesce(p.proconfig::text, 'NULL')) into v_bad
  from (values
${helperRows}) h(f, ok)
  left join pg_proc p on p.pronamespace = 'public'::regnamespace and p.proname = h.f and p.pronargs = 0
  where p.oid is null or coalesce(p.proconfig::text, 'NULL') <> all(h.ok);
  -- 빈 이력 DB(CI 의 빈 Supabase)는 helper 설정이 저장소 migration 결과라 실측과 다를 수 있다 — 이력 있는 DB 에서만 차단한다
  if v_bad is not null and v_hist then
    raise exception 'DEPLOY_BLOCKED[drift] 권한 helper 설정이 예상과 다르다: %', v_bad;
  end if;
end $vf$;
-- 커밋 시점 가드: 이 트랜잭션은 에필로그 검증(vf.i1_deploy_done = 이 xid)을 통과해야만 커밋된다.
-- 파일을 잘라 「프롤로그 + 일부 세그먼트」만 커밋하려는 러너는 COMMIT 에서 실패해 그 조각 전체가 롤백된다. 임시 객체라 카탈로그 밖이다.
create or replace function pg_temp.vf_i1_commit_guard() returns trigger language plpgsql as $vf$ begin
  if coalesce(current_setting('vf.i1_deploy_done', true), '') <> txid_current()::text then
    raise exception 'DEPLOY_BLOCKED[atomicity] 에필로그 검증 없이 커밋하려 했다 — 전체 롤백';
  end if;
  return null;
end $vf$;
create temp table vf_i1_${stage}_guard (x int) on commit drop;
create constraint trigger vf_i1_commit_guard after insert on pg_temp.vf_i1_${stage}_guard
  deferrable initially deferred for each row execute function pg_temp.vf_i1_commit_guard();
insert into pg_temp.vf_i1_${stage}_guard values (1);
create temp table vf_i1_${stage}_before on commit drop as
${CATALOG_SQL};
-- Only proconfig may change on existing authorization helpers. Preserve every other pg_proc attribute.
create temp table vf_i1_${stage}_helpers on commit drop as
select p.oid, to_jsonb(p) - 'proconfig' fingerprint from pg_proc p
where p.oid in ('public.is_admin()'::regprocedure, 'public.is_admin_or_curator()'::regprocedure);
`
}

function epilogue(stage) {
  const a = ALLOW[stage]
  const extraAsserts = stage === 'db1' ? `
  -- 권한 helper: 정확히 강화된 값
  select array_agg(h.f||'='||coalesce(p.proconfig::text, 'NULL')) into v_bad
  from (values ${Object.entries(HELPERS).map(([f, h]) => `(${lit(f)}, ${lit(h.after)})`).join(', ')}) h(f, want)
  left join pg_proc p on p.pronamespace = 'public'::regnamespace and p.proname = h.f and p.pronargs = 0
  where coalesce(p.proconfig::text, 'NULL') <> h.want;
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[verify] helper search_path: %', v_bad; end if;
  -- 새 표 8: RLS on · anon 권한 0 · authenticated 는 SELECT 만
  select array_agg(t) into v_bad from unnest(${arr(DB1_TARGET_TABLES)}) t
  where not (select relrowsecurity from pg_class where oid = to_regclass('public.'||t))
     or has_table_privilege('anon', 'public.'||t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or has_table_privilege('authenticated', 'public.'||t, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or not has_table_privilege('authenticated', 'public.'||t, 'SELECT');
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[verify] 표 RLS/권한: %', v_bad; end if;
  -- 내부 판정기는 정의자 함수 안에서만(anon · authenticated · public 실행권 없음)
  select array_agg(p.proname::text) into v_bad from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('supply_learner_exposure','supply_delivery_valid','supply_artifact_revision')
    and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[verify] 내부 판정기 실행권: %', v_bad; end if;
  -- 쓰기 RPC 는 anon 실행권 없음
  select array_agg(p.proname::text) into v_bad from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname = any(${arr(WRITER_RPCS)})
    and has_function_privilege('anon', p.oid, 'EXECUTE');
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[verify] anon 실행권: %', v_bad; end if;
  -- 정의자 함수는 모두 search_path 끝이 pg_temp
  select array_agg(p.proname::text) into v_bad from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname = any(${arr(DB1_TARGET_FUNCTIONS)}) and p.prosecdef
    and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%pg_temp');
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[verify] 정의자 search_path: %', v_bad; end if;` : `
  if not exists (select 1 from pg_constraint where conname = 'factory_order_state_check' and pg_get_constraintdef(oid) like '%partial%') then
    raise exception 'DEPLOY_BLOCKED[verify] factory_order.state CHECK 에 partial 이 없다';
  end if;
  if has_function_privilege('anon', 'public.workspace_line_fulfillment(uuid)', 'EXECUTE') then
    raise exception 'DEPLOY_BLOCKED[verify] workspace_line_fulfillment anon 실행권';
  end if;`
  return `-- ── VF 에필로그: 카탈로그 diff = 허용 목록(정확히) · 보안 속성 검증 — 하나라도 어긋나면 전체 롤백 ──────────
do $vf$
declare v_added text[]; v_removed text[]; v_changed text[]; v_bad text[];
  exp_added text[] := ${arr(a.added)};
  exp_changed text[] := ${arr(a.changed)};
  con_tables text[] := ${arr(a.addedConstraintTables)};
  v_unexpected text[]; v_missing text[];
begin
  if coalesce(current_setting('vf.i1_deploy_xid', true), '') <> txid_current()::text then
    raise exception 'DEPLOY_BLOCKED[atomicity] 에필로그가 프롤로그와 다른 트랜잭션이다';
  end if;
  select d.added, d.removed, d.changed into v_added, v_removed, v_changed
  from (${diffSql(`vf_i1_${stage}_before`)}) d;
  select array_agg(x order by x) into v_unexpected from unnest(v_added) x
   where x <> all(exp_added) and not (x like 'con:%' and split_part(substr(x, 5), '.', 1) = 'public'
                                       and split_part(substr(x, 5), '.', 2) = any(con_tables));
  select array_agg(x order by x) into v_missing from unnest(exp_added) x where x <> all(v_added);
  -- 변경은 허용 목록의 부분집합이면 된다(되돌리기 뒤 재적용이면 helper 가 이미 강화돼 「변경 0」). 최종값은 아래에서 정확히 본다.
  if v_unexpected is not null or v_missing is not null or cardinality(v_removed) > 0
     or not (v_changed <@ exp_changed) then
    raise exception 'DEPLOY_BLOCKED[allowlist] 허용 목록과 다른 카탈로그 변화 — 추가(목록 밖)=% · 빠짐=% · 삭제=% · 변경=% (허용 변경=%)',
      v_unexpected, v_missing, v_removed, v_changed, exp_changed;
  end if;
  if exists (select 1 from pg_temp.vf_i1_${stage}_helpers h left join pg_proc p on p.oid = h.oid
             where h.fingerprint is distinct from to_jsonb(p) - 'proconfig') then
    raise exception 'DEPLOY_BLOCKED[allowlist] existing helper changed beyond approved search_path';
  end if;${extraAsserts}
  perform set_config('vf.i1_deploy_done', txid_current()::text, true);
  raise notice 'VF_DEPLOY_OK stage=${stage} added=% changed=%', cardinality(v_added), cardinality(v_changed);
end $vf$;
`
}

function header(stage, segs) {
  const st = STAGES[stage]
  return `-- ${st.path}
-- Factory I1 ${stage.toUpperCase()} — 생성물(scripts/db/factory-i1/build.mjs). 손으로 고치지 않는다. 검증: node scripts/db/factory-i1/build.mjs --check
-- 대상 프로젝트 ${PROJECT_REF} · 이전 이력 최댓값 ${PRIOR_MAX_VERSION} · 버전 ${st.version} (${st.name})
-- 원본 세그먼트(바이트 그대로): ${segs.map((id) => `${id}=${SOURCES[id].file} sha256=${SOURCES[id].sha256}`).join(' · ')}
-- 원자 단위: 이 파일 전체가 한 트랜잭션이어야 한다. 프롤로그가 xid 를 표식하고 세그먼트 경계마다 같은 xid 인지 확인한다
--   (비원자 러너는 첫 DDL 전에 DEPLOY_BLOCKED[atomicity] 로 멈춘다). 에필로그가 카탈로그 diff 를 허용 목록과 비교한다.
-- 적용: node scripts/db/factory-i1/deploy.mjs apply --stage ${stage} …  (절차: docs/csat-learner/v62/FACTORY_I1_DEPLOY_PACKAGE.md)
${stage === 'db2' ? `-- ⚠️ DB-2 는 DB-1 실DB 적용 · 검증 기록 뒤에만. 이 파일은 supabase/migrations 밖에 둔다(승격은 별도 PR).\n` : ''}`
}

export function buildStage(stage, db1Sha) {
  const st = STAGES[stage]
  let out = header(stage, st.segments) + '\n' + prologue(stage, db1Sha) + tripwire(stage, 'prologue→' + st.segments[0])
  const segments = []
  st.segments.forEach((id, i) => {
    const text = readSource(id)
    const open = `-- >>> VF-SEGMENT ${id} ${SOURCES[id].file} sha256=${SOURCES[id].sha256} bytes=${Buffer.byteLength(text)}\n`
    out += open
    const start = Buffer.byteLength(out)
    out += text
    segments.push({ id, file: SOURCES[id].file, sha256: SOURCES[id].sha256, bytes: Buffer.byteLength(text), offset: start })
    out += `-- <<< VF-SEGMENT ${id}\n`
    out += tripwire(stage, `${id}→${st.segments[i + 1] ?? 'epilogue'}`)
  })
  out += epilogue(stage)
  return { text: out, sha256: sha256(Buffer.from(out)), bytes: Buffer.byteLength(out), segments }
}

/** 생성된 파일에서 세그먼트를 꺼내 원본 SHA 와 다시 대조(오프셋이 아니라 표식 줄로 찾는다) */
export function verifySegments(text) {
  const re = /^-- >>> VF-SEGMENT (\w+) (\S+) sha256=([0-9a-f]{64}) bytes=(\d+)\n/gm
  const found = []
  let m
  while ((m = re.exec(text))) {
    const start = m.index + m[0].length
    const endMark = `-- <<< VF-SEGMENT ${m[1]}\n`
    const end = text.indexOf(endMark, start)
    const body = text.slice(start, end)
    found.push({ id: m[1], ok: end > 0 && sha256(Buffer.from(body)) === m[3] && SOURCES[m[1]]?.sha256 === m[3] && Buffer.byteLength(body) === Number(m[4]) })
  }
  return found
}

/** 인계용 보조 파일(되돌리기 · 읽기 전용 SQL) — MCP execute_sql · psql 로도 같은 본문을 돌릴 수 있게 */
export function auxFiles(db1Sha, db2Sha) {
  const r = buildRestore()
  const D = 'supabase/deploy/factory-i1/'
  const verifyFile = (st, sha) => `-- ${D}${st}-verify.sql — 생성물. 적용 직후 읽기 전용 검증(각 문 독립 실행 · ok 열이 모두 true). $1 = ${sha}\n`
    + verifySql(st).map((q) => q.replaceAll('$1', `'${sha}'`) + ';').join('\n') + '\n'
  return [[D + 'db1-restore.sql', r.db1], [D + 'db2-restore.sql', r.db2],
    [D + 'preflight.sql', `-- ${D}preflight.sql — 생성물. 적용 전 checkpoint(읽기 전용 · JSON 한 행)\n${PREFLIGHT_SQL};\n`],
    [D + 'db1-verify.sql', verifyFile('db1', db1Sha)], [D + 'db2-verify.sql', verifyFile('db2', db2Sha)]]
}

export function buildAll() {
  const db1 = buildStage('db1')
  const db2 = buildStage('db2', db1.sha256)
  const manifest = {
    package: 'factory-i1-deploy',
    project_ref: PROJECT_REF,
    prior_max_version: PRIOR_MAX_VERSION,
    sources: SOURCES,
    stages: {
      db1: { ...STAGES.db1, sha256: db1.sha256, bytes: db1.bytes, segments: db1.segments },
      db2: { ...STAGES.db2, sha256: db2.sha256, bytes: db2.bytes, segments: db2.segments, requires: { version: STAGES.db1.version, sha256: db1.sha256 } },
    },
    allowlist: ALLOW,
  }
  return { db1, db2, manifest: JSON.stringify(manifest, null, 2) + '\n' }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const { db1, db2, manifest } = buildAll()
  const files = [[STAGES.db1.path, db1.text], [STAGES.db2.path, db2.text], [MANIFEST_PATH, manifest], ...auxFiles(db1.sha256, db2.sha256)]
  if (process.argv.includes('--check')) {
    let bad = 0
    for (const [p, t] of files) {
      const abs = path.join(ROOT, p)
      const cur = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null
      if (cur !== t) { bad++; console.error(`DIFF ${p} — 생성물과 다르다(node scripts/db/factory-i1/build.mjs 로 다시 만든다)`) }
    }
    for (const [st, t] of [['db1', db1.text], ['db2', db2.text]]) {
      for (const s of verifySegments(t)) if (!s.ok) { bad++; console.error(`SEGMENT ${st}/${s.id} 바이트 불일치`) }
    }
    console.log(bad ? `FAIL ${bad}` : `OK db1=${db1.sha256} db2=${db2.sha256}`)
    process.exit(bad ? 1 : 0)
  }
  for (const [p, t] of files) {
    fs.mkdirSync(path.dirname(path.join(ROOT, p)), { recursive: true })
    fs.writeFileSync(path.join(ROOT, p), t)
  }
  console.log(`db1 ${STAGES.db1.path} sha256=${db1.sha256} bytes=${db1.bytes}`)
  console.log(`db2 ${STAGES.db2.path} sha256=${db2.sha256} bytes=${db2.bytes}`)
}
