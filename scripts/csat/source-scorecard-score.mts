// scripts/csat/source-scorecard-score.mts
//
// **원천 21곳을 5축으로 채점하고 유지/축소/보류/제거를 판정한다 — 읽기 전용 · 순수 계산.**
//
// 입력 둘을 합친다. 둘 다 **이미 측정된 파일**이고, 이 스크립트는 산술만 한다 —
// 판정 근거가 어디서 왔는지 한 줄로 되짚을 수 있어야 하기 때문이다.
//
//   ① 구조 실측 `structural.json` — DB 한 번의 SQL 집계(편수 · 적격 등급 · 차단 축 · 적격 문항 · 라이선스 혼재)
//   ② 표본 실측 `scorecard-verified.json` — `source-scorecard-verify.mts` 가 **해시·건수·스키마를
//      대조해 통과시킨 것만**. 에이전트의 보고 문장은 근거로 쓰지 않는다(A3).
//
// ── 5축 (각 20점 · 합 100) ───────────────────────────────────────────
//   F1 난이도 적합  3중 합의 CEFR 분포가 기출과 얼마나 가까운가(14) + 밴드 안 비율(6)
//   F2 지문 적합    결함 없음(8) + 자족성(5) + 산문성(3) + 실을 수 있는 유형 폭(4)
//   F3 소재 기여    기출 8분류와의 거리(12) + **부족 칸** 기여(8)
//   F4 법적 적격    L0 20 · L1 18 · L2 12 · L3 4 · L4 0 (재고 라이선스 혼재 −3)
//   F5 수율·규모    적격률(10) + 1,000편당 적격 문항(6) + 재고 규모(4)
//
//   F1~F3 은 **표본에서만** 나온다 — 새 후보도 같은 축으로 재면 기존 원천과 나란히 놓인다.
//
// ── 판정 ─────────────────────────────────────────────────────────────
//   ≥70 유지 · 50~69 축소 · <50 제거 후보. 두 가지가 점수를 가로챈다:
//     · **L4(ND)** — 파생을 못 하면 문항이 안 나온다. 점수와 무관하게 display-only.
//     · **미판정 ≥50%** — 이건 원천의 성질이 아니라 **우리 쪽 작업이 밀린 것**이다.
//       그 상태의 점수는 원천이 아니라 밀린 일을 재는 것이므로 「보류」로 두고 판정 후 다시 잰다.
//       (이 구분이 없으면 Frontiers·Europe PMC 처럼 한 번도 판정하지 않은 원천이
//        「나쁜 원천」으로 기록되고, 그 기록이 다음 사람의 근거가 된다.)
//
// 기준선: 기출 802편 3중 합의 CEFR(DD-57 정정) · 기출 218편 소재 8분류(`docs/reports/topic-gap.json`).
//
// 실행: pnpm exec tsx scripts/csat/source-scorecard-score.mts \
//         --structural .agent-logs/source-scorecard/structural.json \
//         --verified   .agent-logs/source-scorecard/scorecard-verified.json \
//         --out        .agent-logs/source-scorecard/scorecard.json

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const argOf = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : d
}

/** 기출에서 **공급이 모자란** 소재 칸 — `topic-gap.json` 의 ratio<1. 기출 합 67.9%. */
const SHORT_TOPICS = ['심리·인지', '사회·경제', '예술·문화', '기술·매체', '교육·언어']
const SHORT_TOPIC_EXAM_SHARE = 67.9

/** 라이선스 등급 — `licenseClassOf` 와 1:1. Gate 3 의 정책 질문 둘이 L2·L3 다. */
const LICENSE_GRADE: Record<string, { grade: string; score: number; why: string }> = {
  public_domain: { grade: 'L0', score: 20, why: '파생·발행·상업 이용 자유' },
  cc0: { grade: 'L0', score: 20, why: '권리 포기 — 제약 없음' },
  cc_by: { grade: 'L1', score: 18, why: '파생·상업 가능 · 출처 표시 의무' },
  cc_by_sa: { grade: 'L2', score: 12, why: '파생 가능하나 동일조건 전염 — 교재 전체가 SA 가 된다' },
  restricted: { grade: 'L3', score: 4, why: 'NC 또는 미상 — 상업 배포와 충돌' },
  cc_by_nd: { grade: 'L4', score: 0, why: 'ND — 파생 불가 · display-only' },
}

