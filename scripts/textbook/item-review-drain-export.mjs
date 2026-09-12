// scripts/textbook/item-review-drain-export.mjs
//
// **교재 문항 검수 드레인 ①/③ — 3인이 읽을 몫을 청크로 뽑는다.**
//
// ── 왜 필요한가 (DB 실측 2026-09-12) ────────────────────────────────
// 검증이 거꾸로 걸려 있었다:
//
//   기출 분석 2,234건            → 3인 검수 6,702행 (정확히 ×3)   · 학습자에게 안 간다
//   조판된 19권 · 지면 1,860문항 → 3인 검수      0행              · **학습자가 받는 것이다**
//
// 담을 표가 없었고(`20260912210000_csat_item_reviews`), ⑦ 검수 화면의 「L2 3인 페르소나」
// 눈금은 기출 쪽 수를 세고 있어서 그 구멍이 초록으로 가려졌다.
//
// ── 왜 재고 전량이 아니라 「실릴 문항」인가 ──────────────────────────
// 창고에는 65만 문항이 있고 그중 60% 는 어느 권에도 안 실린다(사다리 밖 재고). 지면에 없는
// 문항을 검수하는 것은 **아무도 읽지 않을 글을 검수하는 것**이다. 해설 드레인이 같은 이유로
// 같은 선택을 했고(실측 2026-09-07: 재고 전량 기준으로 재던 때 콘솔이 전 권을 「해설 아직」으로
// 적고 **할 일이 0인** 드레인을 가리켰다), 여기서도 조판기와 **같은 `loadVolume`** 을 쓴다.
//
// ⚠️ **풀을 여기서 다시 만들지 않는다.** 예전에 해설 드레인이 그렇게 했다가 겨냥한 80과
//   실린 80이 2문항 달랐다 — 뽑은 몫을 전부 채웠는데도 책은 78/80 으로 나왔다.
//   작게 어긋나는 드리프트는 티가 안 난다.
//
// 재실행 안전: **읽기만 한다.** 이미 3인이 본 문항은 안 나온다. 청크 파일은 덮어쓴다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/item-review-drain-export.mjs --band 5 --volume 20 --size 8
//   → scripts/textbook/item-review-drain/v5/chunk-00.json …

import fs from 'node:fs'
import path from 'node:path'

import { loadEnv, loadVolume } from './volume-pool.mjs'

loadEnv()
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const BAND = Number(arg('band') ?? 5)
/** 어느 시리즈의 권인가 — 빼면 독해로 겨냥한다(조판기와 같은 기본값). */
const SERIES = arg('series') ?? 'reading'
/** 단원 수. 조판할 때 쓸 값과 같아야 겨냥한 책과 실린 책이 같다. */
const VOLUME_UNITS = Number(arg('volume') ?? 20)
/** 한 청크에 담을 문항 수. 3인이 문항 하나를 제대로 읽으려면 작아야 한다. */
const SIZE = Number(arg('size') ?? 8)
/**
 * 청크를 둘 자리 — **밴드별로 가른다.**
 * 한 디렉터리를 쓰면 나중 export 가 앞 밴드의 청크를 지우고, import 는 그 안의 `.out.json`
 * 을 전부 읽어 밴드가 섞인다(해설 드레인이 겪은 일이다).
 */
const DIR = path.resolve(arg('dir') ?? `scripts/textbook/item-review-drain/${SERIES}-v${BAND}`)

const { createClient } = await import('@supabase/supabase-js')
// ⚠️ **순서·삽입은 payload 를 그대로 넘기면 검수가 불가능하다** (실측 2026-09-12, 첫 청크에서
//   드러났다). `payload.presented` 는 **문장 배열**이고 (A)(B)(C) 블록 경계는 `toCsatOrder`
//   가 정한다 — 그래서 payload 만 보면 「학습자가 보는 것」을 볼 수 없고, 검수자는 정답
//   순서가 왜 그것인지 확인할 방법이 없다. 삽입도 같다(자리 ①~⑤ 가 `slots` 로 정해진다:
//   `gap_count` 7 인데 선지는 5 다).
//   **해설 드레인과 같은 함수**를 쓴다 — 따로 형식기를 두면 검수한 것과 인쇄되는 것이 갈린다.
const { toCsatOrder, toCsatInsert } = await import('@vocaflow/library-pipeline')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── 그 권에 실릴 문항 ───────────────────────────────────────────────
const { pool, itemIds } = await loadVolume(db, {
  band: BAND,
  seriesId: SERIES,
  unitCount: VOLUME_UNITS,
  // 조판기와 같은 기본값 — 어긋나면 겨냥한 책과 실린 책이 달라진다.
  marketMix: !process.argv.includes('--no-market-mix'),
})
const printed = pool.filter((p) => itemIds.has(p.id))

if (!printed.length) {
  console.log(`V${BAND}(${SERIES}) — 실릴 문항이 0이다. 조판이 안 되는 권은 검수할 것이 없다.`)
  console.log('  먼저 store-new-types.mjs 로 재고를 채운다.')
  process.exit(0)
}

