// scripts/textbook/factory-order-draft.mjs
//
// 관리자용 읽기 전용 CLI — 교재공장 주문 초안 계산 · 주문 계보 조회.
//   prepare --input <JSON> --out <새 파일>               → POST /api/admin/csat/factory-order-draft
//   lineage --user <UUID> --workspace <UUID> --out <새 파일> → GET  /api/admin/csat/product-order-lineage
// 조회·계산만 한다. 계보 등록·연결·철회, 생산, 납품은 이 도구에 없다.
//
// 인증: 관리자 세션 Cookie 는 환경변수 VOCAFLOW_ADMIN_COOKIE 에서만 읽는다(인자·파일·출력에 남기지 않는다).
// Cookie 는 http loopback origin(localhost · 127.0.0.1 · [::1])에만 보내고 redirect 는 따라가지 않는다.
// 출력은 새 파일에만(wx) 쓴다 — 기존 파일은 거절하고, 실패하면 산출물을 만들지 않는다.

import * as fs from 'node:fs'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const FACTORY_ORDER_DRAFT_PATH = '/api/admin/csat/factory-order-draft'
export const PRODUCT_ORDER_LINEAGE_PATH = '/api/admin/csat/product-order-lineage'
export const MAX_INPUT_BYTES = 120000
export const DEFAULT_BASE_URL = 'http://localhost:3000'
export const COOKIE_ENV = 'VOCAFLOW_ADMIN_COOKIE'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
const FLAGS = {
  prepare: new Set(['input', 'out', 'base-url']),
  lineage: new Set(['user', 'workspace', 'out', 'base-url']),
}

export class CliError extends Error {}

/**
 * 새 파일 쓰기 실패. message 는 코드와 경로만 담는다(본문 · Cookie 를 싣지 않는다).
 * cleanup_failed=true 면 이번 실행이 만든 파일이 남았을 수 있다 — paths 를 사람이 확인해야 한다.
 */
export class NewFileError extends Error {
  constructor(code, paths, causes) {
    super(`${code}: ${paths.join(', ')}${causes.length ? ` (${causes.join('; ')})` : ''}`)
    this.code = code
    this.paths = paths
    this.cleanup_failed = code.startsWith('cleanup_failed')
  }
}

const errCode = (e) => (e && typeof e.code === 'string' ? e.code : 'unknown')

/**
 * open(wx) 로 소유를 먼저 확보한 뒤 fd 로 끝까지 쓰고 닫는다. 이미 있으면(EEXIST) 아무것도 지우지 않는다.
 * 소유 확보 뒤 쓰기 · close 가 실패하면 fd 를 닫고 **이번에 만든 그 파일만** 지운다.
 * 정리도 실패하면 숨기지 않고 cleanup_failed 로 던진다. fsImpl 은 시험용 주입.
 */
export function writeNewFile(path, data, fsImpl = fs) {
  const bytes = typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  let fd
  try {
    fd = fsImpl.openSync(path, 'wx')
  } catch (e) {
    throw new NewFileError(errCode(e) === 'EEXIST' ? 'exists' : 'open_failed', [path], [errCode(e)])
  }
  let open = true
  try {
    let off = 0
    while (off < bytes.byteLength) off += fsImpl.writeSync(fd, bytes, off, bytes.byteLength - off)
    open = false
    fsImpl.closeSync(fd)
  } catch (e) {
    const causes = [errCode(e)]
    if (open) {
      try {
        fsImpl.closeSync(fd)
      } catch (ce) {
        causes.push(`close:${errCode(ce)}`)
      }
    }
    try {
      fsImpl.unlinkSync(path)
    } catch (ue) {
      causes.push(`unlink:${errCode(ue)}`)
      throw new NewFileError('cleanup_failed_after_write_error', [path], causes)
    }
    throw new NewFileError('write_failed_removed', [path], causes)
  }
}

/**
 * 여러 새 파일을 한 묶음으로 만든다. rollback() 은 이번 묶음이 만든 파일만 역순으로 지우고(재귀 삭제 없음)
 * 남은 경로 목록을 돌려준다 — 빈 배열이어야 정리 완료다.
 */
