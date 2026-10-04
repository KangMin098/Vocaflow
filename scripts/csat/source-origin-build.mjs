// scripts/csat/source-origin-build.mjs
// 검색 대기열과 근거가 검수된 출처를 합쳐 전체 지문 결과 JSONL과 요약 보고서를 만든다.

import fs from 'node:fs'
import path from 'node:path'
import { renderOriginReport } from './source-origin-report.mjs'
import { searchAttemptKey } from './source-origin-search.mjs'

function arg(name, fallback) { const at = process.argv.indexOf(name); return at < 0 ? fallback : process.argv[at + 1] }
const pendingPath = path.resolve(arg('--pending', 'docs/reports/csat-source-origin-results-20260928.jsonl'))
const curatedPath = path.resolve(arg('--curated', 'scripts/csat/source-origin-curated.json'))
const curated = JSON.parse(fs.readFileSync(curatedPath, 'utf8'))
if (!/^\d{4}-\d{2}-\d{2}$/.test(curated.audited_at)) throw new Error('검수 날짜가 잘못됐다')
const stamp = curated.audited_at.replaceAll('-', '')
const resultsPath = path.resolve(arg('--results', `docs/reports/csat-source-origin-results-${stamp}.jsonl`))
const reportPath = path.resolve(arg('--report', `docs/reports/csat-source-origin-audit-${stamp}.md`))
const searchPath = path.resolve(arg('--search-log', 'scripts/csat/source-origin-work/raw-search.jsonl'))
const allowedStatuses = new Set(['confirmed_exact', 'supported_candidate', 'topic_lineage_only'])

function readJsonl(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line)
      } catch (error) {
        throw new Error(`${file}:${index + 1}: ${error instanceof Error ? error.message : String(error)}`)
      }
    })
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function sourceLabel(source) {
  const authors = source.authors?.length ? `${source.authors.join(', ')} — ` : ''
  const part = source.part ? ` (${source.part})` : ''
  return `${authors}*${source.title}*${part}`
}

const pending = readJsonl(pendingPath)
const attempts = fs.existsSync(searchPath) ? readJsonl(searchPath) : []
const attemptCounts = new Map()
const seenAttempts = new Set()
for (const attempt of attempts) {
  if (typeof attempt.query !== 'string' || !attempt.query.trim() || typeof attempt.raw_search !== 'string' || !attempt.raw_search.trim()) continue
  const key = searchAttemptKey(attempt)
  if (seenAttempts.has(key)) continue
  seenAttempts.add(key)
  attemptCounts.set(attempt.passage_sha256, (attemptCounts.get(attempt.passage_sha256) ?? 0) + 1)
}
const pendingByHash = new Map(pending.map((row) => [row.passage_sha256, row]))

if (pending.length !== curated.scope.unique_passages) {
  throw new Error(`대기열 ${pending.length}행과 고정 분모 ${curated.scope.unique_passages}행이 다르다`)
}
if (pendingByHash.size !== pending.length) throw new Error('대기열 passage_sha256가 중복됐다')

for (const [hash, review] of Object.entries(curated.entries)) {
  if (!pendingByHash.has(hash)) throw new Error(`대기열에 없는 검수 해시: ${hash}`)
  if (!allowedStatuses.has(review.status)) throw new Error(`허용되지 않은 상태 ${review.status}: ${hash}`)
  if (!review.source?.title || !Array.isArray(review.evidence) || review.evidence.length === 0) {
    throw new Error(`출처 또는 근거가 비었다: ${hash}`)
  }
}

const rows = pending.map((row) => {
  const review = curated.entries[row.passage_sha256]
  return {
    passage_sha256: row.passage_sha256,
    representative_item_id: row.representative_item_id,
    item_ids: row.item_ids,
    exam: row.exam,
    word_count: row.word_count,
    search_checked: (attemptCounts.get(row.passage_sha256) ?? 0) > 0,
    search_attempt_count: attemptCounts.get(row.passage_sha256) ?? 0,
    status: review?.status ?? 'unresolved',
    source: review?.source ?? null,
    evidence: review?.evidence ?? [],
    note:
      review?.note ??
      ((attemptCounts.get(row.passage_sha256) ?? 0) > 0 ? '저장된 검색 시도에서 검증 가능한 원전이 아직 확인되지 않았다.' : '저장된 검색 시도가 없다. 미조사 상태이며 출처가 없다는 뜻은 아니다.'),
  }
})

const counts = Object.fromEntries(
  ['confirmed_exact', 'supported_candidate', 'topic_lineage_only', 'unresolved'].map((status) => [
    status,
    rows.filter((row) => row.status === status).length,
  ]),
)
const itemCoverage = new Set(rows.flatMap((row) => row.item_ids)).size
if (itemCoverage !== curated.scope.in_scope_items) {
  throw new Error(`문항 커버리지 ${itemCoverage}와 고정 분모 ${curated.scope.in_scope_items}가 다르다`)
}

fs.mkdirSync(path.dirname(resultsPath), { recursive: true })
fs.writeFileSync(resultsPath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8')

const reviewedRows = rows.filter((row) => row.status !== 'unresolved')
const tableRows = reviewedRows
  .sort((a, b) => a.representative_item_id.localeCompare(b.representative_item_id, 'en', { numeric: true }))
  .map((row) => {
    const evidence = row.evidence[0]
    const linkedEvidence = evidence ? `[${escapeCell(evidence.label)}](${evidence.url})` : ''
    return `| ${escapeCell(row.item_ids.join(', '))} | ${escapeCell(row.status)} | ${escapeCell(sourceLabel(row.source))} | ${linkedEvidence} |`
  })
  .join('\n')

const report = renderOriginReport({ curated, rows, counts, itemCoverage, tableRows, resultsPath })

fs.writeFileSync(reportPath, report, 'utf8')
console.log(JSON.stringify({ results: resultsPath, report: reportPath, rows: rows.length, item_coverage: itemCoverage, counts }, null, 2))
