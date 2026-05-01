// apps/web/src/components/flashcard/CardBack.tsx

'use client'

import type { FlashcardWord } from '@/types/flashcard'
import { Volume2 } from 'lucide-react'

interface CardBackProps {
  word: FlashcardWord
  isExampleAudioPlaying: boolean
}

export function CardBack({ word, isExampleAudioPlaying }: CardBackProps) {
  return (
    <>
      <div className="mb-6 flex items-center justify-between opacity-50">
        <span className="font-body text-[10px] italic text-[var(--t3)]">{word.textTitle}에서</span>
      </div>

      <h3 className="mb-1.5 text-center font-english text-[22px] font-[600] text-[var(--t2)]">
        {word.text}
      </h3>

      <p className="mb-3 text-center font-mono text-[12px] text-[var(--t3)]">
        {word.pronunciation}
      </p>

      <div className="mx-auto mb-5 h-px w-8 bg-[var(--bd)]" aria-hidden="true" />

      <p className="text-center">
        <span className="inline-block rounded-[var(--r-full)] bg-[var(--p-light)] px-2.5 py-0.5 font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--p)]">
          {word.pos}
        </span>
      </p>

      <p className="mb-6 mt-4 text-center font-english text-[26px] font-[500] leading-[1.3] text-[var(--t1)]">
        {word.meaning}
      </p>

      {/* Example with audio indicator */}
      <div className="relative mt-auto rounded-[0_var(--r-md)_var(--r-md)_0] border-l-[3px] border-[var(--p)] bg-gradient-to-br from-[var(--p-light)] to-[var(--bg2)] p-4 font-english text-[14px] italic leading-relaxed text-[var(--t1)]">
        <span
          className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[var(--p)] px-2 py-[3px] font-display text-[9px] font-[700] uppercase tracking-[0.06em] text-white transition-opacity duration-[var(--dur-normal)] ${isExampleAudioPlaying ? 'opacity-100' : 'opacity-70'} `}
        >
          <Volume2
            size={9}
            strokeWidth={2}
            className={
              isExampleAudioPlaying ? 'animate-[audio-pulse_0.8s_ease-in-out_infinite]' : ''
            }
            aria-hidden="true"
          />
          <span>듣기</span>
        </span>

        <ExampleWithMark text={word.exampleSentence} target={word.text} />

        <span className="mt-2 block font-body text-[11px] not-italic text-[var(--t3)]">
          — {word.textTitle}, {word.textChapter}
        </span>
      </div>
    </>
  )
}

function ExampleWithMark({ text, target }: { text: string; target: string }) {
  const regex = new RegExp(`(${target})`, 'gi')
  const parts = text.split(regex)

  return (
    <>
      {parts.map((part, i) => {
        const isTarget = part.toLowerCase() === target.toLowerCase()
        if (isTarget) {
          return (
            <mark
              key={i}
              className="rounded-[2px] bg-[rgba(59,130,246,0.18)] px-0.5 font-[600] italic text-[var(--p)]"
            >
              {part}
            </mark>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
