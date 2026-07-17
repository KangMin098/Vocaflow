// scripts/dict/roots-map.mjs
// 단어↔어근 매핑 — root→파생어 생성(LLM) → 사전 존재 단어만 링크(coincidental 노이즈 회피).
//   chunk : word_roots 를 청크 파일로(서브에이전트 입력 — root+뜻).
//   apply : 서브에이전트 결과(*.out.json = [{root, words:[...]}]) → 사전 실재 단어만 word_root_links upsert.
//     affix_type = root.notes(prefix/root/suffix) 기본값. confidence 기본 4(LLM 생성 파생어).
// 실행: node scripts/dict/roots-map.mjs chunk --dir <DIR> [--size 32]
//       node scripts/dict/roots-map.mjs apply --dir <DIR> [--commit]
import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MODE = process.argv[2]
const DIR = arg('--dir', 'scratch-roots')
const SIZE = parseInt(arg('--size', '32'), 10)
const COMMIT = process.argv.includes('--commit')

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

function affixOf(notes) {
  const n = (notes || '').toLowerCase()
  if (n.startsWith('prefix')) return 'prefix'
  if (n.startsWith('suffix')) return 'suffix'
  return 'root'
}

if (MODE === 'chunk') {
  const { data, error } = await db.from('word_roots').select('id,root,origin,meaning_en,gloss_ko,notes').order('id')
  if (error) { console.error(error.message); process.exit(1) }
  fs.mkdirSync(DIR, { recursive: true })
  let n = 0
  for (let i = 0; i < data.length; i += SIZE) {
    const chunk = data.slice(i, i + SIZE).map((r) => ({ root: r.root, meaning_en: r.meaning_en, gloss_ko: r.gloss_ko, notes: r.notes }))
    fs.writeFileSync(path.join(DIR, `chunk-${String(n).padStart(2, '0')}.json`), JSON.stringify(chunk, null, 2))
    n++
  }
  console.log(`roots: ${data.length} · chunks: ${n} → ${DIR}`)
  process.exit(0)
}

if (MODE === 'apply') {
  // root → id/affix 룩업
  const { data: roots, error: re } = await db.from('word_roots').select('id,root,notes')
  if (re) { console.error(re.message); process.exit(1) }
  const rootMap = new Map(roots.map((r) => [r.root.toLowerCase(), { id: r.id, affix: affixOf(r.notes) }]))

  // 서브에이전트 결과 수집 → (word, root) 후보
  const pairs = new Map() // word → Set(root)
  let files = 0, unknownRoot = 0
  for (const f of fs.readdirSync(DIR)) {
    if (!/\.out\.json$/.test(f)) continue
    files++
    let arr; try { arr = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) } catch { console.warn('parse fail', f); continue }
    if (!Array.isArray(arr)) continue
    for (const e of arr) {
      const root = typeof e?.root === 'string' ? e.root.toLowerCase().trim() : null
      if (!root || !rootMap.has(root)) { if (root) unknownRoot++; continue }
      const words = Array.isArray(e?.words) ? e.words : []
      for (const w0 of words) {
        const w = typeof w0 === 'string' ? w0.toLowerCase().trim() : null
        if (!w || !/^[a-z]+$/.test(w) || w.length < 3) continue
        if (!pairs.has(w)) pairs.set(w, new Set())
        pairs.get(w).add(root)
      }
    }
  }
  const allWords = [...pairs.keys()]
  console.log(`files: ${files} · candidate words: ${allWords.length} · unknown-root drops: ${unknownRoot}`)

  // 사전 실재 단어만 (classified) — 페이지네이션 IN 조회
  const exist = new Set()
  for (let i = 0; i < allWords.length; i += 300) {
    const batch = allWords.slice(i, i + 300)
    const { data, error } = await db.from('shared_dictionary').select('word').in('word', batch).not('classified_by', 'is', null)
    if (error) { console.error('lookup fail', error.message); process.exit(1) }
    for (const r of (data || [])) exist.add(r.word.toLowerCase())
  }

  // 링크 행 구성
  const links = []
  for (const [w, roots0] of pairs) {
    if (!exist.has(w)) continue
    for (const root of roots0) {
      const rm = rootMap.get(root)
      links.push({ word: w, root_id: rm.id, affix_type: rm.affix, confidence: 4 })
    }
  }
  console.log(`existing words: ${exist.size} · links: ${links.length}`)
  if (!COMMIT) {
    console.log('DRY-RUN (--commit 로 적용). 샘플:', links.slice(0, 12).map((l) => l.word + '→' + [...pairs.get(l.word)][0]).join(' · '))
    process.exit(0)
  }
  let done = 0
  for (let i = 0; i < links.length; i += 500) {
    const batch = links.slice(i, i + 500)
    const { data, error } = await db.from('word_root_links').upsert(batch, { onConflict: 'word,root_id', ignoreDuplicates: true }).select('word')
    if (error) { console.error('upsert fail', error.message); process.exit(1) }
    done += data?.length ?? 0
  }
  console.log(`upserted links: ${done}`)
  process.exit(0)
}

console.error('usage: roots-map.mjs chunk|apply --dir <DIR> [--size N] [--commit]')
process.exit(1)
