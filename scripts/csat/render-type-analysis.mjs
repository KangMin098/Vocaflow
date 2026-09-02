// scripts/csat/render-type-analysis.mjs
//
// **유형별 기출 분석 결과를 문서로 낸다.**
//
// 원장은 `scripts/csat/analysis-drain/*.out.json`(문항 분석 + 3인 검수)과 그 안의 `type_report` 다.
// 이 스크립트는 그것을 읽어 사람이 읽는 한 장으로 접는다 — **문서를 손으로 고치지 않는다.**
// (같은 규약: `render-blueprints.mjs` → `CSAT_TYPE_BLUEPRINTS.md`)
//
// 왜 DB 가 아니라 out.json 을 읽나: 문서는 DB 적재 여부와 무관하게 나와야 한다. 적재는
// 승인·연결이 필요한 별도 단계이고, 분석 결과 자체는 그 앞에서 이미 완성돼 있다.
//
// 실행: node scripts/csat/render-type-analysis.mjs
// 산출: docs/CSAT_TYPE_ANALYSIS.md

import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('scripts/csat/data')
const WORK = path.resolve('scripts/csat/analysis-drain')
const OUT = path.resolve('docs/CSAT_TYPE_ANALYSIS.md')

const corpus = JSON.parse(fs.readFileSync(path.join(DIR, 'corpus.json'), 'utf8'))
const inScope = corpus.items.filter((it) => it.in_scope)

const typeMeta = new Map()
for (const it of inScope) {
  if (!it.type_id) continue
  const e = typeMeta.get(it.type_id) ?? { id: it.type_id, name: it.type_name, n: 0, recent: 0, points3: 0, keyed: 0 }
  e.n += 1
  if (it.year >= 2023) e.recent += 1
  if (it.points === 3) e.points3 += 1
  if (it.answer != null) e.keyed += 1
  typeMeta.set(it.type_id, e)
}

// ── 원장 읽기 ─────────────────────────────────────────────────────────
const reports = new Map() // type_id → type_report 여럿 (청크마다 하나)
const analyzed = new Map() // type_id → Set(item_id)
let reviewCount = 0
let revisedCount = 0

for (const f of fs.readdirSync(WORK).filter((f) => f.endsWith('.out.json')).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8'))
  for (const a of j.analyses ?? []) {
    const tid = corpus.items.find((it) => it.id === a.item_id)?.type_id
    if (!tid) continue
    if (!analyzed.has(tid)) analyzed.set(tid, new Set())
    analyzed.get(tid).add(a.item_id)
    reviewCount += (a.reviews ?? []).length
    if (a.revised) revisedCount += 1
  }
  const tr = j.type_report
  if (tr?.type_id) {
    if (!reports.has(tr.type_id)) reports.set(tr.type_id, [])
    reports.get(tr.type_id).push({ ...tr, source: f })
  }
}

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim()

// ── 문서 ──────────────────────────────────────────────────────────────
const L = []
L.push('# 평가원 기출 — 유형별 분석 결과')
L.push('')
L.push('> **이 문서는 손으로 고치지 않는다.** `scripts/csat/analysis-drain/*.out.json` 을 고치고')
L.push('> `node scripts/csat/render-type-analysis.mjs` 를 다시 돌린다.')
L.push('>')
L.push('> 분모: 수능·모의평가 **독해·장문 ' + inScope.length + '문항**(듣기 제외 · ' +
  new Set(inScope.map((i) => i.exam)).size + '회차).')
L.push('> 모든 문항 분석은 **서로 다른 전문가 셋**(출제자 · 오답분석가 · 현장강사)이 검수해')
L.push('> 셋 다 통과한 것만 실린다. 검수 게이트: `scripts/csat/analysis-drain-validate.mjs`.')
L.push('')

const done = [...analyzed.values()].reduce((a, s) => a + s.size, 0)
L.push('## 0. 지금까지 센 것')
L.push('')
L.push('| | |')
L.push('|---|---|')
L.push(`| 분석·검수 완료 문항 | **${done} / ${inScope.length}** (${((done / inScope.length) * 100).toFixed(1)}%) |`)
L.push(`| 검수 기록 | ${reviewCount}건 (문항당 3인) |`)
L.push(`| 검수에서 반려돼 고친 문항 | **${revisedCount}** |`)
L.push(`| 유형 리포트가 있는 유형 | ${reports.size} / ${typeMeta.size} |`)
L.push('')
L.push('> **반려 수가 0이 아닌 것이 이 표에서 가장 중요하다.** 셋이 같은 것을 재고 있으면 반려가')
L.push('> 안 나오고, 그때 "3인 검수" 는 1인 3회와 같아진다. 반려 사유는 유형별 항목에 적혀 있다.')
L.push('')

// ── 유형 순서: 최근 4개년 출제 빈도 ──────────────────────────────────
const order = [...typeMeta.values()].sort((a, b) => b.recent - a.recent || b.n - a.n)

