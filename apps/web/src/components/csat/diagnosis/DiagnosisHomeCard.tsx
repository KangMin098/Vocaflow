// apps/web/src/components/csat/diagnosis/DiagnosisHomeCard.tsx
//
// 기출 홈(/csat)의 내 진단 카드 — 최근 시험 점수 · 등급 · 기록 수와 「시험 기록」 버튼. 기록이 없으면 시작 안내 한 줄.

import Link from 'next/link'

import s from './diagnosis.module.css'

export type HomeDiagnosis =
  | { kind: 'anon' }
  | { kind: 'none' }
  | { kind: 'error' }
  | { kind: 'has'; latest: { label: string; raw: number; grade: number | null; takenAt: string }; count: number }

export function DiagnosisHomeCard({ state }: { state: HomeDiagnosis }) {
  const head = (
    <div className={s.cardHead}>
      <h2 className={s.cardTitle}>내 진단</h2>
      {state.kind === 'has' && <span className={s.cardNote}>기록 {state.count}회</span>}
    </div>
  )
  if (state.kind === 'has') {
    return (
      <section className={s.card} data-testid="dx-home-summary" style={{ margin: '16px 0' }}>
        {head}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div className={s.score}>
            <span className={s.scoreBig} style={{ fontSize: 32 }}>
              {state.latest.raw}
              <span className={s.scoreUnit}>점</span>
            </span>
            {state.latest.grade !== null && <span className={s.gradePill}>{state.latest.grade}등급</span>}
            <span className={s.scoreLabel}>{state.latest.label} · {state.latest.takenAt}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/csat/diagnosis" className={s.secondary}>진단 보기</Link>
            <Link href="/csat/diagnosis/attempts/new" className={s.primary}>시험 기록</Link>
          </div>
        </div>
      </section>
    )
  }
  return (
    <section className={s.card} data-testid={state.kind === 'error' ? 'dx-home-error' : 'dx-home-start'} style={{ margin: '16px 0' }}>
      {head}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <p className={s.lead} style={{ marginTop: 0 }}>
          {state.kind === 'error'
            ? '내 진단을 지금 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.'
            : '푼 학평 · 모의평가 · 수능의 답을 적으면 점수 흐름과 약한 유형을 보여 드려요.'}
        </p>
        <Link href={state.kind === 'anon' ? '/login?next=/csat/diagnosis/attempts/new' : '/csat/diagnosis/attempts/new'} className={s.primary}>
          시험 기록
        </Link>
      </div>
    </section>
  )
}
