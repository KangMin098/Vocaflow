// apps/web/src/components/library/shared/NetflixDetailSheet.tsx
//
// v06.33 — Netflix 스타일 컨텐츠 상세 sheet.
// /library/books · /library/vocab · /text 공통 — 카드 선택 시 부드러운 scale-in 모달.
//
// 뇌과학·가독성 정합:
//   - F-pattern: 좌상단 cover → 좌측 메타 → 하단 CTA
//   - 시각 위계: 제목 28-32px → 메타 11-13px → 설명 14px → sample 12px
//   - Calm UI: dim overlay 80% + soft 카드 그림자 + 모션 spring-like
//   - 즉시 종료: Esc + overlay 클릭 + ✕ 버튼
//   - 인지 부하 최소: 한 화면 결정 1개 (Primary CTA)

'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { X, Clock, BookOpen, Layers, Sparkles, Volume2 } from 'lucide-react'

import { bookCover } from '@/lib/library/book-cover'

export interface SampleWord {
  word: string
  meaningKo: string
  partOfSpeech?: string | null
  cefrLevel?: string | null
}

interface BookVariant {
  type: 'book'
  id: string
  title: string
  author?: string | null
  cefrBand?: string | null
  cefrLevel?: string | null
  bookVLevel?: number | null
  cefrjLevel?: string | null
  lexile?: number | null
  fleschKincaid?: number | null
  wordCount?: number | null
  chapterCount?: number | null
  readingMinutes?: number | null
  wordSetCount?: number | null
  progressPercent?: number | null
  coverFrom?: string | null
  coverTo?: string | null
  ctaHref: string
  ctaLabel: string
  // v06.34 — 큐레이션 메타 (선택 의사결정 보조)
  synopsisKo?: string | null
  learningValue?: string | null
  themes?: string[] | null
  estBasis?: string | null
  estCefr?: string | null
  ageBand?: string | null
  genreNorm?: string | null
  descriptionEn?: string | null
}

interface ScriptVariant {
  type: 'script'
  id: string
  title: string
  author?: string | null
  category: string
  cefrLevel?: string | null
  wordCount?: number | null
  progressPercent?: number | null
  preview?: string | null
  coverFrom: string
  coverTo: string
  ctaHref: string
  ctaLabel: string
}

interface VocabVariant {
  type: 'vocab'
  id: string
  title: string
  description?: string | null
  category: string
  categoryLabel: string
  categoryColor: { from: string; to: string; accent: string }
  cefrLevel?: string | null
  wordCount: number
  coverEmoji?: string | null
  samples?: SampleWord[]
  ctaHref?: string
  ctaLabel: string
  onCtaClick?: () => void
  ctaPending?: boolean
  secondaryHref?: string
  secondaryLabel?: string
}

export type DetailVariant = BookVariant | ScriptVariant | VocabVariant

interface Props {
  variant: DetailVariant | null
  onClose: () => void
}

