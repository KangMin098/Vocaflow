// apps/web/src/components/csat/diagnosis/OmrForm.tsx
//
// 시험 기록 입력(OMR) — 학습자 /csat/diagnosis/attempts/new 와 관리자 대리 입력이 함께 쓴다.
// 기본값은 「확신」. 헷갈림·찍음·시간 부족은 **예외 문항만** 표시한다(45개 전부 태그하게 하면 입력을 포기한다).
// 키보드: 칸에서 1~5 = 고르고 다음 번호로 · 0/Backspace = 비우기 · ↑↓ = 이동.
// 점수는 서버가 정답표로 매긴다 — 여기서는 고른 답과 표시만 보낸다.

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import { track } from '@/lib/analytics/client'

export interface OmrExam {
  id: string
  label: string
  ready: boolean
}

type Flag = 'unsure' | 'guess' | 'timeout'
const FLAG_LABEL: Record<Flag, string> = { unsure: '헷갈림', guess: '찍음', timeout: '시간 부족' }
const CIRCLED = ['①', '②', '③', '④', '⑤']

const btn =
  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--r-md)] border border-[var(--bd)] font-display text-[14px] font-[700] transition-colors duration-[var(--dur-fast,120ms)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--p)]'

export interface OmrResult {
  raw: number
  grade: number | null
  ready: boolean
  snapshotId: string
}

