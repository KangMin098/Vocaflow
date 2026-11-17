// apps/web/src/lib/csat/map/v62/factory-bridge/__tests__/local-production.test.ts
// 1B 로컬 제작 core — 실제 prepareFactoryOrderDraft · sealProductOrder · evaluateSource · validateManifest 를 mock 하지 않는다.
// 대역은 1A fixture 의 DB reader 뿐(합성 수요 · 합성 정책 hash). 파일 쓰기는 CLI 경계라 여기서 하지 않는다.
import { describe, expect, it } from 'vitest'

import { prepareFactoryOrderDraft } from '@/lib/admin/factory-order-draft'
import { canonicalBody, draftInput, fixtureState, LINE, NOW, sha, stubReader } from '@/lib/admin/__tests__/factory-order-draft.fixture'

import { validateManifest } from '../../factory-integration'
import {
  LocalProductionError,
  buildManifestRecord,
  buildMaterials,
  buildPacket,
  checkPacketIntegrity,
  factoryRequestFor,
  checkPrepared,
  renderSheet,
  validateOutput,
  type ProductionOutput,
  type ProductionPacket,
} from '../local-production'

const CONTENT = 'Show one painting to two groups, give each group a different title for it, and they will describe two different scenes. One group notices the sky; the other notices the small figure in the corner. This happens because a title tells the eye where to begin. A viewer facing a new image has no order to follow, so the first words attached to it become a kind of route through the frame. Once that route is set, the details along it feel important and the rest fades into background.\n\nThe same is true of a song or a story, since a name at the top decides what counts as the subject. For this reason a title is not a label stuck on after the work is done. It belongs to the work, and choosing it is a real decision. Some artists refuse to name a piece at all, and that refusal is a choice too, because it hands the route back to the viewer.'

const row = (o: Record<string, unknown> = {}) => ({
  id: '003946dd-f5e6-4efe-9254-b7a69ca39e61', title: 'What a Name Does to a Picture', status: 'ready', article_v_level: 2, word_count: 164,
  register: 'news', cefr_level: 'B1', syntax_score: { score: 70, sent_p90: 25, clause_depth_p90: 3.2 }, display_only: false,
  license_class: 'cc0', copyright_safe_in_kr: true,
  gate: { v: 2, at: '2026-09-06T10:43:04.704Z', by: 'book-llm+rule', cv: 1, rv: 3, why: 'x', codes: [], genre: 'art', purpose: 'library', verdict: 'use', blockedBy: null, publishable: true },
  windows: null, source: 'original', source_url: '', license: 'CC0-1.0 (Vocaflow Original)', content: CONTENT, has_items: true, ...o,
})
const snapshot = (o: Record<string, unknown> = {}) => ({ snapshot_kind: 'read_only_database_export', current_time: '2026-10-21 05:50:28 UTC', row: row(o) })
const request = (o: Record<string, unknown> = {}) => ({ schema: 'vf.local-production-request/1', role: 'guided_practice', task: 'r.central_meaning', quantity: 3, item_types: ['topic', 'title', 'main_point'], ...o })

async function prepared(n = 3) {
  const lines = JSON.parse(canonicalBody()).lines as Array<Record<string, unknown>>
  lines[2] = { ...lines[2], n }
  const canonical = canonicalBody({ lines })
  const state = fixtureState()
  state.line = { ...state.line!, quantity: n }
  state.demand = { ...state.demand!, canonical, signature: sha(canonical) }
  const result = await prepareFactoryOrderDraft(stubReader(state).reader, { demand_line_id: LINE, expected_signature: state.demand.signature, draft: draftInput() as never }, NOW)
  if (!result.ok) throw new Error(result.code)
  return result
}

