// apps/web/src/app/admin/csat/authoring/page.tsx
// ⑤ 집필 — 유형 25 × 수준 9 재고 전량과 사다리 밖 재고.

import { requireAdmin } from '@/lib/auth/require-admin'
import { loadAuthorView } from '@/lib/csat/factory-line-views'

import { AuthorClient } from './AuthorClient'
import Link from 'next/link'
import { loadExplainView } from '@/lib/csat/factory-line-views'
import { ExplainClient } from '../explain/ExplainClient'
import { adminCompatibilityHref, type AdminSearchParams } from '@/lib/admin/navigation'

export const dynamic = 'force-dynamic'

export default async function AdminCsatAuthorPage({
  searchParams = {},
}: {
  searchParams?: AdminSearchParams
}) {
  await requireAdmin('/admin/csat/authoring')
  const explanation = searchParams.view === 'explanation'
  const content = explanation ? (
    <ExplainClient {...await loadExplainView()} />
  ) : (
    <AuthorClient {...await loadAuthorView()} />
  )
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="문항·해설 작업" className="flex flex-wrap gap-2">
        {[
          { label: '문항 제작', view: 'items' },
          { label: '해설 작성·검토', view: 'explanation' },
        ].map((item) => (
          <Link
            key={item.view}
            href={adminCompatibilityHref(`/admin/csat/authoring?view=${item.view}`, searchParams)}
            aria-current={explanation === (item.view === 'explanation') ? 'page' : undefined}
            className="inline-flex min-h-11 items-center rounded border border-[var(--bd)] px-4 text-sm text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--bdf)] aria-[current=page]:bg-[var(--bg3)] aria-[current=page]:font-semibold"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {content}
    </div>
  )
}
