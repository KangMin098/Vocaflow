'use client'

// apps/web/src/components/csat/session/SessionRunner.tsx
//
// **세션 한 판 — 문항을 하나씩 넘기고, 끝나면 한 줄로 닫는다.**
//
//   문항 → (문제지가 기기에 없으면 그 자리에서 받기/놓기) → ①②③ → 기록 반영 → 다음 문항
//   마지막 뒤: 「오늘 끝 · 2/3 정답 · 다음 복습 1문항 · 3일 뒤」 + [홈으로] [한 세트 더]
//
// 세션 구성은 URL(`?set=…&k=…`)에 실려 온다 — 새로 고침해도 같은 문항이다. 없으면 여기서 짠다.
// 기록은 문항마다 곧바로 저장한다 — 중간에 닫아도 푼 것은 남는다.

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { track } from '@/lib/analytics/client'
import { cropOf } from '@/lib/csat/reflow/read-paper'
import { REFLOW_VERSION } from '@/lib/csat/reflow/reflow'
import type { CachedPaper } from '@/lib/csat/reflow/types'
import type { LearnerCatalog } from '@/lib/csat/session/catalog'
import {
  applyResult,
  composeSession,
  type LearnerRecord,
  type SessionSlot,
  type SlotKind,
} from '@/lib/csat/session/model'
import { cachedExamIds, loadPaper, loadRecord, saveRecord } from '@/lib/csat/session/store'

import { ItemScreen, type ItemResult } from './ItemScreen'
import { PaperDrop } from './PaperDrop'
import { PRIMARY, sessionHref } from './SessionHome'

const DAY = 86_400_000

export function SessionRunner({
  catalog,
  initial,
}: {
  catalog: LearnerCatalog
  /** URL 로 받은 세션 — 서버가 후보에 있는지 확인한 것만 온다 */
  initial: { id: string; kind: SlotKind }[] | null
}) {
  const router = useRouter()
  const [slots, setSlots] = useState<SessionSlot[] | null>(null)
  const [index, setIndex] = useState(0)
  const [record, setRecord] = useState<LearnerRecord | null>(null)
  const [paper, setPaper] = useState<CachedPaper | null | 'missing'>(null)
  const [results, setResults] = useState<ItemResult[]>([])
  const started = useRef(Date.now())
  const topRef = useRef<HTMLDivElement | null>(null)

  // 세션 준비 — URL 세션 또는 여기서 짜기
  useEffect(() => {
    let alive = true
    void (async () => {
      const rec = await loadRecord()
      if (!alive) return
      setRecord(rec)
      const byId = new Map(catalog.items.map((i) => [i.id, i]))
      const fromUrl = (initial ?? [])
        .map((s) => ({ kind: s.kind, item: byId.get(s.id) }))
        .filter((s): s is SessionSlot => Boolean(s.item))
      if (fromUrl.length) {
        setSlots(fromUrl)
      } else {
        const cached = await cachedExamIds(REFLOW_VERSION)
        setSlots(composeSession(catalog, rec, new Date(), cached).slots)
      }
    })()
    return () => {
      alive = false
    }
  }, [catalog, initial])

  const current = slots && index < slots.length ? slots[index] : null

  // 지금 문항의 문제지
  useEffect(() => {
    if (!current) return
    let alive = true
    setPaper(null)
    void loadPaper(current.item.exam_id, REFLOW_VERSION).then((p) => {
      if (alive) setPaper(p ?? 'missing')
    })
    return () => {
      alive = false
    }
  }, [current])

  const done = useCallback(
    async (r: ItemResult) => {
      if (!current || !record) return
      const next = applyResult(record, { item: current.item, ...r }, new Date())
      setRecord(next)
      await saveRecord(next)
      const all = [...results, r]
      setResults(all)
      if (slots && index + 1 >= slots.length) {
        track({
          name: 'csat_session_finished',
          props: {
            total: all.length,
            correct: all.filter((x) => x.correct === true).length,
            confused: all.filter((x) => x.confused).length,
            seconds: Math.round((Date.now() - started.current) / 1000),
          },
        })
      }
      setIndex((i) => i + 1)
      // 새 문항은 맨 위에서 — 포커스도 옮긴다(스크린리더가 새 문항을 읽게)
      window.scrollTo({ top: 0 })
      window.setTimeout(() => topRef.current?.focus(), 0)
    },
    [current, index, record, results, slots],
  )

  if (!slots || !record) {
    return <p className="text-[15px] text-[var(--t3)]" aria-busy="true">세션을 준비하고 있어요…</p>
  }

  if (!slots.length) {
    return (
      <div className="flex flex-col gap-4">
        <p className="break-keep text-[17px] text-[var(--t1)]">오늘 풀 문항을 아직 못 골랐어요.</p>
        <Link href="/csat" className={PRIMARY}>
          홈으로
        </Link>
      </div>
    )
  }

  if (!current) {
    return (
      <Finish
        record={record}
        results={results}
        onMore={async () => {
          const cached = await cachedExamIds(REFLOW_VERSION)
          const plan = composeSession(catalog, record, new Date(), cached)
          track({
            name: 'csat_session_started',
            props: {
              size: plan.slots.length,
              review: plan.slots.some((s) => s.kind === 'review'),
              needed: plan.exams.length,
              cached: plan.exams.filter((e) => cached.includes(e)).length,
            },
          })
          setSlots(plan.slots)
          setIndex(0)
          setResults([])
          started.current = Date.now()
          router.replace(sessionHref(plan))
        }}
      />
    )
  }

  const typeName = catalog.types.find((t) => t.id === current.item.type_id)?.name ?? current.item.type_id
  const reflow = paper && paper !== 'missing' ? paper.items.find((i) => i.no === current.item.no) ?? null : null

  return (
    <div ref={topRef} tabIndex={-1} className="outline-none">
      {paper === null ? (
        <p className="text-[15px] text-[var(--t3)]" aria-busy="true">문제지를 여는 중…</p>
      ) : paper === 'missing' || !reflow ? (
        <section aria-labelledby="need-paper-h" className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5">
          <p className="font-mono text-[14px] tabular-nums text-[var(--t3)]">
            {index + 1} / {slots.length}
          </p>
          <h1 id="need-paper-h" className="break-keep text-[20px] font-[700] text-[var(--t1)]">
            {catalog.exams[current.item.exam_id]?.label ?? current.item.exam_id} {current.item.no}번
          </h1>
          <PaperDrop
            catalog={catalog}
            needed={[current.item.exam_id]}
            compact
            onLoaded={(p) => {
              if (p.exam_id === current.item.exam_id) setPaper(p)
            }}
          />
        </section>
      ) : (
        <ItemScreen
          key={current.item.id}
          item={current.item}
          typeName={typeName}
          seq={index + 1}
          total={slots.length}
          paper={reflow}
          crop={cropOf(current.item.exam_id, current.item.no)}
          review={current.kind === 'review'}
          onDone={(r) => void done(r)}
        />
      )}
    </div>
  )
}

