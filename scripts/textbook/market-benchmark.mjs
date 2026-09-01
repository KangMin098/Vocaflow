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
const { explainItem, SCHOOL_SENTENCE_TYPES, LONG_ITEM_TYPES } = await import('@vocaflow/library-pipeline')
// 출판사별 산술은 테스트가 있는 한 벌을 쓴다 (publisher-index.test.ts · 20 케이스).
// 여기에 사본을 두면 테스트가 **쓰이지 않는 쪽**을 지키게 된다.
const { geoMean, reachableMax, bindingPublisher, canScoreTypeSpread, axisCeiling } =
  await import('@vocaflow/library-pipeline')

// `TEXTBOOK_SPEC_PATH` 로 기준선을 갈아 끼울 수 있다 — 출판사별 기준선을 **같은 자로**
// 재려면 필요하다. 지정하지 않으면 79종 합본 규격을 쓴다(기존 동작 그대로).
const SPEC_PATH = process.env.TEXTBOOK_SPEC_PATH
  ? path.resolve(process.env.TEXTBOOK_SPEC_PATH)
  : path.resolve('packages/library-pipeline/src/textbook/market-spec.json')
const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'))

/**
 * V-Level → 시장 규격 버킷. `series.ts` 의 사다리를 따른다
 * (V1 초등 저학년 · V2 초등 고학년 · V3 중1-2 · V4 중3 · V5 고1 · V6 고2 · V7 고3).
 *
 * ⚠️ 표본이 얇은 버킷이 있다(중2 11 · 중3 30). 얇은 곳은 이웃 버킷으로 보낸다 —
 *    없는 규격을 있는 척하는 것보다, 어디를 빌려 왔는지 적는 편이 낫다.
 */
const V_TO_BUCKET = {
  1: '초6', 2: '초6', 3: '중1', 4: '중1', 5: '고1', 6: '고2', 7: '고3', 8: '고3', 9: '고3',
}

/**
 * 지문이 담기는 payload 키. 문장 단위 유형은 A6 에서 유형으로 뺀다.
 *
 * ⚠️ **`presented` 가 빠져 있었다 — 순서(order) 문항이 통째로 A6 에서 사라졌다.**
 *   DCP 순서 문항은 지문을 `presented`(도입 + (A)(B)(C) 덩어리)에 담는다. 그 키를 안 읽으니
 *   낱말 수가 **0** 으로 나왔고, 아래 `w < 10` 관문에 걸려 조용히 건너뛰어졌다 —
 *   빠졌다는 표시조차 남지 않는다. 실측 2026-09-01(V6): `order` 풀 126어 vs 벤치 **0어**.
 *   순서는 시장 밀도 4위(고등 0.0223)의 핵심 유형이라, 없는 채로 잰 A6 는 그 유형을
 *   한 번도 검증하지 않은 값이었다.
 *
 * ⚠️ **아직 남은 것: 풀과 벤치마크가 같은 문항에서 다른 수를 낸다** (양방향으로).
 *   `purpose` 풀 188 vs 벤치 194 · `title` 풀 167 vs 벤치 156 (실측 V6 전수).
 *   세는 법(`split(/\s+/)` vs 알파벳 토큰)만으로는 벤치가 더 클 수 없으므로 **읽는 글이
 *   다르다** — 조합기는 창 안으로 자른 조각을, 벤치마크는 payload 전체를 본다.
 *   A6 미달 6건이 전부 1~6어 초과인 이유가 이것이다. 자를 하나로 합치는 것이 다음 몫이다.
 */
