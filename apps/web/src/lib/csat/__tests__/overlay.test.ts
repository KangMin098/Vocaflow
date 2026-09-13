// apps/web/src/lib/csat/__tests__/overlay.test.ts
//
// 오버레이의 **배선**을 잠근다 — 좌표가 화면 좌표로 옳게 뒤집히는지, 해시 식별이
// 아무 문자열에나 답하지 않는지. 실 DB 없이 돈다.

import { describe, expect, it } from 'vitest'

import { anchorCatalog, examBySha256, toItemSlug } from '@/lib/csat/overlay'

describe('오버레이 좌표 카탈로그', () => {
  it('회차 목록이 비어 있지 않다 — 비면 화면이 「받을 수 있는 것」을 말할 수 없다', () => {
    const c = anchorCatalog()
    expect(c.exams.length).toBeGreaterThan(0)
    expect(c.built).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('해시로 회차를 찾는다', () => {
    const c = anchorCatalog()
    expect(c.exams).toContain('2026')
  })

  it('16진수 64자가 아니면 **묻지도 않고** null — 이 값이 파일 이름이 되므로', () => {
    for (const bad of [
      '',
      'nope',
      'A'.repeat(64), // 대문자
      '0'.repeat(63),
      '0'.repeat(65),
      '../../../etc/passwd',
      '../'.repeat(10) + 'a'.repeat(34),
    ]) {
      expect(examBySha256(bad), `${bad.slice(0, 20)} 가 회차로 해석됐다`).toBeNull()
    }
  })

  it('모르는 해시는 null (오류가 아니다)', () => {
    expect(examBySha256('f'.repeat(64))).toBeNull()
  })

  it('문항 id → 슬러그', () => {
    expect(toItemSlug('2026#30')).toBe('2026-30')
    expect(toItemSlug('M2506#18')).toBe('M2506-18')
  })
})

// PDF 좌표는 **왼아래 원점**이고 화면은 왼위 원점이다. 뒤집을 때 상자 높이를 빼지 않으면
// 상자가 글자 **한 줄 아래**에 그려진다 — 화면은 멀쩡하고 위치만 틀리는, 눈으로 놓치기 쉬운 실패.
// `OverlayClient` 의 `pct()` 와 같은 식을 여기서 잠근다.
describe('PDF 좌표 → 화면 %', () => {
  const page = { w: 842, h: 1191 }
  const pct = (b: { x: number; y: number; w: number; h: number }) => ({
    left: (b.x / page.w) * 100,
    top: ((page.h - b.y - b.h) / page.h) * 100,
    width: (b.w / page.w) * 100,
    height: (b.h / page.h) * 100,
  })

  it('아래쪽 좌표일수록 화면에서는 아래로 간다', () => {
    const high = pct({ x: 88, y: 1000, w: 10, h: 13 })
    const low = pct({ x: 88, y: 200, w: 10, h: 13 })
    expect(high.top).toBeLessThan(low.top)
  })

  it('상자 높이를 빼서 뒤집는다 — 빼지 않으면 한 줄 아래에 그려진다', () => {
    const b = { x: 0, y: 1191 - 13, w: 10, h: 13 }
    // 쪽 맨 위에 닿는 상자는 top 이 0 이어야 한다
    expect(pct(b).top).toBeCloseTo(0, 6)
  })

  it('왼쪽 여백 88pt 는 842pt 쪽에서 약 10.5%', () => {
    expect(pct({ x: 88, y: 0, w: 0, h: 0 }).left).toBeCloseTo(10.45, 1)
  })
})

// ── 링크 모드 — 「그 문항이 있는 쪽부터 열기」 ────────────────────────
//
// cross-origin iframe 은 안을 읽을 수 없지만 **여는 순간의 쪽**은 정할 수 있다.
// 그 쪽 번호가 앵커에서 나오므로, 여기가 틀리면 학습자는 엉뚱한 쪽을 보고 시작한다.
import { kiceSourceOf, pdfFragment, KICE_ARCHIVE_URL } from '@/lib/csat/kice-source'
import { anchorMetaOf, pageOfItem } from '@/lib/csat/overlay'

describe('링크 모드', () => {
  it('문항 번호로 쪽을 찾는다', () => {
    // 2026 30번(어휘)은 5쪽이다 — 좌표 실측값
    expect(pageOfItem('2026', 30)).toBe(5)
    expect(pageOfItem('2026', 18)).toBe(2)
  })

  it('없는 회차·없는 번호는 null — 화면은 1쪽부터 연다', () => {
    expect(pageOfItem('2026', 99)).toBeNull()
    expect(pageOfItem('없는회차', 30)).toBeNull()
  })

  it('형이 둘 든 회차는 앞 절반만 우리 기준이라고 말할 수 있다', () => {
    const m = anchorMetaOf('2026')
    expect(m).not.toBeNull()
    expect(m!.formPages).toBe(8)
    expect(m!.totalPages).toBe(16)
  })

  it('직접 링크가 있는 회차는 파일 URL, 없는 회차는 목록 URL + 이유', () => {
    const y2026 = kiceSourceOf('2026')
    expect(y2026.paperUrl).toMatch(/^https:\/\/www\.suneung\.re\.kr\/boardCnts\/fileDown\.do\?fileSeq=[0-9a-f]{32}$/)
    expect(y2026.reason).toBeNull()

    const mock = kiceSourceOf('M2506')
    expect(mock.paperUrl).toBeNull()
    expect(mock.reason).toBeTruthy() // 왜 없는지 화면이 말할 수 있어야 한다
    expect(mock.listUrl).toMatch(/^https:\/\/www\.suneung\.re\.kr\//)

    const old = kiceSourceOf('2019')
    expect(old.paperUrl).toBeNull()
    expect(old.listUrl).toBe(KICE_ARCHIVE_URL)
  })

  it('쪽 조각은 뷰어가 읽는 형태다', () => {
    expect(pdfFragment(5)).toBe('#page=5&zoom=page-width')
  })
})
