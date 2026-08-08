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

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { X, Clock, BookImage, BookOpen, Layers, Sparkles, Volume2 } from 'lucide-react'

import { bookCover } from '@/lib/library/book-cover'
import { judgeIPlusOne } from '@/lib/library/i-plus-one'

export interface SampleWord {
  word: string
  meaningKo: string
  partOfSpeech?: string | null
  cefrLevel?: string | null
}

// 내 라이브러리(/text) 전용 개인화 — 진도·상태. 공용(/library/books)에선 미전달.
export interface MyProgress {
  status: 'not_started' | 'in_progress' | 'completed'
  progressPercent?: number | null
  /** 완료 단위 (챕터/페이지/단어) */
  completedUnits?: number | null
  totalUnits?: number | null
  /** '챕터' | '페이지' | '단어' */
  unitLabel?: string
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
  /** 원천 표지 이미지 URL (Gutenberg/SE). 있으면 hero 에 실 표지 표시 */
  coverImageUrl?: string | null
  // i+1 적합도 — V레벨별 기지어 커버리지 + 학습자 V레벨
  lexicalCoverage?: Record<string, number> | null
  userVLevel?: number | null
  /** 그림책 여부 — i+1 임계 삽화 보정(judgeIPlusOne illustrated) */
  isPictureBook?: boolean
  // 내 라이브러리(/text) 개인화 — 진도·상태 (공용 /library/books 에선 미전달)
  mine?: MyProgress
  ctaHref: string
  ctaLabel: string
  /** v07 CCP — 만화 진입(포맷 선택). 발행 만화가 있는 도서에서만 non-null */
  comicHref?: string | null
  comicLabel?: string
  /** 만화 진도(0~100) — 본문 진도와 분리 회계(R1·R2) */
  comicProgressPct?: number
  comicCompleted?: boolean
  // v06.34 — 큐레이션 메타 (선택 의사결정 보조)
  synopsisKo?: string | null
  learningValue?: string | null
  themes?: string[] | null
  estBasis?: string | null
  estCefr?: string | null
  ageBand?: string | null
  genreNorm?: string | null
  descriptionEn?: string | null
  // v06.34 — 학습 제외 (enrolled 도서에서만 노출)
  isEnrolled?: boolean
  onUnenroll?: () => void
  unenrollPending?: boolean
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
  mine?: MyProgress
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
  /** 세트 내 챕터 수 (내부 챕터 구성 시). 0/null=미분할(평면). */
  chapterCount?: number | null
  coverEmoji?: string | null
  samples?: SampleWord[]
  mine?: MyProgress
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

