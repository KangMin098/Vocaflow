// apps/web/src/app/(app)/csat/diagnosis/page.tsx
//
// 내 진단 — 모니터링 보드(개요 · 시험 기록[기록 · 유형 · 오답 함정 · 틀린 문항] · 학습 지도). 기록한 학평 · 모평 · 수능 답안으로만 만든다.
// 새 기록 · 기록 상세는 같은 화면의 모달(?tab=records&modal=new · &record=<id>).
// 로그인 확인 뒤 서버가 service role 로 기록 + 문항 유형(번호·유형만) + 선지 함정을 읽는다.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { DiagnosisBoard, boardHref, parseBoardTab } from '@/components/csat/diagnosis/DiagnosisBoard'
import { DiagnosisShell } from '@/components/csat/diagnosis/DiagnosisShell'
import { MapScreen, parseMapView } from '@/components/csat/diagnosis/map/MapScreen'
import { MapPreparing } from '@/components/csat/diagnosis/map/MapPreparing'
import { RecordDetailModal } from '@/components/csat/diagnosis/RecordDetailModal'
import { RecordModal } from '@/components/csat/diagnosis/RecordModal'
import { learnerSession } from '@/lib/csat/diagnosis/learner'
import { loadMapPage } from '@/lib/csat/map/load'
import { parseAsOf } from '@/lib/csat/map/v4/compose'
import { todayKst } from '@/lib/csat/diagnosis/payload'
import { loadExamReport, loadPickerExams } from '@/lib/csat/diagnosis/report'
import { railExams } from '@/lib/csat/rail-data'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: '내 진단 — 기출분석공간' }
export const dynamic = 'force-dynamic'

const BASE = '/csat/diagnosis'

export default async function DiagnosisPage({ searchParams }: { searchParams: { tab?: string; view?: string; modal?: string; record?: string; focus?: string; asof?: string } }) {
  const { userId } = await learnerSession()
  if (!userId) redirect('/login?next=/csat/diagnosis')
  const { tab, view } = parseBoardTab(searchParams.tab, searchParams.view, { map: true })
  const db = createAdminClient() as unknown as SupabaseClient
  const [{ report, typeNames }, exams] = await Promise.all([
    loadExamReport(db, userId),
    searchParams.modal === 'new' ? loadPickerExams(db) : Promise.resolve(null),
  ])
  const closeHref = boardHref(BASE, tab, view)
  // 학습 지도 탭일 때만 지도 데이터를 읽는다(다른 탭의 속도를 건드리지 않는다)
  const mapData = tab === 'map' ? await loadMapPage(db, userId, new Date()) : null
  // ?asof=YYYY-MM-DD — rev4 「목표까지 필요한 학습」을 그날 기준으로 다시 분석(형식 · 미래 날짜는 무시하고 지금 분석)
  const asOf = mapData?.now ? parseAsOf(searchParams.asof, mapData.now) : undefined
  const mapSlot = tab === 'map' ? mapData ? <MapScreen data={mapData} view={parseMapView(searchParams.view)} base={BASE} asOf={asOf} /> : <MapPreparing /> : undefined
  const record = searchParams.record ? report.trend.find((t) => t.sessionId === searchParams.record) : undefined

  const modal = exams ? (
    <RecordModal exams={exams} today={todayKst(new Date())} closeHref={closeHref} diagnosisBase={BASE} />
  ) : record ? (
    <RecordDetailModal
      record={record}
      wrongs={report.wrongAll.filter((w) => w.sessionId === record.sessionId)}
      typeNames={typeNames}
      closeHref={closeHref}
      diagnosisHref={`${BASE}?focus=${record.sessionId}`}
      deleteEndpoint={`/api/csat/diagnosis/sessions?id=${record.sessionId}`}
    />
  ) : null

  return (
    <DiagnosisShell exams={await railExams()} screen="report">
      <DiagnosisBoard report={report} typeNames={typeNames} tab={tab} view={view} features={{ map: true }} mapSlot={mapSlot} base={BASE} addHref={`${BASE}?tab=records&modal=new`} modal={modal} focus={searchParams.focus} />
    </DiagnosisShell>
  )
}