function Finish({ record, results, onMore }: { record: LearnerRecord; results: ItemResult[]; onMore: () => void }) {
  const correct = results.filter((r) => r.correct === true).length
  const now = Date.now()
  const upcoming = record.reviews
    .map((r) => Date.parse(r.due))
    .filter((t) => t > now)
    .sort((a, b) => a - b)
  const nextDays = upcoming.length ? Math.max(1, Math.round((upcoming[0] - now) / DAY)) : null
  const nextCount = nextDays === null ? 0 : upcoming.filter((t) => Math.round((t - now) / DAY) <= nextDays).length

  return (
    <section aria-labelledby="finish-h" className="flex flex-col gap-4 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5" data-testid="finish">
      <h1 id="finish-h" tabIndex={-1} className="font-editorial text-[24px] font-[600] text-[var(--t1)]">
        오늘 끝
      </h1>
      <p className="break-keep text-[17px] text-[var(--t2)]">
        <span className="font-mono tabular-nums text-[var(--t1)]">
          {correct}/{results.length}
        </span>{' '}
        정답
        {nextDays !== null ? (
          <>
            {' · '}다음 복습 <span className="font-mono tabular-nums text-[var(--t1)]">{nextCount}</span>문항 ·{' '}
            {nextDays === 1 ? '내일' : `${nextDays}일 뒤`}
          </>
        ) : null}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Link href="/csat" className={PRIMARY} data-testid="home">
          홈으로
        </Link>
        <button
          type="button"
          onClick={onMore}
          className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-5 text-[17px] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] hover:border-[var(--t2)] active:bg-[var(--bg3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ju)] motion-reduce:transition-none"
          data-testid="more-set"
        >
          한 세트 더
          <ArrowRight aria-hidden className="h-5 w-5" />
        </button>
      </div>
    </section>
  )
}
