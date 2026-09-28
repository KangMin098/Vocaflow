// apps/web/src/components/csat/home/CsatRail.tsx
'use client'

//
// **기출분석공간 메뉴 — 모든 /csat 목록 화면(홈 · 서가 · 내 기록 · Workspace)이 같이 쓴다.**
// 2026-09-29 참조 3B 레일 결로 다시 짰다(ia-design §1-1 의 축은 그대로):
//
//   홈 · 이어서·복습(n) · 내 기록 · 전체 서가           ← 참조 Recents · Favorites · Chat 무리
//   ─
//   목적별 · 유형별 · 회차별                              ← 한 줄씩. 목록은 **팝업**으로 연다(레일에 26 · 29줄을 펴지 않는다)
//   ─
//   Workspace  [+]                                        ← 참조 Spaces [+] — 내 Workspace 이름이 한 줄씩
//
// 목적별 · 유형별 · 회차별은 **같은 도착지**(서가 → `/csat/item/[slug]`)로 간다.
// 어느 축으로 들어왔는지는 `csat_path_chosen` 한 이벤트가 센다(분모를 가르지 않는다).
// 대응 자료가 없는 니즈(등급 판정 · 구문 · 정답률 · EBS 연계 · 시간 재기)는 메뉴에 두지 않는다(ia-design §6).

import Link from 'next/link'
import { useState } from 'react'
import { BookMarked, Compass, Crosshair, FolderKanban, Hash, History, Home, Layers, Library, Microscope, Plus, Search, Sparkles, Target, Timer } from 'lucide-react'

import { Dialog } from '@/components/ui/Dialog'
import { track } from '@/lib/analytics/client'
import { ATLAS_TYPES, RECENT_FROM } from '@/lib/csat/trap-atlas'

import styles from '../space/space.module.css'

export type RailPlace = 'home' | 'continue' | 'record' | 'browse' | 'need' | 'type' | 'exam' | 'workspace'
export type NeedId = 'start' | 'killer' | 'trap' | 'evidence' | 'recent'

export const NEEDS: { id: NeedId; label: string; hint: string; href: string; Icon: typeof Home }[] = [
  { id: 'start', label: '처음 시작하기', hint: '정답을 알고 설계를 예측하는 첫 세트', href: '/csat/dissect', Icon: Sparkles },
  { id: 'killer', label: '킬러 유형 잡기', hint: '빈칸 · 순서 · 삽입만 추린 표', href: '/csat?need=killer', Icon: Target },
  { id: 'trap', label: '오답 선지 설계 보기', hint: '함정 32 가지 — 오답이 만들어지는 법', href: '/csat?tab=trap', Icon: Crosshair },
  { id: 'evidence', label: '근거 문장 찾기', hint: '지문 지도가 있는 문항만', href: '/csat/browse?status=map', Icon: Search },
  { id: 'recent', label: '최근 기출부터', hint: `${RECENT_FROM}학년도 이후 회차`, href: `/csat/browse?from=${RECENT_FROM}`, Icon: Timer },
]

const n = (value: number) => value.toLocaleString('ko-KR')

type Pop = 'need' | 'type' | 'exam' | null

