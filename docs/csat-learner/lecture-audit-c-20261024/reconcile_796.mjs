// docs/csat-learner/lecture-audit-c-20261024/reconcile_796.mjs
// 796 강의 전체를 ID 단위로 묶는다: C 632(reconcile.mjs 와 같은 이력) + C-F3 134(f3_status.json) + 이전 drain 검토 30(현재 판본 cue 해시 대조).
// 읽기 전용 — 판정 파일은 고치지 않고 결과만 출력한다.
//   node docs/csat-learner/lecture-audit-c-20261024/reconcile_796.mjs [--json]
import fs from 'node:fs'
import crypto from 'node:crypto'
import { execSync } from 'node:child_process'

const here = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const root = here.replace(/docs\/csat-learner\/lecture-audit-c-20261024\/?$/, '')
const read = (f) => fs.readFileSync(here + f, 'utf8')
const lines = (f) => read(f).split(/\n/).filter(Boolean).map((l) => JSON.parse(l))
const sha = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16)

// 현재 판본(작업 트리 = main 7f11a8538 의 lecture-data)
const lecDir = root + 'apps/web/src/lib/csat/lecture-data/'
const current = {}
for (const f of fs.readdirSync(lecDir).filter((x) => x.endsWith('.json') && x !== 'index.json'))
  Object.assign(current, JSON.parse(fs.readFileSync(lecDir + f, 'utf8')).lectures)

// ── C 632: 1차 → C04b → RR → 후속 overlay(reconcile.mjs 와 같은 순서)
const hist = {}
for (const f of fs.readdirSync(here).filter((x) => /^C\d\d\.jsonl$/.test(x)))
  for (const j of lines(f)) hist[j.item_id] = [{ stage: 'C:r1:' + f.slice(0, 3), status: j.status }]
for (const j of lines('C04b.jsonl')) hist[j.item_id].push({ stage: 'C:r2:C04b', status: j.status })
for (const m of read('RR_XV.md').matchAll(/^\| ([0-9A-Z]+#\d+) \| (ISSUE_CONFIRMED|PASS|REVIEW_REQUIRED) \|/gm))
  hist[m[1]].push({ stage: 'C:r2:RR', status: m[2] })
const overlay = JSON.parse(read('followup_status_overlay.json'))
for (const [k, v] of Object.entries(overlay)) if (hist[k]) hist[k].push({ stage: 'C:followup:' + v.by, status: v.to })

// ── C-F3 134
const f3 = JSON.parse(read('f3/f3_status.json'))
for (const [k, v] of Object.entries(f3)) {
  if (hist[k]) throw new Error(`C 632 와 C-F3 134 가 겹친다: ${k}`)
  hist[k] = [{ stage: 'F3:r1:' + v.by, status: v.r1 }]
  if (v.final !== v.r1) hist[k].push({ stage: 'F3:xv', status: v.final })
}

// ── 도표 DATA_GAP 20: 공식 문제지 쪽 이미지 판독(f5) — 이전 DATA_GAP 이력 위에 덧붙인다
const charts = JSON.parse(read('f5/charts_overlay.json'))
for (const [k, v] of Object.entries(charts)) {
  if (!hist[k] || hist[k].at(-1).status !== 'DATA_GAP') throw new Error(`도표 overlay 대상이 DATA_GAP 이 아니다: ${k}`)
  hist[k].push({ stage: 'charts:' + v.by, status: v.to, classes: v.classes })
}

// ── 이전 drain 검토 30: 그 검토가 본 판본의 cue 와 현재 cue 가 같은지
const cov = JSON.parse(read('prior_164_coverage.json'))
const cache = {}
const at = (rev, id) => {
  const exam = id.split('#')[0]
  const key = rev + exam
  if (!(key in cache)) {
    try { cache[key] = JSON.parse(execSync(`git -C "${root}" show ${rev}:apps/web/src/lib/csat/lecture-data/${exam}.json`, { maxBuffer: 1 << 28 })).lectures } catch { cache[key] = {} }
  }
  return cache[key][id]
}
const prior30 = []
for (const r of cov.rows.filter((x) => !(x.depth === 'machine_scan_only' || x.basis === 'old_differs_from_main'))) {
  if (hist[r.item_id]) throw new Error(`이전 검토 30 이 다른 범위와 겹친다: ${r.item_id}`)
  // D1a~e 는 작업 트리 8cd15b7b6 판, D1f 는 main e3e0a6a0e 판을 읽었다(00_ASSIGNMENT 정정 기록).
  const rev = r.by === 'D1f' ? 'e3e0a6a0e' : '8cd15b7b6'
  const then = at(rev, r.item_id)
  const same = then ? sha(then.cues) === sha(current[r.item_id].cues) : null
  const status = r.depth === 'deep' ? (same ? 'PRIOR_DEEP_SAME_VERSION' : 'PRIOR_DEEP_VERSION_CHANGED') : 'PRIOR_PARTIAL'
  hist[r.item_id] = [{ stage: `prior:${r.by}@${rev}`, status, cue_sha16_then: then ? sha(then.cues) : null, cue_sha16_now: sha(current[r.item_id].cues) }]
  prior30.push({ item_id: r.item_id, by: r.by, rev, depth: r.depth, same_cues: same })
}

const final = Object.fromEntries(Object.entries(hist).map(([k, h]) => [k, h.at(-1).status]))
const count = (ids) => ids.reduce((a, k) => ((a[final[k]] = (a[final[k]] ?? 0) + 1), a), {})
const ids = Object.keys(final)
const missing = Object.keys(current).filter((k) => !final[k])
const scope = (p) => ids.filter((k) => hist[k][0].stage.startsWith(p))
const report = {
  lectures_current: Object.keys(current).length,
  covered: ids.length,
  missing,
  C632: count(scope('C:')),
  F3_134: count(scope('F3:')),
  prior30: count(scope('prior:')),
  data_gap_ids: ids.filter((k) => final[k] === 'DATA_GAP').sort(),
  issue_ids_C632: scope('C:').filter((k) => final[k] === 'ISSUE_CONFIRMED').sort(),
  issue_ids_F3: scope('F3:').filter((k) => final[k] === 'ISSUE_CONFIRMED').sort(),
  prior30_detail: prior30,
}
if (process.argv.includes('--json')) console.log(JSON.stringify({ report, hist }, null, 1))
else console.log(JSON.stringify(report, null, 1))
