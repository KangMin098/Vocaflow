// apps/web/src/components/admin/curation/LibriVoxAudioPlayer.tsx
// LibriVox 오디오 플레이어 (큐레이션 본문 검수 공용)
// - 챕터 selector + archive.org 직접 스트리밍 (파일 저장 X)
// - 목소리 일관성 배지 (솔로 = 학습 권장 / 협업 = 목소리 바뀜)
// 사용처: LibriVoxIdTab (탭 미리보기) · LibriVoxAudioPanel (preview/[bookId] 본문 검수)

'use client'

import { useState } from 'react'
import { ExternalLink, Headphones } from 'lucide-react'

export interface LibriVoxAudioSection {
  n: number
  title: string
  url: string
  secs: number | null
  reader: string | null
}

export interface LibriVoxAudio {
  archive_url: string | null
  librivox_url: string
  total_secs: number | null
  section_count: number
  sections: LibriVoxAudioSection[]
}

export function LibriVoxAudioPlayer({ audio }: { audio: LibriVoxAudio }) {
  const [idx, setIdx] = useState(0)
  const current = audio.sections[idx] ?? audio.sections[0]

  // 목소리 일관성 — 학습 적합도의 핵심 신호.
  // distinct 낭독자 1명 = 솔로(일관 · 권장) / N명 = 협업(챕터마다 목소리 바뀜)
  const voices = new Set(
    audio.sections.map((s) => s.reader).filter((r): r is string => !!r),
  ).size
  const consistency: 'solo' | 'multi' | 'unknown' =
    voices === 0 ? 'unknown' : voices === 1 ? 'solo' : 'multi'

  if (!current) return null

  return (
    <section
      className="border-t border-[var(--bd)] bg-[var(--bg2)] px-5 py-4"
      aria-label="LibriVox 오디오 낭독"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]">
          <Headphones size={11} aria-hidden />
          오디오 낭독 (LibriVox)
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-[var(--t5)]">
          <span>
            총 {audio.section_count}챕터
            {audio.total_secs != null && ` · ${formatSecs(audio.total_secs)}`}
          </span>
          {audio.archive_url && (
            <a
              href={audio.archive_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[var(--t2)] hover:text-[var(--p)] hover:underline"
              aria-label="archive.org 에서 전체 보기"
            >
              archive.org
              <ExternalLink size={9} aria-hidden />
            </a>
          )}
        </div>
      </div>

      {/* 목소리 일관성 배지 — 학습용 선별 기준 */}
      <VoiceConsistencyBadge kind={consistency} voices={voices} />

      {/* 챕터 선택 + 이동 */}
      <div className="mb-2 flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          aria-label="이전 챕터"
          className="inline-flex min-h-[44px] w-9 shrink-0 items-center justify-center rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] font-mono text-[13px] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          ‹
        </button>
        <label className="sr-only" htmlFor="librivox-chapter-select">
          챕터 선택
        </label>
        <select
          id="librivox-chapter-select"
          value={idx}
          onChange={(e) => setIdx(Number(e.target.value))}
          className="min-h-[44px] flex-1 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-body text-[12px] text-[var(--t1)] focus-visible:border-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          {audio.sections.map((s, i) => (
            <option key={i} value={i}>
              {s.n}. {s.title}
              {s.secs != null ? ` (${formatSecs(s.secs)})` : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setIdx((i) => Math.min(audio.sections.length - 1, i + 1))}
          disabled={idx >= audio.sections.length - 1}
          aria-label="다음 챕터"
          className="inline-flex min-h-[44px] w-9 shrink-0 items-center justify-center rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] font-mono text-[13px] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          ›
        </button>
      </div>

      {/* 플레이어 — preload none 으로 자동 다운로드 방지, 재생 시 스트리밍 */}
      <audio key={current.url} controls preload="none" src={current.url} className="w-full">
        오디오 재생을 지원하지 않는 브라우저입니다.
      </audio>

      {current.reader && (
        <p className="mt-1.5 font-body text-[11px] text-[var(--t2)]">🎙 낭독: {current.reader}</p>
      )}
    </section>
  )
}

function VoiceConsistencyBadge({
  kind,
  voices,
}: {
  kind: 'solo' | 'multi' | 'unknown'
  voices: number
}) {
  const cfg = {
    solo: {
      bg: 'var(--learn-known-light)',
      fg: 'var(--learn-known)',
      dot: '🟢',
      label: '단일 낭독 · 목소리 일관 (학습 권장)',
    },
    multi: {
      bg: 'var(--learn-review-light)',
      fg: 'var(--learn-review)',
      dot: '🟡',
      label: `${voices}명 분담 낭독 · 챕터마다 목소리 바뀜`,
    },
    unknown: {
      bg: 'var(--bg)',
      fg: 'var(--t3)',
      dot: '⚪',
      label: '낭독자 정보 없음',
    },
  }[kind]

  return (
    <div
      className="mb-2 inline-flex items-center gap-2 rounded-[var(--r-sm)] px-2 py-1 font-body text-[11px] font-[600]"
      style={{ background: cfg.bg, color: cfg.fg }}
      role="status"
    >
      <span aria-hidden>{cfg.dot}</span>
      {cfg.label}
    </div>
  )
}

export function formatSecs(total: number): string {
  if (!Number.isFinite(total) || total < 0) return '0:00'
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = Math.floor(total % 60)
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
