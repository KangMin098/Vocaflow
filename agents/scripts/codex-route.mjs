#!/usr/bin/env node
// agents/scripts/codex-route.mjs
//
// Claude ↔ 지정 Codex 대화 인계 라우터. 임의 세션이 아니라 agents/sessions.json 에 결속된 **확인된 UUID** 로만 보낸다.
//   resolve  — 논리 이름 → uuid. 없거나 uuid 미확인이면 실패(새 세션으로 대체하지 않는다)
//   verify   — 그 uuid 의 세션 기록(~/.codex/sessions/**/rollout-*-<uuid>.jsonl)이 있고 역할 배정 문구가 있는가
//   compose  — 인계문(작업 ID · PR · HEAD · FI · 수용 기준 · 본문). 작업 ID 로 Codex 응답을 같은 작업에 결속한다
//   deliver  — `codex queue --thread <uuid> --message` 실행 → 큐 id 확인 → 세션 기록에 작업 ID 가 들어갔는지 확인
//   실패하면 「미전달」 과 재개 조건을 돌려준다(부르는 쪽이 GitHub PR/FI 이슈에 남긴다 — --record-issue/--record-pr)
// 자동 리뷰가 아니다: 훅 · 커밋 · PR · 병합이 이 스크립트를 부르지 않는다. 사람 또는 Claude 가 명시적으로 실행한다(router.md 「자동 Codex 리뷰 없음」 유지).
//
// 사용: node agents/scripts/codex-route.mjs send --to Codex-VOCAFLOW-FINAL-ACCEPT --task FINAL-FI006 --pr 303 --head <sha> --fi FI-006 \
//         --criteria "같은 ref 동시 공급 1행" --body-file handoff.md [--record-pr 303] [--dry-run]
//       node agents/scripts/codex-route.mjs check --to Codex-VOCAFLOW-FINAL-ACCEPT

import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { isMain, rel } from './lib.mjs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const TASK_RE = /^[A-Z][A-Z0-9-]{2,63}$/

export function loadRegistry(file = rel('agents', 'sessions.json')) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

/** 논리 이름 → 결속 정보. 이름이 없거나 Codex 가 아니거나 uuid 가 확인되지 않았으면 throw(대체 없음) */
export function resolve(registry, name) {
  const s = registry?.sessions?.[name]
  if (!s) throw new Error(`등록되지 않은 세션 이름: ${name} — 새 세션으로 대체하지 않는다`)
  if (s.agent !== 'codex') throw new Error(`${name} 은 Codex 세션이 아니다`)
  if (!UUID_RE.test(s.uuid ?? '')) throw new Error(`${name} 의 uuid 가 확인되지 않았다 — 사용자가 세션을 만들고 uuid 를 확인해 sessions.json 에 적어야 한다`)
  if (!s.verified?.evidence?.length) throw new Error(`${name} 의 uuid 결속 근거(verified.evidence)가 없다`)
  return { name, uuid: s.uuid, worktree: s.worktree, role: s.role }
}

/** 세션 기록 파일 찾기 — 없으면 null */
export function findRollout(uuid, home = os.homedir()) {
  const root = path.join(home, '.codex', 'sessions')
  if (!fs.existsSync(root)) return null
  const stack = [root]
  while (stack.length) {
    const d = stack.pop()
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) stack.push(p)
      else if (e.name.endsWith(`${uuid}.jsonl`)) return p
    }
  }
  return null
}

/** 세션 기록 검증 — 첫 줄 session_meta.id = uuid 이고 기록 안에 역할 이름이 있는가 */
export function verifyRollout(text, uuid, name) {
  const reasons = []
  let meta = null
  try { meta = JSON.parse(String(text).split('\n', 1)[0]).payload ?? null } catch { /* 형식 오류 */ }
  if (!meta || meta.id !== uuid) reasons.push('session_meta.id 가 uuid 와 다르다')
  if (!String(text).includes(name)) reasons.push(`세션 기록에 역할 이름 ${name} 이 없다`)
  return { ok: reasons.length === 0, reasons }
}

