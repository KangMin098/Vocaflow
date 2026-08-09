// apps/web/src/app/api/pdcp/progress/route.ts
//
// 이슈 하나의 라이브 진행 — "어디 콘텐츠의 몇 번째 아이템이 진행 중인지 · 진행율" + 지금까지 나온
// 중간 결과 아티팩트(원본/복원/컷 이미지) 목록. 스테이지 스크립트가 work 루트에 쓴 progress.json 을 읽고,
// work 디렉터리를 훑어 산출 이미지를 센다. dev 전용(로컬 파일 접근) · admin.

import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const KINDS = ['pages', 'restored', 'panels'] as const
const IMG = /\.(jpe?g|png)$/i

// 현대화 산출물(Claude Code 오퍼레이터 루프) — 각 단계의 프리뷰 스트립 + verdict 를 모니터에 노출.
const MODERN_KINDS: { key: string; label: string; manifest: string }[] = [
  { key: 'webtoon', label: '모던 웹툰 (flat-color)', manifest: 'webtoon.manifest.json' },
  { key: 'dialogue', label: '모던 대사 레이어', manifest: 'dialogue.manifest.json' },
  { key: 'reletter', label: '재레터링 (반려 기록)', manifest: 'reletter.manifest.json' },
]

type ModernArtifact = { key: string; label: string; preview: string | null; strip: string | null; verdict: unknown }

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
    .select('status, panels_total, qc')
    .eq('id', issueId)
    .maybeSingle()
  const qc = (row?.qc ?? null) as { workDir?: string } | null
  const workDir = typeof qc?.workDir === 'string' ? qc.workDir : null
  if (!workDir || !fs.existsSync(workDir)) {
    return NextResponse.json({ status: row?.status ?? null, workDir: null, progress: null, artifacts: {} })
  }

  // progress.json — 스테이지가 아이템마다 갱신
  let progress: unknown = null
  try {
    const p = path.join(workDir, 'progress.json')
    if (fs.existsSync(p)) progress = JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch { /* noop */ }

  // 중간 결과 아티팩트 목록(원본→복원→컷)
  const artifacts: Record<string, string[]> = {}
  for (const kind of KINDS) {
    try {
      const dir = path.join(workDir, kind)
      if (fs.existsSync(dir)) artifacts[kind] = fs.readdirSync(dir).filter((f) => IMG.test(f)).sort()
    } catch { /* noop */ }
  }
  // 현대화 산출물 — 스트립 프리뷰 + verdict(오퍼레이터 판정). 모니터가 콘텐츠별 현대화 진척을 보게.
  const modern: ModernArtifact[] = []
  for (const m of MODERN_KINDS) {
    const dir = path.join(workDir, m.key)
    if (!fs.existsSync(dir)) continue
    const previewRel = fs.existsSync(path.join(dir, 'strip_preview.jpg')) ? `${m.key}/strip_preview.jpg` : null
    const stripRel = fs.existsSync(path.join(dir, 'strip.jpg')) ? `${m.key}/strip.jpg` : null
    let verdict: unknown = null
    try {
      const mf = path.join(dir, m.manifest)
      if (fs.existsSync(mf)) verdict = (JSON.parse(fs.readFileSync(mf, 'utf8')) as { verdict?: unknown }).verdict ?? null
    } catch { /* noop */ }
    if (previewRel || stripRel || verdict) modern.push({ key: m.key, label: m.label, preview: previewRel, strip: stripRel, verdict })
  }

  return NextResponse.json({ status: row?.status ?? null, panelsTotal: row?.panels_total ?? null, workDir: true, progress, artifacts, modern })
}
