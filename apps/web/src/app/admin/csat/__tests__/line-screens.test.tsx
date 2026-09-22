// apps/web/src/app/admin/csat/__tests__/line-screens.test.tsx
//
// 생산 라인 네 화면 + **공정 정본과 화면·도움말이 어긋나지 않는지**.
//
// 이 저장소가 실제로 겪은 사고를 겨냥한다: 탭 라벨만 바꿔서 도움말이 조용히 사라졌고,
// null 을 0 으로 그려 "지적 0건" 이라는 거짓 안심이 떴다. 둘 다 화면은 멀쩡해 보이는데
// 관리자가 잘못 조작하게 만드는 종류라 렌더 테스트로 못 박는다.

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { HELP_REGISTRY } from '@/lib/admin/help'
import type { KidSourcePanel } from '@/lib/textbook/kid-source-stats'
import { FACTORY_STAGES } from '@/lib/csat/factory-model'
import {
  offLadderCount,
  type AuthorView,
  type PressView,
  type ReviewView,
} from '@/lib/csat/factory-line-model'
import {
  bandStock,
  emptyPassageBands,
  passageGateBands,
  type SourceRollup,
  type StageGateRow,
} from '@vocaflow/library-pipeline/source-rollup'
import { SOURCE_CONSOLE_REAL } from '@/lib/csat/__tests__/fixtures'

import { AuthorClient } from '../authoring/AuthorClient'
import { PressClient } from '../press/PressClient'
import { ReviewClient } from '../review/ReviewClient'
import { bandState } from '../sourcing/BandStrip'
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

/** ④ 소재가 TBP 에서 넘겨받은 패널. 이 테스트들은 지문 재고만 보므로 빈 값으로 둔다. */
const kidSource: KidSourcePanel = { inventory: null, error: null }

const view = SOURCE_CONSOLE_REAL

/** 렌더만 보는 테스트라 액션은 안 부른다 — 누르는 경로는 통합 테스트의 몫이다. */
const noRetake = async () => ({ ok: true })

describe('SourceClient', () => {
  it('지문으로 채우는 밴드가 비면 지목한다', () => {
    const blocked = {
      ...view,
      emptyBands: ['S2'],
      bands: view.bands.map((b) => (b.band === 'S2' ? { ...b, n: 0, inMarket: 0 } : b)),
    }
    const html = text(renderToString(<SourceClient view={blocked} kidSource={kidSource} onRetake={noRetake} />))
    expect(html).toContain('S2 자동화 다독')
    expect(html).toContain('지문이 0편이다')
  })

  /**
   * **이 화면의 옛 결함.** S5 의 합격선은 `listening` 하나뿐이라 지문을 수확해서 채우는
   * 칸이 아닌데, 「합격선이 있는데 0편」 규칙 하나로 판정해 늘 빨갛게 서 있었다. 수확을
   * 아무리 해도 안 꺼지는 경보는 옆의 진짜 경보까지 안 보이게 만든다.
   */
  it('오디오 축 밴드를 「막힘」으로 세지 않는다', () => {
    const html = text(renderToString(<SourceClient view={view} kidSource={kidSource} onRetake={noRetake} />))
    expect(view.emptyBands).not.toContain('S5')
    expect(html).toContain('지문을 수확해서 채우는 칸이 아니다')
    expect(html).not.toContain('S5 병행 듣기 는 지문이 0편이다')
  })

  /** 562편(발행분)을 「지문 재고」라 부르던 것이 분모 사고의 시작이었다. */
  it('출고분을 재고라 부르지 않는다', () => {
    const html = text(renderToString(<SourceClient view={view} kidSource={kidSource} onRetake={noRetake} />))
    expect(html).toContain('학습자에게 나간 것')
    expect(html).toContain('출고분이지 조판이 고르는 풀이 아니다')
    // 분모는 조판 풀이어야 한다 — 출고분(250·312)이 아니라.
    expect(html).toContain('87,556')
  })

  it('잰 시각과 직전 대비 증감을 함께 낸다 — 낡은 값을 최신인 척 보이지 않는다', () => {
    const html = text(renderToString(<SourceClient view={view} kidSource={kidSource} onRetake={noRetake} />))
    expect(html).toMatch(/잰 값/)
    expect(html).toContain('+312')
  })

  it('스냅샷이 없으면 「0편」이 아니라 「안 쟀다」라고 말한다', () => {
    const none = { ...view, rollup: null, bands: [], delta: null }
    const html = text(renderToString(<SourceClient view={none} kidSource={kidSource} onRetake={noRetake} />))
    expect(html).toContain('아직 한 번도 안 쟀다')
    expect(html).toContain('0편이 아니다')
  })

  it('등록부와 어긋난 원천을 화면에 낸다 — 감사 결과가 코드에만 있으면 아무도 안 본다', () => {
    const html = text(renderToString(<SourceClient view={view} kidSource={kidSource} onRetake={noRetake} />))
    expect(html).toContain('등록부에 없는 원천')
    expect(html).toContain('frontiers')
  })
})

