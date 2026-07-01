// apps/web/src/lib/dictation/scoped-resource.ts
//
// 계획 launch(/dictate/setup?text=) — 스크립트(texts.content)를 임시 DictationResource 로.
// 받아쓰기는 문장(텍스트) 전사라 단어 리스트가 아닌 본문 필요 → 단어장 미해당,
// 도서는 inline 본문이 없어 hub. 스크립트(내 텍스트)만 스코핑.
// (dictation storage 는 localStorage 기반 — Phase 2 Supabase 예정)

import type { SupabaseClient } from '@supabase/supabase-js'

import type { CEFRCode, DictationResource } from './types'

const CEFR_SET = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])

interface TextRow {
  title: string | null
  content: string | null
  translation: string | null
  cefr_level: string | null
}

/** texts.id → DictationResource (본인 텍스트만). content 없으면 null. */
export async function fetchTextAsDictationResource(
  client: SupabaseClient,
  textId: string,
  userId: string | null,
): Promise<DictationResource | null> {
  if (!userId) return null
  const { data } = await client
    .from('texts')
    .select('title, content, translation, cefr_level')
    .eq('id', textId)
    .eq('user_id', userId)
    .maybeSingle()
  const row = data as TextRow | null
  if (!row?.content) return null

  const code = (row.cefr_level ?? '').toUpperCase()
  const cefr = CEFR_SET.has(code) ? (code as CEFRCode) : undefined

  return {
    id: `text-${textId}`,
    title: row.title ?? '스크립트',
    script: row.content,
    source: 'direct-script',
    cefr,
    translation: row.translation ?? undefined,
    createdAt: Date.now(),
  }
}
