// scripts/csat/compare-v3-validate.mjs
//
// v3 비교 쌍 작성 결과 검증 — 형식 + 입력 결속(WRITER_PAIR.md). 내용 정확성은 독립 검수의 몫이다.
//   node scripts/csat/compare-v3-validate.mjs --chunk v3p-01
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const PAIR_KINDS = ['same_structure', 'contrast', 'boundary']
const STATUSES = ['ok', 'not_applicable', 'needs_review']
const BANNED = /항상|무조건|반드시|모든 문항|출제자(는|가)[^.]{0,20}(생각|의도했|노렸)/
const txt = (s) => typeof s === 'string' && s.trim().length > 0

export function validatePair(input, out) {
  const errs = []
  const e = (m) => errs.push(`${input.pair_id}: ${m}`)
  if (!out) return [`${input.pair_id}: 결과 없음`]
  if (!STATUSES.includes(out.status)) e(`status ${out.status}`)
  if (out.status !== 'ok') {
    if (!txt(out.reason)) e(`${out.status} 인데 reason 없음`)
    return errs
  }
  for (const k of ['left', 'right']) {
    const want = input[k]
    const got = out[k] ?? {}
    if (got.id !== want.id) e(`${k}.id ${got.id} ≠ ${want.id}`)
    if (got.units_hash !== want.units_hash) e(`${k}.units_hash 결속 불일치`)
    if (got.inquiry_hash !== want.inquiry_hash) e(`${k}.inquiry_hash 결속 불일치`)
  }
  if (!PAIR_KINDS.includes(out.kind)) e(`kind ${out.kind}`)
  if (!txt(out.focus)) e('focus 없음')
  const nL = input.left.sentences.length
  const nR = input.right.sentences.length
  const okS = (arr, n) => Array.isArray(arr) && arr.length > 0 && arr.every((x) => Number.isInteger(x) && x >= 1 && x <= n)
  const okC = (arr) => arr === undefined || (Array.isArray(arr) && arr.every((x) => Number.isInteger(x) && x >= 1 && x <= 5))
  const maps = Array.isArray(out.mappings) ? out.mappings : []
  if (maps.length < 1 || maps.length > 4) e(`mappings ${maps.length}개 — 1~4개`)
  maps.forEach((m, i) => {
    if (!okS(m.left?.sentences, nL)) e(`mappings[${i}].left.sentences 범위 밖/비어 있음`)
    if (!okS(m.right?.sentences, nR)) e(`mappings[${i}].right.sentences 범위 밖/비어 있음`)
    if (!okC(m.left?.choices) || !okC(m.right?.choices)) e(`mappings[${i}] choices 1~5 아님`)
    if (!txt(m.relation) || m.relation.length < 10) e(`mappings[${i}].relation 비었거나 짧음`)
  })
  const shared = Array.isArray(out.shared_conditions) ? out.shared_conditions : []
  const diffs = Array.isArray(out.decisive_differences) ? out.decisive_differences : []
  if (shared.length > 3 || !shared.every(txt)) e('shared_conditions 0~3개 · 빈 값 금지')
  if (diffs.length > 3) e('decisive_differences 0~3개')
  diffs.forEach((d, i) => {
    if (!txt(d.text)) e(`decisive_differences[${i}].text 없음`)
    if (!okS(d.left_sentences, nL) || !okS(d.right_sentences, nR)) e(`decisive_differences[${i}] 문장 범위 밖/비어 있음`)
  })
  if (out.kind === 'same_structure' && shared.length < 1) e('same_structure 인데 shared_conditions 없음')
  if ((out.kind === 'contrast' || out.kind === 'boundary') && diffs.length < 1) e(`${out.kind} 인데 decisive_differences 없음`)
  if (out.principle != null) {
    const p = out.principle
    if (p.level !== 'bounded') e(`principle.level ${p.level} — bounded 만`)
    if (!txt(p.statement)) e('principle.statement 없음')
    for (const k of ['when_applies', 'when_not']) if (!Array.isArray(p[k]) || p[k].length < 1 || p[k].length > 3 || !p[k].every(txt)) e(`principle.${k} 1~3개`)
  }
  if (!txt(out.limitation)) e('limitation 없음')
  const all = JSON.stringify([out.focus, maps.map((m) => m.relation), shared, diffs.map((d) => d.text), out.principle ?? '', out.limitation])
  if (BANNED.test(all)) e('보편 단정 · 출제자 내부 사고 단정 표현')
  return errs
}

async function main() {
  const i = process.argv.indexOf('--chunk')
  const name = i > 0 ? process.argv[i + 1] : null
  if (!name) { console.error('--chunk v3p-NN 필요'); process.exit(2) }
  const dir = join(process.cwd(), 'scripts/csat/compare-drain')
  const input = JSON.parse(readFileSync(join(dir, `chunk-${name}.json`), 'utf8'))
  const outPath = join(dir, `chunk-${name}.out.json`)
  const out = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : { pairs: [] }
  const byId = new Map((out.pairs ?? []).map((p) => [p.pair_id, p]))
  const errs = []
  const st = {}
  for (const p of input.pairs) {
    const o = byId.get(p.pair_id)
    if (o) st[o.status] = (st[o.status] ?? 0) + 1
    errs.push(...validatePair(p, o))
  }
  if (!out.writer_run) errs.push('writer_run 없음')
  console.log(`${name}: 쌍 ${input.pairs.length} · 오류 ${errs.length} · ${JSON.stringify(st)}`)
  for (const x of errs) console.log(`  - ${x}`)
  process.exit(errs.length ? 1 : 0)
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
