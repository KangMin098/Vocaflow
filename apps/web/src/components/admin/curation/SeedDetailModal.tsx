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
//
// 껍데기는 `ui/Dialog`(DD-68 · tines-mapping §28) — 표지는 히어로가 아니라 오른쪽 칸의
// 액자로, 제목은 크림 머리에 크게. 학습자 도서 상세(NetflixDetailSheet)와 같은 배치다.

'use client'


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
} from 'lucide-react'

import { Dialog, DialogColumns } from '@/components/ui/Dialog'
import { BTN } from '@/components/ui/tines-kit'
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
  // Esc · 바깥 · 뒤로가기 · 포커스 가둠 · 스크롤 잠금은 `ui/Dialog` 의 계약이다.
  if (!row) return null

  const cm = row.curation_meta
  const sourceColor = SOURCE_COLOR[row.source] ?? 'var(--t3)'
  const sourceLabel = SOURCE_LABEL[row.source] ?? row.source

  // 큐레이션 메타 없음 경우 안내
  const hasCuration = !!cm && Object.keys(cm).length > 0

  return (
    <Dialog
      onClose={onClose}
      size="xl"
      crumbs={['Admin', '씨앗 카탈로그', sourceLabel]}
      title={row.title}
      ariaLabel={row.title}
      byline={row.author}
      tags={[
        ...(cm?.genre_norm ? [cm.genre_norm] : []),
        ...(row.est_v_level != null ? [`V${row.est_v_level}`] : []),
        ...(cm?.est_cefr ? [`CEFR ${cm.est_cefr}`] : []),
        ...(cm?.age_band ? [cm.age_band] : []),
      ]}
      meta={
        row.imported_to_books ? (
          <span className="inline-flex items-center gap-1 font-display font-[700] text-[var(--success-ink)]">
            <CheckCircle2 size={13} aria-hidden /> 큐에 추가됨
          </span>
        ) : (
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[11px] font-[700]"
            style={{ color: sourceColor, background: `color-mix(in srgb, ${sourceColor} 12%, transparent)` }}
          >
            {sourceLabel}
          </span>
        )
      }
      footer={
        <>
          {row.source_url && (
            <a href={row.source_url} target="_blank" rel="noopener noreferrer" className={BTN.secondary}>
              <ExternalLink size={13} aria-hidden /> 원문 페이지
            </a>
          )}
          {row.imported_to_books ? (
            <span className="ml-auto inline-flex items-center gap-2 rounded-full border border-[var(--success)] bg-[var(--success-light)] px-4 py-2 font-mono text-[12px] font-[700] text-[var(--success-ink)]">
              <CheckCircle2 size={12} aria-hidden /> 큐에 이미 추가됨
            </span>
          ) : (
            <button type="button" onClick={() => onEnqueue(row)} disabled={enqueuing} className={`${BTN.primary} ml-auto`}>
              {enqueuing ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Plus size={13} aria-hidden />}
              {enqueuing ? '큐 추가 중...' : '큐에 추가 (enqueue)'}
            </button>
          )}
        </>
      }
    >
      <DialogColumns
        side={
          <>
            {/* 표지 액자 — 참조 팝업의 미리보기 자리 */}
            <figure className="aspect-[3/4] overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg3)]">
              {row.cover_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={row.cover_url} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[var(--t2)]">
                  <BookOpen size={28} aria-hidden />
                </div>
              )}
            </figure>

            {/* 핵심 메타 — 참조는 좁은 칸에 수치를 세로로 쌓는다 */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4 text-[11px]">
              {row.est_v_level != null && <MetaCell label="V-Level" value={`V${row.est_v_level}`} accent="var(--p)" />}
              {cm?.est_cefr && <MetaCell label="CEFR" value={cm.est_cefr} accent="var(--success-ink)" />}
              {cm?.age_band && <MetaCell label="연령" value={cm.age_band} />}
              {row.published_year && (
                <MetaCell label="출판" value={String(row.published_year)} icon={<Calendar size={10} />} />
              )}
              {row.word_count && (
                <MetaCell label="단어" value={row.word_count.toLocaleString()} icon={<FileText size={10} />} />
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
              {row.language && <MetaCell label="언어" value={row.language} />}
            </div>
          </>
        }
        main={
          <div>
          {!hasCuration && (
            <div className="flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--learn-review)] bg-[var(--learn-review-light)] p-3 text-[12px] text-[var(--learn-review)]">
              <AlertCircle size={14} />
              <span>큐레이션 정보 미생성 — &ldquo;정보 없는 도서 큐에 추가&rdquo; 로 신청하세요.</span>
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
              <div className="flex flex-wrap gap-2">
                {cm.themes.map((th, i) => (
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

          {/* V-Level 추정 근거 */}
          {cm?.est_basis && (
            <Section title="V-Level 추정 근거">
              <p className="font-body text-[11.5px] italic leading-[1.6] text-[var(--t2)]">
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
                    className="inline-flex items-center rounded-[var(--r-sm)] bg-[var(--bg2)] px-2 py-1 font-mono text-[10px] text-[var(--t2)]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Section>
          )}
          </div>
        }
      />
    </Dialog>
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
    <div className="flex flex-col gap-1 min-w-0">
      <span className="font-mono text-[9.5px] uppercase tracking-wider text-[var(--t2)]">
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
      <h3 className="mb-1.5 inline-flex items-center gap-2 font-mono text-[10.5px] font-[700] uppercase tracking-[0.1em] text-[var(--t2)]">
        {icon}
        {title}
      </h3>
      <div>{children}</div>
    </section>
  )
}