export function OmrForm({
  exams,
  endpoint,
  userId,
  today,
  onSaved,
  trackEvents = true,
  reportHref,
}: {
  exams: OmrExam[]
  endpoint: string
  userId?: string
  today: string
  onSaved?: (r: OmrResult) => void
  /** 관리자 대리 입력은 학습자 퍼널에 세지 않는다 */
  trackEvents?: boolean
  /** 저장 뒤 보여 줄 리포트 링크(학습자 화면) */
  reportHref?: string
}) {
  const [examId, setExamId] = useState(exams[0]?.id ?? '')
  const [retake, setRetake] = useState(false)
  const [takenAt, setTakenAt] = useState(today)
  const [choices, setChoices] = useState<Record<number, number | null>>({})
  const [flags, setFlags] = useState<Record<number, Flag>>({})
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<OmrResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const clientKey = useRef<string>(crypto.randomUUID())
  const rows = useRef<(HTMLDivElement | null)[]>([])

  const exam = exams.find((e) => e.id === examId)
  const answered = Object.values(choices).filter((v) => v !== null && v !== undefined).length

  const focusRow = (no: number) => rows.current[no - 1]?.focus()
  const pick = (no: number, v: number | null) => {
    if (result || saving) return // 저장 중·저장한 기록은 잠근다 — 「새 기록 입력」을 눌러야 다시 쓴다(같은 기록이 두 번 쌓이지 않게)
    setChoices((c) => ({ ...c, [no]: v }))
  }
  const reset = () => {
    clientKey.current = crypto.randomUUID()
    setChoices({})
    setFlags({})
    setRetake(false)
    setResult(null)
    setError(null)
  }
  const toggleFlag = (no: number, f: Flag) =>
    !result && !saving && setFlags((cur) => {
      const next = { ...cur }
      if (next[no] === f) delete next[no]
      else next[no] = f
      return next
    })

  const onKey = (no: number, e: React.KeyboardEvent) => {
    if (/^[1-5]$/.test(e.key)) {
      e.preventDefault()
      pick(no, Number(e.key))
      if (no < 45) focusRow(no + 1)
    } else if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      pick(no, null)
    } else if (e.key === 'ArrowDown' && no < 45) {
      e.preventDefault()
      focusRow(no + 1)
    } else if (e.key === 'ArrowUp' && no > 1) {
      e.preventDefault()
      focusRow(no - 1)
    }
  }

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(userId ? { userId } : {}),
          examId,
          mode: retake ? 'retake' : 'live',
          takenAt,
          clientKey: clientKey.current,
          choices: Object.fromEntries(Array.from({ length: 45 }, (_, i) => [i + 1, choices[i + 1] ?? null])),
          flags,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '저장하지 못했어요')
      setResult(json)
      if (trackEvents) track({ name: 'csat_dx_attempt_saved', props: { ready: Boolean(json.ready), retake, answered } })
      onSaved?.(json)
      router.refresh() // 같은 화면의 리포트·기록 표(관리자 상세)가 새 스냅샷을 읽게
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요')
    } finally {
      setSaving(false)
    }
  }

  if (exams.length === 0) {
    return <p className="break-keep font-body text-[14px] text-[var(--t2)]">아직 입력할 수 있는 시험이 없어요.</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 font-body text-[14px] text-[var(--t1)]">
          어떤 시험인가요?
          <select
            className="min-h-[44px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2 text-[14px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
            value={examId}
            disabled={result !== null || saving}
            onChange={(e) => setExamId(e.target.value)}
          >
            {exams.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </label>
        <label className="flex min-h-[44px] items-center gap-2 break-keep font-body text-[14px] text-[var(--t1)]">
          <input type="checkbox" className="h-5 w-5" disabled={result !== null || saving} checked={retake} onChange={(e) => setRetake(e.target.checked)} />
          이미 풀어 본 기출을 다시 푼 거예요
        </label>
        <label className="flex flex-col gap-1 font-body text-[14px] text-[var(--t1)]">
          응시일
          <input
            type="date"
            max={today}
            disabled={result !== null || saving}
            className="min-h-[44px] w-[200px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2 text-[14px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
            value={takenAt}
            onChange={(e) => setTakenAt(e.target.value)}
          />
        </label>
        {exam && !exam.ready && (
          <p role="note" className="break-keep rounded-[var(--r-md)] border border-[var(--bd)] p-3 font-body text-[13px] text-[var(--t1)]">
            이 시험은 점수만 반영되고, 상세 진단(강점·약점·함정)은 준비 중이에요.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <p className="break-keep font-body text-[13px] text-[var(--t2)]">
          1~45번 내가 고른 답을 눌러 주세요. 모르면 비워 두세요. 헷갈렸거나 찍은 문항만 오른쪽에 표시해 주세요. 칸을 누른 뒤 숫자 키 1~5로도 입력할 수 있어요.
        </p>
        <div role="group" aria-label="답안" className="flex flex-col">
          {Array.from({ length: 45 }, (_, i) => i + 1).map((no) => (
            <div
              key={no}
              ref={(el) => { rows.current[no - 1] = el }}
              tabIndex={0}
              onKeyDown={(e) => onKey(no, e)}
              aria-label={`${no}번`}
              className="flex flex-wrap items-center gap-2 border-b border-[var(--bd)] py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
            >
              <span className="w-[36px] font-display text-[14px] font-[800] text-[var(--t1)]">{no}</span>
              <div role="radiogroup" aria-label={`${no}번 답`} className="flex gap-1">
                {CIRCLED.map((c, k) => {
                  const v = k + 1
                  const on = choices[no] === v
                  return (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={`${no}번 ${v}`}
                      tabIndex={-1}
                      onClick={() => pick(no, on ? null : v)}
                      className={`${btn} ${on ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)]' : 'bg-[var(--bg)] text-[var(--t1)]'}`}
                    >
                      {c}
                    </button>
                  )
                })}
              </div>
              <div className="ml-auto flex gap-1">
                {(Object.keys(FLAG_LABEL) as Flag[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={flags[no] === f}
                    aria-label={`${no}번 ${FLAG_LABEL[f]}`}
                    onClick={() => toggleFlag(no, f)}
                    className={`${btn} px-2 text-[12px] ${flags[no] === f ? 'border-[var(--p)] text-[var(--p)]' : 'text-[var(--t2)]'}`}
                  >
                    {FLAG_LABEL[f]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving || !examId || result !== null}
          onClick={submit}
          className="inline-flex min-h-[48px] items-center justify-center rounded-[var(--r-md)] bg-[var(--p)] px-5 font-display text-[15px] font-[800] text-[var(--on-p)] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
        >
          {saving ? '저장하는 중…' : '저장하고 진단 받기'}
        </button>
        {(result || error) && (
          <button type="button" onClick={reset} className="inline-flex min-h-[48px] items-center rounded-[var(--r-md)] border border-[var(--bd)] px-4 font-display text-[14px] font-[700] text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]">
            새 기록 입력
          </button>
        )}
        <span className="font-body text-[13px] text-[var(--t2)]">입력 {answered}/45 · 표시 {Object.keys(flags).length}</span>
      </div>
      <div aria-live="polite">
        {result && (
          <p className="break-keep font-body text-[15px] font-[700] text-[var(--t1)]">
            {result.raw}점, {result.grade ?? '—'}등급. {result.ready ? '진단을 업데이트했어요.' : '점수만 반영했어요. 상세 진단은 준비 중이에요.'}
            {reportHref && (
              <>
                {' '}
                <Link href={reportHref} className="underline">리포트 보기</Link>
              </>
            )}
          </p>
        )}
        {error && <p role="alert" className="break-keep font-body text-[14px] text-[var(--t1)]">{error}</p>}
      </div>
    </div>
  )
}
