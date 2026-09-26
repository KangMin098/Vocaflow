// apps/web/src/components/library/browse/SeriesInfoModal.tsx
//
// 시리즈 학습정보 팝업 — /library/scripts 에서 주제(시리즈)를 누르면 뜨는 "결정 surface".
//
// ── 껍데기는 `ui/Dialog` (DD-68 · tines-mapping §28, 2026-09-23) ───────────
// 예전에는 이 파일이 배경막·패널·머리·닫기 버튼을 직접 그렸다. 지금은 참조 팝업 골격을
// 그대로 쓴다: 빵부스러기 알약 → 큰 제목 → 한 줄 → **능력 태그 줄**(참조의 태그 자리) →
// 가로선 → 2열 본문(넓은 왼쪽 판단 + 좁은 오른쪽 수치·출처) → 바닥 CTA.
// 참조가 태그를 머리에 올리는 이유가 우리에게도 맞는다 — "무엇을 기르는 시리즈인가" 는
// 제목 다음으로 읽혀야 하는 정보지, 스크롤해서 찾을 것이 아니다.
//
// ── 내용 원칙(그대로) ──────────────────────────────────────────────────────
//   · 난이도 게이지: "나 vs 시리즈"를 축 위에 그려 <1s 시각 즉답(전주의적).
//   · 스탯 타일: 분량·읽기시간·음성을 아이콘+수치로(그림 우월).
//   · 로드맵: 큰 번호+연결선(경로 시각화). why/출처는 아이콘 앵커로 보조.
//   · 콘텐츠는 전부 실데이터/근거 — TrackStat + SourceTrack 카피.

'use client'

import { useMemo } from 'react'
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
  Target,
  Type,
  Volume2,
  type LucideIcon,
} from 'lucide-react'

import { Dialog, DialogColumns, DialogSection, DialogTintPanel, type DialogTone } from '@/components/ui/Dialog'
import { BTN, DIALOG } from '@/components/ui/tines-kit'
import { Gwonjeom } from '@/components/ui/press/Gwonjeom'
import { SealMark } from '@/components/ui/press'

import {
  TRACK_FIT_META,
  effectiveUserV,
  getLearnerBand,
  vToCefrLabel,
  vToPct,
  type TrackFit,
  type TrackStat,
} from '@/lib/articles/source-map'
import type { PublishedArticle } from '@/lib/articles/types'

