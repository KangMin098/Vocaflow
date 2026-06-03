// apps/web/src/components/admin/curation/SeedDetailModal.tsx
//
// BulkFetchTab 의 도서 선택 시 표시되는 상세 미리보기 모달.
// 큐레이션 메타(Claude Code 생성) 풀 노출 — 큐레이터 선택 의사결정 보조.
//
// 노출 항목:
//   - Hero: cover · 제목 · 저자 · source pill
//   - 메타 그리드: V-Level · CEFR · 연령 · 장르 · 단어수 · 읽기시간 · 출판연도 · 인기도
//   - synopsis_ko (한국어 줄거리)
//   - learning_value (학습 가치)
//   - est_basis (V-Level 추정 근거)
//   - themes (배지)
//   - description (원문 영문 설명)
//   - 액션: 원문 링크 + Enqueue CTA

'use client'

import { useEffect } from 'react'
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  GraduationCap,
  Loader2,
  Plus,
  Tag,
  TrendingUp,
  X,
} from 'lucide-react'
import type { SeedCatalogRow } from '@/lib/library/admin-queries'

interface Props {
  row: SeedCatalogRow | null
  onClose: () => void
  onEnqueue: (row: SeedCatalogRow) => void
  enqueuing: boolean
}

// source pill 색
const SOURCE_COLOR: Record<string, string> = {
  gutenberg: 'var(--p)',
  standard_ebooks: 'var(--learn-known)',
  wikibooks: 'var(--info)',
  librivox: 'var(--active)',
  openstax: 'var(--p-dark)',
}
const SOURCE_LABEL: Record<string, string> = {
  gutenberg: 'Project Gutenberg',
  standard_ebooks: 'Standard Ebooks',
  wikibooks: 'Wikibooks',
  librivox: 'LibriVox',
  openstax: 'OpenStax',
}

