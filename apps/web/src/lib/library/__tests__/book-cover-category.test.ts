// apps/web/src/lib/library/__tests__/book-cover-category.test.ts
//
// **표지 색이 어떤 단어장인지를 말한다** — 유형마다 고정 색상.
//
// ── 왜 (실측 2026-09-01) ────────────────────────────────────────────────
// 그전까지 표지 색은 `titleHash % 팔레트 8` 이었다. 서로 다르긴 했지만 **유형과 무관**해서
// 같은 '수능·내신' 두 권이 다른 색이 되고 '유아' 와 '공무원' 이 같은 색이 될 수 있었다 —
// 즉 **카테고리 예측 가능성 0%**. 색이 매대에서 아무것도 말하지 않았다.
//
// 교재 표지(`textbook/cover.ts` RUNG_INK)와 같은 원리다: **색상 = 유형 · 명도 = 수준.**
// 명도는 `vLevelLightness` 가 이미 하고 있었으므로 색상만 유형에 묶었다.
//
// 이 파일이 지키는 것은 세 가지뿐이다 — 취향이 아니라 깨지면 매대가 무너지는 것:
//   ① 모든 유형에 색이 있다   ② 어느 두 유형도 눈으로 갈린다   ③ 흰 글자가 산다

import { describe, expect, it } from 'vitest'

import { VOCAB_CATEGORIES } from '@/components/library/vocab/categories'
import { bookCover, categoryIdentity } from '../book-cover'

/** `'all'` 은 필터용 가짜 유형이다 — 세트가 이 값을 갖는 일은 없다. */
const REAL_CATEGORIES = VOCAB_CATEGORIES.filter((c) => c.id !== 'all').map((c) => c.id)

/** `hsl(H S% L%)` → RGB. `bookCover` 가 돌려주는 형식이 이것뿐이라 이것만 읽는다. */
function parseHsl(css: string): [number, number, number] {
  const m = /^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/.exec(css.trim())
  if (!m) throw new Error(`hsl 이 아니다: ${css}`)
  const [h, s, l] = [Number(m[1]) % 360, Number(m[2]) / 100, Number(m[3]) / 100]
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const mm = l - c / 2
  const seg = Math.floor(h / 60) % 6
  const base = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][seg]!
  return base.map((v) => Math.round((v + mm) * 255)) as [number, number, number]
}

function whiteContrast(css: string): number {
  const f = (v: number) => {
    const t = v / 255
    return t <= 0.03928 ? t / 12.92 : Math.pow((t + 0.055) / 1.055, 2.4)
  }
  const [r, g, b] = parseHsl(css)
  const L = 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  return 1.05 / (L + 0.05)
}

function distance(a: string, b: string): number {
  const [x, y] = [parseHsl(a), parseHsl(b)]
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}

/** 유형만 다르고 나머지는 같은 조건 — 색 차이가 오직 유형에서 왔음을 보장한다. */
function coverOf(category: string) {
  return bookCover({ title: '같은 제목', bookVLevel: 6, category })
}

describe('유형 색상 — 표지가 갈래를 말한다', () => {
  it('모든 유형에 색이 있다 — 하나라도 빠지면 그 갈래만 제목 해시로 떨어져 뒤섞인다', () => {
    const missing = REAL_CATEGORIES.filter((id) => {
      const mine = coverOf(id).from
      // 유형표에 없으면 제목 해시로 떨어지므로, 제목이 같은 다른 유형과 색이 같아진다.
      return REAL_CATEGORIES.some((other) => other !== id && coverOf(other).from === mine)
    })
    expect(missing, `유형 색이 없는(혹은 겹치는) 갈래: ${missing.join(', ')}`).toEqual([])
  })

  it('**어느 두 유형도 눈으로 갈린다** — RGB 거리 30 이상', () => {
    const close: string[] = []
    for (let i = 0; i < REAL_CATEGORIES.length; i += 1) {
      for (let j = i + 1; j < REAL_CATEGORIES.length; j += 1) {
        const [a, b] = [REAL_CATEGORIES[i]!, REAL_CATEGORIES[j]!]
        const d = distance(coverOf(a).from, coverOf(b).from)
        if (d < 30) close.push(`${a}↔${b} ${d.toFixed(1)}`)
      }
    }
    expect(close, `너무 가까운 짝:\n  ${close.join('\n  ')}`).toEqual([])
  })

  it('모든 유형이 흰 글자 AA(4.5) 를 넘는다 — 색을 고르다 읽기를 잃지 않는다', () => {
    const weak = REAL_CATEGORIES.flatMap((id) => {
      const { from, to } = coverOf(id)
      return [from, to]
        .map((c) => ({ id, c, r: whiteContrast(c) }))
        .filter((x) => x.r < 4.5)
    })
    expect(weak.map((x) => `${x.id} ${x.c} ${x.r.toFixed(2)}`), '흰 글자 대비 미달').toEqual([])
  })

  it('같은 유형이면 제목이 달라도 같은 색이다 — 같은 갈래는 매대에서 묶여 읽힌다', () => {
    const a = bookCover({ title: '수능 필수 1', bookVLevel: 6, category: 'csat' })
    const b = bookCover({ title: '완전히 다른 제목', bookVLevel: 6, category: 'csat' })
    expect(a.from).toBe(b.from)
    expect(a.to).toBe(b.to)
  })

  it('같은 유형 안에서 수준이 다르면 명도가 다르다 — 색상=유형 · 명도=수준', () => {
    const easy = bookCover({ title: 'x', bookVLevel: 1, category: 'csat' })
    const hard = bookCover({ title: 'x', bookVLevel: 10, category: 'csat' })
    expect(easy.from).not.toBe(hard.from)
  })

  it('모르는 유형은 한 색으로 몰리지 않는다 — 종전대로 제목 해시로 떨어진다', () => {
    const a = bookCover({ title: '가나다', bookVLevel: 6, category: 'not_a_category' })
    const b = bookCover({ title: 'zzzz', bookVLevel: 6, category: 'not_a_category' })
    expect(a.from).not.toBe(b.from)
  })

  it('DB 가 준 표지색은 유형이 덮지 않는다 — 사람이 고른 색이 이긴다', () => {
    const c = bookCover({
      title: 'x',
      bookVLevel: 6,
      category: 'csat',
      coverFrom: '#123456',
      coverTo: '#654321',
    })
    expect(c.from).toBe('#123456')
  })
})

