'use client'

// apps/web/src/components/video/ComponentVideo.tsx
//
// **구성요소 옆에 붙는 영상 한 편.**
//
// ── Calm UI 를 영상에 적용한다는 것 ──────────────────────────────
//  · **자동재생 없음.** 학습 화면에서 소리가 갑자기 나면 그건 방해다(철학 1).
//  · **반복 없음.** 끝나면 멈춘다 — 끝나는 상태가 있는 것만 허용(CLAUDE.md 모션 판정 기준).
//  · **자막 기본 켜짐.** 소리를 끄고 보는 사람이 다수다.
//  · 재생 버튼은 **44px 이상** — 터치 타깃 하한.
//
// ── 누르기 전에는 `<video>` 자체가 없다 ─────────────────────────
// `/video` 서가에는 62편이 한 화면에 깔린다. `<video poster=…>` 를 62개 두면
// **포스터 62장이 한꺼번에** 내려온다(`preload="none"` 은 영상 본체만 막고 포스터는 못 막는다).
// 그래서 누르기 전에는 `<img loading="lazy">` 한 장이고, 누른 뒤에야 플레이어가 붙는다.
// 화면에 안 보이는 카드는 **아무것도 내려받지 않는다.**
//
// 발행 전(=`baseUrl` 없음)에는 **아무것도 그리지 않는다**(`videoById` 가 null 을 준다).
// "영상 준비 중" 자리를 만들지 않는 이유: 지키지 못할 약속을 화면에 두지 않는다.

import { useCallback, useEffect, useRef, useState } from 'react'
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
  /** 눌렀는가 — 누르기 전에는 플레이어를 만들지 않는다. */
  const [activated, setActivated] = useState(false)
  // 시작 이벤트는 **한 번만** 보낸다 — 일시정지 후 재생마다 세면 분모가 부풀어
  // 완주율이 거짓으로 낮아진다.
  const startedRef = useRef(false)

  // 붙자마자 재생한다. 이건 자동재생이 아니다 — **사람이 누른 결과**다.
  useEffect(() => {
    if (activated) void ref.current?.play()
  }, [activated])

  const onPlay = useCallback(() => {
    if (!video || startedRef.current) return
    startedRef.current = true
    track({
      name: 'video_started',
      props: {
        kind: video.kind,
        format: video.format,
        seconds: Math.round(video.seconds),
        videoId: video.id,
      },
    })
  }, [video])

  const onEnded = useCallback(() => {
    if (!video) return
    track({
      name: 'video_completed',
      props: {
        kind: video.kind,
        format: video.format,
        seconds: Math.round(video.seconds),
        videoId: video.id,
      },
    })
  }, [video])

  if (!video) return null

  return (
    <figure
      className={`m-0 ${className ?? ''}`}
      style={{ maxWidth: maxWidth ? `${maxWidth}px` : undefined }}
    >
      <div
        className="relative overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)]"
        style={{ aspectRatio: `${video.width} / ${video.height}` }}
      >
        {activated ? (
          <video
            ref={ref}
            src={video.src}
            poster={video.poster}
            controls
            playsInline
            onPlay={onPlay}
            onEnded={onEnded}
            className="h-full w-full"
          >
            {/*
              ⚠️ **`default` 를 걸지 않는다.** 우리 영상에는 자막이 **화면에 구워져 있다**
                (소리 끈 채로 피드에서 보는 사람에게 닿아야 해서). 거기에 브라우저 자막까지
                기본으로 켜면 같은 글이 아래쪽 같은 자리에 **두 번** 그려진다.
                트랙 자체는 남긴다 — 켜고 싶은 사람이 켤 수 있고, YouTube 업로드와
                크롤러가 이 파일을 읽는다. 글로 읽을 것은 편별 페이지의 자막 전문이 서버 렌더로 낸다.
            */}
            <track kind="captions" srcLang="ko" label="한국어" src={video.captions} />
          </video>
        ) : (
          <button
            type="button"
            onClick={() => setActivated(true)}
            aria-label={`${video.title} 영상 재생 · ${mmss(video.seconds)}`}
            className="group absolute inset-0 block h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--p)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- 외부 스토리지 URL · 리사이즈 불필요(이미 규격 고정) */}
            <img
              src={video.poster}
              alt=""
              loading="lazy"
              decoding="async"
              width={video.width}
              height={video.height}
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--bg)_18%,transparent)] transition-colors duration-[var(--dur-normal)] group-hover:bg-[color-mix(in_srgb,var(--bg)_8%,transparent)]">
              <span className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[var(--p)] text-[var(--ti)] shadow-[var(--sh-md)] transition-transform duration-[var(--dur-normal)] ease-[var(--ease)] group-hover:scale-105 group-active:scale-95">
                <Play size={26} aria-hidden />
              </span>
            </span>
          </button>
        )}

        {/* 길이는 누르기 전에 보인다 — "얼마나 걸리나" 를 모르면 안 누른다. */}
        {!activated && (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded-[var(--r-sm)] bg-[color-mix(in_srgb,var(--t1)_72%,transparent)] px-2 py-0.5 font-mono text-[12px] tabular-nums text-[var(--ti)]">
            {mmss(video.seconds)}
          </span>
        )}
      </div>

      <figcaption className="mt-2 break-keep text-[13px] leading-relaxed text-[var(--t3)]">
        {video.subtitle}
      </figcaption>
    </figure>
  )
}
