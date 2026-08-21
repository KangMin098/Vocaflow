// scripts/dict/csat-dict-health.mjs
//
// **사전 DB 정합성 검사 — 이번 기출 코퍼스 작업이 남긴 격차를 숫자로 잰다.**
// 읽기 전용. 통과/실패를 종료 코드로 돌려주므로 CI·회귀에도 쓸 수 있다.
//
// 왜 기준선을 하드코딩하지 않는가: 임계값을 짐작으로 정하면 목표가 아니라 짐작이 된다.
// **전체 사전의 실제 채움률**과 **kice 밖 대조군의 실제 drift** 를 매번 다시 재서 기준으로 쓴다.
//
// 실행: pnpm dlx tsx scripts/dict/csat-dict-health.mjs

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

/** 이번 드레인이 넣은 행을 가리키는 조건 — 다른 출처를 검사에 끌어들이지 않는다. */
// ── 채움률 기준선 (전체 사전) ────────────────────────────────────────
async function fillRates(filter) {
  const cols = ['primary_pos', 'v_level', 'ipa', 'example_en']
  const out = {}
  let base = db.from('shared_dictionary').select('*', { count: 'exact', head: true })
  if (filter) base = filter(base)
  const { count: total, error: e0 } = await base
  if (e0) throw new Error('총계 조회 실패: ' + e0.message)
  out._total = total
  for (const c of cols) {
    let qq = db.from('shared_dictionary').select('*', { count: 'exact', head: true }).not(c, 'is', null)
    if (filter) qq = filter(qq)
    const { count, error } = await qq
    if (error) throw new Error(`${c} 조회 실패: ` + error.message)
    out[c] = count
  }
  // 배열/jsonb 는 not-null 만으로는 못 잰다 — 빈 배열/빈 객체를 걸러야 한다.
  let ps = db.from('shared_dictionary').select('*', { count: 'exact', head: true }).not('pos_set', 'eq', '{}')
  if (filter) ps = filter(ps)
  const { count: posSet, error: e1 } = await ps
  if (e1) throw new Error('pos_set 조회 실패: ' + e1.message)
  out.pos_set = posSet
  let fp = db.from('shared_dictionary').select('*', { count: 'exact', head: true }).neq('field_provenance', '{}')
  if (filter) fp = filter(fp)
  const { count: prov, error: e2 } = await fp
  if (e2) throw new Error('field_provenance 조회 실패: ' + e2.message)
  out.field_provenance = prov
  return out
}

const all = await fillRates(null)
const drain = await fillRates((qq) =>
  qq.eq('classified_by', 'claude_code_opus_5').eq('source', 'ai-generated').contains('list_tags', ['kice-csat-13y']),
)

const pct = (n, d) => (d ? (100 * n) / d : 0)
const checks = []
const addFill = (key, label) => {
  const baseline = pct(all[key], all._total)
  const actual = pct(drain[key], drain._total)
  checks.push({
    id: label,
    pass: actual >= baseline,
    detail: `${actual.toFixed(1)}% (${drain[key]}/${drain._total}) · 기준 전체 ${baseline.toFixed(1)}%`,
  })
}
addFill('primary_pos', 'C1 신규행 primary_pos')
addFill('pos_set', 'C2 신규행 pos_set')
addFill('v_level', 'C3 신규행 v_level')
addFill('field_provenance', 'C4 신규행 field_provenance')

// ── C5: kice 낱말의 v_level_rule_v1 이 현재 룰과 어긋난 비율 ─────────
// 기준은 kice 밖 대조군에서 같은 방식으로 잰 값 — 하드코딩하지 않는다.
// `calc_v_level` 을 낱말마다 부르므로 **표본**으로 잰다(전수는 왕복이 1만 번을 넘는다).
// 새 집계 함수를 만들면 마이그레이션이 되고, 검사 하나 때문에 스키마를 늘리지 않는다.
const SAMPLE = Number(process.env.HEALTH_SAMPLE ?? 250)

