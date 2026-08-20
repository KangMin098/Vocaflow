// scripts/textbook/build-unit.mjs
//
// **독해 교재 단원을 실제 재료로 조립해 본다.**
//
// 조립 규칙은 라이브러리(`textbook/assemble-unit.ts`)에 있고, 이 스크립트는 DB 에서
// 재료를 모아 넣고 결과를 눈으로 볼 수 있게 찍는다. 규칙과 재료 수집을 나눈 이유는
// 규칙을 회귀로 못 박기 위해서다.
//
// 재실행 안전: 읽기만 한다. 아무것도 쓰지 않는다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/build-unit.mjs --band 5            # 고1 밴드 요약
//   pnpm dlx tsx scripts/textbook/build-unit.mjs --band 5 --show 1   # 단원 1개 전문

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
const BAND = Number(arg('band') ?? 5)
const SHOW = Number(arg('show') ?? 0)

const { createClient } = await import('@supabase/supabase-js')
const { assembleReadingUnit, isBlocked } = await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

// 후보 지문 — 카탈로그가 이미 라이선스·등급·통사를 한 줄로 준다.
const { data: cat, error } = await db
  .from('csat_stage_catalog')
  .select('id, title, v_level, cefr_level, display_only')
  .eq('v_level', BAND)
if (error) throw new Error('카탈로그 조회 실패: ' + error.message)

const ids = (cat ?? []).map((c) => c.id)
if (!ids.length) {
  console.log(`V${BAND} 후보 지문이 없다.`)
  process.exit(0)
}

const { data: arts } = await db
  .from('library_articles')
  .select('id, word_count, content')
  .in('id', ids)
const artById = new Map((arts ?? []).map((a) => [a.id, a]))

const { data: dcp } = await db
  .from('csat_dcp_items')
  .select('ref_id, type, paragraph_idx, payload, answer_key')
  .in('ref_id', ids)
const itemsBy = new Map()
for (const d of dcp ?? []) {
  if (!itemsBy.has(d.ref_id)) itemsBy.set(d.ref_id, [])
  itemsBy.get(d.ref_id).push(d)
}

// ⚠️ Supabase 는 기본 1,000행에서 **조용히 자른다.** 오류도 경고도 없다.
//   V5 68편이면 어휘가 2만 행이라, 페이지네이션 없이 받으면 앞 몇 편만 어휘가 붙고
//   나머지는 "어휘 0" 으로 보인다 — 실제로 그렇게 나왔다(18단원 중 17개가 0).
//   지문별로 나눠 받아 자를 여지를 없앤다.
const vocabRows = []
for (let i = 0; i < ids.length; i += 5) {
  const { data: chunk, error: ve } = await db
    .from('library_article_vocabularies')
    .select('library_article_id, word, first_sentence, frequency_in_article')
    .in('library_article_id', ids.slice(i, i + 5))
    .limit(20000)
  if (ve) throw new Error('어휘 조회 실패: ' + ve.message)
  vocabRows.push(...(chunk ?? []))
}
const words = [...new Set((vocabRows ?? []).map((v) => v.word))]
const meaning = new Map()
for (let i = 0; i < words.length; i += 500) {
  const { data } = await db
    .from('shared_dictionary')
    .select('word, meaning_ko, v_level')
    .in('word', words.slice(i, i + 500))
  for (const r of data ?? []) meaning.set(r.word, r)
}
const vocabBy = new Map()
for (const v of vocabRows ?? []) {
  const d = meaning.get(v.word)
  if (!vocabBy.has(v.library_article_id)) vocabBy.set(v.library_article_id, [])
  vocabBy.get(v.library_article_id).push({
    word: v.word,
    meaning_ko: d?.meaning_ko ?? null,
    v_level: d?.v_level ?? null,
    first_sentence: v.first_sentence ?? null,
    frequency_in_article: v.frequency_in_article ?? 0,
  })
}

const units = []
const blocked = []
for (const c of cat ?? []) {
  const a = artById.get(c.id)
  const u = assembleReadingUnit(
    {
      ref_id: c.id,
      title: c.title ?? '(제목 없음)',
      word_count: a?.word_count ?? 0,
      v_level: c.v_level,
      cefr_level: c.cefr_level,
      display_only: c.display_only ?? false,
    },
    itemsBy.get(c.id) ?? [],
    vocabBy.get(c.id) ?? [],
    { learnerBand: BAND },
  )
  if (isBlocked(u)) blocked.push(u.reason)
  else units.push({ u, content: a?.content ?? '' })
}

console.log(`V${BAND} — 후보 지문 ${cat.length} · **조립된 단원 ${units.length}** · 막힌 것 ${blocked.length}\n`)
if (units.length) {
  console.log(['#', '분', '어수', '문항', '어휘', '제목'].join('  '))
  units.forEach((x, i) => {
    const u = x.u
    console.log(
      [
        String(i + 1).padStart(2),
        String(u.estimated_minutes).padStart(3),
        String(u.passage.word_count).padStart(5),
        String(u.items.length).padStart(4),
        String(u.vocabulary.length).padStart(4),
        u.passage.title.slice(0, 46),
      ].join('  '),
    )
  })
}

// 막힌 사유는 **유형별로 묶어** 보여 준다 — 40줄을 그대로 쏟으면 아무도 안 읽는다.
if (blocked.length) {
  const kinds = {}
  for (const r of blocked) {
    const k = r.includes('display_only') ? 'ND(본문 게재 불가)' : '문항 부족'
    kinds[k] = (kinds[k] ?? 0) + 1
  }
  console.log(`\n막힌 사유:`)
  for (const [k, n] of Object.entries(kinds)) console.log(`  · ${k.padEnd(22)} ${n}`)
}

if (SHOW > 0 && units[SHOW - 1]) {
  const { u, content } = units[SHOW - 1]
  console.log(`\n${'─'.repeat(72)}\n단원 ${SHOW} — ${u.passage.title}`)
  console.log(`V${u.passage.v_level} · ${u.passage.cefr_level} · ${u.passage.word_count}어 · 약 ${u.estimated_minutes}분\n`)
  console.log('[지문 앞부분]')
  console.log(content.trim().slice(0, 420) + ' …\n')
  console.log('[문항]')
  u.items.forEach((it, i) => {
    if (it.type === 'order') {
      const p = it.payload.presented ?? []
      console.log(`  ${i + 1}. 순서 (문단 ${it.paragraph_idx}) — 문장 ${p.length}개를 원래 순서로`)
      p.slice(0, 2).forEach((s, k) => console.log(`      (${'ABCDE'[k]}) ${String(s).slice(0, 62)}…`))
      console.log(`      정답: ${JSON.stringify(it.answer_key.source_order ?? it.answer_key)}`)
    } else {
      console.log(`  ${i + 1}. 삽입 (문단 ${it.paragraph_idx}) — 아래 문장이 들어갈 자리`)
      console.log(`      "${String(it.payload.insert_sentence ?? '').slice(0, 66)}…"`)
      console.log(`      후보 ${it.payload.gap_count ?? '?'}곳 · 정답 ${JSON.stringify(it.answer_key.position ?? it.answer_key)}`)
    }
  })
  console.log('\n[어휘]')
  u.vocabulary.slice(0, 10).forEach((v) =>
    console.log(`  ${v.word.padEnd(18)} V${v.v_level ?? '?'}  ${String(v.meaning_ko).slice(0, 34)}`),
  )
  if (u.vocabulary.length > 10) console.log(`  … 그리고 ${u.vocabulary.length - 10}개`)
}
