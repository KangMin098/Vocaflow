// scripts/knowledge/cohort-analysis.mts
//
// 합성 학습자 집단 결과 분석(2026-10-10) — 화면 실행 결과(run-result.json)와 페르소나 답(answers-*.json)을
// **저장소의 같은 주석 · 같은 채점 함수**로 다시 채점해, 완전 정답과 세부 수행(주장 · 근거 누락/과잉 · 관계)을 분리한다.
// 그리고 같은 입력으로 결정 규칙(find-outcome · learning-decision)을 다시 돌려 화면이 낸 결정과 맞는지 · 같은 근거에 같은 결정인지 본다.
// DB 에 쓰지 않는다. 합성 결과는 학습 효과가 아니다 — 결정 엔진의 타당성 · 설명 가능성 검증용.
//   cd apps/web && node <tsx cli> ../../scripts/knowledge/cohort-analysis.mts --cohort <폴더>
import fs from 'node:fs'
import path from 'node:path'

import { annotationFor, gradeClaimSupport, parseResponse } from '../../apps/web/src/lib/knowledge/claim-support'
import { findOutcome, type FindAttemptRow } from '../../apps/web/src/lib/knowledge/find-outcome'
import { decideStep } from '../../apps/web/src/lib/knowledge/learning-decision'

const arg = (k: string, d: string) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const COHORT = arg('--cohort', '')
if (!COHORT) throw new Error('--cohort 폴더가 필요하다')

interface Persona { id: string; group: string; profile: string; trait: string; items: string[] }
interface Answer { persona: string; item: string; claim: number; support: number[]; relation: string; thinking?: string; relationInvalid?: boolean }
interface RunRow { persona: string; group: string; submitted: { item: string; correct: boolean | null; error?: string }[]; find: string | null; decision: string | null; skill: string | null; nextVisible: boolean; error?: string }

const personas = JSON.parse(fs.readFileSync(path.join(COHORT, 'personas.json'), 'utf8')) as Persona[]
const answers: Answer[] = fs.readdirSync(COHORT).filter((f) => /^answers-[A-Z]\.json$/.test(f)).flatMap((f) => JSON.parse(fs.readFileSync(path.join(COHORT, f), 'utf8')))
const runPath = path.join(COHORT, 'run-result.json')
const run: RunRow[] = fs.existsSync(runPath) ? JSON.parse(fs.readFileSync(runPath, 'utf8')) : []

