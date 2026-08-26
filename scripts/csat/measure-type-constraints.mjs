// scripts/csat/measure-type-constraints.mjs
//
// **37 유형 전부에 "출제자가 반드시 지키는 제약" 을 14개년으로 찾는다.**
//
// 이 저장소가 배운 것 하나 — **특징은 base rate 에 묻히고, 제약은 답을 잠근다**(CSAT_TYPE_DESIGN §5.2).
// 그래서 두 층으로 나눠 잰다.
//
//   형식 제약 F — 14개년 **예외 0** 이면 HARD. 출제자가 어길 수 없는 판형 규칙이다.
//     F1 자리   그 유형이 오는 문항 번호
//     F2 배점   3점이 붙는가
//     F5 선지형 텍스트 5개인가 · 본문 기호(①~⑤)인가 · 조합형((A)(B)(C))인가 · 한국어인가
//
//   내용 제약 S — 기저 대비 이항검정 + Holm 보정. 살아남는 것만 SOFT/HARD.
//     S1 정답 번호 분포 (①회피 · 특정 번호 쏠림)
//     S2 정답 선지의 길이 순위 (최장/최단)
//     S3 정답 선지가 지문과 가장 많이 겹치는가  ← P10.18 이 전체에서 기각한 축. 유형별로 다시 본다
//
// ⚠️ **분모는 수능 14개년만.** 모평을 섞으면 "14개년 비교" 가 아니게 된다.
// ⚠️ Holm 보정은 **S 전체(유형 × 측도)에 한 번에** 건다. 유형마다 따로 걸면 보정이 헐거워진다.
// ⚠️ S1 은 5개 번호 중 가장 치우친 것을 **고른 뒤** 검정하므로 그 자리에서 5배 다중성을 먼저 문다.
//
// 실행: node scripts/csat/measure-type-constraints.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, setBlockFor, passageOf, choicesOf } from './lib-passage.mjs'
import { cleanPassage } from './clean-passage.mjs'
import { binomUpper } from './claim-gate.mjs'

const DIR = path.resolve('scripts/csat/data')
const rd = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))

const cls = rd('classified.json')
const ans = rd('answers.json')
const inv = rd('type-inventory.json')
const current = inv.rows.filter((r) => r.current)
const CUR = new Set(current.map((r) => r.type))

const ansOf = new Map(ans.answers.map((a) => [`${a.exam}#${a.no}`, a]))
const RECENT = ['2023', '2024', '2025', '2026']

/** 양측 이항검정 — 관측이 기저에서 어느 쪽으로든 극단일 확률 */
function binomTwo(n, k, p) {
  const hi = binomUpper(n, k, p)
  const lo = 1 - binomUpper(n, k + 1, p)
  return Math.min(1, 2 * Math.min(hi, lo))
}

const W = (s) => (s.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).map((x) => x.toLowerCase())
const STOP = new Set(('the a an of to in and or is are was were be been being that this these those it its as for with on at by '
  + 'from not no but if than then so such their his her our your my we you they he she i there here which who whom whose what '
  + 'when where how why can could will would shall should may might must do does did done have has had').split(' '))

// ── 자료 수집 ────────────────────────────────────────────────────────
const items = []
for (const r of cls.rows) {
  if (!CUR.has(r.type)) continue
  const a = ansOf.get(`${r.exam}#${r.no}`)
  const b = itemBlocks(r.exam, r.no)[0] ?? null
  const ch = b ? choicesOf(b) : null
  let p = b ? cleanPassage(passageOf(b)) : null
  if ((!p || p.length < 150) && r.no >= 41) {
    const sb = setBlockFor(r.exam, r.no)
    if (sb) p = cleanPassage(passageOf(sb))
  }
  items.push({ ...r, answer: a?.answer ?? null, points: a?.points ?? null, choices: ch, passage: p })
}

