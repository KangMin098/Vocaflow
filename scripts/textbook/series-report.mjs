// scripts/textbook/series-report.mjs
//
// **시리즈 사다리를 재고에 대 본다.**
//
// 브랜드는 이름이 아니라 **채울 수 있는 계단**이다. 시장의 독해 브랜드가 전 학령을 잇는
// 이유가 그것이다 — 계단 하나가 비면 학습자는 그 학년에서 다른 출판사로 갈아탄다.
//
// ⚠️ 초등 3종(파닉스 운율·기본어휘 뜻·철자 완성)은 **DB 에 없다** — 사전의 순수 함수라
//   저장하지 않는다(`elementary.ts`). 그래서 여기서 **그 자리에서 생성해 세어** 넣는다.
//   안 그러면 초등 계단이 거짓으로 비어 보인다.
//
// 재실행 안전: 읽기만 한다.
// 실행: pnpm dlx tsx scripts/textbook/series-report.mjs

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { createClient } = await import('@supabase/supabase-js')
const {
  SERIES_SPINE,
  SERIES_TYPE_LABEL_KO,
  measureSeriesFill,
  buildRhyme,
  buildWordMeaning,
  buildSpellBlank,
} = await import('@vocaflow/library-pipeline')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── 저장된 문항 (유형 × 레벨) ───────────────────────────────────────
// ⚠️ **행을 받아서 세면 안 된다** (실측 2026-09-06). 예전에는 `csat_dcp_items` 전체를
//   1,000행씩 OFFSET 으로 넘기며 셌다. 지금 그 표는 **656,988행**이라 657페이지이고,
//   OFFSET 은 뒤로 갈수록 앞을 다시 훑으므로 statement timeout 으로 **아예 못 돌았다** —
//   시리즈 전체 상태를 보는 유일한 자가 몇 주째 죽어 있었다.
//
//   세는 데는 행이 필요 없다. **(유형 × 레벨) 조합마다 count 한 번**이면 되고,
//   그 조합은 `idx_dcp_items_vlevel_type (v_level, type)` 가 그대로 받아 준다.
//   유형 목록도 짐작하지 않는다 — 인덱스를 훑어 실제로 있는 값만 찾는다(skip scan 흉내).
const stored = new Map()
{
  /** 그 열에 실제로 있는 값들. 하나씩 받아 `> 직전 값` 으로 이어 묻는다. */
  const distinct = async (column) => {
    const out = []
    let last = null
    for (let i = 0; ; i += 1) {
      if (i > 200) throw new Error(`${column}: 서로 다른 값이 200개를 넘는다 — 세는 열이 맞는가?`)
      let q = db.from('csat_dcp_items').select(column).order(column).limit(1)
      if (last !== null) q = q.gt(column, last)
      const { data, error } = await q
      if (error) throw new Error(`${column} 값 훑기 실패: ` + (error.message || '(빈 message)'))
      if (!data?.length) break
      last = data[0][column]
      out.push(last)
    }
    return out
  }
  const types = await distinct('type')
  const levels = await distinct('v_level')
  for (const t of types) {
    for (const v of levels) {
      const { count, error } = await db
        .from('csat_dcp_items')
        .select('id', { count: 'exact', head: true })
        .eq('type', t)
        .eq('v_level', v)
      if (error) throw new Error('문항 조회 실패: ' + (error.message || '(빈 message)'))
      if (count) stored.set(`${t}|${v}`, count)
    }
  }
}

// ── 초등 3종은 사전에서 그 자리에서 만든다 ──────────────────────────
const allWords = new Set()
const byBand = new Map()
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('shared_dictionary')
    .select('word, meaning_ko, rhyme_key, synonyms, v_level')
    .order('word')
    .range(from, from + 999)
  if (error) throw new Error('사전 조회 실패: ' + error.message)
  if (!data?.length) break
  for (const r of data) {
    const w = String(r.word).toLowerCase()
    allWords.add(w)
    if (r.v_level == null || !/^[a-z]{2,12}$/.test(w) || !r.meaning_ko) continue
    const arr = byBand.get(r.v_level) ?? []
    arr.push({
      word: w,
      meaningKo: String(r.meaning_ko),
      rhymeKey: r.rhyme_key || null,
      synonyms: r.synonyms ?? [],
    })
    byBand.set(r.v_level, arr)
  }
  if (data.length < 1000) break
}

