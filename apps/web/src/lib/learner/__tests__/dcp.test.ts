// apps/web/src/lib/learner/__tests__/dcp.test.ts
//
// DCP 순수 로직 검증 — correctOrderFromKey(정답 순서 복원) + ERROR_CAUSES 무결성
// + 「오늘 이미 푼 문항 빼기」 규칙(remainingAfterAttempts · utcDayStartIso).
// correctOrderFromKey 는 grade_dcp_item order 채점의 역산 — DB 실측 문항으로 대조.

import { describe, expect, it } from 'vitest'

import { correctOrderFromKey, ERROR_CAUSES, remainingAfterAttempts, utcDayStartIso } from '../dcp'

describe('correctOrderFromKey', () => {
  it('DB 실측 문항(source_order=[1,3,4,2,0]) → 정답 배열 [4,0,3,1,2]', () => {
    // grade_dcp_item standalone 검증에서 {order:[4,0,3,1,2]} = 정답으로 확인됨.
    expect(correctOrderFromKey([1, 3, 4, 2, 0])).toEqual([4, 0, 3, 1, 2])
  })

  it('항등 순서(source_order=[0,1,2]) → [0,1,2]', () => {
    expect(correctOrderFromKey([0, 1, 2])).toEqual([0, 1, 2])
  })

  it('역순(source_order=[2,1,0]) → [2,1,0]', () => {
    expect(correctOrderFromKey([2, 1, 0])).toEqual([2, 1, 0])
  })
})

describe('ERROR_CAUSES', () => {
  it('DB CHECK 5원인과 정확히 일치', () => {
    expect(ERROR_CAUSES.map((e) => e.cause)).toEqual(['vocab', 'parsing', 'structure', 'inference', 'timing'])
  })

  it('vocab 만 존재 라우트 링크(허위 링크 금지)', () => {
    const vocab = ERROR_CAUSES.find((e) => e.cause === 'vocab')
    expect(vocab?.href).toBe('/flashcard/play')
    // 나머지는 tip 만 (dead link 방지)
    for (const c of ERROR_CAUSES.filter((e) => e.cause !== 'vocab')) {
      expect(c.href).toBeNull()
      expect(c.tip.length).toBeGreaterThan(0)
    }
  })
})

// ────────────────────────────────────────────────────────────
// 오늘 이미 푼 문항 빼기
//
// `prescribe_today` 는 `ORDER BY md5(id || current_date)` 로 5문항을 고정하고 **시도를 보지
// 않는다**(본문 실측 2026-09-06). 그래서 다 풀고 돌아오면 같은 5문항이 1번부터 다시 나왔다.
// RPC 를 못 고치는 동안 앱이 그 몫을 지고, 그 판정 규칙을 여기서 잠근다.
// ────────────────────────────────────────────────────────────
describe('remainingAfterAttempts', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('시도가 없으면 그대로 다 남는다', () => {
    expect(remainingAfterAttempts(items, [])).toEqual(items)
  })

  it('이미 푼 문항만 빠진다 — 남은 것의 순서는 처방 순서 그대로', () => {
    expect(remainingAfterAttempts(items, ['b'])).toEqual([{ id: 'a' }, { id: 'c' }])
  })

  it('다 풀었으면 빈 목록 — 화면은 이것을 「오늘 몫을 다 했어요」로 읽는다', () => {
    expect(remainingAfterAttempts(items, ['c', 'a', 'b'])).toEqual([])
  })

  it('null dcp_item_id 는 무시한다 — 같은 표에 챕터 퀴즈 시도도 들어온다', () => {
    // csat_item_attempts.dcp_item_id 는 nullable 이다(실측). null 을 Set 에 그대로 넣으면
    // 아무것도 안 지우지만, 규칙으로 못 박아 두지 않으면 다음 사람이 `!` 를 붙인다.
    expect(remainingAfterAttempts(items, [null, 'a', null])).toEqual([{ id: 'b' }, { id: 'c' }])
  })

  it('처방에 없는 시도는 아무 영향이 없다', () => {
    expect(remainingAfterAttempts(items, ['zzz'])).toEqual(items)
  })
})

describe('utcDayStartIso', () => {
  it('UTC 자정으로 내린다 — RPC 의 current_date 와 같은 경계', () => {
    expect(utcDayStartIso(Date.UTC(2026, 8, 6, 13, 42, 7, 500))).toBe('2026-09-06T00:00:00.000Z')
  })

  it('KST 경계가 아니다 — 00:30 KST(= 전날 15:30 UTC)는 아직 전날로 센다', () => {
    // KST 자정으로 끊으면 09:00 KST 이전에는 처방(어제 시드)과 시도 창(오늘)이 어긋나
    // 방금 푼 문항이 다시 나온다. 그 함정을 숫자로 못 박는다.
    expect(utcDayStartIso(Date.UTC(2026, 8, 5, 15, 30))).toBe('2026-09-05T00:00:00.000Z')
  })

  it('UTC 자정 정각은 그날로 센다', () => {
    expect(utcDayStartIso(Date.UTC(2026, 8, 6, 0, 0, 0))).toBe('2026-09-06T00:00:00.000Z')
  })
})
