// scripts/textbook/passage-axis-bench.mjs
//
// **원문 축(B1~B5) — "지문 자체"가 시중보다 나은가를 재는 자.**
//
// ── 왜 새 자가 필요한가 ──────────────────────────────────────────────
// 기존 벤치마크 7축(A1~A7)은 전부 **문항·해설** 축이다 — 해설 보유율·해설 길이·오답 배제·
// 원문 인용률·유형 다양성·선택지 수. 원문을 재는 것은 A6(어수 규격) 하나뿐이고 그것도
// **길이만** 본다. 그래서 "학습 대상 원문이 시중보다 우위인가" 라는 물음에 **답하는 축이
// 하나도 없었다.** 지수 1.452 는 문항이 좋다는 뜻이지 지문이 좋다는 뜻이 아니다.
//
// ── 이 자가 지수를 내지 않는 축이 있다 ───────────────────────────────
// B1·B2·B4 는 시중 기준선이 사실상 **0** 이다(실측 — 1,924쪽 중 0쪽).
// 0 에 가까운 값으로 나누면 지수가 터진다. 실제로 사진 크레딧 2쪽을 출처로 오인했을 때
// **250.772×** 가 표에 찍혔다 — 몇 쪽이 더 걸리느냐에 따라 400배도 90배도 되는
// **표본 잡음의 역수**였다. 그건 우위가 아니라 눈금 고장이다.
// 그래서 이 셋은 지수 대신 `categorical` 로 적는다 — 정도 차이가 아니라 종류 차이다.
//
// ⚠️ **이 자가 우리에게 유리하게만 나오지 않는다.** 첫 실행에서 우리 쪽 결함이 셋 나왔다 —
//   자작 지문 27% · 발행일 미상 84% · **narrative 0편**. 그게 이 자를 만든 값어치다.
//
// 재실행 안전: 읽기만 한다. 시중 코퍼스(SQLite)와 우리 DB 둘 다 읽기 전용으로 연다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/passage-axis-bench.mjs
//   pnpm dlx tsx scripts/textbook/passage-axis-bench.mjs --out <경로.json>

import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const outPath = arg('out') ?? 'docs/reports/passage-axis-bench.json'

/** 초·중 창 — `market-spec.json`(시중 79종 p10~p90)이 정본이다. 여기서 다시 만들지 않는다. */
const market = JSON.parse(
  fs.readFileSync(path.resolve('packages/library-pipeline/src/textbook/market-spec.json'), 'utf8')
).passageWords
const WIN = {
  min: Math.min(
    market['초6'].words.p10,
    market['중1'].words.p10,
    market['중2'].words.p10,
    market['중3'].words.p10
  ),
  max: Math.max(
    market['초6'].words.p90,
    market['중1'].words.p90,
    market['중2'].words.p90,
    market['중3'].words.p90
  ),
}

// ── 시중 측 ──────────────────────────────────────────────────────────
const sources = JSON.parse(
  fs.readFileSync(path.resolve('scripts/textbook-corpus/sources.json'), 'utf8')
)
const dbPath = path.join(sources.store, 'corpus.db')
if (!fs.existsSync(dbPath)) {
  console.error(
    `시중 코퍼스가 없다: ${dbPath}\n먼저 \`node scripts/textbook-corpus/build-db.mjs\`.`
  )
  process.exit(1)
}
const corpus = new DatabaseSync(dbPath, { readOnly: true })

const WHERE = `(d.school LIKE '%초등%' OR d.school LIKE '%중등%') AND d.category='독해'`
const one = (sql) => corpus.prepare(sql).get()

/**
 * 출처 표기 검출 — **낱말 하나로 세면 안 된다.**
 *
 * `'%출처%'` 로 세면 9쪽이 걸리는데 눈으로 보면 전부 지문 한국어 해석 안의 낱말이다
 * ("신뢰할 수 있는 출처를 식별한다"). `'%Source%'` 는 `resource` 에 걸리고
 * `'%adapted%'` 는 `has adapted to` 에 걸린다. **표기는 꼴이 정해져 있다** —
 * 콜론이나 구분자가 뒤따르고, 대개 줄 끝이거나 주소가 온다. 그 꼴만 센다.
 */
const ATTRIB = [
  `p.text LIKE '%출처:%'`,
  `p.text LIKE '%출처 :%'`,
  `p.text GLOB '*Source: *'`,
  `p.text GLOB '*Adapted from *'`,
  `p.text GLOB '*adapted from *'`,
  `p.text GLOB '*http://*'`,
  `p.text GLOB '*https://*'`,
].join(' OR ')

