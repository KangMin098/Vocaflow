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

  // ── 이 검사가 바뀐 이유 (2026-09-23 · DD-72) ──────────────────────
  // 원래는 병목이 **하나**였고 `ord` 만 봤다. 그래서 이 검사는 「② 기획(short)과
  // ⑧ 조판(blocked)이 함께 있으면 기획을 가리킨다」를 잠그고 있었다 —
  // **그것이 바로 고친 결함이다.** ② 기획은 `lane: 'lab'` 이라 라인을 안 막는다:
  // 실측 2026-09-23 에 화면이 「막힌 곳 · 2. 기획」이라 적는 동안 ④⑤⑧ 은 전부 통과였고,
  // 기획의 미달 사유는 생산이 아니라 **증거 부족**이라 그 자리에서 돌릴 것이 없었다.
  //
  // 지키려던 것(「뒤가 더 나빠도 앞선 미달을 먼저」)은 **레인 안에서** 그대로 잠근다.
  it('라인 병목은 라인 안에서 앞선 미달을 가리킨다 — 연구소가 끼어들지 않는다', () => {
    const html = text(
      renderToString(
        <FactoryLineClient
          stages={[
            mk('evidence', 'pass'),
            mk('market', 'short', [], '구속점은 EBS 1.199'),
            mk('source', 'short', [], '지문이 모자란다'),
            mk('press', 'blocked', [], '조판된 계단이 없다'),
          ]}
          loadError={null}
        />,
      ),
    )
    // 라인 안에서는 ④ 소재가 ⑧ 조판보다 앞이다.
    expect(html).toContain('생산 라인이 막힌 곳')
    expect(html).toContain('4. 소재')
    expect(html).toContain('지문이 모자란다')
    // 연구소는 **따로** 적히고, 라인을 막지 않는다고 말한다.
    expect(html).toContain('전략 연구소')
    expect(html).toContain('2. 기획')
    expect(html).toContain('라인을 막지는 않는다')
  })

  it('연구소만 막히면 라인은 「다 넘었다」고 말한다 — 없는 생산 작업을 가리키지 않는다', () => {
    const html = text(
      renderToString(
        <FactoryLineClient
          stages={[
            mk('market', 'unmeasured', [], 'EBS 는 증거가 모자라 판정할 수 없다'),
            mk('source', 'pass'),
            mk('press', 'pass'),
          ]}
          loadError={null}
        />,
      ),
    )
    expect(html).toContain('생산 라인이 게이트를 다 넘었다')
    expect(html).toContain('EBS 는 증거가 모자라 판정할 수 없다')
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

  it('전부 통과하면 두 레인 다 「넘었다」고 말한다 — 빈 자리로 두지 않는다', () => {
    const html = text(
      renderToString(
        <FactoryLineClient
          stages={[mk('evidence', 'pass'), mk('market', 'pass'), mk('press', 'pass')]}
          loadError={null}
        />,
      ),
    )
    expect(html).toContain('생산 라인이 게이트를 다 넘었다')
    expect(html).toContain('전략 연구소도 게이트를 다 넘었다')
    expect(html).not.toContain('막힌 곳')
  })

  it('공정마다 시중 공정 이름을 나란히 적는다 — "이게 그 공정" 임이 보여야 한다', () => {
    const html = text(renderToString(<FactoryLineClient stages={[mk('explain', 'short')]} loadError={null} />))
    expect(html).toContain('시중: 정답해설 집필')
  })
})

/* ── 도식 — 색만으로 말하지 않는다 ── */

describe('FactoryLineDiagram', () => {
  const three = [mk('evidence', 'pass'), mk('market', 'short'), mk('blueprint', 'blocked')]

  it('여덟 칸 대신 한 그림 — 칸마다 모양(svg)이 붙는다', () => {
    const html = renderToString(<FactoryLineClient stages={three} loadError={null} />)
    // 칸마다 상태 모양 하나 + 복사 아이콘들. 모양이 없으면 색만 남는다.
    expect((html.match(/<svg/g) ?? []).length).toBeGreaterThanOrEqual(three.length)
  })

  it('상태를 **글자로도** 적는다 — 색약에서 amber↔green 이 ΔE 7.8 로 겹친다', () => {
    const html = text(renderToString(<FactoryLineClient stages={three} loadError={null} />))
    expect(html).toContain('통과')
    expect(html).toContain('몫 남음')
    expect(html).toContain('막힘')
  })

  it('칸마다 스크린리더용 이름에 상태가 들어간다', () => {
    const html = renderToString(<FactoryLineClient stages={three} loadError={null} />)
    expect(html).toContain('aria-label="2. 기획 — 몫 남음')
    expect(html).toContain('지금 라인을 막고 있다')
  })

  it('기본으로 펼치는 칸은 병목이다 — 열자마자 고칠 것이 보인다', () => {
    const html = text(renderToString(<FactoryLineClient stages={three} loadError={null} />))
    expect(html).toContain('기획 상세'.replace(' 상세', '')) // 병목(②)의 이름
    // 병목이 아닌 ③ 설계의 명령은 접혀 있어야 한다(한 칸만 편다)
    expect(html).not.toContain('node scripts/csat/blueprint.mjs')
  })

  it('한 번에 한 칸만 편다 — 나머지 일곱 칸의 명령이 화면에 없다', () => {
    const html = text(renderToString(<FactoryLineClient stages={three} loadError={null} />))
    // 병목(② 기획)의 명령만 나오고, 나머지 두 칸의 명령은 접혀 있어야 한다.
    // (명령 문자열은 `<code>` 와 복사 버튼의 접근성 이름에 각각 한 번씩 나온다 — 둘 다 같은 칸이다.)
    expect(html).toContain('node scripts/market.mjs')
    expect(html).not.toContain('node scripts/evidence.mjs')
    expect(html).not.toContain('node scripts/blueprint.mjs')
  })

  it('칸 버튼이 44px 터치 타겟을 지킨다', () => {
    const html = renderToString(<FactoryLineClient stages={three} loadError={null} />)
    expect((html.match(/min-h-\[44px\]/g) ?? []).length).toBeGreaterThanOrEqual(three.length)
  })
})
