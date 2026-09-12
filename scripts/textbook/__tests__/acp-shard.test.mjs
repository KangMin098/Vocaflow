// scripts/textbook/__tests__/acp-shard.test.mjs
//
// **`process-queue.mjs --shard i/n` — 여러 갈래로 돌려도 같은 글을 두 번 처리하지 않는가.**
//
// ── 왜 이 검사가 있는가 ───────────────────────────────────────────────
// 분석 큐를 한 줄기로 돌리면 느리고, 여러 개 띄우면 **같은 글을 여럿이 처리한다** — 이 스크립트는
// `status='queued'` 를 앞에서부터 `--limit` 만큼 집을 뿐 집었다는 표시를 먼저 하지 않기 때문이다.
// `--shard` 는 DB 를 건드리지 않고 그 겹침을 없애는 장치다.
//
// 여기서 틀리면 **화면에도 로그에도 아무것도 안 뜬다.** 겹치면 같은 글에 어휘 추출을 두 번 해
// 비용만 쓰고(결과는 같아 보인다), 빠지면 그 글은 아무 샤드도 안 집어 **영영 `queued` 로 남는다.**
// 큐가 11,601편이라 사람이 눈으로 셀 수도 없다. 그래서 세 가지를 못으로 박는다:
//   ① 합집합 = 원본 (빠짐 0)  ② 교집합 = 공집합 (겹침 0)  ③ **큐가 줄어도 소속이 안 바뀐다**
//
// ③ 이 핵심이다. 큐는 처리될수록 줄어드는데, 목록에서의 위치(index)로 나누면 다른 샤드가
// 앞머리를 `ready` 로 바꾸는 순간 남은 행이 통째로 밀려 조각이 통째로 흔들린다.
// 그래서 나누는 기준을 **행에 박힌 `id`** 로 뒀다 — 이 검사가 그 선택을 지킨다.
//
// 실행: cd apps/web && npx vitest run ../../scripts/textbook/__tests__ --root ../..

import { describe, expect, it } from 'vitest'

import { applyShard, parseShardArg, shardIndexOf } from '../../acp/process-queue.mjs'

/**
 * 결정론적 UUID 꼴 행 만들기 — 매 실행 같은 값이라야 실패를 재현할 수 있다.
 * (실제 큐 행과 같은 모양: 8-4-4-4-12 16진수.)
 */
function rows(n) {
  const out = []
  let x = 0x9e3779b9
  for (let i = 0; i < n; i += 1) {
    // xorshift — 라이브러리 없이 고르게 퍼지는 값을 만든다.
    x ^= x << 13
    x >>>= 0
    x ^= x >> 17
    x ^= x << 5
    x >>>= 0
    const h = x.toString(16).padStart(8, '0')
    out.push({ id: `${h}-1a2b-4c3d-8e9f-${h}${h.slice(0, 4)}`, title: `article ${i}` })
  }
  return out
}

const ids = (list) => list.map((r) => r.id)

describe('applyShard — 합치면 전체, 겹치면 0', () => {
  it('4조각의 합집합이 원본과 정확히 같다 (빠짐 0)', () => {
    const all = rows(500)
    const union = []
    for (let i = 0; i < 4; i += 1) union.push(...ids(applyShard(all, { index: i, count: 4 })))
    expect(union.slice().sort()).toEqual(ids(all).slice().sort())
    expect(union).toHaveLength(all.length)
  })

  it('조각끼리 교집합이 없다 (겹침 0)', () => {
    const all = rows(500)
    const seen = new Set()
    for (let i = 0; i < 4; i += 1) {
      for (const id of ids(applyShard(all, { index: i, count: 4 }))) {
        expect(seen.has(id)).toBe(false)
        seen.add(id)
      }
    }
    expect(seen.size).toBe(all.length)
  })

  it('조각 수가 1·3·7·16 이어도 같다 (n 이 2의 거듭제곱이 아닐 때가 위험하다)', () => {
    const all = rows(300)
    for (const count of [1, 3, 7, 16]) {
      const seen = new Set()
      for (let i = 0; i < count; i += 1) {
        for (const id of ids(applyShard(all, { index: i, count }))) {
          expect(seen.has(id)).toBe(false)
          seen.add(id)
        }
      }
      expect(seen.size).toBe(all.length)
    }
  })

  it('한 조각에 몰리지 않는다 — 몰리면 여러 개를 띄운 의미가 없다', () => {
    const all = rows(4000)
    const sizes = [0, 1, 2, 3].map((i) => applyShard(all, { index: i, count: 4 }).length)
    // 균등이면 1,000. 넉넉히 잡아도 절반~1.5배 안에는 들어야 한다.
    for (const s of sizes) expect(s).toBeGreaterThan(500)
    for (const s of sizes) expect(s).toBeLessThan(1500)
  })
})

