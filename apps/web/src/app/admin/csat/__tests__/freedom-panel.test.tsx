// apps/web/src/app/admin/csat/__tests__/freedom-panel.test.tsx
//
// **화면이 "한 권은 된다" 에서 멈추지 않는지 잠근다.**
//
// 이 패널이 생긴 이유는 아래 「제작 단계」가 전 밴드 초록을 띄우는데 실제로는 V2·V7 이
// 겹치지 않는 권을 하나밖에 못 내기 때문이다. 그러므로 이 시험이 지켜야 하는 것은
// "패널이 렌더된다" 가 아니라 **좁은 밴드가 화면에 실제로 적히는가** 다.

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { FreedomPanel } from '@/components/admin/textbook/FreedomPanel'
import { buildFreedomView, type FreedomView, type SnapBand } from '@/lib/textbook/freedom-view'
import snapshot from '@/lib/textbook/type-inventory-snapshot.json'

/** 고정 표본 — 화면은 집계표를 읽지만 렌더 회귀는 DB 없이 돈다. */
const snap = snapshot as unknown as { measuredAt: string; bands: SnapBand[] }
const fromSnapshot = () => buildFreedomView(snap.bands, snap.measuredAt)

const html = (v: FreedomView) => renderToStaticMarkup(<FreedomPanel view={v} />)

describe('실제 스냅샷', () => {
  const view = fromSnapshot()
  const out = html(view)

  it('두 수를 화면에 적는다 — 유형 자유도와 권 자유도', () => {
    expect(out).toContain(`/${view.index.soloMeasured}`)
    expect(out).toContain(`${view.index.mixVolumes}`)
  })

  it('가장 좁은 밴드를 이름으로 지목한다', () => {
    expect(view.index.narrowest).not.toBeNull()
    expect(out).toContain(`V${view.index.narrowest!.vLevel}`)
  })

  it('밴드마다 **묶는 유형**을 한국어 이름표로 적는다 — 코드 이름은 안 쓴다', () => {
    // `long_reference` 가 그대로 찍히면 이름표 정본이 안 걸린 것이다.
    expect(out).not.toContain('long_reference')
    expect(out).toContain('장문 지칭')
  })

  it('범위 밖 밴드를 밝힌다 — 분모가 왜 6 인지', () => {
    expect(out).toContain('V1')
    expect(out).toContain('분모에서 뺐다')
  })

  it('정상일 때 drift 경보가 없다', () => {
    expect(view.drift).toEqual([])
    expect(out).not.toContain('role="alert"')
  })
})

describe('못 잰 값 · 어긋남', () => {
  const base = fromSnapshot()

  it('스냅샷과 갈리면 경보를 띄운다 — 조용히 다른 수를 말하지 않는다', () => {
    const out = html({ ...base, drift: [{ vLevel: 7, snapshot: 1, ours: 4 }] })
    expect(out).toContain('role="alert"')
    expect(out).toContain('둘 중 하나가 틀렸다')
  })

  it('못 잰 권 수를 0 으로 그리지 않는다', () => {
    const bands = base.index.bands.map((b, i) =>
      i === 0 ? { ...b, mix: { volumes: null, binding: null, unmeasured: ['mood'] } } : b,
    )
    const out = html({ ...base, index: { ...base.index, bands } })
    expect(out).toContain('못 잼')
  })

  it('재고를 못 읽었으면 이유를 경보로 적는다 — 빈 수가 0 권으로 읽히지 않게', () => {
    const out = html({ ...base, measuredAt: null, loadError: '재고 집계표를 못 읽었다 — 시험' })
    expect(out).toContain('role="alert"')
    expect(out).toContain('재고 집계표를 못 읽었다')
    expect(out).toContain('시각 모름')
  })

  it('밴드가 없어도 죽지 않는다', () => {
    const out = html({
      ...base,
      index: { ...base.index, bands: [], narrowest: null, soloOk: 0, soloMeasured: 0 },
    })
    expect(out).toContain('자유도')
  })
})