/** 판정 → 면 색. 색이 뜻을 나른다(맞음 초록 · 어려움 살구 · 쉬움 청록 · 미진단 라벤더). */
const FIT_TONE: Record<TrackFit | 'undiagnosed', DialogTone> = {
  fit: 'green',
  hard: 'peach',
  easy: 'teal',
  undiagnosed: 'lavender',
}

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
  if (/자신감|친숙|시작/.test(skill)) return Gwonjeom
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
  const accent = track.accent
  const band = getLearnerBand(userV)
  const tone = FIT_TONE[band === 'undiagnosed' ? 'undiagnosed' : fit]

  // 읽기 시간 레이블 — 실 글에서 집계 (분량 타일용).
  const readLabel = useMemo(() => {
    const mins = stat.items.map(readMinutes).filter((m): m is number => m != null)
    if (mins.length === 0) return '—'
    const lo = Math.min(...mins)
    const hi = Math.max(...mins)
    return lo === hi ? `${lo}분` : `${lo}~${hi}분`
  }, [stat.items])

  const maxSourceCount = Math.max(1, ...sources.map((s) => s.count))

  return (
    <Dialog
      onClose={onClose}
      size="lg"
      media={<SealMark label={track.title} size="lg" />}
      crumbs={['학습 시리즈', '기사 서가', `시리즈 ${cefrLabel}`]}
      title={track.title}
      byline={track.oneLine}
      // 참조의 태그 줄 = 「이 시리즈로 기르는 능력」. 아이콘을 달아 Dual Coding 을 유지한다.
      tags={track.skills.map((sk) => {
        const Icon = skillIcon(sk)
        return (
          <span key={sk} className="inline-flex items-center gap-1.5">
            <Icon size={14} aria-hidden style={{ color: accent }} />
            {sk}
          </span>
        )
      })}
      meta={
        <>
          <span className="font-display font-[700] text-[var(--t1)]">{count}편</span>
          <span aria-hidden>·</span>
          <span>출처 {sources.length}곳</span>
          {hasAudio && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Volume2 size={13} aria-hidden /> 음성
              </span>
            </>
          )}
        </>
      }
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN.secondary}>
            닫기
          </button>
          <button type="button" onClick={onEnter} className={`${BTN.primary} group ml-auto flex-1 sm:flex-none`}>
            {idealCount > 0 ? `딱 맞는 글 ${idealCount}편부터 시작` : '이 시리즈로 시작하기'}
            <ArrowRight size={16} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </>
      }
    >
      <DialogColumns
        main={
          <>
            {/* ── 참조의 「Starting prompt」 자리 — 우리는 「나에게 맞나」 판단이 먼저다 ── */}
            <DialogTintPanel
              tone={tone}
              dots
              title={appeal.lead}
              note={appeal.body}
              action={
                <span className="inline-flex items-center gap-1.5 font-display text-[13px] font-[800]">
                  <Target size={15} aria-hidden />
                  {fitMeta.label}
                </span>
              }
            >
              <DifficultyGauge vMin={vMin} vMax={vMax} userV={userV} cefrLabel={cefrLabel} accent={accent} />
            </DialogTintPanel>

            {/* ── 학습 로드맵 — 큰 번호 + 연결선 ── */}
            <DialogSection label="학습 로드맵">
              <ol className="flex flex-col">
                {track.method.map((step, i) => (
                  <li key={step} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        aria-hidden
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[12px] font-[800] text-[var(--ti)]"
                        style={{ backgroundColor: accent }}
                      >
                        {i + 1}
                      </span>
                      {i < track.method.length - 1 && (
                        <span
                          aria-hidden
                          className="my-1 w-[2.5px] flex-1 rounded-full"
                          style={{ backgroundColor: `color-mix(in srgb, ${accent} 30%, var(--bd))` }}
                        />
                      )}
                    </div>
                    <span
                      className={`pt-1 font-body text-[14px] font-[600] leading-[1.35] text-[var(--t1)] break-keep ${i < track.method.length - 1 ? 'pb-3' : ''}`}
                    >
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </DialogSection>

            {/* ── 왜 효과적 ── */}
            <DialogSection label="왜 효과적일까요">
              <div className="flex items-start gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-4">
                <span
                  aria-hidden
                  className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `color-mix(in srgb, ${accent} 16%, transparent)`, color: accent }}
                >
                  <Lightbulb size={14} aria-hidden />
                </span>
                <div className="flex flex-col gap-1">
                  <p className="font-body text-[13.5px] leading-[1.55] text-[var(--t1)] break-keep">{track.why}</p>
                  {track.note && (
                    <p className="mt-1 font-body text-[12px] leading-[1.45] text-[var(--t2)] break-keep">※ {track.note}</p>
                  )}
                </div>
              </div>
            </DialogSection>
          </>
        }
        side={
          <>
            {/* ── 스탯 타일 — 분량·읽기시간·음성 (그림 우월) ── */}
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
              <StatTile icon={FileText} label="분량" value={`${count}편`} tint={accent} />
              <StatTile icon={Clock} label="읽기" value={readLabel} tint={accent} />
              <StatTile
                icon={Volume2}
                label="음성"
                value={hasAudio ? '있음' : '없음'}
                tint={hasAudio ? accent : undefined}
                muted={!hasAudio}
              />
            </div>

            {/* ── 출처별 상세 — 무엇을·어디서, 한눈에 ── */}
            {sources.length > 0 && (
              <DialogSection label={`출처 · ${sources.length}곳`}>
                <div className="flex flex-col gap-2">
                  {sources.map((s) => (
                    <SourceDetail key={s.key} source={s} maxCount={maxSourceCount} />
                  ))}
                </div>
                <p className="font-body text-[11px] leading-[1.4] text-[var(--t2)] break-keep">
                  모두 신뢰할 수 있는 원문에서 큐레이션 · 원문은 각 글에서 열 수 있어요.
                </p>
              </DialogSection>
            )}
          </>
        }
      />
    </Dialog>
  )
}

