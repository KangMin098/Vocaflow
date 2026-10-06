// scripts/csat/pilot/live.mjs
//
// G6 게이트의 live 값 읽기(운영 점검 · 봉인 공용) — **읽기 전용 트랜잭션**으로만 질의한다(DB 쓰기 없음).
// 해시 · 판정 규칙은 앱과 같은 파일(apps/web/src/lib/csat/ec-pilot/run-gate.ts)을 node 타입 제거 실행으로 그대로 쓴다.
// pg 모듈: 저장소 의존성이 아니다 — 전역/로컬 설치가 없으면 env CSAT_PG_MODULE_DIR(그 아래 node_modules/pg 가 있는 디렉터리)로 지정한다.

import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { rulesHash } from '../error-evidence/model-input/deidentify.mjs'
import { captureProbeConfig } from '../../../apps/web/src/lib/csat/ec-pilot/probes.ts'
import { canonicalJson, examSeal, probeConfigHash, sha256 } from '../../../apps/web/src/lib/csat/ec-pilot/run-gate.ts'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
export const RUNS = path.join(ROOT, 'docs/csat-learner/pilot-runs')
const DEV_REF = 'jajenrevcbmrpaliomxv'

export async function loadPg() {
  try { return (await import('pg')).default } catch {
    const dir = process.env.CSAT_PG_MODULE_DIR
    if (!dir) throw new Error('pg 모듈이 없다 — env CSAT_PG_MODULE_DIR 에 pg 가 설치된 디렉터리를 준다')
    return createRequire(path.join(dir, 'noop.js'))('pg')
  }
}

/** 앱 설정(config.ts)의 probeCapPerSession — config.ts 는 server-only 라 import 하지 못해 소스에서 읽는다 */
export function configProbeCap() {
  const src = fs.readFileSync(path.join(ROOT, 'apps/web/src/lib/csat/ec-pilot/config.ts'), 'utf8')
  const m = src.match(/probeCapPerSession:\s*(null|[0-9]+)\s*,/)
  if (!m) throw new Error('config.ts 에서 probeCapPerSession 을 찾지 못했다')
  return m[1] === 'null' ? null : Number(m[1])
}
export function configTaxonomy() {
  const src = fs.readFileSync(path.join(ROOT, 'apps/web/src/lib/csat/ec-pilot/config.ts'), 'utf8')
  return src.match(/taxonomyVersion:\s*'([^']+)'/)?.[1] ?? null
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const participantIdCount = (env = process.env.CSAT_EC_PILOT_USER_IDS) =>
  new Set((env ?? '').split(',').map((x) => x.trim().toLowerCase()).filter((x) => UUID.test(x))).size

export const fileSha256 = (p) => sha256(fs.readFileSync(p, 'utf8'))
export { rulesHash }

export const E2E_REQUIRED_SPEC = 'tests/e2e/52-csat-ec-capture.spec.ts'
const HEX64 = /^[0-9a-f]{64}$/, HEX40 = /^[0-9a-f]{40}$/, ISO = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/

/**
 * 검증 기록 원본 검사(봉인 · 점검 공용) — 형식 · run id · 통과 조건. 메타가 있으면 메타 요약과도 대조한다.
 * @param {string} runId
 * @param {{ pii: {sha256:string,json:object}|null, e2e: {sha256:string,json:object}|null }} files
 * @param {object|null} meta
 * @param {{ e2eReportSha256?: string|null }} [opt] 저장소 밖 Playwright JSON 리포트의 sha256(주면 대조)
 */
export function recordFailures(runId, files, meta, opt = {}) {
  const f = []
  const pii = files.pii, e2e = files.e2e
  if (!pii) f.push('record:piiGuard.missing')
  else {
    const j = pii.json
    if (j.format !== 'ec-pilot-pii-guard-1' || j.runId !== runId || !HEX40.test(j.commit ?? '') || !ISO.test(j.at ?? '') || !(j.passed >= 1) || j.failed !== 0) f.push('record:piiGuard.fields')
    if (j.rulesHash !== rulesHash()) f.push('record:piiGuard.rulesHash')
  }
  if (!e2e) f.push('record:e2e.missing')
  else {
    const j = e2e.json
    if (j.format !== 'ec-pilot-e2e-1' || j.runId !== runId || !HEX40.test(j.commit ?? '') || !ISO.test(j.at ?? '') || !(j.passed >= 1) || j.failed !== 0 || j.skipped !== 0) f.push('record:e2e.fields')
    if (j.build !== 'production') f.push('record:e2e.build')
    if (!Array.isArray(j.specs) || !j.specs.includes(E2E_REQUIRED_SPEC)) f.push('record:e2e.specs')
    if (!HEX64.test(j.reportSha256 ?? '')) f.push('record:e2e.reportSha256')
    else if (opt.e2eReportSha256 && opt.e2eReportSha256 !== j.reportSha256) f.push('record:e2e.report')
  }
  if (pii && e2e && pii.json.commit !== e2e.json.commit) f.push('record:commit.differs')
  if (meta) {
    const v = meta.verification ?? {}
    if (pii && (pii.sha256 !== v.piiGuard?.recordSha256 || pii.json.commit !== v.piiGuard?.commit || pii.json.passed !== v.piiGuard?.passed || pii.json.rulesHash !== v.piiGuard?.rulesHash)) f.push('record:piiGuard.meta')
    if (e2e && (e2e.sha256 !== v.e2e?.recordSha256 || e2e.json.commit !== v.e2e?.commit || e2e.json.passed !== v.e2e?.passed || e2e.json.at !== v.e2e?.at)) f.push('record:e2e.meta')
  }
  return f
}

export function readRecord(name) {
  const p = path.join(RUNS, name)
  return fs.existsSync(p) ? { sha256: fileSha256(p), json: JSON.parse(fs.readFileSync(p, 'utf8')) } : null
}

/** 배포 env CSAT_EC_ACTIVE_RUN(앱이 읽는 메타)이 docs 정본과 같은지 — 'missing' | 'invalid' | 'differs' | 'match' */
export function envMetaState(meta, env = process.env.CSAT_EC_ACTIVE_RUN) {
  const raw = (env ?? '').trim()
  if (!raw) return 'missing'
  let v
  try { v = JSON.parse(raw) } catch { return 'invalid' }
  return canonicalJson(v) === canonicalJson(meta) ? 'match' : 'differs'
}
