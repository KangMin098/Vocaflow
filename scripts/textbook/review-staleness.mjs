// scripts/textbook/review-staleness.mjs
//
// **검수 판정이 어느 판을 보고 내려졌는지 되짚는다 — 「지금도 그 말이 맞나」.**
//
// ── 왜 필요한가 (실측 2026-09-14) ───────────────────────────────────
// 세 시리즈가 전부 3인 검수에서 막혀 있고, 세 차례 드레인의 통과율이 5/60 · 0/55 · 4/57 이었다.
// 회차를 거듭해도 안 오르는 이유가 재고 품질인 줄 알았는데, 사유 947건을 계열로 접어 보니
// **1위가 「해설」(17.0% · 117문항)** 이었고 그 지적이 하나로 되풀이됐다:
//
//   "해설이 「나머지 ① meant · ③ agriculture … 는 앞뒤 내용과 어긋나지 않는다」 한 줄로
//    뭉개, 왜 나머지가 아닌지를 하나도 짚지 않는다."
//
// 그 문장은 **같은 날 생성기에서 제거됐고 38,522문항이 다시 쓰였다**(커밋 `0d4bafec`).
// DB 실측: 그 단정을 담은 문항이 지금 **0개**다. 그런데 그때 내려진 `fail` 은 그대로 남아
// 있고, 조판기는 그 판정을 근거로 문항을 **후보에서 영구히 뺀다**(`volume-pool.mjs`).
//
// ⚠️⚠️ **검수 기록에 「무엇을 봤는지」가 없다.** `csat_item_reviews` 는 판정·사유·확인 목록만
//   담고 **판정 대상의 판(version)** 을 안 담는다. 그래서:
//     · 생성기를 고쳐도 옛 판정은 절대 안 풀린다
//     · 후보 풀은 품질이 오르는 동안 **단조롭게 줄어든다**
//     · 통과율은 구조적으로 회복될 수 없다 — 회차마다 새 문항을 태우기만 한다
//   세 회차의 통과율이 안 오른 것이 이것으로 설명된다.
//
// ── 이 스크립트가 할 수 있는 것 / 없는 것 ───────────────────────────
// 표에 판(version)이 없으므로 일반적인 대조는 **불가능**하다. 다만 드레인이 남긴
// `*.out.json` 에 **검수자가 실제로 읽은 해설 원문**이 적혀 있다. 그것과 지금 DB 의 해설을
// 대조하면 **해설 축에 한해** 「그때 본 것과 지금 것이 다르다」를 정확히 셀 수 있다.
//
// ⚠️ **이것은 하한이다.** 해설만 본다 — 지문·선지가 바뀐 것은 여기서 안 잡힌다.
//   「바뀐 것이 N개」는 맞고 「안 바뀐 것이 나머지」는 **틀린 읽기**다.
//
// 재실행 안전: 읽기만 한다(DB·파일 모두). 아무것도 쓰지 않는다.
//
// 실행:
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/review-staleness.mjs
//   ... --list 20   ← 재검수 대상 id 를 몇 개까지 찍을지 (기본 0)

import fs from 'node:fs'
import path from 'node:path'

import { loadEnv, fetchAllIn } from './volume-pool.mjs'

loadEnv()

const arg = (n, fallback = null) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const LIST = Number(arg('list', '0'))

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const DRAIN = path.join(HERE, 'item-review-drain')

// ── ① 드레인이 남긴 「그때 본 해설」 ─────────────────────────────────
/** item_id → 검수 시점에 화면에 있던 해설. 같은 문항이 여러 회차에 나오면 **마지막 회차**. */
const judged = new Map()
let files = 0
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) {
      walk(p)
      continue
    }
    if (!name.endsWith('.out.json')) continue
    files++
    let rows
    try {
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'))
      rows = Array.isArray(raw) ? raw : Object.values(raw)
    } catch {
      // ⚠️ 깨진 파일을 조용히 건너뛰지 않는다 — 건너뛴 만큼 「바뀐 것 0」이 된다.
      console.log(`  ⚠ 읽을 수 없는 파일 ${path.relative(HERE, p)}`)
      continue
    }
    for (const r of rows) {
      if (!r?.id || typeof r.explanation_ko !== 'string') continue
      judged.set(r.id, r.explanation_ko)
    }
  }
}
if (!fs.existsSync(DRAIN)) {
  console.log(`드레인 폴더가 없다 — ${DRAIN}`)
  process.exit(0)
}
walk(DRAIN)
console.log(`드레인 산출물 ${files}개 · 해설을 되짚을 수 있는 문항 ${judged.size.toLocaleString()}`)

