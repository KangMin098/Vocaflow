// apps/web/src/components/csat/home/CsatRail.tsx
'use client'

//
// **기출분석공간 공통 메뉴 — 모든 CSAT 화면의 항목·순서·선택·접힘·기출 찾기를 소유한다.**
//
//   내 학습 공간(/csat) — Workspace 중심 시작점. 기록·진단·공식·연습·복습은 같은 레일에서 항상 연다.
//   기출 탐구(/csat/browse) — 목적 · 유형 · 회차는 메뉴가 아니라 서가의 검색 조건이다.
//
// 일곱 장면을 사이트 메뉴로 올리지 않는다. 옛 목적별 · 유형별 · 회차별 주소(`/csat?need=` · `?tab=trap` · `/csat/browse?type=` · `?exam=`)는
// 그대로 열린다(옛 URL 전용) — 레일에서만 내려온다. 어느 메뉴를 골랐는지는 `csat_path_chosen{axis:'menu'}` 가 센다.
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BookMarked, Crosshair, FlaskConical, History, Home, Library, Map as MapIcon, Microscope, NotebookPen, Search, Sparkles, Stethoscope, Target, Timer } from 'lucide-react'

import { track } from '@/lib/analytics/client'
import { RECENT_FROM } from '@/lib/csat/trap-atlas'
import { EMPTY_SELECTION, finderItemHref } from '@/lib/csat/item-finder'
import { ItemFinderDialog } from '../browse/ItemFinderDialog'

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
/** 서가 · 문항 · 옛 목적/유형/회차 조건은 기출 탐구 메뉴를 선택한다. */
const EXPLORE: RailPlace[] = ['browse', 'item', 'need', 'type', 'exam']
export const PERSONAL_LINKS = [
  { place: 'continue', href: '/csat?view=continue', label: '이어서 · 복습', Icon: History },
  { place: 'record', href: '/csat/record', label: '내 기록', Icon: BookMarked },
  { place: 'diagnosis', href: '/csat/diagnosis', label: '내 진단', Icon: Stethoscope },
  { place: 'formulas', href: '/csat/formulas', label: '내 공식', Icon: NotebookPen },
  { place: 'practice', href: '/csat/practice', label: '연습 · 주장과 근거', Icon: FlaskConical },
] as const

const n = (value: number) => value.toLocaleString('ko-KR')

export function CsatRail({
  place,
  dueCount,
}: {
  place: RailPlace
  /** 지금 열려 있는 목적 · 유형 · 회차 id(해당 줄에 aria-current) */
  current?: string
  exams: { exam_id: string; label: string; items: number }[]
  /** 이어서 · 복습 옆 개수. 아직 기록을 못 읽었으면 null */
  dueCount: number | null
}) {
  const cur = (on: boolean) => (on ? ('page' as const) : undefined)
  // 모든 CSAT 화면은 같은 펼친 메뉴로 시작하고, 저장한 접힘 선택은 함께 따른다.
  // 왼쪽 위 표지로 전환하고 이 기기에 선택을 남긴다.
  const [collapsed, setCollapsed] = useState(false)
  const [finderOpen, setFinderOpen] = useState(false)
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

  return (<>
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
          aria-current={cur(place === 'home')}
          data-testid="rail-map"
          onClick={() => track({ name: 'csat_path_chosen', props: { axis: 'menu', need: 'none', menu: 'map' } })}
        >
          <MapIcon size={15} aria-hidden="true" />
          내 학습 공간
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
      <div className={styles.railShortcuts}>
        <div className={styles.railPersonal} role="group" aria-label="내 자료" data-testid="home-mine">
          {PERSONAL_LINKS.map(item => <Link key={item.place} href={item.href} className={styles.railItem} aria-current={cur(place === item.place)} data-menu={item.place} data-testid={item.place === 'continue' ? 'home-continue' : undefined} onClick={() => track({ name: 'csat_path_chosen', props: { axis: 'menu', need: 'none', menu: item.place } })}>
            <item.Icon size={15} aria-hidden="true" />{item.label}
            {item.place === 'continue' && dueCount ? <span className={styles.railCount} title="이어서 · 복습할 것">{n(dueCount)}</span> : null}
          </Link>)}
        </div>
        <div className={styles.railFooter}>
          <Link className={styles.railStart} href="/csat/dissect" aria-current={cur(place === 'dissect')} data-testid="home-start" onClick={() => track({ name: 'csat_resume_clicked', props: { kind: 'start', from: place === 'home' ? 'home' : 'rail' } })}><Sparkles size={14} aria-hidden="true" />처음이라면 3문항으로 시작</Link>
          <button type="button" className={styles.railSearch} data-testid="home-finder-open" aria-haspopup="dialog" onClick={() => { track({ name: 'csat_path_chosen', props: { axis: 'finder', need: 'none', origin: place === 'home' ? 'home' : 'browse', action: 'open' } }); setFinderOpen(true) }}><Search size={14} aria-hidden="true" />기출 찾기</button>
        </div>
      </div>
    </nav>
    {finderOpen && <ItemFinderDialog origin={place === 'home' ? 'home' : 'browse'} initial={EMPTY_SELECTION} hrefFor={id => finderItemHref(id, { fromMap: place === 'home' || place === 'diagnosis' })} onClose={() => setFinderOpen(false)} />}
  </>)
}
