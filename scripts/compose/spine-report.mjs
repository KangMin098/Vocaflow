// scripts/compose/spine-report.mjs
//
// 어휘 스파인 실측 — 두 가지를 잰다.
//
//  ① 축 건강성 — V-Level(정본)이 CEFR-J(정답지)와 아직도 맞는가, 사전 cefr_level 의 편향은
//     얼마인가, NGSL 과의 어긋남 중 파생형(단위 불일치)이 몇 %인가.
//     `spine.ts` 주석의 수치가 여기서 나온다. **문서의 수치를 근거로 쓰지 않기 위해** 다시 잰다.
//  ② 지문 적합성 — 재저작 글이 목표 학령 밴드를 어휘로 얼마나 넘는가.
//
// 지금은 **재기만 하고 막지 않는다.** 오늘 V-Level 점 목표를 ±2 로 막았다가 정상 글을
// 실패로 부른 일이 있었다 — 분포를 보기 전에 임계를 정하지 않는다.
//
// 실행: pnpm dlx tsx scripts/compose/spine-report.mjs [--batch <uuid>]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const bi = process.argv.indexOf('--batch')
const batchId = bi >= 0 ? process.argv[bi + 1] : null

const { createClient } = await import('@supabase/supabase-js')
const { GRADE_BANDS, LEARNING_TYPES, bandForVRange, profileBand, evaluateBand } =
  await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const sql = async (q) => {
  const { data, error } = await db.rpc('exec_sql_readonly', { q })
  if (error) throw new Error(error.message)
  return data
}

// ── ① 축 건강성 ────────────────────────────────────────────────────
console.log('■ 축 건강성\n')

// PostgREST 는 요청당 1,000행이 상한이다 —  은 조용히 1,000 으로 잘린다.
//   근거 수치를 재는 스크립트가 표본의 16%만 보고 "실측" 이라고 말하면 문서보다 나쁘다.
const cefrj = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('shared_dictionary')
    .select('cefrj_wordlist_band, v_level, cefr_level')
    .not('cefrj_wordlist_band', 'is', null)
    .not('v_level', 'is', null)
    // ⚠️ 정렬 없는 페이지네이션은 행을 중복시키고 그만큼 누락한다 — 이 저장소가 IA 수집에서
    //   이미 겪은 결함이다(정렬 없이 214건 중복). 안정 정렬 키를 반드시 준다.
    .order('word', { ascending: true })
    .range(from, from + 999)
  if (error) throw new Error('사전 조회 실패: ' + error.message)
  cefrj.push(...(data ?? []))
  if (!data || data.length < 1000) break
}

const byBand = new Map()
let exact = 0
for (const r of cefrj) {
  const a = byBand.get(r.cefrj_wordlist_band) ?? []
  a.push(r.v_level)
  byBand.set(r.cefrj_wordlist_band, a)
  if (r.cefr_level === r.cefrj_wordlist_band) exact++
}
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]
console.log('  CEFR-J ↔ V-Level (정본이 정답지를 아직 따라가는가)')
for (const band of [...byBand.keys()].sort()) {
  const vs = byBand.get(band)
  const avg = vs.reduce((s, v) => s + v, 0) / vs.length
  console.log(`    ${band}  n=${String(vs.length).padStart(5)}  V중앙값 ${median(vs)}  평균 ${avg.toFixed(2)}`)
}
const total = cefrj.length
console.log(
  `\n  사전 cefr_level ↔ CEFR-J 정확 일치 ${exact}/${total} (${((100 * exact) / total).toFixed(1)}%)` +
    ' — 밴드 판정에 쓰지 않는 근거',
)

// ── ② 지문 적합성 ──────────────────────────────────────────────────
console.log('\n■ 재저작 지문의 학령 밴드 적합성\n')

let q = db
  .from('library_articles')
  .select('id, title, composed_spec, word_count, article_v_level')
  .eq('source', 'original')
  .in('status', ['ready', 'published'])
if (batchId) q = q.eq('compose_batch_id', batchId)
const { data: arts } = await q

if (!arts?.length) {
  console.log('  재저작 지문이 없습니다.')
  process.exit(0)
}

for (const a of arts) {
  const track = a.composed_spec?.track
  const spec = track ? LEARNING_TYPES[track] : null
  if (!spec) {
    console.log(`▸ ${a.title}\n  유형을 알 수 없어 밴드를 고를 수 없습니다.\n`)
    continue
  }
  const band = bandForVRange(spec.vBand)

  // 이 글의 어휘와 V-Level — 처리 단계가 이미 뽑아 둔 것을 쓴다(다시 토큰화하지 않는다).
  const { data: vocab } = await db
    .from('library_article_vocabularies')
    .select('word, lemma')
    .eq('library_article_id', a.id)
  const keys = [...new Set((vocab ?? []).map((v) => (v.lemma ?? v.word ?? '').toLowerCase()))].filter(Boolean)
  const { data: dict } = keys.length
    ? await db.from('shared_dictionary').select('word, v_level').in('word', keys)
    : { data: [] }
  const vByWord = new Map((dict ?? []).map((d) => [d.word, d.v_level]))
  const words = keys.map((w) => ({ word: w, v: vByWord.get(w) ?? null }))

  const p = profileBand(words, band)
  const e = evaluateBand(p)

  console.log(`▸ ${a.title}`)
  console.log(
    `  유형 ${track} (V${spec.vBand.min}~${spec.vBand.max}) → 학령 ${GRADE_BANDS[band].label} (V≤${GRADE_BANDS[band].vRange.max})`,
  )
  console.log(
    `  어휘 ${p.known}개 판정 · 사전에 없음 ${p.unknown} · 밴드 초과 ${p.aboveBand} · 심화(V≥9) ${(p.deepShare * 100).toFixed(1)}%`,
  )
  console.log(`  [${e.verdict}] ${e.detail}`)
  if (p.offenders.length) {
    console.log(`  넘는 단어: ${p.offenders.slice(0, 10).map((o) => `${o.word}(V${o.v})`).join(' · ')}`)
  }
  console.log()
}
