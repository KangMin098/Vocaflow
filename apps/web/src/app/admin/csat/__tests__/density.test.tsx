// apps/web/src/app/admin/csat/__tests__/density.test.tsx
//
// **「한 화면에 너무 복잡하다」를 숫자로 만든 회귀.**
//
// 복잡함은 취향 논쟁이 되기 쉽다. 그래서 세 가지를 센다 — 전부 같은 표본(`fixtures.ts`)으로
// 재므로 화면끼리 견줄 수 있다:
//
//   · **덩어리** — 훑어야 하는 렌더 요소 수. 사람이 화면을 볼 때 눈이 멈추는 지점의 상한.
//   · **글자**  — 읽어야 하는 순수 텍스트 길이. 도식이 텍스트를 대신했는지의 분모.
//   · **조작**  — 누를 수 있는 것의 수. 선택지가 많을수록 결정이 느려진다(원칙 6 인지 부하).
//
// ⚠️ 예산은 **줄어든 뒤의 실측값에 여유를 얹어** 정한다. 넉넉히 잡으면 다시 복잡해져도 안 걸리고,
//   딱 맞게 잡으면 한 줄만 고쳐도 빨간불이 뜬다. 그래서 「지금 값 + 15%」를 쓴다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  AUTHOR_REAL,
  BLUEPRINT_REAL,
  MARKET_REAL,
  PRESS_REAL,
  REVIEW_REAL,
  SOURCE_REAL,
  STAGES_REAL,
} from '@/lib/csat/__tests__/fixtures'

import { BlueprintClient } from '../blueprint/BlueprintClient'
import { AuthorClient } from '../authoring/AuthorClient'
import { FactoryLineClient } from '../FactoryLineClient'
import { PressClient } from '../press/PressClient'
import { ReviewClient } from '../review/ReviewClient'
import { SourceClient } from '../sourcing/SourceClient'
import { MarketClient } from '../strategy/MarketClient'

export interface Density {
  chunks: number
  chars: number
  actions: number
  svg: number
}

/**
 * 렌더 결과의 밀집도. 주석(`<!-- -->`)과 태그를 걷어낸 뒤 센다.
 *
 * ⚠️ **접힌 것은 세지 않는다.** `<details>` 안쪽은 열기 전까지 화면에 없으므로, 그것까지 세면
 *   「깊이를 접었다」는 개선이 오히려 나빠진 것으로 잡힌다(실측: 기획 화면의 근거 서술을 접었더니
 *   글자 수가 1,254 → 1,276 으로 **올라갔다**). 여는 손잡이(`<summary>`)는 보이므로 남긴다.
 */
export function measure(html: string): Density {
  const clean = html
    .replace(/<!--[\s\S]*?-->/g, '')
    // <details> … </details> 안에서 <summary>…</summary> 만 남긴다
    .replace(/<details\b[^>]*>([\s\S]*?)<\/details>/g, (_m, body: string) => {
      const summary = body.match(/<summary\b[\s\S]*?<\/summary>/)
      return summary ? summary[0] : ''
    })
  const text = clean
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z#0-9]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const count = (re: RegExp) => (clean.match(re) || []).length
  return {
    chunks: count(/<(div|section|article|p|span|li|tr|td|th|h[1-6]|code|details|summary)\b/g),
    chars: text.length,
    actions: count(/<(button|a|input|select|summary)\b/g),
    svg: count(/<svg\b/g),
  }
}

const SCREENS: { name: string; html: () => string }[] = [
  {
    name: '현황판',
    html: () => renderToString(<FactoryLineClient stages={STAGES_REAL} loadError={null} />),
  },
  { name: '기획', html: () => renderToString(<MarketClient {...MARKET_REAL} />) },
  { name: '설계', html: () => renderToString(<BlueprintClient {...BLUEPRINT_REAL} />) },
  { name: '소재', html: () => renderToString(<SourceClient {...SOURCE_REAL} />) },
  { name: '집필', html: () => renderToString(<AuthorClient {...AUTHOR_REAL} />) },
  { name: '검수', html: () => renderToString(<ReviewClient {...REVIEW_REAL} />) },
  { name: '조판', html: () => renderToString(<PressClient {...PRESS_REAL} />) },
]

