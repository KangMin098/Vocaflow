// agents/scripts/db-approval.mjs
//
// 승인형 DB 배포의 1회용 승인 티켓.
//
// 흐름: Claude Code 가 `node scripts/db/<id>/deploy.mjs apply --stage <s> --confirm-sha <sha>` 를 실행하려 하면
// PreToolUse 훅(db-approval-hook.mjs)이 사용자 승인 창("ask")을 띄우면서 명령 끝에 `--approval-nonce <난수>` 를
// 덧붙인다(updatedInput). 티켓 파일에는 난수의 **해시만** 적는다.
//   · 사용자가 허용 → 덧붙은 명령이 실행 → 러너가 자기 argv 의 난수를 해시해 티켓과 대조 · 1회 소비
//   · 사용자가 거부 → 난수가 실린 명령은 실행되지 않는다 → 그 티켓은 아무도 쓸 수 없다(난수 원문이 어디에도 없다)
//   · 승인 창을 거치지 않은 실행(작업 디렉터리 이동 · 복사본 · node -e import · 인자 순서 변경) → 난수가 없어 거절
//
// 불변식(테스트 · 회귀가 지킨다):
//   · 난수 원문은 훅 출력(updatedInput)에만 있다. 파일 · 로그에 쓰지 않는다.
//   · 에이전트가 직접 붙인 --approval-nonce 는 훅이 거부한다.
//   · 배포 apply 명령에는 settings allow 규칙을 둘 수 없다(있으면 클릭 없이 실행된다).
//   · 티켓은 (러너 · 단계 · 전체 SHA · 난수) 에 묶이고 TTL 안에서 한 번만 쓰인다.
//
// 한계(문서화 · PR #287 독립 리뷰 P2): 같은 OS 계정의 에이전트가 정책을 어기고 **자기 난수로 티켓 파일을 새로 써 넣는**
// 위조는 막지 못한다. guard 의 티켓 디렉터리 쓰기 거부는 흔한 형태만 잡는 보조 장치이며 경로를 조립하는 스크립트
// (python -c 등)는 통과한다 — 방어선이 아니다. 이 설계가 막는 것은 「승인 없는 관성 적용」 · 「거부된 승인의 재사용」 ·
// 「다른 SHA·단계로의 승인 전용」이다. 의도적 위조까지 막아야 하면 사람이 TTY 에서 직접 실행하는 경로를 쓴다.

import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const TICKET_TTL_MS = 5 * 60 * 1000
export const NONCE_FLAG = '--approval-nonce'
const SHA_RE = /^[0-9a-f]{64}$/
const NONCE_RE = /^[0-9a-f]{48}$/
const STAGE_RE = /^[a-z0-9][a-z0-9-]{0,31}$/
/** scripts/db/<runner>/deploy.mjs — 승인형 배포 러너의 경로 규약 */
export const RUNNER_RE = /(?:^|[\\/])scripts[\\/]db[\\/]([a-z0-9][a-z0-9-]*)[\\/]deploy\.mjs$/i

export function approvalDir(env = process.env) {
  return env.VF_DB_APPROVAL_DIR || path.join(os.homedir(), '.vocaflow', 'db-approvals')
}

const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex')

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
  if (i < 0 || !args.slice(i + 1).includes('apply')) return null
  const runner = args[i].match(RUNNER_RE)[1].toLowerCase()
  const rest = args.slice(i + 1)
  const stage = opt(rest, '--stage')
  const sha = opt(rest, '--confirm-sha')
  const count = (n) => rest.filter((a) => a === n || a.startsWith(`${n}=`)).length
  if (count('--stage') > 1 || count('--confirm-sha') > 1) return { runner, stage, sha, ok: false, problem: '--stage · --confirm-sha 는 한 번씩만' }
  if (rest[0] !== 'apply') return { runner, stage, sha, ok: false, problem: 'apply 는 러너 경로 바로 다음에 와야 한다' }
  if (rest.some((a) => a === NONCE_FLAG || a.startsWith(`${NONCE_FLAG}=`))) return { runner, stage, sha, ok: false, problem: `${NONCE_FLAG} 는 훅만 붙인다` }
  if (!stage || !STAGE_RE.test(stage)) return { runner, stage, sha, ok: false, problem: '--stage 가 없거나 형식이 다르다' }
  if (!sha || !SHA_RE.test(sha)) return { runner, stage, sha, ok: false, problem: '--confirm-sha 에 전체 SHA-256(소문자 64자)이 없다' }
  return { runner, stage, sha, ok: true }
}