const PASSAGE_TEXT_KEYS = ['passage', 'remaining', 'sentences', 'intro', 'presented']

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
  // ⚠️ **창고 행이 아니라 인쇄되는 사본을 잰다.**
  //   예전에는 `all.filter((r) => ids.has(r.id))` 로 **저장된 payload** 를 골랐다. 그런데
  //   조판은 `volume-pool` 의 정제 체인(절 이름 제거 · 반복 꼬리 절단 · 구두점 · 따옴표)을
  //   거친 사본을 인쇄한다 — 학습자가 읽는 글은 그쪽이다. 실측 2026-09-01(V6 60문항):
  //   **13건의 낱말 수가 다르고**, 가장 큰 것은 `blank` 저장 186어 → 인쇄 **124어**
  //   (반복 꼬리 62어가 잘린다). 그래서 A6 가 규격 밖이라고 고발한 문항 중 일부는
  //   **인쇄본에서는 규격 안**이었다 — 조합기가 그 자로 이미 걸렀기 때문이다.
  //   이 파일 머리말이 `--volume` 을 "인쇄되는 것만" 이라고 적고 있으니, 그렇게 만든다.
  let unitCount = 0
  const per = []
  const printed = []
  for (const b of bands) {
    const v = await loadVolume(supabase, { band: b, unitCount: MARKET_UNITS_PER_BOOK.median })
    for (const u of v.units) for (const it of u.items) printed.push(it)
    unitCount += v.units.length
    per.push(`V${b} ${v.itemIds.size}`)
  }
  items = printed.map((it) => ({
    id: it.id,
    type: it.type,
    v_level: it.v_level,
    payload: it.payload,
    answer_key: it.answer_key,
  }))
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

/**
 * **축 계산을 기준선(spec)에서 떼어 낸다.**
 *
 * 왜 함수인가 — "우리" 값 중 상당수가 기준선에 **의존한다**. A2 는 시장 해설 길이
 * p25~p90 안에 드는 비율이고, A6 은 학년대별 시장 지문 창 안에 드는 비율이며,
 * A7 은 학교급별 시장 지배값과 같은지다. 그래서 기준선을 바꾸면 분모뿐 아니라
 * **분자도 다시 세야 한다.** 기준선마다 이 블록을 복사해 두면 두 리포트가 조용히
 * 다른 것을 세게 된다(이 저장소가 `stemRe`·창고↔인쇄물에서 이미 겪은 계열의 함정이다).
 *
 * 해설 보유 여부(A1)는 기준선이 상수 1.0 이라 밖에 둔다. 반대로 오답/인용 정규식과
 * 그 모집단(`withOptions`·`citable`)은 A3·A4 계산 **바로 옆**에 남긴다 — 떼어 옮기면
 * "왜 이 모집단인가" 를 적은 주석과 계산이 갈라지기 때문이다. 대신 리포트가 쓸 수 있게
 * 함께 돌려준다.
 */
