// apps/web/src/components/library/vocab/SubscribeSuccessToast.tsx
//
// 구독 직후 결과 토스트.
// - 이번에 담은 수 / 세트 전체 / 이미 보유 분기 안내
// - "내 단어장에서 보기" → /wordvault 직행
// - 5초 자동 소멸 + 수동 닫기
//
// v06.35 — 구독이 세트 전량을 담지 않게 되면서(actions.ts 참조) "N개 추가" 만 말하면
//   학습자가 "300개 세트인데 왜 18개?" 로 읽는다. 담은 수가 세트보다 적을 때는
//   **왜 적은지와 나머지는 어떻게 되는지**를 함께 말한다 — 숫자만 던지면 누락으로 보인다.
//
// ── 글자색이 왜 상수가 아니라 토큰인가 (실측 2026-09-05) ─────────────────
// 면(`--success-light`)은 토큰인데 잉크만 라이트 전용 상수 `#065f46` 이었다. 다크에서
// `--success-light` 는 `rgba(91,164,125,0.18)` 이고 그 아래 `--bg` 가 `#231D17` 이라
// 실효 배경이 약 `#2B2D24` 인데, 거기에 `#065f46` 을 얹으면 **약 1.7:1** 이다 —
// 구독이 됐다는 유일한 신호가 다크 테마에서 거의 안 보였다.
// `--success-ink` 는 정확히 이 자리를 위해 있는 토큰이다(다크 `#7FC49E` 6.23:1 ·
// 라이트 `#1F6B49` 5.43:1 — 양쪽 AA 통과). 알파 변주(`/90`·`/70`)도 함께 뺀다:
// Tailwind 는 `var()` 색에 불투명도 수식어를 적용하지 못해 값이 조용히 죽는다.

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { ArrowRight, CheckCircle2, X } from 'lucide-react'

export interface SubscribeToastData {
  setTitle: string
  importedCount: number
  alreadyOwnedCount: number
  totalWords: number
}

interface Props {
  data: SubscribeToastData | null
  onClose: () => void
}

export function SubscribeSuccessToast({ data, onClose }: Props) {
  const pathname = usePathname()
  // /wordvault/browse 는 풀스크린 세션 — ?from 으로 닫기 시 이 페이지(공용 단어장)로 복귀.
  const browseHref = `/wordvault/browse?from=${encodeURIComponent(pathname || '/library/vocab')}`

  useEffect(() => {
    if (!data) return
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [data, onClose])

  if (!data) return null

  // 담은 수가 세트 전체보다 적으면 = 시작 분량만 담은 것. 나머지는 읽으면서 채워진다.
  const partial = data.importedCount > 0 && data.totalWords > data.importedCount + data.alreadyOwnedCount

  const body =
    data.totalWords === 0
      ? '단어가 없는 세트예요'
      : data.importedCount === 0
        ? data.alreadyOwnedCount > 0
          ? `${data.alreadyOwnedCount.toLocaleString()}개 모두 이미 가지고 있어요`
          : '이미 다 담겨 있어요'
        : partial
          ? `${data.importedCount.toLocaleString()}개로 시작해요 · 나머지는 읽으면서 채워집니다 (전체 ${data.totalWords.toLocaleString()}개)`
          : data.alreadyOwnedCount === 0
            ? `${data.importedCount.toLocaleString()}개 단어가 추가됐어요`
            : `새 단어 ${data.importedCount.toLocaleString()}개 추가 · 이미 보유 ${data.alreadyOwnedCount.toLocaleString()}개 건너뜀`

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-[60] flex w-[min(440px,calc(100vw-32px))] -translate-x-1/2 items-start gap-3 rounded-[var(--r-lg)] border-l-[3.5px] border-[var(--success)] bg-[var(--success-light)] px-4 py-3 shadow-[var(--sh-lg)]"
    >
      <CheckCircle2 size={20} className="shrink-0 text-[var(--success)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-display text-[13px] font-[700] text-[var(--success-ink)]">
          {data.setTitle} 추가 완료
        </p>
        <p className="mt-0.5 font-body text-[12px] text-[var(--success-ink)]">{body}</p>
        {data.importedCount > 0 && (
          <Link
            href={browseHref}
            className="mt-2 inline-flex items-center gap-1 font-display text-[12px] font-[700] text-[var(--success-ink)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--success)] focus-visible:ring-offset-1"
          >
            내 단어장에서 보기
            <ArrowRight size={12} aria-hidden />
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--r-full)] text-[var(--success-ink)] transition-colors hover:bg-[var(--success)]/15 hover:text-[var(--success-ink)]"
        aria-label="알림 닫기"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  )
}
