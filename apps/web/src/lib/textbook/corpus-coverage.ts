// apps/web/src/lib/textbook/corpus-coverage.ts
// Pure projection: the server reduces audit reports before passing data to the client.
export interface CoverageReport {
  measuredAt: string
  cells: {
    source: string
    cefr_level: string | null
    register: string | null
    explicit_school_feed: string | null
    conditional: number
  }[]
  sources: {
    source: string
    articles: number
    usable: number
    conditional: number
    last_fetch: string | null
    missing_fetch_time: number
  }[]
  registry: { source: string; label: string; license_class: string | null }[]
}
export interface TopicReport {
  measuredAt: string
  scanned: number
  cells: {
    source: string
    cefr: string | null
    topic: string
    register: string | null
    schoolFeed: string | null
    n: number
  }[]
  sampleIds: {
    id: string
    title: string
    source: string
    cefr: string | null
    topic: string
    register: string | null
  }[]
}
export interface CoverageCell {
  source: string
  cefr: string
  topic: string
  format: string
  school: string
  count: number
}
export interface CorpusCoverageData {
  measuredAt: string
  topicsMeasuredAt: string
  usable: CoverageCell[]
  conditional: CoverageCell[]
  sources: {
    source: string
    label: string
    articles: number
    usable: number
    conditional: number
    license: string | null
    lastFetch: string | null
    missingFetchTime: number
  }[]
  samples: TopicReport['sampleIds']
}
export interface SourceDiscoveryProfiles {
  schemaVersion: number
  measuredAt: string
  existing: {
    source: string
    role: string
    decision: string
    reason: string
    strengths: string[]
    weaknesses: string[]
    recommendedUse: string[]
    avoidFor: string[]
    evidenceUrls: string[]
  }[]
  candidates: {
    source: string
    label: string
    tier: string
    role: string
    topics: string[]
    reason: string
    accessStatus: string
    licenseSummary: string
    evidenceUrls: string[]
    pilot: {
      attempted: number
      extracted: number
      usable: number | null
      rejected: number | null
    } | null
  }[]
}
export const COVERAGE_UNKNOWN = '미측정'
export const DEFAULT_COVERAGE_FILTERS = { cefr: 'all', topic: 'all', format: 'all', school: 'all' }
export type CoverageFilters = typeof DEFAULT_COVERAGE_FILTERS
const measured = (value: string | null) => value || COVERAGE_UNKNOWN
function count(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid coverage count')
  return value
}
function compact(cells: CoverageCell[]) {
  const grouped = new Map<string, CoverageCell>()
  for (const cell of cells) {
    count(cell.count)
    if (!cell.count) continue
    const key = JSON.stringify([cell.source, cell.cefr, cell.topic, cell.format, cell.school])
    const prior = grouped.get(key)
    if (prior) prior.count += cell.count
    else grouped.set(key, { ...cell })
  }
  return [...grouped.values()]
}
export function buildCorpusCoverage(
  report: CoverageReport,
  topics: TopicReport
): CorpusCoverageData {
  const total = topics.cells.reduce((sum, cell) => sum + count(cell.n), 0)
  if (total !== topics.scanned) throw new Error('Topic scan count mismatch')
  // Separate measurement times are retained; never join these snapshots by article identity.
  return {
    measuredAt: report.measuredAt,
    topicsMeasuredAt: topics.measuredAt,
    usable: compact(
      topics.cells.map((cell) => ({
        source: cell.source,
        cefr: measured(cell.cefr),
        topic: cell.topic || '분류불가',
        format: measured(cell.register),
        school: measured(cell.schoolFeed),
        count: cell.n,
      }))
    ),
    conditional: compact(
      report.cells.map((cell) => ({
        source: cell.source,
        cefr: measured(cell.cefr_level),
        topic: COVERAGE_UNKNOWN,
        format: measured(cell.register),
        school: measured(cell.explicit_school_feed),
        count: cell.conditional,
      }))
    ),
    sources: report.sources.map((row) => {
      const registry = report.registry.find((item) => item.source === row.source)
      return {
        source: row.source,
        label: registry?.label ?? row.source,
        articles: count(row.articles),
        usable: count(row.usable),
        conditional: count(row.conditional),
        license: registry?.license_class ?? null,
        lastFetch: row.last_fetch,
        missingFetchTime: count(row.missing_fetch_time),
      }
    }),
    samples: topics.sampleIds.map(({ id, title, source, cefr, topic, register }) => ({
      id,
      title,
      source,
      cefr,
      topic,
      register,
    })),
  }
}
function matches(cell: CoverageCell, filters: CoverageFilters) {
  return (Object.keys(filters) as (keyof CoverageFilters)[]).every(
    (key) => filters[key] === 'all' || cell[key] === filters[key]
  )
}
export function coverageOptions(data: CorpusCoverageData, key: keyof CoverageFilters) {
  const cells = key === 'topic' ? data.usable : [...data.usable, ...data.conditional]
  return [...new Set(cells.map((cell) => cell[key]))].sort((a, b) => a.localeCompare(b, 'ko'))
}
export function selectCorpusCoverage(data: CorpusCoverageData, filters: CoverageFilters) {
  const usable = data.usable.filter((cell) => matches(cell, filters))
  // Stored conditional topics and reclassified usable topics are not comparable.
  const conditional =
    filters.topic === 'all' ? data.conditional.filter((cell) => matches(cell, filters)) : null
  const providers = data.sources
    .map((source) => ({
      ...source,
      usable: usable
        .filter((cell) => cell.source === source.source)
        .reduce((sum, cell) => sum + cell.count, 0),
      conditional: conditional
        ? conditional
            .filter((cell) => cell.source === source.source)
            .reduce((sum, cell) => sum + cell.count, 0)
        : null,
    }))
    .sort(
      (a, b) =>
        b.usable - a.usable ||
        (b.conditional ?? 0) - (a.conditional ?? 0) ||
        a.source.localeCompare(b.source)
    )
  const total = usable.reduce((sum, cell) => sum + cell.count, 0)
  const topicRows = coverageOptions(data, 'topic').map((topic) => ({
    topic,
    count: data.usable
      .filter((cell) => matches(cell, { ...filters, topic }))
      .reduce((sum, cell) => sum + cell.count, 0),
  }))
  return {
    total,
    conditional: conditional?.reduce((sum, cell) => sum + cell.count, 0) ?? null,
    providers,
    topics: topicRows,
    concentration: total ? (providers[0].usable / total) * 100 : null,
  }
}
