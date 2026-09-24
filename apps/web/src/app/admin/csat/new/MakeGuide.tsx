// apps/web/src/app/admin/csat/new/MakeGuide.tsx
//
// **「어떤 교재를 만드나요?」 — 다섯 갈래 고르기 → 걸음마다 화면 또는 Claude Code 지시문.**
//
// 새 브랜드 · 새 시리즈 · 단행본은 화면 버튼으로 끝나지 않는다(시리즈 정의가 코드에 있다). 그렇다고
// 「코드에 있다」로 끝내면 사용자는 방법을 모른다. 그래서 그 걸음은 **붙여 넣으면 일이 되는 지시문**을
// 화면이 폼 값으로 만들어 준다. 절차 · 문장은 `lib/csat/make-guide.ts` 가 정본이다.

'use client'

import { ArrowRight, Bot, UserRound } from 'lucide-react'
import { useId, useState } from 'react'

import {
  MAKE_CASES,
  TRIGGERS,
  buildPrompt,
  missingFields,
  type CaseKey,
  type PromptKey,
  type RenameForm,
  type SeriesForm,
} from '@/lib/csat/make-guide'

import { CopyButton } from './OrderWizard'

const EMPTY_SERIES: SeriesForm = {
  name: '',
  short: '',
  kind: '',
  accent: '',
  question: '',
  trigger: '',
  evidence: '',
  measuredOn: '',
  grades: [],
}

const field =
  'min-h-[44px] w-full rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2.5 font-body text-[13px] text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]'

function Labeled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-display text-[12px] font-[700] text-[var(--t1)]">{label}</span>
      {children}
      {hint ? <span className="break-keep font-body text-[11.5px] text-[var(--t3)]">{hint}</span> : null}
    </label>
  )
}

function PromptBox({ k, form }: { k: PromptKey; form: SeriesForm | RenameForm }) {
  const missing = missingFields(k, form)
  const text = buildPrompt(k, form)
  return (
    <div className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--p)]/40 bg-[var(--bg2)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-display text-[12.5px] font-[700] text-[var(--t1)]">
          <Bot size={14} strokeWidth={1.9} aria-hidden />
          Claude Code 지시문
        </span>
        {missing.length ? (
          <span role="status" className="break-keep font-body text-[12px] text-[var(--error-ink)]">
            먼저 채우세요: {missing.join(' · ')}
          </span>
        ) : (
          <CopyButton text={text} label="Claude Code 지시문 복사">
            지시문 복사
          </CopyButton>
        )}
      </div>
      <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap break-keep font-mono text-[11.5px] leading-relaxed text-[var(--t2)]">
        {text}
      </pre>
      <p className="break-keep font-body text-[11.5px] text-[var(--t3)]">
        복사한 글을 Claude Code(이 저장소를 연 채팅)에 그대로 붙여 넣으세요. 끝나면 Claude 가 결과를 알려 줘요.
      </p>
    </div>
  )
}

