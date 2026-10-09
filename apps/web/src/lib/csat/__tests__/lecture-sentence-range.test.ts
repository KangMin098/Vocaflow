// apps/web/src/lib/csat/__tests__/lecture-sentence-range.test.ts
//
// 강의가 가리키는 문장(`anchor:sentence:k`)은 학습자 문장 지도(skeleton-data, 0-기반) 안에 있어야 한다(2026-10-09 전량 측정 0/6,608).
// 학습자는 강의가 켠 문장을 공개 문제지에서 같은 번호로 찾는다 — 범위 밖 번호는 아무 문장도 켜지 않거나 엉뚱한 곳을 보게 한다.
// (분석 DB 의 sentence_index 는 화면이 쓰지 않는다 — passage-skeleton.ts 머리말)
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const DIR = path.resolve(__dirname, '..')
const read = (sub: string) => fs.readdirSync(path.join(DIR, sub)).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(DIR, sub, f), 'utf8')))

describe('강의 문장 가리킴 ↔ 문장 지도', () => {
  it('모든 강의 큐의 sentence:k 가 그 문항 문장 지도 범위 안이다', () => {
    const counts = new Map<string, number>()
    for (const d of read('skeleton-data')) for (const it of d.items ?? []) counts.set(it.id, it.sentences.length)
    const bad: string[] = []
    for (const d of read('lecture-data')) {
      for (const lec of Object.values(d.lectures ?? {}) as { item_id: string; cues?: { id: string; target?: { kind: string; id: string }; focus?: number[] }[] }[]) {
        const n = counts.get(lec.item_id)
        for (const c of lec.cues ?? []) {
          const ks = [...(c.target?.kind === 'anchor' ? [/^sentence:(\d+)$/.exec(c.target.id)?.[1]] : []), ...(c.focus ?? []).map(String)].filter((x): x is string => x != null).map(Number)
          for (const k of ks) if (n == null || k < 0 || k >= n) bad.push(`${lec.item_id} ${c.id} sentence:${k} (문장 ${n ?? '지도 없음'})`)
        }
      }
    }
    expect(bad).toEqual([])
  })
})
