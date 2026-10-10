// scripts/textbook/frym-benchmark/reference-role-screen.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { buildReferenceRoleScreen } from './reference-role-screen.mjs'

const sha = value => createHash('sha256').update(value).digest('hex')
test('structural corpus excludes held sources and never opens calibration', () => {
  const dir = mkdtempSync(join(tmpdir(), 'reference-screen-'))
  try {
    const source_path = join(dir, 'source'), rights_evidence_path = join(dir, 'rights')
    writeFileSync(source_path, 'source-v1')
    writeFileSync(rights_evidence_path, 'rights-v1')
    const structural = { source_id: 'a', source_url: 'https://example.org/a',
      purpose: 'passage_structure', reviewer_id: 'reviewer',
      source_path, source_hash: sha('source-v1'), rights_evidence_path,
      rights_evidence_hash: sha('rights-v1'), rights_scope: 'authorized_internal_analysis' }
    const input = { schema: 'reference-role-screen-input/1', candidates: [
      { structural }, { structural: { ...structural, source_id: 'b', rights_scope: 'unknown' } },
    ] }
    const result = buildReferenceRoleScreen(input)
    assert.equal(result.structural_eligible_n, 1)
    assert.deepEqual(result.structural_corpus.map(row => row.source_id), ['a'])
    assert.equal(result.calibration_eligible_n, 0)
    assert.equal(result.grade_distribution_n, 0)
    assert.throws(() => buildReferenceRoleScreen({ ...input, candidates: [
      ...input.candidates, { structural },
    ] }), /REFERENCE_ROLE_DUPLICATE_SOURCE/)
    assert.throws(() => buildReferenceRoleScreen({ ...input, candidates: [
      { structural, admission: {} },
    ] }), /REFERENCE_ROLE_SCREEN_INPUT_INVALID/)
    writeFileSync(rights_evidence_path, 'rights-v2')
    assert.throws(() => buildReferenceRoleScreen(input), /STRUCTURAL_RIGHTS_EVIDENCE_CHANGED/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
