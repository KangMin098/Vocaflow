// apps/web/src/app/(app)/csat/formulas/page.tsx
import type { Metadata } from 'next'
import { NotebookPen } from 'lucide-react'
import { CsatShell } from '@/components/csat/home/CsatShell'
import { ProgressView } from '@/components/csat/session/ProgressView'
import { railExams } from '@/lib/csat/rail-data'
import { loadDissectionCatalog } from '@/lib/csat/dissect-catalog'
export const metadata: Metadata = { title: '내 공식 — 기출' }
export const dynamic = 'force-dynamic'
export default async function FormulasPage() {
  const [catalog, exams] = await Promise.all([loadDissectionCatalog(), railExams()])
  return (
    <CsatShell place="formulas" exams={exams} pill={<><NotebookPen size={13} aria-hidden="true" />내 공식</>}>
      <ProgressView catalog={catalog} />
    </CsatShell>
  )
}
// @form: 계보 — 내가 대조해 만든 공식이 어느 기출에서 나왔는지 계열 → 공식 → 출처로 접히는 이력
