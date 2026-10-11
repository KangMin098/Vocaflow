// scripts/csat/map/v4/__tests__/codebook.test.mjs
// rev4.0 코드북 · 관계 · Workspace 구조화 파일의 누락 · 중복 · 참조 무결성 검사.
//   node --test scripts/csat/map/v4/__tests__/codebook.test.mjs
// 기준 = docs/csat-learner/v4/asis-snapshot.json(개발 DB 읽기 전용 스냅샷 — export-asis.mjs 로 갱신)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/csat-learner/v4', p), 'utf8'))
const snap = read('asis-snapshot.json')
const cb = read('codebook.json')
const rel = read('relations.json')
const ws = read('workspaces.json')

const lineCodes = snap.nodes.filter((n) => n.kind === 'line').map((n) => n.code)
const taskIds = snap.tasks.map((t) => t.id)
const v4 = new Map(cb.tasks.map((t) => [t.id, t]))

const sameSet = (a, b, label) => {
  const A = new Set(a), B = new Set(b)
  assert.deepEqual([...A].filter((x) => !B.has(x)), [], `${label}: 코드북에 없는 DB 항목`)
  assert.deepEqual([...B].filter((x) => !A.has(x)), [], `${label}: DB 에 없는 코드북 항목`)
}

test('스냅샷 규모가 감사 문서의 실측과 같다', () => {
  assert.equal(snap.nodes.length, 72)
  assert.equal(lineCodes.length, 54)
  assert.equal(taskIds.length, 183)
  assert.equal(snap.edges.length, 160)
  assert.equal(snap.line_links.length, 148)
  assert.equal(snap.edges.filter((e) => e.basis !== 'pending').length, 0, '확정된 기존 연결선이 생겼다 — 감사 문서를 다시 본다')
})

test('라인 54 전수 — 누락 · 남는 것 없음, 판단 어휘 · 대응 TASK 유효', () => {
  sameSet(lineCodes, Object.keys(cb.lines), 'lines')
  for (const [code, l] of Object.entries(cb.lines)) {
    assert.ok(cb.status_vocab.line_decision.includes(l.decision), `${code} decision`)
    assert.ok(cb.status_vocab.crosswalk_status.includes(l.crosswalk_status), `${code} crosswalk_status`)
    // 정본 crosswalk 와 다른 판단이면 근거(정본 절 · crosswalk 인용)를 적어야 한다
    const expected = { retain_core: ['유지'], retain_as_facet: ['분할'], move_layer: ['재분류', '통합', '분할'], legacy_alias: ['보류'], retire_from_vnext: ['보류'] }[l.crosswalk_status]
    if (!expected.includes(l.decision)) assert.match(l.why, /§|crosswalk/, `${code}: crosswalk ${l.crosswalk_status} 와 다른 판단(${l.decision})인데 근거가 없다`)
    for (const id of l.v4) assert.ok(v4.has(id), `${code} → 없는 TASK ${id}`)
    if (l.performance_goal) assert.ok(l.v4.length > 0, `${code}: 수행 목표인데 대응 TASK 가 없다`)
    for (const k of ['role', 'observable', 'method', 'assessment', 'why', 'verify', 'layer']) assert.ok(l[k], `${code}.${k} 비었다`)
    if (l.layer !== 'domain' && l.layer !== 'facet' && !l.layer.startsWith('lens.')) assert.ok(l.layer in cb.non_task_layers, `${code} layer ${l.layer}`)
  }
})

test('활동 183 전수 — 분류 6종 중 하나, 대응 TASK 참조 유효', () => {
  sameSet(taskIds, Object.keys(cb.activity_class), 'activities')
  const classes = Object.keys(cb.status_vocab.activity_class)
  for (const [id, c] of Object.entries(cb.activity_class)) assert.ok(classes.includes(c), `${id} class ${c}`)
  for (const [id, ts] of Object.entries(cb.activity_task_override)) {
    if (id.startsWith('$')) continue
    assert.ok(taskIds.includes(id), `override ${id} 는 DB 과제가 아니다`)
    for (const t of ts) assert.ok(v4.has(t), `override ${id} → 없는 TASK ${t}`)
  }
  for (const [id, s] of Object.entries(cb.in_app_execution)) {
    if (id.startsWith('$')) continue
    assert.ok(taskIds.includes(id), `실행 표 ${id}`)
    assert.ok(['live', 'draft'].includes(s))
  }
})

test('rev4 TASK — id 유일, 모든 TASK 가 기존 자산(라인 · 과제)에서 한 번 이상 닿는다', () => {
  assert.equal(v4.size, cb.tasks.length, 'TASK id 중복')
  const axes = new Set(cb.domains.map((d) => d.axis))
  const reached = new Set([
    ...Object.values(cb.lines).flatMap((l) => l.v4),
    ...Object.entries(cb.activity_task_override).filter(([k]) => !k.startsWith('$')).flatMap(([, v]) => v),
  ])
  for (const t of cb.tasks) {
    assert.ok(axes.has(t.axis), `${t.id} axis`)
    assert.ok(t.status in cb.status_vocab.task_status, `${t.id} status`)
    assert.ok(t.direct_check in cb.status_vocab.direct_check, `${t.id} direct_check`)
    assert.ok(reached.has(t.id), `${t.id}: 어느 기존 라인 · 과제에서도 닿지 않는다(근거 없는 신규 TASK)`)
    if (t.status === 'hold') assert.equal(t.direct_check, 'blocked', `${t.id}: 보류 TASK 가 확인 가능으로 표시됐다`)
    for (const m of t.methods) assert.ok(lineCodes.includes(m) || taskIds.includes(m), `${t.id} method ${m}`)
  }
})

