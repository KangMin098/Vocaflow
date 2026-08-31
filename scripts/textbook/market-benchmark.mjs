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
const { withRetry, ELEMENTARY_TYPES } = await import('./volume-pool.mjs')
const { explainItem, SCHOOL_SENTENCE_TYPES } = await import('@vocaflow/library-pipeline')

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
const bandRaw = bandArg >= 0 ? process.argv[bandArg + 1] : null
// `--volume all` — 사다리 7단이 **실제로 인쇄하는 문항 전체**를 한 벌로 잰다.
//
// ⚠️ 밴드를 하나씩 따로 돌리면 **값이 서로 비교되지 않는다.** 다른 세션이 문항을 계속
//   넣어 재고가 실행마다 바뀌고, 그래서 권 구성도 바뀐다 — 실측 2026-08-31: 같은 V7 을
//   40분 간격으로 두 번 재니 A6 이 92.7% 와 100% 로 갈렸다. 자를 고쳐서가 아니라
//   **재고가 달랐다.** 사다리를 한 판에 재야 한 시점의 출간물 품질이 나온다.
const ALL_BANDS = bandRaw === 'all'
const BAND = ALL_BANDS ? null : bandArg >= 0 ? Number(bandRaw) : null
if (bandArg >= 0 && !ALL_BANDS && !Number.isFinite(BAND)) {
  console.error('--volume 뒤에 밴드 번호나 all 이 필요하다 (예: --volume 5 · --volume all)')
  process.exit(1)
}

const all = await fetchAll()
let items = all
let scope = `csat_dcp_items ${all.length.toLocaleString()}문항 (창고 전체)`
if (BAND != null || ALL_BANDS) {
  const { loadVolume } = await import('./volume-pool.mjs')
  const { MARKET_UNITS_PER_BOOK } = await import('@vocaflow/library-pipeline')
  const bands = ALL_BANDS ? [1, 2, 3, 4, 5, 6, 7] : [BAND]
  const ids = new Set()
  let unitCount = 0
  const per = []
  for (const b of bands) {
    const v = await loadVolume(supabase, { band: b, unitCount: MARKET_UNITS_PER_BOOK.median })
    for (const id of v.itemIds) ids.add(id)
    unitCount += v.units.length
    per.push(`V${b} ${v.itemIds.size}`)
  }
  items = all.filter((r) => ids.has(r.id))
  scope = ALL_BANDS
    ? `사다리 7권 — ${unitCount}단원 · ${items.length}문항 (인쇄되는 것만 · ${per.join(' · ')})`
    : `V${BAND} 조판 1권 — ${unitCount}단원 · ${items.length}문항 (인쇄되는 것만)`
  if (!items.length) {
    console.error('조판되는 문항이 없다.')
    process.exit(1)
  }
}
const total = items.length

