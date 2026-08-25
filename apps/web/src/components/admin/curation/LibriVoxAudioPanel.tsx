// apps/web/src/components/admin/curation/LibriVoxAudioPanel.tsx
//
// LibriVox 보이스 — 도서 챕터 ↔ 보이스 챕터 직관 매핑 (본문 검수용).
//   섹션 제목의 챕터 번호로 LibriVox 낭독(다권이면 합쳐서)을 도서 챕터에 1:1 매핑.
//   큐레이터는 "매핑 연결"만 누르면 됨 — 권 목록·선택 없음. 리더에서 챕터별 재생.
//   archive.org 직접 스트리밍 (파일 저장 X).

'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, BookOpen, Check, ChevronDown, ChevronRight, Headphones, Link2Off, Loader2, Pause, Play } from 'lucide-react'

interface SavedChapter {
  /** 도서 챕터 idx */
  idx: number
  /** 보이스 챕터 번호 (LibriVox Roman → 정수) */
  roman: number
  /** 첫 파트 제목 (표시·미리듣기용) */
  title: string
  /** 이 챕터의 오디오 파트 수 */
  parts: number
  /** 첫 파트 archive.org URL (미리듣기) */
  url: string
}

export function LibriVoxAudioPanel({
  bookId,
  chapterCount,
  savedMode,
  savedMappedChapters,
  savedChapters,
}: {
  bookId: string
  /** 도서 텍스트 챕터 수 */
  chapterCount?: number | null
  /** 'chapter_parts'(다권 멀티파트) 또는 'flat'(1섹션=1챕터) 이면 매핑 연결됨 */
  savedMode?: string | null
  savedMappedChapters?: number | null
  /** 저장된 도서 챕터 ↔ 보이스 챕터 매핑 (정렬됨).
   *  chapter_parts 모드면 chapter_map 펼침, flat 모드면 sections[i] 1:1 */
  savedChapters?: SavedChapter[]
}) {
  const router = useRouter()
  // 'chapter_parts' = Roman 챕터 매핑(다권). 'flat' = 1섹션=1챕터 (Arabic 챕터·서술형 제목).
  // 둘 다 워크스페이스(pickChapterAudio)에서 정상 재생됨.
  const isChapterParts = savedMode === 'chapter_parts'
  const isFlat = savedMode === 'flat'
  const connected = isChapterParts || isFlat
  const mapped = savedMappedChapters ?? null
  const chapters = savedChapters ?? []

  const [busy, setBusy] = useState<null | 'build' | 'clear'>(null)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [showList, setShowList] = useState(false)

  // 미리듣기 (단일 audio 공유)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playingIdx, setPlayingIdx] = useState<number | null>(null)

  function togglePlay(ch: SavedChapter) {
    const el = audioRef.current
    if (!el || !ch.url) return
    if (playingIdx === ch.idx) {
      el.pause()
      return
    }
    el.src = ch.url
    void el.play().catch(() => {})
    setPlayingIdx(ch.idx)
  }

  async function connect() {
    setBusy('build')
    setError(null)
    setOkMsg(null)
    try {
      const res = await fetch('/api/admin/library/save-librivox-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: bookId, build_chapter_map: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message ?? `HTTP ${res.status}`)
      if (data?.ok) {
        setOkMsg(
          `${data.mapped_chapters}챕터 매핑됨` +
            (data.total_chapters != null ? ` (전체 ${data.total_chapters}장` : '') +
            (Array.isArray(data.excluded_idx) && data.excluded_idx.length > 0
              ? `, 간지/미주 ${data.excluded_idx.length}개 제외`
              : '') +
            (data.total_chapters != null ? ')' : ''),
        )
        router.refresh() // 서버에서 저장된 매핑 다시 읽어 목록 표시
      } else {
        setError(data?.reason ?? '매핑 실패 — LibriVox 낭독을 찾지 못했거나 챕터 수가 맞지 않습니다.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '매핑 실패')
    } finally {
      setBusy(null)
    }
  }

  async function disconnect() {
    setBusy('clear')
    setError(null)
    setOkMsg(null)
    try {
      const res = await fetch('/api/admin/library/save-librivox-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: bookId, clear: true }),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.message ?? `HTTP ${res.status}`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '해제 실패')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)]">
      <header className="flex flex-wrap items-center gap-2 px-5 py-3">
        <Headphones size={15} className="text-[var(--learn-review)]" aria-hidden />
        <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">
          LibriVox 보이스 — 챕터 매핑
        </h2>
        {connected && (
          <span
            className="inline-flex items-center gap-1 rounded-[var(--r-full)] px-2 py-1 font-display text-[10px] font-[700]"
            style={{ background: 'var(--learn-known-light)', color: 'var(--learn-known)' }}
          >
            <Check size={11} aria-hidden /> {mapped ?? chapters.length}챕터 연결됨
            <span className="ml-1 opacity-70">· {isChapterParts ? '다권 매핑' : '플랫'}</span>
          </span>
        )}
      </header>

      <div className="border-t border-[var(--bd)] px-5 py-4">
        {connected ? (
          // ── 연결됨 ──
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-body text-[12px] text-[var(--t2)]">
                도서 {chapterCount ?? chapters.length}챕터가 LibriVox 낭독과 챕터별로 매핑됨 —{' '}
                {isChapterParts
                  ? '다권 저작은 챕터 안에서 여러 파트를 순차 재생합니다.'
                  : '리더에서 챕터별 재생됩니다.'}
              </p>
              <button
                type="button"
                onClick={disconnect}
                disabled={busy != null}
                className="inline-flex shrink-0 items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg3)] hover:text-[var(--learn-error)] disabled:opacity-50"
              >
                {busy === 'clear' ? (
                  <Loader2 size={12} className="animate-spin" aria-hidden />
                ) : (
                  <Link2Off size={12} aria-hidden />
                )}
                연결 해제
              </button>
            </div>

            {chapters.length > 0 && (
              <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)]">
                <button
                  type="button"
                  onClick={() => setShowList((v) => !v)}
                  aria-expanded={showList}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left font-display text-[11px] font-[700] text-[var(--t2)] transition-colors hover:text-[var(--t1)]"
                >
                  {showList ? <ChevronDown size={13} aria-hidden /> : <ChevronRight size={13} aria-hidden />}
                  도서 챕터 ↔ 보이스 챕터 매핑 보기 ({chapters.length})
                </button>
                {showList && (
                  <ul className="max-h-[320px] divide-y divide-[var(--bd)]/50 overflow-y-auto px-1 pb-1">
                    {chapters.map((ch) => (
                      <li key={ch.idx} className="flex items-center gap-2 px-2 py-2">
                        <button
                          type="button"
                          onClick={() => togglePlay(ch)}
                          disabled={!ch.url}
                          aria-label={`${ch.idx}장 미리듣기`}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--learn-review-light)] text-[var(--learn-review)] transition-colors hover:bg-[var(--learn-review)] hover:text-white disabled:opacity-40"
                        >
                          {playingIdx === ch.idx ? <Pause size={11} aria-hidden /> : <Play size={11} className="ml-0.5" aria-hidden />}
                        </button>
                        <span className="w-12 shrink-0 font-mono text-[11px] font-[700] tabular-nums text-[var(--t1)]">
                          {ch.idx}장
                        </span>
                        <span className="shrink-0 text-[var(--t2)]" aria-hidden>→</span>
                        <span className="min-w-0 flex-1 truncate font-body text-[12px] text-[var(--t2)]">
                          {ch.title || `Chapter ${ch.roman}`}
                          {ch.parts > 1 && <span className="ml-1 text-[var(--t2)]">· {ch.parts}파트</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ) : (
          // ── 미연결 ──
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-body text-[12px] text-[var(--t2)]">
              이 도서를 LibriVox 낭독과 <strong className="text-[var(--t2)]">챕터별로 자동 연결</strong>합니다
              (섹션 제목의 챕터 번호 기준 · 다권이면 합쳐서).
            </p>
            <button
              type="button"
              onClick={connect}
              disabled={busy != null}
              className="inline-flex shrink-0 items-center gap-2 rounded-[var(--r-md)] px-4 py-2 font-display text-[12px] font-[700] text-white shadow-[var(--sh-sm)] transition-all hover:scale-[1.02] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: 'var(--learn-review)' }}
            >
              {busy === 'build' ? (
                <Loader2 size={12} className="animate-spin" aria-hidden />
              ) : (
                <BookOpen size={12} aria-hidden />
              )}
              챕터 매핑 연결
            </button>
          </div>
        )}

        {okMsg && (
          <p className="mt-2 font-body text-[11px] text-[var(--learn-known)]">✅ {okMsg}</p>
        )}
        {error && (
          <p className="mt-2 inline-flex items-center gap-1 font-body text-[11px] text-[var(--learn-error)]">
            <AlertCircle size={11} aria-hidden /> {error}
          </p>
        )}
      </div>

      {/* 미리듣기 공유 audio */}
      <audio
        ref={audioRef}
        preload="none"
        className="hidden"
        onPause={() => setPlayingIdx(null)}
        onEnded={() => setPlayingIdx(null)}
      />
    </section>
  )
}