const items = () => [
  {
    id: 'cm-main-point-01', type: 'main_point', stem: '다음 글의 요지로 가장 적절한 것은?',
    choices: [{ key: '1', text: '그림은 세부보다 전체 구도를 먼저 보아야 한다.' }, { key: '2', text: '제목은 감상자가 주목할 곳을 정하므로 작품의 일부이다.' }, { key: '3', text: '집단마다 취향이 달라 같은 그림을 다르게 묘사한다.' }, { key: '4', text: '예술가는 작품에 제목을 붙이지 말아야 한다.' }, { key: '5', text: '노래의 제목은 그림의 제목보다 영향이 크다.' }],
    answer: '2', evidence_quotes: ['a title tells the eye where to begin', 'It belongs to the work, and choosing it is a real decision.'],
    explanation: { observation: '글은 제목이 시선의 출발점을 정한다고 말하고, 제목이 작품에 속한다고 결론짓는다.', interpretation: '따라서 제목이 주목할 곳을 정하므로 작품의 일부라는 2번이 요지다. 4번은 제목 거부도 선택이라는 말을 권고로 바꾼 것이다.' },
  },
  {
    id: 'cm-title-01', type: 'title', stem: '윗글의 제목으로 가장 적절한 것은?',
    choices: [{ key: '1', text: 'Why Painters Prefer Untitled Works' }, { key: '2', text: 'How Groups Disagree About Art' }, { key: '3', text: 'Labels Added After the Work Is Done' }, { key: '4', text: "A Title Draws the Route for the Viewer's Eye" }, { key: '5', text: 'The Sky and the Corner: Two Ways to Paint' }],
    answer: '4', evidence_quotes: ['the first words attached to it become a kind of route through the frame'],
    explanation: { observation: '첫 단어가 화면을 지나는 길이 된다는 비유가 글 전체를 이끈다.', interpretation: '제목이 시선의 길을 그린다는 4번이 그 비유를 담는다. 3번은 글이 부정한 견해다.' },
  },
  {
    id: 'cm-topic-01', type: 'topic', stem: '윗글의 주제로 가장 적절한 것은?',
    choices: [{ key: '1', text: 'the influence of a title on what viewers notice' }, { key: '2', text: 'the history of naming paintings in museums' }, { key: '3', text: 'the difficulty of describing a painting in words' }, { key: '4', text: 'reasons artists disagree about their own work' }, { key: '5', text: 'differences between group and individual viewing' }],
    answer: '1', evidence_quotes: ['One group notices the sky; the other notices the small figure in the corner.'],
    explanation: { observation: '같은 그림에 다른 제목을 주자 두 집단이 다른 곳을 보았다는 사례가 제시된다.', interpretation: '사례는 제목이 무엇을 보게 하는지에 대한 것이므로 1번이 주제다. 5번은 사례의 장치를 주제로 착각한 것이다.' },
  },
]
const output = (p: ProductionPacket, o: Record<string, unknown> = {}): ProductionOutput => ({
  schema: 'vf.local-production-output/1', task_id: p.task_id, packet_hash: p.packet_hash, request_id: p.body.request_id,
  order_hash: p.body.order.order_hash, order_revision: p.body.order.order_revision, source_digest: p.body.source.source_digest,
  role: 'guided_practice', task: 'r.central_meaning', quantity: 3, author: { agent: 'test', model: 'test', method: 'fixture' },
  items: items(), ...o,
} as ProductionOutput)
const META = { runId: 'run-1', now: '2026-10-21T06:00:00.000Z' }
const packetOf = async (s = snapshot(), r: unknown = request()) => buildPacket({ prepared: { synthetic_demand: true, prepared: await prepared() }, snapshot: s, request: r }, META)
const code = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    return e instanceof LocalProductionError ? e.code : `other:${String(e)}`
  }
  return 'no_error'
}

describe('B1 · 정상 경로(양성 대조)', () => {
  it('1A 실제 서비스 → 패킷 → 출력 검증 → HTML · 자료 · manifest(REAL · review_pending · test_fixture)', async () => {
    const p = await packetOf()
    expect(p.task_id).toMatch(/^LP-[0-9a-f]{24}$/)
    expect(p.body.source.eligibility.status).toBe('eligible')
    expect(p.body.limits).toEqual(expect.arrayContaining(['synthetic_demand_smoke', 'synthetic_policy_hash_not_policy_approval', 'no_import_time_live_requery']))
    const o = output(p)
    expect(validateOutput(p, o)).toEqual([])
    const enc = new TextEncoder()
    const html = enc.encode(renderSheet(p, o))
    const mat = enc.encode(JSON.stringify(buildMaterials(p, o)))
    const rec = buildManifestRecord(p, o, [{ name: 'sheet.html', bytes: html }, { name: 'materials.json', bytes: mat }], { runId: 'run-1', startedAt: META.now, command: ['x'], node: 'v20' })
    expect(rec.manifest.mode).toBe('REAL')
    expect(rec.manifest.status).toBe('review_pending')
    expect(rec.manifest.producedCount).toBe(3)
    expect(rec.manifest.artifacts.every((a) => a.lifecycle === 'test_fixture' && a.kind === 'textbook_activity' && a.rights === 'unknown' && a.quality === 'unreviewed')).toBe(true)
    expect(validateManifest(rec.manifest, factoryRequestFor(checkPrepared((await prepared())))) ).toEqual([])
    expect(rec.claims).toMatchObject({ registrable: false, production_ready: false, released: false, delivered: false, public_fit: 'not_claimed' })
  })
  it('실행 영수증이 없으면 REAL 을 만들지 않는다(MOCK)', async () => {
    const p = await packetOf()
    const rec = buildManifestRecord(p, output(p), [], null)
    expect(rec.manifest.mode).toBe('MOCK')
    expect(rec.manifest.artifacts.every((a) => a.provenance.mock)).toBe(true)
  })
})

