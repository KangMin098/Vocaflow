'use client'

// apps/web/src/components/csat/session/PaperDrop.tsx
//
// **문제지를 받는 한 줄.** 「이번 세션 PDF 1개 필요 · [평가원에서 받기 ↗] [여기 놓기]」
//
// 파일은 이 브라우저를 벗어나지 않는다 — 해시 64자만 나가고, 글자는 여기서 뽑아 기기에 남긴다
// (`lib/csat/reflow/read-paper.ts`). 원본 바이트는 저장하지 않는다.
//
// 해시가 모르는 파일인데 첫 쪽으로 회차를 못 정하면 **고르게 한다**(지시문 C1). 목록은 이 세션에
// 필요한 회차가 맨 앞이다 — 26개 중에서 찾게 하지 않는다.

import { Download, FileUp, Loader2 } from 'lucide-react'
import { useId, useRef, useState } from 'react'

import { track } from '@/lib/analytics/client'
import { readPaper, type ReadResult } from '@/lib/csat/reflow/read-paper'
import type { CachedPaper } from '@/lib/csat/reflow/types'
import type { LearnerCatalog } from '@/lib/csat/session/catalog'
import { savePaper } from '@/lib/csat/session/store'

const BTN =
  'inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-[var(--r-md)] border px-3 text-[15px] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ju)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none'

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'choose'; guess: string | null; finish: (examId: string) => Promise<ReadResult> }
  | { kind: 'error'; message: string }

export function PaperDrop({
  catalog,
  needed,
  onLoaded,
  compact = false,
}: {
  catalog: LearnerCatalog
  /** 이 세션에 필요한데 기기에 없는 회차 */
  needed: string[]
  onLoaded: (paper: CachedPaper) => void
  /** 문항 화면 안에서 쓸 때 — 설명 한 줄을 더 붙인다 */
  compact?: boolean
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [over, setOver] = useState(false)

  const typeOf = (examId: string, no: number) =>
    catalog.items.find((i) => i.exam_id === examId && i.no === no)?.type_id ?? null
  const wanted = (examId: string) => catalog.items.filter((i) => i.exam_id === examId).map((i) => i.no)
  const exams = Object.keys(catalog.exams)

  const settle = async (r: ReadResult, chosen: boolean) => {
    if (r.kind === 'ok') {
      await savePaper(r.paper)
      track({
        name: 'csat_paper_read',
        props: { known: r.known, items: r.paper.items.length, failed: r.failed, chosen },
      })
      setPhase({ kind: 'idle' })
      onLoaded(r.paper)
    } else if (r.kind === 'choose') {
      setPhase({ kind: 'choose', guess: r.guess, finish: r.finish })
    } else {
      setPhase({ kind: 'error', message: r.message })
    }
  }

  const take = async (file: File | null | undefined) => {
    if (!file) return
    setPhase({ kind: 'reading' })
    try {
      await settle(await readPaper(file, { typeOf, wanted, exams }), false)
    } catch {
      setPhase({ kind: 'error', message: '파일을 읽지 못했어요. 다른 파일로 다시 놓아 주세요.' })
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const first = needed[0]
  const source = first ? catalog.papers[first] : null
  const label = (id: string) => catalog.exams[id]?.label ?? id

  if (phase.kind === 'choose') {
    const order = [...needed, ...exams.filter((e) => !needed.includes(e)).sort((a, b) => catalog.exams[b].order - catalog.exams[a].order)]
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={`${inputId}-exam`} className="break-keep text-[15px] text-[var(--t2)]">
          어느 회차 문제지인가요?
        </label>
        <div className="flex flex-wrap gap-2">
          <select
            id={`${inputId}-exam`}
            defaultValue={phase.guess && exams.includes(phase.guess) ? phase.guess : (first ?? order[0])}
            className="min-h-[48px] min-w-0 flex-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 text-[15px] text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ju)]"
          >
            {order.map((e) => (
              <option key={e} value={e}>
                {label(e)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`${BTN} border-[var(--t1)] bg-[var(--t1)] text-[var(--bg)] hover:opacity-90 active:opacity-80`}
            onClick={async () => {
              const sel = document.getElementById(`${inputId}-exam`) as HTMLSelectElement | null
              if (!sel) return
              setPhase({ kind: 'reading' })
              await settle(await phase.finish(sel.value), true)
            }}
          >
            이 회차예요
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`rounded-[var(--r-md)] ${over ? 'bg-[var(--ju-light)]' : ''} transition-colors duration-[var(--dur-fast)] motion-reduce:transition-none`}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        void take(e.dataTransfer.files?.[0])
      }}
    >
      <p className="break-keep text-[15px] leading-relaxed text-[var(--t2)]" data-testid="paper-need">
        {compact
          ? `이 문항은 ${first ? label(first) : ''} 문제지에서 읽어 와요.`
          : `이번 세션 PDF ${needed.length}개 필요`}
        {first && needed.length === 1 && !compact ? ` · ${label(first)}` : ''}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {source ? (
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer noopener"
            className={`${BTN} border-[var(--bd)] bg-[var(--bg)] text-[var(--t1)] hover:border-[var(--t2)] active:bg-[var(--bg3)]`}
          >
            <Download aria-hidden className="h-4 w-4" />
            {source.direct ? '평가원에서 받기' : '평가원에서 찾기'} ↗
          </a>
        ) : null}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          data-testid="paper-input"
          onChange={(e) => void take(e.target.files?.[0])}
          disabled={phase.kind === 'reading'}
        />
        <label
          htmlFor={inputId}
          className={`${BTN} cursor-pointer border-[var(--bd)] bg-[var(--bg)] text-[var(--t1)] hover:border-[var(--t2)] active:bg-[var(--bg3)] [input:focus-visible+&]:outline [input:focus-visible+&]:outline-2 [input:focus-visible+&]:outline-offset-2 [input:focus-visible+&]:outline-[var(--ju)]`}
        >
          {phase.kind === 'reading' ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <FileUp aria-hidden className="h-4 w-4" />
          )}
          {phase.kind === 'reading' ? '읽는 중…' : '여기 놓기'}
        </label>
      </div>
      {phase.kind === 'error' ? (
        <p role="status" className="mt-2 break-keep text-[14px] text-[var(--t2)]">
          {phase.message}
        </p>
      ) : null}
      {!compact ? (
        <p className="mt-2 break-keep text-[13px] text-[var(--t3)]">파일은 이 기기 밖으로 나가지 않아요.</p>
      ) : null}
    </div>
  )
}
