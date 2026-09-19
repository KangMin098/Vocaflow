// apps/web/src/lib/text-viewer/draft.ts
//
// `/text/new` 입력 초안 보존 — sessionStorage.
//
// 왜: 책 한 챕터를 붙여넣고 제목·저자를 채운 뒤 헤더의 「허브」를 잘못 누르거나
// 브라우저 뒤로가기를 하면 전부 사라졌다(순수 useState). 「책 (챕터별)」 모드에서는
// 챕터 여러 개를 한꺼번에 잃었다.
//
// 왜 sessionStorage 인가: 같은 저장소의 받아쓰기 QuickPaste 가 저장되지 않은 본문을
// 정확히 이 방식으로 넘긴다(`lib/dictation/source.ts` CUSTOM_SCRIPT_KEY). 탭을 닫으면
// 사라지는 수명이 "아직 저장하지 않은 글" 의 수명과 같다 — localStorage 는 몇 주 전 초안을
// 남의 기기에 남긴다.

import type { UserBookChapter } from './save-user-book'

export const TEXT_DRAFT_KEY = 'vocaflow:text-new:draft'

export interface TextNewDraft {
  /** 'single' | 'book' — 복구 시 구조 모드까지 되돌린다 */
  structure: 'single' | 'book'
  title: string
  author: string
  text: string
  bookTitle: string
  bookAuthor: string
  chapters: UserBookChapter[]
  /** 저장 시각 (ms) — 배너 문구용은 아니고, 손상된 초안을 걸러 내는 최소 검증에 쓴다 */
  savedAt: number
}

/** 실제로 쓴 글자가 하나라도 있는가 — 빈 폼을 초안으로 남기지 않는다. */
export function hasDraftContent(d: Omit<TextNewDraft, 'savedAt'>): boolean {
  if (d.structure === 'single') {
    return !!(d.title.trim() || d.author.trim() || d.text.trim())
  }
  return !!(
    d.bookTitle.trim() ||
    d.bookAuthor.trim() ||
    d.chapters.some((c) => c.title.trim() || c.content.trim())
  )
}

export function saveDraft(d: Omit<TextNewDraft, 'savedAt'>): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(
      TEXT_DRAFT_KEY,
      JSON.stringify({ ...d, savedAt: Date.now() } satisfies TextNewDraft),
    )
  } catch {
    /* quota 초과 등 — 초안 보존은 부수 효과다. 입력을 막지 않는다. */
  }
}

export function readDraft(): TextNewDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(TEXT_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<TextNewDraft>
    if (parsed.structure !== 'single' && parsed.structure !== 'book') return null
    const draft: TextNewDraft = {
      structure: parsed.structure,
      title: typeof parsed.title === 'string' ? parsed.title : '',
      author: typeof parsed.author === 'string' ? parsed.author : '',
      text: typeof parsed.text === 'string' ? parsed.text : '',
      bookTitle: typeof parsed.bookTitle === 'string' ? parsed.bookTitle : '',
      bookAuthor: typeof parsed.bookAuthor === 'string' ? parsed.bookAuthor : '',
      chapters:
        Array.isArray(parsed.chapters) && parsed.chapters.length > 0
          ? parsed.chapters.map((c) => ({
              title: typeof c?.title === 'string' ? c.title : '',
              content: typeof c?.content === 'string' ? c.content : '',
            }))
          : [{ title: '', content: '' }],
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
    }
    return hasDraftContent(draft) ? draft : null
  } catch {
    return null
  }
}

/** 저장 성공 시 · 「버리기」 시 호출. 남겨 두면 다음 진입마다 배너가 뜬다. */
export function clearDraft(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(TEXT_DRAFT_KEY)
  } catch {
    /* noop */
  }
}
