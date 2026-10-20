// apps/web/src/lib/admin/text-ink.ts
// Status indicators keep their original palette; small status text uses existing AA ink tokens.
import { STATUS_KO } from '@/lib/csat/factory-model'

const INK: Readonly<Record<string, string>> = {
  [STATUS_KO.pass.color.toLowerCase()]: 'var(--success-ink)',
  [STATUS_KO.short.color.toLowerCase()]: 'var(--warning-ink)',
  [STATUS_KO.blocked.color.toLowerCase()]: 'var(--error-ink)',
  [STATUS_KO.unmeasured.color.toLowerCase()]: 'var(--t2)',
  'var(--memory-stable)': 'var(--success-ink)',
  'var(--memory-shaky)': 'var(--warning-ink)',
  'var(--memory-risk)': 'var(--error-ink)',
  'var(--memory-new)': 'var(--t2)',
  'var(--learn-known)': 'var(--learn-known-ink)',
  'var(--learn-review)': 'var(--learn-review-ink)',
  'var(--learn-error)': 'var(--learn-error-ink)',
  'var(--learn-fresh)': 'var(--info-ink)',
  'var(--success)': 'var(--success-ink)',
  'var(--warning)': 'var(--warning-ink)',
  'var(--error)': 'var(--error-ink)',
  'var(--info)': 'var(--info-ink)',
  'var(--active)': 'var(--active-ink)',
  'var(--t4)': 'var(--t2)',
  'var(--t5)': 'var(--t2)',
}

export function adminTextInk(color: string | null | undefined): string | undefined {
  if (color == null) return undefined
  return INK[color.toLowerCase().replace(/\s/g, '')] ?? color
}
