// packages/library-pipeline/src/textbook/order-production-run.test.ts
import { describe, expect, it } from 'vitest'
import { exportOrderProductionDrain, importOrderProductionDrain, summarizeOrderRun } from './order-production-run'
import { planProductBrief } from './product-planning'
import { PRODUCT_CAPABILITIES } from './factory-order'
import { PRODUCT_FAMILIES } from './academic-reading'

const hash = (char: string) => char.repeat(64)
const policy = (n: string) => ({ version: `p${n}`, hash: hash(n) })
const baseBrief = {
  schema: 'textbook-product-brief/1', grade_scope: { mode: 'single_grade', grades: ['elementary_5'] },
  purpose: 'knowledge_reading', domain_weights: { science: 1, social: 1 },
  genre_weights: { explanation: 1 }, duration_days: 6, units_per_chapter: 3,
  difficulty: { start: 1, end: 3 }, passage_words: { start: 60, end: 80 }, source_strategy: 'balanced',
}
function runInput(brief: Record<string, unknown>) {
  const { plan_hash } = planProductBrief(brief)
  const grades = (brief.grade_scope as { grades: string[] }).grades
  return { schema: 'textbook-order-production-input/1', sealed_at: '2026-10-10T00:00:00Z',
    drafts: grades.map(grade => ({ brief, plan_hash, grade,
      product_order_id: `order-${grade}`, order_revision: 1, series_id: 'series', edition_id: 'ed1',
      product_variant: 'student', language_band: grade.startsWith('high') ? 'high' : grade.startsWith('middle') ? 'middle' : 'elementary',
      passage_v_level: grade.startsWith('high') ? 7 : grade.startsWith('middle') ? 5 : 2, share_alike: false, unit_spec_version: 'u1', chapter_spec_version: 'c1',
      volume_spec_version: 'v1', layout_profile: 'reading-v1',
      policies: { source: policy('1'), rights: policy('2'), adaptation: policy('3'),
        benchmark: policy('4'), evidence: policy('5'), trust: policy('6') } })) }
}

// A deterministic "agent drain": passage of the target length with two distinct marked sentences.
function fill(drain: ReturnType<typeof exportOrderProductionDrain>) {
  return { cells: drain.cells.map(cell => {
    const filler = Array.from({ length: cell.passage_words_target - 12 }, (_, i) => `w${cell.day}x${i}`).join(' ')
    const passage = `Plants store energy in roots. ${filler} Rain refills the deep wells slowly.`
    return { cell_id: cell.cell_id, cell_hash: cell.cell_hash, passage, items: [{
      item_id: `${cell.cell_id}:i1`, item_type: cell.item_type, question: `Day ${cell.day}: which statement is supported?`,
      choices: ['Plants store energy in roots.', 'Wells never refill.'], answer: 1,
      explanation: 'The first sentence states it.', evidence_primary: 'Plants store energy in roots.',
      evidence_secondary: 'Rain refills the deep wells slowly.', focus_text: 'energy',
    }] }
  }) }
}

describe('registered order production run', () => {
  it('runs single grades from elementary_5 to high_3 and noncontiguous multi-grade through to one volume', () => {
    const scopes = [
      { mode: 'single_grade', grades: ['elementary_5'] }, { mode: 'single_grade', grades: ['high_3'] },
      { mode: 'multi_grade', grades: ['middle_1', 'high_3'] },
      { mode: 'grade_range', grades: ['middle_1', 'middle_2', 'middle_3'] },
    ]
    for (const grade_scope of scopes) {
      const input = runInput({ ...baseBrief, grade_scope })
      const drain = exportOrderProductionDrain(input)
      const result = importOrderProductionDrain(input, fill(drain))
      expect(result.status, JSON.stringify((result as { blockers?: unknown }).blockers)).toBe('assembled')
      if (result.status !== 'assembled') continue
      expect(result.output.receipt.unit_count).toBe(grade_scope.grades.length * 6)
      expect(result.output.manifest.publish_eligible).toBe(false)
      for (const entry of result.lineage) {
        const order = drain.orders.find(o => o.product_order_id === entry.product_order_id)!
        expect(entry.grade).toBe(order.grade)
        expect(entry.order_hash).toBe(order.order_hash)
        expect(entry.item_ids.every(id => id.startsWith(`${order.product_order_id}:`))).toBe(true)
      }
    }
  })

  it('runs every planned-path family through its adapter and refuses resource families', () => {
    for (const family of Object.keys(PRODUCT_FAMILIES) as (keyof typeof PRODUCT_FAMILIES)[]) {
      const input = runInput({ ...baseBrief, product_family: family })
      if (['P13', 'P14', 'P18', 'P20'].includes(family) || !PRODUCT_CAPABILITIES[family].items.length) {
        expect(() => exportOrderProductionDrain(input)).toThrow(/ORDER_RUN_FAMILY_NOT_IN_PLANNED_PATH|TARGET_DIFFERS|UNSUPPORTED/)
        continue
      }
      const result = importOrderProductionDrain(input, fill(exportOrderProductionDrain(input)))
      expect(result.status, `${family} ${JSON.stringify((result as { blockers?: unknown }).blockers)}`).toBe('assembled')
    }
  })

  it('blocks family-semantic failures, stale revisions, foreign cells and missing cells without output', () => {
    const input = runInput({ ...baseBrief, product_family: 'P09' })
    const drain = exportOrderProductionDrain(input)
    const noSecondary = fill(drain)
    delete (noSecondary.cells[0]!.items[0] as { evidence_secondary?: string }).evidence_secondary
    const a = importOrderProductionDrain(input, noSecondary)
    expect(a.status).toBe('blocked')
    expect(JSON.stringify(a)).toContain('READING_FAMILY_SECONDARY_EVIDENCE_MISSING')
    expect('output' in a).toBe(false)

    const revised = structuredClone(input)
    ;(revised.drafts[0] as { order_revision: number }).order_revision = 2
    const b = importOrderProductionDrain(revised, fill(drain))
    expect(b.status).toBe('blocked')
    expect(JSON.stringify(b)).toMatch(/ORDER_RUN_CELL_STALE_OR_FOREIGN|ORDER_RUN_CELL_MISSING/)

    const partial = fill(drain); partial.cells.pop()
    expect(JSON.stringify(importOrderProductionDrain(input, partial))).toContain('ORDER_RUN_CELL_MISSING')

    const tampered = fill(drain); tampered.cells[0]!.cell_hash = hash('a')
    expect(JSON.stringify(importOrderProductionDrain(input, tampered))).toContain('ORDER_RUN_CELL_HASH_STALE')

    const ungrounded = fill(drain); ungrounded.cells[1]!.items[0]!.evidence_primary = 'not in passage'
    expect(JSON.stringify(importOrderProductionDrain(input, ungrounded))).toContain('READING_FAMILY_ITEM_UNGROUNDED')
  })

  it('rejects drafts from different briefs mixed into one run', () => {
    const one = runInput({ ...baseBrief, grade_scope: { mode: 'multi_grade', grades: ['middle_1', 'high_1'] } })
    const other = runInput({ ...baseBrief, duration_days: 7, grade_scope: { mode: 'multi_grade', grades: ['middle_1', 'high_1'] } })
    one.drafts[1] = other.drafts[1]!
    expect(() => exportOrderProductionDrain(one)).toThrow('ORDER_RUN_BRIEF_MIXED')
  })

  it('summarizes state without reporting blocked or stale runs as complete', () => {
    expect(summarizeOrderRun({}).current_stage).toBe('order_sealed')
    const drain = { drain_hash: hash('1'), cells: [1, 2], orders: [] }
    expect(summarizeOrderRun({ drain }).status).toBe('in_progress')
    const blocked = summarizeOrderRun({ drain, result: { status: 'blocked', drain_hash: hash('2'),
      blockers: [{ stage: 'items_gated', reason: 'X' }] } })
    expect(blocked).toMatchObject({ status: 'blocked', current_stage: 'items_gated', stale: true })
    expect(summarizeOrderRun({ drain, result: { status: 'assembled', drain_hash: hash('1') },
      complete: { manifest_hash: hash('3') } }).status).toBe('complete')
  })
})


