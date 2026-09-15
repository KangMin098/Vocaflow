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

import { SERIES_CATALOG } from '@vocaflow/library-pipeline/textbook-series-catalog'
import { SERIES_SPINE } from '@vocaflow/library-pipeline/textbook-series'
import { volumeVideoId } from '@vocaflow/video-factory/ids'

import { platformComponents, type PlatformComponent } from '@/lib/video/components'
import { VIDEO_BUILT_AT, type VideoFormat, type VideoKind } from '@/lib/video/catalog'
import manifestJson from '@/lib/video/manifest.json'

// 화면과 함께 쓰는 모양·상수는 `video-console-shape.ts` 에 있다 — 이 파일은 `server-only` 라
// 화면이 직접 들여오면 빌드가 죽는다. 여기서는 다시 내보내 **서버 쪽 호출부의 import 경로는
// 그대로 유지**한다(화면은 shape 쪽에서 직접 가져간다).
import { JOB_STAGES } from './video-console-shape'
import type {
  EvalRow,
  EvalSummary,
  EvidenceDrift,
  JobQueue,
  JobRow,
  JobStage,
  PlanBoard,
  PlanRow,
  VideoConsole,
  VideoIssue,
  VideoRow,
  VideoViews,
} from './video-console-shape'

export { JOB_STAGES, JOB_STAGE_KO } from './video-console-shape'
export type {
  EvalAxis,
  EvalRow,
  EvalSummary,
  EvidenceDrift,
  JobQueue,
  PlanBoard,
  PlanRow,
  JobRow,
  JobStage,
  VideoConsole,
  VideoIssue,
  VideoRow,
  VideoViews,
} from './video-console-shape'

type AdminClient = SupabaseClient

const BUCKET = 'video'
const FORMATS: VideoFormat[] = ['wide', 'vertical', 'square']

