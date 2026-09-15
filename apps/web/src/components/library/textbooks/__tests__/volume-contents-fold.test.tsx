// apps/web/src/components/library/textbooks/__tests__/volume-contents-fold.test.tsx
//
// **접었는데 내용이 사라지지 않았는가.**
//
// ── 왜 이 검사가 있어야 하는가 (실측 2026-09-07) ────────────────────
// 권 상세는 **8,405px = 9.3화면인데 접힌 블록이 0개**였다. 그중 둘이 절반을 넘게 먹었다 —
// 단원 미리보기 3,265px(39%) · 목차 1,314px(16%). 둘 다 처음부터 끝까지 읽는 글이 아니라
// 필요할 때 펼쳐 보는 자료인데 펼친 채여서, 그 아래(학습 계획표 · 계단 안내 · 부가 자료)가
// 사실상 안 보였다. 접고 나니 **6,028px = 6.7화면**(−28%)이 됐다.
//
// ⚠️ **접는 방식이 함정이다.** 상태를 JS 로 들면 서버 HTML 에 내용이 안 남고, 그러면
//    구성요소 지수 프로브(`apparatus-surface-probe.mjs` — HTTP GET 한 HTML 의 문자열을 센다)와
//    크롤러가 그 구역을 통째로 못 본다. 지수가 12축 → 10축으로 조용히 떨어지는 식이다.
//    `<details>` 는 접혀 있어도 HTML 에 그대로 있어서 그 일이 안 일어난다 —
//    실측으로도 접기 전후 **12축 · 지수 1.500 그대로**였고 구역 글자 수도 2,871→2,881 이었다.
//    이 검사는 그 성질을 잠근다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { ContentsUnit, PreviewChoiceItem, VolumeContents } from '@/lib/textbook/volume-contents'

import { VolumePreview, VolumeToc } from '../VolumeContents'

function unit(no: number): ContentsUnit {
  return {
    no,
    types: ['order', 'insert'],
    items: 4,
    minutes: 12,
    words: [120, 180],
    passages: [`제${no}단원이 읽는 글`],
  }
}

function item(no: number): PreviewChoiceItem {
  return {
    no,
    type: 'order',
    stem: `${no}번 문항의 발문입니다`,
    intro: `${no}번 문항 지문`,
    blocks: [
      { label: 'A', text: `${no}-A 덩어리` },
      { label: 'B', text: `${no}-B 덩어리` },
      { label: 'C', text: `${no}-C 덩어리` },
    ],
    choices: ['(A)-(B)-(C)', '(A)-(C)-(B)', '(B)-(A)-(C)', '(B)-(C)-(A)', '(C)-(A)-(B)'],
    answer: 1,
    explanation: null,
    source: null,
  }
}

function contents(unitCount: number, itemCount: number): VolumeContents {
  return {
    band: 5,
    step: 5,
    title: 'Vocaflow Reading 4',
    schoolBand: '고1',
    units: Array.from({ length: unitCount }, (_, i) => unit(i + 1)),
    totalItems: unitCount * 4,
    totalMinutes: unitCount * 12 * 60,
    stoppedBecause: null,
    sample: {
      no: 1,
      minutes: 12,
      vocabulary: [],
      items: Array.from({ length: itemCount }, (_, i) => item(i + 1)),
    },
  }
}

const toc = (n: number): string =>
  renderToString(<VolumeToc contents={contents(n, 4)} generatedAt="2026-09-07T00:00:00.000Z" />)
const preview = (n: number): string =>
  renderToString(<VolumePreview contents={contents(10, n)} />)

describe('목차 — 앞은 펴고 나머지는 접는다', () => {
  it('열 단원이면 접힌 블록이 생긴다 — 다 펴 두면 그 아래가 안 보인다', () => {
    const html = toc(10)
    expect(html).toContain('<details')
    expect(html).toContain('나머지 6단원 보기')
  })

  it('**접힌 단원도 HTML 에 그대로 있다** — 없으면 지수와 크롤러가 못 본다', () => {
    const html = toc(10)
    // 접힌 쪽(5~10단원)의 글이 문자열로 살아 있어야 한다.
    expect(html).toContain('제10단원이 읽는 글')
    expect(html).toContain('제7단원이 읽는 글')
  })

  it('앞 네 단원은 접히지 않은 자리에 있다 — 목차가 어떻게 생겼는지는 보여야 한다', () => {
    const html = toc(10)
    const foldAt = html.indexOf('<details')
    expect(foldAt).toBeGreaterThan(0)
    expect(html.indexOf('제1단원이 읽는 글')).toBeLessThan(foldAt)
    expect(html.indexOf('제4단원이 읽는 글')).toBeLessThan(foldAt)
  })

  it('네 단원 이하면 접지 않는다 — 접을 것이 없는데 여는 단추를 두지 않는다', () => {
    expect(toc(3)).not.toContain('<details')
  })
})

describe('단원 미리보기 — 앞은 펴고 나머지는 접는다', () => {
  it('문항이 많으면 접힌 블록이 생기고, 몇 개가 남았는지 말한다', () => {
    const html = preview(6)
    expect(html).toContain('<details')
    expect(html).toContain('남은 문항 4개 보기')
  })

  it('**접힌 문항도 HTML 에 그대로 있다**', () => {
    const html = preview(6)
    expect(html).toContain('6번 문항의 발문입니다')
  })

  it('두 문항 이하면 접지 않는다', () => {
    expect(preview(2)).not.toContain('<details')
  })
})

describe('여는 단추가 손가락과 키보드에 닿는다', () => {
  it('44px 이상이고 포커스가 보인다 — 접기가 접근성을 깎으면 안 된다', () => {
    const html = toc(10)
    expect(html).toContain('min-h-[44px]')
    expect(html).toContain('focus-visible:outline')
  })
})
