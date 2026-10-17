// agents/scripts/db-approval.mjs
//
// 승인형 DB 배포의 1회용 승인 티켓.
//
// 흐름: Claude Code 가 `node scripts/db/<id>/deploy.mjs apply --stage <s> --confirm-sha <sha>` 를 실행하려 하면
// PreToolUse 훅(guard.mjs)이 사용자 승인 창("ask")을 띄우기 **직전에** 이 모듈로 티켓을 발급한다.
// 사용자가 창에서 허용해야만 명령이 실행되고, 러너는 TTY 대신 이 티켓을 1회 소비해 승인을 확인한다.
// 사용자가 거부하면 명령은 실행되지 않고 티켓은 TTL 뒤 무효가 된다.
//
// 불변식(테스트 · check.mjs 가 지킨다):
//   · 티켓은 훅만 쓴다 — 러너에는 발급 API 를 부르지 않는다. 에이전트가 티켓 디렉터리를 만지는 명령은 guard 가 거부한다.
//   · 배포 apply 명령에는 settings allow 규칙을 둘 수 없다(있으면 클릭 없이 실행된다).
//   · 티켓은 (러너 · 단계 · 전체 SHA) 에 묶이고 TTL 안에서 한 번만 쓰인다.
//
// 한계(문서화된 것): 같은 OS 계정에서 도는 에이전트가 정책을 어기고 티켓을 위조하는 것까지 암호학적으로 막지는 못한다.
// 막는 것은 「승인 없이 우연히/관성으로 적용」과 「다른 SHA · 다른 단계로 승인 재사용」이다. 가장 엄격한 경로(사람이
// 직접 TTY 에서 실행)는 그대로 남아 있다.

import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const TICKET_TTL_MS = 5 * 60 * 1000
const SHA_RE = /^[0-9a-f]{64}$/
const STAGE_RE = /^[a-z0-9][a-z0-9-]{0,31}$/
/** scripts/db/<runner>/deploy.mjs — 승인형 배포 러너의 경로 규약 */
export const RUNNER_RE = /(?:^|[\\/])scripts[\\/]db[\\/]([a-z0-9][a-z0-9-]*)[\\/]deploy\.mjs$/i

export function approvalDir(env = process.env) {
  return env.VF_DB_APPROVAL_DIR || path.join(os.homedir(), '.vocaflow', 'db-approvals')
}

function opt(args, name) {
  const i = args.indexOf(name)
  if (i >= 0) return args[i + 1]
  const eq = args.find((a) => a.startsWith(`${name}=`))
  return eq ? eq.slice(name.length + 1) : undefined
}

/**
 * node 인자 목록에서 승인형 배포 apply 를 찾는다.
 * @returns {null | {runner:string, stage?:string, sha?:string, ok:boolean, problem?:string}}
 */
export function parseApply(args) {
  const i = args.findIndex((a) => RUNNER_RE.test(a))
  if (i < 0 || args[i + 1] !== 'apply') return null
  const runner = args[i].match(RUNNER_RE)[1].toLowerCase()
  const rest = args.slice(i + 2)
  const stage = opt(rest, '--stage')
  const sha = opt(rest, '--confirm-sha')
  if (!stage || !STAGE_RE.test(stage)) return { runner, stage, sha, ok: false, problem: '--stage 가 없거나 형식이 다르다' }
  if (!sha || !SHA_RE.test(sha)) return { runner, stage, sha, ok: false, problem: '--confirm-sha 에 전체 SHA-256(소문자 64자)이 없다' }
  return { runner, stage, sha, ok: true }
}

function key({ runner, stage, sha }) {
  return `${runner}-${stage}-${sha}`
}

/** 훅 전용 — 승인 창을 띄우기 직전에 부른다. */
export function issueTicket({ runner, stage, sha, sessionId = null, now = Date.now(), dir = approvalDir() }) {
  if (!SHA_RE.test(sha) || !STAGE_RE.test(stage)) throw new Error('invalid ticket subject')
  fs.mkdirSync(dir, { recursive: true })
  const nonce = crypto.randomBytes(12).toString('hex')
  const ticket = {
    v: 1,
    runner,
    stage,
    sha,
    nonce,
    session_id: sessionId,
    issued_at: new Date(now).toISOString(),
    expires_at: new Date(now + TICKET_TTL_MS).toISOString(),
    approval: 'claude-code-permission-dialog',
  }
  const file = path.join(dir, `${key(ticket)}-${nonce}.json`)
  fs.writeFileSync(file, JSON.stringify(ticket, null, 2) + '\n', { flag: 'wx' })
  return { ...ticket, file }
}

/**
 * 러너 전용 — 일치하는 유효 티켓 하나를 원자적으로 소비한다(rename). 없으면 사유와 함께 null.
 * 가장 최근에 발급된 것부터 고른다. 만료된 것은 지우지 않고 건너뛴다(감사 흔적).
 */
export function consumeTicket({ runner, stage, sha, now = Date.now(), dir = approvalDir() }) {
  if (!fs.existsSync(dir)) return { ticket: null, reason: '승인 티켓이 없다 — Claude Code 승인 창을 거친 실행이 아니다' }
  const prefix = `${key({ runner, stage, sha })}-`
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
  let reason = `승인 티켓이 없다 — ${runner}/${stage}/${sha.slice(0, 12)}… 에 대한 승인 창을 거친 실행이 아니다`
  const candidates = []
  for (const f of files) {
    let t
    try {
      t = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
    } catch {
      continue
    }
    if (t.v !== 1 || t.runner !== runner || t.stage !== stage || t.sha !== sha) continue
    const exp = Date.parse(t.expires_at)
    const iss = Date.parse(t.issued_at)
    if (!(iss <= now) || !(now < exp)) {
      reason = `승인 티켓이 만료됐다(${t.expires_at}) — 다시 승인 받아야 한다`
      continue
    }
    candidates.push({ f, t, iss })
  }
  candidates.sort((a, b) => b.iss - a.iss)
  for (const { f, t } of candidates) {
    const src = path.join(dir, f)
    const dst = `${src}.consumed`
    try {
      fs.renameSync(src, dst) // 같은 파일을 두 실행이 동시에 집으면 하나만 성공한다
    } catch {
      continue
    }
    fs.appendFileSync(dst, JSON.stringify({ consumed_at: new Date(now).toISOString(), pid: process.pid }) + '\n')
    return { ticket: t, reason: null }
  }
  return { ticket: null, reason }
}