// ── 이미 3인이 본 것은 뽑지 않는다 ──────────────────────────────────
//
// ⚠️ **서로 다른 페르소나를 센다.** 행 수로 세면 같은 눈이 세 번 본 것이 「3인 검수」가 된다.
//   DB 의 `unique (item_id, persona)` 가 중복을 막지만, 세는 쪽도 같은 규약이어야 한다.
const done = new Set()
{
  const ids = printed.map((p) => p.id)
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db
      .from('csat_item_reviews')
      .select('item_id, persona')
      .eq('verdict', 'pass')
      .in('item_id', ids.slice(i, i + 200))
    // 표가 없거나 조회가 실패하면 **「전부 미완」으로 뭉개지 않는다** — 그러면 이미 본 것을
    // 다시 내보내 같은 일을 두 번 하게 된다. 실패는 실패라고 말하고 멈춘다.
    if (error) throw new Error('검수 기록 조회 실패: ' + error.message)
    const byItem = new Map()
    for (const r of data ?? []) {
      if (!byItem.has(r.item_id)) byItem.set(r.item_id, new Set())
      byItem.get(r.item_id).add(r.persona)
    }
    for (const [id, personas] of byItem) if (personas.size >= 3) done.add(id)
  }
}

/** 빈 검수 자리 셋 — 채우는 쪽이 페르소나 이름을 지어내지 않게 미리 박아 둔다. */
const BLANK_REVIEWS = [
  { persona: 'setter', verdict: '', findings: [], checked: [] },
  { persona: 'analyst', verdict: '', findings: [], checked: [] },
  { persona: 'tutor', verdict: '', findings: [], checked: [] },
]

const CIRCLED = ['①', '②', '③', '④', '⑤']
const tasks = []
let already = 0
let noExplanation = 0
/** 순서·삽입 변환에 실패한 것 — 지면에 못 싣는 문항이라 검수 대상도 아니다. */
let unprintable = 0

for (const r of printed) {
  if (done.has(r.id)) {
    already++
    continue
  }
  // ⚠️ **해설 없는 문항은 검수 대상이 아니다.** 세 페르소나 중 `tutor` 는 「해설이 왜
  //   나머지가 아닌지를 말하나」를 보는데, 해설이 없으면 그것을 볼 수 없어 자동 revise 가
  //   된다. 해설 드레인이 먼저다 — 순서를 뒤집으면 같은 문항을 두 번 검수하게 된다.
  if (!r.answer_key?.explanation_ko && !r.answer_key?.rationale_ko) {
    noExplanation++
    continue
  }
  const task = {
    id: r.id,
    type: r.type,
    v_level: r.v_level ?? BAND,
    explanation_ko: r.answer_key?.explanation_ko ?? r.answer_key?.rationale_ko ?? '',
    reviews: BLANK_REVIEWS.map((b) => ({ ...b, findings: [], checked: [] })),
  }

  // ── 학습자가 보는 모양으로 편다 ────────────────────────────────────
  // 순서·삽입만 변환이 필요하다. 나머지 유형은 `sentences` + `underlines` 로 그대로 읽힌다.
  if (r.type === 'order') {
    const it = toCsatOrder(r.payload?.presented ?? [], r.answer_key?.source_order ?? [])
    if (!it) {
      unprintable++
      continue
    }
    // 블록 경계가 여기서 정해진다 — 이것이 없으면 정답 순서를 확인할 수 없다.
    task.intro = it.intro
    task.blocks = it.blocks.map((b) => ({ label: b.label, text: b.sentences.join(' ') }))
    task.answer = it.answer
    task.answer_order = it.choices[it.answer - 1]
  } else if (r.type === 'insert') {
    const it = toCsatInsert(
      r.payload?.remaining ?? [],
      r.payload?.insert_sentence ?? '',
      r.answer_key?.position,
    )
    if (!it) {
      unprintable++
      continue
    }
    task.given = it.sentence
    // 자리 번호를 문장에 박아 넣는다 — `position`(원문 자리)과 선지 번호는 다르다.
    task.body = it.body.map((s, i) => {
      const slot = it.slots.indexOf(i + 1)
      return slot >= 0 ? `${s} ${CIRCLED[slot]}` : s
    })
    task.answer = it.answer
  } else {
    // 저장된 그대로. 이 유형들은 payload 가 곧 지면이다.
    task.payload = r.payload
    task.answer_key = r.answer_key
  }

  tasks.push(task)
}

fs.mkdirSync(DIR, { recursive: true })
// 앞 청크를 남겨 두면 다음 드레인이 낡은 것을 다시 읽는다.
for (const f of fs.readdirSync(DIR)) if (/^chunk-\d+\.json$/.test(f)) fs.unlinkSync(path.join(DIR, f))

const chunks = []
for (let i = 0; i < tasks.length; i += SIZE) {
  const n = String(chunks.length).padStart(2, '0')
  const file = path.join(DIR, `chunk-${n}.json`)
  fs.writeFileSync(file, JSON.stringify(tasks.slice(i, i + SIZE), null, 1), 'utf8')
  chunks.push(file)
}

console.log(`V${BAND}(${SERIES}) — 실릴 문항 ${printed.length} (단원 ${VOLUME_UNITS})`)
console.log(`  이미 3인이 통과시킴            ${already}`)
console.log(`  해설이 없어 아직 검수 못 함      ${noExplanation}${noExplanation ? '  ← 해설 드레인이 먼저다' : ''}`)
console.log(`  수능 형식 변환 실패            ${unprintable}`)
console.log(`  **3인이 읽을 몫               ${tasks.length}**  → 청크 ${chunks.length}개 (${SIZE}개씩)`)
if (!tasks.length) {
  console.log('\n  뽑을 것이 없다. 위 두 줄 중 어느 쪽이 몫을 먹었는지 보고 그쪽을 먼저 돌린다.')
} else {
  console.log(`\n  ${path.relative(process.cwd(), DIR)}/chunk-NN.json`)
  console.log('  명세: scripts/textbook/item-review-drain/_PROMPT.md')
  console.log('  각 항목의 reviews 셋을 채운 뒤 같은 이름 + .out.json 으로 저장하면')
  console.log('  item-review-drain-import.mjs --commit 이 DB 에 넣는다.')
}