test('관계 — 타입 · 끝점 · 상태 유효, 승인은 정본 근거가 있는 PART_OF 만(일괄 확정 금지)', () => {
  const ids = rel.relations.map((r) => r.id)
  assert.equal(new Set(ids).size, ids.length, '관계 id 중복')
  const seen = new Set()
  for (const r of rel.relations) {
    assert.ok(r.type in rel.types, `${r.id} type`)
    assert.ok(v4.has(r.from) && v4.has(r.to), `${r.id} 끝점`)
    assert.notEqual(r.from, r.to, `${r.id} 자기 고리`)
    assert.ok(rel.basis_vocab.includes(r.basis), `${r.id} basis`)
    assert.ok(['proposed', 'approved'].includes(r.status), `${r.id}: 허용되지 않은 상태 ${r.status}`)
    if (r.status === 'approved') {
      assert.equal(r.type, 'PART_OF', `${r.id}: PART_OF 밖의 관계가 승인됐다`)
      assert.equal(r.basis, 'canon_rev2.1', `${r.id}: 정본 근거 없는 승인`)
      assert.match(r.approval?.ref ?? '', /VNEXT §3/, `${r.id}: 승인 근거 인용이 없다`)
      assert.notEqual(r.to.charAt(0), 'x', `${r.id}: X 는 정본이 구성 원자를 명시하지 않는다`)
    }
    const key = `${r.type}|${r.from}|${r.to}`
    assert.ok(!seen.has(key), `${r.id} 중복 관계`)
    seen.add(key)
    if (r.type === 'PART_OF') assert.equal(v4.get(r.to).kind, 'integrated', `${r.id}: PART_OF 의 끝은 통합 관찰`)
  }
  // PREREQUISITE 만 따로 순환 검사(우선순위 낮춤에 쓰이므로 순환이면 의미가 없다)
  const pre = rel.relations.filter((r) => r.type === 'PREREQUISITE')
  const adj = new Map()
  for (const r of pre) adj.set(r.from, [...(adj.get(r.from) ?? []), r.to])
  const state = new Map()
  const dfs = (n) => {
    state.set(n, 1)
    for (const m of adj.get(n) ?? []) {
      assert.notEqual(state.get(m), 1, `PREREQUISITE 순환: ${n} → ${m}`)
      if (!state.has(m)) dfs(m)
    }
    state.set(n, 2)
  }
  for (const n of adj.keys()) if (!state.has(n)) dfs(n)
})

test('기존 연결선 처리표가 종류별 실측 개수와 같다', () => {
  const byKind = {}
  for (const e of snap.edges) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1
  const legacy = Object.fromEntries(Object.entries(rel.legacy_edges).filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, v.count]))
  assert.deepEqual(legacy, byKind)
})

test('Workspace — 참조 유효, 준비 상태는 중심 TASK 의 직접 확인 상태에서 나온다', () => {
  const ids = ws.templates.map((t) => t.id)
  assert.equal(new Set(ids).size, ids.length)
  const relIds = new Set(rel.relations.map((r) => r.id))
  for (const t of ws.templates) {
    assert.ok(t.core.length > 0, `${t.id} 중심 TASK 없음`)
    for (const id of [...t.core, ...t.support]) assert.ok(v4.has(id), `${t.id} → ${id}`)
    for (const id of t.relations) assert.ok(relIds.has(id), `${t.id} → 관계 ${id}`)
    for (const m of t.method) assert.ok(lineCodes.includes(m) || taskIds.includes(m), `${t.id} method ${m}`)
    const rank = { blocked: 0, content_needed: 1, ready: 2, live: 3 }
    const derived = t.core.map((c) => v4.get(c).direct_check).sort((a, b) => rank[a] - rank[b])[0]
    assert.equal(t.readiness, derived, `${t.id}: 준비 상태를 과장했다`)
    // 보류 TASK 를 중심으로 둔 템플릿은 보류 템플릿으로만 존재한다(요구 · 편성 대상 아님)
    const holdCore = t.core.some((c) => v4.get(c).status === 'hold')
    assert.equal(t.hold, holdCore, `${t.id}: hold 표시와 중심 TASK 상태가 다르다`)
    if (t.hold) assert.equal(t.readiness, 'blocked')
  }
  // 모든 비보류 TASK 는 적어도 하나의 Workspace 에서 중심 또는 보조로 쓰이거나, 의도적으로 빠진 목록에 있다
  const used = new Set(ws.templates.flatMap((t) => [...t.core, ...t.support]))
  const unused = cb.tasks.filter((t) => t.status !== 'hold' && !used.has(t.id)).map((t) => t.id).sort()
  assert.deepEqual(unused, ['e.o.final_judgment', 'r.o.global_meaning_model', 's.attachment'],
    '새로 Workspace 밖에 남은 TASK 가 생겼다 — WORKSPACE_CONTRACT §2 목록을 고친다')
})

test('생성 문서(코드북 md)가 원천 JSON 과 같다', async () => {
  const { execFileSync } = await import('node:child_process')
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/csat/map/v4/render-codebook.mjs'), '--check'], { stdio: 'pipe' })
})
