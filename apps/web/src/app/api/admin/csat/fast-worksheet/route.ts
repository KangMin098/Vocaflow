// apps/web/src/app/api/admin/csat/fast-worksheet/route.ts
// 단계 3 FAST 빠른 학습지 — 미리보기 · 내보내기(파일 내용 응답). DB 쓰기 없음: 원천 현재 행만 service 클라이언트로 읽는다.
import { NextRequest, NextResponse } from 'next/server'

import { currentSourceReader } from '@/lib/admin/dcp-admission'
import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { evaluateFast, fastFiles, fastView } from '@/lib/csat/map/v62/factory-bridge/fast-worksheet'
import { LocalProductionError } from '@/lib/csat/map/v62/factory-bridge/local-production'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
const MAX_BYTES = 600000
const NO_STORE = { 'Cache-Control': 'no-store' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })
const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin
  if (req.headers.get('origin') !== req.nextUrl.origin) return json({ error: '요청 출처를 확인할 수 없습니다.' }, 403)
  if (!req.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'JSON 요청이 필요합니다.' }, 415)
  const raw = await req.text()
  if (Buffer.byteLength(raw, 'utf8') > MAX_BYTES) return json({ error: '요청 본문이 너무 큽니다.' }, 413)
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return json({ error: '묶음 JSON 을 읽지 못했습니다.' }, 400)
  }
  // 닫힌 본문 — { action, bundle } 만. 사용자 · 원천 행 · 검수 결론을 따로 받지 않는다
  if (!isObj(parsed) || Object.keys(parsed).sort().join() !== 'action,bundle' || (parsed.action !== 'preview' && parsed.action !== 'export') || !isObj(parsed.bundle))
    return json({ error: '요청은 { action: preview|export, bundle } 모양이어야 합니다.' }, 400)
  const bundle = parsed.bundle
  const packet = isObj(bundle.packet) && isObj(bundle.packet.body) && isObj(bundle.packet.body.source) ? bundle.packet.body.source : null
  if (!packet || typeof packet.id !== 'string') return json({ status: 'rejected', code: 'bundle_shape' }, 409)

  let current: unknown
  try {
    current = await currentSourceReader(createAdminClient(), new Date())(packet.id)
  } catch {
    return json({ status: 'source_unavailable', error: '원천 현재 행을 읽지 못했습니다. 같은 묶음으로 다시 시도해 주세요(쓰기는 없었습니다).' }, 503)
  }
  if (current == null) return json({ status: 'rejected', code: 'source_current_missing' }, 409)
  try {
    const state = evaluateFast(bundle, current)
    if (parsed.action === 'preview') return json({ status: 'ok', view: fastView(state), writes: 'not_performed' })
    return json({ status: 'ok', files: fastFiles(state, null), review: state.review.status, writes: 'not_performed' })
  } catch (e) {
    if (e instanceof LocalProductionError) return json({ status: 'rejected', code: e.code, detail: e.detail }, 409)
    return json({ status: 'failed', error: '묶음을 판정하지 못했습니다.' }, 500)
  }
}
