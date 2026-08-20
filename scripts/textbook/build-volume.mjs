// scripts/textbook/build-volume.mjs
//
// **독해 교재 한 권을 실제 재료로 조합한다.** 문항 자체가 지문이다(수능 순서·삽입 구조).
//
// 조합 규칙은 라이브러리(`textbook/compose-unit.ts`)에 있고 여기서는 재료만 모은다.
// 규칙과 수집을 나눈 이유는 규칙을 회귀로 못 박기 위해서다.
//
// 재실행 안전: 읽기만 한다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/build-volume.mjs --band 6
//   pnpm dlx tsx scripts/textbook/build-volume.mjs --band 6 --units 20 --show 1

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const BAND = Number(arg('band') ?? 6)
const UNITS = Number(arg('units') ?? 20)
const SHOW = Number(arg('show') ?? 0)

const { createClient } = await import('@supabase/supabase-js')
const { composeUnits } = await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const { data: cat } = await db
  .from('csat_stage_catalog')
  .select('id, title, v_level, display_only')
  .eq('v_level', BAND)
  .eq('display_only', false)
const titleById = new Map((cat ?? []).map((c) => [c.id, c.title ?? '(제목 없음)']))
const ids = [...titleById.keys()]
if (!ids.length) {
  console.log(`V${BAND} 에 쓸 수 있는 글이 없다.`)
  process.exit(0)
}

// 문항 — 1,000행 제한을 피해 나눠 받는다(이 저장소에서 이미 한 번 조용히 잘렸다).
const items = []
for (let i = 0; i < ids.length; i += 10) {
  const { data } = await db
    .from('csat_dcp_items')
    .select('id, type, ref_id, payload, answer_key')
    .in('ref_id', ids.slice(i, i + 10))
    .limit(20000)
  items.push(...(data ?? []))
}

/** 문항이 품은 지문의 낱말 수. order 는 presented, insert 는 remaining 이 지문이다. */
const passageWords = (it) => {
  const arr = it.type === 'order' ? it.payload?.presented : it.payload?.remaining
  if (!Array.isArray(arr)) return 0
  return arr.join(' ').split(/\s+/).filter(Boolean).length
}

const pool = items.map((it) => ({
  id: it.id,
  type: it.type,
  ref_id: it.ref_id,
  ref_title: titleById.get(it.ref_id) ?? '(제목 없음)',
  v_level: BAND,
  passage_words: passageWords(it),
  payload: it.payload ?? {},
  answer_key: it.answer_key ?? {},
}))

// 어휘 — 지문별로 나눠 받는다.
const vocabRows = []
for (let i = 0; i < ids.length; i += 5) {
  const { data } = await db
    .from('library_article_vocabularies')
    .select('library_article_id, word, first_sentence, frequency_in_article')
    .in('library_article_id', ids.slice(i, i + 5))
    .limit(20000)
  vocabRows.push(...(data ?? []))
}
const words = [...new Set(vocabRows.map((v) => v.word))]
const dict = new Map()
for (let i = 0; i < words.length; i += 500) {
  const { data } = await db
    .from('shared_dictionary')
    .select('word, meaning_ko, v_level')
    .in('word', words.slice(i, i + 500))
  for (const r of data ?? []) dict.set(r.word, r)
}
const vocabByRef = new Map()
for (const v of vocabRows) {
  const d = dict.get(v.word)
  if (!vocabByRef.has(v.library_article_id)) vocabByRef.set(v.library_article_id, [])
  vocabByRef.get(v.library_article_id).push({
    word: v.word,
    meaning_ko: d?.meaning_ko ?? null,
    v_level: d?.v_level ?? null,
    first_sentence: v.first_sentence ?? null,
    frequency_in_article: v.frequency_in_article ?? 0,
  })
}

const { units, stoppedBecause, rejected } = composeUnits(pool, vocabByRef, {
  band: BAND,
  unitCount: UNITS,
})

console.log(`V${BAND} — 원글 ${ids.length}편 · 문항 풀 ${pool.length}`)
console.log(`규격 밖으로 거른 문항: 짧음 ${rejected.tooShort} · 김 ${rejected.tooLong}`)
console.log(`\n**조합된 단원 ${units.length} / 목표 ${UNITS}**`)
if (stoppedBecause) console.log(`  ${stoppedBecause}`)

if (units.length) {
  console.log(`\n${['#', '분', '순서', '삽입', '어휘', '출처(글 4편)'].join('  ')}`)
  for (const u of units) {
    console.log(
      [
        String(u.no).padStart(2),
        String(u.estimated_minutes).padStart(3),
        String(u.items.filter((i) => i.type === 'order').length).padStart(4),
        String(u.items.filter((i) => i.type === 'insert').length).padStart(4),
        String(u.vocabulary.length).padStart(4),
        u.sources.map((s) => s.slice(0, 16)).join(' · ').slice(0, 74),
      ].join('  '),
    )
  }
}

if (SHOW > 0 && units[SHOW - 1]) {
  const u = units[SHOW - 1]
  console.log(`\n${'─'.repeat(74)}\n[단원 ${u.no}] V${u.band} · 약 ${u.estimated_minutes}분\n`)
  u.items.forEach((it, i) => {
    const label = it.type === 'order' ? '순서' : '삽입'
    console.log(`${i + 1}. ${label} — ${it.ref_title} (${it.passage_words}어)`)
    if (it.type === 'order') {
      const p = it.payload.presented ?? []
      p.forEach((s, k) => console.log(`   (${'ABCDE'[k] ?? k}) ${String(s).slice(0, 68)}`))
      console.log(`   정답 순서: ${JSON.stringify(it.answer_key.source_order ?? it.answer_key)}`)
    } else {
      console.log(`   [넣을 문장] ${String(it.payload.insert_sentence ?? '').slice(0, 68)}`)
      const r = it.payload.remaining ?? []
      r.forEach((s, k) => console.log(`   (${k}) ${String(s).slice(0, 68)}`))
      console.log(`   정답 위치: ${JSON.stringify(it.answer_key.position ?? it.answer_key)}`)
    }
    console.log('')
  })
  console.log('[어휘]')
  u.vocabulary.slice(0, 12).forEach((v) =>
    console.log(`   ${v.word.padEnd(20)} V${v.v_level ?? '?'}  ${String(v.meaning_ko).slice(0, 32)}`),
  )
  if (u.vocabulary.length > 12) console.log(`   … 그리고 ${u.vocabulary.length - 12}개`)
}
