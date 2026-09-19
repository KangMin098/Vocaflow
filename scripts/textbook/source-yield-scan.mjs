// scripts/textbook/source-yield-scan.mjs
//
// **원천 한 곳이 실제로 지문이 되는 비율 — 「원문 선택의 기준」의 바닥.**
//
// ── 왜 이 계기가 필요한가 (실측 2026-09-13) ─────────────────────────
// 집필 배치 다섯이 독립으로 같은 것을 보고했다. 같은 밴드·같은 규격인데 **원천이 다르면
// 생존율이 스무 배 갈린다**:
//
//   `topic-v7` · `blank-v7`   PLOS / Europe PMC 초록   게이트 통과 **2/36 (5.6%)**
//   `title-v7`                Europe PMC 초록          게이트 통과 **10/24 (41.7%)**
//   `implication-v7`          Gutenberg 고전 산문      게이트 통과 **16/16 (100%)**
//   `content_match-v6`        Gutenberg 고전 산문      게이트 통과 **40/40 (100%)**
//
// 사인도 하나로 모인다 — **논문 서식**(`Citation:` · `Funding:` · `Objective To …` ·
// `95% CI`)과 **어수 상한 초과**(학술 초록은 190어 언저리에 몰려 있고 V7 상한은 178어)다.
//
// 즉 재고를 「편수」로만 세면 **없는 공급을 있다고 세게 된다.** 9만 편이 있어도 그 원천이
// 학술 초록이면 상위 밴드 독해 문항으로는 스무 편 중 한 편만 선다. 어느 원천을 더 수확할지,
// 어느 밴드에 어느 원천을 붙일지가 여기서 갈린다 — 그것이 「원문 선택의 기준」이다.
//
// ── 무엇을 재는가 ────────────────────────────────────────────────────
// 원천 × 학년으로 표본을 뽑아, **뽑기(`item-drain-export.mjs`)와 같은 함수**로 지문을
// 만들어 본다: `buildPassage`(정제 → 문장 쪼개기 → 창 선택) 뒤 `isPrintablePassage` 로 거른다.
// 통과하면 그 글은 문항이 될 수 있고, 못 하면 재고에 있어도 지면에는 못 온다.
//
// ⚠️ **같은 함수여야 한다 — 「같은 자」라고 적는 것으로는 부족하다.** 2026-09-15 에 뽑기에
//   정제기를 넣었더니 이 표가 **1도 안 움직였다.** 여기가 지문 만드는 과정을 제 손으로
//   다시 구현하고 있었기 때문이다(주석에는 이미 「같은 자」라고 적혀 있었다).
//
// ⚠️ **표본이다.** 밴드 하나가 3만 편을 넘고 본문이 1.3GB 라 전수는 못 잰다. 원천×학년
//   칸마다 최대 `--per`(기본 40)편을 보고, **표본 수를 반드시 함께 찍는다** — 5편 본 칸의
//   80% 와 40편 본 칸의 80% 는 같은 말이 아니다.
// ⚠️ 규격을 여기서 새로 정하지 않는다 — `itemWordSpec` · `isPrintablePassage` 한 벌을
//   그대로 부른다. 사본을 두면 이 표가 뽑기와 다른 말을 하는 날이 온다.
//
// 재실행 안전: **읽기만 한다.** DB 를 바꾸지 않는다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/source-yield-scan.mjs
//   pnpm dlx tsx scripts/textbook/source-yield-scan.mjs --per 60 --type topic
//   pnpm dlx tsx scripts/textbook/source-yield-scan.mjs --no-write

import fs from 'node:fs'
import path from 'node:path'

import { loadEnv, fetchAllIn, fetchAllKeyset, isRetractedTitle, isLegallyUsable } from './volume-pool.mjs'

loadEnv()
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
/** 칸마다 볼 표본 수. 올리면 정확해지고 느려진다. */
const PER = Number(arg('per') ?? 40)
/**
 * 어느 유형의 창으로 재는가. 기본 `topic` — 짧은 독해 유형의 대표다.
 * 유형마다 창이 달라 한 표로 전부를 답할 수는 없다. 이 표는 **대표 유형 하나**를 말한다.
 */
const TYPE = arg('type') ?? 'topic'
const NO_WRITE = process.argv.includes('--no-write')
const OUT = path.resolve('apps/web/src/lib/textbook/source-yield-snapshot.json')

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
// ⚠️ **지문 만드는 과정을 여기서 다시 구현하지 않는다.** 예전엔 문장 쪼개기·창 선택을
//   손으로 갖고 있었고, 그래서 뽑기에 정제기를 넣은 날 이 표가 **1도 안 움직였다**
//   (실측 2026-09-15 — 주석에는 「뽑기와 같은 자」라고 적혀 있었다). `buildPassage` 한 벌.
const {
  itemWordSpec,
  buildPassage,
  isPrintablePassage,
  hasArticleChrome,
  hasAcademicApparatus,
  hasSensitiveTopic,
} = await import('@vocaflow/library-pipeline')

const num = (n) => n.toLocaleString()

// ── 모수 ──────────────────────────────────────────────────────────
// ⚠️ **본문을 여기서 받지 않는다.** 밴드 전체의 `content` 를 끌면 1.3GB 다 —
//   가벼운 열만 받아 칸을 나누고, 표본으로 뽑힌 것만 본문을 받는다.
process.stderr.write('  원글 목록 받는 중…\n')
const arts = await fetchAllKeyset(
  db,
  'library_articles',
  'id, title, source, article_v_level, display_only, license_class, copyright_safe_in_kr',
  'id',
  1000,
  (q) => q.in('status', ['ready', 'published']),
)
process.stderr.write(`  원글 ${num(arts.length)}편\n`)

