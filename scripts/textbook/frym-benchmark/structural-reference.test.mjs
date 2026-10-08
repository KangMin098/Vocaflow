// scripts/textbook/frym-benchmark/structural-reference.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { buildReferenceRoleScreen } from './reference-role-screen.mjs'
import { characterizeStructuralReferences, bindStructuralPlanningNote } from './structural-reference.mjs'
import { evaluateMultiGradeBenchmark } from './multi-grade-benchmark.mjs'

const sha = value => createHash('sha256').update(value).digest('hex')

test('non-grade profile binds role, excerpt, and a non-binding order note', () => {
  const dir = mkdtempSync(join(tmpdir(), 'structural-reference-'))
  try {
    const excerpt = '<h2>Example</h2><p>Ideas change because evidence changes.</p><p>However, one example remains.</p>'
    const source = `header<!--begin-->${excerpt}<!--end-->footer`
    const source_path = join(dir, 'source.html'), rights_evidence_path = join(dir, 'rights.html')
    writeFileSync(source_path, source)
    writeFileSync(rights_evidence_path, 'CC BY for this page')
    const role_input = { schema: 'reference-role-screen-input/1', candidates: [{ structural: {
      source_id: 'open:one', source_url: 'https://example.org/one',
      purpose: 'passage_structure', reviewer_id: 'reviewer',
      rights_scope: 'authorized_internal_analysis', source_path, source_hash: sha(source),
      rights_evidence_path, rights_evidence_hash: sha('CC BY for this page'),
    } }] }
    const role_screen = buildReferenceRoleScreen(role_input)
    const specifications = [{ source_id: 'open:one', start_marker: '<h2>Example',
      end_marker: '<!--end-->', excerpt_hash: sha(excerpt), format: 'article' }]
    const args = { role_input, role_screen, specifications }
    const corpus = characterizeStructuralReferences(args)
    assert.equal(corpus.profile_count, 1)
    assert.equal(corpus.profiles[0].word_count, 10)
    assert.equal(corpus.profiles[0].discourse_cues.because, 1)
    assert.equal(corpus.grade_distribution_n, 0)
    assert.equal(corpus.benchmark_target_fit, 'unopened')
    assert.throws(() => evaluateMultiGradeBenchmark({ contract: {
      reference_cohort: 'open_reference',
    }, references: corpus.profiles }), /OPEN_REFERENCE_ADMISSION_REQUIRED/)
    const note = bindStructuralPlanningNote({ corpus,
      order: { product_order_id: 'order-1', order_revision: 1, order_hash: sha('order') } })
    assert.equal(note.binding, 'advisory_only')
    assert.equal(note.target_fit_evidence, false)
    assert.equal(note.order_evidence_level, 'caller_supplied_unverified')
    assert.throws(() => bindStructuralPlanningNote({ corpus: { ...corpus, grade_distribution_n: 1 },
      order: { product_order_id: 'order-1', order_revision: 1, order_hash: sha('order') } }),
    /STRUCTURAL_PLANNING_INPUT_INVALID/)
    assert.throws(() => characterizeStructuralReferences({ ...args, specifications: [
      { ...specifications[0], excerpt_hash: sha('changed') },
    ] }), /STRUCTURAL_EXCERPT_CHANGED/)
    writeFileSync(source_path, `${source}changed`)
    assert.throws(() => characterizeStructuralReferences(args), /STRUCTURAL_SOURCE_CHANGED/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
