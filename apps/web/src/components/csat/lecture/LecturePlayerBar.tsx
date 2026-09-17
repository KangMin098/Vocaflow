'use client'

// apps/web/src/components/csat/lecture/LecturePlayerBar.tsx
//
// **강의 재생 바.** 글자는 없다 — 역할 아이콘과 순번만 있다(지시문 [D] 「텍스트 표시 없음」).
// 설명은 소리가 하고, 가리키기는 하이라이트가 한다. 바는 **지금 어디쯤인지**만 말한다.
//
//   [▶ 강의 듣기 · 3분 41초]  [0.9 · 1.0 · 1.15]  [⏮] [⏭]
//   눈금(큐마다 하나) — 누르면 그 큐부터
//
// 재생하는 동안만 화면 위에 붙는다(sticky) — 평소에는 제자리에 머물러 해설을 가리지 않는다.

import {
  BookA,
  Compass,
  Eraser,
  Headphones,
  ListTree,
  Magnet,
  Mic,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Search,
  SkipBack,
  SkipForward,
  type LucideIcon,
} from 'lucide-react'

import type { LectureRole } from '@/lib/csat/lecture/types'

import { useLecture } from './LectureStage'

export const ROLE_META: Record<LectureRole, { label: string; Icon: LucideIcon }> = {
  intro: { label: '시작', Icon: Mic },
  strategy: { label: '먼저 할 일', Icon: Compass },
  structure: { label: '뼈대', Icon: ListTree },
  evidence: { label: '근거', Icon: Search },
  eliminate: { label: '오답 지우기', Icon: Eraser },
  trap: { label: '함정', Icon: Magnet },
  vocab: { label: '어휘', Icon: BookA },
  wrapup: { label: '정리', Icon: Repeat },
}

const RATES = [0.9, 1, 1.15] as const

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return m ? (r ? `${m}분 ${r}초` : `${m}분`) : `${r}초`
}

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'
const MOTION = 'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] motion-reduce:transition-none'

export function LecturePlayerBar() {
  const lec = useLecture()
  if (!lec) return null
  const { meta, mode, status, error, index, rate, cues, start, toggle, prev, next, setRate } = lec
  const on = status === 'playing' || status === 'paused'
  const silent = mode === 'silent'
  const total = cues.length || meta.cues

  const mainLabel =
    status === 'loading'
      ? '불러오는 중…'
      : status === 'playing'
        ? '멈춤'
        : status === 'paused'
          ? '이어 듣기'
          : status === 'ended'
            ? '처음부터 다시'
            : silent
              ? `강의 하이라이트만 보기 · ${formatDuration(meta.sec)}`
              : `강의 듣기 · ${formatDuration(meta.sec)}`
  const MainIcon = status === 'playing' ? Pause : status === 'ended' ? RotateCcw : silent ? Play : Headphones

  const current = on && cues[index] ? ROLE_META[cues[index].role] : null

  return (
    <section
      data-lecture-bar
      aria-label="강의 재생"
      className={`mb-6 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3 ${on ? 'sticky top-0 z-20' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => (status === 'ended' ? start(0, 'start') : toggle())}
          disabled={status === 'loading'}
          aria-pressed={status === 'playing'}
          className={`inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--p)] px-4 text-sm text-[var(--on-p)] hover:bg-[var(--p-hover)] active:bg-[var(--p-dark)] disabled:cursor-wait disabled:opacity-60 ${FOCUS} ${MOTION}`}
        >
          <MainIcon aria-hidden className="h-4 w-4" />
          <span className="break-keep">{mainLabel}</span>
        </button>

        <div role="group" aria-label="읽는 속도" className="flex items-center">
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRate(r)}
              aria-pressed={rate === r}
              className={`min-h-[44px] min-w-[44px] border px-2 text-xs tabular-nums first:rounded-l-[var(--r-md)] last:rounded-r-[var(--r-md)] ${FOCUS} ${MOTION} ${
                rate === r
                  ? 'border-[var(--p)] bg-[var(--p-light)] text-[var(--on-p-tint)]'
                  : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:border-[var(--p)] active:bg-[var(--bg3)]'
              }`}
            >
              {r === 1 ? '1.0' : r}
              <span className="sr-only">배속</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={prev}
          disabled={!on || index <= 0}
          aria-label="이전 큐"
          className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] text-[var(--t1)] hover:border-[var(--p)] active:bg-[var(--bg3)] disabled:cursor-not-allowed disabled:text-[var(--t4)] disabled:hover:border-[var(--bd)] ${FOCUS} ${MOTION}`}
        >
          <SkipBack aria-hidden className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={next}
          disabled={!on || index >= total - 1}
          aria-label="다음 큐"
          className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] text-[var(--t1)] hover:border-[var(--p)] active:bg-[var(--bg3)] disabled:cursor-not-allowed disabled:text-[var(--t4)] disabled:hover:border-[var(--bd)] ${FOCUS} ${MOTION}`}
        >
          <SkipForward aria-hidden className="h-4 w-4" />
        </button>

        {/* 지금 어디쯤 — 역할 이름과 순번뿐(대본 아님) */}
        <p className="ml-auto text-xs tabular-nums text-[var(--t3)]" aria-live="polite">
          {current ? `${current.label} · ${index + 1} / ${total}` : `${total}개 큐`}
        </p>
      </div>

      {/* 눈금 — 큐마다 하나. 좁은 화면에서는 이 줄만 옆으로 넘긴다(본문은 밀리지 않는다) */}
      {cues.length ? (
        <ol className="mt-2 flex gap-1 overflow-x-auto pb-1" aria-label="강의 순서">
          {cues.map((c, i) => {
            const { label, Icon } = ROLE_META[c.role]
            const state = !on ? 'idle' : i === index ? 'now' : i < index ? 'done' : 'todo'
            return (
              <li key={c.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => start(i, 'cue')}
                  aria-current={state === 'now' ? 'step' : undefined}
                  aria-label={`${i + 1}번째 — ${label}부터 듣기`}
                  title={label}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-[var(--r-md)] border ${FOCUS} ${MOTION} ${
                    state === 'now'
                      ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)]'
                      : state === 'done'
                        ? 'border-[var(--bd)] bg-[var(--bg3)] text-[var(--t2)] hover:border-[var(--p)]'
                        : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t3)] hover:border-[var(--p)] active:bg-[var(--bg3)]'
                  }`}
                >
                  <Icon aria-hidden className="h-4 w-4" />
                </button>
              </li>
            )
          })}
        </ol>
      ) : null}

      {silent ? (
        <p className="mt-2 break-keep text-xs leading-relaxed text-[var(--t3)]">
          이 기기에는 한국어 목소리가 없어요. 소리 없이, 설명하는 자리만 차례로 짚어 드립니다.
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 break-keep text-xs leading-relaxed text-[var(--t2)]">
          {error} — 해설은 아래에서 그대로 읽을 수 있어요.
        </p>
      ) : null}
      <p className="mt-2 hidden text-xs text-[var(--t3)] sm:block">
        키보드: <kbd className="font-mono">Space</kbd> 재생·멈춤 · <kbd className="font-mono">←</kbd>{' '}
        <kbd className="font-mono">→</kbd> 이전·다음 · 설명 블록을 누르면 그 부분부터 들려 드려요.
      </p>
    </section>
  )
}
