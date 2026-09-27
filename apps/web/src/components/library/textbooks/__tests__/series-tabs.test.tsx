// apps/web/src/components/library/textbooks/__tests__/series-tabs.test.tsx
//
// **학습자가 보는 코너 표지판이 사실을 말하는가.**
//
// ── 이 파일이 잡는 사고 (실측 2026-09-23 · DD-76) ───────────────────
// 이 표지판은 시리즈마다 「인쇄본 준비 중」을 붙일지를 **카탈로그 상수**(`status: 'draft'`)로
// 정했다. 그 상수는 시리즈를 정의한 날의 값이라 **찍은 뒤에도 안 바뀐다**:
//
//   · 어휘 6권 · 구문 6권이 2026-09-06 에 조판돼 `textbook_volume_renders` 에
//     `status='published'` 로 들어갔고, DD-73 이 그 목차까지 구웠다.
//   · 그런데 이 공개 화면은 그 뒤로 **17일 동안** 두 서가에 「인쇄본 준비 중」을 찍었다.
//   · 타입·린트·기존 렌더 회귀 어느 것도 안 잡았다 — **읽을 회귀가 없었다.**
//
// 그래서 여기서 잠그는 것은 하나다: 이 배지의 근거는 **상수가 아니라 구워진 목차**다.

import { readFileSync } from 'node:fs'

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SERIES_CATALOG } from '@vocaflow/library-pipeline/textbook-series-catalog'

import { SeriesTabs } from '../SeriesTabs'
import { seriesHasContents } from '@/lib/textbook/volume-contents'

const html = () => renderToString(<SeriesTabs current="reading" />)

describe('시리즈 표지판', () => {
  it('정의된 시리즈마다 자기 서가로 가는 길이 있다 — 있는 것을 못 찾으면 없는 것과 같다', () => {
    const h = html()
    for (const s of SERIES_CATALOG) {
      if (s.intent === 'retired') continue
      expect(h, `${s.brand} 로 가는 길이 없다`).toContain(`/library/textbooks/${s.id}`)
      expect(h).toContain(s.brand)
    }
  })

  it('「인쇄본 준비 중」은 구워진 목차가 없는 시리즈에만 붙는다', () => {
    const h = html()
    const printable = SERIES_CATALOG.filter((s) => seriesHasContents(s.id))
    const pending = SERIES_CATALOG.filter(
      (s) => s.intent !== 'retired' && !seriesHasContents(s.id),
    )
    // 배지 수가 **구워지지 않은 시리즈 수와 같아야** 한다. 상수를 읽던 동안 이 둘이
    // 갈려 있었고(구워진 시리즈 3 · 배지 2), 아무도 그것을 몰랐다.
    const badges = h.split('인쇄본 준비 중').length - 1
    expect(badges).toBe(pending.length)
    expect(
      printable.length,
      '구워진 시리즈가 하나도 없다 — 이 검사가 아무것도 안 지킨다',
    ).toBeGreaterThan(0)
  })

  it('카탈로그 상수로 배지를 정하지 않는다 — 그 상수는 찍은 뒤에도 안 바뀐다', () => {
    // 소스 대조: 이 화면이 다시 상수를 읽기 시작하면 위 검사는 **표본이 우연히 맞는 동안**
    // 통과한다. 근거 자체를 잠근다.
    const src = new URL('../SeriesTabs.tsx', import.meta.url)
    const text = readFileSync(src, 'utf8')
    expect(text).toContain('seriesHasContents(s.id)')
    expect(text).not.toContain("s.status === 'draft'")
  })
})
