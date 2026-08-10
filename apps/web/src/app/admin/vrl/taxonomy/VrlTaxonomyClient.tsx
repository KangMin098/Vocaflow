// apps/web/src/app/admin/vrl/taxonomy/VrlTaxonomyClient.tsx
// 4 Tab: Levels / Tracks / Domains / Skills — interactive switching

'use client'

import { useState } from 'react'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import type { VrlTaxonomyData } from '@/lib/admin/vrl/queries'

type Tab = 'levels' | 'tracks' | 'domains' | 'skills'

interface Props {
  data: VrlTaxonomyData
}

export function VrlTaxonomyClient({ data }: Props) {
  const [tab, setTab] = useState<Tab>('levels')

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'levels', label: 'Levels', count: data.levels.length },
    { id: 'tracks', label: 'Tracks', count: data.tracks.length },
    { id: 'domains', label: 'Domains', count: data.domains.length },
    { id: 'skills', label: 'Skills', count: data.skills.length },
  ]

  const activeLabel = tabs.find((t) => t.id === tab)?.label

  return (
    <div className="flex flex-col gap-4">
      {/* 활성 탭 라벨을 그대로 넘긴다 — 탭을 옮기면 도움말도 따라간다. */}
      <AdminScreenHelp screen="vrl-taxonomy" tab={activeLabel} />

      <nav
        role="tablist"
        aria-label="Taxonomy 분류 선택"
        className="flex flex-wrap gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-1"
      >
        {tabs.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`rounded-[var(--r-sm)] px-3 py-1.5 font-display text-[13px] font-[600] transition-all duration-[var(--dur-fast)] ${
                active
                  ? 'bg-[var(--bg)] text-[var(--t1)] shadow-[var(--sh-sm)] ring-1 ring-[#8B5CF6]/30'
                  : 'text-[var(--t2)] hover:bg-[var(--bg)] hover:text-[var(--t2)]'
              }`}
            >
              {t.label}
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-[700] ${
                  active ? 'bg-[#8B5CF6]/12 text-[#8B5CF6]' : 'bg-[var(--bg3)] text-[var(--t2)]'
                }`}
              >
                {t.count}
              </span>
            </button>
          )
        })}
      </nav>

      <section
        role="tabpanel"
        className="rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)]"
      >
        {tab === 'levels' && <LevelsTable rows={data.levels} />}
        {tab === 'tracks' && <TracksCardGrid rows={data.tracks} />}
        {tab === 'domains' && <SimpleCardGrid rows={data.domains} />}
        {tab === 'skills' && <SimpleCardGrid rows={data.skills} />}
      </section>
    </div>
  )
}

const METHOD_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  claude_verified: { label: '검증', color: 'var(--success)', bg: 'var(--success-light)' },
  partially_verified: { label: '부분', color: 'var(--info)', bg: 'var(--info-light)' },
  in_progress: { label: '진행 중', color: 'var(--active)', bg: 'var(--warning-light)' },
  system_inferred: { label: '자동', color: 'var(--t3)', bg: 'var(--bg3)' },
  unverified: { label: '미검증', color: 'var(--t3)', bg: 'var(--bg3)' },
}

function LevelsTable({ rows }: { rows: VrlTaxonomyData['levels'] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[var(--bd)] font-display text-[11px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
            <th className="py-2 pr-2 text-center">L</th>
            <th className="py-2 pr-2">한국어</th>
            <th className="py-2 pr-2">학교</th>
            <th className="py-2 pr-2">English</th>
            <th className="py-2 pr-2">CEFR</th>
            <th className="py-2 pr-2">시험 힌트</th>
            <th className="py-2 pr-2 text-right">누적</th>
            <th className="py-2 pr-2 text-right">신규</th>
            <th className="py-2 pr-2 text-right">시간</th>
            <th className="py-2 pr-2">연령</th>
            <th className="py-2 pr-2">검증</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => {
            const badge =
              l.classificationMethod != null && METHOD_BADGE[l.classificationMethod]
                ? METHOD_BADGE[l.classificationMethod]
                : { label: l.classificationMethod ?? '—', color: 'var(--t3)', bg: 'var(--bg3)' }
            return (
              <tr
                key={l.level}
                className="border-b border-[var(--bd)] font-body text-[12px] text-[var(--t2)] hover:bg-[var(--bg2)]"
              >
                <td className="py-2 pr-2 text-center">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#8B5CF6]/10 font-display text-[11px] font-[700] text-[#8B5CF6]">
                    {l.level}
                  </span>
                </td>
                <td className="py-2 pr-2 font-display font-[600] text-[var(--t1)]">
                  {l.koreanName}
                </td>
                <td className="py-2 pr-2">{l.koreanSchool ?? '—'}</td>
                <td className="py-2 pr-2 font-english italic text-[var(--t2)]">
                  {l.englishName ?? '—'}
                </td>
                <td className="py-2 pr-2 font-mono text-[11px] font-[700] text-[var(--p)]">
                  {l.cefrMin === l.cefrMax
                    ? (l.cefrMin ?? '—')
                    : `${l.cefrMin ?? '?'}–${l.cefrMax ?? '?'}`}
                </td>
                <td className="py-2 pr-2 text-[11px] text-[var(--t2)]">
                  {l.testScoreHints ?? '—'}
                </td>
                <td className="py-2 pr-2 text-right font-mono text-[11px]">
                  {l.cumulativeWordCount?.toLocaleString() ?? '—'}
                </td>
                <td className="py-2 pr-2 text-right font-mono text-[11px]">
                  {l.newWordsInLevel?.toLocaleString() ?? '—'}
                </td>
                <td className="py-2 pr-2 text-right font-mono text-[11px]">
                  {l.estimatedStudyHours ?? '—'}h
                </td>
                <td className="py-2 pr-2 text-[11px]">{l.ageRange ?? '—'}</td>
                <td className="py-2 pr-2">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-display text-[10px] font-[700]"
                    style={{ backgroundColor: badge.bg, color: badge.color }}
                  >
                    {badge.label}
                    {l.classificationConfidence != null && (
                      <span className="font-mono opacity-80">
                        {Number(l.classificationConfidence).toFixed(2)}
                      </span>
                    )}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TracksCardGrid({ rows }: { rows: VrlTaxonomyData['tracks'] }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {rows.map((t) => (
        <article
          key={t.id}
          className="flex flex-col gap-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-4"
        >
          <header className="flex items-center justify-between gap-2">
            <h4 className="font-display text-[14px] font-[700] text-[var(--t1)]">
              {t.nameKo}
            </h4>
            <span className="rounded-full bg-[#8B5CF6]/8 px-2 py-0.5 font-mono text-[10px] font-[700] text-[#8B5CF6]">
              {t.id}
            </span>
          </header>
          {t.nameEn && (
            <p className="font-english text-[11px] italic text-[var(--t2)]">{t.nameEn}</p>
          )}
          {t.descriptionKo && (
            <p className="font-body text-[12px] leading-relaxed text-[var(--t2)]">
              {t.descriptionKo}
            </p>
          )}
          <footer className="mt-auto flex items-center justify-between border-t border-[var(--bd)] pt-2 font-mono text-[10px] text-[var(--t2)]">
            <span>{t.displayHint ?? '—'}</span>
            <span className="font-[700] text-[var(--t2)]">
              {t.totalWords?.toLocaleString() ?? '—'} words
            </span>
          </footer>
        </article>
      ))}
    </div>
  )
}

function SimpleCardGrid({
  rows,
}: {
  rows: Array<{
    id: string
    nameKo: string
    descriptionKo: string | null
    totalWords: number | null
  }>
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <article
          key={r.id}
          className="flex flex-col gap-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-4"
        >
          <header className="flex items-center justify-between gap-2">
            <h4 className="font-display text-[14px] font-[700] text-[var(--t1)]">
              {r.nameKo}
            </h4>
            <span className="rounded-full bg-[#8B5CF6]/8 px-2 py-0.5 font-mono text-[10px] font-[700] text-[#8B5CF6]">
              {r.id}
            </span>
          </header>
          {r.descriptionKo && (
            <p className="font-body text-[12px] leading-relaxed text-[var(--t2)]">
              {r.descriptionKo}
            </p>
          )}
          <p className="mt-auto border-t border-[var(--bd)] pt-2 text-right font-mono text-[10px] font-[700] text-[var(--t2)]">
            {r.totalWords?.toLocaleString() ?? '—'} words
          </p>
        </article>
      ))}
    </div>
  )
}
