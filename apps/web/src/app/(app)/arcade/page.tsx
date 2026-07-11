// apps/web/src/app/(app)/arcade/page.tsx — /arcade
// 아케이드 허브 — 황혼 갤러리 + 게임별 무드 포탈(스테인드글라스). 분위기 배경·깊이·SVG 마크.
// 아트 디렉션: 각 게임이 고유 무드로 빛나는 창. 이모지 제거, 일관된 라인 마크.

import Link from 'next/link';
import type { ReactNode } from 'react';

interface GameCard {
  slug: string; name: string; tagline: string; layer: string; ref: string;
  a: string; b: string; glow: string; accent: string; mark: ReactNode;
}

// ─── 게임별 무드(그라디언트 a→b · 앰비언트 글로우 · 악센트) + 라인 마크 ───
const M = (d: ReactNode) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const GAMES: GameCard[] = [
  { slug: 'glyph-tongue', name: 'The Glyph Tongue', tagline: '뜻을 주지 않는다 — 문맥으로 룬을 해독', layer: 'L2 해독', ref: 'Chants of Sennaar',
    a: '#6E86A6', b: '#333E56', glow: 'rgba(184,210,230,.5)', accent: '#DCE8F2',
    mark: M(<><path d="M16 6v20" /><path d="M9 11h14M8 16h16M10 21h12" opacity=".85" /><circle cx="16" cy="6" r="1.5" /></>) },
  { slug: 'word-customs', name: 'Word Customs', tagline: '단어의 여권을 심사해 위조를 적발하라', layer: 'L3+ 검증', ref: 'Papers, Please',
    a: '#B08444', b: '#4A3524', glow: 'rgba(230,190,120,.5)', accent: '#F2E2C0',
    mark: M(<><path d="M10 5h9l4 4v18H10z" /><path d="M19 5v4h4" opacity=".7" /><path d="M13 14h7M13 18h7M13 22h4" opacity=".85" /></>) },
  { slug: 'daily-blitz', name: 'Daily Blitz', tagline: '매일 새로운 10단어 · 스트릭', layer: '리텐션', ref: 'Wordle',
    a: '#E8846A', b: '#7C3B5E', glow: 'rgba(255,196,150,.55)', accent: '#FFE0C4',
    mark: M(<><path d="M6 22h20" /><path d="M16 22a6 6 0 0 0-6-6" opacity=".55" /><path d="M16 22a6 6 0 0 1 6-6" /><path d="M16 6v3M25 9l-2 2M7 9l2 2" /></>) },
  { slug: 'letter-forge', name: 'Letter Forge', tagline: '흩어진 글자로 철자를 벼려내다', layer: 'L4b 생성', ref: '애너그램',
    a: '#C4692C', b: '#54261F', glow: 'rgba(255,186,96,.55)', accent: '#FFD9A0',
    mark: M(<><path d="M7 20h13l4 4H11l-4-4Z" /><path d="M20 20l3-6" /><path d="M9 14l4-6 4 6" /><path d="M10.5 11.5h5" /></>) },
  { slug: 'cascade', name: 'Cascade', tagline: '단어와 뜻을 이어 지우는 낙하 보드', layer: 'L4a 재인', ref: 'Match-3',
    a: '#2E92A8', b: '#123C59', glow: 'rgba(130,232,238,.5)', accent: '#BEF3F7',
    mark: M(<><path d="M5 12c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 7 0" /><path d="M5 18c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 7 0" opacity=".7" /><path d="M5 24c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 7 0" opacity=".45" /></>) },
  { slug: 'connections', name: 'Connections', tagline: '16단어를 숨은 4개 의미로 잇다', layer: 'L5 관계', ref: 'NYT',
    a: '#7150A8', b: '#2C2356', glow: 'rgba(206,178,255,.5)', accent: '#E3D4FF',
    mark: M(<><circle cx="10" cy="10" r="2.4" /><circle cx="22" cy="10" r="2.4" /><circle cx="10" cy="22" r="2.4" /><circle cx="22" cy="22" r="2.4" /><path d="M12.4 10h7.2M10 12.4v7.2M12 12l8 8" opacity=".7" /></>) },
  { slug: 'word-economy', name: 'Word Economy', tagline: '코인을 벌어 파워업에 전략 투자', layer: 'L4a 전략', ref: 'Gimkit',
    a: '#C99A34', b: '#77481E', glow: 'rgba(255,216,124,.55)', accent: '#FFECBB',
    mark: M(<><ellipse cx="16" cy="10" rx="8" ry="3.4" /><path d="M8 10v6c0 1.9 3.6 3.4 8 3.4s8-1.5 8-3.4v-6" /><path d="M8 16c0 1.9 3.6 3.4 8 3.4s8-1.5 8-3.4" opacity=".6" /><path d="M8 22c0 1.9 3.6 3.4 8 3.4s8-1.5 8-3.4" opacity=".4" /></>) },
  { slug: 'ghost-race', name: 'Ghost Race', tagline: '유령과 속도 대결 · 리그 승급', layer: 'L4a 경쟁', ref: 'Kahoot',
    a: '#B34480', b: '#38296A', glow: 'rgba(255,158,224,.5)', accent: '#FFD1EE',
    mark: M(<><path d="M9 6v20" /><path d="M9 7h13l-3 4 3 4H9" /><path d="M4 14h3M3 19h4" opacity=".6" /></>) },
];

