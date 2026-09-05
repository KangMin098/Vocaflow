// apps/web/src/app/admin/csat/__tests__/line-screens.test.tsx
//
// 생산 라인 네 화면 + **공정 정본과 화면·도움말이 어긋나지 않는지**.
//
// 이 저장소가 실제로 겪은 사고를 겨냥한다: 탭 라벨만 바꿔서 도움말이 조용히 사라졌고,
// null 을 0 으로 그려 "지적 0건" 이라는 거짓 안심이 떴다. 둘 다 화면은 멀쩡해 보이는데
// 관리자가 잘못 조작하게 만드는 종류라 렌더 테스트로 못 박는다.

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { HELP_REGISTRY } from '@/lib/admin/help'
import { FACTORY_STAGES } from '@/lib/csat/factory-model'
import {
  emptyGateBands,
  offLadderCount,
  type AuthorView,
  type PressView,
  type ReviewView,
  type SourceView,
} from '@/lib/csat/factory-line-model'

import { AuthorClient } from '../authoring/AuthorClient'
import { PressClient } from '../press/PressClient'
import { ReviewClient } from '../review/ReviewClient'
import { foldBands } from '../sourcing/BandStrip'
import { SourceClient } from '../sourcing/SourceClient'

const text = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '')

/* ── 공정 정본 ↔ 화면 ↔ 도움말 ── */

