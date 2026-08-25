// apps/web/src/components/home/TodayReading.tsx
//
// 오늘 읽을 것 — **처방이 고른 실제 글**을 제목으로 세우는 자리.
//
// ─────────────────────────────────────────────────────────────
// 왜 만들었나 (2026-08-16 지면 계측)
//
// 캡처 하네스에 지면 배분 계측을 붙이고 `/hub` 을 재 보니 구성이 이랬다:
//
//     오늘(단어 무대 + 흐름)   367px (49%)
//     뒤따르는 단어            388px (51%)   ← 행동 불가 목록 7행
//
// **관문의 절반**을 누를 수도 없는 단어 목록이 쓰고 있었다(`<li>` 안에 단어·뜻·"1일" 뿐,
// 링크도 버튼도 없다). 그동안 처방은 오늘 읽을 글을 **5편이나 골라 두고 있었는데**
// (`prescribe_today` → `input.candidates`, 제목·CEFR·register 포함) 화면은 흐름 목록에
// `Read · 30분` 이라고만 적었다 — **무엇을 읽게 되는지 제목조차 볼 수 없었다.**
//
// 이 제품은 단어에 대해 이미 같은 결론을 내린 적이 있다(v06.200):
//   "개수는 할 일을 말하지만 단어는 그 자체가 학습 재료다."
// 읽을거리에는 그 결론이 적용되지 않고 있었다. `Read · 30분` 은 개수와 같은 것이고,
// 제목·수준·성격이 있어야 학습자가 **고를** 수 있다.
// ─────────────────────────────────────────────────────────────
//
// 설계 규칙:
//   ① **단일 CTA 를 깨지 않는다.** 화면의 1차 행동은 무대의 "지금 시작" 하나다.
//      여기 행들은 목록 항목(2차)이고, 채워진 버튼을 쓰지 않는다.
//   ② **3편만** 보여준다. 처방은 5편을 주지만 고르는 자리에 5개는 많다(작업기억 ~4).
//   ③ 이름은 레지스트리에서 — register 한국어 라벨은 `lib/articles/source-guide` 소유.

'use client'

import { useState } from 'react'

import { ArrowRight, BookOpenText, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { REGISTER_LABEL } from '@/lib/articles/source-guide'
import { startArticleLearning } from '@/lib/articles/start-learning'
import type { PrescriptionCandidate } from '@/lib/learner/prescription-actions'

/** 고르는 자리에 5개는 많다 — 작업기억 ~4 항목(학습원칙 ⑥). */
const SHOWN = 3

export function TodayReading({ candidates }: { candidates: PrescriptionCandidate[] }) {
  const shown = candidates.slice(0, SHOWN)
  if (shown.length === 0) return null

  return (
    <section
      aria-label="오늘 읽을 것"
      className="rounded-ios-2xl bg-[var(--bg)] px-5 py-4 shadow-ios-1 md:px-8 md:py-5"
    >
      <header className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="font-mono text-[10px] font-[700] uppercase tracking-[0.16em] text-[var(--t3)]">
          오늘 읽을 것
        </h2>
        <p className="font-body text-[12px] text-[var(--t3)]">지금 수준에서 읽을 수 있는 글이에요</p>
      </header>

      <ul className="mt-2 divide-y divide-[var(--bd)]">
        {shown.map((c) => (
          <li key={c.id}>
            <ReadingRow candidate={c} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function ReadingRow({ candidate }: { candidate: PrescriptionCandidate }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const meta = [
    candidate.cefrLevel,
    candidate.register ? (REGISTER_LABEL[candidate.register] ?? candidate.register) : null,
  ].filter(Boolean) as string[]

  // 행 자체의 조판 — 채워진 버튼을 쓰지 않는다(단일 CTA 규칙).
  const rowClass =
    'group flex w-full items-baseline gap-3 rounded-[var(--r-md)] px-2 py-3 text-left no-underline motion-safe:transition-colors motion-safe:duration-[var(--dur-ios-fast)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:cursor-progress disabled:opacity-70'

  const inner = (
    <>
      <BookOpenText
        size={15}
        strokeWidth={1.9}
        aria-hidden
        className="mt-[3px] shrink-0 text-[var(--t3)]"
      />
      <span className="min-w-0 flex-1">
        <span className="block font-editorial text-[16px] font-[500] leading-snug text-[var(--t1)] [word-break:keep-all] md:text-[17px]">
          {candidate.title}
        </span>
        {meta.length > 0 && (
          <span className="mt-0.5 block font-mono text-[11px] tabular-nums text-[var(--t3)]">
            {meta.join(' · ')}
          </span>
        )}
      </span>
      {busy ? (
        <Loader2 size={14} className="mt-1 shrink-0 animate-spin text-[var(--t3)]" aria-hidden />
      ) : (
        <ArrowRight
          size={14}
          aria-hidden
          className="mt-1 shrink-0 text-[var(--t3)] motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
        />
      )}
    </>
  )

  // 도서는 URL 직결. 글(article)은 `texts` 행으로 변환한 뒤에야 주소가 생긴다
  // (`startArticleLearning` — 흐름의 CTA 와 같은 계약).
  if (candidate.kind === 'book') {
    return (
      <Link href={`/library/books/${candidate.id}`} className={rowClass}>
        {inner}
      </Link>
    )
  }

  async function open() {
    if (busy) return
    setBusy(true)
    setError(null)
    const res = await startArticleLearning(candidate.id)
    if (res.ok) {
      router.push(`/text/${res.textId}?mode=read`)
      return
    }
    // 실패를 삼키지 않는다 — 조용히 아무 일도 안 일어나면 "눌리지 않는 행" 이 된다.
    setError(res.error)
    setBusy(false)
  }

  return (
    <>
      <button type="button" onClick={open} disabled={busy} className={rowClass}>
        {inner}
      </button>
      {error && (
        <p role="alert" className="px-2 pb-2 font-body text-[12px] text-[var(--t2)]">
          {error}
        </p>
      )}
    </>
  )
}
