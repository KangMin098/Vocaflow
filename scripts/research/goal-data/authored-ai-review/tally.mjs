// scripts/research/goal-data/authored-ai-review/tally.mjs — 1차 두 모델 검토 집계(읽기 전용). 두 모델 모두 accept · 정답 일치 · gold_issues 0 인 문항 = 2차 범위 후보
import fs from 'node:fs'
import path from 'node:path'
const ROOT = process.cwd()
const OUT = path.join(ROOT, 'docs/research/goal-data-batches/authored-ai-review')
const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/final/review/FINAL_CONTENT_DECISION_MANIFEST_20261022.json'), 'utf8'))
const parse = (f) => { const t = fs.readFileSync(f, 'utf8'); const m = t.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null }
const rows = []
let tot = { items: 0, both: 0, assess: 0, assessBoth: 0 }
for (const s of man.sets) {
  const set = JSON.parse(fs.readFileSync(path.join(ROOT, s.file), 'utf8'))
  const c = parse(path.join(OUT, s.set_revision, 'claude/result.txt')), x = parse(path.join(OUT, s.set_revision, 'codex/result.txt'))
  const by = (r, id) => r?.items?.find((i) => i.id === id)
  const items = set.items.map((it) => {
    const a = by(c, it.id), b = by(x, it.id), ans = it.gold?.answer ?? null
    const okOne = (v) => v && v.verdict === 'accept' && (v.choice_0based ?? null) === ans && (v.gold_issues ?? []).length === 0
    return { id: it.id, role: it.role, assess: ['independent_check', 'transfer', 'delayed_check'].includes(it.role), claude: a?.verdict ?? 'missing', codex: b?.verdict ?? 'missing', both: okOne(a) && okOne(b),
      issues: [...(a?.gold_issues ?? []).map((g) => 'C: ' + (typeof g === 'string' ? g : JSON.stringify(g))), ...(b?.gold_issues ?? []).map((g) => 'X: ' + (typeof g === 'string' ? g : JSON.stringify(g)))] }
  })
  tot.items += items.length; tot.both += items.filter((i) => i.both).length
  tot.assess += items.filter((i) => i.assess).length; tot.assessBoth += items.filter((i) => i.assess && i.both).length
  rows.push({ set: s.set_revision, file: s.file, file_sha256: s.file_sha256, claude_set: c?.verdict, codex_set: x?.verdict, both_accepted: items.filter((i) => i.both).map((i) => i.id), items })
}
fs.writeFileSync(path.join(OUT, 'round1-tally.json'), JSON.stringify({ totals: tot, sets: rows }, null, 2) + '\n')
console.log(JSON.stringify(tot))
for (const r of rows) console.log(r.set.padEnd(30), `${r.claude_set}/${r.codex_set}`.padEnd(16), `둘 다 수락 ${r.both_accepted.length}/${r.items.length}`, '평가', `${r.items.filter((i) => i.assess && i.both).length}/${r.items.filter((i) => i.assess).length}`)
