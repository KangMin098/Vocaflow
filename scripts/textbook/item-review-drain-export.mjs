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
const { toCsatOrder, toCsatInsert, reviewDigest, freshnessOf } = await import('@vocaflow/library-pipeline')

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

// ── 이미 본 것은 뽑지 않는다 — **세 갈래로 가른다** ────────────────
//
// ⚠️ **처음에 「3인 pass」만 걸렀다가 드레인이 영원히 도는 모양이 됐다**(실측 2026-09-12).
//   3인이 다 읽고 `fail`·`revise` 를 준 문항은 **재검수 대상이 아니라 고칠 대상**이다.
//   그런데 pass 가 3 미만이라 매번 다시 뽑혔다 — 같은 5문항을 몇 번이고 다시 읽게 된다.
//   (실측: 검수한 8문항 중 3만 통과, **5는 3인이 다 봤는데 미통과**였다.)
//
//   그래서 갈래가 셋이다:
//     ① 3인 pass        → 통과. 안 뽑는다.
//     ② 3인이 봤고 미통과 → **고칠 몫.** 안 뽑는다 — 문항·해설을 고친 뒤 검수 행을 지우고 다시 받는다.
//     ③ 3인 미만        → 읽을 몫. 이것만 뽑는다.
//
// ⚠️ **서로 다른 페르소나를 센다.** 행 수로 세면 같은 눈이 세 번 본 것이 「3인 검수」가 된다.
const passed = new Set()
const settled = new Set()
/** 낡거나 판을 모르는 판정이 붙어 있어 **다시 뽑는** 문항. 수를 찍는다 — 조용히 늘면 안 된다. */
const reopened = new Set()
/**
 * 그 문항의 지금 판. 검수 행의 `reviewed_digest` 와 대조할 상대다.
 *
 * ⚠️⚠️ **저장된 행에서 찍는다 — 풀에서 찍으면 안 된다.** `loadVolume` 은 지면용으로 문장을
 *   다듬어서 돌려준다(`volume-pool.mjs` 의 `normalizeQuotes(stripSpaceBeforePunct(…))`).
 *   그 사본으로 판을 찍으면 **DB 의 판과 영원히 어긋나고**, 게이트·계기는 그 문항을 늘
 *   「다른 판」으로 읽어 **고쳐도 안 풀리는 문제가 그대로 되살아난다.**
 *
 *   실측 2026-09-14(첫 바퀴에서 바로 드러났다): 6문항 중 1건이 어긋났고, 차이는 지문
 *   869번째 글자의 아포스트로피 하나였다 — 청크 `will-o’-the-wisp` · DB `will-o'-the-wisp`.
 *   길이도 1069 로 같아 눈으로는 보이지 않는다.
 *
 *   판이 가리켜야 하는 것은 **저장된 문항**이다. 다듬기는 저장된 글에서 결정론으로 나오므로,
 *   저장된 글이 그대로면 지면도 그대로다.
 */