// ── 칩·상세 시트가 표지와 같은 색을 쓰는가 ────────────────────────────────
//
// 실측 2026-09-01: 유형 색 표가 **두 개**였다. `VocabSetCarousel` 의 지역 표는 수능·내신을
// 호박색으로, 표지는 인디고로 그리고 있었고, 그 표에는 `preschool` 이 아예 없어 유아
// 단어장이 조용히 테마 색으로 떨어졌다. 표를 합친 뒤 다시 갈라지지 않게 여기서 잠근다.
describe('categoryIdentity — 칩과 표지가 한 색을 쓴다', () => {
  it('모든 유형에 정체성이 있다 — 빠지면 그 갈래만 중립 회색이 된다', () => {
    const missing = REAL_CATEGORIES.filter((id) => categoryIdentity(id) === null)
    expect(missing, `정체성이 없는 갈래: ${missing.join(', ')}`).toEqual([])
  })

  it('모르는 유형은 **다른 유형의 색을 빌리지 않는다** — `null` 이다', () => {
    // 빌려주면 화면은 멀쩡해 보이고 표만 틀린다 — 빠진 줄 알 방법이 없어진다.
    expect(categoryIdentity('not_a_category')).toBeNull()
    expect(categoryIdentity(null)).toBeNull()
  })

  it('칩 색이 표지 색과 같은 계열이다 — 두 표가 다시 갈라지면 여기서 걸린다', () => {
    for (const id of REAL_CATEGORIES) {
      const ident = categoryIdentity(id)!
      // 정체성의 그라디언트가 표지가 실제로 쓰는 값과 같아야 한다.
      expect(ident.from, id).toBe(coverOf(id).from)
    }
  })

  it('활성 칩(흰 글자)이 전부 AA 를 넘는다', () => {
    const weak = REAL_CATEGORIES
      .map((id) => ({ id, r: whiteContrast(categoryIdentity(id)!.accent) }))
      .filter((x) => x.r < 4.5)
    expect(weak.map((x) => `${x.id} ${x.r.toFixed(2)}`)).toEqual([])
  })

  it('비활성 칩(옅은 바탕 위 글자)이 전부 AA 를 넘는다 — `accent` 를 쓰면 여기서 넷이 깨진다', () => {
    const weak = REAL_CATEGORIES
      .map((id) => {
        const { ink, tint } = categoryIdentity(id)!
        const [lo, hi] = [ink, tint].map((c) => {
          const [r, g, b] = parseHsl(c)
          const f = (v: number) => {
            const t = v / 255
            return t <= 0.03928 ? t / 12.92 : Math.pow((t + 0.055) / 1.055, 2.4)
          }
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
        })
        return { id, r: (Math.max(lo, hi) + 0.05) / (Math.min(lo, hi) + 0.05) }
      })
      .filter((x) => x.r < 4.5)
    expect(weak.map((x) => `${x.id} ${x.r.toFixed(2)}`), '옅은 바탕 위 글자 대비 미달').toEqual([])
  })

  it('**칩 글자색이 서로 갈린다** — RGB 거리 30 이상 (정체성을 지는 것은 바탕이 아니라 글자다)', () => {
    const close: string[] = []
    for (let i = 0; i < REAL_CATEGORIES.length; i += 1) {
      for (let j = i + 1; j < REAL_CATEGORIES.length; j += 1) {
        const [a, b] = [REAL_CATEGORIES[i]!, REAL_CATEGORIES[j]!]
        const d = distance(categoryIdentity(a)!.ink, categoryIdentity(b)!.ink)
        if (d < 30) close.push(`${a}↔${b} ${d.toFixed(1)}`)
      }
    }
    expect(close, `너무 가까운 짝:\n  ${close.join('\n  ')}`).toEqual([])
  })
})
