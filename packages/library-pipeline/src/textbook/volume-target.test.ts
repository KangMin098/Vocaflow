// packages/library-pipeline/src/textbook/volume-target.test.ts
//
// **카탈로그에 없는 책이 조용히 나오지 않게 지킨다.**
//
// 실측 2026-09-12: 조판기가 `SERIES_CATALOG.find(...) ?? SERIES_CATALOG[0]` 로 시리즈를 골랐다.
// 오타를 내면 **독해 책이 나오고 기록은 오타난 id 로 남았다** — 오류 없이.
// 그래서 마지막 두 검사는 판정 함수가 아니라 **조판기 소스**를 본다: 기본값으로 때우는 코드가
// 돌아오면 잡는다.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { SERIES_CATALOG } from './series-catalog'
import { formatVolumeTarget, resolveVolumeTarget } from './volume-target'

const HERE = dirname(fileURLToPath(import.meta.url))
const RENDERER = join(HERE, '..', '..', '..', '..', 'scripts', 'textbook', 'render-volume.mjs')

describe('resolveVolumeTarget', () => {
  it('정의된 (시리즈, 단)은 통과하고 그 단을 함께 준다', () => {
    const t = resolveVolumeTarget('reading', 5)
    expect(t.ok).toBe(true)
    if (!t.ok) return
    expect(t.series.id).toBe('reading')
    expect(t.rung.vLevels).toContain(5)
    // 제목은 카탈로그가 소유한다 — 부르는 쪽이 짓지 않는다.
    expect(t.rung.volumeTitle.length).toBeGreaterThan(0)
  })

  it('모르는 시리즈는 기본값으로 때우지 않고 거절한다', () => {
    const t = resolveVolumeTarget('readng', 5)
    expect(t.ok).toBe(false)
    if (t.ok) return
    expect(t.reason).toContain('readng')
    // 오타를 바로 고칠 수 있게 쓸 수 있는 목록을 준다.
    expect(t.validSeries).toContain('reading')
    expect(t.validSeries).toEqual(SERIES_CATALOG.map((s) => s.id))
  })

  it('시리즈는 맞고 단이 없으면 그 시리즈의 단을 알려 준다', () => {
    // 어휘 시리즈는 V2 부터다 — 초등 저학년 단이 없다(그 밴드 어휘 재고가 518문항뿐이다).
    const t = resolveVolumeTarget('vocab', 1)
    expect(t.ok).toBe(false)
    if (t.ok) return
    expect(t.reason).toContain('V1')
    expect(t.validBands).toBeDefined()
    expect(t.validBands).not.toContain(1)
    expect(t.validBands).toContain(2)
  })

  it('카탈로그의 모든 시리즈 × 자기 단은 전부 통과한다', () => {
    for (const s of SERIES_CATALOG) {
      for (const r of s.rungs) {
        for (const v of r.vLevels) {
          expect(resolveVolumeTarget(s.id, v).ok, `${s.id} V${v}`).toBe(true)
        }
      }
    }
  })

  it('거절문이 고칠 수 있는 정보를 담는다', () => {
    const bad = resolveVolumeTarget('nope', 5)
    if (bad.ok) throw new Error('거절돼야 한다')
    expect(formatVolumeTarget(bad).join(' ')).toContain('쓸 수 있는 시리즈')
    const badBand = resolveVolumeTarget('vocab', 1)
    if (badBand.ok) throw new Error('거절돼야 한다')
    expect(formatVolumeTarget(badBand).join(' ')).toContain('그 시리즈의 단')
  })
})

describe('조판기가 기본값으로 때우지 않는다', () => {
  /**
   * **주석을 지운 뒤 본다.** 조판기 머리 주석에 옛 코드 모양이 근거로 적혀 있어서
   * 그대로 찾으면 고쳐 놓고도 「아직 있다」고 읽는다(실측 2026-09-12에 그렇게 걸렸다).
   * 기록은 남기고 검사는 코드만 본다.
   */
  const src = readFileSync(RENDERER, 'utf8')
    .split(String.fromCharCode(10))
    .filter((l) => !l.trimStart().startsWith('//'))
    .join(String.fromCharCode(10))

  it('판정 함수를 부른다', () => {
    expect(src).toContain('resolveVolumeTarget')
  })

  it('모르는 시리즈에 SERIES_CATALOG[0] 를 쓰지 않는다', () => {
    // 원래 결함: `SERIES_CATALOG.find((x) => x.id === SERIES) ?? SERIES_CATALOG[0]`.
    expect(src).not.toMatch(/\?\?\s*SERIES_CATALOG\[0\]/)
  })

  it('거절하면 조판물을 쓰기 전에 멈춘다', () => {
    const check = src.indexOf('resolveVolumeTarget')
    const write = src.indexOf('fs.writeFileSync(path.resolve(OUT)')
    expect(check).toBeGreaterThan(-1)
    expect(check).toBeLessThan(write)
  })
})
