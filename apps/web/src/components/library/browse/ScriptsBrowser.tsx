// apps/web/src/components/library/browse/ScriptsBrowser.tsx
//
// 스크립트(아티클) 탐색 — /library/scripts.
// 재설계(v06.238): "조용한 초대 먼저, 깊이는 고른 뒤" (Progressive Disclosure · Calm UI · Cognitive Load).
//   진입면 = ① 밴드별 한 줄 안내 → ② 추천 시리즈 히어로 1개 → ③ 나머지 시리즈 간단 rows.
//     · 심리: 선택 과부하(Hick) 최소화 + 확신 있는 출발점(자기효능감) + 자율(나머지도 보임).
//   상세면 = SeriesDetail — 능력·학습과학·학습법 같은 깊이는 고른 뒤에만 노출.
// 데이터/추천 로직은 buildScriptsMap 그대로(밴드 적응 유지). 추가 fetch 0.

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronRight, Info, Sparkles, Volume2 } from 'lucide-react'

import { useUserVLevel } from '@/hooks/useUserVLevel'
import {
  TRACK_FIT_META,
  bandGuidance,
  buildScriptsMap,
  type TrackKey,
  type TrackStat,
} from '@/lib/articles/source-map'
import type { PublishedArticle } from '@/lib/articles/types'

import { SeriesDetail } from './SeriesDetail'
import { SeriesInfoModal } from './SeriesInfoModal'

// 시리즈 출처 힌트 — 상위 3개 짧은 라벨 + 나머지 개수 (학습자 정보 제공, 좁은 공간용)
function sourceHint(stat: TrackStat): string {
  const top = stat.sources.slice(0, 3).map((s) => s.short)
  const more = stat.sources.length - top.length
  return top.join(' · ') + (more > 0 ? ` +${more}` : '')
}

export function ScriptsBrowser({ articles }: { articles: PublishedArticle[] }) {
  const userV = useUserVLevel()
  const [selected, setSelected] = useState<TrackKey | null>(null)
  // 왼쪽(본문) 클릭 시 뜨는 학습정보 팝업 — 글 목록 진입 전 결정 surface
  const [infoKey, setInfoKey] = useState<TrackKey | null>(null)

  const map = useMemo(() => buildScriptsMap(articles, userV), [articles, userV])

  if (articles.length === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-16 text-center"
      >
        <span className="select-none text-3xl" aria-hidden>
          📰
        </span>
        <p className="font-display text-[14px] font-[700] text-[var(--t1)]">
          아직 게시된 스크립트가 없어요
        </p>
        <p className="max-w-[360px] font-body text-[12px] text-[var(--t2)]">
          짧은 영어 글이 큐레이션되면 여기에 표시돼요. 곧 추가될 예정이에요.
        </p>
      </div>
    )
  }

  // ── 상세면 (시리즈 선택 시) ──
  const selectedStat = selected ? map.tracks.find((t) => t.track.key === selected) ?? null : null
  if (selectedStat) {
    return <SeriesDetail stat={selectedStat} userV={userV} onBack={() => setSelected(null)} />
  }

  // ── 진입면 (조용한 초대) ──
  const hero = map.recommendedTrackKey
    ? map.tracks.find((t) => t.track.key === map.recommendedTrackKey) ?? map.tracks[0]
    : map.tracks[0]
  const rest = map.tracks.filter((t) => t.track.key !== hero?.track.key)
  const g = bandGuidance(map)
  const infoStat = infoKey ? map.tracks.find((t) => t.track.key === infoKey) ?? null : null

  return (
    <div className="flex flex-col gap-7">
      {/* ① 밴드별 한 줄 안내 (calm) */}
      <section aria-label="학습 안내" className="flex flex-col gap-1.5 px-0.5">
        <span className="inline-flex w-fit items-center gap-1.5 font-display text-[11px] font-[800] uppercase tracking-[0.09em] text-[var(--p)]">
          <Sparkles size={12} aria-hidden /> {g.eyebrow}
        </span>
        <p className="font-body text-[15px] leading-[1.45] text-[var(--t1)]">{g.title}</p>
        {g.cta.kind === 'diagnostic' && (
          <Link
            href="/diagnostic"
            className="inline-flex w-fit items-center gap-1 font-display text-[12.5px] font-[700] text-[var(--p)] underline-offset-2 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            3분 레벨 진단하기 <ArrowRight size={13} aria-hidden />
          </Link>
        )}
      </section>

      {/* ② 추천 시리즈 — 히어로 1개 */}
      {hero && (
        <section aria-label="추천 시리즈">
          <SeriesHero
            stat={hero}
            onInfo={() => setInfoKey(hero.track.key)}
            onEnter={() => setSelected(hero.track.key)}
          />
        </section>
      )}

      {/* ③ 나머지 시리즈 — 간단 rows */}
      {rest.length > 0 && (
        <section aria-label="다른 시리즈" className="flex flex-col gap-2.5">
          <h2 className="px-0.5 font-display text-[13px] font-[800] text-[var(--t2)]">다른 주제로 읽기</h2>
          <ul className="flex flex-col gap-1.5">
            {rest.map((stat) => (
              <SeriesRow
                key={stat.track.key}
                stat={stat}
                onInfo={() => setInfoKey(stat.track.key)}
                onEnter={() => setSelected(stat.track.key)}
              />
            ))}
          </ul>
        </section>
      )}

      {/* 학습정보 팝업 — 왼쪽(본문) 클릭 시 (결정 surface) */}
      {infoStat && (
        <SeriesInfoModal
          stat={infoStat}
          userV={userV}
          onClose={() => setInfoKey(null)}
          onEnter={() => {
            setSelected(infoStat.track.key)
            setInfoKey(null)
          }}
        />
      )}
    </div>
  )
}

