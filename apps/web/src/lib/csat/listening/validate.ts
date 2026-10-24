// apps/web/src/lib/csat/listening/validate.ts
//
// ListeningItem 검증기 — 던지지 않고 구조화된 오류 목록을 돌려준다. 빈 목록 = 통과.

import { parseExamId } from '../exam-id'
import { isListeningTypeId, type ListeningAudioSource, type ListeningItem } from './types'

export type ListeningErrorCode =
  | 'exam-id-invalid'
  | 'type-id-invalid'
  | 'choices-count'
  | 'answer-out-of-range'
  | 'speaker-unknown'
  | 'utterance-id-duplicate'
  | 'utterance-timing-invalid'
  | 'utterance-timing-not-monotone'
  | 'utterance-timing-overlap'
  | 'evidence-id-duplicate'
  | 'evidence-utterance-missing'
  | 'evidence-span-out-of-bounds'
  | 'evidence-choice-out-of-range'
  | 'rationale-evidence-missing'
  | 'rationale-choice-duplicate'
  | 'rationale-correct-count'
  | 'rationale-correct-mismatch'
  | 'audio-synthetic-labelled-official'
  | 'audio-official-missing-url'
  | 'audio-none-has-url'

export interface ListeningValidationError {
  code: ListeningErrorCode
  /** 문제 위치(예: 'utterances[2]' · 'evidence[e1]') */
  path: string
  message: string
}

const SYNTHETIC_HINT = /synthetic|fixture|tts/i

const inChoiceRange = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= 5

export function validateAudio(audio: ListeningAudioSource): ListeningValidationError[] {
  const out: ListeningValidationError[] = []
  if (audio.kind === 'official' && audio.url && SYNTHETIC_HINT.test(audio.url)) {
    out.push({ code: 'audio-synthetic-labelled-official', path: 'audio.url', message: '합성/테스트 음원 경로가 official 로 표시됨' })
  }
  if (audio.kind === 'official' && !audio.url) out.push({ code: 'audio-official-missing-url', path: 'audio.url', message: 'official 음원에 url 이 없음' })
  if (audio.kind === 'none' && audio.url) out.push({ code: 'audio-none-has-url', path: 'audio.url', message: "kind 'none' 인데 url 이 있음" })
  return out
}

/** official 음원은 권리 verified 일 때만 재생 가능. 합성 픽스처는 테스트 표시와 함께 재생 가능 */
export function isAudioPlayable(audio: ListeningAudioSource): boolean {
  if (!audio.url) return false
  if (audio.kind === 'official') return audio.rights === 'verified' && validateAudio(audio).length === 0
  return audio.kind === 'synthetic-test-fixture'
}

export function validateListeningItem(item: ListeningItem): ListeningValidationError[] {
  const errs: ListeningValidationError[] = []
  const push = (code: ListeningErrorCode, path: string, message: string) => errs.push({ code, path, message })

  if (!parseExamId(item.examId)) push('exam-id-invalid', 'examId', `회차 id 문법 아님: ${item.examId}`)
  if (!isListeningTypeId(item.typeId)) push('type-id-invalid', 'typeId', `알 수 없는 유형: ${String(item.typeId)}`)
  if (item.choices.length !== 5) push('choices-count', 'choices', `선지 ${item.choices.length}개(5개여야 함)`)
  if (!inChoiceRange(item.answer)) push('answer-out-of-range', 'answer', `정답 ${item.answer}`)

  // 발화
  const speakers = new Set(item.speakers)
  const utt = new Map<string, string>()
  let prevEnd: number | null = null
  let prevStart: number | null = null
  item.utterances.forEach((u, i) => {
    const p = `utterances[${i}]`
    if (utt.has(u.id)) push('utterance-id-duplicate', p, `발화 id 중복: ${u.id}`)
    utt.set(u.id, u.text)
    if (!speakers.has(u.speaker)) push('speaker-unknown', p, `speakers 에 없는 화자: ${u.speaker}`)
    const hasS = u.startMs !== undefined
    const hasE = u.endMs !== undefined
    if (hasS !== hasE || (hasS && hasE && (u.startMs! < 0 || u.endMs! <= u.startMs!))) {
      push('utterance-timing-invalid', p, 'startMs/endMs 는 함께 있고 0 ≤ start < end 여야 함')
      return
    }
    if (hasS) {
      if (prevStart !== null && u.startMs! < prevStart) push('utterance-timing-not-monotone', p, '시작 시각이 앞 발화보다 이름')
      else if (prevEnd !== null && u.startMs! < prevEnd) push('utterance-timing-overlap', p, '앞 발화와 시간이 겹침')
      prevStart = u.startMs!
      prevEnd = u.endMs!
    }
  })

  // 근거
  const evIds = new Set<string>()
  for (const e of item.evidence) {
    const p = `evidence[${e.id}]`
    if (evIds.has(e.id)) push('evidence-id-duplicate', p, `근거 id 중복: ${e.id}`)
    evIds.add(e.id)
    const text = utt.get(e.utteranceId)
    if (text === undefined) push('evidence-utterance-missing', p, `없는 발화: ${e.utteranceId}`)
    else if (!Number.isInteger(e.charStart) || !Number.isInteger(e.charEnd) || e.charStart < 0 || e.charEnd <= e.charStart || e.charEnd > text.length) {
      push('evidence-span-out-of-bounds', p, `[${e.charStart}, ${e.charEnd}) 가 발화 길이 ${text.length} 밖`)
    }
    const choices = [...(e.supportsChoice !== undefined ? [e.supportsChoice] : []), ...(e.refutesChoices ?? [])]
    if (choices.some((c) => !inChoiceRange(c))) push('evidence-choice-out-of-range', p, '선지 번호는 1–5')
  }

  // 선지 근거
  const seen = new Set<number>()
  const correct: number[] = []
  item.rationales.forEach((r, i) => {
    const p = `rationales[${i}]`
    if (seen.has(r.choice)) push('rationale-choice-duplicate', p, `선지 ${r.choice} 중복`)
    seen.add(r.choice)
    if (r.verdict === 'correct') correct.push(r.choice)
    for (const id of r.evidenceIds) if (!evIds.has(id)) push('rationale-evidence-missing', p, `없는 근거: ${id}`)
  })
  if (correct.length !== 1) push('rationale-correct-count', 'rationales', `correct 판정 ${correct.length}개(1개여야 함)`)
  else if (correct[0] !== item.answer) push('rationale-correct-mismatch', 'rationales', `correct 선지 ${correct[0]} ≠ 정답 ${item.answer}`)

  errs.push(...validateAudio(item.audio))
  return errs
}
