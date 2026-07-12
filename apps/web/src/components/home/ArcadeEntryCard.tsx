// apps/web/src/components/home/ArcadeEntryCard.tsx
// 허브 → 아케이드 진입 카드. 황혼 갤러리 무드(아케이드 아이덴티티) 배너 + 컨트롤러 마크 + CTA.
// Calm UI — 강조는 그라디언트 하나, 나머지는 조용히.

import Link from 'next/link';

export function ArcadeEntryCard() {
  return (
    <Link
      href="/arcade"
      aria-label="아케이드 — 단어 게임 12종"
      className="group relative flex items-center gap-4 overflow-hidden rounded-[var(--r-lg)] px-5 py-4 transition-transform duration-[var(--dur-normal)] ease-[var(--ease)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2"
      style={{
        background: 'linear-gradient(120deg, #2b1d3e 0%, #3a2450 42%, #4a2740 100%)',
        boxShadow: 'var(--sh-md)',
      }}
    >
      {/* 앰비언트 글로우 */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-80 transition-opacity duration-[var(--dur-normal)] group-hover:opacity-100"
        style={{ background: 'radial-gradient(60% 120% at 12% 0%, rgba(255,180,132,.18), transparent 60%), radial-gradient(60% 120% at 100% 100%, rgba(180,120,255,.2), transparent 60%)' }}
      />
      {/* 컨트롤러 마크 */}
      <span
        className="relative grid h-11 w-11 shrink-0 place-items-center rounded-[12px]"
        style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.22)', color: '#F1E6DE' }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 32 32" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="10" width="24" height="12.5" rx="6.25" />
          <path d="M10 14v4.5M7.75 16.25h4.5" />
          <circle cx="21.5" cy="15" r="1.35" fill="currentColor" stroke="none" />
          <circle cx="24.5" cy="18" r="1.35" fill="currentColor" stroke="none" />
        </svg>
      </span>
      {/* 텍스트 */}
      <span className="relative min-w-0 flex-1">
        <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'rgba(255,225,200,.66)' }}>
          Arcade · 단어 게임
        </span>
        <span className="mt-0.5 block font-display text-[17px] font-extrabold" style={{ color: '#FBF3EC' }}>
          아케이드
        </span>
        <span className="mt-0.5 block truncate text-[12.5px]" style={{ color: 'rgba(246,232,224,.72)' }}>
          14개 세계에서 단어를 놀이로 — 해독 · 추리 · 탐사
        </span>
      </span>
      {/* CTA */}
      <span className="relative inline-flex shrink-0 items-center gap-1 font-display text-[13px] font-bold" style={{ color: '#FBF3EC' }}>
        플레이
        <span className="inline-block transition-transform duration-[var(--dur-normal)] group-hover:translate-x-0.5">→</span>
      </span>
    </Link>
  );
}
