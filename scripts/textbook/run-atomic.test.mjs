// scripts/textbook/run-atomic.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { planProductBrief } from '@vocaflow/library-pipeline/product-planning'

const root = fileURLToPath(new URL('../../', import.meta.url))
const tsx = createRequire(path.join(root, 'package.json')).resolve('tsx/cli')
const cli = (script, ...args) => spawnSync(process.execPath, [tsx, path.join(root, 'scripts/textbook', script), ...args],
  { cwd: root, encoding: 'utf8', windowsHide: true })
const h = c => c.repeat(64)
const policy = n => ({ version: `p${n}`, hash: h(n) })
const brief = { schema: 'textbook-product-brief/1', grade_scope: { mode: 'multi_grade', grades: ['elementary_6', 'high_2'] },
  purpose: 'knowledge_reading', product_family: 'P05', domain_weights: { science: 1 }, genre_weights: { explanation: 1 },
  duration_days: 3, units_per_chapter: 3, difficulty: { start: 2, end: 3 }, passage_words: { start: 60, end: 70 },
  source_strategy: 'balanced' }
const { plan_hash } = planProductBrief(brief)
const input = { schema: 'textbook-order-production-input/1', sealed_at: '2026-10-10T00:00:00Z',
  drafts: brief.grade_scope.grades.map(grade => ({ brief, plan_hash, grade, product_order_id: `order-${grade}`,
    order_revision: 1, series_id: 'series', edition_id: 'ed1', product_variant: 'student',
    language_band: grade.startsWith('high') ? 'high' : 'elementary', passage_v_level: grade.startsWith('high') ? 7 : 2,
    share_alike: false, unit_spec_version: 'u1', chapter_spec_version: 'c1', volume_spec_version: 'v1', layout_profile: 'reading-v1',
    policies: { source: policy('1'), rights: policy('2'), adaptation: policy('3'), benchmark: policy('4'), evidence: policy('5'), trust: policy('6') } })) }

// Deterministic stand-in for the writer drain; `explain` lets one day's explanation change between runs.
const fill = (drain, explain = () => 'The first sentence states it.') => ({ cells: drain.cells.map(cell => {
  const filler = Array.from({ length: cell.passage_words_target - 12 }, (_, i) => `${cell.grade}w${cell.day}x${i}`).join(' ')
  const passage = `Plants store energy in roots. ${filler} Rain refills the deep wells slowly.`
  const flip = cell.day % 2 === 0
  return { cell_id: cell.cell_id, cell_hash: cell.cell_hash, passage, source_text: `Original account: ${passage}`, items: [{
    item_id: `${cell.cell_id}:i1`, item_type: cell.item_type, question: `Day ${cell.day}: which statement is supported?`,
    choices: flip ? ['Wells never refill.', 'Plants store energy in roots.'] : ['Plants store energy in roots.', 'Wells never refill.'],
    answer: flip ? 2 : 1, explanation: explain(cell), evidence_primary: 'Plants store energy in roots.',
    evidence_secondary: 'Rain refills the deep wells slowly.', focus_text: 'energy' }] }
}) })

function completeRun(temp, name, explain) {
  const inputPath = path.join(temp, `${name}.input.json`), runDir = path.join(temp, name)
  fs.writeFileSync(inputPath, JSON.stringify(input))
  assert.equal(cli('order-production-run.mjs', 'export', '--input', inputPath, '--run-dir', runDir).status, 0)
  const drain = JSON.parse(fs.readFileSync(path.join(runDir, 'drain.json'), 'utf8'))
  fs.writeFileSync(path.join(runDir, 'drain.out.json'), JSON.stringify(fill(drain, explain)))
  const imported = cli('order-production-run.mjs', 'import', '--input', inputPath, '--run-dir', runDir)
  assert.equal(imported.status, 0, imported.stderr)
  const review = JSON.parse(fs.readFileSync(path.join(runDir, 'review.json'), 'utf8'))
  fs.writeFileSync(path.join(runDir, 'review.out.json'), JSON.stringify({ reviewer_id: 'test-family-reviewer',
    units: review.units.map(unit => ({ unit_id: unit.unit_id, unit_hash: unit.unit_hash, verdict: 'pass',
      criteria: Object.fromEntries(review.criteria.map(c => [c.id, true])), quote: unit.passage.slice(0, 20),
      rationale: 'Synthetic test review of the family criteria.' })) }))
  const reviewed = cli('order-production-run.mjs', 'review', '--input', inputPath, '--run-dir', runDir)
  assert.equal(reviewed.status, 0, reviewed.stderr)
  return { inputPath, runDir }
}

