// apps/web/src/app/(app)/csat/learn/[id]/page.tsx
//
// 납품받은 창작 자료 실행 — FINAL §8. 이 학습자에게 납품된 자료만 열린다(미리보기 없음 · 평가 지문이 납품 전에 새지 않는다).
// 납품이 없으면 「아직 받지 않은 자료」, 창작 공급 SQL 미적용이면 「준비 중」 안내. 다 푼 뒤에는 학습 지도로 돌아가 변화를 본다.
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'

import { BookOpenCheck } from 'lucide-react'

import { CsatShell } from '@/components/csat/home/CsatShell'
import { AuthoredRunner, ROLE_LABEL } from '@/components/csat/authored/AuthoredRunner'
import { loginUrlWithReturn } from '@/lib/auth/redirect'
import { openDelivered } from '@/lib/csat/authored/server'
import { railExams } from '@/lib/csat/rail-data'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

import styles from '@/components/knowledge/practice.module.css'

export const metadata: Metadata = { title: '글의 중심 잡기 — 기출' }
export const dynamic = 'force-dynamic'

const MAP_HREF = '/csat/diagnosis?tab=map&view=full'

export default async function LearnPage({ params }: { params: { id: string } }) {
  if (!/^[a-z0-9][a-z0-9.-]{2,80}$/.test(params.id)) notFound()
  const db = (await createClient()) as unknown as SupabaseClient
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect(loginUrlWithReturn(`/csat/learn/${params.id}`))
  const opened = await openDelivered(createAdminClient() as unknown as SupabaseClient, db, user.id, `authored:${params.id}`)
  const pill = <><BookOpenCheck size={13} aria-hidden="true" />학습 · {opened.status === 'ok' ? ROLE_LABEL[opened.view.role as keyof typeof ROLE_LABEL] ?? '자료' : '자료'}</>
  if (opened.status !== 'ok') {
    return (
      <CsatShell place="practice" exams={await railExams()} pill={pill} bare>
        <div className={styles.page}>
          <header className={styles.head}>
            <h1>{opened.status === 'not_installed' ? '자료 공급을 준비하고 있어요' : '아직 받지 않은 자료예요'}</h1>
            <p className={styles.why}>
              {opened.status === 'not_installed'
                ? '검수와 승인이 끝난 자료만 학습 지도에서 받을 수 있어요. 지금은 승인된 자료가 없어요.'
                : '학습 지도의 학습 묶음에서 「자료 받기」를 누르면, 나에게 맞는 자료가 이곳에 열려요.'}
            </p>
          </header>
          <Link className={styles.link} href={MAP_HREF}>학습 지도로 가기</Link>
        </div>
      </CsatShell>
    )
  }
  const v = opened.view
  return (
    <CsatShell place="practice" exams={await railExams()} pill={pill} bare>
      <AuthoredRunner
        id={params.id} role={v.role as never} sentences={v.sentences} stem={v.stem} choices={v.choices}
        teach={v.teach ?? null} hints={v.hints} probe={v.probe} done={v.done} returnHref={MAP_HREF}
      />
    </CsatShell>
  )
}
