// scripts/csat/source-origin-build.mjs
// 검색 대기열과 근거가 검수된 출처를 합쳐 전체 지문 결과 JSONL과 요약 보고서를 만든다.

import fs from 'node:fs'
import path from 'node:path'

const pendingPath = path.resolve('scripts/csat/source-origin-work/pending.jsonl')
const curatedPath = path.resolve('scripts/csat/source-origin-curated.json')
const resultsPath = path.resolve('docs/reports/csat-source-origin-results-20260928.jsonl')
const reportPath = path.resolve('docs/reports/csat-source-origin-audit-20260928.md')
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
const curated = JSON.parse(fs.readFileSync(curatedPath, 'utf8'))
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
    search_checked: true,
    status: review?.status ?? 'unresolved',
    source: review?.source ?? null,
    evidence: review?.evidence ?? [],
    note:
      review?.note ??
      '서로 다른 짧은 구절을 이용한 웹·도서·학술 검색에서 독립 검증 가능한 서지 원천을 찾지 못했다.',
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

const report = `# 평가원 영어 기출 원천 전수 조사 — 2026-09-28

## 결론

DB의 평가원 영어 독해 지문 **${curated.scope.in_scope_items}문항 전부**를 본문 정규화 해시로 묶어 **${curated.scope.unique_passages}개 고유 지문**으로 조사했다. 그 결과 원문 또는 근접 원문을 직접 확인한 지문은 **${counts.confirmed_exact}개**, 서지는 강하게 지지되지만 공개 원문 대조가 덜 된 후보는 **${counts.supported_candidate}개**, 소재 계보만 확인된 것은 **${counts.topic_lineage_only}개**, 현재 근거로 확정할 수 없는 것은 **${counts.unresolved}개**다.

이 수치는 “검색 결과가 있었다”가 아니라 아래의 근거 등급을 통과한 수치다. 시험 문제 재게시·학원 자료·AI 생성형 출처 페이지는 그 자체만으로 확정 근거로 쓰지 않았다.

## 조사 범위

| 항목 | DB 실측 |
|---|---:|
| 시험 행 | ${curated.scope.exam_rows} |
| 수능 / 평가원 모의평가 | ${curated.scope.suneung_exam_rows} / ${curated.scope.mock_exam_rows} |
| 문항이 있는 시험 | ${curated.scope.exam_rows_with_items} |
| 조사 문항 | ${curated.scope.in_scope_items} |
| 고유 지문 | ${curated.scope.unique_passages} |
| 중복을 포함한 문항 커버리지 | ${itemCoverage} |
| 교육청 학평 | ${curated.scope.education_office_exam_rows} |

- \`${curated.scope.empty_exam_ids.join(', ')}\`는 시험 행만 있고 문항이 0개다.
- 현재 DB 범위는 수능과 한국교육과정평가원 모의평가다. 교육청 전국연합학력평가는 들어 있지 않다.
- 한 지문을 여러 문항이 공유하는 41–42번, 43–45번 등은 한 번만 검색하고 모든 연결 문항을 결과에 남겼다.

## 근거 등급

| 상태 | 뜻 |
|---|---|
| \`confirmed_exact\` | 출판사·저자·학술 페이지 또는 서지가 확인되는 전문 사본에서 시험 지문과 동일하거나 가벼운 편집만 거친 문장을 직접 확인 |
| \`supported_candidate\` | 책·논문 서지는 공식 페이지로 확인되고 독립적인 귀속 단서가 있으나, 공개된 원문에서 해당 문단을 직접 재확인하지 못함 |
| \`topic_lineage_only\` | 같은 연구·사례의 학술 원천은 찾았지만 시험 문장의 직접 원전이라고 볼 수 없음 |
| \`unresolved\` | 여러 독특한 구절을 검색했으나 시험 재게시물 밖에서 검증 가능한 원천을 찾지 못함 |

## 방법

1. \`csat_items.passage\`를 소문자·구두점·공백 기준으로 정규화하고 SHA-256으로 묶었다.
2. 713개 지문마다 문서 빈도가 낮은 7–11단어 구절을 최대 3개 골라 정확 구절 검색을 수행했다.
3. 일반 웹, 도서 본문, 출판사 미리보기, 학술 페이지, 저자 페이지 순으로 대조했다.
4. 시험지·EBS·학원·Quizlet·Scribd 등 재게시물은 원문 발견이 아니라 지문 동일성 확인에만 썼다.
5. 출처 집계에는 본문을 저장하지 않고 문항 ID, 본문 해시, 서지, 근거 URL만 남겼다.

재현 시작점은 \`node scripts/csat/source-origin-export.mjs\`, 결과 조립은 \`node scripts/csat/source-origin-build.mjs\`다. 검색 원문 로그는 평가원 지문과 대용량 검색 응답을 포함하므로 저장소에서 제외한다.

## 확인·후보 목록

| 문항 | 상태 | 원천 | 대표 근거 |
|---|---|---|---|
${tableRows}

## 조사 중 바로잡은 오귀속

- 2026 수능 22번은 Simon Chadwick 외가 아니라 Vanessa Ratten의 *Sport Entrepreneurial Ecosystems*가 유력하다.
- 2026 수능 24번은 다른 문화·스포츠 개론서가 아니라 Stuart Moss 편 *The Entertainment Industry*의 “Culturtainment” 장이 유력하다.
- 2026 수능 36번은 Edward T. Hall의 *The Dance of Life*가 아니라 Richard J. Bird의 *Chaos and Life*에서 문장이 직접 확인된다.
- 2026 수능 38번은 Paul Smith의 *Sell with a Story*가 아니라 Brent Dykes의 *Effective Data Storytelling* 귀속이 더 강하다.
- 2026 수능 40번은 막연한 *Semiotica* 논문이 아니라 Paul Bouissac의 *Semiotics at the Circus* 귀속이 더 강하다.
- 2022 수능 31번은 Morreall의 정치 유머 장보다 *Comic Relief*의 “The Negative Ethics of Humor”가 문맥과 문장에 맞는다.

## 한계와 DB 반영 조건

- 평가원 문제지는 영어 지문의 서지 출처를 공개하지 않으므로, 이 조사는 공식 정답표가 아니라 증거에 묶인 역추적 결과다.
- \`supported_candidate\`와 \`topic_lineage_only\`는 제품 화면에서 “출처”로 단정해 표시하면 안 된다.
- 현행 \`csat_items\`에는 원천 서지·근거·검증 상태 컬럼이 없다. 이번 작업은 **DB를 변경하지 않았다**.
- DB에 넣으려면 최소한 \`status\`, \`source_title\`, \`source_author\`, \`source_url\`, \`evidence_url\`, \`verified_at\`, \`passage_sha256\`를 함께 저장하고, 본문 해시가 달라지면 검증을 무효화해야 한다. 마이그레이션과 적재는 별도 승인 후 진행한다.

전체 713행 결과: [csat-source-origin-results-20260928.jsonl](./csat-source-origin-results-20260928.jsonl)
`

fs.writeFileSync(reportPath, report, 'utf8')
console.log(JSON.stringify({ results: resultsPath, report: reportPath, rows: rows.length, item_coverage: itemCoverage, counts }, null, 2))
