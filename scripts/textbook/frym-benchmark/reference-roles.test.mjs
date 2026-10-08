// scripts/textbook/frym-benchmark/reference-roles.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { assessReferenceRoles } from './reference-roles.mjs'

const sha = value => createHash('sha256').update(value).digest('hex')
const fixture = () => {
  const dir = mkdtempSync(join(tmpdir(), 'reference-roles-'))
  const source = join(dir, 'source.html'), rights = join(dir, 'rights.html')
  writeFileSync(source, 'source-v1')
  writeFileSync(rights, 'rights-v1')
  return { dir, source, rights, structural: {
    source_id: 'fym:example', source_url: 'https://example.org/article',
    purpose: 'passage_structure', reviewer_id: 'reviewer-a',
    rights_scope: 'authorized_internal_analysis', source_path: source,
    source_hash: sha('source-v1'), rights_evidence_path: rights,
    rights_evidence_hash: sha('rights-v1'),
  } }
}

test('structural role is independent of admission and never opens grade distribution', () => {
  const f = fixture()
  try {
    const result = assessReferenceRoles({ structural: f.structural })
    assert.equal(result.structural_reference, 'eligible')
    assert.equal(result.calibration_reference, 'hold')
    assert.equal(result.grade_distribution_eligible, false)
    assert.match(result.decision_hash, /^[a-f0-9]{64}$/)
  } finally { rmSync(f.dir, { recursive: true, force: true }) }
})

test('catalog-only and uncertain rights remain structural holds', () => {
  const f = fixture()
  try {
    for (const rights_scope of ['catalog_only', 'unknown', 'excluded']) {
      const result = assessReferenceRoles({ structural: { ...f.structural, rights_scope } })
      assert.equal(result.structural_reference, rights_scope === 'excluded' ? 'rejected' : 'hold')
      assert.equal(result.calibration_reference, 'hold')
    }
  } finally { rmSync(f.dir, { recursive: true, force: true }) }
})

test('changed source or held rights evidence invalidates the prior role', () => {
  const f = fixture()
  try {
    writeFileSync(f.source, 'source-v2')
    assert.throws(() => assessReferenceRoles({ structural: f.structural }), /STRUCTURAL_SOURCE_CHANGED/)
    writeFileSync(f.source, 'source-v1')
    writeFileSync(f.rights, 'rights-v2')
    assert.throws(() => assessReferenceRoles({ structural: {
      ...f.structural, rights_scope: 'unknown',
    } }), /STRUCTURAL_RIGHTS_EVIDENCE_CHANGED/)
  } finally { rmSync(f.dir, { recursive: true, force: true }) }
})

test('a caller cannot claim calibration without current verified admission', () => {
  const f = fixture()
  try {
    assert.throws(() => assessReferenceRoles({ structural: f.structural,
      admission: { receipt: {} }, calibration_evidence: {},
    }), /CALIBRATION_ADMISSION_REQUIRED/)
  } finally { rmSync(f.dir, { recursive: true, force: true }) }
})
