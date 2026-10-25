// agents/scripts/db-mcp-guard.mjs
// Vocaflow Supabase MCP SQL 가드 — Claude Code PreToolUse 훅. stdin 의 네이티브 이벤트 JSON 하나를 판정한다.
// 최신 사용자 지시(2026-10-25 · Story 마이그레이션 SQL 전문 승인 뒤): Supabase MCP 의 쓰기 능력을 되살린다.
// 단 쓰기·판정 불가 호출은 언제나 네이티브 호출별 확인(permissionDecision 'ask')을 거친다. 이 훅은 무엇도 allow 하지 않는다.
// 이 복원은 SQL 전문·SHA-256·영향 범위·복구 SQL 의 대화 승인과 데이터 삭제·DROP·TRUNCATE 의 별도 명시 승인을 대체하지 않는다.
// 확인 창은 승인이 아니다 — 티켓·nonce 를 만들지 않고 인증정보·환경변수를 읽지 않는다.
// 정본 문구(dev-mode.json db_apply · AGENTS.md · CLAUDE.md)는 설치하는 쪽이 이 결정에 맞춰 함께 고친다.
//   · apply_migration → 언제나 ask
//   · execute_sql → 보수적 읽기 전용이면 출력 없음(다른 가드·권한 규칙은 그대로), 쓰기·판정 불가·빈/잘못된 SQL 은 ask
// 분류기는 파서가 아니다(뷰·연산자 속 함수는 못 본다). standard_conforming_strings=on 기준이며 불확실하면 ask 로 기운다.
// 전역 래퍼: `import { main } from '<이 파일>'; main()` — 이 모듈은 직접 실행될 때만 스스로 stdin 을 읽는다.
import { createHash } from 'node:crypto'
import { realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const TOOL = /^mcp__.*supabase.*__(execute_sql|apply_migration)$/i
// Postgres 낱말 규칙을 따른다: 비ASCII 는 모두 식별자 글자, 공백은 ASCII 공백만, 대소문자는 ASCII 만 접는다.
const IDC = /[\w$\u0080-\uffff]/
const DOLLAR = /\$(?:[A-Za-z_\u0080-\uffff][\w\u0080-\uffff]*)?\$/y
const READ = /^[ (]*(select|with|explain|show|table|values)(?![\w$\u0080-\uffff])/
const TOKEN = /[a-z_\u0080-\uffff][\w$\u0080-\uffff]*/g
const CALL = /(?<![\w$\u0080-\uffff])((?:[a-z_\u0080-\uffff][\w$\u0080-\uffff]* *\. *)+)?([a-z_\u0080-\uffff][\w$\u0080-\uffff]*) *\(/g
const WRITE = new Set(('insert update delete merge upsert truncate drop alter create grant revoke comment copy call do vacuum ' +
  'reindex cluster refresh lock set reset begin commit rollback savepoint prepare execute listen notify security import load ' +
  'discard into share').split(' '))
const SIDE = /^(pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|lo_.*|dblink.*|set_config|nextval|setval|pg_sleep.*|pg_notify|pg_advisory.*|pg_terminate_backend|pg_cancel_backend|pg_reload_conf|query_to_xml.*|(record|apply|publish|approve|reject|insert|update|delete|upsert|set|reset|close|capture)_.*)$/
// 괄호가 뒤따를 수 있는 SQL 키워드·타입·읽기 전용 내장 함수. 여기 없는 호출(사용자 정의 RPC 포함)은 판정 불가 → ask.
const SAFE = new Set(`select from where and or not in exists any all some as on using join lateral over filter within group by
  order partition having limit offset values array row case when then else union intersect except between is distinct with
  explain materialized numeric decimal varchar char character varying float timestamp time interval bit count sum avg min max
  array_agg string_agg json_agg jsonb_agg json_object_agg jsonb_object_agg bool_and bool_or every stddev variance mode rank
  percentile_cont percentile_disc row_number dense_rank lag lead first_value last_value ntile coalesce nullif greatest least
  cast extract date_trunc date_part age now clock_timestamp to_char to_date to_timestamp to_number make_interval timezone
  lower upper length char_length octet_length trim btrim ltrim rtrim substr substring left right replace split_part concat
  concat_ws format position strpos starts_with regexp_replace regexp_match regexp_matches md5 sha256 encode decode lpad rpad
  initcap quote_ident quote_literal round floor ceil ceiling abs trunc mod random gen_random_uuid json_build_object
  jsonb_build_object json_build_array jsonb_build_array to_json to_jsonb row_to_json jsonb_typeof jsonb_array_length
  json_array_length jsonb_array_elements jsonb_array_elements_text jsonb_each jsonb_each_text jsonb_object_keys
  jsonb_extract_path_text jsonb_pretty array_length array_to_string string_to_array cardinality unnest generate_series
  to_regclass to_regproc to_regprocedure to_regtype to_regnamespace to_regrole format_type obj_description col_description
  current_setting current_database current_schema current_schemas version has_table_privilege has_schema_privilege
  has_function_privilege has_column_privilege pg_has_role pg_get_functiondef pg_get_function_arguments pg_get_function_result
  pg_get_function_identity_arguments pg_get_viewdef pg_get_indexdef pg_get_constraintdef pg_get_triggerdef pg_get_expr
  pg_get_userbyid pg_get_serial_sequence pg_relation_size pg_table_size pg_indexes_size pg_total_relation_size
  pg_database_size pg_size_pretty pg_column_size pg_typeof pg_backend_pid pg_is_in_recovery`.trim().split(/\s+/))

// 주석·문자열·달러 인용 → 공백, 따옴표 식별자 → _q_, ASCII 공백 → ' '. 닫히지 않은 형태는 null(판정 불가).
function strip(sql) {
  let out = ''
  for (let i = 0; i < sql.length;) {
    const c = sql[i]
    if (sql.startsWith('--', i)) {
      while (i < sql.length && sql[i] !== '\n' && sql[i] !== '\r') i++
      out += ' '
    } else if (sql.startsWith('/*', i)) {
      let depth = 0
      do {
        if (sql.startsWith('/*', i)) { depth++; i += 2 } else if (sql.startsWith('*/', i)) { depth--; i += 2 } else i++
      } while (depth > 0 && i < sql.length)
      if (depth > 0) return null
      out += ' '
    } else if (c === `'` || c === `"`) {
      const esc = c === `'` && /[eE]/.test(sql[i - 1] ?? '') && !IDC.test(sql[i - 2] ?? '') // E'…' 만 역슬래시 이스케이프
      for (i++; ; i++) {
        if (i >= sql.length) return null
        if (esc && sql[i] === '\\') i++
        else if (sql[i] === c) { if (sql[i + 1] !== c) break; i++ }
      }
      i++
      out += c === `"` ? ' _q_ ' : ' '
    } else {
      DOLLAR.lastIndex = i
      const tag = c === '$' && !IDC.test(sql[i - 1] ?? '') && DOLLAR.exec(sql)
      if (tag) {
        const end = sql.indexOf(tag[0], i + tag[0].length)
        if (end < 0) return null
        i = end + tag[0].length
        out += ' '
      } else {
        out += /[\t\n\r\f\v]/.test(c) ? ' ' : c
        i++
      }
    }
  }
  return out
}

// { read: true } 만 출력 없이 통과한다. 그 밖은 ask 사유를 돌려준다.
export function classifySql(sql) {
  if (typeof sql !== 'string') return { read: false, why: 'query 가 문자열이 아니다' }
  const stripped = strip(sql)
  if (stripped === null) return { read: false, why: '닫히지 않은 따옴표·주석·달러 인용' }
  let body = stripped.replace(/[A-Z]+/g, (m) => m.toLowerCase())
  let end = body.length
  while (end > 0 && (body[end - 1] === ' ' || body[end - 1] === ';')) end--
  body = body.slice(0, end)
  if (!READ.test(body)) return { read: false, why: '읽기 문(SELECT·WITH·EXPLAIN·SHOW·TABLE·VALUES)으로 시작하지 않거나 빈 SQL' }
  if (body.includes(';')) return { read: false, why: '여러 문장' }
  const word = (body.match(TOKEN) ?? []).find((t) => WRITE.has(t))
  if (word) return { read: false, why: `쓰기·세션 낱말(${word})` }
  for (const [, schema, fn] of body.matchAll(CALL)) {
    const name = fn === '_q_' ? '따옴표 이름' : fn.slice(0, 64)
    if (schema) return { read: false, why: `스키마 한정 함수 호출(${name})` }
    if (SIDE.test(fn)) return { read: false, why: `부작용·쓰기 성격 함수 호출(${name})` }
    if (!SAFE.has(fn)) return { read: false, why: `판정할 수 없는 함수 호출(${name})` }
  }
  return { read: true }
}

// D:/workspace/Vocaflow · 그 아래 · 형제 worktree(이름이 Vocaflow- 로 시작)와 그 아래만. 구분자·대소문자·끝 슬래시·.. 를 정규화한다.
export function inScope(cwd) {
  if (typeof cwd !== 'string' || !cwd) return false
  const p = path.win32.normalize(cwd).split(path.win32.sep).join('/').replace(/^\/\/[?.]\//, '').replace(/\/+$/, '')
    .toLowerCase().replace(/^\/([a-z])(?=\/|$)/, '$1:')
  return /^d:\/workspace\/vocaflow(-[^/]*)?(\/|$)/.test(p)
}

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex')
const ask = (why, query) => ({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason:
  `[Vocaflow Supabase MCP 호출별 확인] ${why}. SQL SHA-256: ` +
  `${typeof query === 'string' ? sha256(query) : 'unavailable(query 가 문자열이 아니라 승인한 SQL 과 대조할 수 없다)'}. ` +
  '쓰기는 실행 전에 이 SQL 전문·SHA-256·영향 범위·복구 SQL 을 사용자가 대화에서 먼저 승인했어야 한다. ' +
  '이 확인 창은 그 승인을 대신하지 않으며 호출마다 따로 확인한다. 데이터 삭제·DROP·TRUNCATE 는 그 내용을 밝힌 별도 명시 승인이 필요하다.' } })

// 이벤트 하나 → 출력할 객체 또는 null(출력 없음). allow 는 만들지 않는다.
export function decide(event) {
  if (!event || typeof event !== 'object' || typeof event.tool_name !== 'string' || !TOOL.test(event.tool_name)) return null
  if (!inScope(typeof event.cwd === 'string' && event.cwd ? event.cwd : process.cwd())) return null
  const query = event.tool_input?.query
  if (/apply_migration$/i.test(event.tool_name)) return ask('apply_migration 은 언제나 호출별 확인 대상', query)
  const verdict = classifySql(query)
  return verdict.read ? null : ask(verdict.why, query)
}

export async function main({ stdin = process.stdin, stdout = process.stdout, stderr = process.stderr } = {}) {
  let raw = ''
  try {
    const chunks = []
    for await (const chunk of stdin) chunks.push(Buffer.from(chunk))
    raw = Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '')
    const out = decide(JSON.parse(raw))
    if (out) stdout.write(JSON.stringify(out))
  } catch {
    // 이벤트를 믿을 수 없으면 도구·cwd 를 특정하지 못한다 — 가짜 권한 문맥을 만들지 않는다.
    // Supabase SQL 도구로 보이면 막고(exit 2 = PreToolUse 차단, stderr 는 Claude 에게 간다), 아니면 조용히 넘긴다.
    if (/supabase/i.test(raw) && /execute_sql|apply_migration/i.test(raw)) {
      stderr.write('[Vocaflow DB MCP 가드] 훅 이벤트를 판정하지 못해 Supabase SQL 호출을 막았다.\n')
      process.exitCode = 2
    }
  }
}

const real = (file) => { const r = realpathSync(file); return process.platform === 'win32' ? r.toLowerCase() : r }
let direct = false
try { direct = Boolean(process.argv[1]) && real(process.argv[1]) === real(fileURLToPath(import.meta.url)) } catch { direct = false }
if (direct) main()
