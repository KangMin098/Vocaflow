// apps/web/src/components/csat/listening/__tests__/ListeningTracer.test.tsx
// 서버 렌더 정적 HTML 로 단계별 노출 · 표지를 본다(저장소에 testing-library/jsdom 이 없다 — 상호작용 로직은 tracer-state 시험이 맡는다).
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { TRACE_FIXTURES, traceFixtureByKey } from '@/lib/csat/listening/fixtures'

import { ListeningTracer } from '../ListeningTracer'
import { initialItemState, judge, submit, type ItemTraceState, type TracerSnapshot } from '../tracer-state'

const fx = traceFixtureByKey('2023-L10')!
const judged = (): ItemTraceState =>
  [
    ['A', 'eliminated', '2023-L10-u6'],
    ['B', 'eliminated', '2023-L10-u4'],
    ['C', 'eliminated', '2023-L10-u8'],
    ['D', 'eliminated', '2023-L10-u10'],
    ['E', 'remaining', '2023-L10-u10'],
  ].reduce((s, [id, v, u]) => judge(s, id, { verdict: v as 'eliminated', utteranceId: u }), initialItemState())

const html = (snap: TracerSnapshot, reveal: 'open' | 'embargo' | 'failure' | null = 'open') =>
  renderToStaticMarkup(<ListeningTracer fixtures={TRACE_FIXTURES} reveal={reveal} initialSnapshot={snap} />)

describe('ListeningTracer', () => {
  it('기본: 원음 없음 · 서버·DB 연동 미검증 · 합성 표지 · 선지 층 BLOCKED, 근거 강조·정답 없음', () => {
    const h = html({ selectedKey: '2023-L10', byItem: {} })
    expect(h).toContain('data-testid="audio-none"')
    expect(h).toContain('원음 없음')
    expect(h).toContain('서버·DB 연동 미검증')
    expect(h).toContain('테스트용 합성 자료')
    expect(h).toContain('BLOCKED_EVIDENCE')
    expect(h).toContain('I can spend up to $200.')
    expect(h).not.toContain('data-evidence=')
    expect(h).not.toContain('data-testid="compare"')
    expect(h).not.toContain('data-testid="official-answer"')
    expect(h).toContain('남은 행 5개 / 5개')
  })

  it('L0: 대본이 닫히고 발화를 짚을 수 없다', () => {
    const h = html({ selectedKey: '2023-L10', byItem: { '2023-L10': { ...initialItemState(), level: 'L0' } } })
    expect(h).not.toContain('I can spend up to $200.')
    expect(h).toContain('대본 닫힘')
  })

  it('L3: 근거 강조와 역할 글자 표지(색만으로 전달하지 않음), 정답 비교는 아직', () => {
    const h = html({ selectedKey: '2023-L10', byItem: { '2023-L10': { ...initialItemState(), level: 'L3' } } })
    expect(h).toContain('data-evidence="e-price"')
    expect(h).toContain('[결정]')
    expect(h).not.toContain('data-testid="compare"')
  })

  it('제출 전엔 L4 단계를 요청해도 L3 으로 깎인다', () => {
    const h = html({ selectedKey: '2023-L10', byItem: { '2023-L10': { ...judged(), level: 'L5' } } })
    expect(h).not.toContain('data-testid="compare"')
    expect(h).not.toContain('data-testid="official-answer"')
  })

  it('제출 + open + L5: 비교와 공식 정답 번호(형별 결속 미검증)', () => {
    const st = { ...submit(fx, judged()), level: 'L5' as const }
    const h = html({ selectedKey: '2023-L10', byItem: { '2023-L10': st } })
    expect(h).toContain('data-testid="compare"')
    expect(h).toContain('data-testid="official-answer"')
    expect(h).toContain('공식 정답 번호 <b>1번</b>')
    expect(h).toContain('형별 결속 미검증')
    expect(h).toContain('공식 선지 번호와 무관')
    expect(h).toContain('남은 행 1개 / 5개')
  })

  it('제출했어도 Reveal Gate 보류 · 실패면 비교·정답이 닫힌다', () => {
    const st = { ...submit(fx, judged()), level: 'L5' as const }
    for (const r of ['embargo', 'failure', null] as const) {
      const h = html({ selectedKey: '2023-L10', byItem: { '2023-L10': st } }, r)
      expect(h).not.toContain('data-testid="compare"')
      expect(h).not.toContain('data-testid="official-answer"')
      expect(h).toContain('정답 공개가 보류')
    }
  })

  it('이유 소거(7번): 대본 유래 후보 표지 · 판단 칩이 발화와 후보를 잇는다', () => {
    const s = judge(initialItemState(), 'work', { verdict: 'eliminated', utteranceId: '2023-L07-u6' })
    const h = html({ selectedKey: '2023-L07', byItem: { '2023-L07': s } })
    expect(h).toContain('대본에서 나온 이유 후보 — 공식 선지가 아니다')
    expect(h).toContain('영화관 아르바이트 판단으로 가기 — 지움')
    expect(h).toContain('지움 — 6번 발화로 가기')
  })

  it('자막 끔: 화자·순서만 남는다', () => {
    const h = html({ selectedKey: '2023-L07', byItem: { '2023-L07': { ...initialItemState(), level: 'L2', captions: false } } })
    expect(h).toContain('자막 끔')
    expect(h).not.toContain('Then, what’s the matter?')
    expect(h).toContain('남자')
  })
})
