// apps/web/src/app/api/csat/diagnosis/map/tasks/[id]/route.ts
//
// POST   /api/csat/diagnosis/map/tasks/<과제 id> — 과제 완료 체크(멱등)
// DELETE /api/csat/diagnosis/map/tasks/<과제 id> — 체크 해제(멱등)

import { NextResponse } from 'next/server'

import { failure, learnerContext } from '@/lib/csat/diagnosis/route-helpers'
import { checkTask, MapInputError, uncheckTask } from '@/lib/csat/map/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: { id: string } }

async function run(fn: typeof checkTask, params: Ctx['params']) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  try {
    await fn(ctx.db, ctx.userId, params.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof MapInputError) return NextResponse.json({ error: e.message }, { status: 400 })
    return failure(e)
  }
}

export async function POST(_req: Request, { params }: Ctx) {
  return run(checkTask, params)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return run(uncheckTask, params)
}
