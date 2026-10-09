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

function putFile(repo, branch, dest, buf, message) {
  gh(['api', '-X', 'PUT', `repos/${repo}/contents/${dest}`, '-f', `message=${message}`, '-f', `branch=${branch}`, '-f', `content=${Buffer.from(buf).toString('base64')}`])
}

function publish(id) {
  if (!opt.repo) throw new Error('--repo owner/exchange 필요')
  const reqFile = path.join(ROOT, 'planning', 'requests', `${id}.md`)
  if (!fs.existsSync(reqFile)) throw new Error(`${reqFile} 없음`)
  const h = header(reqFile)
  if (!h.thread) throw new Error(`${id} 는 thread 요청이 아니다(ugoal request-design 으로 만든 요청만)`)
  if (readLog().some((e) => e.event === 'published' && e.request_id === id)) throw new Error(`${id} 는 이미 게시했다 — 같은 요청을 두 번 올리지 않는다`)
  // Context Packet: 요청 헤더의 첨부 중 context/<UG>/ 아래 파일만(그 밖의 로컬 파일은 올리지 않는다)
  const ctxDir = path.join(ROOT, 'context', h.thread.goal_ref)
  const ctx = (h.attachments || []).map((a) => path.resolve(a.path)).filter((p) => p.startsWith(path.resolve(ctxDir) + path.sep) && fs.existsSync(p))
  const branch = `vfc/${id}`
  const title = `[vfc] ${id} ${h.thread.goal_ref} ${h.thread.round_id} v${h.thread.design_version}`
  const body = [
    `ChatGPT Work 에게: 이 PR 의 \`requests/${id}.md\` 를 읽고(최신 플랫폼 정보는 \`requests/${id}.context/\`), 그 파일의 「응답 규칙」대로 \`\`\`json vfc-response\`\`\` 블록 하나를 **이 PR 의 댓글**로 남겨 주세요.`,
    `thread_id=${h.thread.thread_id} · goal_ref=${h.thread.goal_ref} · round_id=${h.thread.round_id} · design_version=${h.thread.design_version} · base_commit=${h.thread.base_commit ?? '-'}`,
    `응답은 제안일 뿐이며 사용자 승인 전에는 실행되지 않습니다. 이 PR 은 머지하지 않습니다.`,
  ].join('\n\n')
  const plan = { repo: opt.repo, branch, title, label: 'vfc-request', files: [`requests/${id}.md`, ...ctx.map((p) => `requests/${id}.context/${path.basename(p)}`)] }
  if (dry) return out({ dry_run: true, ...plan })
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
  log({ event: 'published', request_id: id, ug: h.thread.goal_ref, round_id: h.thread.round_id, design_version: h.thread.design_version, pr: url, files: plan.files.length })
  out({ published: id, pr: url, ...plan })
}

function collect() {
  if (!opt.repo) throw new Error('--repo owner/exchange 필요')
  const authors = opt.authors ? String(opt.authors).split(',').map((s) => s.trim().toLowerCase()) : null
  const prs = ghJson(['pr', 'list', '--repo', opt.repo, '--label', 'vfc-request', '--state', 'all', '--json', 'number,title,headRefName,createdAt', '--limit', '100'])
  const found = []
  for (const pr of prs) {
    const id = (pr.title.match(/(REQ-\d{8}-\d{3})/) || [])[1]
    if (!id) continue
    const sources = []
    for (const c of ghJson(['api', `repos/${opt.repo}/issues/${pr.number}/comments?per_page=100`])) sources.push({ kind: 'comment', author: c.user.login, author_type: c.user.type, at: c.created_at, body: c.body, ref: c.html_url })
    try {
      const f = ghJson(['api', `repos/${opt.repo}/contents/responses/${id}.response.md?ref=${pr.headRefName}`])
      sources.push({ kind: 'file', author: null, at: null, body: Buffer.from(f.content, 'base64').toString('utf8'), ref: f.html_url })
    } catch {
      /* 응답 파일 없음 */
    }
    for (const s of sources) {
      const blocks = [...String(s.body).matchAll(/```json vfc-response\s*\n([\s\S]*?)\n```/g)]
      if (blocks.length !== 1) continue
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
        log({ event: 'collected', request_id: id, pr: pr.number, author: s.author, author_type: s.author_type, source: s.kind, responded_at: s.at })
      }
      found.push({ id, pr: pr.number, source: s.ref, author: s.author, author_type: s.author_type, status: dry ? 'would_collect' : 'collected', file: path.relative(ROOT, dest) })
    }
  }
  out({ repo: opt.repo, prs: prs.length, results: found, next: found.some((f) => f.status === 'collected') ? 'node bin/vfc.mjs ugoal intake --by user' : null })
}

/** 턴별 시간: published → (Work 가 댓글을 단 시각) → collected. Work 대기 = 댓글 시각 - 게시 시각(댓글 시각이 없으면 수집 시각까지의 상한) */
function status() {
  const ev = readLog()
  const turns = {}
  for (const e of ev) {
    const t = (turns[e.request_id] ||= { request_id: e.request_id })
    if (e.event === 'published') Object.assign(t, { ug: e.ug, round_id: e.round_id, published_at: e.at, pr: e.pr })
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
  else {
    console.log('node poc/work-bridge.mjs publish <REQ-id> --repo owner/exchange [--dry-run]\nnode poc/work-bridge.mjs collect --repo owner/exchange [--authors a,b] [--dry-run]\nnode poc/work-bridge.mjs status')
    process.exit(cmd ? 2 : 0)
  }
} catch (e) {
  console.error(e.message)
  process.exit(1)
}
