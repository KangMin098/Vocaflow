// scripts/textbook/type-inventory-scan.mjs
//
// **시중 교재가 내는 유형을 우리가 낼 수 있는가 — 학년 × 유형 재고.**
//
// ── 왜 이 스캔이 따로 필요한가 ───────────────────────────────────────
// 원문 적격은 「이 글을 써도 되는가」를 묻는다. 그 질문을 다 통과해도 **교재가 시중을
// 못 따라갈 수 있다** — 낼 수 있는 **유형**이 다르면 그렇다.
//
// 조판 로그가 오래 이렇게 말하고 있었다:
//
//   시장 유형 적합도 99.4% (가진 유형 안에서) · **시장 전체 기준 30.1%**
//   — 재고 0 인 유형 14종
//
// 「가진 유형 안에서」는 99% 인데 「시장 전체」로는 30% 다. 실측 2026-09-07 로 이유가 나왔다:
//
//   시장 목표 14%(V5~7 1위)인 `blank`      →  우리 재고 **236개**
//   시장 목표  8~24% 인 `title`            →  **185개**
//   시장 목표  6~16% 인 `topic`            →  **206개**
//   시장 목표  1% 인 `blank_word`          →  **219,810개**
//
// **시장이 가장 많이 요구하는 유형이 우리에겐 없고, 22만 개 쌓아 둔 유형은 시장 비중이 1%다.**
// 원문을 아무리 늘려도 이 격차는 안 줄어든다 — 다른 문제이기 때문이다.
//
// ── 무엇을 재는가 ────────────────────────────────────────────────────
// 학년(`article_v_level`) × 유형(`csat_dcp_items.type`) 으로 문항과 원글을 세고,
// 그 학년의 **시장 목표 비중**(`rungMix` — 시중 79종 실측에서 유도한 정본)과 나란히 둔다.
// 목표가 있는데 재고가 0인 유형이 곧 **지금 못 만드는 문제 유형**이다.
//
// ⚠️ 목표 비중을 여기서 새로 정하지 않는다 — `rungMix` 하나가 정본이다. 두 벌이 되면
//   화면과 조판이 다른 말을 하는 날이 온다(이 저장소가 어수 창에서 이미 겪었다).
//
// 재실행 안전: **읽기만 한다.** 몇 번 돌려도 DB 가 바뀌지 않는다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/type-inventory-scan.mjs             # 스캔 + 스냅샷 갱신
//   pnpm dlx tsx scripts/textbook/type-inventory-scan.mjs --no-write  # 터미널에만

import fs from 'node:fs'
import path from 'node:path'

const { rungMix, ITEMS_PER_UNIT } = await import(
  '../../packages/library-pipeline/src/textbook/rung-mix.ts'
)

/**
 * 한 권의 크기 — **정본은 조판기의 기본값**이다(`build-volume.mjs` 의 `--units` 기본 20).
 * 시중 9종 실측 중앙값이 10단원이고 우리는 20단원을 낸다.
 */
const UNITS_PER_VOLUME = 20
const ITEMS_PER_VOLUME = UNITS_PER_VOLUME * ITEMS_PER_UNIT

function loadEnv(file = 'apps/web/.env.local') {
  for (const line of fs.readFileSync(path.resolve(file), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnv()
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_BASE || !KEY) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없다')
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}` }

const SNAPSHOT = path.resolve('apps/web/src/lib/textbook/type-inventory-snapshot.json')
const NO_WRITE = process.argv.includes('--no-write')

const num = (n) => n.toLocaleString()
const pad = (s, w) => String(s).padEnd(w)

async function get(pathAndQuery, label) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const r = await fetch(`${URL_BASE}/rest/v1/${pathAndQuery}`, { headers: HEADERS })
      if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 140)}`)
      return await r.json()
    } catch (e) {
      if (attempt === 5) throw new Error(`${label} — ${e.message}`)
      await new Promise((res) => setTimeout(res, 1500 * attempt))
    }
  }
}

/**
 * 원글 → 학년. **본문을 안 받는다** — 두 열만 받으면 91,000행도 가볍다.
 *
 * ⚠️ 조판 풀(`ready`·`published`)만 세면 「문항은 있는데 원글이 빠진」 유형이 안 보인다.
 *   재고를 재는 자리이므로 **전량**을 받고, 조판 가능 여부는 적격 판정이 따로 말한다.
 */
async function loadBands() {
  const band = new Map()
  let cursor = '00000000-0000-0000-0000-000000000000'
  let pages = 0
  for (;;) {
    const rows = await get(
      `library_articles?select=id,article_v_level&id=gt.${cursor}&order=id.asc&limit=1000`,
      '학년 조회',
    )
    if (!rows.length) break
    for (const r of rows) band.set(r.id, r.article_v_level ?? null)
    cursor = rows[rows.length - 1].id
    pages += 1
    if (pages % 25 === 0) process.stderr.write(`  학년 ${num(band.size)}편\r`)
    if (rows.length < 1000) break
  }
  process.stderr.write(`  학년 ${num(band.size)}편 (${pages}쪽)\n`)
  return band
}

