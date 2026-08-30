// scripts/textbook/market-benchmark.mjs
//
// **시중 교재 대비 우위 지수 — 같은 자로 잰다.**
//
// ── 왜 필요한가 ────────────────────────────────────────────────────
// "시중 교재보다 월등하게" 는 그 자체로는 목표가 아니다. 무엇을 얼마나 이겨야 하는지
// 숫자가 없으면 이겼는지 졌는지도 모른다. 이 저장소의 교재 목표값 상당수는 지금까지
// **통념이었다** — "수능 지문 90~200어" 는 실측이 아니라 들은 말이다.
//
// 그래서 기준선을 **실제 시중 교재 79종 5,214쪽에서 재서** `market-spec.json` 에 고정하고
// (scripts/textbook-corpus/market-spec.mjs), 여기서는 우리 산출물을 **그 자로** 잰다.
//
// 우위지수 = 우리 값 / 시장 값. 1.20 이상이면 그 축에서 120% 우위다.
// 종합은 산술평균이 아니라 **기하평균**이다 — 비율의 평균은 기하평균이고,
// 한 축이 0 에 가까우면 종합도 끌어내려야 맞다(해설이 없는 교재는 다른 게 좋아도 교재가 아니다).
//
// 재실행 안전: 읽기만 한다.
// 실행: node scripts/textbook/market-benchmark.mjs [--json] [--out <경로>]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')

const SPEC_PATH = path.resolve('packages/library-pipeline/src/textbook/market-spec.json')
const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'))

/**
 * V-Level → 시장 규격 버킷. `series.ts` 의 사다리를 따른다
 * (V1 초등 저학년 · V2 초등 고학년 · V3 중1-2 · V4 중3 · V5 고1 · V6 고2 · V7 고3).
 *
 * ⚠️ 표본이 얇은 버킷이 있다(중2 11 · 중3 30). 얇은 곳은 이웃 버킷으로 보낸다 —
 *    없는 규격을 있는 척하는 것보다, 어디를 빌려 왔는지 적는 편이 낫다.
 */
const V_TO_BUCKET = {
  1: '초6', 2: '초6', 3: '중1', 4: '중1', 5: '고1', 6: '고2', 7: '고2', 8: '고2', 9: '고2',
}

/** 지문 어수가 필요한(= 지문을 통째로 싣는) 유형. 문장 단위 유형은 이 축에서 뺀다. */
const PASSAGE_TEXT_KEYS = ['passage', 'remaining', 'sentences', 'intro']

