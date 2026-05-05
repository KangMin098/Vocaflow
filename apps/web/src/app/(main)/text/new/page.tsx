// apps/web/src/app/(main)/text/new/page.tsx
// TextViewer 입력 화면 — 직접 입력 → texts INSERT → /text 이동
// Phase 4-2: 직접 입력 탭만 동작. 파일/URL 은 준비 중 안내 (Phase 5+ 처리).

'use client'

import { ArrowLeft, ArrowRight, FileText, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { useToast } from '@/components/ui/Toast'
import { useTheme } from '@/hooks/useTheme'

import { InputModeTabs, type InputMode } from '@/components/text-viewer/InputModeTabs'
import { SampleScripts } from '@/components/text-viewer/SampleScripts'
import { TextInput } from '@/components/text-viewer/TextInput'
import { saveText } from '@/lib/text-viewer/save-text'

const CONTENT_MIN = 50
const TITLE_MAX = 200

export default function TextViewerNewPage() {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const toast = useToast()

  const [mode, setMode] = useState<InputMode>('text')
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [text, setText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedTitle = title.trim()
  const trimmedContent = text.trim()
  const canSave =
    mode === 'text' &&
    trimmedTitle.length > 0 &&
    trimmedTitle.length <= TITLE_MAX &&
    trimmedContent.length >= CONTENT_MIN

  const handleSave = async () => {
    if (!canSave || isSaving) return
    setError(null)
    setIsSaving(true)

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
              제목과 본문을 입력해 보관하세요. AI 단어 추출은 곧 만나보실 수 있어요.
            </p>
          </div>

          <InputModeTabs value={mode} onChange={setMode} />

          {mode === 'text' && (
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
                <FileText size={18} />
                <span>저장하기</span>
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