describe('B2 · 변조 거절', () => {
  it('order hash · planning hash · 상태 flag · 역할/TASK/수량 변조된 prepared', async () => {
    const base = await prepared()
    type Loose = { factory: { order_hash: string; planning_hash: string; order: { order_revision: number } }; demand: { role: string; task: string }; registrable: boolean }
    const mut = (f: (x: Loose) => void) => { const c = structuredClone(base) as unknown as Loose; f(c); return c }
    const run = (c: unknown, r: unknown = request()) => code(() => buildPacket({ prepared: { synthetic_demand: true, prepared: c }, snapshot: snapshot(), request: r }, META))
    expect(run(mut((c) => { c.factory.order_hash = '0'.repeat(64) }))).toBe('order_hash_mismatch')
    expect(run(mut((c) => { c.factory.order.order_revision = 2 }))).toBe('order_hash_mismatch')
    expect(run(mut((c) => { c.factory.planning_hash = 'a'.repeat(64) }))).toBe('planning_hash_mismatch')
    expect(run(mut((c) => { c.registrable = true }))).toBe('prepared_state')
    expect(run(mut((c) => { c.demand.role = 'independent_check' }))).toBe('prepared_scope')
    expect(run(mut((c) => { c.demand.task = 'r.inference' }))).toBe('prepared_scope')
    expect(run(base, request({ quantity: 2 }))).toBe('request_mismatch')
    expect(run(base, request({ role: 'transfer' }))).toBe('request_mismatch')
    expect(run(base, request({ item_types: ['blank'] }))).toBe('request_mismatch')
    expect(run(base, { ...request(), approved: true })).toBe('request_shape')
  })
  it('출력의 hash · revision · role · TASK · 수량 · id · 선지 · 근거 변조', async () => {
    const p = await packetOf()
    const bad = (o: Record<string, unknown>) => validateOutput(p, output(p, o))
    expect(bad({ order_hash: '0'.repeat(64) })).toContain('order_hash_mismatch')
    expect(bad({ order_revision: 2 })).toContain('order_revision_mismatch')
    expect(bad({ source_digest: '0'.repeat(64) })).toContain('source_digest_mismatch')
    expect(bad({ request_id: 'x' })).toContain('request_id_mismatch')
    expect(bad({ packet_hash: '0'.repeat(64) })).toContain('packet_hash_mismatch')
    expect(bad({ task_id: 'LP-0' })).toContain('task_id_mismatch')
    expect(bad({ role: 'independent_check' })).toContain('role_mismatch')
    expect(bad({ task: 'r.inference' })).toContain('task_mismatch')
    expect(bad({ quantity: 2 })).toContain('quantity_mismatch')
    expect(bad({ items: items().slice(0, 2) })).toContain('item_count_mismatch')
    const dup = items(); dup[1]!.id = dup[0]!.id
    expect(bad({ items: dup })).toContain('item[1]:duplicate_id')
    const noAns = items(); noAns[0]!.answer = '6'
    expect(bad({ items: noAns })).toContain('item[0]:answer_not_in_choices')
    const fake = items(); fake[2]!.evidence_quotes = ['the painter always names the sky first']
    expect(bad({ items: fake })).toContain('item[2]:evidence[0]:not_in_source')
    const ph = items(); ph[0]!.explanation.interpretation = 'TODO 해설을 나중에 채운다 — 아직 작성하지 않음'
    expect(bad({ items: ph })).toContain('item[0]:placeholder')
    const ty = items(); ty[0]!.type = 'blank'
    expect(bad({ items: ty })).toContain('item[0]:type_not_allowed')
    expect(validateOutput(p, output(p))).toEqual([])
  })
  it('패킷 본문 변조 · 입력이 바뀐 뒤의 옛 패킷', async () => {
    const p = await packetOf()
    const t = structuredClone(p); t.body.request.quantity = 2
    expect(code(() => checkPacketIntegrity(t))).toBe('packet_hash_mismatch')
    expect(checkPacketIntegrity(structuredClone(p)).task_id).toBe(p.task_id)
  })
})

