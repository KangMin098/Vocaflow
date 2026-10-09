#!/usr/bin/env node
// poc/work-bridge.mjs — ChatGPT Work 이벤트 연결 PoC (WF-S8). **PoC — AI-Control 본체에 통합하지 않았다.**
//
// 가설: ChatGPT Work 의 「GitHub PR 이벤트 트리거」가 교환 저장소의 PR 을 보고 자동 실행되고, 응답을 PR 댓글(또는 파일)로 남긴다.
// 공식 문서로 확인된 것은 트리거(PR 열림·리뷰·댓글·커밋·머지, 필터: PR·작성자·제목·라벨)뿐이다. **쓰기(댓글·파일)는 미확인** — 실측 대상.
//
//   publish <REQ-id> --repo owner/exchange [--dry-run]
//       planning/requests/<REQ>.md 를 교환 저장소의 새 브랜치 vfc/<REQ> 에 requests/<REQ>.md 로 올리고
//       라벨 vfc-request · 제목 「[vfc] <REQ> <goal_ref> <round_id>」 PR 을 연다(= Work 트리거).
//   collect --repo owner/exchange [--authors a,b] [--dry-run]
//       vfc-request PR 의 댓글과 responses/<REQ>.response.md 파일에서 ```json vfc-response``` 블록을 찾아
//       planning/responses/<REQ>.response.md 로 원자적으로 쓴다(.part → rename). 이후 검증은 `vfc ugoal intake` 가 한다
//       (thread·목표·라운드·설계 버전·중복 — 이 스크립트는 판정하지 않는다). --authors 로 응답 작성자를 제한한다.
//
// 브라우저 매크로·쿠키·OpenAI API 없음. GitHub 은 gh CLI(사용자 인증)만 쓴다.

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(process.env.VFC_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'))
const argv = process.argv.slice(2)
const cmd = argv[0]
const opt = {}
for (let i = 1; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true
const pos = argv.slice(1).filter((a, i, all) => !a.startsWith('--') && !(i > 0 && all[i - 1].startsWith('--') && all[i - 1] !== '--dry-run'))
const gh = (args, input) => execFileSync('gh', args, { encoding: 'utf8', input, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] }).trim()
const dry = !!opt['dry-run']
const out = (o) => console.log(JSON.stringify(o, null, 2))

function header(reqFile) {
  const m = fs.readFileSync(reqFile, 'utf8').match(/```json vfc-request\s*\n([\s\S]*?)\n```/)
  if (!m) throw new Error(`${reqFile}: vfc-request 블록 없음`)
  return JSON.parse(m[1])
}

function publish(id) {
  if (!opt.repo) throw new Error('--repo owner/exchange 필요')
  const reqFile = path.join(ROOT, 'planning', 'requests', `${id}.md`)
  if (!fs.existsSync(reqFile)) throw new Error(`${reqFile} 없음`)
  const h = header(reqFile)
  if (!h.thread) throw new Error(`${id} 는 thread 요청이 아니다(ugoal request-design 으로 만든 요청만)`)
  const branch = `vfc/${id}`
  const title = `[vfc] ${id} ${h.thread.goal_ref} ${h.thread.round_id} v${h.thread.design_version}`
  const body = [
    `ChatGPT Work 에게: 이 PR 의 \`requests/${id}.md\` 를 읽고, 그 파일의 「응답 규칙」대로 \`\`\`json vfc-response\`\`\` 블록 하나를 **이 PR 의 댓글**로 남겨 주세요.`,
    `thread_id=${h.thread.thread_id} · goal_ref=${h.thread.goal_ref} · round_id=${h.thread.round_id} · design_version=${h.thread.design_version} · base_commit=${h.thread.base_commit ?? '-'}`,
    `응답은 제안일 뿐이며 사용자 승인 전에는 실행되지 않습니다. 이 PR 은 머지하지 않습니다.`,
  ].join('\n\n')
  const plan = { repo: opt.repo, branch, path: `requests/${id}.md`, title, label: 'vfc-request' }
  if (dry) return out({ dry_run: true, ...plan })
  const def = gh(['api', `repos/${opt.repo}`, '--jq', '.default_branch'])
  const baseSha = gh(['api', `repos/${opt.repo}/git/ref/heads/${def}`, '--jq', '.object.sha'])
  gh(['api', '-X', 'POST', `repos/${opt.repo}/git/refs`, '-f', `ref=refs/heads/${branch}`, '-f', `sha=${baseSha}`])
  gh(['api', '-X', 'PUT', `repos/${opt.repo}/contents/requests/${id}.md`, '-f', `message=vfc: ${id} 요청`, '-f', `branch=${branch}`, '-f', `content=${Buffer.from(fs.readFileSync(reqFile)).toString('base64')}`])
  try {
    gh(['label', 'create', 'vfc-request', '--repo', opt.repo, '--color', '5319e7', '--description', 'Vocaflow AI-Control 설계 요청'])
  } catch {
    /* 이미 있다 */
  }
  const url = gh(['pr', 'create', '--repo', opt.repo, '--head', branch, '--base', def, '--title', title, '--label', 'vfc-request', '--body', body])
  out({ published: id, pr: url, at: new Date().toISOString(), ...plan })
}

function collect() {
  if (!opt.repo) throw new Error('--repo owner/exchange 필요')
  const authors = opt.authors ? String(opt.authors).split(',').map((s) => s.trim().toLowerCase()) : null
  const prs = JSON.parse(gh(['pr', 'list', '--repo', opt.repo, '--label', 'vfc-request', '--state', 'all', '--json', 'number,title,headRefName,createdAt', '--limit', '100']))
  const found = []
  for (const pr of prs) {
    const id = (pr.title.match(/(REQ-\d{8}-\d{3})/) || [])[1]
    if (!id) continue
    const sources = []
    const comments = JSON.parse(gh(['api', `repos/${opt.repo}/issues/${pr.number}/comments?per_page=100`]))
    for (const c of comments) sources.push({ kind: 'comment', author: c.user.login, author_type: c.user.type, at: c.created_at, body: c.body, ref: c.html_url })
    try {
      const f = JSON.parse(gh(['api', `repos/${opt.repo}/contents/responses/${id}.response.md?ref=${pr.headRefName}`]))
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
      const archived = path.join(ROOT, 'planning', 'archive', `${id}.response.md`)
      if (fs.existsSync(dest) || fs.existsSync(archived)) {
        found.push({ id, pr: pr.number, source: s.ref, status: 'already_collected' })
        continue
      }
      const text = `<!-- collected by poc/work-bridge.mjs from ${s.ref} (author ${s.author ?? 'file'} · ${s.at ?? '-'}) -->\n\n\`\`\`json vfc-response\n${blocks[0][1]}\n\`\`\`\n`
      if (!dry) {
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.writeFileSync(`${dest}.part`, text)
        fs.renameSync(`${dest}.part`, dest) // ugoal intake 는 .part 를 집지 않는다
      }
      found.push({ id, pr: pr.number, source: s.ref, author: s.author, author_type: s.author_type, status: dry ? 'would_collect' : 'collected', file: path.relative(ROOT, dest) })
    }
  }
  out({ repo: opt.repo, prs: prs.length, results: found, next: found.some((f) => f.status === 'collected') ? 'node bin/vfc.mjs ugoal intake --by user' : null })
}

try {
  if (cmd === 'publish') publish(pos[0])
  else if (cmd === 'collect') collect()
  else {
    console.log('node poc/work-bridge.mjs publish <REQ-id> --repo owner/exchange [--dry-run]\nnode poc/work-bridge.mjs collect --repo owner/exchange [--authors a,b] [--dry-run]')
    process.exit(cmd ? 2 : 0)
  }
} catch (e) {
  console.error(e.message)
  process.exit(1)
}
