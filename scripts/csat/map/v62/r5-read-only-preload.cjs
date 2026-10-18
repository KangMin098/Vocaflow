// scripts/csat/map/v62/r5-read-only-preload.cjs
// Independent R5 browser QA: load with NODE_OPTIONS=--require=<absolute path>.
// The Next server may read remote data; ALL remote DB mutations are rejected.
// Fault modes come from R5_REVIEW_FAULT_FILE (local JSON), audit logs contain
// methods and paths only. No credentials, student data, or response bodies.
const fs = require('node:fs')
const http = require('node:http')
const originalWriteHead = http.ServerResponse.prototype.writeHead
http.ServerResponse.prototype.writeHead = function (...args) {
  if (!this.headersSent) this.setHeader('x-vocaflow-r5-read-only', '1')
  return originalWriteHead.apply(this, args)
}
const original = globalThis.fetch
const ledgers = new Set(['learning_task_attempts', 'learning_sessions', 'csat_trap_attempts', 'csat_session_attempts', 'csat_review_queue', 'csat_dx_response'])
// SQL STABLE, SELECT-only (20261005170000_csat_ec_reveal_gate.sql).
const readRpc = new Set(['/rest/v1/rpc/csat_ec_embargoed_exams', '/rest/v1/rpc/csat_ec_embargoed_items'])
globalThis.fetch = async function readOnlyFetch(input, init) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
  const method = String(init?.method ?? (typeof input === 'object' ? input.method : undefined) ?? 'GET').toUpperCase()
  const remote = !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  const audit = (result) => {
    if (process.env.R5_REVIEW_AUDIT_FILE) fs.appendFileSync(process.env.R5_REVIEW_AUDIT_FILE, JSON.stringify({ method, path: url.pathname, result }) + '\n')
  }
  const readOnlyPost = method === 'POST' && (url.pathname === '/auth/v1/token' || readRpc.has(url.pathname))
  if (remote && !['GET', 'HEAD', 'OPTIONS'].includes(method) && !readOnlyPost) {
    audit('blocked')
    throw new Error(`R5 read-only guard blocked ${method} ${url.pathname}`)
  }
  let mode = 'normal'
  try { mode = JSON.parse(fs.readFileSync(process.env.R5_REVIEW_FAULT_FILE, 'utf8')).mode } catch {}
  const table = url.pathname.split('/').at(-1)
  const json = (body, status = 200, count = 0) => {
    audit(`fixture:${mode}`)
    return new Response(method === 'HEAD' ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'content-range': `*/${count}` } })
  }
  if (remote && url.pathname.startsWith('/rest/v1/')) {
    if (mode === 'no_live' && table === 'knowledge_applications' && url.searchParams.get('surface') === 'eq.csat_item_task') return json([])
    if (mode === 'reserved' && ledgers.has(table)) return json([])
    if (mode === 'ledger_error' && table === 'csat_trap_attempts') return json({ code: 'XX000', message: 'isolated ledger fault' }, 503)
    if (table === 'content_qualification') {
      if (mode === 'fq_error') return json({ code: '42501', message: 'isolated FQ read error' }, 403)
      if (mode === 'fq_zero') return json([])
      if (mode === 'fq_missing') return json({ code: 'PGRST205', message: 'isolated FQ not installed' }, 404)
    }
  }
  if (remote) audit('read_or_auth')
  return original.call(this, input, init)
}