/** 인계문 — 작업 ID 를 첫 줄에 두어 Codex 응답 · 검증 결과를 같은 작업에 결속한다 */
export function compose({ task, from = 'Claude-VOCAFLOW-FINAL-OWNER', to, pr, head, fi = [], criteria = [], body = '' }) {
  if (!TASK_RE.test(task ?? '')) throw new Error('작업 ID 형식(대문자 · 숫자 · 하이픈 3~64자)')
  if (!/^[0-9a-f]{7,40}$/.test(head ?? '')) throw new Error('HEAD sha 가 필요하다')
  if (!pr) throw new Error('PR 번호가 필요하다')
  const lines = [
    `[VF-TASK ${task}] ${from} → ${to}`,
    `PR: #${pr} · HEAD: ${head}`,
    `FI: ${fi.length ? fi.join(', ') : '없음'}`,
    '수용 기준:',
    ...(criteria.length ? criteria.map((c) => `- ${c}`) : ['- (본문 참조)']),
    '',
    String(body).trim(),
    '',
    `응답 · 판정의 첫 줄에 [VF-TASK ${task}] 를 그대로 적어 주세요(같은 작업에 결속).`,
    `판정 줄 형식: 「HEAD ${head} · 판정 ACCEPT|ACCEPT_WITH_LIMITS|REWORK」 — 지적은 줄마다 P0 · P1 · P2 를 붙여 주세요.`,
  ]
  return lines.join('\n')
}

const CODEX_CANDIDATES = () => {
  const ext = path.join(os.homedir(), '.vscode', 'extensions')
  const out = []
  if (fs.existsSync(ext)) for (const d of fs.readdirSync(ext).filter((x) => x.startsWith('openai.chatgpt-')).sort().reverse()) {
    out.push(path.join(ext, d, 'bin', 'windows-x86_64', 'codex.exe'), path.join(ext, d, 'bin', 'linux-x86_64', 'codex'), path.join(ext, d, 'bin', 'macos-aarch64', 'codex'))
  }
  return out
}
export function codexBin(env = process.env) {
  if (env.VF_CODEX_BIN) return env.VF_CODEX_BIN
  return CODEX_CANDIDATES().find((p) => fs.existsSync(p)) ?? 'codex'
}

/** 실제 전달 — 성공이면 { delivered:true, queueId }, 실패면 { delivered:false, reason, resume } */
export function deliver({ registry, to, message, run = execFileSync, home = os.homedir(), bin = codexBin() }) {
  let target
  try { target = resolve(registry, to) } catch (e) { return { delivered: false, reason: e.message, resume: 'sessions.json 에 확인된 uuid 를 적은 뒤 다시 보낸다' } }
  const file = findRollout(target.uuid, home)
  if (!file) return { delivered: false, reason: `세션 기록 없음(${target.uuid})`, resume: '해당 Codex 대화가 이 기기에 있는지 확인한다 — 새 세션으로 대체하지 않는다' }
  const v = verifyRollout(fs.readFileSync(file, 'utf8'), target.uuid, to)
  if (!v.ok) return { delivered: false, reason: v.reasons.join(' · '), resume: 'uuid 결속을 다시 확인한다' }
  const nonce = message.match(/^\[VF-TASK [^\]]+\]/)?.[0]
  if (!nonce) return { delivered: false, reason: '인계문 첫 줄에 작업 ID 가 없다', resume: 'compose 로 인계문을 만든다' }
  const before = fs.statSync(file).size
  let out
  try { out = String(run(bin, ['queue', '--thread', target.uuid, '--message', message], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 })) } catch (e) {
    return { delivered: false, reason: `codex queue 실패: ${String(e.stderr || e.message).slice(0, 200)}`, resume: 'Codex 런타임(VS Code 확장 · app-server)을 연 뒤 같은 인계문을 다시 보낸다' }
  }
  const queueId = out.match(/Queued message ([0-9a-f-]{36}) for thread ([0-9a-f-]{36})/)
  if (!queueId || queueId[2] !== target.uuid) return { delivered: false, reason: `큐 응답을 확인할 수 없다: ${out.slice(0, 160)}`, resume: '세션 기록을 확인한 뒤 다시 보낸다' }
  // 큐 접수 ≠ 처리. 대화가 다른 턴을 진행 중이면 큐 메시지는 그 턴이 끝난 뒤 세션 기록에 들어간다 → status 'queued'(처리 대기)
  const after = fs.readFileSync(file, 'utf8')
  const landed = after.length > before && after.slice(Math.max(0, before - 4096)).includes(nonce)
  return { delivered: true, status: landed ? 'landed' : 'queued', queueId: queueId[1], uuid: target.uuid, rollout: file }
}