/** 문항을 학년 × 유형으로 센다. `ref_id` 커서 — 인덱스를 그대로 탄다. */
async function tallyItems(band) {
  /** `V${band}|${type}` → { items, refs:Set } */
  const cell = new Map()
  let cursor = null
  let pages = 0
  let items = 0
  let orphan = 0
  for (;;) {
    const qs =
      `csat_dcp_items?kind=eq.article&select=ref_id,type&order=ref_id.asc,type.asc&limit=1000` +
      (cursor ? `&ref_id=gt.${cursor}` : '')
    const rows = await get(qs, '문항 조회')
    if (!rows.length) break
    for (const r of rows) {
      items += 1
      const v = band.get(r.ref_id)
      if (v === undefined) orphan += 1
      const key = `${v ?? 'none'}|${r.type}`
      if (!cell.has(key)) cell.set(key, { items: 0, refs: new Set() })
      const c = cell.get(key)
      c.items += 1
      c.refs.add(r.ref_id)
    }
    // ⚠️ 마지막 `ref_id` 를 그대로 커서로 쓴다 — 그 id 의 남은 행은 건너뛰지만 이미 셌다.
    //   한 원글의 문항이 1,000행을 넘으면 진전이 없으므로 무한 루프를 막는다.
    const last = rows[rows.length - 1].ref_id
    if (last === cursor) break
    cursor = last
    pages += 1
    if (pages % 50 === 0) process.stderr.write(`  문항 ${num(items)}\r`)
    if (rows.length < 1000) break
  }
  process.stderr.write(`  문항 ${num(items)} (${pages}쪽)\n`)
  return { cell, items, orphan }
}

/**
 * **초등 세 유형은 저장되지 않는다 — 조판할 때 사전에서 즉석 생성된다.**
 *
 * ⚠️ 실측 2026-09-08: 이 스캔이 `csat_dcp_items` 만 세어 V1 을 **0권**이라 말하고 있었다.
 *   그런데 `rhyme`·`word_meaning`·`spell_blank` 는 `volume-pool.mjs` 가 조판 시점에
 *   `shared_dictionary` 에서 만든다. 실제 수율은 초등 어휘 806개 기준 운율 470(58.3%) ·
 *   뜻 805(99.9%) · 철자 528(65.5%) — **권당 40개씩이면 11권**이다.
 *   **틀린 감시 지표는 감시가 없는 것보다 나쁘다** — 없으면 모른다는 걸 알지만, 틀리면
 *   안다고 착각한다. V1 을 「못 만든다」고 읽고 없는 일을 시킬 뻔했다.
 *
 * 그래서 여기서도 **같은 빌더로** 센다. 별표 표(`ELEMENTARY_TAG`)는 조판기에서 가져온다 —
 * 사본을 두면 두 벌이 갈린다.
 */
async function tallyElementary(cell) {
  const { ELEMENTARY_TAG } = await import('./volume-pool.mjs')
  const { buildRhyme, buildWordMeaning, buildSpellBlank } = await import('@vocaflow/library-pipeline')
  const byTag = new Map()
  for (const [bandStr, tag] of Object.entries(ELEMENTARY_TAG)) {
    if (!byTag.has(tag)) {
      const rows = []
      let cursor = ''
      for (;;) {
        const page = await get(
          `shared_dictionary?select=word,meaning_ko,rhyme_key,synonyms` +
            `&list_tags=cs.{${tag}}&word=gt.${encodeURIComponent(cursor)}&order=word.asc&limit=1000`,
          `초등 어휘(${tag})`,
        )
        if (!page.length) break
        rows.push(...page)
        cursor = page[page.length - 1].word
        if (page.length < 1000) break
      }
      const pool = rows
        .map((r) => ({
          word: String(r.word).toLowerCase(),
          meaningKo: String(r.meaning_ko ?? ''),
          rhymeKey: r.rhyme_key || null,
          synonyms: r.synonyms ?? [],
        }))
        .filter((x) => /^[a-z]{2,12}$/.test(x.word) && x.meaningKo)
      byTag.set(tag, { pool, dictionary: new Set(pool.map((x) => x.word)) })
    }
    const { pool, dictionary } = byTag.get(tag)
    const built = { rhyme: 0, word_meaning: 0, spell_blank: 0 }
    for (const w of pool) {
      if (buildRhyme(w, pool)) built.rhyme += 1
      if (buildWordMeaning(w, pool)) built.word_meaning += 1
      if (buildSpellBlank(w, dictionary)) built.spell_blank += 1
    }
    for (const [type, n] of Object.entries(built)) {
      // 즉석 생성이라 원글이 없다 — 재료가 낱말이므로 `refs` 는 낱말 수로 센다.
      cell.set(`${bandStr}|${type}`, { items: n, refs: new Set(pool.map((x) => x.word)) })
    }
    process.stderr.write(
      `  초등 V${bandStr} (${tag}) 운율 ${num(built.rhyme)} · 뜻 ${num(built.word_meaning)} · 철자 ${num(built.spell_blank)}\n`,
    )
  }
}

