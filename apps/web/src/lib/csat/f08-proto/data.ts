// apps/web/src/lib/csat/f08-proto/data.ts
//
// F08 프로토타입 묶음 조립. 원문·선지·정답은 csat_items 읽기 스냅숏, 분석은 inquiry-data.json(v5 verified),
// 강의는 lecture-data/2026.json 에서 온다 — **새로 쓴 기출 문장은 없다.**
// 공개 전 묶음과 공개 묶음을 나누고, 공개 전 묶음에 정답 누출이 하나라도 있으면 조립을 거부한다(빈 화면이 낫다).

import 'server-only'

import inquiry from '../inquiry-data.json'
import lectures from '../lecture-data/2026.json'
import { answerLeaks } from './leak'
import snapshot from './snapshot-2026-34.json'
import type { ProtoCue, ProtoItem, ProtoMeaning, ProtoReveal, ScopeKind, Truth } from './types'

/** 정답을 말하지 않는 강의 역할 — 이 밖의 큐는 공개 뒤에만 보낸다. */
const PRE_REVEAL_ROLES = new Set(['intro', 'strategy', 'structure'])

interface RawCue { id: string; role: string; target: { kind: string; id: string }; segments: { lang: string; text: string }[] }

export function splitSentences(passage: string): string[] {
  // 이 지문은 마침표+공백으로만 문장이 나뉜다(약어·인용 마침표 없음 — 테스트가 7문장·원문 복원을 확인한다).
  return passage.split(/(?<=\.)\s+/).map((s) => s.trim()).filter(Boolean)
}

function cueOf(raw: RawCue): ProtoCue {
  const m = raw.target.kind === 'anchor' ? /^sentence:(\d+)$/.exec(raw.target.id) : null
  return {
    id: raw.id,
    role: raw.role,
    // 강의 앵커는 0부터 센다(sentence:6 = 7번 문장).
    sentence: m ? Number(m[1]) + 1 : null,
    lines: raw.segments.map((s) => ({ lang: s.lang === 'en-US' ? 'en-US' : 'ko-KR', text: s.text })),
  }
}

type BuildResult = { state: 'ready'; item: ProtoItem } | { state: 'no-source' | 'no-analysis' | 'leak'; detail: string }

export function buildItem(itemId: string): BuildResult {
  if (itemId !== snapshot.item_id) return { state: 'no-source', detail: `${itemId} 의 검증된 원문 스냅숏이 없다` }
  const record = (inquiry.items as Record<string, (typeof inquiry.items)['2026#34'] | undefined>)[itemId]
  if (!record || record.review !== 'verified') return { state: 'no-analysis', detail: '검수 완료(verified) 분석이 없다' }
  const sentences = splitSentences(snapshot.passage)
  if (sentences.length !== record.v3.sentence_count) {
    return { state: 'no-source', detail: `문장 수 불일치(원문 ${sentences.length} · 분석 ${record.v3.sentence_count})` }
  }
  const meanings: ProtoMeaning[] = record.v3.meanings.map((m) => ({
    id: m.id,
    sentence: m.sentences[0],
    expression: m.expression,
    meaningKo: m.meaning_ko,
    scope: (m.scope.kind as ScopeKind) ?? 'none',
    // 노트 안의 「(예: …)」는 선지 대입 예시라 공개 전에 빼낸다.
    scopeNote: m.scope.note.replace(/\s*\(예:[^)]*\)/g, ''),
  }))
  const lecture = (lectures.lectures as Record<string, { cues: RawCue[] } | undefined>)[itemId]
  const pre = lecture ? lecture.cues.filter((c) => PRE_REVEAL_ROLES.has(c.role)).map(cueOf) : []
  const item: ProtoItem = {
    itemId,
    stem: snapshot.stem,
    sentences,
    blankSentence: sentences.findIndex((s) => s.includes('______')) + 1,
    choices: snapshot.choices,
    requirement: {
      requested: record.v3.requirement.requested,
      conditions: record.v3.requirement.conditions,
      readingScope: record.v3.requirement.reading_scope,
    },
    meanings,
    lecture: lecture ? { state: 'ready', cues: pre, lockedCount: lecture.cues.length - pre.length, review: 'unverified' } : { state: 'missing' },
    provenance: {
      passageSha256: snapshot.passage_sha256,
      analysisVersion: record.analysis_version,
      review: record.review,
      unitsHash: record.v3.units_hash,
    },
  }
  const leaks = answerLeaks(JSON.stringify({ ...item, choices: [] }), snapshot.answer, snapshot.choices[snapshot.answer - 1])
  if (leaks.length) return { state: 'leak', detail: leaks.join(' · ') }
  return { state: 'ready', item }
}

export function buildReveal(itemId: string): ProtoReveal | null {
  if (itemId !== snapshot.item_id) return null
  const record = (inquiry.items as Record<string, (typeof inquiry.items)['2026#34'] | undefined>)[itemId]
  if (!record) return null
  const lecture = (lectures.lectures as Record<string, { cues: RawCue[] } | undefined>)[itemId]
  return {
    answer: snapshot.answer,
    verdicts: record.v3.choices.map((c) => ({
      n: c.n,
      isAnswer: c.n === snapshot.answer,
      truth: c.content_truth as Truth,
      decisive: c.decisive,
      sentences: c.sentences,
    })),
    claims: record.v3.design.claims.map((c) => ({ basis: c.basis, text: c.text })),
    principle: {
      statement: record.principle.statement,
      whenApplies: record.principle.when_applies,
      whenNot: record.principle.when_not,
    },
    limitation: record.v3.design.limitation,
    cues: lecture ? lecture.cues.filter((c) => !PRE_REVEAL_ROLES.has(c.role)).map(cueOf) : [],
  }
}
