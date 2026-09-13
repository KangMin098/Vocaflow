// apps/web/src/lib/admin/video-console.ts
//
// **영상 공장 콘솔의 유일한 수치 출처.**
//
// 화면에 뜨는 모든 숫자가 여기서 나온다. 상수는 하나도 없다 — `/admin` 대시보드가 목업
// 상수로 "총 사용자 1,247"(실제 3)을 띄워 놓았던 사고와 같은 이유다.
//
// ── 세 곳을 겹쳐 본다 ──────────────────────────────────────────────
//   ① **있어야 할 것** — 커밋된 구성요소 원천 (`lib/video/components.ts`)
//   ② **발행했다고 적힌 것** — `manifest.json` (커밋됨)
//   ③ **실제로 살아 있는 것** — `storage.objects` 의 `video` 버킷
//
// 셋이 어긋나는 방식이 각각 다른 사고를 뜻한다:
//   ①에 있고 ②에 없다 → **안 만든 편**. 플랫폼은 자랐는데 영상이 안 따라왔다
//   ②에 있고 ①에 없다 → **없어진 구성요소**. 화면이 죽은 것을 가리킨다
//   ②에 있고 ③에 없다 → **유실**. manifest 는 있다는데 파일이 없다 = 화면에서 깨진다
//
// ③이 가장 중요하다. ①②만 보면 **"발행했다"는 기록**만 보는 것이고, 그 기록은 파일이
// 지워져도 그대로 남는다.
//
// 권한: 호출자가 requireAdmin() 을 통과한 뒤 service_role 클라이언트를 넘긴다.
// 실패 처리: 못 읽은 것은 **null 로 나른다.** 0 으로 뭉개면 "조회 0회" 같은 거짓 안심을 준다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { platformComponents, type PlatformComponent } from '@/lib/video/components'
import { VIDEO_BUILT_AT, type VideoFormat, type VideoKind } from '@/lib/video/catalog'
import manifestJson from '@/lib/video/manifest.json'

type AdminClient = SupabaseClient

const BUCKET = 'video'
const FORMATS: VideoFormat[] = ['wide', 'vertical', 'square']

export interface ManifestEntry {
  id: string
  kind: VideoKind
  title: string
  seconds: number
  captions: string
  formats: Partial<Record<VideoFormat, { file: string; poster: string; bytes: number }>>
}
interface Manifest {
  builtAt: string
  baseUrl: string | null
  videos: ManifestEntry[]
}
const manifest = manifestJson as unknown as Manifest

/** 한 구성요소의 상태 — 화면 표의 한 행. */
export interface VideoRow {
  id: string
  kind: VideoKind
  /** 구성요소 이름(영상 제목이 아니라). */
  name: string
  source: string
  /** manifest 에 있는가. */
  published: boolean
  seconds: number | null
  /** 규격별로 **실제 파일이 스토리지에 있는가**. 못 읽었으면 null. */
  live: Record<VideoFormat, boolean> | null
  /** 썸네일·자막이 실제로 올라가 있는가. */
  thumb: boolean | null
  captions: boolean | null
  /** 총 바이트(발행된 규격 합). */
  bytes: number | null
}

export type VideoIssue =
  /** 구성요소는 있는데 영상이 없다 */
  | { kind: 'missing'; id: string; name: string }
  /** manifest 에 있는데 구성요소가 없다 */
  | { kind: 'orphan'; id: string }
  /** manifest 에 있는데 파일이 없다 — 화면에서 깨진다 */
  | { kind: 'lost'; id: string; what: string }

export interface VideoViews {
  /** 종류별 재생 시작. 못 읽었으면 null. */
  started: Record<string, number> | null
  completed: Record<string, number> | null
  /** 영상 id 별 재생 시작 — 계측에 id 가 실리기 시작한 뒤부터 쌓인다. */
  byId: Record<string, number> | null
}

export interface VideoConsole {
  /** manifest 를 만든 시각 — "이 화면이 말하는 발행본은 언제 것인가". */
  builtAt: string
  /** 발행 기준 URL. null 이면 화면에 영상이 **한 편도 안 뜬다**. */
  baseUrl: string | null
  rows: VideoRow[]
  issues: VideoIssue[]
  views: VideoViews
  /** 스토리지를 못 읽었으면 이유 — 화면이 "0개" 대신 이 문장을 띄운다. */
  storageError: string | null
}

