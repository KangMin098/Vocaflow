// apps/web/src/components/library/browse/SeriesInfoModal.tsx
//
// 시리즈 학습정보 팝업 (v06.241 재설계 — 가독성·가시성·"한눈에 확") —
//   /library/scripts 진입면에서 주제(시리즈) 왼쪽을 누르면 뜨는 "결정 surface".
// 뇌과학·심리 근거:
//   · 전주의적 처리(pre-attentive): 색·크기로 결정정보(난이도·레벨·분량)를 <1s 파악 → 상단 스탯 스트립.
//   · 인지부하(Sweller ~4항목): 6나열 → 3존(① 한눈 요약 ② 성장·로드맵 ③ 근거)으로 청킹.
//   · 시각적 위계 + Von Restorff: 개인화 훅·CTA를 크게·고대비로 격리.
//   · 그림 우월 효과 + Gestalt(근접성·공통영역): 아이콘 앵커 + 그룹 간격/구획.
//   · 가독성: 폰트 크기↑·대비↑(중요정보 t1/t2), 짧은 행, 44px 타깃.
// 콘텐츠는 전부 실데이터/근거 — TrackStat(sources·count·fit·idealCount) + SourceTrack 카피.

'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { ArrowRight, Check, Sparkles, Volume2, X } from 'lucide-react'

import { TRACK_FIT_META, getLearnerBand, type TrackStat } from '@/lib/articles/source-map'

