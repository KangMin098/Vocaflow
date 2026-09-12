// apps/web/src/app/api/pdcp/artifact/route.ts
//
// 중간 결과 이미지 서빙 — 이슈의 work 디렉터리 안의 산출 이미지(원본/복원/컷)를 그대로 반환.
// 발행 전 이슈의 이미지는 공개 버킷이 아니라 로컬 work 파일이므로, 모니터 미리보기용 dev 서브.
// dev 전용 · admin · rel 경로 traversal 차단(work 루트 밖 접근 불가).

import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' }

export async function GET(request: Request): Promise<Response> {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'dev 전용' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const issueId = searchParams.get('issueId')
  const rel = searchParams.get('rel') || ''
  if (!issueId || !rel) return NextResponse.json({ error: 'issueId 와 rel 이 필요합니다' }, { status: 400 })

  const client = createAdminClient() as unknown as SupabaseClient
  const { data: row } = await client.from('pd_comic_issues').select('qc').eq('id', issueId).maybeSingle()
  const qc = (row?.qc ?? null) as { workDir?: string } | null
  const workDir = typeof qc?.workDir === 'string' ? qc.workDir : null
  if (!workDir) return NextResponse.json({ error: 'work 디렉터리 없음' }, { status: 404 })

  // traversal 차단 — 해석된 절대경로가 반드시 workDir 하위여야 한다.
  const abs = path.resolve(workDir, rel)
  const base = path.resolve(workDir)
  if (abs !== base && !abs.startsWith(base + path.sep)) return NextResponse.json({ error: '경로 위반' }, { status: 400 })
  const ext = path.extname(abs).toLowerCase()
  if (!MIME[ext] || !fs.existsSync(abs)) return NextResponse.json({ error: '없음' }, { status: 404 })

  const buf = fs.readFileSync(abs)
  return new Response(new Uint8Array(buf), { headers: { 'Content-Type': MIME[ext], 'Cache-Control': 'no-store' } })
}
