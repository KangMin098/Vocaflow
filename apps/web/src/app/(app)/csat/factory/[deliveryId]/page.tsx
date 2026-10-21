// apps/web/src/app/(app)/csat/factory/[deliveryId]/page.tsx
//
// 단계 1D — 납품된 공장 DCP 지도 연습(중심 의미 · 주제/제목/요지) 한 문항을 연다. 명시적 납품 id 만 받는다(최신 추측 없음).
// 학습자 본인 세션으로 factory_dcp_open 을 부른다 — DB 가 소유 · Workspace 열림 · 현재 유효 · 계보 · 제품 링크를 판정하고,
// 답변 전에는 passage · stem · choices 만 내려 준다. 열 수 없으면 닫힌 이유와 Workspace 복귀만 보여 준다(새 학습 링크 없음).
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { BookOpenCheck } from 'lucide-react'

import { CsatShell } from '@/components/csat/home/CsatShell'
import { FactoryDcpRunner } from '@/components/csat/factory/FactoryDcpRunner'
import { loginUrlWithReturn } from '@/lib/auth/redirect'
import { isUuid, openFactoryDelivery, STATE_COPY } from '@/lib/csat/map/v62/factory-bridge/dcp-learning'
import { beforeAnswerSupport, LESSON_SENTENCES, LESSON_SOURCE_ID, LESSON_STEPS, type LessonStep } from '@/lib/csat/map/v62/factory-bridge/source-lesson'
import type { SupplyClient } from '@/lib/csat/map/v62/factory-bridge/dcp-supply'
import { mapReturnQuery, parseMapReturn, returnQueryOf } from '@/lib/csat/map-return'
import { railExams } from '@/lib/csat/rail-data'
import type { DcpItem } from '@/lib/learner/dcp'
import { createClient } from '@/lib/supabase/server'

import styles from '@/components/knowledge/practice.module.css'

export const metadata: Metadata = { title: '글의 중심 잡기 연습 — 기출' }
export const dynamic = 'force-dynamic'

const MAP_HREF = '/csat/diagnosis?tab=map&view=full'

export default async function FactoryDcpPage({ params, searchParams }: { params: { deliveryId: string }; searchParams: Record<string, string | string[] | undefined> }) {
  // 돌아가는 곳 = 링크를 건 같은 Workspace(전체 지도 · 받은 자료 카드). 지도 문맥은 형식만 검증해 그대로 돌려준다
  const fromMap = searchParams.from === 'map'
  const ctxQuery = fromMap ? mapReturnQuery(parseMapReturn(returnQueryOf(searchParams))) : ''
  const returnHref = `${MAP_HREF}${ctxQuery}`
  if (!isUuid(params.deliveryId)) notFound()
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  // 로그인 뒤에도 같은 Workspace 로 돌아오도록 검증한 지도 문맥을 그대로 싣는다
  if (!user) redirect(loginUrlWithReturn(`/csat/factory/${params.deliveryId}${fromMap ? `?from=map${ctxQuery}` : ''}`))
  const r = await openFactoryDelivery(db as unknown as SupplyClient, params.deliveryId)
  const pill = <><BookOpenCheck size={13} aria-hidden="true" />학습 · 안내 연습</>

  if (!r.ok) {
    const title = r.code === 'not_installed' ? '연습 자료를 준비하고 있어요' : r.code === 'query_failed' || r.code === 'bad_shape' ? '자료를 불러오지 못했어요' : '지금은 열 수 없는 자료예요'
    const why = r.code in STATE_COPY ? STATE_COPY[r.code as keyof typeof STATE_COPY]
      : r.code === 'not_installed' ? '검수와 승인이 끝난 공장 연습 자료가 생기면 Workspace 에서 열 수 있어요.'
      : '잠시 뒤 Workspace 에서 다시 열어 주세요. 앞서 푼 결과는 기록에 그대로 남아 있어요.'
    return (
      <CsatShell place="practice" exams={await railExams()} pill={pill} bare>
        <div className={styles.page} data-testid="factory-dcp-unavailable" data-code={r.code}>
          <header className={styles.head}>
            <h1 className="break-keep">{title}</h1>
            <p className={`${styles.why} break-keep`}>{why}</p>
          </header>
          <Link className={styles.link} href={returnHref}>Workspace 로 돌아가기</Link>
        </div>
      </CsatShell>
    )
  }

  const o = r.opened
  const item: DcpItem = {
    id: o.item.id, type: o.item.type, paragraphIdx: o.item.paragraphIdx,
    payload: { passage: o.item.payload.passage, choices: o.item.payload.choices, stemKo: o.item.payload.stem_ko, underline: null, summarySentence: null },
  }
  // 2B — 교수 자료의 원문이면 단계별 답변 전 지원만 싣는다(시범 없음). 원문 content SHA · 순서는 저장 때 DB 가 다시 확인한다
  const step = o.sourceId === LESSON_SOURCE_ID && (LESSON_STEPS as readonly string[]).includes(o.item.type) ? (o.item.type as LessonStep) : null
  const lesson = step ? { step, before: beforeAnswerSupport(step), sentences: LESSON_SENTENCES, returnQuery: fromMap ? `?from=map${ctxQuery}` : '' } : undefined
  return (
    <CsatShell place="practice" exams={await railExams()} pill={pill} bare>
      <div className={styles.page} data-testid="factory-dcp-page">
        <header className={styles.head}>
          <h1 className="break-keep">글의 중심 잡기 · 안내 연습</h1>
          <p className={`${styles.why} break-keep`}>글을 읽고 중심 내용을 고르세요. 답을 내기 전에는 정답과 해설이 보이지 않아요.</p>
        </header>
        <FactoryDcpRunner deliveryId={o.deliveryId} item={item} returnHref={returnHref} attempts={o.attempts} lesson={lesson} />
      </div>
    </CsatShell>
  )
}
