// apps/web/src/app/(main)/csat/formulas/page.tsx
import type { Metadata } from 'next'
import { ProgressView } from '@/components/csat/session/ProgressView'
import { loadDissectionCatalog } from '@/lib/csat/dissect-catalog'
export const metadata: Metadata = { title: '내 공식 — 기출' }
export const dynamic = 'force-dynamic'
export default async function FormulasPage() { return <ProgressView catalog={await loadDissectionCatalog()} /> }
// @form: 계보 — 내가 대조해 만든 공식이 어느 기출에서 나왔는지 계열 → 공식 → 출처로 접히는 이력
