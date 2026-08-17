// apps/web/src/lib/pd-comic/renewal-bridge.ts
//
// 갱신 위험 판정 브리지 — 정본은 `scripts/comic/pd/renewal.mjs` 다.
//
// 왜 브리지인가: 이 지식(어느 시리즈 몇 호가 갱신됐는가)은 조사 결과이고 CLI 와 앱이 **같은 것을**
// 봐야 한다. 앱에 규칙을 베껴 두면 조사가 갱신될 때 한쪽만 고쳐지고, 그 순간 화면은
// "발행해도 된다"고 말하는데 실제로는 아닌 상태가 된다. 그래서 .mjs 를 그대로 읽는다
// (pipeline-bridge 가 어댑터를 동적 import 하는 것과 같은 이유).
//
// 서버 전용 — Node 파일시스템 경로를 쓴다.

import 'server-only'

import path from 'node:path'
import { pathToFileURL } from 'node:url'

export type RenewalLevel = 'renewed' | 'likely-pd' | 'unknown'

export interface RenewalVerdict {
  level: RenewalLevel
  note: string
  /** true = 갱신된 것으로 알려진 구간 → 발행하면 안 된다 */
  blocking: boolean
}

interface RenewalModule {
  assessRenewal: (o: {
    seriesKey?: string | null
    issueNo?: number | null
    publishedYear?: number | null
    publisher?: string | null
  }) => RenewalVerdict
}

const PD_DIR = path.resolve(process.cwd(), '..', '..', 'scripts', 'comic', 'pd')

let cached: RenewalModule | null = null

async function load(): Promise<RenewalModule> {
  if (cached) return cached
  cached = (await import(
    /* webpackIgnore: true */ pathToFileURL(path.join(PD_DIR, 'renewal.mjs')).href
  )) as unknown as RenewalModule
  return cached
}

export async function assessRenewal(o: {
  seriesKey?: string | null
  issueNo?: number | null
  publishedYear?: number | null
  publisher?: string | null
}): Promise<RenewalVerdict> {
  try {
    const m = await load()
    return m.assessRenewal(o)
  } catch {
    // 모듈을 못 읽으면 **안전한 쪽**으로 — "모른다"가 기본값이지 "괜찮다"가 아니다.
    return { level: 'unknown', note: '갱신 규칙을 불러오지 못했습니다 — 확인 필요', blocking: false }
  }
}
