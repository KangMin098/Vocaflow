// apps/web/src/app/admin/csat/__tests__/no-raw-object.test.tsx
//
// **화면이 객체를 그대로 인쇄하지 않는다.**
//
// ── 왜 생겼나 (실측 2026-09-23 · 캡처에서만 드러났다) ───────────────
// ④ 소재 화면의 「초·중 원문 재고」 절이 이렇게 찍혀 있었다:
//
//   bands [object Object],[object Object],[object Object],[object Object],[object Object]
//   adapted [object Object]   total 8,962   pct 97.8
//
// 원인은 `Object.entries(kidSource.inventory).map(([k, v]) => … String(v))` —
// **모양을 모르는 값을 통째로 펴서 인쇄**한 것이다. `bands` 는 배열이고 `adapted` 는 객체다.
// 타입도 린트도 이것을 안 잡는다(`String(unknown)` 은 합법이다). 테스트도 안 잡았다 —
// 렌더 테스트들이 「특정 문구가 있는가」만 물었기 때문이다. **캡처를 사람이 볼 때까지
// 아무도 몰랐고, 그 상태로 최소 17일이 지났다.**
//
// 이 저장소는 같은 결함을 이미 두 번 겪었다(`volume-contents.test.ts` 머리말 — 미리보기
// 선택지가 객체라 `[object Object]` 가 다섯 줄 찍혔다). 그때는 그 화면만 잠갔다.
// 여기서는 **교재 공장 화면 전부**를 한 번에 본다 — 같은 실수가 다음 화면에서 또 난다.
//
// ⚠️ 이 검사는 「무엇이 보이는가」가 아니라 **「보이면 안 되는 것이 없는가」**다.
//   그래서 표본이 비면 아무것도 안 재고 초록이 된다 — 아래 자기검사가 그것을 막는다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  AUTHOR_REAL,
  BLUEPRINT_REAL,
  KID_SOURCE_REAL,
  MARKET_REAL,
  PRESS_REAL,
  REVIEW_DEFECTS_REAL,
  REVIEW_REAL,
  SERIES_REAL,
  SOURCE_CONSOLE_REAL,
  STAGES_REAL,
} from '@/lib/csat/__tests__/fixtures'
import type { KidSourcePanel } from '@/lib/textbook/kid-source-stats'

import { BlueprintClient } from '../blueprint/BlueprintClient'
import { AuthorClient } from '../authoring/AuthorClient'
import { SeriesShelf } from '../catalog/SeriesShelf'
import { FactoryLineClient } from '../FactoryLineClient'
import { PressClient } from '../press/PressClient'
import { ReviewClient } from '../review/ReviewClient'
import { SourceClient } from '../sourcing/SourceClient'
import { MarketClient } from '../strategy/MarketClient'

import type { PressDecide } from '../press/PressClient'

/** 표본은 **쓰지 않는다** — 렌더만 본다. */
const NO_DECIDE: PressDecide = async () => ({ ok: false, says: '표본에서는 판정을 남기지 않는다' })

/**
 * 초·middle 재고가 **실제로 채워진** 표본.
 *
 * ⚠️ 공용 픽스처의 `KID_SOURCE_REAL` 은 `inventory: null` 이라 그 절이 통째로 안 그려진다 —
 *   빈 표본으로 재면 이 검사가 바로 그 결함을 못 잡는다(실제로 못 잡고 있었다).
 *   값은 2026-09-23 화면에 찍혀 있던 실측 합계(8,962 · 97.8%)에 맞췄다.
 */
