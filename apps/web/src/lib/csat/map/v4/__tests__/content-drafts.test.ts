// apps/web/src/lib/csat/map/v4/__tests__/content-drafts.test.ts
// rev4.0 5차 — 콘텐츠 초안 비공개를 기계적으로 강제한다(4차 2차 판정 지적: status 문자열뿐이었다).
//   ① docs/csat-learner/v4/content-drafts/*.draft.json 은 모두 release.public === false · 막힌 조건(blockedBy) 명시
//   ② 앱 코드(apps/web/src)는 초안 폴더를 가져다 쓰지 않는다 — 공개는 B7 사람 출시 승인 뒤 정본 annotations 로 옮겨서만
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '../../../../../../../..')
const DRAFTS = path.join(ROOT, 'docs/csat-learner/v4/content-drafts')
const SRC = path.join(ROOT, 'apps/web/src')

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? (d.name === 'node_modules' ? [] : walk(path.join(dir, d.name))) : [path.join(dir, d.name)]))

describe('콘텐츠 초안 비공개 강제', () => {
  const drafts = fs.readdirSync(DRAFTS).filter((f) => f.endsWith('.draft.json'))

  it('초안이 있다(검사가 빈 폴더로 조용히 통과하지 않게)', () => {
    expect(drafts.length).toBeGreaterThan(0)
  })

  it.each(drafts)('%s — release.public=false · 막힌 조건에 사람 출시 승인 포함', (f) => {
    const d = JSON.parse(fs.readFileSync(path.join(DRAFTS, f), 'utf8')) as { release?: { public?: unknown; blockedBy?: unknown } }
    expect(d.release?.public).toBe(false)
    expect(Array.isArray(d.release?.blockedBy) && (d.release!.blockedBy as string[]).includes('human_release_approval')).toBe(true)
  })

  it('앱 코드가 초안 폴더를 참조하지 않는다', () => {
    const hits = walk(SRC)
      .filter((f) => /\.(ts|tsx|js|mjs|json)$/.test(f) && !f.includes(`${path.sep}__tests__${path.sep}`))
      .filter((f) => fs.readFileSync(f, 'utf8').includes('content-drafts'))
    expect(hits.map((f) => path.relative(ROOT, f))).toEqual([])
  })
})
