import fs from 'node:fs'; import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath,'utf8').split('\n')){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')}
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth:{persistSession:false} })
const fixes = [
  { word:'conduction',    pos:'noun', meaning:'전도 (열·전기의 전달)' },
  { word:'disable',       pos:'verb', meaning:'무력화하다, 못 쓰게 만들다' },
  { word:'impurity',      pos:'noun', meaning:'불순물, 불순함' },
  { word:'insensitivity', pos:'noun', meaning:'무감각, 둔감함' },
  { word:'retrial',       pos:'noun', meaning:'재심, 재심리' },
]
for (const f of fixes) {
  const mk = [{ pos:f.pos, meaning:f.meaning, v_level:6 }]
  // guard: only touch currently single-sense rows
  const { data: cur } = await db.from('shared_dictionary').select('meanings_ko').eq('word', f.word).limit(1)
  if (!cur || !cur.length) { console.log('missing', f.word); continue }
  if (Array.isArray(cur[0].meanings_ko) && cur[0].meanings_ko.length >= 2) { console.log('skip (multi)', f.word); continue }
  const { error } = await db.from('shared_dictionary').update({ pos:f.pos, meaning_ko:f.meaning, meanings_ko:mk }).eq('word', f.word)
  if (error) { console.log('FAIL', f.word, error.message); continue }
  await db.from('shared_words').update({ meaning_ko:f.meaning }).eq('word', f.word)
  console.log('fixed', f.word, '→', f.pos, f.meaning)
}
