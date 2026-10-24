// docs/csat-learner/lecture-audit-c-20261024/reconcile.mjs
// 632 최종 집계를 실제 ID 로 재현한다: 1차 C*.jsonl → C04b 대체 → RR 재판정 → 후속 overlay. 원 판정 파일은 읽기만 한다.
import fs from 'node:fs'
const dir = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const read = f => fs.readFileSync(dir + f, 'utf8')
const lines = f => read(f).split(/\n/).filter(Boolean).map(l => JSON.parse(l))
const hist = {}
for (const f of fs.readdirSync(dir).filter(x => /^C\d\d\.jsonl$/.test(x)))
  for (const j of lines(f)) hist[j.item_id] = [{ stage: 'r1:' + f.slice(0, 3), status: j.status }]
for (const j of lines('C04b.jsonl')) hist[j.item_id].push({ stage: 'r2:C04b', status: j.status })
for (const m of read('RR_XV.md').matchAll(/^\| ([0-9A-Z]+#\d+) \| (ISSUE_CONFIRMED|PASS|REVIEW_REQUIRED) \|/gm)) hist[m[1]].push({ stage: 'r2:RR', status: m[2] })
const overlay = JSON.parse(read('followup_status_overlay.json'))
for (const [k, v] of Object.entries(overlay)) if (hist[k]) hist[k].push({ stage: 'followup:' + v.by, status: v.to })
const final = Object.fromEntries(Object.entries(hist).map(([k, h]) => [k, h.at(-1).status]))
const count = s => Object.values(s).reduce((a, x) => ((a[x] = (a[x] ?? 0) + 1), a), {})
const before = Object.fromEntries(Object.entries(hist).map(([k, h]) => [k, h.filter(x => !x.stage.startsWith('followup')).at(-1).status]))
const changed = Object.keys(final).filter(k => final[k] !== before[k])
console.log(JSON.stringify({ lectures: Object.keys(final).length, before_followup: count(before), final: count(final), changed_by_followup: changed.map(k => `${k}:${before[k]}→${final[k]}`), overlay_outside_632: Object.keys(overlay).filter(k => !hist[k]) }, null, 1))