/** 처리 확인 — 세션 기록에 그 작업 ID 가 들어갔는가(나중에 다시 부른다) */
export function confirmLanded({ registry, to, task, home = os.homedir() }) {
  const target = resolve(registry, to)
  const file = findRollout(target.uuid, home)
  if (!file) return { landed: false, reason: '세션 기록 없음' }
  return { landed: fs.readFileSync(file, 'utf8').includes(`[VF-TASK ${task}]`), uuid: target.uuid }
}

/** GitHub 기록(전달 · 미전달 모두) — 부르는 쪽이 선택 */
export function recordOnGitHub({ kind, number, task, result, run = execFileSync }) {
  const body = result.delivered
    ? `[VF-TASK ${task}] Codex 대화(${result.uuid}) ${result.status === 'landed' ? '세션 기록 반영 확인' : '큐 접수 · 처리 대기(대화가 진행 중인 턴 뒤에 처리)'} · 큐 id \`${result.queueId}\`.`
    : `[VF-TASK ${task}] **Codex 미전달** — ${result.reason}\n재개 조건: ${result.resume}\n(새 Codex 세션으로 대체하지 않았다.)`
  run('gh', [kind === 'issue' ? 'issue' : 'pr', 'comment', String(number), '--body', body], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

// ── 인계 · 판정 결속(2026-10-19 협업 속도 지시) ─────────────────────────
// 여전히 자동 리뷰가 아니다 — 구현을 마친 쪽이 push 직후 `handoff` 한 번을 부르면 인계문을 git 에서 조립하고,
// 같은 작업 · 같은 SHA · 같은 diff · 같은 수용 기준의 유효한 판정이 이미 있으면 다시 보내지 않는다. 결과는 `verdict` 로 같은 작업 + SHA 에 결속한다.

/** 기존 상한 — 트랙(작업 ID)당 Codex 리뷰 3회(2026-10-06 작업 방식 · 계획 ≤1 + 차단 리뷰). 넘기면 보내지 않고 분류만 한다 */
export const MAX_ROUNDS = 3
const LEDGER = () => rel('.agent-handoff', 'review-ledger.json')

export function loadLedger(file = LEDGER()) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return { tasks: {} } }
}
export function saveLedger(ledger, file = LEDGER()) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(ledger, null, 2)}\n`)
}

/** 리뷰 재사용 키 — HEAD · base..HEAD diff 바이트 · 수용 기준. 하나라도 다르면 새 리뷰 대상이다 */
export function reviewKey({ head, diff, criteria = [] }) {
  return crypto.createHash('sha256').update(JSON.stringify([head, crypto.createHash('sha256').update(String(diff)).digest('hex'), [...criteria].map(String)])).digest('hex')
}

/** git 에서 인계 재료 — HEAD · 변경 파일 · diff(키 계산용) */
export function gitFacts({ base = 'origin/main', run = execFileSync } = {}) {
  const g = (...a) => String(run('git', a, { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] })).trim()
  const head = g('rev-parse', 'HEAD')
  const files = g('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean)
  return { head, files, diff: g('diff', `${base}...HEAD`) }
}

/** .agent-goal.md 의 「수용 기준」 절 항목(없으면 빈 목록 — 부르는 쪽이 --criteria 로 준다) */
export function goalCriteria(text) {
  const m = String(text ?? '').replace(/\r\n/g, '\n').match(/^#+\s*수용 기준[^\n]*\n([\s\S]*?)(?=\n#+\s|(?![\s\S]))/m)
  return m ? m[1].split('\n').map((l) => l.replace(/^\s*(?:[-*]|\d+\.)\s*(?:\[[ xX]\]\s*)?/, '').trim()).filter(Boolean) : []
}

/**
 * 보낼지 판단 — reuse: 같은 키의 판정이 이미 있음(다시 보내지 않음) · cap: 상한 도달(REVIEW_UNKNOWN | FIX_REQUIRED) · send: 새 리뷰.
 * 상한은 우회하지 않는다 — 판정 없는 반복은 REVIEW_UNKNOWN, 마지막 판정이 REWORK 면 FIX_REQUIRED(승인된 별도 수정 작업으로).
 */
export function planHandoff(ledger, task, key, max = MAX_ROUNDS) {
  const t = ledger.tasks?.[task] ?? { rounds: [] }
  const same = t.rounds.find((r) => r.key === key && r.verdict)
  if (same) return { action: 'reuse', round: same }
  if (t.rounds.some((r) => r.key === key && !r.verdict)) return { action: 'pending', round: t.rounds.find((r) => r.key === key) }
  if (t.rounds.length >= max) {
    const last = [...t.rounds].reverse().find((r) => r.verdict)
    return { action: 'cap', status: last?.verdict === 'REWORK' ? 'FIX_REQUIRED' : 'REVIEW_UNKNOWN', rounds: t.rounds.length }
  }
  return { action: 'send', round: t.rounds.length + 1 }
}

/** 자동 인계문 본문 — 변경 파일 · 시험 근거 · 이전 판정의 P0/P1(이미 해결 주장 포함) */
export function handoffBody({ files, evidence = '', prior = null, note = '' }) {
  return [
    `변경 파일(${files.length}):`, ...files.slice(0, 60).map((f) => `- ${f}`), ...(files.length > 60 ? [`- … 외 ${files.length - 60}`] : []),
    '', '시험 근거:', String(evidence).trim() || '- (CI 진행 중 — 결과는 같은 SHA 로 따로 확인)',
    ...(prior ? ['', `직전 판정(${prior.head?.slice(0, 9)} · ${prior.verdict}) 의 P0/P1 — 이번 커밋이 다루는 것:`, ...prior.issues.map((i) => `- [${i.sev}] ${i.text}`)] : []),
    ...(note ? ['', String(note).trim()] : []),
  ].join('\n')
}

const VERDICT_RE = /\b(ACCEPT_WITH_LIMITS|ACCEPT|PASS|REWORK|FAIL|REVIEW_UNKNOWN)\b/
/** Codex 응답 하나 → 판정 · SHA 결속 · P0/P1 지적. 다른 SHA 를 판정한 응답은 bound=false(이 커밋의 수정 대상이 아니다) */
export function parseVerdict(text, { task, head }) {
  const s = String(text ?? '')
  if (!s.startsWith(`[VF-TASK ${task}]`)) return null
  const verdict = (s.match(/(?:전체 판정|판정|verdict)[^A-Z\n]{0,12}\**\s*([A-Z_]+)/i)?.[1] ?? s.match(VERDICT_RE)?.[1] ?? null)
  // 숫자만인 id(GitHub 댓글 번호 등)는 SHA 가 아니다
  const shas = [...new Set((s.match(/\b[0-9a-f]{9,40}\b/g) ?? []).filter((x) => /[a-f]/.test(x)))]
  const bound = !!head && shas.some((x) => head.startsWith(x) || x.startsWith(head.slice(0, 9)))
  const issues = s.replace(/\r\n/g, '\n').split('\n')
    .map((l) => l.trim()).filter((l) => /\bP[01]\b/.test(l) && !/P[01][^\n]{0,8}(없음|0건|none)/i.test(l))
    .map((l) => ({ sev: l.match(/\bP([01])\b/)[0], text: l.replace(/^[-*\d.\s]+/, '').slice(0, 300) }))
  return { verdict: VERDICT_RE.test(verdict ?? '') ? verdict : null, bound, shas, issues }
}

/** 응답이 링크한 PR · 이슈 댓글 본문 — Codex 는 상세 판정(SHA · P1)을 댓글에 두고 응답에는 링크만 남긴다 */
export function linkedComments(text, run = execFileSync) {
  const refs = [...new Set([...String(text).matchAll(/github\.com\/([\w.-]+\/[\w.-]+)\/(?:pull|issues)\/\d+#issuecomment-(\d+)/g)].map((m) => `${m[1]}|${m[2]}`))]
  return refs.map((k) => {
    const [repo, id] = k.split('|')
    try { return String(run('gh', ['api', `repos/${repo}/issues/comments/${id}`, '-q', '.body'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })) } catch { return '' }
  }).join('\n')
}

/** 세션 기록에서 그 작업의 완료 응답들(시각 순) */
export function readReplies(rolloutText, task) {
  const out = []
  for (const l of String(rolloutText).split('\n')) {
    if (!l.includes('task_complete') || !l.includes(`[VF-TASK ${task}]`)) continue
    try { const j = JSON.parse(l); const m = j.payload?.last_agent_message; if (typeof m === 'string' && m.startsWith(`[VF-TASK ${task}]`)) out.push({ at: j.timestamp, text: m }) } catch { /* 형식 오류 줄 */ }
  }
  return out
}

/** 판정 결속 — 보낸 뒤의 응답 중 이 HEAD 에 결속된 마지막 것을 원장 라운드에 기록. 결속 안 된 응답은 기록만 하고 판정으로 쓰지 않는다 */
export function bindVerdict(ledger, task, head, replies) {
  const t = ledger.tasks?.[task]
  const round = t?.rounds.find((r) => r.head === head)
  if (!round) return { status: 'not_sent' }
  const after = replies.filter((r) => !round.sentAt || r.at >= round.sentAt).map((r) => ({ ...r, v: parseVerdict(r.text, { task, head }) })).filter((r) => r.v)
  const hit = [...after].reverse().find((r) => r.v.bound && r.v.verdict)
  if (!hit) return { status: after.length ? 'unbound' : 'waiting', replies: after.length }
  Object.assign(round, { verdict: hit.v.verdict, verdictAt: hit.at, issues: hit.v.issues })
  return { status: 'bound', verdict: hit.v.verdict, issues: hit.v.issues, fix: hit.v.verdict === 'REWORK' ? hit.v.issues : [] }
}

function arg(argv, k) { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined }
function args(argv, k) { return argv.flatMap((a, i) => (a === k ? [argv[i + 1]] : [])).filter(Boolean) }

export function main(argv = process.argv.slice(2)) {
  const cmd = argv[0]
  const registry = loadRegistry()
  const to = arg(argv, '--to') ?? 'Codex-VOCAFLOW-FINAL-ACCEPT'
  if (cmd === 'check') {
    try {
      const t = resolve(registry, to)
      const file = findRollout(t.uuid)
      const v = file ? verifyRollout(fs.readFileSync(file, 'utf8'), t.uuid, to) : { ok: false, reasons: ['세션 기록 없음'] }
      console.log(JSON.stringify({ to, uuid: t.uuid, rollout: file, ...v }))
      return v.ok ? 0 : 2
    } catch (e) { console.log(JSON.stringify({ to, ok: false, reasons: [e.message] })); return 2 }
  }
  if (cmd === 'send') {
    const bodyFile = arg(argv, '--body-file')
    const message = compose({ task: arg(argv, '--task'), to, pr: arg(argv, '--pr'), head: arg(argv, '--head'), fi: args(argv, '--fi'), criteria: args(argv, '--criteria'), body: bodyFile ? fs.readFileSync(bodyFile, 'utf8') : '' })
    if (argv.includes('--dry-run')) { console.log(message); return 0 }
    const result = deliver({ registry, to, message })
    console.log(JSON.stringify(result))
    const pr = arg(argv, '--record-pr'); const issue = arg(argv, '--record-issue')
    if (pr) recordOnGitHub({ kind: 'pr', number: pr, task: arg(argv, '--task'), result })
    if (issue) recordOnGitHub({ kind: 'issue', number: issue, task: arg(argv, '--task'), result })
    return result.delivered ? 0 : 3
  }
  if (cmd === 'confirm') {
    const r = confirmLanded({ registry, to, task: arg(argv, '--task') })
    console.log(JSON.stringify(r))
    return r.landed ? 0 : 4
  }
  if (cmd === 'handoff') {
    const task = arg(argv, '--task')
    const facts = gitFacts({ base: arg(argv, '--base') ?? 'origin/main' })
    const goalFile = arg(argv, '--goal') ?? rel('.agent-goal.md')
    const criteria = args(argv, '--criteria').length ? args(argv, '--criteria') : goalCriteria(fs.existsSync(goalFile) ? fs.readFileSync(goalFile, 'utf8') : '')
    const key = reviewKey({ head: facts.head, diff: facts.diff, criteria })
    const ledger = loadLedger()
    const plan = planHandoff(ledger, task, key)
    if (plan.action !== 'send') { console.log(JSON.stringify({ task, head: facts.head, ...plan })); return plan.action === 'cap' ? 5 : 0 }
    const prior = [...(ledger.tasks?.[task]?.rounds ?? [])].reverse().find((r) => r.verdict === 'REWORK') ?? null
    const ev = arg(argv, '--evidence-file')
    const message = compose({ task, to, pr: arg(argv, '--pr'), head: facts.head.slice(0, 9), fi: args(argv, '--fi'), criteria, body: handoffBody({ files: facts.files, evidence: ev ? fs.readFileSync(ev, 'utf8') : '', prior, note: arg(argv, '--note') ?? '' }) })
    if (argv.includes('--dry-run')) { console.log(message); return 0 }
    const result = deliver({ registry, to, message })
    if (result.delivered) {
      ledger.tasks ??= {}; ledger.tasks[task] ??= { rounds: [] }
      ledger.tasks[task].rounds.push({ round: plan.round, head: facts.head, key, sentAt: new Date().toISOString(), queueId: result.queueId, verdict: null })
      saveLedger(ledger)
    }
    console.log(JSON.stringify({ task, head: facts.head, round: plan.round, ...result }))
    return result.delivered ? 0 : 3
  }
  if (cmd === 'verdict') {
    const task = arg(argv, '--task')
    const head = arg(argv, '--head') ?? gitFacts({ base: arg(argv, '--base') ?? 'origin/main' }).head
    const t = resolve(registry, to)
    const file = findRollout(t.uuid)
    const ledger = loadLedger()
    const replies = (file ? readReplies(fs.readFileSync(file, 'utf8'), task) : []).map((x) => ({ ...x, text: `${x.text}\n${linkedComments(x.text)}` }))
    const r = bindVerdict(ledger, task, head, replies)
    if (r.status === 'bound') saveLedger(ledger)
    console.log(JSON.stringify({ task, head, ...r }))
    return r.status === 'bound' ? 0 : 4
  }
  console.error('사용: codex-route.mjs check|send|confirm|handoff|verdict --to <이름> …')
  return 1
}

if (isMain(import.meta.url)) process.exit(main())
