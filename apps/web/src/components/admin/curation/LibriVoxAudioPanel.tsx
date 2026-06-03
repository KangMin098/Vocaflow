// apps/web/src/components/admin/curation/LibriVoxAudioPanel.tsx
//
// 본문 검수(/admin/curation/preview/[bookId])에서 Gutenberg/SE 도서에 LibriVox 보이스를 연결.
// LibriVox 를 독립 소스로 GET 하지 않고, 도서 identity(gutenberg id / 제목·저자)로 매칭.
//   - gutenberg id EXACT 매칭 = 신뢰 / SE 제목·저자 = best-effort
//   - 같은 작품 여러 버전이면 SOLO(단일 낭독) 우선 — 학습 일관성
// archive.org 직접 스트리밍 — 파일 저장 X.

'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Headphones, Loader2 } from 'lucide-react'

import { LibriVoxAudioPlayer, type LibriVoxAudio } from './LibriVoxAudioPlayer'

interface LibriVoxMatch {
  librivox_id: string
  librivox_title: string
  voices: number
  consistency: 'solo' | 'multi' | 'unknown'
  via: 'gutenberg_id' | 'title_author'
}

/** 도서 텍스트 챕터 수 ↔ 낭독 섹션 수 정합 표시 */
function ChapterAlignment({
  bookChapters,
  audioSections,
}: {
  bookChapters: number
  audioSections: number
}) {
  const diff = Math.abs(audioSections - bookChapters)
  const tone =
    diff === 0
      ? { fg: 'var(--learn-known)', icon: '✅', label: '챕터 일치' }
      : diff <= 2
        ? { fg: 'var(--learn-review)', icon: '≈', label: `근접 (±${diff})` }
        : { fg: 'var(--learn-error)', icon: '⚠', label: '불일치' }
  return (
    <span className="inline-flex items-center gap-1 font-mono" style={{ color: tone.fg }} role="status">
      <span aria-hidden>{tone.icon}</span>
      도서 {bookChapters}챕터 · 낭독 {audioSections}섹션 · {tone.label}
    </span>
  )
}

type LoadState = 'loading' | 'ok' | 'none' | 'error'

export function LibriVoxAudioPanel({
  gutenbergId,
  seSlug,
  title,
  author,
  chapterCount,
}: {
  gutenbergId?: string | null
  /** Standard Ebooks 슬러그 — 서버가 원천 gutenberg id 를 해결해 EXACT 매칭에 사용 */
  seSlug?: string | null
  title: string
  author?: string | null
  /** 도서 텍스트 챕터 수 — 섹션 수 근접 버전 우선 선택 + 정합 표시 */
  chapterCount?: number | null
}) {
  const [audio, setAudio] = useState<LibriVoxAudio | null>(null)
  const [match, setMatch] = useState<LibriVoxMatch | null>(null)
  const [state, setState] = useState<LoadState>('loading')
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    setMsg(null)
    const qs = new URLSearchParams()
    if (gutenbergId) qs.set('gutenbergId', gutenbergId)
    if (seSlug) qs.set('seSlug', seSlug)
    if (title) qs.set('title', title)
    if (author) qs.set('author', author)
    if (chapterCount && chapterCount > 0) qs.set('chapterCount', String(chapterCount))

    fetch(`/api/admin/library/resolve-librivox-audio?${qs.toString()}`)
      .then(async (res) => {
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setState('error')
          setMsg(data?.message ?? `HTTP ${res.status}`)
          return
        }
        if (data?.audio && Array.isArray(data.audio.sections) && data.audio.sections.length > 0) {
          setAudio(data.audio as LibriVoxAudio)
          setMatch((data.match as LibriVoxMatch) ?? null)
          setState('ok')
        } else {
          setState('none')
        }
      })
      .catch((e) => {
        if (cancelled) return
        setState('error')
        setMsg(e instanceof Error ? e.message : '네트워크 오류')
      })
    return () => {
      cancelled = true
    }
  }, [gutenbergId, seSlug, title, author, chapterCount])

  return (
    <section className="overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)]">
      <header className="flex flex-wrap items-center gap-2 px-5 py-3">
        <Headphones size={15} className="text-[var(--learn-review)]" aria-hidden />
        <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">
          LibriVox 보이스 — 본문 검수용 청취
        </h2>
        {match && (
          <span
            className="inline-flex items-center gap-1 rounded-[var(--r-full)] px-2 py-0.5 font-mono text-[10px] font-[700]"
            style={
              match.via === 'gutenberg_id'
                ? { background: 'var(--learn-known-light)', color: 'var(--learn-known)' }
                : { background: 'var(--learn-review-light)', color: 'var(--learn-review)' }
            }
            title={
              match.via === 'gutenberg_id'
                ? 'Gutenberg ID 정합 — 정확한 매칭'
                : '제목·저자 기반 추정 매칭 — 다른 작품일 수 있음'
            }
          >
            {match.via === 'gutenberg_id' ? '🎯 ID 정합' : '≈ 제목·저자 추정'}
          </span>
        )}
      </header>

      {state === 'loading' && (
        <div className="flex items-center gap-2 border-t border-[var(--bd)] bg-[var(--bg2)] px-5 py-4 font-body text-[12px] text-[var(--t3)]">
          <Loader2 size={13} className="animate-spin" aria-hidden /> LibriVox 보이스 찾는 중…
        </div>
      )}

      {state === 'error' && (
        <div className="flex items-center gap-2 border-t border-[var(--bd)] bg-[var(--learn-error-light)] px-5 py-4 font-body text-[12px] text-[var(--learn-error)]">
          <AlertCircle size={13} aria-hidden /> 보이스를 불러오지 못했습니다{msg ? ` — ${msg}` : ''}
        </div>
      )}

      {state === 'none' && (
        <div className="border-t border-[var(--bd)] bg-[var(--bg2)] px-5 py-4 font-body text-[12px] text-[var(--t3)]">
          이 도서와 연결할 LibriVox 낭독을 찾지 못했습니다.
          {seSlug && ' (Standard Ebooks 의 Gutenberg 원천을 찾지 못했거나 해당 낭독이 없습니다)'}
          {!gutenbergId && !seSlug && ' (제목·저자 매칭만 시도 — Gutenberg 출처가 아니면 누락될 수 있어요)'}
        </div>
      )}

      {state === 'ok' && audio && (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--bd)] bg-[var(--bg2)] px-5 pt-3 font-body text-[11px] text-[var(--t3)]">
            {match && (
              <span>
                연결된 녹음: <span className="text-[var(--t2)]">{match.librivox_title}</span>
              </span>
            )}
            {chapterCount && chapterCount > 0 && (
              <ChapterAlignment bookChapters={chapterCount} audioSections={audio.section_count} />
            )}
          </div>
          <LibriVoxAudioPlayer audio={audio} />
        </>
      )}
    </section>
  )
}