type StructRow = {
  source: string
  stock_live: number
  eligible_articles: number
  eligible_items: number
  grades: Record<string, number>
  blocked_axes: Record<string, number>
  license_mix: Record<string, number>
}
type VerRow = {
  source: string
  sampled: number
  consensusCefr: Record<string, number>
  cefrDistanceToExam: number
  inBandPct: number
  register: Record<string, number>
  topic: Record<string, number>
  topicDistanceToExam: number
  defect: Record<string, number>
  cleanPct: number
  selfContainedPct: number
  prosePct: number
  csatTypeHits: Record<string, number>
  csatTypeCoverage: number
  vocabHitRateAvg: number
  wordsMedian: number
}

const structural = JSON.parse(
  readFileSync(resolve(argOf('structural', '.agent-logs/source-scorecard/structural.json')), 'utf8'),
) as { measuredAt: string; source: string; rows: StructRow[] }
const verified = JSON.parse(
  readFileSync(resolve(argOf('verified', '.agent-logs/source-scorecard/scorecard-verified.json')), 'utf8'),
) as { sources: VerRow[] }

const byKey = new Map(verified.sources.map((v) => [v.source, v]))
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n))
const topN = (m: Record<string, number>, n: number, skip: string[] = []) =>
  Object.entries(m)
    .filter(([k]) => !skip.includes(k))
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `${k} ${v}`)

const rows = structural.rows.map((st) => {
  const v = byKey.get(st.source)
  if (!v) throw new Error(`${st.source}: 표본 실측이 없다 — 검증을 통과한 청크만 채점한다`)

  const stock = st.stock_live
  const eligPct = stock ? (st.eligible_articles / stock) * 100 : 0
  const itemsPer1000 = stock ? (st.eligible_items / stock) * 1000 : 0

  const licEntries = Object.entries(st.license_mix).filter(([k]) => k !== '—')
  const licMajor = licEntries.sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
  const licMixed = licEntries.length > 1
  const lg = LICENSE_GRADE[licMajor] ?? { grade: 'L?', score: 0, why: '분류 불가 — 근거 없음' }

  const f1 = 14 * clamp(1 - v.cefrDistanceToExam / 100) + 6 * clamp(v.inBandPct / 100)
  const f2 =
    8 * clamp(v.cleanPct / 100) +
    5 * clamp(v.selfContainedPct / 100) +
    3 * clamp(v.prosePct / 100) +
    4 * clamp(Math.min(v.csatTypeCoverage, 10) / 10)
  const shortShare = SHORT_TOPICS.reduce((a, t) => a + (v.topic[t] ?? 0), 0)
  const f3 = 12 * clamp(1 - v.topicDistanceToExam / 100) + 8 * clamp(shortShare / SHORT_TOPIC_EXAM_SHARE)
  const f4 = Math.max(0, lg.score - (licMixed ? 3 : 0))
  const f5 =
    10 * clamp(eligPct / 50) +
    6 * clamp(itemsPer1000 / 10000) +
    4 * clamp(Math.log10(Math.max(1, stock)) / 4.5)

  const total = f1 + f2 + f3 + f4 + f5
  const unjudged = st.grades['unjudged'] ?? 0
  const unjudgedPct = stock ? (unjudged / stock) * 100 : 0

  let verdict: string
  let why: string
  if (lg.grade === 'L4') {
    verdict = '유지(display-only)'
    why = 'L4 — 파생 불가. 읽기 자료로만 남고 문항 공급원이 아니다(점수 무관)'
  } else if (unjudgedPct >= 50) {
    verdict = '보류'
    why = `미판정 ${unjudgedPct.toFixed(0)}% — 원천의 성질이 아니라 내용 판정 미실행이다. 판정 후 재평가`
  } else if (total >= 70) {
    verdict = '유지'
    why = '5축 합 70 이상'
  } else if (total >= 50) {
    verdict = '축소'
    why = '5축 합 50~69 — 잘 드는 구간(피드·등급·연도)만 남긴다'
  } else {
    verdict = '제거 후보'
    why = '5축 합 50 미만'
  }

  return {
    source: st.source,
    stockLive: stock,
    sampled: v.sampled,
    eligibleArticles: st.eligible_articles,
    eligiblePct: +eligPct.toFixed(2),
    eligibleItems: st.eligible_items,
    itemsPer1000: +itemsPer1000.toFixed(0),
    grades: st.grades,
    unjudgedPct: +unjudgedPct.toFixed(1),
    topBlockAxes: topN(st.blocked_axes, 3, ['—']),
    licenseGrade: lg.grade,
    licenseClassMajor: licMajor,
    licenseMixed: licMixed,
    licenseMix: st.license_mix,
    licenseWhy: lg.why,
    consensusCefr: v.consensusCefr,
    cefrDistanceToExam: v.cefrDistanceToExam,
    inBandPct: v.inBandPct,
    register: v.register,
    topic: v.topic,
    topicDistanceToExam: v.topicDistanceToExam,
    shortTopicSharePct: +shortShare.toFixed(1),
    topDefects: topN(v.defect, 3, ['none']),
    cleanPct: v.cleanPct,
    selfContainedPct: v.selfContainedPct,
    prosePct: v.prosePct,
    csatTypeCoverage: v.csatTypeCoverage,
    wordsMedian: v.wordsMedian,
    F1: +f1.toFixed(1),
    F2: +f2.toFixed(1),
    F3: +f3.toFixed(1),
    F4: +f4.toFixed(1),
    F5: +f5.toFixed(1),
    total: +total.toFixed(1),
    verdict,
    why,
  }
})

