// scripts/csat/diagnosis/tag-sensitivity.mts
//
// 추천 민감도(2026-10-11 · 학습 지도 rev4.0 6차 P0-4) — 시험 태그가 바뀌면 학습 지도 추천의 출발점(약한 축 1순위)이 얼마나 바뀌나.
// DB 없이 · 결정적: 같은 합성 학습자(오답 패턴 고정) · 같은 순위 규칙(seed-rules.rank, 엔진과 같은 k=0.6 · 최소 관측 5)으로
// 태그 버전만 바꿔 계산한다. **합성 학습자의 추천 변화는 시스템 민감도이지 실제 학습 효과가 아니다.**
//   지표: 1순위 축 변경 비율 · 1순위 「근거 부족(없음)」 변화 · 1·2위 축 집합 변화 · 바뀐 태그 하나씩 적용했을 때 1순위가 뒤집히는 비율(영향 큰 태그 추적)
//   입력: scripts/csat/diagnosis/pilot/<exam>-items.json(배점) · <exam>-review-final.json(시드 v2 · 최종 · 판정자별)
//   출력: tmp/pilot/tag-sensitivity-<exam>.json + 요약 한 줄
//   node <tsx cli> scripts/csat/diagnosis/tag-sensitivity.mts M2609 M2606 [--n 1000]
import fs from 'node:fs'
import path from 'node:path'

import { ATTRIBUTE_CODES, type AttributeCode } from '../../../apps/web/src/lib/csat/diagnosis/engine/types.ts'
import { lcg, rank, type TaggedItem, type Weights } from '../../../apps/web/src/lib/csat/diagnosis/seed-rules.ts'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const args = process.argv.slice(2)
const N = args.includes('--n') ? Number(args[args.indexOf('--n') + 1]) : 1000
const exams = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--n')
const AXIS_OF: Record<string, string> = { A1: 'V', A2: 'S', A8: 'S', A3: 'R', A6: 'R', A4: 'E', A5: 'E', A9: 'X' }
const CODES = ATTRIBUTE_CODES.filter((c) => c !== 'A7') as AttributeCode[]
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null)

type Final = { items: { no: number; w: Weights; seedV2: Weights; claudeA?: Weights; claudeB?: Weights; claudeC?: Weights }[]; status?: string }

function cohort(base: TaggedItem[], seed: number, n: number): Set<number>[] {
  // 약한 역량 1~2개 · 그 역량이 붙은 문항일수록 더 틀린다(태그 생성기와 독립되게 두 버전 태그의 합집합 기준으로 만든다)
  const rnd = lcg(seed)
  return Array.from({ length: n }, () => {
    const k = rnd() < 0.5 ? 1 : 2
    const weak = new Set<AttributeCode>()
    while (weak.size < k) weak.add(CODES[Math.floor(rnd() * CODES.length)])
    const wrong = new Set<number>()
    for (const it of base) if (rnd() < 0.12 + 0.45 * ([...weak].some((c) => it.weights[c] > 0) ? 1 : 0)) wrong.add(it.no)
    return wrong
  })
}

const top = (items: TaggedItem[], wrong: Set<number>) => {
  const r = rank(items, wrong, 0.6, 5, false)
  return { top: r.candidates[0] ?? null, top2: r.axes.slice(0, 2).map((a) => a.axis).sort().join('') }
}

for (const exam of exams) {
  const meta = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, `pilot/${exam}-items.json`), 'utf8')) as { items: { no: number; points: number }[] }
  const final = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, `pilot/${exam}-review-final.json`), 'utf8')) as Final
  const pts = new Map(meta.items.map((m) => [m.no, m.points]))
  const version = (pick: (it: Final['items'][number]) => Weights | undefined): TaggedItem[] | null => {
    const out: TaggedItem[] = []
    for (const it of final.items) { const w = pick(it); if (!w) return null; out.push({ no: it.no, points: pts.get(it.no) ?? 2, weights: w }) }
    return out
  }
  const before = version((it) => it.seedV2)!
  const after = version((it) => it.w)!
  // 오답 패턴: 두 버전 태그의 합집합(어느 한쪽에 유리하지 않게)
  const union: TaggedItem[] = before.map((b) => ({ ...b, weights: Object.fromEntries(ATTRIBUTE_CODES.map((c) => [c, Math.max(b.weights[c] ?? 0, after.find((a) => a.no === b.no)!.weights[c] ?? 0)])) as Weights }))
  const students = cohort(union, 20261011, N)
  const cmp = (x: TaggedItem[], y: TaggedItem[]) => {
    let flip = 0, gone = 0, appeared = 0, top2 = 0
    for (const w of students) {
      const a = top(x, w), b = top(y, w)
      if (a.top !== b.top) flip++
      if (a.top && !b.top) gone++
      if (!a.top && b.top) appeared++
      if (a.top2 !== b.top2) top2++
    }
    return { top1Changed: pct(flip, N), insufficientAfter: pct(gone, N), newlyRecommended: pct(appeared, N), top2SetChanged: pct(top2, N) }
  }
  // 바뀐 셀 하나씩만 적용 → 1순위가 뒤집히는 비율(추적)
  const cells: { no: number; code: string; from: number; to: number; axis: string; flip: number | null }[] = []
  for (const it of final.items) for (const c of ATTRIBUTE_CODES) {
    if (c === 'A7' || (it.seedV2[c] ?? 0) === (it.w[c] ?? 0)) continue
    const one = before.map((b) => (b.no === it.no ? { ...b, weights: { ...b.weights, [c]: it.w[c] } } : b))
    let flip = 0
    for (const w of students) if (top(before, w).top !== top(one, w).top) flip++
    cells.push({ no: it.no, code: c, from: it.seedV2[c] ?? 0, to: it.w[c] ?? 0, axis: AXIS_OF[c] ?? '?', flip: pct(flip, N) })
  }
  cells.sort((a, b) => (b.flip ?? 0) - (a.flip ?? 0))
  const reviewers: Record<string, unknown> = {}
  for (const [k, pick] of [['A', (it: Final['items'][number]) => it.claudeA], ['B', (it: Final['items'][number]) => it.claudeB]] as const) {
    const v = version(pick)
    if (v) reviewers[`final_vs_${k}`] = cmp(v, after)
  }
  const report = {
    exam, n: N, at: '2026-10-11', status: final.status ?? null,
    caution: '합성 학습자(결정적 · seed 20261011) 기준 시스템 민감도 — 실제 학습 효과 아님. 축 = 엔진 약한 축 1순위(학습 지도 To-Be 의 출발점)',
    seedToFinal: cmp(before, after),
    reviewers,
    changedCells: cells.length,
    highImpact: cells.filter((c) => (c.flip ?? 0) >= 2),
    allCells: cells,
  }
  fs.mkdirSync(path.join(ROOT, 'tmp/pilot'), { recursive: true })
  fs.writeFileSync(path.join(ROOT, `tmp/pilot/tag-sensitivity-${exam}.json`), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ exam, seedToFinal: report.seedToFinal, reviewers, changedCells: cells.length, highImpact: report.highImpact.slice(0, 8).map((c) => `#${c.no} ${c.code} ${c.from}→${c.to} ${c.flip}%`) }))
}
