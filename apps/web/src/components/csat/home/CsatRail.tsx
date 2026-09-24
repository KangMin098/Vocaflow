// apps/web/src/components/csat/home/CsatRail.tsx
'use client'

//
// **기출분석공간 메뉴 — 모든 /csat 목록 화면(홈 · 서가 · 내 기록)이 같이 쓴다.** (ia-design §1-1)
//
//   홈 · 이어서·복습(n) · 내 기록 · 전체 서가
//   목적별  — 니즈 축. 한 줄 = 미리 짠 필터 한 벌(URL). 새 데이터가 없다.
//   유형별  — 자료 축. 서가를 그 유형으로 연다.
//   회차별  — 시험지 축. 서가를 그 회차로 연다.
//
// 목적별 · 유형별 · 회차별은 **같은 도착지**(서가의 번호 칩 → `/csat/item/[slug]`)로 간다.
// 어느 축으로 들어왔는지는 `csat_path_chosen` 한 이벤트가 센다(분모를 가르지 않는다).
// 대응 자료가 없는 니즈(등급 판정 · 구문 · 정답률 · EBS 연계 · 시간 재기)는 메뉴에 두지 않는다 —
// 없는 것을 있는 것처럼 두지 않는다(ia-design §6).

import Link from 'next/link'
import { BookMarked, ChevronDown, Crosshair, Hash, History, Home, Layers, Library, Microscope, Search, Sparkles, Target, Timer } from 'lucide-react'

import { track } from '@/lib/analytics/client'
import { ATLAS_TYPES, RECENT_FROM } from '@/lib/csat/trap-atlas'

import styles from '../space/space.module.css'

export type RailPlace = 'home' | 'continue' | 'record' | 'browse' | 'need' | 'type' | 'exam'
export type NeedId = 'start' | 'killer' | 'trap' | 'evidence' | 'recent'

export const NEEDS: { id: NeedId; label: string; href: string; Icon: typeof Home }[] = [
  { id: 'start', label: '처음 시작하기', href: '/csat/dissect', Icon: Sparkles },
  { id: 'killer', label: '킬러 유형 잡기', href: '/csat?need=killer', Icon: Target },
  { id: 'trap', label: '오답 선지 설계 보기', href: '/csat?tab=trap', Icon: Crosshair },
  { id: 'evidence', label: '근거 문장 찾기', href: '/csat/browse?status=map', Icon: Search },
  { id: 'recent', label: '최근 기출부터', href: `/csat/browse?from=${RECENT_FROM}`, Icon: Timer },
]

const n = (value: number) => value.toLocaleString('ko-KR')

export function CsatRail({
  place,
  current,
  exams,
  dueCount,
}: {
  place: RailPlace
  /** 지금 열려 있는 목적 · 유형 · 회차 id(해당 줄에 aria-current) */
  current?: string
  exams: { exam_id: string; label: string; items: number }[]
  /** 이어서 · 복습 옆 개수. 아직 기록을 못 읽었으면 null */
  dueCount: number | null
}) {
  const types = [...ATLAS_TYPES].sort((a, b) => b.items - a.items || a.name.localeCompare(b.name))
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
        <Link className={styles.railItem} href="/csat" aria-current={cur(place === 'home')}>
          <Home size={15} aria-hidden="true" />
          홈
        </Link>
        <Link className={styles.railItem} href="/csat?view=continue" aria-current={cur(place === 'continue')} data-testid="rail-continue">
          <History size={15} aria-hidden="true" />
          이어서 · 복습
          {dueCount ? <span className={styles.railCount}>{n(dueCount)}</span> : null}
        </Link>
        <Link className={styles.railItem} href="/csat/record" aria-current={cur(place === 'record')}>
          <BookMarked size={15} aria-hidden="true" />
          내 기록
        </Link>
        <Link className={styles.railItem} href="/csat/browse" aria-current={cur(place === 'browse')}>
          <Library size={15} aria-hidden="true" />
          전체 서가
        </Link>
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <div className={styles.groupHead}>목적별</div>
        {NEEDS.map(({ id, label, href, Icon }) => (
          <Link
            key={id}
            className={styles.railItem}
            href={href}
            aria-current={cur(place === 'need' && current === id)}
            data-need={id}
            onClick={() => track({ name: 'csat_path_chosen', props: { axis: 'need', need: id } })}
          >
            <Icon size={15} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </div>

      <div className={styles.divider} />

      <details className={styles.railFold} open>
        <summary className={styles.groupHead}>
          <Layers size={13} aria-hidden="true" />
          유형별
          <span className={styles.railCount}>{n(types.length)}</span>
          <ChevronDown size={13} aria-hidden="true" className={styles.foldIcon} />
        </summary>
        <div className={styles.railScroll}>
          {types.map((t) => (
            <Link
              key={t.id}
              className={styles.railItem}
              href={`/csat/browse?type=${encodeURIComponent(t.id)}`}
              aria-current={cur(place === 'type' && current === t.id)}
              data-type={t.id}
              onClick={() => track({ name: 'csat_path_chosen', props: { axis: 'type', need: 'none' } })}
            >
              <span className="truncate">{t.name}</span>
              <span className={styles.railCount}>{n(t.items)}</span>
            </Link>
          ))}
        </div>
      </details>

      <details className={styles.railFold} open>
        <summary className={styles.groupHead}>
          <Hash size={13} aria-hidden="true" />
          회차별
          <span className={styles.railCount}>{n(exams.length)}</span>
          <ChevronDown size={13} aria-hidden="true" className={styles.foldIcon} />
        </summary>
        <div className={styles.railScroll}>
          {exams.map((exam) => (
            <Link
              key={exam.exam_id}
              className={styles.railItem}
              href={`/csat/browse?exam=${encodeURIComponent(exam.exam_id)}`}
              aria-current={cur(place === 'exam' && current === exam.exam_id)}
              data-exam={exam.exam_id}
              onClick={() => track({ name: 'csat_path_chosen', props: { axis: 'exam', need: 'none' } })}
            >
              <span className="truncate">{exam.label}</span>
              <span className={styles.railCount}>{n(exam.items)}</span>
            </Link>
          ))}
        </div>
      </details>
    </nav>
  )
}
