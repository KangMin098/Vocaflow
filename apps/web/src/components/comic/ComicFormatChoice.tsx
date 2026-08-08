// apps/web/src/components/comic/ComicFormatChoice.tsx
//
// 포맷 선택 — "같은 책, 어느 입구로 들어갈까" (만화 / 원문 / 들으며 읽기).
// 설계: docs/CCP_LIBRARY_INTEGRATION.md §5.2·§5.3 · D5.
//   · 권장 1개만 gold 테두리 + "지금 추천" — 나머지도 동등하게 고를 수 있다(강제 이동 없음).
//   · 미등록 학습자가 '만화로 읽기'를 누르면 enroll_library_book(멱등) 후 리더로 (D4).
//   · 비로그인은 로그인으로 보내되 next 로 되돌아온다.
// Calm UI: 폭죽 없음 · 상태 변화는 문구로만 · reduced-motion 대응.

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookImage, BookOpen, Headphones } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { enrollBook } from '@/lib/library/enroll'
import type { FormatKey, Prescription } from '@/lib/comic/prescribe'

const ON_GOLD = '#231a09'

export interface ComicFormatChoiceProps {
  bookId: string
  /** 등록 학습자의 만화 리더 경로 (미등록이면 null → 등록 후 이동) */
  comicHref: string | null
  /** 등록 학습자의 본문 경로 (미등록이면 null → 도서 상세) */
  textHref: string | null
  /** 등록 학습자의 듣기 경로 (미등록/낭독 없음이면 null) */
  audioHref: string | null
  hasAudio: boolean
  isLoggedIn: boolean
  enrolled: boolean
  /** 만화 컷 수 · 챕터 수 · 원문 예상 시간 — 비교 정보 */
  panelsTotal: number
  chapterCount: number | null
  readingMinutes: number | null
  prescription: Prescription
}

export function ComicFormatChoice({
  bookId,
  comicHref,
  textHref,
  audioHref,
  hasAudio,
  isLoggedIn,
  enrolled,
  panelsTotal,
  chapterCount,
  readingMinutes,
  prescription,
}: ComicFormatChoiceProps) {
  const router = useRouter()
  const [busy, setBusy] = useState<FormatKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loginHref = `/login?next=${encodeURIComponent(`/comics/book/${bookId}`)}`

  /** 미등록 학습자 진입 — 등록(멱등) 후 해당 포맷으로. 실패해도 차분히 안내. */
  async function enrollAndGo(target: FormatKey) {
    setBusy(target)
    setError(null)
    try {
      const ids = await enrollBook(createClient(), bookId)
      const first = ids[0]
      router.push(
        target === 'comic'
          ? `/text/${first}/comic`
          : target === 'audio'
            ? `/text/${first}?mode=listen`
            : `/text/${first}?mode=read`,
      )
    } catch {
      setBusy(null)
      setError('지금은 시작할 수 없었어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  const cards: Array<{
    key: FormatKey
    icon: typeof BookImage
    title: string
    meta: string
    body: string
    href: string | null
    show: boolean
  }> = [
    {
      key: 'comic',
      icon: BookImage,
      title: '만화로 먼저',
      meta: panelsTotal > 0 ? `${panelsTotal}컷` : '만화',
      body: '그림으로 줄거리를 먼저 잡아요',
      href: enrolled ? comicHref : null,
      show: true,
    },
    {
      key: 'text',
      icon: BookOpen,
      title: '원문으로 읽기',
      meta: [
        chapterCount ? `${chapterCount}챕터` : null,
        readingMinutes ? `약 ${formatMinutes(readingMinutes)}` : null,
      ]
        .filter(Boolean)
        .join(' · ') || '정본 텍스트',
      body: '작가의 문장을 그대로 읽어요',
      href: enrolled ? textHref : null,
      show: true,
    },
    {
      key: 'audio',
      icon: Headphones,
      title: '들으며 읽기',
      meta: '원어민 낭독',
      body: '귀와 눈을 함께 써요',
      href: enrolled ? audioHref : null,
      show: hasAudio,
    },
  ]

  return (
    <section aria-label="학습 방식 선택" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-2 px-1">
        <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">어떻게 읽을까요?</h2>
        <p className="font-body text-[12.5px] text-[var(--t2)]">
          {prescription.reason}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards
          .filter((c) => c.show)
          .map((c) => {
            const recommended = prescription.pick === c.key
            const Icon = c.icon
            const inner = (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-display text-[15px] font-[800] text-[var(--t1)]">
                    <Icon size={16} aria-hidden style={{ color: recommended ? 'var(--active)' : 'var(--t3)' }} />
                    {c.title}
                  </span>
                  {recommended && (
                    <span
                      className="shrink-0 rounded-[var(--r-full)] px-2 py-0.5 font-display text-[10px] font-[800]"
                      style={{ background: 'var(--active)', color: ON_GOLD }}
                    >
                      지금 추천
                    </span>
                  )}
                </div>
                <span className="font-mono text-[11.5px] tabular-nums text-[var(--t3)]">{c.meta}</span>
                <p className="font-body text-[13px] text-[var(--t2)]">{c.body}</p>
                <span className="mt-auto pt-1 font-display text-[13px] font-[700] text-[var(--p)]">
                  {busy === c.key ? '준비 중…' : enrolled ? '시작하기 →' : isLoggedIn ? '시작하기 →' : '로그인하고 시작 →'}
                </span>
              </>
            )

            const cls = `flex h-full min-h-[150px] flex-col gap-1.5 rounded-[var(--r-lg)] border-2 bg-[var(--bg)] p-4 text-left shadow-[var(--sh-sm)] transition-[transform,box-shadow,border-color] duration-[var(--dur-normal)] ease-[var(--ease)] hover:-translate-y-0.5 hover:shadow-[var(--sh-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]/40 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
              recommended ? 'border-[var(--active)]' : 'border-[var(--bd)] hover:border-[var(--t3)]'
            }`

            // 등록 학습자 = 곧장 이동(Link) · 미등록 = 등록 후 이동(button) · 비로그인 = 로그인(Link)
            if (c.href) {
              return (
                <Link key={c.key} href={c.href} className={cls}>
                  {inner}
                </Link>
              )
            }
            if (!isLoggedIn) {
              return (
                <Link key={c.key} href={loginHref} className={cls}>
                  {inner}
                </Link>
              )
            }
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => enrollAndGo(c.key)}
                disabled={busy !== null}
                className={cls}
              >
                {inner}
              </button>
            )
          })}
      </div>

      {error && (
        <p role="alert" className="px-1 font-body text-[12.5px] text-[var(--error)]">
          {error}
        </p>
      )}

      {!enrolled && isLoggedIn && (
        <p className="px-1 font-body text-[12px] text-[var(--t3)]">
          시작하면 이 책이 내 학습에 추가되고, 챕터별 단어장도 함께 준비돼요.
        </p>
      )}
    </section>
  )
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min}분`
  const h = Math.round(min / 60)
  return `${h}시간`
}
