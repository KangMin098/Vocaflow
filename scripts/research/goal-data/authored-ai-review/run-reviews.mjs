// scripts/research/goal-data/authored-ai-review/run-reviews.mjs
// T-0098 — 창작 세트마다 같은 입력을 Claude · Codex 의 서로 다른 새 세션에 보내 내용 · Gold 독립 검토를 받는다.
// 원본 증거(input.txt · result.txt · session.json)를 그대로 남긴다. DB 를 건드리지 않는다. 재실행 안전 — 이미 exit 0 인 검토는 건너뛴다.
//   node scripts/research/goal-data/authored-ai-review/run-reviews.mjs [--round 1|2] [--only <set_revision>] [--parallel 3]
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'docs/research/goal-data-batches/authored-ai-review')
const MANIFEST = 'docs/final/review/FINAL_CONTENT_DECISION_MANIFEST_20261022.json'
const CLAUDE = process.env.CLAUDE_BIN || path.join(process.env.APPDATA || '', 'npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe')
const CODEX = process.env.CODEX_BIN || 'C:/Program Files/WindowsApps/OpenAI.Codex_26.1016.8622.0_x64__2p2nqsd0c76g0/app/resources/codex.exe'
const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1] }
const only = arg('--only', null)
const parallel = Number(arg('--parallel', '3'))
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex')

const INSTRUCTION = [
  'Fresh independent AI content/Gold reviewer for Vocaflow first-party authored English reading items for Korean high-school learners.',
  'The user assigns all teacher/reviewer roles to Claude Code and Codex. No tools, files, browsing or other sessions: judge only the supplied JSON.',
  'Review every item: passage sentences, stem, every choice or segment or pair, the gold answer, alternatives, distractor explanations, hints and why texts.',
  'Accept an item only if (a) exactly one keyed answer is defensibly correct from the text alone, (b) every other choice is clearly wrong for the stated reason,',
  '(c) explanations match the text and contain no factual claims presented as real findings that cannot be traced (hypothetical examples must read as hypothetical),',
  '(d) English is natural and level-appropriate, Korean text is accurate. Otherwise mark revise or hold and list the concrete gold_issues.',
  'Do not accept merely because a field says so; verify against the supplied text. This is a first-party candidate content judgment, not an external rights grant or release.',
  'Indexing: gold choices and sentence indexes are 0-based. For each item set choice_0based to the gold.answer value you verified, or null when the item has no gold.answer field.',
  "Return one valid JSON object only, with no trailing prose: {verdict:'accept'|'revise'|'hold',source_file_sha256,items:[{id,verdict,choice_0based,gold_issues:[],why}],limitations:[],required_changes:[]}.",
  'verdict for the whole set is accept only if every item is accept. Distinguish actual defects from optional refinements (refinements are not gold_issues) and preserve uncertainty.',
].join(' ')

function run(cmd, args, input, cwd) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd, windowsHide: true })
    p.on('error', (e) => resolve({ code: -1, signal: null, out: '', err: String(e), pid: null }))
    let out = '', err = ''
    p.stdout.on('data', (d) => { out += d })
    p.stderr.on('data', (d) => { err += d })
    p.on('close', (code, signal) => resolve({ code, signal, out, err, pid: p.pid }))
    p.stdin.end(input)
  })
}

async function reviewClaude(dir, prompt, promptSha) {
  const started = new Date().toISOString()
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-rev-c-'))
  const r = await run(CLAUDE, ['-p', '--output-format', 'json', '--max-turns', '1', '--tools', ''], prompt, cwd)
  let j = {}
  try { j = JSON.parse(r.out) } catch { /* 원문 보존 */ }
  const result = typeof j.result === 'string' ? j.result : r.out
  fs.writeFileSync(path.join(dir, 'result.txt'), result)
  fs.writeFileSync(path.join(dir, 'session.json'), JSON.stringify({ agent: 'claude', label: 't0098-authored-review', request_id: j.session_id ?? null, prompt_sha256: promptSha, status: 'exited', started_at: started, pid: r.pid, exit_code: r.code, signal: r.signal, ended_at: new Date().toISOString(), session_id: j.session_id ?? null, is_error: j.is_error ?? (r.code !== 0), cost_usd: j.total_cost_usd ?? null }, null, 2) + '\n')
  if (r.code !== 0) fs.writeFileSync(path.join(dir, 'stderr.txt'), r.err)
  return r.code === 0 && !!j.session_id
}

