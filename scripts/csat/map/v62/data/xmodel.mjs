// scripts/csat/map/v62/data/xmodel.mjs
//
// 교차 모델 검증 — r5r6(Claude A · Claude B) 확대 결과를 Codex 판정과 비교한다.
// 같은 모델 A/B 일치는 공유 편향을 걸러내지 못한다(rules-v21 실측: Claude–Claude κ .805 → Claude–Codex κ .695, R4 .96 → .30).
//   node scripts/csat/map/v62/data/xmodel.mjs select    # local/xmodel/chunk-X-0N.json (96문항 · 유형 층화 · seed 고정, 있으면 건너뜀)
//   node scripts/csat/map/v62/data/xmodel.mjs compare   # Codex 출력(chunk-X-0N.out.json) vs Claude A · B → docs/.../xmodel-agreement.json
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { LOCAL, ROOT, nonHeldTasks, validateLinkChunk, validateLinkRow } from './pilot-lib.mjs'

const DIR = path.join(LOCAL, 'xmodel')
const OUT = path.join(ROOT, 'docs/csat-learner/v62/data-expansion/xmodel-agreement.json')
const TASKS = ['r.central_meaning', 'r.inference']
const N = 96
const CHUNK = 48
const SEED = 'xmodel-20261023'
const input = JSON.parse(fs.readFileSync(path.join(LOCAL, 'expand-input.json'), 'utf8'))
const byId = new Map(input.rows.map((r) => [r.item_id, r]))
const links = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/csat-learner/v62/data-expansion/r5r6-links.json'), 'utf8')).links
const rank = (id) => crypto.createHash('sha256').update(`${SEED}|${id}`).digest('hex')

function select() {
  fs.mkdirSync(DIR, { recursive: true })
  if (fs.existsSync(path.join(DIR, 'selection.json'))) { console.log('선정 동결 — 건너뜀'); return }
  // 원천 결함 · 수정 대상은 제외(현재 원문과 판정 원문이 다르다)
  const usable = new Set(links.filter((l) => l.state !== 'SOURCE_DEFECT').map((l) => l.item))
  const byType = new Map()
  for (const id of usable) { const t = byId.get(id).type_id ?? 'null'; byType.set(t, [...(byType.get(t) ?? []), id]) }
  // 유형별 비례 배분(최소 1) 후 seed 순서로 뽑는다
  const total = usable.size
  const quota = new Map([...byType].map(([t, ids]) => [t, Math.max(1, Math.round((ids.length / total) * N))]))
  let picked = []
  for (const [t, ids] of byType) picked.push(...ids.sort((a, b) => rank(a).localeCompare(rank(b))).slice(0, quota.get(t)))
  picked = picked.sort((a, b) => rank(a).localeCompare(rank(b))).slice(0, N).sort()
  const defs = nonHeldTasks()
  for (let k = 0; k * CHUNK < picked.length; k++) {
    const items = picked.slice(k * CHUNK, (k + 1) * CHUNK).map((id) => { const r = byId.get(id); return { item_id: id, type_id: r.type_id, source: r.source, source_sha256: r.source_sha256 } })
    fs.writeFileSync(path.join(DIR, `chunk-X-${String(k + 1).padStart(2, '0')}.json`), JSON.stringify({ batch: 'xmodel', track: 'X(Codex)', contracts: ['docs/csat-learner/v62/data-expansion/ANALYST_CONTRACT.md'], tasks: defs.filter((d) => TASKS.includes(d.id)), reference_tasks: defs, items }, null, 1))
  }
  fs.writeFileSync(path.join(DIR, 'selection.json'), JSON.stringify({ seed: SEED, n: picked.length, quota: Object.fromEntries(quota), items: picked }, null, 1))
  console.log(`선정 ${picked.length}문항 · 유형 ${byType.size} → ${path.relative(ROOT, DIR)}`)
}

