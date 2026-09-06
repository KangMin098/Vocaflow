// apps/web/src/lib/textbook/__tests__/volume-contents.test.ts
//
// 목차·미리보기 스냅샷 회귀.
//
// 스냅샷은 **사람이 안 보고 지나가기 쉬운 산출물**이다 — 스크립트가 성공하고 파일이
// 커지면 다 된 것처럼 보인다. 실제로 그렇게 두 번 샜다(둘 다 실측 2026-09-06):
//
//   ① `countPassageWords` 에 **문항 객체**를 넘겨 `[object Object]` 를 세는 바람에
//      전 단원 지문이 **2어**로 적혔다. 숫자가 나왔다고 잰 것이 아니다.
//   ② `unit_vocab` 의 선택지가 객체라 화면에 **[object Object]** 가 다섯 줄 찍혔다.
//      스크립트도 화면도 오류를 내지 않았다.
//
// 그래서 여기서 잠근다: **화면에 그대로 인쇄되는 값의 모양**을 본다.

import { describe, expect, it } from 'vitest'

import {
  CONTENTS_GENERATED_AT,
  CONTENTS_UNITS_PER_VOLUME,
  contentsOf,
  contentsProblem,
} from '../volume-contents'
import raw from '../volume-contents.json'

const snapshot = raw as unknown as {
  volumes: Record<string, ReturnType<typeof contentsOf> & object>
  problems: { band: number; error: string }[]
}
const bands = Object.keys(snapshot.volumes).map(Number)

describe('권 목차 스냅샷', () => {
  it('일곱 권이 다 들어 있다', () => {
    expect(bands.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('굽는 시각이 ISO 날짜다 — 낡은 것이 보여야 다시 굽는다', () => {
    expect(CONTENTS_GENERATED_AT).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(Number.isFinite(Date.parse(CONTENTS_GENERATED_AT))).toBe(true)
  })

  it('한 권은 시장 중앙값만큼 단원을 갖는다', () => {
    expect(CONTENTS_UNITS_PER_VOLUME).toBeGreaterThanOrEqual(5)
    for (const b of bands) {
      const c = contentsOf([b])!
      expect(c.units.length, `band ${b}`).toBe(CONTENTS_UNITS_PER_VOLUME)
    }
  })

  it('단원마다 실제 원글 제목이 있다 — 단원 제목을 짓지 않는다', () => {
    for (const b of bands) {
      for (const u of contentsOf([b])!.units) {
        expect(u.passages.length, `band ${b} unit ${u.no}`).toBeGreaterThan(0)
        for (const p of u.passages) expect(typeof p).toBe('string')
      }
    }
  })

  it('지문 길이가 **말이 되는 수**다 — 객체를 세면 2어가 나온다', () => {
    // 실측 사고 재발 방지. 지문이 있는 유형이면 최소 40어는 넘는다(수능 하한 90의 절반 아래는
    // 지문이 아니라 무언가 잘못 센 것이다). 지문이 없는 유형뿐인 단원은 `null` 이다.
    for (const b of bands) {
      for (const u of contentsOf([b])!.units) {
        if (u.words === null) continue
        expect(u.words[0], `band ${b} unit ${u.no} 최소`).toBeGreaterThan(40)
        expect(u.words[1], `band ${b} unit ${u.no} 최대`).toBeGreaterThanOrEqual(u.words[0])
        expect(u.words[1], `band ${b} unit ${u.no} 최대`).toBeLessThan(1000)
      }
    }
  })

  it('미리보기 선택지가 **전부 문자열**이다 — 객체면 [object Object] 가 찍힌다', () => {
    for (const b of bands) {
      const s = contentsOf([b])!.sample
      if (!s) continue
      for (const it of s.items) {
        expect(it.choices.length, `band ${b} 문항 ${it.no}`).toBe(5)
        for (const c of it.choices) {
          expect(typeof c, `band ${b} 문항 ${it.no}`).toBe('string')
          expect(c).not.toContain('[object')
          expect(c.trim().length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('미리보기 정답이 1~5 안에 있다', () => {
    for (const b of bands) {
      const s = contentsOf([b])!.sample
      if (!s) continue
      for (const it of s.items) {
        expect(it.answer, `band ${b} 문항 ${it.no}`).toBeGreaterThanOrEqual(1)
        expect(it.answer, `band ${b} 문항 ${it.no}`).toBeLessThanOrEqual(5)
      }
    }
  })

  it('미리보기 어휘는 낱말과 뜻을 **둘 다** 갖는다', () => {
    for (const b of bands) {
      const s = contentsOf([b])!.sample
      if (!s) continue
      for (const w of s.vocabulary) {
        expect(w.word.trim().length, `band ${b}`).toBeGreaterThan(0)
        expect(w.meaningKo.trim().length, `band ${b}`).toBeGreaterThan(0)
      }
    }
  })

  it('미리보기를 못 내는 권은 **이유가 적혀 있다** — 빈 자리로 두지 않는다', () => {
    for (const b of bands) {
      const c = contentsOf([b])!
      if (c.sample && c.sample.items.length > 0) continue
      expect(contentsProblem([b]), `band ${b}`).toBeTruthy()
    }
  })

  it('없는 밴드를 물으면 빈 목차를 만들어 내지 않는다', () => {
    expect(contentsOf([99])).toBeNull()
    expect(contentsProblem([99])).toBeNull()
  })
})
