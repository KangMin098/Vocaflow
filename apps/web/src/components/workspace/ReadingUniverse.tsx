// apps/web/src/components/workspace/ReadingUniverse.tsx

'use client'

import type { Word } from '@/types/library'
import type { SupportToken } from '@/lib/workspace/support'
import { Pause, Play } from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'

interface SentencePart {
  text: string
  word?: Word
  support?: SupportToken
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
  /** v06.53 — 그림책 페이지별 삽화 (StoryWeaver 등). idx = 문단 인덱스, 해당 문단 위에 렌더. */
  illustrations?: Array<{ idx: number; url: string; alt?: string }> | null
  isFocusMode: boolean
  onWordHover: (word: Word, anchorRect: DOMRect) => void
  onSentencePlay: (sentenceId: number) => void
  playingSentenceId: number | null
  chapterMeta?: ChapterMeta
  /** 읽기-중 이해 지원 토큰 탭 — RecallCard 와 분리된 수동 gloss */
  onSupportTap?: (support: SupportToken, anchorRect: DOMRect) => void
  /** 학습 대상·노이즈가 아닌 평범한 단어 클릭 — 사전 lookup (WordLookupPopover) */
  onWordLookup?: (surface: string, anchorRect: DOMRect) => void
  /** 지원 토큰 표시 여부 (레벨 적응형 — 기본 표시) */
  showSupport?: boolean
}

// 평범한 단어(학습 대상·노이즈 아님)를 data-lookup 스팬으로 토큰화.
// 비단어(공백·구두점)는 문자열 그대로 — span 남발 회피 (ChapterContent.renderTokens 정책).
// 클릭은 컨테이너 위임 핸들러가 처리.
function renderLookupTokens(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const regex = /([A-Za-z][A-Za-z'’\-]*)|([^A-Za-z]+)/g
  let m: RegExpExecArray | null
  let key = 0
  while ((m = regex.exec(text)) !== null) {
    const word = m[1]
    if (word) {
      nodes.push(
        <span
          key={key++}
          data-lookup={word}
          className="cursor-pointer rounded-[2px] transition-colors duration-[var(--dur-fast)] hover:bg-[rgba(59,130,246,0.08)]"
        >
          {word}
        </span>,
      )
    } else {
      nodes.push(m[2])
      key++
    }
  }
  return nodes
}

export function ReadingUniverse({
  paragraphs,
  illustrations,
  isFocusMode,
  onWordHover,
  onSentencePlay,
  playingSentenceId,
  chapterMeta,
  onSupportTap,
  onWordLookup,
  showSupport = true,
}: ReadingUniverseProps) {
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [activeWordId, setActiveWordId] = useState<string | null>(null)

  // 재생 중 문장 자동 추적 — 화면 밖으로 벗어나면 부드럽게 중앙으로 스크롤.
  // (브라우저 TTS·LibriVox 공통 — playingSentenceId 변화 시)
  const playingRef = useRef<HTMLSpanElement | null>(null)
  useEffect(() => {
    if (playingSentenceId == null) return
    const el = playingRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vh = window.innerHeight || document.documentElement.clientHeight
    // 편안한 독서 밴드(16%~80%) 밖일 때만 스크롤 — 문장마다 흔들림 방지
    if (rect.top < vh * 0.16 || rect.bottom > vh * 0.8) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [playingSentenceId])

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

  // 평범한 단어 클릭 위임 — data-lookup 스팬 1개당 핸들러 대신 컨테이너 1개 (ChapterContent 패턴).
  // 학습 단어(data-word)·노이즈(data-support)는 자체 핸들러가 처리하므로 여기선 무시됨.
  const handleLookupClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onWordLookup) return
    const el = (e.target as HTMLElement).closest('[data-lookup]') as HTMLElement | null
    if (!el) return
    const surface = el.getAttribute('data-lookup')
    if (surface) onWordLookup(surface, el.getBoundingClientRect())
  }

  // v06.53 — 그림책 삽화 idx→url 맵 (해당 문단 위에 렌더). StoryWeaver 등.
  const illusByIdx = new Map<number, { url: string; alt?: string }>()
  for (const it of illustrations ?? []) {
    if (it && typeof it.idx === 'number' && typeof it.url === 'string') {
      illusByIdx.set(it.idx, { url: it.url, ...(it.alt ? { alt: it.alt } : {}) })
    }
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
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        className="reading-prose font-english text-[var(--reading-text)]"
        onClick={onWordLookup ? handleLookupClick : undefined}
        style={{
          fontSize: 'var(--reader-font-size)',
          lineHeight: 'var(--reader-line-height)',
          letterSpacing: '0.003em',
          fontFeatureSettings: '"liga" 1, "kern" 1, "onum" 1',
          textRendering: 'optimizeLegibility',
          transition: 'font-size 200ms, line-height 200ms',
        }}
      >
        {paragraphs.map((p, pIdx) => {
          const illus = illusByIdx.get(pIdx)
          return (
          <Fragment key={p.id}>
          {illus && (
            <figure
              className={`mb-5 overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] shadow-[var(--sh-sm)] transition-opacity duration-[var(--dur-slower)] ${
                isFocusMode ? 'opacity-40' : 'opacity-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={illus.url}
                alt={illus.alt ?? ''}
                loading="lazy"
                className="mx-auto block h-auto w-full max-w-[560px] object-contain"
              />
            </figure>
          )}
          <p
            className={`group/paragraph relative mb-7 whitespace-pre-line md:mb-8 ${
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
                  ref={isPlaying ? playingRef : undefined}
                  className="group/sentence relative inline rounded-[5px] [-webkit-box-decoration-break:clone] [box-decoration-break:clone] transition-colors duration-[var(--dur-slow)] ease-[var(--ease)]"
                  style={
                    isPlaying ? { backgroundColor: 'rgba(99,102,241,0.14)' } : undefined
                  }
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
                    // 읽기-중 이해 지원 토큰 — 저채도 점선, 탭 시 수동 gloss (학습 단어 아님)
                    if (part.support) {
                      if (!showSupport) return <span key={partIdx}>{part.text}</span>
                      const sup = part.support
                      return (
                        <span
                          key={partIdx}
                          data-support={sup.category}
                          role="button"
                          tabIndex={0}
                          aria-label={`${part.text} — 도움말 보기`}
                          className="cursor-help border-b border-dotted border-[var(--t3)]/55 text-[var(--t2)] underline-offset-[3px] transition-colors duration-[var(--dur-fast)] hover:border-[var(--t2)] hover:bg-[var(--bg3)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--t3)]"
                          onClick={(e) => onSupportTap?.(sup, e.currentTarget.getBoundingClientRect())}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              onSupportTap?.(sup, (e.currentTarget as HTMLElement).getBoundingClientRect())
                            }
                          }}
                        >
                          {part.text}
                        </span>
                      )
                    }
                    if (!part.word) {
                      // 학습 대상·노이즈 아님 — 클릭 시 사전 lookup (data-lookup, 위임 핸들러 처리)
                      if (!onWordLookup) return <span key={partIdx}>{part.text}</span>
                      return <span key={partIdx}>{renderLookupTokens(part.text)}</span>
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
          </Fragment>
          )
        })}
      </div>
    </article>
  )
}
