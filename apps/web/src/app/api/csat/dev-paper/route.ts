// apps/web/src/app/api/csat/dev-paper/route.ts
//
// GET /api/csat/dev-paper?exam=2026  → 이 PC 의 로컬 기출 문제지 PDF 바이트 (**개발 서버 전용**)
//
// 개발 기간에 `/csat/item/*` 왼쪽 열을 매번 손으로 놓지 않게 한다(2026-09-25 사용자 지시).
// 프로덕션에서는 무조건 404 — 학습자는 본인이 받은 PDF 를 놓는다(DECISIONS D15).
// 바이트는 브라우저로만 간다. 브라우저는 학습자가 놓은 파일과 **똑같이** 기기 안에서 뽑는다.

import fs from 'node:fs'

import { NextResponse } from 'next/server'

import { devPaperEnabled, localPaperPath } from '@/lib/csat/reflow/dev-paper'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!devPaperEnabled()) return NextResponse.json({ ok: false }, { status: 404 })
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })

  const exam = new URL(req.url).searchParams.get('exam') ?? ''
  const file = localPaperPath(exam)
  if (!file) return NextResponse.json({ ok: false, error: 'no-local-paper' }, { status: 404 })
  return new NextResponse(new Uint8Array(fs.readFileSync(file)), {
    headers: { 'content-type': 'application/pdf', 'cache-control': 'no-store' },
  })
}