rows.sort((a, b) => b.total - a.total)

const out = {
  readOnly: true,
  contract: 'source-scorecard/v1',
  scoredAt: new Date().toISOString(),
  inputs: { structural: structural.source, structuralMeasuredAt: structural.measuredAt, sampleVerified: 'source-scorecard-verify.mts (sha256·건수·스키마 대조 통과분만)' },
  axes: {
    F1: '난이도 적합 — 3중 합의 CEFR 이 기출 분포와 가까운가(14) + 밴드 안 비율(6)',
    F2: '지문 적합 — 결함 없음(8) + 자족성(5) + 산문성(3) + 유형 폭(4)',
    F3: '소재 기여 — 기출 8분류와의 거리(12) + 부족 칸 기여(8)',
    F4: '법적 적격 — L0 20 · L1 18 · L2 12 · L3 4 · L4 0 (재고 혼재 −3)',
    F5: '수율·규모 — 적격률(10) + 1,000편당 적격 문항(6) + 재고 규모(4)',
  },
  thresholds: { keep: 70, shrink: 50, note: 'L4 는 점수 무관 display-only · 미판정 ≥50% 는 보류' },
  totals: {
    sources: rows.length,
    stockLive: rows.reduce((a, r) => a + r.stockLive, 0),
    eligibleArticles: rows.reduce((a, r) => a + r.eligibleArticles, 0),
    eligibleItems: rows.reduce((a, r) => a + r.eligibleItems, 0),
  },
  verdictCounts: rows.reduce<Record<string, number>>((a, r) => ((a[r.verdict] = (a[r.verdict] ?? 0) + 1), a), {}),
  rows,
}

const outPath = argOf('out', '')
if (outPath) writeFileSync(resolve(outPath), JSON.stringify(out, null, 2))
console.log(
  `${'원천'.padEnd(16)} ${'합'.padStart(5)}  F1    F2    F3    F4    F5   등급  적격%   문항/1k  판정`,
)
console.log(
  rows
    .map(
      (r) =>
        `${r.source.padEnd(18)} ${String(r.total).padStart(5)}  ${String(r.F1).padStart(4)}  ${String(r.F2).padStart(4)}  ${String(r.F3).padStart(4)}  ${String(r.F4).padStart(4)}  ${String(r.F5).padStart(4)}   ${r.licenseGrade}  ${String(r.eligiblePct).padStart(6)}  ${String(r.itemsPer1000).padStart(7)}  ${r.verdict}`,
    )
    .join('\n'),
)
console.log('\n판정: ' + JSON.stringify(out.verdictCounts))
console.log('합계: ' + JSON.stringify(out.totals))
