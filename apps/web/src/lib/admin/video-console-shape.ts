// apps/web/src/lib/admin/video-console-shape.ts
//
// **영상 공장 콘솔의 경계 — 서버와 화면이 함께 아는 모양.**
//
// `video-console.ts` 는 `server-only` 를 들여온다(service_role 클라이언트로 스토리지를 읽으므로
// 브라우저 번들에 섞이면 안 된다). 그런데 화면부(`VideoConsoleClient.tsx`)는 `'use client'` 이면서
// 단계 목록·한글 라벨 같은 **값**이 필요하다 — 타입은 컴파일에 지워지지만 값은 안 지워지므로
// 화면이 그 파일을 그대로 들여오면 `server-only` 가 클라이언트 그래프에 딸려 들어가 빌드가 죽는다.
//
// 그래서 **경계를 넘는 것만** 여기 둔다: 상수(JOB_STAGES · JOB_STAGE_KO)와 넘겨줄 값의 모양.
// DB·스토리지를 만지는 코드는 한 줄도 여기 오지 않는다 — 오면 다시 같은 사고가 난다.

import type { VideoFormat, VideoKind } from '@/lib/video/catalog'

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

export interface EvidenceDrift {
  id: string
  title: string
  label: string
  /** 영상에 박힌 값. */
  published: number
  /** 지금 값. 못 재면 null — 그런 항목은 목록에 넣지 않는다. */
  now: number
  /** (now - published) / published. 음수면 줄어든 것. */
  ratio: number
}

/** 단계 — SQL 의 CHECK 와 같은 목록이어야 한다. */
export const JOB_STAGES = [
  'failed',
  'queued',
  'voiced',
  'rendered',
  'packaged',
  'published',
] as const
export type JobStage = (typeof JOB_STAGES)[number]

export const JOB_STAGE_KO: Record<JobStage, string> = {
  failed: '실패',
  queued: '대기',
  voiced: '음성',
  rendered: '렌더',
  packaged: '포장',
  published: '발행',
}

export interface JobRow {
  video_id: string
  kind: string
  stage: JobStage
  stage_before_fail: string | null
  error: string | null
  note: string | null
  seconds: number | null
  formats_rendered: number | null
  updated_at: string
  published_at: string | null
}

export interface JobQueue {
  /** 단계별 편수 — 순서는 `JOB_STAGES`. 0 인 단계도 자리를 지킨다(빠지면 사라진 걸로 읽힌다). */
  counts: Record<JobStage, number>
  /** 실패한 편 — 가장 먼저 봐야 하는 것. */
  failed: JobRow[]
  /** 아직 발행 안 된 편(대기·음성·렌더·포장). 무엇이 밀렸는가. */
  inFlight: JobRow[]
  /** 마지막으로 움직인 때 — "지금 돌고 있나" 의 근거. */
  lastMovedAt: string | null
  total: number
}
