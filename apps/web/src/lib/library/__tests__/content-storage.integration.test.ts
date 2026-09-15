// apps/web/src/lib/library/__tests__/content-storage.integration.test.ts
//
// ⚠️ 2026-09-06 개명 — 아래 줄이 "통합 테스트" 라고 적고 있는데 **이름만 규칙을 안 따랐다**
//    (바로 옆 content-quality-gate.integration.test.ts 는 따른다). 그래서 단위 실행
//    vitest run --exclude "**/*.integration.test.*" 에 이 파일이 섞여 들어갔고,
//    Supabase 가 멈춘 동안 단위층이 통째로 빨간불이 됐다 — 실패 메시지는
//    storeContentChunk failed: <!DOCTYPE html> (Cloudflare 522 페이지가 JSON 자리에 왔다).
//    env 가 있으면 skip 되지 않으므로 로컬에서는 항상 네트워크를 탄다. 이름으로 갈라야 한다.
// 통합 테스트 — 실제 Supabase 와 통신
// 환경변수 없으면 skip (vitest.config.ts 가 .env.local 자동 로드)

import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import {
  storeContentChunk,
  existsContentHash,
} from '../content-storage'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const skipIfNoEnv = !SUPABASE_URL || !SERVICE_KEY

describe.skipIf(skipIfNoEnv)('content-storage (integration)', () => {
  // env 없으면 suite skip — client 생성을 beforeAll 로 지연해야 collection 중
  // createClient(undefined!, …) 가 "supabaseUrl is required" 로 throw 하지 않음.
  // (describe 콜백 본문은 skipIf 여도 collection 때 실행되지만, hook 은 skip 시 미실행.)
  let client: ReturnType<typeof createClient>
  beforeAll(() => {
    client = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
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
