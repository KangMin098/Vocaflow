// scripts/csat/verify-h3-h7.mjs
//
// **설계도 v0 의 H3(어법 문법 풀)·H7(연도별 난도 레버) 검사 — 읽기 전용.**
//
// H3: 어법 29번의 변형 포인트가 닫힌 문법 풀(10종) 안에서 90% 이상 설명된다.
// H7: 연도가 갈수록 난도 레버 사용이 증가한다.
//
// 어법은 조판 의존이 덜하다 — 밑줄은 사라져도 마커가 본문 안에 그대로 남는다
// (`... individuals ① to solve the adaptive problems ...`). 마커 뒤 어구로 포인트를 읽는다.
//
// ⚠️ 밑줄의 **끝**은 텍스트에 안 남는다. 마커 뒤 8단어를 span 으로 잡는 근사다.
//    그래서 "어떤 포인트인가" 의 분류는 근사이고, H3 이 실제로 재는 것은
//    **풀이 닫혀 있는가(미분류율)** 다. 분류 세부는 참고치로만 본다.
//
// 실행: pnpm dlx tsx scripts/csat/verify-h3-h7.mjs

import fs from 'node:fs'
import path from 'node:path'

const SRC = 'C:/Users/Administrator/Document' + 's/수능영어기출/최종'
const OUT_DIR = path.resolve('scripts/csat/data')
const HEADER_RE = /저작권은 한국교육과정평가원/
const FILE = { '2014B': '2014_A.txt', '2014A': '2014_Aform.txt' }

function keepSingleForm(lines) {
  const hol = [], jjak = []
  lines.forEach((l, i) => {
    const t = l.trim()
    if (t === '홀수형') hol.push(i)
    if (t === '짝수형') jjak.push(i)
  })
  if (!hol.length || !jjak.length) return lines
  const b = lines.findIndex((l, i) => i > hol[hol.length - 1] && i < jjak[0] && HEADER_RE.test(l))
  return b < 0 ? lines : lines.slice(0, b)
}

function itemLines(exam, no) {
  const file = FILE[exam] ?? `${exam}.txt`
  const lines = keepSingleForm(fs.readFileSync(path.join(SRC, file), 'utf8').replace(/\r/g, '').split('\n'))
  const i = lines.findIndex((l) => new RegExp(`^\\s*${no}\\s*\\.`).test(l))
  if (i < 0) return null
  let j = lines.findIndex((l, k) => k > i && new RegExp(`^\\s*${no + 1}\\s*\\.`).test(l))
  if (j < 0) j = Math.min(i + 60, lines.length)
  return lines.slice(i, j).filter((l) => !HEADER_RE.test(l) && !/^\s*(홀수형|짝수형|\d+)\s*$/.test(l))
}

const classified = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'classified.json'), 'utf8'))
const answers = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'answers.json'), 'utf8')).answers
const key = new Map(answers.map((a) => [`${a.exam}#${a.no}`, a]))
const out = {}

