// apps/web/src/app/(main)/text/new/page.tsx
// @form: 채색 지문 — 붙여 넣으면 그 자리에서 칠해지는 입력칸(학년을 옮기면 처음 만나는 낱말에 주묵 면 · /fit 과 같은 부품)
//
// TextViewer 입력 화면 — 직접 입력 → texts INSERT → **새 글로** 이동.
//
// 2026-09-19 화면 재설계(DD-30 · docs/design/compare/text-new.md 발산 A 「붙여 넣으면 칠해지는 입력칸」):
//   · 본문을 붙여 넣거나 예시를 고르면 700ms 뒤 **그 자리가 칠해진 원문**으로 바뀐다(`/fit` 골든 부품 그대로).
//     「본문 고치기」 로 입력칸에 돌아간다. 타이핑 중에는 바꾸지 않는다(글자 치는 중에 입력칸이 사라지면 안 된다).
//   · 걷은 것: 텍스트/파일/URL 3열 선택 카드(파일·URL 은 **준비 중**인데 상단 바는 된다고 말했다) ·
//     제목 3번(상단 바 · 킥커 · 두 줄 h2) · 그림자 세그먼트 · 예시 글의 지어낸 단어 수·난이도 상수.
//   · 저장하면 `/text` 목록이 아니라 **방금 만든 글**로 간다 — 목록에서 다시 찾게 했다.
//   · 관측 `text_created { coveragePct, chapters }` — 칠하지 못한 채 저장하면 coveragePct = -1.

'use client'

