// apps/web/src/app/api/admin/csat/dcp-admission/route.ts
import { NextRequest, NextResponse } from 'next/server'

import { admitDcpCandidates, admitDcpReuse, currentSourceReader, existingDcpRowReader, previewDcpAdmission, previewDcpReuse } from '@/lib/admin/dcp-admission'
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
  action: 'preview' | 'admit' | 'preview_reuse' | 'admit_reuse'
  packet: Obj
  output: Obj
  output_sha256: string
  review: Obj
  /** 실제 원저작 · 라이선스 문서에 대한 검수 기록 id. 없으면 F unknown → 자격 없이 보류 */
  rights: { record_id: string; basis: string } | null
  /** 재사용 동작만 — item_id → 기존 DCP id. 행 본문은 받지 않는다(서버가 현재 행을 읽는다) */
  reuse?: { item_id: string; dcp_item_id: string }[]
}
const KEYS = new Set(['action', 'packet', 'output', 'output_sha256', 'review', 'rights'])
const REUSE_ACTIONS: readonly unknown[] = ['preview_reuse', 'admit_reuse']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const isObj = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v)
const short = (v: unknown) => typeof v === 'string' && v.length >= 1 && v.length <= 200
const mappingOk = (m: unknown) => isObj(m) && Object.keys(m).sort().join() === 'dcp_item_id,item_id' && short(m.item_id) && typeof m.dcp_item_id === 'string' && UUID.test(m.dcp_item_id)
/** 닫힌 모양만 받는다 — 모르는 키(userId · actor · 현재 행 등) · 형식 위반은 거절. 내용 검증은 planAdmission 이 다시 한다 */
function parseBody(v: unknown): Body {
  if (!isObj(v)) throw new Error('shape')
  const reuseAction = REUSE_ACTIONS.includes(v.action)
  if (Object.keys(v).some((k) => !KEYS.has(k) && !(reuseAction && k === 'reuse'))) throw new Error('shape')
  const { action, packet, output, output_sha256, review, rights, reuse } = v
  if ((action !== 'preview' && action !== 'admit' && !reuseAction) || !isObj(packet) || !isObj(output) || !isObj(review)) throw new Error('shape')
  if (typeof output_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(output_sha256)) throw new Error('sha')
  if (rights != null && (!isObj(rights) || Object.keys(rights).length !== 2 || !short(rights.record_id) || !short(rights.basis))) throw new Error('rights')
  if (reuseAction && (!Array.isArray(reuse) || !reuse.length || reuse.length > 10 || !reuse.every(mappingOk))) throw new Error('reuse')
  return {
    action: action as Body['action'], packet, output, output_sha256, review,
    rights: rights == null ? null : { record_id: rights.record_id as string, basis: rights.basis as string },
    ...(reuseAction ? { reuse: (reuse as Obj[]).map((m) => ({ item_id: m.item_id as string, dcp_item_id: m.dcp_item_id as string })) } : {}),
  }
}

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
  const service = createAdminClient()
  const reader = currentSourceReader(service, new Date())
  try {
    // 04 재사용 — 기존 행은 service SELECT 로만 읽는다. 입고는 admin 세션 RPC
    if (body.action === 'preview_reuse' || body.action === 'admit_reuse') {
      const reuseInput = { ...input, reuse: body.reuse! }
      const rows = existingDcpRowReader(service)
      if (body.action === 'preview_reuse') {
        const r = await previewDcpReuse(reader, rows, reuseInput)
        return json(r, r.status === 'ok' ? 200 : 409)
      }
      if (admin.role !== 'admin') return json({ error: '후보 입고는 관리자만 실행할 수 있습니다.' }, 403)
      const r = await admitDcpReuse(await createClient(), reader, rows, reuseInput)
      return json(r, r.status === 'ok' ? 200 : r.status === 'not_installed' ? 503 : 409)
    }
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
