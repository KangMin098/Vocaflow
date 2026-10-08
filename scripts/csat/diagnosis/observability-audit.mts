// scripts/csat/diagnosis/observability-audit.mts
//
// 진단축 관측가능성 · 식별성 감사(2026-10-08) — DB 없이 픽스처만(pilot/M2409-*.json · pilot/kice-items.json).
//   1) M2409 상세(tri-model 태그): 축별 관측 · 축 쌍 겹침 · rank · V 근거 문항 구성 · P1 역추적
//   2) 평가원 29회(시드 v2 — 코드 규칙, proposed/unreviewed) 와 「M2409 검수 패턴 투영」(가정 — 근거 아님, 민감도):
//      A2 는 어법(R-GRAMMAR)만 · A6 0 · A9 는 장문(X-) 유형만. 검수자 셋이 M2409 에서 보인 방향을 유형 단위로 옮긴 것.
//   3) 누적 1 · 2 · 3 · 5회(연속 회차 창)
//   4) 거짓 V 1위 재분류(F1 식별 가능 오류 · F2 관측 불가 · F3 혼동) — 같은 표본(gen-link 1008 · gen-weight 2008) · tri 태그 · k=8
// 결과 → tmp/pilot/observability-audit.json
//   node <tsx cli> scripts/csat/diagnosis/observability-audit.mts
import fs from 'node:fs'
import path from 'node:path'

import { ATTRIBUTE_CODES, type AttributeCode } from '../../../apps/web/src/lib/csat/diagnosis/engine/types.ts'
import {
  OBS_AXES, axisObservability, axisTagged, classifyFalseTop, matrixRank, pairObs, stackExams, type ObsAxis, type ObsItem,
} from '../../../apps/web/src/lib/csat/diagnosis/observability.ts'
import { lcg, rank, seedWeights, type TaggedItem, type Weights } from '../../../apps/web/src/lib/csat/diagnosis/seed-rules.ts'
import { RANKING_SHRINK, rankingOf, type CoreAxisView } from '../../../apps/web/src/lib/csat/map/core.ts'
import { AXIS_LINES } from '../../../apps/web/src/lib/csat/diagnosis/seed-rules.ts'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'pilot', f), 'utf8'))
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null)
const r3 = (v: number | null) => (v === null ? null : Math.round(v * 1000) / 1000)
const out: Record<string, unknown> = { at: '2026-10-08' }

// ── 1) M2409 상세 ──
const meta = read('M2409-items.json') as { items: { no: number; points: number }[] }
const tri = read('M2409-review-tri.json') as { items: { no: number; w: Weights }[] }
const M: ObsItem[] = tri.items.map((i) => ({ no: i.no, weights: i.w }))
const pairsOf = (items: ObsItem[]) => {
  const res = []
  for (let i = 0; i < OBS_AXES.length; i++) for (let j = i + 1; j < OBS_AXES.length; j++) {
    const p = pairObs(items, OBS_AXES[i], OBS_AXES[j])
    res.push({ pair: `${p.a}-${p.b}`, both: p.both, aOnly: p.aOnly, bOnly: p.bOnly, jaccard: r3(p.jaccard), bGivenA: r3(p.bGivenA), aGivenB: r3(p.aGivenB), relation: p.relation })
  }
  return res
}
const obsSummary = (items: ObsItem[]) => Object.fromEntries(Object.entries(axisObservability(items)).map(([a, o]) => [a, { status: o.status, tagged: o.tagged, lines: o.lineCounts, unique: o.unique, independence: r3(o.independence), nestedIn: o.nestedIn }]))
const combo = (it: ObsItem) => OBS_AXES.filter((a) => axisTagged(it, a)).join('+') || '(없음)'
const vItems = M.filter((it) => axisTagged(it, 'V'))
const vComp: Record<string, number[]> = {}
for (const it of vItems) (vComp[combo(it)] ??= []).push(it.no)
const P1 = [19, 24, 29, 30, 31, 34, 40, 42]
out.M2409 = {
  axes: obsSummary(M),
  pairs: pairsOf(M),
  rank: matrixRank(OBS_AXES.map((a) => M.map((it) => (axisTagged(it, a) ? 1 : 0)))),
  vEvidence: vComp,
  a2Items: M.filter((it) => (it.weights.A2 ?? 0) > 0).map((it) => it.no),
  p1Trace: P1.map((no) => ({ no, axes: combo(M.find((i) => i.no === no)!), wrong: true })),
}

