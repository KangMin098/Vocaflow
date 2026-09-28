// apps/web/src/components/csat/workspace/ScopeEditor.tsx
'use client'

//
// **담을 것 고르기 + 실제 포함 문항 미리보기** — 만들기 · 편집이 같이 쓴다.
// 조합 규칙(칸 안은 「또는」, 칸 사이는 「그리고」)이 직관과 다를 수 있으므로, 고를 때마다 **실제로 들어오는
// 문항 수와 목록**을 바로 보인다(설계 §3).

import Link from 'next/link'
import { useMemo } from 'react'

import { toItemSlug } from '@/lib/csat/item-slug'
import type { WorkspaceUnits } from '@/lib/csat/workspace-index'
import { poolOf, type WorkspaceIndexItem, type WorkspaceScope } from '@/lib/csat/workspace'

import home from '../home/home.module.css'
import styles from './workspace.module.css'

export type ScopeUnit = 'type' | 'trap' | 'exam' | 'item' | 'mapped'
export type ScopeChange = { action: 'add' | 'remove'; unit: ScopeUnit }

const PREVIEW_MAX = 24

function toggle(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

export function ScopeEditor({
  scope,
  onChange,
  units,
  index,
}: {
  scope: WorkspaceScope
  onChange: (next: WorkspaceScope, change: ScopeChange) => void
  units: WorkspaceUnits
  index: WorkspaceIndexItem[]
}) {
  const pool = useMemo(() => poolOf(scope, index), [scope, index])
  const typeName = useMemo(() => new Map(units.types.map((t) => [t.id, t.name])), [units.types])
  const facets = [scope.types.length > 0, scope.traps.length > 0, scope.exams.length > 0, !!scope.mappedOnly].filter(Boolean).length

  const chip = (on: boolean, label: string, n: number, onClick: () => void, key: string) => (
    <button key={key} type="button" className={home.chip} aria-pressed={on} onClick={onClick}>
      {label}
      <span className={styles.chipN}>{n}</span>
    </button>
  )

  return (
    <div className={styles.groups}>
      <div className={styles.group}>
        <p className={styles.groupHead}>
          유형 <small>{scope.types.length}개 고름</small>
        </p>
        <div className={`${styles.chips} ${styles.scroll}`}>
          {units.types.map((t) =>
            chip(scope.types.includes(t.id), t.name, t.n, () => onChange({ ...scope, types: toggle(scope.types, t.id) }, { action: scope.types.includes(t.id) ? 'remove' : 'add', unit: 'type' }), t.id),
          )}
        </div>
      </div>

      <div className={styles.group}>
        <p className={styles.groupHead}>
          함정(오답 제조법) <small>{scope.traps.length}개 고름</small>
        </p>
        <div className={`${styles.chips} ${styles.scroll}`}>
          {units.traps.map((t) =>
            chip(scope.traps.includes(t.key), t.key, t.n, () => onChange({ ...scope, traps: toggle(scope.traps, t.key) }, { action: scope.traps.includes(t.key) ? 'remove' : 'add', unit: 'trap' }), t.key),
          )}
        </div>
      </div>

      <div className={styles.group}>
        <p className={styles.groupHead}>
          회차 <small>{scope.exams.length}개 고름</small>
        </p>
        <div className={`${styles.chips} ${styles.scroll}`}>
          {units.exams.map((e) =>
            chip(scope.exams.includes(e.id), e.label, e.n, () => onChange({ ...scope, exams: toggle(scope.exams, e.id) }, { action: scope.exams.includes(e.id) ? 'remove' : 'add', unit: 'exam' }), e.id),
          )}
        </div>
      </div>

      <div className={styles.group}>
        <p className={styles.groupHead}>조건</p>
        <div className={styles.chips}>
          <button
            type="button"
            className={home.chip}
            aria-pressed={!!scope.mappedOnly}
            onClick={() => onChange({ ...scope, mappedOnly: !scope.mappedOnly }, { action: scope.mappedOnly ? 'remove' : 'add', unit: 'mapped' })}
          >
            근거 문장 지도가 있는 문항만
          </button>
          {scope.items.map((id) => (
            <button key={id} type="button" className={home.chip} aria-pressed="true" onClick={() => onChange({ ...scope, items: scope.items.filter((x) => x !== id) }, { action: 'remove', unit: 'item' })}>
              {id.replace('#', ' ')}번 빼기
            </button>
          ))}
        </div>
      </div>

      <section className={styles.preview} aria-live="polite" data-testid="ws-preview">
        <p className={styles.previewHead}>
          실제 포함 문항 <b>{pool.length}</b>
          <span className={styles.previewRule}>
            {facets >= 2 ? '고른 칸을 모두 만족하는 문항만 들어옵니다(예: 빈칸 + 최근 회차 = 최근 회차의 빈칸).' : '같은 칸에서 여러 개를 고르면 그중 하나라도 맞는 문항이 들어옵니다.'}
          </span>
        </p>
        {pool.length ? (
          <ul className={styles.previewList}>
            {pool.slice(0, PREVIEW_MAX).map((it) => (
              <li key={it.id}>
                <Link href={`/csat/item/${toItemSlug(it.id)}`} title={`${typeName.get(it.type_id) ?? it.type_id} · ${it.families.join(' · ')}`}>
                  {it.id.replace('#', ' ')}
                </Link>
              </li>
            ))}
            {pool.length > PREVIEW_MAX ? <li className={styles.previewMore}>외 {pool.length - PREVIEW_MAX}문항</li> : null}
          </ul>
        ) : (
          <p className={styles.hint}>아직 들어오는 문항이 없습니다. 조건을 넓히거나 다른 칸을 고르세요.</p>
        )}
      </section>
    </div>
  )
}