/**
 * ⚠️ **순환 배제.** 어법·어휘·삽입·무관·도표는 선택지가 따로 있지 않고 **본문 안에 ①~⑤ 가 찍힌다.**
 * 그래서 `passageOf` 가 뽑은 지문 안에 선지 텍스트가 통째로 들어 있다 —
 * 이 상태로 "선지가 지문 순서를 따라가는가" 를 재면 **rho = 1.00 이 24/24** 로 나온다(실제로 나왔다).
 * 지문이 곧 선지이므로 당연한 값이고, 설계에 대해 아무것도 말하지 않는다.
 */
function circular(it) {
  if (!it.choices || !it.passage) return true
  const long = it.choices.filter((c) => c.trim().length > 20)
  if (!long.length) return true
  const inP = long.filter((c) => it.passage.includes(c.trim().slice(0, 30))).length
  return inP / long.length >= 0.6
}

const byType = {}
for (const it of items) (byType[it.type] ??= []).push(it)

// ── 형식 제약 ────────────────────────────────────────────────────────
const isKo = (s) => /[가-힣]/.test(s ?? '')
function choiceShape(it) {
  if (!it.choices) return null
  const ln = it.choices.map((c) => c.trim().length)
  if (Math.max(...ln) <= 3) return '기호'
  if (it.choices.every((c) => /\([ABC]\)/.test(c))) return '조합'
  return isKo(it.choices.join(' ')) ? '한국어' : '영어'
}

const F = {}
for (const [t, rows] of Object.entries(byType)) {
  const nos = [...new Set(rows.filter((r) => RECENT.includes(r.exam)).map((r) => r.no))].sort((a, b) => a - b)
  const withPts = rows.filter((r) => r.points != null)
  const hi = withPts.filter((r) => r.points === 3).length
  const shapes = rows.map(choiceShape).filter(Boolean)
  const shapeCnt = {}
  for (const s of shapes) shapeCnt[s] = (shapeCnt[s] ?? 0) + 1
  const top = Object.entries(shapeCnt).sort((a, b) => b[1] - a[1])[0]
  F[t] = [
    { id: 'F1', n: rows.length, nos, kind: nos.length === 1 ? 'HARD' : 'SOFT',
      claim: nos.length === 1
        ? `${nos[0]}번 자리에 온다 (최근 4개년 예외 0)`
        : `${nos.join('·')}번 중 한 자리에 온다 (최근 4개년)` },
    { id: 'F2', n: withPts.length, hit: hi,
      kind: (hi === 0 || hi === withPts.length) && withPts.length >= 7 ? 'HARD' : 'SOFT',
      claim: hi === 0 ? `3점이 붙지 않는다 (14개년 ${withPts.length}문항 예외 0)`
        : hi === withPts.length ? `항상 3점이다 (14개년 ${withPts.length}문항 예외 0)`
          : `3점 부착률 ${hi}/${withPts.length}` },
  ]
  if (top) F[t].push({ id: 'F5', n: shapes.length, hit: top[1], top: top[0],
    kind: top[1] === shapes.length && shapes.length >= 7 ? 'HARD' : 'SOFT',
    claim: `선택지는 **${top[0]}** 형태다 (${top[1]}/${shapes.length})` })
}

