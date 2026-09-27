// packages/video-factory/src/jobs/client.ts
//
// **큐에 단계를 적는다** — 이게 없으면 공장이 아니라 배치 스크립트다.
//
// ── 무엇이 달라지나 ────────────────────────────────────────────────
// 지금까지는 진행 상황이 **파일의 존재**로만 표현됐다(mp4 가 있으면 찍은 것). 그래서:
//   · 렌더가 실패하면 콘솔에 한 줄 찍히고 사라진다 — 다음 사람은 실패를 모른다
//   · "언제 찍었나" 를 모른다 — 수치가 얼마나 묵었는지의 근거가 없다
//   · Admin 이 manifest 와 파일을 **비교해 추론**할 뿐, 진짜 큐를 못 본다
// 이제 각 단계가 `video_job_advance` 를 불러 그 편의 자리를 남긴다.
//
// ── 없으면 없는 대로 ───────────────────────────────────────────────
// 마이그레이션 전이거나 service_role 키가 없으면 **조용히 건너뛴다.** 큐 기록 때문에
// 렌더가 실패하면 안 된다 — 기록은 본 작업의 곁가지다. 다만 **한 번은 왜 안 쓰는지 말한다**
// (조용한 무동작이 이 저장소가 반복해 겪은 사고라서).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { VideoSpec } from '../spec/types'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../../../..')

export type JobStage = 'queued' | 'voiced' | 'rendered' | 'packaged' | 'published' | 'failed'

export interface JobMetrics {
  scenes?: number
  voice_clips?: number
  formats_rendered?: number
  seconds?: number
  bytes?: number
  thumb?: boolean
  captions?: boolean
  note?: string
}

let client: SupabaseClient | null | undefined
let warned = false
/**
 * **한 번 안 되면 그 실행 동안은 더 안 부른다.**
 *
 * 처음엔 실패해도 "조용히 건너뛴다" 고만 해 뒀는데, 그러면 62편에 62번 다시 부른다 —
 * RPC 가 없거나 망이 느리면 그 62번이 전부 타임아웃까지 기다린다(실측 2026-09-13:
 * `enqueue` 가 10분을 넘겨도 안 끝났다). 없는 것은 다음 호출에도 없다.
 */
let disabled = false

/** 큐 기록 한 번에 허용하는 시간. 넘으면 그 실행 동안 기록을 끈다. */
const JOB_TIMEOUT_MS = 8_000

/** `apps/web/.env.local` 을 process.env 로 읽는다(이미 있는 값은 덮지 않는다). */
export function loadRepoEnv(): void {
  const envPath = path.join(REPO, 'apps/web/.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2]!.replace(/^['"]|['"]$/g, '')
  }
}

/**
 * **조용히 넘어가지 않는** service_role 클라이언트 — 요청 드레인용.
 * 큐 기록(아래 db())은 곁가지라 없으면 건너뛰지만, 요청 드레인은 DB 가 본 작업이다.
 */
export function requireServiceClient(): SupabaseClient {
  loadRepoEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY 가 없다 (apps/web/.env.local)')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

/** service_role 로만 쓴다 — RLS 를 우회해야 로컬 스크립트가 쓸 수 있다. */
function db(): SupabaseClient | null {
  if (client !== undefined) return client

  loadRepoEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    client = null
    return null
  }
  client = createClient(url, key, {
    auth: { persistSession: false },
    global: {
      // **큐 기록에 타임아웃을 건다.** 이게 없으면 망이 느릴 때 기록 한 줄이 렌더를 멈춰 세운다
      //   (실측 2026-09-13: DB 가 응답하지 않는 동안 `enqueue` 가 10분을 넘겨도 안 끝났다).
      //   기록은 본 작업의 곁가지다 — 곁가지가 본 작업을 인질로 잡으면 안 된다.
      fetch: (input, init) =>
        fetch(input as RequestInfo, { ...init, signal: AbortSignal.timeout(JOB_TIMEOUT_MS) }),
    },
  })
  return client
}

function shutOff(why: string): void {
  disabled = true
  if (warned) return
  warned = true
  console.log(`  (큐 기록 안 함 — ${why}. 작업 자체는 그대로 진행된다)`)
}

