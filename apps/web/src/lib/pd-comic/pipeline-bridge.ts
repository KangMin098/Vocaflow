// apps/web/src/lib/pd-comic/pipeline-bridge.ts
//
// 앱 ↔ 파이프라인 브리지.
//
// 설계 원칙: **앱은 파이프라인 지식을 복제하지 않는다.**
//   어댑터 능력표·복원 파라미터·단계 순서를 앱에 베껴두면 즉시 drift 한다
//   (아케이드 카탈로그가 4곳에 복제돼 전부 낡았던 실패를 반복하지 않는다).
//   그래서 어댑터는 `scripts/comic/pd/sources` 를 **동적 import** 로 그대로 읽고,
//   무거운 이미지 작업(ffmpeg·tesseract)은 CLI 를 spawn 해서 맡긴다.
//
// 왜 API 안에서 직접 처리하지 않는가:
//   복원·컷분할은 ffmpeg 바이너리, 대사추출은 tesseract WASM 이 필요하고
//   한 호(52p)는 수 분~수십 분이 걸린다. serverless 응답 시간 안에 넣을 수 없다.
//   CCP 가 `generate-comic.mjs` 를 CLI 드레인으로 돌리는 것과 같은 구조다.

import 'server-only'

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/** 저장소 루트 — apps/web 에서 두 단계 위. */
export const REPO_ROOT = path.resolve(process.cwd(), '..', '..')
export const PD_DIR = path.join(REPO_ROOT, 'scripts', 'comic', 'pd')

/**
 * 외부 바이너리 위치 — 환경변수 우선, 없으면 저장소의 `tools/` 를 본다.
 *
 * 왜 저장소 폴백이 필요한가: ffmpeg 은 Windows 에 기본 설치가 없고, PATH 에 없으면
 * 복원 단계가 통째로 실패한다(실측: 드레인 1단계 통과 후 2단계에서 즉시 failed).
 * `tools/` 는 .gitignore 대상이라 커밋되지 않지만, 있으면 설정 없이 바로 동작한다.
 */
function resolveTools(): { FFMPEG_BIN?: string } {
  const out: { FFMPEG_BIN?: string } = {}
  if (!process.env.FFMPEG_BIN) {
    const local = path.join(REPO_ROOT, 'tools', 'ffmpeg', 'ffmpeg.exe')
    if (fs.existsSync(local)) out.FFMPEG_BIN = local
  }
  return out
}

export interface AdapterCaps {
  discovery: string
  auth: string
  unit: string
  bulk: boolean
  ocr: boolean
  ocrBoxes: boolean
  minDelayMs: number
  concurrency: number
}

export interface AdapterProfile {
  needsCrop: boolean
  needsDeskew: boolean
  saturation: number
  upscale: number
  denoise: boolean
  segmentAnalysis: number
  segmentDilate: number
  ocrStrategy: string
}

export interface AdapterInfo {
  id: string
  label: string
  caps: AdapterCaps
  profile: AdapterProfile
  /** 검색 필터 — 어댑터마다 지원 범위가 다르며, 모르는 키는 무시한다. */
  search: (q: string, limit?: number, filters?: DiscoveryFilters) => Promise<SourceItem[]>
  metadata: (id: string) => Promise<SourceItem>
  pdHint: (item: SourceItem) => { basis: string | null; note: string }
}

/** 발견 단계 필터. IA 가 전부 지원하고, 나머지 어댑터는 해당 없는 키를 무시한다. */
export interface DiscoveryFilters {
  collection?: string
  yearFrom?: number
  yearTo?: number
  minPages?: number
  sort?: string
  page?: number
}

export interface SourceItem {
  sourceId: string
  identifier: string
  title: string
  seriesTitle?: string
  issueNo?: number
  publishedYear?: number
  url: string
  pageCount?: number
}

/** 어댑터 레지스트리를 파이프라인에서 그대로 읽는다(복제 금지). */
export async function loadAdapters(): Promise<AdapterInfo[]> {
  const mod = await import(
    /* webpackIgnore: true */ pathToFileURL(path.join(PD_DIR, 'sources', 'index.mjs')).href
  )
  return (mod.listAdapters() as AdapterInfo[]) ?? []
}

export async function getAdapter(id: string): Promise<AdapterInfo> {
  const list = await loadAdapters()
  const a = list.find((x) => x.id === id)
  if (!a) throw new Error(`알 수 없는 소스: ${id}`)
  return a
}

// 학습 적합도 큐레이션 점수 — curate-core.mjs(curate.mjs CLI 와 동일 로직) 동적 로드.
export interface CurateTrack { key: string; label: string; query: string; note: string }
export interface CurateCore {
  rank: (items: unknown[], top?: number) => Array<Record<string, unknown>>
  CANON: Array<[string, string]>
  CURATE_TRACKS: CurateTrack[]
}
export async function loadCurateCore(): Promise<CurateCore> {
  const mod = await import(/* webpackIgnore: true */ pathToFileURL(path.join(PD_DIR, 'curate-core.mjs')).href)
  return mod as unknown as CurateCore
}

export interface RunResult {
  ok: boolean
  code: number | null
  stdout: string
  stderr: string
  timedOut: boolean
}

/**
 * 파이프라인 CLI 실행. dev 전용 — 배포 환경에서 앱 프로세스가 ffmpeg 을 돌리게 두지 않는다.
 * timeoutMs 를 넘기면 죽이고 timedOut 을 돌려준다(무한 점유 방지).
 */
export function runPipeline(
  script: string,
  args: string[],
  { timeoutMs = 240_000 }: { timeoutMs?: number } = {},
): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(PD_DIR, script), ...args], {
      cwd: REPO_ROOT,
      env: { ...process.env, ...resolveTools() },
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, timeoutMs)

    child.stdout.on('data', (d) => {
      stdout += String(d)
      if (stdout.length > 200_000) stdout = stdout.slice(-200_000)
    })
    child.stderr.on('data', (d) => {
      stderr += String(d)
      if (stderr.length > 60_000) stderr = stderr.slice(-60_000)
    })
    child.on('error', (e) => {
      clearTimeout(timer)
      resolve({ ok: false, code: null, stdout, stderr: stderr + String(e), timedOut })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ ok: code === 0 && !timedOut, code, stdout, stderr, timedOut })
    })
  })
}

/** 파이프라인 작업 디렉터리 — 호 단위. */
export function workDir(slug: string): string {
  return path.join(REPO_ROOT, 'work', 'pdcp', slug)
}

/** 외부 도구 준비 상태 — Admin '도구' 탭이 그대로 보여준다. */
export async function doctor(): Promise<{ ok: boolean; rows: Array<{ item: string; ok: boolean; detail: string }> }> {
  const r = await runPipeline('pipeline.mjs', ['--doctor'], { timeoutMs: 60_000 })
  const rows: Array<{ item: string; ok: boolean; detail: string }> = []
  // console.table 출력을 파싱하지 않고, 종료코드 + 원문을 그대로 넘긴다.
  // (표 포맷에 의존하면 CLI 출력이 바뀔 때 조용히 깨진다)
  return { ok: r.ok, rows: rows.length ? rows : [{ item: 'pipeline --doctor', ok: r.ok, detail: r.stdout || r.stderr }] }
}
