// scripts/dict/clean-inflected-forms.mjs
//
// 굴절형 전역 권위화 — shared_dictionary.inflected_forms 정제 (LLM 불요, 결정적).
//
// 원칙: 각 lemma 의 기존(corpus 부트스트랩) 형태 중
//   · 규칙 굴절형(forwardRegular 가 만들 수 있는 것) → 유지
//   · 권위 불규칙(english_irregular_forms 동사 + 손수 명사복수/형용사) → 유지·보강
//   나머지(파생 -er/-ness/-ly·축약 파편·고유 파생어) → 제거.
// 신규 규칙형을 "생성"하지는 않음 → 비가산 명사(information→informations) 오생성 차단.
//   (런타임 matchSurface 가 규칙형은 regex 로 항상 커버하므로 DB 누락 무해)
//
// 실행: pnpm dlx tsx scripts/dict/clean-inflected-forms.mjs [--commit]
//   --commit 없으면 dry-run (통계 + 샘플만).

import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const commit = process.argv.includes('--commit')

const { createClient } = await import('@supabase/supabase-js')
const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
if (!url || !key) { console.error('Missing SUPABASE env'); process.exit(1) }
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

// ─── 규칙 굴절형 후보 (관대하게 — 존재형 유지 판정용, 신규 생성 아님) ───
//   POS-aware: 형용사/부사는 비교·최상(-er/-est) 인정, 동사/명사는 -er=파생(agentive)이라 불인정.
//   doubling 은 음절 무관 CVC-말미면 인정(format→formatted, occur→occurred). 검증 전용이라 관대해도 안전.
function forwardRegular(lemma, pos) {
  const w = lemma.toLowerCase()
  const out = new Set()
  const add = (s) => { if (s && s.length >= 2) out.add(s) }
  const last = w[w.length - 1]
  // 단순 접미
  add(w + 's'); add(w + 'es'); add(w + 'ed'); add(w + 'ing'); add(w + 'd')
  // e 끝: e 탈락 + ing/ed/es, +d
  if (w.endsWith('e')) {
    const st = w.slice(0, -1)
    add(st + 'ing'); add(st + 'ed'); add(st + 'es'); add(w + 'd')
  }
  // 자음+y → ies/ied/ying
  if (/[^aeiou]y$/.test(w)) {
    const st = w.slice(0, -1)
    add(st + 'ies'); add(st + 'ied'); add(st + 'ying')
  }
  // -ie → -ying (lie→lying, die→dying, tie→tying)
  if (w.endsWith('ie')) add(w.slice(0, -2) + 'ying')
  // 자음 doubling (CVC-말미, 음절 무관) → +자음 ed/ing
  if (/[aeiou][^aeiouwxy]$/.test(w)) {
    add(w + last + 'ed'); add(w + last + 'ing')
  }
  // f/fe → ves (leaf→leaves, knife→knives, fishwife→fishwives)
  if (w.endsWith('fe')) add(w.slice(0, -2) + 'ves')
  if (w.endsWith('f')) add(w.slice(0, -1) + 'ves')
  // 고전(라틴·그리스) 복수 — 검증 전용(존재형 유지만, 신규 강제 X)
  if (w.endsWith('a')) { add(w + 'e'); add(w + 'ta') }     // fossa→fossae · stigma→stigmata
  if (w.endsWith('um')) add(w.slice(0, -2) + 'a')          // datum→data
  if (w.endsWith('us')) add(w.slice(0, -2) + 'i')          // alumnus→alumni
  if (w.endsWith('is')) add(w.slice(0, -2) + 'es')         // crisis→crises
  if (w.endsWith('on')) add(w.slice(0, -2) + 'a')          // criterion→criteria
  if (/[ie]x$/.test(w)) add(w.slice(0, -2) + 'ices')       // matrix→matrices · vertex→vertices
  // 비교급·최상급 — 형용사/부사만
  if (pos === 'adjective' || pos === 'adverb') {
    add(w + 'er'); add(w + 'est')
    if (w.endsWith('e')) { add(w + 'r'); add(w + 'st') }            // nice→nicer/nicest
    if (/[^aeiou]y$/.test(w)) {
      const st = w.slice(0, -1)
      add(st + 'ier'); add(st + 'iest')                              // snappy→snappier/snappiest
    }
    if (/[aeiou][^aeiouwxy]$/.test(w)) { add(w + last + 'er'); add(w + last + 'est') } // big→bigger
  }
  return out
}

