// apps/web/src/lib/csat/ec-pilot/run-gate.ts
//
// G6 시작 게이트(fail-closed) — 순수 규칙. 앱 서버(gate.ts)와 운영 점검 스크립트(scripts/csat/pilot/start-check.mjs)가 같은 파일을 쓴다.
//   · import 는 node:crypto 하나뿐이다 — 점검 스크립트가 node 의 타입 제거 실행으로 이 파일을 그대로 읽는다(규칙이 두 벌로 갈라지지 않게).
//   · run 메타(docs/csat-learner/pilot-runs/<run id>.json)는 익명 key · 해시 · assignment 만 담는다(PILOT_PROTOCOL §16 · §19).
//     계정 id(UUID) · 이메일 · 전화 꼴이 하나라도 있으면 메타 자체가 실패다.
//   · 항목 하나라도 없거나 live 와 다르면 닫힌다. 실패 사유는 코드 문자열로만 돌려준다(운영자 로그 · 점검 스크립트용 — 학습자 응답은 404).

import { createHash } from 'node:crypto'

export const RUN_META_FORMAT = 'ec-pilot-run-1'
export const PILOT_TAXONOMY = 'v0.1'
export const PILOT_DETECTOR_VERSION = 'bd-0.1.0'
/** 결정 C — 세션당 probe 상한 */
export const PILOT_PROBE_CAP = 3
/** 결정 A — 참가자 최소 3 · 최대 8 */
export const PILOT_PARTICIPANTS_MIN = 3
export const PILOT_PARTICIPANTS_MAX = 8
/** 결정 B — 시험 2회차 고정 */
export const PILOT_EXAM_COUNT = 2

const HEX64 = /^[0-9a-f]{64}$/
const HEX40 = /^[0-9a-f]{40}$/
const RUN_ID = /^ec-pilot-run-[0-9]{8}-[0-9]+$/
const PKEY = /^P[0-9]{3}$/
const EXAM_ID = /^[A-Za-z0-9_-]{1,32}$/
const ISO = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$/

