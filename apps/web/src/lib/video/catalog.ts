// apps/web/src/lib/video/catalog.ts
//
// **앱이 영상을 찾는 단 하나의 창구.**
//
// 앱은 공장 패키지에서 **id 규칙(`/ids` — 순수 함수 다섯)만** 가져온다. 패키지 루트를
// import 하면 헤드리스 렌더러와 `node:fs` 가 딸려 와 Next 번들이 통째로 무거워지고
// 클라이언트에서 깨진다. 내용은 공장이 써 준 **JSON 한 장**에서 읽는다.
//
// ── 없으면 없는 대로 ─────────────────────────────────────────────
// `baseUrl` 이 없으면(=아직 발행 전) 모든 조회가 `null` 을 돌려주고 **화면에 아무것도 안 뜬다.**
// 빈 플레이어나 "영상 준비 중" 자리를 만들지 않는다 — 그건 약속만 하고 못 지키는 자리다.

import {
  VIDEO_IDS,
  activityVideoId,
  seriesVideoId,
  typeVideoId,
} from '@vocaflow/video-factory/ids'

import manifestJson from './manifest.json'

export type VideoKind = 'intro' | 'benefit' | 'curriculum' | 'series' | 'type' | 'module'
export type VideoFormat = 'wide' | 'vertical' | 'square'

export interface VideoFile {
  file: string
  poster: string
  bytes: number
  width: number
  height: number
}

export interface VideoEntry {
  id: string
  kind: VideoKind
  title: string
  subtitle: string
  seconds: number
  captions: string
  formats: Partial<Record<VideoFormat, VideoFile>>
}

interface VideoManifest {
  builtAt: string
  baseUrl: string | null
  videos: VideoEntry[]
}

const manifest = manifestJson as unknown as VideoManifest

/** 발행됐는가. 이 값이 false 면 화면에 영상 자리를 만들지 않는다. */
export const VIDEO_PUBLISHED = Boolean(manifest.baseUrl) && manifest.videos.length > 0

export const VIDEO_BUILT_AT = manifest.builtAt

function url(relative: string): string | null {
  if (!manifest.baseUrl) return null
  return `${manifest.baseUrl.replace(/\/$/, '')}/${relative}`
}

export interface ResolvedVideo {
  id: string
  kind: VideoKind
  title: string
  subtitle: string
  seconds: number
  format: VideoFormat
  src: string
  poster: string
  captions: string
  width: number
  height: number
}

/** id 로 찾는다. 없거나 그 규격을 안 찍었으면 `null`. */
export function videoById(id: string, format: VideoFormat = 'wide'): ResolvedVideo | null {
  const entry = manifest.videos.find((v) => v.id === id)
  const f = entry?.formats[format]
  if (!entry || !f) return null
  const src = url(f.file)
  const poster = url(f.poster)
  const captions = url(entry.captions)
  if (!src || !poster || !captions) return null
  return {
    id: entry.id,
    kind: entry.kind,
    title: entry.title,
    subtitle: entry.subtitle,
    seconds: entry.seconds,
    format,
    src,
    poster,
    captions,
    width: f.width,
    height: f.height,
  }
}

/* ── 구성요소 → 영상 id ───────────────────────────────────────── */
//
// **id 규칙은 여기 없다** — `@vocaflow/video-factory/ids` 하나가 정본이고 공장도 그걸 쓴다.
// 앱과 공장이 각자 규칙을 적으면 갈리는데, 갈려도 **오류가 안 난다**(영상만 조용히 안 뜬다).

export function introVideo(format: VideoFormat = 'wide'): ResolvedVideo | null {
  return videoById(VIDEO_IDS.intro, format)
}

export function curriculumVideo(format: VideoFormat = 'wide'): ResolvedVideo | null {
  return videoById(VIDEO_IDS.curriculum, format)
}

export function seriesVideo(seriesId: string, format: VideoFormat = 'wide'): ResolvedVideo | null {
  return videoById(seriesVideoId(seriesId), format)
}

/** 문항 유형 코드는 밑줄을 쓰고(`word_order`) 영상 id 는 하이픈을 쓴다(`type-word-order`). */
export function typeVideo(typeCode: string, format: VideoFormat = 'wide'): ResolvedVideo | null {
  return videoById(typeVideoId(typeCode), format)
}

export function activityVideo(activityId: string, format: VideoFormat = 'wide'): ResolvedVideo | null {
  return videoById(activityVideoId(activityId), format)
}

/** 목록 화면용 — 종류로 묶어서 돌려준다. */
export function videosByKind(): Record<VideoKind, ResolvedVideo[]> {
  const out = {
    intro: [],
    benefit: [],
    curriculum: [],
    series: [],
    type: [],
    module: [],
  } as Record<VideoKind, ResolvedVideo[]>
  for (const v of manifest.videos) {
    const resolved = videoById(v.id, 'wide')
    if (resolved) out[v.kind].push(resolved)
  }
  return out
}

export const KIND_LABEL: Record<VideoKind, string> = {
  intro: '플랫폼 소개',
  benefit: '이 제품이 다른 점',
  curriculum: '커리큘럼',
  series: '브랜드 시리즈',
  type: '문항 유형',
  module: '학습 활동',
}
