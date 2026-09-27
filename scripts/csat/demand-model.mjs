// scripts/csat/demand-model.mjs
//
// **수요 모델 — 슬롯 표와 결손 지도.** 읽기 전용.
//
// 슬롯 = 학년 대역 × 문항 유형 × 텍스트 갈래.
// 원문 확보 기준의 출발점이 여기다: "원문이 좋은가" 가 아니라 **"어느 슬롯의 결손을
// 가공 후 채우는가"** 로 판정하려면, 먼저 슬롯마다 **무엇이 얼마나 필요한지**를 재야 한다.
//
// ── 근거 태그 ────────────────────────────────────────────────────────
//   [측정] 이 스크립트가 파일·DB 에서 직접 센 값
//   [추론] 은 이 스크립트가 내지 않는다 — 측정 불가한 칸은 **빈칸으로 남긴다.**
//
// ── 출처 ─────────────────────────────────────────────────────────────
//   기출·모의 : `scripts/csat/data/corpus.json` (1,302문항 · 수능 630 · 모의 672)
//   시중 교재 : `d:/workspace/textbook-corpus/market-spec.json` (79종 · 94문서 · 5,229쪽)
//   재고      : `library_articles` 직접 질의
//
// ⚠️ **초·중등 대역은 기출 원장에 없다.** corpus.json 은 고3 수능·모의만 담는다.
//    초·중등 수요는 시중 교재 코퍼스의 학년대(초6·중1·중2·중3)에서만 나온다 —
//    그 칸의 「문항 유형」은 교재 발문에서 오고, 기출처럼 유형 코드가 붙어 있지 않다.
//    그래서 초·중등 슬롯은 **길이 창만 측정되고 유형 분해는 비어 있다.** 그 사실을 적는다.
//
// 사용: node --tls-max-v1.2 scripts/csat/demand-model.mjs [--out <경로>]

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: 'apps/web/.env.local', quiet: true })

const OUT = (() => {
  const i = process.argv.indexOf('--out')
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : 'docs/source-acquisition/data/demand-model.json'
})()

// ── 공통 계량 ─────────────────────────────────────────────────────────
const toks = (t) => (t.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []).filter((w) => w.length > 1)
const CAPS = /(?<=[a-z,;:]\s)[A-Z][a-z]{2,}/g
const FIRST = /\b(I|we|our|us|my|me)\b/
const BACKREF = /^(But|And|So|Thus|Then|Yet|However|Therefore|Moreover|These|This|That|Those|Such|It|He|She|They|Its|His|Her|Their)\b/
/** 논지 구조 표지 — 어느 구조인지 **하나로 정하지 않는다.** 표지의 존재만 센다. */
const STRUCTURE = {
  '주장+근거': /\b(because|since|therefore|thus|hence|as a result|this is why|the reason)\b/i,
  대조: /\b(however|but|whereas|while|by contrast|on the other hand|unlike|rather than)\b/i,
  '문제-해결': /\b(problem|solution|solve|address (?:this|the)|remedy|overcome)\b/i,
  예시: /\b(for example|for instance|such as|consider|take the case)\b/i,
  정의: /\b(is defined as|refers to|means that|is called|known as)\b/i,
  시간순: /\b(first|then|next|finally|later|afterwards|by the \d{4}s)\b/i,
}

function measure(text) {
  const w = toks(text)
  if (w.length < 20) return null
  const sents = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
  const caps = text.match(CAPS) ?? []
  const structures = Object.entries(STRUCTURE).filter(([, re]) => re.test(text)).map(([k]) => k)
  return {
    words: w.length,
    sents: sents.length,
    avgSent: w.length / Math.max(1, sents.length),
    capsPer100: (caps.length / w.length) * 100,
    capsZero: caps.length === 0,
    hasFirst: FIRST.test(text),
    backRef: BACKREF.test(text),
    startsQuote: /^["“‘']/.test(text.trim()),
    structures,
  }
}

const pct = (n, d) => (d ? Number(((n / d) * 100).toFixed(1)) : 0)
const stat = (arr) => {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  const q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))]
  return { n: s.length, min: s[0], p10: q(0.1), p25: q(0.25), median: q(0.5), p75: q(0.75), p90: q(0.9), max: s[s.length - 1] }
}

