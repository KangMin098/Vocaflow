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
const TEMPLATE = process.argv.includes('--template')

/** 자동 생성 템플릿 예문의 표식 — dump 대상 선정과 apply 덮어쓰기 조건에 **같은 정의**를 쓴다. */
const TEMPLATE_OR = [
  'example_en.ilike.*uses the expression*',
  'example_en.ilike.This word*', 'example_en.ilike.The word*',
  'example_en.ilike.This term*', 'example_en.ilike.The term*',
  'example_en.ilike.This phrase*', 'example_en.ilike.The phrase*',
  'example_en.ilike.*in conversation.', 'example_en.ilike.*in a conversation.',
  'example_en.ilike.*in a sentence.', 'example_en.ilike.*in sentence.',
].join(',')

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
      .or(TEMPLATE ? TEMPLATE_OR : 'example_en.is.null,example_en.eq.')
      .order('word')
      .range(from, from + 999)
    if (error) { console.error('query fail', error.message); process.exit(1) }
    rows.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  // 템플릿 모드는 **나쁜 값을 고치는 것**이라 형태·register 로 거르지 않는다.
  // (2026-08-25 실측 212행 중 140이 관용어 · 109가 phrase_unit — 결측 모드의 필터를 그대로 쓰면
  //  대부분이 대상에서 빠진다. 두 모드는 대상 정의가 다르다.)
  const targets = rows
    .filter((r) => TEMPLATE || (/^[a-z]+$/.test(r.word) && !NOISE.includes(r.word_register || 'standard')))
    .map((r) => ({ w: r.word, pos: r.pos, m: r.meaning_ko, v: r.v_level, ...(TEMPLATE ? { bad: r.example_en } : {}) }))
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
      // 표제어가 예문에 실제로 쓰였는지 — **내용어 토큰이 하나라도** 들어 있으면 통과.
      //   이 검사의 목적은 "표제어를 안 쓴 게으른 예문" 을 걸러내는 것이지 구문 분석이 아니다.
      //   더 엄하게 걸면 관용어가 통째로 오탈락한다:
      //     · 어간 통째 요구 → "(every) now and again/then" 은 괄호·슬래시가 **선택지 표기**라
      //       한 문장이 모든 갈래를 담을 수 없다
      //     · 가장 긴 토큰 요구 → 그 토큰이 대개 **자리표시자**(somebody·something)다.
      //       실제로 이 규칙으로 43건 중 14건이 오탈락했고 전부 자리표시자 때문이었다.
      const PLACEHOLDER = new Set(['somebody', 'something', 'someone', 'oneself', 'somewhere', 'etc'])
      const FUNCTION_WORD = new Set([
        'with', 'from', 'that', 'this', 'than', 'then', 'into', 'onto', 'over', 'under',
        'about', 'your', 'their', 'have', 'been', 'does', 'doing', 'being',
      ])
      const content = w
        .split(/[^a-z]+/)
        .filter((t) => t.length >= 4 && !PLACEHOLDER.has(t) && !FUNCTION_WORD.has(t))
      const exLower = ex.toLowerCase()
      const usesHeadword = content.length === 0 || content.some((t) => exLower.includes(t))
      if (ex.length < 6 || ex.length > 240 || hasHangul(ex) || !usesHeadword) { bad++; console.warn('reject', w, '→', ex.slice(0, 60)); continue }
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
    // 대상 조건을 dump 와 **같은 정의**로 건다 → 멱등.
    //   결측 모드: 아직 빈 행만. 템플릿 모드: 아직 템플릿 문장인 행만
    //   (한 번 갈아 끼우면 패턴에 안 걸리므로 다시 돌려도 아무 일도 안 일어난다).
    const { data, error } = await db
      .from('shared_dictionary')
      .update({ example_en: ex })
      .eq('word', w)
      .or(TEMPLATE ? TEMPLATE_OR : 'example_en.is.null,example_en.eq.')
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
