// apps/web/src/components/csat/home/RecordScreen.tsx
'use client'

//
// **내 기록** — `/csat/record` (ia-design §2-6). 진척을 **넓이**로 보인다.
// 정답률 · 랭킹 · 뱃지는 없다(brief A2 · A7). 학습한 날은 칸만 칠하고 「연속 끊김」을 쓰지 않는다.
// 이 화면의 모든 수는 이 학습자의 기록에서 즉석으로 센 값이다(I5).

import Link from 'next/link'
import { ArrowUpRight, BookMarked, CloudOff } from 'lucide-react'

import { activeSet, coverage, dueNow, studyDays, upcoming } from '@/lib/csat/continuity'
import { ATLAS_TYPES } from '@/lib/csat/trap-atlas'
import type { RailExam } from '@/lib/csat/rail-data'

import { ContinueCard } from './ContinueCard'
import { CsatRail } from './CsatRail'
import { useCsatRecord } from './useCsatRecord'
import home from './home.module.css'
import styles from '../space/space.module.css'

const pct = (a: number, b: number) => (b > 0 ? Math.round((100 * a) / b) : 0)

export function RecordScreen({ exams, itemTypes }: { exams: RailExam[]; itemTypes: Record<string, string> }) {
  const rec = useCsatRecord()
  const cov = rec ? coverage(rec.record, (id) => itemTypes[id]) : null
  const days = rec ? studyDays(rec.record, rec.now) : []
  const plan = rec ? upcoming(rec.record, rec.now) : null
  const totalTypes = ATLAS_TYPES.length

  return (
    <div className={styles.root} data-testid="csat-record">
      <CsatRail place="record" exams={exams} dueCount={rec ? dueNow(rec.record, rec.now).length + (activeSet(rec.record) ? 1 : 0) : null} />
      <div className="min-w-0">
        <header className={styles.topbar}>
          <span className={styles.topPill}>
            <BookMarked size={13} aria-hidden="true" />내 기록
          </span>
          {rec && !rec.synced ? (
            <span className={styles.topLink} role="status">
              <CloudOff size={14} aria-hidden="true" />이 기기에만 저장 중
            </span>
          ) : null}
        </header>

        <div className={styles.canvas}>
          <div className={styles.band} style={{ height: 'clamp(180px, 15vw, 210px)' }}>
            <ContinueCard state={rec} from="record" />
          </div>
          <div className={styles.panel}>
            <section className={home.section}>
              <h2 className={home.sectionHead}>덮은 넓이</h2>
              {cov ? (
                <dl className={home.meters}>
                  <div className={home.meter}>
                    <dt>본 유형</dt>
                    <dd data-testid="record-types">
                      {cov.types} <small>/ {totalTypes}</small>
                    </dd>
                    <span className={home.bar} aria-hidden="true">
                      <span style={{ width: `${pct(cov.types, totalTypes)}%` }} />
                    </span>
                  </div>
                  <div className={home.meter}>
                    <dt>연 문항</dt>
                    <dd data-testid="record-items">{cov.items}</dd>
                  </div>
                  <div className={home.meter}>
                    <dt>예측에서 만난 오답 계열</dt>
                    <dd>{cov.families}</dd>
                  </div>
                  <div className={home.meter}>
                    <dt>내 공식</dt>
                    <dd>{cov.formulas}</dd>
                  </div>
                </dl>
              ) : (
                <p className={home.empty} aria-busy="true">기록을 확인하고 있어요…</p>
              )}
            </section>

            <section className={home.section}>
              <h2 className={home.sectionHead}>
                학습한 날 <small>최근 14일</small>
              </h2>
              <div className={home.days} role="img" aria-label={`최근 14일 중 ${days.filter(Boolean).length}일 학습`}>
                {days.map((on, i) => (
                  <span key={i} data-on={on} />
                ))}
              </div>
              <p className={home.daysLegend}>오른쪽 끝이 오늘이에요.</p>
            </section>

            <section className={home.section}>
              <h2 className={home.sectionHead}>다음 복습</h2>
              {plan ? (
                <p className={home.empty}>
                  오늘 <b>{plan.today}</b> · 내일 <b>{plan.tomorrow}</b> · 이번 주 <b>{plan.week}</b> —{' '}
                  <Link href="/csat?view=continue" className="underline underline-offset-4">
                    이어서 · 복습에서 보기
                  </Link>
                </p>
              ) : null}
            </section>

            <section className={home.section}>
              <h2 className={home.sectionHead}>
                내 공식 <small>{rec?.record.formulas.length ?? 0}</small>
              </h2>
              {rec && rec.record.formulas.length ? (
                <ul className={home.list}>
                  {rec.record.formulas.slice(0, 10).map((f) => (
                    <li key={f.tag}>
                      <Link href={`/csat/dissect?formula=${encodeURIComponent(f.tag)}`}>
                        <span className={home.grow}>{f.text}</span>
                        <small>문항 {f.sources.length}</small>
                        <ArrowUpRight size={13} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={home.empty}>해부 끝에서 「내 공식으로 저장」을 고르면 여기에 쌓여요.</p>
              )}
              <p className={home.daysLegend}>
                <Link href="/csat/formulas" className="underline underline-offset-4">
                  공식 전체 보기
                </Link>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
