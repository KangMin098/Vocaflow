// scripts/dict/example-fill.mjs
// 추출 대상 단일 단어 중 example_en 결측분을 채운다(사전급 예문 품질 완비).
//   dump : 대상(단일 소문자어 · classified · v_level · 노이즈 register 제외 · example 결측)을
//          청크 파일(chunk-NN.json = [{w,pos,m,v}...])로 분할 → 서브에이전트 authoring 입력.
//   apply: 서브에이전트 결과(*.out.json = [{word,example_en}...]) 검증 후 shared_dictionary UPDATE.
//     검증: 문자열·길이 6~240·한글 없음·단어 stem 포함. 실패는 스킵 로그. 결측 행만 갱신(멱등).
// 실행: node scripts/dict/example-fill.mjs dump  --dir <DIR> [--chunk 43]
//       node scripts/dict/example-fill.mjs apply --dir <DIR> [--commit]
import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MODE = process.argv[2]
const DIR = arg('--dir', 'scratch-exfill')
const CHUNK = parseInt(arg('--chunk', '43'), 10)
const COMMIT = process.argv.includes('--commit')

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

const NOISE = ['archaic_literary', 'period_cultural', 'phrase_unit', 'brand', 'abbreviation', 'proper_noun']

if (MODE === 'dump') {
  // 대상 조회 — example 결측을 서버측 필터로 좁히고(≈1.8K) 페이지네이션(PostgREST 1000행/req 상한).
  //   RPC 게이트(classified·v_level·register)와 동일 조건 · 단일 소문자어.
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('shared_dictionary')
      .select('word,pos,meaning_ko,v_level,word_register,example_en')
      .not('classified_by', 'is', null)
      .not('v_level', 'is', null)
      .or('example_en.is.null,example_en.eq.')
      .order('word')
      .range(from, from + 999)
    if (error) { console.error('query fail', error.message); process.exit(1) }
    rows.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  const targets = rows.filter((r) =>
    /^[a-z]+$/.test(r.word) &&
    !NOISE.includes(r.word_register || 'standard'),
  ).map((r) => ({ w: r.word, pos: r.pos, m: r.meaning_ko, v: r.v_level }))
  fs.mkdirSync(DIR, { recursive: true })
  let n = 0
  for (let i = 0; i < targets.length; i += CHUNK) {
    const chunk = targets.slice(i, i + CHUNK)
    const name = `chunk-${String(n).padStart(2, '0')}.json`
    fs.writeFileSync(path.join(DIR, name), JSON.stringify(chunk, null, 2))
    n++
  }
  console.log(`targets: ${targets.length} · chunks: ${n} → ${DIR}`)
  process.exit(0)
}

if (MODE === 'apply') {
  const hasHangul = (s) => /[가-힣]/.test(s)
  const items = new Map() // word → example_en
  let files = 0, bad = 0
  for (const f of fs.readdirSync(DIR)) {
    if (!/\.out\.json$/.test(f)) continue
    files++
    let arr
    try { arr = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) } catch { console.warn('parse fail', f); continue }
    if (!Array.isArray(arr)) continue
    for (const e of arr) {
      const w = typeof e?.word === 'string' ? e.word.toLowerCase().trim() : null
      const ex = typeof e?.example_en === 'string' ? e.example_en.trim() : null
      if (!w || !ex) { bad++; continue }
      const stem = w.slice(0, Math.max(4, w.length - 2))
      if (ex.length < 6 || ex.length > 240 || hasHangul(ex) || !ex.toLowerCase().includes(stem)) { bad++; console.warn('reject', w, '→', ex.slice(0, 60)); continue }
      items.set(w, ex)
    }
  }
  console.log(`files: ${files} · valid: ${items.size} · rejected: ${bad}`)
  if (!COMMIT) {
    console.log('DRY-RUN (--commit 로 적용). 샘플:')
    let n = 0; for (const [w, ex] of items) { if (n++ >= 10) break; console.log(' ', w, '→', ex) }
    process.exit(0)
  }
  let done = 0, failed = 0
  for (const [w, ex] of items) {
    // 결측 행만 갱신(멱등) — 이미 채워졌으면 건너뜀
    const { data, error } = await db
      .from('shared_dictionary')
      .update({ example_en: ex })
      .eq('word', w)
      .or('example_en.is.null,example_en.eq.')
      .select('word')
    if (error) { failed++; console.warn('update fail', w, error.message); continue }
    if (data && data.length) done++
  }
  console.log(`applied: ${done} · failed: ${failed}`)

  // 발행 단어장으로 전파. 이 한 줄이 없어서 2026-08-25 에 발행 세트 998개 8,171행이
  // 예문 없이 남아 있었다 — `shared_words` 는 발행 시점 스냅샷이라 나중에 채운 사전 예문이
  // 저절로 반영되지 않는다. 빈 칸만 채우므로 몇 번 돌려도 결과가 같다(재실행 안전).
  const { data: synced, error: syncErr } = await db.rpc('sync_published_set_examples', { p_set_id: null })
  if (syncErr) console.warn(`발행 세트 전파 실패: ${syncErr.message} — SELECT sync_published_set_examples() 를 직접 실행할 것`)
  else console.log(`발행 세트 전파: ${synced ?? 0}행`)

  process.exit(0)
}

console.error('usage: example-fill.mjs dump|apply --dir <DIR> [--chunk N] [--commit]')
process.exit(1)
