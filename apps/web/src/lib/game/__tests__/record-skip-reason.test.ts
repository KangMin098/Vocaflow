// apps/web/src/lib/game/__tests__/record-skip-reason.test.ts
//
// `recordGameResult` 의 **스킵 이유 구별** 계약.
//
// 왜 이 테스트가 있는가:
//   카드를 갱신하지 않는 경로가 셋인데 전부 `{ ok: true, updated: false }` 로 뭉쳐 있었다.
//   셋 중 둘(assisted · cooldown)은 **의도된 FSRS 무결성 가드**이고 하나(not-mine)만 결함인데,
//   구별할 방법이 없어서 팀이 게임별로 각자 우회했다 — morpheme-bank.ts("99.7% silent skip
//   됐다") · morph-bank.ts · due-words.ts · catalog.tsx 가 같은 문제를 따로 적고 따로 대응했다.
//
//   실측 규모: 내 단어 225개 vs 세트 단어 56,079개(628세트) → 겹침 2.1% = **97.9% 가 not-mine**.
//
// 이 테스트가 지키는 것은 두 가지다:
//   ① 세 이유가 실제로 구별된다
//   ② **의도된 가드를 결함으로 세지 않는다** — 이걸 놓치면 정상 동작이 경고로 보고돼
//      고지가 항상 떠 있고(97.9% 가 아니라 100% 처럼 보인다), 결국 무시된다

import { describe, expect, it } from 'vitest'

import type { RecordResult, RecordSkipReason } from '../record-result'

/** 스캐폴드가 세는 규칙 — play-scaffold.tsx 의 track() 과 같은 판정. */
function countsAsCouplingFailure(res: RecordResult): boolean {
  return res.ok && !res.updated && res.reason === 'not-mine'
}

describe('스킵 이유 구별', () => {
  it('세 이유가 타입 수준에서 갈린다', () => {
    const reasons: RecordSkipReason[] = ['not-mine', 'assisted', 'cooldown']
    expect(new Set(reasons).size).toBe(3)
  })

  it('not-mine 만 결합 실패로 센다', () => {
    expect(countsAsCouplingFailure({ ok: true, updated: false, reason: 'not-mine' })).toBe(true)
  })

  it('assisted · cooldown 은 세지 않는다 — 의도된 무결성 가드다', () => {
    expect(
      countsAsCouplingFailure({ ok: true, updated: false, reason: 'assisted' }),
      'assisted 를 결함으로 세면 힌트 사용이 경고로 보고된다',
    ).toBe(false)
    expect(
      countsAsCouplingFailure({ ok: true, updated: false, reason: 'cooldown' }),
      'cooldown 을 결함으로 세면 정상적인 반복 학습이 경고가 된다',
    ).toBe(false)
  })

  it('갱신 성공과 오류는 세지 않는다', () => {
    expect(countsAsCouplingFailure({ ok: true, updated: true })).toBe(false)
    expect(countsAsCouplingFailure({ ok: false, error: 'boom' })).toBe(false)
  })

  it('updated: true 에는 reason 이 붙지 않는다 (성공에 스킵 이유가 있으면 모순이다)', () => {
    const ok: RecordResult = { ok: true, updated: true }
    // @ts-expect-error — 성공 분기에 reason 을 넣는 것은 타입이 막아야 한다
    const bad: RecordResult = { ok: true, updated: true, reason: 'not-mine' }
    expect(ok.ok).toBe(true)
    expect(bad).toBeTruthy()
  })

  it('updated: false 에는 reason 이 반드시 있다 (이유 없는 스킵은 다시 침묵이다)', () => {
    // @ts-expect-error — reason 없는 스킵은 타입이 막아야 한다
    const silent: RecordResult = { ok: true, updated: false }
    expect(silent).toBeTruthy()
  })

  it('세션 집계는 단어 단위로 중복을 제거한다 (같은 단어 재출제가 개수를 부풀리지 않게)', () => {
    // 아케이드는 한 세션에 같은 단어를 여러 번 낸다(ghost-race 는 레이스당 36회 채점).
    // 고지 개수가 "몇 번 넘어갔나" 가 아니라 "몇 단어가 내 것이 아닌가" 여야 한다.
    const seen = new Set<string>()
    for (const w of ['Bribe', 'bribe', 'INHERIT', 'inherit', 'bribe']) {
      const res: RecordResult = { ok: true, updated: false, reason: 'not-mine' }
      if (countsAsCouplingFailure(res)) seen.add(w.toLowerCase())
    }
    expect(seen.size, '대소문자·재출제로 개수가 부풀었다').toBe(2)
  })
})
