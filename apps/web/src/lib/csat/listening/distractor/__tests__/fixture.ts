// apps/web/src/lib/csat/listening/distractor/__tests__/fixture.ts
//
// 실제 대본(scripts/csat/data/listening/2023.json 5번 · L-TODO)에 **테스트용 합성 선택지**를 붙인 픽스처.
// 로컬 JSON 에는 선지가 없다 — 아래 choices·answer·evidence·rationales 는 공식 선지·해설이 아니다.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { EvidenceSpan, ListeningItem } from '../../types'

interface RawItem {
  exam: string
  no: number
  stem: string
  turns: { who: string; text: string }[]
  speakers: string[]
}

export function loadRaw(exam: string, no: number): RawItem {
  const file = resolve(__dirname, '../../../../../../../../scripts/csat/data/listening', `${exam}.json`)
  const all = JSON.parse(readFileSync(file, 'utf8')) as RawItem[]
  const it = all.find((x) => x.no === no)
  if (!it) throw new Error(`${exam}#${no} 없음`)
  return it
}

/** 테스트용 합성 선택지 — 공식 선지가 아님 */
export const SYNTHETIC_TODO_CHOICES = [
  'send text messages to customers',
  'contact the band',
  'wrap wine glasses',
  'order more ingredients',
  'hire a new chef',
]

export function todoItem(): ListeningItem {
  const raw = loadRaw('2023', 5)
  const utterances = raw.turns.map((t, i) => ({ id: `u${i + 1}`, speaker: t.who, text: t.text }))
  const span = (id: string, uid: string, needle: string, extra: Partial<EvidenceSpan>): EvidenceSpan => {
    const u = utterances.find((x) => x.id === uid)!
    const s = u.text.indexOf(needle)
    if (s < 0) throw new Error(`근거 '${needle}' 가 ${uid} 에 없음`)
    return { id, utteranceId: uid, charStart: s, charEnd: s + needle.length, role: 'decisive', ...extra }
  }
  return {
    examId: '2023',
    itemNo: 5,
    typeId: 'L-TODO',
    stem: raw.stem,
    choices: [...SYNTHETIC_TODO_CHOICES],
    answer: 3,
    speakers: raw.speakers,
    utterances,
    evidence: [
      span('e-done', 'u4', 'I already sent text messages.', { role: 'contrast', refutesChoices: [1] }),
      span('e-band', 'u11', 'I’ll contact the band.', { role: 'contrast', refutesChoices: [2] }),
      span('e-wrap', 'u10', 'Sure. I’ll do it now.', { supportsChoice: 3 }),
      span('e-ingr', 'u3', 'I think so.', { role: 'supporting', refutesChoices: [4] }),
    ],
    rationales: [
      { choice: 1, verdict: 'contradicted', evidenceIds: ['e-done'] },
      { choice: 2, verdict: 'wrong-speaker', evidenceIds: ['e-band'] },
      { choice: 3, verdict: 'correct', evidenceIds: ['e-wrap'] },
      { choice: 4, verdict: 'partial-match', evidenceIds: ['e-ingr'] },
      { choice: 5, verdict: 'not-mentioned', evidenceIds: [] },
    ],
    audio: { kind: 'none', rights: 'unverified' },
    provenance: { transcriptSource: 'kice-official-script', sha256: '0'.repeat(64), reviewStatus: 'draft' },
    readiness: 'local-fixture',
  }
}
