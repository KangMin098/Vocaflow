// scripts/dict/sense-vlevel-apply.mjs
// Phase B — 서브에이전트가 부여한 per-sense v_level(*.out.json)을 shared_dictionary.meanings_ko 에 주입.
//   각 항목 {word, v_levels:[정수, ...]} (인덱스=현 meanings_ko sense 순서) 또는 {word, meanings_ko:[{v_level}...]}.
//   결측(v_level=null) sense 에만 채움 — pos/meaning/기존 v_level 불변, flat 컬럼 무변경, 멱등.
//   안전 가드: 현 meanings_ko 길이 != v_levels 길이면 스킵(배열 드리프트 방지). 변화 없으면 스킵.
// 실행: node scripts/dict/sense-vlevel-apply.mjs --dir scripts/dict/svl-p1 [--commit] [--overwrite]
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const DIR = arg('--dir', 'scripts/dict/svl-chunks')
const COMMIT = process.argv.includes('--commit')
const OVERWRITE = process.argv.includes('--overwrite') // 기존 v_level 도 덮어씀(기본=결측만)

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

const validV = (v) => Number.isInteger(v) && v >= 1 && v <= 11

// 수집 + 정규화(v_levels[] 또는 meanings_ko[].v_level → v_levels[])
const items = new Map() // word → number[] (per-sense v_level, null 허용)
let files = 0, bad = 0
for (const f of fs.readdirSync(DIR)) {
  if (!/\.out\.json$/.test(f)) continue
  files++
  let arr
  try { arr = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) } catch { console.warn('parse fail', f); continue }
  if (!Array.isArray(arr)) continue
  for (const e of arr) {
    if (!e || typeof e.word !== 'string') { bad++; continue }
    let vls = null
    if (Array.isArray(e.v_levels)) vls = e.v_levels
    else if (Array.isArray(e.meanings_ko)) vls = e.meanings_ko.map((s) => (s && s.v_level != null ? s.v_level : null))
    if (!vls || !vls.length) { bad++; continue }
    // 최소 한 원소는 유효한 정수여야 의미 있음
    if (!vls.some(validV)) { bad++; continue }
    items.set(e.word.toLowerCase(), vls)
  }
}
console.log(`files: ${files} · candidate words: ${items.size} · rejected: ${bad}`)
if (!COMMIT) {
  console.log('DRY-RUN (--commit 로 적용). 샘플:')
  let n = 0; for (const [w, vls] of items) { if (n++ >= 12) break; console.log(' ', w, '→ v_levels', JSON.stringify(vls)) }
  process.exit(0)
}

// 적용
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let done = 0, updated = 0, failed = 0, skipped = 0, mismatch = 0
const entries = [...items.entries()]
const CONC = 12
const apply = async ([word, vls]) => {
  for (let t = 0; t < 4; t++) {
    const { data: cur, error: selErr } = await db.from('shared_dictionary').select('meanings_ko').eq('word', word).limit(1)
    if (selErr) { await sleep(300 * (t + 1)); continue }
    if (!cur || !cur.length) { skipped++; return }
    const mk = cur[0].meanings_ko
    if (!Array.isArray(mk) || mk.length < 2) { skipped++; return }
    if (mk.length !== vls.length) { mismatch++; return } // 배열 드리프트 — 안전 스킵
    let changed = false
    const next = mk.map((s, i) => {
      if (s == null || typeof s !== 'object') return s
      const has = Number.isInteger(s.v_level)
      const nv = vls[i]
      if (validV(nv) && (!has || (OVERWRITE && s.v_level !== nv))) { changed = true; return { ...s, v_level: nv } }
      return s
    })
    if (!changed) { skipped++; return }
    const { error } = await db.from('shared_dictionary').update({ meanings_ko: next }).eq('word', word)
    if (!error) { updated++; return }
    await sleep(300 * (t + 1))
  }
  failed++
}
for (let i = 0; i < entries.length; i += CONC) {
  await Promise.all(entries.slice(i, i + CONC).map(apply))
  done += Math.min(CONC, entries.length - i)
  if (done % 240 < CONC) console.log(`  ${done}/${entries.length} (updated ${updated}, skipped ${skipped}, mismatch ${mismatch}, failed ${failed})`)
}
console.log(`done. updated ${updated}, skipped(no-change/invalid) ${skipped}, mismatch ${mismatch}, failed ${failed}`)
