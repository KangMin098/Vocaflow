// scripts/dict/mnemonic-expand-chunk.mjs
// M2 확대 — 학습 세트 노출 라틴계 단어 중 '어근 미링크(=니모닉 없음)'에 니모닉 생성.
//   M2(mnemonic-chunk)는 word_root_links 보유 단어만 대상. 여기선 링크 없는 라틴계 단어를
//   어근 인벤토리(181개)를 '근거'로 제공해 서브에이전트가 분해+니모닉 authoring(무환각 유지, 근거 밖이면 skip).
//   산출은 {word, mnemonic_ko} → 기존 mnemonic-apply.mjs 로 적용(어근 링크는 미삽입 — 니모닉이 분해를 담음).
// 실행: node scripts/dict/mnemonic-expand-chunk.mjs --out scripts/dict/mnem-exp --min-v 8 --chunk 160
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const OUT = arg('--out', 'scripts/dict/mnem-exp')
const MINV = parseInt(arg('--min-v', '8'), 10)
const CHUNK = parseInt(arg('--chunk', '160'), 10)
const CATS = ['high', 'csat', 'eng_test', 'themed', 'etymology', 'middle']
const LATINATE = /(tion|sion|ment|ive|ate|ent|ance|ence|ible|able|ical|ology|graph|scribe|spect|port|dict|duct|ject|fer|mit|pose|struct|vert|voc|cede|ceive|tain|vent|form|fy|ize|logue|pathy|phobia|nym)$|^(con|com|pro|pre|re|de|in|im|ex|trans|sub|inter|super|counter|circum|ab|ad|dis|per|se|ob|e)/

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

// 1) 학습 세트 노출 단어(distinct)
const setWords = new Set()
{
  let cursor = ''
  for (;;) {
    const { data: sets } = await db.from('shared_word_sets').select('id').in('category', CATS)
    const ids = (sets ?? []).map((s) => s.id)
    // shared_words 를 set_id IN 로 페이지네이션(word만)
    const { data, error } = await db.from('shared_words').select('word, set_id').in('set_id', ids).gt('word', cursor).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const r of data) setWords.add((r.word || '').toLowerCase())
    cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
}
// 2) 이미 root 링크 있는 단어 제외집합
const linked = new Set()
{
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('word_root_links').select('word').gt('word', cursor).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const r of data) linked.add((r.word || '').toLowerCase())
    cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
}
// 3) 후보 = setWords − linked − 라틴계 − v>=MINV − 니모닉 없음
const cand = [...setWords].filter((w) => !linked.has(w) && LATINATE.test(w) && /^[a-z]+$/.test(w) && w.length >= 4)
const meta = new Map()
for (let i = 0; i < cand.length; i += 300) {
  const { data, error } = await db.from('shared_dictionary')
    .select('word, meaning_ko, pos, v_level, mnemonic_ko').in('word', cand.slice(i, i + 300))
  if (error) { console.error(error.message); process.exit(1) }
  for (const d of data) meta.set(d.word, d)
}
const targets = cand
  .map((w) => meta.get(w))
  .filter((d) => d && d.meaning_ko && d.v_level >= MINV && !(d.mnemonic_ko && d.mnemonic_ko.trim()))
  .map((d) => ({ word: d.word, meaning: d.meaning_ko, pos: d.pos, v: d.v_level }))
  .sort((a, b) => a.word.localeCompare(b.word))

// 4) 어근 인벤토리 근거 파일
const { data: roots } = await db.from('word_roots').select('root, gloss_ko, meaning_en, notes').order('root')
fs.mkdirSync(OUT, { recursive: true })
for (const f of fs.readdirSync(OUT)) if (/^chunk-\d+\.json$/.test(f)) fs.rmSync(path.join(OUT, f))
fs.writeFileSync(path.join(OUT, '_roots_ref.json'), JSON.stringify(roots ?? [], null, 1))
let idx = 0
for (let i = 0; i < targets.length; i += CHUNK) {
  fs.writeFileSync(path.join(OUT, `chunk-${String(idx).padStart(2, '0')}.json`), JSON.stringify(targets.slice(i, i + CHUNK), null, 1))
  idx++
}
console.log(`targets: ${targets.length} latinate/no-root learner words (v>=${MINV}) missing mnemonic`)
console.log(`chunks: ${idx} × ~${CHUNK} + _roots_ref.json(${(roots ?? []).length} roots) → ${OUT}`)