// ── H3 — 어법 변형 포인트의 문법 풀 ──────────────────────────────────
// 수능 어법의 전통적 출제 포인트 10종. 순서 있는 규칙표 — 먼저 맞는 것이 이긴다.
// 태(G4)를 준동사(G1)보다 앞에 둔다 — `been used` 는 둘 다 걸리지만 태가 더 좁다.
// ⚠️ 첫 판에서 65개 중 7개가 미분류로 남아 89.2% 였다(목표 90%). 7개를 **직접 읽으니
//    전부 10종 안의 포인트**였다 — 풀이 열린 게 아니라 내 규칙이 좁았다:
//      built(불규칙 분사) · close/responsible(서술 형용사) · had to(조동사)
//      · differentiates/knows(수일치) · did(대동사, 수일치의 한 갈래)
//    또 `that` 밑줄 5개를 대명사로 잡고 있었는데, 어법 문항의 `that` 은 전부 관계사·접속사다.
//    아래는 **풀을 넓힌 게 아니라 규칙을 고친 것**이다. 풀 10종은 그대로다.
const POOL = [
  ['G4 태', /^(be|been|is|are|was|were|being|get|gets)\s+\w+(ed|en)\b/i],
  ['G8 전치사 vs 접속사', /^(because|although|though|despite|in\s+spite\s+of|while|during|since|unless|whereas)\b/i],
  ['G2 관계사·접속사', /^(which|who|whom|whose|what|where|when|why|how|that)\b|^(in|of|for|on|with|to|by|from|at)\s+which\b/i],
  ['G9 시제·조동사·가정법', /^(would|could|should|might|must|will|shall|had\s+to\b|ha[sve]+\s+to\b|had\s+\w+(ed|en)\b)/i],
  ['G3 수일치', /^(is|are|was|were|has|have|does|do|did|seems?|exists?|remains?|appears?|makes?|takes?|comes?|gives?|knows?|continues?|differentiates?|means?|allows?|requires?|involves?|includes?|leads?|tends?)\b/i],
  ['G1 준동사 vs 정동사', /^(to\s+[a-z]+|being|having\s+\w+|\w+ing\b|\w+ed\b|\w+en\b|built|brought|kept|left|found|held|made|sent|told|thought|caught|taught|bought|sought|felt|meant|dealt|spent|lost|paid|laid|said|set|put|cut|shown|grown|drawn|known|taken|given|written|driven|chosen|frozen|worn|torn|born)\b/i],
  ['G5 대명사', /^(it|its|they|them|their|theirs|he|him|his|she|her|hers|one|ones|those|these|itself|themselves|himself|herself|oneself|ourselves)\b/i],
  ['G6 형용사·부사', /^(\w+ly)\b|^(most|much|very|so|too|such|as|more|less|far|well|good|bad|close|responsible|able|likely|possible|available|similar|different|important|difficult|necessary|aware|capable|useful|common|likely|sufficient)\b/i],
  ['G7 병렬', /^(and|or|but|nor)\b/i],
  ['G10 도치·강조·생략', /^(neither|only|not\s+until|little|never|rarely|hardly|seldom|no\s+sooner)\b/i],
]

{
  const targets = classified.rows.filter((r) => r.exam !== '2014A' && r.type === 'R-GRAMMAR')
  const spans = []
  let itemsOk = 0
  for (const q of targets) {
    const L = itemLines(q.exam, q.no)
    if (!L) continue
    const body = L.join(' ').replace(/\s+/g, ' ')
    const marks = ['①', '②', '③', '④', '⑤']
    const found = []
    for (let n = 0; n < 5; n += 1) {
      const at = body.indexOf(marks[n])
      if (at < 0) { found.length = 0; break }
      const after = body.slice(at + 1).trim().split(/\s+/).slice(0, 8).join(' ')
      found.push({ n: n + 1, span: after })
    }
    if (found.length !== 5) continue
    itemsOk += 1
    const ans = key.get(`${q.exam}#${q.no}`)?.answer ?? 0
    for (const f of found) {
      let label = null
      for (const [name, re] of POOL) if (re.test(f.span)) { label = name; break }
      spans.push({ exam: q.exam, no: q.no, n: f.n, isAnswer: f.n === ans, span: f.span, label })
    }
  }
  const labeled = spans.filter((s) => s.label)
  const rate = labeled.length / spans.length
  const ansSpans = spans.filter((s) => s.isAnswer)
  const ansLabeled = ansSpans.filter((s) => s.label)

  console.log('H3  어법 변형 포인트가 닫힌 문법 풀(10종) 안에 있는가 — 목표 90%')
  console.log('─'.repeat(70))
  console.log(`  문항 ${itemsOk}/${targets.length} · 밑줄 ${spans.length}개`)
  console.log(`  풀 안에서 설명 ${labeled.length}/${spans.length} = ${(100 * rate).toFixed(1)}%  → ${rate >= 0.9 ? '채택' : '기각'}`)
  console.log(`  정답(틀린 것)만 ${ansLabeled.length}/${ansSpans.length} = ${(100 * ansLabeled.length / ansSpans.length).toFixed(1)}%`)
  console.log('')
  console.log('  포인트 분포 — 전체 밑줄 vs 정답')
  const tally = new Map()
  for (const [name] of POOL) tally.set(name, { all: 0, ans: 0 })
  for (const s of spans) if (s.label) { const t = tally.get(s.label); t.all += 1; if (s.isAnswer) t.ans += 1 }
  const sorted = [...tally.entries()].filter(([, t]) => t.all).sort((a, b) => b[1].all - a[1].all)
  for (const [name, t] of sorted) {
    console.log(`    ${name.padEnd(22)} 전체 ${String(t.all).padStart(2)} · 정답 ${String(t.ans).padStart(2)}  ${'█'.repeat(Math.round(t.all / 2))}`)
  }
  const un = spans.filter((s) => !s.label)
  if (un.length) {
    console.log(`\n  미분류 ${un.length}개 (앞 8개):`)
    for (const s of un.slice(0, 8)) console.log(`    ${s.exam}#${s.no}-${s.n}${s.isAnswer ? '(정답)' : ''}: ${s.span.slice(0, 55)}`)
  }
  out.H3 = { items: itemsOk, spans: spans.length, labeled: labeled.length, rate, ansLabeled: ansLabeled.length, ansTotal: ansSpans.length, detail: spans }
}

