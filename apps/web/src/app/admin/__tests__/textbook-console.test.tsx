// apps/web/src/app/admin/__tests__/textbook-console.test.tsx
//
// TBP 콘솔 렌더 회귀 + 도움말 계약.
//
// **이 화면은 조작 버튼이 없다** — 생성은 Claude Code 드레인이다. 그래서 화면이 말해야
// 하는 것은 "지금 어떤 상태인가" 와 "다음에 무엇을 돌려야 하는가" 둘뿐이고,
// 후자는 도움말의 드레인 절차가 진다. 도움말이 비면 화면이 반쪽이라 여기서 함께 본다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { HELP_REGISTRY } from '@/lib/admin/help'
import type { TextbookConsoleStats } from '@/lib/textbook/console-stats'

import { TextbookConsoleClient } from '../textbook/TextbookConsoleClient'

const base: TextbookConsoleStats = {
  totalItems: 4509,
  byType: [
    { type: 'insert', count: 1146, answerBiased: null, chi2: null },
    { type: 'vocab_choice', count: 968, answerBiased: false, chi2: 6.3 },
    { type: 'grammar_choice', count: 383, answerBiased: true, chi2: 52.7 },
  ],
  series: {
    brand: 'Vocaflow Reading',
    rungs: [
      {
        rung: {
          step: 1,
          vLevels: [1],
          schoolBand: '초등 저학년',
          volumeTitle: 'Vocaflow Reading Starter',
          types: ['rhyme'],
          rationale: 'x',
        },
        byType: { rhyme: 0 },
        total: 0,
        emptyTypes: ['rhyme'],
      },
      {
        rung: {
          step: 5,
          vLevels: [5],
          schoolBand: '고1',
          volumeTitle: 'Vocaflow Reading 4',
          types: ['order'],
          rationale: 'x',
        },
        byType: { order: 233 },
        total: 233,
        emptyTypes: [],
      },
    ],
    brokenSteps: [1],
  },
  evaluation: {
    total: 15,
    byStanding: { superior: 5, parity: 3, inferior: 5, absent: 1, unmeasured: 1 },
    byCategory: {
      legal: { total: 3, superior: 1 },
      physical: { total: 3, superior: 2 },
      curriculum: { total: 4, superior: 0 },
      pedagogy: { total: 5, superior: 2 },
    },
    superiorRatio: 5 / 15,
    losing: [
      {
        key: 'explanation',
        category: 'pedagogy',
        label: '해설',
        market: 'm',
        ours: '6.9% 다',
        howMeasured: '실측',
        standing: 'inferior',
      },
    ],
  },
  observations: 0,
  brand: {
    brand: 'Vocaflow Reading',
    fingerprint: 'a1b2c3d4',
    palette: [
      { key: 'ink', label: '본문 잉크', light: '#1A1714', dark: '#F2EDE4' },
      { key: 'accent', label: '표제·문항 번호', light: '#8A5A20', dark: '#D9A94E' },
    ],
    fonts: { english: '"Lora", serif', body: '"DM Sans", sans-serif', mono: '"JetBrains Mono", monospace' },
    renders: [
      {
        band: 5,
        volumeTitle: 'Vocaflow Reading 4',
        step: 5,
        schoolBand: '고1',
        units: 20,
        items: 80,
        autoPassed: 8,
        autoTotal: 9,
        failedChecks: ['오답 매력도'],
        missingExplanations: 0,
        typeMixFit: 0.912,
        distinctVolumes: 6,
        articlesWithItems: 540,
        articlesIdle: 0,
        // 옛 조판 기록에는 검수 결과가 없다 — null 이 정상이고 0 이 거짓말이다.
        review: { passageSpec: null, answerBias: null, proofread: null },
        brandFingerprint: 'a1b2c3d4',
        brandCurrent: true,
        renderCount: 3,
        renderedAt: '2026-08-30T05:00:00.000Z',
      },
      {
        band: 6,
        volumeTitle: 'Vocaflow Reading 5',
        step: 6,
        schoolBand: '고2',
        units: 20,
        items: 80,
        autoPassed: 9,
        autoTotal: 9,
        failedChecks: [],
        missingExplanations: 2,
        typeMixFit: null,
        distinctVolumes: null,
        articlesWithItems: 61,
        articlesIdle: 1779,
        // 옛 조판 기록에는 검수 결과가 없다 — null 이 정상이고 0 이 거짓말이다.
        review: { passageSpec: null, answerBias: null, proofread: null },
        brandFingerprint: '00000000',
        brandCurrent: false,
        renderCount: 1,
        renderedAt: '2026-08-20T05:00:00.000Z',
      },
    ],
    staleBands: [6],
    idleArticles: 1779,
    renderError: null,
  },
  loadError: null,
}

