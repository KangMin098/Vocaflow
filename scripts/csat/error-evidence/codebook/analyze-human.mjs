// scripts/csat/error-evidence/codebook/analyze-human.mjs
//
// 사람 판정자 blind dry run 분석 — 판정자 A ↔ B · A/B ↔ 기대 판정 · 불일치 쌍 · 판정 조정(adjudication) 시트.
// 승인 게이트(docs/csat-learner/codebook/HUMAN_DRY_RUN.md §지표)는 이 프로젝트의 내부 screening 기준이다 — 보편 학술 기준이 아니다.
//
//   node scripts/csat/error-evidence/codebook/analyze-human.mjs <corpus.json> <reviewerA.json> <reviewerB.json> <out-dir> [expected.json]
//   corpus.json  : docs/csat-learner/codebook/data/human-corpus.json (사례 + 경계 묶음)
//   reviewer*.json: 판정 패킷(build-packet.mjs)에서 내보낸 결과 — [{case_id, adequacy, outcome, primary, contributing[], candidates[], judge_confidence, ...}]
//   expected.json: 사람 판정이 끝난 뒤에만 연다(판정자에게 공개 금지). 없으면 기대 비교를 건너뛴다.
// 출력: <out-dir>/human-analysis.md · human-analysis.json · adjudication.csv

import fs from 'node:fs'
import path from 'node:path'

import { agreement, CODES, FAMILIES, OUTCOMES } from './agreement.mjs'

const [corpusF, aF, bF, outDir, expF] = process.argv.slice(2)
if (!corpusF || !aF || !bF || !outDir) {
  console.error('사용: analyze-human.mjs <corpus.json> <reviewerA.json> <reviewerB.json> <out-dir> [expected.json]')
  process.exit(2)
}
const load = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
const corpus = load(corpusF)
const cases = corpus.cases
// 패킷 내보내기 형식({reviewer, codebookHash, judgments[]}) 또는 배열
const judgmentsOf = (f) => {
  const j = load(f)
  if (Array.isArray(j)) return j
  if (j.codebookHash && corpus.codebook_sha256 && j.codebookHash !== corpus.codebook_sha256) {
    console.error(`${f}: 다른 코드북으로 판정한 결과다(${j.codebookHash.slice(0, 12)} ≠ ${corpus.codebook_sha256.slice(0, 12)})`)
    process.exit(2)
  }
  return j.judgments
}
const A = Object.fromEntries(judgmentsOf(aF).map((r) => [r.case_id, r]))
const B = Object.fromEntries(judgmentsOf(bF).map((r) => [r.case_id, r]))
const exp = expF ? load(expF) : null

const GATES = { family: 0.8, primary: 0.7, insufficient: 0.8, primaryReview: 0.65, repeatedPair: 3 }

const fam = (c) => (c ? c.split('.')[0] : null)

const both = cases.filter((c) => A[c.case_id] && B[c.case_id])
const missing = cases.filter((c) => !A[c.case_id] || !B[c.case_id]).map((c) => c.case_id)
const judged = both.filter((c) => A[c.case_id].outcome !== 'unsupported_stimulus' && B[c.case_id].outcome !== 'unsupported_stimulus')

const outcomeAg = agreement(judged.map((c) => [A[c.case_id].outcome, B[c.case_id].outcome]), OUTCOMES)
const insuffAg = agreement(judged.map((c) => [A[c.case_id].outcome === 'insufficient_evidence', B[c.case_id].outcome === 'insufficient_evidence']), [true, false])
const withPrimary = judged.filter((c) => A[c.case_id].primary && B[c.case_id].primary)
const familyAg = agreement(withPrimary.map((c) => [fam(A[c.case_id].primary), fam(B[c.case_id].primary)]), FAMILIES)
const primaryAg = agreement(withPrimary.map((c) => [A[c.case_id].primary, B[c.case_id].primary]), CODES)
// 전 사례 기준(primary 없음도 하나의 범주) — 「둘 다 primary 를 고른 사례」만 보는 수치가 보류 차이를 숨기지 않게
const primaryAll = agreement(judged.map((c) => [A[c.case_id].primary ?? `(${A[c.case_id].outcome})`, B[c.case_id].primary ?? `(${B[c.case_id].outcome})`]),
  [...CODES, ...OUTCOMES.map((o) => `(${o})`)])