import { ArrowLeft, ArrowRight, BookOpen, FileText, Moon, PenLine, RotateCcw, Sun, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { useToast } from '@/components/ui/Toast'
import { useTheme } from '@/hooks/useTheme'

import { BookChapterInput } from '@/components/text-viewer/BookChapterInput'
import {
  NewTextPaint,
  PAINT_MIN_CHARS,
  coveragePctOf,
  defaultLevelOf,
  useTextPaint,
} from '@/components/text-viewer/NewTextPaint'
import { SampleScripts } from '@/components/text-viewer/SampleScripts'
import { CONTENT_MAX, TextInput } from '@/components/text-viewer/TextInput'
import { track } from '@/lib/analytics/client'
import { saveText } from '@/lib/text-viewer/save-text'
import { saveUserBook, type UserBookChapter } from '@/lib/text-viewer/save-user-book'
import {
  clearDraft,
  hasDraftContent,
  readDraft,
  saveDraft,
  type TextNewDraft,
} from '@/lib/text-viewer/draft'
import { LEVEL_LABEL, type ProfileLevel } from '@/lib/textfit/profile'

const CONTENT_MIN = 50
const TITLE_MAX = 200

/** 단일 스크립트 입력 vs 책(챕터별) 입력 */
type StructureMode = 'single' | 'book'

const FIELD =
  'w-full rounded-[var(--r-md)] border border-bd bg-bg px-s-4 py-s-3 text-t1 placeholder:text-t3 transition-colors duration-normal focus:border-bdf focus:outline-none focus:ring-2 focus:ring-p/20'
const LABEL = 'mb-s-2 block font-display text-[12px] font-[700] text-t2'
const QUIET_BTN =
  'inline-flex min-h-11 items-center gap-s-2 rounded-[var(--r-md)] border border-bd bg-bg px-s-4 font-display text-[13px] font-semibold text-t2 transition-colors duration-normal hover:bg-bg2 hover:text-t1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40'

export default function TextViewerNewPage() {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const toast = useToast()

  const [structure, setStructure] = useState<StructureMode>('single')

  // 단일 모드 상태
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [text, setText] = useState('')

  // 책 모드 상태
  const [bookTitle, setBookTitle] = useState('')
  const [bookAuthor, setBookAuthor] = useState('')
  const [chapters, setChapters] = useState<UserBookChapter[]>([{ title: '', content: '' }])

  const [isSaving, setIsSaving] = useState(false)
  // 테마 아이콘은 브라우저에서만 — `useTheme` 의 첫 값이 서버(light)와 브라우저(OS 다크)에서 달라
  // 다크 OS 에서 hydration 오류 3건이 났다(2026-09-19 실측). 공용 훅은 고치지 않는다(A5 — 공용 교체 후보).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const [error, setError] = useState<string | null>(null)

  // ── 칠하기(DD-30) ──────────────────────────────────────────────
  const paint = useTextPaint(structure === 'single' ? text : '')
  const [level, setLevel] = useState<ProfileLevel>(6)
  /** 입력칸(true) / 칠해진 원문(false) */
  const [editing, setEditing] = useState(true)
  /** 붙여 넣기·예시 고르기로 들어온 본문이면, 칠이 도착하는 순간 칠해진 원문으로 바꾼다(`/fit` 과 같은 규칙) */
  const paintOnArrival = useRef(false)
  const lastProfile = useRef<unknown>(null)

  useEffect(() => {
    if (paint.kind !== 'ready' || lastProfile.current === paint.profile) return
    lastProfile.current = paint.profile
    setLevel(defaultLevelOf(paint))
    if (paintOnArrival.current) {
      paintOnArrival.current = false
      setEditing(false)
    }
  }, [paint])

  // 본문이 칠할 길이 아래로 줄면 입력칸으로 돌아간다(칠해진 원문이 빈 채로 남지 않게)
  useEffect(() => {
    if (text.trim().length < PAINT_MIN_CHARS) setEditing(true)
  }, [text])

  // ── 초안 보존 (B3) ──────────────────────────────────────────────
  //   여기서 나가면 붙여넣은 본문이 통째로 사라지던 화면이었다. 이제 sessionStorage 에
  //   1초 디바운스로 남기고, 돌아오면 "이어 쓰기 / 버리기" 한 줄로 복구한다.
  //   복구 배너를 **자동 적용하지 않는** 이유: 새 글을 쓰러 온 사람의 빈 폼을
  //   말없이 옛 글로 덮는 것이 잃는 것보다 나쁘다. 고르게 한다.
  const [pendingDraft, setPendingDraft] = useState<TextNewDraft | null>(null)
  /** 복구 배너에 답하기 전(또는 이미 복구·폐기한 뒤)인지 — 답하기 전에는 덮어쓰지 않는다 */
  const draftDecidedRef = useRef(false)

  useEffect(() => {
    const d = readDraft()
    if (d) setPendingDraft(d)
    else draftDecidedRef.current = true
  }, [])

  useEffect(() => {
    if (!draftDecidedRef.current) return
    const snapshot = {
      structure,
      title,
      author,
      text,
      bookTitle,
      bookAuthor,
      chapters,
    } as const
    // 빈 폼은 초안으로 남기지 않는다 — 남기면 다음 진입마다 빈 배너가 뜬다.
    if (!hasDraftContent(snapshot)) {
      clearDraft()
      return
    }
    const t = window.setTimeout(() => saveDraft(snapshot), 1_000)
    return () => window.clearTimeout(t)
  }, [structure, title, author, text, bookTitle, bookAuthor, chapters])

  const restoreDraft = () => {
    if (!pendingDraft) return
    setStructure(pendingDraft.structure)
    setTitle(pendingDraft.title)
    setAuthor(pendingDraft.author)
    setText(pendingDraft.text)
    setBookTitle(pendingDraft.bookTitle)
    setBookAuthor(pendingDraft.bookAuthor)
    setChapters(pendingDraft.chapters)
    draftDecidedRef.current = true
    setPendingDraft(null)
  }

  const discardDraft = () => {
    clearDraft()
    draftDecidedRef.current = true
    setPendingDraft(null)
  }

  const trimmedTitle = title.trim()
  const trimmedContent = text.trim()
  const trimmedBookTitle = bookTitle.trim()
  const validChapters = chapters
    .map((c) => ({ title: c.title.trim(), content: c.content.trim() }))
    .filter((c) => c.title || c.content)

  // 단일 모드 저장 가능 조건
  //   상한 검사가 없어서, 브라우저가 잘라낸 본문이 "성공적으로" 저장되던 결함이 있었다
  //   (v06.35 · TextInput 하드 절단 제거와 한 쌍). 넘치면 저장을 막아 절단을 만들지 않는다.
  const canSaveSingle =
    structure === 'single' &&
    trimmedTitle.length > 0 &&
    trimmedTitle.length <= TITLE_MAX &&
    trimmedContent.length >= CONTENT_MIN &&
    trimmedContent.length <= CONTENT_MAX

  // 책 모드 저장 가능 조건 — 책 제목 + 모든 챕터 (제목 + content≥CONTENT_MIN)
  const canSaveBook =
    structure === 'book' &&
    trimmedBookTitle.length > 0 &&
    trimmedBookTitle.length <= TITLE_MAX &&
    validChapters.length > 0 &&
    validChapters.every((c) => c.title && c.content.length >= CONTENT_MIN)

  const canSave = canSaveSingle || canSaveBook

  /** 저장 버튼이 왜 잠겼는지 — 비활성 버튼만 두면 무엇을 채워야 할지 모른다 */
  const blocker =
    structure === 'single'
      ? !trimmedTitle
        ? '제목을 적으면 저장할 수 있어요'
        : trimmedContent.length < CONTENT_MIN
          ? `본문을 ${CONTENT_MIN}자 이상 넣으면 저장할 수 있어요`
          : null
      : !trimmedBookTitle
        ? '책 제목을 적으면 저장할 수 있어요'
        : !canSaveBook
          ? `챕터마다 제목과 본문 ${CONTENT_MIN}자 이상이 필요해요`
          : null

  const handleSave = async () => {
    if (!canSave || isSaving) return
    setError(null)
    setIsSaving(true)

    if (structure === 'single') {
      const result = await saveText({
        title: trimmedTitle,
        content: trimmedContent,
        author: author.trim() || undefined,
      })
      if (result.ok) {
        // 저장됐으면 초안은 더 이상 초안이 아니다 — 남기면 다음 진입에 유령 배너가 뜬다.
        draftDecidedRef.current = false
        clearDraft()
        track({ name: 'text_created', props: { coveragePct: coveragePctOf(paint, level), chapters: 1 } })
        toast.success('저장했어요 — 바로 읽어 볼 수 있어요', { title: '저장 완료' })
        router.push(`/text/${result.id}`)
      } else {
        setError(result.error)
        setIsSaving(false)
      }
    } else {
      const result = await saveUserBook({
        bookTitle: trimmedBookTitle,
        author: bookAuthor.trim() || undefined,
        chapters: validChapters,
      })
      if (result.ok) {
        draftDecidedRef.current = false
        clearDraft()
        track({ name: 'text_created', props: { coveragePct: -1, chapters: result.count } })
        toast.success(`${result.count}개 챕터로 "${trimmedBookTitle}" 저장했어요`, { title: '책 저장 완료' })
        router.push(`/text/${result.firstChapterTextId}`)
      } else {
        setError(result.error)
        setIsSaving(false)
      }
    }
  }

  const painted = structure === 'single' && !editing && paint.kind === 'ready'

  return (
    <>
      {/* ── 헤더 — 이 화면의 이름은 여기 한 번만 ── */}
      <header className="flex h-[60px] flex-shrink-0 items-center gap-s-4 border-b border-bd bg-bg px-s-4 lg:px-s-6">
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate font-editorial text-base font-[600] leading-tight tracking-tight text-t1 sm:text-lg">
            새 스크립트 추가
          </h1>
          <p className="truncate font-body text-[11px] text-t2" aria-live="polite">
            {isSaving ? '저장 중…' : '붙여 넣으면 이 글이 어느 학년에게 맞는지 칠해져요'}
          </p>
        </div>

        <div className="flex-1" />

        <Link
          href="/text"
          aria-label="스크립트 허브로 돌아가기"
          className="flex min-h-11 items-center gap-2 rounded-md px-3 font-display text-[12px] font-[600] text-t2 transition-colors duration-normal hover:bg-bg2 hover:text-t1"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>허브</span>
        </Link>

        <button
          onClick={toggleTheme}
          aria-label="테마 전환"
          // 보이는 크기(36px)는 그대로, 누르는 영역만 44px — /wordvault 헤더가 쓰는 것과 같은 방식.
          className="flex h-11 w-11 items-center justify-center rounded-md text-t2 transition-colors duration-normal hover:bg-bg2 hover:text-t1"
        >
          {mounted && theme === 'dark' ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
        </button>
      </header>

      {/* ── 메인 ── */}
      <main className="flex-1 overflow-y-auto p-s-4 lg:p-s-6">
        <div className="mx-auto flex max-w-[760px] flex-col gap-s-5">
          {/* 쓰다 만 글 복구 — 이 화면에서 나가도 본문이 남는다는 유일한 증거다 */}
          {pendingDraft && (
            <div
              role="status"
              className="flex flex-col gap-s-3 border-l-2 border-[var(--p)] py-s-1 pl-s-4 sm:flex-row sm:items-center"
            >
              <p className="flex-1 break-keep font-body text-sm leading-relaxed text-t1">
                쓰던 글이 남아 있어요 —{' '}
                {pendingDraft.structure === 'book'
                  ? `책 "${pendingDraft.bookTitle || '제목 없음'}" · 챕터 ${pendingDraft.chapters.length}개`
                  : `"${pendingDraft.title || '제목 없음'}" · ${pendingDraft.text.trim().length}자`}
              </p>
              <div className="flex gap-s-2">
                <button
                  type="button"
                  onClick={restoreDraft}
                  className="inline-flex min-h-11 items-center gap-s-2 rounded-[var(--r-md)] bg-p px-s-4 font-display text-[13px] font-semibold text-[var(--on-p)] transition-colors duration-normal hover:bg-p-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:translate-y-px"
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  이어 쓰기
                </button>
                <button type="button" onClick={discardDraft} className={QUIET_BTN}>
                  <Trash2 size={14} aria-hidden="true" />
                  버리기
                </button>
              </div>
            </div>
          )}

          {/* 구조 — 한 편 / 책(챕터별). 글자 탭(밑줄)으로: 그림자 세그먼트는 떠 있는 버튼처럼 보였다 */}
          <div role="radiogroup" aria-label="스크립트 구조" className="flex gap-s-5 border-b border-bd">
            {(
              [
                { key: 'single', label: '한 편', icon: FileText },
                { key: 'book', label: '책 (챕터별)', icon: BookOpen },
              ] as const
            ).map(({ key, label, icon: Icon }) => {
              const on = structure === key
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setStructure(key)}
                  className={`-mb-px inline-flex min-h-11 items-center gap-s-2 border-b-2 px-s-1 font-display text-[14px] font-[600] transition-colors duration-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] ${
                    on ? 'border-[var(--ju)] text-t1' : 'border-transparent text-t2 hover:text-t1'
                  }`}
                >
                  <Icon size={14} aria-hidden />
                  {label}
                </button>
              )
            })}
          </div>

          {structure === 'single' && (
            <>
              <div className="grid gap-s-4 sm:grid-cols-[2fr_1fr]">
                <div>
                  <label htmlFor="text-title" className={LABEL}>
                    제목 <span className="text-[var(--error-ink)]">*</span>
                  </label>
                  <input
                    id="text-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={TITLE_MAX + 20}
                    placeholder="예: The Great Gatsby — Chapter 1"
                    aria-describedby={trimmedTitle.length > TITLE_MAX ? 'text-title-over' : undefined}
                    className={`${FIELD} font-display text-base`}
                  />
                  {trimmedTitle.length > TITLE_MAX && (
                    <p id="text-title-over" className="mt-s-1 font-mono text-[11px] text-[var(--error-ink)]">
                      {trimmedTitle.length} / {TITLE_MAX}자 — 조금 줄여 주세요
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="text-author" className={LABEL}>
                    저자 <span className="font-[400]">(선택)</span>
                  </label>
                  <input
                    id="text-author"
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    maxLength={120}
                    placeholder="예: F. Scott Fitzgerald"
                    className={`${FIELD} font-body text-sm`}
                  />
                </div>
              </div>

              {/* 본문 — 입력칸이 곧 결과. 칠해지면 그 자리에 원문이 칠해져 선다 */}
              <div>
                <div className="mb-s-2 flex items-baseline justify-between gap-s-3">
                  <label htmlFor="text-content" className={`${LABEL} mb-0`}>
                    본문 <span className="text-[var(--error-ink)]">*</span>{' '}
                    <span className="font-[400]">최소 {CONTENT_MIN}자</span>
                  </label>
                  {painted && (
                    <button type="button" onClick={() => setEditing(true)} className={QUIET_BTN}>
                      <PenLine size={14} aria-hidden />
                      본문 고치기
                    </button>
                  )}
                </div>

                {painted ? (
                  <div data-painted-text="" className="border-y border-bd py-s-4">
                    <NewTextPaint state={paint} text={text} level={level} onLevelChange={setLevel} />
                  </div>
                ) : (
                  <div onPaste={() => (paintOnArrival.current = true)}>
                    <TextInput id="text-content" value={text} onChange={setText} onClear={() => setText('')} />
                  </div>
                )}

                {/* 칠하기 상태 한 줄 — 입력칸일 때만(칠해진 원문은 스스로 말한다) */}
                {!painted && structure === 'single' && (
                  <p className="mt-s-2 min-h-[20px] font-body text-[12px] text-t2 [word-break:keep-all]" aria-live="polite">
                    {paint.kind === 'loading' && '이 글을 칠하는 중…'}
                    {paint.kind === 'error' && <span className="text-[var(--error-ink)]">{paint.message}</span>}
                    {paint.kind === 'idle' &&
                      trimmedContent.length > 0 &&
                      trimmedContent.length < PAINT_MIN_CHARS &&
                      `${PAINT_MIN_CHARS}자가 넘으면 어느 학년에게 맞는지 칠해져요`}
                    {paint.kind === 'ready' && (
                      <button
                        type="button"
                        onClick={() => setEditing(false)}
                        className="inline-flex min-h-11 items-center gap-s-1 font-display text-[12px] font-[700] text-[var(--p)] hover:text-[var(--p-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
                      >
                        {LEVEL_LABEL[level]} 기준으로 칠해 보기
                        <ArrowRight size={12} aria-hidden />
                      </button>
                    )}
                  </p>
                )}
              </div>

              {/* 빈 본문일 때만 — 예시로 먼저 칠해 보기(D4) */}
              {trimmedContent.length === 0 && (
                <SampleScripts
                  onSelect={(sampleText, sampleTitle) => {
                    paintOnArrival.current = true
                    setText(sampleText)
                    if (!trimmedTitle) setTitle(sampleTitle)
                  }}
                />
              )}
            </>
          )}

          {structure === 'book' && (
            <BookChapterInput
              bookTitle={bookTitle}
              onBookTitleChange={setBookTitle}
              author={bookAuthor}
              onAuthorChange={setBookAuthor}
              chapters={chapters}
              onChaptersChange={setChapters}
            />
          )}

          {error && (
            <div
              role="alert"
              className="border-l-2 border-[var(--error)] py-s-2 pl-s-4 font-body text-sm text-[var(--error-ink)]"
            >
              {error}
            </div>
          )}

          {/* 저장 — 한 곳. 잠겨 있으면 왜 잠겼는지 한 줄 */}
          <div className="flex flex-col gap-s-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || isSaving}
              aria-describedby={blocker ? 'save-blocker' : undefined}
              className="flex h-14 w-full items-center justify-center gap-s-3 rounded-[var(--r-md)] bg-[var(--ju)] font-display text-base font-bold text-[var(--on-ju)] transition-colors duration-normal hover:bg-[var(--ju-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[var(--ju)]"
            >
              {isSaving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--on-ju)] border-t-transparent" aria-hidden="true" />
                  <span>저장 중…</span>
                </>
              ) : (
                <>
                  <span>
                    {structure === 'book' && validChapters.length > 0
                      ? `저장하고 첫 챕터 읽기 (${validChapters.length}개 챕터)`
                      : '저장하고 바로 읽기'}
                  </span>
                  <ArrowRight size={18} aria-hidden />
                </>
              )}
            </button>
            {blocker && (
              <p id="save-blocker" className="text-center font-body text-[12px] text-t2">
                {blocker}
              </p>
            )}
          </div>

          {/* AI 단어 추출(ExtractionPanel)은 여기서 걷었다 — 2026-09-19 수정 1회차.
              같은 글에 칠해진 원문은 「고1 100%」, 패널은 「39.4% 아직 이른 글」(내 단어장 기준)을 말해
              **한 화면에 두 커버리지**가 섰다. 패널은 `/text/[id]` 와 공용이라 고치지 않고(A5),
              저장하면 바로 가는 `/text/[id]` 에 그대로 있다. */}
        </div>
      </main>
    </>
  )
}
