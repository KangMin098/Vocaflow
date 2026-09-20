// apps/web/src/app/dev/replica/__tests__/ours-copy.test.ts
//
// 복제 시트의 **문구 치환**(DD-62 Stage 3 ④)이 지키는 두 가지를 고정한다.
//
//   ① 숫자는 실측으로만 — 마커 `{headwords}` 는 DB 값으로만 채워진다.
//   ② 못 읽으면 **버린다** — 상수로 때우지 않는다(AGENTS.md I5 · `no-hardcoded-stats` 와 같은 규칙).
//
// 왜 회귀가 필요했나: 2026-09-20 실측에서 개발 서버의 `fetchPlatformFacts()` 가 `null` 을 돌려주는 바람에
// 숫자 문장이 **전부 빠진 채** 시트가 나왔다. 그게 설계대로인지(버리는 게 맞다) 아니면 치환이 아예
// 안 도는지는 화면만 봐서는 구별되지 않는다 — 두 갈래를 여기서 각각 고정한다.

import { describe, expect, it } from 'vitest'

import { planCopy, resolveMarkers } from '../ours'
import type { Facts } from '../ours'

const FACTS: Facts = {
  headwords: 49_244,
  meaningKoPct: 100,
  bookVocabLinks: 1_678_399,
  csatOrderInsert: 12_345,
}

const slot = (key: string, fontSize: string, textLen: number, role = 'text') => ({ key, role, textLen, fontSize })

describe('실측 마커', () => {
  it('마커가 없는 문장은 그대로 지나간다', () => {
    expect(resolveMarkers('로그인 없이 먼저 재 보세요.', null)).toBe('로그인 없이 먼저 재 보세요.')
  })

  it('실측치가 있으면 자릿수 구분 기호까지 넣어 채운다', () => {
    expect(resolveMarkers('표제어 {headwords}개', FACTS)).toBe('표제어 49,244개')
    expect(resolveMarkers('도서–어휘 연결 {bookVocabLinks}행', FACTS)).toBe('도서–어휘 연결 1,678,399행')
  })

  it('퍼센트는 자릿수 구분 기호를 붙이지 않는다', () => {
    expect(resolveMarkers('한국어 뜻 {meaningKoPct}%', FACTS)).toBe('한국어 뜻 100%')
  })

  it('실측치를 못 읽으면 문장을 **버린다** — 0 이나 상수로 때우지 않는다', () => {
    expect(resolveMarkers('표제어 {headwords}개', null)).toBeNull()
  })

  it('모르는 마커가 하나라도 있으면 문장 전체를 버린다', () => {
    expect(resolveMarkers('알 수 없는 {nope} 값', FACTS)).toBeNull()
  })

  it('연속 호출에서 정규식 상태가 새지 않는다(전역 플래그 lastIndex)', () => {
    const s = '표제어 {headwords}개'
    expect(resolveMarkers(s, FACTS)).toBe('표제어 49,244개')
    expect(resolveMarkers(s, FACTS)).toBe('표제어 49,244개')
    expect(resolveMarkers('마커 없음', FACTS)).toBe('마커 없음')
    expect(resolveMarkers(s, FACTS)).toBe('표제어 49,244개')
  })
})

describe('문구 배정', () => {
  const slots = Array.from({ length: 24 }, (_, i) => slot(`B0:${i}`, '16px', 120))

  it('실측치가 있으면 숫자가 든 문장이 자리에 들어간다', () => {
    const plan = planCopy(slots, FACTS)
    const all = [...plan.values()].join('\n')
    expect(all).toContain('49,244')
  })

  it('실측치가 없으면 숫자가 든 문장이 한 줄도 나오지 않는다', () => {
    const plan = planCopy(slots, null)
    const all = [...plan.values()].join('\n')
    expect(all).not.toMatch(/\{\w+\}/) // 미치환 마커가 화면에 나가면 안 된다
    expect(all).not.toMatch(/\d{1,3}(,\d{3})+/) // 지어낸 숫자도 안 된다
    expect(all.length).toBeGreaterThan(0) // 그렇다고 자리를 비우지는 않는다
  })

  it('글자 크기가 위계를 정한다 — 가장 큰 자리에 표제가 간다', () => {
    const mixed = [slot('B0:0', '64px', 40), slot('B0:1', '16px', 120)]
    const plan = planCopy(mixed, FACTS)
    expect(plan.get('B0:0')).toBe('내가 아는 비율로 읽기를 설계합니다')
    expect(plan.get('B0:1')).not.toBe(plan.get('B0:0'))
  })

  it('반복을 줄인다 — 섹션 제목 자리 8곳이 모두 다른 말을 한다', () => {
    const heads = Array.from({ length: 8 }, (_, i) => slot(`B1:${i}`, '32px', 20, 'h2'))
    const plan = planCopy([slot('B0:0', '64px', 40), ...heads], FACTS)
    const titles = heads.map((h) => plan.get(h.key))
    expect(new Set(titles).size).toBe(heads.length)
  })
})
