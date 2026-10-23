// apps/web/src/lib/csat/lecture/__tests__/disclosure.test.ts
//
// 「직접 정답 공개」 경계 — 커밋된 실제 강의 대본과 경계 데이터로 결속 · 자르기를 잰다.
import { describe, expect, it } from 'vitest'

import data from '../disclosure-data.json'
import { lectureDigest, lectureDisclosure, lectureUntil } from '../disclosure'
import { loadLecture } from '../store'

const ANSWER_SAID = /정답은\s*[^.?!]{0,12}?(?:일|이|삼|사|오)\s+번|이것이 답입니다/

describe('강의 정답 공개 경계', () => {
  it('데이터의 모든 경계가 지금 대본과 결속된다(대본이 바뀌면 이 검사가 먼저 깨진다)', () => {
    const entries = Object.entries((data as unknown as { lectures: Record<string, { digest: string }> }).lectures)
    expect(entries.length).toBeGreaterThan(0)
    const broken = entries.filter(([id]) => !lectureDisclosure(id, loadLecture(id)).verified).map(([id]) => id)
    expect(broken).toEqual([])
  })

  it('2026#22 — 정답 번호를 말하는 cue(index 4) 앞에서 멈춘다', () => {
    const lecture = loadLecture('2026#22')!
    const d = lectureDisclosure('2026#22', lecture)
    expect(d).toMatchObject({ verified: true, stopBefore: 4 })
    const cut = lectureUntil(lecture, 4)
    expect(cut.cues).toHaveLength(4)
    expect(cut.cues.map((c) => c.segments.map((s) => s.text).join(' ')).join(' ')).not.toMatch(ANSWER_SAID)
    // 자른 바로 다음 cue 가 실제로 정답을 말한다
    expect(lecture.cues[4].segments.map((s) => s.text).join(' ')).toMatch(ANSWER_SAID)
  })

  it('2026#27 — 대본이 규칙보다 먼저 답을 말한 cue 로 경계를 당긴다', () => {
    const lecture = loadLecture('2026#27')!
    const d = lectureDisclosure('2026#27', lecture)
    expect(d).toMatchObject({ verified: true, stopBefore: 4 })
    expect(lecture.cues[4].segments.map((s) => s.text).join(' ')).toMatch(/이것이 답입니다/)
  })

  it('결속 — cue 원문이 한 글자라도 바뀌면 경계를 쓰지 않는다(안전 구간 추정 금지)', () => {
    const lecture = structuredClone(loadLecture('2026#22')!)
    lecture.cues[1].segments[0].text += ' '
    expect(lectureDisclosure('2026#22', lecture)).toEqual({ verified: false, reason: 'binding_mismatch' })
  })

  it('결속 — version · cue 수가 다르면 쓰지 않는다', () => {
    const lecture = loadLecture('2026#22')!
    expect(lectureDisclosure('2026#22', { ...lecture, version: lecture.version + 1 }).verified).toBe(false)
    expect(lectureDisclosure('2026#22', { ...lecture, cues: lecture.cues.slice(1) }).verified).toBe(false)
  })

  it('경계 데이터가 없는 문항 · 강의가 없는 문항은 검증되지 않음', () => {
    expect(lectureDisclosure('2099#99', loadLecture('2026#22'))).toEqual({ verified: false, reason: 'no_boundary' })
    expect(lectureDisclosure('2026#22', null)).toEqual({ verified: false, reason: 'no_boundary' })
  })

  it('digest 는 cue 순서에 민감하다', () => {
    const lecture = loadLecture('2026#22')!
    expect(lectureDigest({ cues: [...lecture.cues].reverse() })).not.toBe(lectureDigest(lecture))
  })
})
