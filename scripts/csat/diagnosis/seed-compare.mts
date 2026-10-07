// scripts/csat/diagnosis/seed-compare.mts
//
// 시드 규칙 평가(2026-10-08) — DB 없이 픽스처만 읽는다(pilot/<exam>-items.json · pilot/<exam>-review.json).
//   1) seed-v1 · seed-v2 를 유형 규칙에서 처음부터 만들어 검수안과 문항별 A1~A9 비교(일치 · 추가 · 제거 · 가중치 · 역량별 · 유형별 · Tier)
//   2) 파일럿 학생 P1 · P2 와 합성 학습자 300명의 추천(핵심 축 후보) — 태그 세트별 · 태그 하나 바꿨을 때 1위가 바뀌는 수 · 1·2위 차
//   3) 사람 검수 패킷(Tier 3 → 2 → 1 순) → docs/csat-learner/pilot-runs/<exam>-review-packet.md
//   4) 결과 JSON → tmp/pilot/<exam>-seed-compare.json · seed-v2 를 검수안 모양으로 → tmp/pilot/<exam>-seed-v2-as-review.json(pilot-run --review 용)
//   node <tsx cli> scripts/csat/diagnosis/seed-compare.mts [--exam M2409]
import fs from 'node:fs'
import path from 'node:path'

import { ATTRIBUTE_CODES, type AttributeCode } from '../../../apps/web/src/lib/csat/diagnosis/engine/types.ts'
import {
  SEED_RULES_V2, applyPerturbation, diffItem, lcg, rank, seedWeights, singlePerturbations, summarize,
  type ItemDiff, type SeedVersion, type TaggedItem, type Weights,
} from '../../../apps/web/src/lib/csat/diagnosis/seed-rules.ts'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const EXAM = process.argv.includes('--exam') ? process.argv[process.argv.indexOf('--exam') + 1] : 'M2409'
const meta = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, `pilot/${EXAM}-items.json`), 'utf8')) as { items: { no: number; type: string; points: number; choiceWords: number }[] }
const review = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, `pilot/${EXAM}-review.json`), 'utf8')) as { items: { no: number; w: Weights; why: string[] }[] }
const TYPE_KO: Record<string, string> = {
  'R-PURPOSE': '글의 목적', 'R-MOOD': '심경', 'R-CLAIM': '필자 주장', 'R-IMPLY': '함축 의미', 'R-GIST': '요지', 'R-TOPIC': '주제', 'R-TITLE': '제목',
  'R-CHART': '도표', 'R-FACT': '내용 일치', 'R-NOTICE': '안내문', 'R-GRAMMAR': '어법', 'R-VOCAB': '어휘(문맥)', 'R-BLANK': '빈칸', 'R-IRRELEVANT': '무관한 문장',
  'R-ORDER': '글의 순서', 'R-INSERT': '문장 삽입', 'R-SUMMARY': '요약문', 'X-TITLE': '장문 제목', 'X-VOCAB': '장문 어휘', 'X-ORDER': '장문 순서', 'X-REFER': '장문 지칭', 'X-FACT': '장문 일치',
}
const AXIS_KO: Record<string, string> = { V: '어휘·표현', S: '문장 이해', R: '문장 관계(글 이해)', E: '근거·선지 판단', X: '실전 수행' }

// ── 1. 시드 ↔ 검수 ──
const reviewW = (no: number) => review.items.find((r) => r.no === no)!.w
const diffsOf = (v: SeedVersion): ItemDiff[] => meta.items.map((m) => {
  const s = seedWeights({ type: m.type, choiceWords: m.choiceWords }, v)
  return diffItem(m.no, m.type, s.weights, reviewW(m.no), s.rules)
})
const d1 = diffsOf('seed-v1')
const d2 = diffsOf('seed-v2')
const s1 = summarize(d1)
const s2 = summarize(d2)
// 규칙이 고친 문항 · 규칙 때문에 새로 어긋난 문항
const ruleEffect = SEED_RULES_V2.map((r) => {
  const hit = d2.filter((d) => d.rules.includes(r.id))
  const fixed = hit.filter((d) => d.tier === 1 && d1.find((x) => x.no === d.no)!.tier !== 1).map((d) => d.no)
  const broke = hit.filter((d) => {
    const before = d1.find((x) => x.no === d.no)!
    return d.diffs.length > before.diffs.length
  }).map((d) => d.no)
  return { id: r.id, label: r.label, applied: hit.map((d) => d.no), fixed, broke }
})

