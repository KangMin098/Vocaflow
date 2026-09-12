// scripts/textbook/item-review-drain-import.mjs
//
// **교재 문항 검수 드레인 ③/③ — 3인이 쓴 것을 적재한다.**
//
// ⚠️ **빈 값·미달을 넣지 않는다.** 이 저장소의 드레인 규칙이다(루트 CLAUDE.md §🤖):
//   빈 값이 들어가면 다음 export 가 그것을 「완료」로 세어 **구멍이 영영 남는다.**
//   그래서 여기서 거르는 것과 건너뛴 수를 **반드시 출력한다.**
//
// ── 무엇을 거르는가 ──────────────────────────────────────────────────
//   · 판정이 빈 문자열인 검수 — 안 본 것이다
//   · 정의 밖 페르소나·판정 — DB CHECK 가 막지만 여기서 먼저 이름을 말해 준다
//   · 같은 페르소나가 두 번 — 같은 눈이 두 번 본 것은 다각이 아니다
//   · pass 인데 `checked` 가 빈 것 — 무엇을 봤는지 없으면 그 pass 는 도장이지 검수가 아니다
//
// ⚠️ **`fail`·`revise` 도 적재한다.** 기록이기 때문이다. 게이트는 「pass 3인」만 세므로
//   fail 이 있는 권은 그대로 막힌다 — 드레인은 사실을 남기고, 판정은 게이트가 한다.
//   (기출 쪽은 3인 pass 가 아니면 **분석 자체**를 안 넣는데, 그건 검수가 분석의 발행 조건이라서다.
//    여기서는 검수 기록이 독립 산출물이다.)
//
// 재실행 안전: `unique (item_id, persona)` 에 upsert 한다 — 몇 번 돌려도 행이 안 늘고
// 마지막 판정이 남는다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/item-review-drain-import.mjs --band 5            (미리보기)
//   pnpm dlx tsx scripts/textbook/item-review-drain-import.mjs --band 5 --commit   (적재)

import fs from 'node:fs'
import path from 'node:path'

import { loadEnv } from './volume-pool.mjs'

loadEnv()
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const BAND = Number(arg('band') ?? 5)
const SERIES = arg('series') ?? 'reading'
const COMMIT = process.argv.includes('--commit')
const DIR = path.resolve(arg('dir') ?? `scripts/textbook/item-review-drain/${SERIES}-v${BAND}`)

const PERSONAS = new Set(['setter', 'analyst', 'tutor'])
const VERDICTS = new Set(['pass', 'revise', 'fail'])

if (!fs.existsSync(DIR)) {
  console.log(`청크 자리가 없다: ${path.relative(process.cwd(), DIR)}`)
  console.log('  먼저 item-review-drain-export.mjs 를 돌린다.')
  process.exit(1)
}

const outFiles = fs.readdirSync(DIR).filter((f) => /^chunk-\d+\.out\.json$/.test(f)).sort()
if (!outFiles.length) {
  console.log(`채운 청크(.out.json)가 없다: ${path.relative(process.cwd(), DIR)}`)
  process.exit(1)
}

const rows = []
const skipped = []
let items = 0
let itemsWith3Pass = 0

for (const f of outFiles) {
  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
  } catch (e) {
    // **깨진 파일을 조용히 건너뛰지 않는다** — 그러면 그 청크의 몫이 영영 빈다.
    skipped.push(`${f}: JSON 파싱 실패 — ${e.message}`)
    continue
  }
  for (const t of Array.isArray(parsed) ? parsed : []) {
    items++
    if (!t?.id) {
      skipped.push(`${f}: id 없는 항목`)
      continue
    }
    const seen = new Set()
    let passes = 0
    for (const r of Array.isArray(t.reviews) ? t.reviews : []) {
      const persona = String(r?.persona ?? '')
      const verdict = String(r?.verdict ?? '')
      if (!PERSONAS.has(persona)) {
        skipped.push(`${t.id}: 정의 밖 페르소나 「${persona || '빈 값'}」`)
        continue
      }
      if (!verdict) {
        skipped.push(`${t.id}/${persona}: 판정이 비어 있다 — 안 본 것이다`)
        continue
      }
      if (!VERDICTS.has(verdict)) {
        skipped.push(`${t.id}/${persona}: 정의 밖 판정 「${verdict}」`)
        continue
      }
      if (seen.has(persona)) {
        skipped.push(`${t.id}/${persona}: 같은 페르소나가 두 번 — 다각이 아니다`)
        continue
      }
      const checked = Array.isArray(r.checked) ? r.checked.filter((s) => String(s).trim()) : []
      if (verdict === 'pass' && !checked.length) {
        // 무엇을 봤는지 없는 pass 는 검수가 아니라 도장이다.
        skipped.push(`${t.id}/${persona}: pass 인데 checked 가 비어 있다`)
        continue
      }
      seen.add(persona)
      if (verdict === 'pass') passes++
      rows.push({
        item_id: t.id,
        persona,
        verdict,
        findings: Array.isArray(r.findings) ? r.findings : [],
        checked,
      })
    }
    if (passes >= 3) itemsWith3Pass++
  }
}

console.log(`${path.relative(process.cwd(), DIR)} — 청크 ${outFiles.length}개 · 문항 ${items}`)
console.log(`  적재할 검수 행            ${rows.length}`)
console.log(`  3인 통과에 닿은 문항       ${itemsWith3Pass} / ${items}`)
console.log(`  **건너뛴 것              ${skipped.length}**`)
// 건너뛴 이유를 다 찍는다 — 수만 찍으면 무엇을 고쳐야 하는지 모른다.
for (const s of skipped.slice(0, 30)) console.log(`    · ${s}`)
if (skipped.length > 30) console.log(`    … 그리고 ${skipped.length - 30}건 더`)

if (!rows.length) {
  console.log('\n넣을 것이 없다.')
  process.exit(skipped.length ? 1 : 0)
}

if (!COMMIT) {
  console.log('\n미리보기다 — 아무것도 쓰지 않았다. 넣으려면 --commit.')
  process.exit(0)
}

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

let written = 0
for (let i = 0; i < rows.length; i += 200) {
  const slice = rows.slice(i, i + 200)
  const { error } = await db
    .from('csat_item_reviews')
    .upsert(slice, { onConflict: 'item_id,persona' })
  if (error) throw new Error(`적재 실패(${i}~): ${error.message}`)
  written += slice.length
  console.log(`  적재 ${written}/${rows.length}`)
}

console.log(`\n→ csat_item_reviews ${written}행`)
console.log('  다음: 같은 밴드를 조판하면 발행 게이트의 「3인 검수」 축이 오른다.')
