// apps/web/src/app/admin/csat/diagnosis/settings/SettingsEditor.tsx
'use client'

import { useState, useTransition } from 'react'

import { inputCls, primaryBtnCls } from '@/components/admin/csat-diagnosis/ui'

import { saveSettingsAction } from '../actions'

export function SettingsEditor({ initial, exams }: { initial: string; exams: { id: string; label: string }[] }) {
  const [text, setText] = useState(initial)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [pending, start] = useTransition()

  const save = () =>
    start(async () => {
      const r = await saveSettingsAction(text, note)
      setErrors(r.errors ?? [])
      setMsg(r.ok ? '새 버전을 저장하고 활성으로 바꿨어요' : r.error ?? '실패')
    })

  return (
    <section className="flex flex-col gap-2">
      <label htmlFor="dx-settings" className="font-display text-[13px] font-[700] text-[var(--t1)]">설정 JSON</label>
      <textarea
        id="dx-settings"
        className={`min-h-[44px] ${inputCls} min-h-[420px] font-mono text-[12.5px]`}
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <details className="font-body text-[12.5px] text-[var(--t2)]">
        <summary className="min-h-[44px] cursor-pointer py-2">시나리오·기준 시험에 쓸 수 있는 id (정답표가 있는 시험)</summary>
        <p className="break-keep">{exams.map((e) => `${e.id}(${e.label})`).join(' · ')}</p>
      </details>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 font-body text-[12px] text-[var(--t1)]">
          메모(무엇을 왜 바꿨나)
          <input className={`min-h-[44px] ${inputCls} w-[320px]`} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button type="button" className={`min-h-[44px] ${primaryBtnCls}`} disabled={pending} onClick={save}>검사 후 저장</button>
        {msg && <span role="status" className="font-body text-[12px] text-[var(--t2)]">{msg}</span>}
      </div>
      {errors.length > 0 && (
        <ul className="list-disc pl-5 font-body text-[12.5px] text-[var(--error-ink)]">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
    </section>
  )
}
