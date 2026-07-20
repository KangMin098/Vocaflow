import fs from 'node:fs'; import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath,'utf8').split('\n')){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')}
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth:{persistSession:false} })
const words = ['pretreatment','recombination','redefinition','referral','resettlement']
const { data } = await db.from('shared_dictionary').select('word,pos,meaning_ko,meanings_ko,v_level').in('word', words)
for (const r of data.sort((a,b)=>words.indexOf(a.word)-words.indexOf(b.word))) console.log(r.word, '|pos:', r.pos, '|meaning_ko:', r.meaning_ko, '|meanings_ko:', JSON.stringify(r.meanings_ko))
