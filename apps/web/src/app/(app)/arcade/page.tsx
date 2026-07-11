// apps/web/src/app/(app)/arcade/page.tsx — /arcade
// 아케이드 스위트 허브 — 6종 단어 게임 진입점. 세계적 게임 메커닉 리서치 기반.

import Link from 'next/link';

interface GameCard {
  slug: string; name: string; emoji: string; tagline: string;
  layer: string; ref: string; accent: string;
}

const GAMES: GameCard[] = [
  { slug: 'daily-blitz', name: 'Daily Blitz', emoji: '📅', tagline: '매일 새로운 10단어 챌린지 · 스트릭', layer: '리텐션', ref: 'Wordle', accent: 'var(--streak)' },
  { slug: 'letter-forge', name: 'Letter Forge', emoji: '🔤', tagline: '흩어진 글자로 철자를 조립', layer: 'L4b 생성', ref: '애너그램', accent: 'var(--combo)' },
  { slug: 'cascade', name: 'Cascade', emoji: '🌊', tagline: '단어↔뜻 짝을 이어 지우는 낙하 보드', layer: 'L4a 재인', accent: 'var(--success)', ref: 'Match-3' },
  { slug: 'connections', name: 'Connections', emoji: '🧩', tagline: '16단어를 숨은 4개 의미 그룹으로', layer: 'L5 관계', ref: 'NYT Connections', accent: 'var(--active)' },
  { slug: 'word-economy', name: 'Word Economy', emoji: '🪙', tagline: '코인 벌어 파워업에 전략 투자', layer: 'L4a 전략', ref: 'Gimkit', accent: '#B06C1E' },
  { slug: 'ghost-race', name: 'Ghost Race', emoji: '🏁', tagline: '유령과 속도 대결 · 리그 승급', layer: 'L4a 경쟁', ref: 'Kahoot·리그', accent: '#217C8E' },
];

export default function ArcadePage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
      <header className="mb-8">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--t3)' }}>
          Arcade · 단어 게임
        </p>
        <h1 className="mt-2 font-display text-[28px] font-extrabold sm:text-[34px]" style={{ color: 'var(--t1)' }}>
          아케이드
        </h1>
        <p className="mt-2 max-w-[52ch] text-[15px]" style={{ color: 'var(--t2)' }}>
          세계적 게임 메커닉을 단어 학습으로. 원하는 방식으로 인출·자동화·의미 연결을 훈련하세요.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((g) => (
          <Link
            key={g.slug}
            href={`/play/${g.slug}?from=/arcade`}
            className="group relative flex flex-col gap-3 overflow-hidden rounded-[var(--r-lg)] border p-5 transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2"
            style={{
              background: 'var(--bg)',
              borderColor: 'var(--bd)',
              boxShadow: 'var(--sh-sm)',
            }}
          >
            <span
              className="absolute inset-x-0 top-0 h-1"
              style={{ background: g.accent }}
              aria-hidden="true"
            />
            <div className="flex items-center justify-between">
              <span className="text-[30px] leading-none" aria-hidden="true">{g.emoji}</span>
              <span
                className="rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider"
                style={{ background: 'var(--bg2)', color: g.accent }}
              >
                {g.layer}
              </span>
            </div>
            <div>
              <h2 className="font-display text-[19px] font-extrabold" style={{ color: 'var(--t1)' }}>
                {g.name}
              </h2>
              <p className="mt-1 text-[13.5px] leading-snug" style={{ color: 'var(--t2)' }}>
                {g.tagline}
              </p>
            </div>
            <div className="mt-auto flex items-center justify-between pt-1">
              <span className="font-mono text-[11px]" style={{ color: 'var(--t3)' }}>ref · {g.ref}</span>
              <span
                className="inline-flex items-center gap-1 font-display text-[13px] font-bold transition-transform group-hover:translate-x-0.5"
                style={{ color: g.accent }}
              >
                플레이 →
              </span>
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-8 text-[12.5px]" style={{ color: 'var(--t3)' }}>
        모든 게임은 학습 기록(FSRS)과 연동됩니다. 단어장·스크립트에서 <code className="font-mono">?set=</code>/<code className="font-mono">?text=</code>로 진입하면 해당 자료의 단어로 플레이합니다.
      </p>
    </div>
  );
}
