// apps/web/src/app/api/fit/route.ts
//
// @auth public — 공개 진단 화면 /fit 의 백엔드. service_role 을 쓰지 않고 anon 키로
//   공개 테이블만 읽는다(RLS 그대로).
//
// 공개 지문 진단 API — `/fit` 화면이 쓰는 유일한 분석 경로.
//
// 왜 서버로 옮겼나 (2026-08-17):
//   원래는 브라우저가 Supabase 를 직접 쳤다. 지문 하나에 후보 수천 개를 300개씩 쪼개
//   **왕복 30회 이상**이 나갔고, 그 경로에 우리 서버가 없어서 **레이트리밋을 붙일 자리조차
//   없었다** — 방어를 안 한 게 아니라 놓을 곳이 없었다.
//   서버로 옮기면서 레벨 맵 전체(20,776 · 202 KB)를 프로세스에 담았다.
//   → 지문 분석당 DB 왕복이 **30+ → 0~1회**(잔여 실재어 확인만)로 줄고, 그제서야
//     한도·상한을 강제할 자리가 생긴다.
//
// 권한: service_role 을 쓰지 않는다. anon 키로 공개 테이블만 읽는다(RLS 그대로).
// 저장: 지문도, 결과도, 요청자도 저장하지 않는다. 쓰기 경로가 없다.

import { NextResponse } from 'next/server'

import { analyzeCounts } from '@/lib/textfit/analyze'
import { buildLevelProfile } from '@/lib/textfit/profile'
import {
  FIT_RATE_LIMIT,
  TokenBucketLimiter,
  clientKeyFromHeaders,
} from '@/lib/textfit/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 서버가 강제하는 상한 — 클라이언트 상한은 방어가 아니라 UX 다. */
const MAX_UNIQUE_WORDS = 4_000
const MAX_TOTAL_TOKENS = 200_000

const limiter = new TokenBucketLimiter(FIT_RATE_LIMIT)

interface Body {
  counts?: unknown
  totalTokens?: unknown
}

/** 신뢰할 수 없는 입력에서 counts 를 안전하게 뽑는다. */
function readCounts(raw: unknown): Record<string, number> | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null

  const out: Record<string, number> = {}
  let n = 0
  for (const [word, count] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= MAX_UNIQUE_WORDS) break
    if (typeof word !== 'string' || word.length === 0 || word.length > 64) continue
    if (typeof count !== 'number' || !Number.isFinite(count) || count < 1) continue
    out[word.toLowerCase()] = Math.min(Math.floor(count), 1_000_000)
    n += 1
  }
  return out
}

export async function POST(request: Request): Promise<NextResponse> {
  const limit = limiter.take(clientKeyFromHeaders(request.headers), Date.now())
  if (!limit.allowed) {
    return NextResponse.json(
      { error: '요청이 너무 잦아요. 잠시 뒤 다시 시도해 주세요.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식이에요.' }, { status: 400 })
  }

  const counts = readCounts(body.counts)
  if (counts === null) {
    return NextResponse.json({ error: 'counts 가 필요해요.' }, { status: 400 })
  }

  const totalTokens =
    typeof body.totalTokens === 'number' && Number.isFinite(body.totalTokens)
      ? Math.min(Math.max(0, Math.floor(body.totalTokens)), MAX_TOTAL_TOKENS)
      : 0

  if (Object.keys(counts).length === 0) {
    return NextResponse.json(buildLevelProfile([], totalTokens))
  }

  try {
    // 분석 코어는 랜딩 히어로와 공유한다(`lib/textfit/analyze.ts`).
    // 여기 남는 것은 **외부 입력의 책임**뿐이다 — 한도·검증·응답 형태.
    const { profile } = await analyzeCounts(counts, totalTokens)

    return NextResponse.json(profile, {
      headers: {
        // 같은 지문을 다시 보내면 CDN/브라우저가 받아 준다. 개인 데이터가 없어 공개 캐시 가능.
        'Cache-Control': 'public, max-age=60',
      },
    })
  } catch (err) {
    // 내부 사정(맵 적재 실패 등)을 응답으로 흘리지 않는다. 다만 **서버 로그에는 남긴다** —
    // 삼키면 "화면은 뜨는데 분석만 영원히 안 되는" 상태의 원인을 찾을 방법이 없어진다.
    console.error('[api/fit] 분석 실패:', err)
    return NextResponse.json({ error: '지금은 분석이 어려워요.' }, { status: 503 })
  }
}
