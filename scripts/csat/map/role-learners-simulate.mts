// scripts/csat/map/role-learners-simulate.mts
//
// 역할 학습자 시뮬레이션 ③ 채점 · 직접 확인 엔진 통과(2026-10-10). DB 를 쓰지 않는다(읽지도 않는다 — 골격 파일 · 답 파일만).
// 역할 학습자(Claude Code 서브에이전트 · 페르소나 맹검)의 답을 실제 채점기(gradeEvidence)와 직접 확인 엔진(skillDiagnosis) ·
// 생애주기 4칸(lifecycleCells)에 그대로 통과시킨다. **프로세스 검증이지 학습 효과 근거가 아니다** — 학습자는 모델이다.
// 시도 순서: 문항 묶음 순서대로 하루에 하나(독립 첫 시도 · 해설 전). 상위 페르소나가 틀린 문항은 주석 점검 대상으로 따로 적는다.
//   cd apps/web && node <tsx cli> ../../scripts/csat/map/role-learners-simulate.mts
import fs from 'node:fs'
import path from 'node:path'

import { CURRICULUM, lifecycleCells, stepOfTask } from '../../../apps/web/src/lib/csat/map/curriculum'
import { skillDiagnosis, type SkillAttempt } from '../../../apps/web/src/lib/csat/map/skill-diagnosis'
import { deriveEvidenceAnnotation, gradeEvidence, type EvidenceTaskKey, type SkeletonLike } from '../../../apps/web/src/lib/knowledge/evidence-locate'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const DIR = path.join(ROOT, 'scripts/csat/map/role-learners')
const SK = path.join(ROOT, 'apps/web/src/lib/csat/skeleton-data')
const skeletons = new Map<string, SkeletonLike>(fs.readdirSync(SK).filter((f) => f.endsWith('.json') && f !== 'index.json')
  .flatMap((f) => (JSON.parse(fs.readFileSync(path.join(SK, f), 'utf8')) as { items: SkeletonLike[] }).items).map((i) => [i.id, i]))
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8')) as Record<EvidenceTaskKey, string[]>
const personas: { persona: string; answers: Record<string, { key: string; no: number; reason: string }> }[] = fs.readdirSync(DIR).filter((f) => /^answers-.+\.json$/.test(f))
  .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as { persona: string; answers: Record<string, { key: string; no: number; reason: string }> })

// 규칙 학습자(scripted) — 모델 페르소나는 사람의 오류 습관을 잘 재현하지 못했다(기초 페르소나도 근거를 대부분 찾음).
// 생애주기 끝까지(확인 → 바로잡기 → 다시 확인 → 통과 / 계속)를 지나가게 하려고 오류 습관을 규칙으로 준다. 이것도 효과 근거가 아니다.
//   habit-then-repair  처음 두 문항은 습관대로(빈칸 문장 바로 앞 · 글 첫 문장) 고르고, 바로잡기 뒤 다시 확인 문항은 근거를 고른다
//   habit-persistent   처음 두 문항은 습관대로, 다시 확인에서도 한 번 더 습관대로 고른다
const habitPick = (a: { blank: number | null; evidence: number[]; disputed: number[]; sentenceCount: number }) => {
  const bad = (n: number) => n >= 0 && n < a.sentenceCount && !a.evidence.includes(n) && !a.disputed.includes(n) && n !== a.blank
  const tries = a.blank !== null ? [a.blank - 1, a.blank + 1, 0] : [0, a.sentenceCount - 1, 1]
  return tries.find(bad) ?? Array.from({ length: a.sentenceCount }, (_, i) => i).find(bad) ?? 0
}
for (const [persona, checkHabit] of [['habit-then-repair', false], ['habit-persistent', true]] as const) {
  const answers: Record<string, { key: string; no: number; reason: string }> = {}
  for (const key of Object.keys(manifest) as EvidenceTaskKey[]) {
    manifest[key].forEach((itemId, i) => {
      const a = deriveEvidenceAnnotation(key, skeletons.get(itemId) ?? null)!
      const habit = i < 2 || (checkHabit && i === 2)
      answers[itemId] = { key, no: (habit ? habitPick(a) : a.evidence[0]) + 1, reason: habit ? '습관(빈칸 옆 · 첫 문장)' : '바로잡기 뒤 근거 문장' }
    })
  }
  personas.push({ persona, answers })
}

const now = new Date('2026-10-20T00:00:00Z')
const day = (d: number) => new Date(Date.UTC(2026, 9, d)).toISOString()
const out: Record<string, unknown> = {}
const review: { itemId: string; key: string; pick: number; evidence: number[]; reason: string }[] = []
for (const p of personas) {
  const res: Record<string, unknown> = {}
  for (const key of Object.keys(manifest) as EvidenceTaskKey[]) {
    const attempts: SkillAttempt[] = []
    const rows = manifest[key].map((itemId, i) => {
      const a = deriveEvidenceAnnotation(key, skeletons.get(itemId) ?? null)!
      const ans = p.answers[itemId]
      const pick = ans ? ans.no - 1 : -1
      const g = pick >= 0 && pick < a.sentenceCount ? gradeEvidence(a, { pick }) : null
      attempts.push({ userId: p.persona, itemRef: itemId, taskKey: key, phase: 'practice', isCorrect: g ? g.isCorrect : null, synthetic: false, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, answeredAt: day(10 + i) })
      if (p.persona === 'top' && g && !g.isCorrect) review.push({ itemId, key, pick: pick + 1, evidence: a.evidence.map((e) => e + 1), reason: ans.reason })
      return { itemId, pick: pick + 1, evidence: a.evidence.map((e) => e + 1), correct: g?.isCorrect ?? null, lure: g?.lurePicked ?? null }
    })
    const targets = manifest[key].map((itemRef) => ({ itemRef, taskKey: key }))
    const d = skillDiagnosis(targets, attempts, now)
    res[key] = {
      step: stepOfTask(key),
      readiness: CURRICULUM[stepOfTask(key)!].readiness,
      correct: rows.filter((r) => r.correct).length,
      lurePicked: rows.filter((r) => r.lure).length,
      status: d.status,
      verifiedItems: d.verifiedItems,
      check: d.check,
      lifecycle: lifecycleCells(d, true).map((c) => `${c.stage}:${c.state}`).join(' '),
      rows,
    }
  }
  out[p.persona] = res
}
fs.writeFileSync(path.join(DIR, 'simulation.json'), JSON.stringify({ note: '역할 학습자(모델) 시뮬레이션 — 프로세스 검증 · 효과 근거 아님', now: now.toISOString(), personas: out, annotationReview: review }, null, 2))
for (const [p, r] of Object.entries(out)) for (const [k, v] of Object.entries(r as Record<string, { correct: number; lurePicked: number; status: string; lifecycle: string }>)) console.log(`${p.padEnd(6)} ${k.padEnd(16)} 정답 ${v.correct}/${(v as unknown as { rows: unknown[] }).rows.length} · 함정 ${v.lurePicked} · ${v.status.padEnd(12)} · ${v.lifecycle}`)
console.log(`주석 점검 대상(상위 페르소나 오답): ${review.length}`)
for (const r of review) console.log(`  ${r.itemId} ${r.key} 고름 ${r.pick} · 주석 근거 ${r.evidence.join(',')} — ${r.reason}`)
