// apps/web/src/app/(main)/text/new/page.tsx
// TextViewer 입력 화면 — 직접입력 / PDF·DOCX·TXT / URL → AI 분석 → WordVault 인계
// /text 허브에서 "새 스크립트 추가하기" CTA 로 진입

'use client'

import { ArrowLeft, ArrowRight, FileText, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { useToast } from '@/components/ui/Toast'
import { useTheme } from '@/hooks/useTheme'

import { FileUploadArea } from '@/components/text-viewer/FileUploadArea'
import { InputModeTabs, type InputMode } from '@/components/text-viewer/InputModeTabs'
import { SampleScripts } from '@/components/text-viewer/SampleScripts'
import { TextInput } from '@/components/text-viewer/TextInput'
import { UrlInput } from '@/components/text-viewer/UrlInput'
import { mockAnalysisResult } from '@/components/text-viewer/analysis-types'
import { saveExtractedWords } from '@/lib/text-viewer/handoff'

type ViewState = 'input' | 'analyzing'

export default function TextViewerNewPage() {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const toast = useToast()

  const [view, setView] = useState<ViewState>('input')
  const [mode, setMode] = useState<InputMode>('text')
  const [text, setText] = useState('')

  const canAnalyze = mode === 'text' ? text.trim().length > 0 : false

  const handleAnalyze = () => {
    if (!canAnalyze) return
    setView('analyzing')

    // Mock: 1.5s analysis → handoff to WordVault
    setTimeout(() => {
      const words = mockAnalysisResult.words
      saveExtractedWords(words)
      toast.success(`${words.length}개 단어 추출 완료`, {
        title: 'AI 분석 완료',
      })
      router.push('/wordvault/browse')
    }, 1500)
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
            {view === 'input' && '직접 입력 · 파일 · URL'}
            {view === 'analyzing' && 'AI 분석 중...'}
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
          {/* INPUT */}
          {view === 'input' && (
            <>
              <div className="mb-s-8">
                <div className="mb-s-3 flex items-center gap-s-2">
                  <FileText size={14} className="text-p" />
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-t3">
                    — 새 스크립트 추가하기
                  </span>
                </div>

                <h2 className="mb-s-3 font-display text-2xl font-extrabold leading-[1.1] tracking-[-0.02em] text-t1 sm:text-3xl">
                  스크립트을 추가하면
                  <br />
                  <span className="text-p">AI가 단어를 추출</span>합니다
                </h2>

                <p className="max-w-xl font-body text-sm leading-relaxed text-t2 sm:text-base">
                  텍스트를 직접 입력하거나 PDF · DOCX · TXT 파일을 업로드하면, AI가 핵심 단어를
                  추출해 학습용 단어장을 자동 생성합니다.
                </p>
              </div>

              <InputModeTabs value={mode} onChange={setMode} />

              <div className="mb-s-6">
                {mode === 'text' && (
                  <TextInput value={text} onChange={setText} onClear={() => setText('')} />
                )}
                {mode === 'file' && (
                  <FileUploadArea
                    onFileSelect={(file) =>
                      toast.info(`파일 선택: ${file.name} (Phase 2에서 파싱)`)
                    }
                  />
                )}
                {mode === 'url' && (
                  <UrlInput
                    onUrlSubmit={async (url) => {
                      toast.info(`URL: ${url} (Phase 2에서 본문 추출)`)
                    }}
                  />
                )}
              </div>

              {mode === 'text' && (
                <div className="mb-s-8">
                  <SampleScripts
                    onSelect={(sampleText, title) => {
                      setText(sampleText)
                      toast.success(`"${title}" 적용됨`)
                    }}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                className="group relative flex h-14 w-full items-center justify-center gap-s-3 overflow-hidden rounded-xl bg-p font-display text-base font-bold text-ti shadow-sm transition-all duration-normal hover:bg-p-hover hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-p"
              >
                <Sparkles
                  size={18}
                  className="transition-transform duration-normal group-hover:rotate-12"
                />
                <span>AI로 단어 추출하기</span>
                <ArrowRight
                  size={18}
                  className="transition-transform duration-normal group-hover:translate-x-1"
                />
              </button>

              <p className="pt-s-4 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-t3">
                평균 3-5초 소요 · GPT-4o-mini 사용
              </p>
            </>
          )}

          {/* ANALYZING */}
          {view === 'analyzing' && (
            <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
              <div className="relative mb-s-6 h-20 w-20">
                <div
                  className="absolute inset-0 animate-spin rounded-full border-4 border-bg3 border-t-p"
                  style={{ animationDuration: '1s' }}
                />
                <div
                  className="absolute inset-3 flex items-center justify-center rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, var(--p) 0%, var(--combo) 100%)',
                  }}
                >
                  <Sparkles size={20} className="animate-pulse text-ti" />
                </div>
              </div>

              <p className="mb-s-3 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-t3">
                — AI 분석 진행 중
              </p>

              <h2 className="mb-s-2 font-display text-2xl font-extrabold tracking-tight text-t1">
                단어를 추출하고 있어요
              </h2>

              <p className="max-w-md font-body text-sm text-t2">
                GPT-4o-mini가 텍스트를 분석하여
                <br />
                학습 가치가 높은 단어를 골라내는 중입니다.
              </p>

              <div className="mt-s-6 flex items-center gap-s-2 font-mono text-xs text-t3">
                <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
                <span>평균 3-5초 소요</span>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
