'use client'

// apps/web/src/components/video/ComponentVideo.tsx
//
// **구성요소 옆에 붙는 영상 한 편.**
//
// ── Calm UI 를 영상에 적용한다는 것 ──────────────────────────────
//  · **자동재생 없음.** 학습 화면에서 소리가 갑자기 나면 그건 방해다(철학 1).
//  · **반복 없음.** 끝나면 멈춘다 — 끝나는 상태가 있는 것만 허용(CLAUDE.md 모션 판정 기준).
//  · **포스터 먼저.** 진입 즉시 무거운 요청을 걸지 않는다(`preload="none"`).
//  · **자막 기본 켜짐.** 소리를 끄고 보는 사람이 다수다.
//  · 재생 버튼은 **44px 이상** — 터치 타깃 하한.
//
// 발행 전(=`baseUrl` 없음)에는 **아무것도 그리지 않는다**(`videoById` 가 null 을 준다).
// "영상 준비 중" 자리를 만들지 않는 이유: 지키지 못할 약속을 화면에 두지 않는다.

import { useCallback, useRef, useState } from 'react'
import { Play } from 'lucide-react'

import { track } from '@/lib/analytics/client'
import type { ResolvedVideo } from '@/lib/video/catalog'

export interface ComponentVideoProps {
  video: ResolvedVideo | null
  /** 좁은 자리에 넣을 때. 기본은 본문 폭을 채운다. */
  maxWidth?: number
  className?: string
}

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function ComponentVideo({ video, maxWidth, className }: ComponentVideoProps) {
  const ref = useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = useState(false)
  // 시작 이벤트는 **한 번만** 보낸다 — 일시정지 후 재생마다 세면 분모가 부풀어
  // 완주율이 거짓으로 낮아진다.
  const startedRef = useRef(false)

  const onPlay = useCallback(() => {
    setPlaying(true)
    if (!video || startedRef.current) return
    startedRef.current = true
    track({
      name: 'video_started',
      props: { kind: video.kind, format: video.format, seconds: Math.round(video.seconds) },
    })
  }, [video])

  const onEnded = useCallback(() => {
    setPlaying(false)
    if (!video) return
    track({
      name: 'video_completed',
      props: { kind: video.kind, format: video.format, seconds: Math.round(video.seconds) },
    })
  }, [video])

  if (!video) return null

  const start = () => {
    const el = ref.current
    if (!el) return
    void el.play()
  }

  return (
    <figure
      className={`m-0 ${className ?? ''}`}
      style={{ maxWidth: maxWidth ? `${maxWidth}px` : undefined }}
    >
      <div
        className="relative overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)]"
        style={{ aspectRatio: `${video.width} / ${video.height}` }}
      >
        <video
          ref={ref}
          src={video.src}
          poster={video.poster}
          controls={playing}
          preload="none"
          playsInline
          onPlay={onPlay}
          onPause={() => setPlaying(false)}
          onEnded={onEnded}
          className="h-full w-full"
        >
          <track kind="captions" srcLang="ko" label="한국어" src={video.captions} default />
        </video>

        {/* 재생 전에는 덮개 버튼 하나만 — 컨트롤 바가 포스터를 가리지 않는다. */}
        {!playing && (
          <button
            type="button"
            onClick={start}
            aria-label={`${video.title} 영상 재생 · ${mmss(video.seconds)}`}
            className="group absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--bg)_18%,transparent)] transition-colors duration-[var(--dur-normal)] hover:bg-[color-mix(in_srgb,var(--bg)_8%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
          >
            <span className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[var(--p)] text-[var(--ti)] shadow-[var(--sh-md)] transition-transform duration-[var(--dur-normal)] ease-[var(--ease)] group-hover:scale-105 group-active:scale-95">
              <Play size={26} aria-hidden />
            </span>
          </button>
        )}

        {/* 길이는 늘 보인다 — "얼마나 걸리나" 를 모르면 안 누른다. */}
        <span className="pointer-events-none absolute bottom-2 right-2 rounded-[var(--r-sm)] bg-[color-mix(in_srgb,var(--t1)_72%,transparent)] px-2 py-0.5 font-mono text-[12px] tabular-nums text-[var(--ti)]">
          {mmss(video.seconds)}
        </span>
      </div>

      <figcaption className="mt-2 break-keep text-[13px] leading-relaxed text-[var(--t3)]">
        {video.subtitle}
      </figcaption>
    </figure>
  )
}
