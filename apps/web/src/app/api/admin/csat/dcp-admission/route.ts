// apps/web/src/app/api/admin/csat/dcp-admission/route.ts
import { NextRequest, NextResponse } from 'next/server'

import { admitDcpCandidates, currentSourceReader, previewDcpAdmission } from '@/lib/admin/dcp-admission'
import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { approveFactoryDcp } from '@/lib/csat/map/v62/factory-bridge/dcp-request'
import type { SupplyClient } from '@/lib/csat/map/v62/factory-bridge/dcp-supply'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
const MAX_BYTES = 400000
const NO_STORE = { 'Cache-Control': 'no-store' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })

type Obj = Record<string, unknown>
interface Body {
  action: 'preview' | 'admit'
  packet: Obj
  output: Obj
  output_sha256: string
  review: Obj
  /** 실제 원저작 · 라이선스 문서에 대한 검수 기록 id. 없으면 F unknown → 자격 없이 보류 */
  rights: { record_id: string; basis: string } | null
}
const KEYS = new Set(['action', 'packet', 'output', 'output_sha256', 'review', 'rights'])
const isObj = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v)
const short = (v: unknown) => typeof v === 'string' && v.length >= 1 && v.length <= 200
/** 닫힌 모양만 받는다 — 모르는 키(userId · actor 등) · 형식 위반은 거절. 내용 검증은 planAdmission 이 다시 한다 */
function parseBody(v: unknown): Body {
  if (!isObj(v) || Object.keys(v).some((k) => !KEYS.has(k))) throw new Error('shape')
  const { action, packet, output, output_sha256, review, rights } = v
  if ((action !== 'preview' && action !== 'admit') || !isObj(packet) || !isObj(output) || !isObj(review)) throw new Error('shape')
  if (typeof output_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(output_sha256)) throw new Error('sha')
  if (rights != null && (!isObj(rights) || Object.keys(rights).length !== 2 || !short(rights.record_id) || !short(rights.basis))) throw new Error('rights')
  return { action, packet, output, output_sha256, review, rights: rights == null ? null : { record_id: rights.record_id as string, basis: rights.basis as string } }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
/** 승인 본문 — { action, qualification_id, note } 만. 사용자 · actor · scope 는 받지 않는다(scope 는 public 고정) */
function parseApprove(v: Obj): { qualification_id: string; note: string } | null {
  const keys = Object.keys(v).sort().join()
  if (keys !== 'action,note,qualification_id') return null
  if (typeof v.qualification_id !== 'string' || !UUID.test(v.qualification_id)) return null
  if (typeof v.note !== 'string' || v.note.trim().length < 1 || v.note.length > 500) return null
  return { qualification_id: v.qualification_id, note: v.note.trim() }
}

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
    return json({ error: '패킷 · 출력 · 검수 본문을 확인해 주세요.' }, 400)
  }
  // 2F — 명시적 출시 승인. 미리보기 · 입고와 분리된 별도 동작이며 자동으로 이어지지 않는다
  if (isObj(parsed) && parsed.action === 'approve') {
    const a = parseApprove(parsed)
    if (!a) return json({ error: '자격 id 와 승인 메모를 확인해 주세요.' }, 400)
    try {
      const r = await approveFactoryDcp(createAdminClient(), (await createClient()) as unknown as SupplyClient,a.qualification_id, a.note)
      return json(r, r.status === 'ok' ? 200 : r.status === 'not_installed' ? 503 : 409)
    } catch {
      return json({ error: '자격 · 승인 상태를 확인하지 못했습니다. 다시 시도하기 전에 후보 상태를 확인해 주세요.' }, 503)
    }
  }
  let body: Body
  try {
    body = parseBody(parsed)
  } catch {
    return json({ error: '패킷 · 출력 · 검수 본문을 확인해 주세요.' }, 400)
  }
  const input = { packet: body.packet, output: body.output, outputSha256: body.output_sha256, review: body.review, rights: body.rights }
  const reader = currentSourceReader(createAdminClient(), new Date())
  try {
    if (body.action === 'preview') {
      const r = await previewDcpAdmission(reader, input)
      return json(r, r.status === 'ok' ? 200 : 409)
    }
    // 입고는 admin 만 · 관리자 로그인 세션으로 RPC 를 부른다(service_role 은 원천 읽기에만)
    if (admin.role !== 'admin') return json({ error: '후보 입고는 관리자만 실행할 수 있습니다.' }, 403)
    const r = await admitDcpCandidates(await createClient(), reader, input)
    return json(r, r.status === 'ok' ? 200 : r.status === 'not_installed' ? 503 : 409)
  } catch {
    return json({ error: '원천 또는 기록 결과를 확인하지 못했습니다. 같은 본문으로 재요청하기 전에 다시 미리보기 해 주세요.' }, 503)
  }
}
