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
// ── ⚠️ 무엇을 무엇과 비교하는가 (실측 2026-08-31) ───────────────────
// 기본 모드는 **우리 창고 전체**(`csat_dcp_items` 42만 문항)를 잰다. 그런데 기준선은
// 시중 교재의 **인쇄된 쪽**이다 — 인쇄물에는 걸러지고 남은 것만 실린다. 창고와 인쇄물을
// 견주면 우리 쪽만 불리하게 나온다:
//
//   A1 해설 보유율   창고 94.8%   ↔   같은 시점 조판한 V5 한 권 **120/120 = 100%**
//   A6 지문 어수     창고 88.3%   ↔   같은 권 자동검수 **규격 밖 0 = 100%**
//
// 조립기(`composeUnits`)가 규격 밖을 이미 거르므로 **창고의 미달은 인쇄물에 안 실린다.**
// 그래서 `--volume <band>` 를 둔다 — `loadVolume` 이 실제로 고른 문항만 같은 자로 잰다.
// 두 값을 다 봐야 한다: 창고 값은 **재고 품질**, 권 값은 **출간물 품질**이다.
// (같은 종류의 단위 오류를 이 저장소가 이미 한 번 겪었다 — "지문 수" 를 "원문 수" 로 센 일.)
//
// ── 축의 천장 ───────────────────────────────────────────────────────
// 지수 = 우리/시장이므로 **시장 값이 천장을 정한다.** 실측 기준선에서:
//   A1 시장 100.0%  → 우리가 만점이어도 지수 **1.000**. 120% 는 산술적으로 불가능하다.
//   A7 시장  86.1%  → 천장 **1.161**. 우리는 이미 100% 라 더 올릴 것이 없다.
//   A6 시장  80.0%  → 천장 1.250. 여지가 있는 유일한 규격 축이다.
// "모든 축 120%" 를 요구하면 A1·A7 은 영원히 미달로 남는다 — 그 둘의 목표는 **천장**이다.
//
// 재실행 안전: 읽기만 한다.
// 실행: node scripts/textbook/market-benchmark.mjs [--json] [--out <경로>]
//       node scripts/textbook/market-benchmark.mjs --volume 5     # 한 권만

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')
const { withRetry } = await import('./volume-pool.mjs')

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
  let cursor = null

  for (;;) {
    // ⚠️ **정렬 없이 페이지를 넘기면 안 된다.** Postgres 는 ORDER BY 가 없으면 순서를
    //    보장하지 않으므로, 페이지마다 같은 행이 또 나오고 그만큼 다른 행이 빠진다.
    //    2026-08-30 에 재고가 13만 행으로 늘자 이것이 터졌다 — 희귀 유형이 표본에서
    //    통째로 빠져 A5(유형 다양성)가 14/14 에서 **8/14 로 보였다.** 재고는 그대로였다.
    //    (이 저장소가 IA 수집에서 이미 겪은 버그다 — CLAUDE.md §PDCP `sort[]=identifier asc`.)
    //
    // ⚠️ **그리고 `range()`(= OFFSET)로 넘겨도 안 된다.** OFFSET 은 건너뛸 행을 매번 처음부터
    //    세므로 페이지가 깊어질수록 느려진다. 재고가 19만 행이 되자 이 함수가 통째로
    //    `canceling statement due to statement timeout` 으로 죽었다(실측 2026-08-30) —
    //    **자가 먼저 부러진 것이다.** 재고가 늘어날수록 못 재는 자는 가드가 아니다.
    //
    //    그래서 커서(keyset) 방식으로 넘긴다: 마지막으로 본 id 다음부터 PAGE 개.
    //    pk 인덱스를 그대로 타므로 페이지 깊이와 무관하게 일정하다.
    // 끊긴 연결(Cloudflare 525 · schema cache · 타임아웃)은 코드 결함이 아니라 사고다.
    // `volume-pool.mjs` 의 `withRetry` 를 그대로 쓴다 — 재시도 정책을 두 벌로 두지 않는다.
    // ⚠️ 읽기라서 재시도해도 안전하다(쓰기였다면 중복이 생긴다).
    const at = cursor
    const data = await withRetry('벤치마크 페이지', () => {
      let q = supabase
        .from('csat_dcp_items')
        .select('id,type,v_level,payload,answer_key')
        .order('id')
        .limit(PAGE)
      if (at != null) q = q.gt('id', at)
      return q
    })
    rows.push(...data)
    if (data.length < PAGE) break
    // id 는 uuid 다 — `order('id')` 와 `gt('id', …)` 가 같은 정렬(바이트 순)을 쓰므로 안전하다.
    cursor = data[data.length - 1].id
  }
  return rows
}

function ratio(ours, market) {
  if (market === 0) return null
  return Number((ours / market).toFixed(3))
}

/**
 * `--volume <band>` — 창고가 아니라 **그 밴드로 실제 조판될 한 권**을 잰다.
 *
 * 풀을 여기서 다시 만들지 않는다. `loadVolume` 이 조판·해설 드레인과 쓰는 그 한 벌이다
 * (`volume-drift.test.ts` 가 지키는 규칙). 고른 문항의 id 만 받아 창고 행에서 추린다 —
 * 그래야 두 모드가 **같은 컬럼·같은 계산**을 통과한다(따로 재면 또 두 자가 된다).
 */
const bandArg = process.argv.indexOf('--volume')
const BAND = bandArg >= 0 ? Number(process.argv[bandArg + 1]) : null
if (bandArg >= 0 && !Number.isFinite(BAND)) {
  console.error('--volume 뒤에 밴드 번호가 필요하다 (예: --volume 5)')
  process.exit(1)
}