// ── 내용 제약 ────────────────────────────────────────────────────────
const S = []
for (const [t, rows] of Object.entries(byType)) {
  const withA = rows.filter((r) => r.answer >= 1 && r.answer <= 5)
  if (withA.length >= 7) {
    const cnt = [0, 0, 0, 0, 0]
    for (const r of withA) cnt[r.answer - 1] += 1
    let best = null
    for (let k = 0; k < 5; k += 1) {
      const p = Math.min(1, 5 * binomTwo(withA.length, cnt[k], 0.2))
      if (!best || p < best.p) best = { k, p, hit: cnt[k] }
    }
    S.push({ type: t, id: 'S1', n: withA.length, hit: best.hit, base: 0.2, p: best.p, dist: cnt,
      claim: best.hit === 0
        ? `정답이 ${best.k + 1}번에 오지 않는다 (14개년 ${withA.length}문항 예외 0)`
        : `정답이 ${best.k + 1}번에 몰린다 (${best.hit}/${withA.length}, 기저 20%)` })
  }

  const withC = rows.filter((r) => r.choices && r.answer >= 1 && r.answer <= 5
    && Math.max(...r.choices.map((c) => c.trim().length)) > 3)
  if (withC.length >= 7) {
    // ⚠️ **동점을 세면 안 된다.** 순서형 선지는 `(A) － (C) － (B)` 라 다섯이 전부 같은 길이여서
    //    동점을 인정하면 13/13 "정답이 최장" 이라는 **가짜 HARD** 가 나온다(실제로 한 번 나왔다).
    //    최장·최단은 **유일할 때만** 센다.
    let longest = 0, shortest = 0, usedL = 0, usedS = 0
    for (const r of withC) {
      const ln = r.choices.map((c) => c.trim().length)
      const mx = Math.max(...ln), mn = Math.min(...ln)
      if (ln.filter((x) => x === mx).length === 1) { usedL += 1; if (ln[r.answer - 1] === mx) longest += 1 }
      if (ln.filter((x) => x === mn).length === 1) { usedS += 1; if (ln[r.answer - 1] === mn) shortest += 1 }
    }
    const cand = []
    if (usedL >= 7) cand.push({ k: '최장', hit: longest, used: usedL, p: binomTwo(usedL, longest, 0.2) })
    if (usedS >= 7) cand.push({ k: '최단', hit: shortest, used: usedS, p: binomTwo(usedS, shortest, 0.2) })
    if (cand.length) {
      const pick = cand.sort((a, b) => a.p - b.p)[0]
      S.push({ type: t, id: 'S2', n: pick.used, hit: pick.hit, base: 0.2,
        p: Math.min(1, cand.length * pick.p),
        claim: `정답 선지가 5개 중 **${pick.k}** 이다 (${pick.hit}/${pick.used}, 기저 20%)` })
    }
  }

  const withP = rows.filter((r) => r.passage && r.passage.length > 150 && r.choices
    && r.answer >= 1 && Math.max(...r.choices.map((c) => c.trim().length)) > 3 && !isKo(r.choices.join(''))
    && !circular(r))
  if (withP.length >= 7) {
    let hit = 0, used = 0
    for (const r of withP) {
      const P = new Set(W(r.passage).filter((w) => !STOP.has(w) && w.length > 2))
      const sc = r.choices.map((c) => {
        const cw = [...new Set(W(c).filter((w) => !STOP.has(w) && w.length > 2))]
        return cw.length ? cw.filter((w) => P.has(w)).length / cw.length : 0
      })
      const mx = Math.max(...sc)
      if (sc.filter((x) => x === mx).length > 1) continue
      used += 1
      if (sc[r.answer - 1] === mx) hit += 1
    }
    if (used >= 7) S.push({ type: t, id: 'S3', n: used, hit, base: 0.2, p: binomTwo(used, hit, 0.2),
      claim: `정답 선지가 지문과 가장 많이 겹친다 (${hit}/${used}, 기저 20%)` })
  }
}

