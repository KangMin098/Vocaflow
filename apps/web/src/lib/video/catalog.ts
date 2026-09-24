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

export type VideoKind =
  | 'intro'
  | 'benefit'
  | 'curriculum'
  | 'series'
  | 'type'
  | 'module'
  | 'method'
  | 'advice'
  | 'request'
export type VideoFormat = 'wide' | 'vertical' | 'square'

export interface VideoFile {
  file: string
  poster: string
  bytes: number
  width: number
  height: number
  /** 내용 해시 — 같은 경로를 덮어쓰는 교체 뒤에도 캐시된 옛 파일이 안 나가게 `?v=` 로 붙인다 */
  v?: string
  posterV?: string
}

export interface VideoEvidence {
  label: string
  value: string
  source: string
}

export interface VideoEntry {
  id: string
  kind: VideoKind
  title: string
  subtitle: string
  seconds: number
  captions: string
  captionsV?: string
  /** 컷별 자막 전문 — 편별 페이지가 **서버 렌더 HTML** 로 낸다(I6). */
  transcript: string[]
  /** 화면에 나온 수치와 출처. 근거 없는 수치를 페이지에 싣지 않기 위해 함께 나른다. */
  evidence: VideoEvidence[]
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

function url(relative: string, v?: string): string | null {
  if (!manifest.baseUrl) return null
  // 옛 manifest(해시 없음)는 그대로 — 해시는 다음 포장부터 붙는다
  return `${manifest.baseUrl.replace(/\/$/, '')}/${relative}${v ? `?v=${v}` : ''}`
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
  transcript: string[]
  evidence: VideoEvidence[]
}

/** id 로 찾는다. 없거나 그 규격을 안 찍었으면 `null`. */
export function videoById(id: string, format: VideoFormat = 'wide'): ResolvedVideo | null {
  const entry = manifest.videos.find((v) => v.id === id)
  const f = entry?.formats[format]
  if (!entry || !f) return null
  const src = url(f.file, f.v)
  const poster = url(f.poster, f.posterV)
  const captions = url(entry.captions, entry.captionsV)
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
    transcript: entry.transcript ?? [],
    evidence: entry.evidence ?? [],
  }
}

/** 편별 페이지가 쓰는 목록 — `generateStaticParams` 용. */
export function allVideoIds(): string[] {
  return manifest.videos.map((v) => v.id)
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

/**
 * 종류의 이름 — **이 표가 종류 목록이자 순서의 정본이다.**
 *
 * `Record<VideoKind, string>` 이라 종류를 하나 더하면 여기가 컴파일 오류로 먼저 걸린다.
 * `KIND_ORDER`·`videosByKind`·`/video` 목록이 전부 이 표에서 파생되므로 따로 손볼 곳이 없다.
 *
 * **키 순서가 곧 화면 순서다** — 처음 온 사람이 읽는 순서:
 *   무엇인가(intro) → 왜 다른가(benefit) → 어떻게 배우나(method) → 무엇을 권하나(advice)
 *   → 무엇으로(curriculum · series · type · module)
 */
export const KIND_LABEL: Record<VideoKind, string> = {
  intro: '플랫폼 소개',
  benefit: '이 제품이 다른 점',
  method: '학습 방법',
  advice: '권장안',
  curriculum: '커리큘럼',
  series: '브랜드 시리즈',
  type: '문항 유형',
  module: '학습 활동',
  // 관리자 요청으로 기획·검토를 거친 편 — 분야가 여럿이라 한 이름으로 묶는다
  request: '기획 영상',
}

/**
 * 종류 전부 — **화면 순서 그대로.**
 *
 * ⚠️ `/video` 가 이 목록을 손으로 다시 적고 있었다. 종류를 둘 더했더니 화면은 멀쩡히 뜨면서
 *   **11편이 조용히 사라졌다**(73편 중 62편만 그려짐). 목록은 한 곳에만 있어야 한다.
 */
export const KIND_ORDER = Object.keys(KIND_LABEL) as VideoKind[]

/**
 * **규칙이 만드는 종류** — 구성요소 하나당 영상 하나가 있어야 하는 종류(분모가 있는 종류).
 *
 * `request` 는 여기 없다: 관리자 요청 하나당 한 편이라 「있어야 할 편」의 분모가 없다.
 * 요청 편 진척은 `/admin/video` 의 요청 탭(`video_requests`)이 센다.
 */
export const RULE_KIND_ORDER = KIND_ORDER.filter((k) => k !== 'request')

/**
 * 목록 화면용 — 종류로 묶어서 돌려준다.
 *
 * ⚠️ 예전에는 빈 배열 여섯 개를 **손으로 적고** `as Record<VideoKind, …>` 로 캐스트했다.
 *   캐스트가 빠진 키를 가려서 타입체크는 통과하는데, 새 종류의 영상이 들어오면
 *   `out[v.kind]` 가 undefined 라 **화면이 죽는다**(실측 2026-09-13에 `method`·`advice` 를
 *   더하며 발견). 그래서 이제 `KIND_LABEL` 에서 만든다 — 손으로 적을 곳이 없다.
 */
export function videosByKind(): Record<VideoKind, ResolvedVideo[]> {
  const out = Object.fromEntries(KIND_ORDER.map((k) => [k, [] as ResolvedVideo[]])) as Record<
    VideoKind,
    ResolvedVideo[]
  >
  for (const v of manifest.videos) {
    const resolved = videoById(v.id, 'wide')
    // manifest 는 파일이라 이 코드보다 **새로울 수도, 낡을 수도** 있다 — 모르는 종류가
    // 오면 버리고 넘어간다. 여기서 죽으면 영상 목록 전체가 안 뜬다.
    if (resolved && out[v.kind]) out[v.kind].push(resolved)
  }
  return out
}
