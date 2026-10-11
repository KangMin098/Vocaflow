// packages/library-pipeline/src/textbook/companion-practice.test.ts
import { describe, expect, it } from 'vitest'
import { exportOrderProductionDrain, importOrderProductionDrain } from './order-production-run'
import { assemblePlannedVolumeSynthetic, planProductBrief } from './product-planning'
import { buildCompanionPractice, verifyCompanionPractice, COMPANION_ACTIVITIES, type CompanionResources } from './companion-practice'

const h = (c: string) => c.repeat(64)
const policy = (n: string) => ({ version: `p${n}`, hash: h(n) })
const brief = (grades: string[], companion_activities: string[] = [...COMPANION_ACTIVITIES]) => ({
  schema: 'textbook-product-brief/1', grade_scope: { mode: grades.length === 1 ? 'single_grade' : 'multi_grade', grades },
  purpose: 'knowledge_reading', domain_weights: { science: 1 }, genre_weights: { explanation: 1 }, duration_days: 2,
  units_per_chapter: 2, difficulty: { start: 2, end: 3 }, passage_words: { start: 120, end: 130 },
  source_strategy: 'balanced', companion_activities })
const runInput = (b: ReturnType<typeof brief>) => ({ schema: 'textbook-order-production-input/1', sealed_at: '2026-10-07T00:00:00Z',
  drafts: b.grade_scope.grades.map(grade => ({ brief: b, plan_hash: planProductBrief(b).plan_hash, grade,
    product_order_id: `order-${grade}`, order_revision: 1, series_id: 's', edition_id: 'e', product_variant: 'student',
    language_band: grade.startsWith('high') ? 'high' : grade.startsWith('middle') ? 'middle' : 'elementary',
    passage_v_level: grade.startsWith('high') ? 7 : grade.startsWith('middle') ? 5 : 2, share_alike: false,
    unit_spec_version: 'u1', chapter_spec_version: 'c1', volume_spec_version: 'v1', layout_profile: 'reading-v1',
    policies: { source: policy('1'), rights: policy('2'), adaptation: policy('3'), benchmark: policy('4'),
      evidence: policy('5'), trust: policy('6') } })) })

// Ordinary prose so the real generators find candidates (articles, a repeated adjective, short sentences).
const body = [
  'The town sits beside a cold river.', 'Every spring the river brings water to the farms.',
  'They learn that clean water helps every living thing.', 'These farms grow an apple crop each year.', 'The farmers say the cold water keeps the soil healthy.',
  'Children walk to the river after school.', 'They watch the birds and count the fish.',
  'An old bridge crosses the river near the school.', 'The bridge is narrow but strong.',
  'In summer the town holds a fair by the water.', 'Families bring food and sit under the trees.',
  'The river is a quiet friend to the whole town.', 'People keep it clean because they need it.',
  'A teacher takes the class to test the water.', 'The students write what they see in a notebook.',
]
function fill(drain: ReturnType<typeof exportOrderProductionDrain>) {
  return { cells: drain.cells.map(cell => {
    const first = `This is the ${cell.grade.replace('_', ' ')} story for day ${cell.day}.`
    const words: string[] = first.split(' ')
    const sentences = [first]
    for (let i = 0; words.length < cell.passage_words_target - 4; i += 1) {
      const next = body[i % body.length]!
      sentences.push(next); words.push(...next.split(' '))
    }
    return { cell_id: cell.cell_id, cell_hash: cell.cell_hash, passage: sentences.join(' '), items: [{
      item_id: `${cell.cell_id}:i1`, item_type: cell.item_type, question: 'What is the passage about?',
      choices: ['A town and its river', 'A city at night'], answer: 1, explanation: '글 전체가 강과 마을 이야기다.',
      evidence_primary: first }] }
  }) }
}
const pool = ['river', 'water', 'fish', 'bridge', 'school', 'farm', 'apple', 'tree'].map(word => ({
  word, meaningKo: `${word}-뜻`, rhymeKey: word.slice(-2) }))
const deps: CompanionResources = {
  lexicon: { antonymsOf: word => ({ cold: ['hot'], clean: ['dirty'], narrow: ['wide'], strong: ['weak'], old: ['new'], quiet: ['noisy'] } as Record<string, string[]>)[word] ?? [],
    posOf: word => ['cold', 'clean', 'narrow', 'strong', 'old', 'quiet'].includes(word) ? 'adjective' : null },
  isCommonWord: () => true, wordPool: pool,
  audioOf: word => ({ url: `https://upload.wikimedia.org/En-us-${word}.ogg`, attribution: 'Wikimedia Commons · CC BY-SA 3.0' }),
}

