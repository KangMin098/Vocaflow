#!/usr/bin/env node
// poc/work-bridge.mjs — ChatGPT Work 이벤트 연결 PoC (WF-S8/S10). **PoC — AI-Control 본체에 통합하지 않았다.**
//
// 가설: ChatGPT Work 의 「GitHub PR 이벤트 트리거」가 교환 저장소의 PR 을 보고 자동 실행되고, 응답을 PR 댓글(또는 파일)로 남긴다.
// 공식 문서로 확인된 것은 트리거(PR 활동, 필터: PR·작성자·제목·라벨)뿐이다. **Work 의 GitHub 쓰기는 미확인** — 실측 대상.
//
// 교환 프로토콜(vfc-bridge/1) — docs/WORK_BRIDGE_POC.md
//   publish <REQ> --repo owner/exchange
//       브랜치 vfc/<REQ> · requests/<REQ>.md(thread 요청서) · requests/<REQ>.context/*(Context Packet) · 라벨 vfc-request · 제목 「[vfc] <REQ> <goal> <round> v<n>」 PR
//   collect --repo owner/exchange [--authors a,b]
//       그 PR 의 댓글 · responses/<REQ>.response.md 에서 ```json vfc-response``` 블록 하나 → planning/responses/<REQ>.response.md (.part → rename)
//       판정(thread·목표·라운드·설계 버전·중복·승인 경계)은 기존 `vfc ugoal intake` 가 한다 — 여기서는 요청 id 일치만 본다.
//   status
//       턴별 시각(published · collected · intake 는 상태 파일)으로 Work 대기 상한을 낸다.
//
// GitHub 은 gh CLI(사용자 인증)만 쓴다(VFC_GH_CMD 로 바꿀 수 있다 — 테스트는 가짜 gh). 브라우저 매크로·쿠키·OpenAI API 없음.

import fs from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(process.env.VFC_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'))
const LOG = path.join(ROOT, 'planning', 'bridge-log.jsonl')
const argv = process.argv.slice(2)
const cmd = argv[0]
const opt = {}
const pos = []
for (let i = 1; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    const k = argv[i].slice(2)
    opt[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true
  } else pos.push(argv[i])
}
const GH = (process.env.VFC_GH_CMD || 'gh').split(' ')
const gh = (args, input) => execFileSync(GH[0], [...GH.slice(1), ...args], { encoding: 'utf8', input, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] }).trim()
const ghJson = (args) => JSON.parse(gh(args))
const dry = !!opt['dry-run']
const out = (o) => console.log(JSON.stringify(o, null, 2))
const log = (rec) => {
  fs.mkdirSync(path.dirname(LOG), { recursive: true })
  fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), ...rec }) + '\n')
}
const readLog = () => (fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [])

function header(reqFile) {
  const m = fs.readFileSync(reqFile, 'utf8').match(/```json vfc-request\s*\n([\s\S]*?)\n```/)
  if (!m) throw new Error(`${reqFile}: vfc-request 블록 없음`)
  return JSON.parse(m[1])
}

