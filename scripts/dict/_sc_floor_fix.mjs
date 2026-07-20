import fs from 'node:fs'; import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath,'utf8').split('\n')){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')}
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth:{persistSession:false} })
const fixes = [
  { word:'pretreatment',  pos:'noun', meaning:'전처리, 예비 처리' },
  { word:'recombination', pos:'noun', meaning:'재조합, 재결합' },
  { word:'redefinition',  pos:'noun', meaning:'재정의' },
  { word:'referral',      pos:'noun', meaning:'위탁, 소개, 추천' },
  { word:'resettlement',  pos:'noun', meaning:'재정착, 이주' },
]
for (const f of fixes) {
  const mk = [{ pos:f.pos, meaning:f.meaning, v_level:5 }]
  const { error } = await db.from('shared_dictionary').update({ pos:f.pos, meaning_ko:f.meaning, meanings_ko:mk }).eq('word', f.word)
  if (error) { console.log('FAIL', f.word, error.message); continue }
  await db.from('shared_words').update({ meaning_ko:f.meaning }).eq('word', f.word)
  console.log('fixed', f.word, '→', f.pos, f.meaning)
}
