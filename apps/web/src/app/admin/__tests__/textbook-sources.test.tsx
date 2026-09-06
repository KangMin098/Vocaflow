// apps/web/src/app/admin/__tests__/textbook-sources.test.tsx
//
// 원문 적격 화면 회귀 + 도움말 계약.
//
// **이 화면의 목적은 교재 생성이 임의 판단이 되지 않게 하는 것**이다. 그러려면 화면이
// 세 가지를 반드시 말해야 한다 — 어떤 자로 쟀는가(축·출처) · 지금 몇 편이 통과하는가 ·
// 통과 못 한 것은 다음에 무엇을 해야 하는가. 셋 중 하나라도 사라지면 화면이 "숫자만
// 보이는 판" 이 되고, 그때부터 원문 선택은 다시 감으로 돌아간다.
//
// 그래서 아래 검사는 **표시가 사라지는 것**과 **판정이 관대해지는 것**을 함께 잠근다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { HELP_REGISTRY } from '@/lib/admin/help'
import { buildSourceEligibilityPanel } from '@/lib/textbook/source-eligibility-view'

import { SourceEligibilityClient } from '../textbook/sources/SourceEligibilityClient'

const panel = buildSourceEligibilityPanel(new Date('2026-09-06T12:00:00Z'))
const html = renderToString(<SourceEligibilityClient panel={panel} />)

describe('buildSourceEligibilityPanel', () => {
  it('스냅샷 합계가 등급 합과 맞는다 — 어긋나면 밴드 인자와 함께 만든 스냅샷이다', () => {
    const sum = panel.grades.reduce((n, g) => n + g.count, 0)
    expect(sum).toBe(panel.total.total)
  })

  it('일곱 축을 모두 낸다 — 자를 하나라도 빼면 판정이 헐거워진다', () => {
    expect(panel.axes).toHaveLength(7)
    expect(panel.axes.map((a) => a.id)).toEqual([
      'legal',
      'safety',
      'gate',
      'analysis',
      'judgement',
      'format',
      'vocabulary',
    ])
  })

  it('조판 가능은 두 등급의 합뿐이다', () => {
    const composable = panel.grades.filter((g) => g.composable).map((g) => g.grade)
    expect(composable.sort()).toEqual(['excerpt', 'usable'])
    const sum = panel.grades.filter((g) => g.composable).reduce((n, g) => n + g.count, 0)
    expect(sum).toBe(panel.total.composable)
  })

  it('경과 일수를 기준 시각으로 계산한다 — 화면이 낡음을 스스로 말해야 한다', () => {
    const later = buildSourceEligibilityPanel(new Date('2026-09-20T12:00:00Z'))
    expect(later.ageDays).toBeGreaterThan(panel.ageDays)
  })

  it('다음 한 걸음은 **되돌릴 수 있는** 축 중 가장 큰 것이다', () => {
    if (!panel.topBlocker) return // 전부 통과한 재고면 없을 수 있다
    expect(panel.topBlocker.axis.recoverable).toBe(true)
    const recoverableMax = Math.max(
      ...panel.axes.filter((a) => a.recoverable).map((a) => a.blocked)
    )
    expect(panel.topBlocker.axis.blocked).toBe(recoverableMax)
  })
})

describe('원문 적격 화면', () => {
  it('일곱 축을 자의 출처와 함께 보인다 — "왜 이 원문을 골랐나" 의 답이다', () => {
    for (const a of panel.axes) {
      expect(html).toContain(a.label)
      expect(html).toContain(a.question)
    }
    // 출처를 지우면 임계값이 짐작처럼 보인다.
    expect(html).toContain('PASSAGE_WORDS')
    expect(html).toContain('gate-rules.mjs')
  })

  it('등급마다 다음에 할 일이 붙는다 — 막다른 화면을 만들지 않는다', () => {
    for (const g of panel.grades) {
      expect(html).toContain(g.label)
      expect(html).toContain(g.nextStep)
    }
  })

  it('조판 가능 여부를 색이 아니라 **글자로도** 말한다 (색맹 대응)', () => {
    expect(html).toContain('조판 가능')
    expect(html).toContain('조판 불가')
  })

  it('되돌릴 수 없는 축을 그렇게 표시한다', () => {
    expect(html).toContain('영영 못 쓴다')
  })

  it('언제 잰 값인지와 다시 재는 명령을 함께 보인다', () => {
    expect(html).toContain('에 잰 값')
    expect(html).toContain('source-eligibility-scan.mjs')
  })

  it('조판이 받으면 안 되는 편수를 숨기지 않는다', () => {
    expect(html).toContain('지금 조판이 받으면 안 되는 편수')
    expect(html).toContain((panel.total.total - panel.total.composable).toLocaleString())
  })

  it('학령별로 "만들 수 없음" 을 분명히 말한다', () => {
    const zero = panel.bands.some((b) => b.composable === 0)
    if (zero) expect(html).toContain('만들 수 없음')
  })

  it('문항이 이미 있는데 원문이 판정을 못 넘는 편수를 드러낸다', () => {
    // 이 격차가 곧 "판정 없이 만들어진 문항" 의 분모다. 숨기면 화면이 좋아 보이지만
    // 그게 이 화면이 막으려는 바로 그것이다.
    expect(html).toContain('문항이 붙은 원문')
    if (panel.articlesWithItems != null && panel.articlesWithItems > panel.total.composable) {
      expect(html).toContain((panel.articlesWithItems - panel.total.composable).toLocaleString())
    }
  })

  it('게이트를 돌려도 안 풀리는 몫을 갈라 말한다 — 안 그러면 헛일을 시킨다', () => {
    if (panel.topBlocker?.axis.id === 'judgement' && panel.structurallyUnjudged) {
      expect(html).toContain('게이트를 돌려도 안 풀린다')
      expect(html).toContain(panel.structurallyUnjudged.toLocaleString())
      expect(html).toContain('plos-extract')
    }
  })

  it('못 잰 것과 0 을 구별한다', () => {
    // 옛 스냅샷에는 두 열이 없다. 0 으로 채우면 "그런 원문은 없다" 는 거짓말이 된다.
    expect(panel.articlesWithItems === null || typeof panel.articlesWithItems === 'number').toBe(true)
    expect(
      panel.structurallyUnjudged === null || typeof panel.structurallyUnjudged === 'number'
    ).toBe(true)
  })
})

describe('도움말 계약', () => {
  const entry = HELP_REGISTRY['textbook/sources']

  it('레지스트리 키가 라우트 슬러그와 같다', () => {
    expect(entry).toBeTruthy()
    expect(entry!.title).toBe('원문 적격')
  })

  it('드레인 절차가 있고 재실행 안전 여부를 밝힌다', () => {
    const drain = entry!.screen.drain
    expect(drain).toBeTruthy()
    expect(drain!.procedure.length).toBeGreaterThanOrEqual(3)
    expect(JSON.stringify(drain)).toContain('재실행 안전')
  })

  it('조판이 아직 이 판정을 강제하지 않는다는 사실을 경고에 적는다', () => {
    // 이 문장을 지우면 관리자가 "화면이 막아 준다" 고 오해한다.
    expect(JSON.stringify(entry!.screen.cautions)).toContain('volume-pool.mjs')
  })

  it('스캔 명령이 도움말과 화면에서 같다', () => {
    expect(JSON.stringify(entry!.screen.drain)).toContain('source-eligibility-scan.mjs')
  })
})
