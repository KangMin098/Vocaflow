// apps/web/src/lib/library/__tests__/book-cover-ink.test.ts
//
// **표지는 자기 색에서 잉크를 정한다.**
//
// ── 왜 이 테스트가 있나 (실측 2026-08-22) ────────────────────────────────
// `bookCover()` 가 `textTone: 'light'` 를 **무조건** 돌려주고 있었고, 화면은 그 필드를
// **아예 읽지 않은 채** `text-white` 를 박아 뒀다. 옅은 민트 표지의 책 제목이 **1.1:1** 이었다
// (`Introduction to Sociology` · `/wordvault`·`/library`).
// `drop-shadow` 가 읽히게 도와주고 있었지만 **그림자는 WCAG 가 세지 않는다.**

import { describe, expect, it } from 'vitest'

import { bookCover } from '../book-cover'

/** 흰 글자 대비. */
function whiteOnHex(hex: string): number {
  const v =
    hex.length === 4
      ? hex
          .slice(1)
          .split('')
          .map((c) => c + c)
          .join('')
      : hex.slice(1)
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16))
  const f = (x: number) => {
    const t = x / 255
    return t <= 0.03928 ? t / 12.92 : Math.pow((t + 0.055) / 1.055, 2.4)
  }
  const L = 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  return 1.05 / (L + 0.05)
}

/** `hsl(...)` 의 상대 휘도 — 생성 표지는 hsl 로 나온다. */
function lumOfHsl(css: string): number {
  const m = /hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/.exec(css)
  if (!m) throw new Error('hsl 이 아니다: ' + css)
  const h = Number(m[1])
  const s = Number(m[2]) / 100
  const l = Number(m[3]) / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const mm = l - c / 2
  const seg = Math.floor(h / 60) % 6
  const t = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][seg]
  const [r, g, b] = t.map((v) => Math.round((v + mm) * 255))
  const f = (v: number) => {
    const u = v / 255
    return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** 고른 잉크의 실제 대비. 어두운 잉크는 #1A1714(L=0.0087). */
function contrastOfChoice(lighter: number, tone: 'light' | 'dark'): number {
  return tone === 'light' ? 1.05 / (lighter + 0.05) : (lighter + 0.05) / 0.0587
}

describe('DB 표지색 — 밝으면 잉크를 뒤집는다', () => {
  it('옅은 표지에는 흰 글자를 얹지 않는다', () => {
    const cover = bookCover({
      title: 'Introduction to Sociology',
      bookVLevel: null,
      coverFrom: '#EAF8EF',
      coverTo: '#D6EFE1',
    })
    expect(cover.textTone, `흰 글자 대비 ${whiteOnHex('#EAF8EF').toFixed(2)}:1`).toBe('dark')
  })

  it('어두운 표지에는 흰 글자를 유지한다 — 과잉 반전 금지', () => {
    const cover = bookCover({
      title: 'Pride and Prejudice',
      bookVLevel: null,
      coverFrom: '#1D4ED8',
      coverTo: '#0F2540',
    })
    expect(cover.textTone).toBe('light')
    expect(whiteOnHex('#1D4ED8')).toBeGreaterThan(4.5)
  })

  it('두 색 중 **밝은 쪽**으로 판정한다 — 그라디언트 한쪽에서 사라지면 실패다', () => {
    const cover = bookCover({
      title: 'Half And Half',
      bookVLevel: null,
      coverFrom: '#0F2540',
      coverTo: '#F2FBF6',
    })
    expect(cover.textTone).toBe('dark')
  })

  it('경계 부근에서 흰 글자를 고르면 실제로 AA 를 넘는다', () => {
    for (const hex of ['#565656', '#5A5A5A', '#606060', '#6B6B6B']) {
      const cover = bookCover({ title: 't', bookVLevel: null, coverFrom: hex, coverTo: hex })
      if (cover.textTone === 'light') {
        expect(whiteOnHex(hex), `${hex} 를 light 로 골랐다`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})

describe('생성 표지 — HSL 명도는 지각 휘도가 아니다', () => {
  // ⚠️ 이 블록의 첫 판은 "생성 표지는 전부 흰 글자" 를 단언했다가 **실패했다.**
  //    `vLevelLightness` 표(24~52%)는 HSL 명도인데 **같은 명도라도 색상마다 휘도가 다르다** —
  //    파랑 44% 는 어둡고 청록·호박 44% 는 밝다. 실측: 팔레트 8개 중 3개
  //    (hue 189/200 · 38/28 · 160/175)가 40조합 중 **14조합**에서 흰 글자 AA 에 미달한다.
  //    명도 표를 고치는 대신 `inkFor` 가 잉크를 뒤집는다 — 그래서 단언할 것은
  //    "무슨 톤을 골랐나" 가 아니라 **"고른 톤이 실제로 통과하나"** 다.
  it('고른 잉크가 실제로 AA 를 넘는다 (전 V레벨 × 팔레트)', () => {
    for (const v of [null, 1, 2, 4, 6, 8, 11]) {
      for (let i = 0; i < 24; i++) {
        const c = bookCover({ title: `t${i}`, bookVLevel: v })
        const lighter = Math.max(lumOfHsl(c.from), lumOfHsl(c.to))
        expect(
          contrastOfChoice(lighter, c.textTone),
          `V${v} t${i} ${c.textTone} — ${c.from}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('생성 표지는 **전부** 흰 글자가 안전하다 — 잉크를 뒤집을 일이 없다', () => {
    // `darkenUntilSafe` 가 들어온 뒤로는 생성 쪽에서 dark 가 나오면 안 된다.
    // (뒤집기 판정 자체가 죽지 않았다는 것은 아래 DB 표지 테스트가 지킨다.)
    const tones = new Set(
      Array.from({ length: 40 }, (_, i) => bookCover({ title: `t${i}`, bookVLevel: 2 }).textTone),
    )
    expect([...tones]).toEqual(['light'])
  })

  it('밝은 색상은 실제로 어두워진다 — 명도 표를 그대로 쓰지 않는다', () => {
    // 청록·호박 계열은 표의 명도(예: V1-2 = 52%)로는 흰 글자가 안 되므로 내려가야 한다.
    const lowered = Array.from({ length: 40 }, (_, i) =>
      bookCover({ title: `t${i}`, bookVLevel: 2 }),
    ).filter((c) => {
      const m = /hsl\(\s*[\d.]+\s+[\d.]+%\s+([\d.]+)%/.exec(c.from)
      return m && Number(m[1]) < 52
    })
    expect(lowered.length, '표의 명도가 한 번도 안 내려갔다 — 보정이 죽어 있다').toBeGreaterThan(0)
  })
})
