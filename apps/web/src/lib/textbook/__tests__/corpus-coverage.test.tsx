// apps/web/src/lib/textbook/__tests__/corpus-coverage.test.tsx
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SourceWorkspace } from '@/app/admin/csat/sources/SourceWorkspace'
import { buildSourceEligibilityPanel } from '../source-eligibility-view'
import { buildSourceInventoryPanel } from '../source-inventory-view'

vi.mock('@/components/admin/AdminScreenHelp', () => ({ AdminScreenHelp: () => null }))
vi.mock('@/app/admin/csat/sources/SourceOperations', () => ({
  SourceOperations: () => null,
  SourceQueueSummary: () => null,
}))
import { CorpusCoverage } from '@/app/admin/csat/sources/CorpusCoverage'
import {
  buildCorpusCoverage,
  selectCorpusCoverage,
  DEFAULT_COVERAGE_FILTERS,
  type CoverageReport,
  type TopicReport,
} from '../corpus-coverage'
import {
  DEFAULT_SOURCE_STATE,
  SOURCE_VIEWS,
  parseSourceWorkspace,
  sourceViewForKey,
  sourceWorkspaceHref,
} from '../source-workspace'

const read = (name: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), '../../docs/reports', name), 'utf8'))
const report: CoverageReport = read('csat-corpus-coverage-20260919.json')
const topics: TopicReport = read('csat-usable-topics-20260919.json')
const data = buildCorpusCoverage(report, topics)

describe('corpus coverage measured snapshots', () => {
  it('preserves every measured usable article and conditional excerpt separately', () => {
    const result = selectCorpusCoverage(data, DEFAULT_COVERAGE_FILTERS)
    expect(result.total).toBe(topics.scanned)
    expect(result.total).toBe(report.sources.reduce((sum, source) => sum + source.usable, 0))
    expect(result.conditional).toBe(
      report.sources.reduce((sum, source) => sum + source.conditional, 0)
    )
    expect(result.providers).toHaveLength(report.sources.length)
    expect(data.measuredAt).not.toBe(data.topicsMeasuredAt)
  })
  it('does not convert absent fetch timestamps or unmeasured conditional topics into zero', () => {
    expect(report.sources.some((source) => source.last_fetch === null)).toBe(true)
    expect(report.sources.some((source) => source.last_fetch !== null)).toBe(true)
    for (const source of report.sources) {
      expect(data.sources.find((row) => row.source === source.source)).toMatchObject({
        lastFetch: source.last_fetch,
        missingFetchTime: source.missing_fetch_time,
      })
    }
    const selection = selectCorpusCoverage(data, {
      ...DEFAULT_COVERAGE_FILTERS,
      topic: '과학·자연',
    })
    expect(selection.conditional).toBeNull()
    expect(selection.providers.every((source) => source.conditional === null)).toBe(true)
    expect(selection.total).toBe(
      topics.cells
        .filter((cell) => cell.topic === '과학·자연')
        .reduce((sum, cell) => sum + cell.n, 0)
    )
  })
  it('computes intersections from cells and empty ranges without fabricated concentration', () => {
    const filters = { cefr: 'A2', topic: 'all', format: 'expository', school: 'PD 발췌 · 초5~6' }
    const expected = topics.cells
      .filter(
        (cell) =>
          cell.cefr === filters.cefr &&
          cell.register === filters.format &&
          cell.schoolFeed === filters.school
      )
      .reduce((sum, cell) => sum + cell.n, 0)
    expect(selectCorpusCoverage(data, filters).total).toBe(expected)
    const empty = selectCorpusCoverage(data, { ...filters, cefr: 'no such level' })
    expect(empty.total).toBe(0)
    expect(empty.concentration).toBeNull()
    expect(empty.topics.every((topic) => topic.count === 0)).toBe(true)
  })
  it('refuses malformed count and scan totals', () => {
    expect(() => buildCorpusCoverage(report, { ...topics, scanned: topics.scanned + 1 })).toThrow(
      'count mismatch'
    )
    expect(() =>
      buildCorpusCoverage(report, { ...topics, cells: [{ ...topics.cells[0], n: -1 }] })
    ).toThrow('Invalid coverage count')
  })
  it('reduces report payload and excludes original audit fields from client data', () => {
    expect(JSON.stringify(data).length).toBeLessThan(JSON.stringify({ report, topics }).length / 2)
    expect(JSON.stringify(data)).not.toContain('reading')
    expect(JSON.stringify(data)).not.toContain('harvest_cmd')
  })
  it('renders measured labels and disclosures in server HTML', () => {
    const html = renderToStaticMarkup(<CorpusCoverage data={data} onSource={() => {}} />)
    expect(html).toContain(topics.scanned.toLocaleString('ko-KR'))
    for (const label of [
      '고정 스냅샷',
      '연령 적합성은 미검증',
      '문항 유형 적합성은 미측정',
      '수집 시 기본값',
      '조건부 발췌',
    ])
      expect(html).toContain(label)
    expect(html).toContain('새 원천 후보와 검토 상태')
  })
})

