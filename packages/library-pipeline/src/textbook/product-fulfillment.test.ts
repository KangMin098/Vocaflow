// packages/library-pipeline/src/textbook/product-fulfillment.test.ts
import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync, mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { assemblePlannedVolumeSynthetic, buildProductOrderFromBrief, planProductBrief, verifyProductPlanFulfillment, verifyPlannedVolumeSyntheticOutput } from './product-planning'
import { sealProductOrder } from './factory-order'

const brief = {
  schema: 'textbook-product-brief/1', grade_scope: { mode: 'grade_range', grades: ['middle_1', 'middle_2'] },
  purpose: 'relation_reading', domain_weights: { science: 1, social: 1 },
  genre_weights: { explanation: 3, argument: 1 }, duration_days: 20, units_per_chapter: 5,
  difficulty: { start: 3, end: 6 }, passage_words: { start: 180, end: 260 }, source_strategy: 'balanced',
}
const hash = (char: string) => char.repeat(64)
function fixture(inputBrief = brief) {
  const { plan, plan_hash } = planProductBrief(inputBrief)
  const baseTarget = JSON.parse(readFileSync(new URL('../../../../scripts/textbook/targets/knowledge-middle1.json', import.meta.url), 'utf8'))
  const orders = plan.brief.grade_scope.grades.map(grade => {
    const ageBand = grade.startsWith('elementary_') ? 'upper_elementary' : grade
    const shell = {
      schema: 'textbook-product-order/1' as const,
      product_order_id: `order-${grade}`, order_revision: 1, series_id: 'relation-reading', edition_id: 'first',
      product_variant: 'relation', target: { ...baseTarget, age_band: ageBand, reasoning_band: ageBand, family: 'P09', skills: ['R3'] },
      exam_alignment: [], source_policy_version: 'source-v1', source_policy_hash: hash('1'),
      rights_policy_version: 'rights-v1', rights_policy_hash: hash('2'),
      adaptation_policy_version: 'adapt-v1', adaptation_policy_hash: hash('3'),
      unit_spec_version: 'unit-v1', chapter_spec_version: 'chapter-v1', volume_spec_version: 'volume-v1',
      layout_profile: 'reading-v1', benchmark_contract_version: 'benchmark-v1', benchmark_contract_hash: hash('4'),
      evidence_policy_version: 'evidence-v1', evidence_policy_hash: hash('5'),
      trust_policy_version: 'trust-v1', trust_policy_hash: hash('6'),
      created_at: '2026-10-09T00:00:00Z', sealed_at: '2026-10-09T00:01:00Z',
    }
    const sealed = buildProductOrderFromBrief(inputBrief, grade, shell)
    return { grade, order: sealed.order, order_hash: sealed.order_hash }
  })
  const units = orders.flatMap(entry => plan.units.map(unit => {
    const passage = Array.from({ length: unit.passage_words_target }, (_, index) => `word${index}`).join(' ')
    const prompt = `Which relation is supported on day ${unit.day} for ${entry.grade}?`
    const item = { item_id: `${entry.grade}-${unit.day}-item`, item_type: unit.item_type_target!,
      prompt, answer: 'The stated relation', explanation: 'The cited passage supports the answer.',
      evidence_quote: 'word0 word1', passage_hash: createHash('sha256').update(passage).digest('hex'),
      product_order_id: entry.order.product_order_id, order_revision: entry.order.order_revision,
      order_hash: entry.order_hash }
    return { day: unit.day, grade: entry.grade, product_order_id: entry.order.product_order_id,
      order_revision: entry.order.order_revision, order_hash: entry.order_hash, planning_hash: plan_hash,
      primary_skill: unit.primary_skill, domain: unit.domain, genre: unit.genre,
      difficulty_level: unit.difficulty_level, passage, items: [item],
      source_mode: unit.day <= 10 ? 'direct' : 'adaptation',
      revisit_prior_skill: unit.revisit_prior_skill, cumulative_review: unit.cumulative_review,
      unit_id: `${entry.grade}-${unit.day}`, unit_html: `<section><p>${passage}</p><p>${prompt}</p></section>`,
    }
  }))
  return { brief: inputBrief, orders, units }
}

