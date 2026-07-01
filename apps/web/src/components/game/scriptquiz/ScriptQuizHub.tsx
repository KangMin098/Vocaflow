// apps/web/src/components/game/scriptquiz/ScriptQuizHub.tsx
// ScriptQuiz Hub (client) — 큐레이션 챕터 퀴즈 카탈로그에서 도서·챕터 선택
// 학습 과학:
//   · 맥락 의존 기억 — chapter 단위로 묶어 인출
//   · Self-determination — 도서·챕터·언어 모드 사용자 선택
//   · Immersion (default) — 영어 질문/선택지, 한영 토글로 학습자 자율성 보장
//   · Calm UI — 압박 없는 챕터 그리드 + 문항 수만 담백 표기

'use client'

import { BookOpen, FileText, Languages, Sparkles } from 'lucide-react'
import { useState } from 'react'

import { HubStartCard } from '@/components/hub/HubStartCard'
import { ModuleHero } from '@/components/hub/ModuleHero'
import type { ChapterQuizCatalogBook } from '@/components/game/scriptquiz/types'

const QUIZ_ACCENT = 'var(--active)' // 앰버

interface Selected {
  bookId: string
  chapterIdx: number
}

export function ScriptQuizHub({ catalog }: { catalog: ChapterQuizCatalogBook[] }) {
  const firstBook = catalog[0]
  const firstChapter = firstBook?.chapters[0]
  const [selected, setSelected] = useState<Selected | null>(
    firstBook && firstChapter
      ? { bookId: firstBook.bookId, chapterIdx: firstChapter.chapterIdx }
      : null,
  )
  const [showKorean, setShowKorean] = useState(false)

  const bookCount = catalog.length
  const chapterCount = catalog.reduce((s, b) => s + b.chapters.length, 0)
  const questionTotal = catalog.reduce((s, b) => s + b.questionTotal, 0)

  const koQuery = showKorean ? '&ko=1' : ''
  const ctaHref = selected
    ? `/scriptquiz/play?book=${selected.bookId}&ch=${selected.chapterIdx}${koQuery}`
    : '#'

  const koToggle = (
    <label className="flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
      <span
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-[var(--bg)] text-[var(--p)]"
        aria-hidden
      >
        <Languages size={14} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[13px] font-[600] text-[var(--t1)]">
          한국어 번역 보기
        </span>
        <span className="block font-body text-[11px] text-[var(--t3)]">
          질문·선택지 아래 회색 작은 글씨로 보조 표시 — 영어로만 보고 싶다면 끄세요
        </span>
      </span>
      <input
        type="checkbox"
        checked={showKorean}
        onChange={(e) => setShowKorean(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-[var(--p)]"
        aria-label="한국어 번역 보기"
      />
    </label>
  )

  return (
    <div className="mx-auto flex max-w-[var(--ios-content-wide-max)] flex-col gap-4 px-4 py-6 md:px-6 md:py-8">
      {/* ── 1. Hero ── */}
      <ModuleHero
        eyebrow="ScriptQuiz · 스크립트 독해"
        title="스토리 기반 독해 검증"
        note={
          questionTotal > 0
            ? `도서 ${bookCount} · 챕터 ${chapterCount} · 문항 ${questionTotal}`
            : '아직 생성된 챕터 퀴즈가 없어요 — 샘플로 먼저 체험해 보세요'
        }
        gradient={{ from: '#F59E0B', to: '#B45309' }}
        icon={FileText}
        stats={[
          { label: '도서', value: bookCount, emphasis: true },
          { label: '챕터', value: chapterCount, unit: 'ch' },
          { label: '문항', value: questionTotal },
        ]}
      />

      {catalog.length === 0 ? (
        /* ── 빈 상태 — 샘플 데모 유도 ── */
        <section className="flex flex-col items-center gap-4 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg)] px-6 py-12 text-center shadow-[var(--sh-sm)]">
          <span
            className="inline-flex h-12 w-12 items-center justify-center rounded-[var(--r-full)]"
            style={{ backgroundColor: 'var(--warning-light)', color: QUIZ_ACCENT }}
            aria-hidden
          >
            <Sparkles size={20} strokeWidth={2} />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">
              생성된 챕터 퀴즈가 아직 없어요
            </h2>
            <p className="max-w-[420px] font-body text-[12.5px] leading-relaxed text-[var(--t3)]">
              라이브러리 도서를 큐레이션하면 챕터별 스토리 퀴즈가 생성됩니다. 우선 샘플
              퀴즈로 흐름을 체험해 보세요.
            </p>
          </div>
          <a
            href="/scriptquiz/play"
            className="inline-flex items-center gap-2 rounded-[var(--r-md)] px-5 py-2.5 font-display text-[13px] font-[700] text-[var(--ti)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:scale-[1.02] active:scale-[0.97]"
            style={{ backgroundColor: QUIZ_ACCENT }}
          >
            <Sparkles size={13} strokeWidth={2.5} aria-hidden />
            샘플 퀴즈 체험
          </a>
        </section>
      ) : (
        <>
          {/* ── 2. 도서별 챕터 선택 ── */}
          {catalog.map((book) => (
            <section
              key={book.bookId}
              aria-label={`${book.bookTitle} 챕터`}
              className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
            >
              <header className="mb-4 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)]"
                  style={{ backgroundColor: 'var(--warning-light)', color: QUIZ_ACCENT }}
                  aria-hidden
                >
                  <BookOpen size={13} strokeWidth={2} />
                </span>
                <h2 className="font-english text-[14px] font-[700] text-[var(--t1)]">
                  {book.bookTitle}
                </h2>
                {book.bookVLevel != null && (
                  <span className="rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg2)] px-2 py-0.5 font-mono text-[10px] font-[600] text-[var(--t3)]">
                    V{book.bookVLevel}
                  </span>
                )}
                <span className="font-body text-[12px] text-[var(--t3)]">·</span>
                <p className="font-mono text-[11px] text-[var(--t3)]">
                  {book.chapters.length}챕터 · {book.questionTotal}문항
                </p>
              </header>

              <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {book.chapters.map((ch) => {
                  const isActive =
                    selected?.bookId === book.bookId &&
                    selected?.chapterIdx === ch.chapterIdx
                  return (
                    <li key={ch.chapterIdx}>
                      <button
                        type="button"
                        onClick={() =>
                          setSelected({ bookId: book.bookId, chapterIdx: ch.chapterIdx })
                        }
                        aria-pressed={isActive}
                        className={`flex w-full items-center gap-3 rounded-[var(--r-md)] border p-3 text-left transition-all duration-[var(--dur-normal)] ${
                          isActive
                            ? 'border-[var(--active)] bg-[var(--warning-light)]'
                            : 'border-[var(--bd)] bg-[var(--bg)] hover:border-[var(--active)]/40'
                        }`}
                      >
                        <span
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-sm)] font-display text-[13px] font-[700]"
                          style={{
                            backgroundColor: `${QUIZ_ACCENT}15`,
                            color: QUIZ_ACCENT,
                          }}
                          aria-hidden
                        >
                          {ch.chapterIdx}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-english text-[13px] font-[600] text-[var(--t1)]">
                            {ch.chapterTitle}
                          </p>
                          <p className="font-mono text-[10px] text-[var(--t3)]">
                            {ch.questionCount}문제
                          </p>
                        </div>
                        <FileText
                          size={14}
                          className="shrink-0 text-[var(--t3)]"
                          aria-hidden
                        />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}

          {/* ── 3. 설정 & 시작 ── */}
          <HubStartCard
            title="설정 후 시작"
            description="영어 immersion 기본 — 어려우면 한국어 번역도 함께 보세요"
            choices={[]}
            extras={koToggle}
            cta={{
              label: '시작하기',
              href: ctaHref,
              accent: QUIZ_ACCENT,
              disabled: !selected,
              disabledReason: !selected ? '먼저 챕터를 선택해주세요' : undefined,
            }}
          />
        </>
      )}
    </div>
  )
}
