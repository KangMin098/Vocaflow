// scripts/lib/supabase-env.mts
//
// 스크립트용 Supabase 자격 로딩 — **환경변수 우선, 파일은 대비책**.
//
// ── 왜 순서가 이래야 하는가 (2026-08-26) ─────────────────────────────
// 이 저장소 스크립트들은 관행적으로 `apps/web/.env.local` 을 **직접 읽고, 없으면 즉시 종료**한다.
// 로컬에서는 편하지만 그 한 줄이 **스케줄러에서 못 쓰게 만든다** — CI(`.github/workflows/ci.yml`)는
// 시크릿을 **환경변수로** 주지 파일을 만들지 않는다.
//
// 실제로 무인 드레인(`scripts/topic-corpus/drain-loop.mts`)을 만들자마자 이 벽에 부딪혔다:
// 사람 없이 도는 것이 목적인데 정작 **사람의 로컬 파일**을 요구하고 있었다.
//
// 그래서 환경변수를 먼저 보고, 없을 때만 파일을 읽는다. 둘 다 없으면 무엇이 없는지 말하고 죽는다.

import { existsSync, readFileSync } from 'node:fs'

export interface SupabaseEnv {
  url: string
  serviceRoleKey: string
  /** 어디서 왔는가 — 로그에 찍어 두면 "왜 다른 DB 를 봤지" 를 나중에 알 수 있다 */
  source: 'env' | 'file'
}

/** `.env` 형식 한 장을 아주 단순하게 읽는다(따옴표만 벗긴다). 없으면 빈 객체. */
function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {}
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
    if (m) out[m[1]!] = m[2]!.trim().replace(/^["']|["']$/g, '')
  }
  return out
}

/**
 * 서비스롤 자격을 찾는다. 못 찾으면 **무엇이 없는지 말하고** 종료한다 —
 * 조용히 빈 클라이언트를 돌려주면 "쓴 줄 알았는데 아무 데도 안 들어간" 상태가 된다.
 */
export function loadSupabaseEnv(filePath = 'apps/web/.env.local'): SupabaseEnv {
  const fromEnv = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  }
  if (fromEnv.url && fromEnv.serviceRoleKey) {
    return { ...fromEnv, source: 'env' }
  }

  const file = readEnvFile(filePath)
  const url = fromEnv.url || file['NEXT_PUBLIC_SUPABASE_URL'] || file['SUPABASE_URL'] || ''
  const serviceRoleKey = fromEnv.serviceRoleKey || file['SUPABASE_SERVICE_ROLE_KEY'] || ''

  if (!url || !serviceRoleKey) {
    const missing = [!url && 'NEXT_PUBLIC_SUPABASE_URL', !serviceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY']
      .filter(Boolean)
      .join(' · ')
    console.error(
      `자격이 없다: ${missing}\n` +
        `  · 환경변수로 주거나 (CI·스케줄러)\n` +
        `  · ${filePath} 에 넣어라 (로컬)`,
    )
    process.exit(1)
  }
  return { url, serviceRoleKey, source: 'file' }
}
