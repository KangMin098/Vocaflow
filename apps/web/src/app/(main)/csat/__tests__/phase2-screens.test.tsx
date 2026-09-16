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
import { PriorityClient } from '../predict/PriorityClient'
import { BAND_LABEL, BAND_SAYS, type Band } from '@/lib/csat/priority'

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

const BANDS: Band[] = ['A', 'B', 'C', 'gone']
const bandInfo = BANDS.map((b) => ({ band: b, label: BAND_LABEL[b], says: BAND_SAYS[b] }))

const SCREENS: [string, string][] = [
  ['지형 히트맵', renderToStaticMarkup(<Heatmap data={mapData} />)],
  ['모드 선택', renderToStaticMarkup(<ModePicker />)],
  ['단계 레일', renderToStaticMarkup(<CsatSteps />)],
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

/**
 * 화면을 **이름으로** 집는다.
 *
 * ⚠️ 처음엔 SCREENS[3] 처럼 첨자로 집었는데, 화면 하나를 걷어내자 뒤 첨자가 통째로
 *   밀려 엉뚱한 화면을 검사했다(2026-09-16 · 「묶기」 제거). 목록 순서가 검사의 의미를
 *   바꾸면 안 된다.
 */
const S = (name: string): string => {
  const hit = SCREENS.find(([n]) => n === name)
  if (!hit) throw new Error('그런 화면이 없다: ' + name)
  return hit[1]
}

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
    const html = S('지형 히트맵')
    expect(html).toContain('data-cell="0-0"')
    expect(html).toMatch(/<button[^>]*data-cell="0-0"/)
  })

  it('히트맵 칸마다 읽어 주는 이름이 있다', () => {
    expect(S('지형 히트맵')).toMatch(/aria-label="[^"]*빈칸 추론[^"]*문항/)
  })

  it('사정권 슬라이더가 라벨을 가진 input 이다', () => {
    const html = S('사정권')
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
    expect(S('지형 히트맵')).toContain(AXIS.format.fg)
  })

  it('3점 표시가 색 말고 기호도 쓴다 — 색 단독 금지', () => {
    expect(S('지형 히트맵')).toContain(AXIS.hard.mark)
  })
})

describe('빈 상태는 다음 한 걸음이다 (A4 · D5)', () => {
  /**
   * ⚠️ 이 검사는 두 번 뒤집혔다. 처음엔 「⑥⑦ 이 링크가 아니어야 한다」였는데 그 둘이
   *   이미 있는 화면이었고(/csat/drill · /csat/plan), 다음엔 ⑦ 「내 기록」이 아직인 줄
   *   알았는데 그것도 이미 돌고 있었다. 지금 레일에는 **막힌 칸이 없다** — 그래서
   *   검사도 그렇게 적는다. 막힌 칸이 생기면 이 검사가 먼저 깨진다.
   */
  it('레일의 모든 칸이 실제로 갈 수 있는 링크다', () => {
    const html = S('단계 레일')
    expect(html).not.toContain('아직 열리지 않음')
    // 없는 라우트로 가는 칸이 없다. `/csat/patterns` 는 2026-09-16 에 걷어냈다
    // (`my-traps.ts` 와 같은 질문에 답해 잉여가 됐다 — `steps.ts` 머리말 참조).
    for (const dead of ['/csat/train', '/csat/review', '/csat/patterns', '/csat/item"']) {
      expect(html, dead).not.toContain(`href="${dead}`)
    }
    // 다섯 칸이 전부 <a> 다 — 지도·지형·사정권·겨루기·주파.
    expect((html.match(/<a /g) ?? []).length).toBe(5)
  })
})

describe('E5 — 숫자는 분모와 함께', () => {
  it('히트맵 행 끝이 전체 문항 수를 든다', () => {
    expect(S('지형 히트맵')).toContain('>3<')
  })

  it('사정권이 최근/전체를 함께 적는다', () => {
    expect(S('사정권')).toMatch(/최근 \d+ \/ 전체 \d+/)
  })
})

describe('현재 단계 표시', () => {
  it('레일이 현재 칸에 aria-current 를 준다', () => {
    expect(S('단계 레일')).toContain('aria-current="step"')
  })
})

/**
 * **v07 판면 — 제목은 세리프다.**
 *
 * `globals.css` 가 `h1~h6` 을 세리프(Lora/Hahmlet)로 깔아 두었다. 그런데 컴포넌트에
 * `font-display`(IBM Plex Sans)를 붙이면 그 기본값을 **되돌려** 산세리프가 된다.
 *
 * ⚠️ 실제로 그렇게 됐다(실측 2026-09-16). v07 적용 커밋이 페이지의 `h1` 은 고쳤는데
 *   같은 시각 내가 만들고 있던 컴포넌트(`ModePicker`·`PriorityClient`)는 못 보고 지나갔다.
 *   화면은 멀쩡히 뜨고 **제목만 다른 글꼴**이라, 나란히 놓고 보기 전에는 안 보인다.
 */
describe('v07 — 제목이 세리프 기본값을 되돌리지 않는다', () => {
  it('csat 화면·컴포넌트의 제목에 font-display 가 없다', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const roots = [
      path.resolve(__dirname, '..'),
      path.resolve(__dirname, '../../../../components/csat'),
    ]
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
        const full = path.join(dir, d.name)
        if (d.isDirectory()) return d.name === '__tests__' ? [] : walk(full)
        return /\.tsx$/.test(d.name) ? [full] : []
      })

    const offenders: string[] = []
    for (const file of roots.flatMap(walk)) {
      const src = fs.readFileSync(file, 'utf8')
      src.split('\n').forEach((line, i) => {
        // 제목 태그(h1~h6)나 제목 자리에 font-display 를 박은 줄.
        if (/font-display/.test(line) && /<h[1-6]|제목|title/i.test(line)) {
          offenders.push(`${path.basename(file)}:${i + 1}`)
        }
      })
    }
    expect(offenders, `세리프 기본값을 되돌린 제목: ${offenders.join(' · ')}`).toEqual([])
  })
})

/**
 * **격자는 탭 정거장 하나다** (roving tabindex · WAI-ARIA grid).
 *
 * ⚠️ 처음엔 364칸(26유형 × 14연도)이 **전부** 탭 정거장이었다. 화살표 이동을 붙여 놓아서
 *   「키보드로 된다」고 여겼는데, 격자를 **지나가려면** Tab 을 364번 눌러야 했다.
 *   계측기의 「컨트롤 364」가 알려 줬다(실측 2026-09-16 · 브라우저 재확인: 1/364).
 */
describe('히트맵 — 탭 정거장은 하나', () => {
  const html = S('지형 히트맵')

  it('칸은 여럿인데 tabindex=0 은 하나뿐이다', () => {
    const cells = html.match(/data-cell="/g) ?? []
    const stops = html.match(/tabindex="0"/gi) ?? []
    expect(cells.length).toBeGreaterThan(1)
    expect(stops.length).toBe(1)
  })

  it('나머지 칸은 tabindex=-1 로 건너뛴다', () => {
    const skipped = html.match(/tabindex="-1"/gi) ?? []
    const cells = html.match(/data-cell="/g) ?? []
    expect(skipped.length).toBe(cells.length - 1)
  })

  it('증명 표식이 붙어 있다 — 계측기가 div 격자를 못 보던 것', () => {
    expect(html).toContain('data-proof="heatmap"')
  })
})