export function newFileSet(fsImpl = fs) {
  const created = []
  return {
    created,
    write(path, data) {
      writeNewFile(path, data, fsImpl)
      created.push(path)
    },
    rollback() {
      const left = []
      for (const p of [...created].reverse()) {
        try {
          fsImpl.unlinkSync(p)
        } catch (e) {
          if (errCode(e) !== 'ENOENT') left.push(`${p} (${errCode(e)})`)
        }
      }
      created.length = 0
      return left
    },
  }
}

/** argv(명령 이후) → { command, flags }. 모르는 명령·플래그·중복·빈 값은 거절한다. */
export function parseArgs(argv) {
  const [command, ...rest] = argv
  if (!command || !Object.hasOwn(FLAGS, command))
    throw new CliError('명령은 prepare 또는 lineage 입니다.')
  const allowed = FLAGS[command]
  const flags = {}
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i]
    const value = rest[i + 1]
    if (typeof key !== 'string' || !key.startsWith('--')) throw new CliError(`알 수 없는 인자: ${key}`)
    const name = key.slice(2)
    if (!allowed.has(name)) throw new CliError(`${command} 에 없는 플래그: --${name}`)
    if (Object.hasOwn(flags, name)) throw new CliError(`--${name} 이 두 번 주어졌습니다.`)
    if (typeof value !== 'string' || value === '' || value.startsWith('--'))
      throw new CliError(`--${name} 값이 필요합니다.`)
    flags[name] = value
  }
  const required = command === 'prepare' ? ['input', 'out'] : ['user', 'workspace', 'out']
  for (const name of required) if (!flags[name]) throw new CliError(`--${name} 이 필요합니다.`)
  if (command === 'lineage') {
    if (!UUID.test(flags.user)) throw new CliError('--user 는 UUID 여야 합니다.')
    if (!UUID.test(flags.workspace)) throw new CliError('--workspace 는 UUID 여야 합니다.')
  }
  return { command, flags }
}

/** 자격 증명을 보낼 수 있는 base 만 origin 으로 돌려준다 — http loopback, 경로·쿼리·fragment·계정 정보 없음. */
export function loopbackOrigin(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new CliError('--base-url 을 해석할 수 없습니다.')
  }
  if (url.protocol !== 'http:') throw new CliError('--base-url 은 http loopback 만 허용합니다.')
  if (!LOOPBACK_HOSTS.has(url.hostname)) throw new CliError('--base-url 은 localhost · 127.0.0.1 · [::1] 만 허용합니다.')
  if (url.username || url.password) throw new CliError('--base-url 에 계정 정보를 넣을 수 없습니다.')
  const rest = raw.startsWith(url.origin) ? raw.slice(url.origin.length) : null
  if (url.pathname !== '/' || url.search || url.hash || (rest !== '' && rest !== '/'))
    throw new CliError('--base-url 은 origin(경로·쿼리·fragment 없음)이어야 합니다.')
  return url.origin
}

function readCookie(env) {
  const cookie = env[COOKIE_ENV]
  if (typeof cookie !== 'string' || cookie.trim() === '')
    throw new CliError(`${COOKIE_ENV} 가 설정되지 않았습니다 — 관리자 세션 Cookie 를 환경변수로만 넘깁니다.`)
  if (/[\r\n]/.test(cookie)) throw new CliError(`${COOKIE_ENV} 형식이 잘못됐습니다.`)
  return cookie
}

function readInput(path, readFile) {
  let raw
  try {
    raw = readFile(path)
  } catch {
    throw new CliError('--input 파일을 읽을 수 없습니다.')
  }
  if (Buffer.byteLength(raw, 'utf8') > MAX_INPUT_BYTES)
    throw new CliError(`--input 이 ${MAX_INPUT_BYTES} 바이트를 넘습니다.`)
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new CliError('--input 이 JSON 이 아닙니다.')
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new CliError('--input 은 JSON 객체여야 합니다.')
  return raw
}

const isDraft = (b) =>
  b && b.status === 'draft_prepared' && b.persisted === false && b.lineage === 'not_registered' &&
  b.production === 'not_started' && b.delivery === 'not_performed' && b.registrable === false &&
  typeof b.factory?.order_hash === 'string' && Array.isArray(b.blockers)

