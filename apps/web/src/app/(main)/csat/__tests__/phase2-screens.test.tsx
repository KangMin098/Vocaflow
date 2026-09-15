// apps/web/src/app/(main)/csat/__tests__/phase2-screens.test.tsx
//
// **브리프 [G] 완료 조건을 기계로 채점한다.**
//
// 스크린샷 리뷰는 사람이 보는 것이고, 여기서는 **사람이 놓치는 것**을 잡는다:
// 연속 문단(G2) · 원문 유출(G3) · 키보드 조작(G4) · 두 축 분리(G5).
// 규칙을 설명하는 것보다 검사기가 낫다(브리프 §3 실행 팁).

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { CsatSteps } from '@/components/csat/CsatSteps'
import { Heatmap } from '@/components/csat/Heatmap'
import { ModePicker } from '@/components/csat/ModePicker'
import { AXIS } from '@/lib/csat/axes'
import { buildHeatmap, type Heatmap as HeatmapData } from '@/lib/csat/heatmap'
import { buildPriority } from '@/lib/csat/priority'
import { PatternBoard } from '../patterns/PatternBoard'
import { PriorityClient } from '../predict/PriorityClient'
import { BAND_LABEL, BAND_SAYS, type Band } from '@/lib/csat/priority'
import type { TrapEntry } from '@/lib/csat/trap-atlas'

// `usePathname` 은 라우터 밖에서 null 을 준다 — 컴포넌트가 그걸 견디는지도 함께 본다.
vi.mock('next/navigation', () => ({ usePathname: () => '/csat/map' }))

const mapData: HeatmapData = {
  ...buildHeatmap(
    [
      { typeId: 'R-BLANK', examId: '2024', hard: true },
      { typeId: 'R-BLANK', examId: '2024', hard: false },
      { typeId: 'R-BLANK', examId: '2025', hard: false },
      { typeId: 'R-TOPIC', examId: '2024', hard: false },
    ],
    [
      { id: 'R-BLANK', name: '빈칸 추론' },
      { id: 'R-TOPIC', name: '주제' },
      { id: 'R-MOOD', name: '심경' },
    ],
  ),
  exams: 30,
  error: null,
}

const TRAPS: TrapEntry[] = [
  {
    key: '어휘 함정',
    n: 389,
    recent: 173,
    items: 383,
    types: 17,
    by_type: {},
    by_type_recent: {},
    examples: [],
  },
  {
    key: '부분 사실',
    n: 200,
    recent: 90,
    items: 198,
    types: 8,
    by_type: {},
    by_type_recent: {},
    examples: [],
  },
]

const BANDS: Band[] = ['A', 'B', 'C', 'gone']
const bandInfo = BANDS.map((b) => ({ band: b, label: BAND_LABEL[b], says: BAND_SAYS[b] }))

const SCREENS: [string, string][] = [
  ['지형 히트맵', renderToStaticMarkup(<Heatmap data={mapData} />)],
  ['모드 선택', renderToStaticMarkup(<ModePicker />)],
  ['단계 레일', renderToStaticMarkup(<CsatSteps />)],
  ['패턴 보드', renderToStaticMarkup(<PatternBoard traps={TRAPS} />)],
  [
    '사정권',
    renderToStaticMarkup(
      <PriorityClient
        rows={buildPriority(mapData)}
        bands={bandInfo}
        hardMark={AXIS.hard.mark}
        hardFg={AXIS.hard.fg}
        formatFg={AXIS.format.fg}
      />,
    ),
  ],
]

/** 서로 인접한 `<p>` 가 몇 개까지 이어지는가. 브리프 G2 가 세는 것. */
function maxAdjacentP(html: string): number {
  // 여는 `<p` 와 그 사이의 다른 태그를 보고 연속 여부를 센다.
  const tags = html.match(/<\/?[a-z]+/gi) ?? []
  let run = 0
  let max = 0
  for (const t of tags) {
    if (t === '<p') {
      run += 1
      max = Math.max(max, run)
    } else if (t !== '</p') {
      run = 0
    }
  }
  return max
}

