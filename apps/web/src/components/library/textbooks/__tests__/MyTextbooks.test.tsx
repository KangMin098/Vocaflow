// apps/web/src/components/library/textbooks/__tests__/MyTextbooks.test.tsx
//
// My Library 교재 면의 **세 상태 구별** 회귀.
//
// 이 화면이 저지를 수 있는 가장 나쁜 일은 틀린 목록이 아니라
// **저장소를 못 읽은 것을 "고른 게 없다" 로 인쇄하는 것**이다. 학습자는 자기가 담아 둔 교재가
// 사라졌다고 읽고, 다시 담으러 간다. 이 저장소가 같은 실수를 서가에서 이미 한 번 했다 —
// RLS 로 막힌 조회의 빈 배열을 '근간 예정'(재료 없음)으로 인쇄해, 문항 1,241개짜리 계단이
// '없음' 으로 보였다(`shelf.ts` §unmeasured).

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { Shelf, ShelfVolume } from '@/lib/textbook/shelf'

import { MyTextbooks } from '../MyTextbooks'

function vol(step: number, title: string): ShelfVolume {
  return {
    step,
    title,
    schoolBand: '중1',
    vLevels: [3],
    types: ['vocab_choice'],
    rationale: '',
    itemCount: 120,
    byType: { vocab_choice: 120 },
    emptyTypes: [],
    status: 'ready',
    maxUnits: 30,
  }
}

const SHELF: Shelf = {
  brand: 'Vocaflow',
  volumes: [vol(1, '첫 권'), vol(2, '둘째 권'), vol(3, '셋째 권')],
  readyCount: 3,
  hasUnmeasured: false,
}

describe('못 읽음 ≠ 0권', () => {
  it('저장소를 못 읽으면 "없다" 고 말하지 않는다', () => {
    const html = renderToString(
      <MyTextbooks shelf={SHELF} mine={{ steps: [], available: false }} />,
    )
    expect(html).toContain('확인하지 못했어요')
    // '아직 담은 교재가 없어요' 는 **다른 사실**이다. 둘을 같은 문장으로 뭉개면 안 된다.
    expect(html).not.toContain('아직 담은 교재가 없어요')
    // 서가로 보내는 CTA 도 내지 않는다 — 이미 담았을 수 있으므로 "고르러 가세요" 는 틀린 안내다.
    expect(html).not.toContain('교재 서가 둘러보기')
  })

  it('정말 0권이면 서가로 보낸다 (막다른 빈 화면 금지)', () => {
    const html = renderToString(<MyTextbooks shelf={SHELF} mine={{ steps: [], available: true }} />)
    expect(html).toContain('아직 담은 교재가 없어요')
    expect(html).toContain('/library/textbooks')
    expect(html).not.toContain('확인하지 못했어요')
  })
})

describe('담은 것을 관리한다', () => {
  it('담은 권만, 계단 순서로 보여준다', () => {
    const html = renderToString(
      // 일부러 역순으로 넘긴다 — 화면이 서가 순서를 따르는지 본다(순서 = 난이도).
      <MyTextbooks shelf={SHELF} mine={{ steps: [3, 1], available: true }} />,
    )
    expect(html).toContain('첫 권')
    expect(html).toContain('셋째 권')
    expect(html).not.toContain('둘째 권')
    expect(html.indexOf('첫 권')).toBeLessThan(html.indexOf('셋째 권'))
  })

  it('권마다 상세로 가는 길이 있다 (보이는데 못 여는 목록 금지)', () => {
    const html = renderToString(<MyTextbooks shelf={SHELF} mine={{ steps: [2], available: true }} />)
    expect(html).toContain('/library/textbooks/2')
  })

  it('서가에서 사라진 계단은 조용히 빠진다 (없는 권을 이름 없이 그리지 않는다)', () => {
    // 시리즈가 줄면 담아 둔 step 이 남는다. 그때 빈 행을 그리면 "제목 없는 교재" 가 팔린다.
    const html = renderToString(
      <MyTextbooks shelf={SHELF} mine={{ steps: [1, 99], available: true }} />,
    )
    expect(html).toContain('첫 권')
    expect(html).not.toContain('undefined')
  })
})
