// scripts/csat/error-evidence/model-input/deidentify.mjs
//
// 모델 입력 비식별화 — PILOT_PROTOCOL §9. `csat_ec_ai_export` packet 을 모델(Claude · Codex)에 보내기 전 **반드시** 거친다
// (다른 경로는 apps/web/src/lib/csat/ec-pilot/__tests__/model-input-enforcement.test.ts 가 정적으로 막는다).
//
//   ① session_id · 증거 id · 문항 id 를 익명 attempt key(`P001-E1-#21`) 계열 별칭으로 치환. 별칭 ↔ 실제 id 는 저장소 밖 파일에만.
//   ② 학생 자유서술(process_evidence 값의 문자열)에서 식별정보 꼴(pii-rules.mjs)을 탐지 — 걸리면 그 packet 은 blocked(자동 전송 금지).
//      운영자가 redaction 파일로 가린 뒤 재실행해야 통과한다.
//   ③ 결과 전체에 UUID · 이메일 · 전화 꼴이 남으면 blocked(residual).
//   ④ 감사용으로 익명화 전/후 sha256 · 규칙 이름만 돌려준다(원문 없음).
// 순수 함수 — DB · 파일은 model-packets.mjs 가 다룬다. 시각은 인자로 받는다.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { PII_RULES, RESIDUAL_RULES } from './pii-rules.mjs'

export const DEID_VERSION = 'deid-1'

/** 키를 정렬한 JSON — 같은 값이면 같은 해시(결정적) */
export function canonicalJson(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v)
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`
  return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(',')}}`
}
export const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex')
export const hashOf = (v) => sha256(canonicalJson(v))

/** 규칙 판본 해시 — run 메타 verification.piiGuard.rulesHash 와 대조한다 */
export function rulesHash() {
  return hashOf({ version: DEID_VERSION, pii: PII_RULES.map((r) => [r.name, r.re.source, r.re.flags]), residual: RESIDUAL_RULES.map((r) => [r.name, r.re.source, r.re.flags]) })
}

const PKEY = /^P[0-9]{3}$/
/** `P001-E1-#21` — 참가자 익명 key · run 안의 시험 순번(1부터) · 문항 번호 */
export function attemptKey(participantKey, examOrdinal, itemNo) {
  if (!PKEY.test(participantKey)) throw new Error(`참가자 key 형식이 아니다(P001 꼴): ${participantKey}`)
  if (!Number.isInteger(examOrdinal) || examOrdinal < 1) throw new Error('시험 순번은 1 이상 정수')
  if (!Number.isInteger(itemNo) || itemNo < 1) throw new Error('문항 번호는 1 이상 정수')
  return `${participantKey}-E${examOrdinal}-#${itemNo}`
}

/** 자유서술 하나에서 걸린 규칙 이름(중복 없음 · 정렬) */
export function detectPii(text) {
  if (typeof text !== 'string' || !text) return []
  return [...new Set(PII_RULES.filter((r) => r.re.test(text)).map((r) => r.name))].sort()
}

function residualFindings(v) {
  const out = new Set()
  const walk = (x) => {
    if (typeof x === 'string') { for (const r of RESIDUAL_RULES) if (r.re.test(x)) out.add(`residual:${r.name}`) }
    else if (Array.isArray(x)) x.forEach(walk)
    else if (x && typeof x === 'object') for (const [k, y] of Object.entries(x)) { for (const r of RESIDUAL_RULES) if (r.re.test(k)) out.add(`residual:${r.name}`); walk(y) }
  }
  walk(v)
  return [...out].sort()
}

/** packet 전체에서 UUID · 이메일 · 전화 꼴(규칙 이름) — 테스트 · 점검용 */
export const residualIdentifiers = residualFindings

const mapStrings = (v, f) => {
  if (typeof v === 'string') return f(v)
  if (Array.isArray(v)) return v.map((x) => mapStrings(x, f))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapStrings(x, f)]))
  return v
}
const collectStrings = (v, out = []) => {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) v.forEach((x) => collectStrings(x, out))
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => collectStrings(x, out))
  return out
}

/**
 * packet 하나를 비식별화한다.
 * @param {object} packet csat_ec_ai_export 반환값
 * @param {{ sessionId: string, itemNo: number, participantKey: string, examOrdinal: number,
 *           redactions?: { find: string, replace: string }[] }} ctx
 * @returns {{ attempt: string, status: 'ok'|'blocked', rules: string[], sha256Before: string, sha256After: string,
 *             packet: object|null, aliases: object }}
 *   blocked 이면 packet 은 null(보내지 않는다). aliases(별칭 → 실제 id)는 저장소 밖에만 쓴다.
 */
