// scripts/db/authored-ai-record/deploy.mjs
//
// T-0098 창작 문항 비출시 기록의 승인형 러너 — 터미널 대신 Claude Code 승인 창(팝업)으로 승인한다.
//   · apply 는 승인 창(db-approval 훅이 덧붙인 1회용 --approval-nonce) 또는 TTY 에서 `APPLY authored-ai-record <sha>` 입력으로만.
//   · --confirm-sha = docs/research/goal-data-batches/authored-ai-review/nonrelease-calls.sql 의 sha256(사용자가 본 SQL). 파일이 바뀌면 거절.
//   · 승인되면 AI-Control T-0098 에 승인을 기록하고(근거에 티켓 · SQL sha), 관리자 로그인 세션 실행기(record-nonrelease.mts --execute)를 부른다.
//   · 출시 승인 · 사람 결정 · service_role · 직접 SQL 은 쓰지 않는다(T-0102 결정). 관리자 계정은 apps/web/.env.local 의 VF_ADMIN_EMAIL · VF_ADMIN_PASSWORD.
//
//   node scripts/db/authored-ai-record/deploy.mjs preflight --stage t0098                       # 읽기 전용(파일 sha · 승인 상태 · 계정 변수 유무)
//   node scripts/db/authored-ai-record/deploy.mjs apply     --stage t0098 --confirm-sha <sha>
//
// 종료 코드: 0 성공 · 1 사용법 · 2 실행 전 차단 · 4 실행 중 실패(재시도 전 결과 조회)
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { consumeTicket, NONCE_FLAG } from '../../../agents/scripts/db-approval.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const RUNNER = 'authored-ai-record'
const SQL = 'docs/research/goal-data-batches/authored-ai-review/nonrelease-calls.sql'
const CONTROL = process.env.VF_CONTROL_ROOT || 'D:/workspace/Vocaflow-AI-Control'
const MAIN = process.env.VF_MAIN_WORKTREE || 'D:/workspace/Vocaflow-main-serving'
const ENV_FILE = path.join(MAIN, 'apps/web/.env.local')
const TSX = path.join(MAIN, 'node_modules/.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx')
const SUPABASE_JS = path.join(MAIN, 'node_modules/@supabase/supabase-js')
const TASK = 'T-0098'

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex')
const fail = (code, msg) => { console.error(`[${RUNNER}] ${msg}`); process.exit(code) }

/** .env.local 에서 필요한 키만 읽는다(값을 출력하지 않는다) */
function readEnv(keys) {
  if (!fs.existsSync(ENV_FILE)) return {}
  const out = {}
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && keys.includes(m[1])) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}
const KEYS = ['VF_ADMIN_EMAIL', 'VF_ADMIN_PASSWORD', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']

function taskApproval() {
  const q = JSON.parse(fs.readFileSync(path.join(CONTROL, 'state/TASK_QUEUE.json'), 'utf8'))
  return (q.tasks ?? q).find((t) => t.task_id === TASK)?.approval ?? null
}

function args(a = process.argv.slice(2)) {
  const get = (k) => { const i = a.indexOf(k); return i < 0 ? null : a[i + 1] }
  return { cmd: a[0], stage: get('--stage'), confirmSha: get('--confirm-sha'), approvalNonce: get(NONCE_FLAG) }
}

async function main() {
  const o = args()
  if (!['preflight', 'apply'].includes(o.cmd) || o.stage !== 't0098') fail(1, '사용법: preflight|apply --stage t0098 [--confirm-sha <sha>]')
  const fileSha = sha(fs.readFileSync(path.join(ROOT, SQL)))
  const env = readEnv(KEYS)
  const missing = KEYS.filter((k) => !env[k])
  const appr = taskApproval()
  if (o.cmd === 'preflight') {
    console.log(JSON.stringify({ sql: SQL, sql_sha256: fileSha, approval: appr ? { by: appr.by, via: appr.via, sql_sha256: appr.sql_sha256 } : null, env_missing: missing, tsx: fs.existsSync(TSX), supabase_js: fs.existsSync(SUPABASE_JS) }, null, 2))
    return
  }
  if (o.confirmSha !== fileSha) fail(2, `--confirm-sha 가 현재 SQL sha(${fileSha})와 다르다 — SQL 이 바뀌었으면 다시 보고 승인해야 한다`)
  if (missing.length) fail(2, `관리자 실행 변수 없음: ${missing.join(', ')} (${ENV_FILE})`)

  // 승인 — 승인 창 티켓 또는 TTY 입력
  let approvedVia
  if (o.approvalNonce) {
    const r = consumeTicket({ runner: RUNNER, stage: o.stage, sha: o.confirmSha, nonce: o.approvalNonce })
    if (!r.ticket) fail(2, r.reason)
    approvedVia = `popup-ticket ${r.ticket.id ?? r.ticket.issued_at}`
  } else if (process.stdin.isTTY && process.stdout.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const ans = (await rl.question(`승인하려면 입력: APPLY ${RUNNER} ${o.confirmSha}\n> `)).trim()
    rl.close()
    if (ans !== `APPLY ${RUNNER} ${o.confirmSha}`) fail(2, '입력이 달라 중단')
    approvedVia = 'tty-confirm'
  } else fail(2, `${NONCE_FLAG} 가 없다 — Claude Code 승인 창에서 허용된 명령이 아니다`)

  // AI-Control 에 승인 기록(이미 같은 SQL 로 승인돼 있으면 그대로)
  if (!(appr?.by === 'user' && appr.sql_sha256 === fileSha)) {
    const r = spawnSync(process.execPath, [path.join(CONTROL, 'bin/vfc.mjs'), 'task', 'approve', TASK, '--by', 'user', '--ref', `승인 창 허용(${approvedVia}) · ${SQL}`, '--sql-sha256', fileSha], { cwd: CONTROL, encoding: 'utf8' })
    if (r.status !== 0) fail(2, `AI-Control 승인 기록 실패: ${(r.stderr || r.stdout).trim().slice(-400)}`)
  }

  // 관리자 로그인 세션 실행기 — 같은 SQL 의 RPC 를 같은 인자로 부른다
  const run = spawnSync(TSX, ['../../scripts/research/goal-data/authored-ai-review/record-nonrelease.mts', '--execute', '--confirm', fileSha], {
    cwd: path.join(ROOT, 'apps/web'), encoding: 'utf8', shell: process.platform === 'win32',
    env: { ...process.env, ...env, TSX_TSCONFIG_PATH: 'tsconfig.json', VF_SUPABASE_JS: SUPABASE_JS, VF_CONTROL_ROOT: CONTROL },
  })
  process.stdout.write(run.stdout ?? '')
  process.stderr.write(run.stderr ?? '')
  if (run.status !== 0) fail(4, '실행 중 실패 — 다시 돌리기 전에 결과(content_ai_decision 등)를 조회할 것. 등록 · 결정 · 자격은 같은 입력이면 같은 행이라 재실행 안전')
}

await main()
