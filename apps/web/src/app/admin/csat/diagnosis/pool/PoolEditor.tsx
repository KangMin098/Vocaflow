// apps/web/src/app/admin/csat/diagnosis/pool/PoolEditor.tsx
'use client'

import { useState, useTransition } from 'react'

import { btnCls, inputCls, primaryBtnCls, tdCls, thCls } from '@/components/admin/csat-diagnosis/ui'
import type { PoolRow } from '@/lib/csat/diagnosis/admin'

import { setPoolItemAction } from '../actions'

export function PoolEditor({ rows }: { rows: PoolRow[] }) {
  const [id, setId] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const run = (itemId: string, active: boolean | null, done: string) =>
    start(async () => {
      const r = await setPoolItemAction(itemId, active)
      setMsg(r.ok ? done : r.error ?? '실패')
      if (r.ok && active === true) setId('')
    })

  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-display text-[15px] font-[800] text-[var(--t1)]">문항</h3>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 font-body text-[12px] text-[var(--t1)]">
          문항 id 추가
          <input className={`${inputCls} w-[160px]`} placeholder="2026#31" value={id} onChange={(e) => setId(e.target.value.trim())} />
        </label>
        <button type="button" className={primaryBtnCls} disabled={pending || !id} onClick={() => run(id, true, `${id} 를 넣었어요`)}>넣기</button>
        {msg && <span role="status" className="font-body text-[12px] text-[var(--t2)]">{msg}</span>}
      </div>
      {rows.length === 0 ? (
        <p className="break-keep font-body text-[13px] text-[var(--t2)]">풀이 비어 있어요. 비어 있으면 학습자의 「진단 테스트」가 열리지 않아요.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead><tr><th className={thCls}>문항</th><th className={thCls}>유형</th><th className={thCls}>역량</th><th className={thCls}>검수</th><th className={thCls}>상태</th><th className={thCls}>조작</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.itemId}>
                <td className={tdCls}>{r.itemId}</td>
                <td className={tdCls}>{r.typeId}</td>
                <td className={tdCls}>{Object.entries(r.weights).map(([c, w]) => `${c}×${w}`).join(' ') || '—'}</td>
                <td className={tdCls}>{r.reviewed ? '완료' : '미검수'}</td>
                <td className={tdCls}>{r.active ? '활성' : '쉼'}</td>
                <td className={tdCls}>
                  <div className="flex gap-1">
                    <button type="button" className={btnCls} disabled={pending} onClick={() => run(r.itemId, !r.active, r.active ? '쉬게 했어요' : '활성으로 바꿨어요')}>
                      {r.active ? '쉬게 하기' : '활성으로'}
                    </button>
                    <button type="button" className={btnCls} disabled={pending} onClick={() => run(r.itemId, null, '뺐어요')}>빼기</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
