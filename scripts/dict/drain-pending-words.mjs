// scripts/dict/drain-pending-words.mjs
//
// **pending_words 백로그를 Claude Code 가 비우는 드레인.**
//
// ── 왜 규칙만으로는 못 비우나 (실측 2026-08-25) ─────────────────────
// 큐 9,081행의 정체를 규칙으로 갈라 보면 매번 절반쯤에서 막힌다:
//   · `lexicon_clean` 에 영어로 있으면 진성 갭 → ted·avon·baidu·cac 이 진성 갭으로 올라온다
//   · 코퍼스에 아예 없으면 노이즈      → thylakoid·mesophyll·anoxygenic 같은 실단어가 섞인다
//   · 하이픈은 등재 불필요             → **틀렸다**. 해석기가 하이픈을 분해하지 않아
//                                        well-being·decision-making 이 눌러도 안 뜬다
// 남은 판단은 "이게 영어 낱말인가, 고유명사인가, 쓰레기인가" 하나뿐이고 그건 사람(=LLM)의 몫이다.
// 그래서 이 저장소가 이미 쓰는 3단 드레인으로 만든다.
//
// ── 3단 ─────────────────────────────────────────────────────────────
//   export : 후보를 chunk-NN.json 으로 분할 → Claude Code authoring 입력
//   (Claude Code) : 각 chunk 를 읽고 chunk-NN.out.json 을 쓴다
//   import : 검증 후 세 갈래로 적재 — 사전 등재 / 고유명사 / 노이즈
//
// **판정이 셋인 것이 핵심이다.** 등재만 하면 큐가 안 줄고, 기각만 하면 실단어를 버린다.
//   verdict='add'         → shared_dictionary 등재 + pending 을 added 로
//   verdict='proper_noun' → proper_noun_forms 등재 + pending 을 rejected 로
//   verdict='noise'       → noise_blacklist 등재 + pending 을 rejected 로
// 뒤 둘은 적재 함수(`ingest_topic_corpus_doc`)가 조회하는 표라, 넣어 두면 **다시 큐에 안 들어온다**.
// status 만 바꾸면 그 낱말이 다음 코퍼스에서 또 올라온다.
//
// ── 재실행 안전 ─────────────────────────────────────────────────────
//   export : 이미 해석되는 낱말(`unresolved_dict_words` 로 확인)·고유명사표·노이즈표에 있는 것을
//            제외한다. 몇 번 돌려도 남은 것만 나온다.
//   import : 이미 있는 표제어는 건너뛴다(건너뛴 수를 출력). 같은 out.json 을 다시 넣어도 결과가 같다.
//
// ── 일부러 후보에서 빼는 것 ─────────────────────────────────────────
//   접두사 파생(non-·anti-·un-·self- …) — 뜻이 뒤집혀 해석기로도 못 풀고(anti-slavery→slavery)
//   등재할지도 판단이 필요하다. 별도 라운드로 다룬다.
//
// 실행:
//   node scripts/dict/drain-pending-words.mjs export --dir scripts/dict/pending-drain [--chunk 60] [--min-enc 3]
//   node scripts/dict/drain-pending-words.mjs import --dir scripts/dict/pending-drain [--commit]

import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath))
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }

const arg = (n, d) => {
  const i = process.argv.indexOf(n)
  return i >= 0 ? process.argv[i + 1] : d
}
const MODE = process.argv[2]
const DIR = arg('--dir', 'scripts/dict/pending-drain')
const CHUNK = parseInt(arg('--chunk', '60'), 10)
const MIN_ENC = parseInt(arg('--min-enc', '3'), 10)
const COMMIT = process.argv.includes('--commit')

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(
  process.env['NEXT_PUBLIC_SUPABASE_URL'],
  process.env['SUPABASE_SERVICE_ROLE_KEY'],
  { auth: { persistSession: false } },
)

/** 뜻을 뒤집는 접두사 — 이 라운드에서 제외 (해석기 L4 가 같은 이유로 'less' 를 뺀다) */
const NEGATING_PREFIXES = [
  'non', 'anti', 'un', 'dis', 'mis', 'ir', 'im', 'il', 'de', 'counter', 'pseudo', 'quasi',
]
const POS_OK = new Set([
  'noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction',
  'interjection', 'determiner', 'idiom', 'phrasal_verb', 'abbreviation', 'number', 'other',
])
const REGISTER_OK = new Set([
  'standard', 'modern_advanced', 'phrase_unit', 'archaic_literary', 'period_cultural',
  'abbreviation', 'brand', 'proper_noun',
])
const CEFR_OK = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
/** noise_blacklist.category 체크 제약이 허용하는 값 — 임의 문자열을 쓰면 upsert 가 통째로 실패한다.
 *  (첫 실행에서 category='drain' 으로 40건이 조용히 안 들어갔다. 큐는 rejected 인데 블랙리스트엔
 *   없어서, 다음 코퍼스 적재 때 같은 낱말이 그대로 다시 올라왔을 상태였다.) */
