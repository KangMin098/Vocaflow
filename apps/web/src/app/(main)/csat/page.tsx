// apps/web/src/app/(main)/csat/page.tsx
import type { Metadata } from 'next'
import { SessionHome } from '@/components/csat/session/SessionHome'
import { loadDissectionCatalog } from '@/lib/csat/dissect-catalog'
export const metadata: Metadata = { title: '기출 — 오늘의 해부', description: '정답을 알고, 출제자의 수를 예측하고 대조합니다.' }
export const dynamic = 'force-dynamic'
export default async function CsatHomePage() { return <SessionHome catalog={await loadDissectionCatalog()} /> }
