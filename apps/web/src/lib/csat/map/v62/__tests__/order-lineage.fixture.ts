// apps/web/src/lib/csat/map/v62/__tests__/order-lineage.fixture.ts
// Synthetic policy hashes are test data, never policy approval or a production-ready order.
import { sealProductOrder } from '@vocaflow/library-pipeline/factory-order'

export const lineageOrder = (id = 'TPO-test', revision = 1) => sealProductOrder({
  schema: 'textbook-product-order/1', product_order_id: id, order_revision: revision,
  series_id: 'test-series', edition_id: 'test-edition', product_family: 'P07', product_variant: 'test',
  target: { family: 'P07', age_band: 'middle_1', language_band: 'middle', reasoning_band: 'middle_1',
    passage_v_level: 3, skills: ['R4'], exam: 'none', words: { min: 180, max: 250 }, share_alike: false, resources: [] },
  grade_target: 'middle_1', reading_skill_targets: ['R4'], purposes: ['test'], exam_alignment: [],
  domain_mix: { science: 100 }, genre_mix: { explanation: 100 },
  source_policy_version: 'test', source_policy_hash: 'a'.repeat(64), rights_policy_version: 'test', rights_policy_hash: 'b'.repeat(64),
  adaptation_policy_version: 'test', adaptation_policy_hash: 'c'.repeat(64), benchmark_contract_version: 'test', benchmark_contract_hash: 'd'.repeat(64),
  evidence_policy_version: 'test', evidence_policy_hash: 'e'.repeat(64), trust_policy_version: 'test', trust_policy_hash: 'f'.repeat(64),
  item_types: ['main_point'], activity_types: [],
  passage_difficulty_profile: { lexical: 3, syntax: 3, information_density: 3, discourse: 3, inference: 3, abstraction: 3, background_knowledge: 3 },
  item_difficulty_profile: { reasoning: 3 }, unit_spec_version: 'test', chapter_spec_version: 'test', volume_spec_version: 'test', layout_profile: 'test',
  created_at: '2026-10-20T00:00:00Z', sealed_at: '2026-10-20T00:00:00Z',
})