// ── A1 해설 보유율 ────────────────────────────────────────────────
// 시장 기준선 1.00 — 해설지를 내는 교재는 전 문항에 해설이 붙는다(`spec.explanation.note`).
// ⚠️ 해설은 **두 이름으로 산다** — 결정론/배치는 `explanation_ko`, 생성형 드레인은
// `rationale_ko`. 둘 다 학습자 화면(`DcpPlayer`)과 조판(`render-volume`)이 읽는다.
// 한쪽만 세면 534문항의 해설이 있는데도 "없음" 으로 잡힌다.
//
// ⚠️ **저장된 글자만 세면 학습자가 받는 것을 과소평가한다.** 조판기는 저장 해설이 없으면
//   유형별 **규칙 해설**(`explainItem`)을 붙여 인쇄한다 — 실측 2026-08-31 V7 한 권의
//   60문항 중 11개가 그렇게 채워졌고, 그 권의 해설은 60/60 이다. 그런데 여기서 저장 값만
//   세면 같은 문항이 "해설 없음" 으로 잡힌다.
//
//   그래서 **두 수를 다 낸다** — 저장(stored)과 학습자가 실제로 받는 것(delivered).
//   지수에는 delivered 를 쓴다(교재 품질은 학습자가 받는 것으로 정해진다). 다만 저장 값도
//   함께 찍어, 규칙에 기대는 몫이 얼마인지 숨기지 않는다.
const storedExplanationOf = (i) => i.answer_key?.explanation_ko || i.answer_key?.rationale_ko || null
const ruleExplanationOf = (i) => {
  const e = explainItem(i.type, i.payload, i.answer_key)
  return typeof e?.ko === 'string' && e.ko.trim() ? e.ko.trim() : null
}
const explanationOf = (i) => storedExplanationOf(i) || ruleExplanationOf(i)
const withStored = items.filter((i) => storedExplanationOf(i))
const withExplain = items.filter((i) => explanationOf(i))
const A1 = { ours: withExplain.length / total, market: 1.0 }
const A1_STORED = withStored.length / total

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
//
// **인용할 원문이 있는 문항만 센다.** 초등 3종(rhyme·word_meaning·spell_blank)은
//   원글이 아니라 사전에서 나오므로 인용할 지문이 없다.
//
// ⚠️ **다만 이 제외는 실제로는 아무것도 걷어내지 않는다 — 그리고 그 사실이 중요하다.**
//   초등 3종은 조판 시점에 만들어져 `csat_dcp_items` 에 행이 없다. 그래서 이 벤치마크의
//   모집단(창고 행)에 애초에 들어오지 않는다. 실측 2026-08-31: 제외된 건수 **0**.
//   (그 전에 "초등 60문항이 A4 를 끌어내린다" 고 짐작했는데 틀렸다. 이 줄을 남기는 이유는
//    같은 짐작을 다음 사람이 또 하지 않게 하려는 것이다.)
//
//   A4 를 실제로 끌어내리는 것은 **손으로 쓴 유형**이다 — 실측 사다리 7권:
//   `blank 21/64` · `title 16/47` · `topic 11/38` 이 인용 없이 적혔다.
//   병합기가 인용을 강제하기 전에 쓰인 것들이라, 고치려면 그 해설을 다시 써야 한다.
const CITE_RE = /[A-Za-z]{4,}[^가-힣]{0,3}[A-Za-z]{4,}/
const citable = withExplain.filter((i) => !ELEMENTARY_TYPES.has(i.type))
const A4 = {
  ours: citable.length ? citable.filter((i) => CITE_RE.test(explanationOf(i))).length / citable.length : 0,
  market: spec.explanation.sourceCitationRate,
}
// 어느 유형이 떨어뜨리는지 — 총합만 보면 고칠 자리를 못 찾는다.
const failBy = (list, re) => {
  const m = {}
  for (const i of list) {
    m[i.type] ??= { n: 0, bad: 0 }
    m[i.type].n += 1
    if (!re.test(explanationOf(i))) m[i.type].bad += 1
  }
  return Object.entries(m).filter(([, v]) => v.bad > 0).sort((a, b) => b[1].bad - a[1].bad)
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

// ⚠️ **A5 에는 우리가 넘을 수 없는 천장이 있다 — 규격 두 벌이 서로 어긋난다.**
//   `typeCoverage` 는 시장이 16종을 쓴다고 하는데, 목표 몫을 유도하는 `typeDensity` 는
//   13종만 담고 그중 3종(unit_vocab·blank_word·word_order)은 그 16 밖이다. 그래서
//   **목표 몫을 받을 수 있는 시장 표준 유형은 10종뿐**이고, 나머지 6종
//   (claim·content_match·long_reference·mood·purpose·summary)은 재고가 있어도
//   목표가 0 이라 어느 권에도 안 실린다.
//
//   실측 2026-08-31: 사다리 7권이 그 10종을 **전부** 싣는다 → A5 는 이미 천장이다.
//   0.625 는 우리 파이프라인의 결함이 아니라 **기준선 두 벌의 불일치**다.
//   고치려면 코퍼스를 다시 재야 한다(scripts/textbook-corpus/market-spec.mjs) —
//   여기서 분모를 바꾸면 못 넘은 것을 넘었다고 적는 셈이다.
const densityTypes = new Set(
  Object.keys(spec.typeDensity?.bySchool?.['고등']?.densityPerPage ?? {}),
)
const reachableTypes = [...marketTypes].filter((t) => densityTypes.has(t))
const missingReachable = reachableTypes.filter((t) => !ourTypes.has(t))
const unreachableTypes = [...marketTypes].filter((t) => !densityTypes.has(t))
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
// 같은 실행 안에서 두 자를 비교한다 — 재고가 계속 바뀌어 두 번 돌린 값은 못 견준다.
let a6SentSkipped = 0
let a6SentWouldFail = 0
const a6ByBucket = {}
for (const it of items) {
  const w = passageWords(it.payload)
  // ⚠️ **문장 단위 유형은 유형으로 거른다 — 길이로 어림하면 새어 나간다.**
  //   전에는 `w < 10` 이었는데 학교 축 문장은 14~38어라 그 그물을 통과했고,
  //   **문장 하나를 지문 길이 자로 재고 있었다.** 실측 2026-08-31(조판된 권):
  //   V7 미달 3건 = `word_order` 38어 · `blank_word` 14어 · `grammar_fix` 17어.
  //   셋 다 규격 위반이 아니라 자가 틀린 것이었다(그들의 창은 6~40어다).
  if (SCHOOL_SENTENCE_TYPES.has(it.type)) {
    a6SentSkipped += 1
    const b0 = V_TO_BUCKET[it.v_level]
    const s0 = b0 && spec.passageWords[b0]
    if (s0 && w != null && (w < s0.words.p10 || w > s0.words.p90)) a6SentWouldFail += 1
    continue
  }
  if (w == null || w < 10) continue
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
  // 규칙에 기대는 몫을 숨기지 않는다 — 저장 해설과 인쇄 해설을 나란히 찍는다.
  console.log(
    `  A1 내역  저장된 해설 ${(100 * A1_STORED).toFixed(1)}%` +
      ` · 조판이 규칙으로 채우는 몫 ${(100 * (A1.ours - A1_STORED)).toFixed(1)}%p` +
      ` → 학습자가 받는 ${(100 * A1.ours).toFixed(1)}%
`,
  )
  console.log(
    `  A6 내역  문장 단위 유형 ${a6SentSkipped}건을 이 축에서 뺐다` +
      ` (지문 자로 재면 ${a6SentWouldFail}건이 미달로 잡힌다 — 자가 틀린 것이다)` +
      ` · 분모 ${a6Total}
`,
  )
  // 어느 버킷이 얼마나 미달인지 — 총합만 보면 어디를 고쳐야 할지 알 수 없다.
  for (const [b, v] of Object.entries(a6ByBucket)) {
    console.log(
      `    ${b.padEnd(4)} ${v.in}/${v.total} = ${((100 * v.in) / (v.total || 1)).toFixed(1)}%` +
        `  (시장 ${v.p10}~${v.p90}어)`,
    )
  }
  const a3Bad = failBy(withOptions, WRONG_RE)
  const a4Bad = failBy(citable, CITE_RE)
  if (a3Bad.length) {
    console.log(`  A3 내역  오답 배제가 없는 유형 — ${a3Bad.map(([t, v]) => `${t} ${v.bad}/${v.n}`).join(' · ')}`)
  }
  if (a4Bad.length) {
    console.log(`  A4 내역  인용이 없는 유형 — ${a4Bad.map(([t, v]) => `${t} ${v.bad}/${v.n}`).join(' · ')}`)
  }
  console.log(`           초등 3종 ${withExplain.length - citable.length}건은 원글이 없어 이 축에서 뺐다
`)
  console.log(
    `  A5 천장  목표 몫을 받을 수 있는 시장 표준 유형 ${reachableTypes.length}/${marketTypes.size}종` +
      ` — 나머지 ${unreachableTypes.length}종은 밀도 규격에 없어 목표가 0 이다` +
      ` (${unreachableTypes.join(' · ')})`,
  )
  console.log(
    missingReachable.length
      ? `           아직 못 실은 것 ${missingReachable.length}종 — ${missingReachable.join(' · ')}
`
      : `           **천장에 닿았다** — 실을 수 있는 ${reachableTypes.length}종을 다 싣고 있다.
`,
  )
  console.log()
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
