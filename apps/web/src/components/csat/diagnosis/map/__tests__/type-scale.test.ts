// apps/web/src/components/csat/diagnosis/map/__tests__/type-scale.test.ts
//
// /csat 글자 크기 = 참조 실측 비율 가드 — spec.json type(scale · minPx)과 globals.css 토큰이 같고,
// /csat 모듈 CSS 에 고정 px font-size 가 남지 않았는지(모두 max(최소, 원래값 × 비율))를 본다.
// 눈대중으로 글자 크기를 바꾸면 떨어진다: 고치려면 참조 캡처를 다시 재서(ref-scan --ink · ours-text-metrics) spec.json 부터.
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '../../../../../../../..')
const WEB = path.join(ROOT, 'apps/web/src')
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/design/refs/3b/access-map/spec.json'), 'utf8')) as {
  type: { scale: number; minPx: number; pairs: { ref: { ink: number }; ours: { fontSize: number; ink: number }; refFontEst: number }[] }
}

const cssFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? cssFiles(path.join(dir, e.name)) : e.name.endsWith('.css') ? [path.join(dir, e.name)] : []))

describe('/csat 글자 크기 = 참조 실측 비율', () => {
  it('명세의 비율은 측정 쌍에서 나온다(참조 추정 / 우리 크기 ≈ scale, ±0.03)', () => {
    for (const p of spec.type.pairs) {
      const est = (p.ours.fontSize * p.ref.ink) / p.ours.ink
      expect(Math.abs(est - p.refFontEst)).toBeLessThan(0.1)
      expect(Math.abs(p.refFontEst / p.ours.fontSize - spec.type.scale)).toBeLessThan(0.03)
    }
  })
  it('globals.css 토큰 = 명세', () => {
    const g = fs.readFileSync(path.join(WEB, 'app/globals.css'), 'utf8')
    expect(Number(g.match(/--csat-fs-scale:\s*([\d.]+);/)?.[1])).toBe(spec.type.scale)
    expect(Number(g.match(/--csat-fs-min:\s*(\d+)px;/)?.[1])).toBe(spec.type.minPx)
  })
  it('/csat 모듈 CSS 에 고정 px font-size 가 없다', () => {
    const files = cssFiles(path.join(WEB, 'components/csat'))
    const bad = files.flatMap((f) =>
      fs.readFileSync(f, 'utf8').split(/\r?\n/).map((l, i) => ({ f: path.relative(WEB, f), i: i + 1, l })).filter((x) => /font-size:\s*\d+(\.\d+)?px/.test(x.l)),
    )
    expect(bad.map((b) => `${b.f}:${b.i}`)).toEqual([])
  })
})