// ─── 여기가 핵심 회귀 ────────────────────────────────────────────────
describe('큐가 줄어도 소속 조각이 안 바뀐다 (index 로 나누면 여기서 깨진다)', () => {
  it('다른 샤드가 절반을 처리해 큐에서 사라져도 남은 행의 소속이 그대로다', () => {
    const all = rows(600)
    const before = new Map(all.map((r) => [r.id, shardIndexOf(r.id, 4)]))

    // 다른 샤드들이 일하는 동안 큐는 이렇게 줄어든다 — 앞머리부터, 그리고 군데군데.
    const shrunk = all.filter((_, i) => i % 2 === 0).slice(30)
    expect(shrunk.length).toBeLessThan(all.length)

    for (const r of shrunk) expect(shardIndexOf(r.id, 4)).toBe(before.get(r.id))

    // 줄어든 큐에서도 여전히 안 겹치고, 합치면 남은 전체가 된다.
    const union = []
    for (let i = 0; i < 4; i += 1) union.push(...ids(applyShard(shrunk, { index: i, count: 4 })))
    expect(union.slice().sort()).toEqual(ids(shrunk).slice().sort())
  })

  it('순서가 뒤집혀 읽혀도 같은 답이다 — 정렬은 소속에 관여하지 않는다', () => {
    const all = rows(200)
    const forward = ids(applyShard(all, { index: 2, count: 5 })).sort()
    const backward = ids(applyShard(all.slice().reverse(), { index: 2, count: 5 })).sort()
    expect(backward).toEqual(forward)
  })

  it('`--source`·`--feed`·`--narrative` 로 좁혀도 소속이 안 바뀐다', () => {
    const all = rows(400).map((r, i) => ({ ...r, source: i % 3 === 0 ? 'plos' : 'gutenberg' }))
    const narrowed = all.filter((r) => r.source === 'plos')
    const fromWhole = new Set(
      ids(applyShard(all, { index: 1, count: 4 })).filter((id) =>
        narrowed.some((r) => r.id === id),
      ),
    )
    const fromNarrowed = new Set(ids(applyShard(narrowed, { index: 1, count: 4 })))
    expect(fromNarrowed).toEqual(fromWhole)
  })
})

describe('shardIndexOf — 언제나 0..n-1 안에 든다', () => {
  it('UUID 가 아닌 id 도 결정론적으로 한 조각에 들어간다', () => {
    for (const id of ['', 'zzz', '12345', null, undefined, 'GGGG-HHHH']) {
      const a = shardIndexOf(id, 4)
      const b = shardIndexOf(id, 4)
      expect(a).toBe(b)
      expect(a).toBeGreaterThanOrEqual(0)
      expect(a).toBeLessThan(4)
    }
  })

  it('n=1 이면 전부 0 번 조각이다', () => {
    for (const r of rows(50)) expect(shardIndexOf(r.id, 1)).toBe(0)
  })
})

describe('parseShardArg — 인자가 없으면 지금까지와 완전히 같다', () => {
  it('`--shard` 가 없으면 null 이고, applyShard 는 목록을 그대로 돌려준다', () => {
    const argv = ['node', 'process-queue.mjs', '--source', 'plos', '--commit', '--limit', '200']
    expect(parseShardArg(argv)).toBeNull()

    const all = rows(120)
    const out = applyShard(all, parseShardArg(argv))
    expect(out).toBe(all) // 사본조차 만들지 않는다 — 손대지 않았다는 뜻이다.
  })

  it('`--shard 0/4` 를 읽는다', () => {
    expect(parseShardArg(['node', 'x.mjs', '--shard', '0/4'])).toEqual({ index: 0, count: 4 })
    expect(parseShardArg(['node', 'x.mjs', '--shard', '3/4', '--commit'])).toEqual({
      index: 3,
      count: 4,
    })
  })

  // ⚠️ 반대쪽 가드 — 잘못 적었을 때 조용히 전량으로 되돌아가면, 네 갈래를 띄운 사람이
  //   전량 처리 네 개를 띄운 것이 된다. 겹침을 막으려던 것이 정반대로 동작한다.
  it('꼴이 틀리거나 범위를 벗어나면 죽는다 — 전량으로 되돌아가지 않는다', () => {
    expect(() => parseShardArg(['node', 'x.mjs', '--shard'])).toThrow(/i\/n/)
    expect(() => parseShardArg(['node', 'x.mjs', '--shard', '4'])).toThrow(/i\/n/)
    expect(() => parseShardArg(['node', 'x.mjs', '--shard', 'a/b'])).toThrow(/i\/n/)
    expect(() => parseShardArg(['node', 'x.mjs', '--shard', '0/0'])).toThrow(/1 이상/)
    expect(() => parseShardArg(['node', 'x.mjs', '--shard', '4/4'])).toThrow(/0 부터/)
    expect(() => parseShardArg(['node', 'x.mjs', '--shard', '9/4'])).toThrow(/0 부터/)
  })
})
