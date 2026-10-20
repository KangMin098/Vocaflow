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
import { AuthoredRunner } from '@/components/csat/authored/AuthoredRunner'
import { AUTHORED_ROLE_LABEL as ROLE_LABEL } from '@/lib/knowledge/authored/labels'
import { loginUrlWithReturn } from '@/lib/auth/redirect'
import { randomUUID } from 'node:crypto'

import { openDelivered, recordOpen, taskKeyOf } from '@/lib/csat/authored/server'
import { AUTHORED_TASK_LABEL } from '@/lib/knowledge/authored/tasks'
import { railExams } from '@/lib/csat/rail-data'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

import styles from '@/components/knowledge/practice.module.css'
import { mapReturnQuery, parseMapReturn, returnQueryOf } from '@/lib/csat/map-return'

export const metadata: Metadata = { title: '글의 중심 잡기 — 기출' }
export const dynamic = 'force-dynamic'

const MAP_HREF = '/csat/diagnosis?tab=map&view=full'

export default async function LearnPage({ params, searchParams }: { params: { id: string }; searchParams: { d?: string } & Record<string, string | string[] | undefined> }) {
  // 지도 복귀(FI-011 C) — 지도 CTA 가 실은 문맥(형식만 검증 · lib/csat/map-return)을 그대로 돌려준다. 조회 권한으로 쓰지 않는다(지도가 현재 본인 계획과 비교)
  //   돌아가는 곳은 원래 링크와 같은 전체 지도(Workspace 행 · 받은 자료 카드가 있는 화면) — 지도 홈(/csat)에는 Workspace 행이 없다(fbc5667f5 CI 실측)
  const returnHref = searchParams.from === 'map' ? `${MAP_HREF}${mapReturnQuery(parseMapReturn({ ...returnQueryOf(searchParams), map_item: params.id, map_attempt: undefined }))}` : MAP_HREF
  if (!/^[a-z0-9][a-z0-9.-]{2,80}$/.test(params.id)) notFound()
  const db = (await createClient()) as unknown as SupabaseClient
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect(loginUrlWithReturn(`/csat/learn/${params.id}${searchParams.d && /^[0-9a-f-]{36}$/i.test(searchParams.d) ? `?d=${searchParams.d}` : ''}`))
  // 출처 = 지도 · Workspace 링크의 납품 id(?d=). 같은 자료가 여러 묶음 · 역할로 납품됐으면 고르게 한다(최신 추측 금지 · FI-001)
  const opened = await openDelivered(createAdminClient() as unknown as SupabaseClient, db, user.id, `authored:${params.id}`, searchParams.d ?? null)
    .catch((e: unknown) => { console.error('[csat-learn] 자료 열기 실패', params.id, e instanceof Error ? e.message : e); throw e })
  const pill = <><BookOpenCheck size={13} aria-hidden="true" />학습 · {opened.status === 'ok' ? ROLE_LABEL[opened.view.role as keyof typeof ROLE_LABEL] ?? '자료' : '자료'}</>
  if (opened.status === 'choose') {
    return (
      <CsatShell place="practice" exams={await railExams()} pill={pill} bare>
        <div className={styles.page} data-testid="authored-choose">
          <header className={styles.head}>
            <h1>어느 학습 묶음에서 풀까요?</h1>
            <p className={styles.why}>이 자료는 여러 학습 묶음에서 받았어요. 고른 묶음의 계획에 결과가 반영돼요.</p>
          </header>
          <ul className={styles.steps}>
            {opened.choices.map((c) => (
              <li key={c.deliveryId}>
                <Link className={styles.link} href={`/csat/learn/${params.id}?d=${c.deliveryId}`}>{ROLE_LABEL[c.role as keyof typeof ROLE_LABEL] ?? c.role} · {c.deliveredAt.slice(0, 10)} 받음</Link>
              </li>
            ))}
          </ul>
        </div>
      </CsatShell>
    )
  }
  if (opened.status !== 'ok') {
    return (
      <CsatShell place="practice" exams={await railExams()} pill={pill} bare>
        <div className={styles.page}>
          <header className={styles.head}>
            <h1>{opened.status === 'not_installed' ? '자료 공급을 준비하고 있어요' : opened.status === 'revoked' ? '지금은 열 수 없는 자료예요' : '아직 받지 않은 자료예요'}</h1>
            <p className={styles.why}>
              {opened.status === 'revoked'
                ? '이 자료의 이용 승인이 철회되거나 바뀌었어요. 앞서 푼 결과는 기록에 그대로 남아 있고, 학습 지도에서 다른 자료를 받을 수 있어요.'
                : opened.status === 'not_installed'
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
  // FI-010 — 본문을 연 사실을 노출 원장에 남기고, 이 페이지의 제출은 같은 세션 id 를 쓴다(다른 페이지로 다시 열면 첫 노출이 아니다)
  const sessionId = randomUUID()
  const taskKey = await taskKeyOf(createAdminClient() as unknown as SupabaseClient, v.ref)
  const opened2 = !v.done && taskKey ? await recordOpen(createAdminClient() as unknown as SupabaseClient, { id: user.id, email: user.email ?? null }, v, taskKey, sessionId, new Date().toISOString()) : false
  // FI-010(#302) — 본문을 학습자에게 주기 전에 열기(노출) 기록을 확보한다. 기록이 실패했는데 본문을 주면, 나중의 정상 열기 · 제출이
  //   「첫 노출 · 독립 근거」로 잘못 승격된다(본문은 이미 나갔다). 그래서 미완료 자료는 기록 실패 시 본문 없이 재진입 안내만 준다(fail-closed).
  //   본문을 주지 않았으므로 다음 정상 열기가 실제 첫 공개다 — 정상 첫 열기의 독립 수행은 막지 않는다. 완료 자료(다시 보기)는 노출 판정과 무관
  if (!v.done && !opened2) {
    return (
      <CsatShell place="practice" exams={await railExams()} pill={pill} bare>
        <div className={styles.page} data-testid="authored-open-unavailable">
          <header className={styles.head}>
            <h1>자료를 열지 못했어요</h1>
            <p className={styles.why}>열기 기록을 남기지 못해 본문을 보여 드리지 않았어요. 잠시 뒤 학습 지도에서 다시 열어 주세요 — 다시 열면 처음 보는 것으로 기록돼요.</p>
          </header>
          <Link className={styles.link} href={MAP_HREF}>학습 지도로 가기</Link>
        </div>
      </CsatShell>
    )
  }
  return (
    <CsatShell place="practice" exams={await railExams()} pill={pill} bare>
      <AuthoredRunner
        id={params.id} deliveryId={v.deliveryId} role={v.role as never} format={v.format} sentences={v.sentences} stem={v.stem} choices={v.choices}
        teach={v.teach ?? null} hints={v.hints} extra={v.extra} probe={v.probe} done={v.done} retry={v.retry} annotationHash={v.annotationHash} returnHref={returnHref} taskLabel={AUTHORED_TASK_LABEL[v.taskId]}
        sessionId={opened2 ? sessionId : undefined}
      />
    </CsatShell>
  )
}