// 1) 세부 채점 — 화면이 쓴 것과 같은 함수
interface Graded { persona: string; group: string; item: string; relationInvalid: boolean; claimSupportOk: boolean; claimOk: boolean; restated: boolean; supportMissed: number; supportExtra: number; supportOk: boolean; relationOk: boolean; isCorrect: boolean; claimPicked: number; claimKey: number; thinking: string }
const graded: Graded[] = []
for (const a of answers) {
  const ann = annotationFor(a.item)
  if (!ann) continue
  const p = personas.find((x) => x.id === a.persona)!
  const r = parseResponse({ claim: a.claim, support: a.support.filter((s) => s !== a.claim), relation: a.relation }, ann)
  if (!r) continue
  const g = gradeClaimSupport(ann, r)
  graded.push({
    // 관계 질문 문장을 다른 문장으로 읽은 응답(1부터 센 번호)은 관계 · 완전 정답을 세지 않고 「주장+근거」만 본다
    persona: a.persona, group: p.group, item: a.item, relationInvalid: !!a.relationInvalid, claimSupportOk: g.claimOk && g.supportOk, claimOk: g.claimOk, restated: g.claimRestated,
    supportMissed: g.supportMissed.length, supportExtra: g.supportExtra.length, supportOk: g.supportOk, relationOk: g.relationOk, isCorrect: g.isCorrect,
    claimPicked: a.claim, claimKey: ann.claim, thinking: a.thinking ?? '',
  })
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—')
const groups = ['A', 'B', 'C', 'D']
console.log('## 세부 수행(그룹별 · 문항 단위)')
console.log('그룹 | 문항 | 완전 정답 | 주장+근거 | 주장 | 근거 정확 | 근거 누락 있음 | 근거 과잉 있음 | 관계(유효분)')
for (const g of groups) {
  const xs = graded.filter((x) => x.group === g)
  const c = (f: (x: Graded) => boolean) => pct(xs.filter(f).length, xs.length)
  const rv = xs.filter((x) => !x.relationInvalid)
  console.log(`${g} | ${xs.length} | ${rv.length ? pct(rv.filter((x) => x.isCorrect).length, rv.length) : '관계 무효'} | ${c((x) => x.claimSupportOk)} | ${c((x) => x.claimOk)} | ${c((x) => x.supportOk)} | ${c((x) => x.supportMissed > 0)} | ${c((x) => x.supportExtra > 0)} | ${rv.length ? pct(rv.filter((x) => x.relationOk).length, rv.length) : '무효'}`)
}

// 부분 정답 — 주장은 맞았는데 완전 정답이 아닌 것(지금 판정은 이것도 「막힘」으로 센다)
const partial = graded.filter((x) => x.claimOk && !x.isCorrect)
console.log(`\n## 부분 정답(주장 맞음 · 완전 정답 아님) ${partial.length}/${graded.length}`)
const why = (x: Graded) => [!x.supportOk && (x.supportMissed ? `근거 누락 ${x.supportMissed}` : ''), !x.supportOk && (x.supportExtra ? `근거 과잉 ${x.supportExtra}` : ''), !x.relationOk && '관계 오답'].filter(Boolean).join(' · ')
const tally: Record<string, number> = {}
for (const x of partial) tally[why(x)] = (tally[why(x)] ?? 0) + 1
console.log(JSON.stringify(tally))

// 문항별 — 주석 문제 의심(모든 그룹에서 같은 방식으로 틀리는 문항)
console.log('\n## 문항별(주장 정답률 · 완전 정답률 · 가장 흔한 오답 주장)')
for (const item of [...new Set(graded.map((x) => x.item))].sort()) {
  const xs = graded.filter((x) => x.item === item)
  const wrong: Record<number, number> = {}
  for (const x of xs.filter((y) => !y.claimOk)) wrong[x.claimPicked] = (wrong[x.claimPicked] ?? 0) + 1
  const top = Object.entries(wrong).sort((a, b) => b[1] - a[1])[0]
  console.log(`${item} n=${xs.length} 주장 ${pct(xs.filter((x) => x.claimOk).length, xs.length)} · 완전 ${pct(xs.filter((x) => x.isCorrect).length, xs.length)} · 정답 주장 ${xs[0].claimKey + 1}번째${top ? ` · 흔한 오답 ${Number(top[0]) + 1}번째 ×${top[1]}` : ''}`)
}

// 2) 화면 결과와 재채점 일치
if (run.length) {
  let match = 0, total = 0
  const mism: string[] = []
  for (const r of run) for (const s of r.submitted) {
    if (s.correct === null) continue
    const g = graded.find((x) => x.persona === r.persona && x.item === s.item)
    if (!g) continue
    total++
    if (g.isCorrect === s.correct) match++
    else mism.push(`${r.persona} ${s.item} 화면 ${s.correct} · 재채점 ${g.isCorrect}`)
  }
  console.log(`\n## 화면 채점 = 재채점 ${match}/${total}${mism.length ? ' · 불일치 ' + mism.join('; ') : ''}`)

  // 3) 결정 재현 · 일관성 — 같은 (정오 패턴)에는 같은 결정
  const CHAIN = { task: { id: 't', slug: 't', version: 1 }, method: { id: 'm', slug: 'm', version: 1 }, principle: { id: 'p', slug: 'p', version: 1 } }
  const items9 = ['2022#20', '2025#20', '2016#20', '2020#20', '2021#20', '2026#20', 'M2506#20', 'M2606#20', 'M2609#20']
  const confirm = items9.map((itemRef) => ({ itemRef, href: itemRef, label: itemRef }))
  const byPattern: Record<string, Set<string>> = {}
  let reproduced = 0, comparable = 0
  console.log('\n## 결정(화면) · 재현 · 근거')
  for (const r of run) {
    const done = r.submitted.filter((s) => s.correct !== null)
    const rows: FindAttemptRow[] = done.map((s) => ({ itemRef: s.item, taskKey: 'claim-support', userId: r.persona, phase: 'practice', isCorrect: s.correct, synthetic: true, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false }))
    const o = findOutcome(confirm.map((c) => ({ itemRef: c.itemRef, taskKey: 'claim-support' })), rows)
    const d = decideStep({ stepKey: 'structure', findTaskId: 'B6-3', outcome: o, chain: CHAIN, confirm, triedItems: done.map((s) => s.item), practiceHref: '/csat/practice/claim-support' })
    const pattern = `${o.right}O${o.wrong}X`
    ;(byPattern[pattern] ??= new Set()).add(d.action)
    if (r.decision) { comparable++; if (r.decision === d.action) reproduced++ }
    const gs = graded.filter((x) => x.persona === r.persona)
    console.log(`${r.persona}(${r.group}) ${pattern} → 화면 ${r.decision} · 재현 ${d.action} · 표시 ${r.nextVisible} · 세부 ${gs.map((x) => `${x.item}[${x.claimOk ? '주장O' : '주장X'}${x.supportOk ? '' : ' 근거X'}${x.relationOk ? '' : ' 관계X'}]`).join(' ')}`)
  }
  console.log(`\n결정 재현 ${reproduced}/${comparable} · 같은 정오 패턴 → 결정 종류 ${JSON.stringify(Object.fromEntries(Object.entries(byPattern).map(([k, v]) => [k, [...v]])))}`)
  const dist: Record<string, Record<string, number>> = {}
  for (const r of run) { dist[r.group] ??= {}; dist[r.group][r.decision ?? 'none'] = (dist[r.group][r.decision ?? 'none'] ?? 0) + 1 }
  console.log(`결정 분포(그룹별) ${JSON.stringify(dist)}`)
  console.log(`실행 상태 완료 ${run.filter((r) => !r.error && r.submitted.every((s) => !s.error)).length} · 오류 ${run.filter((r) => r.error || r.submitted.some((s) => s.error)).length}`)
}
fs.writeFileSync(path.join(COHORT, 'analysis.json'), JSON.stringify({ graded }, null, 1))

// 4) 정책 v1 → v2 비교(같은 입력) — v2 는 막힌 부분(주장 · 근거 · 관계)을 추적한다. 행동이 바뀌면 안 된다(v2 는 추적 · 문구만 바꿨다)
if (run.length) {
  const CHAIN = { task: { id: 't', slug: 't', version: 1 }, method: { id: 'm', slug: 'm', version: 1 }, principle: { id: 'p', slug: 'p', version: 1 } }
  const items9 = ['2022#20', '2025#20', '2016#20', '2020#20', '2021#20', '2026#20', 'M2506#20', 'M2606#20', 'M2609#20']
  const confirm = items9.map((itemRef) => ({ itemRef, href: itemRef, label: itemRef }))
  const focus: Record<string, Record<string, number>> = {}
  let sameAction = 0, n = 0
  const partialDistinct: string[] = []
  for (const r of run) {
    const done = r.submitted.filter((s) => s.correct !== null)
    const rows = (withParts: boolean): FindAttemptRow[] => done.map((s) => {
      const g = graded.find((x) => x.persona === r.persona && x.item === s.item)
      return { itemRef: s.item, taskKey: 'claim-support', userId: r.persona, phase: 'practice', isCorrect: s.correct, synthetic: true, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false,
        parts: withParts && g ? { claim: g.claimOk, support: g.supportOk, relation: g.relationOk } : null }
    })
    const mk = (p: boolean) => decideStep({ stepKey: 'structure', findTaskId: 'B6-3', outcome: findOutcome(confirm.map((c) => ({ itemRef: c.itemRef, taskKey: 'claim-support' })), rows(p)), chain: CHAIN, confirm, triedItems: done.map((s) => s.item), practiceHref: '/csat/practice/claim-support' })
    const v1 = mk(false), v2 = mk(true)
    n++
    if (v1.action === v2.action) sameAction++
    if (v2.action === 'practice_method') {
      focus[r.group] ??= {}
      const k = v2.trace.focus ?? 'none'
      focus[r.group][k] = (focus[r.group][k] ?? 0) + 1
      if (v2.trace.focus && v2.trace.focus !== 'claim') partialDistinct.push(`${r.persona}(${r.group}) 초점 ${v2.trace.focus} · ${JSON.stringify(v2.trace.observation.blockedParts)}`)
    }
  }
  console.log(`\n## 정책 v1 → v2(같은 입력) 행동 동일 ${sameAction}/${n}`)
  console.log(`연습 처방의 초점(그룹별) ${JSON.stringify(focus)}`)
  console.log(`v1 이 구별 못 한 「주장은 맞음 · 다른 부분에서 막힘」 처방 ${partialDistinct.length}명: ${partialDistinct.join(' | ')}`)
}
