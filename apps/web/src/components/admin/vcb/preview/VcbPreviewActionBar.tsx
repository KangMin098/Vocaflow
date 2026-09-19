// apps/web/src/components/admin/vcb/preview/VcbPreviewActionBar.tsx

'use client'

import { Loader2, Upload, XCircle } from 'lucide-react'

interface Props {
  totalCount: number
  rejectedCount: number
  importableCount: number
  isPending: boolean
  hasWarning: boolean
  onImport: () => void
}

export function VcbPreviewActionBar({
  totalCount,
  rejectedCount,
  importableCount,
  isPending,
  hasWarning,
  onImport,
}: Props) {
  const isDanger = importableCount === 0

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 border-t shadow-[var(--sh-md)]"
      style={{ background: 'var(--bg)', borderColor: 'var(--bd)' }}
    >
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
        {rejectedCount > 0 ? (
          <div
            className="flex items-center gap-2 px-2 py-1 rounded-[var(--r-md)] text-xs font-mono"
            style={{ background: 'var(--error-light)', color: 'var(--error)' }}
          >
            <XCircle className="w-3.5 h-3.5" />
            {rejectedCount}건 거부 표시
          </div>
        ) : null}

        <div className="flex-1 text-sm" style={{ color: 'var(--t2)' }}>
          <span style={{ color: 'var(--t1)', fontWeight: 600 }}>
            {importableCount.toLocaleString()}
          </span>{' '}
          건 import 됩니다
          {rejectedCount > 0 && (
            <span style={{ color: 'var(--t3)' }}> · {totalCount} 전체 - {rejectedCount} 거부</span>
          )}
        </div>

        <button
          type="button"
          onClick={onImport}
          disabled={isPending || isDanger}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-[var(--r-md)] font-display text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: hasWarning ? 'var(--bg2)' : 'var(--p)',
            color: hasWarning ? 'var(--p)' : 'var(--ti)',
            border: hasWarning ? '1px solid var(--p)' : 'none',
          }}
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          DB 에 import
          {hasWarning && (
            <span className="text-[10px] font-mono px-2 py-1 rounded-[var(--r-sm)]"
              style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
              주의
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