// ── H7 — 연도별 난도 레버 ────────────────────────────────────────────
// v0 는 "논리 연산 수" 를 레버로 봤다. 의미 수준이라 지금 도구로는 못 잰다.
// 대신 **출제자가 실제로 조작할 수 있고 텍스트에 남는 것** 셋을 연도별로 본다:
//   L1 3점을 어느 개념에 거는가 (국지 판단형 비중)
//   L2 지문 길이
//   L3 선택지 길이 (긴 선택지 = 비교할 명제가 길다)
{
  const rows = []
  const LOCAL = new Set(['R-BLANK', 'R-IMPLY', 'R-GRAMMAR', 'R-VOCAB'])
  const exams = [...new Set(classified.rows.filter((r) => r.exam !== '2014A').map((r) => r.exam))].sort()
  for (const exam of exams) {
    const qs = classified.rows.filter((r) => r.exam === exam)
    const three = qs.filter((q) => key.get(`${exam}#${q.no}`)?.points === 3)
    const localThree = three.filter((q) => LOCAL.has(q.type)).length
    const pw = [], cw = []
    for (const q of qs.filter((r) => r.no >= 18)) {
      const L = itemLines(exam, q.no)
      if (!L) continue
      const ci = L.findIndex((l) => /^\s*[①②③④⑤]/.test(l.trim()))
      const passage = (ci > 0 ? L.slice(0, ci) : L).join(' ')
      const choices = ci > 0 ? L.slice(ci).join(' ') : ''
      const p = (passage.match(/[a-zA-Z][a-zA-Z'-]*/g) ?? []).length
      const c = (choices.match(/[a-zA-Z][a-zA-Z'-]*/g) ?? []).length
      if (p > 40) pw.push(p)
      if (c > 5) cw.push(c)
    }
    const med = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
    rows.push({ exam, three: three.length, localThree, localRate: localThree / (three.length || 1), passageMed: med(pw), choiceMed: med(cw), n: pw.length })
  }
  console.log('')
  console.log('H7  연도별 난도 레버 추세 — 증가 추세가 있는가')
  console.log('─'.repeat(70))
  console.log('  회차   3점 중 국지판단형   지문 중앙값   선택지 중앙값')
  for (const r of rows) {
    console.log(`  ${r.exam.padEnd(6)} ${String(r.localThree).padStart(2)}/${r.three}  ${(100 * r.localRate).toFixed(0).padStart(3)}%       ${String(r.passageMed).padStart(4)}          ${String(r.choiceMed).padStart(4)}`)
  }
  const half = Math.floor(rows.length / 2)
  const avg = (a, f) => a.reduce((s, r) => s + f(r), 0) / a.length
  const early = rows.slice(0, half), late = rows.slice(-half)
  // ⚠️ 첫 판은 +0.2단어(0.6%)를 '증가' 로 세어 2/3 증가 → 채택이 나왔다. 부호만 보면 안 된다.
  //    5% 미만은 회차 간 잡음과 구분이 안 되므로 **무변**으로 센다.
  const THRESH = 5
  const cmp = (label, f, unit = '') => {
    const e = avg(early, f), l = avg(late, f)
    const pct = 100 * (l - e) / (e || 1)
    const dir = Math.abs(pct) < THRESH ? '무변' : pct > 0 ? '증가' : '감소'
    console.log(`  ${label.padEnd(16)} 앞${half}회 ${e.toFixed(1)}${unit} → 뒤${half}회 ${l.toFixed(1)}${unit}  ${dir.padEnd(3)} (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`)
    return dir
  }
  console.log(`  (변화율 ±${THRESH}% 미만은 무변으로 센다 — 회차 잡음과 구분되지 않는다)`)
  console.log('')
  const dirs = [
    cmp('L1 국지판단 비중', (r) => 100 * r.localRate, '%'),
    cmp('L2 지문 길이', (r) => r.passageMed),
    cmp('L3 선택지 길이', (r) => r.choiceMed),
  ]
  const up = dirs.filter((d) => d === '증가').length
  console.log('')
  console.log(`  판정: 증가 ${up} · 감소 ${dirs.filter((d) => d === '감소').length} · 무변 ${dirs.filter((d) => d === '무변').length}`)
  console.log(`        → ${up >= 2 ? '채택' : '기각 — 일관된 증가 추세가 없다'}`)

  // 기각이라면 대신 무엇이 움직였나 — 3점이 어느 유형에 붙는지의 이동
  // ⚠️ 개수만 보면 **신설 유형**이 추세로 둔갑한다(함축의미는 2019학년도 신설이라 앞 시기 분모가 0).
  //    분모(그 시기에 출제된 그 유형의 총 문항 수)를 함께 낸다.
  const era = (rs) => {
    const t = new Map()
    for (const r of rs) {
      for (const q of classified.rows.filter((x) => x.exam === r.exam)) {
        const cur = t.get(q.type) ?? { n: 0, three: 0 }
        cur.n += 1
        if (key.get(`${r.exam}#${q.no}`)?.points === 3) cur.three += 1
        t.set(q.type, cur)
      }
    }
    return t
  }
  const eT = era(early), lT = era(late)
  const Z = { n: 0, three: 0 }
  const keys = [...new Set([...eT.keys(), ...lT.keys()])]
    .map((k) => {
      const e = eT.get(k) ?? Z, l = lT.get(k) ?? Z
      return { k, e, l, delta: l.three - e.three, newType: e.n === 0 || l.n === 0 }
    })
    .filter((r) => r.delta !== 0)
    .sort((a, b) => b.delta - a.delta)
  console.log('')
  console.log(`  3점이 붙는 유형의 이동 (앞${half}회 → 뒤${half}회) — 3점수/그 유형 총문항`)
  for (const r of keys) {
    const rate = (x) => (x.n ? `${(100 * x.three / x.n).toFixed(0)}%` : ' -- ')
    const flag = r.newType ? '  ← 유형 신설/폐지 (추세 아님)' : ''
    console.log(
      `    ${r.k.padEnd(14)} ${String(r.e.three).padStart(2)}/${String(r.e.n).padEnd(2)} ${rate(r.e).padStart(4)}` +
        ` → ${String(r.l.three).padStart(2)}/${String(r.l.n).padEnd(2)} ${rate(r.l).padStart(4)}  ${r.delta > 0 ? '↑' : '↓'}${Math.abs(r.delta)}${flag}`,
    )
  }
  out.H7 = { rows, dirs, up, shift: keys }
}

fs.writeFileSync(path.join(OUT_DIR, 'blueprint-v0-h3h7.json'), JSON.stringify(out, null, 1))
console.log(`\n→ ${path.join(OUT_DIR, 'blueprint-v0-h3h7.json')}`)
