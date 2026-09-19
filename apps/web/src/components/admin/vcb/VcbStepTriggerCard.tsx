// apps/web/src/components/admin/vcb/VcbStepTriggerCard.tsx

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Database, ShieldCheck, Sparkles, Rocket, Copy, Check } from 'lucide-react'

// Server → Client 경계에서 Lucide 컴포넌트(함수) 직렬화 불가 → string key 매핑.
const ICON_MAP = {
  database: Database,
  shieldCheck: ShieldCheck,
  sparkles: Sparkles,
  rocket: Rocket,
} as const

export type VcbStepIconKey = keyof typeof ICON_MAP

interface Props {
  step: number
  icon: VcbStepIconKey
  title: string
  description: string
  enabled: boolean
  primaryAction:
    | { label: string; href: string; command?: never }
    | { label: string; command: string; href?: never }
  stats: Array<{ label: string; value: number | string }>
  blockers?: string[]
}

export function VcbStepTriggerCard({
  step,
  icon,
  title,
  description,
  enabled,
  primaryAction,
  stats,
  blockers = [],
}: Props) {
  const [copied, setCopied] = useState(false)
  const Icon = ICON_MAP[icon]

  const handleCopy = async () => {
    if (!('command' in primaryAction) || !primaryAction.command) return
    try {
      await navigator.clipboard.writeText(primaryAction.command)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const isHref = 'href' in primaryAction && primaryAction.href !== undefined
  const hasBlockers = blockers.length > 0

  return (
    <article
      className="flex flex-col gap-3 p-5 rounded-[var(--r-lg)] border"
      style={{
        background: 'var(--bg)',
        borderColor: 'var(--bd)',
        opacity: enabled ? 1 : 0.5,
        pointerEvents: enabled ? 'auto' : 'none',
      }}
    >
      <header className="flex items-center gap-2">
        <Icon className="w-4 h-4" style={{ color: 'var(--p)' }} />
        <span
          className="font-mono text-xs uppercase tracking-wider"
          style={{ color: 'var(--t3)' }}
        >
          Step {step}
        </span>
      </header>

      <h4 className="font-display font-semibold text-base m-0" style={{ color: 'var(--t1)' }}>
        {title}
      </h4>
      <p className="text-sm m-0" style={{ color: 'var(--t2)' }}>
        {description}
      </p>

      <dl
        className="grid grid-cols-2 gap-2 p-3 rounded-[var(--r-md)] m-0"
        style={{ background: 'var(--bg2)' }}
      >
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-[11px]" style={{ color: 'var(--t3)' }}>
              {s.label}
            </dt>
            <dd className="font-display font-semibold m-0" style={{ color: 'var(--t1)' }}>
              {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
            </dd>
          </div>
        ))}
      </dl>

      {hasBlockers && (
        <ul
          className="list-none p-3 m-0 rounded-[var(--r-md)] text-xs"
          style={{
            background: 'var(--warning-light)',
            color: 'var(--warning)',
            border: '1px solid var(--warning)',
          }}
        >
          {blockers.map((b, i) => (
            <li key={i} className="my-0.5">
              ⚠️ {b}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 items-center mt-auto">
        {isHref ? (
          <Link
            href={primaryAction.href}
            className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-[var(--r-md)] font-display text-sm font-medium text-white"
            style={{ background: 'var(--admin-strong)' }}
          >
            {primaryAction.label}
          </Link>
        ) : (
          <>
            <code
              className="flex-1 font-mono text-xs px-3 py-2 rounded-[var(--r-md)] border overflow-hidden text-ellipsis whitespace-nowrap"
              style={{
                background: 'var(--bg2)',
                borderColor: 'var(--bd)',
                color: 'var(--t2)',
              }}
            >
              {primaryAction.command}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[44px] inline-flex items-center gap-1 px-3 py-2 rounded-[var(--r-md)] text-xs font-display border"
              style={{
                color: 'var(--t2)',
                borderColor: 'var(--bd)',
                background: 'var(--bg)',
              }}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </>
        )}
      </div>
    </article>
  )
}
