// scripts/textbook/bias-review-report.mjs
//
// **편향·차별 검토 표시 — 검정 교과서가 거치는 심사의 자리.**
//
// ⚠️ **이 스크립트는 판정하지 않고 아무것도 지우지 않는다.** 어떤 글이 편향적인지는
//   사람이 판단할 일이다 — 노예제·전쟁·장애를 다루는 지문은 낱말이 나온다는 이유로
//   걸러지면 안 되고, 반대로 낱말이 깨끗해도 서술이 편향될 수 있다.
//   기계가 하는 일은 **사람의 눈이 갈 자리를 좁히는 것**뿐이다.
//
// 비하·낡은 호칭 목록은 **주입한다** — `scripts/dict/SLUR_CANDIDATES.json` 은 사전
// 큐레이션에서 낱말마다 사유를 달아 만든 것이고, 그 판단은 한곳에서 관리돼야 한다.
// 파일이 없으면 그 검사만 건너뛰고 **건너뛰었다고 적는다**(조용히 통과시키지 않는다).
//
// 재실행 안전: 읽기만 한다.
// 실행: pnpm dlx tsx scripts/textbook/bias-review-report.mjs [--show 20]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const SHOW = Number(arg('show') ?? 12)

const { createClient } = await import('@supabase/supabase-js')
const { reviewStock, reviewPassage } = await import('@vocaflow/library-pipeline')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── 비하·낡은 호칭 목록 (주입) ──────────────────────────────────────
const SLUR_PATH = path.resolve('scripts/dict/SLUR_CANDIDATES.json')
let derogatory = new Map()
let slurNote = ''
if (fs.existsSync(SLUR_PATH)) {
  const raw = JSON.parse(fs.readFileSync(SLUR_PATH, 'utf8'))
  derogatory = new Map(Object.entries(raw).map(([w, why]) => [w.toLowerCase(), String(why)]))
  slurNote = `비하·낡은 호칭 목록 ${derogatory.size}항목 적재 (${path.relative(process.cwd(), SLUR_PATH)})`
} else {
  slurNote = `⚠️ 비하·낡은 호칭 목록이 없다 — 그 검사는 **건너뛰었다**. (${path.relative(process.cwd(), SLUR_PATH)})`
}

// ── 지문 재고 ───────────────────────────────────────────────────────
const passages = []
const meta = []
for (let from = 0; ; from += 500) {
  const { data, error } = await db
    .from('csat_dcp_items')
    .select('id, type, payload, v_level')
    .order('id')
    .range(from, from + 499)
  if (error) throw new Error('문항 조회 실패: ' + error.message)
  if (!data?.length) break
  for (const r of data) {
    const p = r.payload ?? {}
    const text = [
      p.intro,
      ...(p.sentences ?? []),
      ...(p.presented ?? []),
      ...(p.remaining ?? []),
      p.insert_sentence,
      p.answer, // 영작 배열의 정답 문장
    ]
      .filter(Boolean)
      .join(' ')
    if (!text) continue
    passages.push(text)
    meta.push({ id: r.id, type: r.type, vLevel: r.v_level, text })
  }
  if (data.length < 500) break
}

const r = reviewStock(passages, derogatory)

const line = '─'.repeat(78)
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + '%' : '—')

console.log(`${line}\n편향·차별 검토 표시 — 판정이 아니라 **사람이 볼 자리**\n`)
console.log(`  ${slurNote}\n`)
console.log(`  검사한 지문        ${r.passages.toLocaleString()}`)
console.log(`  **검토 표시        ${r.flagged.toLocaleString()}  = ${pct(r.flagged, r.passages)}**`)
console.log(`  ↳ 전체가 아니라 이만큼만 사람이 보면 된다.\n`)

const KIND_KO = {
  derogatory: '비하·낡은 호칭',
  gendered_occupation: '성별 표시 직업어',
  pronoun_imbalance: '성별 대명사 쏠림',
}
console.log('  종류별 (표시 건수)')
for (const [k, n] of Object.entries(r.byKind)) {
  if (k === 'pronoun_imbalance') continue
  console.log(`    ${KIND_KO[k].padEnd(20)} ${String(n).padStart(6)}`)
}

const p = r.pronouns
console.log(
  `\n  성별 대명사 균형 — 남성 ${p.male.toLocaleString()} · 여성 ${p.female.toLocaleString()}` +
    `   χ²=${p.chi2.toFixed(1)} (df 1, 임계 3.841)  ${p.imbalanced ? '⚠️ 쏠림' : '✅ 고름'}`,
)
console.log('    ↳ 한 지문이 기우는 것은 편향이 아니다 — **재고 전체를 모아 놓고** 본다.')

if (r.topCues.length) {
  console.log(`\n  가장 자주 걸린 표현 (상위 ${Math.min(SHOW, r.topCues.length)})`)
  for (const c of r.topCues.slice(0, SHOW)) {
    console.log(`    ${c.cue.padEnd(22)} ${String(c.count).padStart(5)}  ${KIND_KO[c.kind]}`)
  }
}

// 실제로 어떤 문항인지 몇 개 보여 준다 — 숫자만 보면 사람이 판단할 수 없다.
const samples = meta
  .map((m) => ({ m, f: reviewPassage(m.text, derogatory) }))
  .filter((x) => x.f.length)
  .slice(0, 3)

if (samples.length) {
  console.log(`\n${line}\n표시된 지문 표본 ${samples.length}개 — 사람이 볼 것\n`)
  for (const s of samples) {
    console.log(`  [${s.m.type} · V${s.m.vLevel}] ${s.m.id}`)
    for (const f of s.f) {
      console.log(`     · "${f.cue}" — ${f.why}${f.alternative ? ` (대안: ${f.alternative})` : ''}`)
    }
    console.log()
  }
}

console.log(line)
console.log('\n  ⚠️ 이 리포트는 아무것도 지우지 않았다. 발행 여부는 사람이 정한다.')
