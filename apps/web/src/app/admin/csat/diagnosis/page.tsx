// apps/web/src/app/admin/csat/diagnosis/page.tsx
//
// 영어 진단 — 관리자 현황. 학습자 수 · 최근 진단 · 시험별 태깅 완료율 · 진단 테스트 풀의 역량 커버리지.
// 숫자는 전부 즉석 조회다(I5 — 상수 금지).

import type { SupabaseClient } from '@supabase/supabase-js'
import Link from 'next/link'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { DxHeader, DxNav, pct, tdCls, thCls } from '@/components/admin/csat-diagnosis/ui'
import { requireAdmin } from '@/lib/auth/require-admin'
import { loadExamTagging, loadLearners, loadPool, poolCoverage } from '@/lib/csat/diagnosis/admin'
import { ATTRIBUTE_CODES } from '@/lib/csat/diagnosis/engine/types'
import { ATTRIBUTE_NAME, CONFIDENCE_LABEL } from '@/lib/csat/diagnosis/labels'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function DiagnosisDashboardPage() {
  await requireAdmin('/admin/csat/diagnosis')
  const db = createAdminClient() as unknown as SupabaseClient
  const [exams, learners, pool] = await Promise.all([loadExamTagging(db), loadLearners(db), loadPool(db)])
  const scorable = exams.filter((e) => e.hasKey)
  const coverage = poolCoverage(pool)
  const activePool = pool.filter((p) => p.active).length

  return (
    <div className="flex flex-col gap-5">
      <DxHeader title="영어 진단 — 현황" lead="학습자 진단이 믿을 만한지 보는 화면이에요. 태깅이 끝나 「진단 반영」을 켠 시험만 역량·함정 진단에 쓰이고, 나머지는 점수만 반영돼요.">
        <AdminScreenHelp screen="csat-diagnosis" />
      </DxHeader>
      <DxNav current="/admin/csat/diagnosis" />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['진단 학습자', `${learners.length}명`],
          ['진단 스냅샷이 있는 학습자', `${learners.filter((l) => l.snapshot).length}명`],
          ['채점 가능한 시험', `${scorable.length}회`],
          ['진단 반영 시험', `${exams.filter((e) => e.ready).length}회`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[var(--r-md)] border border-[var(--bd)] p-3">
            <div className="font-body text-[12px] text-[var(--t2)]">{k}</div>
            <div className="font-display text-[20px] font-[800] text-[var(--t1)]">{v}</div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-display text-[15px] font-[800] text-[var(--t1)]">최근 진단</h3>
        {learners.length === 0 ? (
          <p className="font-body text-[13px] text-[var(--t2)]">아직 진단을 받은 학습자가 없어요.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead><tr><th className={thCls}>학습자</th><th className={thCls}>기록</th><th className={thCls}>능력(보정)</th><th className={thCls}>예상 등급</th><th className={thCls}>신뢰도</th><th className={thCls}>계산 시각</th></tr></thead>
            <tbody>
              {learners.slice(0, 10).map((l) => (
                <tr key={l.userId}>
                  <td className={tdCls}><Link className="underline" href={`/admin/csat/diagnosis/learners/${l.userId}`}>{l.email ?? l.userId.slice(0, 8)}</Link></td>
                  <td className={tdCls}>{l.sessions}회</td>
                  <td className={tdCls}>{l.snapshot?.ability ?? '—'}</td>
                  <td className={tdCls}>{l.snapshot?.gradeEst ? `${l.snapshot.gradeEst}등급` : '—'}</td>
                  <td className={tdCls}>{l.snapshot ? CONFIDENCE_LABEL[l.snapshot.confidence as keyof typeof CONFIDENCE_LABEL] : '—'}</td>
                  <td className={tdCls}>{l.snapshot?.computedAt.slice(0, 16).replace('T', ' ') ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-display text-[15px] font-[800] text-[var(--t1)]">시험별 태깅 완료율 (채점 가능한 시험)</h3>
        <table className="w-full border-collapse">
          <thead><tr><th className={thCls}>시험</th><th className={thCls}>검수</th><th className={thCls}>완료율</th><th className={thCls}>공식 오답률</th><th className={thCls}>진단 반영</th></tr></thead>
          <tbody>
            {scorable.map((e) => (
              <tr key={e.id}>
                <td className={tdCls}><Link className="underline" href={`/admin/csat/diagnosis/exams/${encodeURIComponent(e.id)}`}>{e.label} <span className="text-[var(--t2)]">({e.id})</span></Link></td>
                <td className={tdCls}>{e.reviewed}/{e.items}</td>
                <td className={tdCls}>{pct(e.reviewed, e.items)}</td>
                <td className={tdCls}>{e.errorRates}/{e.items}</td>
                <td className={tdCls}>{e.ready ? '켜짐' : '꺼짐 — 점수만'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-display text-[15px] font-[800] text-[var(--t1)]">진단 테스트 풀 — 활성 {activePool}문항</h3>
        <table className="w-full border-collapse">
          <thead><tr><th className={thCls}>역량</th><th className={thCls}>덮는 문항</th><th className={thCls}>가중치 합</th></tr></thead>
          <tbody>
            {ATTRIBUTE_CODES.map((c) => (
              <tr key={c}>
                <td className={tdCls}>{c} {ATTRIBUTE_NAME[c].admin}</td>
                <td className={tdCls}>{coverage[c].items}{coverage[c].items === 0 && c !== 'A7' ? ' — 비어 있음' : ''}</td>
                <td className={tdCls}>{coverage[c].weight}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="break-keep font-body text-[12px] text-[var(--t2)]">A7 듣기는 진단 테스트에 듣기 문항이 없어 비어 있는 것이 정상이에요.</p>
      </section>
    </div>
  )
}
