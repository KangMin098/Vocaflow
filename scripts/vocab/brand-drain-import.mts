// scripts/vocab/brand-drain-import.mts
//
// **브랜드 드레인 3/3 — Claude Design 이 확정한 규격을 발행물에 각인한다.**
//
// ── 어디에 적재하나 ────────────────────────────────────────────────
// `shared_word_sets.curation_query` 는 jsonb 다. **키를 더하는 것이라 마이그레이션이 필요 없다**
// (CLAUDE.md §드레인 규칙). 통째로 덮지 않고 기존 값을 읽어 `brand` 키 하나만 더한다 —
// 덮으면 컴포저가 남긴 레시피·점수표·판권 각인이 날아간다.
//
// ── 넣지 않는 것 ───────────────────────────────────────────────────
// · **검증에 걸린 캔버스** — 특히 색 값(hex/rgb)이 들어 있으면 넣지 않는다. 넣는 순간
//   토큰이 정본이 아니게 되고, 토큰을 고쳐도 서가가 따라오지 않는다.
// · **빈 캔버스** — 빈 값이 들어가면 다음 export 가 "이미 했다" 로 세어 그 계열이 영영
//   빈 채로 남는다. 건너뛴 수를 반드시 출력한다.
//
// ── 재실행 안전 ────────────────────────────────────────────────────
// 같은 `.out.json` 으로 몇 번을 돌려도 결과가 같다. 기본은 드라이런이고 `--commit` 이 있어야 쓴다.
//
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/vocab/brand-drain-import.mts [--commit] [--dir <디렉터리>]

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { validateBrandCanvas, type VocabBrandCanvas } from '@vocaflow/library-pipeline/vocab-brand-canvas'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '')
  }
}

const argOf = (flag: string, fallback: string): string => {
  const i = process.argv.indexOf(flag)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback
}
const COMMIT = process.argv.includes('--commit')
const DIR = path.resolve(argOf('--dir', 'scripts/vocab/brand-drain'))

const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 부재 (apps/web/.env.local)')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

if (!fs.existsSync(DIR)) {
  console.error(`${DIR} 이 없다 — 먼저 export 를 돌릴 것.`)
  process.exit(1)
}

const outFiles = fs.readdirSync(DIR).filter((f) => f.endsWith('.out.json')).sort()
if (outFiles.length === 0) {
  console.error(`${DIR} 에 .out.json 이 없다 — Claude Design 단계가 아직이다.`)
  process.exit(1)
}

let applied = 0
let skippedInvalid = 0
let skippedMissingChunk = 0
let setsTouched = 0

for (const file of outFiles) {
  const outPath = path.join(DIR, file)
  const chunkPath = outPath.replace(/\.out\.json$/, '.json')
  if (!fs.existsSync(chunkPath)) {
    console.error(`  ! ${file} — 짝이 되는 청크가 없다 (${path.basename(chunkPath)}). 어느 세트에 넣을지 알 수 없어 건너뛴다`)
    skippedMissingChunk += 1
    continue
  }
  const chunk = JSON.parse(fs.readFileSync(chunkPath, 'utf8')) as { family: string; setIds: string[] }
  const canvas = JSON.parse(fs.readFileSync(outPath, 'utf8')) as VocabBrandCanvas

  const problems = validateBrandCanvas(canvas)
  if (problems.length > 0) {
    console.error(`  ! ${file} — 검증 ${problems.length}건, 넣지 않는다:`)
    for (const p of problems) console.error(`      ${p.field}: ${p.message}`)
    skippedInvalid += 1
    continue
  }
  if (canvas.family !== chunk.family) {
    console.error(`  ! ${file} — 계열이 청크와 다르다 (${canvas.family} ≠ ${chunk.family})`)
    skippedInvalid += 1
    continue
  }

  console.log(`  ${file} → ${chunk.family} · 세트 ${chunk.setIds.length}개`)
  applied += 1
  if (!COMMIT) { setsTouched += chunk.setIds.length; continue }

  for (const id of chunk.setIds) {
    const { data, error } = await supabase
      .from('shared_word_sets')
      .select('curation_query')
      .eq('id', id)
      .maybeSingle()
    if (error) { console.error(`      ! ${id}: ${error.message}`); continue }
    // 기존 jsonb 를 읽어 **키 하나만 더한다** — 통째로 덮으면 레시피가 날아간다.
    const cq = ((data as { curation_query: Record<string, unknown> | null } | null)?.curation_query ?? {}) as Record<string, unknown>
    const next = { ...cq, brand: canvas }
    const { error: upErr } = await supabase
      .from('shared_word_sets')
      .update({ curation_query: next } as never)
      .eq('id', id)
    if (upErr) { console.error(`      ! ${id}: ${upErr.message}`); continue }
    setsTouched += 1
  }
}

console.log('')
console.log(`브랜드 각인 ${COMMIT ? '적용' : '드라이런'}`)
console.log(`  캔버스 ${applied}개 · 세트 ${setsTouched}개`)
console.log(`  건너뜀 — 검증 실패 ${skippedInvalid} · 짝 없는 출력 ${skippedMissingChunk}`)
if (!COMMIT) console.log('  (쓰려면 --commit)')