export default function ArcadePage() {
  return (
    <div className="arc-scene">
      <style dangerouslySetInnerHTML={{ __html: ARC_CSS }} />
      <div className="arc-glow" aria-hidden="true" />
      <div className="arc-grain" aria-hidden="true" />
      <div className="arc-vig" aria-hidden="true" />

      <div className="arc-inner">
        <header className="arc-head">
          <p className="arc-eyebrow">Arcade · 단어 게임</p>
          <h1 className="arc-title">아케이드</h1>
          <p className="arc-sub">여섯 개의 세계. 각자의 방식으로 인출·자동화·의미 연결을 연습하세요.</p>
        </header>

        <div className="arc-grid">
          {GAMES.map((g) => (
            <Link
              key={g.slug}
              href={`/play/${g.slug}?from=/arcade`}
              className="arc-card"
              style={{ ['--m-a' as string]: g.a, ['--m-b' as string]: g.b, ['--m-glow' as string]: g.glow, ['--m-accent' as string]: g.accent }}
            >
              <span className="arc-card-glow" aria-hidden="true" />
              <div className="arc-card-top">
                <span className="arc-mark">{g.mark}</span>
                <span className="arc-chip">{g.layer}</span>
              </div>
              <div className="arc-card-body">
                <h2 className="arc-name">{g.name}</h2>
                <p className="arc-tag">{g.tagline}</p>
              </div>
              <div className="arc-card-foot">
                <span className="arc-ref">{g.ref}</span>
                <span className="arc-play">플레이 <span className="arc-arrow">→</span></span>
              </div>
            </Link>
          ))}
        </div>

        <p className="arc-note">모든 게임은 학습 기록(FSRS)과 연동됩니다. 단어장·스크립트에서 <code>?set=</code>·<code>?text=</code>로 진입하면 그 자료의 단어로 플레이합니다.</p>
      </div>
    </div>
  );
}

const GRAIN = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