/**
 * 한 편의 단계를 올린다. **실패해도 예외를 던지지 않는다** — 기록이 본 작업을 멈추면 안 된다.
 *
 * 단계는 앞으로만 간다(뒤로 가는 호출은 RPC 가 무시한다). 그래서 렌더를 두 번 돌려도
 * 이미 `published` 인 편이 `rendered` 로 되돌아가지 않는다.
 */
export async function advance(
  videoId: string,
  kind: string,
  stage: JobStage,
  metrics: JobMetrics = {},
  error?: string,
): Promise<void> {
  if (disabled) return
  const c = db()
  if (!c) return shutOff('SUPABASE_SERVICE_ROLE_KEY 가 없다')
  try {
    const { error: rpcError } = await c.rpc('video_job_advance', {
      p_video_id: videoId,
      p_kind: kind,
      p_stage: stage,
      p_metrics: metrics,
      p_error: error ?? null,
    })
    if (rpcError) {
      // 42883 = 함수 없음 · 42P01 = 테이블 없음 → 마이그레이션 전이다.
      shutOff(`video_job_advance 를 못 불렀다 (${rpcError.code ?? rpcError.message})`)
    }
  } catch (err) {
    // 타임아웃·망 오류는 예외로 온다. **던지지 않는다** — 기록 때문에 렌더가 죽으면 안 된다.
    shutOff(`큐에 못 닿았다 (${(err as Error).name})`)
  }
}

/**
 * 설계도 전부를 큐에 올린다 — **재실행 안전**(이미 있으면 단계를 되돌리지 않는다).
 *
 * 이게 "안 만든 편" 의 분모다. 플랫폼이 자라 설계도가 늘면 이 명령이 새 행을 만들고,
 * Admin 의 큐에 `queued` 로 뜬다.
 */
export async function enqueueAll(specs: VideoSpec[]): Promise<{ ok: number; skipped: number }> {
  const c = db()
  if (!c) {
    shutOff('SUPABASE_SERVICE_ROLE_KEY 가 없다')
    return { ok: 0, skipped: specs.length }
  }
  let ok = 0
  let skipped = 0
  for (const spec of specs) {
    // 한 번 막히면 나머지는 세기만 한다 — 62번 타임아웃을 기다리지 않는다.
    if (disabled) {
      skipped++
      continue
    }
    try {
      const { error } = await c.rpc('video_job_advance', {
        p_video_id: spec.id,
        p_kind: spec.kind,
        p_stage: 'queued',
        p_metrics: { scenes: spec.scenes.length },
        p_error: null,
      })
      if (error) {
        shutOff(`video_job_advance 를 못 불렀다 (${error.code ?? error.message})`)
        skipped++
      } else ok++
    } catch (err) {
      shutOff(`큐에 못 닿았다 (${(err as Error).name})`)
      skipped++
    }
  }
  return { ok, skipped }
}

/**
 * **평가 결과를 남긴다.** 단계(`stage`)는 건드리지 않는다 —
 * 평가는 제작의 단계가 아니라 그 위의 판정이고, 섞으면 "평가에서 떨어졌다" 가
 * "아직 안 찍었다" 로 읽힌다.
 *
 * 기록이 본 작업을 인질로 잡지 않는 규칙은 `advance()` 와 같다 — 예외를 던지지 않는다.
 */
export async function recordEvaluation(
  videoId: string,
  pass: number,
  fail: number,
  unknown: number,
  axes: unknown,
): Promise<boolean> {
  if (disabled) return false
  const c = db()
  if (!c) {
    shutOff('SUPABASE_SERVICE_ROLE_KEY 가 없다')
    return false
  }
  try {
    const { error } = await c.rpc('video_job_evaluate', {
      p_video_id: videoId,
      p_pass: pass,
      p_fail: fail,
      p_unknown: unknown,
      p_axes: axes,
    })
    if (error) {
      shutOff(`video_job_evaluate 를 못 불렀다 (${error.code ?? error.message})`)
      return false
    }
    return true
  } catch (err) {
    shutOff(`큐에 못 닿았다 (${(err as Error).name})`)
    return false
  }
}

/** 큐 요약 — CLI 가 한 줄로 보여 준다. 못 읽으면 null. */
export async function overview(): Promise<{ stage: string; n: number }[] | null> {
  if (disabled) return null
  const c = db()
  if (!c) return null
  try {
    const { data, error } = await c.rpc('video_jobs_overview')
    if (error || !Array.isArray(data)) return null
    return data as { stage: string; n: number }[]
  } catch {
    return null
  }
}
