// apps/web/src/components/text-viewer/SampleScripts.tsx
// 샘플 스크립트 5개 (사용자가 빠르게 시작)

'use client'

import { cn } from '@/lib/utils/cn'
import { BookOpen, Mic, Newspaper, Sparkles, Zap } from 'lucide-react'

export interface Sample {
  id: string
  title: string
  source: string
  difficulty: '쉬움' | '보통' | '어려움'
  wordCount: number
  text: string
  icon: typeof Sparkles
  color: string
}

const samples: Sample[] = [
  {
    id: 'ted-jobs',
    title: 'Stay hungry, stay foolish',
    source: 'Steve Jobs · Stanford 2005',
    difficulty: '보통',
    wordCount: 280,
    icon: Mic,
    color: '#3B82F6',
    text: `Your time is limited, so don't waste it living someone else's life. Don't be trapped by dogma, which is living with the results of other people's thinking. Don't let the noise of others' opinions drown out your own inner voice.`,
  },
  {
    id: 'bbc-news',
    title: 'Climate change update',
    source: 'BBC News',
    difficulty: '어려움',
    wordCount: 320,
    icon: Newspaper,
    color: '#EC4899',
    text: `Scientists have warned that the world is on track for catastrophic global warming, with current policies likely to result in a temperature rise of nearly three degrees Celsius by the end of the century.`,
  },
  {
    id: 'ted-habits',
    title: 'The power of habits',
    source: 'TED Talk · Charles Duhigg',
    difficulty: '쉬움',
    wordCount: 220,
    icon: Sparkles,
    color: '#10B981',
    text: `Every habit has three components: a cue, a routine, and a reward. Once you understand this loop, you can change any behavior. The key is to identify your cue and reward, then experiment with different routines.`,
  },
  {
    id: 'wiki-history',
    title: 'The Renaissance',
    source: 'Wikipedia',
    difficulty: '어려움',
    wordCount: 410,
    icon: BookOpen,
    color: '#8B5CF6',
    text: `The Renaissance was a fervent period of European cultural, artistic, political and economic rebirth following the Middle Ages. Generally described as taking place from the 14th century to the 17th century.`,
  },
  {
    id: 'blog-tech',
    title: 'Why AI matters in 2026',
    source: 'Tech Blog',
    difficulty: '보통',
    wordCount: 250,
    icon: Zap,
    color: '#F97316',
    text: `Artificial intelligence is no longer just a buzzword. It has become an essential part of how we work, learn, and communicate. From writing assistants to medical diagnosis, AI is reshaping industries.`,
  },
]

export interface SampleScriptsProps {
  onSelect: (text: string, title: string) => void
}

export function SampleScripts({ onSelect }: SampleScriptsProps) {
  return (
    <div>
      <div className="mb-s-3 flex items-center gap-s-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-t3">
          — 샘플 스크립트
        </span>
        <span className="font-body text-xs text-t3">클릭하면 자동으로 입력됩니다</span>
      </div>

      <div className="grid grid-cols-2 gap-s-2 sm:grid-cols-3 lg:grid-cols-5">
        {samples.map((sample) => {
          const Icon = sample.icon
          return (
            <button
              key={sample.id}
              type="button"
              onClick={() => onSelect(sample.text, sample.title)}
              className={cn(
                'group relative flex flex-col items-start gap-s-2',
                'rounded-lg border bg-bg p-s-3',
                'text-left transition-all duration-normal',
                'hover:-translate-y-[2px] hover:border-bdf hover:bg-bg2 hover:shadow-md'
              )}
            >
              {/* 아이콘 칩 */}
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-transform duration-normal group-hover:scale-110"
                style={{
                  background: `linear-gradient(135deg, ${sample.color}25, ${sample.color}10)`,
                  border: `1px solid ${sample.color}30`,
                }}
              >
                <Icon size={13} style={{ color: sample.color }} />
              </div>

              {/* 제목 */}
              <div className="w-full">
                <div className="mb-[2px] line-clamp-2 font-display text-xs font-bold leading-tight text-t1">
                  {sample.title}
                </div>
                <div className="truncate font-mono text-[9px] uppercase tracking-wider text-t3">
                  {sample.source}
                </div>
              </div>

              {/* 메타 */}
              <div className="mt-auto flex w-full items-center gap-s-1 pt-s-1">
                <span
                  className={cn(
                    'rounded px-s-1 py-[1px] font-mono text-[9px] uppercase tracking-wider',
                    sample.difficulty === '쉬움' && 'bg-success-light text-[var(--success-ink)]',
                    sample.difficulty === '보통' && 'bg-warning-light text-warning',
                    sample.difficulty === '어려움' && 'bg-error-light text-[var(--error-ink)]'
                  )}
                >
                  {sample.difficulty}
                </span>
                <span className="ml-auto font-mono text-[9px] tabular-nums text-t3">
                  {sample.wordCount}단어
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
