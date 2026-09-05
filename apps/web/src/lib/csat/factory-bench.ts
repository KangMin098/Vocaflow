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
