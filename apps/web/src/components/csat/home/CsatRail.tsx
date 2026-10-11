// apps/web/src/components/csat/home/CsatRail.tsx
'use client'

//
// **기출분석공간 메뉴 — 모든 /csat 화면이 같이 쓴다.**
//
// 2026-10-11 사용자 결정: 메뉴는 세 줄만 둔다 — 연습 · 주장과 근거 · 내 공식 · 근거 문장 찾기.
// 홈 · 이어서 · 내 기록 · 내 진단 · 서가 · 목적별 나머지 · 유형별 · 회차별은 메뉴에서 뺐다(화면 자체는 남는다 — 로고가 홈으로 간다).

import Link from 'next/link'
import { FlaskConical, Microscope, NotebookPen, Search } from 'lucide-react'

import { track } from '@/lib/analytics/client'

import styles from '../space/space.module.css'

export type RailPlace = 'home' | 'continue' | 'record' | 'diagnosis' | 'browse' | 'need' | 'type' | 'exam' | 'item' | 'practice' | 'formulas' | 'dissect'
export type NeedId = 'start' | 'killer' | 'trap' | 'evidence' | 'recent'

export function CsatRail({
  place,
  current,
}: {
  place: RailPlace
  /** 지금 열려 있는 목적 id(해당 줄에 aria-current) */
  current?: string
}) {
  const cur = (on: boolean) => (on ? ('page' as const) : undefined)

  return (
    <nav className={styles.rail} aria-label="기출분석공간 메뉴" data-testid="csat-rail">
      <Link className={styles.mark} href="/csat">
        <span className={styles.markGlyph} aria-hidden="true">
          <Microscope size={15} />
        </span>
        기출분석공간
      </Link>

      <div className={styles.group}>
        <Link className={styles.railItem} href="/csat/practice" aria-current={cur(place === 'practice')} data-testid="rail-practice">
          <FlaskConical size={15} aria-hidden="true" />
          연습 · 주장과 근거
        </Link>
        <Link className={styles.railItem} href="/csat/formulas" aria-current={cur(place === 'formulas')} data-testid="rail-formulas">
          <NotebookPen size={15} aria-hidden="true" />
          내 공식
        </Link>
        <Link
          className={styles.railItem}
          href="/csat/browse?status=map"
          aria-current={cur(place === 'need' && current === 'evidence')}
          data-need="evidence"
          onClick={() => track({ name: 'csat_path_chosen', props: { axis: 'need', need: 'evidence' } })}
        >
          <Search size={15} aria-hidden="true" />
          근거 문장 찾기
        </Link>
      </div>
    </nav>
  )
}
