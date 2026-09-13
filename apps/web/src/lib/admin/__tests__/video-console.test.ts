// apps/web/src/lib/admin/__tests__/video-console.test.ts
//
// **콘솔이 무엇을 사고로 보는가** — 고정 입력으로 잠근다.
//
// 이 판정이 틀리면 두 방향으로 손해가 난다: 멀쩡한 것을 고치러 가거나(오탐),
// 깨진 것을 못 본다(누락). 후자가 더 나쁘다 — 학습자 화면에서 영상이 깨진 채 떠 있는데
// 콘솔은 초록이다.
//
// 특히 **`null`(못 잼)과 `false`(없음)를 섞지 않는지**를 본다. 스토리지를 못 읽었을 때
// "파일 0개" 로 그리면 관리자가 있지도 않은 사고를 쫓는다.

import { describe, expect, it } from 'vitest'

import { compareVideoState, type ManifestEntry } from '../video-console'
import type { PlatformComponent } from '@/lib/video/components'

const component = (id: string, name = id): PlatformComponent => ({
  id,
  kind: 'type',
  name,
  source: 'test',
})

const entry = (id: string): ManifestEntry => ({
  id,
  kind: 'type',
  title: id,
  seconds: 10,
  captions: `${id}.vtt`,
  formats: {
    wide: { file: `wide/${id}.mp4`, poster: `wide/${id}.jpg`, bytes: 100 },
    vertical: { file: `vertical/${id}.mp4`, poster: `vertical/${id}.jpg`, bytes: 100 },
    square: { file: `square/${id}.mp4`, poster: `square/${id}.jpg`, bytes: 100 },
  },
})

/** 그 편이 완전히 올라간 상태의 파일 이름들. */
const allNames = (id: string): string[] => [
  `wide/${id}.mp4`,
  `vertical/${id}.mp4`,
  `square/${id}.mp4`,
  `${id}.vtt`,
  `thumb/${id}.jpg`,
]

describe('셋이 일치하면 사고가 없다', () => {
  it('구성요소 = manifest = 파일', () => {
    const { rows, issues } = compareVideoState(
      [component('type-a'), component('type-b')],
      [entry('type-a'), entry('type-b')],
      new Set([...allNames('type-a'), ...allNames('type-b')]),
    )
    expect(issues).toEqual([])
    expect(rows.every((r) => r.published)).toBe(true)
    expect(rows.every((r) => r.live?.wide && r.live.vertical && r.live.square)).toBe(true)
    expect(rows.every((r) => r.thumb === true && r.captions === true)).toBe(true)
  })
})

describe('어긋나는 세 방식이 각각 다르게 잡힌다', () => {
  it('구성요소는 있는데 영상이 없다 → missing', () => {
    const { rows, issues } = compareVideoState([component('type-a', '빈칸 추론')], [], new Set())
    expect(issues).toEqual([{ kind: 'missing', id: 'type-a', name: '빈칸 추론' }])
    // 행은 남는다 — 없는 것도 보여야 "밀린 것" 이 보인다.
    expect(rows).toHaveLength(1)
    expect(rows[0]!.published).toBe(false)
  })

  it('영상은 있는데 구성요소가 없다 → orphan', () => {
    const { issues } = compareVideoState([], [entry('type-gone')], new Set(allNames('type-gone')))
    expect(issues.filter((i) => i.kind === 'orphan')).toEqual([{ kind: 'orphan', id: 'type-gone' }])
  })

  it('manifest 에 있는데 파일이 없다 → lost (규격·자막·썸네일을 따로 센다)', () => {
    const names = new Set([`wide/type-a.mp4`, `${'type-a'}.vtt`])
    const { issues } = compareVideoState([component('type-a')], [entry('type-a')], names)
    const lost = issues.filter((i) => i.kind === 'lost').map((i) => (i as { what: string }).what)
    expect(lost.sort()).toEqual(['square', 'vertical', '썸네일'].sort())
  })
})

describe('못 잼과 없음을 섞지 않는다', () => {
  it('스토리지를 못 읽으면 live·thumb·captions 가 null 이다 (false 가 아니라)', () => {
    const { rows, issues } = compareVideoState([component('type-a')], [entry('type-a')], null)
    expect(rows[0]!.live).toBeNull()
    expect(rows[0]!.thumb).toBeNull()
    expect(rows[0]!.captions).toBeNull()
    // 못 읽었으면 유실 판정을 내리지 않는다 — 거짓 경보가 된다.
    expect(issues.filter((i) => i.kind === 'lost')).toEqual([])
  })

  it('발행 안 된 편의 수치는 null 이다 — 0 이 아니다', () => {
    const { rows } = compareVideoState([component('type-a')], [], new Set())
    expect(rows[0]!.seconds).toBeNull()
    expect(rows[0]!.bytes).toBeNull()
  })
})
