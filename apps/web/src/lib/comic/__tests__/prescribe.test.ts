// apps/web/src/lib/comic/__tests__/prescribe.test.ts
// 포맷 처방 규칙 회귀 — docs/CCP_LIBRARY_INTEGRATION.md §5.3 표와 1:1.
// 핵심 계약: 만화는 "어려울 때 / 복습할 때"만 권장된다(적정 난이도에선 본문) — seductive details 방어.

import { describe, expect, it } from 'vitest'

import { prescribeFormat, type PrescribeInput } from '../prescribe'

const base: PrescribeInput = {
  diagnosed: true,
  fit: 'ideal',
  comicProgressPct: 0,
  comicCompleted: false,
  readAnyChapter: false,
  hasAudio: false,
}

describe('prescribeFormat', () => {
  it('보던 만화가 있으면 이어보기가 최우선 (난이도보다 앞선다)', () => {
    const r = prescribeFormat({ ...base, fit: 'ideal', comicProgressPct: 40 })
    expect(r.pick).toBe('comic')
    expect(r.reason).toMatch(/이어서/)
  })

  it('본문을 읽은 적 있으면 만화를 복습으로 권장', () => {
    const r = prescribeFormat({ ...base, readAnyChapter: true })
    expect(r.pick).toBe('comic')
    expect(r.reason).toMatch(/되짚|기억/)
  })

  it('만화를 완독했으면 다음 단계는 본문', () => {
    const r = prescribeFormat({ ...base, comicCompleted: true, comicProgressPct: 100 })
    expect(r.pick).toBe('text')
  })

  it('어려운 책(hard)이면 만화를 스캐폴드로 권장', () => {
    expect(prescribeFormat({ ...base, fit: 'hard' }).pick).toBe('comic')
  })

  it('도전적(challenge)이면 만화 권장', () => {
    expect(prescribeFormat({ ...base, fit: 'challenge' }).pick).toBe('comic')
  })

  it('딱 맞는 난이도(ideal)면 본문 — 만화를 밀지 않는다', () => {
    const r = prescribeFormat({ ...base, fit: 'ideal' })
    expect(r.pick).toBe('text')
  })

  it('수월한데 낭독이 있으면 듣기, 없으면 본문', () => {
    expect(prescribeFormat({ ...base, fit: 'easy', hasAudio: true }).pick).toBe('audio')
    expect(prescribeFormat({ ...base, fit: 'easy', hasAudio: false }).pick).toBe('text')
  })

  it('미진단이면 만화로 가볍게 시작', () => {
    const r = prescribeFormat({ ...base, diagnosed: false, fit: null })
    expect(r.pick).toBe('comic')
    expect(r.reason).toMatch(/진단/)
  })

  it('진단했어도 커버리지가 없으면(fit=null) 미진단과 동일하게 만화', () => {
    expect(prescribeFormat({ ...base, fit: null }).pick).toBe('comic')
  })
})