const rawById = new Map()
{
  const ids = printed.map((p) => p.id)
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db
      .from('csat_dcp_items')
      .select('id, payload, answer_key')
      .in('id', ids.slice(i, i + 200))
    if (error) throw new Error('원본 문항 조회 실패: ' + error.message)
    for (const r of data ?? []) rawById.set(r.id, r)
  }
}
/** 저장된 행이 없으면 판을 찍지 않는다 — 짐작한 판을 적으면 그 판정이 영원히 「지금 판」이 된다. */
const digestOf = (id) => {
  const raw = rawById.get(id)
  return raw ? reviewDigest(raw.payload, raw.answer_key) : null
}
const nowDigest = new Map(printed.map((p) => [p.id, digestOf(p.id)]).filter(([, d]) => d))
{
  const ids = printed.map((p) => p.id)
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db
      .from('csat_item_reviews')
      .select('item_id, persona, verdict, reviewed_digest')
      .in('item_id', ids.slice(i, i + 200))
    // 표가 없거나 조회가 실패하면 **「전부 미완」으로 뭉개지 않는다** — 그러면 이미 본 것을
    // 다시 내보내 같은 일을 두 번 하게 된다. 실패는 실패라고 말하고 멈춘다.
    if (error) throw new Error('검수 기록 조회 실패: ' + error.message)
    const seen = new Map()
    const ok = new Map()
    for (const r of data ?? []) {
      // ── 낡은 판정으로 문항을 빼지 않는다 (2026-09-14) ──────────────────
      // ⚠️ 이것이 없던 동안 **고쳐도 영원히 안 풀렸다.** 해설을 고쳐 38,522문항을 다시
      //   썼는데도 그때 내려진 `fail` 이 남아 문항이 ②「고칠 몫」으로 빠졌다 — 실측
      //   후보에서 빠진 163문항 중 **123(75%)이 판정 시점과 해설이 달랐다.** 후보 풀은
      //   품질이 오르는 동안 단조롭게 줄고, 통과율이 구조적으로 회복될 수 없었다.
      //
      //   판이 다르거나(**stale**) 모르면(**unknown**) 그 판정은 **지금 문항에 대한 것이
      //   아니다.** 세지 않고 다시 뽑는다 — 문항이 검수 큐로 돌아갈 뿐이라 안전하다
      //   (조판은 여전히 「3인 pass」를 요구한다).
      if (freshnessOf(r, nowDigest) !== 'current') {
        reopened.add(r.item_id)
        continue
      }
      if (!seen.has(r.item_id)) seen.set(r.item_id, new Set())
      seen.get(r.item_id).add(r.persona)
      if (r.verdict === 'pass') {
        if (!ok.has(r.item_id)) ok.set(r.item_id, new Set())
        ok.get(r.item_id).add(r.persona)
      }
    }
    for (const [id, personas] of seen) {
      if ((ok.get(id)?.size ?? 0) >= 3) passed.add(id)
      else if (personas.size >= 3) settled.add(id)
    }
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
/** 3인이 다 봤는데 통과 못 한 것 — **고칠 몫**이다(재검수 아님). */
let toFix = 0
/** 순서·삽입 변환에 실패한 것 — 지면에 못 싣는 문항이라 검수 대상도 아니다. */
let unprintable = 0

for (const r of printed) {
  if (passed.has(r.id)) {
    already++
    continue
  }
  if (settled.has(r.id)) {
    // 3인이 다 봤는데 통과 못 한 것 — 다시 읽을 것이 아니라 고칠 것이다.
    toFix++
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
    // **그때 읽은 판.** 적재가 이 값을 검수 행에 그대로 적고, 게이트는 지금 판과 같은 판정만
    // 센다. 이것이 없던 동안 해설을 고쳐도 옛 fail 이 안 풀렸다 — 실측 2026-09-14, 후보에서
    // 빠진 163문항 중 123(75%)이 판정 시점과 해설이 달랐다. 정본은 `reviewDigest()` 하나다.
    reviewed_digest: digestOf(r.id),
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
// ── 앞 회차를 **한 벌로** 치운다 ────────────────────────────────────
//
// ⚠️ 여기가 `chunk-NN.json` 만 지우고 있었다. 그러면 앞 회차의 `chunk-NN.out.json` 과
//   `.imported` 표식이 남는데, 새 export 는 **같은 번호에 다른 문항**을 담는다(실측
//   2026-09-14: chunk-01·02 의 옛 out 이 새 청크와 문항이 전혀 달랐다). 결과가 둘이다:
//     ① 새로 채운 `.out.json` 이 **옛 표식 때문에 조용히 건너뛰어진다** — 실제로 당했다.
//     ② 표식 없는 옛 out 이 남아 있으면 **다른 회차의 문항이 이번 적재에 섞인다.**
//   해설 드레인이 같은 계열의 사고를 겪고 표식을 넣었는데(그쪽 `.gitignore` 주석 참조),
//   표식만으로는 「같은 번호 · 다른 내용」을 못 막는다. 회차를 새로 열면 **한 벌을 치운다.**
//
// ⚠️ 치운 수를 찍는다 — 조용히 지우면 채워 놓고 안 넣은 몫이 사라진 것을 아무도 모른다.
let cleared = 0
let clearedUnimported = 0
for (const f of fs.readdirSync(DIR)) {
  if (!/^chunk-\d+\.(json|out\.json|out\.json\.imported)$/.test(f)) continue
  if (/^chunk-\d+\.out\.json$/.test(f) && !fs.existsSync(path.join(DIR, `${f}.imported`))) {
    clearedUnimported += 1
  }
  fs.unlinkSync(path.join(DIR, f))
  cleared += 1
}

const chunks = []
for (let i = 0; i < tasks.length; i += SIZE) {
  const n = String(chunks.length).padStart(2, '0')
  const file = path.join(DIR, `chunk-${n}.json`)
  fs.writeFileSync(file, JSON.stringify(tasks.slice(i, i + SIZE), null, 1), 'utf8')
  chunks.push(file)
}

console.log(`V${BAND}(${SERIES}) — 실릴 문항 ${printed.length} (단원 ${VOLUME_UNITS})`)
if (cleared) {
  console.log(
    `  앞 회차 청크 치움              ${cleared}개` +
      (clearedUnimported ? `  ⚠️ 그중 **적재 안 된 채운 청크 ${clearedUnimported}개**` : ''),
  )
}
console.log(`  이미 3인이 통과시킴            ${already}`)
console.log(`  3인이 봤는데 미통과            ${toFix}${toFix ? '  ← 재검수가 아니라 고칠 몫' : ''}`)
// 낡거나 판을 모르는 판정을 안 세어 **다시 열린** 문항. 조용히 늘면 안 되므로 늘 찍는다.
console.log(
  `  판이 달라 다시 연 문항          ${reopened.size}${reopened.size ? '  ← 그 판정은 지금 문항에 대한 것이 아니다' : ''}`,
)
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