describe('order production run CLI', () => {
  it('exports, fills, gates and assembles a run directory; blocks, recovers and refuses rerun', async () => {
    const { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const path = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const { createRequire } = await import('node:module')
    const { spawnSync } = await import('node:child_process')
    const root = fileURLToPath(new URL('../../../../', import.meta.url))
    const tsx = createRequire(path.join(root, 'package.json')).resolve('tsx/cli')
    const temp = mkdtempSync(path.join(tmpdir(), 'vocaflow-order-run-'))
    const cli = (...args: string[]) => spawnSync(process.execPath, [tsx, path.join(root, 'scripts/textbook/order-production-run.mjs'), ...args],
      { cwd: root, encoding: 'utf8', windowsHide: true })
    try {
      const inputPath = path.join(temp, 'input.json'), runDir = path.join(temp, 'run')
      const input = runInput({ ...baseBrief, product_family: 'P05', grade_scope: { mode: 'multi_grade', grades: ['elementary_6', 'high_2'] } })
      writeFileSync(inputPath, JSON.stringify(input))
      expect(cli('export', '--input', inputPath, '--run-dir', runDir).status).toBe(0)
      expect(cli('export', '--input', inputPath, '--run-dir', runDir).status).not.toBe(0)
      const drain = JSON.parse(readFileSync(path.join(runDir, 'drain.json'), 'utf8'))
      const bad = fill(drain); bad.cells[0]!.items[0]!.focus_text = 'missing-word'
      writeFileSync(path.join(runDir, 'drain.out.json'), JSON.stringify(bad))
      expect(cli('import', '--input', inputPath, '--run-dir', runDir).status).toBe(2)
      expect(existsSync(path.join(runDir, 'student.html'))).toBe(false)
      expect(JSON.parse(cli('status', '--run-dir', runDir).stdout)).toMatchObject({ status: 'blocked', current_stage: 'items_gated' })
      writeFileSync(path.join(runDir, 'drain.out.json'), JSON.stringify(fill(drain)))
      writeFileSync(path.join(runDir, 'student.html'), 'interrupted partial write')
      const ok = cli('import', '--input', inputPath, '--run-dir', runDir)
      expect(ok.status, ok.stderr).toBe(0)
      const status = JSON.parse(cli('status', '--run-dir', runDir).stdout)
      expect(status).toMatchObject({ status: 'complete', current_stage: 'volume_assembled', stale: false, cell_count: 12 })
      const lineage = JSON.parse(readFileSync(path.join(runDir, 'lineage.json'), 'utf8'))
      expect(new Set(lineage.map((u: { product_order_id: string }) => u.product_order_id))).toEqual(new Set(['order-elementary_6', 'order-high_2']))
      expect(readFileSync(path.join(runDir, 'student.html'), 'utf8')).not.toContain('interrupted')
      expect(cli('import', '--input', inputPath, '--run-dir', runDir).status).not.toBe(0)
    } finally {
      if (path.dirname(temp) !== path.resolve(tmpdir()) || !path.basename(temp).startsWith('vocaflow-order-run-'))
        throw Error('TEMP_CLEANUP_TARGET_INVALID')
      rmSync(temp, { recursive: true, force: true })
    }
  }, 60_000)
})