// ── 추천 히어로 — 확신 있는 출발점 (본문=학습안내 팝업 · 하단=바로 둘러보기) ──
function SeriesHero({ stat, onInfo, onEnter }: { stat: TrackStat; onInfo: () => void; onEnter: () => void }) {
  const { track, fit, cefrLabel, count, hasAudio } = stat
  const fitMeta = TRACK_FIT_META[fit]
  return (
    <div
      className="group overflow-hidden rounded-[var(--r-lg)] border shadow-[var(--sh-xs)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:-translate-y-0.5 hover:shadow-[var(--sh-md)]"
      style={{
        borderColor: `color-mix(in srgb, ${track.accent} 30%, var(--bd))`,
        backgroundColor: `color-mix(in srgb, ${track.accent} 5%, var(--bg))`,
      }}
    >
      {/* 본문 = 학습 안내 팝업 열기 */}
      <button
        type="button"
        onClick={onInfo}
        aria-label={`${track.title} — 학습 안내 보기`}
        className="flex w-full flex-col gap-3.5 p-5 text-left transition-colors duration-[var(--dur-normal)] hover:bg-[color-mix(in_srgb,var(--t1)_3%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--p)]"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 font-display text-[11px] font-[800] uppercase tracking-[0.08em]" style={{ color: track.accent }}>
            <Sparkles size={12} aria-hidden /> 먼저 이걸로
          </span>
          <span
            className="inline-flex items-center rounded-[var(--r-full)] px-2 py-0.5 font-display text-[10.5px] font-[800]"
            style={{ color: fitMeta.color, backgroundColor: `color-mix(in srgb, ${fitMeta.color} 14%, transparent)` }}
          >
            {fitMeta.label}
          </span>
        </div>

        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--r-lg)] text-[24px]"
            style={{ backgroundColor: `color-mix(in srgb, ${track.accent} 16%, transparent)` }}
          >
            {track.icon}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3 className="font-display text-[17px] font-[800] leading-[1.2] text-[var(--t1)]">{track.title}</h3>
            <p className="font-body text-[13px] leading-[1.45] text-[var(--t2)]">{track.oneLine}</p>
            {stat.sources.length > 0 && (
              <p className="truncate font-mono text-[10.5px] font-[600] text-[var(--t2)]">출처 · {sourceHint(stat)}</p>
            )}
          </div>
        </div>

        {/* 왼쪽=팝업 어포던스 */}
        <span className="inline-flex items-center gap-1 font-display text-[12px] font-[700]" style={{ color: track.accent }}>
          <Info size={13} aria-hidden /> 이 시리즈 알아보기
        </span>
      </button>

      {/* 하단 = 바로 글 둘러보기 (직행) */}
      <div
        className="flex items-center justify-between gap-2 border-t px-5 py-3"
        style={{ borderColor: `color-mix(in srgb, ${track.accent} 18%, var(--bd))` }}
      >
        <span className="flex items-center gap-2.5 font-mono text-[11.5px] font-[600] text-[var(--t2)]">
          <span>{cefrLabel}</span>
          <span>·</span>
          <span>{count}편</span>
          {hasAudio && (
            <span className="inline-flex items-center gap-1">
              <Volume2 size={12} aria-hidden /> 음성
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={onEnter}
          aria-label={`${track.title} 글 둘러보기`}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-[var(--r-md)] px-2 font-display text-[13px] font-[700] transition-colors duration-[var(--dur-normal)] hover:bg-[color-mix(in_srgb,var(--t1)_5%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          style={{ color: track.accent }}
        >
          글 둘러보기
          <ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  )
}

// ── 나머지 시리즈 — 조용한 row (왼쪽=학습안내 팝업 · 오른쪽=바로 둘러보기) ──
function SeriesRow({ stat, onInfo, onEnter }: { stat: TrackStat; onInfo: () => void; onEnter: () => void }) {
  const { track, cefrLabel, count } = stat
  return (
    <li className="flex min-h-[60px] items-stretch overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)]">
      {/* 왼쪽 = 학습 안내 팝업 */}
      <button
        type="button"
        onClick={onInfo}
        aria-label={`${track.title} — 학습 안내 보기`}
        className="flex flex-1 items-center gap-3 px-3.5 py-2.5 text-left transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--p)] active:bg-[var(--bg3)]"
      >
        <span
          aria-hidden
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[18px]"
          style={{ backgroundColor: `color-mix(in srgb, ${track.accent} 12%, transparent)` }}
        >
          {track.icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-display text-[14px] font-[700] text-[var(--t1)]">{track.title}</span>
          {stat.sources.length > 0 && (
            <span className="truncate font-mono text-[10px] font-[500] text-[var(--t2)]">{sourceHint(stat)}</span>
          )}
        </span>
        <Info size={15} aria-hidden className="shrink-0 opacity-70" style={{ color: track.accent }} />
      </button>
      {/* 오른쪽 = 바로 글 둘러보기 (직행) */}
      <button
        type="button"
        onClick={onEnter}
        aria-label={`${track.title} 글 둘러보기`}
        className="flex shrink-0 items-center gap-1.5 border-l border-[var(--bd)] px-3 transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--p)] active:bg-[var(--bg3)]"
      >
        <span className="font-mono text-[11px] font-[600] text-[var(--t2)]">{cefrLabel} · {count}편</span>
        <ChevronRight size={16} aria-hidden className="text-[var(--t2)]" />
      </button>
    </li>
  )
}