/** 스토리지에 실제로 있는 객체 이름 집합. 못 읽으면 null. */
async function liveObjects(db: AdminClient): Promise<{ names: Set<string> | null; error: string | null }> {
  const names = new Set<string>()
  // 폴더별로 나눠 읽는다 — `list('')` 는 하위 폴더를 펼치지 않고 폴더 이름만 준다.
  for (const folder of ['', 'wide', 'vertical', 'square', 'thumb']) {
    const { data, error } = await db.storage.from(BUCKET).list(folder, { limit: 1000 })
    if (error) return { names: null, error: error.message }
    for (const o of data ?? []) {
      // 폴더 항목은 id 가 null 로 온다 — 파일만 센다.
      if (o.id === null) continue
      names.add(folder ? `${folder}/${o.name}` : o.name)
    }
  }
  return { names, error: null }
}

/** 영상 관측 집계. 계측이 아직 한 건도 없으면 **빈 객체**(0건)이고, 못 읽으면 null 이다. */
async function readViews(db: AdminClient): Promise<VideoViews> {
  const { data, error } = await db
    .from('funnel_events')
    .select('event, meta')
    .in('event', ['video_started', 'video_completed'])
    .limit(10000)
  if (error || !data) return { started: null, completed: null, byId: null }

  const started: Record<string, number> = {}
  const completed: Record<string, number> = {}
  const byId: Record<string, number> = {}
  for (const row of data as { event: string; meta: Record<string, unknown> | null }[]) {
    const kind = typeof row.meta?.kind === 'string' ? row.meta.kind : '(미상)'
    const bucket = row.event === 'video_started' ? started : completed
    bucket[kind] = (bucket[kind] ?? 0) + 1
    const id = typeof row.meta?.videoId === 'string' ? row.meta.videoId : null
    if (id && row.event === 'video_started') byId[id] = (byId[id] ?? 0) + 1
  }
  return { started, completed, byId }
}

/**
 * **순수 비교** — 구성요소 · manifest · 실제 파일 이름 셋을 겹친다.
 *
 * DB 를 안 쓴다. 그래야 "무엇을 사고로 보는가" 를 **고정 입력으로 검증**할 수 있다 —
 * 이 판정이 틀리면 관리자가 멀쩡한 것을 고치러 가거나, 깨진 것을 못 본다.
 */
export function compareVideoState(
  components: PlatformComponent[],
  videos: ManifestEntry[],
  names: Set<string> | null,
): { rows: VideoRow[]; issues: VideoIssue[] } {
  const byId = new Map(videos.map((v) => [v.id, v]))
  const componentIds = new Set(components.map((c) => c.id))

  const rows: VideoRow[] = components.map((c) => {
    const entry = byId.get(c.id)
    if (!entry) {
      return {
        ...c,
        published: false,
        seconds: null,
        live: null,
        thumb: null,
        captions: null,
        bytes: null,
      }
    }
    const live = names
      ? (Object.fromEntries(
          FORMATS.map((f) => [f, Boolean(entry.formats[f] && names.has(entry.formats[f]!.file))]),
        ) as Record<VideoFormat, boolean>)
      : null
    const bytes = FORMATS.reduce((n, f) => n + (entry.formats[f]?.bytes ?? 0), 0)
    return {
      ...c,
      published: true,
      seconds: entry.seconds,
      live,
      thumb: names ? names.has(`thumb/${c.id}.jpg`) : null,
      captions: names ? names.has(entry.captions) : null,
      bytes,
    }
  })

  const issues: VideoIssue[] = []
  for (const c of components) {
    if (!byId.has(c.id)) issues.push({ kind: 'missing', id: c.id, name: c.name })
  }
  for (const v of videos) {
    if (!componentIds.has(v.id)) issues.push({ kind: 'orphan', id: v.id })
  }
  if (names) {
    for (const v of videos) {
      for (const f of FORMATS) {
        const file = v.formats[f]?.file
        if (file && !names.has(file)) issues.push({ kind: 'lost', id: v.id, what: f })
      }
      if (!names.has(v.captions)) issues.push({ kind: 'lost', id: v.id, what: '자막' })
      if (!names.has(`thumb/${v.id}.jpg`)) issues.push({ kind: 'lost', id: v.id, what: '썸네일' })
    }
  }

  return { rows, issues }
}

export async function loadVideoConsole(db: AdminClient): Promise<VideoConsole> {
  const [{ names, error: storageError }, views] = await Promise.all([
    liveObjects(db),
    readViews(db),
  ])
  const { rows, issues } = compareVideoState(platformComponents(), manifest.videos, names)

  return {
    builtAt: VIDEO_BUILT_AT,
    baseUrl: manifest.baseUrl,
    rows,
    issues,
    views,
    storageError,
  }
}
