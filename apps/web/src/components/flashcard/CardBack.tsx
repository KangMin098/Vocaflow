// apps/web/src/components/flashcard/CardBack.tsx

'use client'

import type { FlashcardWord } from '@/types/flashcard'
import { Volume2 } from 'lucide-react'
import { matchSurface } from '@/lib/text/surface-match'
import { ZoomableImage } from '@/components/ui/ZoomableImage'

interface CardBackProps {
  word: FlashcardWord
  isExampleAudioPlaying: boolean
}

export function CardBack({ word, isExampleAudioPlaying }: CardBackProps) {
  return (
    <>
      {/* 그림책 삽화 — Dual Coding(Paivio): 정답 공개 시 단어+의미+장면 동시 부호화 */}
      {word.illustrationUrl && (
        <div className="-mx-8 -mt-8 mb-4 overflow-hidden border-b border-[var(--bd)]">
          <ZoomableImage
            src={word.illustrationUrl}
            alt={word.text}
            className="block h-24 w-full object-cover"
          />
        </div>
      )}

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

        <ExampleWithMark
          text={word.exampleSentence}
          target={word.text}
          forms={word.inflectedForms}
        />

        <span className="mt-2 block font-body text-[11px] not-italic text-[var(--t3)]">
          — {word.textTitle}, {word.textChapter}
        </span>
      </div>

      {/* 자주 함께 쓰는 표현 — 데이터 있을 때만 절제 노출(Progressive Disclosure).
          정답면 하단, 예문 보조 톤. 학습 중 자극 최소화(Calm UI) — 최대 3개. */}
      {word.collocations && word.collocations.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-body text-[10px] uppercase tracking-[0.08em] text-[var(--t3)]">
            함께 쓰는 표현
          </span>
          {word.collocations.slice(0, 3).map((c) => (
            <span
              key={c}
              className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-english text-[12px] text-[var(--t2)]"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </>
  )
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function ExampleWithMark({
  text,
  target,
  forms,
}: {
  text: string
  target: string
  forms?: string[]
}) {
  if (!text || !target) return <>{text}</>
  // 예문이 원문 문장(굴절형 포함)이므로 lemma 가 아니라 실제 표면형(running·was·went 등)을 찾아 하이라이트.
  // 사전 DB inflected_forms(forms) 우선 → 불규칙까지 정확. 못 찾으면 lemma whole-word 폴백.
  const surface = matchSurface(text, target, forms)?.surface ?? target
  const regex = new RegExp(`\\b(${escapeRegExp(surface)})\\b`, 'gi')
  const parts = text.split(regex)
  const surfaceLc = surface.toLowerCase()

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === surfaceLc ? (
          <mark
            key={i}
            className="rounded-[3px] bg-[var(--active-light)] px-1 font-[700] not-italic text-[var(--t1)]"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}
