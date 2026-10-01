// apps/web/src/components/csat/diagnosis/DiagnosisHomeCard.tsx
//
// 기출 홈(/csat)의 진단 요약 카드 — 현재 등급 · 핵심 약점 하나 · 추천 하나 · 「시험 기록 추가」.
// 진단 이력이 없으면 「진단 시작」 카드. 코드(A4 · C4)는 드러내지 않는다.

import { ClipboardPen, Stethoscope } from 'lucide-react'
import Link from 'next/link'

import { ATTRIBUTE_CODES } from '@/lib/csat/diagnosis/engine/types'
import { ATTRIBUTE_NAME, CONFIDENCE_LABEL, lineText } from '@/lib/csat/diagnosis/labels'
import type { SnapshotView } from '@/lib/csat/diagnosis/snapshot'

const link =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-display text-[13px] font-[700] text-[var(--t1)] hover:border-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'
const primary =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-md)] bg-[var(--p)] px-4 font-display text-[13px] font-[800] text-[var(--on-p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'

export type HomeDiagnosis = { kind: 'anon' } | { kind: 'none' } | { kind: 'has'; snapshot: SnapshotView }

export function DiagnosisHomeCard({ state }: { state: HomeDiagnosis }) {
  if (state.kind !== 'has') {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4" data-testid="dx-home-start">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="flex items-center gap-1.5 text-[15px] font-[800] text-[var(--t1)]">
            <Stethoscope size={16} aria-hidden="true" /> 내 영어 진단
          </h2>
          <p className="break-keep font-body text-[13px] text-[var(--t2)]">모의고사 기록이나 20문항 진단 테스트로 지금 등급과 약점을 알려 드려요.</p>
        </div>
        <Link className={primary} href={state.kind === 'anon' ? '/login?next=/csat/diagnosis/start' : '/csat/diagnosis/start'}>진단 시작</Link>
      </section>
    )
  }
  const s = state.snapshot
  const weakest = ATTRIBUTE_CODES.filter((c) => s.attributeMastery?.[c]?.status === 'ok')
    .sort((a, b) => (s.attributeMastery[a].value as number) - (s.attributeMastery[b].value as number))[0]
  const rec = s.recommendedLines[0] ? lineText(s.recommendedLines[0].code) : null
  return (
    <section className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4" data-testid="dx-home-summary">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[15px] font-[800] text-[var(--t1)]">
          <Stethoscope size={16} aria-hidden="true" /> 내 영어 진단
        </h2>
        <span className="font-body text-[12px] text-[var(--t2)]">신뢰도 {CONFIDENCE_LABEL[s.confidence]}</span>
      </div>
      <dl className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <div>
          <dt className="font-body text-[12px] text-[var(--t2)]">지금 등급</dt>
          <dd className="font-display text-[20px] font-[800] text-[var(--t1)]">{s.gradeEst ? `${s.gradeEst}등급` : '—'}</dd>
        </div>
        <div>
          <dt className="font-body text-[12px] text-[var(--t2)]">핵심 약점</dt>
          <dd className="break-keep font-body text-[14px] text-[var(--t1)]">{weakest ? ATTRIBUTE_NAME[weakest].learner : '기록이 더 필요해요'}</dd>
        </div>
        <div>
          <dt className="font-body text-[12px] text-[var(--t2)]">추천</dt>
          <dd className="break-keep font-body text-[14px] text-[var(--t1)]">{rec ? rec.title : '기록이 더 필요해요'}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Link className={primary} href="/csat/diagnosis/attempts/new"><ClipboardPen size={15} aria-hidden="true" />시험 기록 추가</Link>
        <Link className={link} href="/csat/diagnosis">리포트 보기</Link>
      </div>
    </section>
  )
}
