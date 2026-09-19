// scripts/textbook/__tests__/with-retry.test.mjs
//
// **`withRetry` 가 무엇을 「다시 해 볼 만한 실패」로 보는가.**
//
// ── 왜 이 검사가 있는가 ───────────────────────────────────────────────
// 이 함수의 값어치는 재시도가 아니라 **페이지를 반으로 줄이는 것**이다. 큰 본문을 1,000행씩
// 받다가 끊기면 몇 번을 다시 물어도 같은 크기라 또 끊긴다 — 줄여야 통과한다.
//
// 그런데 「일시적인가」를 message 문자열로 판정하다 보니, 판정 목록에 없는 모양으로 끊기면
// **한 번도 안 줄이고 즉시 죽는다.** 이 저장소는 그 사고를 두 번 겪었다:
//
//   ① 2026-08-31 — 게이트웨이가 오류를 **HTML 페이지**로 돌려줘 message 가 `<!DOCTYPE html>…`
//      이었다. 낱말 목록에 안 걸려 재시도 없이 배치가 끝났다.
//   ② 2026-09-07 — 응답이 중간에 끊겨 message 가 `Unterminated string in JSON at position
//      14602775` 였다. 역시 안 걸려 즉시 죽었고, 그 바람에 **plos 발췌 11,601편이 통째로
//      분석 대기에 갇혀 있었다.** 큐가 비어서가 아니라 큐를 **읽지 못해서**였다.
//
// 둘 다 원인은 「응답이 너무 커서」이고 처방은 같다. 그래서 세 갈래를 여기서 잠근다.

import { describe, expect, it } from 'vitest'

import { withRetry } from '../volume-pool.mjs'

/** 부른 페이지 크기를 기록하면서 지정한 횟수만큼 실패하는 가짜 질의. */
function failing(message, failTimes) {
  const sizes = []
  let n = 0
  const run = async (size) => {
    sizes.push(size)
    n += 1
    if (n <= failTimes) return { data: null, error: { message } }
    return { data: [{ ok: true }], error: null }
  }
  return { run, sizes }
}

describe('withRetry — 무엇을 다시 해 볼 만한 실패로 보는가', () => {
  it('잘린 JSON 이면 페이지를 반으로 줄여 다시 묻는다 (2026-09-07 사고)', async () => {
    const { run, sizes } = failing('Unterminated string in JSON at position 14602775', 2)
    const res = await withRetry('페이지', run, 4, 1000)
    expect(res.data).toEqual([{ ok: true }])
    // 1000 → 500 → 250. 줄이지 않으면 같은 크기로만 다시 묻는다.
    expect(sizes).toEqual([1000, 500, 250])
    expect(res.page).toBe(250)
  })

  it('HTML 오류 페이지도 같은 갈래다 (2026-08-31 사고)', async () => {
    const { run, sizes } = failing('<!DOCTYPE html><html>error code: 524</html>', 1)
    const res = await withRetry('페이지', run, 4, 1000)
    expect(res.data).toEqual([{ ok: true }])
    expect(sizes).toEqual([1000, 500])
  })

  it('statement timeout 도 줄여서 다시 묻는다', async () => {
    const { run, sizes } = failing('canceling statement due to statement timeout', 1)
    await withRetry('페이지', run, 4, 1000)
    expect(sizes).toEqual([1000, 500])
  })

  // ⚠️ 여기가 반대쪽 가드다. 무엇이든 재시도하면 **진짜 잘못된 질의를 계속 두들긴다** —
  //   컬럼 이름을 틀렸는데 네 번 물어보는 것은 고쳐야 할 것을 늦게 알려 줄 뿐이다.
  it('일시적이지 않은 오류는 곧바로 던진다 — 없는 컬럼 같은 것', async () => {
    const { run, sizes } = failing('column library_articles.nope does not exist', 99)
    await expect(withRetry('페이지', run, 4, 1000)).rejects.toThrow('페이지 조회 실패')
    expect(sizes).toEqual([1000])
  })

  it('줄여도 계속 실패하면 던지되 하한 아래로는 안 내려간다', async () => {
    const { run, sizes } = failing('Unterminated string in JSON at position 1', 99)
    await expect(withRetry('페이지', run, 4, 100, 50)).rejects.toThrow('페이지 조회 실패')
    // 시도는 tries 만큼 넷: 100 → 50 → 50 → 50. **하한 아래로 안 내려간다** —
    // 0 으로 수렴하면 영영 아무것도 못 받는다.
    expect(sizes).toEqual([100, 50, 50, 50])
    // 재시도 대기가 1s → 3s → 9s 라 기본 제한(5s)을 넘는다. 기다림 자체가 이 함수의 일부다.
  }, 20_000)
})
