// apps/web/scripts/csat-lecture/env.mts
//
// 강의 드레인 스크립트 공통 — `.env.local` 을 읽고 경로를 정한다.
// `apps/web` 에서 실행한다(`npx tsx scripts/csat-lecture/<이름>.mts`).

import fs from 'node:fs'
import path from 'node:path'

for (const f of ['.env.local', '../../.env.local']) {
  try {
    for (const line of fs.readFileSync(path.resolve(f), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* 없으면 다음 후보 */
  }
}

/** 드레인 작업 폴더 — **커밋하지 않는다**(청크에 기출 원문이 실린다 · .gitignore) */
export const WORK = path.resolve('../../scripts/csat/lecture-drain')
/** 커밋되는 산출물 */
export const DATA = path.resolve('src/lib/csat/lecture-data')
/** 게이트 리포트 */
export const REPORTS = path.resolve('../../docs/csat-lecture')

export function arg(name: string, fallback: string | null = null): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback
}
export const flag = (name: string) => process.argv.includes(`--${name}`)

export async function serviceDb() {
  const { createClient } = await import('@supabase/supabase-js')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없다')
  return createClient(url, key, { auth: { persistSession: false } })
}

export function readJson<T>(p: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as T
  } catch {
    return fallback
  }
}

export function writeJson(p: string, v: unknown) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n')
}