// ── 2. 추천 · 민감도 ──
const tagged = (w: (no: number) => Weights): TaggedItem[] => meta.items.map((m) => ({ no: m.no, points: m.points, weights: w(m.no) }))
const T = {
  'seed-v1': tagged((no) => d1.find((d) => d.no === no)!.seed),
  'seed-v2': tagged((no) => d2.find((d) => d.no === no)!.seed),
  'review-v2': tagged(reviewW),
}
const PROFILES = {
  P1: new Set([19, 24, 29, 30, 31, 34, 40, 42]),
  P2: new Set([20, 23, 32, 33, 35, 36, 37, 38, 39, 43, 44]),
}
const round = (v: number | null) => (v === null ? null : Math.round(v * 1000) / 1000)
const profileRows = Object.entries(PROFILES).map(([name, wrong]) => {
  const out: Record<string, unknown> = { name, wrong: [...wrong] }
  for (const [tag, items] of Object.entries(T)) {
    const r = rank(items, wrong)
    out[tag] = { candidates: r.candidates, gap: round(r.gap), axes: r.axes.map((a) => `${a.axis} ${round(a.observed)}`), attr: Object.fromEntries(Object.entries(r.attr).map(([k, v]) => [k, round(v)])) }
  }
  // 검수안 태그에서 하나만 바꿨을 때 1위가 바뀌는 경우
  const base = rank(T['review-v2'], wrong)
  const flips: Record<string, { total: number; flip: number; examples: string[] }> = {}
  for (const p of singlePerturbations(T['review-v2'])) {
    const f = (flips[p.kind] ??= { total: 0, flip: 0, examples: [] })
    f.total++
    const r = rank(applyPerturbation(T['review-v2'], p), wrong)
    if ((r.candidates[0] ?? null) !== (base.candidates[0] ?? null)) {
      f.flip++
      if (f.examples.length < 6) f.examples.push(`${p.no}번 ${p.code} ${p.from}→${p.to}: ${base.candidates[0] ?? '없음'}→${r.candidates[0] ?? '없음'}`)
    }
  }
  out.flips = flips
  return out
})

// 합성 학습자 — 약한 역량 1~2개를 고르고, 문항의 약한 역량 가중 비율만큼 오답 확률을 올린다(기본 오답 0.12). 결정적(시드 고정)
const rnd = lcg(20261008)
const CODES = ATTRIBUTE_CODES.filter((c) => c !== 'A7')
const synth = Array.from({ length: 300 }, () => {
  const k = rnd() < 0.5 ? 1 : 2
  const weak = new Set<AttributeCode>()
  while (weak.size < k) weak.add(CODES[Math.floor(rnd() * CODES.length)])
  const wrong = new Set<number>()
  for (const it of T['review-v2']) {
    const tot = CODES.reduce((s, c) => s + it.weights[c], 0)
    const share = tot ? [...weak].reduce((s, c) => s + it.weights[c], 0) / tot : 0
    if (rnd() < 0.12 + 0.7 * share) wrong.add(it.no)
  }
  return wrong
})
const top = (items: TaggedItem[], wrong: Set<number>) => rank(items, wrong).candidates[0] ?? null
const synthStats = (() => {
  const withTop = synth.filter((w) => top(T['review-v2'], w) !== null)
  const gaps = withTop.map((w) => rank(T['review-v2'], w).gap).filter((g): g is number => g !== null)
  const agree = (tag: 'seed-v1' | 'seed-v2') => withTop.filter((w) => top(T[tag], w) === top(T['review-v2'], w)).length
  // 보조 태그 하나(추가/제거)로 1위가 바뀌는 학습자 비율 — 학습자마다 전수
  const secondary = singlePerturbations(T['review-v2']).filter((p) => p.kind !== 'core_change')
  const core = singlePerturbations(T['review-v2']).filter((p) => p.kind === 'core_change')
  let secFlipStudents = 0, coreFlipStudents = 0, secFlips = 0, coreFlips = 0
  for (const w of withTop) {
    const b = top(T['review-v2'], w)
    const fs1 = secondary.filter((p) => top(applyPerturbation(T['review-v2'], p), w) !== b).length
    const fs2 = core.filter((p) => top(applyPerturbation(T['review-v2'], p), w) !== b).length
    if (fs1) secFlipStudents++
    if (fs2) coreFlipStudents++
    secFlips += fs1
    coreFlips += fs2
  }
  return {
    students: synth.length,
    withCandidate: withTop.length,
    gapUnder005: gaps.filter((g) => g < 0.05).length,
    gapUnder002: gaps.filter((g) => g < 0.02).length,
    medianGap: round([...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] ?? null),
    agreeWithReview: { 'seed-v1': agree('seed-v1'), 'seed-v2': agree('seed-v2') },
    secondaryPerturbations: secondary.length,
    corePerturbations: core.length,
    studentsFlippedBySecondary: secFlipStudents,
    studentsFlippedByCore: coreFlipStudents,
    avgSecondaryFlipsPerStudent: round(secFlips / Math.max(1, withTop.length)),
    avgCoreFlipsPerStudent: round(coreFlips / Math.max(1, withTop.length)),
  }
})()