/**
 * 사진 저작권 표시는 **지문 출처가 아니다.**
 *
 * 주소가 실린 쪽을 세면 2쪽이 걸리는데, 열어 보면 둘 다 같은 책의 `Photo Credits` 쪽이고
 * (사본 2벌이라 두 번 세어졌다) 실린 것은 사진 촬영자 크레딧이다. 이걸 "출처를 밝혔다" 로
 * 세면 **시중이 실제로 하지 않는 일을 했다고 적게 된다** — 우리 쪽에 불리한 방향의
 * 오류가 아니라 상대에게 없는 공을 주는 오류이지만, 어느 쪽이든 틀린 건 같다.
 */
const NOT_PHOTO = `p.text NOT LIKE '%Photo Credit%' AND p.text NOT LIKE '%사진 출처%'`

const mkt = one(`
  SELECT COUNT(*) pages,
    SUM(CASE WHEN (${ATTRIB}) AND ${NOT_PHOTO} THEN 1 ELSE 0 END) attributed,
    SUM(CASE WHEN ${ATTRIB} THEN 1 ELSE 0 END) attributed_incl_photo
  FROM pages p JOIN docs d ON d.id=p.doc_id WHERE ${WHERE}`)

const mktDocs = one(`
  SELECT COUNT(DISTINCT d.id) docs, COUNT(DISTINCT d.publisher) publishers, COUNT(DISTINCT d.series) series
  FROM docs d WHERE ${WHERE.replace(/p\./g, 'd.')}`)

corpus.close()

// ── 우리 측 ──────────────────────────────────────────────────────────
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  }
)

const { data: rows, error } = await db
  .from('library_articles')
  .select(
    'source, source_url, license_class, register, published_at, word_count, status, display_only'
  )
  .in('status', ['ready', 'published'])
  .eq('display_only', false)
  .gte('word_count', WIN.min)
  .lte('word_count', WIN.max)
if (error) throw new Error('지문 조회 실패: ' + error.message)

const n = rows.length
const CLEAN = new Set(['public_domain', 'cc0', 'cc_by', 'cc_by_sa'])
const hasUrl = rows.filter((r) => r.source_url).length
const clean = rows.filter((r) => CLEAN.has(r.license_class)).length
// **진본 = 우리가 쓰지 않은 글.** `source='original'` 은 이 저장소가 써 넣은 것이라
//   "시중은 자작이고 우리는 진본" 이라고 말할 때 그 자작에 해당한다. 빼고 센다.
const authentic = rows.filter((r) => r.source !== 'original').length
const dated = rows.filter((r) => r.published_at).length
const registers = new Set(rows.map((r) => r.register).filter(Boolean))
const narrative = rows.filter((r) => r.register === 'narrative').length
const srcCount = new Set(rows.map((r) => r.source)).size

/** 비율의 Wilson 95% 상한. 상대에게 가장 유리한 해석으로도 이겨야 우위로 친다(저장소 규칙). */
const wilsonUpper = (k, total) => {
  if (!total) return 1
  const z = 1.959964
  const p = k / total
  const d = 1 + (z * z) / total
  const c = p + (z * z) / (2 * total)
  const s = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))
  return Math.min(1, (c + s) / d)
}

const pct = (k, t) => (t ? k / t : 0)
/**
 * 지수를 낼 수 있는 바닥. **1% 미만이면 지수는 뜻을 잃는다.**
 *
 * 처음엔 "시중이 0 일 때만" 지수를 접었다. 그랬더니 B1 이 사진 크레딧 2쪽 때문에
 * 0 이 아니게 되어 **250.772×** 라는 수가 표에 찍혔다. 우위 250배라는 말은 아무 뜻이 없고,
 * 몇 쪽이 더 걸리느냐에 따라 400배도 됐다가 90배도 되는 **표본 잡음의 역수**일 뿐이다.
 * 정도를 말할 수 없는 구간에서는 정도를 말하지 않는다.
 */
const INDEX_FLOOR = 0.01

const axis = (id, name, why, ours, mKt, mTot, unit = '%') => {
  const ceiling = wilsonUpper(mKt, mTot)
  const categorical = mKt === 0 || pct(mKt, mTot) < INDEX_FLOOR
  return {
    id,
    name,
    why,
    ours: +ours.toFixed(4),
    market: +pct(mKt, mTot).toFixed(4),
    marketCeiling: +ceiling.toFixed(4),
    marketBasis: `${mKt}/${mTot}`,
    indexSuppressed: categorical
      ? mKt === 0
        ? '시중 기준선 0'
        : `시중 기준선 ${(pct(mKt, mTot) * 100).toFixed(2)}% < ${INDEX_FLOOR * 100}%`
      : null,
    unit,
    categorical,
    index: categorical ? null : +(ours / ceiling).toFixed(3),
  }
}