describe('20-day planned volume fulfillment', () => {
  it('assembles single, noncontiguous and complete elementary-to-high-school student schedules', () => {
    for (const scope of [
      { mode: 'single_grade', grades: ['high_3'] },
      { mode: 'multi_grade', grades: ['middle_1', 'high_3'] },
      { mode: 'grade_range', grades: ['elementary_5', 'elementary_6', 'middle_1', 'middle_2', 'middle_3', 'high_1', 'high_2', 'high_3'] },
    ]) {
      const input = fixture({ ...brief, grade_scope: scope })
      const output = assemblePlannedVolumeSynthetic(input)
      expect(output.receipt.unit_count).toBe(scope.grades.length * 20)
      expect(output.receipt.grade_scope).toEqual(scope)
      expect(verifyPlannedVolumeSyntheticOutput(input, output)).toEqual(output.manifest)
    }
  })
  it('rebuilds output from current inputs and rejects changed render, explanation and mixed receipt', () => {
    const input = fixture(), output = assemblePlannedVolumeSynthetic(input)
    expect(verifyPlannedVolumeSyntheticOutput(input, output)).toEqual(output.manifest)
    expect(() => verifyPlannedVolumeSyntheticOutput(input, { ...output, html: output.html + '<p>changed</p>' }))
      .toThrow('PRODUCT_PLAN_OUTPUT_STALE_OR_MIXED')
    expect(() => verifyPlannedVolumeSyntheticOutput(input, { ...output,
      receipt: { ...output.receipt, planning_hash: hash('f') } })).toThrow('PRODUCT_PLAN_OUTPUT_STALE_OR_MIXED')
    input.units[0]!.items[0]!.explanation = 'Revised explanation'
    expect(() => verifyPlannedVolumeSyntheticOutput(input, output)).toThrow('PRODUCT_PLAN_OUTPUT_STALE_OR_MIXED')
  })

  it('runs the student-volume CLI for 40 grade/day cells without overwrite or stale-input output', () => {
    const root = fileURLToPath(new URL('../../../../', import.meta.url))
    const require = createRequire(path.join(root, 'package.json'))
    const temp = mkdtempSync(path.join(tmpdir(), 'vocaflow-planned-volume-'))
    try {
      const inputPath = path.join(temp, 'input.json'), output = path.join(temp, 'output')
      const input = fixture()
      writeFileSync(inputPath, JSON.stringify(input))
      const run = (out = output) => spawnSync(process.execPath, [require.resolve('tsx/cli'),
        path.join(root, 'scripts/textbook/planned-volume-run.mjs'), '--input', inputPath, '--out-dir', out],
      { cwd: root, encoding: 'utf8', windowsHide: true })
      const result = run()
      expect(result.status, result.stderr).toBe(0)
      const summary = JSON.parse(readFileSync(path.join(output, 'complete.json'), 'utf8'))
      expect(summary.publish_eligible).toBe(false)
      const receipt = JSON.parse(readFileSync(path.join(output, 'receipt.json'), 'utf8'))
      const manifest = JSON.parse(readFileSync(path.join(output, 'student.html.manifest.json'), 'utf8'))
      expect(summary.receipt_hash).toBe(receipt.receipt_hash)
      expect(summary.planning_hash).toBe(receipt.planning_hash)
      expect(summary.manifest_hash).toBe(manifest.manifest_hash)
      expect(existsSync(path.join(output, '.complete.pending'))).toBe(false)
      const html = readFileSync(path.join(output, 'student.html'), 'utf8')
      expect(html.match(/<section>/g)).toHaveLength(40)
      expect(existsSync(path.join(output, 'teacher.html'))).toBe(false)
      expect(run().status).not.toBe(0)
      expect(readFileSync(path.join(output, 'student.html'), 'utf8')).toBe(html)
      input.units[0]!.order_revision += 1
      writeFileSync(inputPath, JSON.stringify(input))
      const rejected = path.join(temp, 'rejected')
      expect(run(rejected).status).not.toBe(0)
      expect(existsSync(rejected)).toBe(false)
    } finally {
      if (path.dirname(temp) !== path.resolve(tmpdir()) || !path.basename(temp).startsWith('vocaflow-planned-volume-'))
        throw Error('TEMP_CLEANUP_TARGET_INVALID')
      rmSync(temp, { recursive: true, force: true })
    }
  })
  it('verifies skill, difficulty, domain, genre, item, source and grade balance from actual unit inputs', () => {
    const result = verifyProductPlanFulfillment(fixture())
    expect(result.unit_count).toBe(40)
    expect(result.units.filter(unit => unit.grade === 'middle_1')).toHaveLength(20)
    expect(result.synthetic_fixture && result.non_production).toBe(true)
    expect(result.receipt_hash).toMatch(/^[a-f0-9]{64}$/)
    const volume = assemblePlannedVolumeSynthetic(fixture())
    expect(volume.html.match(/<section>/g)).toHaveLength(40)
    expect(volume.manifest.fulfillment_receipt_hash).toBe(result.receipt_hash)
    expect(volume.manifest.publish_eligible).toBe(false)
  })

  it('rejects lost grades, stale orders and changed progression or rendered content', () => {
    const check = (edit: (value: ReturnType<typeof fixture>) => void, reason: string) => {
      const value = fixture()
      edit(value)
      expect(() => verifyProductPlanFulfillment(value)).toThrow(reason)
    }
    check(value => { value.units.pop() }, 'PRODUCT_PLAN_GRADE_OR_UNIT_COUNT_MISMATCH')
    check(value => { value.orders[0]!.order.planning_hash = hash('c') }, 'PRODUCT_PLAN_ORDER_STALE')
    check(value => {
      const entry = value.orders[0]!
      entry.order.domain_mix = { science: 100 }
      entry.order_hash = sealProductOrder(entry.order).order_hash
      for (const unit of value.units.filter(unit => unit.grade === entry.grade)) {
        unit.order_hash = entry.order_hash
        unit.items[0]!.order_hash = entry.order_hash
      }
    }, 'PRODUCT_PLAN_ORDER_STALE')
    check(value => { value.units[0]!.order_hash = hash('c') }, 'PRODUCT_PLAN_UNIT_STALE_OR_MIXED')
    check(value => { value.units[0]!.domain = 'history' }, 'PRODUCT_PLAN_UNIT_STALE_OR_MIXED')
    check(value => { value.units[0]!.genre = 'narrative' }, 'PRODUCT_PLAN_UNIT_STALE_OR_MIXED')
    check(value => { value.units[0]!.primary_skill = 'other' }, 'PRODUCT_PLAN_UNIT_STALE_OR_MIXED')
    check(value => { value.units[0]!.difficulty_level = 11 }, 'PRODUCT_PLAN_UNIT_STALE_OR_MIXED')
    check(value => { value.units[0]!.items[0]!.item_type = 'other' }, 'PRODUCT_PLAN_UNIT_STALE_OR_MIXED')
    check(value => { value.units[0]!.items.push({ ...value.units[0]!.items[0]!, item_type: 'other', item_id: 'other' }) }, 'PRODUCT_PLAN_UNIT_STALE_OR_MIXED')
    check(value => { value.units[4]!.revisit_prior_skill = false }, 'PRODUCT_PLAN_UNIT_STALE_OR_MIXED')
    check(value => { value.units[0]!.passage = 'short' }, 'PRODUCT_PLAN_PASSAGE_LENGTH_OUTSIDE_BAND')
    check(value => { value.units[0]!.unit_html = `<section><p>Different text</p><p>${value.units[0]!.items[0]!.prompt}</p></section>` }, 'PRODUCT_PLAN_UNIT_PASSAGE_NOT_RENDERED')
    check(value => {
      const unit = value.units[0]!
      unit.items[0]!.prompt = 'word0 word1'
      unit.unit_html = `<section><p>${unit.passage}</p></section>`
    }, 'PRODUCT_PLAN_UNIT_PASSAGE_NOT_RENDERED')
    check(value => { value.units[0]!.items = [] }, 'too_small')
    check(value => { value.units[0]!.items[0]!.passage_hash = hash('c') }, 'PRODUCT_PLAN_ITEM_MISSING_OR_MIXED')
    check(value => { value.units[0]!.items[0]!.evidence_quote = 'not in passage' }, 'PRODUCT_PLAN_ITEM_MISSING_OR_MIXED')
    check(value => { value.units[0]!.items[0]!.order_hash = hash('c') }, 'PRODUCT_PLAN_ITEM_MISSING_OR_MIXED')
    check(value => { value.units[0]!.items[0]!.prompt = 'not rendered' }, 'PRODUCT_PLAN_ITEM_MISSING_OR_MIXED')
    check(value => { value.units[0]!.items[0]!.item_id = value.units[1]!.items[0]!.item_id }, 'PRODUCT_PLAN_ITEM_MISSING_OR_MIXED')
    check(value => { value.units[0]!.unit_html = `<!-- ${value.units[0]!.passage} -->` }, 'PRODUCT_PLAN_UNIT_HTML_UNVERIFIABLE')
    check(value => { value.units[0]!.unit_html = `<!-- ${value.units[0]!.passage}` }, 'PRODUCT_PLAN_UNIT_HTML_UNVERIFIABLE')
    check(value => { value.units[0]!.unit_html = `<script>${value.units[0]!.passage}</script>` }, 'PRODUCT_PLAN_UNIT_HTML_UNVERIFIABLE')
    check(value => { value.units[0]!.unit_html = `<p hidden>${value.units[0]!.passage}</p>` }, 'PRODUCT_PLAN_UNIT_HTML_UNVERIFIABLE')
    check(value => {
      value.orders[1]!.order.product_order_id = value.orders[0]!.order.product_order_id
      for (const unit of value.units.filter(unit => unit.grade === 'middle_2'))
        unit.product_order_id = value.orders[0]!.order.product_order_id
    }, 'PRODUCT_PLAN_ORDER_REUSED_ACROSS_GRADES')
    check(value => { for (const unit of value.units) unit.source_mode = 'direct' }, 'PRODUCT_PLAN_SOURCE_MIX_MISMATCH')
    check(value => { value.units[0]!.grade = 'middle_2' }, 'PRODUCT_PLAN_UNIT_STALE_OR_MIXED')
    check(value => { value.units[1]!.unit_id = value.units[0]!.unit_id }, 'PRODUCT_PLAN_UNIT_STALE_OR_MIXED')
  })

  it('accepts visible passage text split by inline emphasis', () => {
    const value = fixture()
    const unit = value.units[0]!
    unit.unit_html = `<section><p>${unit.passage.replace('word1', '<em>word1</em>')}</p><p>${unit.items[0]!.prompt}</p></section>`
    expect(verifyProductPlanFulfillment(value).unit_count).toBe(40)
  })

  it('does not admit a capability type omitted from the sealed one-day order', () => {
    const value = fixture({ ...brief, duration_days: 1 })
    const unit = value.units[0]!
    const second = { ...unit.items[0]!, item_id: 'other-type', item_type: 'insert', prompt: 'A second question?' }
    unit.items.push(second)
    unit.unit_html = unit.unit_html.replace('</section>', `<p>${second.prompt}</p></section>`)
    expect(() => verifyProductPlanFulfillment(value)).toThrow('PRODUCT_PLAN_UNIT_STALE_OR_MIXED')
  })
})