describe('TBP 콘솔 렌더', () => {
  it('요약 수치가 화면에 나온다', () => {
    const html = renderToString(<TextbookConsoleClient stats={base} />)
    expect(html).toContain('4,509')
    expect(html).toContain('33%') // 평가 우위 5/15
  })

  it('**끊긴 계단을 계단 수에 세지 않는다** — 사다리가 이어졌다고 착각하면 안 된다', () => {
    const html = renderToString(<TextbookConsoleClient stats={base} />)
    expect(html).toContain('1/2') // 2단 중 1단만 살아 있다
  })

  it('정답 번호 쏠림을 유형별로 표시한다', () => {
    const html = renderToString(<TextbookConsoleClient stats={base} />)
    expect(html).toContain('52.7')
    expect(html).toContain('쏠림')
    expect(html).toContain('고름')
    // 저장 형식에 번호가 없는 유형은 "못 잼" 이라고 말한다 — 통과로 눙치지 않는다.
    expect(html).toContain('저장 형식에 번호 없음')
  })

  it('**관측 0 을 경고로 말한다** — 없는 것을 없다고', () => {
    const html = renderToString(<TextbookConsoleClient stats={base} />)
    expect(html).toContain('난이도·변별도 못 냄')
  })

  it('지고 있는 요소를 숨기지 않는다', () => {
    const html = renderToString(<TextbookConsoleClient stats={base} />)
    expect(html).toContain('해설')
    expect(html).toContain('6.9%')
  })

  it('조회가 깨지면 빈 표 대신 이유를 말한다', () => {
    const html = renderToString(
      <TextbookConsoleClient stats={{ ...base, loadError: '문항 조회 실패: boom' }} />,
    )
    expect(html).toContain('문항 조회 실패: boom')
  })
})

describe('브랜드 규격 · 조판 기록', () => {
  it('규격을 화면에서 읽을 수 있다 — 코드에만 있으면 아무도 안 본다', () => {
    const html = renderToString(<TextbookConsoleClient stats={base} />)
    expect(html).toContain('브랜드 규격')
    expect(html).toContain('Vocaflow Reading')
    expect(html).toContain('#1A1714')
    expect(html).toContain('Lora')
  })

  it('**색만으로 말하지 않는다** — 색 칸 옆에 값이 글자로 있다', () => {
    const html = renderToString(<TextbookConsoleClient stats={base} />)
    // 스와치는 aria-hidden 이고, 읽을 수 있는 것은 hex 문자열 쪽이다.
    expect(html).toContain('aria-hidden')
    expect(html).toContain('#8A5A20')
  })

  it('옛 규격으로 찍힌 권을 재조판 대상으로 표시한다', () => {
    const html = renderToString(<TextbookConsoleClient stats={base} />)
    expect(html).toContain('옛 규격')
    expect(html).toContain('옛 규격 1권')
  })

  it('조판 기록의 수치를 다시 계산하지 않고 그대로 보인다', () => {
    const html = renderToString(<TextbookConsoleClient stats={base} />)
    expect(html).toContain('Vocaflow Reading 4')
    expect(html).toContain('8/9')
    expect(html).toContain('오답 매력도')
    // 원글을 안 쓰는 권은 0 이 아니라 "해당 없음" 이다.
    expect(html).toContain('해당 없음')
    // 해설이 안 붙은 문항 수는 경고로 — 통과로 눙치지 않는다.
    expect(html).toContain('2')
  })

  it('**기록을 못 읽은 것과 조판 0권을 구별한다**', () => {
    const broken = renderToString(
      <TextbookConsoleClient
        stats={{ ...base, brand: { ...base.brand, renders: [], staleBands: [], renderError: '조판 기록 조회 실패: boom' } }}
      />,
    )
    expect(broken).toContain('조판 기록 조회 실패: boom')
    expect(broken).not.toContain('아직 조판된 권이 없다')

    const none = renderToString(
      <TextbookConsoleClient
        stats={{ ...base, brand: { ...base.brand, renders: [], staleBands: [] } }}
      />,
    )
    expect(none).toContain('아직 조판된 권이 없다')
    expect(none).toContain('render-volume.mjs')
  })
})