/* ── ④ 소재 — 밴드 셈법 정본 ── */

/** 실제 `csat_stage_gates`(2026-09-15 실측)의 모양. S5 만 오디오 축이다. */
const GATES: StageGateRow[] = [
  { stage: 'S1', metric: 'coverage' },
  { stage: 'S1', metric: 'wpm' },
  { stage: 'S2', metric: 'coverage' },
  { stage: 'S3', metric: 'coverage' },
  { stage: 'S3', metric: 'item_accuracy' },
  { stage: 'S4', metric: 'coverage' },
  { stage: 'S5', metric: 'listening' },
]

const rollupOf = (vlevels: SourceRollup['vlevels']): SourceRollup => ({
  ...(SOURCE_CONSOLE_REAL.rollup as SourceRollup),
  vlevels,
})

describe('bandStock — 무엇이 지문 밴드인가', () => {
  it('합격선이 듣기뿐인 밴드는 지문 밴드가 아니다', () => {
    expect(passageGateBands(GATES)).toEqual(['S1', 'S2', 'S3', 'S4'])
    const stock = bandStock(rollupOf([{ v: 8, n: 10, wcMed: 900, inMarket: 4, inRepo: 3 }]), GATES)
    expect(stock.find((b) => b.band === 'S5')!.audioOnly).toBe(true)
    expect(emptyPassageBands(stock)).not.toContain('S5')
  })

  it('지문으로 채워야 하는데 0편인 밴드는 잡는다', () => {
    const stock = bandStock(rollupOf([{ v: 8, n: 10, wcMed: 900, inMarket: 4, inRepo: 3 }]), GATES)
    expect(emptyPassageBands(stock)).toEqual(['S1', 'S2', 'S3'])
  })

  /** 목록(`['S5']`)이 아니라 규칙이라서 — 게이트가 바뀌면 판정도 그날 바뀐다. */
  it('S5 에 지문 합격선이 붙는 날 자동으로 지문 밴드가 된다', () => {
    const later = [...GATES, { stage: 'S5', metric: 'coverage' }]
    expect(passageGateBands(later)).toContain('S5')
    const stock = bandStock(rollupOf([]), later)
    expect(stock.find((b) => b.band === 'S5')!.audioOnly).toBe(false)
    expect(emptyPassageBands(stock)).toContain('S5')
  })

  it('수준 미부여를 S2 로 몰래 넣지 않는다 — 뷰가 하던 짓이다', () => {
    const stock = bandStock(
      rollupOf([{ v: null, n: 77, wcMed: null, inMarket: 0, inRepo: 0 }]),
      GATES,
    )
    expect(stock.find((b) => b.band === 'S2')!.n).toBe(0)
    expect(stock.find((b) => b.band === '미분류')!.n).toBe(77)
  })

  it('밴드 칸의 상태는 색보다 먼저 정해진다', () => {
    expect(
      bandState({ band: 'S5', gated: false, audioOnly: true, n: 0, inMarket: 0, inRepo: 0 }),
    ).toBe('audio')
    expect(
      bandState({ band: 'S2', gated: true, audioOnly: false, n: 0, inMarket: 0, inRepo: 0 }),
    ).toBe('blocked')
    expect(
      bandState({ band: 'S2', gated: true, audioOnly: false, n: 9, inMarket: 2, inRepo: 1 }),
    ).toBe('stocked')
    expect(
      bandState({ band: '미분류', gated: false, audioOnly: false, n: 9, inMarket: 2, inRepo: 1 }),
    ).toBe('ungated')
  })
})

/* ── ④ 소재 — 분모 ── */

