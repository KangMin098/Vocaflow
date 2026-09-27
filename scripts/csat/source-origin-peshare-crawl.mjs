// scripts/csat/source-origin-peshare-crawl.mjs
// 피이쉐어의 공개 원문 출처 페이지를 후보 데이터로 수집한다. 이 값은 오기 가능성이 있어 검증 전 확정하지 않는다.

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_OUTPUT = 'scripts/csat/source-origin-work/peshare-candidates.jsonl'
const DEFAULT_MAX_ID = 320
const CONCURRENCY = 5

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function decodeHtml(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractPage(id, html) {
  const title = decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1])
  if (!title || !/수능|모의평가/.test(title)) return null
  const sourceBlock = html.match(
    /원문 출처[\s\S]*?w3-pale-yellow[^>]*>\s*<p>([\s\S]*?)<\/p>/i,
  )?.[1]
  const sourceText = decodeHtml(sourceBlock)
  if (!sourceText) return null
  return {
    peshare_id: id,
    page_title: title,
    source_text: sourceText,
    url: `https://peshare.com/saying/view_saying.jsp?saying_id=${id}`,
    status: 'candidate_unverified',
  }
}

async function fetchPage(id) {
  const url = `https://peshare.com/saying/view_saying.jsp?saying_id=${id}`
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; VocaflowSourceAudit/1.0)' } })
  if (!response.ok) return null
  return extractPage(id, await response.text())
}

const maxId = Number(arg('--max-id', DEFAULT_MAX_ID))
if (!Number.isInteger(maxId) || maxId < 1 || maxId > 5000) throw new Error('--max-id는 1..5000이어야 한다')
const output = path.resolve(arg('--output', DEFAULT_OUTPUT))
const candidates = []
let errors = 0

for (let start = 1; start <= maxId; start += CONCURRENCY) {
  const ids = Array.from({ length: Math.min(CONCURRENCY, maxId - start + 1) }, (_, index) => start + index)
  const rows = await Promise.all(
    ids.map(async (id) => {
      try {
        return await fetchPage(id)
      } catch (error) {
        errors += 1
        console.error(`peshare ${id}: ${error instanceof Error ? error.message : String(error)}`)
        return null
      }
    }),
  )
  candidates.push(...rows.filter(Boolean))
}

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, `${candidates.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8')
console.log(JSON.stringify({ output, scanned: maxId, candidates: candidates.length, errors }, null, 2))
