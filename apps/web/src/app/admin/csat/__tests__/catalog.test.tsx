// apps/web/src/app/admin/csat/__tests__/catalog.test.tsx
//
// **카탈로그가 만들 수 없는 책을 세지 않는지** 본다.
//
// ⚠️ 이 파일의 앞 판은 **거짓말을 지키고 있었다.** 「낼 수 있는데 안 낸 책 18권」을 통과
//   조건으로 들고 있었는데, 그 18칸은 조판 명령을 줘도 안 나오는 칸이었다 —
//   (유형 × 학령) 격자가 시장이 파는 축이 아니었기 때문이다. 검사가 화면을 지킨 것이 아니라
//   틀린 숫자를 지켰다.
//
// 축을 시리즈로 바꾼 뒤로 **한 칸 = 한 권**이 됐다. 그래서 여기서 잠그는 것은:
//   · 화면의 수가 표본의 판정과 **같은 말**인가 (수를 박지 않는다)
//   · 「단 없음」과 「문항 모자람」을 다르게 그리는가 — 할 일이 다르다
//   · 시리즈끼리 눈으로 갈리는가 — 표지가 같으면 매대에서 한 권이 된다
//   · 안 만드는 것을 **칸으로 그리지 않고 이유로** 적는가

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SERIES_REAL } from '@/lib/csat/__tests__/fixtures'
import { VOLUME_STATUS_KO, readyToPrint } from '@/lib/csat/series-model'

import { SeriesShelf } from '../catalog/SeriesShelf'

const text = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '')

describe('SeriesShelf', () => {
  const html = () => text(renderToString(<SeriesShelf {...SERIES_REAL} />))

  it('헤드라인이 표본의 판정과 같은 말을 한다 — 수를 박지 않는다', () => {
    const n = readyToPrint(SERIES_REAL.rows)
    const h = html()
    if (n > 0) expect(h).toContain(`찍기만 하면 되는 권 ${n}권`)
    else if (SERIES_REAL.rows.some((r) => r.status === 'draft'))
      expect(h).toContain('한 번도 안 찍은 시리즈')
    else expect(h).toContain('낼 수 있는 권은 다 냈다')
  })

  it('우리 시리즈를 시장 시리즈와 나란히 적는다 — 분모 없이 「1개」는 아무 말도 안 한다', () => {
    expect(html()).toContain(`시리즈 ${SERIES_REAL.counts.shipping}/${SERIES_REAL.counts.market}`)
  })

  it('시리즈마다 자기 브랜드가 보인다 — 셋이 한 이름이면 한 시리즈로 읽힌다', () => {
    const h = html()
    for (const r of SERIES_REAL.rows) expect(h, `${r.brand} 이 없다`).toContain(r.brand)
  })

  it('표지를 시리즈마다 다르게 그린다 — 전역 브랜드를 쓰면 셋 다 같은 표지가 된다', () => {
    const h = html()
    // 표지의 브랜드 칸은 짧은 이름이다(Reading / Vocab / Syntax). 실측 2026-09-06 에
    // 전역 `COVER_BRAND` 를 쓰다가 셋 다 READING 으로 찍혔다.
    for (const r of SERIES_REAL.rows) {
      const short = r.brand.split(' ').slice(-1)[0]!
      expect(h, `표지에 ${short} 가 없다`).toContain(short.toUpperCase())
    }
  })

  it('아직 안 찍은 시리즈가 몇 권 중 몇 권인지 드러난다', () => {
    const draft = SERIES_REAL.rows.filter((r) => r.status === 'draft')
    expect(draft.length, '표본에 draft 가 없다 — 이 검사가 아무것도 안 지킨다').toBeGreaterThan(0)
    const h = html()
    for (const r of draft) expect(h).toContain(`${r.published}/${r.rungs}권`)
  })

  it('판정을 색만으로 말하지 않는다 — 기호와 글자를 함께 낸다', () => {
    const h = html()
    const used = new Set(SERIES_REAL.rows.flatMap((r) => r.volumes.map((v) => v.status)))
    for (const s of used) {
      expect(h, `${s} 의 이름표가 없다`).toContain(VOLUME_STATUS_KO[s].label)
      expect(h, `${s} 의 기호가 없다`).toContain(VOLUME_STATUS_KO[s].mark)
    }
  })

  it('「단 없음」은 재고 문제가 아니다 — 다른 기호로 그리고 값을 안 적는다', () => {
    const none = SERIES_REAL.rows.flatMap((r) => r.volumes).filter((v) => v.status === 'noRung')
    expect(none.length, '표본에 단 없는 칸이 없다').toBeGreaterThan(0)
    for (const v of none) {
      expect(v.items).toBeNull()
      expect(v.title).toBeNull()
    }
    expect(VOLUME_STATUS_KO.noRung.mark).not.toBe(VOLUME_STATUS_KO.needsItems.mark)
  })

  it('안 만드는 것은 칸이 아니라 **이유**로 적는다 — 회색 칸은 아무 행동도 안 부른다', () => {
    const h = html()
    expect(h).toContain('안 만드는 것')
    for (const n of SERIES_REAL.notMaking) {
      expect(h, `${n.name} 이 없다`).toContain(n.name)
      expect(n.why.length, `${n.name} 의 이유가 너무 짧다`).toBeGreaterThan(20)
    }
  })

  it('마크다운 강조가 화면에 새지 않는다 — `**` 는 글자로 보이면 안 된다', () => {
    const body = html().replace(/<[^>]*>/g, '')
    expect(body).not.toContain('**')
  })

  it('재고를 못 읽었으면 0 이 아니라 이유를 말한다', () => {
    const broken = { ...SERIES_REAL, loadError: '재고를 못 읽었다: boom' }
    const h = text(renderToString(<SeriesShelf {...broken} />))
    expect(h).toContain('재고를 못 읽었다')
    expect(h).toContain('role="alert"')
  })
})

