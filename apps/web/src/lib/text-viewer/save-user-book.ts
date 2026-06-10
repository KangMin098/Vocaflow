// apps/web/src/lib/text-viewer/save-user-book.ts
//
// /text/new 챕터 모드 → public.texts N개 row INSERT 헬퍼.
// 모든 챕터는 같은 user_book_group_id 를 공유 (단순 UUID grouping token).
//
// 데이터 모델:
//   - user_book_group_id = UUID 1개 (책 식별)
//   - chapter_idx = 1..N (입력 순서)
//   - chapter_title = 챕터별 제목
//   - title = "{책 제목}" (각 row 동일 — /text 목록에서 그룹 표시 시 활용)
//   - author = 책 저자 (각 row 동일)
//
// 단일 트랜잭션 보장은 client-side 불가 — INSERT 1회 (.insert([rows])) 로 일괄 원자성.
// 실패 시 일부 row 가 들어갔으면 rollback 차원에서 group_id 로 일괄 DELETE 시도.

import { createClient } from '@/lib/supabase/client'

export interface UserBookChapter {
  /** 챕터 제목 (입력) */
  title: string
  /** 챕터 본문 */
  content: string
}

export interface SaveUserBookInput {
  /** 책 전체 제목 (모든 챕터의 texts.title 에 동일하게 들어감) */
  bookTitle: string
  /** 저자 (선택) */
  author?: string
  /** 챕터 배열 — 입력 순서가 chapter_idx 1..N */
  chapters: UserBookChapter[]
}

export type SaveUserBookResult =
  | {
      ok: true
      /** 그룹 식별자 (UUID) — 워크스페이스 진입 등에 활용 */
      groupId: string
      /** 첫 챕터의 texts.id (워크스페이스 redirect 용) */
      firstChapterTextId: string
      /** 생성된 texts row 수 */
      count: number
    }
  | { ok: false; error: string }

const TITLE_MAX = 200
const CHAPTER_TITLE_MAX = 200
const CONTENT_MIN = 50
const CONTENT_MAX = 100_000
const MAX_CHAPTERS = 50

export async function saveUserBook(input: SaveUserBookInput): Promise<SaveUserBookResult> {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return { ok: false, error: '로그인이 필요합니다' }

  const bookTitle = input.bookTitle.trim()
  const author = input.author?.trim() || null
  const chapters = input.chapters
    .map((c) => ({ title: c.title.trim(), content: c.content.trim() }))
    .filter((c) => c.title || c.content) // 둘 다 비어있는 빈 행은 제거

  if (!bookTitle) return { ok: false, error: '책 제목을 입력해주세요' }
  if (bookTitle.length > TITLE_MAX) {
    return { ok: false, error: `책 제목이 너무 깁니다 (최대 ${TITLE_MAX}자)` }
  }
  if (chapters.length === 0) {
    return { ok: false, error: '챕터 1개 이상이 필요합니다' }
  }
  if (chapters.length > MAX_CHAPTERS) {
    return { ok: false, error: `챕터는 최대 ${MAX_CHAPTERS}개까지 입력 가능합니다` }
  }

  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i]!
    const cn = i + 1
    if (!c.title) {
      return { ok: false, error: `${cn}번째 챕터 제목을 입력해주세요` }
    }
    if (c.title.length > CHAPTER_TITLE_MAX) {
      return { ok: false, error: `${cn}번째 챕터 제목이 너무 깁니다 (최대 ${CHAPTER_TITLE_MAX}자)` }
    }
    if (!c.content || c.content.length < CONTENT_MIN) {
      return { ok: false, error: `${cn}번째 챕터 본문은 최소 ${CONTENT_MIN}자 필요합니다` }
    }
    if (c.content.length > CONTENT_MAX) {
      return { ok: false, error: `${cn}번째 챕터 본문이 너무 깁니다 (최대 ${CONTENT_MAX.toLocaleString()}자)` }
    }
  }

  // group_id 1개 생성 → 모든 챕터 동일 사용. crypto.randomUUID 는 brower 지원 OK.
  const groupId = crypto.randomUUID()
  const now = new Date().toISOString()

  const rows = chapters.map((c, i) => ({
    user_id: user.id,
    title: bookTitle, // 모든 챕터 row 의 title 은 책 제목 (그룹 식별 단순화)
    author,
    content: c.content,
    chapter_idx: i + 1,
    chapter_title: c.title,
    user_book_group_id: groupId,
    source: 'direct-script' as const,
    progress_percent: 0,
    cefr_level: null,
    cover_from: '#A78BFA',
    cover_to: '#6D28D9',
    last_opened: now,
  }))

  const { data, error } = await supabase
    .from('texts')
    .insert(rows)
    .select('id, chapter_idx')
    .order('chapter_idx', { ascending: true })

  if (error || !data || data.length === 0) {
    // best-effort rollback — 부분 성공한 row 있으면 group_id 로 일괄 삭제
    if (data && data.length > 0) {
      await supabase.from('texts').delete().eq('user_book_group_id', groupId).eq('user_id', user.id)
    }
    // eslint-disable-next-line no-console
    console.error('[saveUserBook] insert failed', error)
    return { ok: false, error: '저장 중 오류가 발생했습니다' }
  }

  if (data.length !== chapters.length) {
    // 일부만 들어감 — rollback
    await supabase.from('texts').delete().eq('user_book_group_id', groupId).eq('user_id', user.id)
    return { ok: false, error: `${chapters.length}개 챕터 중 ${data.length}개만 저장됨 — 전체 취소` }
  }

  const first = data[0] as { id: string; chapter_idx: number }
  return {
    ok: true,
    groupId,
    firstChapterTextId: first.id,
    count: data.length,
  }
}