function passageWords(payload) {
  let text = ''
  for (const k of PASSAGE_TEXT_KEYS) {
    const v = payload?.[k]
    if (typeof v === 'string') text += ` ${v}`
    else if (Array.isArray(v)) text += ` ${v.map((x) => (typeof x === 'string' ? x : x?.text ?? '')).join(' ')}`
  }
  if (typeof payload?.insert_sentence === 'string') text += ` ${payload.insert_sentence}`
  if (!text.trim()) return null
  return (text.match(/[A-Za-z][A-Za-z'-]*/g) || []).length
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

async function fetchAll() {
  const rows = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    // ⚠️ **정렬 없이 페이지를 넘기면 안 된다.** Postgres 는 ORDER BY 가 없으면 순서를
    //    보장하지 않으므로, 페이지마다 같은 행이 또 나오고 그만큼 다른 행이 빠진다.
    //    2026-08-30 에 재고가 13만 행으로 늘자 이것이 터졌다 — 희귀 유형이 표본에서
    //    통째로 빠져 A5(유형 다양성)가 14/14 에서 **8/14 로 보였다.** 재고는 그대로였다.
    //    (이 저장소가 IA 수집에서 이미 겪은 버그다 — CLAUDE.md §PDCP `sort[]=identifier asc`.)
    const { data, error } = await supabase
      .from('csat_dcp_items')
      .select('type,v_level,payload,answer_key')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

function ratio(ours, market) {
  if (market === 0) return null
  return Number((ours / market).toFixed(3))
}

const items = await fetchAll()
const total = items.length

// ── A1 해설 보유율 ────────────────────────────────────────────────
// 시장 기준선 1.00 — 해설지를 내는 교재는 전 문항에 해설이 붙는다(`spec.explanation.note`).
// ⚠️ 해설은 **두 이름으로 산다** — 결정론/배치는 `explanation_ko`, 생성형 드레인은
// `rationale_ko`. 둘 다 학습자 화면(`DcpPlayer`)과 조판(`render-volume`)이 읽는다.
// 한쪽만 세면 534문항의 해설이 있는데도 "없음" 으로 잡힌다.
const explanationOf = (i) => i.answer_key?.explanation_ko || i.answer_key?.rationale_ko || null
const withExplain = items.filter((i) => explanationOf(i))
const A1 = { ours: withExplain.length / total, market: 1.0 }

// ── A2 해설 규격 적합률 ───────────────────────────────────────────
// 시장 해설 길이 p25~p90 구간 안에 드는 비율. 정의상 시장 자신은 0.65 다.
const LO = spec.explanation.lengthChars.p25
const HI = spec.explanation.lengthChars.p90
const inSpecLen = withExplain.filter((i) => {
  const L = explanationOf(i).length
  return L >= LO && L <= HI
}).length
const A2 = { ours: withExplain.length ? inSpecLen / withExplain.length : 0, market: 0.65 }

// ── A3 오답 배제 언급률 ───────────────────────────────────────────
const WRONG_RE = /오답|나머지|적절하지 않|틀린 이유|[①②③④⑤]/
const A3 = {
  ours: withExplain.length
    ? withExplain.filter((i) => WRONG_RE.test(explanationOf(i))).length / withExplain.length
    : 0,
  market: spec.explanation.wrongOptionMentionRate,
}

// ── A4 원문 인용률 ────────────────────────────────────────────────
const CITE_RE = /[A-Za-z]{4,}[^가-힣]{0,3}[A-Za-z]{4,}/
const A4 = {
  ours: withExplain.length
    ? withExplain.filter((i) => CITE_RE.test(explanationOf(i))).length / withExplain.length
    : 0,
  market: spec.explanation.sourceCitationRate,
}

// ── A5 유형 다양성 ────────────────────────────────────────────────
// 두 가지를 함께 본다:
//   ① **관문** — 시장 표준 유형을 다 갖췄는가. 하나라도 없으면 시험 대비 교재가 아니다.
//   ② **폭**   — 표준 밖 유형까지 몇 종을 다루는가. 여기가 기능 우위가 나는 자리다.
// 폭만 세면 "표준 5종이 없는데 잡다한 20종이 있다" 도 우위로 보인다. 그래서 **관문을 못 넘으면
// 폭을 관문 값으로 눌러 둔다** — 못 넘은 채로 이겼다고 적지 않기 위해서다.
const marketTypes = new Set(spec.questionStems.map((s) => s.ourType).filter(Boolean))
const ourTypes = new Set(items.map((i) => i.type))
const covered = [...marketTypes].filter((t) => ourTypes.has(t))
const beyond = [...ourTypes].filter((t) => !marketTypes.has(t))
const gate = covered.length / marketTypes.size
const A5 = {
  ours: gate >= 1 ? ourTypes.size : covered.length,
  market: marketTypes.size,
  gate,
}

// ── A6 지문 어수 규격 적합률 ──────────────────────────────────────
// 시장 p10~p90 안에 드는 비율. 정의상 시장 자신은 0.80 이다.
let a6In = 0
let a6Total = 0
const a6ByBucket = {}
for (const it of items) {
  const w = passageWords(it.payload)
  if (w == null || w < 10) continue          // 문장 단위 유형은 이 축 밖이다
  const bucket = V_TO_BUCKET[it.v_level]
  const s = bucket && spec.passageWords[bucket]
  if (!s) continue
  a6Total += 1
  const ok = w >= s.words.p10 && w <= s.words.p90
  if (ok) a6In += 1
  a6ByBucket[bucket] ??= { in: 0, total: 0, p10: s.words.p10, p90: s.words.p90 }
  a6ByBucket[bucket].total += 1
  if (ok) a6ByBucket[bucket].in += 1
}
const A6 = { ours: a6Total ? a6In / a6Total : 0, market: 0.80 }

// ── A7 선택지 수 규격 적합률 ──────────────────────────────────────
// 학교급마다 시장의 지배값이 있다(초·중·고 모두 5지선다 — 중등 93.8%).
// `middle-choice.ts` 는 "중등 4지선다" 라고 적고 4,135문항을 그렇게 만들었는데,
// 그 문장에는 근거가 없었고 실측은 반대였다. 그래서 축으로 세워 다시 잊히지 않게 한다.
const VBAND_SCHOOL = (v) => (v == null ? null : v <= 2 ? '초등' : v <= 4 ? '중등' : '고등')
let a7In = 0
let a7Total = 0
const a7ByType = {}
for (const it of items) {
  const choices = it.payload?.choices ?? it.payload?.underlines
  if (!Array.isArray(choices) || choices.length < 3) continue
  const school = VBAND_SCHOOL(it.v_level)
  const want = spec.choiceCount?.[school]?.dominant
  if (!want) continue
  a7Total += 1
  const ok = choices.length === want
  if (ok) a7In += 1
  a7ByType[it.type] ??= { ok: 0, total: 0, want, seen: {} }
  a7ByType[it.type].total += 1
  if (ok) a7ByType[it.type].ok += 1
  a7ByType[it.type].seen[choices.length] = (a7ByType[it.type].seen[choices.length] ?? 0) + 1
}
// 시장 자신도 100% 는 아니다 — 지배값 비율을 기준선으로 쓴다(중등 0.938 등).
const a7Market = Object.values(spec.choiceCount ?? {}).length
  ? Object.values(spec.choiceCount).reduce((a, c) => a + c.fiveChoiceRate, 0)
    / Object.values(spec.choiceCount).length
  : 0.85
const A7 = { ours: a7Total ? a7In / a7Total : 0, market: Number(a7Market.toFixed(3)) }

const AXES = [
  { id: 'A1', name: '해설 보유율', ...A1, unit: '%', why: '해설이 없으면 혼자 공부할 수 없다 — 시장이 교재를 고르는 첫 기준' },
  { id: 'A2', name: `해설 길이 규격 적합률 (${LO}~${HI}자)`, ...A2, unit: '%', why: '짧으면 근거가 없고 길면 안 읽는다. 시장 p25~p90 구간' },
  { id: 'A3', name: '오답 배제 언급률', ...A3, unit: '%', why: '왜 다른 것이 아닌지까지 써야 해설의 깊이가 된다' },
  { id: 'A4', name: '원문 인용률', ...A4, unit: '%', why: '지문에서 근거를 끌어와야 검증 가능한 해설이다' },
  { id: 'A5', name: '유형 다양성 (표준 대비)', ...A5, unit: '종', why: '표준 유형을 다 갖춘 뒤의 폭이 기능 우위다 — 관문을 못 넘으면 폭을 인정하지 않는다' },
  { id: 'A6', name: '지문 어수 규격 적합률', ...A6, unit: '%', why: '학년대별 지문 길이가 규격 밖이면 시험지에 못 싣는다' },
  { id: 'A7', name: '선택지 수 규격 적합률', ...A7, unit: '%', why: '학교급마다 시장 지배값이 있다 — 어긋나면 그 학년 시험지가 아니다' },
].map((a) => ({ ...a, index: ratio(a.ours, a.market) }))

// 종합은 기하평균 — 한 축이 0 에 가까우면 종합도 끌려 내려가야 맞다.
const idx = AXES.map((a) => a.index).filter((x) => x != null && x > 0)
const overall = idx.length === AXES.length
  ? Number(Math.exp(idx.reduce((s, x) => s + Math.log(x), 0) / idx.length).toFixed(3))
  : null

const report = {
  generatedAt: new Date().toISOString(),
  specGeneratedAt: spec.generatedAt,
  corpus: spec.provenance,
  itemsMeasured: total,
  axes: AXES,
  overallIndex: overall,
  overallNote: overall == null
    ? '한 축 이상이 0 이라 기하평균을 낼 수 없다 — 그 축이 곧 할 일이다'
    : null,
  detail: {
    explanationsByType: Object.entries(
      items.reduce((m, i) => {
        m[i.type] ??= { items: 0, explained: 0 }
        m[i.type].items += 1
        if (explanationOf(i)) m[i.type].explained += 1
        return m
      }, {}),
    )
      .map(([type, v]) => ({ type, ...v, pct: Number((100 * v.explained / v.items).toFixed(1)) }))
      .sort((a, b) => b.items - a.items),
    passageSpecByBucket: a6ByBucket,
    choiceCountByType: a7ByType,
    typesBeyondMarket: beyond.sort(),
    marketTypesMissing: [...marketTypes].filter((t) => !ourTypes.has(t)).sort(),
  },
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  const pct = (x) => `${(x * 100).toFixed(1)}%`
  console.log('시중 교재 대비 우위 지수')
  console.log(`  기준선: ${spec.provenance.documentsMeasured}종 · ${spec.provenance.pagesMeasured.toLocaleString()}쪽 (실측 ${spec.generatedAt.slice(0, 10)})`)
  console.log(`  대상  : csat_dcp_items ${total.toLocaleString()}문항\n`)
  console.log('  축                                 시중      우리     지수')
  console.log('  ' + '─'.repeat(62))
  for (const a of AXES) {
    const fmt = a.unit === '%' ? pct : (x) => `${x}종`
    const mark = a.index >= 1.2 ? '✅' : a.index >= 1.0 ? '△' : '❌'
    console.log(`  ${a.id} ${a.name.padEnd(30)} ${fmt(a.market).padStart(7)} ${fmt(a.ours).padStart(8)} ${String(a.index).padStart(7)} ${mark}`)
  }
  console.log('  ' + '─'.repeat(62))
  console.log(`  종합(기하평균) ${overall ?? '—'}   목표 1.200\n`)
  console.log('  유형별 해설 보유율 (하위 8):')
  for (const t of report.detail.explanationsByType.slice(0, 8)) {
    console.log(`    ${t.type.padEnd(16)} ${String(t.explained).padStart(5)}/${String(t.items).padEnd(6)} ${String(t.pct).padStart(5)}%`)
  }
  if (report.detail.marketTypesMissing.length) {
    console.log(`\n  ⚠ 시장에 있고 우리에 없는 유형: ${report.detail.marketTypesMissing.join(', ')}`)
  }
  console.log(`  시장 표준 밖 우리 유형 ${report.detail.typesBeyondMarket.length}종: ${report.detail.typesBeyondMarket.join(', ')}`)
}

const outFlag = process.argv.indexOf('--out')
if (outFlag >= 0 && process.argv[outFlag + 1]) {
  fs.writeFileSync(process.argv[outFlag + 1], `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}
