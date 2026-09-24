// apps/web/src/components/csat/home/ContinuePanel.tsx
'use client'

//
// **이어서 · 복습 판** — `/csat?view=continue`. 표 자리에 선다(ia-design §1-2).
// 세 무리: 멈춘 세트 · 복습 일정 · 최근 연 문항. 모두 **한 번 누르면** 그 자리가 열린다.

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import { track } from '@/lib/analytics/client'
import { activeSet, dueNow, upcoming } from '@/lib/csat/continuity'
import { toItemSlug } from '@/lib/csat/item-slug'
import { ATLAS_TYPES } from '@/lib/csat/trap-atlas'

import type { CsatRecordState } from './useCsatRecord'
import styles from './home.module.css'

const itemLabel = (id: string) => id.replace('#', ' · ') + '번'
const dayLabel = (t: number, now: number) => {
  const d = Math.round((t - now) / 86_400_000)
  return d <= 0 ? '오늘' : d === 1 ? '내일' : `${d}일 뒤`
}

export function ContinuePanel({ state, itemTypes }: { state: CsatRecordState | null; itemTypes: Record<string, string> }) {
  if (!state) return <p className={`${styles.section} ${styles.empty}`} aria-busy="true">기록을 확인하고 있어요…</p>
  const { record, now } = state
  const set = activeSet(record)
  const due = dueNow(record, now)
  const later = record.queue.filter((q) => q.due > now).sort((a, b) => a.due - b.due)
  const plan = upcoming(record, now)
  const views = [...(record.views ?? [])].sort((a, b) => b.at - a.at).slice(0, 8)
  const typeName = (id: string) => ATLAS_TYPES.find((t) => t.id === itemTypes[id])?.name ?? '기출'

  return (
    <div data-testid="continue-panel">
      <section className={styles.section}>
        <h2 className={styles.sectionHead}>멈춘 세트</h2>
        {set ? (
          <ul className={styles.list}>
            <li>
              <Link href="/csat/dissect?resume=1" onClick={() => track({ name: 'csat_resume_clicked', props: { kind: 'set', from: 'home' } })}>
                <span className={styles.grow}>
                  {typeName(set.first)} · {itemLabel(set.first)}부터
                </span>
                <small>
                  {set.index + 1}/{set.total} · 약 {set.minutes}분
                </small>
                <ArrowUpRight size={13} aria-hidden="true" />
              </Link>
            </li>
          </ul>
        ) : (
          <p className={styles.empty}>멈춘 세트가 없어요. 홈의 카드에서 새 3문항을 시작할 수 있어요.</p>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHead}>
          복습 <small>오늘 {plan.today} · 내일 {plan.tomorrow} · 이번 주 {plan.week}</small>
        </h2>
        {due.length || later.length ? (
          <ul className={styles.list}>
            {[...due, ...later].slice(0, 8).map((q) => (
              <li key={q.tag}>
                {q.due <= now ? (
                  <Link href="/csat/dissect" onClick={() => track({ name: 'csat_resume_clicked', props: { kind: 'review', from: 'home' } })}>
                    <span className={styles.grow}>{itemLabel(q.source)}에서 만난 설계 — 다른 문항으로 다시</span>
                    <small>{dayLabel(q.due, now)}</small>
                    <ArrowUpRight size={13} aria-hidden="true" />
                  </Link>
                ) : (
                  <span className={styles.static}>
                    <span className={styles.grow}>{itemLabel(q.source)}에서 만난 설계</span>
                    <small>{dayLabel(q.due, now)}</small>
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>잡힌 복습이 없어요. 해부 끝에서 「헷갈려요」를 고르면 3일 뒤 다른 문항으로 다시 물어요.</p>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHead}>최근 연 문항</h2>
        {views.length ? (
          <ul className={styles.list}>
            {views.map((v) => (
              <li key={v.id}>
                <Link href={`/csat/item/${toItemSlug(v.id)}`}>
                  <span className={styles.grow}>
                    {typeName(v.id)} · {itemLabel(v.id)}
                  </span>
                  <small>{new Date(v.at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</small>
                  <ArrowUpRight size={13} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>아직 연 문항이 없어요.</p>
        )}
      </section>
    </div>
  )
}
