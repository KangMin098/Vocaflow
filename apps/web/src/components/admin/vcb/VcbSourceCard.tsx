// apps/web/src/components/admin/vcb/VcbSourceCard.tsx
// Source 목록 카드. P5c.4 에서 storage_key 표시 추가.

import { FileText } from 'lucide-react'
import type { SourceSummary } from '@vocaflow/vcb-curate-core'

function extractStorageKey(notes: string | null): string | null {
  if (!notes) return null
  const match = notes.match(/^storage_key=([^\n]+)$/m)
  return match ? match[1]!.trim() : null
}

interface Props {
  source: SourceSummary
}

const KIND_LABELS: Record<string, string> = {
  frequency_list: '빈도 리스트',
  corpus: '코퍼스',
  dictionary: '사전',
  curated_list: '큐레이션',
  ai_generated: 'AI 생성',
}

const KIND_COLORS: Record<string, { bg: string; text: string }> = {
  frequency_list: { bg: 'var(--info-light)', text: 'var(--info)' },
  corpus: { bg: 'var(--p-light)', text: 'var(--p)' },
  dictionary: { bg: 'var(--success-light)', text: 'var(--success)' },
  curated_list: { bg: 'var(--warning-light)', text: 'var(--warning)' },
  ai_generated: { bg: 'var(--p-light)', text: 'var(--p)' },
}

const TIER_COLORS: Record<string, { bg: string; text: string }> = {
  T1: { bg: 'var(--success-light)', text: 'var(--success)' },
  T2: { bg: 'var(--warning-light)', text: 'var(--warning)' },
  T3: { bg: 'var(--error-light)', text: 'var(--error)' },
}

const TIER_LABELS: Record<string, string> = {
  T1: 'T1 · 자유 사용',
  T2: 'T2 · attribution',
  T3: 'T3 · 저장 금지',
}

export function VcbSourceCard({ source }: Props) {
  const kindStyle = KIND_COLORS[source.kind] ?? KIND_COLORS.corpus!
  const tierStyle = TIER_COLORS[source.license_tier] ?? TIER_COLORS.T2!
  const storageKey = extractStorageKey(source.notes)

  return (
    <article
      className="flex flex-col gap-3 p-5 rounded-[var(--r-lg)] border"
      style={{
        background: 'var(--bg)',
        borderColor: 'var(--bd)',
      }}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3
            className="font-display font-semibold text-base m-0 truncate"
            style={{ color: 'var(--t1)' }}
          >
            {source.title}
          </h3>
          <p
            className="font-mono text-xs m-0 mt-0.5 truncate"
            style={{ color: 'var(--t3)' }}
          >
            {source.slug}
          </p>
        </div>
        <span
          className="px-2 py-0.5 text-[11px] rounded-[var(--r-sm)] font-mono whitespace-nowrap"
          style={{ background: tierStyle.bg, color: tierStyle.text }}
        >
          {source.license_tier}
        </span>
      </header>

      <div className="flex gap-2 flex-wrap">
        <span
          className="px-2 py-0.5 text-[11px] rounded-[var(--r-sm)]"
          style={{ background: kindStyle.bg, color: kindStyle.text }}
        >
          {KIND_LABELS[source.kind] ?? source.kind}
        </span>
        <span
          className="px-2 py-0.5 text-[11px] rounded-[var(--r-sm)] font-mono"
          style={{ background: 'var(--bg2)', color: 'var(--t3)' }}
        >
          {source.language}
        </span>
        <span
          className="px-2 py-0.5 text-[11px] rounded-[var(--r-sm)]"
          style={{ background: 'var(--bg2)', color: 'var(--t3)' }}
        >
          {TIER_LABELS[source.license_tier]}
        </span>
      </div>

      <p
        className="text-xs m-0 line-clamp-2"
        style={{ color: 'var(--t2)' }}
        title={source.citation}
      >
        {source.citation}
      </p>

      {source.url && (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono truncate"
          style={{ color: 'var(--p)' }}
        >
          {source.url}
        </a>
      )}

      {storageKey && (
        <div
          className="flex items-center gap-1.5 text-[11px] font-mono"
          style={{ color: 'var(--success)' }}
          title="vocab-sources-raw 버킷에 업로드된 파일"
        >
          <FileText className="w-3 h-3" />
          {storageKey}
        </div>
      )}

      <footer
        className="flex items-center justify-between pt-3 border-t"
        style={{ borderColor: 'var(--bd)' }}
      >
        <span className="text-[11px]" style={{ color: 'var(--t3)' }}>
          {source.run_count > 0
            ? `${source.run_count}개 run 에서 사용`
            : '사용된 run 없음'}
        </span>
        <span className="text-[11px] font-mono" style={{ color: 'var(--t3)' }}>
          #{source.id}
        </span>
      </footer>
    </article>
  )
}
