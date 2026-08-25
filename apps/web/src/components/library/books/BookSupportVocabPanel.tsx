// apps/web/src/components/library/books/BookSupportVocabPanel.tsx
//
// "이 책의 말" — 책 고유 어휘 읽기 지원 패널 (ADR 0004 D5).
//
// 왜 챕터 단어장과 별개인가: Treasure Island 의 crosstrees·keelhauling·deadlight 같은
// 항해어는 shared_dictionary 미등재라 챕터 단어장에 못 들어간다. 그렇다고 버리면
// 이 책을 읽게 만드는 말이 통째로 사라진다. 반대로 학습 목표 어휘에 넣는 것도 틀렸다 —
// 항해 전문어는 한국 고등학생 어휘 목표가 아니다.
//   → **외울 목록이 아니라 읽을 때 참고하는 목록**으로 분리한다.
//
// 그래서 word set 이 아니다: shared_word_sets 는 구독하면 FSRS 를 타는 "학습 목록"이라,
// 여기 담으면 세 곳(목록·추천·구독)에 예외를 달아야 한다. 읽기 전용 RPC
// (list_book_support_vocab)로 직접 읽는다 — 구독 개념 자체가 없다.
//
// Calm UI + Progressive Disclosure: 기본 접힘. 펼칠 때 한 번만 fetch.
'use client'

import { useState } from 'react'
import { Compass, ChevronDown, Loader2 } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface SupportWord {
  word: string
  meaning_ko: string
  occurrences: number
}

export function BookSupportVocabPanel({ bookId }: { bookId: string }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<SupportWord[] | null>(null)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    const next = !open
    setOpen(next)
    if (!next || rows || loading) return
    setLoading(true)
    try {
      // database.ts 재생성 전이라 신규 RPC 가 타입에 없음 — 코드베이스 관례대로 loose client.
      const sb = createClient() as unknown as SupabaseClient
      const { data } = await sb.rpc('list_book_support_vocab', {
        p_book_id: bookId,
        p_limit: 60,
      })
      setRows((data ?? []) as unknown as SupportWord[])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  // 열기 전에는 건수를 모른다 — 0건인 책에서도 헤더는 뜬다. 열어서 0이면 그 사실을 말한다.
  // (건수만 미리 세려고 별도 왕복을 하는 건 이 패널의 비중에 비해 과하다.)
  return (
    <section
      aria-labelledby="support-vocab-title"
      className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)]"
    >
      <button
        type="button"
        onClick={() => void toggle()}
        aria-expanded={open}
        className="flex min-h-[52px] w-full items-center gap-3 rounded-[var(--r-lg)] px-4 py-3 text-left transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
      >
        <Compass size={16} className="shrink-0 text-[var(--t2)]" aria-hidden />
        <span className="flex flex-1 flex-col gap-1">
          <span
            id="support-vocab-title"
            className="font-display text-[13px] font-[700] text-[var(--t1)]"
          >
            이 책의 말
          </span>
          <span className="font-body text-[11px] leading-relaxed text-[var(--t2)]">
            이 책에만 자주 나오는 말이에요. 외울 단어가 아니라 읽을 때 참고하세요.
          </span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className="shrink-0 text-[var(--t2)] transition-transform duration-[var(--dur-normal)] ease-[var(--ease)]"
          style={{ transform: open ? 'rotate(180deg)' : undefined }}
        />
      </button>

      {open && (
        <div className="border-t border-[var(--bd)] px-4 py-3">
          {loading && (
            <p className="flex items-center gap-2 font-body text-[12px] text-[var(--t2)]">
              <Loader2 size={14} className="animate-spin" aria-hidden />
              불러오는 중이에요
            </p>
          )}
          {!loading && rows?.length === 0 && (
            <p className="font-body text-[12px] leading-relaxed text-[var(--t2)]">
              이 책에는 따로 안내할 고유 어휘가 없어요.
            </p>
          )}
          {!loading && rows && rows.length > 0 && (
            <ul className="flex flex-col gap-2">
              {rows.map((r) => (
                <li key={r.word} className="flex items-baseline gap-2">
                  <span className="font-display text-[13px] font-[600] text-[var(--t1)]">
                    {r.word}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-[var(--t2)]">
                    {r.occurrences}회
                  </span>
                  <span className="flex-1 font-body text-[12px] leading-relaxed text-[var(--t2)]">
                    {r.meaning_ko}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