// 문항별 추천 민감도 — 그 문항만 검수안 → 시드 v2 로 바꿨을 때 1위(후보 첫째)가 바뀌는 합성 학습자 수(후보 있는 학습자 중)
const withCand = synth.filter((w) => top(T['review-v2'], w) !== null)
const itemImpact: Record<number, number> = {}
for (const d of d2.filter((x) => x.tier !== 1)) {
  const swapped = T['review-v2'].map((it) => (it.no === d.no ? { ...it, weights: d.seed } : it))
  itemImpact[d.no] = withCand.filter((w) => top(swapped, w) !== top(T['review-v2'], w)).length
}

// ── 3. 결과 · 사람 검수 패킷 ──
const result = { exam: EXAM, at: '2026-10-08', 'seed-v1': s1, 'seed-v2': s2, ruleEffect, profiles: profileRows, synthetic: synthStats, itemImpact, withCandidate: withCand.length }
fs.mkdirSync(path.join(ROOT, 'tmp/pilot'), { recursive: true })
fs.writeFileSync(path.join(ROOT, `tmp/pilot/${EXAM}-seed-compare.json`), JSON.stringify({ ...result, diffs: d2 }, null, 1))
fs.writeFileSync(path.join(ROOT, `tmp/pilot/${EXAM}-seed-v2-as-review.json`), JSON.stringify({
  exam: EXAM, reviewer: 'seed-v2 (유형 규칙 그대로 — 검수 아님 · TEST 시험 비교용)', version: 'seed-v2',
  items: d2.map((d) => ({ no: d.no, w: d.seed, why: d.rules.map((r) => `seed:${r}`) })),
}, null, 1))

