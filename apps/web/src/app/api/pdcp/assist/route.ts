// apps/web/src/app/api/pdcp/assist/route.ts
//
// 브라우저 보조 취득 세션 시작 — **자동 크롤링이 금지되거나 불가능한 소스를 사람이 운전한다.**
//
// 왜 자동 수집을 안 만드는가(실측 2026-08-09):
//   Comic Book Plus  robots.txt 가 ClaudeBot·anthropic-ai 를 전면 Disallow + 목록 엔드포인트 차단
//   Digital Comic Museum  일반 클라이언트 403 · 계정 필요
//   Library of Congress / HathiTrust  Cloudflare 챌린지 · 다운로드 403
//   운영자가 명시한 거부를 뚫는 대신, 사람이 직접 받고 **정리만 자동화**한다.
//
// 이 라우트는 브라우저 창을 띄우는 프로세스를 백그라운드로 띄우고 즉시 응답한다.
// 창이 뜨는 곳은 **서버가 도는 그 컴퓨터**이므로 dev 전용이다(원격 배포에서 의미 없음).

import { NextResponse } from 'next/server'
import { spawn } from 'node:child_process'
import path from 'node:path'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { loadAdapters, PD_DIR, REPO_ROOT } from '@/lib/pd-comic/pipeline-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 방문 가능한 사이트 목록 — 어댑터가 SSoT. */
export async function GET(): Promise<NextResponse> {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const adapters = await loadAdapters()
  const assist = adapters.find((a) => (a.caps as { assisted?: boolean }).assisted)
  return NextResponse.json({
    available: process.env.NODE_ENV !== 'production',
    sites: (assist as unknown as { sites?: unknown })?.sites ?? [],
  })
}

const SLUG_OK = /^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$/

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: '브라우저 세션은 dev 전용입니다 — 서버가 도는 컴퓨터에 창이 열립니다' },
      { status: 403 },
    )
  }
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  let body: { site?: string; url?: string; slug?: string; timeout?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const slug = String(body.slug ?? '').trim().toLowerCase()
  if (!SLUG_OK.test(slug)) {
    return NextResponse.json(
      { error: '작업명(slug)은 소문자·숫자·하이픈 2~60자여야 합니다' },
      { status: 400 },
    )
  }
  if (!body.site && !body.url) {
    return NextResponse.json({ error: 'site 또는 url 이 필요합니다' }, { status: 400 })
  }
  // 임의 URL 은 사람이 보고 있는 화면이지만, 최소한 http(s) 인지는 막아둔다
  if (body.url && !/^https?:\/\//i.test(body.url)) {
    return NextResponse.json({ error: 'url 은 http(s) 여야 합니다' }, { status: 400 })
  }

  const timeout = Math.min(3600, Math.max(60, Number(body.timeout) || 900))
  const args = [
    path.join(PD_DIR, 'assist.mjs'),
    '--slug', slug,
    '--timeout', String(timeout),
    ...(body.site ? ['--site', String(body.site)] : []),
    ...(body.url ? ['--url', String(body.url)] : []),
  ]

  // detached — 사람이 브라우저에서 작업하는 동안 응답을 붙들고 있을 수 없다.
  // 진행 상황은 파일(work/pdcp/<slug>/assist.manifest.json)로 확인한다.
  const child = spawn(process.execPath, args, {
    cwd: REPO_ROOT,
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  })
  child.unref()

  return NextResponse.json({
    started: true,
    slug,
    timeout,
    workDir: path.join(REPO_ROOT, 'work', 'pdcp', slug),
    message:
      '브라우저 창이 서버 컴퓨터에 열립니다. 로그인·다운로드를 마친 뒤 창을 닫으면 자동으로 정규화됩니다.',
  })
}