const ARC_CSS = `
  .arc-scene {
    position: relative; min-height: calc(100vh - 60px); width: 100%; overflow: hidden; isolation: isolate;
    border-radius: 24px;
    background:
      radial-gradient(130% 90% at 12% -5%, #3d2752 0%, transparent 52%),
      radial-gradient(120% 100% at 105% 108%, #5e2b44 0%, transparent 48%),
      linear-gradient(158deg, #191129 0%, #241634 46%, #2c1830 100%);
    font-family: var(--font-display, system-ui, sans-serif);
  }
  .arc-glow { position: absolute; inset: -25%; z-index: 0; pointer-events: none;
    background:
      radial-gradient(38% 40% at 28% 22%, rgba(255,186,132,.20), transparent 70%),
      radial-gradient(44% 46% at 78% 74%, rgba(176,116,240,.18), transparent 70%);
    animation: arc-drift 26s ease-in-out infinite alternate; }
  .arc-grain { position: absolute; inset: 0; z-index: 0; pointer-events: none; opacity: .05; mix-blend-mode: overlay; background-image: url("${GRAIN}"); }
  .arc-vig { position: absolute; inset: 0; z-index: 0; pointer-events: none; box-shadow: inset 0 0 220px 30px rgba(0,0,0,.5), inset 0 0 60px rgba(0,0,0,.25); border-radius: 24px; }

  .arc-inner { position: relative; z-index: 1; max-width: 1040px; margin: 0 auto; padding: clamp(36px, 7vh, 76px) clamp(20px, 4vw, 44px) 56px; }
  .arc-head { margin-bottom: clamp(28px, 5vh, 48px); }
  .arc-eyebrow { margin: 0; font-family: var(--font-english, ui-monospace, monospace); font-size: 11px; font-weight: 700; letter-spacing: .28em; text-transform: uppercase; color: rgba(255,225,200,.62); }
  .arc-title { margin: 10px 0 0; font-size: clamp(38px, 7vw, 60px); font-weight: 800; letter-spacing: -.01em; line-height: 1; color: #FBF3EC;
    text-shadow: 0 2px 30px rgba(0,0,0,.4); }
  .arc-sub { margin: 16px 0 0; max-width: 46ch; font-size: clamp(14px, 1.4vw, 16px); line-height: 1.5; color: rgba(246,232,224,.68); }

  .arc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(14px, 1.8vw, 20px); }
  @media (max-width: 860px) { .arc-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 560px) { .arc-grid { grid-template-columns: 1fr; } }

  .arc-card {
    position: relative; overflow: hidden; isolation: isolate;
    display: flex; flex-direction: column; gap: 14px; min-height: 208px; padding: 22px 22px 18px;
    border-radius: 20px; text-decoration: none; color: #fff;
    background: linear-gradient(152deg, var(--m-a) 0%, var(--m-b) 100%);
    border: 1px solid rgba(255,255,255,.16);
    box-shadow: 0 22px 48px -22px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.18);
    transition: transform .42s cubic-bezier(.2,.8,.2,1), box-shadow .42s cubic-bezier(.2,.8,.2,1);
  }
  .arc-card-glow { position: absolute; inset: 0; z-index: -1; pointer-events: none;
    background: radial-gradient(78% 58% at 28% 6%, var(--m-glow), transparent 62%); opacity: .85; transition: opacity .42s ease; }
  .arc-card::after { content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none; border-radius: 20px;
    background: linear-gradient(180deg, rgba(255,255,255,.10), transparent 34%); }
  .arc-card:hover { transform: translateY(-7px) scale(1.014); box-shadow: 0 34px 64px -22px rgba(0,0,0,.8), 0 0 44px -8px var(--m-glow); }
  .arc-card:hover .arc-card-glow { opacity: 1; }
  .arc-card:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,255,255,.6), 0 22px 48px -22px rgba(0,0,0,.75); }

  .arc-card-top { display: flex; align-items: flex-start; justify-content: space-between; }
  .arc-mark { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 12px;
    color: var(--m-accent); background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.22);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.25), 0 4px 14px -4px rgba(0,0,0,.4); }
  .arc-mark svg { width: 26px; height: 26px; filter: drop-shadow(0 0 6px var(--m-glow)); }
  .arc-chip { font-family: var(--font-english, ui-monospace, monospace); font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
    color: rgba(255,255,255,.92); background: rgba(0,0,0,.20); padding: 5px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,.16); backdrop-filter: blur(4px); }

  .arc-card-body { margin-top: auto; }
  .arc-name { margin: 0; font-size: 21px; font-weight: 800; letter-spacing: -.01em; color: #fff; text-shadow: 0 1px 12px rgba(0,0,0,.28); }
  .arc-tag { margin: 5px 0 0; font-size: 13px; line-height: 1.4; color: rgba(255,255,255,.82); word-break: keep-all; }

  .arc-card-foot { display: flex; align-items: center; justify-content: space-between; padding-top: 14px; margin-top: 4px; border-top: 1px solid rgba(255,255,255,.14); }
  .arc-ref { font-family: var(--font-english, ui-monospace, monospace); font-size: 10.5px; letter-spacing: .06em; color: rgba(255,255,255,.6); }
  .arc-play { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 800; color: #fff; }
  .arc-arrow { display: inline-block; transition: transform .3s cubic-bezier(.2,.8,.2,1); }
  .arc-card:hover .arc-arrow { transform: translateX(4px); }

  .arc-note { margin: clamp(28px, 5vh, 44px) 0 0; font-size: 12.5px; line-height: 1.6; color: rgba(240,226,220,.5); max-width: 62ch; }
  .arc-note code { font-family: var(--font-english, ui-monospace, monospace); font-size: 11.5px; color: rgba(255,225,200,.72); background: rgba(255,255,255,.06); padding: 1px 5px; border-radius: 5px; }

  @keyframes arc-drift { from { transform: translate3d(-2%, -1%, 0); } to { transform: translate3d(2%, 2.5%, 0); } }
  @media (prefers-reduced-motion: reduce) { .arc-glow { animation: none; } .arc-card, .arc-arrow { transition: none; } }
`;