  // Esc 닫기 + body scroll lock + focus 복원(열 때 트리거 저장)
  useEffect(() => {
    if (!variant) return
    const prevActive = document.activeElement as HTMLElement | null
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
      prevActive?.focus()
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
  // gradient 결정 — Reading Room default = navy ink (variant 가 override 안 할 때)
  let from = 'var(--p)'
  let to = 'var(--p-dark)'
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

  const coverImageUrl = variant.type === 'book' ? (variant.coverImageUrl ?? null) : null

  return (
    <div
      className="relative h-[200px] shrink-0 overflow-hidden md:h-[240px]"
      style={
        coverImageUrl
          ? { backgroundColor: 'var(--p-dark)' }
          : {
              // Calm UI — sheen 보강 + white veil 로 풀-saturate 톤다운
              background: `
          linear-gradient(rgba(255,255,255,0.12), rgba(255,255,255,0.12)),
          radial-gradient(120% 80% at 20% 10%, rgba(255,255,255,0.28) 0%, transparent 55%),
          linear-gradient(155deg, ${from} 0%, ${to} 75%, rgba(0,0,0,0.24) 100%)
        `,
            }
      }
    >
      {coverImageUrl ? (
        <>
          {/* 실 표지 — 블러 backdrop(landscape 채움) + 중앙 contained cover (portrait) */}
          <Image
            src={coverImageUrl}
            alt=""
            aria-hidden
            fill
            sizes="720px"
            className="scale-110 object-cover blur-2xl brightness-[0.5]"
          />
          <Image
            src={coverImageUrl}
            alt={variant.type === 'book' ? `${variant.title} 표지` : ''}
            fill
            sizes="(max-width: 768px) 90vw, 720px"
            className="z-[1] object-contain p-3"
          />
          {/* 하단 scrim — 제목 가독성 */}
          <div
            aria-hidden
            className="absolute inset-0 z-[1] bg-gradient-to-t from-black/75 via-transparent to-black/5"
          />
        </>
      ) : (
        <>
          {/* sheen + grain (그라디언트 표지) */}
          <div aria-hidden className="book-cover-sheen absolute inset-0" />
          <div aria-hidden className="book-cover-grain absolute inset-0" />
        </>
      )}

      {/* bottom fade to bg */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 z-[2] h-20 bg-gradient-to-b from-transparent to-[var(--bg)]"
      />

      {/* 좌상단 카테고리/타입 */}
      <div className="absolute left-5 top-5 z-[2] inline-flex items-center gap-1.5 rounded-[var(--r-full)] bg-black/40 px-3 py-1 font-display text-[10px] font-[700] uppercase tracking-wider text-white backdrop-blur-md md:left-7 md:top-7">
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
      <div className="absolute inset-x-0 bottom-0 z-[2] flex flex-col gap-1.5 px-6 pb-5 text-white md:px-8 md:pb-6">
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
      {/* 내 학습 (내 라이브러리 전용 — 상태·진도·레벨 권장) */}
      {v.mine && (
        <MyProgressSection
          kind="book"
          mine={v.mine}
          coverage={v.lexicalCoverage}
          userVLevel={v.userVLevel ?? 0}
          isPictureBook={v.isPictureBook}
        />
      )}

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

      {/* i+1 적합도 — 공용(/library/books)에서만. 내 라이브러리는 위 '내 학습'에 포함 */}
      {!v.mine && (
        <IPlusOneRow coverage={v.lexicalCoverage} userVLevel={v.userVLevel ?? 0} isPictureBook={v.isPictureBook} />
      )}

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
        <ProgressRow percent={v.progressPercent} accent="var(--p)" />
      )}

      {/* 만화 회계는 본문 진도와 분리 표기 — 만화를 다 봤다고 챕터가 완료되진 않는다
          (docs/CCP_LIBRARY_INTEGRATION.md R1·R2) */}
      {v.comicHref && (v.comicProgressPct ?? 0) > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2">
          <span className="inline-flex items-center gap-1.5 font-display text-[12px] font-[700] text-[var(--t2)]">
            <BookImage size={13} aria-hidden style={{ color: 'var(--active)' }} />
            만화 미리 봄
          </span>
          <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
            {v.comicCompleted ? '다 봤어요' : `${v.comicProgressPct}%`}
          </span>
        </div>
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

// ── 내 학습 섹션 (내 라이브러리 /text 전용) ───────────────────────
// 상태 배지 + 진도(챕터/페이지) + 레벨 적합도(i+1, 도서 한정) + 상황별 권장 1줄.
const STATUS_META = {
  not_started: { label: { book: '미시작', script: '미시작', vocab: '학습 전' }, fg: 'var(--t2)', bg: 'var(--bg3)' },
  in_progress: { label: { book: '진행 중', script: '읽는 중', vocab: '학습 중' }, fg: 'var(--p)', bg: 'var(--p-light)' },
  completed: { label: { book: '정복', script: '완독', vocab: '완료' }, fg: 'var(--success)', bg: 'var(--success-light)' },
} as const

function buildGuidance(
  kind: 'book' | 'script' | 'vocab',
  status: MyProgress['status'],
  tier: 'easy' | 'ideal' | 'challenge' | 'hard' | null,
): string {
  if (kind === 'book') {
    if (status === 'completed') return '이 책을 정복했어요. 다른 책에도 도전해 보세요.'
    if (status === 'in_progress') return '이어서 학습하면 흐름을 유지할 수 있어요.'
    // not_started — 레벨 적합도에 따라 권장 분기 (레벨 관리)
    if (tier === 'hard') return '모르는 단어가 많아요 — 챕터 단어장으로 먼저 다지면 수월해요.'
    if (tier === 'challenge') return '약간 도전적이에요. 단어를 함께 익히며 읽어보세요.'
    if (tier === 'ideal') return '지금 시작하기 딱 좋은 난이도예요.'
    if (tier === 'easy') return '대부분 아는 단어라 편하게 읽혀요.'
    return '첫 챕터부터 천천히 시작해 보세요.'
  }
  if (kind === 'script') {
    if (status === 'completed') return '다 읽었어요. 단어 학습으로 마무리해 보세요.'
    if (status === 'in_progress') return '이어서 읽어보세요.'
    return '본문을 읽으며 단어를 추출해 보세요.'
  }
  // vocab
  if (status === 'completed') return '복습으로 기억을 단단히 굳혀보세요.'
  if (status === 'in_progress') return '오늘도 몇 단어 더 만나볼까요?'
  return 'Flashcard 로 학습을 시작해 보세요.'
}

function MyProgressSection({
  kind,
  mine,
  coverage,
  userVLevel,
  isPictureBook,
}: {
  kind: 'book' | 'script' | 'vocab'
  mine: MyProgress
  coverage?: Record<string, number> | null
  userVLevel?: number | null
  isPictureBook?: boolean
}) {
  const sm = STATUS_META[mine.status]
  const fit =
    kind === 'book' && coverage && userVLevel && userVLevel >= 1
      ? judgeIPlusOne(coverage, userVLevel, isPictureBook)
      : null
  const pct = Math.max(0, Math.min(100, mine.progressPercent ?? 0))
  const hasUnits = mine.completedUnits != null && mine.totalUnits != null && mine.totalUnits > 0
  const guidance = buildGuidance(kind, mine.status, fit?.tier ?? null)

  return (
    <section className="flex flex-col gap-2.5 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-mono text-[10.5px] font-[700] uppercase tracking-[0.1em] text-[var(--t3)]">
          내 학습
        </h3>
        <span
          className="inline-flex items-center gap-1 rounded-[var(--r-full)] px-2.5 py-1 font-display text-[11px] font-[700]"
          style={{ color: sm.fg, background: sm.bg }}
        >
          <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sm.fg }} />
          {sm.label[kind]}
        </span>
      </div>

      {/* 진도 */}
      {(hasUnits || pct > 0) && (
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="font-display text-[10px] font-[700] uppercase tracking-wider text-[var(--t3)]">
              진도
            </span>
            <span className="font-display text-[12px] font-[700] tabular-nums text-[var(--t1)]">
              {hasUnits
                ? `${mine.completedUnits} / ${mine.totalUnits} ${mine.unitLabel ?? ''}`
                : `${pct}%`}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg3)]">
            <div
              className="h-full transition-[width] duration-[var(--dur-slow)]"
              style={{ width: `${pct}%`, backgroundColor: sm.fg }}
              aria-hidden
            />
          </div>
        </div>
      )}

      {/* 레벨 적합도 (i+1) — 도서 한정 */}
      {fit && (
        <div className="flex items-center justify-between gap-2 rounded-[var(--r-md)] border bg-[var(--bg)] px-3 py-2" style={{ borderColor: fit.color }}>
          <span className="inline-flex items-center gap-1.5 font-display text-[12px] font-[700]">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: fit.color }} />
            <span style={{ color: fit.color }}>레벨 {fit.label}</span>
          </span>
          <span className="font-mono text-[11px] text-[var(--t2)]">
            V{userVLevel} · 아는 단어{' '}
            <strong className="font-display font-[700]" style={{ color: fit.color }}>
              {fit.coverage}%
            </strong>
          </span>
        </div>
      )}

      {/* 미진단 안내 (도서이고 coverage 있는데 V레벨 미설정) */}
      {kind === 'book' && coverage && (!userVLevel || userVLevel < 1) && (
        <Link
          href="/diagnostic"
          className="flex items-center justify-between gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] px-3 py-2 transition-colors hover:border-[var(--p)] hover:bg-[var(--p-light)]"
        >
          <span className="font-body text-[11.5px] text-[var(--t2)]">
            레벨을 진단하면 이 책이 나에게 맞는지 알려드려요
          </span>
          <span className="shrink-0 font-display text-[11.5px] font-[700] text-[var(--p)]">진단 →</span>
        </Link>
      )}

      {/* 권장 1줄 */}
      <p className="font-body text-[11.5px] leading-relaxed text-[var(--t2)]">💡 {guidance}</p>
    </section>
  )
}

