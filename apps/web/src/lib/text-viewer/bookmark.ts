// apps/web/src/lib/text-viewer/bookmark.ts
//
// 지문 워크스페이스의 북마크(별) — `texts.is_bookmarked` 영속화.
//
// 왜 이 파일이 생겼나: 헤더 버튼과 `B` 단축키가 로컬 state 만 뒤집고 있었다.
// 새로고침 한 번에 사라지는데 화면은 "B 키로 추가할 수 있어요" 라고 **가르치고** 있었고,
// `/text` 허브(`useTexts`)는 이미 `is_bookmarked` 를 읽어 카드에 별을 그리고 있었다 —
// 읽는 쪽만 있고 쓰는 쪽이 없었다. 컬럼도 인덱스도(`idx_texts_user_bookmark`) 이미 있으므로
// 마이그레이션 없이 쓰기만 연결한다.
//
// RLS: `texts` 는 auth.uid() = user_id 로 격리된다 — 남의 행은 0행 갱신으로 조용히 실패하지
// 않도록 `select('id')` 로 되받아 **갱신된 행이 있었는지**까지 확인한다.

import { createClient } from '@/lib/supabase/client'

/** 이 텍스트가 북마크돼 있는지. 비로그인·조회 실패는 false (별을 켜지 않는다). */
export async function fetchBookmarked(textId: string): Promise<boolean> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('texts')
    .select('is_bookmarked')
    .eq('id', textId)
    .maybeSingle()
  if (error || !data) return false
  return (data as { is_bookmarked: boolean | null }).is_bookmarked === true
}

/**
 * 북마크 저장. 성공 여부를 반드시 돌려준다 —
 * 호출부가 실패 시 낙관적 표시를 되돌릴 수 있어야 한다.
 */
export async function setBookmarked(
  textId: string,
  value: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('texts')
    .update({ is_bookmarked: value })
    .eq('id', textId)
    .select('id')
  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return { ok: false, error: '이 글에 북마크를 저장할 권한이 없어요' }
  }
  return { ok: true }
}
