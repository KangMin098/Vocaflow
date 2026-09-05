// apps/web/src/lib/csat/factory-bench.ts
//
// **시중 벤치마크 리포트 읽기** — 「시중 교재보다 120%」의 유일한 근거.
//
// 이 수치는 DB 가 아니라 파일에 있다. `scripts/textbook/market-benchmark.mjs` 가 시중 교재
// 79종 5,214쪽을 읽어 만든 것이고, 그 계산은 몇 분 걸리므로 웹 요청 시간 안에 다시 할 수 없다.
// 그래서 화면은 **생성 시점의 사실**을 보여 주고, 그 시점을 함께 적는다 — "지금 그렇다" 가
// 아니라 "그때 그랬다" 이기 때문이다.
//
// ⚠️ 파일이 없으면 **0 이 아니라 null** 이다. 우위 지수 0 은 "완전히 진다" 는 뜻이라
//   못 읽은 것과 정반대의 오해를 만든다.

import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * 조회 하나에 **상한을 건다.** 넘기면 그 값은 「못 잼」이다.
 *
 * ⚠️ 예산을 물결 **사이**에서만 검사하면 소용이 없다 — 실측 2026-09-05 에 요청 하나가
 * 57초를 잡아먹어서, 첫 물결만으로 예산을 다 쓰고도 페이지가 57초(현황판은 두 번 걸려 114초)
 * 멈췄다. 느린 의존이 화면을 붙잡으면 관리자는 새로고침을 누르고, 그 요청이 풀을 더 조여
 * 다음 요청을 더 느리게 만든다. 그래서 **요청마다** 끊는다.
 *
 * ⚠️ 이것만으로는 **기다리기를 멈출 뿐 요청을 멈추지는 못한다.** 버려진 요청은 커넥션을 계속
 * 쥐고 있어서, 칸 225개를 세는 화면에서는 그 자체가 다음 요청을 느리게 만든다(풀 포화).
 * 요청까지 끊으려면 `withDeadline` 을 쓴다 — 이 함수는 취소 신호를 못 받는 값에만 쓴다.
 */
export function withTimeout<T>(p: PromiseLike<T>, ms: number, onTimeout: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(onTimeout), ms)
    void Promise.resolve(p).then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      () => {
        clearTimeout(timer)
        resolve(onTimeout)
      },
    )
  })
}

/**
 * 조회 하나에 상한을 걸되 **요청 자체를 끊는다.**
 *
 * `withTimeout` 은 기다리기만 멈춘다 — 버려진 요청은 커넥션을 계속 쥐고 있고, 칸 225개를 세는
 * 화면에서는 그 잔해가 다음 요청을 느리게 만든다(실측 2026-09-05: `pg_stat_activity` 가 idle
 * 백엔드로 가득 찬 채 집필 화면 39초). 그래서 취소 신호를 함께 보낸다.
 *
 * 신호를 받고도 안 끝나는 구현이 있을 수 있으므로 **시계와도 경주한다** — 둘 중 먼저 오는 쪽이
 * 이긴다. 어느 쪽이든 화면은 상한을 넘겨 기다리지 않는다.
 */
export async function withDeadline<T>(
  run: (signal: AbortSignal) => PromiseLike<T>,
  ms: number,
  onTimeout: T,
): Promise<T> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), ms)
  try {
    return await withTimeout(
      Promise.resolve(run(ac.signal)).catch(() => onTimeout),
      ms,
      onTimeout,
    )
  } finally {
    clearTimeout(timer)
    // 이미 끝났어도 신호를 보내 둔다 — 남은 재시도·스트림이 있으면 같이 끊긴다.
    ac.abort()
  }
}

/** 조회 하나에 허용하는 시간. 이보다 오래 걸리는 칸은 「?」로 남는다. */
export const QUERY_TIMEOUT_MS = 4_000

/** 저장소 뿌리 — `apps/web` 에서 두 칸 위. `lib/pd-comic/pipeline-bridge.ts` 와 같은 규약. */
export const REPO_ROOT = path.resolve(process.cwd(), '..', '..')