L.push('## 1. 유형 한눈에')
L.push('')
L.push('| 유형 | 기출 | 최근 4개년 | 3점 | 분석 완료 | 리포트 |')
L.push('|---|---|---|---|---|---|')
for (const t of order) {
  const a = analyzed.get(t.id)?.size ?? 0
  L.push(`| ${t.name} \`${t.id}\` | ${t.n} | ${t.recent} | ${t.points3} | ${a} | ${reports.has(t.id) ? '있음' : '—'} |`)
}
L.push('')

// ── 유형별 상세 ───────────────────────────────────────────────────────
L.push('## 2. 유형별 분석')
L.push('')
for (const t of order) {
  const rs = reports.get(t.id)
  if (!rs?.length) continue
  const a = analyzed.get(t.id)?.size ?? 0
  L.push(`### ${t.name} \`${t.id}\``)
  L.push('')
  L.push(`기출 **${t.n}문항**(최근 4개년 ${t.recent} · 3점 ${t.points3}) · 분석 완료 **${a}** · 리포트 ${rs.length}건`)
  L.push('')

  // 근거 위치 — 청크마다 다르면 **다르다고 적는다**. 합치면 반증이 사라진다.
  const loci = rs.map((r) => r.answer_locus_pattern).filter(Boolean)
  if (loci.length) {
    L.push('**정답 근거는 어디 있나**')
    L.push('')
    for (const [i, x] of loci.entries()) {
      L.push(`- ${loci.length > 1 ? `(${rs[i].source.replace(/^chunk-|\.out\.json$/g, '')}) ` : ''}${esc(x)}`)
    }
    L.push('')
  }

  // 절차 — 가장 문항을 많이 본 리포트의 것을 싣는다(합치면 단계가 뒤엉킨다)
  const best = [...rs].sort((x, y) => (y.n_analyzed ?? 0) - (x.n_analyzed ?? 0))[0]
  const steps = best.procedure ?? best.procedure_steps ?? []
  if (steps.length) {
    L.push(`**푸는 절차** (n=${best.n_analyzed ?? '?'}${best.time_budget_sec ? ` · 권장 ${best.time_budget_sec}초` : ''})`)
    L.push('')
    for (const [i, s] of steps.entries()) {
      L.push(`${i + 1}. ${esc(s.step)}`)
      if (s.on_fail) L.push(`   - 막히면 — ${esc(s.on_fail)}`)
    }
    L.push('')
  }

  // 함정 — 청크를 가로질러 합산한다(같은 라벨은 더한다)
  const trapN = new Map()
  const trapSig = new Map()
  for (const r of rs) {
    for (const tr of r.recurring_traps ?? []) {
      if (!tr?.trap) continue
      trapN.set(tr.trap, (trapN.get(tr.trap) ?? 0) + (typeof tr.count === 'number' ? tr.count : 1))
      if (tr.signature && !trapSig.has(tr.trap)) trapSig.set(tr.trap, tr.signature)
    }
  }
  if (trapN.size) {
    L.push('**되풀이되는 함정**')
    L.push('')
    L.push('| 함정 | 건수 | 어떻게 만들어지나 |')
    L.push('|---|---|---|')
    for (const [k, v] of [...trapN].sort((x, y) => y[1] - x[1])) {
      L.push(`| ${esc(k)} | ${v} | ${esc(trapSig.get(k) ?? '')} |`)
    }
    L.push('')
  }

  const modes = [...new Set(rs.flatMap((r) => r.failure_modes ?? []))]
  if (modes.length) {
    L.push('**여기서 미끄러진다**')
    L.push('')
    for (const m of modes) L.push(`- ${esc(m)}`)
    L.push('')
  }

  const open = [...new Set(rs.flatMap((r) => r.open_questions ?? []))]
  if (open.length) {
    L.push('**아직 말할 수 없는 것** — 표본이 모자라거나 청크끼리 어긋난 것')
    L.push('')
    for (const o of open) L.push(`- ${esc(o)}`)
    L.push('')
  }
}

// ── 배점 설계 — 코퍼스에서 바로 센다 ─────────────────────────────────
//
// 서브에이전트가 「어법은 3점 비율이 높다」는 저장소 기존 실측이 자기 표본(최근 9문항)에서
// 재현되지 않는다고 보고했다. 둘 다 맞았다 — **연도가 갈린다.** 이런 것은 분석문이 아니라
// 원장이 답할 수 있으므로 여기서 센다(손으로 적으면 다음 회차에 낡는다).
{
  const keyed = inScope.filter((it) => it.points != null)
  const rows = new Map()
  for (const it of keyed) {
    const e = rows.get(it.type_id) ?? { n: 0, p3: 0, oldN: 0, oldP3: 0, newN: 0, newP3: 0 }
    const old = it.year <= 2022
    e.n += 1
    if (it.points === 3) e.p3 += 1
    if (old) { e.oldN += 1; if (it.points === 3) e.oldP3 += 1 } else { e.newN += 1; if (it.points === 3) e.newP3 += 1 }
    rows.set(it.type_id, e)
  }
  const shift = [...rows]
    .filter(([, e]) => e.oldN >= 5 && e.newN >= 5 && Math.abs(e.oldP3 / e.oldN - e.newP3 / e.newN) >= 0.4)
    .sort((a, b) => (b[1].oldP3 / b[1].oldN - b[1].newP3 / b[1].newN) - (a[1].oldP3 / a[1].oldN - a[1].newP3 / a[1].newN))
  if (shift.length) {
    L.push('## 3. 배점 설계가 바뀐 자리')
    L.push('')
    L.push('**3점 비율이 2023학년도를 기점으로 40%p 이상 움직인 유형.** 옛 기출로 「이 유형은 3점」을')
    L.push('외우면 지금 시험에서 시간 배분이 어긋난다. (정답표가 있는 문항만 셈)')
    L.push('')
    L.push('| 유형 | ~2022학년도 | 2023학년도~ |')
    L.push('|---|---|---|')
    for (const [id, e] of shift) {
      const nm = typeMeta.get(id)?.name ?? id
      L.push(`| ${nm} \`${id}\` | ${e.oldP3}/${e.oldN} (${Math.round((100 * e.oldP3) / e.oldN)}%) | ${e.newP3}/${e.newN} (${Math.round((100 * e.newP3) / e.newN)}%) |`)
    }
    L.push('')
  }
}