/**
 * 화면별 예산 — **2026-09-05 실측값 + 15%**.
 *
 * 여유를 15% 로 잡은 이유: 딱 맞게 잡으면 한 줄만 고쳐도 빨간불이 뜨고, 넉넉히 잡으면 다시
 * 카드 여덟 장으로 돌아가도 안 걸린다. 15% 는 「문장 한둘·칸 몇 개」는 통과시키고
 * 「섹션 하나 추가」는 잡는 폭이다.
 *
 * ⚠️ 예산을 올리려면 **왜 그만큼 필요한지**를 같은 커밋에 적는다. 숫자만 올리면 이 회귀는
 *   아무것도 안 지키는 장식이 된다.
 */
const BUDGET: Record<string, { chunks: number; chars: number }> = {
  현황판: { chunks: 110, chars: 490 },
  기획: { chunks: 112, chars: 1300 },
  설계: { chunks: 110, chars: 660 },
  소재: { chunks: 72, chars: 780 },
  집필: { chunks: 175, chars: 1035 },
  // 검수: 카드 4장(75 덩어리 · 907 글자)을 층 도식으로 바꾸며 89 · 784 가 됐다. 덩어리가 +14 인
  // 이유는 층마다 통과 막대 1 + 명령 접힘 손잡이 1 + 모양 1 이 붙어서다 — 글자 −14% · 그림 2 → 6 과
  // 맞바꾼 구조다. 예산은 새 실측 89 + 15%.
  검수: { chunks: 102, chars: 900 },
  조판: { chunks: 80, chars: 785 },
}

describe('화면 밀집도', () => {
  it('실측을 표로 남긴다 — 예산을 고칠 때 근거를 눈으로 본다', () => {
    const rows = SCREENS.map((s) => ({ name: s.name, ...measure(s.html()) }))
    const line = (r: (typeof rows)[number]) =>
      `${r.name.padEnd(6)} 덩어리 ${String(r.chunks).padStart(4)} · 글자 ${String(r.chars).padStart(5)} · 조작 ${String(r.actions).padStart(3)} · svg ${String(r.svg).padStart(3)}`
    // eslint-disable-next-line no-console -- 예산을 정하는 근거를 눈으로 봐야 한다
    console.log('\n' + rows.map(line).join('\n'))
    expect(rows).toHaveLength(SCREENS.length)
  })

  it.each(SCREENS.map((s) => s.name))('%s 이 예산 안에 있다', (name) => {
    const s = SCREENS.find((x) => x.name === name)!
    const d = measure(s.html())
    const b = BUDGET[name]!
    expect(d.chunks, `${name} 덩어리 ${d.chunks} > 예산 ${b.chunks}`).toBeLessThanOrEqual(b.chunks)
    expect(d.chars, `${name} 글자 ${d.chars} > 예산 ${b.chars}`).toBeLessThanOrEqual(b.chars)
  })

  it('예산 표가 화면 목록과 어긋나지 않는다 — 화면을 늘리고 예산을 빼먹으면 안 잡힌다', () => {
    expect(Object.keys(BUDGET).sort()).toEqual(SCREENS.map((s) => s.name).sort())
  })

  it('현황판이 가장 가벼운 축에 든다 — 여기가 무거우면 처음 여는 사람이 길을 잃는다', () => {
    const rows = SCREENS.map((s) => ({ name: s.name, ...measure(s.html()) }))
    const home = rows.find((r) => r.name === '현황판')!
    const others = rows.filter((r) => r.name !== '현황판')
    // 글자는 가장 적어야 한다 — 현황판은 읽는 곳이 아니라 **고르는 곳**이다.
    expect(Math.min(...others.map((r) => r.chars))).toBeGreaterThan(home.chars)
  })

  it('현황판은 글자보다 그림에 기댄다 — 글자/그림 비가 다른 화면보다 낮다', () => {
    const ratio = (r: Density) => (r.svg ? r.chars / r.svg : Infinity)
    const rows = SCREENS.map((s) => ({ name: s.name, ...measure(s.html()) }))
    const home = rows.find((r) => r.name === '현황판')!
    for (const r of rows.filter((x) => x.name !== '현황판')) {
      expect(ratio(home), `현황판이 ${r.name} 보다 글자에 기댄다`).toBeLessThan(ratio(r))
    }
  })
})