// ── 2) 평가원 전체 ──
const kice = read('kice-items.json') as { exams: { exam: string; items: { no: number; type: string; points: number | null; choiceWords: number | null }[] }[] }
const seedV2 = (e: (typeof kice.exams)[number]): ObsItem[] => e.items.map((i) => ({ no: i.no, weights: seedWeights({ type: i.type, choiceWords: i.choiceWords }, 'seed-v2').weights }))
const project = (e: (typeof kice.exams)[number]): ObsItem[] => e.items.map((i) => {
  const w = { ...seedWeights({ type: i.type, choiceWords: i.choiceWords }, 'seed-v2').weights }
  if (i.type !== 'R-GRAMMAR') w.A2 = 0
  w.A6 = 0
  if (!i.type.startsWith('X-')) w.A9 = 0
  return { no: i.no, weights: w }
})
const variants = { 'seed-v2': seedV2, projection: project } as const
for (const [name, fn] of Object.entries(variants)) {
  const perExam = kice.exams.map((e) => {
    const items = fn(e)
    const o = axisObservability(items)
    return { exam: e.exam, ...Object.fromEntries(OBS_AXES.map((a) => [a, o[a].status])), counts: Object.fromEntries(OBS_AXES.map((a) => [a, o[a].tagged])), indep: Object.fromEntries(OBS_AXES.map((a) => [a, r3(o[a].independence)])) }
  })
  const dist = Object.fromEntries(OBS_AXES.map((a) => {
    const c: Record<string, number> = {}
    for (const r of perExam) c[r[a] as string] = (c[r[a] as string] ?? 0) + 1
    return [a, c]
  }))
  // 축 쌍 — 시험 전체를 이어 붙여 본 관계와 시험별 관계 빈도
  const pairRel: Record<string, Record<string, number>> = {}
  for (const e of kice.exams) for (const p of pairsOf(fn(e))) (pairRel[p.pair] ??= {})[p.relation] = (pairRel[p.pair][p.relation] ?? 0) + 1
  const pooled = pairsOf(stackExams(kice.exams.map(fn)))
  out[`kice/${name}`] = { exams: perExam.length, statusByAxis: dist, perExam, pairRelationsPerExam: pairRel, pooledPairs: pooled }
  // ── 3) 누적 ──
  out[`cumulative/${name}`] = [1, 2, 3, 5].map((k) => {
    const wins: ObsItem[][][] = []
    for (let s = 0; s + k <= kice.exams.length; s++) wins.push(kice.exams.slice(s, s + k).map(fn))
    const res: Record<string, Record<string, number | null>> = {}
    for (const a of OBS_AXES) {
      const c: Record<string, number> = {}
      for (const w of wins) { const st = axisObservability(stackExams(w))[a].status; c[st] = (c[st] ?? 0) + 1 }
      res[a] = Object.fromEntries(Object.entries(c).map(([st, n]) => [st, pct(n, wins.length)]))
    }
    return { exams: k, windows: wins.length, ...res }
  })
}