/** 개인화 훅 — fit + idealCount + 진단여부 (감정 부호화·자기효능감). */
function appealLine(stat: TrackStat, userV: number): { lead: string; body: string } {
  const band = getLearnerBand(userV)
  if (band === 'undiagnosed') {
    return { lead: '중급(B1) 기준으로 보여드려요', body: '3분 진단하면 딱 맞는 글만 골라드려요.' }
  }
  if (stat.fit === 'fit') {
    return {
      lead: '당신 레벨에 딱 맞아요',
      body:
        stat.idealCount > 0
          ? `지금 읽기 좋은 글이 ${stat.idealCount}편 있어요.`
          : '편하게 몰입할 수 있는 시리즈예요.',
    }
  }
  if (stat.fit === 'hard') {
    return { lead: '조금 도전적이에요', body: '살짝 어려운 글이 더 깊은 이해와 기억을 만들어요.' }
  }
  return { lead: '수월하게 읽혀요', body: '아는 단어가 많아 속도·유창성 훈련에 좋아요.' }
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
        {/* ═══ 히어로 — 정체성 (그림 우월·큰 아이콘/타이틀) ═══ */}
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
            <span
              className="inline-flex w-fit items-center gap-1 font-display text-[11px] font-[800] uppercase tracking-[0.1em]"
              style={{ color: accent }}
            >
              학습 시리즈
            </span>
            <h2
              id={titleId}
              className="font-editorial text-[25px] font-[600] leading-[1.1] tracking-[-0.01em] text-[var(--t1)]"
            >
              {track.title}
            </h2>
            <p className="font-body text-[14px] leading-[1.5] text-[var(--t2)]">{track.oneLine}</p>
          </div>
        </header>

        {/* ═══ 본문 (스크롤) ═══ */}
        <div className="flex flex-col gap-5 overflow-y-auto px-6 pb-5 pt-1">
          {/* ── ① 한눈 요약: 스탯 스트립 (전주의적 — 색·크기로 <1s 파악) ── */}
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="난이도" value={fitMeta.label} valueColor={fitMeta.color} tint={fitMeta.color} />
            <StatTile label="레벨" value={cefrLabel} valueColor={accent} tint={accent} />
            <StatTile
              label="분량"
              value={`${count}편`}
              valueColor="var(--t1)"
              badge={hasAudio ? '음성' : undefined}
            />
          </div>

          {/* ── 개인화 훅 (Von Restorff — 크게·격리·감정) ── */}
          <div
            className="flex items-start gap-3 rounded-[var(--r-lg)] border-l-[3px] px-4 py-3.5"
            style={{
              borderColor: fitMeta.color,
              backgroundColor: `color-mix(in srgb, ${fitMeta.color} 9%, var(--bg))`,
            }}
          >
            <span
              aria-hidden
              className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--r-full)]"
              style={{ backgroundColor: fitMeta.color, color: 'var(--ti)' }}
            >
              <Sparkles size={13} aria-hidden />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="font-display text-[16px] font-[800] leading-[1.3] text-[var(--t1)]">
                {appeal.lead}
              </span>
              <span className="font-body text-[13.5px] leading-[1.45] text-[var(--t2)]">{appeal.body}</span>
            </div>
          </div>

          {/* ── ② 이렇게 성장해요 (능력 — 그림 우월·체크 앵커) ── */}
          <Zone label="이렇게 성장해요" accent={accent}>
            <ul className="flex flex-col gap-2">
              {track.skills.map((sk) => (
                <li key={sk} className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--r-full)]"
                    style={{ backgroundColor: `color-mix(in srgb, ${accent} 18%, transparent)`, color: accent }}
                  >
                    <Check size={12} strokeWidth={3} aria-hidden />
                  </span>
                  <span className="font-body text-[14px] font-[600] text-[var(--t1)]">{sk}</span>
                </li>
              ))}
            </ul>
          </Zone>

          {/* ── 학습 로드맵 (경로 시각화 — 큰 번호·연결선) ── */}
          <Zone label="학습 로드맵" accent={accent}>
            <ol className="flex flex-col">
              {track.method.map((step, i) => (
                <li key={step} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      aria-hidden
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--r-full)] font-mono text-[12px] font-[800] text-[var(--ti)] shadow-[var(--sh-xs)]"
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
                    className={`pt-1 font-body text-[14px] font-[600] leading-[1.35] text-[var(--t1)] ${i < track.method.length - 1 ? 'pb-3' : ''}`}
                  >
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </Zone>

          {/* ── ③ 근거 존: 왜 효과적 + 출처 (보조 — 신뢰) ── */}
          <div className="flex flex-col gap-3 rounded-[var(--r-lg)] bg-[var(--bg2)] p-4">
            <div className="flex flex-col gap-1.5">
              <span className="font-display text-[11px] font-[800] uppercase tracking-[0.08em] text-[var(--t2)]">
                왜 효과적일까요
              </span>
              <p className="font-body text-[13.5px] leading-[1.55] text-[var(--t1)]">{track.why}</p>
            </div>
            {sources.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t border-[var(--bd)] pt-3">
                <span className="font-display text-[11px] font-[800] uppercase tracking-[0.08em] text-[var(--t2)]">
                  출처 · 신뢰할 수 있는 원문
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {sources.map((s) => (
                    <span
                      key={s.key}
                      className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] bg-[var(--bg)] px-2.5 py-1 font-display text-[11.5px] font-[600] text-[var(--t1)] shadow-[var(--sh-xs)]"
                      title={`${s.label} · ${s.count}편`}
                    >
                      <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.label}
                      <span className="font-mono text-[10px] font-[700] text-[var(--t3)]">{s.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {track.note && (
              <p className="font-body text-[11.5px] leading-[1.45] text-[var(--t3)]">※ {track.note}</p>
            )}
          </div>
        </div>

        {/* ═══ 스티키 CTA (Von Restorff — 가장 큰 고대비 행동) ═══ */}
        <footer className="flex items-center gap-2.5 border-t border-[var(--bd)] bg-[var(--bg)] px-6 py-4">
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
            className="group inline-flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-[var(--r-md)] px-4 font-display text-[15px] font-[800] text-[var(--ti)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 active:translate-y-0"
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

/** 한눈 요약 타일 — 라벨(작게) + 값(크게·색) · 전주의적 파악. */
function StatTile({
  label,
  value,
  valueColor,
  tint,
  badge,
}: {
  label: string
  value: string
  valueColor: string
  tint?: string
  badge?: string
}) {
  return (
    <div
      className="flex flex-col items-center gap-1 rounded-[var(--r-md)] border px-2 py-2.5 text-center"
      style={{
        borderColor: tint ? `color-mix(in srgb, ${tint} 28%, var(--bd))` : 'var(--bd)',
        backgroundColor: tint ? `color-mix(in srgb, ${tint} 7%, var(--bg))` : 'var(--bg2)',
      }}
    >
      <span className="font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t3)]">
        {label}
      </span>
      <span className="inline-flex items-center gap-1 font-display text-[15px] font-[800] leading-none" style={{ color: valueColor }}>
        {value}
        {badge && (
          <span className="inline-flex items-center gap-0.5 font-mono text-[10px] font-[700] text-[var(--t3)]">
            <Volume2 size={11} aria-hidden /> {badge}
          </span>
        )}
      </span>
    </div>
  )
}

/** 정보 존 — 라벨(가시성 t2) + 내용 (Gestalt 근접성 그룹). */
function Zone({ label, accent, children }: { label: string; accent: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <span className="inline-flex items-center gap-1.5 font-display text-[12px] font-[800] uppercase tracking-[0.07em] text-[var(--t2)]">
        <span aria-hidden className="h-3 w-[3px] rounded-full" style={{ backgroundColor: accent }} />
        {label}
      </span>
      {children}
    </section>
  )
}
