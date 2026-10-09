// lib/review-verdicts.mjs
//
// Codex Stop 훅이 남긴 리뷰 판정(verdicts.jsonl)을 작업 완료 판정에 잇는다.
// Stop 훅은 **판정만** 한다(REVIEW_PASS / REVIEW_BLOCKED / REVIEW_UNKNOWN). 다음 작업 선택은 오케스트레이터 몫이다.
//   · 완료하려는 커밋의 가장 최근 판정이 REVIEW_BLOCKED 면 완료·병합·배포 금지 → 작업은 BLOCKED, 오케스트레이터는 다른 독립 작업으로 간다.
//   · REVIEW_PASS 는 **그 커밋**에 대한 것일 때만 유효하다 — 다른 커밋의 PASS 를 완료 근거로 쓰지 않는다.
// 위치: VFC_REVIEW_VERDICTS(테스트·다른 사용자) 또는 ~/.claude/codex-review/verdicts.jsonl. 파일이 없으면 판정 없음(none).

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const verdictsFile = () => process.env.VFC_REVIEW_VERDICTS || path.join(os.homedir(), '.claude', 'codex-review', 'verdicts.jsonl')

export function readVerdicts(file = verdictsFile()) {
  let text = ''
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return []
  }
  const out = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      out.push(JSON.parse(line))
    } catch {
      /* 깨진 줄은 판정이 아니다 */
    }
  }
  return out
}

const sameCommit = (a, b) => !!a && !!b && a.length >= 7 && b.length >= 7 && (a.startsWith(b) || b.startsWith(a))

/**
 * 커밋에 대한 Stop 훅 판정.
 *   { state: 'none' }                       — 이 커밋을 본 판정이 없다
 *   { state: 'pass'|'blocked'|'unknown', record } — 이 커밋에 대한 **가장 최근** 판정
 *   pass_elsewhere: 다른 커밋에 대한 PASS 가 있었다(근거로 쓸 수 없음을 알리는 용도)
 */
export function reviewGate(commit, { verdicts = readVerdicts() } = {}) {
  const mine = verdicts.filter((v) => sameCommit(String(v.head || ''), String(commit || '')))
  const passElsewhere = verdicts.some((v) => v.verdict === 'REVIEW_PASS' && !sameCommit(String(v.head || ''), String(commit || '')))
  if (!mine.length) return { state: 'none', pass_elsewhere: passElsewhere }
  // BLOCKED 는 **같은 루트에서 그 지적 파일을 모두 다시 본** 뒤의 PASS 만 풀 수 있다(다른 파일만 본 PASS 는 못 푼다)
  const covers = (p, b) => p.verdict === 'REVIEW_PASS' && p.root === b.root && (b.p0_p1 || []).every((f) => !f.affected_file || (p.files || []).includes(f.affected_file))
  for (let i = 0; i < mine.length; i++) {
    const b = mine[i]
    if (b.verdict !== 'REVIEW_BLOCKED') continue
    if (!mine.slice(i + 1).some((p) => covers(p, b))) return { state: 'blocked', record: b, pass_elsewhere: passElsewhere }
  }
  const last = mine[mine.length - 1]
  const state = last.verdict === 'REVIEW_PASS' ? 'pass' : last.verdict === 'REVIEW_BLOCKED' ? 'blocked' : 'unknown'
  return { state, record: last, pass_elsewhere: passElsewhere }
}