/** 메타에 들어가면 안 되는 꼴 — 계정 id(UUID) · 이메일 · 전화 */
export const META_PII_RULES: readonly { name: string; re: RegExp }[] = [
  { name: 'uuid', re: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i },
  { name: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  // 해시(hex) 속의 우연한 숫자열을 전화로 보지 않게 앞뒤가 영숫자가 아닐 때만
  { name: 'phone', re: /(?<![0-9A-Za-z])(?:(?:\+82[\s-]?|0)1[016789][\s.-]?[0-9]{3,4}[\s.-]?[0-9]{4}|0[2-6][0-9]?[\s.-][0-9]{3,4}[\s.-][0-9]{4})(?![0-9A-Za-z])/ },
]
/** 메타에 있으면 안 되는 키 이름(값과 무관하게) */
const FORBIDDEN_KEYS = /^(user_?id|userid|account(_?id)?|email|e-mail|name|full_?name|school|class|phone|session_?id|mapping)$/i

export interface ExamSeal { examId: string; itemSetHash: string; answerKeyHash: string; corpusHash: string }
export interface ParticipantSeal { key: string; exams: string[] }
export interface VerificationRecord { commit: string; passed: number; failed: number; at: string; recordSha256: string }
export interface PiiGuardRecord extends VerificationRecord { rulesHash: string }
export interface E2eRecord extends VerificationRecord { skipped: number }

export interface RunMeta {
  format: string
  runId: string
  status: 'sealed'
  taxonomy: { version: string; definitionsHash: string }
  detectorVersion: string
  probe: { capPerSession: number; configHash: string }
  appCommit: string
  db: { latestMigration: string; migrationCount: number }
  exams: ExamSeal[]
  participants: ParticipantSeal[]
  verification: { piiGuard: PiiGuardRecord; e2e: E2eRecord }
  sealedAt: string
  seal: string
}

// ── 정규화 해시 ───────────────────────────────────────────────

/** 키를 정렬한 JSON — 클라이언트(pg · supabase-js)나 키 순서가 달라도 같은 값이면 같은 문자열 */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== 'object') {
    if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('canonicalJson: 유한하지 않은 수')
    return JSON.stringify(v === undefined ? null : v)
  }
  if (Array.isArray(v)) return `[${v.map((x) => canonicalJson(x)).join(',')}]`
  const o = v as Record<string, unknown>
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`
}

export const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex')
export const hashOf = (v: unknown): string => sha256(canonicalJson(v))

export interface ItemRow { id: string; no: number; section: string | null; in_scope: boolean | null; type_id: string | null; stem: string | null; passage: string | null; choices: unknown; body_ok: boolean | null; raw_block: string | null }
export interface KeyRow { no: number; answers: number[] | null; points: number | null }
export interface TrapRow { item_id: string; option_no: number; trap_key: string | null; source: string | null; analysis_version: number | null }
export interface ExamRow { id: string; organizer: string | null; source_note: string | null; item_count: number | null; listening_end: number | null }

const byNo = <T extends { no: number }>(rows: readonly T[]) => [...rows].sort((a, b) => a.no - b.no)

/** §16 item set 해시 — 문항 id · 번호 · 문항 내용 해시(발문 · 지문 · 선지 · 본문 적격), 번호순 */
export function itemSetHash(items: readonly ItemRow[]): string {
  return hashOf(byNo(items).map((i) => [i.id, i.no, hashOf([i.stem, i.passage, i.choices ?? null, i.body_ok])]))
}

/** §16 정답표 해시 — csat_dx_answer_key(번호 · 정답 · 배점), 번호순 */
export function answerKeyHash(rows: readonly KeyRow[]): string {
  return hashOf(byNo(rows).map((r) => [r.no, r.answers ?? null, r.points ?? null]))
}

/** §16 원문/코퍼스 판 — 시험 원천 표기 · 문항 분류 · 원문 블록 해시 · 선지 함정 원값 */
export function corpusHash(exam: ExamRow, items: readonly ItemRow[], traps: readonly TrapRow[]): string {
  const t = [...traps].sort((a, b) => (a.item_id < b.item_id ? -1 : a.item_id > b.item_id ? 1 : a.option_no - b.option_no))
  return hashOf({
    exam: [exam.id, exam.organizer, exam.source_note, exam.item_count, exam.listening_end],
    items: byNo(items).map((i) => [i.no, i.id, i.section, i.in_scope, i.type_id, i.raw_block === null ? null : sha256(i.raw_block)]),
    traps: t.map((r) => [r.item_id, r.option_no, r.trap_key, r.source, r.analysis_version]),
  })
}

export function examSeal(exam: ExamRow, items: readonly ItemRow[], key: readonly KeyRow[], traps: readonly TrapRow[]): ExamSeal {
  return { examId: exam.id, itemSetHash: itemSetHash(items), answerKeyHash: answerKeyHash(key), corpusHash: corpusHash(exam, items, traps) }
}

/** §16 capture · probe config 해시 — 허용 probe(key · version · prompt_hash) + 세션 상한 */
export function probeConfigHash(probes: readonly { key: string; version: string; prompt_hash: string }[], cap: number | null): string {
  return hashOf({ probes: [...probes].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)), probe_cap: cap })
}

/** 봉인 해시 — seal 필드를 뺀 메타 전체 */
export function metaSeal(meta: Omit<RunMeta, 'seal'> & { seal?: string }): string {
  const rest: Record<string, unknown> = { ...meta }
  delete rest.seal
  return hashOf(rest)
}

// ── 메타 가드 ─────────────────────────────────────────────────

/** 메타 안의 모든 문자열 · 키를 훑어 식별정보 꼴을 찾는다(규칙 이름만 — 원문을 돌려주지 않는다) */
export function metaPiiFindings(v: unknown, path = '$'): string[] {
  const out: string[] = []
  const walk = (x: unknown, p: string) => {
    if (typeof x === 'string') {
      for (const r of META_PII_RULES) if (r.re.test(x)) out.push(`${r.name}@${p}`)
    } else if (Array.isArray(x)) x.forEach((y, i) => walk(y, `${p}[${i}]`))
    else if (x && typeof x === 'object') {
      for (const [k, y] of Object.entries(x as Record<string, unknown>)) {
        if (FORBIDDEN_KEYS.test(k)) out.push(`forbidden_key@${p}.${k}`)
        for (const r of META_PII_RULES) if (r.re.test(k)) out.push(`${r.name}@${p}.<key>`)
        walk(y, `${p}.${k}`)
      }
    }
  }
  walk(v, path)
  return out
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x)

function verificationShape(r: unknown, kind: 'piiGuard' | 'e2e'): string[] {
  const f: string[] = []
  if (!isObj(r)) return [`shape:verification.${kind}`]
  if (typeof r.commit !== 'string' || !HEX40.test(r.commit)) f.push(`shape:verification.${kind}.commit`)
  if (!isInt(r.passed) || r.passed < 1) f.push(`shape:verification.${kind}.passed`)
  if (r.failed !== 0) f.push(`shape:verification.${kind}.failed`)
  if (typeof r.at !== 'string' || !ISO.test(r.at)) f.push(`shape:verification.${kind}.at`)
  if (typeof r.recordSha256 !== 'string' || !HEX64.test(r.recordSha256)) f.push(`shape:verification.${kind}.recordSha256`)
  if (kind === 'piiGuard' && (typeof r.rulesHash !== 'string' || !HEX64.test(r.rulesHash))) f.push('shape:verification.piiGuard.rulesHash')
  if (kind === 'e2e' && r.skipped !== 0) f.push('shape:verification.e2e.skipped')
  return f
}

/** 메타 형식 · 결정 A–C · 식별정보 가드 · 봉인 해시. 실패 코드 목록(비면 통과) */
export function validateRunMeta(meta: unknown): string[] {
  if (meta === null || meta === undefined) return ['meta:missing']
  if (!isObj(meta)) return ['meta:shape']
  const f: string[] = []
  f.push(...metaPiiFindings(meta).map((x) => `pii:${x}`))
  if (meta.format !== RUN_META_FORMAT) f.push('shape:format')
  if (typeof meta.runId !== 'string' || !RUN_ID.test(meta.runId)) f.push('shape:runId')
  if (meta.status !== 'sealed') f.push('shape:status')
  const tax = meta.taxonomy
  if (!isObj(tax) || tax.version !== PILOT_TAXONOMY) f.push('taxonomy:version')
  if (!isObj(tax) || typeof tax.definitionsHash !== 'string' || !HEX64.test(tax.definitionsHash)) f.push('taxonomy:definitionsHash')
  if (meta.detectorVersion !== PILOT_DETECTOR_VERSION) f.push('detector:version')
  const pr = meta.probe
  if (!isObj(pr) || pr.capPerSession !== PILOT_PROBE_CAP) f.push('probe:cap')
  if (!isObj(pr) || typeof pr.configHash !== 'string' || !HEX64.test(pr.configHash)) f.push('probe:configHash')
  if (typeof meta.appCommit !== 'string' || !HEX40.test(meta.appCommit)) f.push('app:commit')
  const db = meta.db
  if (!isObj(db) || typeof db.latestMigration !== 'string' || !/^[0-9]{14}$/.test(db.latestMigration) || !isInt(db.migrationCount) || db.migrationCount < 1) f.push('shape:db')
  const exams = Array.isArray(meta.exams) ? meta.exams : null
  const examIds = new Set<string>()
  if (!exams || exams.length !== PILOT_EXAM_COUNT) f.push('exams:count')
  for (const [i, e] of (exams ?? []).entries()) {
    if (!isObj(e) || typeof e.examId !== 'string' || !EXAM_ID.test(e.examId)) { f.push(`exams:shape[${i}]`); continue }
    if (examIds.has(e.examId)) f.push('exams:duplicate')
    examIds.add(e.examId)
    for (const k of ['itemSetHash', 'answerKeyHash', 'corpusHash'] as const)
      if (typeof e[k] !== 'string' || !HEX64.test(e[k] as string)) f.push(`exams:${e.examId}.${k}`)
  }
  const parts = Array.isArray(meta.participants) ? meta.participants : null
  if (!parts || parts.length < PILOT_PARTICIPANTS_MIN || parts.length > PILOT_PARTICIPANTS_MAX) f.push('participants:count')
  const keys = new Set<string>()
  for (const [i, p] of (parts ?? []).entries()) {
    if (!isObj(p) || typeof p.key !== 'string' || !PKEY.test(p.key)) { f.push(`participants:shape[${i}]`); continue }
    if (keys.has(p.key)) f.push('participants:duplicate')
    keys.add(p.key)
    const ex = Array.isArray(p.exams) ? p.exams : null
    if (!ex || ex.length < 1 || ex.length > PILOT_EXAM_COUNT || new Set(ex).size !== ex.length || !ex.every((x) => typeof x === 'string' && examIds.has(x)))
      f.push(`participants:${p.key}.assignment`)
  }
  const v = meta.verification
  if (!isObj(v)) f.push('shape:verification')
  else {
    f.push(...verificationShape(v.piiGuard, 'piiGuard'), ...verificationShape(v.e2e, 'e2e'))
    for (const k of ['piiGuard', 'e2e'] as const) {
      const r = v[k]
      if (isObj(r) && typeof meta.appCommit === 'string' && r.commit !== meta.appCommit) f.push(`verify:${k}.commit`)
    }
  }
  if (typeof meta.sealedAt !== 'string' || !ISO.test(meta.sealedAt)) f.push('shape:sealedAt')
  if (typeof meta.seal !== 'string' || !HEX64.test(meta.seal)) f.push('seal:missing')
  else if (meta.seal !== metaSeal(meta as unknown as RunMeta)) f.push('seal:mismatch')
  return f
}

// ── live 대조 ─────────────────────────────────────────────────

/** 앱 · 점검 스크립트가 지금 시점에 읽은 값. 못 읽은 항목은 null(→ 닫힘) */
export interface LiveState {
  configTaxonomyVersion: string
  /** DB csat_ec_taxonomy_version 행(설정 버전) */
  dbTaxonomy: { status: string; note: string | null; definitionsHash: string | null } | null
  detectorVersion: string | null
  probeCap: number | null
  probeConfigHash: string | null
  /** 서버 env CSAT_EC_PILOT_USER_IDS 의 유효 UUID 개수(계정 id 자체는 게이트에 넘기지 않는다) */
  participantIdCount: number
  /** 운영자가 선언한 검증 커밋(env CSAT_EC_APP_COMMIT) — 메타 appCommit 과 같아야 한다 */
  appCommit: string | null
  /** 실제 배포 빌드 커밋(플랫폼 주입 VERCEL_GIT_COMMIT_SHA — 운영자가 덮어쓸 수 없는 값). 없으면 닫힘 */
  buildCommit: string | null
  exams: Record<string, ExamSeal | null>
  /** 점검 스크립트만 채운다(앱은 DB 메타 표를 못 읽는다) — undefined 면 비교하지 않는다 */
  db?: { latestMigration: string; migrationCount: number } | null
}

export interface GateResult { open: boolean; failures: string[]; exams: string[] }

/** 메타 가드 + live 대조. 하나라도 실패하면 닫힘 */
export function evaluateRunGate(meta: unknown, live: LiveState): GateResult {
  const failures = validateRunMeta(meta)
  if (failures.includes('meta:missing') || failures.includes('meta:shape')) return { open: false, failures, exams: [] }
  const m = meta as RunMeta
  if (live.configTaxonomyVersion !== PILOT_TAXONOMY || live.configTaxonomyVersion !== m.taxonomy?.version) failures.push('live:taxonomy.config')
  const t = live.dbTaxonomy
  if (!t || t.status !== 'sealed' || /TEST/.test(t.note ?? '') || !t.definitionsHash || t.definitionsHash !== m.taxonomy?.definitionsHash) failures.push('live:taxonomy.hash')
  if (live.detectorVersion !== PILOT_DETECTOR_VERSION || live.detectorVersion !== m.detectorVersion) failures.push('live:detector')
  if (live.probeCap === null || live.probeCap !== PILOT_PROBE_CAP || live.probeCap !== m.probe?.capPerSession) failures.push('live:probe.cap')
  if (!live.probeConfigHash || live.probeConfigHash !== m.probe?.configHash) failures.push('live:probe.config')
  if (live.participantIdCount !== (Array.isArray(m.participants) ? m.participants.length : -1)) failures.push('live:participants.count')
  if (!live.appCommit || live.appCommit.toLowerCase() !== m.appCommit) failures.push('live:app.commit')
  // 배포 빌드 = 검증 커밋 그 자체(§16 앱 커밋 봉인). 다른 코드가 배포되면 env 가 낡아 있어도 닫힌다
  if (!live.buildCommit || live.buildCommit.toLowerCase() !== m.appCommit) failures.push('live:app.build')
  for (const e of Array.isArray(m.exams) ? m.exams : []) {
    const l = live.exams[e?.examId]
    if (!l) { failures.push(`live:exam.${e?.examId}.missing`); continue }
    for (const k of ['itemSetHash', 'answerKeyHash', 'corpusHash'] as const) if (l[k] !== e[k]) failures.push(`live:exam.${e.examId}.${k}`)
  }
  if (live.db !== undefined) {
    if (!live.db || live.db.latestMigration !== m.db?.latestMigration || live.db.migrationCount !== m.db?.migrationCount) failures.push('live:db.migrations')
  }
  const open = failures.length === 0
  return { open, failures, exams: open ? m.exams.map((e) => e.examId) : [] }
}