const started = Date.now()
const band = await loadBands()
const { cell, items, orphan } = await tallyItems(band)
await tallyElementary(cell)
const elapsed = ((Date.now() - started) / 1000).toFixed(1)

/** 학년 사다리 — `rungMix` 가 목표를 갖는 밴드만 본다. */
const BANDS = [1, 2, 3, 4, 5, 6, 7]

const bands = BANDS.map((v) => {
  const target = rungMix(v).targetShare
  // ⚠️ **「재고가 있다」로 세면 안 된다.** 처음엔 목표 유형 중 재고 0 이 아닌 것의 비중을
  //   더해 「덮는 몫」이라 불렀는데, 유형당 26개만 있어도 100% 로 찍혔다. 한 권이 120문항이고
  //   `blank` 목표가 14% 면 **권당 17개**가 필요하다 — 재고 28개는 한 권 쓰면 바닥이다.
  //   그래서 재는 것은 **「이 유형으로 몇 권까지 갈 수 있는가」** 다.
  const types = Object.entries(target)
    .map(([type, share]) => {
      const c = cell.get(`${v}|${type}`)
      const count = c?.items ?? 0
      const needPerVolume = Math.max(1, Math.round(ITEMS_PER_VOLUME * share))
      return {
        type,
        targetShare: +(share * 100).toFixed(1),
        items: count,
        articles: c?.refs.size ?? 0,
        needPerVolume,
        volumes: Math.floor(count / needPerVolume),
      }
    })
    .sort((a, b) => b.targetShare - a.targetShare)

  // **한 권은 가장 얇은 유형이 정한다.** 나머지가 아무리 많아도 그 유형이 바닥나면 멈춘다.
  const binding = types.reduce(
    (worst, t) => (worst == null || t.volumes < worst.volumes ? t : worst),
    /** @type {null | (typeof types)[number]} */ (null),
  )
  return {
    vLevel: v,
    types,
    missingTypes: types.filter((t) => t.items === 0).map((t) => t.type),
    missingShare: +types
      .filter((t) => t.items === 0)
      .reduce((n, t) => n + t.targetShare, 0)
      .toFixed(1),
    /** 시중 구성 그대로 낼 수 있는 권수 — **가장 얇은 유형**이 정한다. */
    volumes: binding ? binding.volumes : 0,
    bindingType: binding ? binding.type : null,
    totalItems: types.reduce((n, t) => n + t.items, 0),
  }
})

console.log(`\n학년 × 유형 재고 — 문항 ${num(items)} · ${elapsed}초\n`)
console.log(`  ${pad('V', 4)}${pad('만들 수 있는 권수', 20)}${pad('가장 얇은 유형', 30)}재고 0 유형`)
console.log(`  ${'─'.repeat(96)}`)
for (const b of bands) {
  const t0 = b.types.find((t) => t.type === b.bindingType)
  const detail = t0 ? `${b.bindingType} (${num(t0.items)} / 권당 ${t0.needPerVolume})` : '—'
  console.log(
    `  ${pad(`V${b.vLevel}`, 4)}${pad(`${b.volumes}권`, 20)}${pad(detail, 30)}` +
      `${b.missingTypes.length}종 ${b.missingTypes.slice(0, 5).join(', ')}`,
  )
}

console.log('\n  가장 크게 비어 있는 자리 (목표는 큰데 재고가 없거나 얇다)')
const holes = []
for (const b of bands) {
  for (const t of b.types) {
    if (t.targetShare >= 5 && t.items < 500) holes.push({ v: b.vLevel, ...t })
  }
}
holes.sort((a, b) => b.targetShare - a.targetShare)
for (const h of holes.slice(0, 12)) {
  console.log(`    V${h.v} ${pad(h.type, 16)} 목표 ${pad(`${h.targetShare}%`, 7)} 재고 ${num(h.items)}`)
}
if (orphan) console.log(`\n  ⚠ 원글을 못 찾은 문항 ${num(orphan)}개 — 삭제된 원글의 잔재로 보인다`)

if (!NO_WRITE) {
  const snapshot = {
    measuredAt: new Date().toISOString(),
    elapsedSeconds: Number(elapsed),
    totalItems: items,
    orphanItems: orphan,
    bands,
  }
  fs.writeFileSync(SNAPSHOT, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(`\n  → ${SNAPSHOT}`)
}

console.log('\n  이 스캔은 문항을 만들지 않는다 — 무엇이 비었는지만 센다.')
