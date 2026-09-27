// apps/web/src/components/library/textbooks/SeriesTabs.tsx
//
// **시리즈를 고르는 자리** — 서점의 코너 표지판.
//
// ── 왜 필요한가 (실측 2026-09-12) ────────────────────────────────────
// 시리즈 셋(독해·어휘·구문)이 정의되고, 권의 주소에 시리즈가 들어가고
// (`/library/textbooks/[series]/[step]`), 매대 함수가 시리즈를 읽게 됐는데 —
// **화면에서 찾아갈 길이 없었다.** 주소를 직접 타야 어휘 서가에 갈 수 있었다.
// 있는 것을 못 찾으면 없는 것과 같다.
//
// ── 왜 링크인가 (탭이 아니라) ────────────────────────────────────────
// 각 시리즈는 **자기 주소를 가진 서가**다. 클라이언트 상태로 전환하면 그 서가를 공유·북마크할
// 수 없고, 뒤로가기가 코너를 안 되돌린다. 시중에서 「어휘 코너」는 장소다 — 상태가 아니다.
//
// ── 「인쇄본 준비 중」은 상수가 아니라 실측이다 (고침 2026-09-23 · DD-76) ─────────
// 이 칩은 카탈로그의 `status: 'draft'` 상수를 읽고 있었다. 그런데 그 상수는 시리즈를
// 정의한 날의 값이라 **찍은 뒤에도 안 바뀐다** — 어휘·구문은 2026-09-06 에 각 6권이
// 조판돼 `textbook_volume_renders.status='published'` 로 들어갔고 DD-73 이 목차까지
// 구웠는데, 이 공개 화면은 그 뒤로도 **「인쇄본 준비 중」을 찍고 있었다**(17일).
//
// 그래서 목차 스냅샷에서 읽는다 — 학습자가 실제로 받는 인쇄물이 그것이다.
// 스냅샷에 그 시리즈가 하나도 없으면 진짜로 인쇄본이 없다. 새 시리즈가 생기면 구울
// 때까지 자동으로 「준비 중」이고, 구우면 자동으로 사라진다 — 고칠 상수가 없다.

import Link from 'next/link'

import { SERIES_CATALOG } from '@vocaflow/library-pipeline/textbook-series-catalog'

import { seriesHasContents } from '@/lib/textbook/volume-contents'

/** 그 시리즈 서가의 주소. 독해도 자기 주소를 갖는다 — 특별 대우하면 링크가 갈린다. */
export function seriesShelfHref(seriesId: string): string {
  return `/library/textbooks/${seriesId}`
}

export function SeriesTabs({ current }: { current: string }) {
  return (
    <nav
      aria-label="교재 시리즈"
      className="flex flex-wrap items-stretch gap-2 rounded-ios-2xl bg-[var(--bg)] px-3 py-3 shadow-ios-2 md:px-5"
    >
      {SERIES_CATALOG.map((s) => {
        const active = s.id === current
        // 접은 시리즈는 매대에 안 올린다 — 못 사는 코너를 표지판에 남기면 거짓이 된다.
        if (s.intent === 'retired') return null
        const printable = seriesHasContents(s.id)
        return (
          <Link
            key={s.id}
            href={seriesShelfHref(s.id)}
            // 지금 보고 있는 코너를 스크린리더도 알아야 한다.
            aria-current={active ? 'page' : undefined}
            className={[
              'group flex min-h-[44px] min-w-0 flex-1 flex-col justify-center gap-0.5 rounded-ios-xl px-3 py-2 no-underline',
              'motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
              active
                ? 'bg-[var(--p)] text-[var(--on-p)]'
                : 'bg-[var(--bg2)] text-[var(--t1)] hover:bg-[var(--bd)] active:bg-[var(--bd)]',
            ].join(' ')}
          >
            <span className="truncate font-display text-[13px] font-[700]">{s.brand}</span>
            {/* 이 시리즈가 답하는 물음 — 카탈로그가 소유한다. 화면에서 짓지 않는다. */}
            <span
              className={[
                'truncate font-body text-[11px] leading-[1.5] [word-break:keep-all]',
                active ? 'text-[var(--on-p)]/80' : 'text-[var(--t2)]',
              ].join(' ')}
            >
              {s.question}
            </span>
            {/* ⚠️ 조판된 권이 없는 시리즈는 그렇다고 적는다 — 문항은 풀 수 있지만 인쇄본이 없다. */}
            {!printable && (
              <span
                className={[
                  'truncate font-mono text-[10px]',
                  active ? 'text-[var(--on-p)]/70' : 'text-[var(--t3)]',
                ].join(' ')}
              >
                인쇄본 준비 중
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
