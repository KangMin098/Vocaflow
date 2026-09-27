// scripts/csat/checklist-exp/thin-rule.mjs
//
// **「가는 연결(linkThin) → 보류」 규칙을 풀면 어떻게 되나 — 새 판정 없이 기존 답과 전문 판정만 대 본다(읽기 전용 · DB 0).**
// 입력: checklist-drain/batch-{1,2}(단신 473편 · 커밋됨) · checklist-exp/work-v2(실험 v2 195편 · gitignore — 없으면 그 절만 빈다).
// 결과 기록: docs/reports/checklist-exp-20260926.md 「단신 가는 연결 재측정」.
// 실행: node scripts/csat/checklist-exp/thin-rule.mjs
import fs from 'node:fs'

import { decide } from './decide.mjs'

const R = new URL('../', import.meta.url).pathname
const J = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))

// ① 단신 473편 — 체크리스트 답 + 전문 판정(있는 것만)
const brief = []
for (const b of ['batch-1', 'batch-2']) {
  const D = `${R}checklist-drain/${b}/`
  const truth = new Map()
  for (const f of fs.readdirSync(D).filter((x) => /^full-\d+\.out\.json$/.test(x))) for (const r of J(D + f)) truth.set(r.id, r.retention)
  for (const f of fs.readdirSync(D).filter((x) => /^chunk-\d+\.out\.json$/.test(x))) {
    const src = new Map(J(D + f.replace('.out', '')).map((x) => [x.id, x.source]))
    for (const o of J(D + f)) brief.push({ id: o.id, source: src.get(o.id), a: o.answers, truth: truth.get(o.id) ?? null })
  }
}
// ② 실험 v2 195편(층화 · 원천 여럿) — 가벼운 판정자(cO)와 일반 에이전트(무접미) 답 둘 다
const W = `${R}checklist-exp/work-v2/`
const HAS_EXP = fs.existsSync(W + 'key.json')
const key = new Map(HAS_EXP ? J(W + 'key.json').items.map((i) => [i.id, i]) : [])
const exp = {}
for (const suf of HAS_EXP ? ['', '.cO'] : []) {
  exp[suf || 'agent'] = []
  for (const f of fs.readdirSync(W).filter((x) => new RegExp(`^chunk-\\d+${suf.replace('.', '\\.')}\\.out\\.json$`).test(x))) {
    for (const o of J(W + f)) { const k = key.get(o.id); if (k) exp[suf || 'agent'].push({ id: o.id, source: k.source, a: o.answers, truth: k.truth }) }
  }
}

const CAND = {
  'C1 thin·strippedRemains': (a) => a.strippedRemains,
  'C2 thin·stripped·가공3': (a) => a.strippedRemains && a.detachable && a.standsAlone && a.vocabAdjustable,
  'C3 thin·(요지∨서사)': (a) => a.mainPoint || a.narrative,
  'C4 thin·stripped·factsMany': (a) => a.strippedRemains && a.factsMany,
  'C5 thin·stripped·(요지∨서사)': (a) => a.strippedRemains && (a.mainPoint || a.narrative),
}

function measure(name, rows, onlySource) {
  const thin = rows.filter((r) => decide(r.a).rule === 'linkThin' && (!onlySource || r.source === onlySource))
  const known = thin.filter((r) => r.truth)
  const base = rows.filter((r) => decide(r.a).retention === 'keep')
  console.log(`\n### ${name}${onlySource ? ` (${onlySource}만)` : ''} — 전체 ${rows.length} · 지금 바로 확정 ${base.length} · linkThin ${thin.length}(정답 있음 ${known.length}, 그중 keep ${known.filter((r) => r.truth === 'keep').length})`)
  for (const [c, f] of Object.entries(CAND)) {
    const add = known.filter((r) => f(r.a))
    const wrong = add.filter((r) => r.truth !== 'keep')
    console.log(`  ${c.padEnd(32)} 더 확정 ${String(add.length).padStart(3)} · 그중 오판 ${wrong.length} (${add.length ? (100 * wrong.length / add.length).toFixed(1) : '-'}%) ${wrong.length ? '← ' + wrong.map((w) => `${w.id.slice(0, 8)}:${w.truth}`).join(' ') : ''}`)
  }
}
measure('단신 배치 1·2', brief)
if (!HAS_EXP) { console.log('\n(실험 v2 폴더가 없다 — 단신 절만 쟀다)'); process.exit(0) }
measure('실험 v2 · 가벼운 판정자', exp['.cO'])
measure('실험 v2 · 가벼운 판정자', exp['.cO'], 'wikinews')
measure('실험 v2 · 일반 에이전트', exp.agent)

// 층화 되돌리기 — 표본은 판정값별로 정해진 수를 뽑았다(keep 100 · hold 40 · discard 60). 모집단 비율로 가중.
const K = J(W + 'key.json')
const cnt = { keep: 0, hold: 0, discard: 0 }
for (const i of K.items) cnt[i.truth]++
const w = Object.fromEntries(Object.entries(K.population).map(([v, n]) => [v, n / cnt[v]]))
console.log('\n모집단', JSON.stringify(K.population), '· 가중', JSON.stringify(Object.fromEntries(Object.entries(w).map(([k, v]) => [k, +v.toFixed(1)]))))
for (const [name, rows] of [['가벼운 판정자', exp['.cO']], ['일반 에이전트', exp.agent]]) {
  for (const only of [null, 'wikinews']) {
    const thin = rows.filter((r) => decide(r.a).rule === 'linkThin' && (!only || r.source === only))
    const tot = thin.reduce((s, r) => s + w[r.truth], 0)
    const bad = thin.filter((r) => r.truth !== 'keep').reduce((s, r) => s + w[r.truth], 0)
    console.log(`  ${name}${only ? ' (wikinews)' : ''}: linkThin 을 전부 keep 으로 올리면 모집단 가중 오판 ${(100 * bad / tot).toFixed(1)}% (표본 ${thin.length}편)`)
  }
}
