// scripts/csat/content-review/packages/apply-to-snapshot.mts
//
// 콘텐츠 정정 패키지(docs/csat-learner/content-review/<item>/package.json)의 제안 문안을 검수 스냅샷 후보에 채운다 —
// 검수자가 /admin/csat/content-review 에서 수정 전후를 비교하게. 후보 id 는 changes 에 묶여 있으므로 다시 계산한다.
// 원본(강의 · 분석 · DB)은 바꾸지 않는다. 승인 상태도 바꾸지 않는다(스냅샷에는 승인이 없다).
//
// 실행: node_modules/.bin/tsx scripts/csat/content-review/packages/apply-to-snapshot.mts 2015-25

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildRelations, candidateId } from '../../../../apps/web/src/lib/csat/content-review/candidates.ts'
import type { ProposedChange, ReviewCandidate } from '../../../../apps/web/src/lib/csat/content-review/types.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')
const slug = process.argv[2]
if (!slug) throw new Error('패키지 이름(예: 2015-25)을 준다')
const pkg = JSON.parse(readFileSync(join(ROOT, `docs/csat-learner/content-review/${slug}/package.json`), 'utf8'))
const snapPath = join(ROOT, 'apps/web/src/lib/csat/content-review/data/snapshot.json')
const snap = JSON.parse(readFileSync(snapPath, 'utf8'))

const target: ReviewCandidate | undefined = snap.candidates.find((c: ReviewCandidate) => c.itemId === pkg.item_id && c.source === 'DRAIN_MULTI_ANSWER')
if (!target) throw new Error(`${pkg.item_id} 후보가 스냅샷에 없다`)

const draftRef = `docs/csat-learner/content-review/${slug}/package.json`
const changes: ProposedChange[] = target.changes.map((ch) => {
  if (ch.target.startsWith('cue:')) {
    const lc = pkg.lecture_changes.find((x: { id: string }) => `cue:${x.id}` === ch.target)
    return lc ? { ...ch, proposed: (lc.text as string[]).join(' '), draftRef } : ch
  }
  if (ch.target === 'analysis:reject:5') return { ...ch, proposed: `verdict correct — ${pkg.analysis_v6.choice_n5.why_correct}`, draftRef }
  return ch
})
const oldId = target.id
const next: ReviewCandidate = {
  ...target,
  changes,
  officialAnswerBasis: pkg.official.basis,
  aiEvidence: [...new Set([...target.aiEvidence, `콘텐츠 정정 패키지 ${slug} · F 발행 전 검증 수정 후 BLOCK 0`])],
  note: `공식 정답 ④·⑤ = 평가원 정답표(sha256 ${pkg.official.sha256.slice(0, 8)}…). 사람 내용 승인 없음.`,
}
next.id = candidateId(next)
snap.candidates = snap.candidates.map((c: ReviewCandidate) => (c.id === oldId ? next : c))
snap.relations = buildRelations(snap.candidates)
// 스냅샷 원본 형식(build-snapshot 출력 — 1칸 들여쓰기) 그대로 — 형식만 바뀐 diff 를 만들지 않는다
writeFileSync(snapPath, JSON.stringify(snap, null, 1) + '\n')
console.log(JSON.stringify({ item: pkg.item_id, oldId, newId: next.id, proposed: changes.filter((c) => c.proposed != null).length, of: changes.length }))
