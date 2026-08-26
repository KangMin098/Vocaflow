// scripts/csat/test-blueprint-coverage.mjs
//
// **"출제 설계도가 완성됐다" 를 숫자로 만든다.**
//
// 분모 = 현행 37 유형 × 요건 5 = **185 칸**. 분자 = 기계로 확인되는 칸.
// 자기 신고를 세지 않는다 — 요건마다 **파일이 있고 그 안에 값이 있는지**를 확인한다.
//
// | 요건 | 무엇을 확인하나 |
// |---|---|
// | R1 설계 서술 | 능력 정의 · 출제 명제 · 출제자 사고 ≥3단계 · 오답 생성 원리 ≥3종 |
// | R2 제약 실측 | 14개년 검정 통과 제약 ≥2개, 그중 HARD ≥1 (형식·가족·내용 어느 층이든) |
// | R3 계측 대역 | `type-bands-all.json` 에 n≥7 대역 |
// | R4 생성 절차 | 단계 ≥4, **각 단계에 실패 시 처리(check)** |
// | R5 생성 검증 | 그 절차로 만든 문항이 대역 안에 들었다는 실측 기록 |
//
// 실행: node scripts/csat/test-blueprint-coverage.mjs

import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('scripts/csat/data')
const rd = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))

const inv = rd('type-inventory.json')
const bands = rd('type-bands-all.json').bands
const con = fs.existsSync(path.join(DIR, 'type-constraints.json')) ? rd('type-constraints.json') : { types: {} }
const REG_F = path.join(DIR, 'blueprint-registry.json')
const reg = fs.existsSync(REG_F) ? JSON.parse(fs.readFileSync(REG_F, 'utf8')) : { types: {} }

const current = inv.rows.filter((r) => r.current)
const REQ = ['R1', 'R2', 'R3', 'R4', 'R5']

const nonEmpty = (s) => typeof s === 'string' && s.trim().length >= 10

function checkR1(e) {
  if (!e) return [false, '항목 없음']
  if (!nonEmpty(e.ability)) return [false, '능력 정의 없음']
  if (!nonEmpty(e.proposition)) return [false, '출제 명제 없음']
  if (!Array.isArray(e.thought) || e.thought.filter(nonEmpty).length < 3) return [false, '출제자 사고 3단계 미만']
  const d = e.distractors ?? []
  // 이름은 이름이라 짧다(≥2자). 검사할 것은 **어떻게 만드는가**(how) 쪽이다.
  const okD = d.filter((x) => typeof x?.name === 'string' && x.name.trim().length >= 2 && nonEmpty(x?.how))
  if (okD.length < 3) return [false, `오답 생성 원리 ${okD.length}종 (3 필요)`]
  return [true, '']
}

/**
 * R2 — 제약. 자동 계측(`type-constraints.json`)과 손으로 등록한 것(registry)을 합쳐 본다.
 * 요구: **통과 제약 ≥2, 그중 HARD ≥1.** 기각(REJECT)만 있으면 미충족이다.
 * 손 등록분은 근거 파일이 실제로 있어야 센다 — 문장만으로는 세지 않는다.
 */
function checkR2(t, e) {
  const auto = con.types?.[t]
  const pool = []
  if (auto) {
    for (const c of auto.format ?? []) if (c.kind === 'HARD') pool.push({ id: c.id, kind: c.kind })
    for (const c of [...(auto.content ?? []), ...(auto.family ?? [])]) if (c.kind !== 'REJECT') pool.push({ id: c.id, kind: c.kind })
  }
  for (const c of e?.constraints ?? []) {
    if (!['HARD', 'SOFT'].includes(c?.kind)) continue
    if (!nonEmpty(c.claim)) return [false, `${c.id}: 주장 문구 없음`]
    if (!Number.isFinite(c.n) || c.n < 7) return [false, `${c.id}: 표본 n=${c.n}`]
    if (!nonEmpty(c.stat)) return [false, `${c.id}: 통계 근거 없음`]
    const ev = c.evidence ?? {}
    for (const k of ['script', 'data']) {
      if (!ev[k]) return [false, `${c.id}: evidence.${k} 없음`]
      if (!fs.existsSync(path.resolve(ev[k]))) return [false, `${c.id}: ${ev[k]} 파일 없음`]
    }
    pool.push({ id: c.id, kind: c.kind })
  }
  const hard = pool.filter((c) => c.kind === 'HARD').length
  if (pool.length < 2) return [false, `통과 제약 ${pool.length}개 (2 필요)`]
  if (hard < 1) return [false, 'HARD 제약 0개']
  return [true, '']
}

function checkR3(t) {
  const b = bands[t]
  if (!b?.ok) return [false, `대역 없음 (n=${b?.n ?? 0})`]
  return [true, '']
}

function checkR4(e) {
  const p = e?.procedure ?? []
  const ok = p.filter((x) => nonEmpty(x?.step) && nonEmpty(x?.check))
  if (ok.length < 4) return [false, `절차 ${ok.length}단계 (실패 처리 포함 4 필요)`]
  return [true, '']
}

function checkR5(e) {
  const v = e?.validation
  if (!v) return [false, '검증 기록 없음']
  if (!v.data || !fs.existsSync(path.resolve(v.data))) return [false, `데이터 ${v.data ?? '?'} 없음`]
  if (!nonEmpty(v.metric)) return [false, '측도 없음']
  if (!(v.pass >= 1) || !(v.total >= 1)) return [false, '통과/전체 수 없음']
  if (v.pass < v.total) return [false, `대역 안 ${v.pass}/${v.total}`]
  return [true, '']
}

const rows = []
for (const r of current) {
  const e = reg.types?.[r.type]
  const res = {
    R1: checkR1(e), R2: checkR2(r.type, e), R3: checkR3(r.type), R4: checkR4(e), R5: checkR5(e),
  }
  rows.push({ type: r.type, name: r.name, sec: r.sec, res })
}

const cells = rows.length * REQ.length
const done = rows.reduce((s, r) => s + REQ.filter((k) => r.res[k][0]).length, 0)
const full = rows.filter((r) => REQ.every((k) => r.res[k][0])).length

const perReq = Object.fromEntries(REQ.map((k) => [k, rows.filter((r) => r.res[k][0]).length]))

console.log(`설계도 달성률 ${done}/${cells} = ${(done / cells * 100).toFixed(1)}%   (유형 완성 ${full}/${rows.length})`)
console.log(`요건별: ${REQ.map((k) => `${k} ${perReq[k]}/${rows.length}`).join(' · ')}`)
console.log('')
console.log(['type', 'sec', ...REQ, '막힌 곳'].join('\t'))
for (const r of rows) {
  const marks = REQ.map((k) => (r.res[k][0] ? 'O' : '.'))
  const why = REQ.filter((k) => !r.res[k][0]).map((k) => `${k}:${r.res[k][1]}`)[0] ?? ''
  console.log([r.type, r.sec, ...marks, why].join('\t'))
}

fs.writeFileSync(path.join(DIR, 'blueprint-coverage.json'), JSON.stringify({
  denominator: rows.length, requirements: REQ, cells, done, pct: +(done / cells * 100).toFixed(1),
  fullTypes: full, perReq,
  rows: rows.map((r) => ({ type: r.type, ...Object.fromEntries(REQ.map((k) => [k, r.res[k][0]])), blocked: REQ.filter((k) => !r.res[k][0]).map((k) => `${k}:${r.res[k][1]}`) })),
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'blueprint-coverage.json')}`)
process.exit(done === cells ? 0 : 1)