const KID_SOURCE_FILLED: KidSourcePanel = {
  error: null,
  inventory: {
    bands: [
      { band: '초3~4', held: 507, quarantined: 12, publishable: 495, quarantinedPct: 2.4, quotaLeft: 1337, composable: 3 },
      { band: '초5~6', held: 1840, quarantined: 40, publishable: 1800, quarantinedPct: 2.2, quotaLeft: 32, composable: 2 },
      { band: '초6~중1', held: 2100, quarantined: 55, publishable: 2045, quarantinedPct: 2.6, quotaLeft: 0, composable: 0 },
      { band: '중1~2', held: 2600, quarantined: 61, publishable: 2539, quarantinedPct: 2.3, quotaLeft: 0, composable: 4 },
      { band: '중3', held: 2113, quarantined: 30, publishable: 2083, quarantinedPct: 1.4, quotaLeft: 0, composable: 0 },
    ],
    adapted: { held: 0, quarantined: 0, publishable: 0 },
    total: 8962,
    pct: 97.8,
  },
}

const SCREENS: { name: string; html: () => string }[] = [
  { name: '현황판', html: () => renderToString(<FactoryLineClient stages={STAGES_REAL} loadError={null} />) },
  { name: '카탈로그', html: () => renderToString(<SeriesShelf {...SERIES_REAL} />) },
  { name: '기획', html: () => renderToString(<MarketClient {...MARKET_REAL} />) },
  { name: '설계', html: () => renderToString(<BlueprintClient {...BLUEPRINT_REAL} />) },
  {
    name: '소재',
    html: () =>
      renderToString(
        <SourceClient
          view={SOURCE_CONSOLE_REAL}
          kidSource={KID_SOURCE_FILLED}
          onRetake={async () => ({ ok: true })}
        />,
      ),
  },
  {
    name: '소재(재고 못 읽음)',
    html: () =>
      renderToString(
        <SourceClient
          view={SOURCE_CONSOLE_REAL}
          kidSource={KID_SOURCE_REAL}
          onRetake={async () => ({ ok: true })}
        />,
      ),
  },
  { name: '집필', html: () => renderToString(<AuthorClient {...AUTHOR_REAL} />) },
  { name: '검수', html: () => renderToString(<ReviewClient {...REVIEW_REAL} defects={REVIEW_DEFECTS_REAL} />) },
  { name: '조판', html: () => renderToString(<PressClient {...PRESS_REAL} onDecide={NO_DECIDE} />) },
]

/** 화면이 값을 그대로 던졌을 때 나오는 자국들. 전부 사람이 읽을 수 없는 글자다. */
const RAW_MARKERS = ['[object Object]', '[object Array]', 'undefined,', ',undefined', 'NaN%', 'Infinity']

describe('교재 공장 화면이 객체를 그대로 인쇄하지 않는다', () => {
  it.each(SCREENS.map((s) => s.name))('%s', (name) => {
    const html = SCREENS.find((s) => s.name === name)!.html()
    for (const marker of RAW_MARKERS) {
      expect(html, `${name} 에 「${marker}」 가 찍혔다 — 모양을 모르는 값을 펴서 인쇄하고 있다`).not.toContain(
        marker,
      )
    }
  })

  // ── 자기검사 ───────────────────────────────────────────────────────
  // 위 검사는 **없는 것을 확인한다.** 렌더가 조용히 빈 문자열을 돌려주면 전부 통과한다 —
  // 이 저장소가 여러 번 겪은 거짓 초록이다(30-admin-sweep 머리말). 바닥을 박아 둔다.
  it('표본이 실제로 화면을 그린다 — 빈 렌더로 통과하지 않게', () => {
    for (const s of SCREENS) {
      const html = s.html()
      expect(html.length, `${s.name} 렌더가 너무 짧다`).toBeGreaterThan(500)
    }
  })

  it('초·중 재고 표본이 칸을 실제로 담고 있다 — 빈 표본으로 재면 이 결함을 못 잡는다', () => {
    expect(KID_SOURCE_FILLED.inventory?.bands.length).toBeGreaterThanOrEqual(5)
    const html = SCREENS.find((s) => s.name === '소재')!.html()
    // 칸 이름이 화면에 있어야 그 절이 실제로 그려진 것이다.
    for (const b of KID_SOURCE_FILLED.inventory!.bands) expect(html).toContain(b.band)
  })
})
