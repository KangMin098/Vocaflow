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
