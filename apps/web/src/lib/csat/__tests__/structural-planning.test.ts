// apps/web/src/lib/csat/__tests__/structural-planning.test.ts
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { canonicalJson } from '@vocaflow/library-pipeline'
import { afterEach, expect, it } from 'vitest'

import { loadStructuralPlanningCatalog, planProductOrderStructure } from '../structural-planning'

const digest = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex')
const sha = (value: string) => createHash('sha256').update(value).digest('hex')
const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })

function fixture() {
  const dir = mkdtempSync(path.join(tmpdir(), 'structural-planning-api-'))
  dirs.push(dir)
  const sourcePath = path.join(dir, 'source.html'), rightsPath = path.join(dir, 'rights.html')
  const excerpt = '<p>Evidence changes because conditions change.</p>'
  const source = `intro<!--start-->${excerpt}<!--end-->footer`
  writeFileSync(sourcePath, source)
  writeFileSync(rightsPath, 'CC BY article evidence')
  const structural = { source_id: 'open:one', source_url: 'https://example.org/one',
    purpose: 'passage_structure', reviewer_id: 'reviewer', rights_scope: 'authorized_internal_analysis',
    source_path: sourcePath, source_hash: sha(source), rights_evidence_path: rightsPath,
    rights_evidence_hash: sha('CC BY article evidence') }
  const input = { schema: 'reference-role-screen-input/1', candidates: [{ structural }] }
  const decisionBody = { schema: 'reference-roles/1', source_id: structural.source_id,
    source_hash: structural.source_hash, rights_evidence_hash: structural.rights_evidence_hash,
    structural_evidence_hash: digest(structural), evidence_level: 'operator_reviewed_local',
    structural_reference: 'eligible', structural_reason: null,
    calibration_reference: 'hold', calibration_decision_hash: null,
    calibration_reason: 'ADMISSION_AND_CALIBRATION_REQUIRED', grade_distribution_eligible: false,
    grade_distribution_reason: 'COHORT_REPRESENTATIVENESS_NOT_EVALUATED' }
  const decision = { ...decisionBody, decision_hash: digest(decisionBody) }
  const screenBody = { schema: 'reference-role-screen/1', input_hash: digest(input),
    source_count: 1, structural_eligible_n: 1, calibration_eligible_n: 0, grade_distribution_n: 0,
    structural_corpus: [{ source_id: structural.source_id, source_hash: structural.source_hash,
      decision_hash: decision.decision_hash }], decisions: [decision] }
  const screen = { ...screenBody, screen_hash: digest(screenBody) }
  const spec = { source_id: structural.source_id, start_marker: '<p>Evidence',
    end_marker: '<!--end-->', excerpt_hash: sha(excerpt), format: 'article' }
  const profileBody = { schema: 'structural-characterization/1', source_id: structural.source_id,
    role_decision_hash: decision.decision_hash, source_hash: structural.source_hash,
    excerpt_hash: spec.excerpt_hash, format: 'article', text_block_count: 1, heading_count: 0,
    list_item_count: 0, word_count: 6, sentence_count: 1, median_sentence_words: 6,
    discourse_cues: { because: 1 }, measurement_scope: 'non_grade_structure_only' }
  const profile = { ...profileBody, profile_hash: digest(profileBody) }
  const corpusBody = { schema: 'structural-reference-corpus/1', role_screen_hash: screen.screen_hash,
    profile_count: 1, profiles: [profile], calibration_eligible_n: 0, grade_distribution_n: 0,
    benchmark_target_fit: 'unopened', benchmark_level_separation: 'unopened' }
  const corpus = { ...corpusBody, corpus_hash: digest(corpusBody) }
  const save = (name: string, value: unknown) => writeFileSync(path.join(dir, name), JSON.stringify(value))
  save('role-screen-r1.input.json', input)
  save('role-screen-r1.out.json', screen)
  save('structural-spec-r2.json', [spec])
  save('structural-corpus-r3.json', corpus)
  return { dir, sourcePath, rightsPath, corpus, screen }
}