// ── 게시 전 검사(WF-S11) — 하나라도 걸리면 게시하지 않는다 ──
// 비밀값·자격증명 · 개인정보(이메일·전화) · 비공개 운영 정보(Supabase 프로젝트 ref·호스트·DB URL) · 데이터 덤프
const SCAN = [
  ['secret_key', /sk-[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.|-----BEGIN [A-Z ]*PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{20,}/],
  ['credential_assignment', /\b[A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD)\b\s*[:=]\s*["']?(?!\[REDACTED\])[^\s"']{6,}/],
  ['db_url', /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"'`]+/i],
  ['supabase_host', /\b[a-z0-9]{20}\.supabase\.(?:co|in)\b/i],
  ['supabase_project_ref', /\bjajenrevcbmrpaliomxv\b/],
  ['email', /\b[A-Za-z0-9._%+-]+@(?!example\.(?:com|org)\b)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/],
  ['phone_kr', /\b01[016789][- ]?\d{3,4}[- ]?\d{4}\b/],
  ['sql_dump', /\bINSERT\s+INTO\s+\w+.*\bVALUES\b|\bCOPY\s+\w+.*\bFROM\s+stdin\b/i],
]
// 교환 저장소로 내보내는 패킷 파일(사용자 승인 범위 2026-10-09: 정본·코드 경로·최소 발췌·테스트·기준 커밋) — 다른 작업·owner·결정 기록 파일은 내보내지 않는다
const BRIDGE_CONTEXT_ALLOW = new Set(['platform-summary.md', 'goal-brief.md', 'existing-features.md', 'recent-changes.md', 'unverified-assumptions.md', 'evidence-manifest.json'])
const ALLOW_EMAIL = /noreply@anthropic\.com|t@example\.com/

export function scanFiles(files) {
  const findings = []
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8')
    if (/\.(sql|csv|tsv|jsonl|dump)$/i.test(f)) findings.push({ file: f, rule: 'data_file_type', excerpt: path.basename(f) })
    for (const [rule, re] of SCAN) {
      const m = text.match(re)
      if (!m) continue
      if (rule === 'email' && ALLOW_EMAIL.test(m[0])) continue
      findings.push({ file: f, rule, excerpt: m[0].slice(0, 12) + '…' })
    }
  }
  return findings
}

function packetFiles(id) {
  const reqFile = path.join(ROOT, 'planning', 'requests', `${id}.md`)
  const h = header(reqFile)
  const ctxDir = path.join(ROOT, 'context', h.thread?.goal_ref || '_')
  const ctx = (h.attachments || []).map((a) => path.resolve(a.path)).filter((p) => p.startsWith(path.resolve(ctxDir) + path.sep) && fs.existsSync(p) && BRIDGE_CONTEXT_ALLOW.has(path.basename(p)))
  return { reqFile, h, ctx }
}

/** 사람이 볼 미리보기: 올릴 파일 목록·크기·sha·검사 결과 → planning/bridge-preview/<REQ>.md */
function preview(id) {
  const t0 = Date.now()
  const { reqFile, h, ctx } = packetFiles(id)
  const files = [reqFile, ...ctx]
  const findings = scanFiles(files)
  const rows = files.map((f) => {
    const buf = fs.readFileSync(f)
    return { path: path.relative(ROOT, f).split(path.sep).join('/'), bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16) }
  })
  const dir = path.join(ROOT, 'planning', 'bridge-preview')
  fs.mkdirSync(dir, { recursive: true })
  const pf = path.join(dir, `${id}.md`)
  fs.writeFileSync(pf, [`# 게시 미리보기 ${id}`, '', `목표 ${h.thread?.goal_ref} · thread ${h.thread?.thread_id} · round ${h.thread?.round_id} · 설계 v${h.thread?.design_version} · 기준 제품 커밋 ${h.thread?.context_base_commit ?? '(패킷 없음)'}`, '', '| 파일 | 바이트 | sha256(16) |', '|---|---|---|', ...rows.map((r) => `| ${r.path} | ${r.bytes} | ${r.sha256} |`), '', `총 ${rows.reduce((a, r) => a + r.bytes, 0)} 바이트 · 검사 ${findings.length ? `**실패 ${findings.length}건 — 게시 금지**` : '통과'}`, '', ...findings.map((x) => `- ${x.rule} · ${path.basename(x.file)} · ${x.excerpt}`)].join('\n'))
  log({ event: 'previewed', request_id: id, files: rows.length, bytes: rows.reduce((a, r) => a + r.bytes, 0), findings: findings.length, ms: Date.now() - t0 })
  return { preview: path.relative(ROOT, pf), files: rows, findings }
}

function putFile(repo, branch, dest, buf, message) {
  gh(['api', '-X', 'PUT', `repos/${repo}/contents/${dest}`, '-f', `message=${message}`, '-f', `branch=${branch}`, '-f', `content=${Buffer.from(buf).toString('base64')}`])
}

function publish(id) {
  if (!opt.repo) throw new Error('--repo owner/exchange 필요')
  const reqFile = path.join(ROOT, 'planning', 'requests', `${id}.md`)
  if (!fs.existsSync(reqFile)) throw new Error(`${reqFile} 없음`)
  const h = header(reqFile)
  if (!h.thread) throw new Error(`${id} 는 thread 요청이 아니다(ugoal request-design 으로 만든 요청만)`)
  const log0 = readLog()
  const collected = new Set(log0.filter((e) => e.event === 'collected').map((e) => e.request_id))
  const prior = log0.filter((e) => e.event === 'published' && e.request_id === id)
  // --retry: 응답을 못 받은 요청만 — 옛 PR 을 닫고 새 브랜치로 다시 연다(같은 요청 id · 새 PR 이벤트)
  if (prior.length && !opt.retry) throw new Error(`${id} 는 이미 게시했다 — 응답이 없으면 --retry 로 다시 트리거한다`)
  if (prior.length && collected.has(id)) throw new Error(`${id} 는 이미 응답을 받았다 — 다시 올리지 않는다`)
  // 한 번에 하나: Work 는 가까이 온 PR 이벤트를 한 실행으로 합치고 마지막 PR 만 답했다(실측 PR #3·#4, 8초 간격) — 응답 대기 중인 다른 요청이 있으면 게시하지 않는다
  const waiting = [...new Set(log0.filter((e) => e.event === 'published' && e.request_id !== id).map((e) => e.request_id))].filter((r) => !collected.has(r))
  if (waiting.length && !opt.parallel) throw new Error(`응답 대기 중인 요청이 있다(${waiting.join(', ')}) — 한 번에 하나씩 게시한다(동시 게시는 Work 가 하나만 답한다). 무시하려면 --parallel`)
  // Context Packet: 요청 헤더의 첨부 중 context/<UG>/ 아래 파일만(그 밖의 로컬 파일은 올리지 않는다)
  const ctxDir = path.join(ROOT, 'context', h.thread.goal_ref)
  const ctx = (h.attachments || []).map((a) => path.resolve(a.path)).filter((p) => p.startsWith(path.resolve(ctxDir) + path.sep) && fs.existsSync(p) && BRIDGE_CONTEXT_ALLOW.has(path.basename(p)))
  // 요청서에 기록된 첨부 sha256 과 지금 파일이 다르면(패킷을 요청 뒤에 다시 만들었다) 게시하지 않는다 — 요청과 실제 보낸 근거가 어긋난다
  const stale = (h.attachments || []).filter((a) => ctx.includes(path.resolve(a.path)) && crypto.createHash('sha256').update(fs.readFileSync(a.path)).digest('hex') !== a.sha256)
  if (stale.length) throw new Error(`첨부가 요청 기록과 다르다(${stale.map((a) => path.basename(a.path)).join(', ')}) — vfc ugoal cancel-request 후 request-design 으로 다시 만든다`)
  const scan = scanFiles([reqFile, ...ctx])
  if (scan.length) {
    log({ event: 'publish_refused', request_id: id, findings: scan.map((x) => x.rule) })
    throw new Error(`게시 전 검사 실패 ${scan.length}건(${[...new Set(scan.map((x) => x.rule))].join(', ')}) — 게시하지 않는다. node poc/work-bridge.mjs preview ${id} 로 확인`)
  }
  const branch = prior.length ? `vfc/${id}-r${prior.length + 1}` : `vfc/${id}`
  if (prior.length && !dry) {
    for (const pr of prior) {
      try {
        gh(['pr', 'close', pr.pr, '--repo', opt.repo, '--comment', `응답이 없어 다시 트리거한다(--retry) — 새 PR 로 이어진다`])
      } catch {
        /* 이미 닫혔다 */
      }
    }
  }
  const title = `[vfc] ${id} ${h.thread.goal_ref} ${h.thread.round_id} v${h.thread.design_version}`
  const body = [
    // 실제로 올린 파일만 안내한다 — 없는 .context 폴더를 가리키면 Work 가 「연결 자료 읽기 실패」 로 needs_info 를 낸다(실측 PR #1)
    `ChatGPT Work 에게: 이 PR 의 \`requests/${id}.md\` 를 읽고${ctx.length ? `(최신 플랫폼 정보는 \`requests/${id}.context/\` 의 ${ctx.length}개 파일)` : '(이 요청에는 첨부 컨텍스트가 없다 — 요청서만으로 판단하고 가정은 unverified 로 표시)'}, 그 파일의 「응답 규칙」대로 \`\`\`json vfc-response\`\`\` 블록 하나를 **이 PR 의 댓글**로 남겨 주세요.`,
    `thread_id=${h.thread.thread_id} · goal_ref=${h.thread.goal_ref} · round_id=${h.thread.round_id} · design_version=${h.thread.design_version}`,
    `기준 제품 커밋(Vocaflow main · 패킷의 근거): ${h.thread.context_base_commit ?? '없음'} — 이 PR 의 head 커밋(교환 저장소 revision)과는 다르다. 응답의 context_base_commit 에 이 값을 그대로 돌려주고, 패킷에 없는 코드는 unverified 로 표시한다. allowed_paths 는 패킷에서 확인한 실제 경로만 쓴다(근거 없으면 비운다).`,
    `응답은 제안일 뿐이며 사용자 승인 전에는 실행되지 않습니다. 이 PR 은 머지하지 않습니다.`,
  ].join('\n\n')
  const plan = { repo: opt.repo, branch, title, label: 'vfc-request', files: [`requests/${id}.md`, ...ctx.map((p) => `requests/${id}.context/${path.basename(p)}`)] }
  if (dry) return out({ dry_run: true, ...plan })
  const tPub = Date.now()
  const def = ghJson(['api', `repos/${opt.repo}`]).default_branch
  const baseSha = ghJson(['api', `repos/${opt.repo}/git/ref/heads/${def}`]).object.sha
  gh(['api', '-X', 'POST', `repos/${opt.repo}/git/refs`, '-f', `ref=refs/heads/${branch}`, '-f', `sha=${baseSha}`])
  putFile(opt.repo, branch, `requests/${id}.md`, fs.readFileSync(reqFile), `vfc: ${id} 요청`)
  for (const p of ctx) putFile(opt.repo, branch, `requests/${id}.context/${path.basename(p)}`, fs.readFileSync(p), `vfc: ${id} context ${path.basename(p)}`)
  try {
    gh(['label', 'create', 'vfc-request', '--repo', opt.repo, '--color', '5319e7', '--description', 'Vocaflow AI-Control 설계 요청'])
  } catch {
    /* 이미 있다 */
  }
  const url = gh(['pr', 'create', '--repo', opt.repo, '--head', branch, '--base', def, '--title', title, '--label', 'vfc-request', '--body', body])
  log({ event: 'published', request_id: id, ug: h.thread.goal_ref, round_id: h.thread.round_id, design_version: h.thread.design_version, pr: url, files: plan.files.length, context_base_commit: h.thread.context_base_commit ?? null, ms: Date.now() - tPub })
  out({ published: id, pr: url, ...plan })
}

function collect() {
  if (!opt.repo) throw new Error('--repo owner/exchange 필요')
  const found = collectOnce({ authors: opt.authors ? String(opt.authors).split(',').map((s) => s.trim().toLowerCase()) : null, app: opt.app || null })
  out({ repo: opt.repo, results: found, next: found.some((f) => f.status === 'collected') ? 'node bin/vfc.mjs ugoal intake --by user' : null })
}

function collectOnce({ authors, app }) {
  const prs = ghJson(['pr', 'list', '--repo', opt.repo, '--label', 'vfc-request', '--state', 'all', '--json', 'number,title,headRefName,createdAt', '--limit', '100'])
  const found = []
  for (const pr of prs) {
    const id = (pr.title.match(/(REQ-\d{8}-\d{3})/) || [])[1]
    if (!id) continue
    const sources = []
    for (const c of ghJson(['api', `repos/${opt.repo}/issues/${pr.number}/comments?per_page=100`])) sources.push({ kind: 'comment', author: c.user.login, author_type: c.user.type, app: c.performed_via_github_app?.slug ?? null, at: c.created_at, body: c.body, ref: c.html_url })
    try {
      const f = ghJson(['api', `repos/${opt.repo}/contents/responses/${id}.response.md?ref=${pr.headRefName}`])
      sources.push({ kind: 'file', author: null, at: null, body: Buffer.from(f.content, 'base64').toString('utf8'), ref: f.html_url })
    } catch {
      /* 응답 파일 없음 */
    }
    for (const s of sources) {
      const blocks = [...String(s.body).matchAll(/```json vfc-response\s*\n([\s\S]*?)\n```/g)]
      if (blocks.length !== 1) continue
      // Work 댓글은 사용자 명의 + 앱(performed_via_github_app) 으로 달린다(실측 chatgpt-codex-connector) — 사람이 단 댓글과 가르려면 --app 으로 앱을 고정한다
      if (app && s.kind === 'comment' && s.app !== app) {
        found.push({ id, pr: pr.number, source: s.ref, author: s.author, app: s.app, status: 'ignored_app' })
        continue
      }
      if (authors && s.author && !authors.includes(s.author.toLowerCase())) {
        found.push({ id, pr: pr.number, source: s.ref, author: s.author, status: 'ignored_author' })
        continue
      }
      let j
      try {
        j = JSON.parse(blocks[0][1])
      } catch (e) {
        found.push({ id, pr: pr.number, source: s.ref, status: 'bad_json', error: e.message })
        continue
      }
      if (j.request_id !== id) {
        found.push({ id, pr: pr.number, source: s.ref, status: 'request_id_mismatch', got: j.request_id })
        continue
      }
      const dest = path.join(ROOT, 'planning', 'responses', `${id}.response.md`)
      const already = fs.existsSync(dest) || fs.existsSync(path.join(ROOT, 'planning', 'archive', `${id}.response.md`)) || readLog().some((e) => e.event === 'collected' && e.request_id === id)
      if (already) {
        found.push({ id, pr: pr.number, source: s.ref, status: 'already_collected' })
        continue
      }
      const text = `<!-- collected by poc/work-bridge.mjs from ${s.ref} (author ${s.author ?? 'file'} · ${s.at ?? '-'}) -->\n\n\`\`\`json vfc-response\n${blocks[0][1]}\n\`\`\`\n`
      if (!dry) {
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.writeFileSync(`${dest}.part`, text)
        fs.renameSync(`${dest}.part`, dest) // ugoal intake 는 .part 를 집지 않는다
        log({ event: 'collected', request_id: id, pr: pr.number, author: s.author, author_type: s.author_type, app: s.app ?? null, source: s.kind, responded_at: s.at })
      }
      found.push({ id, pr: pr.number, source: s.ref, author: s.author, author_type: s.author_type, status: dry ? 'would_collect' : 'collected', file: path.relative(ROOT, dest) })
    }
  }
  return found
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function inflight() {
  const ev = readLog()
  const got = new Set(ev.filter((e) => e.event === 'collected').map((e) => e.request_id))
  return [...new Set(ev.filter((e) => e.event === 'published').map((e) => e.request_id))].filter((r) => !got.has(r))
}

/**
 * 대기 요청이 있는 동안 --interval 초마다 collect(--app) → 새로 모았으면 vfc ugoal intake.
 * 끝: 대기 요청 0 · --timeout-min 경과 · planning/bridge-watch.STOP · API 연속 오류 --max-errors.
 * 겹쳐 돌지 않는다: planning/bridge-watch.lock(wx · pid). 죽은 잠금은 치운다. 재시작해도 이미 모은 것은 already_collected 라 중복 인수 없음.
 */
function watch() {
  if (!opt.repo) throw new Error('--repo owner/exchange 필요')
  const interval = Number(opt.interval || 30) * 1000
  const deadline = Date.now() + Number(opt['timeout-min'] || 30) * 60_000
  const maxErr = Number(opt['max-errors'] || 5)
  const lockF = path.join(ROOT, 'planning', 'bridge-watch.lock')
  const stopF = path.join(ROOT, 'planning', 'bridge-watch.STOP')
  fs.mkdirSync(path.dirname(lockF), { recursive: true })
  try {
    fs.writeFileSync(lockF, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }), { flag: 'wx' })
  } catch {
    let pid = 0
    try {
      pid = JSON.parse(fs.readFileSync(lockF, 'utf8')).pid
    } catch {
      pid = 0
    }
    let alive = false
    try {
      process.kill(pid, 0)
      alive = true
    } catch (e) {
      alive = e.code === 'EPERM'
    }
    if (alive) throw new Error(`다른 watch 가 실행 중이다(pid ${pid}) — 겹쳐 돌지 않는다`)
    fs.writeFileSync(lockF, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }))
  }
  const result = { started_at: new Date().toISOString(), polls: 0, errors: 0, collected: [], intake: [], stop_reason: null }
  try {
    for (;;) {
      if (fs.existsSync(stopF)) {
        result.stop_reason = 'STOP 파일'
        break
      }
      const waiting = inflight()
      if (!waiting.length) {
        result.stop_reason = '대기 요청 없음'
        break
      }
      if (Date.now() > deadline) {
        result.stop_reason = `시간 상한(대기 ${waiting.join(',')})`
        log({ event: 'watch_timeout', waiting })
        break
      }
      result.polls++
      let got = []
      try {
        got = collectOnce({ authors: null, app: opt.app || null }).filter((r) => r.status === 'collected')
        result.errors = 0
      } catch (e) {
        result.errors++
        log({ event: 'watch_error', error: String(e.message).slice(0, 200) })
        if (result.errors >= maxErr) {
          result.stop_reason = `API 연속 오류 ${result.errors}`
          break
        }
      }
      if (got.length) {
        result.collected.push(...got.map((g) => g.id))
        const t = Date.now()
        const VFC = process.env.VFC_CLI || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'vfc.mjs')
        const r = JSON.parse(execFileSync(process.execPath, [VFC, 'ugoal', 'intake', '--min-age-ms', '0', '--by', 'bridge-watch', '--json'], { encoding: 'utf8', env: { ...process.env, VFC_ROOT: ROOT } }))
        result.intake.push(...r.results)
        for (const x of r.results) log({ event: 'intake', request_id: (x.file.match(/(REQ-\d{8}-\d{3})/) || [])[1] ?? null, status: x.status, design_version: x.design_version ?? null, design_incomplete: x.design_incomplete ?? null, ms: Date.now() - t })
        continue
      }
      sleep(interval)
    }
  } finally {
    try {
      if (JSON.parse(fs.readFileSync(lockF, 'utf8')).pid === process.pid) fs.rmSync(lockF, { force: true })
    } catch {
      /* 이미 없다 */
    }
  }
  out(result)
}

