// apps/web/src/lib/library/content-storage.ts
// LCP v2.0 — Content-addressed storage client
// 본문은 content_chunks 에 SHA-256 hash 기반 1회만 저장

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 본문을 content_chunks 에 저장하고 hash 반환.
 * 같은 본문은 hash 기반 dedup — 100명이 같은 chapter 학습해도 1번만 저장.
 *
 * @param client  service_role 권한 Supabase 클라이언트 (admin 측에서만 호출)
 * @param content chapter 본문 (UTF-8 텍스트)
 * @returns       SHA-256 hex hash (64자)
 */
export async function storeContentChunk(
  client: SupabaseClient,
  content: string,
): Promise<string> {
  if (!content || content.trim().length === 0) {
    throw new Error('storeContentChunk: empty content')
  }

  const { data, error } = await client.rpc('store_content_chunk', {
    p_content: content,
  })

  if (error) throw new Error(`storeContentChunk failed: ${error.message}`)
  if (!data) throw new Error('storeContentChunk: no hash returned')
  return data as string
}

/**
 * texts row 1개의 본문 조회.
 * 라이브러리 책 chapter 면 content_chunks 에서, 직접입력 텍스트면 texts.content 에서.
 * SECURITY DEFINER 함수로 권한 검증 자동.
 */
export async function getChapterContent(
  client: SupabaseClient,
  textId: string,
): Promise<string | null> {
  const { data, error } = await client.rpc('get_chapter_content', {
    p_text_id: textId,
  })

  if (error) throw new Error(`getChapterContent failed: ${error.message}`)
  return (data as string | null) ?? null
}

/**
 * 같은 hash 가 이미 저장되어 있는지 빠른 확인 (저장 전 dedup 확인용).
 * service_role 또는 authenticated 모두 SELECT 가능.
 */
export async function existsContentHash(
  client: SupabaseClient,
  hash: string,
): Promise<boolean> {
  const { data, error } = await client
    .from('content_chunks')
    .select('hash')
    .eq('hash', hash)
    .maybeSingle()

  if (error) throw new Error(`existsContentHash failed: ${error.message}`)
  return data !== null
}
