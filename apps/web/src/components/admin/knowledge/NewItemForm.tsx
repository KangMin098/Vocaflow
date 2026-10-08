// apps/web/src/components/admin/knowledge/NewItemForm.tsx
// 새 항목 작성 — 사람이 쓴 항목은 「검토 중」으로 들어간다(「추출됨」은 드레인 몫).
// 본질은 영역 하나에 대해서만 쓴다(rules.checkNewItem).
'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { KIND_LABEL, KIND_QUESTION, KINDS_BY_LAYER, type Kind } from '@/lib/knowledge/vnext-labels'
import { createItemAction } from '@/app/admin/knowledge/actions'
import { LAYER_LABEL, LAYER_QUESTION, type Layer } from '@/lib/knowledge/labels'

const FIELD =
  'min-h-11 w-full rounded border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]'

const DIMENSION_LABEL: Record<string, string> = {
  age: '학령',
  proficiency: '숙련도',
  exam: '시험',
  process: '과정',
  question: '문항 유형',
}

interface TaxonomyOption {
  id: string
  label: string
  dimension: string
}

export function NewItemForm({ layers, taxonomy }: { layers: Layer[]; taxonomy: TaxonomyOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [layer, setLayer] = useState<Layer>(layers[0])
  const [kind, setKind] = useState<Kind>(KINDS_BY_LAYER[layers[0]][0])
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [statement, setStatement] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [conditions, setConditions] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const skillOptions = taxonomy.filter((t) => t.dimension === 'skill')
  const conditionGroups = Object.entries(DIMENSION_LABEL).map(([dim, name]) => ({
    name,
    options: taxonomy.filter((t) => t.dimension === dim),
  }))
  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-6 inline-flex min-h-11 items-center rounded border border-[var(--p)] px-4 text-sm font-medium text-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
      >
        새 항목 쓰기
      </button>
    )
  }

  return (
    <form
      className="mb-8 grid gap-3 border-y border-[var(--bd)] py-6"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        start(async () => {
          const r = await createItemAction({ layer, kind, slug, title, statement, skillIds: skills, conditionIds: conditions })
          if (!r.ok) {
            setError(r.error ?? '저장 실패')
            return
          }
          router.push(`/admin/knowledge/item/${slug}`)
        })
      }}
    >
      <fieldset className="flex flex-wrap gap-4 text-sm text-[var(--t1)]">
        <legend className="mb-1 text-sm text-[var(--t2)]">층</legend>
        {layers.map((l) => (
          <label key={l} className="inline-flex min-h-11 items-center gap-2">
            <input className="h-4 w-4 accent-[var(--p)]" type="radio" name="layer" checked={layer === l} onChange={() => { setLayer(l); setKind(KINDS_BY_LAYER[l][0]) }} />
            {LAYER_LABEL[l]}
            <span className="text-xs text-[var(--t3)]">{LAYER_QUESTION[l]}</span>
          </label>
        ))}
      </fieldset>
      {KINDS_BY_LAYER[layer].length > 1 && (
        <fieldset className="flex flex-wrap gap-4 text-sm text-[var(--t1)]">
          <legend className="mb-1 text-sm text-[var(--t2)]">종류</legend>
          {KINDS_BY_LAYER[layer].map((k) => (
            <label key={k} className="inline-flex min-h-11 items-center gap-2">
              <input className="h-4 w-4 accent-[var(--p)]" type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />
              {KIND_LABEL[k]}
              <span className="text-xs text-[var(--t3)]">{KIND_QUESTION[k]}</span>
            </label>
          ))}
        </fieldset>
      )}
      <label className="text-sm text-[var(--t2)]">
        제목
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD} maxLength={120} required />
      </label>
      <label className="text-sm text-[var(--t2)]">
        주소 이름 (영문 소문자·숫자·하이픈)
        <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} className={FIELD} required />
      </label>
      <label className="text-sm text-[var(--t2)]">
        문장 — 근거를 재서술한다. 원문을 옮겨 적지 않는다
        <textarea value={statement} onChange={(e) => setStatement(e.target.value)} rows={3} className={FIELD} maxLength={1500} required />
      </label>
      <fieldset>
        <legend className="mb-1 text-sm text-[var(--t2)]">영역{layer === 'essence' ? ' (본질은 정확히 하나)' : ''}</legend>
        <div className="flex flex-wrap gap-x-4">
          {skillOptions.map((t) => (
            <label key={t.id} className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--t1)]">
              <input className="h-4 w-4 accent-[var(--p)]" type="checkbox" checked={skills.includes(t.id)} onChange={() => toggle(skills, setSkills, t.id)} />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
      {layer !== 'essence' && (
        <details>
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-[var(--t2)]">
            조건 (학령·숙련도·시험·과정·문항 유형) — 조건이 다르면 다른 항목
          </summary>
          {conditionGroups.map((g) => (
            <fieldset key={g.name} className="mt-2">
              <legend className="text-xs text-[var(--t3)]">{g.name}</legend>
              <div className="flex flex-wrap gap-x-4">
                {g.options.map((t) => (
                  <label key={t.id} className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--t1)]">
                    <input className="h-4 w-4 accent-[var(--p)]" type="checkbox" checked={conditions.includes(t.id)} onChange={() => toggle(conditions, setConditions, t.id)} />
                    {t.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </details>
      )}
      {error && (
        <p role="alert" className="text-sm text-[var(--error-ink)]">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded border border-[var(--p)] px-4 text-sm font-medium text-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:text-[var(--t3)]"
        >
          검토 중으로 저장
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex min-h-11 items-center rounded border border-[var(--bd)] px-4 text-sm text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
        >
          닫기
        </button>
      </div>
    </form>
  )
}
