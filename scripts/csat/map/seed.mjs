// scripts/csat/map/seed.mjs
//
// 학습 지도 시드 — source/learning-map.json + source/sources.json → csat_map_seed(jsonb) RPC 한 번(원자적 · 재실행 안전).
//
//   node scripts/csat/map/seed.mjs             # 기본 = dry-run: 페이로드 개수 · 보류 현황만 출력(DB 접속 없음)
//   node --tls-max-v1.2 scripts/csat/map/seed.mjs --commit   # 적용(마이그레이션 20261002120000 이 먼저 적용돼 있어야 한다)
//
// 입력에 없는 것은 넣지 않는다: 연결선별 출처(edge_sources) · 듣기·유형 번호표(B 라인) · 오답률은 승인 뒤 별도 파일로.
// 출처 0건 연결선은 DB 트리거가 pending 으로 저장한다 — 이 스크립트는 그 수를 미리 보여 준다.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'source')
const read = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))

const SETTINGS = { default_goal: 100, reference_exams: 6, status: { near: 0.9 }, min_coverage: 0.5, goal_presets: [100, 90, 80, 70, 60] }

// 습관 신호 → D 라인(엔진 habit_flags.code 대응). D3 · D4 · D6 은 신호가 없어 과제 완료율만 쓴다.
const HABIT_LINE = { D1: 'word_reuse', D2: 'guessing', D5: 'time_collapse', D7: 'cutline_90', D8: 'ebs', D9: 'listening' }
// 진단 DB 에 역량 태그가 있는 코드(A7 은 엔진 설정 listening.attribute 로 처리해 태그 행이 없다)
const ATTRIBUTE_LINES = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A8', 'A9']
// 함정 계열이 DB 에 있는 코드(C8 은 연결 함정이 0 — 일부러 비운다. C9 는 지도에 연결하지 않는다 — 2026-10-02 결정)
const TRAP_LINES = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7']

export function buildPayload(map = read('learning-map.json'), src = read('sources.json')) {
  const nodes = [
    { code: 'GOAL', kind: 'goal', name: '최종 목표', summary: '목표 점수에서 잃어도 되는 점수만큼 놓치는 문항을 정하고, 나머지를 반드시 맞혀야 하는 문항으로 둔다.', sort: 0 },
    ...map.axes.map((a, i) => ({ code: a.id, kind: 'axis', name: a.name, summary: a.desc, sort: i + 1 })),
    ...map.lines.map((l, i) => ({ code: l.id, kind: 'line', name: l.name, axis: l.axis, track: l.track, why: l.why, signal: l.signal, sort: i + 1 })),
    ...map.principles.map((p, i) => ({ code: p.id, kind: 'principle', name: p.name, summary: `${p.desc}\n\n${p.ev}`, sort: i + 1 })),
    ...map.tracks.map((t, i) => ({ code: t.id, kind: 'track', name: t.name, summary: [t.sub, t.desc, `개선 기대: ${t.horizon}`, `판정: ${t.eval}`, `학습 재료: ${t.material}`].join('\n'), sort: i + 1 })),
  ]
  const edges = [
    ...map.axes.map((a) => ({ from: 'GOAL', to: a.id, kind: 'goal', basis: 'direct' })),
    ...map.lines.map((l) => ({ from: l.axis, to: l.id, kind: 'member', basis: 'direct' })),
    ...map.lines.flatMap((l) => l.principles.map((p) => ({ from: l.id, to: p.principle, kind: 'reason', basis: p.basisClaimed }))),
    ...map.routes.map((r) => ({ from: r.principle, to: r.track, kind: 'route', basis: r.basisClaimed })),
  ]
  const tasks = Object.entries(map.tasks).flatMap(([line, rows]) =>
    rows.map((t) => ({ id: `${line}-${t.ord}`, line, ord: t.ord, title: t.title, how: t.how, cadence: t.cadence, done_when: t.doneWhen, material: t.material, method_line: t.methodLine })),
  )
  const line_links = [
    ...ATTRIBUTE_LINES.map((c) => ({ line: c, kind: 'attribute', ref: c })),
    ...TRAP_LINES.map((c) => ({ line: c, kind: 'trap_family', ref: c })),
    ...Object.entries(HABIT_LINE).map(([line, ref]) => ({ line, kind: 'habit', ref })),
  ]
  return {
    sources: src.sources,
    nodes,
    edges,
    node_sources: src.nodeSources.map((n) => ({ node: n.node, source: n.source })),
    edge_sources: [],
    tasks,
    line_links,
    item_rates: [],
    settings: SETTINGS,
  }
}

/** 출처가 하나도 안 붙은 연결선 수(= DB 에 pending 으로 저장될 수) — 노드 출처는 연결선을 풀지 않는다 */
export function pendingSummary(p) {
  const byKind = {}
  for (const e of p.edges) {
    const k = (byKind[e.kind] ??= { total: 0, pending: 0 })
    k.total += 1
    const sourced = p.edge_sources.some((s) => s.from === e.from && s.to === e.to && s.kind === e.kind)
    if (!sourced) k.pending += 1
  }
  const sourcedNodes = new Set(p.node_sources.map((n) => n.node))
  const principles = p.nodes.filter((n) => n.kind === 'principle')
  return { byKind, principlesPending: principles.filter((n) => !sourcedNodes.has(n.code)).map((n) => n.code) }
}

async function main() {
  const p = buildPayload()
  const s = pendingSummary(p)
  console.log(`노드 ${p.nodes.length} · 연결선 ${p.edges.length} · 과제 ${p.tasks.length} · 출처 ${p.sources.length} · 라인 연결 ${p.line_links.length}`)
  for (const [k, v] of Object.entries(s.byKind)) console.log(`  연결선 ${k}: 보류 ${v.pending} / 전체 ${v.total}`)
  console.log(`  원리 근거 보류: ${s.principlesPending.join(' · ')} (${s.principlesPending.length}/8)`)
  if (!process.argv.includes('--commit')) {
    console.log('dry-run — DB 에 쓰지 않았다. 적용은 --commit.')
    return
  }
  const { createClient } = await import('@supabase/supabase-js')
  const env = (name) => {
    if (process.env[name]) return process.env[name]
    for (const f of ['.env.local', '.env', 'apps/web/.env.local', 'apps/web/.env']) {
      if (!fs.existsSync(f)) continue
      const m = fs.readFileSync(f, 'utf8').match(new RegExp(`^${name}\\s*=\\s*(.+)$`, 'm'))
      if (m) return m[1].trim().replace(/^["']|["']$/g, '')
    }
    return null
  }
  const url = env('NEXT_PUBLIC_SUPABASE_URL') ?? env('SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY') ?? env('SUPABASE_SERVICE_KEY')
  if (!url || !key) throw new Error('SUPABASE_URL / SERVICE_ROLE_KEY 가 필요하다')
  const db = createClient(url, key, { auth: { persistSession: false } })
  const { data, error } = await db.rpc('csat_map_seed', { p })
  if (error) throw new Error(`시드 실패(전체 롤백됨): ${error.message}`)
  console.log('적용 결과:', JSON.stringify(data))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}
