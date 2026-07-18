// scripts/dict/mnemonic-etym-apply.mjs
// M3 어원 니모닉 적용 + 경선식 차단 게이트. 서브에이전트 산출(*.out.json: {word, mnemonic_ko})을 shared_dictionary.mnemonic_ko 에.
//   게이트(경선식=발음 소리흉내 차단):
//   (1) 화살표(→) 필수  (2) 라틴 어근 토큰(로마자) 필수 · 한글(...) 소리 괄호 거부
//   (3) 어근 토큰이 그 단어 etymology_text(같은 dir chunk-NN.json)에 실제 등장(diacritic strip 후 substring)
//   근거 불일치(=지어낸 소리) → 거부. 멱등(이미 있으면 스킵, --overwrite).
// 실행: node scripts/dict/mnemonic-etym-apply.mjs --dir scripts/dict/mnem-etym [--commit] [--overwrite]
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const DIR = arg('--dir', 'scripts/dict/mnem-etym')
const COMMIT = process.argv.includes('--commit')
const OVERWRITE = process.argv.includes('--overwrite')
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
// 흔한 라틴/그리스 접두사(어원 텍스트에 하이픈형으로만 나올 수 있어 whitelist 허용)
const AFFIX = new Set(['ad', 'ab', 're', 'de', 'in', 'im', 'ex', 'e', 'con', 'com', 'co', 'pro', 'pre', 'per', 'sub', 'ob', 'se', 'dis', 'trans', 'inter', 'super', 'a', 'an', 'un', 'non', 'bi', 'tri', 'di', 'sym', 'syn', 'epi', 'peri', 'para', 'meta', 'anti', 'auto', 'homo', 'hetero'])

// chunk-NN.json 의 etymology_text 로드 (근거)
const etym = new Map()
for (const f of fs.readdirSync(DIR)) {
  if (!/^chunk-\d+\.json$/.test(f)) continue
  let arr; try { arr = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) } catch { continue }
  for (const e of arr) if (e && e.word) etym.set(e.word.toLowerCase(), norm(e.etymology_text || ''))
}

// 게이트 검사 → 통과분만 반환
function gate(word, mn) {
  if (!mn.includes('→')) return 'no-arrow'
  // 한글(한글) 소리 괄호 = 경선식 신호
  if (/[가-힣]\s*\([^)]*[가-힣]/.test(mn.replace(/[a-zA-Z]+\s*\(/g, 'X('))) {
    // 라틴토큰 괄호를 X로 치환 후에도 한글(한글 남으면 소리 괄호
    if (/[가-힣]\(/.test(mn.replace(/[a-zA-Z]+\(/g, 'X('))) return 'hangul-sound-paren'
  }
  // 라틴 어근 토큰 추출: 괄호 앞 로마자 + 체인 내 로마자
  const roots = [...mn.matchAll(/([a-zA-Z]{2,})\s*\(/g)].map((m) => m[1].toLowerCase())
  if (!roots.length) return 'no-latin-root'
  const et = etym.get(word)
  if (et == null) return 'no-etym-source'
  // 각 어근이 etymology_text 에 등장하는가(접사 whitelist 예외)
  const bad = roots.filter((r) => !AFFIX.has(r) && !et.includes(norm(r)))
  if (bad.length) return 'ungrounded:' + bad.join(',')
  return null // pass
}

const items = new Map()
const rej = { count: 0, reasons: {} }
let files = 0
for (const f of fs.readdirSync(DIR)) {
  if (!/\.out\.json$/.test(f)) continue
  files++
  let arr; try { arr = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) } catch { console.warn('parse fail', f); continue }
  if (!Array.isArray(arr)) continue
  for (const e of arr) {
    if (!e || typeof e.word !== 'string' || typeof e.mnemonic_ko !== 'string') { rej.count++; rej.reasons['malformed'] = (rej.reasons['malformed'] || 0) + 1; continue }
    const w = e.word.toLowerCase()
    const mn = e.mnemonic_ko.trim()
    if (!mn || mn.length > 140) { rej.count++; rej.reasons['len'] = (rej.reasons['len'] || 0) + 1; continue }
    const g = gate(w, mn)
    if (g) { rej.count++; const k = g.split(':')[0]; rej.reasons[k] = (rej.reasons[k] || 0) + 1; continue }
    items.set(w, mn)
  }
}
console.log(`files: ${files} · pass: ${items.size} · rejected: ${rej.count}`, rej.reasons)
if (!COMMIT) {
  console.log('DRY-RUN (--commit 로 적용). 통과 샘플:')
  let n = 0; for (const [w, mn] of items) { if (n++ >= 14) break; console.log(' ', w, '→', mn) }
  process.exit(0)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let updated = 0, skipped = 0, failed = 0
const entries = [...items.entries()], CONC = 12
const apply = async ([word, mn]) => {
  for (let t = 0; t < 4; t++) {
    const { data: cur } = await db.from('shared_dictionary').select('mnemonic_ko').eq('word', word).limit(1)
    if (!cur || !cur.length) { skipped++; return }
    if (!OVERWRITE && cur[0].mnemonic_ko && cur[0].mnemonic_ko.trim()) { skipped++; return }
    const { error } = await db.from('shared_dictionary').update({ mnemonic_ko: mn }).eq('word', word)
    if (!error) { updated++; return }
    await sleep(300 * (t + 1))
  }
  failed++
}
for (let i = 0; i < entries.length; i += CONC) {
  await Promise.all(entries.slice(i, i + CONC).map(apply))
  if ((i + CONC) % 240 < CONC) console.log(`  ${Math.min(i + CONC, entries.length)}/${entries.length} (updated ${updated}, skipped ${skipped}, failed ${failed})`)
}
console.log(`done. updated ${updated}, skipped ${skipped}, failed ${failed}`)