const all = await fetchAll()
let items = all
let scope = `csat_dcp_items ${all.length.toLocaleString()}문항 (창고 전체)`
if (BAND != null) {
  const { loadVolume } = await import('./volume-pool.mjs')
  const { itemIds, units } = await loadVolume(supabase, { band: BAND, unitCount: 20 })
  items = all.filter((r) => itemIds.has(r.id))
  scope = `V${BAND} 조판 1권 — ${units.length}단원 · ${items.length}문항 (인쇄되는 것만)`
  if (!items.length) {
    console.error(`V${BAND} 로 조판되는 문항이 없다.`)
    process.exit(1)
  }
}
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
// ⚠️ **선택지가 있는 문항만 센다.** 단답형(빈칸 낱말 쓰기·어법 고쳐 쓰기)에는
//   배제할 오답이 없다 — 없는 것을 못 했다고 세면 단답 재고가 늘수록 지수가 떨어진다.
//   실제로 그랬다: 재고가 17,206 → 136,512 로 늘며 단답이 64%가 되자 A3 가
//   62.5% → 45.3% 로 떨어졌는데, **선택지 있는 문항만 보면 99.8%** 였다.
//   시장 기준선 53.6% 도 객관식 해설 위주로 잰 값이라 같은 모집단으로 맞춘다.
const WRONG_RE = /오답|나머지|적절하지 않|틀린 이유|[①②③④⑤]/
const hasOptions = (i) => Array.isArray(i.payload?.choices) || Array.isArray(i.payload?.underlines)
const withOptions = withExplain.filter(hasOptions)
const A3 = {
  ours: withOptions.length
    ? withOptions.filter((i) => WRONG_RE.test(explanationOf(i))).length / withOptions.length
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
//
// ⚠️ **분모는 재는 범위에 따라 다르다** (실측 2026-08-31).
//   창고를 잴 때는 79종 **합본**의 표준 유형 수(16)가 맞다 — 창고끼리 견주는 것이다.
//   그런데 **한 권**을 그 16 으로 나누면 안 된다. 시중 교재도 1권에 16종을 담지 않는다:
//   권당 실측은 **중앙 5종**(초 4 · 중 4 · 고 8 · p90 15 · 최대 17)이다.
//   그 분모로 우리 V5 한 권(10종)이 **0.625(❌)** 로 나왔다 — 10종은 고등 중앙(8)보다 많다.
//   창고↔인쇄물 오류와 같은 계열이라, 범위에 맞는 분모를 골라 쓴다.
const marketTypes = new Set(spec.questionStems.map((s) => s.ourType).filter(Boolean))
const ourTypes = new Set(items.map((i) => i.type))
const covered = [...marketTypes].filter((t) => ourTypes.has(t))
const beyond = [...ourTypes].filter((t) => !marketTypes.has(t))
const gate = covered.length / marketTypes.size
/** 밴드 → 권당 기준선의 학교급. `V_TO_BUCKET` 과 같은 사다리를 따른다. */
const BAND_SCHOOL = (v) => (v == null ? null : v <= 2 ? '초등' : v <= 4 ? '중등' : '고등')
const perDoc = spec.typeCoverage?.perDocument
const perDocBase =
  BAND == null
    ? null
    : perDoc?.bySchool?.[BAND_SCHOOL(BAND)]?.median ?? perDoc?.overall?.median ?? null
const A5 =
  perDocBase != null
    ? {
        // 한 권 대 한 권. 관문(표준 전 유형 보유)은 합본 기준이라 여기서는 세지 않는다 —
        // 한 권에 전 유형을 요구하는 것은 시중 어느 교재도 안 하는 일이다.
        ours: covered.length,
        market: perDocBase,
        gate: null,
        basis: `권당 중앙값 (${BAND_SCHOOL(BAND)} ${perDoc.bySchool?.[BAND_SCHOOL(BAND)]?.docs ?? '?'}종 실측)`,
      }
    : {
        ours: gate >= 1 ? ourTypes.size : covered.length,
        market: marketTypes.size,
        gate,
        basis: '79종 합본',
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
  { id: 'A3', name: '오답 배제 언급률 (선택지 문항)', ...A3, unit: '%', why: '왜 다른 것이 아닌지까지 써야 해설의 깊이가 된다 — 단답형은 배제할 오답이 없어 모집단에서 뺀다' },
  { id: 'A4', name: '원문 인용률', ...A4, unit: '%', why: '지문에서 근거를 끌어와야 검증 가능한 해설이다' },
  { id: 'A5', name: `유형 다양성 (${A5.basis})`, ...A5, unit: '종', why: '표준 유형을 다 갖춘 뒤의 폭이 기능 우위다 — 관문을 못 넘으면 폭을 인정하지 않는다' },
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
  // **무엇을 잰 값인지 없으면 두 모드의 숫자가 뒤섞인다** — 창고 94.8% 와 권 100% 는
  // 둘 다 맞는 값이라 라벨이 없으면 어느 쪽이 인용된 것인지 알 수 없다.
  scope: BAND == null ? { kind: 'inventory', items: total } : { kind: 'volume', band: BAND, items: total },
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
    wrongOptionScope: {
      withOptions: withOptions.length,
      shortAnswer: withExplain.length - withOptions.length,
      note: '단답형은 배제할 오답이 없어 A3 모집단에서 뺀다',
    },
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
  console.log(`  대상  : ${scope}\n`)
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
