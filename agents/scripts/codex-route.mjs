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
  const after = fs.readFileSync(file, 'utf8')
  const landed = after.length > before && after.slice(Math.max(0, before - 4096)).includes(nonce.replace(/[\]]/g, ']'))
  if (!landed) return { delivered: false, queueId: queueId[1], reason: '큐에는 들어갔지만 세션 기록에 작업 ID 가 보이지 않는다', resume: 'Codex 대화를 열어 큐가 처리되는지 확인한다' }
  return { delivered: true, queueId: queueId[1], uuid: target.uuid, rollout: file }
}

/** GitHub 기록(전달 · 미전달 모두) — 부르는 쪽이 선택 */
export function recordOnGitHub({ kind, number, task, result, run = execFileSync }) {
  const body = result.delivered
    ? `[VF-TASK ${task}] Codex 대화(${result.uuid})에 전달됨 · 큐 id \`${result.queueId}\`.`
    : `[VF-TASK ${task}] **Codex 미전달** — ${result.reason}\n재개 조건: ${result.resume}\n(새 Codex 세션으로 대체하지 않았다.)`
  run('gh', [kind === 'issue' ? 'issue' : 'pr', 'comment', String(number), '--body', body], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
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
  console.error('사용: codex-route.mjs check|send --to <이름> …')
  return 1
}

if (isMain(import.meta.url)) process.exit(main())