describe('B3 · 원천 적격성은 evaluateSource 그대로', () => {
  it.each([
    ['archived', { status: 'archived' }, 'source_rejected'],
    ['권리 제한(display_only)', { display_only: true }, 'source_rejected'],
    ['분석 미비', { cefr_level: null }, 'source_review'],
    ['내용 미판정', { gate: { publishable: true, verdict: null, purpose: 'library' } }, 'source_review'],
    ['내용 거절', { gate: { publishable: false, verdict: 'reject', purpose: 'library' } }, 'source_rejected'],
    ['난도 부적합(CEFR 상한 초과)', { cefr_level: 'C2' }, 'source_rejected'],
  ])('%s', async (_name, o, expected) => {
    // prepared · request 는 정상 — 원천 하나만 바꿔 evaluateSource 의 status 가 그대로 거절 코드가 되는지 본다
    const p = await prepared()
    expect(code(() => buildPacket({ prepared: { synthetic_demand: true, prepared: p }, snapshot: snapshot(o), request: request() }, META))).toBe(expected)
  })
  it('literal \\n 은 원본 hash 를 유지하고 정규화 hash 를 따로 남긴다', async () => {
    const p = await packetOf(snapshot({ content: CONTENT.replace('\n\n', '\\n\\n') }))
    expect(p.body.source.normalization).toEqual(['literal_backslash_n_to_newline'])
    expect(p.body.source.content_sha256).not.toBe(p.body.source.display_sha256)
  })
})

describe('B4 · HTML 주입 · 산출 hash', () => {
  it('원문 · 선지의 태그는 escape 되고 답 · 해설은 HTML 에 없다', async () => {
    const evil = `${CONTENT} <script>alert(1)</script>`
    const p = await packetOf(snapshot({ content: evil, title: 'T <img src=x onerror=alert(1)>' }))
    const it0 = items(); it0[0]!.choices[0]!.text = '<img src=x onerror=alert(2)> 선지'
    const o = output(p, { items: it0 })
    expect(validateOutput(p, o)).toEqual([])
    const html = renderSheet(p, o)
    expect(html).not.toMatch(/<script|<img/i)
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('&lt;img src=x onerror=alert(2)&gt;')
    expect(html).not.toContain(it0[0]!.explanation.interpretation)
  })
  it('manifest 의 파일 hash 는 넘겨받은 bytes 의 hash', async () => {
    const p = await packetOf()
    const bytes = new TextEncoder().encode(renderSheet(p, output(p)))
    const rec = buildManifestRecord(p, output(p), [{ name: 'sheet.html', bytes }], { runId: 'r', startedAt: META.now, command: [], node: 'v' })
    const { createHash } = await import('node:crypto')
    expect(rec.files[0]!.sha256).toBe(createHash('sha256').update(bytes).digest('hex'))
    expect(rec.files[0]!.bytes).toBe(bytes.byteLength)
  })
})

describe('B5 · 같은 입력 = 같은 작업 id, 다른 입력 = 다른 판본', () => {
  it('실행 시각 · run id 는 task id 에 들어가지 않는다', async () => {
    const a = await packetOf()
    const b = buildPacket({ prepared: { synthetic_demand: true, prepared: await prepared() }, snapshot: snapshot(), request: request() }, { runId: 'run-2', now: '2027-01-01T00:00:00.000Z' })
    expect(b.task_id).toBe(a.task_id)
    expect(b.packet_hash).toBe(a.packet_hash)
  })
  it('원천 본문이 바뀌면 다른 task id 이고 옛 출력은 거절된다', async () => {
    const a = await packetOf()
    const b = await packetOf(snapshot({ content: `${CONTENT} Extra.` }))
    expect(b.task_id).not.toBe(a.task_id)
    expect(validateOutput(b, output(a))).toEqual(expect.arrayContaining(['task_id_mismatch', 'packet_hash_mismatch', 'source_digest_mismatch']))
  })
  it('synthetic_demand 표시가 바뀌면 다른 판본', async () => {
    const a = await packetOf()
    const b = buildPacket({ prepared: { synthetic_demand: false, prepared: await prepared() }, snapshot: snapshot(), request: request() }, META)
    expect(b.task_id).not.toBe(a.task_id)
  })
})
