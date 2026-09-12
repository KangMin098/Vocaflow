// packages/library-pipeline/src/textbook/cover.test.ts
//
// 표지의 **잴 수 있는 계약**을 못 박는다. 모양 취향이 아니라, 깨지면 매대가 무너지는 것만.
//
// ── 왜 (2026-09-01 실측) ────────────────────────────────────────────
// 표지를 만들고도 **일곱 권이 한 권처럼 보였다.** 평균색이 전부 같은 베이지였고
// (#E9E3DA~#ECE6DD), 표지 식별률이 **1종 / 7권 = 14%** 였다. 같은 자로 잰 시중은
// NE능률 100%(10/10) · 다락원 92%(23/25) 다.
//
// 원인은 색이 없어서가 아니라 **면적이 없어서**였다 — 계단 색이 책등(폭 3.5%)과 숫자에만
// 있었다. 그래서 아래 42% 를 색면으로 채웠다. 이 테스트는 그 둘(색이 다르다 · 대비가 산다)을
// 지킨다.

import { describe, expect, it } from 'vitest'

import { COVER_RATIO, RUNG_INK, coverSpecOf, coverSvg, rungInk, volumeMark } from './cover'
import { SERIES_SPINE } from './series'

/** WCAG 상대휘도 — 표지 색이 종이 위에서 읽히는지 보는 데만 쓴다. */
function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = ch.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!
}
function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)]
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}
function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}
function distance(a: string, b: string): number {
  const [x, y] = [rgb(a), rgb(b)]
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}

/** 표지의 종이색(`bg2` 라이트). 색면이 여기 위에 얹힌다. */
const PAPER = '#F4F0E9'

describe('계단 색 — 표지가 서로 구별된다', () => {
  it('사다리 계단 수와 색 수가 같다 — 하나라도 모자라면 그 권이 다른 권과 같아 보인다', () => {
    expect(RUNG_INK).toHaveLength(SERIES_SPINE.length)
  })

  it('일곱 색이 전부 다르다', () => {
    expect(new Set(RUNG_INK).size).toBe(RUNG_INK.length)
  })

  it('**어느 두 색도 눈으로 갈린다** — RGB 거리 40 이상', () => {
    const pairs: string[] = []
    for (let i = 0; i < RUNG_INK.length; i += 1) {
      for (let j = i + 1; j < RUNG_INK.length; j += 1) {
        const d = distance(RUNG_INK[i]!, RUNG_INK[j]!)
        if (d < 40) pairs.push(`${i + 1}단↔${j + 1}단 ${d.toFixed(1)}`)
      }
    }
    expect(pairs, `너무 가까운 짝:\n  ${pairs.join('\n  ')}`).toEqual([])
  })

  it('일곱 색 전부 종이 위에서 AA(4.5) 를 넘는다 — 색을 고르다 읽기를 잃지 않는다', () => {
    const weak = RUNG_INK.map((c, i) => ({ c, i, r: contrast(c, PAPER) })).filter((x) => x.r < 4.5)
    expect(
      weak.map((x) => `${x.i + 1}단 ${x.c} ${x.r.toFixed(2)}`),
      '종이 대비 미달',
    ).toEqual([])
  })

  it('마지막 단은 브랜드 잉크다 — 사다리 끝이 브랜드 색으로 맺힌다', () => {
    expect(RUNG_INK[RUNG_INK.length - 1]).toBe('#0F2540')
  })

  it('사다리 밖 계단은 조용히 흰색이 되지 않는다 — 마지막 색으로 떨어진다', () => {
    expect(rungInk(99)).toBe(RUNG_INK[RUNG_INK.length - 1])
    expect(rungInk(0)).toBe(RUNG_INK[RUNG_INK.length - 1])
  })
})