describe('companion practice on the order lineage', () => {
  it('builds all seven non-reading activities from the run passages, bound to each order', () => {
    const input = runInput(brief(['elementary_6', 'high_2']))
    const drain = exportOrderProductionDrain(input)
    const run = importOrderProductionDrain(input, fill(drain))
    expect(run.status, JSON.stringify((run as { blockers?: unknown }).blockers)).toBe('assembled')
    if (run.status !== 'assembled') return
    expect(run.volumeInput.orders.every(entry => entry.order.activity_types.length === 7)).toBe(true)
    const practice = buildCompanionPractice(run, deps)
    expect(practice.status, JSON.stringify((practice as { blockers?: unknown }).blockers)).toBe('built')
    if (practice.status !== 'built') return
    for (const grade of ['elementary_6', 'high_2']) for (const activity of COMPANION_ACTIVITIES)
      expect(practice.manifest.items.some(item => item.grade === grade && item.activity === activity), `${grade} ${activity}`).toBe(true)
    const orders = new Map(drain.orders.map(order => [order.product_order_id, order.order_hash]))
    expect(practice.manifest.items.every(item => orders.get(item.product_order_id) === item.order_hash)).toBe(true)
    expect(practice.manifest.run_receipt_hash).toBe(run.output.receipt.receipt_hash)
    expect(practice.html).toContain('CC BY-SA 3.0')
    expect(verifyCompanionPractice(run, deps, practice)).toEqual(practice.manifest)
  })

  it('blocks missing resources and empty activities instead of inventing items, and detects stale output', () => {
    const input = runInput(brief(['middle_1'], ['vocab_practice', 'listening_practice']))
    const run = importOrderProductionDrain(input, fill(exportOrderProductionDrain(input)))
    if (run.status !== 'assembled') throw Error('run not assembled')
    expect(JSON.stringify(buildCompanionPractice(run, { ...deps, audioOf: undefined }))).toContain('COMPANION_RESOURCE_MISSING:audioOf')
    const noAntonyms = buildCompanionPractice(run, { ...deps, lexicon: { antonymsOf: () => [], posOf: () => null } })
    expect(noAntonyms.status).toBe('blocked')
    expect(JSON.stringify(noAntonyms)).toContain('COMPANION_ACTIVITY_EMPTY')
    const noAttribution = buildCompanionPractice(run, { ...deps, audioOf: word => ({ url: `https://x/${word}.ogg`, attribution: '' }) })
    expect(JSON.stringify(noAttribution)).toContain('"listening_practice","reason":"COMPANION_ACTIVITY_EMPTY"')
    const built = buildCompanionPractice(run, deps)
    if (built.status !== 'built') throw Error(JSON.stringify(built))
    run.volumeInput.units[0]!.passage = run.volumeInput.units[0]!.passage.replace('cold', 'warm')
    expect(() => verifyCompanionPractice(run, deps, built)).toThrow('COMPANION_PRACTICE_STALE_OR_MIXED')
  })

  it('an order without companion activities produces an empty, valid section', () => {
    const input = runInput(brief(['high_3'], []))
    const run = importOrderProductionDrain(input, fill(exportOrderProductionDrain(input)))
    if (run.status !== 'assembled') throw Error('run not assembled')
    const practice = buildCompanionPractice(run, deps)
    expect(practice.status).toBe('built')
    if (practice.status === 'built') expect(practice.manifest.items).toHaveLength(0)
  })
})