// ─── 권위 불규칙 맵 (base → [forms]) ───
async function buildIrregularMap() {
  const map = new Map()
  const put = (base, forms) => {
    const s = map.get(base) ?? new Set()
    for (const f of forms) if (f) s.add(f.toLowerCase())
    map.set(base, s)
  }
  // 1) DB english_irregular_forms (불규칙 동사 133 base, 희귀 포함)
  let from = 0
  const PAGE = 1000
  for (;;) {
    const { data, error } = await db
      .from('english_irregular_forms')
      .select('base, form')
      .range(from, from + PAGE - 1)
    if (error) { console.error('irregular_forms load:', error.message); process.exit(1) }
    for (const r of data) if (r.base && r.form) put(r.base.toLowerCase(), [r.form])
    if (data.length < PAGE) break
    from += PAGE
  }
  // 2) 손수 — 불규칙 명사 복수 (english_irregular_forms 미수록)
  const PLURALS = {
    child: ['children'], man: ['men'], woman: ['women'], foot: ['feet'], tooth: ['teeth'],
    goose: ['geese'], mouse: ['mice'], louse: ['lice'], ox: ['oxen'], person: ['people', 'persons'],
    penny: ['pence', 'pennies'], die: ['dice'], leaf: ['leaves'], loaf: ['loaves'], knife: ['knives'],
    wife: ['wives'], life: ['lives'], half: ['halves'], calf: ['calves'], shelf: ['shelves'],
    wolf: ['wolves'], thief: ['thieves'], self: ['selves'], elf: ['elves'], hoof: ['hooves'],
    scarf: ['scarves'], datum: ['data'], medium: ['media'], bacterium: ['bacteria'],
    curriculum: ['curricula'], phenomenon: ['phenomena'], criterion: ['criteria'],
    analysis: ['analyses'], basis: ['bases'], crisis: ['crises'], thesis: ['theses'],
    diagnosis: ['diagnoses'], hypothesis: ['hypotheses'], parenthesis: ['parentheses'],
    axis: ['axes'], index: ['indices', 'indexes'], appendix: ['appendices', 'appendixes'],
    matrix: ['matrices'], vertex: ['vertices'], cactus: ['cacti', 'cactuses'], fungus: ['fungi', 'funguses'],
    nucleus: ['nuclei'], radius: ['radii'], stimulus: ['stimuli'], syllabus: ['syllabi', 'syllabuses'],
    alumnus: ['alumni'], focus: ['foci', 'focuses'], antenna: ['antennae', 'antennas'],
    formula: ['formulae', 'formulas'], larva: ['larvae'], gentleman: ['gentlemen'],
    policeman: ['policemen'], fireman: ['firemen'], fisherman: ['fishermen'], salesman: ['salesmen'],
    businessman: ['businessmen'], chairman: ['chairmen'], craftsman: ['craftsmen'],
    spokesman: ['spokesmen'], freshman: ['freshmen'], madman: ['madmen'], snowman: ['snowmen'],
    aircraft: ['aircraft'], offspring: ['offspring'], series: ['series'], species: ['species'],
  }
  for (const [b, f] of Object.entries(PLURALS)) put(b, f)
  // 3) 손수 — 불규칙 형용사/부사 비교·최상
  const ADJ = {
    good: ['better', 'best'], well: ['better', 'best'], bad: ['worse', 'worst'],
    badly: ['worse', 'worst'], ill: ['worse', 'worst'],
    far: ['farther', 'further', 'farthest', 'furthest'],
    little: ['less', 'least', 'littler', 'littlest'], many: ['more', 'most'], much: ['more', 'most'],
    old: ['older', 'oldest', 'elder', 'eldest'],
  }
  for (const [b, f] of Object.entries(ADJ)) put(b, f)
  // homograph 제외 — lie(recline)→lay/lain 은 별도 동사 'lay'와 충돌 (lie 는 규칙형 lies/lied/lying 만)
  map.delete('lie')
  return map
}

const norm = (s) => (s ?? '').toLowerCase().trim()