// ── i+1 적합도 row ───────────────────────
// 학습자 V레벨 기준 기지어 커버리지 → "나에게 딱 맞아요 · 95%" + 진행 막대.
// 미진단(userVLevel 0)이면 진단 유도 안내. coverage 데이터 없으면 미표시.
function IPlusOneRow({
  coverage,
  userVLevel,
  isPictureBook,
}: {
  coverage?: Record<string, number> | null
  userVLevel: number
  isPictureBook?: boolean
}) {
  if (!userVLevel || userVLevel < 1) {
    return (
      <Link
        href="/diagnostic"
        className="flex items-center justify-between gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 transition-colors hover:border-[var(--p)] hover:bg-[var(--p-light)]"
      >
        <span className="font-body text-[12px] text-[var(--t2)]">
          내 레벨을 진단하면 이 책이 나에게 맞는지 알려드려요
        </span>
        <span className="shrink-0 font-display text-[12px] font-[700] text-[var(--p)]">
          진단 →
        </span>
      </Link>
    )
  }

  const fit = judgeIPlusOne(coverage, userVLevel, isPictureBook)
  if (!fit) return null

  return (
    <div
      className="rounded-[var(--r-md)] border bg-[var(--bg2)] px-4 py-3"
      style={{ borderColor: fit.color }}
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-display text-[13px] font-[700]">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: fit.color }}
          />
          <span style={{ color: fit.color }}>나에게 {fit.label}</span>
        </span>
        <span className="font-mono text-[12px] text-[var(--t2)]">
          V{userVLevel} 학습자가 아는 단어{' '}
          <strong className="font-display font-[700] tabular-nums" style={{ color: fit.color }}>
            {fit.coverage}%
          </strong>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg3)]">
        <div
          className="h-full transition-[width] duration-[var(--dur-slow)]"
          style={{ width: `${fit.coverage}%`, backgroundColor: fit.color }}
          aria-hidden
        />
      </div>
      <p className="mt-1.5 font-body text-[10.5px] leading-relaxed text-[var(--t3)]">
        {fit.tier === 'ideal'
          ? '모르는 단어가 적당해서 맥락으로 익히기 좋아요 (i+1).'
          : fit.tier === 'easy'
            ? '대부분 아는 단어라 편하게 읽혀요.'
            : fit.tier === 'challenge'
              ? '모르는 단어가 다소 있어요 — 단어장으로 먼저 다지면 수월해요.'
              : '모르는 단어가 많아요 — 단어장 학습 후 도전을 권해요.'}
      </p>
    </div>
  )
}

