// apps/web/src/lib/csat/map/v62/factory-bridge/__tests__/dcp-fixture.ts
// 1C 시험 공용 — 1B 실제 경로(1A 서비스 · 패킷 · 출력 검증)로 만든 패킷 · 출력 · AI 검수 기록. 원문은 1B 실제 원천과 같은 CC0 본문.
import { createHash } from 'node:crypto'

import { prepareFactoryOrderDraft } from '@/lib/admin/factory-order-draft'
import { canonicalBody, draftInput, fixtureState, LINE, NOW, sha, stubReader } from '@/lib/admin/__tests__/factory-order-draft.fixture'

import { AI_REVIEW_SCHEMA } from '../dcp-admission'
import { buildPacket, itemDigest, type ProductionOutput, type ProductionPacket } from '../local-production'

export const SOURCE_ID = '003946dd-f5e6-4efe-9254-b7a69ca39e61'
export const CONTENT = 'Show one painting to two groups, give each group a different title for it, and they will describe two different scenes. One group notices the sky; the other notices the small figure in the corner. This happens because a title tells the eye where to begin. A viewer facing a new image has no order to follow, so the first words attached to it become a kind of route through the frame. Once that route is set, the details along it feel important and the rest fades into background.\n\nThe same is true of a song or a story, since a name at the top decides what counts as the subject. For this reason a title is not a label stuck on after the work is done. It belongs to the work, and choosing it is a real decision. Some artists refuse to name a piece at all, and that refusal is a choice too, because it hands the route back to the viewer.'

export const row = (o: Record<string, unknown> = {}) => ({
  id: SOURCE_ID, title: 'What a Name Does to a Picture', status: 'ready', article_v_level: 2, word_count: 164,
  register: 'news', cefr_level: 'B1', syntax_score: { score: 70, sent_p90: 25, clause_depth_p90: 3.2 }, display_only: false,
  license_class: 'cc0', copyright_safe_in_kr: true,
  gate: { v: 2, at: '2026-09-06T10:43:04.704Z', by: 'book-llm+rule', cv: 1, rv: 3, why: 'x', codes: [], genre: 'art', purpose: 'library', verdict: 'use', blockedBy: null, publishable: true },
  windows: null, source: 'original', source_url: '', license: 'CC0-1.0 (Vocaflow Original)', content: CONTENT, has_items: true, ...o,
})
export const snapshot = (o: Record<string, unknown> = {}) => ({ snapshot_kind: 'read_only_database_export' as const, current_time: '2026-10-21 05:50:28 UTC', row: row(o) })

export async function prepared() {
  const lines = JSON.parse(canonicalBody()).lines as Array<Record<string, unknown>>
  lines[2] = { ...lines[2], n: 3 }
  const canonical = canonicalBody({ lines })
  const state = fixtureState()
  state.line = { ...state.line!, quantity: 3 }
  state.demand = { ...state.demand!, canonical, signature: sha(canonical) }
  const result = await prepareFactoryOrderDraft(stubReader(state).reader, { demand_line_id: LINE, expected_signature: state.demand.signature, draft: draftInput() as never }, NOW)
  if (!result.ok) throw new Error(result.code)
  return result
}

const items = () => [
  {
    id: 'cm-main-point-01', type: 'main_point', stem: '다음 글의 요지로 가장 적절한 것은?',
    choices: [{ key: '1', text: '그림은 세부보다 전체 구도를 먼저 보아야 한다.' }, { key: '2', text: '제목은 감상자가 주목할 곳을 정하므로 작품의 일부이다.' }, { key: '3', text: '집단마다 취향이 달라 같은 그림을 다르게 묘사한다.' }, { key: '4', text: '예술가는 작품에 제목을 붙이지 말아야 한다.' }, { key: '5', text: '노래의 제목은 그림의 제목보다 영향이 크다.' }],
    answer: '2', evidence_quotes: ['a title tells the eye where to begin'],
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
    explanation: { observation: '같은 그림에 다른 제목을 주자 두 집단이 다른 곳을 보았다는 가정 사례가 제시된다.', interpretation: '사례는 제목이 무엇을 보게 하는지에 대한 것이므로 1번이 주제다. 5번은 사례의 장치를 주제로 착각한 것이다.' },
  },
]

export const request = () => ({ schema: 'vf.local-production-request/1', role: 'guided_practice', task: 'r.central_meaning', quantity: 3, item_types: ['topic', 'title', 'main_point'] })

/** synthetic=false 는 격리 하네스에서 「실제 등록 주문」 자리를 대신하는 시험 전용 표시다 — 정책 hash 는 여전히 합성이다 */
export const packetOf = async (synthetic = true, s: unknown = snapshot()) =>
  buildPacket({ prepared: { synthetic_demand: synthetic, prepared: await prepared() }, snapshot: s, request: request() }, { runId: 'run-1', now: '2026-10-21T06:00:00.000Z' })

export const outputOf = (p: ProductionPacket): ProductionOutput => ({
  schema: 'vf.local-production-output/1', task_id: p.task_id, packet_hash: p.packet_hash, request_id: p.body.request_id,
  order_hash: p.body.order.order_hash, order_revision: p.body.order.order_revision, source_digest: p.body.source.source_digest,
  role: 'guided_practice', task: 'r.central_meaning', quantity: 3, author: { agent: 'test', model: 'test', method: 'fixture' }, items: items(),
} as ProductionOutput)

export const fileSha = (o: unknown) => createHash('sha256').update(`${JSON.stringify(o, null, 2)}\n`).digest('hex')

const EV = (k: string) => [`${k}: 근거 구절과 선지 대조 기록 review#1`]
export function reviewOf(p: ProductionPacket, out: ProductionOutput, o: { axes?: Record<string, unknown>; target?: Record<string, unknown>; conclusion?: string } = {}) {
  return {
    schema: AI_REVIEW_SCHEMA,
    kind: 'ai',
    reviewer: { model: 'codex', session: 'codex-item-review-20261021', role: 'independent item, key and evidence reviewer' },
    target: {
      source_digest: p.body.source.source_digest, output_sha256: fileSha(out), order_hash: p.body.order.order_hash, packet_hash: p.packet_hash,
      role: 'guided_practice', task: 'r.central_meaning', items: out.items.map((it) => ({ item_id: it.id, item_sha256: itemDigest(it) })), ...o.target,
    },
    conclusion: o.conclusion ?? 'pass',
    axes: o.axes ?? { B: { state: 'pass', evidence: EV('B') }, C: { state: 'pass', evidence: EV('C') }, D: { state: 'pass', evidence: EV('D') }, H: { state: 'pass', evidence: EV('H') }, E: { state: 'unknown', evidence: [] } },
    evidence: ['keys_checked unique_best_answer x3'],
    limitations: ['ai_review_not_human', 'shared_passage_three_guided_opportunities'],
  }
}