export function deidentifyPacket(packet, ctx) {
  if (!packet || typeof packet !== 'object' || !packet.canonical_input) throw new Error('ai_export packet 이 아니다')
  const attempt = attemptKey(ctx.participantKey, ctx.examOrdinal, ctx.itemNo)
  const ci = packet.canonical_input
  if (ci.format !== 'ci-1') throw new Error(`모르는 canonical_input 형식: ${ci.format}`)
  const sha256Before = hashOf(packet)
  // 별칭: 세션 → attempt, 증거 id → attempt/eN(작성순), 문항 id → attempt/item
  const replace = new Map()
  if (typeof ctx.sessionId === 'string' && ctx.sessionId) replace.set(ctx.sessionId.toLowerCase(), attempt)
  const evidence = {}
  const pe = Array.isArray(ci.process_evidence) ? ci.process_evidence : []
  pe.forEach((row, i) => {
    const id = Array.isArray(row) ? row[0] : null
    if (typeof id === 'string') { const a = `${attempt}/e${i + 1}`; replace.set(id.toLowerCase(), a); evidence[a] = id }
  })
  if (typeof ci.item_id === 'string') replace.set(ci.item_id.toLowerCase(), `${attempt}/item`)
  const ids = [...replace.keys()].sort((a, b) => b.length - a.length)
  const swap = (s) => {
    let out = s
    for (const id of ids) out = out.replace(new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), replace.get(id))
    return out
  }
  // 모델에 필요 없는 연결 값은 뺀다 — input_hash(DB 원입력 해시 · 행 연결 단서)는 aliases 에만
  const body = {
    format: DEID_VERSION,
    attempt,
    taxonomy_version: packet.taxonomy_version,
    choice_trap_map: packet.choice_trap_map,
    quality_rule_version: packet.quality_rule_version,
    evidence_profile: packet.evidence_profile,
    canonical_input: { ...ci, item_id: `${attempt}/item` },
  }
  let anon = mapStrings(body, swap)
  // redaction — 이 attempt 의 문자열에서 find → replace. 하나도 안 맞으면 낡은 redaction 이다(실패)
  for (const r of ctx.redactions ?? []) {
    if (typeof r?.find !== 'string' || !r.find || typeof r.replace !== 'string') throw new Error(`redaction 형식 오류(${attempt})`)
    if (!collectStrings(anon).some((s) => s.includes(r.find))) throw new Error(`redaction 이 맞는 곳이 없다(${attempt}) — 낡은 redaction`)
    anon = mapStrings(anon, (s) => s.split(r.find).join(r.replace))
  }
  // 자유서술 = process_evidence 값 안의 문자열(종류 · id 별칭 제외)
  const rules = new Set()
  for (const row of anon.canonical_input.process_evidence ?? []) {
    const value = Array.isArray(row) ? row[2] : row
    // 해시 · 판 해시(prompt_hash 등 긴 hex)는 자유서술이 아니다
    for (const s of collectStrings(value)) if (!/^[0-9a-f]{32,}$/i.test(s)) for (const n of detectPii(s)) rules.add(n)
  }
  for (const n of residualFindings(anon)) rules.add(n)
  const sorted = [...rules].sort()
  const status = sorted.length ? 'blocked' : 'ok'
  return {
    attempt, status, rules: sorted, sha256Before, sha256After: hashOf(anon),
    packet: status === 'ok' ? anon : null,
    aliases: { attempt, session_id: ctx.sessionId, item_no: ctx.itemNo, item_id: ci.item_id ?? null, input_hash: packet.input_hash ?? null,
      round_id: packet.round_id ?? null, evidence },
  }
}

/** 모델 출력의 별칭(attempt · attempt/eN)을 실제 id 로 되돌린다 — 적재(csat_ec_ai_import) 직전, 저장소 밖에서만 */
export function rehydrate(output, aliases) {
  const map = new Map(Object.entries(aliases.evidence ?? {}))
  map.set(`${aliases.attempt}/item`, aliases.item_id)
  const keys = [...map.keys()].sort((a, b) => b.length - a.length)
  return mapStrings(output, (s) => {
    for (const k of keys) if (s === k) return map.get(k)
    return s
  })
}

// ── 저장소 밖 경로 가드 ────────────────────────────────────────

const gitDefault = {
  /** 경로가 속한 git 작업트리 루트(없으면 null) */
  toplevel(p) {
    let dir = path.dirname(path.resolve(p))
    while (!fs.existsSync(dir)) { const up = path.dirname(dir); if (up === dir) return null; dir = up }
    try { return execFileSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null } catch { return null }
  },
  tracked(root, rel) {
    try { execFileSync('git', ['-C', root, 'ls-files', '--error-unmatch', '--', rel], { stdio: 'ignore' }); return true } catch { return false }
  },
  ignored(root, rel) {
    try { execFileSync('git', ['-C', root, 'check-ignore', '-q', '--no-index', '--', rel], { stdio: 'ignore' }); return true } catch { return false }
  },
}

/**
 * 원문 · 매핑 · 별칭 · 감사 로그를 쓸 경로가 「저장소 밖」 또는 「git 작업트리 안이면 무시(ignored)되고 추적되지 않는」 곳인지.
 * 아니면 throw — 학생 자유서술 원문 · 계정 매핑이 커밋될 수 있는 곳에는 쓰지 않는다.
 */
export function assertPrivatePath(p, git = gitDefault) {
  if (typeof p !== 'string' || !p) throw new Error('경로가 없다')
  if (!path.isAbsolute(p)) throw new Error(`절대경로만 허용한다: ${p}`)
  const root = git.toplevel(p)
  if (!root) return path.resolve(p)
  const rel = path.relative(path.resolve(root), path.resolve(p)).split(path.sep).join('/')
  if (rel.startsWith('..')) return path.resolve(p)
  if (git.tracked(root, rel)) throw new Error(`저장소 추적 경로다 — 원문을 쓰지 않는다: ${rel}`)
  if (!git.ignored(root, rel)) throw new Error(`저장소 안의 무시되지 않는 경로다(커밋될 수 있다) — .pilot-private/ 같은 gitignore 위치나 저장소 밖 절대경로를 쓴다: ${rel}`)
  return path.resolve(p)
}

/** 감사 한 줄 — 원문 없음(run id · attempt · 전/후 해시 · 규칙 이름 · 상태 · 시각) */
export function auditLine(runId, r, nowIso) {
  return JSON.stringify({ run: runId, attempt: r.attempt, status: r.status, rules: r.rules, sha256_before: r.sha256Before, sha256_after: r.sha256After, deid: DEID_VERSION, rules_hash: rulesHash(), at: nowIso })
}
