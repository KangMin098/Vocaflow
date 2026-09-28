// apps/web/src/components/csat/home/CsatRail.tsx
'use client'

//
// **기출분석공간 메뉴 — 모든 /csat 목록 화면(홈 · 서가 · 내 기록 · Workspace)이 같이 쓴다.**
// 2026-09-29 참조 3B 레일 결 · 사용자 지시 「메뉴 클릭 시 팝업 X」:
//
//   홈(= 내 Workspace 목록) · 이어서·복습(n) · 내 기록        ← 참조 Recents · Favorites · Chat 무리
//   ─
//   유형 · 함정 · 전체 서가                                     ← 한 줄 = 한 화면. 누르면 **곧바로 이동**한다
//   ─
//   Workspace  [+]  + 내 Workspace 이름                         ← 참조 Spaces [+]
//
// 옛 「목적별」 다섯 갈래는 레일에서 뺐다 — 그 역할은 Workspace 만들기의 **출발점**이 맡는다(같은 다섯 갈래).
// `?need=` 주소는 그대로 동작한다(옛 링크 · 메인의 킬러 유형 좁히기).
// 대응 자료가 없는 니즈(등급 판정 · 구문 · 정답률 · EBS 연계 · 시간 재기)는 메뉴에 두지 않는다(ia-design §6).

import Link from 'next/link'
import { BookMarked, Crosshair, FolderKanban, History, Home, Layers, Library, Microscope, Plus, Search, Sparkles, Target, Timer } from 'lucide-react'

import { track } from '@/lib/analytics/client'
import { ATLAS_TYPES, RECENT_FROM, TRAPS } from '@/lib/csat/trap-atlas'

import styles from '../space/space.module.css'

export type RailPlace = 'home' | 'continue' | 'record' | 'browse' | 'need' | 'type' | 'exam' | 'types' | 'traps' | 'workspace'
export type NeedId = 'start' | 'killer' | 'trap' | 'evidence' | 'recent'

/** 목적 다섯 갈래 — 레일에서는 뺐고, 주소(`?need=`)와 Workspace 출발점이 쓴다 */
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
  dueCount,
  workspaces,
}: {
  place: RailPlace
  /** 지금 열려 있는 Workspace id */
  current?: string
  /** 옛 호출부 호환 — 회차 목록은 이제 전체 서가가 보인다 */
  exams?: { exam_id: string; label: string; items: number }[]
  /** 이어서 · 복습 옆 개수. 아직 기록을 못 읽었으면 null */
  dueCount: number | null
  /** 내 Workspace(이름 · id). 아직 기록을 못 읽었으면 null */
  workspaces?: { id: string; name: string }[] | null
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
        <Link className={styles.railItem} href="/csat" aria-current={cur(place === 'home')} data-testid="rail-home">
          <Home size={15} aria-hidden="true" />홈
        </Link>
        <Link className={styles.railItem} href="/csat?view=continue" aria-current={cur(place === 'continue')} data-testid="rail-continue">
          <History size={15} aria-hidden="true" />
          이어서 · 복습
          {dueCount ? <span className={styles.railCount}>{n(dueCount)}</span> : null}
        </Link>
        <Link className={styles.railItem} href="/csat/record" aria-current={cur(place === 'record')}>
          <BookMarked size={15} aria-hidden="true" />내 기록
        </Link>
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <Link
          className={styles.railItem}
          href="/csat?tab=type"
          aria-current={cur(place === 'types' || place === 'need')}
          data-testid="rail-types"
          onClick={() => track({ name: 'csat_path_chosen', props: { axis: 'type', need: 'none' } })}
        >
          <Layers size={15} aria-hidden="true" />
          유형
          <span className={styles.railCount}>{n(ATLAS_TYPES.length)}</span>
        </Link>
        <Link
          className={styles.railItem}
          href="/csat?tab=trap"
          aria-current={cur(place === 'traps')}
          data-testid="rail-traps"
          onClick={() => track({ name: 'csat_path_chosen', props: { axis: 'need', need: 'trap' } })}
        >
          <Crosshair size={15} aria-hidden="true" />
          함정
          <span className={styles.railCount}>{n(TRAPS.length)}</span>
        </Link>
        <Link
          className={styles.railItem}
          href="/csat/browse"
          aria-current={cur(place === 'browse' || place === 'type' || place === 'exam')}
          data-testid="rail-browse"
          onClick={() => track({ name: 'csat_path_chosen', props: { axis: 'exam', need: 'none' } })}
        >
          <Library size={15} aria-hidden="true" />전체 서가
        </Link>
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <div className={styles.groupHead} style={{ display: 'flex', alignItems: 'center' }}>
          Workspace
          <Link href="/csat?new=1" aria-label="새 Workspace" className={styles.railPlus} data-testid="rail-ws-new">
            <Plus size={14} aria-hidden="true" />
          </Link>
        </div>
        {workspaces == null ? null : workspaces.length === 0 ? (
          <Link className={styles.railItem} href="/csat?new=1">
            <FolderKanban size={15} aria-hidden="true" />첫 Workspace 만들기
          </Link>
        ) : (
          workspaces.map((w) => (
            <Link
              key={w.id}
              className={styles.railItem}
              href={`/csat/workspace/${encodeURIComponent(w.id)}?from=rail`}
              aria-current={cur(place === 'workspace' && current === w.id)}
            >
              <FolderKanban size={15} aria-hidden="true" />
              <span className="truncate">{w.name}</span>
            </Link>
          ))
        )}
      </div>
    </nav>
  )
}
