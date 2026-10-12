// scripts/csat/meaning-support-validate.mjs
//
// v3.1 교수 sidecar 작성 결과 기계 검증 — 형식 · 참조 · 결속(배포 inquiry 직접 해시) · 원문 대조(입력 있을 때) · 인용 예산.
// 의미 정확성은 독립 검수의 몫이다. 재실행 안전(파일을 쓰지 않는다).
//   node scripts/csat/meaning-support-validate.mjs --item 2026#34
//   node scripts/csat/meaning-support-validate.mjs --manifest scripts/csat/meaning-support-drain/pilot-manifest.json
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { quoteUsage, validateSupport, WRITER_STATUSES } from './lib-meaning-support.mjs'

const ROOT = process.cwd()
const DIR = join(ROOT, 'scripts/csat/meaning-support-drain')
const slug = (id) => id.replace('#', '-')
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

export function checkItem(id, { pub, requireInput = true } = {}) {
  const outPath = join(DIR, `support-${slug(id)}.out.json`)
  if (!existsSync(outPath)) return { id, status: 'missing', errs: ['작성 결과 없음'] }
  const out = readJson(outPath)
  const errs = []
  if (!WRITER_STATUSES.includes(out.status)) errs.push(`status ${out.status}`)
  if (!out.writer_run) errs.push('writer_run 없음')
  if (out.status !== 'ok') { if (!out.reason) errs.push(`${out.status} 인데 reason 없음`); return { id, status: out.status, errs } }
  const inPath = join(DIR, `input-${slug(id)}.json`)
  const input = existsSync(inPath) ? readJson(inPath) : null
  if (!input && requireInput) errs.push('원문 입력 없음 — 원문 대조 불가(빌드 실패 · 기존 산출물 보존)')
  const record = pub[id]
  errs.push(...validateSupport(out.support, { input: input ? { id, stem: input.stem, sentences: input.sentences, choices: input.choices } : null, record }))
  if (out.support?.itemId !== id) errs.push(`support.itemId ${out.support?.itemId} ≠ ${id}`)
  return { id, status: 'ok', errs, usage: quoteUsage(out.support ?? {}) }
}

function main() {
  const pub = readJson(join(ROOT, 'apps/web/src/lib/csat/inquiry-data.json')).items
  const i = process.argv.indexOf('--item')
  const m = process.argv.indexOf('--manifest')
  const ids = i > 0 ? [process.argv[i + 1]] : readJson(join(ROOT, m > 0 ? process.argv[m + 1] : 'scripts/csat/meaning-support-drain/pilot-manifest.json')).items.map((x) => x.itemId)
  let bad = 0
  for (const id of ids) {
    const r = checkItem(id, { pub })
    if (r.status === 'missing') { console.log(`${id}: 작성 결과 없음`); continue }
    console.log(`${id}: ${r.status} · 오류 ${r.errs.length}${r.usage ? ` · 공개 인용 ${r.usage.distinctQuotes}개 ${r.usage.quoteWords}단어(전부 기존 expression 안)` : ''}`)
    for (const x of r.errs) console.log(`  - ${x}`)
    bad += r.errs.length
  }
  process.exit(bad ? 1 : 0)
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