describe('④ 소재의 분모', () => {
  /**
   * `csat_stage_catalog` 는 뷰이고 양쪽 갈래가 다 `status = published` 다. 그것으로 세던
   * 562편은 **출고분**이었고 조판 풀의 0.6% 였다(실측 2026-09-13: 87,556편). 되돌아가면
   * 화면은 멀쩡히 뜨고 수만 조용히 200분의 1 이 된다 — 그래서 조회 자체를 막는다.
   */
  it('발행분 뷰로 재고를 세지 않는다', () => {
    const ROOT = resolve(__dirname, '../../../../../../..')
    const files = [
      'apps/web/src/lib/csat/factory.ts',
      'apps/web/src/lib/csat/factory-line-views.ts',
      'apps/web/src/app/admin/csat/sourcing/page.tsx',
      'apps/web/src/app/admin/csat/sourcing/SourceClient.tsx',
    ]
    for (const rel of files) {
      const src = readFileSync(resolve(ROOT, rel), 'utf8')
      // 묘비명(주석)에 이름이 남는 것은 좋다 — **조회**가 있으면 안 된다.
      expect(src, `${rel} 이 발행분 뷰를 다시 읽는다`).not.toMatch(
        /from\(\s*['"]csat_stage_catalog['"]/,
      )
    }
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
  inventoryAt: null,
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
      // 쟀고, 셋이 봤지만 통과가 아닌 문항이 있다 — 「덜 봤다」와 구별돼야 한다.
      personaReview: { quorum: 3, items: 60, passed: 41, settled: 47 },
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
      // 옛 조판 기록 — 이 눈금이 붙기 전에 찍힌 권이다. 0 이 아니라 못 잼이다.
      personaReview: null,
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

  /**
   * **3인 검수는 「덜 봤다」와 「봤는데 막혔다」를 갈라야 한다** — 할 일이 정반대다.
   *
   * 이 칸이 붙기 전, ⑦ 화면의 L2 눈금은 `csat_coverage()`(기출 분석)를 세고 있었다.
   * 기출은 3인 검수 6,702행을 받았고 학습자가 실제로 받는 교재 문항은 0건이었는데,
   * 화면은 기출 수를 읽어 초록이었다(실측 2026-09-13).
   */
  it('권마다 3인 검수를 분자/분모로 내고, 막힌 수를 따로 적는다', () => {
    const html = text(renderToString(<ReviewClient {...review} />))
    // 41/60 통과 · 47이 판정까지 갔으므로 6건이 「봤는데 막힘」이다.
    expect(html).toContain('41/60')
    expect(html).toContain('6건 막힘')
  })

  it('검수 실측이 없는 권은 0 이 아니라 「기록 없음」이다', () => {
    const only = { ...review, volumes: review.volumes.filter((v) => v.personaReview == null) }
    const html = text(renderToString(<ReviewClient {...only} />))
    expect(html).toContain('기록 없음')
    // 0/60 으로 적으면 「검수가 전부 떨어졌다」로 읽힌다 — 아직 안 쟀다는 뜻인데.
    expect(html).not.toContain('0/60')
  })

  it('셋이 본 것과 통과가 같으면 막힌 수를 적지 않는다 — 없는 지적을 만들지 않는다', () => {
    const done = {
      ...review,
      volumes: [{ ...review.volumes[0]!, personaReview: { quorum: 3, items: 60, passed: 60, settled: 60 } }],
    }
    const html = text(renderToString(<ReviewClient {...done} />))
    expect(html).toContain('60/60')
    expect(html).not.toContain('막힘')
  })
})

/* ── ⑧ 조판 ── */

const press: PressView = {
  volumes: [
    {
      band: 6,
      series: 'reading',
      publish: { status: 'published', reason: null, at: '2026-09-02T00:00:00Z', by: 'claude' },
      personaBlocked: 0,
      autoPassed: 10,
      autoTotal: 10,
      reach: { href: '/library/textbooks/reading/6', hasContents: true },
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
      series: 'vocab',
      // 아무도 판정한 적이 없다 — 'rendered' 로 채우면 「사람이 그렇게 판정했다」가 된다.
      publish: null,
      personaBlocked: null,
      // 자동 검사가 **안 돌았다** — 0/0 은 「통과」가 아니라 「못 잼」이다.
      autoPassed: 0,
      autoTotal: 0,
      reach: { href: '/library/textbooks/vocab/1', hasContents: false },
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
  brand: {
    rows: [
      { key: 'ink', label: '본문 잉크', light: '#1A1714', dark: '#F0EAE0' },
      { key: 'rule', label: '괘선 — 표·구분선', light: '#E0DBD0', dark: '#3D362D' },
    ],
    fonts: { english: 'Lora, serif', body: 'DM Sans, sans-serif', mono: 'JetBrains Mono, monospace' },
  },
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

  /**
   * ⚠️ **이 검사는 6일 동안 빨간불이었다** (실측 2026-09-13에 발견).
   *
   * 「결정적 공정에는 drain 이 **없어야 한다**」로 적혀 있었는데, 2026-09-07 에 ④ 소재로
   * 수확 절차(World Bank·Frontiers·NIST)가 들어오면서 깨졌다(`173b4535`). 목록은 09-05 판
   * 그대로였다 — **코드가 늘었는데 분류가 안 따라온 것**이고, 그동안 아무도 이 빨간불을
   * 치우지 않았다.
   *
   * 그래서 규칙을 **뜻대로** 고친다. 위 주석이 말하는 해는 「drain 이 있다」가 아니라
   * 「**Claude Code 배치를 돌리면 된다는 오해**」다. 수확 절차는 터미널 명령뿐이고 청크를
   * 내보내 채워 넣는 단계가 없으므로 그 오해를 만들지 않는다 — 지우면 실제로 쓰이는
   * 절차만 잃는다.
   *
   * 결정적 공정의 drain 은 **절차는 적어도 되지만 배치 몫을 주장하면 안 된다.**
   */
  it.each(DETERMINISTIC)('%s 의 절차는 Claude Code 배치를 주장하지 않는다', (key) => {
    const drain = HELP_REGISTRY[key]?.screen.drain
    if (!drain) return // 절차 자체가 없는 것도 정상이다(③ 설계 · ⑧ 조판)
    const said = JSON.stringify(drain)
    for (const claim of ['-drain-export', '-drain-import', '.out.json', '청크']) {
      expect(said, `${key} 가 결정적 공정인데 배치 몫(${claim})을 주장한다`).not.toContain(claim)
    }
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

  // ── 이 검사가 바뀐 이유 (2026-09-23 · DD-72) ──────────────────────
  // 원래는 `<details>` 수를 층 수와 견줬다 — 층마다 명령을 접어 두었기 때문이다.
  // 공통 골격이 생기며 네 명령이 **드레인 절 한 곳**으로 모였고(복사 버튼과 함께),
  // 같은 명령이 두 곳에 그려지던 중복이 사라졌다. 그래서 세는 대상이 없어졌다.
  //
  // 지키려던 것은 개수가 아니라 **순서**다: 층은 「무엇을 보는지」를 먼저 말하고,
  // 「어떻게 돌리는지」는 그 아래 한자리에 있다. 그 순서를 직접 잰다 —
  // 명령 문자열이 층 도식보다 **뒤에** 나오는가.
  it('층은 무엇을 보는지를 먼저 말하고, 명령은 그 아래 한자리에 모인다', () => {
    const html = renderToString(<ReviewClient {...review} />)
    const plain = text(html)
    for (const l of review.layers) expect(plain).toContain(l.looksAt)

    // 마지막 층의 「보는 것」보다 첫 명령이 뒤에 있어야 한다.
    const lastLooksAt = plain.lastIndexOf(review.layers[review.layers.length - 1]!.looksAt)
    const firstCmd = plain.indexOf(review.layers[0]!.cmd)
    expect(lastLooksAt, '층의 「보는 것」이 안 그려졌다').toBeGreaterThan(-1)
    expect(firstCmd, '명령이 안 그려졌다').toBeGreaterThan(-1)
    expect(firstCmd, '명령이 층 도식보다 앞에 있다 — 무엇을 보는지가 먼저다').toBeGreaterThan(
      lastLooksAt,
    )

    // 명령은 **드레인 절 한 곳**에만 있다 — 층마다 접어 두던 것을 합쳤으므로
    // 복사 버튼 수가 곧 명령 수여야 한다. 두 곳에 그리면 여기가 두 배가 된다.
    // (표본의 층 둘이 같은 명령 문자열을 쓰므로 문자열 등장 횟수로는 못 센다.)
    expect((html.match(/aria-label="명령 복사: /g) ?? []).length).toBe(review.layers.length)
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
