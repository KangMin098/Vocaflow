// apps/web/src/components/csat/workspace/WorkspaceCards.tsx
'use client'

//
// Workspace 카드 목록 — `/csat` 메인의 「내 Workspace」 줄과 `/csat/workspace` 목록이 같이 쓴다.
// 카드 = 이름 · 목표 · 진행(연 문항 / 풀, 기존 학습 포함) · 가장 약한 곳(판단할 만큼 쌓였을 때만) · [이어서].

import Link from 'next/link'
import { ArrowRight, FolderPlus } from 'lucide-react'

import type { DissectionRecord } from '@/lib/csat/dissect'
import { toItemSlug } from '@/lib/csat/item-slug'
import { STEP_TARGET, nextSet, poolOf, progressOf, weakRows, type Workspace, type WorkspaceIndexItem } from '@/lib/csat/workspace'

import home from '../home/home.module.css'
import styles from './workspace.module.css'

export function WorkspaceCards({
  list,
  record,
  now,
  items,
  typeName,
  from,
  showNew = true,
}: {
  list: Workspace[]
  record: DissectionRecord
  now: number
  items: WorkspaceIndexItem[]
  typeName: Map<string, string>
  from: 'home' | 'rail'
  showNew?: boolean
}) {
  return (
    <div className={styles.strip} data-testid="ws-cards">
      {list.map((ws) => {
        const pool = poolOf(ws.scope, items)
        const prog = progressOf(ws, pool, record, now)
        const weakest = weakRows(pool, record).find((r) => r.verdict !== 'insufficient' && r.hits / r.n < 0.5)
        const next = nextSet(pool, record)
        return (
          <article key={ws.id} className={styles.wcard} data-testid="ws-card">
            <h3>
              <Link href={`/csat/workspace/${encodeURIComponent(ws.id)}?from=${from}`}>{ws.name}</Link>
            </h3>
            {ws.intent.goal ? <p className={styles.wgoal}>{ws.intent.goal}</p> : null}
            <p className={styles.wmeta}>
              <span>
                연 문항 {prog.touched}/{prog.pool}
              </span>
              {prog.perWeek ? (
                <span>
                  이번 주 {prog.studiedThisWeek}/{prog.perWeek}
                </span>
              ) : null}
              {prog.daysLeft != null ? <span>기한 {prog.daysLeft}일</span> : null}
            </p>
            {weakest ? (
              <p className={styles.hint}>
                약한 곳: {weakest.axis === 'type' ? typeName.get(weakest.key) ?? weakest.key : weakest.key} — {STEP_TARGET[weakest.step]} {weakest.n}회 중 {weakest.hits}
              </p>
            ) : null}
            <div className={styles.wactions}>
              {next.length ? (
                <Link className={home.primary} href={`/csat/item/${toItemSlug(next[0])}`}>
                  이어서 <ArrowRight size={14} aria-hidden="true" />
                </Link>
              ) : null}
              <Link className={home.secondary} href={`/csat/workspace/${encodeURIComponent(ws.id)}?from=${from}`}>
                열기
              </Link>
            </div>
          </article>
        )
      })}
      {showNew ? (
        <Link className={styles.newCard} href="/csat/workspace/new" data-testid="ws-new">
          <FolderPlus size={18} aria-hidden="true" style={{ justifySelf: 'center' }} />새 Workspace 만들기
          <small className={styles.hint}>목적 · 약점에 맞춰 유형 · 함정 · 회차를 골라 담아요</small>
        </Link>
      ) : null}
    </div>
  )
}