const order = () => ({
  schema: 'textbook-product-order/1', product_order_id: 'f02-middle_1', order_revision: 1,
  series_id: 'bridge-reading', edition_id: 'first', product_family: 'P03', product_variant: 'knowledge',
  target: JSON.parse(readFileSync(path.resolve(process.cwd(), '../../scripts/textbook/targets/knowledge-middle1.json'), 'utf8')) as unknown,
  grade_target: 'middle_1', reading_skill_targets: ['R2', 'R3', 'R4'], purposes: ['knowledge'],
  exam_alignment: [], domain_mix: { science: 100 }, genre_mix: { explanation: 100 },
  source_policy_version: 'source-v1', source_policy_hash: '3'.repeat(64),
  rights_policy_version: 'rights-v1', rights_policy_hash: '4'.repeat(64),
  adaptation_policy_version: 'adapt-v1', adaptation_policy_hash: '5'.repeat(64),
  item_types: ['main_point'], activity_types: [],
  passage_difficulty_profile: { lexical: 3, syntax: 3, information_density: 3, discourse: 3,
    inference: 3, abstraction: 3, background_knowledge: 3 },
  item_difficulty_profile: { reasoning: 3 }, unit_spec_version: 'unit-v1',
  chapter_spec_version: 'chapter-v1', volume_spec_version: 'volume-v1', layout_profile: 'reading-v1',
  benchmark_contract_version: 'benchmark-v1', benchmark_contract_hash: '6'.repeat(64),
  evidence_policy_version: 'evidence-v1', evidence_policy_hash: '2'.repeat(64),
  trust_policy_version: 'trust-v1', trust_policy_hash: '1'.repeat(64),
  created_at: '2026-10-07T00:00:00Z', sealed_at: '2026-10-07T00:01:00Z',
})

it('serves current metadata and lets the operator adopt or ignore without changing the order', async () => {
  const f = fixture()
  const catalog = await loadStructuralPlanningCatalog(f.dir)
  expect(catalog.profiles.map(row => row.source_id)).toEqual(['open:one'])
  const before = order()
  const ignored = planProductOrderStructure(before, catalog, [])
  const adopted = planProductOrderStructure(before, catalog, ['open:one'])
  expect(ignored.selection).toBe('ignored')
  expect(adopted.selection).toBe('adopted')
  expect(adopted.target_fit_evidence).toBe(false)
  expect(adopted.level_separation_evidence).toBe(false)
  expect(before.grade_target).toBe('middle_1')
  expect(() => planProductOrderStructure(before, catalog, ['unknown'])).toThrow('STRUCTURAL_SELECTION_INVALID')
})

it('fails closed on rights and source changes or a mixed corpus', async () => {
  const f = fixture()
  writeFileSync(f.rightsPath, 'changed rights')
  await expect(loadStructuralPlanningCatalog(f.dir)).rejects.toThrow('STRUCTURAL_SOURCE_CHANGED')
  writeFileSync(f.rightsPath, 'CC BY article evidence')
  writeFileSync(f.sourcePath, 'changed source')
  await expect(loadStructuralPlanningCatalog(f.dir)).rejects.toThrow('STRUCTURAL_SOURCE_CHANGED')
  writeFileSync(f.sourcePath, 'intro<!--start--><p>Evidence changes because conditions change.</p><!--end-->footer')
  writeFileSync(path.join(f.dir, 'structural-corpus-r3.json'), JSON.stringify({ ...f.corpus, corpus_hash: '0'.repeat(64) }))
  await expect(loadStructuralPlanningCatalog(f.dir)).rejects.toThrow('STRUCTURAL_CHAIN_INVALID')
})

it('rejects a mixed structural selection even when its screen hash is recomputed', async () => {
  const f = fixture()
  const mixedBody = { ...f.screen, structural_corpus: [{
    source_id: 'other:source', source_hash: 'a'.repeat(64), decision_hash: 'b'.repeat(64),
  }] }
  const body: Record<string, unknown> = { ...mixedBody }
  delete body.screen_hash
  writeFileSync(path.join(f.dir, 'role-screen-r1.out.json'), JSON.stringify({
    ...body, screen_hash: digest(body),
  }))
  await expect(loadStructuralPlanningCatalog(f.dir)).rejects.toThrow('STRUCTURAL_CHAIN_INVALID')
})
