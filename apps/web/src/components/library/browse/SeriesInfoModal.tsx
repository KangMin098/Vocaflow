// apps/web/src/components/library/browse/SeriesInfoModal.tsx
//
// 시리즈 학습정보 팝업 (v06.245 — 시각적 정보전달 강화) —
//   /library/scripts 진입면에서 주제(시리즈)를 누르면 뜨는 "결정 surface".
// 텍스트 위주 → 시각 부호화(정보전달 매커니즘) 우선:
//   · 난이도 게이지: "나 vs 시리즈"를 축 위에 그려 "나에게 맞나?"를 <1s 시각 즉답(전주의적).
//   · 스탯 타일: 분량·읽기시간·음성을 아이콘+수치로(그림 우월).
//   · 능력 아이콘 칩: 각 능력에 키워드→아이콘(Dual Coding) — 텍스트 나열 탈피.
//   · 로드맵: 큰 번호+연결선(경로 시각화). why/출처는 아이콘 앵커로 보조.
//   · 인지부하 청킹(Sweller), Von Restorff(개인화·CTA 격리), Calm 등장, 44/48px 타깃, 다크 토큰.
// 콘텐츠는 전부 실데이터/근거 — TrackStat + SourceTrack 카피.

'use client'

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Clock,
  FileText,
  Globe,
  Headphones,
  Lightbulb,
  Scale,
  Sparkles,
  Target,
  Type,
  Volume2,
  X,
  type LucideIcon,
} from 'lucide-react'

import {
  TRACK_FIT_META,
  effectiveUserV,
  getLearnerBand,
  vToCefrLabel,
  vToPct,
  type TrackStat,
} from '@/lib/articles/source-map'
import type { PublishedArticle } from '@/lib/articles/types'

/** 개인화 훅 — fit + idealCount + 진단여부 (감정 부호화·자기효능감). */
function appealLine(stat: TrackStat, userV: number): { lead: string; body: string } {
  const band = getLearnerBand(userV)
  if (band === 'undiagnosed') {
    return { lead: '중급(B1) 기준으로 보여드려요', body: '3분 진단하면 딱 맞는 글만 골라드려요.' }
  }
  if (stat.fit === 'fit') {
    return {
      lead: '당신 레벨에 딱 맞아요',
      body: stat.idealCount > 0 ? `지금 읽기 좋은 글이 ${stat.idealCount}편 있어요.` : '편하게 몰입할 수 있는 시리즈예요.',
    }
  }
  if (stat.fit === 'hard') {
    return { lead: '조금 도전적이에요', body: '살짝 어려운 글이 더 깊은 이해와 기억을 만들어요.' }
  }
  return { lead: '수월하게 읽혀요', body: '아는 단어가 많아 속도·유창성 훈련에 좋아요.' }
}

/** 능력 라벨 → 아이콘 (Dual Coding — 키워드 매칭, 폴백 Target). */
function skillIcon(skill: string): LucideIcon {
  if (/듣기|청해|청취|쉐도|따라/.test(skill)) return Headphones
  if (/발음|억양|말하기|스피/.test(skill)) return Volume2
  if (/논증|논리|추론|비판|구조/.test(skill)) return Scale
  if (/데이터|통계|수치|사실|정보/.test(skill)) return BarChart3
  if (/배경|폭넓|스키마|지식|넓/.test(skill)) return Globe
  if (/어휘|단어|철자/.test(skill)) return Type
  if (/독해|읽기|이해|파악/.test(skill)) return BookOpen
  if (/자신감|친숙|시작/.test(skill)) return Sparkles
  return Target
}

/** 대략 읽기 시간(분). */
function readMinutes(a: PublishedArticle): number | null {
  if (a.reading_minutes != null) return a.reading_minutes
  if (a.word_count != null) return Math.max(1, Math.round(a.word_count / 200))
  return null
}

