#!/usr/bin/env node
// scripts/csat/map/v4/gen-definition.mjs
// docs/csat-learner/v4/{codebook,relations,workspaces}.json → apps/web/src/lib/csat/map/v4/definition.data.ts(정적 import 용 생성물)
//   node scripts/csat/map/v4/gen-definition.mjs [--check]
// --check: 파일을 고치지 않고, 다시 생성한 결과와 다르면 exit 1. 재실행 안전(통째로 다시 쓴다).
// 앱은 이 생성물만 import 한다 — 요청마다 파일 시스템을 읽지 않고, 앱 밖(docs/) 파일을 번들러가 따로 다루지 않게.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/csat-learner/v4', p), 'utf8'))
const cb = read('codebook.json')
const rel = read('relations.json')
const ws = read('workspaces.json')
const noMeta = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('$')))

const data = {
  version: cb.version,
  domains: cb.domains.map((d) => ({ axis: d.axis, name: d.name })),
  tasks: cb.tasks.map((t) => ({ id: t.id, display: t.display, axis: t.axis, kind: t.kind, status: t.status, name: t.name, goal: t.goal, conditions: t.conditions, evidence: t.evidence, criterion: t.criterion, quantity_policy: t.quantity_policy, direct_check: t.direct_check, methods: t.methods, assets: t.assets })),
  lines: Object.fromEntries(Object.entries(cb.lines).map(([k, l]) => [k, { crosswalk_status: l.crosswalk_status, decision: l.decision, layer: l.layer, v4: l.v4, performance_goal: l.performance_goal }])),
  activityClass: noMeta(cb.activity_class),
  activityTaskOverride: noMeta(cb.activity_task_override),
  inAppExecution: noMeta(cb.in_app_execution),
  relations: rel.relations.map((r) => ({ id: r.id, type: r.type, from: r.from, to: r.to, basis: r.basis, ref: r.ref, status: r.status })),
  templates: ws.templates.map((t) => ({ id: t.id, name: t.name, goal: t.goal, core: t.core, support: t.support, relations: t.relations, method: t.method, protocol: t.protocol, content_keys: t.content_keys, criterion: t.criterion, readiness: t.readiness, hold: t.hold === true })),
}

const text = `// apps/web/src/lib/csat/map/v4/definition.data.ts
// 생성물 — 손으로 고치지 않는다. 원천 docs/csat-learner/v4/*.json → node scripts/csat/map/v4/gen-definition.mjs
// 최신 여부: definition.test.ts 가 --check 와 같은 비교를 한다.

import type { V4Data } from './types'

export const V4_DATA: V4Data = ${JSON.stringify(data, null, 1)}
`
const out = path.join(ROOT, 'apps/web/src/lib/csat/map/v4/definition.data.ts')
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').replace(/\r\n/g, '\n') : ''
  if (cur !== text) { console.error('definition.data.ts 가 원천 JSON 과 다르다 — gen-definition.mjs 를 실행한다'); process.exit(1) }
  console.log('definition.data.ts = 원천')
} else {
  fs.writeFileSync(out, text)
  console.log(`→ ${path.relative(ROOT, out)} (${text.length} bytes)`)
}
