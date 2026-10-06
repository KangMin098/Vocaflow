// apps/web/src/lib/csat/ec-pilot/__tests__/model-input-enforcement.test.ts
//
// 모델 입력 비식별화 강제(PILOT_PROTOCOL §9 · G6 체크리스트 4) — **기본 거부** 정적 검사.
// 저장소의 코드 파일 중 AI 판정 입력/적재 RPC(csat_ec_ai_export · csat_ec_ai_import · csat_ec_canonical_input)를 부르는 곳은
//   (a) 유일한 운영 래퍼(model-input/model-packets.mjs) — RPC 결과를 deidentifyPacket 에 넘기고, 차단이 아닌 결과(r.packet)만 파일로 쓴다
//   (b) 아래 「검증 하네스」 목록에 있고 모델 SDK · CLI 를 전혀 부르지 않아야 한다(DB 함수 동작만 확인 — 모델에 보내지 않는다).
// 모듈 import 만으로는 통과하지 않는다(import 하고 원본을 보내는 우회를 막는다). 새 파일이 이 RPC 를 부르면 실패한다.

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '../../../../../../..')
const SCAN_DIRS = ['scripts', 'apps/web/src', 'apps/web/scripts', 'packages', 'agents']
const CODE = /\.(m?js|cjs|tsx?)$/
const AI_RPC = /csat_ec_ai_export|csat_ec_ai_import|csat_ec_canonical_input/
const DEID_IMPORT = /from\s+['"][^'"]*model-input\/deidentify\.mjs['"]|from\s+['"]\.\/deidentify\.mjs['"]/
const MODEL_CALL = /@anthropic-ai\/sdk|from\s+['"]openai['"]|api\.anthropic\.com|api\.openai\.com|(?:spawn|exec|execFile|execSync|execFileSync)\s*\(\s*['"`](?:claude|codex)\b/

/** DB 함수 동작만 보는 검증 하네스 — 모델에 보내지 않는다(MODEL_CALL 이 있으면 실패) */
const HARNESSES = new Set([
  'scripts/csat/error-evidence/dev-smoke/smoke-capture.mjs',
  'scripts/csat/error-evidence/dev-smoke/smoke-pilot.mjs',
  'scripts/csat/error-evidence/dev-smoke/smoke.mjs',
  'scripts/csat/error-evidence/isolated-pg/seed.mjs',
  'scripts/csat/error-evidence/isolated-pg/t_funcs.mjs',
  'scripts/csat/error-evidence/isolated-pg/t_p2fix.mjs',
  'scripts/csat/error-evidence/isolated-pg/t_pilot.mjs',
  'scripts/csat/error-evidence/isolated-pg/t_rls.mjs',
])
const MODULE = 'scripts/csat/error-evidence/model-input/deidentify.mjs'
const WRAPPER = 'scripts/csat/error-evidence/model-input/model-packets.mjs'

function walk(dir: string, out: string[]) {
  if (!fs.existsSync(dir)) return
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '__tests__' || e.name.startsWith('.next')) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (CODE.test(e.name)) out.push(p)
  }
}

const files = (() => {
  const out: string[] = []
  for (const d of SCAN_DIRS) walk(path.join(ROOT, d), out)
  return out.map((p) => ({ rel: path.relative(ROOT, p).split(path.sep).join('/'), text: fs.readFileSync(p, 'utf8') }))
})()

describe('AI 판정 입력 경로는 비식별화 모듈을 거친다(기본 거부)', () => {
  const callers = files.filter((f) => AI_RPC.test(f.text) && f.rel !== MODULE)

  it('호출 파일을 실제로 찾는다(검사가 빈 손으로 통과하지 않게)', () => {
    expect(callers.length).toBeGreaterThanOrEqual(HARNESSES.size)
    expect(callers.some((f) => f.rel.endsWith('model-input/model-packets.mjs'))).toBe(true)
  })

  it('모든 호출 파일 = 운영 래퍼 하나 또는 모델을 부르지 않는 검증 하네스', () => {
    const bad = callers.filter((f) => !(f.rel === WRAPPER || HARNESSES.has(f.rel))).map((f) => f.rel)
    expect(bad).toEqual([])
  })

  it('운영 래퍼 — export 결과는 deidentifyPacket 을 거치고, 쓰는 packet 은 차단이 아닌 r.packet 뿐', () => {
    const w = files.find((f) => f.rel === WRAPPER)!.text
    expect(DEID_IMPORT.test(w)).toBe(true)
    expect(w).toMatch(/const \{ data: packet[^}]*\} = await db\.rpc\('csat_ec_ai_export'/)
    expect(w).toMatch(/deidentifyPacket\(packet,/)
    expect(w).toMatch(/if \(r\.status !== 'ok'\) \{[^\n]*continue \}/)
    // packet 을 쓰는 곳은 r.packet 하나 — 원본(packet) · canonical_input 을 직접 쓰지 않는다
    const writes = [...w.matchAll(/writeFileSync\(([^\n]*)\)/g)].map((m) => m[1])
    expect(writes.some((x) => /JSON\.stringify\(r\.packet,/.test(x))).toBe(true)
    expect(writes.some((x) => /JSON\.stringify\(packet\b|canonical_input/.test(x))).toBe(false)
    expect(MODEL_CALL.test(w)).toBe(false)
  })

  it('검증 하네스는 모델 SDK · CLI 를 부르지 않는다', () => {
    const bad = callers.filter((f) => HARNESSES.has(f.rel) && MODEL_CALL.test(f.text)).map((f) => f.rel)
    expect(bad).toEqual([])
  })

  it('모델 SDK · CLI 를 부르는 파일이 판정 RPC 도 부르면 반드시 비식별화 모듈을 import', () => {
    const bad = files.filter((f) => MODEL_CALL.test(f.text) && AI_RPC.test(f.text) && !DEID_IMPORT.test(f.text)).map((f) => f.rel)
    expect(bad).toEqual([])
  })

  it('검사 규칙 자체 — 모듈 없는 새 호출 파일은 걸린다', () => {
    const fake = { rel: 'scripts/csat/new-judge.mjs', text: "await db.rpc('csat_ec_ai_export', {})" }
    expect(AI_RPC.test(fake.text) && !(fake.rel === WRAPPER || HARNESSES.has(fake.rel))).toBe(true)
    const sneaky = { rel: 'scripts/csat/sneaky.mjs', text: "import { deidentifyPacket } from './model-input/deidentify.mjs'\nawait db.rpc('csat_ec_ai_export', {})" }
    expect(sneaky.rel === WRAPPER || HARNESSES.has(sneaky.rel)).toBe(false)
  })
})