/** 난이도 게이지 — 축(쉬움→어려움) 위에 시리즈 밴드 + 내 위치를 그려 "나에게 맞나"를 시각 즉답. */
function DifficultyGauge({
  vMin,
  vMax,
  userV,
  cefrLabel,
  accent,
}: {
  vMin: number
  vMax: number
  userV: number
  cefrLabel: string
  accent: string
}) {
  const bandLo = vToPct(vMin)
  const bandHi = vToPct(vMax)
  const me = vToPct(effectiveUserV(userV))
  const myCefr = vToCefrLabel(effectiveUserV(userV))
  return (
    <div className="flex flex-col gap-2">
      {/* 트랙은 면 위라 면 글자색 14% — 크림 기준 --bg3 를 쓰면 색 있는 면에서 안 보인다(§25). */}
      <div className="relative h-2.5 w-full rounded-full bg-[color-mix(in_srgb,var(--t1)_14%,transparent)]">
        {/* 시리즈 밴드 */}
        <span
          aria-hidden
          className="absolute top-0 h-full rounded-full"
          style={{
            left: `${bandLo}%`,
            width: `${Math.max(6, bandHi - bandLo)}%`,
            backgroundColor: `color-mix(in srgb, ${accent} 55%, transparent)`,
          }}
        />
        {/* 내 위치 마커 */}
        <span aria-hidden className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${me}%` }}>
          <span className="block h-4 w-4 rounded-full border-[2.5px] border-[var(--bg)] bg-[var(--t1)]" />
        </span>
      </div>
      <div className="flex items-center justify-between font-mono text-[10.5px] font-[600] text-[var(--t2)]">
        <span>← 쉬움</span>
        <span className="font-[700]">
          내 레벨 · {userV > 0 ? `V${userV}` : '기준'} · {myCefr}
        </span>
        <span aria-hidden className="hidden sm:inline">
          시리즈 {cefrLabel}
        </span>
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
      <span aria-hidden className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: source.color }} />
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
        {source.blurb && <p className="font-body text-[12px] leading-[1.4] text-[var(--t2)] break-keep">{source.blurb}</p>}
        <div className="mt-0.5 h-[3px] w-full rounded-full bg-[var(--bg3)]">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, backgroundColor: `color-mix(in srgb, ${source.color} 60%, transparent)` }}
          />
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
      className="flex flex-col items-center gap-1 rounded-[var(--r-md)] border px-2 py-3 text-center lg:flex-row lg:gap-3 lg:px-4 lg:text-left"
      style={{
        borderColor: tint ? `color-mix(in srgb, ${tint} 28%, var(--bd))` : 'var(--bd)',
        backgroundColor: tint ? `color-mix(in srgb, ${tint} 7%, var(--bg))` : 'var(--bg2)',
      }}
    >
      <span aria-hidden style={{ color: muted ? 'var(--t3)' : tint ?? 'var(--t2)' }}>
        <Icon size={16} aria-hidden />
      </span>
      <span className={`${DIALOG.sectionLabel} text-[9.5px] lg:flex-1`}>{label}</span>
      <span
        className="font-display text-[14px] font-[800] leading-none"
        style={{ color: muted ? 'var(--t3)' : 'var(--t1)' }}
      >
        {value}
      </span>
    </div>
  )
}
