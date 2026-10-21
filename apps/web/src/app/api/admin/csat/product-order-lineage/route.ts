// apps/web/src/app/api/admin/csat/product-order-lineage/route.ts
import { NextRequest, NextResponse } from 'next/server'

import {
  executeProductOrderLineage,
  readProductOrderLineage,
} from '@/lib/admin/product-order-lineage'
import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  lineageCommandSchema,
  prepareLineageRegistration,
} from '@/lib/csat/map/v62/factory-bridge/order-lineage'

export const dynamic = 'force-dynamic'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin
  const user = req.nextUrl.searchParams.get('user') ?? ''
  const workspace = req.nextUrl.searchParams.get('workspace') ?? ''
  if (!uuid.test(user) || !uuid.test(workspace))
    return NextResponse.json(
      { error: '조회할 사용자와 Workspace를 확인해 주세요.' },
      { status: 400 }
    )
  const result = await readProductOrderLineage(createAdminClient(), admin.id, user, workspace)
  return NextResponse.json(result, { status: result.status === 'error' ? 503 : 200 })
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin
  if (admin.role !== 'admin')
    return NextResponse.json(
      { error: '등록·연결·철회는 관리자만 실행할 수 있습니다.' },
      { status: 403 }
    )
  // Browser cookie mutations must originate from this application. API automation uses the same explicit Origin.
  if (req.headers.get('origin') !== req.nextUrl.origin)
    return NextResponse.json({ error: '요청 출처를 확인할 수 없습니다.' }, { status: 403 })
  if (!req.headers.get('content-type')?.startsWith('application/json'))
    return NextResponse.json({ error: 'JSON 요청이 필요합니다.' }, { status: 415 })
  const raw = await req.text()
  if (Buffer.byteLength(raw, 'utf8') > 120000)
    return NextResponse.json({ error: '주문 본문이 너무 큽니다.' }, { status: 413 })
  let command: ReturnType<typeof lineageCommandSchema.parse>
  try {
    command = lineageCommandSchema.parse(JSON.parse(raw))
    if (command.action === 'register') prepareLineageRegistration(command)
  } catch {
    return NextResponse.json({ error: '정본·해시·요구 명세를 확인해 주세요.' }, { status: 400 })
  }
  try {
    const { data, error } = await executeProductOrderLineage(createAdminClient(), admin.id, command)
    if (error)
      return NextResponse.json(
        {
          error: '계보 기록 결과를 확인해 주세요. 재전송 전 조회가 필요할 수 있습니다.',
          code: error.code,
        },
        {
          status:
            error.code === '42501'
              ? 403
              : ['P0001', '23503', '23505', '23514', '22023'].includes(error.code)
                ? 409
                : 503,
        }
      )
    if (typeof data !== 'string')
      return NextResponse.json(
        { error: '기록 결과를 확인하지 못했습니다. 재전송 전 조회해 주세요.' },
        { status: 503 }
      )
    // Recording/replaying a historical fact is not a declaration of current eligibility or delivery.
    return NextResponse.json({
      recorded_id: data,
      current: 'read_required',
      delivery: 'not_performed',
    })
  } catch {
    return NextResponse.json(
      {
        error:
          '기록 결과를 확인하지 못했습니다. 같은 요청 UUID로 재전송하기 전에 계보를 조회해 주세요.',
        current: 'read_required',
      },
      { status: 503 }
    )
  }
}