describe('coverSvg — 표지가 실제로 그 색을 쓴다', () => {
  const spec = { brand: 'READING', step: 3, totalSteps: 7, schoolBand: '중학 1-2학년' }

  it('그 계단의 색이 표지에 실제로 들어간다', () => {
    expect(coverSvg(spec)).toContain(rungInk(3))
  })

  it('계단이 다르면 표지 문자열도 다르다 — 같으면 매대에서 같은 책이다', () => {
    const svgs = SERIES_SPINE.map((r) => coverSvg({ ...spec, step: r.step }))
    expect(new Set(svgs).size).toBe(SERIES_SPINE.length)
  })

  it('비율은 5:7 — 부르는 쪽이 폭만 주면 세로가 따라온다', () => {
    expect(coverSvg(spec, 140)).toContain(`viewBox="0 0 140 ${Math.round(140 / COVER_RATIO)}"`)
  })

  it('유동일 때는 width/height 를 안 적는다 — 적으면 CSS 가 못 늘린다', () => {
    const fluid = coverSvg(spec, 240, { fluid: true })
    expect(fluid).toContain('width:100%')
    expect(fluid).not.toMatch(/<svg[^>]*\swidth="240"/)
  })

  it('아직 못 펼치는 권은 계단 색을 쓰지 않는다 — 준비된 권과 같아 보이면 안 된다', () => {
    const pending = coverSvg({ ...spec, pending: true })
    expect(pending).not.toContain(rungInk(3))
  })

  it('표지가 스스로 무엇인지 말한다 — 화면 낭독기가 읽을 이름', () => {
    expect(coverSvg(spec)).toContain('aria-label="READING 3권 표지 — 중학 1-2학년"')
  })

  it('제목에 든 꺾쇠를 그대로 뱉지 않는다', () => {
    expect(coverSvg({ ...spec, schoolBand: '중<3>' })).toContain('중&lt;3&gt;')
  })
})

/**
 * 아래 셋은 **표지를 처음 굽어 보고서야** 드러난 것이다(2026-09-07 · `pnpm --filter web cover:probe`).
 * 코드로는 안 보이고 그림으로만 보이므로, 다시 썩지 않게 여기서 잠근다.
 */
describe('표지가 카드와 같은 말을 한다', () => {
  const rung = SERIES_SPINE[4]! // 5단 · volumeTitle "Vocaflow Reading 4"

  it('권 이름에서 표시만 떼어낸다 — 브랜드는 이미 표지 위쪽에 있다', () => {
    expect(volumeMark('Vocaflow Reading 4')).toBe('4')
    expect(volumeMark('Vocaflow Reading Starter')).toBe('Starter')
  })

  it('브랜드가 안 붙은 이름도 마지막 토막으로 떨어진다 — 빈 문자열을 찍지 않는다', () => {
    expect(volumeMark('별책 3')).toBe('3')
    expect(volumeMark('Starter')).toBe('Starter')
  })

  it('**큰 글자는 계단이 아니라 책 이름이다** — 5단 표지에 5 가 아니라 4 가 찍힌다', () => {
    // 이게 어긋나면 매대 카드에서 표지는 "5", 제목은 "Vocaflow Reading 4" 라 한 책이 두 수를 말한다.
    const spec = coverSpecOf(rung, 'READING')
    expect(spec.volume).toBe('4')
    expect(spec.step).toBe(5)
    const svg = coverSvg(spec)
    expect(svg).toContain('>4</text>')
    expect(svg).not.toContain('>5</text>')
  })

  it('한 줄 주제를 받으면 표지에 싣는다 — 안 주면 그 자리는 비운다', () => {
    const bare = coverSvg(coverSpecOf(rung, 'READING'))
    const withSubject = coverSvg(coverSpecOf(rung, 'READING', SERIES_SPINE.length, false, '학평 대응'))
    expect(bare).not.toContain('학평 대응')
    expect(withSubject).toContain('학평 대응')
  })

  it('**스켈레톤으로 읽히던 글줄 네 줄이 없다** — 콘텐츠가 안 온 카드처럼 보였다', () => {
    // 옛 판은 opacity 0.26 짜리 둥근 막대 넷을 깔았다. 되살아나면 여기서 걸린다.
    const svg = coverSvg(coverSpecOf(rung, 'READING', SERIES_SPINE.length, false, '학평 대응'))
    expect(svg).not.toContain('opacity="0.26"')
  })

  it('깊이 눈금이 판형을 따라 커진다 — 고정 px 면 큰 판에서 발치의 점이 된다', () => {
    const spec = coverSpecOf(rung, 'READING')
    const tallest = (svg: string): number =>
      Math.max(...[...svg.matchAll(/<rect[^>]*height="([\d.]+)"[^>]*rx="1"/g)].map((m) => Number(m[1])))
    expect(tallest(coverSvg(spec, 290))).toBeGreaterThan(tallest(coverSvg(spec, 112)) * 2)
  })
})
