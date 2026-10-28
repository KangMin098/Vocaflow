// apps/web/src/lib/csat/listening/fixtures/build.ts
//
// 대본 턴 → 계약 모양 발화 · 근거 구간. 구간은 글자 위치를 손으로 세지 않고 구절로 찾는다(대본이 바뀌면 던져서 드러난다).

import type { EvidenceRole, EvidenceSpan, ListeningUtterance } from '../types'

export interface RawTurn {
  who: string
  text: string
}

export function utterancesFromTurns(prefix: string, turns: readonly RawTurn[]): ListeningUtterance[] {
  return turns.map((t, i) => ({ id: `${prefix}-u${i + 1}`, speaker: t.who, text: t.text }))
}

export function spanOf(
  utterances: readonly ListeningUtterance[],
  id: string,
  utteranceId: string,
  phrase: string,
  role: EvidenceRole,
): EvidenceSpan {
  const u = utterances.find((x) => x.id === utteranceId)
  if (!u) throw new Error(`발화 없음: ${utteranceId}`)
  const at = u.text.indexOf(phrase)
  if (at < 0) throw new Error(`구절이 발화 ${utteranceId} 에 없음: ${phrase}`)
  return { id, utteranceId, charStart: at, charEnd: at + phrase.length, role }
}
