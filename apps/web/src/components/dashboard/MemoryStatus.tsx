// apps/web/src/components/dashboard/MemoryStatus.tsx
// 대시보드 — 기억 상태 (Memory Decay 4색). 학습자가 "무엇을 복습할지" 한눈에.
// 4색은 앱 전역 동일 토큰(--memory-stable|shaky|risk|new). 라벨+설명으로 의미 명시.
// Calm UI — 위급(빨강)을 압박이 아닌 "복습하기" 행동 유도로 연결.

'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface MemoryState {
  key: string
  label: string
  desc: string
  token: string
  count: number
}

export interface MemoryStatusProps {
  stable?: number
  shaky?: number
  risk?: number
  fresh?: number
}

export function MemoryStatus({ stable = 0, shaky = 0, risk = 0, fresh = 0 }: MemoryStatusProps) {
  const states: MemoryState[] = [
    { key: 'stable', label: '안정', desc: '잘 기억해요', token: '--memory-stable', count: stable },
    { key: 'shaky', label: '흔들림', desc: '가끔 헷갈려요', token: '--memory-shaky', count: shaky },
    { key: 'risk', label: '위급', desc: '곧 잊을 수 있어요', token: '--memory-risk', count: risk },
    { key: 'new', label: '새 단어', desc: '처음 만나요', token: '--memory-new', count: fresh },
  ]
  const total = states.reduce((s, x) => s + x.count, 0)
  const attention = shaky + risk

  // 빈 상태 — 아직 등록한 단어가 없을 때 (Calm empty state, 압박 없는 시작 유도)
  if (total === 0) {
    return (
      <section
        aria-label="기억 상태"
        className="rounded-ios-2xl bg-[var(--bg)] px-5 py-5 shadow-ios-2"
      >
        <h2 className="font-display text-[14px] font-[700] tracking-tight text-[var(--t1)]">
          기억 상태
        </h2>
        <p className="mt-2 font-body text-[13px] leading-relaxed text-[var(--t2)]">
          아직 만난 단어가 없어요. 글을 읽고 단어를 담으면 여기서 기억의 흐름을 볼 수 있어요.
        </p>
        <Link
          href="/library"
          className="group mt-3 inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[var(--p-light)] px-3 py-1.5 font-display text-[12px] font-[700] text-[var(--on-p-tint)] transition-colors hover:bg-[var(--p)] hover:text-[var(--on-p)]"
        >
          읽을거리 찾아보기
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </section>
    )
  }

  return (
    <section
      aria-label="기억 상태"
      className="rounded-ios-2xl bg-[var(--bg)] px-5 py-4 shadow-ios-2"
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-[14px] font-[700] tracking-tight text-[var(--t1)]">
            기억 상태
          </h2>
          <span className="font-mono text-[10px] font-[600] uppercase tracking-[0.1em] text-[var(--t2)]">
            총 {total.toLocaleString()}개
          </span>
        </div>
        {attention > 0 && (
          <Link
            href="/flashcard"
            className="group inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[var(--p-light)] px-3 py-1.5 font-display text-[12px] font-[700] text-[var(--on-p-tint)] transition-colors hover:bg-[var(--p)] hover:text-[var(--on-p)]"
          >
            <span className="tabular-nums">{attention}개</span> 복습하기
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        )}
      </header>

      {/* 누적 막대 — 4색 분포 */}
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-[var(--r-full)] bg-[var(--bg3)]"
        role="img"
        aria-label={states.map((s) => `${s.label} ${s.count}개`).join(', ')}
      >
        {states.map((s) =>
          s.count > 0 ? (
            <div
              key={s.key}
              style={{ width: `${(s.count / total) * 100}%`, background: `var(${s.token})` }}
              title={`${s.label} ${s.count}개`}
            />
          ) : null,
        )}
      </div>

      {/* 범례 — 라벨 + 설명 (의미 명시) */}
      {/* dt/dd 는 dl 의 직접 자식이어야 한다(axe dlitem). 색 점·레이아웃 래퍼를 두면
          정의 목록 시맨틱이 깨지므로, 시각 구조는 그대로 두고 요소만 평평하게 편다. */}
      <dl className="mt-3 grid grid-cols-[auto_1fr] items-start gap-x-2 gap-y-2.5 sm:grid-cols-[auto_1fr_auto_1fr]">
        {states.map((s) => (
          <Fragment key={s.key}>
            <dt className="flex items-baseline gap-1.5">
              <span
                className="mt-[6px] h-2.5 w-2.5 shrink-0 rounded-[var(--r-sm)]"
                style={{ background: `var(${s.token})` }}
                aria-hidden
              />
              <span className="font-display text-[13px] font-[700] text-[var(--t1)]">
                {s.label}
              </span>
              <span className="font-display text-[12px] font-[700] tabular-nums text-[var(--t2)]">
                {s.count.toLocaleString()}
              </span>
            </dt>
            <dd className="min-w-0 font-body text-[11px] leading-snug text-[var(--t2)]">
              {s.desc}
            </dd>
          </Fragment>
        ))}
      </dl>
    </section>
  )
}
