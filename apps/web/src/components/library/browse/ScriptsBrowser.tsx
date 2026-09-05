// apps/web/src/components/library/browse/ScriptsBrowser.tsx
//
// 스크립트(아티클) 탐색 — /library/scripts.
// 재설계(v06.238): "조용한 초대 먼저, 깊이는 고른 뒤" (Progressive Disclosure · Calm UI · Cognitive Load).
//   진입면 = ① 밴드별 한 줄 안내 → ② 추천 시리즈 히어로 1개 → ③ 나머지 시리즈 간단 rows.
//     · 심리: 선택 과부하(Hick) 최소화 + 확신 있는 출발점(자기효능감) + 자율(나머지도 보임).
//   상세면 = SeriesDetail — 능력·학습과학·학습법 같은 깊이는 고른 뒤에만 노출.
// 데이터/추천 로직은 buildScriptsMap 그대로(밴드 적응 유지). 추가 fetch 0.
//
// ── 왜 시리즈 선택이 `useState` 가 아니라 `?series=` 인가 (2026-08-26) ──
// 드릴다운이 상태였다. 그래서 **글 목록에 주소가 없었다** — 익명으로 `/library/scripts` 를
// 받아 보면 시리즈 제목까지는 있는데 글로 가는 링크가 **0개**였다. sitemap 이 광고하는
// 글 160개를 사이트 안 어느 페이지도 가리키지 않는 고아 상태였고, 뒤로가기·공유·새로고침도
// 전부 진입면으로 돌아갔다.
//
// 만화 서가는 이미 `?series=` 로 되어 있다(`/comics/restored`). 같은 모양으로 맞춘다 —
// 진입면 → `?series=` → 글 상세, 세 단계가 전부 주소를 갖는다.

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, ChevronRight, Info, Sparkles, Volume2 } from 'lucide-react'

import { useUserVLevel } from '@/hooks/useUserVLevel'
import { dominantMediaForm } from '@/lib/library/media-form'
import { MediaCover, MediaCoverSrLabel } from '@/components/library/MediaCover'
import {
  TRACK_FIT_META,
  bandGuidance,
  buildScriptsMap,
  type TrackKey,
  type TrackStat,
} from '@/lib/articles/source-map'
import type { PublishedArticle } from '@/lib/articles/types'

import { ShelfEmptyState } from '@/components/library/shared/ShelfEmptyState'

import { SeriesDetail } from './SeriesDetail'
import { SeriesInfoModal } from './SeriesInfoModal'

// 시리즈 출처 힌트 — 상위 3개 짧은 라벨 + 나머지 개수 (학습자 정보 제공, 좁은 공간용)
function sourceHint(stat: TrackStat): string {
  const top = stat.sources.slice(0, 3).map((s) => s.short)
  const more = stat.sources.length - top.length
  return top.join(' · ') + (more > 0 ? ` +${more}` : '')
}

/** 시리즈 글 목록의 주소. 진입면과 상세면이 같은 라우트를 쓰되 주소로 갈린다. */
export function seriesHref(key: TrackKey): string {
  return `/library/scripts?series=${encodeURIComponent(key)}`
}

export const SCRIPTS_INDEX_HREF = '/library/scripts'