/**
 * **화면이 주는 명령이 그 칸의 권을 내는지.**
 *
 * ⚠️ 이 저장소는 같은 사고를 두 번 냈다 — 화면이 「이 권을 찍으면 된다」고 적어 놓고,
 *   주는 명령은 **다른 권**을 내는 것이다. 처음엔 (유형 × 학령) 격자가 그랬고, 축을 시리즈로
 *   고치면서 또 그랬다(`--band` 만 주면 조합기가 독해 사다리를 본다).
 *   화면과 스크립트가 갈리는 자리라, 여기서 문자열로 잠근다.
 */
describe('찍는 법이 그 칸의 권을 낸다', () => {
  it('명령에 `--series` 가 실린다 — 밴드만 주면 어휘 칸에서 독해 권이 나온다', () => {
    // 상세 패널은 칸을 골라야 열리므로 컴포넌트 소스를 본다(서버 렌더로는 안 열린다).
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'catalog', 'SeriesShelf.tsx'),
      'utf8',
    )
    expect(src).toContain('--series {sel.row.id}')
    // 밴드만 주는 옛 형태가 남아 있으면 안 된다.
    expect(src).not.toContain('build-volume.mjs --band {sel.v.step}')
  })

  it('산출 파일 이름도 시리즈를 따른다 — 두 시리즈가 같은 파일을 덮어쓰면 안 된다', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'catalog', 'SeriesShelf.tsx'),
      'utf8',
    )
    expect(src).toContain('--out {sel.row.id}-v{sel.v.step}.html')
  })
})

/**
 * **표지 색이 시리즈를 가르는지** — 화면에서.
 *
 * 색 자체의 판정(대비·거리)은 `series-ink.test.ts` 가 재고, 여기서는 **그 색이 실제로
 * 화면까지 오는지**만 본다. 실측 2026-09-06: `accent` 를 안 넘겨서 세 시리즈가 전부
 * 같은 단별 색으로 찍혔다 — 계산이 맞아도 안 넘기면 소용이 없다.
 */
