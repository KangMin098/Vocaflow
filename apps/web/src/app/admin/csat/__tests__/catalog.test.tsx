// apps/web/src/app/admin/csat/__tests__/catalog.test.tsx
//
// 카탈로그 — **「낼 수 있는데 안 냈다」가 화면에서 안 흐려지는지** 본다.
//
// 이 화면이 생긴 이유가 그 수 하나다. 실측 2026-09-06 에 낼 수 있는 권 24 중 찍힌 것은
// 6권(독해)뿐이었고, 어휘·구문·내신 재고 58만 문항이 담을 책이 없어 놀고 있었다.
// 그 사실이 「재고 58만」이나 「커버리지 4/5」로 표현되면 아무도 안 움직인다 —
// **안 낸 권 수**만이 행동을 부른다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { GENRES, STEPS, catalogCoverage, genreCoverage, type CatalogRow } from '@/lib/csat/product-model'
import type { CatalogView } from '@/lib/csat/product-view'

import { CatalogClient } from '../catalog/CatalogClient'

const text = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '')

/** 상태 문자열 뒤 `!` = 이미 낸 칸. */
function row(id: string, statuses: string[], items = 1000): CatalogRow {
  const cells = statuses.map((raw, i) => {
    const published = raw.endsWith('!')
    const status = (published ? raw.slice(0, -1) : raw) as CatalogRow['cells'][number]['status']
    return {
      genre: id as CatalogRow['genre']['id'],
      step: STEPS[i]?.step ?? i + 1,
      items,
      explained: items,
      blocked: GENRES.find((g) => g.id === id)!.blocked,
      status,
      published,
    }
  })
  const ready = cells.filter((c) => c.status === 'ready')
  return {
    genre: GENRES.find((g) => g.id === id)!,
    cells,
    ready: ready.length,
    published: ready.filter((c) => c.published).length,
  }
}

function view(rows: CatalogRow[]): CatalogView {
  return { rows, coverage: catalogCoverage(rows), genres: genreCoverage(rows), loadError: null }
}

/** 실측 2026-09-06 의 모양 — 독해만 찍혔고 나머지는 재고가 있는데 안 냈다. */
const REAL = view([
  row('reading', ['empty', 'ready!', 'ready!', 'ready!', 'ready!', 'ready!', 'ready!'], 215032),
  row('vocab', ['needsItems', 'ready', 'ready', 'ready', 'ready', 'ready', 'ready'], 287614),
  row('syntax', ['needsItems', 'ready', 'ready', 'ready', 'ready', 'ready', 'ready'], 153720),
  row('school', ['needsItems', 'ready', 'ready', 'ready', 'ready', 'ready', 'ready'], 143884),
  row('pastexam', Array(7).fill('blocked'), 0),
  row('platform', Array(7).fill('blocked'), 0),
])

describe('CatalogClient', () => {
  it('헤드라인은 재고도 커버리지도 아니고 「안 낸 권」이다', () => {
    const html = text(renderToString(<CatalogClient {...REAL} />))
    expect(html).toContain('낼 수 있는데 안 낸 책 18권')
  })

  it('시중 유형 커버리지를 분자/분모로 적는다 — 기출은 못 내므로 4/5 다', () => {
    const html = text(renderToString(<CatalogClient {...REAL} />))
    expect(html).toContain('시중 유형 4/5')
  })

  it('유형마다 시중 문서 수를 나란히 적는다 — 왜 그 유형을 만드는지의 근거', () => {
    const html = text(renderToString(<CatalogClient {...REAL} />))
    expect(html).toContain('시중 60종')
    expect(html).toContain('시중 8종')
  })

  it('못 내는 유형은 재고 0 이 아니라 **이유**를 말한다', () => {
    const html = text(renderToString(<CatalogClient {...REAL} />))
    // 기출은 재고가 없어서가 아니라 저작권이라 못 낸다. 「재고 없음」으로 보이면
    // "더 만들면 되겠네" 로 읽힌다.
    expect(html).toContain('시중에 없음') // 개인 맞춤
    expect(html).not.toContain('기출 재고 0 — 더 만들면')
  })

  it('색만으로 말하지 않는다 — 칸마다 기호와 글자가 함께 있다', () => {
    const html = text(renderToString(<CatalogClient {...REAL} />))
    for (const m of ['●', '○', '◐', '✕', '—']) expect(html).toContain(m)
    expect(html).toContain('안 냄')
    expect(html).toContain('못 냄')
  })

  it('칸의 접근성 이름에 학령·유형·상태가 다 들어간다', () => {
    const html = renderToString(<CatalogClient {...REAL} />)
    expect(html).toContain('aria-label="초등 고학년 어휘 — 낼 수 있음')
  })

  it('기본으로 펼치는 칸은 「낼 수 있는데 안 낸」 첫 칸이다 — 열자마자 할 일이 보인다', () => {
    const html = text(renderToString(<CatalogClient {...REAL} />))
    expect(html).toContain('아직 안 찍었을 뿐이다')
    expect(html).toContain('찍는 법')
  })

  it('안 낸 칸에는 찍는 명령이 붙고, 조합기 한계를 함께 적는다', () => {
    const html = text(renderToString(<CatalogClient {...REAL} />))
    expect(html).toContain('build-volume.mjs')
    // ⚠️ 명령만 주고 끝내면 어휘 권을 찍으려다 독해가 나온다 — 조합기가 아직 독해만 담는다.
    expect(html).toContain('독해 유형만')
  })

  it('전부 냈으면 헤드라인이 그렇게 말한다', () => {
    const done = view([row('reading', ['ready!', 'ready!'])])
    const html = text(renderToString(<CatalogClient {...done} />))
    expect(html).toContain('낼 수 있는 책은 다 냈다')
  })

  it('집계를 못 읽으면 role=alert 로 이유를 그대로 올린다', () => {
    const broken: CatalogView = { ...REAL, loadError: '재고 집계를 못 읽었다: timeout' }
    const html = renderToString(<CatalogClient {...broken} />)
    expect(html).toContain('role="alert"')
    expect(text(html)).toContain('재고 집계를 못 읽었다: timeout')
  })

  it('칸 버튼이 44px 터치 타겟을 지킨다', () => {
    const html = renderToString(<CatalogClient {...REAL} />)
    // 6유형 × 7학령 = 42칸
    expect((html.match(/min-h-\[44px\]/g) ?? []).length).toBeGreaterThanOrEqual(42)
  })
})
