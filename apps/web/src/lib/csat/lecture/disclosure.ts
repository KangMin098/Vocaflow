// apps/web/src/lib/csat/lecture/disclosure.ts
//
// **강의의 「직접 정답 공개」 경계 — 검증된 것만 쓴다.**
//
// 경계 데이터(`disclosure-data.json`)는 cue 공개 수준 검수(sidecar)에서 `scripts/csat/lecture-disclosure-build.mjs` 가 만든다.
// 요청마다 지금 강의 대본의 version · cue 수 · digest 를 다시 계산해 데이터와 맞춘다 — 대본이 바뀌었으면 경계를 쓰지 않는다
// (안전 구간을 추정하지 않는다). 경계 앞에도 정답을 좁히는 단서는 있을 수 있다 — `preStopRisk` 가 그 수준이다.
//
// ⚠️ UI 의 정답 미표시 계약이지 보안 경계가 아니다. 공개된 기출 해설 전체는 같은 학습자가 전체 강의 경로로 받을 수 있다.

import crypto from 'node:crypto'

import data from './disclosure-data.json'
import type { Lecture } from './types'

export type PreStopRisk = 'decisive_confirmed' | 'decisive_possible' | 'hint' | 'none'

export type LectureDisclosure =
  | { verified: true; stopBefore: number; preStopRisk: PreStopRisk }
  | { verified: false; reason: 'no_boundary' | 'binding_mismatch' }

interface Entry { version: number | null; cues: number; digest: string; stopBefore: number; preStopRisk: PreStopRisk }
const ENTRIES = (data as unknown as { lectures: Record<string, Entry> }).lectures

/** cue 원문 JSON 을 줄바꿈으로 이은 sha256 — 생성기와 같은 계산 */
export function lectureDigest(lecture: Pick<Lecture, 'cues'>): string {
  return crypto.createHash('sha256').update(lecture.cues.map((c) => JSON.stringify(c)).join('\n')).digest('hex')
}

export function lectureDisclosure(itemId: string, lecture: Lecture | null): LectureDisclosure {
  const e = ENTRIES[itemId]
  if (!e || !lecture) return { verified: false, reason: 'no_boundary' }
  const version = (lecture as { version?: number }).version ?? null
  if (version !== e.version || lecture.cues.length !== e.cues || lectureDigest(lecture) !== e.digest) return { verified: false, reason: 'binding_mismatch' }
  if (e.stopBefore < 0 || e.stopBefore > lecture.cues.length) return { verified: false, reason: 'binding_mismatch' }
  return { verified: true, stopBefore: e.stopBefore, preStopRisk: e.preStopRisk }
}

/** 경계 앞 cue 만 담은 강의 — 대본 · 음성 · 강조 · 소거 표시가 모두 이 범위만 안다 */
export function lectureUntil(lecture: Lecture, stopBefore: number): Lecture {
  return { ...lecture, cues: lecture.cues.slice(0, stopBefore) }
}