async function reviewCodex(dir, prompt, promptSha) {
  const started = new Date().toISOString()
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-rev-x-'))
  const last = path.join(cwd, 'last.txt')
  const r = await run(CODEX, ['exec', '--json', '--sandbox', 'read-only', '--skip-git-repo-check', '-C', cwd, '--output-last-message', last, '-'], prompt, cwd)
  let sessionId = null
  for (const line of r.out.split(/\r?\n/)) {
    try { const e = JSON.parse(line); sessionId ??= e.thread_id ?? e.session_id ?? e.msg?.session_id ?? null } catch { /* 이벤트 아님 */ }
  }
  const result = fs.existsSync(last) ? fs.readFileSync(last, 'utf8') : ''
  fs.writeFileSync(path.join(dir, 'result.txt'), result)
  fs.writeFileSync(path.join(dir, 'events.jsonl'), r.out)
  const requestId = crypto.randomUUID()
  fs.writeFileSync(path.join(dir, 'session.json'), JSON.stringify({ agent: 'codex', label: 't0098-authored-review', request_id: requestId, prompt_sha256: promptSha, status: 'exited', started_at: started, session_id: sessionId, exit_code: r.code, ended_at: new Date().toISOString() }, null, 2) + '\n')
  if (r.code !== 0) fs.writeFileSync(path.join(dir, 'stderr.txt'), r.err)
  return r.code === 0 && !!sessionId && !!result
}

const man = JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST), 'utf8'))
const round = Number(arg('--round', '1'))
const tally = round === 2 ? JSON.parse(fs.readFileSync(path.join(OUT, 'round1-tally.json'), 'utf8')) : null
const jobs = []
for (const s of man.sets) {
  if (only && s.set_revision !== only) continue
  const bytes = fs.readFileSync(path.join(ROOT, s.file))
  const fileSha = sha(bytes)
  if (fileSha !== s.file_sha256) { console.error(`SKIP ${s.set_revision}: 파일 sha 가 manifest 와 다르다`); continue }
  // 2차(--round 2): 1차에서 두 모델 모두 수락한 문항만 범위로 다시 검토한다(round1-tally.json). 범위 밖 문항은 검토하지 않았다고 명시한다
  let scopeNote = ''
  if (round === 2) {
    const r1 = tally.sets.find((x) => x.set === s.set_revision)
    if (!r1 || r1.both_accepted.length === 0) continue
    scopeNote = `\n\nREVIEW SCOPE (round 2): review ONLY these item ids: ${JSON.stringify(r1.both_accepted)}. All other items in the file are NOT reviewed and must NOT appear in items[]. The set verdict is accept only if every scoped item is accept.`
  }
  const prompt = `${INSTRUCTION}${scopeNote}\n\nsource_file_sha256: ${fileSha}\nsource_file: ${s.file}\n\n${bytes.toString('utf8')}`
  const promptSha = sha(prompt)
  const base = path.join(OUT, s.set_revision, round === 2 ? 'round2' : '')
  for (const agent of ['claude', 'codex']) {
    const dir = path.join(base, agent)
    const prev = fs.existsSync(path.join(dir, 'session.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'session.json'), 'utf8')) : null
    if (prev && prev.exit_code === 0 && prev.session_id && prev.prompt_sha256 === promptSha) continue
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'input.txt'), prompt)
    jobs.push({ set: s.set_revision, agent, dir, prompt, promptSha })
  }
}
console.log(`검토 ${jobs.length}건 실행(병렬 ${parallel})`)
let i = 0, ok = 0, fail = 0
await Promise.all(Array.from({ length: parallel }, async () => {
  while (i < jobs.length) {
    const j = jobs[i++]
    const good = j.agent === 'claude' ? await reviewClaude(j.dir, j.prompt, j.promptSha) : await reviewCodex(j.dir, j.prompt, j.promptSha)
    good ? ok++ : fail++
    console.log(`${good ? 'OK  ' : 'FAIL'} ${j.set} ${j.agent}`)
  }
}))
console.log(`완료 ok ${ok} · fail ${fail}`)
process.exit(fail ? 2 : 0)
