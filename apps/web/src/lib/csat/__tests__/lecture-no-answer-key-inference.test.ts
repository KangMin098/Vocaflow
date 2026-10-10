// apps/web/src/lib/csat/__tests__/lecture-no-answer-key-inference.test.ts
//
// 강의는 정답표로 선지의 참을 추론하지 않는다(F11 · 2026-10-11). M2206#25 는 「틀린 선지는 이 번뿐이니 맞는 말이고」
// 라고 했다 — 학습자가 배워야 할 것은 도표를 읽어 대조하는 법이지 정답 번호에서 거꾸로 맞히는 법이 아니다.
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const DIR = path.resolve(__dirname, '../lecture-data')
const BAD = /(틀린|정답인?) 선지는 .{1,8}뿐이니|정답이 아니니 (맞|일치)|답이 .{1,6}번이니 나머지는/

describe('강의 대본 — 정답표 역추론 금지', () => {
  it('어떤 큐도 정답 번호로 다른 선지의 참을 판정하지 않는다', () => {
    const bad: string[] = []
    for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.json') && x !== 'index.json')) {
      const d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
      for (const lec of Object.values(d.lectures ?? {}) as { item_id: string; cues: { id: string; segments: { text: string }[] }[] }[]) {
        for (const c of lec.cues) {
          const t = c.segments.map((s) => s.text).join(' ')
          if (BAD.test(t)) bad.push(`${lec.item_id} ${c.id}`)
        }
      }
    }
    expect(bad).toEqual([])
  })
})