// ── ① 기출·모의 — 유형별 수요 ─────────────────────────────────────────
const corpus = JSON.parse(readFileSync('scripts/csat/data/corpus.json', 'utf8'))
const items = corpus.items ?? []

const byType = new Map()
for (const it of items) {
  // 듣기는 지문 원천 수요가 아니다(대본은 자체 생성) — 분모에서 뺀다.
  if (it.section === '듣기') continue
  const key = it.type_name ?? '(유형 없음)'
  if (!byType.has(key)) byType.set(key, { type: key, items: 0, suneung: 0, mock: 0, long: 0, m: [] })
  const b = byType.get(key)
  b.items += 1
  if (it.exam_kind === 'suneung') b.suneung += 1
  else b.mock += 1
  if (it.section === '장문') b.long += 1
  const m = measure(String(it.passage ?? ''))
  if (m) b.m.push(m)
}

const readingTotal = [...byType.values()].reduce((s, b) => s + b.items, 0)
const typeRows = [...byType.values()]
  .map((b) => {
    const ms = b.m
    const has = (f) => pct(ms.filter(f).length, ms.length)
    const structCount = new Map()
    for (const x of ms) for (const s of x.structures) structCount.set(s, (structCount.get(s) ?? 0) + 1)
    return {
      type: b.type,
      items: b.items,
      // **목표 가중치 = 실제 문항 출현 빈도.** 이것이 결손 가중치의 분자가 된다.
      demandShare: pct(b.items, readingTotal),
      suneung: b.suneung,
      mock: b.mock,
      longSection: b.long,
      measured: ms.length,
      words: stat(ms.map((x) => x.words)),
      avgSent: stat(ms.map((x) => Number(x.avgSent.toFixed(1)))),
      capsPer100: stat(ms.map((x) => Number(x.capsPer100.toFixed(2)))),
      capsZeroPct: has((x) => x.capsZero),
      firstPersonPct: has((x) => x.hasFirst),
      backRefPct: has((x) => x.backRef),
      startsQuotePct: has((x) => x.startsQuote),
      structures: Object.fromEntries(
        [...structCount].sort((a, b2) => b2[1] - a[1]).map(([k, v]) => [k, pct(v, ms.length)]),
      ),
    }
  })
  .sort((a, b) => b.items - a.items)

// ── ② 시중 교재 — 학년대별 길이 창 ────────────────────────────────────
const MARKET = 'd:/workspace/textbook-corpus/market-spec.json'
let marketBands = null
let marketStems = null
if (existsSync(MARKET)) {
  const ms = JSON.parse(readFileSync(MARKET, 'utf8'))
  marketBands = Object.fromEntries(
    Object.entries(ms.passageWords ?? {}).map(([band, v]) => [band, { gradeMin: v.gradeMin, ...v.words }]),
  )
  // 발문 = 그 학년대가 실제로 내는 문항 유형의 대리 지표
  marketStems = (ms.questionStems ?? []).map((s) => ({
    stem: s.stem, ourType: s.ourType, occurrences: s.occurrences,
    gradeMin: s.gradeMin, gradeMax: s.gradeMax, seriesCount: s.seriesCount,
  }))
}