async function driftSample(inKice) {
  const kiceLemmas = new Set(freqLemmas)
  const pool = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('shared_dictionary')
      .select('word, v_level_rule_v1')
      .order('word', { ascending: true })
      .range(from, from + 999)
    if (error) throw new Error('표본 조회 실패: ' + error.message)
    for (const r of data) if (kiceLemmas.has(r.word) === inKice) pool.push(r)
    if (data.length < 1000) break
  }
  // 결정적 표본 — 매 실행이 같은 낱말을 보게 해 수치가 흔들리지 않는다.
  // ⚠️ 위 조회에 order 가 없으면 페이지 순서가 보장되지 않아 표본이 매번 달라진다(실측: 대조군 13.2%↔23.2%).
  pool.sort((a, b) => a.word.localeCompare(b.word))
  const step = Math.max(1, Math.floor(pool.length / SAMPLE))
  const picked = pool.filter((_, i) => i % step === 0).slice(0, SAMPLE)
  let drifted = 0
  for (const r of picked) {
    const { data, error } = await db.rpc('calc_v_level', { p_word: r.word })
    if (error) throw new Error('calc_v_level 실패: ' + error.message)
    if ((data ?? null) !== (r.v_level_rule_v1 ?? null)) drifted += 1
  }
  return { n: picked.length, drifted, pct: picked.length ? (100 * drifted) / picked.length : 0 }
}

const freqLemmas = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from('lexicon_frequencies').select('lemma').eq('source_id', 1).range(from, from + 999)
  if (error) throw new Error('kice lemma 조회 실패: ' + error.message)
  freqLemmas.push(...data.map((d) => d.lemma))
  if (data.length < 1000) break
}
const kiceDrift = await driftSample(true)
const ctlDrift = await driftSample(false)
checks.push({
  id: 'C5 v_level_rule_v1 drift',
  pass: kiceDrift.pct <= ctlDrift.pct,
  detail: `kice ${kiceDrift.pct.toFixed(1)}% (${kiceDrift.drifted}/${kiceDrift.n}) · 대조군 ${ctlDrift.pct.toFixed(1)}% (${ctlDrift.drifted}/${ctlDrift.n})`,
})

// ── C6: 코퍼스와 DB 의 등장 연도가 어긋난 행 ─────────────────────────
const norm = JSON.parse(fs.readFileSync('scripts/dict/csat-corpus/normalized.json', 'utf8'))
const byLemma = new Map(norm.rows.map((r) => [r.lemma, r.years_appeared.join(',')]))
const freq = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('lexicon_frequencies')
    .select('lemma, metadata')
    .eq('source_id', 1)
    .range(from, from + 999)
  if (error) throw new Error('빈도 조회 실패: ' + error.message)
  freq.push(...data)
  if (data.length < 1000) break
}
let mismatch = 0
for (const f of freq) {
  if ((f.metadata?.evidence ?? '') !== 'corpus_v1') continue
  const want = byLemma.get(f.lemma)
  const got = (f.metadata?.years_appeared ?? []).join(',')
  if (want !== undefined && want !== got) mismatch += 1
}
checks.push({ id: 'C6 등장연도 불일치', pass: mismatch === 0, detail: `${mismatch}건` })

// ── C7: 문서가 주장하는 채움률이 실측과 맞는가 ───────────────────────
// DB_SCHEMA.md 가 `ipa_uk/us 100%` 라고 적고 있었으나 실측은 0 이었다(2026-08-21).
const { count: ipaUk } = await db.from('shared_dictionary').select('*', { count: 'exact', head: true }).not('ipa_uk', 'is', null)
const schema = fs.readFileSync('docs/DB_SCHEMA.md', 'utf8')
// 표 줄만 본다 — 과거 주장을 인용해 설명한 본문까지 세면 고쳐도 영원히 실패한다(실측).
const tableRow = schema.split('\n').find((l) => l.startsWith('| `shared_dictionary` |')) ?? ''
const claims100 = /ipa_uk\/(?:ipa_)?us\s*100%/.test(tableRow)
checks.push({
  id: 'C7 문서 주장 = 실측',
  pass: !(claims100 && ipaUk === 0),
  detail: claims100 ? `DB_SCHEMA 는 ipa_uk/us 100% 라 적었는데 실측 ${ipaUk}행` : `실측 ipa_uk ${ipaUk}행 · 문서에 100% 주장 없음`,
})

const passed = checks.filter((c) => c.pass).length
console.log('── 사전 DB 정합성 ──────────────────────────────────')
for (const c of checks) console.log(`${c.pass ? '✅' : '❌'} ${c.id.padEnd(28)} ${c.detail}`)
console.log('')
console.log(`달성률 ${((100 * passed) / checks.length).toFixed(0)}%  (${passed}/${checks.length})`)
console.log(`참고 — ipa 는 data/cmudict/ 가 없어 검사 대상에서 제외(외부 데이터 필요)`)
process.exit(passed === checks.length ? 0 : 1)
