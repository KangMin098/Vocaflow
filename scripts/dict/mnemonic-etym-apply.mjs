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

// 영어 파생 접미사(라틴 어원엔 없어도 정상) — 근거 대상서 제외
const ENG_SUFFIX = new Set(['ist', 'able', 'ible', 'fy', 'ify', 'al', 'ic', 'ical', 'ous', 'ize', 'ise', 'ment', 'tion', 'sion', 'er', 'or', 'ity', 'ness', 'ate', 'ive', 'ary', 'ory', 'ism', 'ish', 'ful', 'less', 'ly', 'ance', 'ence', 'ent', 'ant', 'age', 'ship', 'hood', 'dom', 'ward', 'wise', 'ee', 'ade', 'let'])
// 게이트: 경선식(발음 소리흉내)만 차단 — "어원 근거 어근이 하나라도 있으면 통과"
//   경선식은 진짜 라틴 어근이 0개(뜻 없는 한글 소리)라 아래를 못 넘김.
function gate(word, mn) {
  if (!mn.includes('→')) return 'no-arrow'
  const et = etym.get(word)
  if (et == null) return 'no-etym-source'
  // 괄호 앞 토큰(유니코드·매크론 포함, 접두어 표기 trailing '-' 허용) → diacritic strip. 선행 '-'=접미사.
  const toks = [...mn.matchAll(/(-?)(\p{L}{2,})-?\s*\(/gu)].map((m) => ({ suf: m[1] === '-', t: norm(m[2]) }))
  const roman = toks.filter((x) => /^[a-z]+$/.test(x.t)) // 정규화 후 로마자 = 라틴/그리스 어근
  if (!roman.length) return 'no-latin-root' // 로마자 어근 0 = 순수 한글 소리흉내(경선식)
  // 어간 매칭(굴절 변이 흡수): 어근 전체 or 앞 4글자가 etymology_text 에 등장
  const grounds = (r) => et.includes(r) || (r.length >= 4 && et.includes(r.slice(0, 4)))
  const grounded = roman.some((x) => !x.suf && !ENG_SUFFIX.has(x.t) && !AFFIX.has(x.t) && grounds(x.t))
  if (grounded) return null // 어원 근거 어근 ≥1 → 통과
  const hasContent = roman.some((x) => !x.suf && !ENG_SUFFIX.has(x.t) && !AFFIX.has(x.t))
  return hasContent ? 'ungrounded' : null // 접사만이면 관대 통과
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
