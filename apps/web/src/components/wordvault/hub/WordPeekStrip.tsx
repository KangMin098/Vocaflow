// apps/web/src/components/wordvault/hub/WordPeekStrip.tsx
//
// WordPeekStrip — 최근 만난 단어 미리보기 (데스크톱 전용)
//
// 의도:
//   - 자산 관리 hub 의 "Word Peek" — 자산 정체성 환기 (단어 자체 노출)
//   - Cognitive Load 관리: 모바일은 hidden (390px 자원 보호)
//
// 카드 구조:
//   [memory dot] [영단어 Lora] · [한글 의미]
//
// 클릭 시: /wordvault?view=browse&q={word} (browse 검색에 단어 프리필)

'use client'

import Link from 'next/link'

import { MEMORY_LABEL } from '@/lib/framework/memory-labels'

export type PeekMemoryState = 'stable' | 'shaky' | 'risk' | 'new'

export interface PeekWord {
  id: string | number
  word: string
  meaning: string
  memoryState: PeekMemoryState
}

interface WordPeekStripProps {
  words: PeekWord[]
  className?: string
}

const STATE_COLOR: Record<PeekMemoryState, string> = {
  stable: 'var(--memory-stable)',
  shaky: 'var(--memory-shaky)',
  risk: 'var(--memory-risk)',
  new: 'var(--memory-new)',
}

// 이름은 레지스트리에서 — 같은 화면 안에서 어휘가 갈리던 것을 막는다
const STATE_LABEL: Record<PeekMemoryState, string> = {
  stable: MEMORY_LABEL.stable.label,
  shaky: MEMORY_LABEL.shaky.label,
  risk: MEMORY_LABEL.risk.label,
  new: MEMORY_LABEL.new.label,
}

export function WordPeekStrip({ words, className }: WordPeekStripProps) {
  if (words.length === 0) return null

  return (
    <section
      aria-label="최근에 만난 단어"
      className={className ?? 'hidden md:flex md:flex-col md:gap-2'}
    >
      <h3 className="font-display text-[13px] font-[600] text-[var(--t2)]">
        최근에 만난 단어
      </h3>
      <ul className="flex flex-wrap gap-2">
        {words.slice(0, 5).map((w) => (
          <li key={w.id}>
            <Link
              href={`/wordvault?view=browse&q=${encodeURIComponent(w.word)}`}
              aria-label={`${w.word} (${STATE_LABEL[w.memoryState]}) — ${w.meaning}`}
              className="group inline-flex items-center gap-2 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-1.5 transition-colors duration-[var(--dur-normal)] hover:border-[var(--p)] hover:bg-[var(--bg3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: STATE_COLOR[w.memoryState] }}
              />
              <span className="font-english text-[14px] font-[600] text-[var(--t1)]">
                {w.word}
              </span>
              <span className="font-body text-[12px] text-[var(--t2)]">
                · {w.meaning}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
