// apps/web/src/lib/video/__tests__/catalog.test.ts
//
// **영상이 화면에 뜨지 않는 두 가지 조용한 실패를 막는다.**
//
//   ① 공장이 지은 id 와 앱이 찾는 id 가 다르다 → 오류 없이 안 뜬다
//   ② 발행 전인데 화면이 영상 자리를 만든다 → 빈 플레이어가 남는다
//
// ①은 이 저장소가 이름·경로·수치에서 세 번 겪은 드리프트와 같은 모양이라 특히 위험하다.
// 그래서 규칙을 `@vocaflow/video-factory/ids` 한 곳에 두고, 여기서 **앱이 그것을 쓰는지**
// 확인한다(문자열을 다시 적으면 그 순간 정본이 둘이 된다).

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  VIDEO_IDS,
  activityVideoId,
  seriesVideoId,
  typeVideoId,
} from '@vocaflow/video-factory/ids'

import {
  VIDEO_PUBLISHED,
  activityVideo,
  curriculumVideo,
  introVideo,
  seriesVideo,
  typeVideo,
  videoById,
  videosByKind,
} from '../catalog'

const CATALOG_SRC = fs.readFileSync(path.join(__dirname, '../catalog.ts'), 'utf8')
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8')) as {
  baseUrl: string | null
  videos: { id: string; kind: string }[]
}

describe('id 규칙은 한 곳에서만 온다', () => {
  it('앱이 id 문자열을 다시 적지 않는다', () => {
    // `'type-'` `'series-'` `'module-'` 같은 접두어가 여기 적혀 있으면 정본이 둘이 된 것이다.
    const literals = CATALOG_SRC.match(/'(type|series|module|benefit|intro|curriculum)-[^']*'/g)
    expect(literals ?? []).toEqual([])
  })

  it('밑줄 유형 코드는 하이픈 id 가 된다', () => {
    expect(typeVideoId('word_order')).toBe('type-word-order')
    expect(typeVideoId('blank')).toBe('type-blank')
  })

  it('시리즈·활동 규칙', () => {
    expect(seriesVideoId('reading')).toBe('series-reading')
    expect(activityVideoId('flashcard')).toBe('module-flashcard')
    expect(VIDEO_IDS.intro).toBe('intro-platform')
  })
})

describe('발행 전에는 화면에 영상 자리를 만들지 않는다', () => {
  const published = VIDEO_PUBLISHED

  it('baseUrl 이 없으면 모든 조회가 null 이다', () => {
    if (published) return // 발행 후에는 이 검사가 의미 없다
    expect(introVideo()).toBeNull()
    expect(curriculumVideo()).toBeNull()
    expect(seriesVideo('reading')).toBeNull()
    expect(typeVideo('word_order')).toBeNull()
    expect(activityVideo('flashcard')).toBeNull()
  })

  it('발행 여부와 manifest 가 어긋나지 않는다', () => {
    expect(published).toBe(Boolean(manifest.baseUrl) && manifest.videos.length > 0)
  })
})

describe('발행 후에는 manifest 의 모든 항목이 화면에서 찾아진다', () => {
  it('id 로 전부 조회된다', () => {
    if (!VIDEO_PUBLISHED) return
    const missing = manifest.videos.filter((v) => videoById(v.id, 'wide') === null)
    expect(missing.map((v) => v.id)).toEqual([])
  })

  it('종류별 묶음이 manifest 와 같은 수를 센다', () => {
    if (!VIDEO_PUBLISHED) return
    const byKind = videosByKind()
    const total = Object.values(byKind).reduce((n, list) => n + list.length, 0)
    expect(total).toBe(manifest.videos.length)
  })
})

describe('서가에서 누르기 전에는 아무것도 내려받지 않는다', () => {
  // 왜 잠그나: `/video` 에는 62편이 한 화면에 깔린다. `<video poster=…>` 를 62개 두면
  // **포스터 62장이 한꺼번에** 내려온다 — `preload="none"` 은 영상 본체만 막고 포스터는 못 막는다.
  // 되돌리기 쉬운 최적화라("그냥 video 태그 쓰면 되잖아") 코드로 못 박는다.
  const RAW = fs.readFileSync(
    path.join(__dirname, '../../../components/video/ComponentVideo.tsx'),
    'utf8',
  )
  // 주석을 걷어낸 코드만 본다 — 머리말이 왜 이렇게 했는지 설명하며 `<video` 를 인용하는데,
  // 그걸 세면 검사가 자기 설명에 걸린다(실측: 첫 시도에서 그렇게 실패했다).
  const SRC = RAW.split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n')

  it('플레이어는 누른 뒤에야 붙는다', () => {
    expect(SRC).toContain('activated ? (')
    expect(SRC).toMatch(/<video\b/)
    // `<video>` 가 조건 바깥에 있으면 항상 붙는다 — 조건문보다 앞에 나오면 안 된다.
    expect(SRC.indexOf('activated ? (')).toBeLessThan(SRC.indexOf('<video'))
  })

  it('포스터는 지연 로드한다', () => {
    expect(SRC).toContain('loading="lazy"')
  })

  it('자동재생을 켜지 않는다', () => {
    expect(SRC).not.toMatch(/\bautoPlay\b/)
    expect(SRC).not.toMatch(/\bloop\b/)
  })
})
