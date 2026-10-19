// apps/web/src/components/admin/AdminWorkInbox.tsx
import Link from 'next/link'
import type { DashboardStats } from '@/lib/admin/dashboard-stats'

export function AdminWorkInbox({ stats }: { stats: DashboardStats }) {
  const tasks = [
    { label: '실패한 도서 확인', count: stats.books.failed, href: '/admin/curation?view=library&status=failed' },
    { label: '실패한 짧은 글 확인', count: stats.articles.failed, href: '/admin/articles?stage=review&status=failed' },
    { label: '도서 검토 대기', count: stats.books.ready, href: '/admin/curation?view=review&status=ready' },
    { label: '짧은 글 검토 대기', count: stats.articles.ready, href: '/admin/articles?stage=review&status=ready' },
    { label: '사전 누락 후보 판정', count: stats.words.pending, href: '/admin/pending-words?status=pending' },
  ].filter(task => task.count !== 0)
  return (
    <section aria-labelledby="admin-inbox-heading" className="mb-6 rounded-[var(--r-md)] border border-[var(--bd)] p-4">
      <h2 id="admin-inbox-heading" className="text-base font-semibold">지금 처리할 일</h2>
      <p className="mt-1 break-keep text-xs text-[var(--t2)]">도서·짧은 글·사전 누락의 원천 큐별 조회입니다. 합계나 전체 업무 완료율로 계산하지 않습니다.</p>
      {tasks.length ? <ul className="mt-2 divide-y divide-[var(--bd)]">{tasks.map(task => <li key={task.href}><Link href={task.href} className="flex min-h-11 items-center justify-between gap-3 text-sm underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--bdf)]"><span>{task.label}</span><span>{task.count === null ? '조회 불가 · 원천 확인' : `${task.count.toLocaleString()}건`}</span></Link></li>)}</ul> : <p className="mt-3 text-sm text-[var(--t2)]">조회한 원천 큐에는 현재 대기 작업이 없습니다.</p>}
    </section>
  )
}