/** 턴별 시간: published → (Work 가 댓글을 단 시각) → collected. Work 대기 = 댓글 시각 - 게시 시각(댓글 시각이 없으면 수집 시각까지의 상한) */
function status() {
  const ev = readLog()
  const turns = {}
  for (const e of ev) {
    const t = (turns[e.request_id] ||= { request_id: e.request_id })
    if (e.event === 'previewed') Object.assign(t, { preview_ms: e.ms, packet_files: e.files, packet_bytes: e.bytes })
    if (e.event === 'published') Object.assign(t, { ug: e.ug, round_id: e.round_id, published_at: e.at, pr: e.pr, publish_ms: e.ms ?? null })
    if (e.event === 'intake') Object.assign(t, { intake_at: e.at, intake_status: e.status, intake_ms: e.ms, design_version: e.design_version })
    if (e.event === 'collected') Object.assign(t, { collected_at: e.at, responded_at: e.responded_at, author: e.author, author_type: e.author_type })
  }
  const rows = Object.values(turns).map((t) => {
    const p = Date.parse(t.published_at)
    return { ...t, work_wait_ms: t.responded_at ? Date.parse(t.responded_at) - p : null, collect_lag_ms: t.collected_at ? Date.parse(t.collected_at) - p : null, state: t.collected_at ? 'collected' : t.published_at ? 'waiting_work' : 'unknown' }
  })
  out({ turns: rows, published: rows.filter((r) => r.published_at).length, collected: rows.filter((r) => r.collected_at).length })
}

try {
  if (cmd === 'publish') publish(pos[0])
  else if (cmd === 'collect') collect()
  else if (cmd === 'status') status()
  else if (cmd === 'preview') out(preview(pos[0]))
  else if (cmd === 'watch') watch()
  else {
    console.log('node poc/work-bridge.mjs publish <REQ-id> --repo owner/exchange [--dry-run]\nnode poc/work-bridge.mjs collect --repo owner/exchange [--authors a,b] [--dry-run]\nnode poc/work-bridge.mjs status')
    process.exit(cmd ? 2 : 0)
  }
} catch (e) {
  console.error(e.message)
  process.exit(1)
}
