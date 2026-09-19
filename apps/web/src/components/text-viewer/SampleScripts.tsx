// apps/web/src/components/text-viewer/SampleScripts.tsx
// 예시 글 5개 — 고르면 본문에 들어가고, 700ms 뒤 그 자리에서 칠해진다(`/text/new` DD-30).
//
// 2026-09-19 화면 재설계: 예시마다 달려 있던 「280단어」「쉬움/보통/어려움」 은 **지어낸 상수**였다 —
//   「280단어」 예시의 실제 본문은 40낱말 남짓이다(I5). 단어 수는 본문에서 세고, 난이도는 적지 않는다 —
//   고르면 칠해진 원문과 학년별 커버리지가 실제로 말한다. 5열 카드(그라디언트 칩 · 떠오르는 hover)는 괘선 목록으로.

'use client'

import { ArrowRight } from 'lucide-react'

export interface Sample {
  id: string
  title: string
  source: string
  text: string
}

const samples: Sample[] = [
  {
    id: 'ted-jobs',
    title: 'Stay hungry, stay foolish',
    source: 'Steve Jobs · Stanford 2005',
    text: `Your time is limited, so don't waste it living someone else's life. Don't be trapped by dogma, which is living with the results of other people's thinking. Don't let the noise of others' opinions drown out your own inner voice.`,
  },
  {
    id: 'bbc-news',
    title: 'Climate change update',
    source: 'BBC News',
    text: `Scientists have warned that the world is on track for catastrophic global warming, with current policies likely to result in a temperature rise of nearly three degrees Celsius by the end of the century.`,
  },
  {
    id: 'ted-habits',
    title: 'The power of habits',
    source: 'TED Talk · Charles Duhigg',
    text: `Every habit has three components: a cue, a routine, and a reward. Once you understand this loop, you can change any behavior. The key is to identify your cue and reward, then experiment with different routines.`,
  },
  {
    id: 'wiki-history',
    title: 'The Renaissance',
    source: 'Wikipedia',
    text: `The Renaissance was a fervent period of European cultural, artistic, political and economic rebirth following the Middle Ages. Generally described as taking place from the 14th century to the 17th century.`,
  },
  {
    id: 'blog-tech',
    title: 'Why AI matters in 2026',
    source: 'Tech Blog',
    text: `Artificial intelligence is no longer just a buzzword. It has become an essential part of how we work, learn, and communicate. From writing assistants to medical diagnosis, AI is reshaping industries.`,
  },
]

export interface SampleScriptsProps {
  onSelect: (text: string, title: string) => void
}

/** 본문에서 센 낱말 수 — 상수로 적지 않는다 */
export function wordCountOf(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function SampleScripts({ onSelect }: SampleScriptsProps) {
  return (
    <section aria-labelledby="sample-scripts-title">
      <h2 id="sample-scripts-title" className="font-display text-[12px] font-[700] text-t2">
        예시 글로 먼저 보기 <span className="font-body font-[400] text-t2">— 고르면 본문에 들어가고 바로 칠해져요</span>
      </h2>
      <ul className="mt-s-2 border-t border-bd">
        {samples.map((sample) => (
          <li key={sample.id} className="border-b border-bd">
            <button
              type="button"
              onClick={() => onSelect(sample.text, sample.title)}
              className="group flex min-h-[44px] w-full items-baseline gap-s-3 px-s-1 py-s-2 text-left transition-colors duration-normal hover:bg-bg2 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--p)] active:translate-y-px"
            >
              <span className="min-w-0 flex-1 truncate font-english text-[15px] text-t1">{sample.title}</span>
              <span className="hidden shrink-0 font-body text-[12px] text-t2 sm:inline">{sample.source}</span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-t2">{wordCountOf(sample.text)}낱말</span>
              <ArrowRight size={13} aria-hidden className="shrink-0 self-center text-t2 group-hover:text-[var(--p)]" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
