// apps/web/src/components/csat/home/CsatRail.tsx
'use client'

//
// **기출분석공간 메뉴 — 공간/탐구와 홈의 개인 자료.** (v3 M1 · CSAT_LEARNER_UX_V3 §1 · §7)
//
//   내 학습 지도(/csat)  — Workspace 중심 시작점. 홈은 children 슬롯에 기록·진단·공식·연습·복습·기출 찾기를 둔다.
//   기출 탐구(/csat/browse) — 목적 · 유형 · 회차는 메뉴가 아니라 서가의 검색 조건이다.
//
// 일곱 장면을 사이트 메뉴로 올리지 않는다. 옛 목적별 · 유형별 · 회차별 주소(`/csat?need=` · `?tab=trap` · `/csat/browse?type=` · `?exam=`)는
// 그대로 열린다(옛 URL 전용) — 레일에서만 내려온다. 어느 메뉴를 골랐는지는 `csat_path_chosen{axis:'menu'}` 가 센다.
import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { Crosshair, Home, Library, Map as MapIcon, Microscope, Search, Sparkles, Target, Timer } from 'lucide-react'

import { track } from '@/lib/analytics/client'
import { RECENT_FROM } from '@/lib/csat/trap-atlas'

import styles from '../space/space.module.css'

export type RailPlace = 'home' | 'continue' | 'record' | 'diagnosis' | 'browse' | 'need' | 'type' | 'exam' | 'item' | 'practice' | 'formulas' | 'dissect'
export type NeedId = 'start' | 'killer' | 'trap' | 'evidence' | 'recent'

export const NEEDS: { id: NeedId; label: string; href: string; Icon: typeof Home }[] = [
  { id: 'start', label: '처음 시작하기', href: '/csat/dissect', Icon: Sparkles },
  { id: 'killer', label: '킬러 유형 잡기', href: '/csat?need=killer', Icon: Target },
  { id: 'trap', label: '오답 선지 설계 보기', href: '/csat?tab=trap', Icon: Crosshair },
  { id: 'evidence', label: '근거 문장 찾기', href: '/csat/browse?status=map', Icon: Search },
  { id: 'recent', label: '최근 기출부터', href: `/csat/browse?from=${RECENT_FROM}`, Icon: Timer },
]

const RAIL_KEY = 'csat-rail'
/** 기출 탐구 메뉴가 켜지는 자리 — 서가 · 문항 · 옛 목적/유형/회차 조건. 나머지(지도 · 기록 · 진단 · 공식 · 연습 · 세션)는 내 학습 지도 */
const EXPLORE: RailPlace[] = ['browse', 'item', 'need', 'type', 'exam']

const n = (value: number) => value.toLocaleString('ko-KR')

export function CsatRail({
  place,
  dueCount,
  children,
}: {
  place: RailPlace
  /** 지금 열려 있는 목적 · 유형 · 회차 id(해당 줄에 aria-current) */
  current?: string
  exams: { exam_id: string; label: string; items: number }[]
  /** 이어서 · 복습 옆 개수. 아직 기록을 못 읽었으면 null */
  dueCount: number | null
  children?: ReactNode
}) {
  const cur = (on: boolean) => (on ? ('page' as const) : undefined)
  // 홈 첫 기기는 참조처럼 펼친 메뉴, 다른 화면은 기존의 좁은 레일이다. 저장한 접힘 선택은 우선한다.
  // 왼쪽 위 표지로 전환하고 이 기기에 선택을 남긴다.
  const [collapsed, setCollapsed] = useState(place !== 'home')
  useEffect(() => {
    try {
      if (localStorage.getItem(RAIL_KEY) === 'open') setCollapsed(false)
      if (localStorage.getItem(RAIL_KEY) === 'closed') setCollapsed(true)
    } catch {
      // 저장소를 못 쓰면 각 화면의 기본값을 유지한다.
    }
  }, [])
  const toggle = () => {
    setCollapsed((c) => {
      const next = !c
      try {
        localStorage.setItem(RAIL_KEY, next ? 'closed' : 'open')
      } catch {
        // 저장 실패는 화면 전환에 영향 없음
      }
      return next
    })
  }

  return (
    <nav className={styles.rail} aria-label="기출분석공간 메뉴" data-testid="csat-rail" data-collapsed={collapsed ? 'true' : 'false'}>
      <Link
        className={styles.mark}
        href="/csat"
        onClick={(e) => {
          e.preventDefault()
          toggle()
        }}
        aria-expanded={!collapsed}
        aria-label={collapsed ? '기출분석공간 메뉴 펼치기' : '기출분석공간 메뉴 접기'}
        title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
        data-testid="rail-toggle"
      >
        <span className={styles.markGlyph} aria-hidden="true">
          <Microscope size={15} />
        </span>
        기출분석공간
      </Link>

      <div className={styles.group}>
        <Link
          className={styles.railItem}
          href="/csat"
          aria-current={cur(!EXPLORE.includes(place))}
          data-testid="rail-map"
          onClick={() => track({ name: 'csat_path_chosen', props: { axis: 'menu', need: 'none', menu: 'map' } })}
        >
          <MapIcon size={15} aria-hidden="true" />
          내 학습 공간
          {dueCount ? <span className={styles.railCount} title="이어서 · 복습할 것">{n(dueCount)}</span> : null}
        </Link>
        <Link
          className={styles.railItem}
          href="/csat/browse"
          aria-current={cur(EXPLORE.includes(place))}
          data-testid="rail-browse"
          onClick={() => track({ name: 'csat_path_chosen', props: { axis: 'menu', need: 'none', menu: 'browse' } })}
        >
          <Library size={15} aria-hidden="true" />
          기출 탐구
        </Link>
      </div>
      {children}
    </nav>
  )
}
