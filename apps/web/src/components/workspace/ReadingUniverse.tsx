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

interface ReadingUniverseProps {
  paragraphs: ParagraphData[]
  isFocusMode: boolean
  onWordHover: (word: Word, anchorRect: DOMRect) => void
  onSentencePlay: (sentenceId: number) => void
  playingSentenceId: number | null
}

export function ReadingUniverse({
  paragraphs,
  isFocusMode,
  onWordHover,
  onSentencePlay,
  playingSentenceId,
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

  return (
    <article className="relative mx-auto max-w-[760px] px-8 py-16">
      {/* Reading Meta */}
      <div
        className={`mb-8 flex items-center gap-3 font-display text-[11px] font-[600] tracking-[0.04em] text-[var(--t3)] transition-opacity duration-[var(--dur-slower)] ${isFocusMode ? 'opacity-40' : 'opacity-100'} `}
      >
        <span>Chapter One · Page 3</span>
        <span className="h-px flex-1 bg-gradient-to-r from-[var(--bd)] to-transparent" />
        <span className="italic">5분 정도의 읽기</span>
      </div>

      {/* Reading Text */}
      <div
        className="font-english text-[var(--reading-text)] [&_p:first-of-type::first-letter]:float-left [&_p:first-of-type::first-letter]:mr-2 [&_p:first-of-type::first-letter]:mt-1.5 [&_p:first-of-type::first-letter]:font-english [&_p:first-of-type::first-letter]:text-[3em] [&_p:first-of-type::first-letter]:font-[600] [&_p:first-of-type::first-letter]:leading-[0.9] [&_p:first-of-type::first-letter]:text-[var(--p)]"
        style={{
          fontSize: 'var(--reader-font-size)',
          lineHeight: 'var(--reader-line-height)',
          letterSpacing: '0.005em',
          fontFeatureSettings: '"liga" 1, "kern" 1',
          transition: 'font-size 200ms, line-height 200ms',
        }}
      >
        {paragraphs.map((p) => (
          <p key={p.id} className="group/paragraph mb-7">
            {p.sentences.map((s, sIdx) => {
              const isPlaying = playingSentenceId === s.id
              return (
                <span key={s.id}>
                  {/* Play Button */}
                  <button
                    onClick={() => onSentencePlay(s.id)}
                    aria-label={`문장 ${s.id + 1} 듣기`}
                    aria-pressed={isPlaying}
                    className={`mr-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--bd)] bg-[var(--bg)] align-middle transition-all duration-[var(--dur-normal)] ${
                      isPlaying
                        ? 'animate-[playing-ring_1.5s_ease-in-out_infinite] border-[var(--p)] bg-[var(--p)] text-white opacity-100'
                        : 'text-[var(--t3)] opacity-0 hover:scale-110 hover:border-[var(--p)] hover:bg-[var(--p)] hover:text-white group-hover/paragraph:opacity-100'
                    } `}
                  >
                    {isPlaying ? (
                      <Pause size={10} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                    ) : (
                      <Play size={10} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                    )}
                  </button>

                  {/* Sentence Content */}
                  <span
                    className={`inline transition-all duration-[var(--dur-normal)] ${
                      isPlaying
                        ? 'rounded-sm bg-gradient-to-b from-transparent from-[70%] to-[rgba(59,130,246,0.12)] to-[70%]'
                        : ''
                    } `}
                  >
                    {s.parts.map((part, pIdx) => {
                      if (!part.word) {
                        return <span key={pIdx}>{part.text}</span>
                      }
                      const word = part.word
                      const isActive = activeWordId === word.id

                      const statusClass = (() => {
                        if (isActive) {
                          return 'rounded-[var(--r-sm)] bg-[var(--p)] px-1.5 py-px font-medium text-white'
                        }
                        switch (word.status) {
                          case 'stable':
                            return 'border-b border-[rgba(34,197,94,0.35)]'
                          case 'shaky':
                            return 'border-b-[1.5px] border-dashed border-[rgba(245,158,11,0.6)]'
                          case 'risk':
                            return 'animate-[word-pulse_4s_ease-in-out_infinite] border-b-[1.5px] border-dashed border-[rgba(239,68,68,0.7)]'
                          case 'new':
                            return 'bg-gradient-to-b from-transparent from-[65%] to-[rgba(59,130,246,0.16)] to-[65%]'
                          default:
                            return ''
                        }
                      })()

                      return (
                        <span
                          key={pIdx}
                          data-word={word.id}
                          className={`relative cursor-pointer transition-all duration-[var(--dur-fast)] hover:bg-[rgba(59,130,246,0.08)] ${statusClass} `}
                          onMouseEnter={(e) => handleWordEnter(word, e)}
                          onMouseLeave={handleWordLeave}
                          onClick={(e) => handleWordEnter(word, e)}
                        >
                          {word.text}
                        </span>
                      )
                    })}
                  </span>
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