// ── S4 선지↔지문 순서 대응 (세부사항 계열) ───────────────────────────
// 선택지 ①~⑤ 가 지문의 서술 순서를 따라간다면, 각 선지의 **최고 유사 문장 index** 가
// 선지 번호와 함께 증가한다. Spearman rho 를 문항마다 재고 rho>0 인 비율을 기저 0.5 로 검정한다.
const sentsOf = (p) => p.split(/(?<=[.!?])\s+/).filter((x) => W(x).length >= 4)
function spearman(a) {
  const n = a.length
  if (n < 3) return null
  const r = a.map((x, i) => ({ x, i })).sort((u, v) => u.x - v.x).map((u, k) => ({ ...u, rank: k + 1 }))
  const rk = new Array(n)
  for (const u of r) rk[u.i] = u.rank
  let d2 = 0
  for (let i = 0; i < n; i += 1) d2 += (rk[i] - (i + 1)) ** 2
  return 1 - (6 * d2) / (n * (n * n - 1))
}
for (const [t, rows] of Object.entries(byType)) {
  const usable = rows.filter((r) => r.passage && r.passage.length > 150 && r.choices
    && Math.max(...r.choices.map((c) => c.trim().length)) > 8 && !circular(r))
  if (usable.length < 7) continue
  let hit = 0, used = 0, sum = 0
  for (const r of usable) {
    const ss = sentsOf(r.passage)
    if (ss.length < 4) continue
    const SW = ss.map((s) => new Set(W(s).filter((w) => !STOP.has(w) && w.length > 2)))
    const idx = r.choices.map((c) => {
      // 한국어 선지는 영어 지문과 낱말이 겹치지 않는다 — 숫자·고유명사만 남겨 맞춘다
      const cw = [...new Set((c.match(/[A-Za-z][A-Za-z'-]{2,}|\d+/g) ?? []).map((x) => x.toLowerCase()))].filter((w) => !STOP.has(w))
      if (!cw.length) return null
      let bi = -1, bs = -1
      SW.forEach((s, i) => { const v = cw.filter((w) => s.has(w) || [...s].some((z) => z.startsWith(w))).length / cw.length; if (v > bs) { bs = v; bi = i } })
      return bs > 0 ? bi : null
    })
    const ok = idx.filter((x) => x !== null)
    if (ok.length < 4) continue
    const rho = spearman(ok)
    if (rho === null) continue
    used += 1; sum += rho
    if (rho > 0) hit += 1
  }
  if (used >= 7) S.push({ type: t, id: 'S4', n: used, hit, base: 0.5, p: binomTwo(used, hit, 0.5),
    rhoMean: +(sum / used).toFixed(3),
    claim: `선택지가 지문의 서술 순서를 따라간다 (rho>0 ${hit}/${used}, 평균 rho ${(sum / used).toFixed(2)}, 기저 50%)` })
}

// ── S5 정답의 근거가 지문의 첫 문장 또는 끝 문장에 있는가 (대의파악 계열) ─
for (const [t, rows] of Object.entries(byType)) {
  const usable = rows.filter((r) => r.passage && r.passage.length > 150 && r.choices
    && r.answer >= 1 && !isKo(r.choices.join('')) && Math.max(...r.choices.map((c) => c.trim().length)) > 8
    && !circular(r))
  if (usable.length < 7) continue
  let hit = 0, used = 0
  for (const r of usable) {
    const ss = sentsOf(r.passage)
    if (ss.length < 4) continue
    const cw = [...new Set(W(r.choices[r.answer - 1]).filter((w) => !STOP.has(w) && w.length > 2))]
    if (cw.length < 2) continue
    let bi = -1, bs = -1
    ss.forEach((s, i) => {
      const sw = new Set(W(s).filter((w) => !STOP.has(w) && w.length > 2))
      const v = cw.filter((w) => sw.has(w)).length / cw.length
      if (v > bs) { bs = v; bi = i }
    })
    if (bs <= 0) continue
    used += 1
    if (bi === 0 || bi >= ss.length - 2) hit += 1
  }
  // 기저 = 첫 1문장 + 끝 2문장이 차지하는 비율. 문장 수가 유형마다 다르므로 보수적으로 3/평균문장수
  const avgS = usable.reduce((s, r) => s + sentsOf(r.passage).length, 0) / usable.length
  const base = Math.min(0.9, 3 / Math.max(4, avgS))
  if (used >= 7) S.push({ type: t, id: 'S5', n: used, hit, base: +base.toFixed(3), p: binomTwo(used, hit, base),
    claim: `정답의 근거 문장이 지문의 **첫 문장 또는 끝 두 문장** 에 있다 (${hit}/${used}, 기저 ${(base * 100).toFixed(0)}%)` })
}

// ── G 가족 제약 — 유형을 가로질러 묶어서 검정하고, 구성원이 물려받는다 ──
//
// 왜 필요한가: 유형 하나의 표본은 13~15문항이다. `R-NOTICE` 의 "① 정답 0/27" 은 raw p=0.024 인데
// Holm 78 검정을 걸면 1.000 으로 죽는다. **같은 설계 원리를 공유하는 유형을 묶으면 살아난다** —
// 묶은 192문항에서는 p = 1e-25 다. 묶음은 **자료를 보기 전에 선언**해야 한다(사후 확장 금지).
//
// 아래 4가족은 `CSAT_BLUEPRINT_V1.md §2.1·§2.1.1·§2.2` 에 이미 선언돼 있던 것을 그대로 옮긴 것이고,
// G4 만 이번에 새로 세운 가설이다.
const FAMILIES = [
  { id: 'G1', name: '선지가 지문·담화의 서술 순서에 대응하는 유형',
    members: ['R-GRAMMAR', 'R-VOCAB', 'R-IRRELEVANT', 'R-INSERT', 'X-VOCAB', 'X-REFER',
      'R-FACT', 'R-NOTICE', 'R-CHART', 'X-FACT', 'L-NOTMENTION', 'L-ANNOUNCE', 'L-SET-NOT'],
    test: 'no1', base: 0.27,
    claim: (n) => `정답을 ①에 두지 않는다 — 대응형 ${n}문항 예외 0 (비대응형 기저 27%)`,
    why: '①은 지문 맨 앞에 대응한다. 거기에 답을 두면 뒤를 읽을 이유가 사라져 "앞만 읽고 찍기" 로 무너진다' },
  { id: 'G2', name: '선지가 지문 순서에 대응하지 않는 유형',
    members: null, complementOf: 'G1', test: 'no1max', base: 0.2,
    claim: (n, hit) => `①이 오히려 최빈 정답이다 (${hit}/${n}) — "1번은 잘 안 나온다"를 여기 적용하면 손해다`,
    why: '회차당 정답 번호는 균형을 맞춘다. 대응형 15문항이 앞번호를 못 쓰므로 그 몫이 이쪽으로 밀린다' },
  { id: 'G3', name: '선택지가 한국어인 유형',
    members: null, byShape: '한국어', test: 'no3pt',
    claim: (n) => `3점이 붙지 않는다 — 한글 선지 ${n}문항 예외 0`,
    why: '한글 선지는 선택지 자체의 독해 부담이 없다. 3점은 부담이 큰 자리에만 붙는다' },
  { id: 'G4', name: '순서 배열형(선지가 (A)(B)(C) 순열)',
    members: ['R-ORDER', 'X-ORDER'], test: 'no1', base: 0.2,
    claim: (n) => `정답을 ①에 두지 않는다 — 순열형 ${n}문항 예외 0`,
    why: '①은 "주어진 글 다음 바로 (A)" 라는 가장 순진한 읽기다. 거기에 답을 두면 추론이 필요 없어진다',
    novel: true },
]

const G = []
const shapeOfType = {}
for (const [t, rows] of Object.entries(byType)) {
  const sh = rows.map(choiceShape).filter(Boolean)
  const cnt = {}
  for (const s of sh) cnt[s] = (cnt[s] ?? 0) + 1
  shapeOfType[t] = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}
const g1Members = FAMILIES[0].members
for (const f of FAMILIES) {
  let members = f.members
  if (f.complementOf) members = current.map((r) => r.type).filter((t) => !g1Members.includes(t))
  if (f.byShape) members = current.map((r) => r.type).filter((t) => shapeOfType[t] === f.byShape)
  members = members.filter((t) => byType[t])
  const rows = members.flatMap((t) => byType[t])

  if (f.test === 'no1') {
    const withA = rows.filter((r) => r.answer >= 1 && r.answer <= 5)
    const hit = withA.filter((r) => r.answer === 1).length
    G.push({ id: f.id, name: f.name, members, n: withA.length, hit, base: f.base,
      p: binomUpper(withA.length, withA.length - hit, 1 - f.base) , exceptionFree: hit === 0,
      claim: f.claim(withA.length, hit), why: f.why, novel: !!f.novel })
  } else if (f.test === 'no1max') {
    const withA = rows.filter((r) => r.answer >= 1 && r.answer <= 5)
    const cnt = [0, 0, 0, 0, 0]
    for (const r of withA) cnt[r.answer - 1] += 1
    const hit = cnt[0]
    G.push({ id: f.id, name: f.name, members, n: withA.length, hit, base: f.base, dist: cnt,
      p: binomTwo(withA.length, hit, f.base), exceptionFree: false,
      claim: f.claim(withA.length, hit), why: f.why })
  } else if (f.test === 'no3pt') {
    const withP = rows.filter((r) => r.points != null)
    const hit = withP.filter((r) => r.points === 3).length
    const baseRate = items.filter((r) => r.points != null).filter((r) => r.points === 3).length / items.filter((r) => r.points != null).length
    G.push({ id: f.id, name: f.name, members, n: withP.length, hit, base: +baseRate.toFixed(3),
      p: Math.pow(1 - baseRate, withP.length), exceptionFree: hit === 0,
      claim: f.claim(withP.length), why: f.why })
  }
}
// G 는 4개뿐이므로 Bonferroni 로 족하다
for (const g of G) { g.holm = Math.min(1, g.p * G.length); g.kind = g.holm < 0.05 ? (g.exceptionFree ? 'HARD' : 'SOFT') : 'REJECT' }

// Holm 보정 — S 전체에 한 번
const sorted = [...S].sort((a, b) => a.p - b.p)
const m = sorted.length
sorted.forEach((s, i) => { s.holm = Math.min(1, Math.max(...sorted.slice(0, i + 1).map((x, j) => (m - j) * x.p))) })
for (const s of S) s.kind = s.holm < 0.05 ? ((s.hit === s.n || s.hit === 0) ? 'HARD' : 'SOFT') : 'REJECT'

const out = {
  builtAt: 'measure-type-constraints.mjs',
  scope: '수능 14개년 (2014B·2014A·2015~2026) · 630문항',
  holmFamily: m,
  families: G,
  types: {},
}
for (const r of current) {
  out.types[r.type] = {
    format: F[r.type] ?? [],
    content: S.filter((s) => s.type === r.type).map(({ type, ...x }) => x),
    family: G.filter((g) => g.members.includes(r.type)).map((g) => ({ id: g.id, name: g.name, n: g.n, hit: g.hit, base: g.base, p: g.p, holm: g.holm, kind: g.kind, claim: g.claim, why: g.why })),
  }
}
fs.writeFileSync(path.join(DIR, 'type-constraints.json'), JSON.stringify(out, null, 1))

const hardF = (t) => out.types[t].format.filter((x) => x.kind === 'HARD').length
const okS = (t) => [...out.types[t].content, ...out.types[t].family].filter((x) => x.kind !== 'REJECT')
console.log(`Holm family = ${m} 개 내용 검정 · 분모 ${current.length} 유형`)
console.log(`형식 HARD ≥1: ${current.filter((r) => hardF(r.type) >= 1).length}/${current.length}`)
console.log(`내용·가족 통과 ≥1: ${current.filter((r) => okS(r.type).length >= 1).length}/${current.length}`)
console.log('')
console.log('가족 제약')
for (const g of G) console.log(`  ${g.id} ${g.kind}	${g.hit}/${g.n} (기저 ${g.base})	p=${g.p.toExponential(2)} holm=${g.holm.toExponential(2)}	${g.claim}`)
console.log('')
console.log(['type', '형식HARD', '내용통과', '내용 최선', 'holm'].join('\t'))
for (const r of current) {
  const cs = okS(r.type).sort((a, b) => a.holm - b.holm)
  const b = cs[0]
  console.log([r.type, hardF(r.type), cs.length, b ? `${b.id} ${b.claim}` : '—', b ? b.holm.toFixed(4) : ''].join('\t'))
}
console.log(`\n→ ${path.join(DIR, 'type-constraints.json')}`)