export function SeriesInfoModal({
  stat,
  userV,
  onClose,
  onEnter,
}: {
  stat: TrackStat
  userV: number
  onClose: () => void
  onEnter: () => void
}) {
  const { track, count, cefrLabel, hasAudio, fit, sources, idealCount, vMin, vMax } = stat
  const fitMeta = TRACK_FIT_META[fit]
  const appeal = appealLine(stat, userV)
  const titleId = useId()
  const accent = track.accent

  // 읽기 시간 레이블 — 실 글에서 집계 (분량 타일용).
  const readLabel = useMemo(() => {
    const mins = stat.items.map(readMinutes).filter((m): m is number => m != null)
    if (mins.length === 0) return '—'
    const lo = Math.min(...mins)
    const hi = Math.max(...mins)
    return lo === hi ? `${lo}분` : `${lo}~${hi}분`
  }, [stat.items])

  const maxSourceCount = Math.max(1, ...sources.map((s) => s.count))

  const [shown, setShown] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const raf = requestAnimationFrame(() => setShown(true))
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      cancelAnimationFrame(raf)
    }
  }, [onClose])

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-end justify-center bg-[color-mix(in_srgb,var(--t1)_50%,transparent)] p-0 backdrop-blur-[3px] transition-opacity duration-[var(--dur-normal)] sm:items-center sm:p-4 ${shown ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[var(--r-xl)] bg-[var(--bg)] shadow-[var(--sh-lg)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] sm:rounded-[var(--r-xl)] ${shown ? 'translate-y-0 opacity-100 sm:scale-100' : 'translate-y-6 opacity-0 sm:translate-y-0 sm:scale-95'}`}
      >
        {/* ═══ 히어로 — 정체성 ═══ */}
        <header
          className="relative flex items-start gap-4 px-6 pb-5 pt-6"
          style={{ background: `linear-gradient(155deg, color-mix(in srgb, ${accent} 20%, var(--bg)) 0%, var(--bg) 82%)` }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-[var(--r-full)] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg3)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <X size={20} aria-hidden />
          </button>
          <span
            aria-hidden
            className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--r-lg)] text-[32px] shadow-[var(--sh-sm)]"
            style={{ backgroundColor: `color-mix(in srgb, ${accent} 22%, var(--bg))` }}
          >
            {track.icon}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1 pr-8">
            <span className="inline-flex w-fit items-center gap-1 font-display text-[11px] font-[800] uppercase tracking-[0.1em]" style={{ color: accent }}>
              학습 시리즈
            </span>
            <h2 id={titleId} className="font-editorial text-[25px] font-[600] leading-[1.1] tracking-[-0.01em] text-[var(--t1)]">
              {track.title}
            </h2>
            <p className="font-body text-[14px] leading-[1.5] text-[var(--t2)]">{track.oneLine}</p>
          </div>
        </header>

        {/* ═══ 본문 (스크롤) ═══ */}
        <div className="flex flex-col gap-5 overflow-y-auto px-6 pb-5 pt-2">
          {/* ── 난이도 게이지 — "나에게 맞나?" 시각 즉답 ── */}
          <DifficultyGauge vMin={vMin} vMax={vMax} userV={userV} fitMeta={fitMeta} cefrLabel={cefrLabel} accent={accent} />

          {/* ── 스탯 타일 — 분량·읽기시간·음성 (그림 우월) ── */}
          <div className="grid grid-cols-3 gap-2">
            <StatTile icon={FileText} label="분량" value={`${count}편`} tint={accent} />
            <StatTile icon={Clock} label="읽기" value={readLabel} tint={accent} />
            <StatTile icon={Volume2} label="음성" value={hasAudio ? '있음' : '없음'} tint={hasAudio ? accent : undefined} muted={!hasAudio} />
          </div>

          {/* ── 개인화 훅 (Von Restorff) ── */}
          <div
            className="flex items-start gap-3 rounded-[var(--r-lg)] border-l-[3px] px-4 py-4"
            style={{ borderColor: fitMeta.color, backgroundColor: `color-mix(in srgb, ${fitMeta.color} 9%, var(--bg))` }}
          >
            <span aria-hidden className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--r-full)]" style={{ backgroundColor: fitMeta.color, color: 'var(--ti)' }}>
              <Sparkles size={13} aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <span className="font-display text-[16px] font-[800] leading-[1.3] text-[var(--t1)]">{appeal.lead}</span>
              <span className="font-body text-[13.5px] leading-[1.45] text-[var(--t2)]">{appeal.body}</span>
            </div>
          </div>

          {/* ── 기르는 능력 — 아이콘 칩 그리드 (Dual Coding) ── */}
          <Zone label="이렇게 성장해요" accent={accent}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {track.skills.map((sk) => {
                const Icon = skillIcon(sk)
                return (
                  <div key={sk} className="flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-3">
                    <span aria-hidden className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-md)]" style={{ backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}>
                      <Icon size={16} aria-hidden />
                    </span>
                    <span className="font-body text-[13.5px] font-[600] leading-[1.25] text-[var(--t1)]">{sk}</span>
                  </div>
                )
              })}
            </div>
          </Zone>

          {/* ── 학습 로드맵 — 큰 번호 + 연결선 ── */}
          <Zone label="학습 로드맵" accent={accent}>
            <ol className="flex flex-col">
              {track.method.map((step, i) => (
                <li key={step} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span aria-hidden className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--r-full)] font-mono text-[12px] font-[800] text-[var(--ti)] shadow-[var(--sh-xs)]" style={{ backgroundColor: accent }}>
                      {i + 1}
                    </span>
                    {i < track.method.length - 1 && (
                      <span aria-hidden className="my-1 w-[2.5px] flex-1 rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${accent} 30%, var(--bd))` }} />
                    )}
                  </div>
                  <span className={`pt-1 font-body text-[14px] font-[600] leading-[1.35] text-[var(--t1)] ${i < track.method.length - 1 ? 'pb-3' : ''}`}>{step}</span>
                </li>
              ))}
            </ol>
          </Zone>

          {/* ── 출처별 상세 (소스별 · 소스주제별 — 무엇을·어디서, 한눈에) ── */}
          {sources.length > 0 && (
            <Zone label={`출처 · ${sources.length}곳`} accent={accent}>
              <div className="flex flex-col gap-2">
                {sources.map((s) => (
                  <SourceDetail key={s.key} source={s} maxCount={maxSourceCount} />
                ))}
              </div>
              <p className="mt-0.5 font-body text-[11px] leading-[1.4] text-[var(--t2)]">
                모두 신뢰할 수 있는 원문에서 큐레이션 · 원문은 각 글에서 열 수 있어요.
              </p>
            </Zone>
          )}

          {/* ── 왜 효과적 (아이콘 앵커) ── */}
          <div className="flex items-start gap-3 rounded-[var(--r-lg)] bg-[var(--bg2)] p-4">
            <span aria-hidden className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--r-full)]" style={{ backgroundColor: `color-mix(in srgb, ${accent} 16%, transparent)`, color: accent }}>
              <Lightbulb size={14} aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <span className="font-display text-[11px] font-[800] uppercase tracking-[0.08em] text-[var(--t2)]">왜 효과적일까요</span>
              <p className="font-body text-[13px] leading-[1.5] text-[var(--t1)]">{track.why}</p>
              {track.note && <p className="mt-1 font-body text-[11.5px] leading-[1.45] text-[var(--t2)]">※ {track.note}</p>}
            </div>
          </div>
        </div>

        {/* ═══ 스티키 CTA ═══ */}
        <footer className="flex items-center gap-3 border-t border-[var(--bd)] bg-[var(--bg)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[48px] items-center justify-center rounded-[var(--r-md)] px-4 font-display text-[14px] font-[700] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={onEnter}
            className="group inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-[var(--r-md)] px-4 font-display text-[15px] font-[800] text-[var(--ti)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 active:translate-y-0"
            style={{ backgroundColor: accent }}
          >
            {idealCount > 0 ? `딱 맞는 글 ${idealCount}편부터 시작` : '이 시리즈로 시작하기'}
            <ArrowRight size={16} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </footer>
      </div>
    </div>
  )
}

