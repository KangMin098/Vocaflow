// scripts/dict-common.mjs
//
// dict-fetch / dict-update / dict-status 공통 유틸.
//
// - .env.local 로드 (apps/web/.env.local 자동 인식)
// - service_role Supabase 클라이언트 생성
// - JWT 형식 가드

import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { exit } from 'node:process'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))

// .env.local 우선순위: 루트 → apps/web
const ENV_CANDIDATES = [
  resolve(__dirname, '../.env.local'),
  resolve(__dirname, '../apps/web/.env.local'),
]

for (const p of ENV_CANDIDATES) {
  if (existsSync(p)) dotenv.config({ path: p, override: false })
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export function requireEnv() {
  if (!URL || !KEY) {
    console.error('  ✗ env 누락 — NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    console.error(`    검색 경로: ${ENV_CANDIDATES.join(' / ')}`)
    exit(1)
  }
  if (!KEY.startsWith('eyJ')) {
    console.error("  ✗ SUPABASE_SERVICE_ROLE_KEY 형식 이상 — JWT 는 'eyJ' 로 시작해야 함")
    exit(1)
  }
  return { url: URL, key: KEY }
}

export function makeClient() {
  const { url, key } = requireEnv()
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** argv 에서 --flag value 또는 --flag=value 추출 */
export function arg(argv, flag, fallback = null) {
  const i = argv.indexOf(flag)
  if (i >= 0 && i + 1 < argv.length) return argv[i + 1]
  for (const a of argv) {
    if (a.startsWith(`${flag}=`)) return a.slice(flag.length + 1)
  }
  return fallback
}

export const VALID_CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