export function NetflixDetailSheet({ variant, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Esc 닫기 + body scroll lock
  useEffect(() => {
    if (!variant) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Stale-safe: 항상 빈 문자열로 복구 (prevOverflow 누적 차단)
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [variant, onClose])

  // 컴포넌트 unmount (라우트 변경 등) 시 강제 cleanup 보장
  useEffect(() => {
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  if (!variant) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={variant.title}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 md:p-10"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.92) 100%)',
        backdropFilter: 'blur(12px)',
        animation: 'sheet-fade 220ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--r-2xl)] bg-[var(--bg)] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.5)] focus:outline-none"
        style={{
          animation: 'sheet-pop 320ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-3 z-[2] flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-all hover:scale-110 hover:bg-black/70"
        >
          <X size={16} strokeWidth={2.5} aria-hidden />
        </button>

        {/* Hero — variant 별 cover */}
        <Hero variant={variant} />

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 md:px-8 md:py-6">
          {variant.type === 'book' && <BookBody v={variant} />}
          {variant.type === 'script' && <ScriptBody v={variant} />}
          {variant.type === 'vocab' && <VocabBody v={variant} />}
        </div>

        {/* CTA footer */}
        <Footer variant={variant} onClose={onClose} />
      </div>

      <style jsx global>{`
        @keyframes sheet-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes sheet-pop {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ─── Hero ────────────────────────────────────────────────
function Hero({ variant }: { variant: DetailVariant }) {
  // gradient 결정
  let from = '#3B82F6'
  let to = '#1D4ED8'
  if (variant.type === 'book') {
    const c = bookCover({
      title: variant.title,
      bookVLevel: variant.bookVLevel ?? null,
      coverFrom: variant.coverFrom,
      coverTo: variant.coverTo,
    })
    from = c.from
    to = c.to
  } else if (variant.type === 'script') {
    from = variant.coverFrom
    to = variant.coverTo
  } else {
    from = variant.categoryColor.from
    to = variant.categoryColor.to
  }

  return (
    <div
      className="relative h-[200px] shrink-0 overflow-hidden md:h-[240px]"
      style={{
        // Calm UI — sheen 보강 (22%→28%) + 추가 white veil 12% 로 풀-saturate 톤다운
        // bottom black (40%) 도 24% 로 완화 (vignette 약화)
        background: `
          linear-gradient(rgba(255,255,255,0.12), rgba(255,255,255,0.12)),
          radial-gradient(120% 80% at 20% 10%, rgba(255,255,255,0.28) 0%, transparent 55%),
          linear-gradient(155deg, ${from} 0%, ${to} 75%, rgba(0,0,0,0.24) 100%)
        `,
      }}
    >
      {/* sheen + grain */}
      <div aria-hidden className="book-cover-sheen absolute inset-0" />
      <div aria-hidden className="book-cover-grain absolute inset-0" />

      {/* bottom fade to bg */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-[var(--bg)]"
      />

      {/* 좌상단 카테고리/타입 */}
      <div className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-[var(--r-full)] bg-black/40 px-3 py-1 font-display text-[10px] font-[700] uppercase tracking-wider text-white backdrop-blur-md md:left-7 md:top-7">
        {variant.type === 'book' && (
          <>
            <BookOpen size={11} aria-hidden /> 도서
          </>
        )}
        {variant.type === 'script' && (
          <>
            <BookOpen size={11} aria-hidden /> {variant.category}
          </>
        )}
        {variant.type === 'vocab' && (
          <>
            <Layers size={11} aria-hidden /> {variant.categoryLabel}
          </>
        )}
      </div>

      {/* 우상단 emoji (vocab) */}
      {variant.type === 'vocab' && variant.coverEmoji && (
        <span
          aria-hidden
          className="absolute right-16 top-5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-[22px] leading-none backdrop-blur-sm md:right-20 md:top-7"
        >
          {variant.coverEmoji}
        </span>
      )}

      {/* 제목 + 저자 (좌하단) */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 px-6 pb-5 text-white md:px-8 md:pb-6">
        <h2
          className={`line-clamp-2 font-display font-[800] leading-[1.1] tracking-[-0.015em] drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)] ${
            variant.type === 'book'
              ? 'font-english text-[26px] md:text-[32px]'
              : 'text-[24px] md:text-[28px]'
          }`}
        >
          {variant.title}
        </h2>
        {((variant.type === 'book' || variant.type === 'script') && variant.author) && (
          <p className="font-body text-[13px] font-[500] text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
            {variant.author}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── BookBody ────────────────────────────────────────────
function BookBody({ v }: { v: BookVariant }) {
  return (
    <div className="flex flex-col gap-5">
      {/* 4축 난이도 + 분량 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="CEFR" value={v.cefrBand ?? v.cefrLevel ?? '—'} />
        <Stat
          label="V-Level"
          value={v.bookVLevel != null ? `V${v.bookVLevel}` : '—'}
          sub="한국 학습자"
        />
        <Stat label="CEFR-J" value={v.cefrjLevel ?? '—'} sub="외부 표준" />
        <Stat
          label="F-K Grade"
          value={v.fleschKincaid != null ? v.fleschKincaid.toFixed(1) : '—'}
          sub="통사 복잡도"
        />
      </div>

      {/* 분량 */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3">
        {v.chapterCount != null && (
          <MetaItem
            icon={<BookOpen size={12} aria-hidden />}
            label="챕터"
            value={v.chapterCount.toLocaleString()}
          />
        )}
        {v.wordCount != null && (
          <MetaItem label="단어" value={v.wordCount.toLocaleString()} />
        )}
        {v.readingMinutes != null && v.readingMinutes > 0 && (
          <MetaItem
            icon={<Clock size={12} aria-hidden />}
            label="읽기"
            value={`약 ${Math.round(v.readingMinutes / 60)}시간`}
          />
        )}
        {v.lexile != null && <MetaItem label="Lexile" value={`${v.lexile}L`} />}
        {v.wordSetCount != null && v.wordSetCount > 0 && (
          <MetaItem
            icon={<Sparkles size={12} aria-hidden />}
            label="단어장"
            value={`${v.wordSetCount}개`}
          />
        )}
      </div>

      {v.progressPercent != null && v.progressPercent > 0 && (
        <ProgressRow percent={v.progressPercent} accent="#7C3AED" />
      )}

      {/* v06.34 — 큐레이션 메타: 선택 의사결정 보조 */}
      {v.synopsisKo && (
        <Section title="줄거리">
          <p className="font-body text-[13px] leading-[1.65] text-[var(--t1)]">
            {v.synopsisKo}
          </p>
        </Section>
      )}

      {v.learningValue && (
        <Section title="학습자에게 주는 가치">
          <p className="font-body text-[13px] leading-[1.65] text-[var(--t2)]">
            {v.learningValue}
          </p>
        </Section>
      )}

      {v.themes && v.themes.length > 0 && (
        <Section title="테마">
          <div className="flex flex-wrap gap-1.5">
            {v.themes.map((th, i) => (
              <span
                key={`${th}-${i}`}
                className="inline-flex items-center rounded-[var(--r-full)] bg-[var(--p-light)] px-2.5 py-1 font-mono text-[11px] font-[600] text-[var(--p-dark)]"
              >
                {th}
              </span>
            ))}
          </div>
        </Section>
      )}

      {(v.ageBand || v.genreNorm || v.estCefr) && (
        <Section title="큐레이터 추정">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
            {v.genreNorm && (
              <span>
                <strong className="font-display font-[700] text-[var(--t1)]">유형</strong>{' '}
                <span className="text-[var(--t2)]">{v.genreNorm}</span>
              </span>
            )}
            {v.ageBand && (
              <span>
                <strong className="font-display font-[700] text-[var(--t1)]">연령</strong>{' '}
                <span className="text-[var(--t2)]">{v.ageBand}</span>
              </span>
            )}
            {v.estCefr && (
              <span>
                <strong className="font-display font-[700] text-[var(--t1)]">CEFR 추정</strong>{' '}
                <span className="text-[var(--t2)]">{v.estCefr}</span>
              </span>
            )}
          </div>
        </Section>
      )}

      {v.estBasis && (
        <Section title="V-Level 추정 근거">
          <p className="font-body text-[11.5px] italic leading-[1.6] text-[var(--t3)]">
            {v.estBasis}
          </p>
        </Section>
      )}

      {v.descriptionEn && (
        <Section title="원문 설명 (영어)">
          <p className="font-body text-[12px] leading-[1.6] text-[var(--t2)] line-clamp-6">
            {v.descriptionEn}
          </p>
        </Section>
      )}

      {/* 학습 가이드 */}
      <Tip text="짧은 챕터부터 시작해 단어를 충분히 익혀보세요." />
    </div>
  )
}

// ── Section helper (v06.34) ───────────────────────
function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="font-mono text-[10.5px] font-[700] uppercase tracking-[0.1em] text-[var(--t3)]">
        {title}
      </h3>
      <div>{children}</div>
    </section>
  )
}

// ─── ScriptBody ──────────────────────────────────────────
function ScriptBody({ v }: { v: ScriptVariant }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="CEFR" value={v.cefrLevel ?? '—'} />
        <Stat
          label="단어"
          value={v.wordCount != null ? v.wordCount.toLocaleString() : '—'}
        />
        <Stat
          label="진행"
          value={v.progressPercent != null ? `${v.progressPercent}%` : '0%'}
          sub={v.progressPercent && v.progressPercent > 0 ? '이어 학습' : '시작 전'}
        />
      </div>

      {v.preview && (
        <div className="rounded-[var(--r-md)] border-l-[3px] border-[#3B82F6] bg-[var(--bg2)] px-4 py-3">
          <p className="mb-1 font-display text-[10px] font-[700] uppercase tracking-wider text-[var(--t3)]">
            미리보기
          </p>
          <p className="font-english text-[14px] leading-relaxed text-[var(--t2)]">
            &ldquo;{v.preview}&rdquo;
          </p>
        </div>
      )}

      {v.progressPercent != null && v.progressPercent > 0 && (
        <ProgressRow percent={v.progressPercent} accent="#3B82F6" />
      )}

      <Tip text="단어 hover · 본문 듣기 · 따라읽기로 단계적 학습이 가능해요." />
    </div>
  )
}

// ─── VocabBody ───────────────────────────────────────────
function VocabBody({ v }: { v: VocabVariant }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="단어 수" value={v.wordCount.toLocaleString()} />
        <Stat label="CEFR" value={v.cefrLevel ?? '—'} />
        <Stat label="카테고리" value={v.categoryLabel} />
      </div>

      {v.description && (
        <p className="font-body text-[13.5px] leading-relaxed text-[var(--t2)]">
          {v.description}
        </p>
      )}

      {/* 단어 sample */}
      {v.samples && v.samples.length > 0 && (
        <div>
          <p className="mb-2 inline-flex items-center gap-1.5 font-display text-[10px] font-[700] uppercase tracking-wider text-[var(--t3)]">
            <Sparkles size={11} aria-hidden /> 단어 미리보기 ({v.samples.length})
          </p>
          <ul className="grid grid-cols-1 gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)]/40 p-3 sm:grid-cols-2">
            {v.samples.slice(0, 8).map((w) => (
              <li key={w.word} className="flex items-baseline justify-between gap-2">
                <span className="font-english text-[14px] font-[600] text-[var(--t1)]">
                  {w.word}
                </span>
                <span className="truncate font-body text-[11.5px] text-[var(--t3)]">
                  {w.meaningKo}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Tip text="추가 후 Flashcard · Dictation 등 모든 학습 모듈에서 사용할 수 있어요." />
    </div>
  )
}

// ─── Footer CTA ──────────────────────────────────────────
function Footer({ variant, onClose }: { variant: DetailVariant; onClose: () => void }) {
  const accent =
    variant.type === 'book'
      ? '#7C3AED'
      : variant.type === 'script'
        ? '#3B82F6'
        : variant.categoryColor.accent

  if (variant.type === 'vocab') {
    return (
      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--bd)] bg-[var(--bg)] px-6 py-3 md:px-8">
        {variant.secondaryHref && variant.secondaryLabel && (
          <Link
            href={variant.secondaryHref}
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-2.5 font-display text-[13px] font-[700] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)]"
          >
            <Volume2 size={13} aria-hidden />
            {variant.secondaryLabel}
          </Link>
        )}
        <button
          type="button"
          onClick={() => variant.onCtaClick?.()}
          disabled={variant.ctaPending}
          className="inline-flex items-center gap-1.5 rounded-[var(--r-md)] px-5 py-2.5 font-display text-[13.5px] font-[700] text-white shadow-[var(--sh-sm)] transition-all hover:scale-[1.03] active:scale-[0.97] disabled:opacity-60"
          style={{ backgroundColor: accent }}
        >
          {variant.ctaLabel}
        </button>
      </footer>
    )
  }

  return (
    <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--bd)] bg-[var(--bg)] px-6 py-3 md:px-8">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-2.5 font-display text-[13px] font-[700] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)]"
      >
        나중에
      </button>
      <Link
        href={variant.ctaHref}
        onClick={onClose}
        className="inline-flex items-center rounded-[var(--r-md)] px-5 py-2.5 font-display text-[13.5px] font-[700] text-white shadow-[var(--sh-sm)] transition-all hover:scale-[1.03] active:scale-[0.97]"
        style={{ backgroundColor: accent }}
      >
        {variant.ctaLabel}
      </Link>
    </footer>
  )
}

// ─── 미니 helpers ────────────────────────────────────────
function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[var(--r-md)] bg-[var(--bg2)] p-2.5">
      <span className="font-display text-[9.5px] font-[700] uppercase tracking-[0.06em] text-[var(--t3)]">
        {label}
      </span>
      <span className="font-display text-[16px] font-[800] tabular-nums text-[var(--t1)]">
        {value}
      </span>
      {sub && <span className="font-mono text-[9.5px] text-[var(--t3)]">{sub}</span>}
    </div>
  )
}

function MetaItem({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode
  label: string
  value: string
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5 font-body text-[12px] text-[var(--t2)]">
      {icon && <span className="text-[var(--t3)]">{icon}</span>}
      <span className="text-[var(--t3)]">{label}</span>
      <strong className="font-display font-[700] text-[var(--t1)]">{value}</strong>
    </span>
  )
}

function ProgressRow({ percent, accent }: { percent: number; accent: string }) {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="font-display text-[10px] font-[700] uppercase tracking-wider text-[var(--t3)]">
          학습 진행
        </span>
        <span className="font-display text-[14px] font-[700] tabular-nums" style={{ color: accent }}>
          {percent}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg3)]">
        <div
          className="h-full transition-[width] duration-[var(--dur-slow)]"
          style={{ width: `${percent}%`, backgroundColor: accent }}
          aria-hidden
        />
      </div>
    </div>
  )
}

function Tip({ text }: { text: string }) {
  return (
    <p className="font-body text-[11.5px] italic text-[var(--t3)]">💡 {text}</p>
  )
}
