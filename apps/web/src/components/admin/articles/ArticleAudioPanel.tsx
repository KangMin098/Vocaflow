// apps/web/src/components/admin/articles/ArticleAudioPanel.tsx
//
// 글 보이스 연결 (책 LibriVoxAudioPanel 미러).
//   책: 도서 챕터 ↔ LibriVox 섹션 매핑(다단계). 글: 단일 섹션이라 오디오 URL 1개를
//   검증/교체/해제. VOA 등 소스는 ingest 시 audio_url 을 이미 채움 → 큐레이터는 검증·미리듣기.
//   set/clear 는 /api/acp/set-audio (service-role) 호출 후 router.refresh.

'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Check,
  Headphones,
  Link2,
  Link2Off,
  Loader2,
  Pause,
  Play,
} from 'lucide-react'

interface Props {
  articleId: string
  audioUrl: string | null
  source: string
}

export function ArticleAudioPanel({ articleId, audioUrl, source }: Props) {
  const router = useRouter()
  const connected = !!audioUrl && audioUrl.trim().length > 0

  const [busy, setBusy] = useState<null | 'set' | 'clear'>(null)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [input, setInput] = useState('')

  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)

  function togglePlay() {
    const el = audioRef.current
    if (!el || !audioUrl) return
    if (playing) {
      el.pause()
      return
    }
    el.src = audioUrl
    void el.play().catch(() => setError('미리듣기 재생 실패 — URL 접근 불가일 수 있어요'))
    setPlaying(true)
  }

  async function call(nextUrl: string | null, kind: 'set' | 'clear') {
    setBusy(kind)
    setError(null)
    setOkMsg(null)
    try {
      const res = await fetch('/api/acp/set-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: articleId, audio_url: nextUrl }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setOkMsg(kind === 'clear' ? '보이스 연결을 해제했어요' : '보이스를 연결했어요')
      setInput('')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '요청 실패')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)]">
      <header className="flex flex-wrap items-center gap-2 px-5 py-3">
        <Headphones size={15} className="text-[var(--learn-review)]" aria-hidden />
        <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">보이스 연결</h2>
        {connected && (
          <span
            className="inline-flex items-center gap-1 rounded-[var(--r-full)] px-2 py-0.5 font-display text-[10px] font-[700]"
            style={{ background: 'var(--learn-known-light)', color: 'var(--learn-known)' }}
          >
            <Check size={11} aria-hidden /> 연결됨
            <span className="ml-1 font-mono uppercase opacity-70">{source}</span>
          </span>
        )}
      </header>

      <div className="border-t border-[var(--bd)] px-5 py-4">
        {connected ? (
          // ── 연결됨 ──
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                aria-label="보이스 미리듣기"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--learn-review-light)] text-[var(--learn-review)] transition-colors hover:bg-[var(--learn-review)] hover:text-white"
              >
                {playing ? <Pause size={13} aria-hidden /> : <Play size={13} className="ml-0.5" aria-hidden />}
              </button>
              <a
                href={audioUrl!}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--p)] hover:underline"
                title={audioUrl!}
              >
                {audioUrl}
              </a>
              <button
                type="button"
                onClick={() => call(null, 'clear')}
                disabled={busy != null}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-1.5 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--learn-error)] disabled:opacity-50"
              >
                {busy === 'clear' ? (
                  <Loader2 size={12} className="animate-spin" aria-hidden />
                ) : (
                  <Link2Off size={12} aria-hidden />
                )}
                연결 해제
              </button>
            </div>
            <p className="font-body text-[11px] text-[var(--t2)]">
              소스가 제공한 원어민 낭독 — 학습자 스크립트 재생에 사용됩니다 (단일 스트림 · 문장 단위 듣기는 브라우저 TTS).
            </p>
          </div>
        ) : (
          // ── 미연결 ──
          <div className="flex flex-col gap-2.5">
            <p className="font-body text-[12px] text-[var(--t2)]">
              이 글에 연결된 보이스가 없어요. 소스(VOA 등)의 오디오 URL 을 직접 연결할 수 있어요.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="url"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="https://… (mp3 등 오디오 URL)"
                className="min-w-0 flex-1 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-mono text-[12px] text-[var(--t1)] placeholder:text-[var(--t2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
              />
              <button
                type="button"
                onClick={() => call(input, 'set')}
                disabled={busy != null || input.trim().length === 0}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--r-md)] px-3.5 py-2 font-display text-[12px] font-[700] text-white shadow-[var(--sh-sm)] transition-all hover:scale-[1.02] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: 'var(--learn-review)' }}
              >
                {busy === 'set' ? (
                  <Loader2 size={12} className="animate-spin" aria-hidden />
                ) : (
                  <Link2 size={12} aria-hidden />
                )}
                연결
              </button>
            </div>
          </div>
        )}

        {okMsg && <p className="mt-2 font-body text-[11px] text-[var(--learn-known)]">✅ {okMsg}</p>}
        {error && (
          <p className="mt-2 inline-flex items-center gap-1 font-body text-[11px] text-[var(--learn-error)]">
            <AlertCircle size={11} aria-hidden /> {error}
          </p>
        )}
      </div>

      <audio
        ref={audioRef}
        preload="none"
        className="hidden"
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </section>
  )
}
