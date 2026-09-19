// apps/web/src/lib/textbook/__tests__/shelf-scale.test.ts
//
// **타이포 스케일 계약** — 매대 컴포넌트가 스케일 밖 크기를 쓰면 여기서 실패한다.
//
// ── 왜 테스트로 강제하나 (실측 2026-09-01) ──────────────────────────
// 이 화면 하나가 서로 다른 font-size 를 14종 쓰고 있었다. 그중 여덟 종이 9~12.5px
// 사이였다 — 0.5px 차이는 위계를 만들지 못한다. 한 번 정리해 두어도 다음 사람이
// (혹은 다음의 내가) `text-[11.5px]` 를 하나 더 추가하면 조용히 되돌아간다.
// 스케일은 주석으로 부탁할 게 아니라 검사로 잠가야 유지된다.
//
// ⚠️ 소스를 문자열로 읽어 검사한다. 런타임 렌더로는 조건부 분기(상태별 클래스)를
//    다 못 밟기 때문이다 — 안 밟은 분기에 숨은 크기가 이 화면이 겪은 그 문제였다.

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { SHELF_TYPE_SCALE, SHELF_TYPE_SIZES, textSize } from '../shelf-scale'

const ROOT = path.resolve(__dirname, '../../../..')

/** 매대 화면을 이루는 파일 전부. 새 파일을 만들면 여기에 더한다. */
const SHELF_FILES = [
  'src/components/library/textbooks/TextbookShelf.tsx',
  'src/components/library/textbooks/ShelfControls.tsx',
  'src/components/library/textbooks/TextbookPickButton.tsx',
]

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

/** `text-[17px]` · `md:text-[22px]` 등에서 px 값만 뽑는다. */
function sizesIn(source: string): number[] {
  const out: number[] = []
  for (const m of source.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) out.push(Number(m[1]))
  return out
}

describe('매대 타이포 스케일', () => {
  it('스케일 자체에 중복이 없다', () => {
    expect(new Set(SHELF_TYPE_SIZES).size).toBe(SHELF_TYPE_SIZES.length)
  })

  it('textSize() 가 스케일 값을 그대로 낸다', () => {
    expect(textSize('title')).toBe(`text-[${SHELF_TYPE_SCALE.title}px]`)
  })

  it.each(SHELF_FILES)('%s 는 스케일 밖 크기를 쓰지 않는다', (rel) => {
    const used = sizesIn(read(rel))
    const outside = [...new Set(used)].filter((n) => !SHELF_TYPE_SIZES.includes(n)).sort((a, b) => a - b)
    expect(
      outside,
      `스케일 밖 크기: ${outside.join(', ')} — 정말 필요하면 shelf-scale.ts 를 먼저 고칠 것`,
    ).toEqual([])
  })

  it('매대 전체가 쓰는 크기 종류가 스케일 크기(7종)를 넘지 않는다', () => {
    const all = new Set(SHELF_FILES.flatMap((f) => sizesIn(read(f))))
    expect(all.size).toBeLessThanOrEqual(SHELF_TYPE_SIZES.length)
  })

  it('9~12.5px 구간에 세 종을 넘게 쌓지 않는다 (위계를 못 만드는 구간)', () => {
    const all = [...new Set(SHELF_FILES.flatMap((f) => sizesIn(read(f))))]
    const crowded = all.filter((n) => n >= 9 && n <= 12.5)
    expect(crowded.sort((a, b) => a - b).length).toBeLessThanOrEqual(3)
  })
})

describe('매대 계측 손잡이', () => {
  // `data-volume-card` 가 없으면 `shelf-ux-probe.mjs` 가 상품을 못 찾는다 —
  // 지수가 나빠지는 게 아니라 **못 재는 상태**가 된다. 그게 더 나쁘다.
  it('목록·격자 두 진열 모두 data-volume-card 를 단다', () => {
    expect(read(SHELF_FILES[0])).toContain('data-volume-card')
    expect(read(SHELF_FILES[1])).toContain('data-volume-card')
  })
})
