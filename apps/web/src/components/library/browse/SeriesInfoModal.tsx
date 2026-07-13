// apps/web/src/components/library/browse/SeriesInfoModal.tsx
//
// 시리즈 학습정보 팝업 (v06.240) — /library/scripts 진입면에서 주제(시리즈) 왼쪽을 누르면 뜨는 "결정 surface".
//   글 목록에 들어가기 전, 이 시리즈가 무엇을·어떻게·왜 학습에 좋은지 매력적으로 제시해
//   학습자가 확신을 갖고 고르게 한다 (Progressive Disclosure · Empathetic Feedback · 자기효능감).
//   콘텐츠는 전부 실데이터/근거 — TrackStat(집계 sources·count·fit·idealCount) + SourceTrack 카피(skills/why/method).
//   Calm UI: 차분한 등장(페이드), 색+아이콘 이중부호, 44px 타깃, Esc·백드롭 닫기, 다크 토큰 대응.

'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import {
  ArrowRight,
  BookOpenText,
  Lightbulb,
  Route,
  Sparkles,
  Target,
  Volume2,
  X,
} from 'lucide-react'

import { TRACK_FIT_META, getLearnerBand, type TrackStat } from '@/lib/articles/source-map'

/** 개인화 어필 한 줄 — fit + idealCount + 진단여부 기반 (감정 부호화·자기효능감). */
function appealLine(stat: TrackStat, userV: number): { lead: string; body: string } {
  const band = getLearnerBand(userV)
  if (band === 'undiagnosed') {
    return {
      lead: '중급(B1) 기준으로 보여드려요',
      body: '3분 레벨 진단을 하면 당신 수준에 딱 맞는 글만 골라드려요.',
    }
  }
  if (stat.fit === 'fit') {
    return {
      lead: '당신 레벨에 딱 맞아요',
      body:
        stat.idealCount > 0
          ? `지금 읽기 좋은 글이 ${stat.idealCount}편 있어요. 여기서 시작하면 좋아요.`
          : '지금 수준에서 편하게 몰입할 수 있는 시리즈예요.',
    }
  }
  if (stat.fit === 'hard') {
    return {
      lead: '조금 도전적이에요',
      body: '살짝 어려운 글이 오히려 더 깊은 이해와 기억을 만들어요. 준비됐다면 도전해봐요.',
    }
  }
  return {
    lead: '수월하게 읽혀요',
    body: '아는 단어가 많아 부담 없어요. 속도·유창성 읽기 훈련에 활용해봐요.',
  }
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
  const { track, count, cefrLabel, hasAudio, fit, sources, idealCount } = stat
  const fitMeta = TRACK_FIT_META[fit]
  const appeal = appealLine(stat, userV)
  const titleId = useId()
  const accent = track.accent

  // 차분한 등장 (mounted-state 트랜지션 — 플러그인 의존 없이 확실)
  const [shown, setShown] = useState(false)

  // Esc 닫기 + 배경 스크롤 잠금 (팝업 몰입) + 등장 트리거
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
      className={`fixed inset-0 z-[60] flex items-end justify-center bg-[color-mix(in_srgb,var(--t1)_45%,transparent)] p-0 backdrop-blur-[3px] transition-opacity duration-[var(--dur-normal)] sm:items-center sm:p-4 ${shown ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full max-w-[540px] flex-col overflow-hidden rounded-t-[var(--r-xl)] bg-[var(--bg)] shadow-[var(--sh-lg)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] sm:rounded-[var(--r-xl)] ${shown ? 'translate-y-0 opacity-100 sm:scale-100' : 'translate-y-4 opacity-0 sm:translate-y-0 sm:scale-95'}`}
      >
        {/* ── 히어로 헤더 (액센트 브랜딩) ── */}
        <header
          className="relative flex flex-col gap-3 px-6 pb-5 pt-6"
          style={{
            background: `linear-gradient(160deg, color-mix(in srgb, ${accent} 16%, var(--bg)) 0%, var(--bg) 78%)`,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-[var(--r-full)] text-[var(--t3)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg3)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <X size={18} aria-hidden />
          </button>

          <span
            className="inline-flex w-fit items-center gap-1.5 font-display text-[11px] font-[800] uppercase tracking-[0.09em]"
            style={{ color: accent }}
          >
            <Sparkles size={12} aria-hidden /> 학습 시리즈
          </span>

          <div className="flex items-start gap-3.5 pr-10">
            <span
              aria-hidden
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--r-lg)] text-[28px] shadow-[var(--sh-xs)]"
              style={{ backgroundColor: `color-mix(in srgb, ${accent} 18%, var(--bg))` }}
            >
              {track.icon}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2
                id={titleId}
                className="font-editorial text-[24px] font-[500] leading-[1.12] tracking-[-0.01em] text-[var(--t1)]"
              >
                {track.title}
              </h2>
              <p className="font-body text-[13px] leading-[1.5] text-[var(--t2)]">{track.oneLine}</p>
            </div>
          </div>

          {/* 메타 배지 */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center rounded-[var(--r-full)] px-2.5 py-0.5 font-display text-[11px] font-[800]"
              style={{ color: fitMeta.color, backgroundColor: `color-mix(in srgb, ${fitMeta.color} 15%, transparent)` }}
            >
              {fitMeta.label}
            </span>
            <span
              className="inline-flex items-center rounded-[var(--r-sm)] px-1.5 py-0.5 font-mono text-[11px] font-[700]"
              style={{ color: accent, backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)` }}
            >
              {cefrLabel}
            </span>
            <span className="font-mono text-[11.5px] font-[600] text-[var(--t3)]">{count}편</span>
            {hasAudio && (
              <span className="inline-flex items-center gap-1 font-mono text-[11.5px] font-[600] text-[var(--t3)]">
                <Volume2 size={12} aria-hidden /> 음성
              </span>
            )}
          </div>
        </header>

        {/* ── 본문 (스크롤) ── */}
        <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
          {/* 개인화 어필 — 자기효능감 */}
          <div
            className="flex items-start gap-2.5 rounded-[var(--r-lg)] border px-3.5 py-3"
            style={{
              borderColor: `color-mix(in srgb, ${fitMeta.color} 30%, var(--bd))`,
              backgroundColor: `color-mix(in srgb, ${fitMeta.color} 7%, var(--bg))`,
            }}
          >
            <span
              aria-hidden
              className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--r-full)]"
              style={{ backgroundColor: `color-mix(in srgb, ${fitMeta.color} 20%, transparent)`, color: fitMeta.color }}
            >
              <Sparkles size={12} aria-hidden />
            </span>
            <p className="font-body text-[12.5px] leading-[1.5] text-[var(--t2)]">
              <span className="font-display font-[800] text-[var(--t1)]">{appeal.lead}</span> —{' '}
              {appeal.body}
            </p>
          </div>

          {/* 무엇을 읽나 — 출처 (신뢰·기대) */}
          {sources.length > 0 && (
            <Section icon={BookOpenText} label="무엇을 읽나요" accent={accent}>
              <div className="flex flex-wrap gap-1.5">
                {sources.map((s) => (
                  <span
                    key={s.key}
                    className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] border px-2.5 py-1 font-display text-[11.5px] font-[600] text-[var(--t1)]"
                    style={{ borderColor: `color-mix(in srgb, ${s.color} 35%, transparent)` }}
                    title={`${s.label} · ${s.count}편`}
                  >
                    <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label}
                    <span className="font-mono text-[10px] font-[700] text-[var(--t3)]">{s.count}</span>
                  </span>
                ))}
              </div>
              <p className="font-body text-[11px] leading-[1.4] text-[var(--t3)]">
                신뢰할 수 있는 원문에서 큐레이션했어요 · 원문은 각 글에서 열 수 있어요.
              </p>
            </Section>
          )}

          {/* 이렇게 성장해요 — 능력 (효과) */}
          <Section icon={Target} label="이렇게 성장해요" accent={accent}>
            <div className="flex flex-wrap gap-1.5">
              {track.skills.map((sk) => (
                <span
                  key={sk}
                  className="inline-flex items-center rounded-[var(--r-full)] bg-[var(--bg2)] px-2.5 py-1 font-display text-[12px] font-[600] text-[var(--t2)] shadow-[var(--sh-xs)]"
                >
                  {sk}
                </span>
              ))}
            </div>
          </Section>

          {/* 왜 효과적인가 — 학습 과학 (Empathetic · Lora italic) */}
          <Section icon={Lightbulb} label="왜 효과적일까요" accent={accent}>
            <p
              className="border-l-2 pl-3 font-english text-[13.5px] italic leading-[1.55] text-[var(--t2)]"
              style={{ borderColor: `color-mix(in srgb, ${accent} 45%, transparent)` }}
            >
              {track.why}
            </p>
          </Section>

          {/* 학습 로드맵 — 방법 (세로 스테퍼) */}
          <Section icon={Route} label="학습 로드맵" accent={accent}>
            <ol className="flex flex-col gap-0">
              {track.method.map((step, i) => (
                <li key={step} className="flex gap-3">
                  {/* 번호 + 연결선 */}
                  <div className="flex flex-col items-center">
                    <span
                      aria-hidden
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--r-full)] font-mono text-[11px] font-[800] text-[var(--ti)]"
                      style={{ backgroundColor: accent }}
                    >
                      {i + 1}
                    </span>
                    {i < track.method.length - 1 && (
                      <span
                        aria-hidden
                        className="my-0.5 w-[2px] flex-1"
                        style={{ backgroundColor: `color-mix(in srgb, ${accent} 25%, var(--bd))` }}
                      />
                    )}
                  </div>
                  <span className="pb-3.5 pt-0.5 font-body text-[13px] leading-[1.4] text-[var(--t1)]">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </Section>

          {track.note && (
            <p className="rounded-[var(--r-md)] bg-[var(--bg2)] px-3 py-2 font-body text-[11.5px] leading-[1.45] text-[var(--t3)]">
              ※ {track.note}
            </p>
          )}
        </div>

        {/* ── 스티키 CTA ── */}
        <footer className="flex items-center gap-2.5 border-t border-[var(--bd)] bg-[var(--bg)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--r-md)] px-4 font-display text-[13px] font-[700] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={onEnter}
            className="group inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[var(--r-md)] px-4 font-display text-[14px] font-[800] text-[var(--ti)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 active:translate-y-0"
            style={{ backgroundColor: accent }}
          >
            {idealCount > 0 ? `딱 맞는 글 ${idealCount}편부터 시작하기` : '이 시리즈로 시작하기'}
            <ArrowRight size={15} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </footer>
      </div>
    </div>
  )
}

/** 본문 섹션 — 아이콘 라벨 + 내용 (일관 리듬). */
function Section({
  icon: Icon,
  label,
  accent,
  children,
}: {
  icon: typeof Target
  label: string
  accent: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <span className="inline-flex items-center gap-1.5 font-display text-[11px] font-[800] uppercase tracking-[0.08em] text-[var(--t3)]">
        <Icon size={13} aria-hidden style={{ color: accent }} />
        {label}
      </span>
      {children}
    </section>
  )
}
