// scripts/textbook/explain-probe.mjs
//
// **해설 커버리지를 실측한다.** 상업 교재 제작 8단계 중 6번(해답·해설)의 달성률이다.
//
// 분모는 **수능 형식으로 인쇄 가능한 문항 전체**다. 해설을 쓴 것만 세면 100%가 나오고
// 그건 아무것도 말하지 않는다. 형식 변환에서 떨어진 문항도 따로 보여 준다 — 거기가
// 해설 이전에 막힌 자리다.
//
// 재실행 안전: 읽기만 한다. DB 에 아무것도 쓰지 않는다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/explain-probe.mjs           # 숫자만
//   pnpm dlx tsx scripts/textbook/explain-probe.mjs --sample  # 실제 해설 몇 개도

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const showSample = process.argv.includes('--sample')

const { createClient } = await import('@supabase/supabase-js')
const { toCsatOrder, toCsatInsert, explainOrder, explainInsert, measureExplainCoverage } =
  await import('@vocaflow/library-pipeline')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── 낱말 희소도 ─────────────────────────────────────────────────────
// 해설의 어휘 사슬이 **흔한 낱말의 반복**을 근거로 세지 않게 하는 재료다.
// 사전에 없는 낱말은 가장 희귀한 쪽으로 본다(고유명사·전문어라 주제를 강하게 지시한다).
const vLevelOf = new Map()
for (let from = 0; ; from += 1000) {
  const { data, error: e } = await db
    .from('shared_dictionary')
    .select('word, v_level')
    .order('word')
    .range(from, from + 999)
  if (e) throw new Error('사전 조회 실패: ' + e.message)
  if (!data?.length) break
  for (const r of data) vLevelOf.set(String(r.word).toLowerCase(), r.v_level)
  if (data.length < 1000) break
}
const MAX_V = Math.max(...[...vLevelOf.values()].filter((v) => v != null))
const rarity = (w) => vLevelOf.get(w.toLowerCase()) ?? MAX_V

// 1,000행 조용한 절단에 두 번 당했다 — 페이지로 받는다.
const rows = []
for (let from = 0; ; from += 500) {
  const { data, error } = await db
    .from('csat_dcp_items')
    .select('id, type, payload, answer_key, v_level')
    .order('id')
    .range(from, from + 499)
  if (error) throw new Error('문항 조회 실패: ' + error.message)
  if (!data?.length) break
  rows.push(...data)
  if (data.length < 500) break
}

const explanations = []
const samples = []
const dropped = { order: 0, insert: 0 }
const noEvidence = []

for (const r of rows) {
  let item = null
  if (r.type === 'order') {
    item = toCsatOrder(r.payload?.presented ?? [], r.answer_key?.source_order ?? [])
    if (!item) {
      dropped.order++
      continue
    }
  } else {
    item = toCsatInsert(r.payload?.remaining ?? [], r.payload?.insert_sentence ?? '', r.answer_key?.position)
    if (!item) {
      dropped.insert++
      continue
    }
  }
  // ⚠️ **희소도를 넘기지 않는다.** 넘기면 커버리지가 6.9% → 6.2% 로 **떨어진다**(2026-08-21 실측).
  //   Cycle 2 에 "다음 레버는 희귀어 사슬" 이라고 적어 뒀는데 재 보니 틀렸다 — 흔한 낱말을
  //   빼면 오답 쪽 근거만 사라지는 게 아니라 **정답 쪽 근거도 같이 사라진다.**
  //   `rarity` 는 위에서 계산해 두고 여기서는 쓰지 않는다(다음 실험의 재료로 남긴다).
  const ex = r.type === 'order' ? explainOrder(item) : explainInsert(item)

  // **교차 검증** — 해설이 문항과 다른 답을 설명하면 그건 결함이다. 조용히 넘기지 않는다.
  if (ex.answer !== item.answer) {
    throw new Error(`해설이 다른 답을 설명한다: 문항 ${r.id} (문항 ${item.answer} vs 해설 ${ex.answer})`)
  }
  // **인용 검증** — 근거의 cue 는 지문에 실제로 있어야 한다.
  const passage =
    r.type === 'order'
      ? item.intro + ' ' + item.blocks.map((b) => b.sentences.join(' ')).join(' ')
      : item.body.join(' ') + ' ' + item.sentence
  for (const e of ex.evidence) {
    if (!passage.toLowerCase().includes(e.cue.toLowerCase())) {
      throw new Error(`지문에 없는 것을 인용했다: 문항 ${r.id} · "${e.cue}"`)
    }
  }

  explanations.push({ ...ex, type: r.type, v_level: r.v_level })
  if (!ex.body) noEvidence.push({ id: r.id, type: r.type })
  if (showSample && ex.body && samples.length < 6 && samples.filter((s) => s.type === r.type).length < 3) {
    samples.push({ id: r.id, type: r.type, item, body: ex.body })
  }
}

const c = measureExplainCoverage(explanations)
const pct = (x) => (100 * x).toFixed(1) + '%'
const line = '─'.repeat(72)

console.log(`${line}\n해설 커버리지 — 상업 교재 제작 6단계(해답·해설)\n`)
console.log(`  DB 문항                ${rows.length}`)
console.log(`  수능 형식 변환 실패    ${dropped.order + dropped.insert}  (순서 ${dropped.order} · 삽입 ${dropped.insert})`)
console.log(`  해설 분모              ${c.total}`)
console.log(`  **해설 생성            ${c.explained}  = ${pct(c.ratio)}**`)
console.log(`  근거 없어 안 씀        ${c.total - c.explained}`)

const byType = {}
for (const e of explanations) {
  byType[e.type] ??= { t: 0, x: 0 }
  byType[e.type].t++
  if (e.body) byType[e.type].x++
}
console.log('\n  유형별')
for (const [t, v] of Object.entries(byType)) {
  console.log(`    ${t.padEnd(8)} ${v.x}/${v.t}  ${pct(v.x / v.t)}`)
}

const KIND_KO = {
  first_mention: '한정사 전환 (a→the)',
  demonstrative: '지시어',
  connective: '연결어',
  pronoun: '대명사',
  lexical_repeat: '어휘 반복',
}
const totalEv = Object.values(c.byKind).reduce((s, n) => s + n, 0)
console.log(`\n  근거 종류별 (총 ${totalEv}건 · 강한 것부터)`)
for (const [k, n] of Object.entries(c.byKind)) {
  console.log(`    ${KIND_KO[k].padEnd(22)} ${String(n).padStart(5)}  ${pct(n / (totalEv || 1))}`)
}

const strong = c.byKind.first_mention + c.byKind.demonstrative
console.log(`\n  방향이 확정되는 근거(한정사 전환 + 지시어): ${strong}건 = ${pct(strong / (totalEv || 1))}`)

if (showSample) {
  for (const s of samples) {
    console.log(`\n${line}\n[${s.type}] 문항 ${s.id}`)
    if (s.type === 'order') {
      console.log(`\n  ${s.item.intro}\n`)
      for (const b of s.item.blocks) console.log(`  (${b.label}) ${b.sentences.join(' ')}\n`)
    } else {
      console.log(`\n  [넣을 문장] ${s.item.sentence}\n`)
      s.item.body.forEach((t, i) => {
        const slot = s.item.slots.indexOf(i + 1)
        console.log(`  ${t} ${slot >= 0 ? ['①', '②', '③', '④', '⑤'][slot] : ''}`)
      })
    }
    console.log('\n  ── 해설 ──')
    for (const l of s.body.split('\n')) console.log('  ' + l)
  }
}
