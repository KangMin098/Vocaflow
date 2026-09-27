// apps/web/src/app/admin/knowledge/sources/csat/page.tsx
// 기출 원천 — Codex 2026-09-28 전수 조사(docs/reports/csat-source-origin-audit-20260928.md).
// 지문 원문은 보이지 않는다: 문항 번호 · 서지 · 근거 링크 · 등급만. 미확인(G)은 목록 대신 개수로.
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { GradeMark, KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { requireAdmin } from '@/lib/auth/require-admin'
import { GRADE_LABEL, share } from '@/lib/knowledge/labels'
import { countByGrade, listCsatOrigins } from '@/lib/knowledge/server'

export const dynamic = 'force-dynamic'

export default async function CsatOriginsPage() {
  await requireAdmin('/admin/knowledge/sources/csat')
  const frame = {
    title: '기출 원천',
    question: '수능·모평 지문은 어떤 책·논문에서 왔는가',
    help: <AdminScreenHelp screen="knowledge-csat-origins" />,
    back: { href: '/admin/knowledge/sources', label: '근거 · 출처' },
  }
  let origins
  try {
    origins = await listCsatOrigins()
  } catch {
    return (
      <KnowledgeFrame {...frame}>
        <LoadFailed what="기출 원천" href="/admin/knowledge/sources/csat" />
      </KnowledgeFrame>
    )
  }
  const grades = countByGrade(origins)
  const known = origins.filter((o) => o.grade !== 'G')
  const knownShare = share(known.length, origins.length)

  return (
    <KnowledgeFrame {...frame}>
      <p className="mb-6 text-sm text-[var(--t2)]">
        고유 지문 <b className="tabular-nums text-[var(--t1)]">{origins.length}</b>개 중 원천을 댈 수 있는 것{' '}
        <b className="tabular-nums text-[var(--t1)]">{known.length}</b>개
        {knownShare !== null && <> ({knownShare}%)</>} · 직접 확인(A) <b className="tabular-nums text-[var(--t1)]">{grades.A}</b> ·
        미확인 <b className="tabular-nums text-[var(--t1)]">{grades.G}</b>. 표본이 작으니 「수능 지문 전체가 ~이다」로 읽지 않는다.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] border-collapse text-sm">
          <caption className="sr-only">원천이 확인되거나 유력한 기출 지문</caption>
          <thead>
            <tr className="border-b border-[var(--bd)] text-left text-[var(--t2)]">
              <th scope="col" className="py-2 pr-3 font-medium">문항</th>
              <th scope="col" className="py-2 pr-3 font-medium">등급</th>
              <th scope="col" className="py-2 pr-3 font-medium">원천</th>
              <th scope="col" className="py-2 font-medium">근거</th>
            </tr>
          </thead>
          <tbody>
            {known.map((o) => (
              <tr key={o.passageSha256} className="border-b border-[var(--bd)] align-top">
                <th scope="row" className="py-3 pr-3 text-left font-mono font-normal text-[var(--t1)]">
                  {o.itemIds.join(' · ')}
                </th>
                <td className="py-3 pr-3">
                  <GradeMark grade={o.grade} label={GRADE_LABEL[o.grade]} />
                </td>
                <td className="py-3 pr-3 text-[var(--t1)]">
                  <i>{o.sourceTitle}</i>
                  <span className="block text-xs text-[var(--t2)]">
                    {[o.sourceAuthors.join(', '), o.sourcePublisher, o.sourceYear].filter(Boolean).join(' · ')}
                  </span>
                </td>
                <td className="py-3">
                  <ul className="space-y-1">
                    {o.evidence.map((e) => (
                      <li key={e.url}>
                        <a
                          href={e.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex min-h-11 items-center underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
                        >
                          {e.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </KnowledgeFrame>
  )
}