// ── 선지 형식이 바뀐 자리 — 코퍼스에서 바로 센다 ─────────────────────
//
// 서브에이전트가 세 유형에서 「연도에 따라 설계가 다르다」를 보고했다. 그중 **선지 형식**은
// 기계로 셀 수 있으므로 여기서 센다 — 손으로 적으면 다음 회차에 낡고, 그때 이 문서가
// 학습자에게 틀린 말을 하게 된다.
{
  /** 선지 형식의 지문(指紋) — 화살표가 있으면 「변화 쌍」, 슬래시가 있으면 「네모 선택형」 */
  const shape = (it) => {
    const j = (it.choices ?? []).join(' ')
    if (/[→⇒↔]/.test(j)) return '변화 쌍 (A → B)'
    if (/\S\s*\/\s*\S/.test(j) && (it.type_id === 'R-VOCAB' || it.type_id === 'X-VOCAB')) return '네모 선택형 (A / B)'
    return null
  }
  const rows = []
  for (const [tid, meta] of typeMeta) {
    const its = inScope.filter((it) => it.type_id === tid && it.choices?.length).sort((a, b) => a.year - b.year)
    if (its.length < 8) continue
    const marked = its.filter((it) => shape(it))
    if (!marked.length || marked.length === its.length) continue // 늘 그랬거나 한 번도 없었으면 전환이 아니다
    const form = shape(marked[0])
    const years = marked.map((it) => it.year)
    const lo = Math.min(...years)
    const hi = Math.max(...years)
    const others = its.filter((it) => !shape(it)).map((it) => it.year)
    // 두 형식이 **연도로 갈리는지** 본다 — 섞여 있으면 전환이 아니라 공존이다
    const clean = others.every((y) => y < lo) || others.every((y) => y > hi)
    rows.push({ tid, name: meta.name, form, lo, hi, n: marked.length, total: its.length, clean, others })
  }
  if (rows.length) {
    L.push('## 4. 선지 형식이 바뀐 자리')
    L.push('')
    L.push('옛 기출로 형식을 익히면 지금 시험에서 **첫 동작이 어긋난다**. 발문만 보고 절차를 고르려면')
    L.push('여기가 언제 바뀌었는지 알아야 한다. (선지가 파싱된 문항만 셈)')
    L.push('')
    L.push('| 유형 | 형식 | 그 형식인 문항 | 연도 | 두 형식이 연도로 갈리나 |')
    L.push('|---|---|---|---|---|')
    for (const r of rows) {
      L.push(`| ${r.name} \`${r.tid}\` | ${r.form} | ${r.n}/${r.total} | ${r.lo}~${r.hi}학년도 | ${r.clean ? '갈린다' : '**섞여 있다(공존)**'} |`)
    }
    L.push('')
  }
}

// ── 아직 분석 전 ──────────────────────────────────────────────────────
const pending = order.filter((t) => !reports.has(t.id))
if (pending.length) {
  L.push('## 5. 아직 분석 전')
  L.push('')
  L.push('**숨기지 않는다** — 없는 것을 안 적으면 다 된 것처럼 읽힌다.')
  L.push('')
  L.push('| 유형 | 기출 | 최근 4개년 |')
  L.push('|---|---|---|')
  for (const t of pending) L.push(`| ${t.name} \`${t.id}\` | ${t.n} | ${t.recent} |`)
  L.push('')
}

L.push('---')
L.push('')
L.push(`*생성 ${new Date().toISOString().slice(0, 10)} — \`node scripts/csat/render-type-analysis.mjs\`*`)

fs.writeFileSync(OUT, L.join('\n') + '\n')
console.log(`  유형 ${typeMeta.size} · 리포트 있는 유형 ${reports.size} · 분석 완료 ${done}/${inScope.length}`)
console.log(`  검수 ${reviewCount}건 · 반려 후 수정 ${revisedCount}문항`)
console.log(`→ ${OUT}`)