/** 난이도 게이지 — 축(쉬움→어려움) 위에 시리즈 밴드 + 내 위치를 그려 "나에게 맞나"를 시각 즉답. */
function DifficultyGauge({
  vMin,
  vMax,
  userV,
  fitMeta,
  cefrLabel,
  accent,
}: {
  vMin: number
  vMax: number
  userV: number
  fitMeta: { label: string; color: string }
  cefrLabel: string
  accent: string
}) {
  const bandLo = vToPct(vMin)
  const bandHi = vToPct(vMax)
  const me = vToPct(effectiveUserV(userV))
  const myCefr = vToCefrLabel(effectiveUserV(userV))
  return (
    <div className="flex flex-col gap-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 font-display text-[13px] font-[800]" style={{ color: fitMeta.color }}>
          <Target size={14} aria-hidden /> {fitMeta.label}
        </span>
        <span className="font-mono text-[11px] font-[600] text-[var(--t2)]">시리즈 {cefrLabel}</span>
      </div>
      <div className="relative mt-1 h-2.5 w-full rounded-[var(--r-full)] bg-[var(--bg3)]">
        {/* 시리즈 밴드 */}
        <span
          aria-hidden
          className="absolute top-0 h-full rounded-[var(--r-full)]"
          style={{ left: `${bandLo}%`, width: `${Math.max(6, bandHi - bandLo)}%`, backgroundColor: `color-mix(in srgb, ${accent} 55%, transparent)` }}
        />
        {/* 내 위치 마커 */}
        <span aria-hidden className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${me}%` }}>
          <span className="block h-4 w-4 rounded-[var(--r-full)] border-[2.5px] border-[var(--bg)] bg-[var(--t1)] shadow-[var(--sh-sm)]" />
        </span>
      </div>
      <div className="flex items-center justify-between font-mono text-[10.5px] font-[600] text-[var(--t2)]">
        <span>← 쉬움</span>
        <span className="font-[700] text-[var(--t2)]">내 레벨 · {userV > 0 ? `V${userV}` : '기준'} · {myCefr}</span>
        <span>어려움 →</span>
      </div>
    </div>
  )
}

/** 출처 상세 — 이름 + 분야 + 편수 + 비율바 + 설명 (소스별·소스주제별, 한눈에). */
function SourceDetail({ source, maxCount }: { source: TrackStat['sources'][number]; maxCount: number }) {
  const pct = Math.round((source.count / maxCount) * 100)
  return (
    <div className="flex items-start gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3">
      <span aria-hidden className="mt-1 h-3 w-3 shrink-0 rounded-[var(--r-full)]" style={{ backgroundColor: source.color }} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-[13.5px] font-[800] text-[var(--t1)]">{source.label}</span>
          <span
            className="inline-flex shrink-0 items-center rounded-[var(--r-sm)] px-2 py-1 font-display text-[10px] font-[700]"
            style={{ color: source.color, backgroundColor: `color-mix(in srgb, ${source.color} 12%, transparent)` }}
          >
            {source.domain}
          </span>
          <span className="ml-auto shrink-0 font-mono text-[11px] font-[700] text-[var(--t2)]">{source.count}편</span>
        </div>
        {source.blurb && <p className="font-body text-[12px] leading-[1.4] text-[var(--t2)]">{source.blurb}</p>}
        <div className="mt-0.5 h-[3px] w-full rounded-[var(--r-full)] bg-[var(--bg3)]">
          <div className="h-full rounded-[var(--r-full)]" style={{ width: `${pct}%`, backgroundColor: `color-mix(in srgb, ${source.color} 60%, transparent)` }} />
        </div>
      </div>
    </div>
  )
}

/** 스탯 타일 — 아이콘 + 라벨 + 값 (전주의적 파악). */
function StatTile({
  icon: Icon,
  label,
  value,
  tint,
  muted = false,
}: {
  icon: LucideIcon
  label: string
  value: string
  tint?: string
  muted?: boolean
}) {
  return (
    <div
      className="flex flex-col items-center gap-1 rounded-[var(--r-md)] border px-2 py-3 text-center"
      style={{
        borderColor: tint ? `color-mix(in srgb, ${tint} 28%, var(--bd))` : 'var(--bd)',
        backgroundColor: tint ? `color-mix(in srgb, ${tint} 7%, var(--bg))` : 'var(--bg2)',
      }}
    >
      <span aria-hidden style={{ color: muted ? 'var(--t3)' : tint ?? 'var(--t2)' }}>
        <Icon size={16} aria-hidden />
      </span>
      <span className="font-display text-[9.5px] font-[700] uppercase tracking-[0.05em] text-[var(--t2)]">{label}</span>
      <span className="font-display text-[14px] font-[800] leading-none" style={{ color: muted ? 'var(--t3)' : 'var(--t1)' }}>
        {value}
      </span>
    </div>
  )
}

/** 정보 존 — 라벨 + 내용 (Gestalt 근접성). */
function Zone({ label, accent, children }: { label: string; accent: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <span className="inline-flex items-center gap-2 font-display text-[12px] font-[800] uppercase tracking-[0.07em] text-[var(--t2)]">
        <span aria-hidden className="h-3 w-[3px] rounded-full" style={{ backgroundColor: accent }} />
        {label}
      </span>
      {children}
    </section>
  )
}
