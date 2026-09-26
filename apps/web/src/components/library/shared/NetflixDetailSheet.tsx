// apps/web/src/components/library/shared/NetflixDetailSheet.tsx
//
// 콘텐츠 상세 팝업 — /library/books · /library/vocab · /text 공통. 카드를 누르면 뜬다.
//
// ── 껍데기는 `ui/Dialog` (DD-68 · tines-mapping §28, 2026-09-23) ───────────
// 예전 골격은 **표지 히어로 위에 흰 제목**이었다(어두운 그라디언트 200~240px + scrim).
// 참조 팝업은 반대다 — 제목을 크림 머리에 크게 놓고, 그림은 본문 오른쪽 칸의 액자로 내린다.
// 바꾼 이유는 닮음만이 아니다: 제목이 표지 위에 있으면 대비가 표지마다 달라 `drop-shadow`
// 로 억지로 읽히게 해야 했고(실 표지 도서는 밝은 표지가 많다), 제목 길이가 두 줄을 넘으면
// 표지를 가렸다. 크림 머리로 내리면 대비가 한 값으로 고정되고 제목은 40px 까지 커진다.
//
// 남긴 것: F-pattern(결정 → 근거 → CTA) · 한 화면 결정 1개 · Esc/바깥/뒤로가기 닫기.
// 본문은 2열 — 왼쪽은 판단 근거(내 학습 · i+1 · 큐레이션), 오른쪽은 표지 액자 + 수치.

'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Clock, BookImage, BookOpen, Layers, Volume2 } from 'lucide-react'
import { Gwonjeom } from '@/components/ui/press/Gwonjeom'

import { Dialog, DialogColumns, DialogSection } from '@/components/ui/Dialog'
import { BTN, DIALOG } from '@/components/ui/tines-kit'
import { VocabSpreadSheet } from '@/components/library/vocab/VocabSpreadSheet'
import { bookCover } from '@/lib/library/book-cover'
import { judgeIPlusOne } from '@/lib/library/i-plus-one'
import { formatReadingTime } from '@/lib/library/reading-time'

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

/** 종류 → 빵부스러기. 참조의 「Tines 3B › Examples › IT」 자리. */
function crumbsOf(v: DetailVariant): string[] {
  if (v.type === 'book') return ['도서', '서가', v.cefrBand ?? v.cefrLevel ?? '레벨 미정']
  if (v.type === 'script') return ['기사', '서가', v.category]
  return ['단어장', '서가', v.categoryLabel]
}

/** 제목 아래 한 줄 — 참조의 「By 작성자」. 저자가 없으면 그 자리에 설명을 둔다. */
function bylineOf(v: DetailVariant): string | null {
  if (v.type === 'vocab') return v.description ?? null
  return v.author ?? null
}

/** 태그 줄 — 참조의 윤곽선 알약. 도서는 테마, 나머지는 분류·구성. */
function tagsOf(v: DetailVariant): string[] {
  if (v.type === 'book') return (v.themes ?? []).slice(0, 5)
  if (v.type === 'script') return [v.category, v.cefrLevel ?? '레벨 미정'].filter(Boolean)
  return [v.categoryLabel, ...(v.chapterCount ? [`챕터 ${v.chapterCount}`] : [])]
}

export function NetflixDetailSheet({ variant, onClose }: Props) {
  // 마운트 = 열림. Esc · 바깥 · 뒤로가기 · 포커스 가둠 · 스크롤 잠금은 Dialog 의 계약이다.
  if (!variant) return null

  const readLabel = variant.type === 'book' ? formatReadingTime(variant.readingMinutes) : null
  const wordCount =
    variant.type === 'vocab'
      ? variant.wordCount
      : variant.type === 'book'
        ? variant.wordCount
        : variant.wordCount

  return (
    <Dialog
      onClose={onClose}
      size="xl"
      crumbs={crumbsOf(variant)}
      title={
        <span className={variant.type === 'book' ? 'font-english' : undefined}>{variant.title}</span>
      }
      ariaLabel={variant.title}
      byline={bylineOf(variant)}
      tags={tagsOf(variant)}
      meta={
        <>
          {wordCount != null && (
            <span>
              <strong className="font-display font-[700] text-[var(--t1)]">
                {wordCount.toLocaleString()}
              </strong>{' '}
              단어
            </span>
          )}
          {readLabel && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock size={13} aria-hidden />
                {readLabel}
              </span>
            </>
          )}
        </>
      }
      footer={<Footer variant={variant} onClose={onClose} />}
    >
      <DialogColumns
        main={
          <>
            {variant.type === 'book' && <BookBody v={variant} />}
            {variant.type === 'script' && <ScriptBody v={variant} />}
            {variant.type === 'vocab' && <VocabBody v={variant} />}
          </>
        }
        side={<SideColumn variant={variant} />}
      />
    </Dialog>
  )
}