function computeAxes(spec) {
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
  // ⚠️ **`Array.isArray` 로는 모자란다 — 빈 배열도 참이다.** `spell_blank`(초등 철자 쓰기)은
  //   `choices: []` 를 들고 있어서 이 관문을 통과했고, 선택지가 하나도 없는 20문항이
  //   "오답 배제를 안 했다" 로 세어졌다(실측 2026-09-01, A3 1.866 → 1.744).
  //   초등 문항은 조판 시점에 만들어져 창고에 행이 없으므로, `--volume` 이 인쇄본을
  //   재도록 고친 **뒤에야** 이 결함이 드러났다. 길이로 판정한다.
  const hasOptions = (i) =>
    (i.payload?.choices?.length ?? 0) > 0 || (i.payload?.underlines?.length ?? 0) > 0
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
  // ⚠️ **이 제외는 2026-09-01 부터 실제로 일을 한다 — 그 전에는 0건이었다.**
  //   초등 3종은 조판 시점에 만들어져 `csat_dcp_items` 에 행이 없다. 그래서 `--volume` 이
  //   창고 행을 고르던 동안에는 **V1 60문항이 모집단에 아예 안 들어왔다** — 벤치마크가
  //   사다리 7권을 잰다고 하면서 실은 6권을 재고 있었던 것이다(실측 2026-08-31: 제외 0건).
  //   `--volume` 이 인쇄되는 사본을 재도록 고치면서 이 제외가 비로소 60건을 걷어낸다.
  //   (그때 "초등 60문항이 A4 를 끌어내린다" 는 짐작이 틀렸다고 적었는데, 짐작이 틀린 게
  //    아니라 **그 문항들이 애초에 세어지지 않고 있었다.** 자를 고치자 A3·A7 이 실제로
  //    내려갔다 — 1.866→1.744 · 1.161→1.000. 내려간 값이 맞는 값이다.)
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
  // 미달을 **유형별로** 센다 — 버킷별 합계만 보면 어느 유형이 미달인지 알 수 없다.
  //   실측 2026-08-31: A6 96.4% 의 미달 10건이 어디서 왔는지 알 방법이 없었다.
  const a6FailByType = {}
  const a6Fails = []
  for (const it of items) {
    const w = passageWords(it.payload)
    // ⚠️ **문장 단위 유형은 유형으로 거른다 — 길이로 어림하면 새어 나간다.**
    //   전에는 `w < 10` 이었는데 학교 축 문장은 14~38어라 그 그물을 통과했고,
    //   **문장 하나를 지문 길이 자로 재고 있었다.** 실측 2026-08-31(조판된 권):
    //   V7 미달 3건 = `word_order` 38어 · `blank_word` 14어 · `grammar_fix` 17어.
    //   셋 다 규격 위반이 아니라 자가 틀린 것이었다(그들의 창은 6~40어다).
    // ⚠️ **장문(41~45)도 다른 자로 잰다.** 집필 규격이 `CSAT_LONG_ITEM_WORDS` 260~400어라
    //   시장 p90(고1 242 · 고2 188) 밖에 있는 것이 **설계**다 — `itemWordSpec` 주석이
    //   "장문은 시장 분포의 꼬리 자체다" 라고 적고 있다. 그런데 이 축은 문장 단위 유형만
    //   빼고 장문은 그대로 재고 있었다(실측 2026-09-01: `long_reference` V5 337어·331어가
    //   미달로 잡혔다). 규격 위반이 아니라 **자가 틀린 것**이다 — 문장 축과 같은 이유다.
    if (SCHOOL_SENTENCE_TYPES.has(it.type) || LONG_ITEM_TYPES.has(it.type)) {
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
    else {
      a6FailByType[it.type] = (a6FailByType[it.type] ?? 0) + 1
      // 유형만으로는 자가 틀린 것인지 교재가 틀린 것인지 못 가른다 — 실제 값을 남긴다.
      a6Fails.push({ type: it.type, w, v: it.v_level, lo: s.words.p10, hi: s.words.p90 })
    }
  }
  const A6 = { ours: a6Total ? a6In / a6Total : 0, market: 0.80 }

  // ── A7 선택지 수 규격 적합률 ──────────────────────────────────────
  // 학교급마다 시장의 지배값이 있다(초·중·고 모두 5지선다 — 중등 93.8%).
  // `middle-choice.ts` 는 "중등 4지선다" 라고 적고 4,135문항을 그렇게 만들었는데,
  // 그 문장에는 근거가 없었고 실측은 반대였다. 그래서 축으로 세워 다시 잊히지 않게 한다.
  const VBAND_SCHOOL = (v) => (v == null ? null : v <= 2 ? '초등' : v <= 4 ? '중등' : '고등')
  let a7In = 0
  let a7Total = 0
  let a7NoBaseline = 0
  const a7ByType = {}
  for (const it of items) {
    const choices = it.payload?.choices ?? it.payload?.underlines
    if (!Array.isArray(choices) || choices.length < 3) continue
    // ⚠️ **초1~2 의 기준선이 코퍼스에 없다 — 없는 자로 재지 않는다.**
    //   실측 2026-09-01: 초등 문서 19건 880쪽의 `grade_min` 범위가 **초3~초6** 이고,
    //   초1~2 를 담는 교재는 **0건**이다. 그런데 `V_TO_BUCKET` 은 V1(초1~2)과
    //   V2(초3~6)를 둘 다 '초6' 으로 보내므로, 초1~2 권이 초3~6 규격으로 재어졌다.
    //
    //   그 자로 재면 V1 의 4지선다 40문항이 전부 미달이 되어 A7 이 1.161 → 1.000 으로
    //   떨어진다(실측). 하지만 그 판정의 근거는 **초3~6 교재**이고, 초1~2 에서 5지선다가
    //   맞는지는 아무도 재지 않았다 — 오히려 작업기억 ~4항목(학습원칙 6)은 반대쪽을 가리킨다.
    //   **근거 없는 임계값을 목표로 삼지 않는다.** 못 잰 것은 못 잰다고 적고 분모에서 뺀다
    //   (출판사별 지수가 해설 축을 `—` 로 남기는 것과 같은 원칙이다).
    if (it.v_level != null && it.v_level <= 1) {
      a7NoBaseline += 1
      continue
    }
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

  return {
    AXES, LO, HI, marketTypes, ourTypes, beyond, reachableTypes, unreachableTypes, missingReachable,
    a6ByBucket, a6FailByType, a6Fails, a6SentSkipped, a6SentWouldFail, a6Total, a7ByType, a7NoBaseline,
    withOptions, citable, failBy, WRONG_RE, CITE_RE,
  }
}

const {
  AXES, LO, HI, marketTypes, ourTypes, beyond, reachableTypes, unreachableTypes, missingReachable,
  a6ByBucket, a6FailByType, a6Fails, a6SentSkipped, a6SentWouldFail, a6Total, a7ByType, a7NoBaseline,
  withOptions, citable, failBy, WRONG_RE, CITE_RE,
} = computeAxes(spec)

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
      ` · 분모 ${a6Total}` +
      (Object.keys(a6FailByType).length
        ? `\n           미달 유형 — ${Object.entries(a6FailByType)
            .sort((a, b) => b[1] - a[1])
            .map(([t, n]) => `${t} ${n}`)
            .join(' · ')}`
        : '\n           미달 0건') +
      // 유형별 합계로는 **자가 틀린 것인지 교재가 틀린 것인지** 못 가른다.
      //   장문(43~45)은 규격이 260~400어라 시장 p90(188~242) 밖에 있는 것이 설계다 —
      //   그건 미달이 아니라 다른 자로 재야 할 유형이다. 실제 값을 적어야 그것이 보인다.
      (a6Fails.length
        ? `\n           낱낱 — ${a6Fails
            .map((f) => `${f.type} V${f.v} ${f.w}어(창 ${f.lo}~${f.hi})`)
            .join(' · ')}`
        : '') +
      (a7NoBaseline
        ? `\n  A7 내역  초1~2 문항 ${a7NoBaseline}건을 이 축에서 뺐다 — 코퍼스의 초등 교재 19건이` +
          ` 전부 초3~6 이라 초1~2 의 지배값을 잰 적이 없다 (없는 자로 재지 않는다)`
        : '') +
      `
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


// ══════════════════════════════════════════════════════════════════
// `--per-publisher` — **합본이 아니라 출판사마다 따로 이겼는지 본다.**
//
// 왜 필요한가 (실측 2026-08-31): 합본 기준선은 쪽수 가중평균이고, 이 코퍼스는
// NE능률이 전체 쪽수의 **67%**(60종 3,486쪽)다. 즉 "79종 대비 1.416" 은 사실상
// **NE능률 대비** 값이다. 평균을 이기면서 특정 출판사에 지는 것은 얼마든지 가능하고,
// 그 출판사가 EBS(수능 연계교재 발행처)라면 가장 아픈 자리에서 지는 것이다.
//
// ⚠️ **그리고 이 코퍼스로는 못 재는 축이 있다.** 정답해설 문서를 가진 출판사가
//   NE능률뿐이라 A2·A3·A4(7축 중 3축)는 EBS·쎄듀·수경에 대해 **표본이 0** 이다.
//   0 을 "해설이 나쁘다" 로 세면 없는 승리를 적게 된다 — 그래서 **못 잼(—)** 으로
//   남기고, 종합에서도 뺀다. 무엇을 못 쟀는지가 이 모드의 주요 산출물이다.
//
// 기준선 규칙 — 비율 축(A3·A4·A7)은 상대의 **Wilson 95% 상한**을 쓴다.
//   상대에게 가장 유리한 해석으로도 이겨야 우위로 친다. 표본이 작으면 구간이 넓어져
//   저절로 이기기 어려워지므로, 근거 없는 "표본 N개 이상" 문턱을 둘 필요가 없다.
//   A2·A6 은 기준선이 **정의상 상수**다(p25~p90 = 65% · p10~p90 = 80%) — 표본이
//   아니라 구성이라 CI 를 쓰지 않는다. 출판사마다 달라지는 것은 **창**이고,
//   그래서 우리 값(분자)이 달라진다.
if (process.argv.includes('--per-publisher')) {
  const PUB_SPEC = path.resolve('packages/library-pipeline/src/textbook/publisher-spec.json')
  if (!fs.existsSync(PUB_SPEC)) {
    console.error('publisher-spec.json 이 없다 — 먼저 node scripts/textbook-corpus/publisher-spec.mjs')
    process.exit(1)
  }
  const pubSpec = JSON.parse(fs.readFileSync(PUB_SPEC, 'utf8'))

  /** 비율 축의 기준선 = 상대의 CI 상한. 못 쟀으면 null 이다(0 이 아니다). */
  const hi = (ci) => (ci && Number.isFinite(ci.hi) ? ci.hi : null)

  const perPub = []
  for (const p of pubSpec.publishers) {
    const expOk = !p.explanation?.insufficient
    // computeAxes 가 `spec.explanation.lengthChars.p25` 를 먼저 읽는다. 해설 표본이
    // 없는 출판사에서 터지지 않도록 합본 값을 **창으로만** 빌려 준다 — 그 축의 판정은
    // 아래에서 null 로 덮으므로 빌린 값이 점수에 섞이지 않는다.
    const explanation = expOk ? p.explanation : spec.explanation
    const built = {
      generatedAt: pubSpec.generatedAt,
      provenance: { documentsMeasured: p.profile.docs, pagesMeasured: p.profile.pages },
      questionStems: (p.typeCoverage?.distinctOurTypesCovered ?? []).map((t) => ({ ourType: t })),
      typeCoverage: { perDocument: p.typeCoverage?.perDocument ?? null },
      passageWords: p.passageWords ?? {},
      explanation,
      // 유형 밀도는 "어느 학년에 어떤 문항이 실리는가" 라 출판사가 아니라 **학년의 성질**이다.
      // 출판사별로 다시 재지 않고 합본 값을 쓴다 — 빌려 왔다는 사실을 리포트에 적는다.
      typeDensity: spec.typeDensity,
      choiceCount: p.choiceCount ?? {},
    }
    const r = computeAxes(built)
    const axes = r.AXES.map((a) => ({ ...a }))
    const byId = Object.fromEntries(axes.map((a) => [a.id, a]))

    // ── 못 잰 축을 null 로 덮는다 (0 으로 두면 없는 패배·없는 승리가 생긴다) ──
    const gaps = []
    if (!expOk) {
      for (const id of ['A1', 'A2', 'A3', 'A4']) {
        byId[id].index = null
        byId[id].insufficient = '이 코퍼스에 해당 출판사의 정답해설 문서가 0건'
      }
      gaps.push('해설 축 A1~A4')
    } else {
      // 표본이 있을 때는 **상대의 가장 유리한 해석**(CI 상한)으로 다시 잰다.
      const a3 = hi(p.explanation.wrongOptionMentionCi)
      const a4 = hi(p.explanation.sourceCitationCi)
      if (a3) { byId.A3.market = a3; byId.A3.index = ratio(byId.A3.ours, a3) }
      if (a4) { byId.A4.market = a4; byId.A4.index = ratio(byId.A4.ours, a4) }
    }
    if (!Object.keys(built.passageWords).length || !r.a6Total) {
      byId.A6.index = null
      byId.A6.insufficient = '학년당 표본 10 미만 — 지문 규격을 세울 수 없다'
      gaps.push('지문 축 A6')
    }
    const cc = Object.values(built.choiceCount)
    if (!cc.length) {
      byId.A7.index = null
      byId.A7.insufficient = '선택지를 셀 수 있는 본책·미리보기가 없다'
      gaps.push('선택지 축 A7')
    } else {
      const his = cc.map((c) => hi(c.fiveChoiceCi)).filter((x) => x != null)
      if (his.length) {
        const m = Number((his.reduce((a, b) => a + b, 0) / his.length).toFixed(3))
        byId.A7.market = m
        byId.A7.index = ratio(byId.A7.ours, m)
      }
    }
    // ── A5 는 **창고 모드에서 출판사별로 잴 수 없다** (실측 2026-08-31) ──
    //   창고 모드의 분모는 `marketTypes.size` = 그 출판사에서 **발문이 검출된 유형 수**다.
    //   3종뿐인 쎄듀는 7종만 잡혀, 우리 창고 25종과 견주면 3.571 이 나온다. 우리가 3.5배
    //   낫다는 뜻이 아니라 **그 출판사의 표본이 작다는 뜻**이다 — 책을 적게 낸 곳일수록
    //   우리가 유리해지는 자는 자가 아니다. 합본(79종→16종)에서는 이 왜곡이 안 보였다.
    //
    //   유형 폭의 올바른 출판사별 비교는 **우리 한 권 대 그들 한 권**이다
    //   (`perDocument` 중앙값). 창고에는 "우리 한 권" 이 없으므로 `--volume` 에서만 잰다.
    if (!built.typeCoverage.perDocument || !built.questionStems.length) {
      byId.A5.index = null
      byId.A5.insufficient = '발문이 잡힌 문서가 없다 (OCR 미도달)'
      gaps.push('유형 축 A5')
    } else if (!canScoreTypeSpread(byId.A5.basis)) {
      byId.A5.index = null
      byId.A5.insufficient =
        '창고 유형 수(25종)를 이 출판사에서 검출된 발문 유형 수와 견줄 수 없다 — 표본이 작을수록 우리가 유리해진다. --volume 에서 권 대 권으로 잰다'
      gaps.push('유형 축 A5')
    } else {
      // 권 대 권 비교는 유효하다. 다만 표본이 얇으면 중앙값이 흔들린다 — 몇 종에서 나온
      // 값인지 함께 남긴다(숨기면 2종에서 나온 16 을 규격으로 믿게 된다).
      const pd = built.typeCoverage.perDocument
      const docs = pd?.overall?.docs ?? 0
      byId.A5.baselineDocs = docs
      if (docs < 5) {
        byId.A5.caution = `권당 유형 수 기준선이 ${docs}종에서 나왔다 — 중앙값이 흔들린다`
      }
    }

    const live = axes.filter((a) => a.index != null && a.index > 0)
    const overallPub = geoMean(axes.map((a) => a.index))

    // ── 도달 가능한 최대치 ────────────────────────────────────────
    //   비율 축은 우리 값이 100% 를 못 넘으므로 축 천장이 `1/시장`이다. 잰 축이
    //   적을수록 천장이 낮아진다 — 그래서 **1.20 이 산술적으로 불가능한 출판사**가 생긴다.
    //   개수 축(A5, 단위 '종')에는 천장이 없어 이 계산에서 뺀다(빼면 남은 축만으로 낸
    //   보수적인 값이 된다 — 실제 천장은 이보다 높거나 같다).
    const reachable = reachableMax(axes)
    for (const a of axes) {
      if (a.index == null) continue
      const c = axisCeiling(a)
      if (c != null) a.ceiling = c
    }
    perPub.push({
      publisher: p.publisher,
      profile: p.profile,
      axes,
      axesMeasured: live.length,
      axesTotal: axes.length,
      gaps,
      overallIndex: overallPub,
      reachableMax: reachable,
      // 개수 축을 뺀 보수적 천장이라, 불가능 판정은 `A5 를 못 재는 동안` 이라는 조건부다.
      targetReachable: reachable == null ? null : reachable >= 1.2,
    })
  }

  // **구속 지수** — 각 출판사를 다 이겨야 하므로 가장 낮은 곳이 실제 성적이다.
  const binding = bindingPublisher(perPub)

  const pubReport = {
    generatedAt: new Date().toISOString(),
    scope,
    itemsMeasured: total,
    baselineRule: pubSpec.method.baselineRule,
    publishers: perPub,
    excluded: pubSpec.excluded,
    bindingPublisher: binding?.publisher ?? null,
    bindingIndex: binding?.overallIndex ?? null,
    pooledIndex: overall,
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(pubReport, null, 2))
  } else {
    const ids = AXES.map((a) => a.id)
    console.log('\n출판사별 우위 지수 — **각** 출판사를 따로 이겨야 한다')
    console.log(`  기준선 규칙: ${pubSpec.method.baselineRule}`)
    console.log(`  합본 지수 ${overall} 는 쪽수 가중평균이다 — 아래가 실제 성적이다.\n`)
    console.log(`  출판사      종  쪽수  ${ids.map((i) => i.padStart(5)).join('')}   종합   천장  잰축  판정`)
    console.log('  ' + '─'.repeat(76))
    for (const p of perPub) {
      const cells = ids
        .map((id) => {
          const a = p.axes.find((x) => x.id === id)
          return (a.index == null ? '—' : a.index.toFixed(2)).padStart(5)
        })
        .join('')
      const mark = p.overallIndex == null ? '—' : p.overallIndex >= 1.2 ? '✅' : p.overallIndex >= 1.0 ? '△' : '❌'
      console.log(
        `  ${p.publisher.padEnd(9)} ${String(p.profile.docs).padStart(2)} ${String(p.profile.pages).padStart(5)}  ${cells}  ${String(p.overallIndex ?? '—').padStart(5)}  ${String(p.reachableMax ?? '—').padStart(5)}  ${p.axesMeasured}/${p.axesTotal}   ${mark}`,
      )
    }
    console.log('  ' + '─'.repeat(76))
    console.log(
      binding
        ? `  구속 출판사 **${binding.publisher}** — 종합 ${binding.overallIndex} (목표 1.200)\n`
        : '  잴 수 있는 출판사가 없다\n',
    )
    const impossible = perPub.filter((p) => p.reachableMax != null && !p.targetReachable)
    for (const p of impossible) {
      console.log(
        `  ⛔ ${p.publisher} — 잰 ${p.axesMeasured}축으로 도달 가능한 최대치가 ${p.reachableMax} 라` +
          ` 목표 1.200 이 **산술적으로 불가능하다**. 축을 더 재야 한다(축마다 천장 ` +
          p.axes.filter((a) => a.ceiling).map((a) => `${a.id} ${a.ceiling}`).join(' · ') +
          ').',
      )
    }
    if (impossible.length) console.log()
    for (const p of perPub) {
      if (!p.gaps.length) continue
      console.log(`  ⚠ ${p.publisher} — 못 잰 축: ${p.gaps.join(' · ')}`)
      for (const a of p.axes) {
        if (a.insufficient) console.log(`      ${a.id} ${a.name} — ${a.insufficient}`)
      }
    }
    for (const e of pubSpec.excluded) {
      console.log(`  (경쟁자 제외) ${e.publisher} ${e.docs}종 ${e.pages}쪽 — ${e.why}`)
    }
    console.log(
      '\n  ⓘ 유형 밀도(A5 의 도달가능 유형 판정)는 합본 값을 빌려 쓴다 — 밀도는 출판사가 아니라 학년의 성질이다.',
    )
  }

  const pubOut = process.argv.indexOf('--pub-out')
  if (pubOut >= 0 && process.argv[pubOut + 1]) {
    fs.writeFileSync(process.argv[pubOut + 1], `${JSON.stringify(pubReport, null, 2)}\n`, 'utf8')
  }
}

const outFlag = process.argv.indexOf('--out')
if (outFlag >= 0 && process.argv[outFlag + 1]) {
  fs.writeFileSync(process.argv[outFlag + 1], `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}