const inventory = [...stored.entries()].map(([k, count]) => {
  const [type, v] = k.split('|')
  return { type, vLevel: v === 'null' ? null : Number(v), count }
})

// 초등 3종 — 시리즈가 쓰는 밴드에서만 센다(전 밴드를 세면 리포트가 길어지기만 한다).
const elementaryBands = new Set(SERIES_SPINE.flatMap((r) => (r.step <= 3 ? r.vLevels : [])))
for (const v of elementaryBands) {
  const pool = byBand.get(v) ?? []
  let rhyme = 0
  let meaning = 0
  let spell = 0
  for (const p of pool) {
    if (buildRhyme(p, pool)) rhyme++
    if (buildWordMeaning(p, pool)) meaning++
    if (buildSpellBlank(p, allWords)) spell++
  }
  inventory.push({ type: 'rhyme', vLevel: v, count: rhyme })
  inventory.push({ type: 'word_meaning', vLevel: v, count: meaning })
  inventory.push({ type: 'spell_blank', vLevel: v, count: spell })
}

const fill = measureSeriesFill(inventory)

const line = '─'.repeat(78)
console.log(`${line}\n${fill.brand} — 학령 사다리 ${fill.rungs.length}단\n`)

// 이름표는 `series.ts` 가 정본이다. 여기 따로 두었더니 유형을 늘렸을 때
// 아무 에러 없이 `undefined 291` 이 찍혔다(2026-08-22). 저쪽은 타입이 걸려 있어 빠뜨릴 수 없다.
const TYPE_KO = SERIES_TYPE_LABEL_KO

for (const r of fill.rungs) {
  const mark = r.total === 0 ? '❌ 끊김' : r.emptyTypes.length ? '⚠️ 반쪽' : '✅'
  console.log(
    `  ${mark}  ${String(r.rung.step).padStart(2)}단  V${r.rung.vLevels.join(',')}  ` +
      `${r.rung.schoolBand.padEnd(14)} ${r.rung.volumeTitle.padEnd(26)} 문항 ${String(r.total).padStart(5)}`,
  )
  console.log(
    '        ' +
      r.rung.types
        .map((t) => `${TYPE_KO[t]} ${r.byType[t]}`)
        .join(' · '),
  )
  if (r.emptyTypes.length) {
    console.log(`        ⚠️ 재고 0: ${r.emptyTypes.map((t) => TYPE_KO[t]).join(' · ')}`)
  }
  console.log()
}

console.log(line)
if (fill.brokenSteps.length) {
  console.log(`\n  ❌ **사다리가 끊긴 계단: ${fill.brokenSteps.join(', ')}단**`)
  console.log('     그 학년 학습자는 우리 시리즈로 들어올 수도, 이어 갈 수도 없다.')
} else {
  console.log('\n  ✅ 모든 계단에 문항이 있다.')
}

const halves = fill.rungs.filter((r) => r.total > 0 && r.emptyTypes.length)
if (halves.length) {
  console.log(`\n  ⚠️ 반쪽인 계단 ${halves.length}개 — 쓰기로 한 유형 중 재고가 0인 것이 있다`)
  for (const h of halves) {
    console.log(`       ${h.rung.step}단 ${h.rung.volumeTitle}: ${h.emptyTypes.map((t) => TYPE_KO[t]).join(' · ')}`)
  }
}

// 재고가 어디 몰려 있는지 — 사다리의 무게중심.
const totals = fill.rungs.map((r) => r.total)
const sum = totals.reduce((s, n) => s + n, 0)
console.log(`\n  무게중심 — 계단별 비중`)
console.log(
  '     ' +
    fill.rungs
      .map((r) => `${r.rung.step}단 ${sum ? ((100 * r.total) / sum).toFixed(0) : 0}%`)
      .join(' · '),
)
