// apps/web/src/app/api/pdcp/reader/route.ts
//
// 모던 리더 데이터 — 구성 보존 현대화 결과(page-modern MAX 이미지 + letter.spec 말풍선 오버레이)를
// 학습자 리더가 렌더할 형태로 반환. 원작 페이지 구성 그대로 두고 이미지=색채·디자인, 내용=모던 대사.
// dev 전용 · admin (발행 전 preview). 이미지는 /api/pdcp/artifact 로 서빙.
//   GET ?issueId=<uuid>  →  { title, slug, pages: [{ index, page, imageRel, balloons }] }

import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Balloon = { type: 'balloon' | 'caption'; x: number; y: number; w: number; h: number; text: string }
type Page = { index: number; page: string; imageRel: string; balloons: Balloon[] }

export async function GET(request: Request): Promise<NextResponse> {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'dev 전용' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const issueId = searchParams.get('issueId')
  if (!issueId) return NextResponse.json({ error: 'issueId 가 필요합니다' }, { status: 400 })

  const client = createAdminClient() as unknown as SupabaseClient
  const { data: row } = await client
    .from('pd_comic_issues')
    .select('slug, title, series_title, qc')
    .eq('id', issueId)
    .maybeSingle()
  const qc = (row?.qc ?? null) as { workDir?: string } | null
  const workDir = typeof qc?.workDir === 'string' ? qc.workDir : null
  if (!workDir || !fs.existsSync(workDir)) {
    return NextResponse.json({ error: '현대화 산출물이 없습니다 (page-modern 미실행)', pages: [] }, { status: 404 })
  }

  const pmDir = path.join(workDir, 'page-modern')
  if (!fs.existsSync(pmDir)) return NextResponse.json({ error: 'page-modern 없음', pages: [] }, { status: 404 })

  // letter.spec.json — 말풍선 좌표+모던 대사(오퍼레이터 육안 지정)
  let spec: Record<string, Balloon[]> = {}
  try {
    const sf = path.join(workDir, 'letter.spec.json')
    if (fs.existsSync(sf)) spec = JSON.parse(fs.readFileSync(sf, 'utf8')) as Record<string, Balloon[]>
  } catch { /* noop */ }

  const files = fs.readdirSync(pmDir).filter((f) => /^\d+\.jpg$/i.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const pages: Page[] = files.map((f, i) => {
    const key = f.replace(/\.jpg$/i, '')
    return { index: i, page: key, imageRel: `page-modern/${f}`, balloons: Array.isArray(spec[key]) ? spec[key] : [] }
  })

  return NextResponse.json({
    title: (row?.title as string) ?? (row?.series_title as string) ?? '복원 만화',
    slug: (row?.slug as string) ?? null,
    pages,
  })
}