// 불일치 쌍
const pairCount = {}
const outcomePairs = {}
for (const c of judged) {
  const a = A[c.case_id], b = B[c.case_id]
  if (a.primary && b.primary && a.primary !== b.primary) { const k = [a.primary, b.primary].sort().join(' ↔ '); pairCount[k] = (pairCount[k] || 0) + 1 }
  if (a.outcome !== b.outcome) { const k = [a.outcome, b.outcome].sort().join(' ↔ '); outcomePairs[k] = (outcomePairs[k] || 0) + 1 }
}
const repeated = Object.entries(pairCount).filter(([, n]) => n >= GATES.repeatedPair)

// 경계 묶음별
const groups = {}
for (const c of judged) for (const g of c.boundaries ?? ['(없음)']) {
  groups[g] = groups[g] || { n: 0, outcome: 0, primaryN: 0, primary: 0 }
  const a = A[c.case_id], b = B[c.case_id]
  groups[g].n++
  if (a.outcome === b.outcome) groups[g].outcome++
  if (a.primary && b.primary) { groups[g].primaryN++; if (a.primary === b.primary) groups[g].primary++ }
}

// 판정자 확신도와 불일치
const confRows = {}
for (const c of judged) for (const r of [A[c.case_id], B[c.case_id]]) {
  const k = r.judge_confidence ?? '(없음)'
  confRows[k] = confRows[k] || { n: 0, agree: 0 }
  confRows[k].n++
  if (A[c.case_id].outcome === B[c.case_id].outcome && A[c.case_id].primary === B[c.case_id].primary) confRows[k].agree++
}

// 기대 판정 대비(정답이 아니라 작성자 가정 — 셋을 따로 본다)
let vsExp = null
if (exp) {
  vsExp = { A: { outcome: 0, primary: 0, primaryN: 0 }, B: { outcome: 0, primary: 0, primaryN: 0 }, bothAgreeButDiffer: [] }
  for (const c of judged) {
    const e = exp[c.case_id]
    if (!e) continue
    for (const [who, r] of [['A', A[c.case_id]], ['B', B[c.case_id]]]) {
      if (r.outcome === e.outcome || (e.accept_outcome || []).includes(r.outcome)) vsExp[who].outcome++
      if (e.outcome === 'identified' && r.primary) { vsExp[who].primaryN++; if (r.primary === e.primary || (e.accept || []).includes(r.primary)) vsExp[who].primary++ }
    }
    const a = A[c.case_id], b = B[c.case_id]
    const same = a.outcome === b.outcome && a.primary === b.primary
    const matchesExp = a.outcome === e.outcome && (e.outcome !== 'identified' || a.primary === e.primary || (e.accept || []).includes(a.primary))
    if (same && !matchesExp) vsExp.bothAgreeButDiffer.push({ case_id: c.case_id, reviewers: `${a.outcome}:${a.primary ?? '-'}`, expected: `${e.outcome}:${e.primary ?? (e.candidates || []).join('|')}` })
  }
}

const pct = (x) => (x == null ? '—' : `${(100 * x).toFixed(1)}%`)
const num = (x) => (x == null ? '—' : x.toFixed(3))
const gate = (v, g) => (v == null ? '—' : v >= g ? '통과' : '미달')
const res = {
  n: { corpus: cases.length, judgedBoth: judged.length, withPrimaryBoth: withPrimary.length, missing },
  family: familyAg, primary: primaryAg, primaryAllCases: primaryAll, outcome: outcomeAg, insufficient: insuffAg,
  gates: {
    family: gate(familyAg.po, GATES.family), primary: primaryAg.po == null ? '—' : primaryAg.po >= GATES.primary ? '통과' : primaryAg.po >= GATES.primaryReview ? '수정 검토 구간' : '미달',
    insufficient: gate(insuffAg.po, GATES.insufficient), repeatedPairs: repeated.length ? `반복 충돌 ${repeated.length}쌍` : '없음',
  },
  pairCount, outcomePairs, groups, confRows, vsExpected: vsExp,
}
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'human-analysis.json'), JSON.stringify(res, null, 1) + '\n')

