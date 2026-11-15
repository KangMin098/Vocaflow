// apps/web/src/lib/csat/__tests__/theater-disclosure-mask.test.ts
//
// 레일 차례 마스킹을 **실제 강의 데이터 전부**로 잰다 — 소스 문자열 가드만으로는 정규식 결함(`\\d`)을 못 잡았다(T-0140 Codex P1).
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { lectureOutline } from '../lecture/store'
import { maskDisclosureSteps, theaterSteps } from '../theater'

const DATA = path.join(process.cwd(), 'src/lib/csat/lecture-data')
const ids = Object.keys(JSON.parse(fs.readFileSync(path.join(DATA, 'index.json'), 'utf8')).items as Record<string, unknown>)

describe('레일 차례 — 오답 소거 번호 마스킹', () => {
  it('강의가 있는 모든 문항에서 마스킹 뒤 오답 번호가 남지 않는다(이름 · 키 모두)', () => {
    let rejects = 0
    const leaks: string[] = []
    for (const id of ids) {
      const raw = theaterSteps(lectureOutline(id))
      rejects += raw.filter((s) => /^analysis:reject:\d$/.test(s.targetKey)).length
      for (const s of maskDisclosureSteps(raw)) {
        if (/^analysis:reject:\d$/.test(s.targetKey) || /오답 [①-⑤1-5]/.test(s.name)) leaks.push(`${id} ${s.id}`)
      }
    }
    // 마스킹 대상이 실제로 있어야 이 검사가 뜻이 있다
    expect(rejects).toBeGreaterThan(1000)
    expect(leaks).toEqual([])
  })

  it('오답 소거가 아닌 차례는 그대로 둔다', () => {
    const raw = theaterSteps(lectureOutline('2026#22'))
    const masked = maskDisclosureSteps(raw)
    raw.forEach((s, i) => {
      if (!/^analysis:reject:/.test(s.targetKey)) expect(masked[i]).toEqual(s)
      else expect(masked[i]).toMatchObject({ name: '오답 지우기', targetKey: 'analysis:reject' })
    })
  })
})
