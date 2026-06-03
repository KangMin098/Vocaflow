// apps/web/src/components/library/reader/ChapterContent.tsx
// LCP v2.0 Phase 12.5 — Reader 본문 패널
// paragraph 단위 렌더링 + 옵션 마커 + 옵션 sample words 하이라이트

import { type MouseEvent, type ReactNode } from 'react'
import type { ChapterContent, SampleWord } from '@/lib/library/reader-queries'

interface ChapterContentViewProps {
  content: ChapterContent
  showParagraphMarkers: boolean
  sampleWords: SampleWord[]
  /** 단어 클릭 시 호출 (word, 클릭한 단어의 viewport rect). 미지정 시 단어 비클릭. */
  onWordClick?: (word: string, rect: DOMRect) => void
}

export function ChapterContentView({
  content,
  showParagraphMarkers,
  sampleWords,
  onWordClick,
}: ChapterContentViewProps) {
  const paragraphs = splitByOffsets(content.content, content.paragraph_offsets)
  const sampleSet = new Set(sampleWords.map((w) => w.word.toLowerCase()))
  const clickable = !!onWordClick

  // 이벤트 위임 — 수천 단어에 핸들러 N개 대신 컨테이너 1개.
  const handleClick = (e: MouseEvent<HTMLDivElement>): void => {
    if (!onWordClick) return
    const el = (e.target as HTMLElement).closest('[data-word]') as HTMLElement | null
    if (!el) return
    const word = el.getAttribute('data-word')
    if (word) onWordClick(word, el.getBoundingClientRect())
  }

  return (
    <article
      className="mx-auto max-w-2xl px-8 py-10"
      role="article"
      aria-label={content.chapter_title ?? `Chapter ${content.chapter_idx}`}
    >
      <header className="mb-8 border-b border-[var(--bd)] pb-4">
        <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--t3)]">
          Chapter {content.chapter_idx}
        </span>
        {content.chapter_title && (
          <h1 className="mt-1 font-display text-[24px] font-[700] text-[var(--t1)]">
            {content.chapter_title}
          </h1>
        )}
        <span className="mt-2 inline-block font-mono text-[10px] text-[var(--t5)]">
          {content.word_count.toLocaleString()} 단어
        </span>
      </header>

      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        className="flex flex-col gap-4 font-serif text-[16px] leading-[1.75] text-[var(--t1)]"
        onClick={clickable ? handleClick : undefined}
      >
        {paragraphs.map((para, i) => (
          <Paragraph
            key={i}
            text={para}
            index={i + 1}
            showMarker={showParagraphMarkers}
            sampleSet={sampleSet}
            clickable={clickable}
          />
        ))}
      </div>

      {sampleWords.length > 0 && <SampleWordsLegend words={sampleWords} />}
    </article>
  )
}

// ─────────────────────────────────────────────
// Paragraph
// ─────────────────────────────────────────────

function Paragraph({
  text,
  index,
  showMarker,
  sampleSet,
  clickable,
}: {
  text: string
  index: number
  showMarker: boolean
  sampleSet: Set<string>
  clickable: boolean
}) {
  return (
    <div className="flex gap-3">
      {showMarker && (
        <span
          className="flex h-6 w-8 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-[var(--bg2)] font-mono text-[10px] tabular-nums text-[var(--t3)]"
          aria-label={`문단 ${index}`}
        >
          {index}
        </span>
      )}
      <p className="flex-1 whitespace-pre-wrap">{renderTokens(text, sampleSet, clickable)}</p>
    </div>
  )
}

// ─────────────────────────────────────────────
// Sample words legend (admin-review)
// ─────────────────────────────────────────────

function SampleWordsLegend({ words }: { words: SampleWord[] }) {
  return (
    <aside
      className="mt-10 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-5"
      aria-label="이 장의 핵심 어휘"
    >
      <h2 className="mb-3 font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]">
        ✦ LV 상위 10개 어휘 (학습 가치 순)
      </h2>
      <ul role="list" className="flex flex-col gap-2">
        {words.map((w) => (
          <li
            key={w.word}
            className="flex items-baseline gap-3 border-b border-[var(--bd)] pb-2 last:border-b-0 last:pb-0"
          >
            <span className="w-24 shrink-0 font-display text-[14px] font-[700] text-[var(--t1)]">
              {w.word}
            </span>
            {w.cefr_level && (
              <span className="font-mono text-[10px] text-[var(--t3)]">{w.cefr_level}</span>
            )}
            <span className="font-mono text-[10px] tabular-nums text-[var(--t3)]">
              LV {w.base_learning_value.toFixed(2)}
            </span>
            {w.first_sentence && (
              <span className="line-clamp-1 flex-1 font-serif text-[12px] italic text-[var(--t2)]">
                {w.first_sentence}
              </span>
            )}
          </li>
        ))}
      </ul>
    </aside>
  )
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function splitByOffsets(content: string, offsets: number[]): string[] {
  if (offsets.length === 0) return [content]
  const result: string[] = []
  for (let i = 0; i < offsets.length; i++) {
    const start = offsets[i]!
    const end = i + 1 < offsets.length ? offsets[i + 1]! : content.length
    result.push(content.slice(start, end).trim())
  }
  return result
}

/**
 * 본문을 단어/비단어 토큰으로 쪼개 렌더.
 * - 단어: clickable 이면 data-word + hover 인터랙션 (위임 핸들러가 클릭 처리).
 * - sample 단어: cefr 하이라이트.
 * - 비단어(공백·구두점)·비인터랙티브 일반어: 문자열 그대로 (span 남발 회피).
 */
function renderTokens(
  text: string,
  sampleSet: Set<string>,
  clickable: boolean
): ReactNode[] {
  const nodes: ReactNode[] = []
  const regex = /([A-Za-z][A-Za-z'’\-]*)|([^A-Za-z]+)/g
  let match: RegExpExecArray | null
  let key = 0
  while ((match = regex.exec(text)) !== null) {
    const word = match[1]
    if (word) {
      const isSample = sampleSet.has(word.toLowerCase())
      if (!clickable && !isSample) {
        nodes.push(word)
        key++
        continue
      }
      const highlightCls = isSample
        ? 'rounded-[2px] bg-[var(--cefr-C1-bg)] px-0.5 text-[var(--cefr-C1-text)]'
        : ''
      const interactiveCls = clickable
        ? 'cursor-pointer rounded-[2px] transition-colors duration-[var(--dur-fast)] hover:bg-[var(--p-light)] hover:text-[var(--p-dark)]'
        : ''
      nodes.push(
        <span
          key={key++}
          data-word={clickable ? word : undefined}
          className={[highlightCls, interactiveCls].filter(Boolean).join(' ') || undefined}
        >
          {word}
        </span>
      )
    } else {
      nodes.push(match[2])
      key++
    }
  }
  return nodes
}
