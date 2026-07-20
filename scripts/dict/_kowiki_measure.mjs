// 읽기전용: kowiktionary 영어 한국어정의의 coverage tail 커버리지
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })
const core = new Set()
{ let cur=''; for(;;){ const {data}=await db.from('shared_dictionary').select('word').gt('word',cur).order('word').limit(1000); if(!data||!data.length)break; for(const r of data)core.add(r.word.toLowerCase()); cur=data[data.length-1].word; if(data.length<1000)break } }
// kowiki 영어 → 한국어 gloss
const ko = new Map()
for (const line of fs.readFileSync('scripts/dict/data/kowiki-en.jsonl','utf8').split('\n')) {
  if(!line)continue
  let o; try{o=JSON.parse(line)}catch{continue}
  const w=(o.word||'').toLowerCase(); if(!w||!/^[a-z][a-z'-]*[a-z]$/.test(w))continue
  const g=o.senses?.find(s=>s.glosses?.length)?.glosses?.[0]
  if(g&&!ko.has(w)) ko.set(w,g)
}
const words=[...ko.keys()]
const inCore=words.filter(w=>core.has(w)).length
const tail=words.filter(w=>!core.has(w))
console.log('kowiki 영어 고유단어(한국어정의):', words.length)
console.log('  코어 내(중복):', inCore)
console.log('  코어 밖(=tail 무료 한국어!):', tail.length)
// tail 중 coverage_lexicon에 있는 것(=바로 채울 수 있음) — 배치 확인
let inCov=0
for(let i=0;i<tail.length;i+=300){ const {data}=await db.from('coverage_lexicon').select('word').in('word',tail.slice(i,i+300)); if(data)inCov+=data.length }
console.log('  그중 coverage_lexicon 존재(즉시 채움 가능):', inCov)
console.log('\ntail 샘플(코어 밖 희귀어 + 한국어):')
for(const w of tail.slice(0,15)) console.log('  '+w+' → '+ko.get(w))