test('run-atomic CLI: completed run -> atomic volume, tamper -> broken, changed day -> journaled revision', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vocaflow-run-atomic-'))
  const status = runDir => JSON.parse(cli('run-atomic.mjs', 'status', '--run-dir', runDir).stdout)
  try {
    const a = completeRun(temp, 'a')
    const produced = cli('run-atomic.mjs', 'produce', '--input', a.inputPath, '--run-dir', a.runDir)
    assert.equal(produced.status, 0, produced.stderr)
    assert.deepEqual(JSON.parse(produced.stdout).days.map(day => day.grades), [['elementary_6', 'high_2'], ['elementary_6', 'high_2'], ['elementary_6', 'high_2']])
    assert.equal(status(a.runDir).state, 'volume_ready')
    assert.notEqual(cli('run-atomic.mjs', 'produce', '--input', a.inputPath, '--run-dir', a.runDir).status, 0)

    // Day 2 explanation changes in run b: only day 2 is rebuilt, and its journal must reach complete.
    const b = completeRun(temp, 'b', cell => cell.day === 2 ? 'The opening sentence says so directly.' : 'The first sentence states it.')
    const revised = cli('run-atomic.mjs', 'revise', '--prior-input', a.inputPath, '--prior-run-dir', a.runDir,
      '--input', b.inputPath, '--run-dir', b.runDir)
    assert.equal(revised.status, 0, revised.stderr)
    const impact = JSON.parse(fs.readFileSync(path.join(b.runDir, 'atomic', 'impact.json'), 'utf8'))
    assert.deepEqual(impact.impact.rebuild_days, [2])
    assert.deepEqual(impact.impact.reuse_days, [1, 3])
    const revisedStatus = status(b.runDir)
    assert.equal(revisedStatus.state, 'volume_ready')
    assert.deepEqual(revisedStatus.journals.map(row => [row.journal, row.state]), [['day-2-r2', 'complete']])

    // A tampered journal record or volume never reads as ready.
    const journal = path.join(b.runDir, 'atomic', 'journal', 'day-2-r2')
    const last = fs.readdirSync(journal).filter(file => file.startsWith('revision-')).sort().at(-1)
    fs.rmSync(path.join(journal, last))
    assert.equal(status(b.runDir).state, 'revision_incomplete')
    fs.appendFileSync(path.join(a.runDir, 'atomic', 'volume.html'), '<p>tampered</p>')
    assert.equal(status(a.runDir).state, 'broken')

    // An incomplete run cannot enter atomic production.
    const c = path.join(temp, 'c')
    assert.equal(cli('order-production-run.mjs', 'export', '--input', a.inputPath, '--run-dir', c).status, 0)
    const refused = cli('run-atomic.mjs', 'produce', '--input', a.inputPath, '--run-dir', c)
    assert.notEqual(refused.status, 0)
    assert.match(refused.stderr, /RUN_NOT_COMPLETE/)
  } finally {
    if (path.dirname(temp) !== path.resolve(os.tmpdir()) || !path.basename(temp).startsWith('vocaflow-run-atomic-'))
      throw Error('TEMP_CLEANUP_TARGET_INVALID')
    fs.rmSync(temp, { recursive: true, force: true })
  }
})
