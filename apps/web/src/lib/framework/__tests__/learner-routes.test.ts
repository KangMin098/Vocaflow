// apps/web/src/lib/framework/__tests__/learner-routes.test.ts
//
// **매니페스트가 파일 시스템과 어긋나면 여기서 막는다.**
//
// `learner-routes.ts` 는 브라우저 번들에 들어가야 해서 `fs` 를 쓸 수 없다(계측이
// 클라이언트에서 경로를 정규화한다). 그래서 목록이 선언이고, 선언은 낡는다 —
// 라우트를 만들고 매니페스트에 안 적으면 그 화면은 **사이트맵에서 사라지고
// 계측에서 `other` 로 접힌다.** 둘 다 조용한 실패라 아무도 모른다.
//
// 그래서 이 테스트가 `app/(main)`·`app/(app)` 을 실제로 훑어 대조한다.
// (같은 방식을 `components/layout/__tests__/wayfinding.test.ts` 와
//  `tests/e2e/utils/learner-routes.ts` 가 이미 쓴다.)

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  LEARNER_ROUTES,
  SCREEN_IDS,
  UNKNOWN_SCREEN,
  isLearnerDestination,
  screenIdOf,
} from '../learner-routes'
import { MODULE_ACTIVITIES } from '../registry'

const APP_DIR = path.resolve(__dirname, '../../../app')

/** 한 라우트 그룹 아래의 모든 라우트. 동적 세그먼트는 `[x]` 그대로 남긴다. */
function routesUnder(group: string): string[] {
  const base = path.join(APP_DIR, group)
  if (!fs.existsSync(base)) return []
  const out: string[] = []
  const walk = (dir: string, url: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name)
      if (!fs.statSync(full).isDirectory()) continue
      // 라우트 그룹·비공개 폴더는 URL 에 들어가지 않는다.
      if (name.startsWith('_') || name.startsWith('(')) {
        walk(full, url)
        continue
      }
      const child = `${url}/${name}`
      if (fs.existsSync(path.join(full, 'page.tsx'))) out.push(child)
      walk(full, child)
    }
  }
  walk(base, '')
  return out
}

const onDisk = [...new Set([...routesUnder('(main)'), ...routesUnder('(app)')])].sort()
const declared = LEARNER_ROUTES.map((r) => r.path).sort()

describe('학습자 라우트 매니페스트', () => {
  it('라우트를 실제로 찾았다 (0 은 성과가 아니라 측정 실패다)', () => {
    expect(onDisk.length).toBeGreaterThan(50)
  })

  it('파일 시스템에 있는 라우트가 전부 선언돼 있다', () => {
    const missing = onDisk.filter((r) => !declared.includes(r))
    expect(
      missing,
      '이 라우트들이 lib/framework/learner-routes.ts 에 없다 — ' +
        '사이트맵에서 사라지고 계측이 `other` 로 접는다',
    ).toEqual([])
  })

  it('선언에만 있고 파일 시스템에 없는 라우트가 없다', () => {
    const stale = declared.filter((r) => !onDisk.includes(r))
    expect(stale, '이 라우트들은 지워졌는데 선언에 남아 있다 — 사이트맵이 404 를 판다').toEqual([])
  })

  it('화면 id 는 유일하고, isSafeProps 계약(24자 이내·공백 없음)을 지킨다', () => {
    expect(new Set(SCREEN_IDS).size).toBe(SCREEN_IDS.length)
    const bad = SCREEN_IDS.filter((id) => id.length > 24 || /\s/.test(id))
    expect(bad, 'isSafeProps 가 이 값들을 런타임에 버린다 — 계측이 조용히 0 이 된다').toEqual([])
    expect(SCREEN_IDS).not.toContain(UNKNOWN_SCREEN)
  })

  it('모든 라우트가 자기 화면 id 로 정규화된다 (동적 세그먼트 포함)', () => {
    for (const route of LEARNER_ROUTES) {
      // 동적 세그먼트에 실제 값이 들어와도 같은 id 로 접혀야 한다.
      const concrete = route.path.replace(/\[[^\]]+\]/g, 'sample-1')
      expect(screenIdOf(concrete), route.path).toBe(route.screen)
    }
  })

  it('모르는 경로는 경로를 그대로 흘리지 않고 other 로 접는다', () => {
    expect(screenIdOf('/fit?shared=abc')).toBe(UNKNOWN_SCREEN)
    expect(screenIdOf('/there/is/no/such/screen')).toBe(UNKNOWN_SCREEN)
  })

  it('레지스트리의 모듈 활동 경로가 매니페스트에 있다', () => {
    const paths = new Set(declared)
    const missing = MODULE_ACTIVITIES.filter((a) => a.route && !paths.has(a.route.path)).map(
      (a) => a.route?.path,
    )
    expect(missing, 'registry.ts 가 아는 세션 경로가 매니페스트에 없다').toEqual([])
  })

  it('링크로 걸 수 있는 목적지에는 동적·리다이렉트·실험 화면이 없다', () => {
    const destinations = LEARNER_ROUTES.filter(isLearnerDestination)
    expect(destinations.some((r) => r.dynamic)).toBe(false)
    expect(destinations.some((r) => r.kind === 'redirect')).toBe(false)
    // `/hub-lab` 은 인바운드 링크 0건인 설계 실험이다 — 학습자에게 팔지 않는다.
    expect(destinations.some((r) => r.path === '/hub-lab')).toBe(false)
  })
})
