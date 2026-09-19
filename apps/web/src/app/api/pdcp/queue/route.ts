// apps/web/src/app/api/pdcp/queue/route.ts
//
// 큐 현황 — 드레인 루프가 한 단계 끝낼 때마다 새로 읽는다(라이브 모니터링).
//
// ★ 두 가지를 분리해 돌려준다:
//   `counts` = **서버 전량 집계**(상태별·멈춤·총계). 화면이 좁힌 목록으로 다시 세지 않는다.
//   `rows`   = range 로 이어 받은 목록. 상한에 걸리면 `truncated` 로 말한다.
//
// ★ 파일시스템 조회 비용:
//   예전엔 **행마다** existsSync×2 + readdirSync×2 를 돌았다 — 969행이면 GET 한 번에
//   ~3,900회 동기 호출이고, 그중 955행(대기·취득 단계)은 애초에 현대화 산출물이 있을 수
//   없는 행이었다. 지금은 ① 대사 추출(ocr) 이후 행만 보고 ② 결과를 workDir 별로 캐시한다.
//   LIVE 폴링(5초)이 같은 디렉터리를 반복해서 긁던 것이 캐시 TTL 안에서 한 번으로 접힌다.

import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { stageIndex } from '@/lib/pd-comic/model'
import { countPdComicsAdmin, listPdComicsAdmin } from '@/lib/pd-comic/queries'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export interface ModernStatus {
  preserve: boolean
  reader: boolean
  restyle: boolean
}

/** 현대화 산출물이 있을 수 있는 최소 단계 — 그 전 행은 디스크를 볼 이유가 없다. */
const MODERN_FROM = stageIndex('ocr')

/**
 * workDir → 판정 캐시. 폴링이 4~5초마다 같은 디렉터리를 다시 긁는 것을 막는다.
 * TTL 을 짧게 두는 이유: 현대화는 콘솔에서 돌리고 **끝나자마자 배지를 보고 싶다**.
 * 15초면 CLI 한 스텝보다 짧아 "돌렸는데 반영이 안 된다" 로 느껴지지 않는다.
 */
const MODERN_TTL_MS = 15_000
const modernCache = new Map<string, { at: number; value: ModernStatus }>()

const NONE: ModernStatus = { preserve: false, reader: false, restyle: false }

const hasJpg = (dir: string) => {
  try {
    return fs.existsSync(dir) && fs.readdirSync(dir).some((f) => /\.jpe?g$/i.test(f))
  } catch {
    return false
  }
}

function modernStatus(qc: unknown): ModernStatus {
  const wd = (qc as { workDir?: string } | null)?.workDir
  if (!wd || typeof wd !== 'string') return NONE

  const hit = modernCache.get(wd)
  if (hit && Date.now() - hit.at < MODERN_TTL_MS) return hit.value

  const value: ModernStatus = fs.existsSync(wd)
    ? {
        preserve: hasJpg(path.join(wd, 'page-modern')),
        reader: fs.existsSync(path.join(wd, 'page-html', 'reader.html')),
        restyle: hasJpg(path.join(wd, 'modern')),
      }
    : NONE
  modernCache.set(wd, { at: Date.now(), value })
  // 캐시가 무한히 자라지 않게 — 오래된 항목부터 버린다(Map 은 삽입 순서를 지킨다).
  if (modernCache.size > 2000) {
    for (const k of [...modernCache.keys()].slice(0, 500)) modernCache.delete(k)
  }
  return value
}

export async function GET(): Promise<NextResponse> {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const client = createAdminClient() as unknown as SupabaseClient
  const [list, counts] = await Promise.all([
    listPdComicsAdmin(client),
    countPdComicsAdmin(client),
  ])

  // dev 전용: 현대화 트랙 배지. 대사 추출 이후 행만 디스크를 본다.
  const rows =
    process.env.NODE_ENV === 'production'
      ? list.data.rows
      : list.data.rows.map((r) =>
          stageIndex(r.status) >= MODERN_FROM ? { ...r, modern: modernStatus(r.qc) } : r,
        )

  return NextResponse.json({
    ready: list.ready && counts.ready,
    rows,
    total: list.data.total,
    truncated: list.data.truncated,
    counts: counts.data,
  })
}