describe('표지 색이 시리즈를 가른다', () => {
  it('세 시리즈의 표지가 서로 다른 색을 쓴다', () => {
    const h = text(renderToString(<SeriesShelf {...SERIES_REAL} />))
    // 각 행의 표지 svg 에서 색면 색을 뽑는다(종이색·회색 계열은 공통이라 뺀다).
    const common = new Set(['#f4f0e9', '#e0dbd0', '#4a443e', '#fbfaf6'])
    const inks = [...h.matchAll(/#[0-9a-fA-F]{6}/g)]
      .map((m) => m[0].toLowerCase())
      .filter((c) => !common.has(c))
    const distinct = new Set(inks)
    expect(
      distinct.size,
      `표지 색면이 ${distinct.size}가지뿐이다 — 시리즈 ${SERIES_REAL.rows.length}개가 서로 다른 색이어야 한다`,
    ).toBeGreaterThanOrEqual(SERIES_REAL.rows.length)
  })

  it('액센트를 표지에 실제로 넘긴다 — 계산이 맞아도 안 넘기면 소용없다', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'catalog', 'SeriesShelf.tsx'),
      'utf8',
    )
    expect(src).toContain('accent: row.accent')
  })
})

/**
 * **「어떤 원문을 어떤 기준으로」에 답하는 자리.**
 *
 * 그 답이 세 화면에 흩어져 있었다 — 카탈로그는 권을, ④ 소재는 밴드별 지문을,
 * ④-1 원문 적격은 판정을 보여 주고 **셋을 잇는 것은 관리자 머릿속뿐**이었다.
 * 사슬은 이미 데이터에 있었는데(`SeriesRung.types`·`rationale`) 화면이 안 썼다.
 */
describe('한 권이 무엇으로 만들어지는가', () => {
  it('모든 권이 유형과 배합 근거를 들고 온다 — 근거 없는 배합은 짐작이다', () => {
    for (const r of SERIES_REAL.rows) {
      for (const v of r.volumes) {
        if (v.status === 'noRung') {
          // 단이 없는 칸은 유형도 없다 — 빈 배열이지 「못 잼」이 아니다.
          expect(v.types).toEqual([])
          expect(v.recipe).toBeNull()
        } else {
          expect(v.types.length, `${v.title} 에 유형이 없다`).toBeGreaterThan(0)
          expect(v.recipe, `${v.title} 에 배합 근거가 없다`).toBeTruthy()
        }
      }
    }
  })

  it('유형 이름은 정본에서 온다 — 화면이 다시 지으면 조판물과 갈린다', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'lib', 'csat', 'series-view.ts'),
      'utf8',
    )
    expect(src).toContain('SERIES_TYPE_LABEL_KO[t]')
  })

  it('고른 권 아래에 「무엇으로」가 붙는다', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'catalog', 'SeriesShelf.tsx'),
      'utf8',
    )
    expect(src).toContain('무엇으로')
    expect(src).toContain('sel.v.recipe')
  })
})

/**
 * **「팔고 있나」는 상수가 아니라 사실이다.**
 *
 * ⚠️ 실측 2026-09-06: 어휘·구문 12권을 실제로 찍었는데 화면이 「한 번도 안 찍은 시리즈 2개」
 *   라고 적었다. `series-catalog.ts` 의 `status: 'draft'` 가 정의 시점의 상수라 낡은 것이다 —
 *   이 세션에서 반복해 잡은 것과 **같은 종류**(손으로 적은 값이 데이터를 이긴다).
 *   정의(브랜드·단·유형)는 상수가 맞지만 **"나갔는가" 는 조판 기록에서 읽어야 한다.**
 */
describe('발행 상태를 실측에서 끌어낸다', () => {
  it('한 권이라도 나갔으면 shipping 이고 다음 걸음이 없다', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'lib', 'csat', 'series-view.ts'),
      'utf8',
    )
    expect(src).toContain('const shipping = publishedCount > 0')
    // 상수를 그대로 쓰던 옛 형태가 남아 있으면 안 된다.
    expect(src).not.toContain('status: s.status,')
    expect(src).not.toContain('nextStep: s.nextStep,')
  })

  it('시리즈 분자도 기록에서 센다 — 정의만 해 둔 것을 「판다」로 세지 않는다', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'lib', 'csat', 'series-view.ts'),
      'utf8',
    )
    expect(src).toContain("rows.filter((r) => r.status === 'shipping').length")
  })

  it('표본은 draft 갈래를 유지한다 — 그 갈래를 시험할 표본이 없으면 검사가 준다', () => {
    expect(SERIES_REAL.rows.some((r) => r.status === 'draft')).toBe(true)
    expect(SERIES_REAL.rows.some((r) => r.status === 'shipping')).toBe(true)
  })
})
