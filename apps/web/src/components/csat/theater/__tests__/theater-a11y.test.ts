// apps/web/src/components/csat/theater/__tests__/theater-a11y.test.ts
//
// T-0181 — 해설 화면 접근성 결함 회귀(정적). 실제 렌더 판정은 실로그인 e2e(csat-judgment-d-irrelevant)의 axe 0 단언이 맡는다.
//   ① 근거·관계 판 스크롤 본문(paneBody)은 키보드로 포커스되는 이름 있는 영역이다(axe scrollable-region-focusable)
//   ② 보라 강조 글자(보기 전환 눌림 · 문제지 링크)는 바탕 대비 4.5:1 이상인 토큰(--p-ink)을 쓴다(axe color-contrast)
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = fs.readFileSync(path.resolve(__dirname, '../theater.module.css'), 'utf8')
const tsx = fs.readFileSync(path.resolve(__dirname, '../AnalysisTheater.tsx'), 'utf8')

const hex = (name: string) => {
  const m = new RegExp(`${name}:\\s*(?:var\\([^,]+,\\s*)?(#[0-9a-fA-F]{6})`).exec(css)
  if (!m) throw new Error(`${name} 값 없음`)
  return m[1]
}
const lum = (h: string) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

describe('해설 화면 접근성(T-0181)', () => {
  it('근거·관계 판 스크롤 본문은 tabIndex=0 · role=region · 이름이 있다', () => {
    const m = /<div className=\{styles\.paneBody\} ref=\{evidencePaneRef\}([^>]*)>/.exec(tsx)
    expect(m, '근거 판 본문 div').not.toBeNull()
    expect(m![1]).toContain('tabIndex={0}')
    expect(m![1]).toContain('role="region"')
    expect(m![1]).toMatch(/aria-label="[^"]+"/)
    expect(css).toMatch(/\.paneBody:focus-visible\s*\{[^}]*outline/)
  })

  it('보라 강조 글자 토큰은 연보라 · 흰 바탕 모두 4.5:1 이상', () => {
    const ink = hex('--p-ink')
    expect(ratio(ink, hex('--p-light'))).toBeGreaterThanOrEqual(4.5)
    expect(ratio(ink, hex('--bg'))).toBeGreaterThanOrEqual(4.5)
  })

  it('보기 전환 눌림 · 문제지 링크 글자는 --p-ink 를 쓴다(--p 그대로면 3.83 · 4.4:1)', () => {
    expect(css).toMatch(/\.viewSwitch button\[aria-pressed='true'\]\s*\{[^}]*color:\s*var\(--p-ink\)/)
    expect(css).toMatch(/\.kv a\s*\{[^}]*color:\s*var\(--p-ink\)/)
  })
})