export function ScriptsBrowser({
  articles,
  series,
  loadError = false,
}: {
  articles: PublishedArticle[]
  /** `?series=` — 서버가 읽어 넘긴다. 상태가 아니라 주소가 이 화면의 단일 출처다. */
  series: string | null
  /** 카탈로그 **조회 자체가 실패**했는가 — 빈 목록의 두 원인을 가른다. */
  loadError?: boolean
}) {
  const userV = useUserVLevel()
  const router = useRouter()
  // 왼쪽(본문) 클릭 시 뜨는 학습정보 팝업 — 글 목록 진입 전 결정 surface.
  // 이것만 상태로 남는다: 팝업은 되돌아올 자리가 아니라 결정을 돕는 겹침이다.
  const [infoKey, setInfoKey] = useState<TrackKey | null>(null)

  const map = useMemo(() => buildScriptsMap(articles, userV), [articles, userV])

  if (articles.length === 0) {
    // 「없다」와 「못 읽었다」를 가른다 — 발행 293편이 그대로인데 0을 말하면 거짓말이다.
    return loadError ? (
      <ShelfEmptyState
        tone="error"
        title="지금 글 목록을 불러오지 못했어요"
        body="서가가 빈 게 아니라 목록을 읽는 데 실패했어요. 잠시 뒤 다시 시도하거나, 그동안 원서 쪽을 둘러보셔도 좋아요."
        onAction={() => router.refresh()}
        actionLabel="다시 시도"
        ctaHref="/library/books"
        ctaLabel="도서 보러 가기"
      />
    ) : (
      <ShelfEmptyState
        title="아직 게시된 글이 없어요"
        body="짧은 영어 글은 매일 들어오는 외부 피드에서 골라 올라와요. 그동안 원서 한 권을 골라 두거나, 3분 진단으로 내 수준을 정해 두면 다음에 딱 맞는 글부터 보여드릴게요."
        ctaHref="/library/books"
        ctaLabel="도서 보러 가기"
      />
    )
  }

  // ── 상세면 (`?series=`) ──
  // 없는 키가 오면 진입면으로 떨어진다 — 주소를 손으로 고쳐도 빈 화면이 나오지 않는다.
  const selectedStat = series ? map.tracks.find((t) => t.track.key === series) ?? null : null
  if (selectedStat) {
    return (
      <SeriesDetail
        stat={selectedStat}
        userV={userV}
        // ⚠️ `push` 였다. 그러면 히스토리가 index → series → index 로 **쌓여서**,
        //    그다음 브라우저 뒤로가기가 방금 나온 시리즈로 되돌아간다(2026-09-05).
        //    시리즈 목록으로 나가는 것은 앞으로 가는 이동이 아니라 되돌아가는 것이므로
        //    주소를 대체한다 — 뒤로가기는 서가 밖(들어온 곳)으로 나간다.
        onBack={() => router.replace(SCRIPTS_INDEX_HREF, { scroll: false })}
      />
    )
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
      <section aria-label="학습 안내" className="flex flex-col gap-2 px-1">
        <span className="inline-flex w-fit items-center gap-2 font-display text-[11px] font-[800] uppercase tracking-[0.09em] text-[var(--p)]">
          <Sparkles size={12} aria-hidden /> {g.eyebrow}
        </span>
        {/* 한글 문단에 break-keep — 없으면 390px 에서 낱말이 음절로 쪼개진다(CLAUDE.md I7). */}
        <p className="break-keep font-body text-[15px] leading-[1.45] text-[var(--t1)]">{g.title}</p>
        {g.cta.kind === 'diagnostic' && (
          <Link
            href="/diagnostic"
            // 실측 2026-08-25: 117×19 였다. 문장 속 링크가 아니라 독립 CTA 라 44px 규칙 대상이다.
            className="inline-flex min-h-11 w-fit items-center gap-1 font-display text-[12.5px] font-[700] text-[var(--p)] underline-offset-2 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
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
            enterHref={seriesHref(hero.track.key)}
          />
        </section>
      )}

      {/* ③ 나머지 시리즈 — 간단 rows */}
      {rest.length > 0 && (
        <section aria-label="다른 시리즈" className="flex flex-col gap-3">
          <h2 className="px-1 font-display text-[13px] font-[800] text-[var(--t2)]">다른 주제로 읽기</h2>
          <ul className="flex flex-col gap-2">
            {rest.map((stat) => (
              <SeriesRow
                key={stat.track.key}
                stat={stat}
                onInfo={() => setInfoKey(stat.track.key)}
                enterHref={seriesHref(stat.track.key)}
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
            setInfoKey(null)
            router.push(seriesHref(infoStat.track.key))
          }}
        />
      )}
    </div>
  )
}

// ── 추천 히어로 — 확신 있는 출발점 (본문=학습안내 팝업 · 하단=바로 둘러보기) ──
function SeriesHero({
  stat,
  onInfo,
  enterHref,
}: {
  stat: TrackStat
  onInfo: () => void
  /** "글 둘러보기" 는 **진짜 링크**다 — 크롤러가 글 목록에 닿는 유일한 경로다. */
  enterHref: string
}) {
  const { track, fit, cefrLabel, count, hasAudio } = stat
  const fitMeta = TRACK_FIT_META[fit]
  const heroForm = dominantMediaForm(track.sources)
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
        className="flex w-full flex-col gap-4 p-5 text-left transition-colors duration-[var(--dur-normal)] hover:bg-[color-mix(in_srgb,var(--t1)_3%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--p)]"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 font-display text-[11px] font-[800] uppercase tracking-[0.08em]" style={{ color: track.accent }}>
            <Sparkles size={12} aria-hidden /> 먼저 이걸로
          </span>
          <span
            className="inline-flex items-center rounded-[var(--r-full)] px-2 py-1 font-display text-[10.5px] font-[800]"
            // 배경을 글자색의 14% 로 깔면 글자와 배경이 같은 계열이라 대비가 4.5 를 넘기 어렵다
            // (2026-08-09 실측 4.49). 중립 면(--bg2) 위에 잉크를 얹는다.
            style={{ color: fitMeta.color, backgroundColor: 'var(--bg2)' }}
          >
            {fitMeta.label}
          </span>
        </div>

        <div className="flex items-start gap-3">
          {/* 이모지 한 글자였던 자리 — 이 시리즈가 어떤 종류의 인쇄물인지를 조판으로 말한다.
              (도서만 표지를 갖고 나머지는 전부 같은 색 사각형이던 문제. lib/library/media-form.ts) */}
          <span className="block h-16 w-12 shrink-0 overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)]">
            <MediaCover form={heroForm} title={track.title} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {/* h1 다음은 h2 — 이 히어로는 "다른 주제로 읽기"(h2) 의 하위가 아니라 형제 구역이다.
                그래서 h3 로 시작하면 h1 → h3 로 한 단계 건너뛴다(WCAG 2.2 §1.3.1).
                실측 2026-08-25 모바일에서 제목 계층 50점. 크기는 그대로 둔다. */}
            <h2 className="font-display text-[17px] font-[800] leading-[1.2] text-[var(--t1)]">
              {track.title}
              <MediaCoverSrLabel form={heroForm} />
            </h2>
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
        <span className="flex items-center gap-3 font-mono text-[11.5px] font-[600] text-[var(--t2)]">
          <span>{cefrLabel}</span>
          <span>·</span>
          <span>{count}편</span>
          {hasAudio && (
            <span className="inline-flex items-center gap-1">
              <Volume2 size={12} aria-hidden /> 음성
            </span>
          )}
        </span>
        <Link
          href={enterHref}
          aria-label={`${track.title} 글 둘러보기`}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-[var(--r-md)] px-2 font-display text-[13px] font-[700] transition-colors duration-[var(--dur-normal)] hover:bg-[color-mix(in_srgb,var(--t1)_5%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          style={{ color: track.accent }}
        >
          글 둘러보기
          <ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  )
}

// ── 나머지 시리즈 — 조용한 row (왼쪽=학습안내 팝업 · 오른쪽=바로 둘러보기) ──
function SeriesRow({
  stat,
  onInfo,
  enterHref,
}: {
  stat: TrackStat
  onInfo: () => void
  enterHref: string
}) {
  const { track, cefrLabel, count } = stat
  const rowForm = dominantMediaForm(track.sources)
  return (
    <li className="flex min-h-[60px] items-stretch overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)]">
      {/* 왼쪽 = 학습 안내 팝업 */}
      <button
        type="button"
        onClick={onInfo}
        aria-label={`${track.title} — 학습 안내 보기`}
        className="flex flex-1 items-center gap-3 px-4 py-3 text-left transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--p)] active:bg-[var(--bg3)]"
      >
        <span className="block h-11 w-8 shrink-0 overflow-hidden rounded-[var(--r-sm)] border border-[var(--bd)]">
          <MediaCover form={rowForm} title={track.title} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-display text-[14px] font-[700] text-[var(--t1)]">
            {track.title}
            <MediaCoverSrLabel form={rowForm} />
          </span>
          {stat.sources.length > 0 && (
            <span className="truncate font-mono text-[10px] font-[500] text-[var(--t2)]">{sourceHint(stat)}</span>
          )}
        </span>
        <Info size={15} aria-hidden className="shrink-0 opacity-70" style={{ color: track.accent }} />
      </button>
      {/* 오른쪽 = 바로 글 둘러보기 (직행) */}
      <Link
        href={enterHref}
        aria-label={`${track.title} 글 둘러보기`}
        className="flex shrink-0 items-center gap-2 border-l border-[var(--bd)] px-3 transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--p)] active:bg-[var(--bg3)]"
      >
        <span className="font-mono text-[11px] font-[600] text-[var(--t2)]">{cefrLabel} · {count}편</span>
        <ChevronRight size={16} aria-hidden className="text-[var(--t2)]" />
      </Link>
    </li>
  )
}
