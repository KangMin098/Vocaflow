// scripts/csat/source-origin-raw-write.mjs
// 웹 검색 후보 행을 원전 조사 작업 파일에 해시 기준으로 재실행 안전하게 병합한다.

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import readline from 'node:readline'

const WORK_ROOT = path.resolve('scripts/csat/source-origin-work')
const DEFAULT_OUTPUT = path.join(WORK_ROOT, 'raw-search.jsonl')

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function assertWorkPath(value) {
  const resolved = path.resolve(value)
  const relative = path.relative(WORK_ROOT, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`작업 디렉터리 밖에는 쓸 수 없다: ${resolved}`)
  }
  return resolved
}

function parseRows(serialized) {
  const value = JSON.parse(serialized)
  if (!Array.isArray(value)) throw new Error('입력은 JSON 배열이어야 한다')
  return value.map((row) => {
    if (!/^[a-f0-9]{64}$/.test(row.passage_sha256 ?? '')) throw new Error('passage_sha256가 잘못됐다')
    if (typeof row.representative_item_id !== 'string') throw new Error('representative_item_id가 없다')
    if (typeof row.query !== 'string' || typeof row.raw_search !== 'string') {
      throw new Error('query/raw_search가 없다')
    }
    return row
  })
}

const output = assertWorkPath(arg('--output', DEFAULT_OUTPUT))
const existing = fs.existsSync(output)
  ? fs
      .readFileSync(output, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  : []

const byHash = new Map(existing.map((row) => [row.passage_sha256, row]))

function mergeAndWrite(incoming) {
  let changed = 0
  for (const row of incoming) {
    const before = byHash.get(row.passage_sha256)
    if (before && before.query === row.query && before.raw_search === row.raw_search) continue
    byHash.set(row.passage_sha256, row)
    changed += 1
  }

  const rows = [...byHash.values()].sort((a, b) =>
    a.representative_item_id.localeCompare(b.representative_item_id, 'en', { numeric: true }),
  )
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8')
  return { changed, total: rows.length }
}

if (process.argv.includes('--stream')) {
  const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity, terminal: false })
  for await (const line of input) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed === '__CSAT_SOURCE_ORIGIN_END__') break
    const incoming = parseRows(trimmed)
    const result = mergeAndWrite(incoming)
    console.log(JSON.stringify({ output, incoming: incoming.length, ...result }))
  }
  input.close()
} else {
  const encoded = arg('--base64')
  const serialized = encoded
    ? Buffer.from(encoded, 'base64').toString('utf8')
    : await new Promise((resolve, reject) => {
        let input = ''
        const sentinel = '__CSAT_SOURCE_ORIGIN_END__'
        process.stdin.setEncoding('utf8')
        process.stdin.on('data', (chunk) => {
          input += chunk
          const end = input.indexOf(sentinel)
          if (end >= 0) {
            process.stdin.pause()
            resolve(input.slice(0, end).trim())
          }
        })
        process.stdin.on('end', () => resolve(input))
        process.stdin.on('error', reject)
      })
  if (!serialized.trim()) throw new Error('표준 입력이나 --base64 입력이 필요하다')
  const incoming = parseRows(serialized)
  const result = mergeAndWrite(incoming)
  console.log(JSON.stringify({ output, incoming: incoming.length, ...result }))
}
