// scripts/textbook/lib/db.mjs
//
// **Supabase 접속과 재시도를 한 벌로 모은다.**
//
// ── 왜 (실측 2026-09-04~05) ─────────────────────────────────────────
// `fetch failed` 로 배치가 통째로 날아가는 결함을 이 저장소가 **여섯 번** 밟았다:
// `gate-import` · `adapt-drain-import` · `harvest-gutenberg-kid` · `gate-book-export` ·
// `prune-kid-excerpts` · 그리고 매 사이클 다시 쓰던 계측용 임시 스크립트.
// 여섯 번 모두 같은 코드를 손으로 다시 썼다 — 대기 시간과 시도 횟수가 조금씩 달랐고,
// 임시 스크립트에는 아예 없었다.
//
// 새 스크립트는 여기서 가져다 쓴다. 기존 다섯은 각자의 재시도가 이미 돌고 있어
// 건드리지 않았다 — 돌고 있는 수확을 깨는 값이 고치는 값보다 크다.
//
// 재실행 안전: 이 모듈은 상태를 갖지 않는다.

import fs from 'node:fs'
import path from 'node:path'

/** `apps/web/.env.local` 을 읽어 없는 값만 채운다 — 이미 있는 환경변수를 덮지 않는다. */
export function loadEnv(file = 'apps/web/.env.local') {
  for (const line of fs.readFileSync(path.resolve(file), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

export async function client() {
  loadEnv()
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * PostgREST 호출을 재시도한다.
 *
 * ⚠️ `r.error` 를 **던진다** — supabase-js 는 실패를 예외가 아니라 결과의 필드로 준다.
 *   그래서 `await db.from(...)` 만 쓰면 조회가 실패해도 코드가 조용히 흘러간다.
 * ⚠️ 여러 질의를 잴 때는 `Promise.all` 로 **함께** 보낸다. 순차로 돌리면 재시도 대기가
 *   줄줄이 더해져 시작도 못 한다(실측: 몫 조회 다섯을 순차로 돌렸을 때).
 */
export async function dbRetry(fn, what, attempt = 0) {
  try {
    const r = await fn()
    if (r?.error) throw new Error(r.error.message)
    return r
  } catch (e) {
    if (attempt >= 5) throw new Error(`${what} — ${String(e.message).slice(0, 100)}`)
    const wait = Math.min(30_000, 1500 * 2 ** attempt)
    console.error(`  ↻ ${what} 재시도 ${attempt + 1}/5 (${Math.round(wait / 1000)}s)`)
    await sleep(wait)
    return dbRetry(fn, what, attempt + 1)
  }
}
