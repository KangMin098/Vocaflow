// apps/web/src/lib/design/__tests__/screen-types.test.ts
//
// 학습자 화면 유형 정본(`screen-types.ts`)이 실제 코드와 갈라지지 않게 지킨다.
//   ① 정적 학습자 라우트(페이지 파일)가 빠짐없이 분류돼 있다 — 새 화면을 만들면 유형부터 정한다.
//   ② 분류표에만 있고 페이지가 없는 주소가 없다.
//   ③ 머리를 `ModuleHero`/`PageIntro` 로 적은 화면은 그 페이지(또는 직접 import 한 화면 컴포넌트)가 실제로 그것을 그린다.
//   ④ 기능형 화면은 발견형 히어로를, 발견형 화면은 기능형 머리를 쓰지 않는다(두 계층을 섞지 않는다).
//   ⑤ session ⇔ 전체 화면(`isFullScreenRoute`) — 셸이 걷히는 화면과 유형이 같은 말을 한다.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { isFullScreenRoute } from '@/lib/layout/full-screen-routes'

import { SCREEN_TYPES } from '../screen-types'

const SRC = resolve(__dirname, '..', '..', '..')
const APP = join(SRC, 'app')
/** 학습자 화면이 아닌 것 — 교사 콘솔 · 디자인 실험실 */
const NOT_LEARNER = new Set(['/teacher', '/hub-lab'])

function learnerPages(): Map<string, string> {
  const out = new Map<string, string>()
  const walk = (dir: string, url: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (!statSync(full).isDirectory() || name.startsWith('[')) continue
      if (name.startsWith('_') || name.startsWith('(')) {
        walk(full, url)
        continue
      }
      const child = `${url}/${name}`
      const page = join(full, 'page.tsx')
      if (existsSync(page) && !NOT_LEARNER.has(child)) out.set(child, page)
      walk(full, child)
    }
  }
  for (const group of ['(main)', '(app)']) {
    const base = join(APP, group)
    if (existsSync(base)) walk(base, '')
  }
  return out
}

/** 페이지 소스 + 그 페이지가 직접 import 한 (ui · lib 밖) 화면 컴포넌트 소스 — 한 단계만 따라간다. */
function screenSource(page: string): string {
  const src = readFileSync(page, 'utf8')
  let text = src
  for (const m of src.matchAll(/from '([^']+)'/g)) {
    const spec = m[1]
    const base = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(page), spec) : null
    if (!base || base.includes(join('components', 'ui')) || base.includes(join(SRC, 'lib'))) continue
    for (const ext of ['', '.tsx', '.ts', '/index.tsx', '/index.ts']) {
      const f = base + ext
      if (existsSync(f) && statSync(f).isFile()) {
        text += readFileSync(f, 'utf8')
        break
      }
    }
  }
  return text
}

const pages = learnerPages()

describe('학습자 화면 유형 정본', () => {
  it('스캔이 비어 있지 않다', () => {
    expect(pages.size).toBeGreaterThan(60)
  })

  it('① 모든 정적 학습자 라우트가 분류돼 있다', () => {
    const missing = [...pages.keys()].filter((r) => !(r in SCREEN_TYPES)).sort()
    expect(missing, `분류되지 않은 화면 — screen-types.ts 에 유형을 정한다:\n${missing.join('\n')}`).toEqual([])
  })

  it('② 분류표에만 있는 주소가 없다', () => {
    const stale = Object.keys(SCREEN_TYPES).filter((r) => !pages.has(r)).sort()
    expect(stale, `페이지가 없는 분류 — 지웠거나 옮겼다:\n${stale.join('\n')}`).toEqual([])
  })

  it('③ ModuleHero / PageIntro 라고 적은 화면은 실제로 그것을 그린다', () => {
    const wrong: string[] = []
    for (const [route, spec] of Object.entries(SCREEN_TYPES)) {
      if (spec.head !== 'ModuleHero' && spec.head !== 'PageIntro') continue
      const page = pages.get(route)
      if (!page) continue
      if (!new RegExp(`<${spec.head}\\b`).test(screenSource(page))) wrong.push(`${route} — ${spec.head} 없음`)
    }
    expect(wrong).toEqual([])
  })

  it('④ 두 머리 계층을 섞지 않는다', () => {
    const mixed: string[] = []
    for (const [route, spec] of Object.entries(SCREEN_TYPES)) {
      const page = pages.get(route)
      if (!page) continue
      const text = screenSource(page)
      if (spec.type === 'functional' && /<ModuleHero\b/.test(text)) mixed.push(`${route} — 기능형인데 발견형 히어로`)
      if (spec.type === 'landing' && /<PageIntro\b/.test(text)) mixed.push(`${route} — 발견형인데 기능형 머리`)
    }
    expect(mixed).toEqual([])
  })

  it('⑤ session 은 전체 화면 라우트와 정확히 같다', () => {
    const disagree = [...pages.keys()]
      .filter((r) => (SCREEN_TYPES[r]?.type === 'session') !== isFullScreenRoute(r))
      .map((r) => `${r} — 유형 ${SCREEN_TYPES[r]?.type ?? '없음'} · 전체 화면 ${isFullScreenRoute(r)}`)
    expect(disagree).toEqual([])
  })
})