/** 훅 전용 — 승인 창을 띄우기 직전에 부른다. 난수 원문은 반환값으로만 나간다(파일엔 해시). */
export function issueTicket({ runner, stage, sha, sessionId = null, now = Date.now(), dir = approvalDir() }) {
  if (!SHA_RE.test(sha) || !STAGE_RE.test(stage)) throw new Error('invalid ticket subject')
  fs.mkdirSync(dir, { recursive: true })
  const nonce = crypto.randomBytes(24).toString('hex')
  const id = crypto.randomBytes(6).toString('hex')
  const ticket = {
    v: 2,
    id,
    runner,
    stage,
    sha,
    nonce_sha256: hash(nonce),
    session_id: sessionId,
    issued_at: new Date(now).toISOString(),
    expires_at: new Date(now + TICKET_TTL_MS).toISOString(),
    approval: 'claude-code-permission-dialog',
  }
  const file = path.join(dir, `${runner}-${stage}-${sha}-${id}.json`)
  fs.writeFileSync(file, JSON.stringify(ticket, null, 2) + '\n', { flag: 'wx' })
  return { ticket, nonce, file }
}

/** 러너 전용 — argv 의 난수에 맞는 유효 티켓 하나를 원자적으로 소비한다(rename). 없으면 사유와 함께 null. */
export function consumeTicket({ runner, stage, sha, nonce, now = Date.now(), dir = approvalDir() }) {
  if (!nonce || !NONCE_RE.test(nonce)) return { ticket: null, reason: `${NONCE_FLAG} 가 없다 — Claude Code 승인 창에서 허용된 명령이 아니다` }
  if (!fs.existsSync(dir)) return { ticket: null, reason: '승인 티켓이 없다 — Claude Code 승인 창을 거친 실행이 아니다' }
  const want = hash(nonce)
  const prefix = `${runner}-${stage}-${sha}-`
  for (const f of fs.readdirSync(dir).filter((x) => x.startsWith(prefix) && x.endsWith('.json'))) {
    let t
    try {
      t = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
    } catch {
      continue
    }
    if (t.v !== 2 || t.runner !== runner || t.stage !== stage || t.sha !== sha || t.nonce_sha256 !== want) continue
    const iss = Date.parse(t.issued_at)
    const exp = Date.parse(t.expires_at)
    if (!(iss <= now) || !(now < exp)) return { ticket: null, reason: `승인 티켓이 만료됐다(${t.expires_at}) — 다시 승인 받아야 한다` }
    const src = path.join(dir, f)
    const dst = `${src}.consumed`
    try {
      fs.renameSync(src, dst) // 같은 파일을 두 실행이 동시에 집으면 하나만 성공한다
    } catch {
      return { ticket: null, reason: '승인 티켓이 이미 쓰였다' }
    }
    try {
      fs.appendFileSync(dst, JSON.stringify({ consumed_at: new Date(now).toISOString(), pid: process.pid }) + '\n')
    } catch {
      /* 소비 표시 실패는 판정에 영향 없음 — 이미 rename 됐다 */
    }
    return { ticket: t, reason: null }
  }
  return { ticket: null, reason: `승인 티켓이 없거나 이미 쓰였다 — ${runner}/${stage}/${sha.slice(0, 12)}… 는 승인 창을 다시 거쳐야 한다` }
}

/** 셸 메타문자 · 줄바꿈이 없는 단일 명령인가 — 난수가 다른 프로그램(echo · tee · 주석)에 실리지 않게 */
export function isSingleCommand(command) {
  return !/[;&|<>#`\r\n]|\$\(/.test(command)
}

/**
 * 훅이 승인 창에 넘길 명령 — 난수를 `--confirm-sha <sha>` 바로 뒤에 넣는다(러너의 인자로만 들어가게).
 * 단일 명령이 아니거나 --confirm-sha 가 정확히 한 번 나오지 않으면 던진다(훅은 발급하지 않는다).
 */
export function withNonce(command, sha, nonce) {
  if (!NONCE_RE.test(nonce) || !SHA_RE.test(sha)) throw new Error('invalid nonce')
  if (!isSingleCommand(command)) throw new Error('compound command')
  const anchor = `--confirm-sha ${sha}`
  const at = command.indexOf(anchor)
  if (at < 0 || command.indexOf(anchor, at + 1) >= 0) throw new Error('confirm-sha anchor')
  const end = at + anchor.length
  return `${command.slice(0, end)} ${NONCE_FLAG} ${nonce}${command.slice(end)}`
}
