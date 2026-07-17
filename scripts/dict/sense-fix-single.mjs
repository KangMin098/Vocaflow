// scripts/dict/sense-fix-single.mjs
// 단일-POS 오데이터 교정 — sense-apply 의 ≥2-sense 가드가 적용 못 하는, 뜻 자체가 틀린(반대·오단어) 단어를 명시 리스트로 교정.
//   각 항목 {word,pos,meaning,v_level} → meaning_ko + pos + meanings_ko(단일 요소) + shared_words 동기화.
//   사용자 명시 승인된 확정 리스트만. 멱등(재실행 안전). 실행: node scripts/dict/sense-fix-single.mjs [--commit]
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const COMMIT = process.argv.includes('--commit')
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

// 사용자 승인 확정 교정 리스트 (V1-4, 오데이터: 반대뜻/오단어/품사오류/re- 누락)
const FIXES = [
  { word: 'impossibility',  pos: 'noun',      meaning: '불가능함, 불가능한 일',        v_level: 2 },
  { word: 'inability',      pos: 'noun',      meaning: '무능력, ~하지 못함',           v_level: 2 },
  { word: 'meaningfulness', pos: 'noun',      meaning: '유의미함, 의미 있음',          v_level: 2 },
  { word: 'preferment',     pos: 'noun',      meaning: '승진, 발탁',                    v_level: 3 },
  { word: 'proper',         pos: 'adjective', meaning: '적절한, 올바른, 제대로 된',     v_level: 2 },
  { word: 'rearrangement',  pos: 'noun',      meaning: '재배열, 재배치, 재조정',        v_level: 3 },
  { word: 'reintroduction', pos: 'noun',      meaning: '재도입, 다시 도입함',           v_level: 3 },
  { word: 'reorganisation', pos: 'noun',      meaning: '재편, 개편, 재조직',            v_level: 3 },
  { word: 'reorganization', pos: 'noun',      meaning: '재편, 개편, 재조직',            v_level: 3 },
  // V8 (품사 오라벨: 명사가 adjective 로 저장 / 뜻 반대):
  { word: 'arousal',          pos: 'noun', meaning: '각성, 자극, 흥분',       v_level: 8 },
  { word: 'betrayal',         pos: 'noun', meaning: '배신, 폭로',            v_level: 8 },
  { word: 'cynic',            pos: 'noun', meaning: '냉소가, 비꼬는 사람',    v_level: 8 },
  { word: 'portrayal',        pos: 'noun', meaning: '묘사, 표현',            v_level: 8 },
  { word: 'incomprehension',  pos: 'noun', meaning: '몰이해, 이해하지 못함',  v_level: 8 },
  // V10 (명사가 adjective 로 오라벨된 단일-sense — sense 완성 런 S6 잔여):
  { word: 'appraisal',    pos: 'noun', meaning: '평가, 감정',   v_level: 10 },
  { word: 'reappraisal',  pos: 'noun', meaning: '재평가',       v_level: 10 },
  { word: 'rebuttal',     pos: 'noun', meaning: '반박, 반론',   v_level: 10 },
  { word: 'perusal',      pos: 'noun', meaning: '정독, 숙독',   v_level: 10 },
  { word: 'denture',      pos: 'noun', meaning: '틀니, 의치',   v_level: 10 },
]

let changed = 0, unchanged = 0, missing = 0
for (const f of FIXES) {
  const { data: cur } = await db.from('shared_dictionary').select('word, pos, meaning_ko').eq('word', f.word).limit(1)
  if (!cur || !cur.length) { console.log(`  MISSING  ${f.word}`); missing++; continue }
  const before = `${cur[0].pos}:${cur[0].meaning_ko}`
  const after = `${f.pos}:${f.meaning}`
  if (before === after) { console.log(`  ok       ${f.word} (already ${after})`); unchanged++; continue }
  console.log(`  ${COMMIT ? 'FIX     ' : 'DRY     '} ${f.word}: ${before}  →  ${after}`)
  if (!COMMIT) { changed++; continue }
  const meanings_ko = [{ pos: f.pos, meaning: f.meaning, v_level: f.v_level }]
  const { error } = await db.from('shared_dictionary')
    .update({ meaning_ko: f.meaning, pos: f.pos, meanings_ko }).eq('word', f.word)
  if (error) { console.log(`  ERROR    ${f.word}: ${error.message}`); continue }
  await db.from('shared_words').update({ meaning_ko: f.meaning }).eq('word', f.word)
  changed++
}
console.log(`\n${COMMIT ? 'applied' : 'DRY-RUN (--commit 로 적용)'}: ${changed} · unchanged ${unchanged} · missing ${missing}`)