let md = `# 사람 판정자 dry run — 분석\n\n> 내부 screening 기준(보편 학술 기준 아님). 50~60건 경계 중심 표본이라 코드별 신뢰도를 추정하지 않는다.\n\n`
md += `사례 ${cases.length} · 두 판정자 모두 판정 ${judged.length} · 둘 다 primary ${withPrimary.length}${missing.length ? ` · 누락 ${missing.join(', ')}` : ''}\n\n`
md += `| 지표 | 관찰 일치 | Cohen κ | Gwet AC1 | 내부 게이트 |\n|---|---|---|---|---|\n`
md += `| family 정확 일치(둘 다 primary) | ${pct(familyAg.po)} | ${num(familyAg.kappa)} | ${num(familyAg.ac1)} | ≥ 80% → ${res.gates.family} |\n`
md += `| primary 정확 일치(둘 다 primary) | ${pct(primaryAg.po)} | ${num(primaryAg.kappa)} | ${num(primaryAg.ac1)} | ≥ 70% → ${res.gates.primary} |\n`
md += `| primary(전 사례 · 보류도 범주) | ${pct(primaryAll.po)} | ${num(primaryAll.kappa)} | ${num(primaryAll.ac1)} | 참고 |\n`
md += `| outcome 일치 | ${pct(outcomeAg.po)} | ${num(outcomeAg.kappa)} | ${num(outcomeAg.ac1)} | 참고 |\n`
md += `| insufficient_evidence 여부 일치 | ${pct(insuffAg.po)} | ${num(insuffAg.kappa)} | ${num(insuffAg.ac1)} | ≥ 80% → ${res.gates.insufficient} |\n\n`
md += `반복 충돌 쌍(같은 primary 쌍 ${GATES.repeatedPair}건 이상): **${res.gates.repeatedPairs}**\n\n`
md += `## primary 불일치 쌍\n\n| 쌍 | 건 |\n|---|---|\n${Object.entries(pairCount).sort((x, y) => y[1] - x[1]).map(([k, v]) => `| ${k} | ${v} |`).join('\n') || '| (없음) | 0 |'}\n\n`
md += `## outcome 불일치 쌍\n\n| 쌍 | 건 |\n|---|---|\n${Object.entries(outcomePairs).sort((x, y) => y[1] - x[1]).map(([k, v]) => `| ${k} | ${v} |`).join('\n') || '| (없음) | 0 |'}\n\n`
md += `## 경계 묶음별\n\n| 경계 | 사례 | outcome 일치 | primary 일치(둘 다 primary) |\n|---|---|---|---|\n${Object.entries(groups).map(([g, v]) => `| ${g} | ${v.n} | ${v.outcome}/${v.n} | ${v.primary}/${v.primaryN} |`).join('\n')}\n\n`
md += `## 판정자 확신도별 일치\n\n| 확신도 | 판정 수 | 두 판정자 완전 일치 |\n|---|---|---|\n${Object.entries(confRows).map(([k, v]) => `| ${k} | ${v.n} | ${v.agree}/${v.n} |`).join('\n')}\n\n`
if (vsExp) {
  md += `## 기대 판정 대비(정답이 아니다 — 작성자 가정)\n\n| | outcome | primary(기대 identified · 판정자 primary) |\n|---|---|---|\n`
  for (const w of ['A', 'B']) md += `| ${w} | ${vsExp[w].outcome}/${judged.length} | ${vsExp[w].primary}/${vsExp[w].primaryN} |\n`
  md += `\n두 판정자가 서로 같고 기대와 다른 사례(작성자 가정 재검토 대상): ${vsExp.bothAgreeButDiffer.length}건\n\n`
  for (const d of vsExp.bothAgreeButDiffer) md += `- ${d.case_id}: 판정 ${d.reviewers} · 기대 ${d.expected}\n`
}
fs.writeFileSync(path.join(outDir, 'human-analysis.md'), md)

// 판정 조정 시트 — 최초 blind 결과는 고치지 않는다. 불일치마다 분류 하나를 채운다
const CATS = 'reviewer_mistake|rule_gap|evidence_gap|case_problem|taxonomy_overlap|missing_cause'
const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`
const rows = [['case_id', 'boundaries', 'A', 'B', 'A_rationale', 'B_rationale', `category(${CATS})`, 'adjudicated_outcome', 'adjudicated_primary', 'note'].map(esc).join(',')]
for (const c of judged) {
  const a = A[c.case_id], b = B[c.case_id]
  if (a.outcome === b.outcome && a.primary === b.primary) continue
  rows.push([c.case_id, (c.boundaries || []).join(' / '), `${a.outcome}:${a.primary ?? (a.candidates || []).join('|')}`, `${b.outcome}:${b.primary ?? (b.candidates || []).join('|')}`,
    a.rationale, b.rationale, '', '', '', ''].map(esc).join(','))
}
fs.writeFileSync(path.join(outDir, 'adjudication.csv'), '﻿' + rows.join('\r\n') + '\r\n')
console.log(md.split('\n').slice(0, 12).join('\n'))
console.log(`불일치 ${rows.length - 1}건 → ${path.join(outDir, 'adjudication.csv')}`)