// ── ③ 시중 교재 고등 — 지문 문체 (기출과 대조군) ──────────────────────
let marketStyle = null
const CORPUS_DB = 'd:/workspace/textbook-corpus/corpus.db'
if (existsSync(CORPUS_DB)) {
  const db = new DatabaseSync(CORPUS_DB, { readOnly: true })
  const rows = []
  const seen = new Set()
  for (const d of db.prepare("select id from docs where school like '%고등%' and status='ok'").all()) {
    for (const pg of db.prepare('select text from pages where doc_id=? and en>ko').all(d.id)) {
      for (const run of String(pg.text ?? '')
        .split(/[가-힣]+[^A-Za-z]*/g).map((s) => s.replace(/\s+/g, ' ').trim())
        .filter((s) => s.length > 400 && /[.!?]/.test(s))) {
        const k = run.slice(0, 60)
        if (seen.has(k)) continue
        seen.add(k)
        const m = measure(run)
        if (m && m.words >= 90 && m.words <= 220) rows.push(m)
      }
    }
  }
  marketStyle = {
    n: rows.length,
    words: stat(rows.map((x) => x.words)),
    capsPer100: stat(rows.map((x) => Number(x.capsPer100.toFixed(2)))),
    capsZeroPct: pct(rows.filter((x) => x.capsZero).length, rows.length),
    firstPersonPct: pct(rows.filter((x) => x.hasFirst).length, rows.length),
    backRefPct: pct(rows.filter((x) => x.backRef).length, rows.length),
    startsQuotePct: pct(rows.filter((x) => x.startsQuote).length, rows.length),
  }
}

// ── ④ 재고 — 갈래 × V레벨 ────────────────────────────────────────────
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: stock, error } = await sb.rpc('exec_sql_readonly', {}).then(
  () => ({ data: null, error: null }),
  () => ({ data: null, error: null }),
)
void stock
void error

// RPC 가 없으므로 PostgREST 집계로 센다 — 갈래별·display_only 별.
const registers = ['narrative', 'expository', 'argumentative', 'news', 'reference']
const inventory = { byRegister: {}, adaptable: {}, note: '' }
for (const r of registers) {
  const { count } = await sb.from('library_articles').select('id', { count: 'exact', head: true }).eq('register', r)
  inventory.byRegister[r] = count ?? null
  const { count: ok } = await sb
    .from('library_articles').select('id', { count: 'exact', head: true })
    .eq('register', r).eq('display_only', false)
  inventory.adaptable[r] = ok ?? null
}
{
  const { count } = await sb.from('library_articles').select('id', { count: 'exact', head: true }).is('register', null)
  inventory.byRegister['(미분류)'] = count ?? null
}
inventory.note =
  'adaptable = display_only=false. ND(개작 불가)는 display_only=true 로 표시돼 있다 — ' +
  'the_conversation 71편이 그 경우다. 갈래 축에 **실용문·전기 칸이 없다**(register enum 에 없다).'

// ── 출력 ──────────────────────────────────────────────────────────────
const out = {
  contract: 'demand-model/v1',
  measuredAt: new Date().toISOString(),
  evidence: {
    기출: 'scripts/csat/data/corpus.json',
    시중교재: 'd:/workspace/textbook-corpus/market-spec.json · corpus.db',
    재고: 'library_articles (PostgREST count)',
  },
  limits: [
    '초·중등 대역은 기출 원장에 없다 — corpus.json 은 고3 수능·모의만 담는다.',
    '듣기 500문항은 분모에서 뺐다 — 지문 원천 수요가 아니다.',
    '갈래 축에 실용문·전기 칸이 없다 — register enum 이 5종뿐이다.',
    '슬롯의 「갈래」는 기출 문항에 라벨이 없어 유형별 분해를 못 했다. 유형×갈래 교차는 비어 있다.',
    '논지 구조는 표지 정규식의 **존재**만 센다 — 구조를 하나로 판정하지 않는다.',
  ],
  readingItems: readingTotal,
  types: typeRows,
  market: { bands: marketBands, stems: marketStems, highStyle: marketStyle },
  inventory,
}

writeFileSync(OUT, JSON.stringify(out, null, 1))
console.log(`기출 독해·장문 ${readingTotal}문항 · 유형 ${typeRows.length}종`)
console.log(`시중 교재 학년대 ${Object.keys(marketBands ?? {}).length}칸 · 발문 표준형 ${marketStems?.length ?? 0}종`)
console.log(`시중 교재 고등 지문 구간 ${marketStyle?.n ?? 0}개`)
console.log('재고 갈래별:', JSON.stringify(inventory.byRegister))
console.log(`→ ${OUT}`)
