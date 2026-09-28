// apps/web/src/components/csat/workspace/ScopeEditor.tsx
'use client'

//
// **담을 것 고르기 + 실제 포함 문항** — 만들기 · 고치기 팝업이 같이 쓴다.
// 2026-09-29 사용자 지시 「나열식은 다른 방식으로」: 유형 26 · 함정 32 · 회차 29 를 칩으로 다 펴지 않는다.
// 칸마다 **고르기 상자 하나 + 고른 것만 토큰**으로 보인다. 조합 규칙(칸 안은 또는 · 칸 사이는 그리고)이
// 직관과 다를 수 있으므로 **실제로 들어오는 문항 수와 앞 몇 개**를 늘 보인다(설계 §3).

import Link from 'next/link'
import { useMemo } from 'react'
import { X } from 'lucide-react'

import { toItemSlug } from '@/lib/csat/item-slug'
import type { WorkspaceUnits } from '@/lib/csat/workspace-index'
import { poolOf, type WorkspaceIndexItem, type WorkspaceScope } from '@/lib/csat/workspace'

import styles from './workspace.module.css'

export type ScopeUnit = 'type' | 'trap' | 'exam' | 'item' | 'mapped'
export type ScopeChange = { action: 'add' | 'remove'; unit: ScopeUnit }

const PREVIEW_MAX = 10

type Field = 'types' | 'traps' | 'exams'
const UNIT_OF: Record<Field, ScopeUnit> = { types: 'type', traps: 'trap', exams: 'exam' }

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
  const facets = [scope.types.length > 0, scope.traps.length > 0, scope.exams.length > 0, !!scope.mappedOnly].filter(Boolean).length

  const rows: { field: Field; label: string; options: { id: string; label: string; n: number }[] }[] = [
    { field: 'types', label: '유형', options: units.types.map((t) => ({ id: t.id, label: t.name, n: t.n })) },
    { field: 'traps', label: '함정', options: units.traps.map((t) => ({ id: t.key, label: t.key, n: t.n })) },
    { field: 'exams', label: '회차', options: units.exams.map((e) => ({ id: e.id, label: e.label, n: e.n })) },
  ]

  const add = (field: Field, id: string) => {
    if (!id || scope[field].includes(id)) return
    onChange({ ...scope, [field]: [...scope[field], id] }, { action: 'add', unit: UNIT_OF[field] })
  }
  const remove = (field: Field, id: string) => onChange({ ...scope, [field]: scope[field].filter((x) => x !== id) }, { action: 'remove', unit: UNIT_OF[field] })

  return (
    <div className={styles.scope}>
      {rows.map(({ field, label, options }) => {
        const nameOf = new Map(options.map((o) => [o.id, o.label]))
        return (
          <div key={field} className={styles.scopeRow}>
            <label className={styles.scopeLabel} htmlFor={`ws-add-${field}`}>
              {label}
            </label>
            <div className={styles.tokens}>
              {scope[field].map((id) => (
                <span key={id} className={styles.token}>
                  {nameOf.get(id) ?? id}
                  <button type="button" aria-label={`${nameOf.get(id) ?? id} 빼기`} onClick={() => remove(field, id)}>
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              ))}
              <select id={`ws-add-${field}`} className={styles.adder} value="" onChange={(e) => add(field, e.target.value)} data-testid={`ws-add-${field}`}>
                <option value="">{scope[field].length ? '+ 더하기' : `+ ${label} 고르기`}</option>
                {options
                  .filter((o) => !scope[field].includes(o.id))
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label} · {o.n}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )
      })}

      <div className={styles.scopeRow}>
        <span className={styles.scopeLabel}>조건</span>
        <label className={styles.switchRow}>
          <span>근거 문장 지도가 있는 문항만</span>
          <input
            type="checkbox"
            role="switch"
            className={styles.switch}
            checked={!!scope.mappedOnly}
            onChange={() => onChange({ ...scope, mappedOnly: !scope.mappedOnly }, { action: scope.mappedOnly ? 'remove' : 'add', unit: 'mapped' })}
          />
        </label>
      </div>

      {scope.items.length ? (
        <div className={styles.scopeRow}>
          <span className={styles.scopeLabel}>낱개</span>
          <div className={styles.tokens}>
            {scope.items.map((id) => (
              <span key={id} className={styles.token}>
                {id.replace('#', ' ')}번
                <button type="button" aria-label={`${id} 빼기`} onClick={() => onChange({ ...scope, items: scope.items.filter((x) => x !== id) }, { action: 'remove', unit: 'item' })}>
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <section className={styles.preview} aria-live="polite" data-testid="ws-preview">
        <p className={styles.previewHead}>
          실제 포함 문항 <b>{pool.length}</b>
          <span className={styles.previewRule}>{facets >= 2 ? '고른 칸을 모두 만족하는 문항만(예: 빈칸 + 2026 수능 = 2026 수능의 빈칸)' : '같은 칸 안에서는 하나라도 맞으면 들어옵니다'}</span>
        </p>
        {pool.length ? (
          <p className={styles.previewList}>
            {pool.slice(0, PREVIEW_MAX).map((it, i) => (
              <span key={it.id}>
                {i ? ' · ' : ''}
                <Link href={`/csat/item/${toItemSlug(it.id)}`}>{it.id.replace('#', ' ')}</Link>
              </span>
            ))}
            {pool.length > PREVIEW_MAX ? <span className={styles.previewMore}> 외 {pool.length - PREVIEW_MAX}</span> : null}
          </p>
        ) : (
          <p className={styles.hint}>아직 들어오는 문항이 없습니다. 칸을 고르세요.</p>
        )}
      </section>
    </div>
  )
}