describe('TBP 도움말 계약', () => {
  const entry = HELP_REGISTRY['textbook']

  it('레지스트리에 등록돼 있다 — 없으면 화면의 도움말 버튼이 빈다', () => {
    expect(entry).toBeDefined()
    expect(entry!.title.length).toBeGreaterThan(0)
  })

  it('**드레인 절차가 있다** — 이 화면은 조작 버튼이 없어서 절차가 곧 사용법이다', () => {
    const drain = entry!.screen.drain
    expect(drain).toBeDefined()
    expect(drain!.procedure.length).toBeGreaterThanOrEqual(4)
    expect(drain!.prerequisites.length).toBeGreaterThan(0)
    expect(drain!.verify.length).toBeGreaterThan(0)
  })

  it('**되돌릴 수 없는 동작이 주의에 적혀 있다**', () => {
    const cautions = (entry!.screen.cautions ?? []).join(' ')
    expect(cautions).toMatch(/--prune/)
    expect(cautions).toMatch(/되돌릴 수 없/)
  })

  it('모든 절차 단계가 끝난 것을 어떻게 아는지 적는다', () => {
    for (const step of entry!.screen.drain!.procedure) {
      expect(step.done, step.title).toBeTruthy()
      expect(step.detail.length, step.title).toBeGreaterThan(20)
    }
  })
})

describe('사다리 병목 — 최솟값을 이름으로 짚는다', () => {
  it('적합도를 표에 낸다 — 기록해 놓고 안 보여주면 없는 것과 같다', () => {
    const html = renderToString(<TextbookConsoleClient stats={base} />)
    expect(html).toContain('유형-학년 적합도')
    expect(html).toContain('91.2%')
  })

  it('**못 잰 것을 0 으로 치지 않는다** — 0 이면 그것이 항상 최소가 되어 병목을 가린다', () => {
    const html = renderToString(<TextbookConsoleClient stats={base} />)
    expect(html).toContain('못 잼')
    // 병목은 적합도를 잰 권(V5 91.2%) 이지, 못 잰 권(V6)이 아니다.
    expect(html).toContain('사다리 병목')
    expect(html).toContain('Vocaflow Reading 4')
  })

  it('임계값으로 판정하지 않는다 — 몇 %가 합격이라는 근거가 없다', () => {
    const html = renderToString(<TextbookConsoleClient stats={base} />)
    expect(html).toContain('임계값을 두지 않는다')
    expect(html).not.toContain('적합도 미달')
  })

  it('조판된 권이 없으면 병목 줄도 없다 — 근거 없이 말하지 않는다', () => {
    const html = renderToString(
      <TextbookConsoleClient
        stats={{ ...base, brand: { ...base.brand, renders: [], staleBands: [] } }}
      />,
    )
    expect(html).not.toContain('사다리 병목')
  })
})

describe('문항이 안 붙은 원글 — 집필보다 먼저 할 일', () => {
  it('합계를 요약 카드로 낸다 — 이 수가 안 보이면 아무도 안 돌린다', () => {
    const html = renderToString(<TextbookConsoleClient stats={base} />)
    expect(html).toContain('문항 없는 원글')
    expect(html).toContain('1,779')
    expect(html).toContain('집필보다 이게 먼저다')
  })

  it('**분자를 함께 보여야 권수가 읽힌다** — 쓸 수 있는 원글 열', () => {
    const html = renderToString(<TextbookConsoleClient stats={base} />)
    expect(html).toContain('쓸 수 있는 원글')
    expect(html).toContain('540')
    expect(html).toContain('문항 없음')
  })

  it('무엇을 돌려야 하는지 명령을 적는다', () => {
    const html = renderToString(<TextbookConsoleClient stats={base} />)
    expect(html).toContain('먼저 할 일')
    expect(html).toContain('store-new-types.mjs --band N --commit')
  })

  it('**못 잰 것과 0 을 구별한다** — null 이면 대시, 0 이면 남은 몫 없음', () => {
    const unmeasured = renderToString(
      <TextbookConsoleClient stats={{ ...base, brand: { ...base.brand, idleArticles: null } }} />,
    )
    expect(unmeasured).toContain('아직 안 쟀다')
    expect(unmeasured).not.toContain('먼저 할 일')

    const done = renderToString(
      <TextbookConsoleClient stats={{ ...base, brand: { ...base.brand, idleArticles: 0 } }} />,
    )
    expect(done).toContain('남은 몫 없음')
    expect(done).not.toContain('먼저 할 일')
  })
})
