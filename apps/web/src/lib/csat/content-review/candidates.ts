// apps/web/src/lib/csat/content-review/candidates.ts
//
// **F1 검수 후보 통합 — 결정적 id · 중복 · 충돌.**
//
// id 는 (문항 · 결함 · 정렬된 target · 판본 결속)의 sha256 앞 16자다. 같은 내용을 두 원천이 올려도 id 가 같아
// 한 번만 검수된다(중복 감수 방지). 판본이 바뀌면 id 도 바뀐다 — 옛 판본 위의 판정이 새 판본에 옮겨 붙지 않는다.
// 순수 함수만 둔다(DB·파일 없음). 해시는 node:crypto — 스냅샷 빌드와 서버 화면에서만 부른다.
// ⚠️ `@/` 별칭을 쓰지 않는다 — 스냅샷 빌드 스크립트(tsx)가 그대로 import 한다.

import { createHash } from 'node:crypto'

import type { CandidateRelation, ReviewCandidate, RevisionBinding } from './types'

function bindingKey(b: RevisionBinding): string {
  return [b.itemId, b.itemMd5, b.analysisVersion, b.analysisMd5, b.lectureVersion ?? '-', b.lectureHash ?? '-'].join('|')
}

export function candidateId(c: Pick<ReviewCandidate, 'itemId' | 'defect' | 'changes' | 'binding'>): string {
  const targets = [...new Set(c.changes.map((x) => x.target))].sort().join(',')
  const key = [c.itemId, c.defect, targets, bindingKey(c.binding)].join('\n')
  return `cr_${createHash('sha256').update(key, 'utf8').digest('hex').slice(0, 16)}`
}

/** 선지 번호를 가리키는 target(`analysis:reject:5` · `cue` 문안의 「오 번」은 못 잡는다 — target 만 본다) */
function rejectedChoice(target: string): number | null {
  const m = /^analysis:reject:(\d)$/.exec(target)
  return m ? Number(m[1]) : null
}

const norm = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim()

/**
 * 후보 사이 관계.
 * - duplicate: 같은 문항 · 같은 결함 · target 이 겹침 · 같은 판본
 * - conflict: 같은 문항 · 같은 target 에 서로 다른 제안 문안, 또는 공식 정답 선지를 「소거(reject)」로 남기는 변경
 * - same_item: 위 둘이 아닌 같은 문항의 후보 — 함께 검수해야 한다
 */
export function buildRelations(cands: readonly ReviewCandidate[]): CandidateRelation[] {
  const out: CandidateRelation[] = []
  for (let i = 0; i < cands.length; i++) {
    const a = cands[i]!
    for (const ch of a.changes) {
      const n = rejectedChoice(ch.target)
      if (n !== null && a.officialAnswers?.includes(n) && ch.proposed !== null && !/정답/.test(ch.proposed)) {
        out.push({ kind: 'conflict', a: a.id, b: a.id, reason: `${ch.target} 는 공식 정답 ${n} 을 오답 소거로 남긴다` })
      }
    }
    for (let j = i + 1; j < cands.length; j++) {
      const b = cands[j]!
      if (a.itemId !== b.itemId) continue
      const at = new Map(a.changes.map((x) => [x.target, x]))
      const shared = b.changes.filter((x) => at.has(x.target))
      if (a.defect === b.defect && shared.length && bindingKey(a.binding) === bindingKey(b.binding)) {
        out.push({ kind: 'duplicate', a: a.id, b: b.id, reason: `같은 결함 · target ${shared.map((x) => x.target).join(',')}` })
        continue
      }
      const diff = shared.filter((x) => x.proposed !== null && at.get(x.target)!.proposed !== null && norm(x.proposed) !== norm(at.get(x.target)!.proposed))
      if (diff.length) {
        out.push({ kind: 'conflict', a: a.id, b: b.id, reason: `같은 target 에 다른 제안: ${diff.map((x) => x.target).join(',')}` })
        continue
      }
      out.push({ kind: 'same_item', a: a.id, b: b.id, reason: '같은 문항 — 함께 검수' })
    }
  }
  return out
}

/**
 * 중복 합치기 — 같은 id 이거나 duplicate 관계면 하나로 합치고 원천·AI 증거·변경을 모은다.
 * 먼저 온 후보가 대표다(입력 순서 = 원천 우선순위).
 */
export function dedupeCandidates(cands: readonly ReviewCandidate[]): { kept: ReviewCandidate[]; merged: { into: string; from: string }[] } {
  const kept: ReviewCandidate[] = []
  const merged: { into: string; from: string }[] = []
  for (const c of cands) {
    const hit = kept.find(
      (k) => k.id === c.id ||
        (k.itemId === c.itemId && k.defect === c.defect && bindingKey(k.binding) === bindingKey(c.binding) &&
          k.changes.some((x) => c.changes.some((y) => y.target === x.target && norm(y.proposed) === norm(x.proposed)))),
    )
    if (!hit) {
      kept.push({ ...c, changes: [...c.changes], aiEvidence: [...c.aiEvidence], tracks: [...c.tracks] })
      continue
    }
    merged.push({ into: hit.id, from: c.id })
    for (const ch of c.changes) if (!hit.changes.some((x) => x.target === ch.target)) hit.changes.push(ch)
    for (const e of c.aiEvidence) if (!hit.aiEvidence.includes(e)) hit.aiEvidence.push(e)
    for (const t of c.tracks) if (!hit.tracks.includes(t)) hit.tracks.push(t)
    hit.sourceRef = `${hit.sourceRef} + ${c.source}:${c.sourceRef}`
  }
  return { kept, merged }
}