const isLineage = (b) => b && (b.status === 'installed' || b.status === 'not_installed')

function summarize(command, body) {
  if (command === 'prepare')
    return [
      `주문 초안 계산됨 — 저장 안 됨 · 계보 미등록 · 생산 미실행 · 납품 미실행`,
      `대응: ${body.mapping} (미검증 후보) · order_hash ${body.factory.order_hash}`,
      `남은 차단 ${body.blockers.length}: ${body.blockers.join(', ')}`,
    ]
  return body.status === 'not_installed'
    ? ['주문 계보 테이블이 설치되지 않았습니다 — 조회만 했고 기록은 만들지 않았습니다.']
    : ['주문 계보 조회됨 — 읽기만 했고 등록·연결·철회·납품은 하지 않았습니다.']
}

/**
 * CLI 본체. 의존성은 주입(fake fetch · 메모리 파일)한다. 반환값은 종료 코드.
 * 검증이 끝나기 전에는 fetch·파일 쓰기를 하지 않는다.
 */
export async function run(argv, deps = {}) {
  const env = deps.env ?? process.env
  const fetchImpl = deps.fetch ?? globalThis.fetch
  const readFile = deps.readFile ?? ((p) => readFileSync(p, 'utf8'))
  const exists = deps.exists ?? existsSync
  const writeNew = deps.writeNew ?? ((p, text) => writeNewFile(p, text))
  const out = deps.stdout ?? ((s) => process.stdout.write(`${s}\n`))
  const err = deps.stderr ?? ((s) => process.stderr.write(`${s}\n`))

  let request
  let command
  let outPath
  try {
    const parsed = parseArgs(argv)
    command = parsed.command
    const { flags } = parsed
    const origin = loopbackOrigin(flags['base-url'] ?? DEFAULT_BASE_URL)
    const cookie = readCookie(env)
    outPath = resolve(flags.out)
    if (exists(outPath)) throw new CliError('--out 파일이 이미 있습니다 — 새 경로를 주세요.')
    const headers = { Cookie: cookie, Origin: origin, Accept: 'application/json' }
    if (command === 'prepare') {
      const body = readInput(flags.input, readFile)
      request = {
        url: `${origin}${FACTORY_ORDER_DRAFT_PATH}`,
        init: { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body, redirect: 'error' },
      }
    } else {
      const qs = new URLSearchParams({ user: flags.user, workspace: flags.workspace })
      request = {
        url: `${origin}${PRODUCT_ORDER_LINEAGE_PATH}?${qs}`,
        init: { method: 'GET', headers, redirect: 'error' },
      }
    }
  } catch (e) {
    err(e instanceof CliError ? e.message : '입력을 확인하지 못했습니다.')
    return 2
  }

  let res
  try {
    res = await fetchImpl(request.url, request.init)
  } catch {
    err('서버에 연결하지 못했습니다(또는 redirect 가 차단됐습니다).')
    return 1
  }
  let body
  try {
    body = await res.json()
  } catch {
    err(`응답을 JSON 으로 읽지 못했습니다 (HTTP ${res.status}).`)
    return 1
  }
  if (res.status !== 200) {
    const code = typeof body?.code === 'string' ? ` · ${body.code}` : ''
    err(`HTTP ${res.status}${code} — 산출물을 만들지 않았습니다.`)
    return 1
  }
  if (!(command === 'prepare' ? isDraft(body) : isLineage(body))) {
    err('응답 형식이 예상과 다릅니다 — 산출물을 만들지 않았습니다.')
    return 1
  }
  try {
    writeNew(outPath, `${JSON.stringify(body, null, 2)}\n`)
  } catch (e) {
    if (e instanceof NewFileError && e.cleanup_failed) {
      err(`--out 파일 쓰기에 실패했고 부분 파일을 지우지 못했습니다 — 직접 확인하세요: ${e.message}`)
    } else {
      err('--out 파일을 새로 만들지 못했습니다(이미 있거나 쓸 수 없음).')
    }
    return 1
  }
  for (const line of summarize(command, body)) out(line)
  out(`저장: ${outPath}`)
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2)).then((code) => {
    process.exitCode = code
  })
}