describe('공정 정본과 화면·도움말이 어긋나지 않는다', () => {
  const withScreen = FACTORY_STAGES.filter((s) => s.href)

  it.each(withScreen.map((s) => [s.name, s.href!] as const))(
    '%s 화면 파일이 실제로 있다 (%s)',
    (_name, href) => {
      const seg = href.replace('/admin/csat', '').replace(/^\//, '')
      const dir = resolve(__dirname, '..', seg)
      expect(existsSync(resolve(dir, 'page.tsx')), `${href} 에 page.tsx 가 없다`).toBe(true)
    },
  )

  it('공정 8칸 중 전용 화면이 붙은 칸의 수를 고정한다 — 줄면 회귀다', () => {
    // 해설(⑥)만 전용 화면이 없다. 유형별 해설 보유율은 집계 RPC 가 있어야 잴 수 있고,
    // 그것은 마이그레이션이라 승인 대기다. 붙는 순간 이 수가 8이 된다.
    expect(withScreen).toHaveLength(7)
    expect(FACTORY_STAGES.filter((s) => !s.href).map((s) => s.id)).toEqual(['explain'])
  })

  it('레지스트리에 공정 화면 도움말이 다 있다 — 없으면 도움말 버튼이 빈손이다', () => {
    for (const s of withScreen) {
      const key = s.href === '/admin/csat' ? 'csat' : `csat-${s.href!.split('/').pop()}`
      expect(HELP_REGISTRY[key], `${s.name}(${key}) 도움말이 없다`).toBeTruthy()
    }
    expect(HELP_REGISTRY['csat']).toBeTruthy()
  })
})

/* ── ④ 소재 ── */

const source: SourceView = {
  rows: [
    { band: 'S1', vLevel: 2, count: 15, displayOnly: 0, licenseClasses: ['pd'], cefrLevels: ['A2'] },
    { band: 'S3', vLevel: 5, count: 205, displayOnly: 15, licenseClasses: ['pd', 'cc-by'], cefrLevels: ['B1'] },
  ],
  gateBands: ['S1', 'S2', 'S3', 'S4', 'S5'],
  loadError: null,
}

describe('SourceClient', () => {
  it('게이트는 있는데 지문이 0편인 밴드를 지목한다', () => {
    const html = text(renderToString(<SourceClient {...source} />))
    // 예전에는 빈 밴드 이름을 글로 열거했는데, 띠가 같은 것을 보여 주므로 지웠다(중복).
    // 지금은 「몇 단계가 막혔는가」 + 띠의 「게이트 있는데 0편」 칸이 그 말을 한다.
    expect(html).toContain('3단계는 지금 책을 못 만든다')
    expect(html).toContain('게이트 있는데 0편')
  })

  it('화면 전용 지문을 재고에서 빼고 센다 — 넣으면 있지도 않은 여유를 믿게 된다', () => {
    const html = text(renderToString(<SourceClient {...source} />))
    expect(html).toContain('(−15)')
    expect(html).toContain('190') // 205 − 15
  })

  it('모든 게이트 밴드에 지문이 있으면 그렇게 말한다', () => {
    const full: SourceView = {
      ...source,
      gateBands: ['S1', 'S3'],
    }
    const html = text(renderToString(<SourceClient {...full} />))
    expect(html).toContain('모두 지문이 있다')
  })
})

describe('emptyGateBands', () => {
  it('지문이 0편인 게이트 밴드만 낸다', () => {
    expect(emptyGateBands(source)).toEqual(['S2', 'S4', 'S5'])
  })

  it('게이트가 없는 밴드는 세지 않는다 — 합격선이 없으면 막힌 것이 아니다', () => {
    expect(emptyGateBands({ rows: [], gateBands: [] })).toEqual([])
  })
})

/* ── ⑤ 집필 ── */

const author: AuthorView = {
  cells: [
    { type: 'order', vLevel: 5, count: 4807 },
    { type: 'order', vLevel: 9, count: 3 },
    { type: 'title', vLevel: 5, count: 17 },
    { type: 'insert', vLevel: 5, count: null },
  ],
  total: 4827,
  ladderCells: [{ type: 'order', vLevel: 5 }],
  loadError: null,
}

describe('offLadderCount', () => {
  it('사다리가 안 쓰는 칸의 재고만 더한다', () => {
    // order/V9(3) + title/V5(17) = 20. insert/V5 는 못 센 칸이라 0 으로 센다.
    expect(offLadderCount(author)).toBe(20)
  })

  it('전부 사다리 안이면 0', () => {
    expect(
      offLadderCount({
        cells: [{ type: 'order', vLevel: 5, count: 100 }],
        ladderCells: [{ type: 'order', vLevel: 5 }],
      }),
    ).toBe(0)
  })
})

describe('AuthorClient', () => {
  it('사다리 밖 재고를 전체 대비 비율과 함께 지목한다', () => {
    const html = text(renderToString(<AuthorClient {...author} />))
    expect(html).toContain('사다리 밖 재고')
    expect(html).toContain('20')
    expect(html).toContain('어느 권에도 안 실리는')
  })

  it('못 센 칸은 「?」이고 재고 0 은 「—」이다 — 같은 글자면 관리자가 구멍을 오해한다', () => {
    const html = text(renderToString(<AuthorClient {...author} />))
    expect(html).toContain('?')
    expect(html).toContain('—')
  })

  it('목록이 낡았다는 경고를 role=alert 로 올린다', () => {
    const html = text(
      renderToString(<AuthorClient {...author} loadError="유형 목록이 낡았다 — 다 셌는데도 5개가 표 밖이다" />),
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('유형 목록이 낡았다')
  })

  it('총계를 못 셌으면 0 이 아니라 「못 잼」이라고 적는다', () => {
    const html = text(renderToString(<AuthorClient {...author} total={null} />))
    expect(html).toContain('못 잼')
  })
})

/* ── ⑦ 검수 ── */

const review: ReviewView = {
  layers: [
    { id: 'L1', name: '기계 게이트', looksAt: '인용 대조', passed: 7, total: 7, unmeasuredReason: null, cmd: 'node a.mjs' },
    { id: 'L2', name: '3인 페르소나', looksAt: '전원 pass', passed: 802, total: 802, unmeasuredReason: null, cmd: 'node b.mjs' },
    { id: 'L3', name: '교차 대조', looksAt: '정답 쏠림', passed: 3, total: 7, unmeasuredReason: null, cmd: 'node c.mjs' },
    { id: 'L4', name: '외부 대조', looksAt: '시중 7축', passed: null, total: null, unmeasuredReason: '기획 화면이 잰다', cmd: 'node d.mjs' },
  ],
  volumes: [
    {
      band: 6,
      volumeTitle: 'Vol 5',
      items: 60,
      autoPassed: 5,
      autoTotal: 6,
      failedChecks: ['지문 규격'],
      answerBias: { chi2: 3.2, cramersV: 0.04, biased: false },
      proofread: { passages: 20, defective: 0 },
      passageSpec: '90~200어',
    },
    {
      band: 2,
      volumeTitle: 'Vol 1',
      items: 60,
      autoPassed: 6,
      autoTotal: 6,
      failedChecks: [],
      answerBias: null,
      proofread: null,
      passageSpec: null,
    },
  ],
  loadError: null,
}

describe('ReviewClient', () => {
  it('층마다 「보는 것」을 함께 적는다 — 겹치지 않아야 다층이 의미가 있다', () => {
    const html = text(renderToString(<ReviewClient {...review} />))
    for (const l of review.layers) expect(html).toContain(l.looksAt)
  })

  it('통과한 층을 전체 층 수와 함께 낸다 — 한 층 통과가 통과로 읽히면 안 된다', () => {
    const html = text(renderToString(<ReviewClient {...review} />))
    expect(html).toContain('2 / 4')
    expect(html).toContain('1개 층은 아직 안 쟀다')
  })

  it('「기록 없음」과 「지적 0건」을 가른다', () => {
    const html = text(renderToString(<ReviewClient {...review} />))
    expect(html).toContain('기록 없음') // Vol 1 — 검사가 안 돌았다
    expect(html).toContain('0/20') // Vol 5 — 돌았는데 깨끗했다
    expect(html).toContain('균등')
  })

  it('조판된 권이 없으면 검수할 원고가 없다고 말한다', () => {
    const html = text(renderToString(<ReviewClient {...review} volumes={[]} />))
    expect(html).toContain('검수할 원고가 아직 없다')
  })
})

/* ── ⑧ 조판 ── */

const press: PressView = {
  volumes: [
    {
      band: 6,
      volumeTitle: 'Vol 5',
      step: 6,
      schoolBand: '고2',
      units: 20,
      items: 60,
      missingExplanations: 0,
      typeMixFit: 0.91,
      distinctVolumes: 12,
      articlesWithItems: 1757,
      articlesIdle: 8235,
      brandCurrent: true,
      renderCount: 3,
      renderedAt: '2026-09-01T00:00:00Z',
      outPath: 'volume-v6.html',
    },
    {
      band: 1,
      volumeTitle: 'Starter',
      step: 1,
      schoolBand: '초등 저학년',
      units: 20,
      items: 60,
      missingExplanations: 4,
      typeMixFit: null,
      distinctVolumes: null,
      articlesWithItems: null,
      articlesIdle: null,
      brandCurrent: false,
      renderCount: 1,
      renderedAt: null,
      outPath: null,
    },
  ],
  rungs: 7,
  brandFingerprint: 'abcdef0123456789',
  loadError: null,
}

describe('PressClient', () => {
  it('조판된 계단을 사다리 전체와 함께 낸다', () => {
    const html = text(renderToString(<PressClient {...press} />))
    expect(html).toContain('2 / 7')
  })

  it('옛 규격으로 찍힌 권을 센다', () => {
    const html = text(renderToString(<PressClient {...press} />))
    expect(html).toContain('옛 규격')
  })

  it('해설 안 붙은 문항을 합쳐 경고한다 — 0 이 아니면 해설 빠진 책이 나간다', () => {
    const html = text(renderToString(<PressClient {...press} />))
    expect(html).toContain('해설 안 붙은 문항')
    expect(html).toContain('해설 빠진 책이 나간다')
  })

  it('못 잰 항목을 0 으로 그리지 않는다', () => {
    const html = text(renderToString(<PressClient {...press} />))
    expect(html).toContain('못 잼')
    expect(html).toContain('해당 없음')
  })

  it('문항 없는 원글이 있으면 집필보다 그것이 먼저라고 말한다', () => {
    const html = text(renderToString(<PressClient {...press} />))
    expect(html).toContain('store-new-types')
    expect(html).toContain('8,235')
  })

  it('조판된 권이 없으면 그 사실을 말한다', () => {
    const html = text(renderToString(<PressClient {...press} volumes={[]} />))
    expect(html).toContain('여기까지 와야 책이다')
  })
})

/* ── 드레인 지도: 어느 공정이 Claude Code 몫인가 ── */

describe('공정별 드레인 절차가 있어야 할 곳에만 있다', () => {
  // LLM 이 실제로 판단해야 하는 공정. 나머지 셋은 결정적이다:
  //   ③ 설계 = 코드 상수(series.ts) · ④ 소재 = 수확·규격 프로브 · ⑧ 조판 = 조합·렌더
  // 없어야 할 곳에 드레인을 적으면 "배치를 돌리면 된다" 는 오해를 만들고,
  // 있어야 할 곳에 없으면 관리자가 터미널에서 막힌다.
  const LLM_STAGES = ['csat', 'csat-strategy', 'csat-authoring', 'csat-review', 'csat-evidence']
  const DETERMINISTIC = ['csat-blueprint', 'csat-sourcing', 'csat-press']

  it.each(LLM_STAGES)('%s 에 드레인 절차가 있다', (key) => {
    expect(HELP_REGISTRY[key]?.screen.drain, `${key} 에 drain 이 없다`).toBeTruthy()
  })

  it.each(DETERMINISTIC)('%s 에는 드레인 절차가 없다 — 결정적 공정이다', (key) => {
    expect(HELP_REGISTRY[key]?.screen.drain, `${key} 는 LLM 몫이 아닌데 drain 이 붙었다`).toBeUndefined()
  })

  it('현황판의 드레인 지도가 공정 8칸을 모두 언급한다 — 빠지면 그 칸은 아무도 안 본다', () => {
    const map = HELP_REGISTRY['csat']!.screen.drain!
    expect(map.procedure).toHaveLength(FACTORY_STAGES.length)
    for (const s of FACTORY_STAGES) {
      const named = map.procedure.some((step) => step.title.includes(s.name))
      expect(named, `드레인 지도에 「${s.name}」 칸이 없다`).toBe(true)
    }
  })

  it('드레인 지도가 각 칸을 Claude Code 몫인지 아닌지로 가른다', () => {
    const map = HELP_REGISTRY['csat']!.screen.drain!
    const marked = map.procedure.filter((s) => /Claude Code 몫/.test(s.title))
    // 8칸 전부가 "몫" 또는 "몫 아님" 으로 표시돼야 한다 — 애매하게 두면 오해가 생긴다
    expect(marked).toHaveLength(FACTORY_STAGES.length)
  })

  it('모든 드레인 절차가 재실행 안전 여부나 되돌릴 수 없음을 말한다 (CLAUDE.md §3️⃣)', () => {
    for (const key of LLM_STAGES) {
      const d = HELP_REGISTRY[key]!.screen.drain!
      const text = d.procedure.map((s) => s.detail).join(' ')
      expect(
        /재실행 안전|읽기만|덮어쓴다|덮지 않고|되돌릴 수 없/.test(text),
        `${key} 드레인이 재실행 안전 여부를 말하지 않는다`,
      ).toBe(true)
    }
  })

  it('드레인이 내미는 scripts/ 경로가 저장소에 실제로 있다', () => {
    const REPO_ROOT = resolve(__dirname, '../../../../../../..')
    const seen = new Set<string>()
    for (const key of LLM_STAGES) {
      const d = HELP_REGISTRY[key]!.screen.drain!
      const blob = [
        d.what,
        ...d.prerequisites,
        ...d.procedure.flatMap((s) => [s.detail, s.done ?? '']),
        ...d.verify,
        ...(d.recovery ?? []),
      ].join(' ')
      for (const m of blob.matchAll(/(scripts\/[\w./-]+\.(?:mjs|mts|ts|js))/g)) seen.add(m[1]!)
    }
    expect(seen.size).toBeGreaterThanOrEqual(8)
    for (const rel of seen) {
      expect(existsSync(resolve(REPO_ROOT, rel)), `${rel} 가 없다`).toBe(true)
    }
  })
})

/* ── ⑦ 검수 — 층 도식 ── */

describe('ReviewStack — 카드 넷이 아니라 위에서 아래로 쌓인 체', () => {
  it('층마다 모양(svg)이 붙는다 — 색약에서 초록↔주황이 겹치므로 색만으로 말하지 않는다', () => {
    const html = renderToString(<ReviewClient {...review} />)
    // 층 4개 = 모양 4개 이상 (도움말 아이콘 등이 더 있을 수 있다)
    expect((html.match(/<svg/g) ?? []).length).toBeGreaterThanOrEqual(review.layers.length)
  })

  it('처음 걸리는 층 아래는 흐리게 그리고 그 뜻을 적는다 — 아래 층 수치는 통과율이 아니다', () => {
    const html = renderToString(<ReviewClient {...review} />)
    // L3 이 3/7 로 처음 걸리므로 L4 는 「아래」다.
    expect(html).toContain('opacity-55')
    expect(text(html)).toContain('여기까지 오지 않는다')
  })

  it('전 층 통과면 흐린 층이 없다', () => {
    const allPass = {
      ...review,
      layers: review.layers.map((l) => ({ ...l, passed: 5, total: 5, unmeasuredReason: null })),
    }
    const html = renderToString(<ReviewClient {...allPass} />)
    expect(html).not.toContain('opacity-55')
    expect(text(html)).not.toContain('여기까지 오지 않는다')
  })

  it('명령은 접혀 있다 — 층이 무엇을 보는지가 먼저, 어떻게 돌리는지는 깊이다', () => {
    const html = renderToString(<ReviewClient {...review} />)
    expect((html.match(/<details/g) ?? []).length).toBeGreaterThanOrEqual(review.layers.length)
    for (const l of review.layers) expect(text(html)).toContain(l.looksAt)
  })

  it('못 잰 층은 0% 가 아니라 「못 잼」과 이유다', () => {
    const html = text(renderToString(<ReviewClient {...review} />))
    expect(html).toContain('못 잼')
    expect(html).toContain('기획 화면이 잰다')
    expect(html).not.toContain('(0%)')
  })
})

/* ── ⑧ 조판 — 사다리 채움 띠 ── */

describe('LadderFill — 「N / 7」을 계단으로', () => {
  it('계단 수만큼 칸을 그리고, 빈 계단을 「비어 있음」이라고 적는다', () => {
    const html = text(renderToString(<PressClient {...press} />))
    // press 표본은 7단 중 6단·1단만 조판됐다 → 나머지 5칸이 비어 있음
    expect((html.match(/비어 있음/g) ?? []).length).toBeGreaterThanOrEqual(5)
    expect(html).toContain('고2')
    expect(html).toContain('초등 저학년')
  })

  it('옛 규격으로 찍힌 계단을 글자로도 가른다 — 색만 다르면 색약에서 같아 보인다', () => {
    const html = text(renderToString(<PressClient {...press} />))
    expect(html).toContain('옛 규격')
    expect(html).toContain('조판됨')
  })

  it('해설 안 붙은 권에 표시를 얹는다 — 그대로 나가면 해설 빠진 책이다', () => {
    const html = renderToString(<PressClient {...press} />)
    // 1단(Starter)에 해설 없음 4 → 빨간 점 하나
    expect(html).toContain('해설 없음 4')
    expect(html).toContain('bg-[#9C3A30]')
  })

  it('접근성 이름에 채움 비율을 적는다', () => {
    const html = renderToString(<PressClient {...press} />)
    expect(html).toContain('aria-label="학령 사다리 7단 중 2단 조판됨"')
  })

  it('조판된 권이 없어도 7칸을 다 그린다 — 빈 사다리가 곧 할 일 목록이다', () => {
    const html = text(renderToString(<PressClient {...press} volumes={[]} />))
    expect((html.match(/비어 있음/g) ?? []).length).toBeGreaterThanOrEqual(7)
  })
})

/* ── ④ 소재 — 밴드 띠 ── */

describe('BandStrip', () => {
  it('밴드별로 접는다 — 표는 (밴드 × 수준) 이라 한 밴드가 여러 줄에 흩어져 있다', () => {
    const folded = foldBands(source.rows, source.gateBands)
    expect(folded.map((b) => b.band)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5'])
    // S3 는 205편 중 화면 전용 15 → 쓸 수 있는 것 190
    expect(folded.find((b) => b.band === 'S3')!.usable).toBe(190)
  })

  it('게이트가 있는데 0편인 밴드를 지목한다 — 그 단계 책은 지금 못 만든다', () => {
    const html = text(renderToString(<SourceClient {...source} />))
    expect(html).toContain('게이트 있는데 0편')
  })

  it('화면 전용 지문을 막대에서 뺀다 — 넣으면 있지도 않은 여유를 믿게 된다', () => {
    const folded = foldBands(
      [{ band: 'S3', vLevel: 5, count: 100, displayOnly: 40, licenseClasses: [], cefrLevels: [] }],
      ['S3'],
    )
    expect(folded[0]!.usable).toBe(60)
    expect(folded[0]!.displayOnly).toBe(40)
  })

  it('게이트가 없는 밴드도 재고가 있으면 보여 준다 — 다만 흐리게', () => {
    const folded = foldBands(
      [{ band: 'S9', vLevel: 1, count: 5, displayOnly: 0, licenseClasses: [], cefrLevels: [] }],
      ['S1'],
    )
    expect(folded.find((b) => b.band === 'S9')!.gated).toBe(false)
    expect(folded.find((b) => b.band === 'S1')!.gated).toBe(true)
  })
})
