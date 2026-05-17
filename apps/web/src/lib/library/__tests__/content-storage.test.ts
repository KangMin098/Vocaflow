// apps/web/src/lib/library/__tests__/content-storage.test.ts
// 통합 테스트 — 실제 Supabase 와 통신
// 환경변수 없으면 skip (vitest.config.ts 가 .env.local 자동 로드)

import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import {
  storeContentChunk,
  existsContentHash,
} from '../content-storage'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const skipIfNoEnv = !SUPABASE_URL || !SERVICE_KEY

describe.skipIf(skipIfNoEnv)('content-storage (integration)', () => {
  const client = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  it('storeContentChunk — 신규 저장', async () => {
    const sample = 'The quick brown fox jumps over the lazy dog. ' + Date.now()
    const hash = await storeContentChunk(client, sample)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)

    const exists = await existsContentHash(client, hash)
    expect(exists).toBe(true)
  })

  it('storeContentChunk — 동일 본문 dedup', async () => {
    const sample = 'Deduplication test sample — ' + Math.random().toString(36)
    const hash1 = await storeContentChunk(client, sample)
    const hash2 = await storeContentChunk(client, sample)
    expect(hash1).toBe(hash2)
  })

  it('빈 입력은 거부', async () => {
    await expect(storeContentChunk(client, '')).rejects.toThrow()
    await expect(storeContentChunk(client, '   ')).rejects.toThrow()
  })
})
