// apps/web/src/app/(main)/text/new/page.tsx
// TextViewer 입력 화면 — 직접 입력 → texts INSERT → /text 이동
// Phase 4-2: 직접 입력 탭만 동작. 파일/URL 은 준비 중 안내 (Phase 5+ 처리).

'use client'

import { ArrowLeft, ArrowRight, BookOpen, FileText, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { useToast } from '@/components/ui/Toast'
import { useTheme } from '@/hooks/useTheme'

import { InputModeTabs, type InputMode } from '@/components/text-viewer/InputModeTabs'
import { SampleScripts } from '@/components/text-viewer/SampleScripts'
import { TextInput } from '@/components/text-viewer/TextInput'
import { BookChapterInput } from '@/components/text-viewer/BookChapterInput'
import { saveText } from '@/lib/text-viewer/save-text'
import {
  saveUserBook,
  type UserBookChapter,
} from '@/lib/text-viewer/save-user-book'
import { ExtractionPanel } from '@/components/text-extract/ExtractionPanel'

const CONTENT_MIN = 50
const TITLE_MAX = 200

/** 단일 스크립트 입력 vs 책(챕터별) 입력 — InputModeTabs 의 file/url 과는 별개 축 */
type StructureMode = 'single' | 'book'

export default function TextViewerNewPage() {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const toast = useToast()

  const [mode, setMode] = useState<InputMode>('text')
  /** v06.34 — 단일 스크립트 vs 책(챕터별) 구조 모드 */
  const [structure, setStructure] = useState<StructureMode>('single')

  // 단일 모드 상태
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [text, setText] = useState('')

  // 책 모드 상태
  const [bookTitle, setBookTitle] = useState('')
  const [bookAuthor, setBookAuthor] = useState('')
  const [chapters, setChapters] = useState<UserBookChapter[]>([
    { title: '', content: '' },
  ])

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedTitle = title.trim()
  const trimmedContent = text.trim()
  const trimmedBookTitle = bookTitle.trim()
  const validChapters = chapters
    .map((c) => ({ title: c.title.trim(), content: c.content.trim() }))
    .filter((c) => c.title || c.content)

  // 단일 모드 저장 가능 조건
  const canSaveSingle =
    structure === 'single' &&
    trimmedTitle.length > 0 &&
    trimmedTitle.length <= TITLE_MAX &&
    trimmedContent.length >= CONTENT_MIN

  // 책 모드 저장 가능 조건 — 책 제목 + 모든 챕터 (제목 + content≥CONTENT_MIN)
  const canSaveBook =
    structure === 'book' &&
    trimmedBookTitle.length > 0 &&
    trimmedBookTitle.length <= TITLE_MAX &&
    validChapters.length > 0 &&
    validChapters.every((c) => c.title && c.content.length >= CONTENT_MIN)

  const canSave = mode === 'text' && (canSaveSingle || canSaveBook)

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
        toast.success('스크립트가 저장됐어요', { title: '저장 완료' })
        router.push('/text')
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
        toast.success(
          `${result.count}개 챕터로 "${trimmedBookTitle}" 저장됐어요`,
          { title: '책 저장 완료' },
        )
        router.push('/text')
      } else {
        setError(result.error)
        setIsSaving(false)
      }
    }
  }

  return (
    <>
      {/* ── 헤더 ── */}
      <header className="flex h-[60px] flex-shrink-0 items-center gap-s-4 border-b border-bd bg-bg px-s-4 lg:px-s-6">
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate font-display text-base font-bold leading-tight tracking-tight text-t1 sm:text-lg">
            새 스크립트 추가
          </h1>
          <p className="truncate font-mono text-[10px] uppercase tracking-wider text-t3">
            {isSaving ? '저장 중...' : '직접 입력 · 파일 · URL'}
          </p>
        </div>

        <div className="flex-1" />

        <Link
          href="/text"
          aria-label="스크립트 허브로 돌아가기"
          className="flex h-9 items-center gap-1.5 rounded-md px-3 font-display text-[12px] font-[600] text-t2 transition-colors duration-normal hover:bg-bg2 hover:text-t1"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>허브</span>
        </Link>

        <button
          onClick={toggleTheme}
          aria-label="테마 전환"
          className="flex h-9 w-9 items-center justify-center rounded-md text-t2 transition-colors duration-normal hover:bg-bg2 hover:text-t1"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </header>

      {/* ── 메인 ── */}
      <main className="flex-1 overflow-y-auto p-s-4 lg:p-s-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-s-8">
            <div className="mb-s-3 flex items-center gap-s-2">
              <FileText size={14} className="text-p" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-t3">
                — 새 스크립트 추가하기
              </span>
            </div>

            <h2 className="mb-s-3 font-display text-2xl font-extrabold leading-[1.1] tracking-[-0.02em] text-t1 sm:text-3xl">
              직접 입력한 스크립트을
              <br />
              <span className="text-p">내 라이브러리에 추가</span>합니다
            </h2>

            <p className="max-w-xl font-body text-sm leading-relaxed text-t2 sm:text-base">
              제목과 본문을 입력해 보관하세요. 본문 입력 시 다축 VRL 기반 AI 단어 추출이 활성화됩니다.
            </p>
          </div>

          <InputModeTabs value={mode} onChange={setMode} />

          {mode === 'text' && (
            <>
              {/* v06.34 — 구조 모드 토글: 단일 스크립트 vs 책 (챕터별) */}
              <div className="mb-s-4 flex flex-col gap-s-2">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-t3">
                  입력 구조
                </span>
                <div
                  role="radiogroup"
                  aria-label="스크립트 구조"
                  className="grid grid-cols-2 gap-s-2 rounded-xl border border-bd bg-bg2 p-s-1"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={structure === 'single'}
                    onClick={() => setStructure('single')}
                    className={[
                      'flex items-center justify-center gap-s-2 rounded-lg px-s-3 py-s-2 font-display text-sm font-[600] transition-all duration-normal',
                      structure === 'single'
                        ? 'bg-bg text-t1 shadow-sm'
                        : 'text-t3 hover:text-t1',
                    ].join(' ')}
                  >
                    <FileText size={14} aria-hidden />
                    <span>단일 스크립트</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={structure === 'book'}
                    onClick={() => setStructure('book')}
                    className={[
                      'flex items-center justify-center gap-s-2 rounded-lg px-s-3 py-s-2 font-display text-sm font-[600] transition-all duration-normal',
                      structure === 'book'
                        ? 'bg-bg text-t1 shadow-sm'
                        : 'text-t3 hover:text-t1',
                    ].join(' ')}
                  >
                    <BookOpen size={14} aria-hidden />
                    <span>책 (챕터별)</span>
                  </button>
                </div>
                <p className="font-body text-xs text-t3">
                  {structure === 'single'
                    ? '단일 본문 1개를 그대로 저장합니다.'
                    : '책 1권을 챕터별로 입력해 하나의 책으로 묶입니다.'}
                </p>
              </div>

              {structure === 'single' && (
                <>
                  {/* 제목 */}
                  <div className="mb-s-4">
                    <label
                      htmlFor="text-title"
                      className="mb-s-2 block font-mono text-[10px] font-semibold uppercase tracking-wider text-t3"
                    >
                      제목 <span className="text-error">*</span>
                    </label>
                    <input
                      id="text-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={TITLE_MAX + 20}
                      placeholder="예: The Great Gatsby — Chapter 1"
                      className="w-full rounded-lg border border-bd bg-bg px-s-4 py-s-3 font-display text-base text-t1 placeholder:text-t3 transition-all duration-normal focus:border-bdf focus:outline-none focus:ring-2 focus:ring-p/20"
                    />
                    <div className="mt-s-1 flex justify-end font-mono text-[10px] text-t3">
                      <span className={trimmedTitle.length > TITLE_MAX ? 'text-error' : ''}>
                        {trimmedTitle.length} / {TITLE_MAX}
                      </span>
                    </div>
                  </div>

                  {/* 저자 (선택) */}
                  <div className="mb-s-4">
                    <label
                      htmlFor="text-author"
                      className="mb-s-2 block font-mono text-[10px] font-semibold uppercase tracking-wider text-t3"
                    >
                      저자 <span className="text-t4">(선택)</span>
                    </label>
                    <input
                      id="text-author"
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      maxLength={120}
                      placeholder="예: F. Scott Fitzgerald"
                      className="w-full rounded-lg border border-bd bg-bg px-s-4 py-s-3 font-body text-sm text-t1 placeholder:text-t3 transition-all duration-normal focus:border-bdf focus:outline-none focus:ring-2 focus:ring-p/20"
                    />
                  </div>

                  {/* 본문 */}
                  <div className="mb-s-2">
                    <label
                      htmlFor="text-content"
                      className="mb-s-2 block font-mono text-[10px] font-semibold uppercase tracking-wider text-t3"
                    >
                      본문 <span className="text-error">*</span>{' '}
                      <span className="text-t4">최소 {CONTENT_MIN}자</span>
                    </label>
                    <TextInput value={text} onChange={setText} onClear={() => setText('')} />
                  </div>

                  <div className="mb-s-6">
                    <SampleScripts
                      onSelect={(sampleText, sampleTitle) => {
                        setText(sampleText)
                        if (!trimmedTitle) setTitle(sampleTitle)
                        toast.success(`"${sampleTitle}" 적용됨`)
                      }}
                    />
                  </div>

                  {/* Phase 3A: 다축 VRL AI 단어 추출 — composite score + evaluation breakdown */}
                  <ExtractionPanel
                    text={trimmedContent.length >= CONTENT_MIN ? trimmedContent : ''}
                    onSaved={(count) =>
                      toast.success(`${count}개 단어를 내 단어장에 추가했어요`, {
                        title: 'AI 단어 추출 완료',
                      })
                    }
                  />
                </>
              )}

              {structure === 'book' && (
                <div className="mb-s-6">
                  <BookChapterInput
                    bookTitle={bookTitle}
                    onBookTitleChange={setBookTitle}
                    author={bookAuthor}
                    onAuthorChange={setBookAuthor}
                    chapters={chapters}
                    onChaptersChange={setChapters}
                  />
                </div>
              )}
            </>
          )}

          {(mode === 'file' || mode === 'url') && (
            <div className="mb-s-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-bd bg-bg2 px-s-6 py-s-12 text-center">
              <div className="mb-s-3 flex h-12 w-12 items-center justify-center rounded-full bg-bg3 text-t3">
                <Sparkles size={20} />
              </div>
              <p className="font-display text-base font-bold text-t1">
                이 입력 방식은 준비 중입니다
              </p>
              <p className="mt-s-1 font-body text-sm text-t2">
                곧 만나보실 수 있어요. 지금은 텍스트 직접 입력으로 시작해 보세요.
              </p>
              <button
                type="button"
                onClick={() => setMode('text')}
                className="mt-s-4 inline-flex items-center gap-s-1 rounded-md border border-bd bg-bg px-s-3 py-s-2 font-display text-[12px] font-semibold text-t2 transition-colors duration-normal hover:border-p hover:text-p"
              >
                직접 입력으로 이동
                <ArrowRight size={12} />
              </button>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mb-s-4 rounded-lg border border-error bg-error-light px-s-4 py-s-3 font-body text-sm text-error"
            >
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className="group relative flex h-14 w-full items-center justify-center gap-s-3 overflow-hidden rounded-xl bg-p font-display text-base font-bold text-ti shadow-sm transition-all duration-normal hover:bg-p-hover hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-p"
          >
            {isSaving ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-ti/40 border-t-ti"
                  aria-hidden="true"
                />
                <span>저장 중...</span>
              </>
            ) : (
              <>
                {structure === 'book' ? <BookOpen size={18} /> : <FileText size={18} />}
                <span>
                  {structure === 'book' && validChapters.length > 0
                    ? `저장하기 (${validChapters.length}개 챕터)`
                    : '저장하기'}
                </span>
                <ArrowRight
                  size={18}
                  className="transition-transform duration-normal group-hover:translate-x-1"
                />
              </>
            )}
          </button>

          <p className="pt-s-4 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-t3">
            저장 후 내 라이브러리에서 바로 학습할 수 있어요
          </p>
        </div>
      </main>
    </>
  )
}
