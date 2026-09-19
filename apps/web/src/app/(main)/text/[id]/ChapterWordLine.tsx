// apps/web/src/app/(main)/text/[id]/ChapterWordLine.tsx
//
// **이 챕터의 낱말 줄** — `/text/[id]` 첫 시선(2026-09-19 · DD-27 수정 1회차).
//
// 원문 낱말에 R(t) 밑줄을 실어도 **첫 화면에는 칠해진 낱말이 하나도 없었다** — 학습 낱말은 챕터에 30개 안팎이고
// 첫 출현만 표시되는데, 그 자리가 대개 첫 화면 아래다(런타임 계정 실측: 흐릿해요 21 · 처음 9 가 모두 폴드 밖).
// 그래서 원문 바로 위에 그 낱말들을 **나오는 순서대로 한 줄**로 조판한다 — 허브 골든의 낱말 줄과 같은 문법
// (Lora + 밑줄 두께 3/2/1px · dotted = 처음). 낱말을 누르면 원문의 그 자리로 간다(즉시 · 포커스 링 — 7종 안).

'use client'

import { DecayUnderline } from '@/components/ui/press'
import type { TextParagraph } from './text-content-helpers'

const ORDER = ['risk', 'shaky', 'stable', 'new'] as const
const KO = { stable: '알아요', shaky: '익숙해요', risk: '흐릿해요', new: '처음 만나요' } as const

export interface LineWord {
  id: string
  text: string
  status: (typeof ORDER)[number]
}

/** 원문에 나오는 순서의 학습 낱말(첫 출현 — 원문 표시와 같은 규칙) */
export function chapterLineWords(paragraphs: TextParagraph[]): LineWord[] {
  const out: LineWord[] = []
  const seen = new Set<string>()
  for (const p of paragraphs)
    for (const s of p.sentences)
      for (const part of s.parts)
        if (part.word && !seen.has(part.word.id)) {
          seen.add(part.word.id)
          out.push({ id: part.word.id, text: part.word.text, status: part.word.status })
        }
  return out
}

function locate(id: string) {
  const el = document.querySelector<HTMLElement>(`[data-word="${CSS.escape(id)}"]`)
  if (!el) return
  // 부드러운 스크롤은 쓰지 않는다(학습 화면 모션 7종 밖) — 즉시 옮기고 포커스 링으로 자리를 알린다
  el.scrollIntoView({ block: 'center' })
  el.setAttribute('tabindex', '-1')
  el.focus({ preventScroll: true })
}

export function ChapterWordLine({ words, failed }: { words: LineWord[]; failed: boolean }) {
  if (words.length === 0) return null
  const counts = Object.fromEntries(ORDER.map((k) => [k, words.filter((w) => w.status === k).length])) as Record<
    (typeof ORDER)[number],
    number
  >

  return (
    <section aria-label="이 챕터의 학습 낱말" className="mx-auto w-full max-w-[680px] border-b border-[var(--bd)] px-5 pb-4 pt-5 md:px-0">
      <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums text-[var(--t2)]">
        <span>이 챕터의 낱말 {words.length}</span>
        {failed ? (
          <span role="status">기억 상태를 불러오지 못했어요 — 모두 처음으로 보여요</span>
        ) : (
          ORDER.filter((k) => counts[k] > 0).map((k) => (
            <span key={k} className="font-display text-[11.5px] font-[600] text-[var(--t1)]">
              <DecayUnderline state={k}>{KO[k]}</DecayUnderline> <span className="font-mono text-[var(--t2)]">{counts[k]}</span>
            </span>
          ))
        )}
      </p>
      <p lang="en" className="m-0 mt-1 line-clamp-3 font-english text-[16px] leading-[1.6] md:line-clamp-2">
        {words.map((w, i) => (
          <span key={w.id}>
            <button
              type="button"
              onClick={() => locate(w.id)}
              aria-label={`${w.text} — ${KO[w.status]}, 원문에서 찾기`}
              // 44px 터치 하한 — 줄 높이를 버튼이 맡는다
              className="inline-flex min-h-11 items-center rounded-[var(--r-sm)] text-[var(--t1)] transition-colors duration-[var(--dur-fast)] hover:bg-[var(--bg2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
            >
              <DecayUnderline state={w.status}>{w.text}</DecayUnderline>
            </button>
            {i < words.length - 1 && ' '}
          </span>
        ))}
      </p>
    </section>
  )
}
