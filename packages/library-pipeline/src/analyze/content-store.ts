// packages/library-pipeline/src/analyze/content-store.ts
// LCP v2.0 — chapter content를 content_chunks에 저장 + hash 반환
// Phase 2의 store_content_chunk SQL 함수를 직접 호출

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * chapter content 배열을 content_chunks에 저장 + hash 배열 반환.
 * 동일 content는 hash dedup으로 자동 처리됨 (Phase 2 함수).
 */
export async function storeChapterChunks(
  client: SupabaseClient,
  chapterContents: string[],
): Promise<string[]> {
  const hashes: string[] = []
  for (const content of chapterContents) {
    const { data, error } = await client.rpc('store_content_chunk', {
      p_content: content,
    })
    if (error) {
      throw new Error(`store_content_chunk failed: ${error.message}`)
    }
    if (typeof data !== 'string') {
      throw new Error('store_content_chunk: invalid hash returned')
    }
    hashes.push(data)
  }
  return hashes
}