describe('companion practice through the order-production CLI', () => {
  it('blocks the run without resources and completes it with practice output when resources are given', async () => {
    const { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const path = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const { createRequire } = await import('node:module')
    const { spawnSync } = await import('node:child_process')
    const root = fileURLToPath(new URL('../../../../', import.meta.url))
    const tsx = createRequire(path.join(root, 'package.json')).resolve('tsx/cli')
    const temp = mkdtempSync(path.join(tmpdir(), 'vocaflow-companion-'))
    const cli = (...args: string[]) => spawnSync(process.execPath, [tsx, path.join(root, 'scripts/textbook/order-production-run.mjs'), ...args],
      { cwd: root, encoding: 'utf8', windowsHide: true })
    try {
      const inputPath = path.join(temp, 'input.json'), runDir = path.join(temp, 'run'), resPath = path.join(temp, 'res.json')
      writeFileSync(inputPath, JSON.stringify(runInput(brief(['elementary_6', 'high_2']))))
      expect(cli('export', '--input', inputPath, '--run-dir', runDir).status).toBe(0)
      writeFileSync(path.join(runDir, 'drain.out.json'), JSON.stringify(fill(JSON.parse(readFileSync(path.join(runDir, 'drain.json'), 'utf8')))))
      expect(cli('import', '--input', inputPath, '--run-dir', runDir).status).toBe(2)
      expect(existsSync(path.join(runDir, 'student.html'))).toBe(false)
      expect(cli('status', '--run-dir', runDir).stdout).toContain('COMPANION_RESOURCE_MISSING')
      writeFileSync(resPath, JSON.stringify({ antonyms: { clean: ['dirty'] }, pos: { clean: 'adjective' }, common_words: null,
        word_pool: pool, audio: Object.fromEntries(pool.map(w => [w.word, { url: `https://upload.wikimedia.org/En-us-${w.word}.ogg`, attribution: 'Wikimedia Commons · CC BY-SA 3.0' }])) }))
      const ok = cli('import', '--input', inputPath, '--run-dir', runDir, '--companion-resources', resPath)
      expect(ok.status, ok.stderr).toBe(0)
      expect(JSON.parse(cli('status', '--run-dir', runDir).stdout)).toMatchObject({ status: 'in_progress', current_stage: 'family_reviewed' })
      expect(existsSync(path.join(runDir, 'complete.json'))).toBe(false)
      const reviewDrain = JSON.parse(readFileSync(path.join(runDir, 'review.json'), 'utf8'))
      const approve = (verdict: 'pass' | 'fail') => ({ reviewer_id: 'claude-family-reviewer', units: reviewDrain.units.map((unit: { unit_id: string; unit_hash: string; passage: string }) => ({
        unit_id: unit.unit_id, unit_hash: unit.unit_hash, verdict,
        criteria: Object.fromEntries(reviewDrain.criteria.map((c: { id: string }) => [c.id, verdict === 'pass'])),
        quote: unit.passage.slice(0, 20), rationale: 'Synthetic test review of the family criteria.' })) })
      writeFileSync(path.join(runDir, 'review.out.json'), JSON.stringify(approve('fail')))
      expect(cli('review', '--input', inputPath, '--run-dir', runDir).status).toBe(2)
      expect(JSON.parse(cli('status', '--run-dir', runDir).stdout)).toMatchObject({ status: 'blocked', current_stage: 'family_reviewed' })
      writeFileSync(path.join(runDir, 'review.out.json'), JSON.stringify(approve('pass')))
      const reviewed = cli('review', '--input', inputPath, '--run-dir', runDir)
      expect(reviewed.status, reviewed.stderr).toBe(0)
      expect(JSON.parse(readFileSync(path.join(runDir, 'complete.json'), 'utf8')).family_review_receipt_hash).toMatch(/^[a-f0-9]{64}$/)
      const complete = JSON.parse(readFileSync(path.join(runDir, 'complete.json'), 'utf8'))
      const manifest = JSON.parse(readFileSync(path.join(runDir, 'practice.manifest.json'), 'utf8'))
      expect(complete.practice_manifest_hash).toBe(manifest.manifest_hash)
      expect(complete.companion_resources_sha256).toMatch(/^[a-f0-9]{64}$/)
      expect(manifest.resources_sha256).toBe(complete.companion_resources_sha256)
      expect(new Set(manifest.items.map((item: { activity: string }) => item.activity)).size).toBe(7)
      expect(readFileSync(path.join(runDir, 'practice.html'), 'utf8')).toContain('data-activity="dictation_practice"')
    } finally {
      if (path.dirname(temp) !== path.resolve(tmpdir()) || !path.basename(temp).startsWith('vocaflow-companion-'))
        throw Error('TEMP_CLEANUP_TARGET_INVALID')
      rmSync(temp, { recursive: true, force: true })
    }
  }, 60_000)
})

describe('review regressions (2026-10-11)', () => {
  it('an order whose sealed activities differ from the brief is stale, not silently practice-free', () => {
    const input = runInput(brief(['middle_2'], ['grammar_practice']))
    const drain = exportOrderProductionDrain(input)
    const run = importOrderProductionDrain(input, fill(drain))
    if (run.status !== 'assembled') throw Error('run not assembled')
    const mixed = structuredClone(run)
    mixed.volumeInput.orders[0]!.order.activity_types = []
    expect(() => assemblePlannedVolumeSynthetic(mixed.volumeInput)).toThrow('PRODUCT_PLAN_ORDER_STALE')
  })

  it('a one-skill diagnostic and a unit without items block instead of building or crashing', () => {
    const one = { ...brief(['middle_2'], ['diagnostic_check']), duration_days: 1, units_per_chapter: 1 }
    const input = runInput(one)
    const run = importOrderProductionDrain(input, fill(exportOrderProductionDrain(input)))
    if (run.status !== 'assembled') throw Error(JSON.stringify((run as { blockers?: unknown }).blockers))
    expect(JSON.stringify(buildCompanionPractice(run, deps))).toContain('COMPANION_DIAGNOSTIC_TOO_NARROW')
    const empty = structuredClone(run)
    empty.volumeInput.units[0]!.items = []
    expect(JSON.stringify(buildCompanionPractice(empty, deps))).toContain('COMPANION_UNIT_WITHOUT_ITEMS')
  })

  it('records the companion resources hash so a different resources file is a different lineage', () => {
    const input = runInput(brief(['middle_2'], ['grammar_practice']))
    const run = importOrderProductionDrain(input, fill(exportOrderProductionDrain(input)))
    if (run.status !== 'assembled') throw Error('run not assembled')
    const a = buildCompanionPractice(run, deps, { resourcesSha256: h('a') })
    if (a.status !== 'built') throw Error('not built')
    expect(a.manifest.resources_sha256).toBe(h('a'))
    expect(() => verifyCompanionPractice(run, deps, a, { resourcesSha256: h('b') })).toThrow('COMPANION_PRACTICE_STALE_OR_MIXED')
  })
})