const NOISE_CATEGORY_OK = new Set([
  'foreign_word', 'archaic_grammar', 'interjection_noise', 'proper_noun_marker', 'corrupt_token',
])
const hasHangul = (s) => /[가-힣]/.test(s)

async function pageAll(build) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

/** 배치로 해석 여부 확인 — RPC 는 **해석 실패분만** 돌려준다. */
async function unresolvedOnly(words) {
  const left = new Set()
  for (let i = 0; i < words.length; i += 500) {
    const slice = words.slice(i, i + 500)
    const { data, error } = await db.rpc('unresolved_dict_words', { p_words: slice })
    if (error) throw new Error(`unresolved_dict_words: ${error.message}`)
    for (const w of data || []) left.add(w)
  }
  return left
}

if (MODE === 'export') {
  const rows = await pageAll(() =>
    db
      .from('pending_words')
      .select('lemma, encounter_count, doc_freq')
      .eq('status', 'pending')
      .order('encounter_count', { ascending: false }),
  )

  const shaped = rows
    .map((r) => ({ w: String(r.lemma || '').toLowerCase().trim(), enc: r.encounter_count ?? 0, df: r.doc_freq ?? 0 }))
    .filter((r) => /^[a-z][a-z'-]*[a-z]$/.test(r.w) && r.w.length >= 3)
    // 접두사 파생은 이 라운드 제외 (파일 머리 주석 참조)
    .filter((r) => !(r.w.includes('-') && NEGATING_PREFIXES.includes(r.w.split('-')[0])))
    // 넓이(문서 수) 또는 총량 중 하나라도 기준을 넘어야 한다. doc_freq 는 2026-08-25 이후 적재분만 있다.
    .filter((r) => r.df >= 2 || r.enc >= MIN_ENC)

  const [{ data: pn }, { data: nb }] = await Promise.all([
    db.from('proper_noun_forms').select('form'),
    db.from('noise_blacklist').select('form'),
  ])
  const known = new Set([
    ...(pn || []).map((x) => String(x.form).toLowerCase()),
    ...(nb || []).map((x) => String(x.form).toLowerCase()),
  ])
  const notKnown = shaped.filter((r) => !known.has(r.w))

  const unresolved = await unresolvedOnly(notKnown.map((r) => r.w))
  const targets = notKnown
    .filter((r) => unresolved.has(r.w))
    .sort((a, b) => b.df - a.df || b.enc - a.enc || a.w.localeCompare(b.w))

  fs.mkdirSync(DIR, { recursive: true })

  // 아직 적재하지 않은 결과물 위에 덮어쓰지 않는다. export 는 후보가 줄면 청크 경계가 통째로
  // 밀리므로, out.json 을 남겨 둔 채 다시 뽑으면 chunk-NN.json 과 chunk-NN.out.json 의 내용이
  // 어긋난다(실제로 한 번 그렇게 됐다 — 57청크가 56청크로 줄면서 00 번의 짝이 깨졌다).
  const staleOut = fs.readdirSync(DIR).filter((f) => /\.out\.json$/.test(f))
  if (staleOut.length > 0 && !process.argv.includes('--force')) {
    console.error(`${DIR} 에 적재되지 않은 결과물이 ${staleOut.length}개 있다: ${staleOut.slice(0, 3).join(', ')}…`)
    console.error('  먼저 import --commit 으로 적재하고 out.json 을 치운 뒤 다시 export 하거나, --force 로 덮어쓴다.')
    process.exit(1)
  }
  for (const f of fs.readdirSync(DIR)) {
    if (/^chunk-\d+\.json$/.test(f)) fs.unlinkSync(path.join(DIR, f))
  }

  let n = 0
  for (let i = 0; i < targets.length; i += CHUNK) {
    fs.writeFileSync(
      path.join(DIR, `chunk-${String(n).padStart(2, '0')}.json`),
      JSON.stringify(targets.slice(i, i + CHUNK), null, 2),
    )
    n++
  }
  console.log(
    `pending ${rows.length} → 형태 통과 ${shaped.length} → 기지(고유명사·노이즈) 제외 ${notKnown.length} → 미해석 ${targets.length}`,
  )
  console.log(`chunks: ${n} (${CHUNK}개씩) → ${DIR}`)
  process.exit(0)
}

if (MODE === 'import') {
  if (!fs.existsSync(DIR)) {
    console.error(`${DIR} 가 없다. 먼저 export 를 돌린다.`)
    process.exit(1)
  }
  const add = new Map()
  const proper = new Map()
  const noise = new Map()
  const rejectLog = []
  let files = 0

  for (const f of fs.readdirSync(DIR)) {
    if (!/\.out\.json$/.test(f)) continue
    files++
    let arr
    try {
      arr = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
    } catch {
      console.warn('parse fail', f)
      continue
    }
    if (!Array.isArray(arr)) continue

    for (const e of arr) {
      const w = typeof e?.word === 'string' ? e.word.toLowerCase().trim() : null
      if (!w) { rejectLog.push(['(word 없음)', JSON.stringify(e).slice(0, 60)]); continue }
      const verdict = e?.verdict

      if (verdict === 'proper_noun') { proper.set(w, e?.note || 'drain'); continue }
      if (verdict === 'noise') {
        const cat = String(e?.category || 'corrupt_token').trim()
        if (!NOISE_CATEGORY_OK.has(cat)) {
          rejectLog.push([w, `noise category 불가: ${cat}`])
          continue
        }
        noise.set(w, { note: e?.note || '', category: cat })
        continue
      }
      if (verdict !== 'add') { rejectLog.push([w, `verdict 이 add/proper_noun/noise 가 아님: ${verdict}`]); continue }

      const ko = typeof e?.meaning_ko === 'string' ? e.meaning_ko.trim() : ''
      const ex = typeof e?.example_en === 'string' ? e.example_en.trim() : ''
      const pos = String(e?.pos || '').trim()
      const cefr = String(e?.cefr_level || '').trim().toUpperCase()
      const vl = Number(e?.v_level)
      const reg = String(e?.word_register || 'standard').trim()
      // 하이픈·아포스트로피를 **양쪽 모두** 지우고 비교한다. 한쪽만 지우면 'pro-slavery' 의
      // stem('proslave')이 예문 "Pro-slavery newspapers…" 에 없다고 나온다(첫 실행에서 5건 오탈락).
      const base = w.replace(/[^a-z]/g, '')
      const stem = base.slice(0, Math.max(4, base.length - 2))
      const exNorm = ex.toLowerCase().replace(/[^a-z]/g, '')

      if (!POS_OK.has(pos)) { rejectLog.push([w, `pos 불가: ${pos}`]); continue }
      if (!CEFR_OK.has(cefr)) { rejectLog.push([w, `cefr 불가: ${cefr}`]); continue }
      if (!Number.isInteger(vl) || vl < 1 || vl > 11) { rejectLog.push([w, `v_level 불가: ${e?.v_level}`]); continue }
      if (!REGISTER_OK.has(reg)) { rejectLog.push([w, `register 불가: ${reg}`]); continue }
      if (ko.length < 2 || !hasHangul(ko)) { rejectLog.push([w, `뜻이 비었거나 한글 없음: "${ko}"`]); continue }
      if (ex.length < 6 || ex.length > 240 || hasHangul(ex)) { rejectLog.push([w, `예문 길이/언어 불가`]); continue }
      if (stem.length >= 4 && !exNorm.includes(stem)) { rejectLog.push([w, `예문에 표제어 없음`]); continue }

      add.set(w, { word: w, pos, cefr, vl, ko, ex, reg })
    }
  }

  console.log(`files ${files} · add ${add.size} · proper_noun ${proper.size} · noise ${noise.size} · 검증 탈락 ${rejectLog.length}`)
  for (const [w, why] of rejectLog.slice(0, 20)) console.warn('  reject', w, '—', why)
  if (rejectLog.length > 20) console.warn(`  … 외 ${rejectLog.length - 20}건`)

  if (!COMMIT) {
    console.log('\nDRY-RUN (--commit 로 적재). add 샘플:')
    let n = 0
    for (const v of add.values()) { if (n++ >= 8) break; console.log(' ', v.word, '·', v.pos, v.cefr, 'V' + v.vl, '·', v.ko) }
    process.exit(0)
  }

  // ① 이미 있는 표제어는 건너뛴다 (재실행 안전)
  const words = [...add.keys()]
  const existing = new Set()
  for (let i = 0; i < words.length; i += 500) {
    const { data } = await db.from('shared_dictionary').select('word').in('word', words.slice(i, i + 500))
    for (const r of data || []) existing.add(r.word)
  }
  const fresh = [...add.values()].filter((v) => !existing.has(v.word))
  console.log(`이미 등재 ${existing.size}건 건너뜀 · 새로 넣을 것 ${fresh.length}건`)

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  let inserted = 0
  for (let i = 0; i < fresh.length; i += 100) {
    const batch = fresh.slice(i, i + 100).map((v) => ({
      word: v.word,
      pos: v.pos,
      primary_pos: v.pos,
      pos_set: [v.pos],
      cefr_level: v.cefr,
      v_level: v.vl,
      skill_type: v.word.includes(' ') ? 'collocation' : 'single_word',
      skill_level: v.word.includes(' ') ? 4 : 3,
      word_register: v.reg,
      meaning_ko: v.ko,
      meanings_ko: [{ pos: v.pos, meaning: v.ko }],
      example_en: v.ex,
      source: 'ai-generated',
      classified_by: 'claude_code_opus_5',
      claude_classified_at: new Date().toISOString(),
      vrl_calculated_at: new Date().toISOString(),
      list_tags: [],
      senses: [],
      field_provenance: { meaning_ko: `claude-code-${stamp}`, v_level: `pending-drain-${stamp}` },
      verified: false,
    }))
    const { error } = await db.from('shared_dictionary').insert(batch)
    if (error) { console.warn('insert fail', error.message); continue }
    inserted += batch.length
  }

  // ② 고유명사·노이즈는 **표에 넣어야** 다음 코퍼스에서 다시 안 올라온다
  let properUp = 0
  if (proper.size > 0) {
    const rowsPn = [...proper.entries()].map(([form, note]) => ({
      form, evidence: `drain:${note}`.slice(0, 200), occurrences: 0, book_count: 0,
    }))
    const { error } = await db.from('proper_noun_forms').upsert(rowsPn, { onConflict: 'form' })
    if (error) console.warn('proper_noun_forms fail', error.message)
    else properUp = rowsPn.length
  }
  let noiseUp = 0
  if (noise.size > 0) {
    const rowsNb = [...noise.entries()].map(([form, v]) => ({
      form, category: v.category, note: String(v.note).slice(0, 200), source: `pending-drain-${stamp}`,
    }))
    const { error } = await db.from('noise_blacklist').upsert(rowsNb, { onConflict: 'form' })
    if (error) {
      // 조용히 넘기면 안 된다 — 큐만 rejected 가 되고 블랙리스트가 비면 다음 적재에서 다시 올라온다.
      console.error('noise_blacklist fail —', error.message)
      console.error('  ⚠️ 블랙리스트 적재 실패. 큐만 정리하면 같은 낱말이 다음 코퍼스에서 다시 올라온다.')
      process.exitCode = 1
    } else noiseUp = rowsNb.length
  }

  // ③ 큐 정리 — 등재분은 added, 나머지 판정은 rejected
  const mark = async (lemmas, status, note) => {
    let n = 0
    for (let i = 0; i < lemmas.length; i += 200) {
      const { data, error } = await db
        .from('pending_words')
        .update({ status, resolved_at: new Date().toISOString(), updated_at: new Date().toISOString(), admin_note: note })
        .in('lemma', lemmas.slice(i, i + 200))
        .eq('status', 'pending')
        .select('lemma')
      if (error) { console.warn('queue update fail', error.message); continue }
      n += (data || []).length
    }
    return n
  }
  const addedN = await mark([...add.keys()], 'added', `${stamp} pending 드레인 등재`)
  const rejectedN = await mark([...proper.keys(), ...noise.keys()], 'rejected', `${stamp} pending 드레인 기각(고유명사/노이즈)`)

  console.log(
    `\n적재 완료 — 사전 +${inserted} · proper_noun_forms +${properUp} · noise_blacklist +${noiseUp}`,
  )
  console.log(`큐 정리 — added ${addedN} · rejected ${rejectedN}`)
  process.exit(0)
}

console.error('usage: drain-pending-words.mjs export|import --dir <DIR> [--chunk N] [--min-enc N] [--commit]')
process.exit(1)
