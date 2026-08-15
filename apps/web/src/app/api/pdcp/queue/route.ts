// apps/web/src/app/api/pdcp/queue/route.ts
//
// 큐 현황 — 드레인 루프가 한 단계 끝낼 때마다 새로 읽는다(라이브 모니터링).

import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { listPdComicsAdmin } from '@/lib/pd-comic/queries'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 현대화 트랙 상태를 workDir 산출물로 판정 (선형 단계 아님 — 2개 선택 트랙).
const hasJpg = (dir: string) => { try { return fs.existsSync(dir) && fs.readdirSync(dir).some((f) => /\.jpe?g$/i.test(f)) } catch { return false } }
function modernStatus(qc: unknown): { preserve: boolean; reader: boolean; restyle: boolean } {
  const wd = (qc as { workDir?: string } | null)?.workDir
  if (!wd || typeof wd !== 'string' || !fs.existsSync(wd)) return { preserve: false, reader: false, restyle: false }
  return {
    preserve: hasJpg(path.join(wd, 'page-modern')),
    reader: fs.existsSync(path.join(wd, 'page-html', 'reader.html')),
    restyle: hasJpg(path.join(wd, 'modern')),
  }
}

export async function GET(): Promise<NextResponse> {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const client = createAdminClient() as unknown as SupabaseClient
  const { ready, data } = await listPdComicsAdmin(client)
  // dev 전용: 각 이슈 workDir 산출물로 현대화 트랙 배지 계산(이슈 수 적어 stat 저렴)
  const rows = process.env.NODE_ENV === 'production'
    ? data
    : data.map((r) => ({ ...r, modern: modernStatus(r.qc) }))
  return NextResponse.json({ ready, rows })
}
