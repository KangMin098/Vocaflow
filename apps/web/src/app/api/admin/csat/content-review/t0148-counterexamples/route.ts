// apps/web/src/app/api/admin/csat/content-review/t0148-counterexamples/route.ts
//
// T-0148 2단계 반례 자료(AI 사전 점검 — 판정 아님). 채점 화면이 **1단계를 잠근 뒤에만** 부른다.
// 페이지 props 로 넘기면 1단계 중에도 RSC 페이로드에 실려 블라인드가 깨진다 — 그래서 따로 받는다.
// 정답 키·AI 채점은 여기에도 없다.

import { NextResponse } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import counterexamples from '@/lib/csat/content-review/t0148/counterexamples.json'

export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin
  return NextResponse.json(counterexamples, { headers: { 'Cache-Control': 'no-store' } })
}
