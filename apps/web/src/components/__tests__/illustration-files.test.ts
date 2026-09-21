// apps/web/src/components/__tests__/illustration-files.test.ts
//
// **코드가 부르는 삽화 파일이 실제로 있다**(DD-68). 삽화는 무료 생성 한도 안에서 나눠 만들어져서
// 일부가 빠질 수 있다(2026-09-21: 한도 소진으로 spot-lost · welcome · calendar 3점 미생성).
// 이름만 적어 두면 화면에는 깨진 그림이 뜨고 빌드는 통과한다 — 문자열로 적힌 이름을 전부 파일과 맞춘다.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '../..')
const DIR = path.resolve(SRC, '../public/illustrations/tines')
// 따옴표 안의 삽화 이름: 'tile-books' · "spot-vault" · `spot-${…}` 는 조립이라 뺀다
const NAME = /['"`]((?:spot|tile|band|scene|hero|card|bed|pattern)-[a-z0-9-]+)['"`]/g

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (name === '__tests__' || name === 'node_modules' || name.startsWith('.')) continue
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

describe('삽화 이름 ↔ 파일', () => {
  it('문자열로 적힌 tines 삽화 이름은 모두 public/illustrations/tines 에 있다', () => {
    const missing: string[] = []
    for (const f of walk(SRC)) {
      const src = readFileSync(f, 'utf8')
      if (!src.includes('illustrations/tines') && !src.includes('SpotState') && !src.includes('AreaHero') && !src.includes('ToneTabs')) continue
      for (const m of src.matchAll(NAME)) {
        const id = m[1]
        if (!existsSync(path.join(DIR, `${id}.webp`))) missing.push(`${path.relative(SRC, f)} → ${id}`)
      }
    }
    expect(missing, `없는 삽화:\n  ${missing.join('\n  ')}`).toEqual([])
  })

  it('SpotState 의 art 는 spot-<art>.webp 로 있다', () => {
    const src = readFileSync(path.join(SRC, 'components/ui/SpotState.tsx'), 'utf8')
    const union = src.match(/export type SpotArt =([\s\S]*?)\n\n/)?.[1] ?? ''
    const arts = [...union.matchAll(/'([a-z-]+)'/g)].map((m) => m[1])
    expect(arts.length).toBeGreaterThan(5)
    for (const a of arts) expect(existsSync(path.join(DIR, `spot-${a}.webp`)), a).toBe(true)
  })
})
