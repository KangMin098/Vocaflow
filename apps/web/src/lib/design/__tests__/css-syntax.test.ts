// apps/web/src/lib/design/__tests__/css-syntax.test.ts
//
// **모든 CSS 파일이 문법적으로 닫혀 있는가.**
//
// 2026-10-21 — 병합 충돌을 "양쪽 다 남기기"로 풀면서 `unified.module.css` 의
// `@media` 닫는 `}` 가 한쪽에만 붙어 사라졌다. tsc · lint · vitest 는 CSS 를 파싱하지 않아
// 전부 통과했고, `next build` 에서야 `Unclosed block` 으로 멈췄다(PR #332 CI). 개발 서버에서는
// 그 모듈을 쓰는 지도 화면만 깨진다. 빌드까지 가지 않고 여기서 잡는다.
import fs from 'node:fs'
import path from 'node:path'

import postcss from 'postcss'
import { describe, expect, it } from 'vitest'

const ROOTS = [path.resolve(__dirname, '../../..'), path.resolve(__dirname, '../../../../../../packages/design-tokens/src')]

function cssFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : cssFiles(p)
    return e.name.endsWith('.css') ? [p] : []
  })
}

describe('CSS 문법', () => {
  const files = ROOTS.flatMap(cssFiles)

  it('검사 대상이 있다', () => {
    expect(files.length).toBeGreaterThan(10)
  })

  it('모든 파일이 postcss 로 파싱된다(닫히지 않은 블록 · 충돌 표식 없음)', () => {
    const bad: string[] = []
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8')
      if (/^(<{7}|={7}|>{7})( |$)/m.test(src)) bad.push(`${f}: 병합 충돌 표식`)
      try {
        postcss.parse(src, { from: f })
      } catch (e) {
        const err = e as { reason?: string; line?: number }
        bad.push(`${f}:${err.line ?? '?'} ${err.reason ?? String(e)}`)
      }
    }
    expect(bad).toEqual([])
  })
})
