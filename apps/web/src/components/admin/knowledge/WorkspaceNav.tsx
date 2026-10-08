// apps/web/src/components/admin/knowledge/WorkspaceNav.tsx
// 학습 원리 5개 업무 공간 + 공간 안 탭(2026-10-08 vNext · 정본 docs/methodology/VNEXT_ARCHITECTURE.md §5).
// 기존 8 라우트(본질·원리 · 방법론 · 검토 대기 · 근거·출처 · 기출 원천 · 전문가 · 공백 · 가져오기 원장)는 URL 그대로 공간의 탭이 된다.
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { WORKSPACES, workspaceOf } from '@/lib/knowledge/vnext-labels'

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'

export function WorkspaceNav() {
  const pathname = usePathname() ?? '/admin/knowledge'
  const current = workspaceOf(pathname)
  return (
    <nav aria-label="학습 원리 업무 공간" className="mb-6 border-b border-[var(--bd)]" data-testid="knowledge-workspaces">
      <ol className="flex flex-wrap gap-1">
        {WORKSPACES.map((w, i) => {
          const on = current?.key === w.key
          return (
            <li key={w.key}>
              <Link
                href={w.href}
                aria-current={on ? 'page' : undefined}
                title={w.question}
                className={`inline-flex min-h-11 items-center gap-2 rounded-t px-3 text-sm ${FOCUS} ${on ? 'border-b-2 border-[var(--p)] font-semibold text-[var(--t1)]' : 'text-[var(--t2)] hover:text-[var(--t1)]'}`}
              >
                <span className="font-mono text-xs text-[var(--t3)]">{String.fromCharCode(65 + i)}</span>
                {w.label}
              </Link>
            </li>
          )
        })}
      </ol>
      {current && current.tabs.length > 0 && (
        <ul className="flex flex-wrap gap-1 pb-2 pt-1" aria-label={`${current.label} 탭`}>
          {current.tabs.map((t) => {
            const on = pathname === t.href
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={on ? 'page' : undefined}
                  className={`inline-flex min-h-11 items-center rounded px-3 text-xs ${FOCUS} ${on ? 'bg-[var(--bg2,rgba(0,0,0,0.05))] font-semibold text-[var(--t1)]' : 'text-[var(--t2)] hover:text-[var(--t1)]'}`}
                >
                  {t.label}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </nav>
  )
}
