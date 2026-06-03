// apps/web/src/components/workspace/ReadingUniverse.tsx

'use client'

import type { Word } from '@/types/library'
import { Pause, Play } from 'lucide-react'
import { useRef, useState } from 'react'

interface SentencePart {
  text: string
  word?: Word
}

interface SentenceData {
  id: number
  parts: SentencePart[]
}

interface ParagraphData {
  id: number
  sentences: SentenceData[]
}

interface ChapterMeta {
  label: string
  /** 읽기 추정 분 (없으면 숨김) */
  readingMinutes?: number
  /** chapter 진행률 0~100 (없으면 숨김) */
  progressPercent?: number
}

interface ReadingUniverseProps {
  paragraphs: ParagraphData[]
  isFocusMode: boolean
  onWordHover: (word: Word, anchorRect: DOMRect) => void
  onSentencePlay: (sentenceId: number) => void
  playingSentenceId: number | null
  chapterMeta?: ChapterMeta
}

export function ReadingUniverse({
  paragraphs,
  isFocusMode,
  onWordHover,
  onSentencePlay,
  playingSentenceId,
  chapterMeta,
}: ReadingUniverseProps) {
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [activeWordId, setActiveWordId] = useState<string | null>(null)

  const handleWordEnter = (word: Word, e: React.MouseEvent<HTMLSpanElement>) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    const rect = e.currentTarget.getBoundingClientRect()
    hoverTimerRef.current = setTimeout(() => {
      setActiveWordId(word.id)
      onWordHover(word, rect)
    }, 250)
  }

  const handleWordLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
  }

  // 첫 paragraph 에만 drop-cap 적용 — `first-of-type` 가 아닌 명시적 인덱스 (TOC strip 회귀 회피)
  return (
    <article className="relative mx-auto max-w-[680px] px-6 py-4 md:px-8 md:py-6">
      {/* Chapter Meta — kicker line */}
      {chapterMeta && (
        <header
          className={`mb-10 flex items-center gap-3 transition-opacity duration-[var(--dur-slower)] ${
            isFocusMode ? 'opacity-30' : 'opacity-100'
          } `}
        >
          <span className="font-display text-[11px] font-[700] uppercase tracking-[0.12em] text-[var(--t2)]">
            {chapterMeta.label}
          </span>
          <span className="h-px flex-1 bg-gradient-to-r from-[var(--bd)] via-[var(--bd)] to-transparent" />
          {typeof chapterMeta.readingMinutes === 'number' && chapterMeta.readingMinutes > 0 && (
            <span className="font-body text-[11.5px] italic text-[var(--t3)]">
              약 {chapterMeta.readingMinutes}분 읽기
            </span>
          )}
        </header>
      )}

      {/* Reading Text */}
      <div
        className="reading-prose font-english text-[var(--reading-text)]"
        style={{
          fontSize: 'var(--reader-font-size)',
          lineHeight: 'var(--reader-line-height)',
          letterSpacing: '0.003em',
          fontFeatureSettings: '"liga" 1, "kern" 1, "onum" 1',
          textRendering: 'optimizeLegibility',
          transition: 'font-size 200ms, line-height 200ms',
        }}
      >
        {paragraphs.map((p, pIdx) => (
          <p
            key={p.id}
            className={`group/paragraph relative mb-7 md:mb-8 ${
              pIdx === 0
                ? '[&::first-letter]:float-left [&::first-letter]:mr-2.5 [&::first-letter]:mt-1.5 [&::first-letter]:font-english [&::first-letter]:text-[3.2em] [&::first-letter]:font-[700] [&::first-letter]:leading-[0.9] [&::first-letter]:text-[var(--p)]'
                : ''
            } `}
          >
            {p.sentences.map((s, sIdx) => {
              const isPlaying = playingSentenceId === s.id
              return (
                <span
                  key={s.id}
                  className={`group/sentence relative inline transition-colors duration-[var(--dur-normal)] ${
                    isPlaying
                      ? 'rounded-[3px] bg-[rgba(250,204,21,0.22)] shadow-[inset_0_-1px_0_rgba(234,179,8,0.28)] dark:bg-[rgba(250,204,21,0.16)]'
                      : ''
                  } `}
                >
                  {/* Play affordance — 항상 보이는 4px 도트, hover/playing 시 풀 버튼으로 확장 */}
                  <button
                    type="button"
                    onClick={() => onSentencePlay(s.id)}
                    aria-label={`문장 ${s.id + 1} 듣기`}
                    aria-pressed={isPlaying}
                    className={`mr-1 inline-flex h-[18px] w-[18px] -translate-y-px items-center justify-center rounded-full align-middle transition-all duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--reading-bg)] ${
                      isPlaying
                        ? 'animate-[playing-ring_1.6s_ease-in-out_infinite] bg-[var(--p)] text-white'
                        : 'bg-[var(--bd)]/55 text-transparent hover:scale-110 hover:bg-[var(--p)] hover:text-white group-hover/sentence:bg-[var(--t4)]/85 group-hover/paragraph:bg-[var(--t4)]/55'
                    } `}
                  >
                    {isPlaying ? (
                      <Pause size={9} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                    ) : (
                      <Play size={9} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                    )}
                  </button>

                  {/* Sentence content */}
                  {s.parts.map((part, partIdx) => {
                    if (!part.word) {
                      return <span key={partIdx}>{part.text}</span>
                    }
                    const word = part.word
                    const isActive = activeWordId === word.id

                    const statusClass = (() => {
                      if (isActive) {
                        return 'rounded-[var(--r-sm)] bg-[var(--p)] px-1 py-px font-[500] text-white'
                      }
                      switch (word.status) {
                        case 'stable':
                          return 'border-b border-[rgba(34,197,94,0.38)] hover:border-[rgba(34,197,94,0.7)]'
                        case 'shaky':
                          return 'border-b-[1.5px] border-dashed border-[rgba(245,158,11,0.65)]'
                        case 'risk':
                          return 'animate-[word-pulse_4s_ease-in-out_infinite] border-b-[1.5px] border-dashed border-[rgba(239,68,68,0.72)]'
                        case 'new':
                          return 'bg-gradient-to-b from-transparent from-[62%] to-[rgba(59,130,246,0.18)] to-[62%]'
                        default:
                          return ''
                      }
                    })()

                    return (
                      <span
                        key={partIdx}
                        data-word={word.id}
                        className={`relative cursor-help transition-colors duration-[var(--dur-fast)] hover:bg-[rgba(59,130,246,0.10)] ${statusClass} `}
                        onMouseEnter={(e) => handleWordEnter(word, e)}
                        onMouseLeave={handleWordLeave}
                        onClick={(e) => handleWordEnter(word, e)}
                      >
                        {word.text}
                      </span>
                    )
                  })}
                  {sIdx < p.sentences.length - 1 && ' '}
                </span>
              )
            })}
          </p>
        ))}
      </div>
    </article>
  )
}