const fmtW = (w: Weights, hi: Set<string> = new Set()) => ATTRIBUTE_CODES.map((c) => (hi.has(c) ? `**${c}:${w[c]}**` : `${c}:${w[c]}`)).join(' ')
const whyOf = (no: number) => review.items.find((r) => r.no === no)!.why
const tierName = { 3: 'Tier 3 — 역량 추가/삭제가 다름(정밀 확인 · 지금 추천에 영향)', 2: 'Tier 2 — 가중치만 다름(지금 추천 영향 없음 · 데이터 의미 · 리포트 숙달)', 1: 'Tier 1 — 시드와 검수안 완전 일치(빠른 확인)' }
const lines: string[] = [
  `# ${EXAM} 사람 검수 패킷 — 시드 v2 · 에이전트 검수안 v2 대조 (2026-10-08)`,
  '',
  '> 이 패킷은 **사람 검수 준비물**이다. 아래 값은 아직 어디에도 저장되지 않았다(실제 M2409 검수 표지 0 · diagnosis_ready 꺼짐).',
  '> 정본 저장은 사람이 문항마다 승인/수정한 결과로, 관리자 태깅 화면(`/admin/csat/diagnosis/exams/' + EXAM + '`)의 「검수 저장」(csat_dx_save_item_tagging)으로만 한다.',
  '> 굵은 글씨 = 시드 v2 와 검수안 v2 가 다른 역량. 0 = 이 문항에서 진단 근거로 쓰지 않음 · 1 = 보조 · 2 = 핵심.',
  '> 보조(1) 기준: 「그 역량만으로도 이 문항을 틀릴 수 있다」고 설명될 때만.',
  '> 순위 판정 계약(2026-10-08 사용자 승인): docs/csat-learner/pilot-runs/ranking-stability-20261008.md §0.',
  '> 우선순위(2026-10-08 순위 안정성 결정 뒤): ① Tier 3 — 역량이 **붙었는지(0 ↔ 1 이상)**가 달라 지금 학습 지도 추천을 바꿀 수 있다. 추천 민감도(그 문항 하나를 시드 값으로 두면 합성 학습자 몇 명의 1위가 바뀌나) 큰 순.',
  '>   ② Tier 2 — 1 ↔ 2 만 다르다. **지금 학습 지도 추천에는 영향이 없다**(지도는 연결 여부만 본다). 진단 리포트의 역량 숙달(rule-v1 · 가중치를 곱한다)과 데이터 의미 보존을 위한 검수다. ③ Tier 1 — 훑기.',
  '',
  `| Tier | 문항 수 | 확인 방법 |`, '|---|---|---|',
  `| 3 | ${s2.tiers[3]} | 지문을 읽고 역량을 더하거나 빼는 이유가 맞는지 |`,
  `| 2 | ${s2.tiers[2]} | 보조(1)와 핵심(2) 중 어느 쪽인지 — 지금 추천에는 영향 없음 |`,
  `| 1 | ${s2.tiers[1]} | 시드 그대로 승인 가능한지 훑기 |`,
  '',
]
for (const tier of [3, 2, 1] as const) {
  lines.push(`## ${tierName[tier]}`, '')
  for (const d of d2.filter((x) => x.tier === tier).sort((a, b) => (itemImpact[b.no] ?? 0) - (itemImpact[a.no] ?? 0) || a.no - b.no)) {
    const hi = new Set(d.diffs.map((x) => x.code as string))
    lines.push(`### ${d.no}번 · ${TYPE_KO[d.type] ?? d.type} (${d.type})`)
    lines.push(`- 시드 v2: ${fmtW(d.seed, hi)}${d.rules.length ? ` — 적용 규칙 ${d.rules.join(', ')}` : ''}`)
    if (tier !== 1) {
      lines.push(`- 추천 민감도: 이 문항을 시드 값으로 두면 합성 학습자 ${withCand.length}명 중 **${itemImpact[d.no]}명**의 「먼저 확인」 1위가 바뀐다${tier === 2 ? ' (Tier 2 — 0 이어야 정상)' : ''}`)
      lines.push(`- 검수안 v2: ${fmtW(d.review, hi)}`)
      lines.push(`- 차이: ${d.diffs.map((x) => `${x.code} ${x.seed}→${x.review}(${x.kind === 'add' ? '추가' : x.kind === 'remove' ? '제거' : '가중치'})`).join(' · ')}`)
      const why = whyOf(d.no).filter((w) => !w.includes('파일럿 v2'))
      lines.push(`- 검수안 이유: ${why.length ? why.join(' / ') : '(기록 없음 — 사람이 판단)'}`)
      lines.push(`- 사람이 볼 것: ${d.diffs.map((x) => (x.kind === 'reweight' ? `${x.code} 가 이 문항에서 ${x.review === 2 ? '핵심인지' : '보조로 충분한지'}` : x.kind === 'add' ? `${x.code} 만으로도 틀릴 수 있는지` : `${x.code} 가 정말 판단에 쓰이지 않는지`)).join(' · ')}`)
    }
    if (tier === 3) {
      lines.push('- 다른 역량마다 세 질문(사람이 답을 남긴다 — ①만 예이고 ②·③이 약하면 문항에 있어도 진단 태그로 쓰지 않는다):')
      for (const x of d.diffs.filter((y) => y.kind !== 'reweight')) {
        lines.push(`  - ${x.code}: ① 이 문항을 풀려면 반드시 필요한가 [예/아니오] · ② 틀렸을 때 ${x.code} 결손이라고 진단해도 되는가 [예/아니오] · ③ 이 태그 하나가 학생의 첫 추천을 바꿀 만큼 강한 근거인가 [예/아니오] → 0 / 1 / 2: ___`)
      }
    }
    lines.push('- [ ] 승인  [ ] 수정 → A1~A9: ______', '')
  }
}
fs.writeFileSync(path.join(ROOT, `docs/csat-learner/pilot-runs/${EXAM}-review-packet.md`), lines.join('\n'))

console.log(JSON.stringify(result, null, 1))
console.log(d2.filter((d) => d.tier !== 1).map((d) => `T${d.tier} ${d.no} ${d.type} ${d.diffs.map((x) => `${x.code}${x.seed}→${x.review}`).join(',')}`).join('\n'))