function cleanLemma(lemma, pos, existing, irrMap) {
  const w = norm(lemma)
  const reg = forwardRegular(w, pos)
  const irr = irrMap.get(w) ?? new Set()
  const out = new Set()
  // 기존 형태 중 규칙형이거나 권위 불규칙이면 유지 (나머지=noise 제거)
  for (const f0 of existing ?? []) {
    const f = norm(f0)
    if (!f || f === w) continue
    if (reg.has(f) || irr.has(f)) out.add(f)
  }
  // 권위 불규칙 보강 (기존에 없던 것도 추가)
  for (const f of irr) if (f !== w) out.add(f)
  return [...out].sort()
}

// ─── 처리 ───
const irrMap = await buildIrregularMap()
console.log(`irregular map: ${irrMap.size} bases\n`)

// 대상: inflected_forms 보유분 + 맵 base (NULL 불규칙 채움)
// keyset pagination (word PK) — offset 재스캔/timeout 회피
const rows = []
{
  const PAGE = 1000
  let cursor = ''
  for (;;) {
    const { data, error } = await db
      .from('shared_dictionary')
      .select('word, pos, inflected_forms')
      .not('inflected_forms', 'is', null)
      .gt('word', cursor)
      .order('word', { ascending: true })
      .limit(PAGE)
    if (error) { console.error('load:', error.message); process.exit(1) }
    if (!data.length) break
    rows.push(...data)
    cursor = data[data.length - 1].word
    if (data.length < PAGE) break
  }
}
// 맵 base 중 inflected_forms NULL 인 것도 추가 (불규칙 채움)
{
  const have = new Set(rows.map((r) => r.word))
  const bases = [...irrMap.keys()].filter((b) => !have.has(b))
  for (let i = 0; i < bases.length; i += 300) {
    const chunk = bases.slice(i, i + 300)
    const { data } = await db.from('shared_dictionary')
      .select('word, pos, inflected_forms').in('word', chunk).is('inflected_forms', null)
    if (data) rows.push(...data)
  }
}
console.log(`processing ${rows.length} lemmas\n`)

const changes = []
let droppedNoiseExamples = []
let filledExamples = []
for (const r of rows) {
  const oldArr = (r.inflected_forms ?? []).map(norm).filter(Boolean).sort()
  const next = cleanLemma(r.word, r.pos, r.inflected_forms, irrMap)
  const oldKey = oldArr.join('|')
  const newKey = next.join('|')
  if (oldKey === newKey) continue
  changes.push({ word: r.word, old: oldArr, next })
  const dropped = oldArr.filter((f) => !next.includes(f))
  const added = next.filter((f) => !oldArr.includes(f))
  if (dropped.length && droppedNoiseExamples.length < 20)
    droppedNoiseExamples.push(`${r.word}: -[${dropped.join(',')}]`)
  if (added.length && filledExamples.length < 20)
    filledExamples.push(`${r.word}: +[${added.join(',')}]`)
}

console.log(`=== ${commit ? 'COMMIT' : 'DRY-RUN'} ===`)
console.log(`changed: ${changes.length} / ${rows.length}`)
console.log(`→ became empty (set NULL): ${changes.filter((c) => c.next.length === 0).length}`)
console.log(`\n--- dropped (noise) samples ---`)
for (const e of droppedNoiseExamples) console.log('  ' + e)
console.log(`\n--- added (irregular fill) samples ---`)
for (const e of filledExamples) console.log('  ' + e)

if (commit && changes.length) {
  console.log(`\napplying ${changes.length} updates...`)
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  let done = 0
  let failed = 0
  const CONC = 10
  const upd = async (c) => {
    for (let t = 0; t < 4; t++) {
      const { error } = await db.from('shared_dictionary')
        .update({ inflected_forms: c.next.length ? c.next : null })
        .eq('word', c.word)
      if (!error) return true
      await sleep(300 * (t + 1))
    }
    failed++
    return false
  }
  for (let i = 0; i < changes.length; i += CONC) {
    const batch = changes.slice(i, i + CONC)
    await Promise.all(batch.map(upd))
    done += batch.length
    if (done % 2000 < CONC) console.log(`  ${done}/${changes.length} (failed ${failed})`)
  }
  console.log(`done. failed=${failed} (re-run to converge if >0)`)
}
process.exit(0)