export function CsatRail({
  place,
  current,
  exams,
  dueCount,
  workspaces,
}: {
  place: RailPlace
  /** 지금 열려 있는 목적 · 유형 · 회차 · Workspace id */
  current?: string
  exams: { exam_id: string; label: string; items: number }[]
  /** 이어서 · 복습 옆 개수. 아직 기록을 못 읽었으면 null */
  dueCount: number | null
  /** 내 Workspace(이름 · id). 아직 기록을 못 읽었으면 null */
  workspaces?: { id: string; name: string }[] | null
}) {
  const [pop, setPop] = useState<Pop>(null)
  const types = [...ATLAS_TYPES].sort((a, b) => b.items - a.items || a.name.localeCompare(b.name))
  const cur = (on: boolean) => (on ? ('page' as const) : undefined)
  const close = () => setPop(null)

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
        <Link className={styles.railItem} href="/csat/browse" aria-current={cur(place === 'browse')}>
          <Library size={15} aria-hidden="true" />전체 서가
        </Link>
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <button type="button" className={styles.railItem} aria-current={cur(place === 'need')} aria-haspopup="dialog" onClick={() => setPop('need')} data-testid="rail-need">
          <Compass size={15} aria-hidden="true" />목적별
        </button>
        <button type="button" className={styles.railItem} aria-current={cur(place === 'type')} aria-haspopup="dialog" onClick={() => setPop('type')} data-testid="rail-type">
          <Layers size={15} aria-hidden="true" />
          유형별
          <span className={styles.railCount}>{n(types.length)}</span>
        </button>
        <button type="button" className={styles.railItem} aria-current={cur(place === 'exam')} aria-haspopup="dialog" onClick={() => setPop('exam')} data-testid="rail-exam">
          <Hash size={15} aria-hidden="true" />
          회차별
          <span className={styles.railCount}>{n(exams.length)}</span>
        </button>
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <div className={styles.groupHead} style={{ display: 'flex', alignItems: 'center' }}>
          Workspace
          <Link href="/csat?tab=workspace&new=1" aria-label="새 Workspace" className={styles.railPlus} data-testid="rail-ws-new">
            <Plus size={14} aria-hidden="true" />
          </Link>
        </div>
        {workspaces == null ? null : workspaces.length === 0 ? (
          <Link className={styles.railItem} href="/csat?tab=workspace&new=1">
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

      {pop === 'need' ? (
        <Dialog onClose={close} title="목적별" byline="하려는 일에서 출발합니다 — 모두 같은 서가와 문항 화면으로 이어져요" size="md">
          <ul className={styles.popList}>
            {NEEDS.map(({ id, label, hint, href, Icon }) => (
              <li key={id}>
                <Link
                  href={href}
                  className={styles.popItem}
                  aria-current={cur(place === 'need' && current === id)}
                  data-need={id}
                  onClick={() => track({ name: 'csat_path_chosen', props: { axis: 'need', need: id } })}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>
                    <b>{label}</b>
                    <small>{hint}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Dialog>
      ) : null}

      {pop === 'type' ? (
        <Dialog onClose={close} title="유형별" byline={`${n(types.length)}유형 — 문항이 많은 순. 고르면 서가를 그 유형으로 엽니다`} size="lg">
          <ul className={styles.popGrid}>
            {types.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/csat/browse?type=${encodeURIComponent(t.id)}`}
                  className={styles.popChip}
                  aria-current={cur(place === 'type' && current === t.id)}
                  data-type={t.id}
                  onClick={() => track({ name: 'csat_path_chosen', props: { axis: 'type', need: 'none' } })}
                >
                  <span className="truncate">{t.name}</span>
                  <small>{n(t.items)}</small>
                </Link>
              </li>
            ))}
          </ul>
        </Dialog>
      ) : null}

      {pop === 'exam' ? (
        <Dialog onClose={close} title="회차별" byline={`${n(exams.length)}회차 — 최근 순. 고르면 서가를 그 회차로 엽니다`} size="lg">
          <ul className={styles.popGrid}>
            {exams.map((exam) => (
              <li key={exam.exam_id}>
                <Link
                  href={`/csat/browse?exam=${encodeURIComponent(exam.exam_id)}`}
                  className={styles.popChip}
                  aria-current={cur(place === 'exam' && current === exam.exam_id)}
                  data-exam={exam.exam_id}
                  onClick={() => track({ name: 'csat_path_chosen', props: { axis: 'exam', need: 'none' } })}
                >
                  <span className="truncate">{exam.label}</span>
                  <small>{n(exam.items)}</small>
                </Link>
              </li>
            ))}
          </ul>
        </Dialog>
      ) : null}
    </nav>
  )
}
