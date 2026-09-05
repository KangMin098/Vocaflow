// apps/web/src/app/api/srs/flush/route.ts
//
// **화면을 떠나는 순간에도 평가를 보낼 수 있는 경로.**
//
// ── 왜 server action 으로 부족한가 ──────────────────────────────────────
// `flushPendingSrsResults` 는 server action 이고, server action 호출은 React 의 라우팅
// 수명에 묶여 있다. 탭을 닫거나 화면을 떠나는 순간(`pagehide`)에는 그 호출이 완주한다는
// 보장이 없다 — 브라우저가 문서를 버리면서 진행 중이던 요청도 함께 버린다.
//
// 언로드 중에도 살아남는 전송 수단은 `navigator.sendBeacon` 과 `fetch(keepalive: true)`
// 둘뿐이고, 둘 다 **평범한 HTTP 엔드포인트**를 필요로 한다. 그래서 같은 로직에 문을 하나 낸다.
//
// 로직을 복제하지 않는다 — server action 본체를 그대로 부른다. 인증도 그 안에서
// 쿠키로 확인하므로 여기서 다시 하지 않는다(두 곳에서 하면 반드시 갈라진다).
//
// ⚠️ 이 경로로 오는 요청은 **응답을 아무도 안 본다**(beacon 은 응답을 버린다).
//    그래서 이중 적용을 응답으로 막을 수 없고, 멱등성은 `flush-actions.ts` 가 책임진다.

import { NextResponse } from 'next/server'
import { flushPendingSrsResults } from '@/lib/srs/flush-actions'
import type { FlushItem } from '@/lib/srs/flush-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 한 번에 받는 상한. 정상 세션은 수십 건이다 — 넘으면 조작이거나 버그다. */
const MAX_ITEMS = 500

function sane(v: unknown): v is FlushItem {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.word === 'string' &&
    o.word.length > 0 &&
    typeof o.rating === 'number' &&
    typeof o.reviewedAt === 'string' &&
    Number.isFinite(Date.parse(o.reviewedAt)) &&
    typeof o.module === 'string'
  )
}

export async function POST(req: Request) {
  let items: FlushItem[] = []
  try {
    const body = (await req.json()) as { items?: unknown }
    if (Array.isArray(body?.items)) items = body.items.filter(sane).slice(0, MAX_ITEMS)
  } catch {
    return NextResponse.json({ ok: false, error: '본문을 읽을 수 없습니다.' }, { status: 400 })
  }

  if (items.length === 0) {
    return NextResponse.json({ ok: true, persisted: 0, skipped: 0, duplicated: 0 })
  }

  const result = await flushPendingSrsResults(items)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
