// agents/scripts/__tests__/db-mcp-guard.test.mjs
// db-mcp-guard 훅 회귀 — 정본 훅을 자식 프로세스로 띄우고 stdin 에 PreToolUse 이벤트를 넣는다. DB 에 붙지 않는다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HOOK = fileURLToPath(new URL('../db-mcp-guard.mjs', import.meta.url))
const CWD = String.raw`D:\workspace\Vocaflow-main-serving`
const EXEC = 'mcp__supabase__execute_sql'
const APPLY = 'mcp__claude_ai_Supabase__apply_migration'
const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex')
const ev = (query, tool = EXEC, cwd = CWD) => ({ hook_event_name: 'PreToolUse', tool_name: tool, cwd, tool_input: { query } })
const run = (input, args = [HOOK]) =>
  spawnSync(process.execPath, args, { input: typeof input === 'string' ? input : JSON.stringify(input), encoding: 'utf8' })

function silent(r, label) {
  assert.equal(r.status, 0, `${label}: ${r.stderr}`)
  assert.equal(r.stdout, '', `${label}: 출력이 없어야 한다`)
}
function asks(r, query, label) {
  assert.equal(r.status, 0, `${label}: ${r.stderr}`)
  assert.notEqual(r.stdout, '', `${label}: ask 가 나와야 한다`)
  const out = JSON.parse(r.stdout)
  assert.deepEqual(Object.keys(out), ['hookSpecificOutput'])
  const { hookEventName, permissionDecision, permissionDecisionReason: why, ...rest } = out.hookSpecificOutput
  assert.deepEqual([hookEventName, permissionDecision, rest], ['PreToolUse', 'ask', {}], label)
  for (const part of [/승인/, /대신하지 않/, /호출마다/, /DROP·TRUNCATE/]) assert.match(why, part)
  if (typeof query === 'string') assert.ok(why.includes(`SQL SHA-256: ${sha(query)}.`), `${label}: ${why}`)
  else assert.match(why, /SQL SHA-256: unavailable/, label)
  return why
}

test('보수적 읽기 전용 SQL 은 출력 없음', () => {
  for (const q of [
    'select count(*) from library_books',
    `SELECT to_regclass('public.texts') IS NOT NULL;  \n`,
    'with t as (select 1 as n) select n from t',
    'explain (format json) select * from texts where id = $1',
    'show search_path',
    'table texts',
    'values (1), (2);',
    'select pg_size_pretty(pg_database_size(current_database()))',
    `select relname from pg_catalog.pg_class where relkind = 'r' limit 5`,
    `select 'drop table x; delete' as s, $tag$truncate t$tag$ as d -- update t\n/* insert */`,
    'select "comment", "update" from feedback',
    String.raw`select E'it\'s; delete' as x`,
    '/* /* nested */ drop table t */ select 1',
    `select '한글 -- 삭제' as x`,
    'select count(*) filter (where n > 1) over (partition by k) from t',
    `select exists (select 1 from pg_tables where tablename = 'texts')`,
  ]) silent(run(ev(q)), q)
})

test('쓰기·세션·부작용 SQL 은 원문 해시와 함께 ask', () => {
  for (const q of [
    'insert into t values (1)', 'update t set a = 1', 'DELETE FROM t', 'truncate t', 'vacuum', 'set role postgres',
    'select * from t for update', 'with d as (delete from t returning *) select * from d', 'select 1 into newtab',
    `select set_config('role', 'postgres', false)`, 'select record_attempt(1)', `select nextval('s')`,
    `select query_to_xml('delete from t', true, true, '')`, 'select my_rpc()',
  ]) asks(run(ev(q)), q, q)
})

