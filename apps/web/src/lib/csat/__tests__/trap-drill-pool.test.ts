// apps/web/src/lib/csat/__tests__/trap-drill-pool.test.ts
//
// **구워 둔 훈련 문제 풀이 훈련으로 쓸 만한가.**
//
// 풀이 망가지는 방식은 조용하다: 정답이 보기에 없거나, 해설이 정답 이름을 품고 있거나,
// 한 함정이 풀을 먹어 세트가 늘 같은 것만 묻거나. 셋 다 화면은 멀쩡히 돈다.
//
// 굽는 쪽과 여기가 **같은 경계**를 쓰는지도 본다 — 굽는 스크립트는 맨 node 로 돌아야 해서
// `UNIVERSAL_MIN_TYPES` 를 import 하지 못하고 값을 다시 적는다. 어긋나면 여기서 빨개진다.

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { DRILL_SIZE, loadTrapDrill } from '../drill-loader'
import { TRAPS, UNIVERSAL, UNIVERSAL_MIN_TYPES } from '../trap-atlas'
import { OPTION_COUNT, leaksAnswer, type DrillCard } from '../trap-drill'

const POOL = path.join(process.cwd(), 'src/lib/csat/drill-data/pool.json')
const raw = JSON.parse(fs.readFileSync(POOL, 'utf8')) as {
  built_at: string
  per_trap: number
  eligible: number
  cards: DrillCard[]
}

describe('구운 풀', () => {
  it('충분히 크고 함정 아홉을 다 덮는다', () => {
    expect(raw.cards.length).toBeGreaterThan(200)
    const covered = new Set(raw.cards.map((c) => c.answer))
    for (const t of UNIVERSAL) expect(`${t.key}:${covered.has(t.key)}`).toBe(`${t.key}:true`)
    // 범용 아홉 **밖의** 함정은 들어가면 안 된다 — 넣으면 외울 것이 다시 서른두 가지가 된다.
    const universal = new Set(UNIVERSAL.map((t) => t.key))
    const outside = [...covered].filter((k) => !universal.has(k))
    expect(outside, `범용 밖 함정이 섞였다: ${outside.join(', ')}`).toEqual([])
  })

  it('굽는 쪽과 읽는 쪽이 같은 「범용」 경계를 쓴다', () => {
    // 굽는 스크립트는 맨 node 라 상수를 import 하지 못하고 10 을 다시 적는다.
    // 그 값이 여기와 어긋나면 풀에 범용 아닌 함정이 섞이거나 빠진다.
    const minTypes = Math.min(...[...new Set(raw.cards.map((c) => c.answer))].map((k) => {
      const t = TRAPS.find((x) => x.key === k)
      return t ? t.types : 0
    }))
    expect(minTypes).toBeGreaterThanOrEqual(UNIVERSAL_MIN_TYPES)
  })

  it('한 함정이 풀을 먹지 않는다', () => {
    const by = new Map<string, number>()
    for (const c of raw.cards) by.set(c.answer, (by.get(c.answer) ?? 0) + 1)
    for (const [k, n] of by) expect(`${k}:${n <= raw.per_trap}`).toBe(`${k}:true`)
  })

  it('문제마다 정답이 보기 안에 있고 보기가 넷이다', () => {
    for (const c of raw.cards) {
      expect(c.options, `${c.id} 보기 수`).toHaveLength(OPTION_COUNT)
      expect(c.options, `${c.id} 에 정답이 없다`).toContain(c.answer)
      expect(new Set(c.options).size, `${c.id} 보기 중복`).toBe(OPTION_COUNT)
    }
  })

  it('정답 자리가 한쪽으로 쏠리지 않는다', () => {
    // 늘 같은 자리면 학습자가 **수법이 아니라 자리를** 외운다.
    const at = [0, 0, 0, 0]
    for (const c of raw.cards) at[c.options.indexOf(c.answer)]! += 1
    const min = Math.min(...at)
    const max = Math.max(...at)
    expect(max / min, `정답 자리 분포가 치우쳤다: ${at.join('/')}`).toBeLessThan(1.6)
  })

  it('해설이 정답 이름을 품고 있지 않다', () => {
    const leaky = raw.cards.filter((c) => leaksAnswer(c.tempting, c.reject, c.answer)).map((c) => c.id)
    expect(leaky, '정답이 그대로 적힌 문제가 있다 — 읽기 검사가 된다').toEqual([])
  })

  it('해설이 판단할 만큼 길다', () => {
    for (const c of raw.cards) {
      expect(c.tempting.length, `${c.id} 끌리는 이유가 짧다`).toBeGreaterThanOrEqual(20)
      expect(c.reject.length, `${c.id} 버리는 법이 짧다`).toBeGreaterThanOrEqual(40)
    }
  })

  it('문항 링크가 실제 슬러그와 맞는다', () => {
    for (const c of raw.cards) expect(c.slug).toBe(c.item_id.replace('#', '-'))
  })
})

describe('세트 뽑기', () => {
  it('여덟을 주고 같은 문항을 두 번 주지 않는다', () => {
    const { cards, pool } = loadTrapDrill('seed-a')
    expect(cards).toHaveLength(DRILL_SIZE)
    expect(new Set(cards.map((c) => c.item_id)).size).toBe(DRILL_SIZE)
    expect(pool).toBe(raw.cards.length)
  })

  it('한 세트가 함정 넷 이상을 묻는다', () => {
    // 이것이 깨지면 훈련이 「아홉 가지를 알아보는 것」이 아니라 「흔한 것을 찍는 것」이 된다.
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const { cards } = loadTrapDrill(seed)
      const kinds = new Set(cards.map((c) => c.answer)).size
      expect(kinds, `씨앗 ${seed} 에서 함정이 ${kinds}종뿐이다`).toBeGreaterThanOrEqual(4)
    }
  })

  it('같은 함정이 한 세트에 셋 이상 나오지 않는다', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const by = new Map<string, number>()
      for (const c of loadTrapDrill(seed).cards) by.set(c.answer, (by.get(c.answer) ?? 0) + 1)
      for (const [k, n] of by) expect(`${seed}/${k}:${n}`).toBe(`${seed}/${k}:${Math.min(n, 2)}`)
    }
  })

  it('같은 씨앗이면 같은 세트 — 새로고침에 문제가 바뀌지 않는다', () => {
    expect(loadTrapDrill('same').cards.map((c) => c.id)).toEqual(loadTrapDrill('same').cards.map((c) => c.id))
  })

  it('씨앗이 다르면 다른 세트 — 「여덟 개 더」가 같은 것을 주지 않는다', () => {
    const a = loadTrapDrill('one').cards.map((c) => c.id)
    const b = loadTrapDrill('two').cards.map((c) => c.id)
    expect(a).not.toEqual(b)
    const overlap = a.filter((id) => b.includes(id)).length
    expect(overlap, '두 세트가 거의 같다').toBeLessThan(DRILL_SIZE / 2)
  })
})
