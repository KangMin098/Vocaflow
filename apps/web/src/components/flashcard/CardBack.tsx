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
        <span className="font-body text-[10px] italic text-[var(--t2)]">{word.textTitle}에서</span>
      </div>

      <h3 className="mb-1.5 text-center font-english text-[22px] font-[600] text-[var(--t2)]">
        {word.text}
      </h3>

      <p className="mb-3 text-center font-mono text-[12px] text-[var(--t2)]">
        {word.pronunciation}
      </p>

      <div className="mx-auto mb-5 h-px w-8 bg-[var(--bd)]" aria-hidden="true" />

      <p className="text-center">
        <span className="inline-block rounded-[var(--r-full)] bg-[var(--p-light)] px-3 py-1 font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--on-p-tint)]">
          {word.pos}
        </span>
      </p>

      <p className="mb-6 mt-4 text-center font-english text-[26px] font-[500] leading-[1.3] text-[var(--t1)]">
        {word.meaning}
      </p>

      {/* 품사별 여러 뜻 — 다의어일 때만(≥2 sense). 시중 단어장 대비 다의어 한눈에.
          per-sense meanings_ko(Phase B 100%) 노출. 단일 sense면 flat meaning 으로 충분(미표시). */}
      {word.senses && word.senses.length >= 2 && (
        <div className="mb-5 flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3">
          <span className="mb-0.5 font-body text-[10px] uppercase tracking-[0.08em] text-[var(--t2)]">
            품사별 뜻
          </span>
          {word.senses.map((s, i) => (
            <div key={`${s.pos}-${i}`} className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                {s.pos && (
                  <span className="shrink-0 rounded-[var(--r-full)] bg-[var(--bg3)] px-2 py-px font-mono text-[10px] font-[700] text-[var(--t2)]">
                    {posLabel(s.pos)}
                  </span>
                )}
                <span className="font-body text-[14px] leading-snug text-[var(--t1)]">
                  {s.meaning}
                </span>
              </div>

              {/* 뜻마다 붙는 문장 — 뜻 목록만으로는 갈라지지 않는다. 그 뜻으로만 읽히는 문장이
                  변별을 만든다(Context-Dependent). 해석은 있을 때만 — 없는 예문은 건너뛰게 된다. */}
              {s.example && (
                <p className="border-l border-[var(--bd)] pl-3 font-english text-[12px] italic leading-relaxed text-[var(--t2)]">
                  {s.example}
                  {s.exampleKo && (
                    <span className="mt-0.5 block font-body text-[11px] not-italic text-[var(--t3,var(--t2))]">
                      {s.exampleKo}
                    </span>
                  )}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Example with audio indicator */}
      <div className="relative mt-auto rounded-[0_var(--r-md)_var(--r-md)_0] border-l-[3px] border-[var(--p)] bg-gradient-to-br from-[var(--p-light)] to-[var(--bg2)] p-4 font-english text-[14px] italic leading-relaxed text-[var(--t1)]">
        <span
          className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[var(--p)] px-2 py-[4px] font-display text-[9px] font-[700] uppercase tracking-[0.06em] text-white transition-opacity duration-[var(--dur-normal)] ${isExampleAudioPlaying ? 'opacity-100' : 'opacity-70'} `}
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

        {/* 예문 해석 — 국내 교재는 예문마다 해석을 단다. 해석 없는 예문은 학습자가 건너뛴다.
            없으면 표시하지 않는다(빈 줄이 카드를 흔들지 않게). */}
        {word.exampleTranslation && (
          <span className="mt-2 block font-body text-[12px] not-italic leading-relaxed text-[var(--t2)]">
            {word.exampleTranslation}
          </span>
        )}

        <span className="mt-2 block font-body text-[11px] not-italic text-[var(--t2)]">
          — {word.textTitle}, {word.textChapter}
        </span>
      </div>

      {/* 자주 함께 쓰는 표현 — 데이터 있을 때만 절제 노출(Progressive Disclosure).
          정답면 하단, 예문 보조 톤. 학습 중 자극 최소화(Calm UI) — 최대 3개. */}
      {word.collocations && word.collocations.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-body text-[10px] uppercase tracking-[0.08em] text-[var(--t2)]">
            함께 쓰는 표현
          </span>
          {word.collocations.slice(0, 3).map((c) => (
            <span
              key={c}
              className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-1 font-english text-[12px] text-[var(--t2)]"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {/* 어원 힌트 — 어근 분해(word_root_links). 시중 어원단어장 대비 학습 중 노출.
          prefix→root→suffix 순 chip. 데이터 있을 때만(Progressive Disclosure). */}
      {word.roots && word.roots.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-body text-[10px] uppercase tracking-[0.08em] text-[var(--t2)]">
            어원
          </span>
          {word.roots.map((r, i) => (
            <span key={`${r.root}-${i}`} className="inline-flex items-center gap-2">
              {i > 0 && <span className="text-[11px] text-[var(--t2)]">+</span>}
              <span className="rounded-[var(--r-full)] bg-[var(--active-light)] px-2 py-1 text-[12px]">
                <span className="font-english font-[700] text-[var(--active-ink)]">{r.root}</span>
                <span className="font-body text-[var(--t2)]"> {r.gloss}</span>
              </span>
            </span>
          ))}
        </div>
      )}

      {/* 어근 기반 니모닉 — "어떻게 기억할까"의 다리. 데이터 있을 때만(Progressive Disclosure).
          Empathetic Feedback: 압박 없는 기억 힌트. Lora italic 사람 말투 톤. */}
      {word.mnemonic && (
        <p className="mt-2.5 flex items-start gap-2 font-body text-[12.5px] italic leading-relaxed text-[var(--t2)]">
          <span className="not-italic" aria-hidden="true">
            💡
          </span>
          <span>{word.mnemonic}</span>
        </p>
      )}
    </>
  )
}

/** 품사 → 한국 학습자 약어(명·동·형·부). 미지 품사는 원문 유지. */
function posLabel(pos: string): string {
  const p = pos.toLowerCase()
  if (p.startsWith('noun') || p === 'n') return '명'
  if (p.startsWith('verb') || p === 'v') return '동'
  if (p.startsWith('adject') || p === 'adj') return '형'
  if (p.startsWith('adverb') || p === 'adv') return '부'
  return pos
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
