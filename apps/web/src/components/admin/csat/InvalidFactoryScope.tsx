// apps/web/src/components/admin/csat/InvalidFactoryScope.tsx
import Link from 'next/link'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { factoryScopeDescription } from '@/lib/admin/factory-scope'

export function InvalidFactoryScope({ screen }: { screen: 'csat-review' | 'csat-press' }) {
  return (
    <section aria-labelledby="invalid-factory-scope" className="break-keep rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6">
      <h1 id="invalid-factory-scope" className="font-display text-xl font-semibold text-[var(--t1)]">제작 기준을 확인하세요</h1>
      <p role="alert" className="mt-3 text-sm text-[var(--t2)]">{factoryScopeDescription({ kind: 'invalid' }, false)}</p>
      <Link href="/admin/csat/new" className="mt-4 inline-flex min-h-11 items-center rounded border border-[var(--bd)] px-4 text-sm text-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]">제작 기준 다시 선택</Link>
      <AdminScreenHelp screen={screen} />
    </section>
  )
}