// ── ② 지금 DB 의 판정과 해설 ────────────────────────────────────────
const { createClient } = await import('@supabase/supabase-js')
const { countTriPersonaPassed } = await import('@vocaflow/library-pipeline')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { data: reviews, error } = await db
  .from('csat_item_reviews')
  .select('item_id, persona, verdict')
if (error) throw new Error(`검수 조회 실패: ${error.message}`)

/** 조판기와 **같은 규칙**으로 「후보에서 빠지는」 문항을 고른다 — 자를 둘로 만들지 않는다. */
const byItem = new Map()
for (const r of reviews ?? []) {
  const e = byItem.get(r.item_id) ?? { personas: new Set(), passes: new Set(), fails: 0 }
  e.personas.add(r.persona)
  if (r.verdict === 'pass') e.passes.add(r.persona)
  if (r.verdict === 'fail') e.fails += 1
  byItem.set(r.item_id, e)
}
const blocked = [...byItem.entries()]
  .filter(([, e]) => e.fails > 0 || (e.personas.size >= 3 && e.passes.size < 3))
  .map(([id]) => id)

const counted = countTriPersonaPassed(reviews ?? [])
console.log(
  `검수 기록 ${(reviews ?? []).length.toLocaleString()}건 · 문항 ${byItem.size.toLocaleString()} · ` +
    `3인 통과 ${counted.passed} · 후보에서 빠진 문항 ${blocked.length}`,
)

const ids = blocked.filter((id) => judged.has(id))
const items = await fetchAllIn(db, 'csat_dcp_items', 'id, type, answer_key', 'id', ids, ['id'])
const nowById = new Map(items.map((r) => [r.id, r.answer_key?.explanation_ko ?? r.answer_key?.rationale_ko ?? '']))

// ── ③ 대조 ─────────────────────────────────────────────────────────
const changed = []
const same = []
const gone = []
for (const id of blocked) {
  const then = judged.get(id)
  if (then === undefined) {
    gone.push(id)
    continue
  }
  const now = nowById.get(id)
  if (now === undefined) {
    gone.push(id)
    continue
  }
  ;(then.trim() === String(now).trim() ? same : changed).push(id)
}

const pct = (n) => (blocked.length ? `${Math.round((n / blocked.length) * 100)}%` : '—')
console.log('')
console.log(`후보에서 빠진 ${blocked.length}문항 중`)
console.log(`  판정 시점과 **해설이 다르다**   ${changed.length} (${pct(changed.length)})  ← 재검수 대상`)
console.log(`  해설이 그대로                   ${same.length} (${pct(same.length)})`)
console.log(`  되짚을 기록이 없다              ${gone.length} (${pct(gone.length)})  ← 판을 모른다`)

if (changed.length) {
  const byType = {}
  for (const r of items) if (changed.includes(r.id)) byType[r.type] = (byType[r.type] ?? 0) + 1
  console.log(
    `  유형별 — ${Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `${t} ${n}`)
      .join(' · ')}`,
  )
}
if (LIST && changed.length) {
  console.log('\n재검수 대상 id')
  for (const id of changed.slice(0, LIST)) console.log(`  ${id}`)
  if (changed.length > LIST) console.log(`  … 그 밖 ${changed.length - LIST}`)
}

console.log('')
console.log('⚠️ 이 수는 **하한이다** — 해설만 대조했다. 지문·선지가 바뀐 것은 안 잡힌다.')
console.log('⚠️ 「해설이 그대로」를 「판정이 아직 맞다」로 읽지 마라 — 다른 축이 바뀌었을 수 있다.')
console.log('   판을 기록하지 않는 한 일반적인 대조는 불가능하다(csat_item_reviews 에 판 열이 없다).')
