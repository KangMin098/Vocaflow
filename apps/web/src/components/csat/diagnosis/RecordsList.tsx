// apps/web/src/components/csat/diagnosis/RecordsList.tsx
//
// 시험 기록 목록 — 머리(제목 · 개수 · 검색 · 검은 원형 +), 표 한 줄 = 기록 한 회. 줄을 누르면 그 기록 모달이 열린다.

'use client'

import { Plus, Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type { ExamReport } from '@/lib/csat/diagnosis/engine/exam-report'

import s from './board.module.css'

const pct = (v: number) => `${Math.round(v * 100)}%`

export function RecordsList({ trend, base, addHref }: { trend: ExamReport['trend']; base: string; addHref: string }) {
  const recordHref = (id: string) => `${base}?tab=records&record=${id}`
  const router = useRouter()
  const [q, setQ] = useState('')
  const rows = [...trend].reverse().filter((t) => !q.trim() || t.label.includes(q.trim()) || t.takenAt.includes(q.trim()))

  return (
    <div>
      <div className={s.listHead}>
        <span className={s.listTitle}>
          시험 기록 <span className={s.count}>{trend.length}</span>
        </span>
        <div className={s.actions}>
          <label className={s.search}>
            <Search size={15} aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="시험 이름 · 날짜" aria-label="시험 기록 찾기" />
          </label>
          <Link href={addHref} className={s.plus} aria-label="시험 기록 추가"><Plus size={18} aria-hidden="true" /></Link>
        </div>
      </div>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr><th>시험</th><th>응시일</th><th>점수</th><th>등급</th><th>오답</th><th>듣기</th><th>독해</th></tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.sessionId} className={s.rowClick} onClick={() => router.push(recordHref(t.sessionId))}>
                <td>
                  <Link href={recordHref(t.sessionId)} className={s.rowLink} onClick={(e) => e.stopPropagation()}>
                    <span className={s.icon}>{t.grade ?? '–'}</span>
                    {t.label}
                  </Link>
                  {t.mode === 'retake' && <span className={s.chip} style={{ marginLeft: 8 }}>다시 푼 기출</span>}
                  {t.quality !== 'trusted' && <span className={s.chip} style={{ marginLeft: 8 }} title={t.qualityReasons.join(' · ')}>진단 제외 · 입력 확인 필요</span>}
                </td>
                <td className={s.num}>{t.takenAt}</td>
                <td className={s.num}>{t.raw}</td>
                <td className={s.num}>{t.grade ?? '—'}</td>
                <td className={s.num}>{t.wrong}</td>
                <td className={s.num}>{pct(t.listening)}</td>
                <td className={s.num}>{pct(t.reading)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className={s.muted}>찾는 기록이 없어요.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
