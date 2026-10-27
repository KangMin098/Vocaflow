// apps/web/src/lib/scriptquiz/own-passage.ts
// T-0193 — 퀴즈 화면이 근거 짚기에 쓸 본문을 읽는다. **본인 texts 행**이고, 도서 챕터 퀴즈면 그 행이
// 같은 도서·챕터일 때만(다른 글 본문으로 근거를 맞추면 엉뚱한 문장을 「근거」로 세운다).
// 어떤 실패든 undefined — 피커가 없을 뿐 퀴즈는 그대로 풀린다. 본문에는 정답·근거가 없다.

export interface OwnPassageDeps {
  /** 현재 인증 사용자 id. 없으면 null */
  currentUserId: () => Promise<string | null>
  /** 그 사용자의 texts 행(id·user_id 로 조회). 없으면 null */
  findOwnText: (
    textId: string,
    userId: string,
  ) => Promise<{ library_book_id: string | null; chapter_idx: number | null } | null>
  /** get_chapter_content RPC(SECURITY DEFINER, 소유자 검사) */
  readContent: (textId: string) => Promise<string | null>
}

export async function readOwnPassage(
  deps: OwnPassageDeps,
  textId: string,
  chapter: { bookId: string; chapterIdx: number } | null,
): Promise<string | undefined> {
  try {
    if (!textId) return undefined
    const userId = await deps.currentUserId()
    if (!userId) return undefined
    const row = await deps.findOwnText(textId, userId)
    if (!row) return undefined
    if (chapter && (row.library_book_id !== chapter.bookId || row.chapter_idx !== chapter.chapterIdx)) return undefined
    const content = await deps.readContent(textId)
    return content && content.trim() ? content : undefined
  } catch {
    return undefined
  }
}

export type QuizPageMode = 'quiz' | 'empty' | 'demo'

/** 범위(book·ch 또는 text)를 주었는데 문항이 없으면 빈 상태 — 다른 글(데모)로 바꿔 보여 주지 않는다. */
export function quizPageMode(scoped: boolean, hasSession: boolean): QuizPageMode {
  if (hasSession) return 'quiz'
  return scoped ? 'empty' : 'demo'
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const INT_RE = /^(0|[1-9][0-9]*)$/

export type QuizScope =
  | { kind: 'none' }
  | { kind: 'book'; bookId: string; chapterIdx: number; textId?: string }
  | { kind: 'text'; textId: string }
  /** 범위를 주었지만 확인할 수 없다 — 데모·다른 장·개인 퀴즈로 바꿔 해석하지 않는다 */
  | { kind: 'invalid' }

/**
 * 퀴즈 범위 파라미터. **있음과 유효함을 나눈다** — book 만 있거나 ch 가 `bad`·`1junk`·`1.5` 이면
 * 무범위(데모)나 절삭된 장(1)이 아니라 invalid. 숫자는 원문 전체가 안전 정수일 때만.
 */
export function parseQuizScope(params: { book?: string; ch?: string; text?: string }): QuizScope {
  const has = (v: string | undefined) => v !== undefined
  const { book, ch, text } = params
  if (!has(book) && !has(ch) && !has(text)) return { kind: 'none' }
  if (has(text) && !UUID_RE.test(text!)) return { kind: 'invalid' }
  if (has(book) || has(ch)) {
    if (!has(book) || !has(ch) || !UUID_RE.test(book!) || !INT_RE.test(ch!)) return { kind: 'invalid' }
    const chapterIdx = Number(ch)
    if (!Number.isSafeInteger(chapterIdx)) return { kind: 'invalid' }
    return { kind: 'book', bookId: book!, chapterIdx, ...(has(text) ? { textId: text } : {}) }
  }
  return { kind: 'text', textId: text! }
}
