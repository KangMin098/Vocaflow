// scripts/textbook/adapt-review-export.mjs
// 완성된 각색 청크를 Claude Code·Codex 독립 검수 양식으로 내보낸다. DB 접근 없음.
import fs from 'node:fs'
import path from 'node:path'
import { REVIEWERS, mergeReviewTemplates, prepareReviewRows } from './academic-reading-review.mjs'

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i < 0 ? null : process.argv[i + 1]
}
const dir = path.resolve(arg('dir') ?? '')
if (!arg('dir') || !fs.existsSync(dir)) throw new Error('--dir <각색 청크 폴더>가 필요합니다')
const files = fs.readdirSync(dir).filter(f => f.endsWith('.out.json')).sort()
if (!files.length) throw new Error('완성된 .out.json 청크가 없습니다')
let created = 0
let held = 0
for (const file of files) {
  const original = path.join(dir, file.replace(/\.out\.json$/, '.json'))
  if (!fs.existsSync(original)) throw new Error(`원본 청크 없음: ${original}`)
  const source = JSON.parse(fs.readFileSync(original, 'utf8'))
  const drafts = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
  const prepared = prepareReviewRows(source, drafts)
  const complete = prepared.complete
  held += prepared.held.length
  for (const row of prepared.held) console.log(`  보류 ${row.source_id}: ${row.reason}`)
  if (!complete.length) continue
  for (const reviewer of REVIEWERS) {
    const output = path.join(dir, file.replace(/\.out\.json$/, `.${reviewer}.review.json`))
    const existing = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf8')) : []
    const merged = mergeReviewTemplates(existing, complete, reviewer)
    if (!merged.added) continue
    fs.writeFileSync(output, `${JSON.stringify(merged.rows, null, 2)}\n`)
    created += merged.added
    console.log(`${output}: 새 검수 ${merged.added}건`)
  }
}
console.log(`새 검수 항목 ${created}건 · 보류 행 ${held}개. 기존 판정은 보존했습니다.`)
