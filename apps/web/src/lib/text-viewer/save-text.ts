// apps/web/src/lib/text-viewer/save-text.ts
//
// /text/new 직접 입력 → public.texts INSERT 헬퍼.
// Phase 4-3 에서 AI 단어 추출 통합 시 본 모듈에 확장.
//
// RLS:
//   - INSERT 정책 USING (auth.uid() = user_id) — 본인 행만 삽입 가능
//   - service_role 키 사용 금지 (createClient = browser anon)

import { createClient } from '@/lib/supabase/client'

export interface SaveTextInput {
  title: string
  content: string
  /** 미입력 시 null 저장 */
  author?: string
}

export type SaveTextResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

const TITLE_MAX = 200
const CONTENT_MIN = 50
const CONTENT_MAX = 100_000

export async function saveText(input: SaveTextInput): Promise<SaveTextResult> {
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, error: '로그인이 필요합니다' }
  }

  const title = input.title.trim()
  const content = input.content.trim()
  const author = input.author?.trim() || null

  if (!title || !content) {
    return { ok: false, error: '제목과 내용을 모두 입력해주세요' }
  }
  if (title.length > TITLE_MAX) {
    return { ok: false, error: `제목이 너무 깁니다 (최대 ${TITLE_MAX}자)` }
  }
  if (content.length < CONTENT_MIN) {
    return { ok: false, error: `내용이 너무 짧습니다 (최소 ${CONTENT_MIN}자)` }
  }
  if (content.length > CONTENT_MAX) {
    return { ok: false, error: `내용이 너무 깁니다 (최대 ${CONTENT_MAX.toLocaleString()}자)` }
  }

  const { data, error } = await supabase
    .from('texts')
    .insert({
      user_id: user.id,
      title,
      content,
      author,
      source: 'direct-script',
      progress_percent: 0,
      cefr_level: null,
      cover_from: '#A78BFA',
      cover_to: '#6D28D9',
      last_opened: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error('[saveText] insert failed', error)
    return { ok: false, error: '저장 중 오류가 발생했습니다' }
  }

  return { ok: true, id: data.id }
}