function kappa(pairs) {
  const cats = [...new Set(pairs.flat())]
  const n = pairs.length
  if (!n) return null
  const po = pairs.filter(([a, b]) => a === b).length / n
  const pe = cats.reduce((s, c) => s + (pairs.filter(([a]) => a === c).length / n) * (pairs.filter(([, b]) => b === c).length / n), 0)
  return pe === 1 ? null : Number(((po - pe) / (1 - pe)).toFixed(4))
}
const bin = (v) => (v === 'direct' ? 'direct' : 'other')

function compare() {
  const sel = JSON.parse(fs.readFileSync(path.join(DIR, 'selection.json'), 'utf8'))
  const codex = new Map()
  const errors = []
  for (const f of fs.readdirSync(DIR).filter((f) => /^chunk-X-\d+\.out\.json$/.test(f))) {
    const rows = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).rows ?? []
    errors.push(...validateLinkChunk(rows).map((e) => `${f}: ${e}`))
    for (const r of rows) { const e = validateLinkRow(r, byId.get(r.item_id), TASKS); if (e.length) errors.push(...e.map((x) => `${f} ${r.item_id}: ${x}`)); else codex.set(r.item_id, r) }
  }
  const missing = sel.items.filter((id) => !codex.has(id))
  if (errors.length || missing.length) { console.log(`결함 ${errors.length} · 누락 ${missing.length}`); for (const e of [...errors, ...missing.map((m) => `누락 ${m}`)].slice(0, 30)) console.log('  ' + e); process.exit(1) }
  const per = {}
  for (const t of TASKS) {
    const rows = sel.items.map((id) => {
      const l = links.find((x) => x.item === id && x.task === t)
      return { id, A: l.judgments.A, B: l.judgments.B, X: codex.get(id).links.find((x) => x.task_id === t).relevance, r1: l.candidateRelevance }
    })
    const pairs = (k1, k2) => rows.map((r) => [r[k1], r[k2]])
    const r1Direct = rows.filter((r) => r.r1 === 'direct')
    per[t] = {
      n: rows.length,
      kappa: { claudeA_claudeB: kappa(pairs('A', 'B')), claudeA_codex: kappa(pairs('A', 'X')), claudeB_codex: kappa(pairs('B', 'X')) },
      direct_binary_kappa: { claudeA_claudeB: kappa(rows.map((r) => [bin(r.A), bin(r.B)])), claudeA_codex: kappa(rows.map((r) => [bin(r.A), bin(r.X)])), claudeB_codex: kappa(rows.map((r) => [bin(r.B), bin(r.X)])) },
      r1_direct: { n: r1Direct.length, codex_direct: r1Direct.filter((r) => r.X === 'direct').length, codex_other: r1Direct.filter((r) => r.X !== 'direct').map((r) => `${r.id}:${r.X}`) },
      codex_direct_not_r1: rows.filter((r) => r.X === 'direct' && r.r1 !== 'direct').map((r) => `${r.id}:A=${r.A},B=${r.B}`),
    }
  }
  const out = { seed: sel.seed, n: sel.items.length, note: 'Claude A/B(같은 모델)와 Codex(다른 모델) 판정 비교. R1 direct 유지율 = 두 Claude 가 일치한 direct 중 Codex 도 direct 인 비율. 사람 검수 아님.', per_task: per }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n')
  for (const [t, v] of Object.entries(per)) console.log(`${t}: κ A–B ${v.kappa.claudeA_claudeB} · A–X ${v.kappa.claudeA_codex} · B–X ${v.kappa.claudeB_codex} | direct 이분 A–B ${v.direct_binary_kappa.claudeA_claudeB} · A–X ${v.direct_binary_kappa.claudeA_codex} · B–X ${v.direct_binary_kappa.claudeB_codex} | R1 direct ${v.r1_direct.n} 중 Codex direct ${v.r1_direct.codex_direct}`)
}

const cmd = process.argv[2]
if (cmd === 'select') select()
else if (cmd === 'compare') compare()
else { console.error('select | compare'); process.exit(2) }
