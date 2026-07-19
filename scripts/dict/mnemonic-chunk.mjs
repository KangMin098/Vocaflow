// scripts/dict/mnemonic-chunk.mjs
// M2 니모닉 생성 — 어원 root 링크 보유 단어를 어근 분해와 함께 청크 분할.
//   서브에이전트가 청크를 읽어 '어근 literal → 단어 뜻' 다리를 놓는 한국어 니모닉 authoring → .out.json →
//   mnemonic-apply.mjs 가 shared_dictionary.mnemonic_ko 에 적용.
//   근거(어근 gloss)가 있어 환각 없음. 어근 연결이 불투명/억지면 skip(품질 우선).
// 실행: node scripts/dict/mnemonic-chunk.mjs --out scripts/dict/mnem-p1 --chunk 160
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const CHUNK = parseInt(arg('--chunk', '160'), 10)
const OUT = arg('--out', 'scripts/dict/mnem-chunks')
const AFFIX_ORDER = { prefix: 0, root: 1, suffix: 2 }

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

// word_roots: id → {root, gloss, en}
const roots = new Map()
{
  const { data, error } = await db.from('word_roots').select('id, root, gloss_ko, meaning_en')
  if (error) { console.error(error.message); process.exit(1) }
  for (const r of data) roots.set(r.id, { root: r.root, gloss: r.gloss_ko ?? '', en: r.meaning_en ?? '' })
}
// word_root_links: word → parts[]
const linksByWord = new Map()
{
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('word_root_links').select('word, affix_type, root_id').gt('word', cursor).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const l of data) {
      const r = roots.get(l.root_id); if (!r) continue
      const arr = linksByWord.get(l.word) ?? []
      arr.push({ root: r.root, gloss: r.gloss, en: r.en, affix: l.affix_type })
      linksByWord.set(l.word, arr)
    }
    cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
}
// 뜻/품사 (미니모닉 없는 것만)
const words = [...linksByWord.keys()]
const meta = new Map()
for (let i = 0; i < words.length; i += 300) {
  const batch = words.slice(i, i + 300)
  const { data, error } = await db.from('shared_dictionary')
    .select('word, meaning_ko, pos, mnemonic_ko').in('word', batch)
  if (error) { console.error(error.message); process.exit(1) }
  for (const d of data) meta.set(d.word, d)
}

const targets = []
for (const [word, parts] of linksByWord) {
  const m = meta.get(word)
  if (!m || !m.meaning_ko) continue
  if (m.mnemonic_ko && m.mnemonic_ko.trim()) continue // 이미 있음
  parts.sort((a, b) => (AFFIX_ORDER[a.affix] ?? 1) - (AFFIX_ORDER[b.affix] ?? 1))
  targets.push({
    word, meaning: m.meaning_ko, pos: m.pos,
    roots: parts.map((p) => ({ affix: p.affix, root: p.root, gloss: p.gloss, en: p.en })),
  })
}
targets.sort((a, b) => a.word.localeCompare(b.word))

fs.mkdirSync(OUT, { recursive: true })
for (const f of fs.readdirSync(OUT)) if (/^chunk-\d+\.json$/.test(f)) fs.rmSync(path.join(OUT, f))
let idx = 0
for (let i = 0; i < targets.length; i += CHUNK) {
  fs.writeFileSync(path.join(OUT, `chunk-${String(idx).padStart(2, '0')}.json`), JSON.stringify(targets.slice(i, i + CHUNK), null, 1))
  idx++
}
console.log(`targets: ${targets.length} etymology-linked words missing mnemonic_ko`)
console.log(`chunks: ${idx} × ~${CHUNK} → ${OUT}/chunk-NN.json`)