/** 시중 우위 목표 — 「시중 교재보다 120%」. 사용자 지시이고 문서 전체가 이 숫자를 쓴다. */
export const MARKET_TARGET_INDEX = 1.2

/**
 * 축 하나. `index` 가 null 이면 **못 잰 축**이고, 그때 `insufficient` 가 왜 못 쟀는지 말한다.
 *
 * 못 잰 축을 1.0(대등)으로 채우면 종합 지수가 올라간다 — 그것은 개선이 아니라 **분식**이다.
 * 그래서 못 잰 축은 종합에서 빠지고, 대신 `reachableMax`(잰 축만으로 낼 수 있는 최대)가
 * 목표에 닿는지를 따로 본다.
 */
export interface BenchAxis {
  id: string
  name: string
  ours: number | null
  market: number | null
  unit: string
  why: string
  index: number | null
  ceiling: number | null
  insufficient: string | null
}

export interface BenchPublisher {
  publisher: string
  /** 이 출판사 표본의 크기 — 지수를 얼마나 믿을지가 여기서 갈린다. */
  docs: number
  pages: number
  overallIndex: number | null
  /** 잰 축만으로 낼 수 있는 최대 지수. 이게 목표보다 낮으면 **막는 것은 파이프라인이 아니라 증거**다. */
  reachableMax: number | null
  targetReachable: boolean
  axesMeasured: number
  axesTotal: number
  /** 못 잰 축 묶음 — 사람이 읽을 이름. */
  gaps: string[]
  axes: BenchAxis[]
}

export interface BenchFile {
  generatedAt: string
  scope: string
  /** 가장 낮은 지수를 낸 출판사 — 합본 평균이 감추는 자리. */
  bindingPublisher: string | null
  bindingIndex: number | null
  pooledIndex: number | null
  publishers: BenchPublisher[]
}

type Raw = Record<string, unknown>

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function toAxis(r: Raw): BenchAxis {
  return {
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    ours: num(r.ours),
    market: num(r.market),
    unit: String(r.unit ?? ''),
    why: String(r.why ?? ''),
    index: num(r.index),
    ceiling: num(r.ceiling),
    insufficient: typeof r.insufficient === 'string' ? r.insufficient : null,
  }
}

function toPublisher(r: Raw): BenchPublisher {
  const profile = (r.profile ?? {}) as Raw
  return {
    publisher: String(r.publisher ?? ''),
    docs: Number(profile.docs ?? 0),
    pages: Number(profile.pages ?? 0),
    overallIndex: num(r.overallIndex),
    reachableMax: num(r.reachableMax),
    targetReachable: r.targetReachable === true,
    axesMeasured: Number(r.axesMeasured ?? 0),
    axesTotal: Number(r.axesTotal ?? 0),
    gaps: Array.isArray(r.gaps) ? r.gaps.map(String) : [],
    axes: Array.isArray(r.axes) ? r.axes.map((a) => toAxis(a as Raw)) : [],
  }
}

/** 리포트 한 벌. 파일이 없거나 깨지면 `null` — 0 으로 뭉개지 않는다. */
export async function readBench(file: string): Promise<BenchFile | null> {
  try {
    const raw = await readFile(path.join(REPO_ROOT, 'docs', 'reports', file), 'utf8')
    const j = JSON.parse(raw) as Raw
    if (num(j.bindingIndex) == null) return null
    return {
      generatedAt: String(j.generatedAt ?? ''),
      scope: String(j.scope ?? ''),
      bindingPublisher: typeof j.bindingPublisher === 'string' ? j.bindingPublisher : null,
      bindingIndex: num(j.bindingIndex),
      pooledIndex: num(j.pooledIndex),
      publishers: Array.isArray(j.publishers) ? j.publishers.map((p) => toPublisher(p as Raw)) : [],
    }
  } catch {
    return null
  }
}

/** 창고(재고 품질)와 권(출간물 품질) 두 모드. 학습자가 만나는 것은 권 쪽이다. */
export const BENCH_FILES = {
  warehouse: 'textbook-publisher-benchmark.json',
  volume: 'textbook-publisher-benchmark-volume.json',
} as const

export type BenchMode = keyof typeof BENCH_FILES
