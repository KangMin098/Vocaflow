// apps/web/src/components/text-viewer/UrlInput.tsx
// URL 입력 영역 (웹 페이지 → 본문 추출)
// Phase 2에서 실제 추출, 지금은 UI만

'use client'

import { cn } from '@/lib/utils/cn'
import { AlertCircle, Link as LinkIcon, Loader2 } from 'lucide-react'
import { useState } from 'react'

export interface UrlInputProps {
  onUrlSubmit?: (url: string) => Promise<void>
}

export function UrlInput({ onUrlSubmit }: UrlInputProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isValidUrl = (str: string): boolean => {
    try {
      const u = new URL(str)
      return u.protocol === 'http:' || u.protocol === 'https:'
    } catch {
      return false
    }
  }

  const handleSubmit = async () => {
    setError('')

    if (!url.trim()) {
      setError('URL을 입력해주세요')
      return
    }

    if (!isValidUrl(url)) {
      setError('올바른 URL 형식이 아닙니다 (https://...)')
      return
    }

    setLoading(true)
    try {
      // Phase 2에서 실제 fetch + 본문 추출
      await new Promise((resolve) => setTimeout(resolve, 1500))
      await onUrlSubmit?.(url)
    } catch (err) {
      setError('페이지를 가져올 수 없습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border bg-bg',
          'transition-all duration-normal',
          error
            ? 'border-error'
            : 'focus-within:ring-p/20 border-bd focus-within:border-bdf focus-within:ring-2'
        )}
      >
        <LinkIcon
          size={18}
          className="pointer-events-none absolute left-s-4 top-1/2 -translate-y-1/2 text-t3"
        />

        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder="https://www.ted.com/talks/..."
          disabled={loading}
          className="w-full bg-transparent py-s-4 pl-s-12 pr-s-4 font-body text-base text-t1 placeholder:text-t3 focus:outline-none disabled:opacity-60"
        />
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mt-s-2 flex items-center gap-s-2 font-body text-sm text-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* 가져오기 버튼 */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!url || loading}
        className={cn(
          'mt-s-3 h-11 w-full rounded-md',
          'border border-bd bg-bg2',
          'font-display text-sm font-medium text-t1',
          'transition-all duration-normal',
          'hover:border-t2 hover:bg-bg3',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'flex items-center justify-center gap-s-2'
        )}
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>페이지 분석 중...</span>
          </>
        ) : (
          <>
            <LinkIcon size={14} />
            <span>웹 페이지에서 가져오기</span>
          </>
        )}
      </button>

      {/* 지원 사이트 안내 */}
      <div className="mt-s-4 rounded-lg border border-bd bg-bg2 p-s-3">
        <div className="mb-s-2 font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-t3">
          잘 작동하는 사이트
        </div>
        <div className="grid grid-cols-2 gap-s-1 font-body text-xs text-t2">
          <span>· TED Talks (ted.com)</span>
          <span>· BBC News</span>
          <span>· Medium</span>
          <span>· Wikipedia (영문)</span>
          <span>· The Guardian</span>
          <span>· 영어 블로그</span>
        </div>
      </div>
    </div>
  )
}