describe('overview verdict does not merge conditional excerpts', () => {
  const panel = buildSourceEligibilityPanel()
  const inventory = buildSourceInventoryPanel()
  const render = (coverage?: typeof data) =>
    renderToStaticMarkup(
      <SourceWorkspace
        panel={panel}
        inventory={inventory}
        coverage={coverage}
        eligibility={null}
        operations={null}
      />
    ).match(/<section[^>]+aria-label="판정 현황과 측정 시각"[\s\S]*?<\/section>/)?.[0] ?? ''
  it('renders measured usable and conditional counts separately in the actual overview', () => {
    const html = render(data)
    const usable = data.usable.reduce((sum, cell) => sum + cell.count, 0)
    const conditional = data.conditional.reduce((sum, cell) => sum + cell.count, 0)
    expect(html).toContain('현재 스냅샷에서 사용 가능 원문')
    expect(html).toContain('<strong>' + usable.toLocaleString('ko-KR') + '</strong>')
    expect(html).toContain('조건부 발췌 ' + conditional.toLocaleString('ko-KR') + '편')
    expect(html).toContain('사용 가능 수에 포함하지 않습니다')
    expect(html).not.toContain(
      '<strong>' + (usable + conditional).toLocaleString('ko-KR') + '</strong>'
    )
    expect(html).toContain(data.measuredAt.slice(0, 19).replace('T', ' '))
  })
  it('labels legacy totals as candidates including conditional excerpts when coverage is absent', () => {
    const html = render()
    expect(html).toContain('이전 스캔의 조판 후보(조건부 포함)')
    expect(html).toContain(
      '<strong>' + panel.total.composable.toLocaleString('ko-KR') + '</strong>'
    )
    expect(html).not.toContain('현재 스냅샷에서 사용 가능 원문')
  })
})

describe('coverage navigation', () => {
  it('round trips the coverage URL and source inspector destination', () => {
    for (const state of [
      { ...DEFAULT_SOURCE_STATE, view: 'coverage' as const },
      { ...DEFAULT_SOURCE_STATE, source: 'the_conversation' },
    ]) {
      expect(
        parseSourceWorkspace(new URL(sourceWorkspaceHref(state), 'http://localhost').searchParams)
      ).toEqual(state)
    }
  })
  it('covers every tab using arrows, wraps in both directions, and reaches endpoints', () => {
    const views = Object.keys(SOURCE_VIEWS) as (keyof typeof SOURCE_VIEWS)[]
    for (let i = 0; i < views.length; i++) {
      expect(sourceViewForKey(views[i], 'ArrowRight')).toBe(views[(i + 1) % views.length])
      expect(sourceViewForKey(views[i], 'ArrowLeft')).toBe(
        views[(i + views.length - 1) % views.length]
      )
      expect(sourceViewForKey(views[i], 'Home')).toBe(views[0])
      expect(sourceViewForKey(views[i], 'End')).toBe(views.at(-1))
    }
    expect(sourceViewForKey('coverage', 'Escape')).toBeNull()
  })
})