// ─── 오른쪽 칸 — 참조의 미리보기 액자 자리 ───────────────
// 표지(액자) + 그 아래 수치. 참조는 여기에 제품 화면과 「What this prompt builds」 를 둔다.
function SideColumn({ variant }: { variant: DetailVariant }) {
  return (
    <>
      <CoverFrame variant={variant} />
      {variant.type === 'book' && <BookStats v={variant} />}
      {variant.type === 'script' && <ScriptStats v={variant} />}
      {variant.type === 'vocab' && <VocabStats v={variant} />}
    </>
  )
}

// ─── 표지 액자 ───────────────────────────────────────────
// 참조 팝업은 오른쪽 칸 맨 위에 **테두리 있는 액자**로 미리보기를 둔다(둥근 12px).
// 제목이 머리로 올라갔으므로 여기서는 표지가 온전히 보인다 — scrim·drop-shadow 가 필요 없다.
function CoverFrame({ variant }: { variant: DetailVariant }) {
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
    <figure
      className={`relative overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] ${
        coverImageUrl ? 'aspect-[3/4]' : 'aspect-[4/3]'
      }`}
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
          {/* 실 표지 — 블러 backdrop(가로 표지 채움) + 중앙 contained cover(세로 표지) */}
          <Image
            src={coverImageUrl}
            alt=""
            aria-hidden
            fill
            sizes="360px"
            className="scale-110 object-cover blur-2xl brightness-[0.5]"
          />
          <Image
            src={coverImageUrl}
            alt={`${variant.title} 표지`}
            fill
            sizes="(max-width: 1024px) 90vw, 360px"
            className="z-[1] object-contain p-3"
          />
        </>
      ) : (
        <>
          {/* sheen + grain (그라디언트 표지) */}
          <div aria-hidden className="book-cover-sheen absolute inset-0" />
          <div aria-hidden className="book-cover-grain absolute inset-0" />
          {/* 그림이 없는 표지는 제목이 표지 구실을 한다 — 참조의 액자 속 제품 화면과 같은 자리 */}
          <figcaption
            className={`absolute inset-x-0 bottom-0 z-[2] px-4 pb-4 font-display text-[19px] font-[800] leading-[1.15] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] ${
              variant.type === 'book' ? 'font-english' : 'break-keep'
            }`}
          >
            {variant.title}
          </figcaption>
        </>
      )}

      {/* 좌상단 종류 — 표지만 보고도 무엇인지 알게 */}
      <span className="absolute left-3 top-3 z-[2] inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 font-display text-[10px] font-[700] uppercase tracking-wider text-white backdrop-blur-md">
        {variant.type === 'vocab' ? <Layers size={11} aria-hidden /> : <BookOpen size={11} aria-hidden />}
        {variant.type === 'book' ? '도서' : variant.type === 'script' ? variant.category : variant.categoryLabel}
      </span>

      {/* 우상단 emoji (단어장) */}
      {variant.type === 'vocab' && variant.coverEmoji && (
        <span
          aria-hidden
          className="absolute right-3 top-3 z-[2] inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-[20px] leading-none backdrop-blur-sm"
        >
          {variant.coverEmoji}
        </span>
      )}
    </figure>
  )
}

// ─── 오른쪽 칸 수치 ──────────────────────────────────────
function BookStats({ v }: { v: BookVariant }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="CEFR" value={v.cefrBand ?? v.cefrLevel ?? '—'} />
        <Stat label="V-Level" value={v.bookVLevel != null ? `V${v.bookVLevel}` : '—'} sub="한국 학습자" />
        <Stat label="CEFR-J" value={v.cefrjLevel ?? '—'} sub="외부 표준" />
        <Stat
          label="F-K Grade"
          value={v.fleschKincaid != null ? v.fleschKincaid.toFixed(1) : '—'}
          sub="통사 복잡도"
        />
      </div>

      <div className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3">
        {v.chapterCount != null && (
          <MetaItem icon={<BookOpen size={12} aria-hidden />} label="챕터" value={v.chapterCount.toLocaleString()} />
        )}
        {v.wordCount != null && <MetaItem label="단어" value={v.wordCount.toLocaleString()} />}
        {formatReadingTime(v.readingMinutes) !== null && (
          <MetaItem
            icon={<Clock size={12} aria-hidden />}
            label="읽기"
            value={formatReadingTime(v.readingMinutes) as string}
          />
        )}
        {v.lexile != null && <MetaItem label="Lexile" value={`${v.lexile}L`} />}
        {v.wordSetCount != null && v.wordSetCount > 0 && (
          <MetaItem icon={<Gwonjeom size={12} aria-hidden />} label="단어장" value={`${v.wordSetCount}개`} />
        )}
      </div>
    </>
  )
}