// ── 4) 거짓 V 재분류(같은 표본 · tri 태그 · k=8) ──
const GEN = read('M2409-review.json') as { items: { no: number; w: Weights }[] }
const GEN_TAGS: TaggedItem[] = meta.items.map((m) => ({ no: m.no, points: m.points, weights: GEN.items.find((x) => x.no === m.no)!.w }))
const TRI: TaggedItem[] = meta.items.map((m) => ({ no: m.no, points: m.points, weights: tri.items.find((x) => x.no === m.no)!.w }))
const CODES = ATTRIBUTE_CODES.filter((c) => c !== 'A7')
const AXIS_OF: Record<string, ObsAxis> = { A1: 'V', A2: 'S', A8: 'S', A3: 'R', A6: 'R', A4: 'E', A5: 'E', A9: 'X' }
for (const gen of ['gen-link', 'gen-weight'] as const) {
  const rnd = lcg(gen === 'gen-link' ? 1008 : 2008)
  let vTop = 0
  const cls: Record<string, number> = {}
  const byWeak: Record<string, Record<string, number>> = {}
  let allTop = 0
  let gV = 0
  const gCls: Record<string, number> = {}
  const allCls: Record<string, number> = {}
  for (let i = 0; i < 1000; i++) {
    const k = rnd() < 0.5 ? 1 : 2
    const weak = new Set<AttributeCode>()
    while (weak.size < k) weak.add(CODES[Math.floor(rnd() * CODES.length)])
    const wrong = new Set<number>()
    for (const it of GEN_TAGS) {
      const tot = CODES.reduce((s, c) => s + it.weights[c], 0)
      const share = gen === 'gen-link' ? ([...weak].some((c) => it.weights[c] > 0) ? 1 : 0) : tot ? [...weak].reduce((s, c) => s + it.weights[c], 0) / tot : 0
      if (rnd() < 0.12 + (gen === 'gen-link' ? 0.45 : 0.7) * share) wrong.add(it.no)
    }
    const rr = rank(TRI, wrong, 0.6, 5, false, RANKING_SHRINK.k)
    const top = rr.candidates[0] as ObsAxis | undefined
    if (!top) continue
    // 게이트(제품과 같은 RANKING_GATE) 를 통과해 단계로 확정된 1위인가 — 앞 보고의 「V 거짓률」은 이 기준
    const g = rankingOf((Object.entries(AXIS_LINES) as [CoreAxisView['code'], AttributeCode[]][]).map(([code, lines]) => {
      const ax = rr.axes.find((x) => x.axis === code)
      const ns = lines.filter((c) => rr.attr[c] !== undefined).map((c) => rr.attrN[c] ?? 0)
      const o = ax ? ax.observed : null
      return { code, observed: o, minLineN: ns.length ? Math.min(...ns) : null, status: o === null ? 'insufficient' : o < 0.6 ? 'obs_low' : 'obs_mid' } as Pick<CoreAxisView, 'code' | 'status' | 'observed' | 'minLineN'>
    }), 0.6)
    const gatedV = g.kind === 'clear' && g.top === 'V'
    const isTrue = [...weak].some((c) => AXIS_OF[c] === top)
    allTop++
    if (!isTrue) {
      const c = classifyFalseTop(M, [...weak], top)
      allCls[c] = (allCls[c] ?? 0) + 1
    }
    if (gatedV) { gV++; if (!isTrue) { const c = classifyFalseTop(M, [...weak], 'V'); gCls[c] = (gCls[c] ?? 0) + 1 } }
    if (top !== 'V') continue
    vTop++
    if (isTrue) continue
    const c = classifyFalseTop(M, [...weak], 'V')
    cls[c] = (cls[c] ?? 0) + 1
    const key = [...weak].sort().join('+')
    ;(byWeak[c] ??= {})[key] = (byWeak[c][key] ?? 0) + 1
  }
  const falseV = Object.values(cls).reduce((a, b) => a + b, 0)
  const falseAll = Object.values(allCls).reduce((a, b) => a + b, 0)
  out[`reclass/${gen}`] = {
    vTop, falseV, falseVRate: pct(falseV, vTop),
    classes: Object.fromEntries(Object.entries(cls).map(([c, n]) => [c, { n, ofFalseV: pct(n, falseV), ofVTop: pct(n, vTop) }])),
    weakAttrsByClass: byWeak,
    gatedClearV: { vTop: gV, false: Object.values(gCls).reduce((a, b) => a + b, 0), falseRate: pct(Object.values(gCls).reduce((a, b) => a + b, 0), gV), classes: Object.fromEntries(Object.entries(gCls).map(([c, n]) => [c, { n, ofVTop: pct(n, gV) }])) },
    allTops: { top: allTop, false: falseAll, falseRate: pct(falseAll, allTop), classes: Object.fromEntries(Object.entries(allCls).map(([c, n]) => [c, { n, ofTop: pct(n, allTop) }])) },
  }
}

fs.mkdirSync(path.join(ROOT, 'tmp/pilot'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'tmp/pilot/observability-audit.json'), JSON.stringify(out, null, 1))
for (const [k, v] of Object.entries(out)) if (!k.startsWith('kice/')) console.log(k, JSON.stringify(v))
for (const name of Object.keys(variants)) {
  const v = out[`kice/${name}`] as { statusByAxis: unknown; pooledPairs: unknown; pairRelationsPerExam: unknown }
  console.log(`kice/${name} status`, JSON.stringify(v.statusByAxis))
  console.log(`kice/${name} pairRel`, JSON.stringify(v.pairRelationsPerExam))
  console.log(`kice/${name} pooled`, JSON.stringify(v.pooledPairs))
}
