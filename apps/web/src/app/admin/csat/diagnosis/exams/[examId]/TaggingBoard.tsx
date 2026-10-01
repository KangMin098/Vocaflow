// apps/web/src/app/admin/csat/diagnosis/exams/[examId]/TaggingBoard.tsx
'use client'

import { useMemo, useRef, useState, useTransition } from 'react'

import { btnCls, inputCls, primaryBtnCls } from '@/components/admin/csat-diagnosis/ui'
import type { TaggingItem } from '@/lib/csat/diagnosis/admin'
import { ATTRIBUTE_CODES, type AttributeCode } from '@/lib/csat/diagnosis/engine/types'
import { ATTRIBUTE_NAME } from '@/lib/csat/diagnosis/labels'

import { saveItemTaggingAction } from '../../actions'

type TrapOption = { key: string; family: string | null }

function ItemCard({ item, trapOptions, onSaved }: { item: TaggingItem; trapOptions: TrapOption[]; onSaved: (id: string) => void }) {
  const [weights, setWeights] = useState<Record<AttributeCode, number>>(item.weights)
  const [traps, setTraps] = useState<Record<number, string | null>>(
    Object.fromEntries([1, 2, 3, 4, 5].map((n) => [n, item.traps[n]?.key ?? null])),
  )
  const [errorRate, setErrorRate] = useState(item.errorRate === null ? '' : String(item.errorRate))
  const [ebs, setEbs] = useState<'null' | 'true' | 'false'>(item.ebsLinked === null ? 'null' : item.ebsLinked ? 'true' : 'false')
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  // 롱테일 라벨(정본 32종 밖)도 선택지에 남긴다 — 지우지 않고 보존
  const options = useMemo(() => {
    const extra = Object.values(item.traps).map((t) => t?.key).filter((k): k is string => Boolean(k) && !trapOptions.some((o) => o.key === k))
    return [...trapOptions, ...extra.map((key) => ({ key, family: null }))]
  }, [item.traps, trapOptions])

  const save = () =>
    start(async () => {
      const rate = errorRate.trim() === '' ? null : Number(errorRate)
      const r = await saveItemTaggingAction({
        itemId: item.id,
        weights,
        traps,
        errorRate: rate,
        ebsLinked: ebs === 'null' ? null : ebs === 'true',
      })
      setMsg(r.ok ? '검수 저장했어요' : r.error ?? '실패')
      if (r.ok) onSaved(item.id)
    })

  return (
    <article id={`item-${item.id}`} className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--bd)] p-4" tabIndex={-1}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-[15px] font-[800] text-[var(--t1)]">{item.no}번 · {item.typeId}</h3>
        <span className="font-body text-[12px] text-[var(--t2)]">
          {item.reviewedAt ? `검수 ${item.reviewedAt.slice(0, 10)}` : item.weightSource === 'type_default' ? '유형 기본값 — 미검수' : '미검수'}
        </span>
      </header>
      {item.stem && <p className="break-keep font-body text-[13px] text-[var(--t1)]">{item.stem}</p>}

      <fieldset className="flex flex-col gap-1">
        <legend className="font-display text-[12.5px] font-[700] text-[var(--t2)]">역량 가중치 (0 없음 · 1 보조 · 2 핵심)</legend>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-9">
          {ATTRIBUTE_CODES.map((c) => (
            <label key={c} className="flex flex-col gap-1 font-body text-[12px] text-[var(--t1)]">
              <span>{c} {ATTRIBUTE_NAME[c].admin}</span>
              <select className={inputCls} value={weights[c]} onChange={(e) => setWeights({ ...weights, [c]: Number(e.target.value) })}>
                {[0, 1, 2].map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1">
        <legend className="font-display text-[12.5px] font-[700] text-[var(--t2)]">선지 함정 (정답 선지는 비워 둡니다)</legend>
        <ol className="flex flex-col gap-1">
          {[1, 2, 3, 4, 5].map((n) => {
            const correct = item.answers.includes(n)
            return (
              <li key={n} className="grid grid-cols-1 items-center gap-2 md:grid-cols-[1fr_260px]">
                <span className="break-keep font-body text-[13px] text-[var(--t1)]">
                  <b>{'①②③④⑤'[n - 1]}</b> {item.choices[n - 1] ?? ''} {correct && <span className="font-[700] text-[var(--admin)]">· 정답</span>}
                </span>
                <label className="sr-only" htmlFor={`t-${item.id}-${n}`}>{n}번 선지 함정</label>
                <select
                  id={`t-${item.id}-${n}`}
                  className={inputCls}
                  disabled={correct}
                  value={traps[n] ?? ''}
                  onChange={(e) => setTraps({ ...traps, [n]: e.target.value || null })}
                >
                  <option value="">— 없음 —</option>
                  {options.map((o) => (
                    <option key={o.key} value={o.key}>{o.key}{o.family ? ` (${o.family})` : ' (계열 없음)'}</option>
                  ))}
                </select>
              </li>
            )
          })}
        </ol>
      </fieldset>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 font-body text-[12px] text-[var(--t1)]">
          공식 오답률(0~1)
          <input className={`${inputCls} w-[110px]`} inputMode="decimal" value={errorRate} onChange={(e) => setErrorRate(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 font-body text-[12px] text-[var(--t1)]">
          EBS 연계
          <select className={inputCls} value={ebs} onChange={(e) => setEbs(e.target.value as typeof ebs)}>
            <option value="null">미확인</option>
            <option value="true">연계</option>
            <option value="false">비연계</option>
          </select>
        </label>
        <button type="button" className={primaryBtnCls} disabled={pending} onClick={save}>검수 저장</button>
        {msg && <span role="status" className="font-body text-[12px] text-[var(--t2)]">{msg}</span>}
      </div>
    </article>
  )
}

export function TaggingBoard({ items, trapOptions }: { items: TaggingItem[]; trapOptions: TrapOption[] }) {
  const [onlyPending, setOnlyPending] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const listRef = useRef<HTMLDivElement>(null)
  const isDone = (i: TaggingItem) => Boolean(i.reviewedAt) || savedIds.has(i.id)
  const visible = onlyPending ? items.filter((i) => !isDone(i)) : items

  const goNext = () => {
    const next = items.find((i) => !isDone(i))
    if (!next) return
    const el = document.getElementById(`item-${next.id}`)
    el?.scrollIntoView({ block: 'start' })
    el?.focus()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-[44px] items-center gap-2 font-body text-[13px] text-[var(--t1)]">
          <input type="checkbox" className="h-5 w-5" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
          미완료만 보기
        </label>
        <button type="button" className={btnCls} onClick={goNext}>다음 미완료로 이동</button>
        <span className="font-body text-[13px] text-[var(--t2)]">남은 문항 {items.filter((i) => !isDone(i)).length}</span>
      </div>
      <div ref={listRef} className="flex flex-col gap-3">
        {visible.map((i) => (
          <ItemCard key={i.id} item={i} trapOptions={trapOptions} onSaved={(id) => setSavedIds((s) => new Set(s).add(id))} />
        ))}
      </div>
    </div>
  )
}
