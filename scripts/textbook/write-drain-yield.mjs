// scripts/textbook/write-drain-yield.mjs
//
// **집필 드레인 ②.7 — 적재 *전에* "이 글에서 문항이 나오는가" 를 잰다.**
//
// ── 왜 필요한가 (2026-08-30 실측) ────────────────────────────────────
// 어수·어휘·문장 하한을 **전부 지켜도 문항이 안 나오는 글이 있다.** 적재기는 그것을
// 통과시키고, 문항 생성기는 조용히 0 을 낸다. 그 사이에 아무도 안 본다.
//
// 실측: V2 집필분 40편이 밴드 적중 40/40 · 문장 12 이상 · 어수 규격 안이었는데,
// 이 검사를 돌려 보니 **순서+삽입이 둘 다 나오는 글은 8편뿐**이었다. 원인은 문장 수다 —
// 13문장이면 `repaginate` 가 `[7,6]` 으로 가르는데, 순서 문항은 문단이 **4~6문장**이어야
// 나오므로 7문장 문단에서는 한 개도 안 나온다. 12문장이어야 `[6,6]` 이 되고 둘 다 나온다.
//
// 저장소가 같은 벽에 이미 두 번 부딪혔다(52편을 쓰고 순서 0 · V2 원글 85편에 10단원).
// 그때마다 원인을 적재 뒤에 알았다. **적재는 되돌릴 수 없다**(`source_id` 유일키라
// 덮어쓰지 않는다) — 그래서 이 검사는 적재 앞에 있어야 한다.
//
// ── 무엇을 재는가 ────────────────────────────────────────────────────
// 적재기와 **같은 `repaginate`** 로 문단을 나눈 뒤, 문단마다 세 규격을 함께 본다:
//   · 조합기 창       90~200어  (`CSAT_ITEM_WORDS` — 이걸 못 넘기면 통째로 걸린다)
//   · 순서 문항 문단  4~6문장   (도입문 1 + (A)(B)(C))
//   · 삽입 문항 문단  6~10문장  (본문 5~9문장 = 문단에서 한 문장을 빼낸 것)
// 겹치는 값이 **6문장**뿐이라, 한 편이 두 유형을 다 내려면 6문장 문단이 필요하다.
//
// ⚠️ 문단 나누기는 복제하지 않는다 — `repaginate.mjs` 를 그대로 가져다 쓴다.
//   복제하면 검사기가 통과시킨 글이 적재 뒤에 문항 0 으로 남는다.
//
// 재실행 안전: 읽기만 한다. DB 도 안 본다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/write-drain-yield.mjs --band 2
//   pnpm dlx tsx scripts/textbook/write-drain-yield.mjs --band 2 --only chunk-02

import fs from 'node:fs'
import path from 'node:path'

import { repaginate } from './repaginate.mjs'

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const BAND = Number(arg('band') ?? 3)
const ONLY = arg('only')
const DIR = path.resolve(arg('dir') ?? `scripts/textbook/write-drain/v${BAND}`)

/** 조합기가 문항 지문으로 쓰는 창. 이 밖이면 문단이 통째로 걸린다. */
const WINDOW = { min: 90, max: 200 }
/** 순서 문항이 나오는 문단 크기. */
const ORDER_SENTENCES = { min: 4, max: 6 }
/** 삽입 문항이 나오는 문단 크기. */
const INSERT_SENTENCES = { min: 6, max: 10 }

const sentencesOf = (t) => t.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 1)

if (!fs.existsSync(DIR)) {
  console.log(`청크 디렉터리가 없다: ${path.relative(process.cwd(), DIR)}`)
  process.exit(0)
}
const files = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.out.json'))
  .filter((f) => !ONLY || f.startsWith(ONLY))
  .sort()
if (!files.length) {
  console.log(`채워진 청크(.out.json)가 없다: ${path.relative(process.cwd(), DIR)}`)
  process.exit(0)
}

const rows = []
for (const f of files) {
  for (const r of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))) {
    if (String(r.content ?? '').trim()) rows.push(r)
  }
}

let ok = 0
const bad = []
for (const r of rows) {
  const paras = repaginate(r.content).split('\n\n').map((p) => {
    const w = p.split(/\s+/).filter(Boolean).length
    return { w, s: sentencesOf(p).length }
  })
  const fits = (p) => p.w >= WINDOW.min && p.w <= WINDOW.max
  const order = paras.filter((p) => fits(p) && p.s >= ORDER_SENTENCES.min && p.s <= ORDER_SENTENCES.max).length
  const insert = paras.filter((p) => fits(p) && p.s >= INSERT_SENTENCES.min && p.s <= INSERT_SENTENCES.max).length
  if (order > 0 && insert > 0) {
    ok += 1
    continue
  }
  // **왜 못 내는지 말한다.** 수만 찍으면 집필하는 쪽은 어디를 손대야 할지 알 수 없다.
  const why = paras.some((p) => !fits(p))
    ? paras.every((p) => p.w < WINDOW.min)
      ? '문단이 90어를 못 넘긴다 — 글을 늘리거나 문단을 덜 쪼갠다'
      : '문단 어수가 고르지 않다 — 문장 길이를 맞춘다'
    : '문단 문장 수가 6이 아니다 — 글을 **정확히 12문장**으로 맞추면 [6,6] 이 된다'
  bad.push(
    `  슬롯 ${r.slot} — 문단 [${paras.map((p) => `${p.s}문장/${p.w}어`).join(' · ')}]` +
      `  순서 ${order} · 삽입 ${insert}\n      → ${why}`,
  )
}

console.log(`V${BAND} 문항 수율 — 순서와 삽입이 **둘 다** 나오는 글 ${ok}/${rows.length}\n`)
if (bad.length) {
  console.log(bad.join('\n'))
  console.log(
    '\n두 유형이 다 있어야 단원이 만들어진다 — 하나만 나오는 글은 원글 수만 늘리고 단원은 못 늘린다.\n' +
      '**적재는 되돌릴 수 없다**(source_id 유일키라 덮어쓰지 않는다). 여기서 고치고 넣을 것.',
  )
} else {
  console.log('전부 순서·삽입 둘 다 낸다. 적재해도 좋다.')
}
