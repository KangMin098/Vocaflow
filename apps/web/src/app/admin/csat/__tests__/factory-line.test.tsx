// apps/web/src/app/admin/csat/__tests__/factory-line.test.tsx
//
// 공정 현황판 렌더 — **화면이 거짓말을 안 하는지** 본다.
//
// 이 화면의 주장은 둘이다: ① 지금 라인을 막는 공정은 하나이고, ② 못 잰 것은 0 이 아니다.
// 둘 중 하나라도 화면에서 뒤집히면 관리자가 엉뚱한 공정에 배치를 돌린다 — 배치 한 번이
// 몇 시간이므로 그 오조작 비용이 크다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { FACTORY_STAGES, type StageState } from '@/lib/csat/factory-model'

import { FactoryLineClient } from '../FactoryLineClient'

// React 서버 렌더는 인접한 텍스트 조각 사이에 `<!-- -->` 를 넣는다.
const text = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '')

function mk(
  id: string,
  status: StageState['status'],
  gauges: StageState['gauges'] = [],
  blocker: string | null = null,
): StageState {
  const def = FACTORY_STAGES.find((s) => s.id === id)!
  return {
    def,
    status,
    gauges,
    blocker,
    nextCommands: [
      { cmd: `node scripts/${id}.mjs`, why: `${def.name} 다음 몫`, writes: true },
      { cmd: `Claude Code: ${def.name} 청크를 채운다`, why: '배치가 채운다', claudeCode: true },
    ],
  }
}

describe('FactoryLineClient', () => {
  it('빈 라인도 그린다 — 조회가 실패해도 화면이 사라지지 않는다', () => {
    const html = renderToString(<FactoryLineClient stages={[]} loadError={null} />)
    expect(html).toContain('공정 현황판')
  })

  it('조회 오류를 role=alert 로 그대로 보여 준다', () => {
    const html = renderToString(<FactoryLineClient stages={[]} loadError="RPC 실패: 권한 없음" />)
    expect(html).toContain('role="alert"')
    expect(text(html)).toContain('RPC 실패: 권한 없음')
  })

  it('병목은 뒤가 더 나빠도 앞선 미달을 가리킨다', () => {
    const html = text(
      renderToString(
        <FactoryLineClient
          stages={[
            mk('evidence', 'pass'),
            mk('market', 'short', [], '구속점은 EBS 1.199'),
            mk('press', 'blocked', [], '조판된 계단이 없다'),
          ]}
          loadError={null}
        />,
      ),
    )
    expect(html).toContain('2. 기획')
    expect(html).toContain('구속점은 EBS 1.199')
    // 뒤쪽 공정이 병목 자리에 오지 않는다
    expect(html).not.toContain('8. 조판 · 발행<')
  })

  it('못 잰 눈금은 0% 막대가 아니라 「못 잼」과 그 이유를 적는다', () => {
    const html = text(
      renderToString(
        <FactoryLineClient
          stages={[
            mk('market', 'unmeasured', [
              {
                label: '구속 출판사 지수',
                num: null,
                den: null,
                unit: 'index',
                target: 1.2,
                unmeasuredReason: '벤치마크 리포트를 못 읽었다',
              },
            ]),
          ]}
          loadError={null}
        />,
      ),
    )
    expect(html).toContain('못 잼')
    expect(html).toContain('벤치마크 리포트를 못 읽었다')
    expect(html).not.toContain('(0%)')
  })

  it('비율 눈금은 백분율만이 아니라 분자/분모를 그대로 적는다', () => {
    const html = text(
      renderToString(
        <FactoryLineClient
          stages={[
            mk('explain', 'short', [
              { label: '해설 보유', num: 426696, den: 655092, unit: 'ratio', target: 1 },
            ]),
          ]}
          loadError={null}
        />,
      ),
    )
    expect(html).toContain('426,696 / 655,092')
    expect(html).toContain('(65%)')
  })

  it('지수 눈금은 목표 1.200 을 함께 적는다 — 1.199 가 통과처럼 보이면 안 된다', () => {
    const html = text(
      renderToString(
        <FactoryLineClient
          stages={[
            mk('market', 'short', [
              { label: '구속 출판사 지수 (EBS)', num: 1.199, den: null, unit: 'index', target: 1.2 },
            ]),
          ]}
          loadError={null}
        />,
      ),
    )
    expect(html).toContain('1.199')
    expect(html).toContain('목표 1.200')
  })

  it('명령과 그 위험 표시를 화면에 싣는다 — 도움말을 펼치지 않아도 보인다', () => {
    const html = text(renderToString(<FactoryLineClient stages={[mk('author', 'short')]} loadError={null} />))
    expect(html).toContain('node scripts/author.mjs')
    expect(html).toContain('씀')
    expect(html).toContain('Claude Code')
  })

  it('전부 통과하면 병목 자리에 초과 개선을 말한다', () => {
    const html = text(
      renderToString(
        <FactoryLineClient stages={[mk('evidence', 'pass'), mk('market', 'pass')]} loadError={null} />,
      ),
    )
    expect(html).toContain('초과 개선')
  })

  it('공정마다 시중 공정 이름을 나란히 적는다 — "이게 그 공정" 임이 보여야 한다', () => {
    const html = text(renderToString(<FactoryLineClient stages={[mk('explain', 'short')]} loadError={null} />))
    expect(html).toContain('시중: 정답해설 집필')
  })
})