export interface ManifestEntry {
  evidence?: { label: string; value: string; source: string }[]
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

/* ────────────────────────── 수치 낡음 ────────────────────────── */
//
// **영상은 찍은 날의 스냅샷이다.** DB 는 계속 자라므로 화면에 박힌 수는 반드시 묵는다.
// 그래서 "틀렸다" 고 하지 않고 **얼마나 달라졌는지**를 보여 준다 — 다시 찍을지는 사람이 정한다.
//
// ⚠️ **임계값을 지어내지 않는다.** "20% 넘으면 경고" 같은 수를 근거 없이 정하면 그건
//   목표가 아니라 짐작이다(이 저장소가 반복해서 경계하는 것). 대신 실제 차이를 크기순으로 낸다.


/** 숫자 문자열(쉼표 포함)만 수로 바꾼다. `3/7` 같은 비율 표기는 대상이 아니다. */
function asNumber(v: string): number | null {
  if (!/^[0-9][0-9,]*$/.test(v.trim())) return null
  const n = Number(v.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/**
 * 발행된 근거와 **지금 DB** 를 맞대 본다.
 *
 * 다시 세는 것은 영상이 실제로 인용한 것들이다 — 플랫폼 4종과 유형별 재고.
 * 못 재는 근거(논문·계산식 등)는 그냥 건너뛴다. 억지로 0 으로 만들지 않는다.
 */
export async function evidenceDrift(db: AdminClient): Promise<EvidenceDrift[]> {
  const now = new Map<string, number>()

  const count = async (table: string, eq?: [string, string]): Promise<void> => {
    let q = db.from(table).select('*', { count: 'exact', head: true })
    if (eq) q = q.eq(eq[0], eq[1])
    const { count: n, error } = await q
    if (!error && typeof n === 'number') now.set(table, n)
  }
  await Promise.all([
    count('shared_dictionary'),
    count('csat_dcp_items'),
    count('library_chapter_quiz'),
    count('library_books', ['status', 'published']),
  ])

  // 유형별 재고 — 영상 28편이 각자 자기 유형의 수를 인용한다.
  const { data: inv } = await db.rpc('textbook_shelf_inventory')
  const typeStock = new Map<string, number>()
  if (Array.isArray(inv)) {
    for (const r of inv as { item_type: string; item_count: number }[]) {
      typeStock.set(r.item_type, (typeStock.get(r.item_type) ?? 0) + r.item_count)
    }
  }

  /** 근거 라벨·출처에서 "지금 값" 을 찾는다. 못 찾으면 null — 건너뛴다. */
  const lookup = (videoId: string, source: string): number | null => {
    if (source.includes('shared_dictionary')) return now.get('shared_dictionary') ?? null
    if (source.includes('csat_dcp_items')) return now.get('csat_dcp_items') ?? null
    if (source.includes('library_chapter_quiz')) return now.get('library_chapter_quiz') ?? null
    if (source.includes('library_books')) return now.get('library_books') ?? null
    if (source.includes('textbook_shelf_inventory') && videoId.startsWith('type-')) {
      // `type-long-reference` → `long_reference`
      const code = videoId.slice('type-'.length).replace(/-/g, '_')
      return typeStock.get(code) ?? null
    }
    return null
  }

  const out: EvidenceDrift[] = []
  for (const v of manifest.videos) {
    for (const e of v.evidence ?? []) {
      const published = asNumber(e.value)
      if (published === null || published === 0) continue
      const current = lookup(v.id, e.source)
      if (current === null || current === published) continue
      out.push({
        id: v.id,
        title: v.title,
        label: e.label,
        published,
        now: current,
        ratio: (current - published) / published,
      })
    }
  }
  // 많이 달라진 것부터 — 임계값을 두지 않고 크기순으로 낸다.
  return out.sort((a, b) => Math.abs(b.ratio) - Math.abs(a.ratio))
}

/* ────────────────────────── 큐 (video_jobs) ────────────────────────── */
//
// **파일이 아니라 기록이 말하는 진행.**
//
// 위쪽(`compareVideoState`)은 manifest 와 파일을 비교해 **추론**한다 — 그건 "지금 어떤 상태인가"
// 는 답해도 **"어떻게 여기 왔는가"** 는 못 답한다. 실패가 있었는지, 언제 찍었는지, 지금 밀린
// 것이 큐에 올라 있는지는 기록이 있어야 안다.
//
// 마이그레이션 전이면 **패널이 통째로 안 뜬다**(null). 빈 표를 그리면 "큐가 비었다" 로 읽히는데
// 그건 거짓이다 — 큐가 없는 것과 큐가 빈 것은 다르다.

/**
 * 큐를 읽는다. **표가 없으면 `null`** — 그 경우 화면은 패널을 안 그린다.
 *
 * 0 과 없음을 가르는 것이 이 함수의 요점이다. 빈 배열을 돌려주면 화면이 "큐가 비었다" 로
 * 그리는데, 마이그레이션 전에는 그게 사실이 아니다.
 */
export async function loadJobQueue(db: AdminClient): Promise<JobQueue | null> {
  const { data, error } = await db
    .from('video_jobs')
    .select(
      'video_id, kind, stage, stage_before_fail, error, note, seconds, formats_rendered, updated_at, published_at',
    )
    .order('updated_at', { ascending: false })
    .limit(500)

  // 42P01 = 표 없음 → 마이그레이션 전. 그 외 오류도 같게 다룬다(빈 표를 그리지 않는다).
  if (error || !data) return null

  const rows = data as JobRow[]
  const counts = Object.fromEntries(JOB_STAGES.map((s) => [s, 0])) as Record<JobStage, number>
  for (const r of rows) {
    if (r.stage in counts) counts[r.stage] += 1
  }

  return {
    counts,
    failed: rows.filter((r) => r.stage === 'failed'),
    inFlight: rows.filter((r) => r.stage !== 'published' && r.stage !== 'failed'),
    lastMovedAt: rows[0]?.updated_at ?? null,
    total: rows.length,
  }
}

/* ── 평가 — 파이프라인 3단계 중 마지막 ──────────────────────────── */

/**
 * **찍은 것이 규격 안인가.** 판정은 로컬에서 `pnpm video evaluate` 가 하고,
 * 그 결과가 `video_jobs` 에 남는다. 여기서는 **읽기만** 한다.
 *
 * ⚠️ 「안 잰 편」과 「재서 통과한 편」을 **가른다.** 뭉치면 아직 평가를 안 돌린 상태가
 *   "다 통과" 로 보이고, 그건 이 저장소가 반복해서 겪은 거짓 안심의 모양이다.
 *
 * 못 읽으면 `null` — 마이그레이션 전이면 화면이 이 칸을 통째로 안 그린다.
 */
export async function loadEvaluation(db: AdminClient): Promise<EvalSummary | null> {
  const { data, error } = await db
    .from('video_jobs')
    .select('video_id, kind, eval_at, eval_pass, eval_fail, eval_unknown, eval_axes')
    .order('eval_fail', { ascending: false, nullsFirst: false })
    .limit(500)

  // 42703 = 열 없음 · 42P01 = 표 없음 → 마이그레이션 전. 빈 표를 그리지 않는다.
  if (error || !data) return null

  const rows = data as EvalRow[]
  const done = rows.filter((r) => r.eval_at !== null)
  const lastAt = done.reduce<string | null>(
    (a, r) => (r.eval_at && (!a || r.eval_at > a) ? r.eval_at : a),
    null,
  )
  return {
    total: rows.length,
    evaluated: done.length,
    clean: done.filter((r) => (r.eval_fail ?? 0) === 0 && (r.eval_unknown ?? 0) === 0).length,
    failing: done.filter((r) => (r.eval_fail ?? 0) > 0).length,
    incomplete: done.filter((r) => (r.eval_fail ?? 0) === 0 && (r.eval_unknown ?? 0) > 0).length,
    lastAt,
    // 고칠 것만 나른다 — 통과한 73편을 화면에 늘어놓아도 결정이 안 바뀐다.
    rows: done.filter((r) => (r.eval_fail ?? 0) > 0),
  }
}

/* ── 기획 — 파이프라인 3단계 중 첫째 ────────────────────────────── */

/**
 * **다음에 무엇을 찍을 것인가.**
 *
 * 「안 만든 편」과 다르다. 공장은 번들에 있는 것을 전부 설계도로 만들므로 정상 상태에서
 * 「안 만든 편」은 늘 0 이고, 화면은 "다 했다" 고 말한다. 그런데 **설계도 규칙이 아예 없는
 * 후보**가 남아 있다 — 교재 **권별**이 그랬다. 없는 것이 목록에 안 보이면 영원히 안 만들어진다.
 *
 * ⚠️ 공장의 `catalog/plan.ts` 와 **같은 판단을 두 곳에서 한다.** 공장은 그날 뽑은 번들을 보고,
 *   여기는 커밋된 원천 + **DB 실측**을 본다(번들은 커밋하지 않으므로 운영에는 없다).
 *   `lib/video/components.ts` 가 같은 이유로 이미 그렇게 하고 있다.
 *
 * 재고를 못 읽으면 `null` 로 나른다 — **0 으로 뭉개면 멀쩡한 권이 「빈 서가」로 막힌다.**
 */
export async function loadPlan(db: AdminClient): Promise<PlanBoard> {
  const covered = platformComponents()
  const coveredIds = new Set(covered.map((c) => c.id))

  // 권별 재고 — 카탈로그 화면과 **같은 RPC**를 쓴다. 다른 수를 말하면 둘 중 하나가 거짓이다.
  const { data: invRows } = await db.rpc('textbook_shelf_inventory')
  type InvRow = { item_type: string; v_level: number; item_count: number }
  const inventory = (invRows as InvRow[] | null) ?? null
  const stockOf = (types: readonly string[], vLevels: readonly number[]): number | null => {
    if (!inventory) return null
    return inventory
      .filter((r) => types.includes(r.item_type) && vLevels.includes(r.v_level))
      .reduce((sum, r) => sum + r.item_count, 0)
  }

  const next: PlanRow[] = []
  const blocked: PlanRow[] = []
  for (const series of SERIES_CATALOG) {
    for (const rung of SERIES_SPINE) {
      const id = volumeVideoId(series.id, rung.step)
      if (coveredIds.has(id)) continue
      const backing = stockOf(rung.types, rung.vLevels)
      const row: PlanRow = {
        id,
        kind: 'volume',
        name: `${series.brand} ${rung.volumeTitle}`,
        state: backing === 0 ? 'blocked' : 'candidate',
        backing,
        backingLabel: '이 권의 문항',
        blockedWhy:
          backing === 0
            ? '이 권에 문항이 0개다 — 지금 찍으면 빈 서가를 광고하게 된다'
            : null,
      }
      ;(backing === 0 ? blocked : next).push(row)
    }
  }

  // 재고 큰 순. **못 센 것(null)은 맨 뒤** — 0 과 같은 자리에 두면 「없다」로 읽힌다.
  next.sort((a, b) => {
    if (a.backing === null && b.backing === null) return a.name.localeCompare(b.name)
    if (a.backing === null) return 1
    if (b.backing === null) return -1
    return b.backing - a.backing
  })

  const addressable = covered.length + next.length + blocked.length
  const denom = covered.length + next.length
  return {
    addressable,
    covered: covered.length,
    next,
    blocked,
    // 막힌 자리는 분모에서 뺀다 — 만들 수 없는 것 때문에 영영 100%가 안 되면 그 수로 결정을 못 한다.
    coverage: denom === 0 ? null : covered.length / denom,
  }
}