export function MakeGuide({
  grades,
  seriesList,
}: {
  // 고를 수 있는 학년 — 학년 계단 정본의 이름.
  grades: string[]
  seriesList: { id: string; brand: string; accent: string; kind: string }[]
}) {
  const [which, setWhich] = useState<CaseKey>('volume')
  const [sf, setSf] = useState<SeriesForm>(EMPTY_SERIES)
  const [rf, setRf] = useState<RenameForm>({ seriesId: '', oldName: '', newName: '' })
  const groupId = useId()
  const c = MAKE_CASES.find((x) => x.key === which)!
  const set = (patch: Partial<SeriesForm>) => setSf((f) => ({ ...f, ...patch }))
  const clash = seriesList.find(
    (s) => sf.accent && s.accent.toLowerCase() === sf.accent.toLowerCase(),
  )

  return (
    <section
      aria-labelledby={`${groupId}-t`}
      className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 sm:p-5"
    >
      <div className="flex flex-col gap-0.5">
        <h2 id={`${groupId}-t`} className="font-display text-[16px] font-[800] text-[var(--t1)]">
          어떤 교재를 만드나요?
        </h2>
        <p className="break-keep font-body text-[13px] text-[var(--t2)]">
          하나를 고르면 해야 할 걸음이 순서대로 나와요. 걸음마다 「여는 화면」이나 「Claude Code 지시문」 중 하나가 있어요.
        </p>
      </div>

      <div role="radiogroup" aria-label="교재 종류" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {MAKE_CASES.map((m) => (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={which === m.key}
            onClick={() => setWhich(m.key)}
            className={`flex min-h-[44px] flex-col gap-0.5 rounded-[var(--r-md)] border p-3 text-left transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] ${
              which === m.key ? 'border-[var(--p)] bg-[var(--p)]/8' : 'border-[var(--bd)] hover:bg-[var(--bg2)]'
            }`}
          >
            <span className="font-display text-[13.5px] font-[800] text-[var(--t1)]">
              {m.letter}. {m.name}
            </span>
            <span className="break-keep font-body text-[11.5px] leading-snug text-[var(--t2)]">{m.when}</span>
          </button>
        ))}
      </div>

      {/* ── 폼: 지시문에 들어갈 값 ── */}
      {c.form === 'series' || c.form === 'single' ? (
        <fieldset className="grid gap-3 rounded-[var(--r-md)] border border-[var(--bd)] p-3 sm:grid-cols-2">
          <legend className="px-1 font-display text-[12.5px] font-[700] text-[var(--t1)]">
            {c.form === 'single' ? '단행본 정보' : '새 시리즈 정보'}
          </legend>
          <Labeled label="이름 (브랜드)" hint="표지와 판권면에 그대로 찍혀요. 예) Vocaflow Grammar">
            <input className={field} value={sf.name} onChange={(e) => set({ name: e.target.value })} />
          </Labeled>
          <Labeled label="표지 짧은 이름 (선택)" hint="표지에 크게 찍히는 영문 한 낱말. 예) GRAMMAR">
            <input className={field} value={sf.short} onChange={(e) => set({ short: e.target.value.toUpperCase() })} />
          </Labeled>
          <Labeled
            label="시장 칸 (선택)"
            hint={`지금 있는 칸: ${[...new Set(seriesList.map((s) => s.kind))].join(' · ')} — 새 칸이면 새 이름`}
          >
            <input className={field} value={sf.kind} onChange={(e) => set({ kind: e.target.value })} />
          </Labeled>
          <Labeled
            label="표지 색 (선택)"
            hint={
              clash
                ? `⚠️ 「${clash.brand}」와 같은 색이에요 — 매대에서 같은 시리즈로 보여요`
                : `지금 쓰는 색: ${seriesList.map((s) => `${s.brand} ${s.accent}`).join(' · ')}`
            }
          >
            <input className={field} placeholder="#2F6FB5" value={sf.accent} onChange={(e) => set({ accent: e.target.value })} />
          </Labeled>
          <div className="sm:col-span-2">
            <Labeled label="이 책이 답하는 질문" hint="학습자가 이 책으로 무엇을 할 수 있게 되나 — 한 줄. 예) 문장의 규칙을 스스로 고치는가">
              <input className={field} value={sf.question} onChange={(e) => set({ question: e.target.value })} />
            </Labeled>
          </div>
          <Labeled label="왜 여나 (계기)">
            <select className={field} value={sf.trigger} onChange={(e) => set({ trigger: e.target.value })}>
              <option value="">고르세요</option>
              {TRIGGERS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label} — {t.asks}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="잰 날" hint="그때 본 숫자를 잰 날이에요">
            <input type="date" className={field} value={sf.measuredOn} onChange={(e) => set({ measuredOn: e.target.value })} />
          </Labeled>
          <div className="sm:col-span-2">
            <Labeled
              label="그때 본 숫자 (근거)"
              hint="예) 시중 교재 22종 중 문법 전문 시리즈 4종 · 우리 문법 문제 재고 3.1만 개"
            >
              <input className={field} value={sf.evidence} onChange={(e) => set({ evidence: e.target.value })} />
            </Labeled>
          </div>
          <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
            <legend className="font-display text-[12px] font-[700] text-[var(--t1)]">
              {c.form === 'single' ? '학년 (하나)' : '넣을 학년 (계단 설계에 쓰여요)'}
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {grades.map((g) => {
                const on = sf.grades.includes(g)
                return (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      set({
                        grades:
                          c.form === 'single'
                            ? on ? [] : [g]
                            : on ? sf.grades.filter((x) => x !== g) : [...sf.grades, g],
                      })
                    }
                    className={`min-h-[44px] rounded-[var(--r-sm)] border px-3 font-display text-[12.5px] font-[600] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] ${
                      on ? 'border-[var(--p)] bg-[var(--p)]/10 text-[var(--t1)]' : 'border-[var(--bd)] text-[var(--t2)] hover:bg-[var(--bg2)]'
                    }`}
                  >
                    {g}
                  </button>
                )
              })}
            </div>
          </fieldset>
        </fieldset>
      ) : null}

      {c.form === 'rename' ? (
        <fieldset className="grid gap-3 rounded-[var(--r-md)] border border-[var(--bd)] p-3 sm:grid-cols-2">
          <legend className="px-1 font-display text-[12.5px] font-[700] text-[var(--t1)]">이름 바꾸기</legend>
          <Labeled label="바꿀 시리즈">
            <select
              className={field}
              value={rf.seriesId}
              onChange={(e) => {
                const s = seriesList.find((x) => x.id === e.target.value)
                setRf((f) => ({ ...f, seriesId: e.target.value, oldName: s?.brand ?? '' }))
              }}
            >
              <option value="">고르세요</option>
              {seriesList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.brand}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="새 이름">
            <input className={field} value={rf.newName} onChange={(e) => setRf((f) => ({ ...f, newName: e.target.value }))} />
          </Labeled>
        </fieldset>
      ) : null}

      {/* ── 걸음 ── */}
      <ol className="flex flex-col gap-2">
        {c.steps.map((st, i) => (
          <li key={`${c.key}-${i}`} className="flex gap-3 rounded-[var(--r-md)] border border-[var(--bd)] p-3">
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--p)] font-display text-[13px] font-[800] text-[var(--on-p)]"
            >
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-[14px] font-[800] text-[var(--t1)]">{st.title}</h3>
                {st.decides ? (
                  <span className="inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-display text-[11px] font-[700] text-[var(--t2)]">
                    <UserRound size={11} strokeWidth={2} aria-hidden />
                    사람이 정해요
                  </span>
                ) : null}
              </div>
              <p className="break-keep font-body text-[13px] leading-relaxed text-[var(--t1)]">{st.doThis}</p>
              {st.where ? (
                <a
                  href={st.where.href}
                  className="inline-flex min-h-[44px] w-fit items-center gap-1 font-display text-[12.5px] font-[700] text-[var(--p)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
                >
                  {st.where.label} 열기 <ArrowRight size={14} strokeWidth={2} aria-hidden />
                </a>
              ) : null}
              {st.claude ? <PromptBox k={st.claude} form={st.claude === 'renameBrand' ? rf : sf} /> : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
