// apps/web/src/app/admin/articles/SourceProfile.tsx
// ACP §18 — 단일 모드 소스 프로필 (선택한 소스가 "무엇을·누구에게·어떤 글" 인지).
//
// 관리자가 그 소스를 몰라도 판단하도록 SOURCE_SPECS 메타를 노출. 대량 모드의 소스 카드
// 가이드를 단일 모드에도 가져온 것. 데이터는 source-guide(getSourceGuide) 경유.

'use client'

import type { ReactNode } from 'react'

import type { SourceFeedHealth } from '@/lib/articles/types'
import type { SourceKey, LearnerLevel } from '@vocaflow/library-pipeline/curation-spec'
import { getSourceGuide, fitForLevel, FIT_LABEL, REGISTER_LABEL, type LevelFit } from '@/lib/articles/source-guide'

const FIT_TONE: Record<LevelFit, { bg: string; fg: string }> = {
  fit: { bg: 'var(--learn-known-light)', fg: 'var(--learn-known)' },
  easy: { bg: 'var(--learn-fresh-light)', fg: 'var(--learn-fresh)' },
  hard: { bg: 'var(--learn-review-light)', fg: 'var(--learn-review)' },
}

export function SourceProfile({
  source,
  level,
  feedHealth,
}: {
  source: SourceKey
  level: LearnerLevel
  feedHealth: SourceFeedHealth[]
}) {
  const g = getSourceGuide(source)
  const fit = fitForLevel(source, level)
  const tone = FIT_TONE[fit]
  const feeds = feedHealth.filter((f) => f.source === source)

  return (
    <section
      aria-label="소스 프로필"
      className="flex flex-col gap-2.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3"
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]">이 소스</span>
        <span
          className="rounded-[var(--r-full)] px-2 py-0.5 font-mono text-[9px] font-[700]"
          style={{ backgroundColor: tone.bg, color: tone.fg }}
        >
          {FIT_LABEL[fit]}
        </span>
        <span className="font-mono text-[10px] text-[var(--t2)]">
          CEFR {g.cefr.min}–{g.cefr.max}
        </span>
      </header>

      <ProfileRow label="무엇을">
        {g.topics.slice(0, 6).map((t) => (
          <Chip key={t}>{t}</Chip>
        ))}
      </ProfileRow>

      <ProfileRow label="어떤 글">
        {g.registers.map((r) => (
          <Chip key={r} tone="known">
            {REGISTER_LABEL[r] ?? r}
          </Chip>
        ))}
        <span className="font-body text-[11px] text-[var(--t2)]">{g.style}</span>
      </ProfileRow>

      <ProfileRow label="라이선스">
        <span className="font-mono text-[10px] text-[var(--t2)]">{g.license}</span>
        {g.attributionRequired && (
          <span className="font-mono text-[10px] text-[var(--learn-review)]">· 인용 의무</span>
        )}
      </ProfileRow>

      {feeds.length > 0 && (
        <ProfileRow label="피드">
          {feeds.map((f) => (
            <span
              key={f.feedId}
              className="inline-flex items-center gap-1 rounded-[var(--r-sm)] bg-[var(--bg2)] px-2 py-0.5 font-mono text-[10px] text-[var(--t2)]"
            >
              {f.feedLabel}
              <span className="text-[var(--t2)]">
                {f.pending}/{f.candidates}
              </span>
            </span>
          ))}
        </ProfileRow>
      )}
    </section>
  )
}

function ProfileRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-[52px] shrink-0 font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]">
        {label}
      </span>
      {children}
    </div>
  )
}

function Chip({ children, tone }: { children: ReactNode; tone?: 'known' }) {
  return (
    <span
      className="rounded-[var(--r-full)] border border-[var(--bd)] px-2 py-0.5 font-mono text-[10px]"
      style={
        tone === 'known'
          ? { backgroundColor: 'var(--learn-known-light)', color: 'var(--learn-known)' }
          : { color: 'var(--t2)' }
      }
    >
      {children}
    </span>
  )
}