test('주석·문자열·인용 함정, 여러 문장, 불확실한 호출은 ask', () => {
  for (const q of [
    'select 1; drop table t', 'select 1; select 2', `select 'abc`, 'select 1 /* drop', 'select $$x',
    'select 1 --x\rdelete from t', String.raw`select '\' ; drop table t; --'`, `select 'it''s -- no comment'; drop table t`,
    'select 1 /* a */ ; /* b */ delete from t', 'select 1 as a$x$ from t for update -- b$x$',
    'select 1 as →$x$ from t for update -- ←$x$', 'select "evil"()', 'select * from "public"."fn"()',
    'select public.count(*)', 'select count\u00a0(*)',
  ]) asks(run(ev(q)), q, q)
})

test('빈·주석뿐·알 수 없는 SQL 과 문자열 아닌 query 는 ask(객체를 문자열로 바꾸지 않는다)', () => {
  for (const q of ['', '   \n\t', '-- only a comment', 'garbage words here', 'analyze t']) asks(run(ev(q)), q, JSON.stringify(q))
  for (const q of [undefined, null, 123, { query: 'select 1' }, ['select 1']]) asks(run(ev(q)), q, JSON.stringify(q))
})

test('apply_migration 은 DDL·읽기를 가리지 않고 언제나 ask', () => {
  for (const q of ['create table story_x (id int primary key);\n', 'select 1']) {
    assert.match(asks(run(ev(q, APPLY)), q, q), /apply_migration/)
  }
  asks(run(ev({ sql: 'drop table t' }, APPLY)), undefined, 'object query')
})

test('원문 그대로(공백·줄바꿈·한글·큰 입력)의 SHA-256 을 쓴다', () => {
  const q = '\n  DELETE FROM t  \r\n\t'
  assert.ok(!asks(run(ev(q)), q, 'whitespace').includes(sha(q.trim())))
  const big = `insert into t values ('${'가'.repeat(40000)}')`
  asks(run(ev(big)), big, 'big utf8')
})

test('관련 없는 도구·경로는 출력 없음, Vocaflow 경로 변형은 판정한다', () => {
  for (const tool of ['mcp__supabase__list_tables', 'Bash', 'mcp__other__execute_sql', 'mcp__supabase__execute_sql_x']) {
    silent(run(ev('delete from t', tool)), tool)
  }
  for (const cwd of ['D:/workspace/Other', 'D:/workspace/VocaflowX', 'C:/workspace/Vocaflow-main-serving',
    'D:/workspace/Other/Vocaflow-x', 'D:/workspace']) {
    silent(run(ev('delete from t', EXEC, cwd)), cwd)
  }
  for (const cwd of ['d:/workspace/vocaflow/', String.raw`D:\workspace\Vocaflow\apps\web`, 'D:/WORKSPACE/VOCAFLOW-AI-Control/',
    'D:/workspace/Other/../Vocaflow-main-serving', '/d/workspace/Vocaflow-main-serving']) {
    asks(run(ev('delete from t', EXEC, cwd)), 'delete from t', cwd)
  }
})

test('깨진 이벤트 JSON 은 가짜 권한 문맥·스택 없이 끝난다', () => {
  for (const raw of ['', '{not json', 'null', '[]', '"x"']) silent(run(raw), JSON.stringify(raw))
  const r = run('{"tool_name":"mcp__supabase__execute_sql","cwd":')
  assert.equal(r.status, 2)
  assert.equal(r.stdout, '')
  assert.match(r.stderr, /막았다/)
  assert.doesNotMatch(r.stderr, /\n\s+at /)
})

test('전역 래퍼는 main 을 import 해 부르고, import 만으로는 stdin 을 읽지 않는다', () => {
  const url = JSON.stringify(pathToFileURL(HOOK).href)
  const wrapper = ['--input-type=module', '-e', `import { main } from ${url}; main()`]
  asks(run(ev('delete from t'), wrapper), 'delete from t', 'wrapper')
  silent(run(ev('select 1'), wrapper), 'wrapper read')
  silent(run(ev('delete from t'), ['--input-type=module', '-e', `import ${url}`]), 'import only')
})