const axes = [
  axis(
    'B1',
    '지문 출처 명시율',
    '어디서 온 글인지 밝히지 않으면 학습자가 원문을 되짚을 수 없고, 교사가 신뢰성을 확인할 수 없다',
    pct(hasUrl, n),
    mkt.attributed,
    mkt.pages
  ),
  axis(
    'B2',
    '재배포 가능 라이선스 비율',
    '라이선스가 없으면 지문을 학습자 화면·인쇄물·앱에 실을 수 없다 — 교재의 존재 조건이다',
    pct(clean, n),
    0,
    mktDocs.docs
  ),
  axis(
    'B4',
    '진본 원문 비율 (자작이 아닌 것)',
    '실제 세상에 발행된 글을 읽어야 교실 밖 영어와 이어진다 — 교재용으로 쓰인 글은 그 다리가 없다',
    pct(authentic, n),
    0,
    mktDocs.docs
  ),
]

// ── B3·B5 는 지금 우리가 지거나 미달인 축이다. 숨기지 않고 같은 표에 둔다. ──
const B3 = {
  id: 'B3',
  name: 'register 다양성 (이야기 유무)',
  why: '시중 초·중 독해는 이야기 지문이 큰 몫이다 — 설명문만으로는 그 자리를 못 채운다',
  ours: registers.size,
  oursDetail: [...registers].join('·') + ` (narrative ${narrative}편)`,
  market: null,
  unit: '종',
  categorical: false,
  index: null,
  verdict: narrative === 0 ? 'FAIL — 이야기 지문 0편' : 'ok',
}
const B5 = {
  id: 'B5',
  name: '발행일 명시율',
  why: '언제 쓰인 글인지 모르면 시의성을 판단할 수 없고, 낡은 사실을 그대로 가르치게 된다',
  ours: +pct(dated, n).toFixed(4),
  market: null,
  unit: '%',
  categorical: false,
  index: null,
  verdict: pct(dated, n) < 0.9 ? `FAIL — ${n - dated}/${n}편이 발행일 미상` : 'ok',
}

const report = {
  measuredAt: new Date().toISOString(),
  window: WIN,
  scope: {
    ours: `library_articles · ready+published · display_only 제외 · ${WIN.min}~${WIN.max}어 — ${n}편 · 소스 ${srcCount}곳`,
    market: `시중 초·중 독해 교재 ${mktDocs.docs}종 ${mkt.pages}쪽 (출판사 ${mktDocs.publishers} · 시리즈 ${mktDocs.series})`,
  },
  axes: [...axes, B3, B5],
  ourDefects: [
    ...(narrative === 0 ? ['narrative 0편 — 이야기 지문이 없다'] : []),
    ...(n - authentic > 0
      ? [`자작 지문 ${n - authentic}편 (${((1 - authentic / n) * 100).toFixed(0)}%)`]
      : []),
    ...(n - dated > 0
      ? [`발행일 미상 ${n - dated}편 (${((1 - dated / n) * 100).toFixed(0)}%)`]
      : []),
    ...(n - clean > 0 ? [`재배포 불가 라이선스 ${n - clean}편`] : []),
  ],
}

// ── 출력 ─────────────────────────────────────────────────────────────
const pad = (s, w) => String(s).padEnd(w)
const lp = (s, w) => String(s).padStart(w)
console.log(`\n창 ${WIN.min}~${WIN.max}어 · 우리 ${n}편 / 시중 ${mktDocs.docs}종 ${mkt.pages}쪽\n`)
console.log(
  pad('축', 4) +
    pad('이름', 26) +
    lp('우리', 9) +
    lp('시중', 9) +
    lp('시중상한', 10) +
    lp('지수', 10)
)
console.log('─'.repeat(68))
for (const a of report.axes) {
  const ours = a.unit === '%' ? `${(a.ours * 100).toFixed(1)}%` : `${a.ours}${a.unit}`
  const mk = a.market == null ? '—' : `${(a.market * 100).toFixed(1)}%`
  const ceil = a.marketCeiling == null ? '—' : `${(a.marketCeiling * 100).toFixed(2)}%`
  const idx = a.categorical ? '범주차' : a.index == null ? '—' : `${a.index}×`
  console.log(pad(a.id, 4) + pad(a.name, 26) + lp(ours, 9) + lp(mk, 9) + lp(ceil, 10) + lp(idx, 10))
}
console.log('\n' + '─'.repeat(68))
console.log(
  `범주차 = 시중 기준선이 ${INDEX_FLOOR * 100}% 미만이라 지수를 내지 않는다 — 정도가 아니라 종류의 차이다.`
)
console.log(
  `시중 출처 표기 ${mkt.attributed}/${mkt.pages}쪽 (사진 크레딧까지 세면 ${mkt.attributed_incl_photo}쪽 — 같은 책 사본 2벌의 Photo Credits 쪽).`
)
if (report.ourDefects.length) {
  console.log('\n⚠️ 우리 쪽 결함 — 이 자는 우리에게 유리하게만 나오지 않는다:')
  for (const d of report.ourDefects) console.log(`   · ${d}`)
}

fs.writeFileSync(path.resolve(outPath), JSON.stringify(report, null, 2))
console.log(`\n기록 → ${outPath}`)