// ─── ScriptBody ──────────────────────────────────────────
function ScriptBody({ v }: { v: ScriptVariant }) {
  return (
    <div className="flex flex-col gap-5">
      {v.mine && <MyProgressSection kind="script" mine={v.mine} />}

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
        <div className="rounded-[var(--r-md)] border-l-[3px] border-[var(--p)] bg-[var(--bg2)] px-4 py-3">
          <p className="mb-1 font-display text-[10px] font-[700] uppercase tracking-wider text-[var(--t3)]">
            미리보기
          </p>
          <p className="font-english text-[14px] leading-relaxed text-[var(--t2)]">
            &ldquo;{v.preview}&rdquo;
          </p>
        </div>
      )}

      {v.progressPercent != null && v.progressPercent > 0 && (
        <ProgressRow percent={v.progressPercent} accent="var(--p)" />
      )}

      <Tip text="단어 hover · 본문 듣기 · 따라읽기로 단계적 학습이 가능해요." />
    </div>
  )
}

// ─── VocabBody ───────────────────────────────────────────
function VocabBody({ v }: { v: VocabVariant }) {
  return (
    <div className="flex flex-col gap-5">
      {v.mine && <MyProgressSection kind="vocab" mine={v.mine} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="단어 수" value={v.wordCount.toLocaleString()} />
        {v.chapterCount != null && v.chapterCount > 0 && (
          <Stat label="챕터" value={`${v.chapterCount}`} />
        )}
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
  // Reading Room — 모든 variant 가 navy ink 정합 (book/script accent 토큰화)
  const accent =
    variant.type === 'book'
      ? 'var(--p)'
      : variant.type === 'script'
        ? 'var(--p-hover)'
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

  // v06.34 — enrolled 도서면 좌측에 "내 학습에서 제외" 보조 액션 노출
  const showUnenroll =
    variant.type === 'book' && variant.isEnrolled === true && !!variant.onUnenroll

  return (
    <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--bd)] bg-[var(--bg)] px-6 py-3 md:px-8">
      <div className="flex items-center">
        {showUnenroll && variant.type === 'book' && (
          <button
            type="button"
            onClick={() => variant.onUnenroll?.()}
            disabled={variant.unenrollPending}
            className="inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-display text-[12px] font-[600] text-[var(--t3)] transition-colors hover:border-[var(--error)] hover:bg-[var(--error-light)] hover:text-[var(--error)] disabled:opacity-50"
            title="내 학습 도서 목록에서 빼기 (단어 학습 기록은 보존)"
          >
            {variant.unenrollPending ? '제외 중…' : '− 내 학습에서 제외'}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-2.5 font-display text-[13px] font-[700] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)]"
        >
          나중에
        </button>
        {/* 포맷 선택 — 만화 발행 도서만. 본문 CTA 와 동등 위계(강요 아님), gold 로 계열 구분 */}
        {variant.type === 'book' && variant.comicHref && (
          <Link
            href={variant.comicHref}
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-[var(--r-md)] px-4 py-2.5 font-display text-[13px] font-[700] shadow-[var(--sh-sm)] transition-all hover:scale-[1.03] active:scale-[0.97] motion-reduce:transition-none motion-reduce:hover:scale-100"
            style={{ backgroundColor: 'var(--active)', color: '#231a09' }}
          >
            <BookImage size={14} aria-hidden />
            {variant.comicLabel ?? '만화로 읽기'}
          </Link>
        )}
        <Link
          href={variant.ctaHref}
          onClick={onClose}
          className="inline-flex items-center rounded-[var(--r-md)] px-5 py-2.5 font-display text-[13.5px] font-[700] text-white shadow-[var(--sh-sm)] transition-all hover:scale-[1.03] active:scale-[0.97]"
          style={{ backgroundColor: accent }}
        >
          {variant.ctaLabel}
        </Link>
      </div>
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