function ScriptStats({ v }: { v: ScriptVariant }) {
  return (
    <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
      <Stat label="CEFR" value={v.cefrLevel ?? '—'} />
      <Stat label="단어" value={v.wordCount != null ? v.wordCount.toLocaleString() : '—'} />
      <Stat
        label="진행"
        value={v.progressPercent != null ? `${v.progressPercent}%` : '0%'}
        sub={v.progressPercent && v.progressPercent > 0 ? '이어 학습' : '시작 전'}
      />
    </div>
  )
}

function VocabStats({ v }: { v: VocabVariant }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat label="단어 수" value={v.wordCount.toLocaleString()} />
      {v.chapterCount != null && v.chapterCount > 0 && <Stat label="챕터" value={`${v.chapterCount}`} />}
      <Stat label="CEFR" value={v.cefrLevel ?? '—'} />
      <Stat label="카테고리" value={v.categoryLabel} />
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

      {/* i+1 적합도 — 공용(/library/books)에서만. 내 라이브러리는 위 '내 학습'에 포함.
          4축 난이도·분량 수치는 오른쪽 칸(`BookStats`)으로 옮겼다 — 참조 팝업이 수치를
          좁은 칸에 세로로 쌓는 자리다. 왼쪽은 「읽을지 말지」를 정하는 글이 차지한다. */}
      {!v.mine && (
        <IPlusOneRow coverage={v.lexicalCoverage} userVLevel={v.userVLevel ?? 0} isPictureBook={v.isPictureBook} />
      )}

      {v.progressPercent != null && v.progressPercent > 0 && (
        <ProgressRow percent={v.progressPercent} accent="var(--p)" />
      )}

      {/* 만화 회계는 본문 진도와 분리 표기 — 만화를 다 봤다고 챕터가 완료되진 않는다
          (docs/CCP_LIBRARY_INTEGRATION.md R1·R2) */}
      {v.comicHref && (v.comicProgressPct ?? 0) > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2">
          <span className="inline-flex items-center gap-2 font-display text-[12px] font-[700] text-[var(--t2)]">
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
          <div className="flex flex-wrap gap-2">
            {v.themes.map((th, i) => (
              <span
                key={`${th}-${i}`}
                className="inline-flex items-center rounded-[var(--r-full)] bg-[var(--p-light)] px-3 py-1 font-mono text-[11px] font-[600] text-[var(--on-p-tint)]"
              >
                {th}
              </span>
            ))}
          </div>
        </Section>
      )}

      {(v.ageBand || v.genreNorm || v.estCefr) && (
        <Section title="큐레이터 추정">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
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
          <p className="font-body text-[12px] italic leading-[1.6] text-[var(--t2)]">
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

// ── Section helper — 참조 팝업의 본문 소제목(`DialogSection`)과 같은 결 ───────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <DialogSection label={title}>{children}</DialogSection>
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
    <section className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-[11px] font-[600] tracking-[0.04em] text-[var(--t2)]">
          내 학습
        </h3>
        <span
          className="inline-flex items-center gap-1 rounded-[var(--r-full)] px-3 py-1 font-display text-[11px] font-[700]"
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
            <span className="font-display text-[10px] font-[700] uppercase tracking-wider text-[var(--t2)]">
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
          <span className="inline-flex items-center gap-2 font-display text-[12px] font-[700]">
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
          <span className="font-body text-[12px] text-[var(--t2)]">
            레벨을 진단하면 이 책이 나에게 맞는지 알려드려요
          </span>
          <span className="shrink-0 font-display text-[12px] font-[700] text-[var(--p)]">진단 →</span>
        </Link>
      )}

      {/* 권장 1줄 */}
      <p className="font-body text-[12px] leading-relaxed text-[var(--t2)] break-keep">{guidance}</p>
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
        <span className="inline-flex items-center gap-2 font-display text-[13px] font-[700]">
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
      <p className="mt-1.5 font-body text-[11px] leading-relaxed text-[var(--t2)]">
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

      {/* 수치는 오른쪽 칸(`ScriptStats`) — 여기는 글이 차지한다 */}
      {v.preview && (
        <Section title="미리보기">
          <p className="rounded-[var(--r-md)] border-l-[3px] border-[var(--p)] bg-[var(--bg2)] px-4 py-3 font-english text-[14px] leading-relaxed text-[var(--t2)]">
            &ldquo;{v.preview}&rdquo;
          </p>
        </Section>
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

      {/* 수치는 오른쪽 칸(`VocabStats`) · 설명은 머리의 「By」 줄로 올라갔다 */}

      {/*
        지면 — 시중 단어장을 펼쳤을 때 나오는 것. 조판은 파이프라인이 하고
        (`@vocaflow/library-pipeline/vocab-typeset`) 여기서는 그린다.
        지면이 만들어지지 않으면 아무것도 그리지 않으므로 아래 낱말 미리보기가 그대로 남는다.
      */}
      <VocabSpreadSheet setId={v.id} />

      {/* 단어 sample */}
      {v.samples && v.samples.length > 0 && (
        <div>
          <p className="mb-2 inline-flex items-center gap-2 font-display text-[10px] font-[700] uppercase tracking-wider text-[var(--t2)]">
            <Gwonjeom size={11} aria-hidden /> 단어 미리보기 ({v.samples.length})
          </p>
          <ul className="grid grid-cols-1 gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)]/40 p-3 sm:grid-cols-2">
            {v.samples.slice(0, 8).map((w) => (
              <li key={w.word} className="flex items-baseline justify-between gap-2">
                <span className="font-english text-[14px] font-[600] text-[var(--t1)]">
                  {w.word}
                </span>
                <span className="truncate font-body text-[12px] text-[var(--t2)]">
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

// ─── 바닥 CTA ────────────────────────────────────────────
// `Dialog` 가 `<footer>` 와 가로선·여백을 그린다 — 여기서는 버튼만 낸다(footer 중첩 금지).
// 참조의 바닥은 알약 버튼 줄이다: 2차는 테두리, 1차는 꽉 찬 보라.
function Footer({ variant, onClose }: { variant: DetailVariant; onClose: () => void }) {
  if (variant.type === 'vocab') {
    return (
      <>
        <button type="button" onClick={onClose} className={BTN.secondary}>
          닫기
        </button>
        {variant.secondaryHref && variant.secondaryLabel && (
          <Link href={variant.secondaryHref} onClick={onClose} className={`${BTN.soft} ml-auto`}>
            <Volume2 size={14} aria-hidden />
            {variant.secondaryLabel}
          </Link>
        )}
        <button
          type="button"
          onClick={() => variant.onCtaClick?.()}
          disabled={variant.ctaPending}
          className={`${BTN.primary} ${variant.secondaryHref && variant.secondaryLabel ? '' : 'ml-auto'}`}
        >
          {variant.ctaLabel}
        </button>
      </>
    )
  }

  // enrolled 도서면 왼쪽에 "내 학습에서 제외" 보조 액션 — 되돌릴 수 있는 동작이라 글자 버튼.
  const showUnenroll = variant.type === 'book' && variant.isEnrolled === true && !!variant.onUnenroll
  const hasComic = variant.type === 'book' && !!variant.comicHref

  return (
    <>
      {showUnenroll && variant.type === 'book' && (
        <button
          type="button"
          onClick={() => variant.onUnenroll?.()}
          disabled={variant.unenrollPending}
          className={`${BTN.text} text-[var(--t2)] hover:text-[var(--error-ink)] disabled:opacity-50`}
          title="내 학습 도서 목록에서 빼기 (단어 학습 기록은 보존)"
        >
          {variant.unenrollPending ? '제외 중…' : '− 내 학습에서 제외'}
        </button>
      )}
      <button type="button" onClick={onClose} className={`${BTN.secondary} ${showUnenroll ? 'ml-auto' : ''}`}>
        나중에
      </button>
      {/* 포맷 선택 — 만화 발행 도서만. 본문 CTA 와 동등 위계(강요 아님) */}
      {variant.type === 'book' && variant.comicHref && (
        <Link href={variant.comicHref} onClick={onClose} className={`${BTN.soft} ${showUnenroll ? '' : 'ml-auto'}`}>
          <BookImage size={14} aria-hidden />
          {variant.comicLabel ?? '만화로 읽기'}
        </Link>
      )}
      <Link
        href={variant.ctaHref}
        onClick={onClose}
        className={`${BTN.primary} ${showUnenroll || hasComic ? '' : 'ml-auto'}`}
      >
        {variant.ctaLabel}
      </Link>
    </>
  )
}

// ─── 미니 helpers ────────────────────────────────────────
function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
      <span className={DIALOG.sectionLabel}>{label}</span>
      <span className="font-display text-[16px] font-[800] tabular-nums text-[var(--t1)]">
        {value}
      </span>
      {sub && <span className="font-mono text-[10px] text-[var(--t2)]">{sub}</span>}
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
    <span className="inline-flex items-baseline gap-2 font-body text-[12px] text-[var(--t2)]">
      {icon && <span className="text-[var(--t2)]">{icon}</span>}
      <span className="text-[var(--t2)]">{label}</span>
      <strong className="font-display font-[700] text-[var(--t1)]">{value}</strong>
    </span>
  )
}

function ProgressRow({ percent, accent }: { percent: number; accent: string }) {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="font-display text-[10px] font-[700] uppercase tracking-wider text-[var(--t2)]">
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
    <p className="break-keep border-l-2 border-[var(--ju)] pl-2 font-body text-[12px] text-[var(--t2)]">{text}</p>
  )
}