describe('G2 — 문단 나열 금지', () => {
  it.each(SCREENS)('%s 에 연속 <p> 가 3개 미만이다', (_name, html) => {
    expect(maxAdjacentP(html)).toBeLessThan(3)
  })
})

describe('G3 — 기출 원문이 렌더 트리에 없다', () => {
  // 지문·선지가 새면 반드시 영문 긴 덩어리로 나타난다. 우리 글은 한국어다.
  it.each(SCREENS)('%s 에 20낱말 이상 연속 영문이 없다', (_name, html) => {
    const text = html.replace(/<[^>]+>/g, ' ')
    const longEnglish = text.match(/(?:\b[A-Za-z][A-Za-z'’-]*\b[ ,;:]+){20,}/)
    expect(longEnglish?.[0] ?? null).toBeNull()
  })
})

describe('G4 — 주인공 객체가 키보드로 조작된다', () => {
  it('히트맵 칸이 button 이다 — div+onClick 이 아니다', () => {
    const html = SCREENS[0][1]
    expect(html).toContain('data-cell="0-0"')
    expect(html).toMatch(/<button[^>]*data-cell="0-0"/)
  })

  it('히트맵 칸마다 읽어 주는 이름이 있다', () => {
    expect(SCREENS[0][1]).toMatch(/aria-label="[^"]*빈칸 추론[^"]*문항/)
  })

  it('패턴 보드 항목이 button 이다', () => {
    expect(SCREENS[3][1]).toMatch(/<button[^>]*어휘 함정|어휘 함정[^<]*<\/span>/)
    expect(SCREENS[3][1]).toContain('<button')
  })

  it('사정권 슬라이더가 라벨을 가진 input 이다', () => {
    const html = SCREENS[4][1]
    expect(html).toContain('type="range"')
    expect(html).toContain('id="csat-depth"')
    expect(html).toContain('for="csat-depth"')
  })

  it('모든 화면에 조작 가능한 것이 하나 이상 있다 (브리프 A3)', () => {
    for (const [name, html] of SCREENS) {
      const has = /<button|<a |<input|<select/.test(html)
      expect(has, name).toBe(true)
    }
  })
})

describe('G5 — 두 축이 시각적으로 갈린다', () => {
  it('형식과 소재가 다른 색이다', () => {
    expect(AXIS.format.fg).not.toBe(AXIS.topic.fg)
  })

  it('히트맵의 유형 라벨이 형식 축 색을 쓴다', () => {
    expect(SCREENS[0][1]).toContain(AXIS.format.fg)
  })

  it('3점 표시가 색 말고 기호도 쓴다 — 색 단독 금지', () => {
    expect(SCREENS[0][1]).toContain(AXIS.hard.mark)
  })
})

describe('빈 상태는 다음 한 걸음이다 (A4 · D5)', () => {
  it('패턴 보드 내 묶음이 비면 무엇을 하면 되는지 적는다', () => {
    const html = SCREENS[3][1]
    expect(html).toContain('아직 비어 있어요')
    expect(html).toContain('눌러')
  })

  it('안 지은 단계는 링크가 아니다 — 빈 화면으로 보내지 않는다', () => {
    const html = SCREENS[2][1]
    expect(html).toContain('아직 열리지 않음')
    // ⑥⑦ 이 href 를 갖지 않는다.
    expect(html).not.toContain('href="/csat/train"')
    expect(html).not.toContain('href="/csat/review"')
  })
})

describe('E5 — 숫자는 분모와 함께', () => {
  it('히트맵 행 끝이 전체 문항 수를 든다', () => {
    expect(SCREENS[0][1]).toContain('>3<')
  })

  it('사정권이 최근/전체를 함께 적는다', () => {
    expect(SCREENS[4][1]).toMatch(/최근 \d+ \/ 전체 \d+/)
  })
})

describe('현재 단계 표시', () => {
  it('레일이 현재 칸에 aria-current 를 준다', () => {
    expect(SCREENS[2][1]).toContain('aria-current="step"')
  })
})