/** 조판이 절대 못 쓰는 것은 모수에서 뺀다 — 원천 판정이 그것 때문에 흐려지면 안 된다. */
const usable = arts.filter(
  (a) => isLegallyUsable(a) && !isRetractedTitle(a.title) && !hasSensitiveTopic(String(a.title ?? '')),
)

/** `source|band` → 원글 배열 */
const cells = new Map()
for (const a of usable) {
  const band = a.article_v_level
  if (band == null) continue
  const key = `${a.source ?? '(없음)'}|${band}`
  if (!cells.has(key)) cells.set(key, [])
  cells.get(key).push(a)
}

/**
 * 표본은 **결정론으로** 고른다 — 같은 재고면 같은 표본이라야 어제 값과 비교할 수 있다.
 * 무작위로 뽑으면 수치가 흔들리는 것이 재고 변화인지 표본 변화인지 알 수 없다.
 */
function sample(list, n) {
  if (list.length <= n) return list
  const step = list.length / n
  const out = []
  for (let i = 0; i < n; i += 1) out.push(list[Math.floor(i * step)])
  return out
}

const wanted = []
for (const [key, list] of cells) for (const a of sample(list, PER)) wanted.push([key, a])
process.stderr.write(`  칸 ${num(cells.size)} · 표본 ${num(wanted.length)}편 본문 조회 중…\n`)

const bodies = new Map()
const ids = wanted.map(([, a]) => a.id)
for (let i = 0; i < ids.length; i += 200) {
  const rows = await fetchAllIn(db, 'library_articles', 'id, content', 'id', ids.slice(i, i + 200), ['id'])
  for (const r of rows) bodies.set(r.id, String(r.content ?? ''))
  process.stderr.write(`  본문 ${num(bodies.size)}/${num(ids.length)}\r`)
}
process.stderr.write(`  본문 ${num(bodies.size)}편\n`)

/** 이 글이 지문이 되는가 — **뽑기와 같은 자**를 쓴다. */
const MIN_SENTENCES = 5
function verdict(a) {
  const body = bodies.get(a.id) ?? ''
  if (!body.trim()) return 'body_none'
  const text = buildPassage(body, itemWordSpec(TYPE, a.article_v_level), MIN_SENTENCES)
  // 창을 못 만든다 = 어수가 규격 밖이거나 문장이 모자라다.
  if (!text) return 'no_window'
  if (isPrintablePassage(text)) return 'ok'
  // 왜 인쇄할 수 없는지 갈라 적는다 — 처방이 다르다(수확기 수정 vs 원천 교체).
  if (hasAcademicApparatus(text)) return 'apparatus'
  if (hasArticleChrome(text)) return 'chrome'
  return 'other'
}

const rows = []
for (const [key, list] of cells) {
  const [source, bandStr] = key.split('|')
  const picked = sample(list, PER)
  const tally = { ok: 0, no_window: 0, apparatus: 0, chrome: 0, other: 0, body_none: 0 }
  for (const a of picked) tally[verdict(a)] += 1
  rows.push({
    source,
    vLevel: Number(bandStr),
    /** 그 칸의 재고 전량 — 표본이 아니라 실제 편수다. */
    articles: list.length,
    sampled: picked.length,
    ok: tally.ok,
    yieldPct: +((tally.ok / picked.length) * 100).toFixed(1),
    /** 재고 × 통과율 — **실제로 쓸 수 있는 편수의 추정**이다. 편수만 보면 과대평가한다. */
    usableEstimate: Math.round(list.length * (tally.ok / picked.length)),
    reasons: tally,
  })
}
rows.sort((a, b) => b.usableEstimate - a.usableEstimate)

const pad = (s, w) => String(s).padEnd(w)
console.log(`\n원천 × 학년 지문 생존율 — 유형 \`${TYPE}\` 창 기준 · 칸당 표본 ${PER}\n`)
console.log(
  `  ${pad('원천', 18)}${pad('V', 4)}${'재고'.padStart(8)}${'표본'.padStart(6)}${'통과'.padStart(6)}` +
    `${'통과율'.padStart(8)}${'쓸 수 있는 편수'.padStart(16)}  주된 사인`,
)
console.log(`  ${'─'.repeat(98)}`)
for (const r of rows) {
  const worst = Object.entries(r.reasons)
    .filter(([k]) => k !== 'ok')
    .sort((a, b) => b[1] - a[1])[0]
  const why = worst && worst[1] > 0 ? `${worst[0]} ${worst[1]}` : '—'
  console.log(
    `  ${pad(r.source, 18)}${pad('V' + r.vLevel, 4)}${num(r.articles).padStart(8)}${String(r.sampled).padStart(6)}` +
      `${String(r.ok).padStart(6)}${`${r.yieldPct}%`.padStart(8)}${num(r.usableEstimate).padStart(16)}  ${why}`,
  )
}

const totalStock = rows.reduce((n, r) => n + r.articles, 0)
const totalUsable = rows.reduce((n, r) => n + r.usableEstimate, 0)
console.log(
  `\n  재고 ${num(totalStock)}편 · **지문이 되는 것 약 ${num(totalUsable)}편** ` +
    `(${((totalUsable / totalStock) * 100).toFixed(1)}%)`,
)
console.log('  편수만 세면 이 격차가 안 보인다 — 어느 원천을 더 수확할지가 여기서 갈린다.')

if (!NO_WRITE) {
  fs.writeFileSync(
    OUT,
    `${JSON.stringify(
      { measuredAt: new Date().toISOString(), type: TYPE, perCell: PER, totalStock, totalUsable, rows },
      null,
      2,
    )}\n`,
  )
  console.log(`\n  → ${OUT}`)
}
console.log('\n  이 스캔은 아무것도 고치지 않는다 — 어느 원천이 지면에 닿는지만 센다.')
