// scripts/dict/roots-seed.mjs
// word_roots 시드 — 공개 표준 라틴/그리스 어근 인벤토리를 멱등 upsert.
//   소스: scripts/dict/data/word-roots-seed.json ([{root,origin,meaning_en,gloss_ko,variants,notes}])
//   멱등: onConflict root(unique). 기존 root 는 update(뜻/변형 다듬기 반영).
// 실행: node scripts/dict/roots-seed.mjs [--commit]
import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const COMMIT = process.argv.includes('--commit')
const ORIGIN_OK = new Set(['latin', 'greek', 'other'])

const rows = JSON.parse(fs.readFileSync('scripts/dict/data/word-roots-seed.json', 'utf8'))
let bad = 0
const clean = []
for (const r of rows) {
  if (!r || typeof r.root !== 'string' || !r.root.trim() || !ORIGIN_OK.has(r.origin) ||
      typeof r.meaning_en !== 'string' || !r.meaning_en.trim() || typeof r.gloss_ko !== 'string' || !r.gloss_ko.trim()) { bad++; continue }
  clean.push({
    root: r.root.trim(),
    origin: r.origin,
    meaning_en: r.meaning_en.trim(),
    gloss_ko: r.gloss_ko.trim(),
    variants: Array.isArray(r.variants) ? r.variants : [],
    notes: r.notes ?? null,
  })
}
// root 중복 방지 (파일 내)
const seen = new Set(); const dupes = []
for (const c of clean) { if (seen.has(c.root)) dupes.push(c.root); seen.add(c.root) }
console.log(`seed rows: ${clean.length} valid · ${bad} rejected · file-dupes: ${dupes.length ? dupes.join(',') : 0}`)
if (!COMMIT) { console.log('DRY-RUN (--commit 로 적용). 샘플:', clean.slice(0, 6).map((c) => c.root + '=' + c.gloss_ko).join(' · ')); process.exit(0) }

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })
const { data, error } = await db.from('word_roots').upsert(clean, { onConflict: 'root' }).select('id')
if (error) { console.error('upsert fail', error.message); process.exit(1) }
console.log(`upserted: ${data?.length ?? 0} roots`)
