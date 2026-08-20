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
const { composeUnits, toCsatOrder, toCsatInsert, scoreVolume } = await import('@vocaflow/library-pipeline')

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
    .select('id, type, ref_id, paragraph_idx, payload, answer_key')
    .in('ref_id', ids.slice(i, i + 10))
    .limit(20000)
  items.push(...(data ?? []))
}

// ⚠️ Supabase 는 `.in()` 결과 순서를 보장하지 않는다. 정렬하지 않으면 **같은 재료로
//   실행할 때마다 다른 교재**가 나온다 — 실측: "어휘 미달 0" 과 "미달 2" 가 번갈아 나왔다.
//   교재는 재현 가능해야 한다(같은 판이 같은 내용이어야 한다).
items.sort(
  (a, b) =>
    a.ref_id.localeCompare(b.ref_id) ||
    a.type.localeCompare(b.type) ||
    (a.paragraph_idx ?? 0) - (b.paragraph_idx ?? 0),
)

/** 문항이 품은 지문. order 는 presented, insert 는 remaining 이 지문이다. */
const bodyOf = (it) => {
  const arr = it.type === 'order' ? it.payload?.presented : it.payload?.remaining
  return Array.isArray(arr) ? arr : []
}
const passageWords = (it) => bodyOf(it).join(' ').split(/\s+/).filter(Boolean).length

const pool = items.map((it) => ({
  id: it.id,
  type: it.type,
  ref_id: it.ref_id,
  ref_title: titleById.get(it.ref_id) ?? '(제목 없음)',
  v_level: BAND,
  passage_text: bodyOf(it).join(' ') + ' ' + (it.payload?.insert_sentence ?? ''),
  passage_words: passageWords(it),
  body_sentences: bodyOf(it).length,
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
// 어휘도 같은 이유로 정렬한다 — 같은 빈도일 때 어느 낱말이 먼저 뽑히는지가 갈린다.
vocabRows.sort(
  (a, b) =>
    a.library_article_id.localeCompare(b.library_article_id) ||
    (b.frequency_in_article ?? 0) - (a.frequency_in_article ?? 0) ||
    a.word.localeCompare(b.word),
)

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
console.log(`거른 문항: 짧음 ${rejected.tooShort} · 김 ${rejected.tooLong} · 수능형식불가 ${rejected.wrongFormat} · 인용잔해 ${rejected.residue}`)
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

// ── 3관점 채점 ──────────────────────────────────────────────────────
if (units.length) {
  const sc = scoreVolume(units)
  console.log(`
${'─'.repeat(74)}
채점 — 자동 ${sc.auto.filter((c) => c.pass).length}/${sc.auto.length} 통과
`)
  for (const a of ['learner', 'teacher', 'parent']) {
    const label = { learner: '학습자', teacher: '교사', parent: '학부모' }[a]
    for (const c of sc.auto.filter((x) => x.audience === a)) {
      console.log(`  ${c.pass ? '✅' : '❌'} [${label}] ${c.label.padEnd(30)} ${c.detail}`)
    }
  }
  console.log('\n사람이 봐야 하는 것 (점수 없음):')
  for (const h of sc.human) {
    const label = { learner: '학습자', teacher: '교사', parent: '학부모' }[h.audience]
    console.log(`  ? [${label}] ${h.label} — ${h.question}`)
  }
}

if (SHOW > 0 && units[SHOW - 1]) {
  const u = units[SHOW - 1]
  console.log(`\n${'─'.repeat(74)}\n[단원 ${u.no}] V${u.band} · 약 ${u.estimated_minutes}분\n`)
  const circled = '①②③④⑤'
  u.items.forEach((it, i) => {
    // 수능 인쇄 형식으로 바꾼다 — 저장 형식과 학습 화면은 그대로 두고 표현만 바꾼다.
    const csat =
      it.type === 'order'
        ? toCsatOrder(it.payload.presented ?? [], it.answer_key.source_order ?? [])
        : toCsatInsert(
            it.payload.remaining ?? [],
            it.payload.insert_sentence ?? '',
            it.answer_key.position ?? -1,
          )

    if (csat && csat.kind === 'order') {
      console.log(`${i + 1}. 글의 순서 — ${it.ref_title} (${it.passage_words}어)`)
      console.log(`   [도입] ${String(csat.intro).slice(0, 66)}`)
      for (const b of csat.blocks) {
        console.log(`   (${b.label}) ${b.sentences.join(' ').slice(0, 64)}`)
      }
      csat.choices.forEach((c, k) => console.log(`     ${circled[k]} (${c.join(')-(')})`))
      console.log(`   정답: ${circled[csat.answer - 1]}\n`)
      return
    }

    if (csat && csat.kind === 'insert') {
      console.log(`${i + 1}. 문장 삽입 — ${it.ref_title} (${it.passage_words}어)`)
      console.log(`   [넣을 문장] ${String(csat.sentence).slice(0, 64)}`)
      csat.body.forEach((b, k) => console.log(`   ${circled[k]} ${String(b).slice(0, 64)}`))
      console.log(`   정답: ${circled[csat.answer - 1]}\n`)
      return
    }

    // 변환 실패는 조용히 넘기지 않는다 — 자리 수가 5곳이 아니면 교재에 실을 수 없다.
    const why = it.type === 'insert' ? '자리가 5곳이 아니다(6문장 문단만 가능)' : '문장이 4개 미만'
    console.log(`${i + 1}. ${it.type} — **수능 형식 변환 불가**: ${why}\n`)
  })
  console.log('[어휘]')
  u.vocabulary.slice(0, 12).forEach((v) =>
    console.log(`   ${v.word.padEnd(20)} V${v.v_level ?? '?'}  ${String(v.meaning_ko).slice(0, 32)}`),
  )
  if (u.vocabulary.length > 12) console.log(`   … 그리고 ${u.vocabulary.length - 12}개`)
}