export function SeedDetailModal({ row, onClose, onEnqueue, enqueuing }: Props) {
  // Esc 키 + body scroll lock
  useEffect(() => {
    if (!row) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [row, onClose])

  // unmount 안전망
  useEffect(() => {
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  if (!row) return null

  const cm = row.curation_meta
  const sourceColor = SOURCE_COLOR[row.source] ?? 'var(--t3)'
  const sourceLabel = SOURCE_LABEL[row.source] ?? row.source

  // 큐레이션 메타 없음 경우 안내
  const hasCuration = !!cm && Object.keys(cm).length > 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={row.title}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-6 md:p-10"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--r-xl)] bg-[var(--bg)] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.4)]"
      >
        {/* 닫기 */}
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-3 z-[2] flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-all hover:scale-110 hover:bg-black/70"
        >
          <X size={16} />
        </button>

        {/* Hero — cover + 제목 */}
        <div className="flex shrink-0 gap-4 border-b border-[var(--bd)] bg-[var(--bg2)] p-5">
          <div className="h-32 w-24 shrink-0 overflow-hidden rounded-[var(--r-md)] bg-[var(--bg3)] shadow-[var(--sh-sm)]">
            {row.cover_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={row.cover_url}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[var(--t4)]">
                <BookOpen size={28} />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 pt-1">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center rounded-[var(--r-full)] px-2 py-0.5 font-mono text-[10px] font-[700]"
                style={{
                  color: sourceColor,
                  background: `color-mix(in srgb, ${sourceColor} 12%, transparent)`,
                }}
              >
                {sourceLabel}
              </span>
              {cm?.genre_norm && (
                <span className="inline-flex items-center rounded-[var(--r-full)] bg-[var(--bg3)] px-2 py-0.5 font-mono text-[10px] text-[var(--t2)]">
                  {cm.genre_norm}
                </span>
              )}
              {row.imported_to_books && (
                <span className="inline-flex items-center gap-1 rounded-[var(--r-full)] border border-[var(--learn-known)] bg-[var(--learn-known-light)] px-2 py-0.5 font-mono text-[10px] font-[700] text-[var(--learn-known)]">
                  <CheckCircle2 size={10} /> 큐에 추가됨
                </span>
              )}
            </div>

            <h2 className="font-display text-[18px] font-[700] leading-tight text-[var(--t1)] line-clamp-2">
              {row.title}
            </h2>
            {row.author && (
              <p className="mt-1 font-body text-[13px] text-[var(--t2)]">
                {row.author}
              </p>
            )}

            {/* 핵심 메타 그리드 */}
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] sm:grid-cols-3">
              {row.est_v_level != null && (
                <MetaCell label="V-Level" value={`V${row.est_v_level}`} accent="var(--p)" />
              )}
              {cm?.est_cefr && (
                <MetaCell label="CEFR" value={cm.est_cefr} accent="var(--learn-known)" />
              )}
              {cm?.age_band && <MetaCell label="연령" value={cm.age_band} />}
              {row.published_year && (
                <MetaCell
                  label="출판"
                  value={String(row.published_year)}
                  icon={<Calendar size={10} />}
                />
              )}
              {row.word_count && (
                <MetaCell
                  label="단어"
                  value={row.word_count.toLocaleString()}
                  icon={<FileText size={10} />}
                />
              )}
              {row.reading_time_minutes && (
                <MetaCell
                  label="읽기"
                  value={
                    row.reading_time_minutes >= 60
                      ? `${Math.floor(row.reading_time_minutes / 60)}h ${row.reading_time_minutes % 60}m`
                      : `${row.reading_time_minutes}m`
                  }
                  icon={<Clock size={10} />}
                />
              )}
              {row.popularity_rank != null && (
                <MetaCell
                  label="인기"
                  value={`↓ ${row.popularity_rank.toLocaleString()}`}
                  icon={<TrendingUp size={10} />}
                />
              )}
              {row.language && (
                <MetaCell label="언어" value={row.language} />
              )}
            </div>
          </div>
        </div>

        {/* 본문 — 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto p-5">
          {!hasCuration && (
            <div className="flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--learn-review)] bg-[var(--learn-review-light)] p-3 text-[12px] text-[var(--learn-review)]">
              <AlertCircle size={14} />
              <span>큐레이션 정보 미생성 — "정보 없는 도서 큐에 추가" 로 신청하세요.</span>
            </div>
          )}

          {/* 줄거리 */}
          {cm?.synopsis_ko && (
            <Section title="줄거리" icon={<BookOpen size={13} />}>
              <p className="font-body text-[13px] leading-[1.65] text-[var(--t1)]">
                {cm.synopsis_ko}
              </p>
            </Section>
          )}

          {/* 학습 가치 */}
          {cm?.learning_value && (
            <Section title="학습자에게 주는 가치" icon={<GraduationCap size={13} />}>
              <p className="font-body text-[13px] leading-[1.65] text-[var(--t2)]">
                {cm.learning_value}
              </p>
            </Section>
          )}

          {/* 테마 배지 */}
          {cm?.themes && cm.themes.length > 0 && (
            <Section title="테마" icon={<Tag size={13} />}>
              <div className="flex flex-wrap gap-1.5">
                {cm.themes.map((th, i) => (
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

          {/* V-Level 추정 근거 */}
          {cm?.est_basis && (
            <Section title="V-Level 추정 근거">
              <p className="font-body text-[11.5px] italic leading-[1.6] text-[var(--t3)]">
                {cm.est_basis}
              </p>
            </Section>
          )}

          {/* 원문 영문 설명 — 큐레이션 메타와 별도 */}
          {row.description && (
            <Section title="원문 설명 (영어)">
              <p className="font-body text-[12px] leading-[1.6] text-[var(--t2)] line-clamp-6">
                {row.description}
              </p>
            </Section>
          )}

          {/* subjects (LCC subject) */}
          {row.subjects && row.subjects.length > 0 && (
            <Section title="원본 주제 (소스 메타)">
              <div className="flex flex-wrap gap-1">
                {row.subjects.slice(0, 8).map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-[var(--r-sm)] bg-[var(--bg2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--t3)]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Footer — 액션 */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--bd)] bg-[var(--bg2)] p-3">
          {row.source_url ? (
            <a
              href={row.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)]"
            >
              <ExternalLink size={12} /> 원문 페이지
            </a>
          ) : (
            <span />
          )}

          {row.imported_to_books ? (
            <span className="inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--learn-known)] bg-[var(--learn-known-light)] px-3 py-2 font-mono text-[12px] font-[700] text-[var(--learn-known)]">
              <CheckCircle2 size={12} /> 큐에 이미 추가됨
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onEnqueue(row)}
              disabled={enqueuing}
              className="inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--p)] bg-[var(--p)] px-4 py-2 font-display text-[12px] font-[700] text-[var(--ti)] hover:opacity-90 disabled:opacity-50"
            >
              {enqueuing ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Plus size={12} />
              )}
              {enqueuing ? '큐 추가 중...' : '큐에 추가 (enqueue)'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 내부 helper ───────────────────────────
function MetaCell({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: string
  icon?: React.ReactNode
  accent?: string
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="font-mono text-[9.5px] uppercase tracking-wider text-[var(--t3)]">
        {label}
      </span>
      <span
        className="inline-flex items-center gap-1 font-display text-[12.5px] font-[700] tabular-nums"
        style={{ color: accent ?? 'var(--t1)' }}
      >
        {icon}
        <span className="truncate">{value}</span>
      </span>
    </div>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mb-4">
      <h3 className="mb-1.5 inline-flex items-center gap-1.5 font-mono text-[10.5px] font-[700] uppercase tracking-[0.1em] text-[var(--t3)]">
        {icon}
        {title}
      </h3>
      <div>{children}</div>
    </section>
  )
}
