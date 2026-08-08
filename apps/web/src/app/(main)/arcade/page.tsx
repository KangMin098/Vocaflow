// apps/web/src/app/(main)/arcade/page.tsx — /arcade
// 아케이드 허브 — 황혼 갤러리 + 게임별 무드 포탈(스테인드글라스).
//
// 라우트 그룹 (main) — 허브는 세션이 아니다. 이전에는 (app)(=SessionFrame 전용 풀스크린 그룹)에
// 있어 Sidebar·FlowNav 가 통째로 사라졌고, 그래서 사이드바에 넣을 수도 없었다.
// 게임 본체(/play/*)만 (app) 에 남는다.
//
// ── IA (v07.4 재설계) ─────────────────────────────────────────────
//   ① 오늘의 추천 1종      — 결정론적 회전. "고르지 않아도 시작되는" 기본값.
//   ② 내 단어로 플레이     — due 큐로 진행 · FSRS 반영되는 게임들
//   ③ 큐레이션 세계        — 내장 수제 콘텐츠 · 단어가 없어도 즉시 플레이
//
//   근거: 선택지가 작업기억을 넘기면 자율성이 아니라 마비가 된다(choice overload).
//   그렇다고 선택권을 뺏으면 SDT 자율성이 깎인다. 해법은 "추천 하나 + 전부 열람".
//   그리고 학습자가 게임을 고를 때 실제로 궁금한 건 장르가 아니라
//   "이게 내 단어를 쓰나?" 이므로, 1차 분류축을 데이터 소스로 둔다.
//
//   게임 정의(이름·무드·마크·소스)는 lib/game/catalog 단일 출처 — 이 파일은 배치만 한다.

import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

import ArcadeMetaStrip from '@/components/game/ArcadeMetaStrip';
import {
  BANK_GAMES,
  GAME_COUNT,
  GAME_MARKS,
  MINE_GAMES,
  gamePlayHref,
  kstDayIndex,
  pickDailyGame,
  type GameEntry,
} from '@/lib/game/catalog';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: '아케이드 · Vocaflow' };
export const dynamic = 'force-dynamic';

/** 최소 mine 게임(minWords 4~6) 을 채우려면 이만큼은 있어야 한다. */
const MINE_READY_THRESHOLD = 6;

interface VocabStats {
  total: number;
  dueNow: number;
}

/** 내 단어 보유량 + 지금 복습 임박 수 — 추천 분기와 섹션 문구의 근거. */
async function fetchVocabStats(): Promise<VocabStats> {
  try {
    const client = (await createClient()) as unknown as SupabaseClient;
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return { total: 0, dueNow: 0 };

    const nowIso = new Date().toISOString();
    const [totalRes, dueRes] = await Promise.all([
      client
        .from('vocabularies')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('meaning', 'is', null)
        .neq('meaning', ''),
      client
        .from('vocabularies')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('meaning', 'is', null)
        .neq('meaning', '')
        .or(`next_review_at.is.null,next_review_at.lte.${nowIso}`),
    ]);
    return { total: totalRes.count ?? 0, dueNow: dueRes.count ?? 0 };
  } catch {
    return { total: 0, dueNow: 0 };
  }
}

export default async function ArcadePage() {
  const stats = await fetchVocabStats();
  const mineReady = stats.total >= MINE_READY_THRESHOLD;
  const daily = pickDailyGame(kstDayIndex(), stats.total);

  return (
    <div className="arc-scene">
      <style dangerouslySetInnerHTML={{ __html: ARC_CSS }} />
      <div className="arc-glow" aria-hidden="true" />
      <div className="arc-grain" aria-hidden="true" />
      <div className="arc-vig" aria-hidden="true" />

      <div className="arc-inner">
        <header className="arc-head">
          <p className="arc-eyebrow">Arcade · 단어 게임 {GAME_COUNT}종</p>
          <h1 className="arc-title">아케이드</h1>
          <p className="arc-sub">저마다 다른 세계. 각자의 방식으로 인출·추론·의미 연결을 연습하세요.</p>
        </header>

        <ArcadeMetaStrip />

        {/* ① 오늘의 추천 — 고르지 않아도 시작되는 기본값 */}
        <DailyPick game={daily} mineReady={mineReady} stats={stats} />

        {/* ② 내 단어로 플레이 */}
        <GameSection
          id="mine"
          eyebrow="My Words"
          title="내 단어로 플레이"
          desc={
            mineReady
              ? `내 단어 ${stats.total}개 중 복습이 임박한 것부터 나와요. 결과는 기억 곡선(FSRS)에 반영됩니다.`
              : `내 단어가 ${MINE_READY_THRESHOLD}개 이상이면 여기 게임들이 내 단어로 바뀝니다. 지금은 맛보기 단어로 열려요.`
          }
          games={MINE_GAMES}
          badge={mineReady ? `복습 임박 ${stats.dueNow}개` : '맛보기'}
          badgeTone={mineReady ? 'live' : 'muted'}
          action={
            mineReady
              ? undefined
              : { href: '/wordvault', label: '단어 모으러 가기' }
          }
        />

        {/* ③ 큐레이션 세계 */}
        <GameSection
          id="bank"
          eyebrow="Curated Worlds"
          title="큐레이션 세계"
          desc="수제 콘텐츠로 문맥 추론·철자 규칙·의미 관계를 연습해요. 내 단어가 없어도 지금 바로 플레이할 수 있습니다."
          games={BANK_GAMES}
        />

        <p className="arc-note">
          단어장·스크립트에서 <code>?set=</code>·<code>?text=</code>로 진입하면 그 자료의 단어로 플레이합니다.
          아무 것도 지정하지 않으면 “내 단어로 플레이”는 복습 큐를, “큐레이션 세계”는 내장 콘텐츠를 씁니다.
        </p>
        <p className="arc-credit">
          배경음악: Kevin MacLeod (incompetech.com) ·{' '}
          <a href="http://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">
            CC-BY 3.0
          </a>
        </p>
      </div>
    </div>
  );
}

// ── ① 오늘의 추천 ────────────────────────────────────────────────
function DailyPick({
  game,
  mineReady,
  stats,
}: {
  game: GameEntry;
  mineReady: boolean;
  stats: VocabStats;
}) {
  const usesMyWords = game.source === 'mine' && mineReady;
  return (
    <section className="arc-daily" aria-labelledby="arc-daily-title">
      <Link
        href={gamePlayHref(game.slug, { from: '/arcade' })}
        className="arc-daily-card"
        style={
          {
            ['--m-a']: game.mood.a,
            ['--m-b']: game.mood.b,
            ['--m-glow']: game.mood.glow,
            ['--m-accent']: game.mood.accent,
          } as CSSProperties
        }
      >
        <span className="arc-card-glow" aria-hidden="true" />
        <span className="arc-daily-mark" aria-hidden="true">
          <Mark slug={game.slug} />
        </span>
        <span className="arc-daily-body">
          <span className="arc-daily-eyebrow">오늘의 한 판</span>
          <h2 id="arc-daily-title" className="arc-daily-name">
            {game.name}
          </h2>
          <span className="arc-daily-tag">{game.tagline}</span>
          <span className="arc-daily-meta">
            {usesMyWords
              ? `내 복습 단어 ${stats.dueNow > 0 ? `${stats.dueNow}개 ` : ''}로 진행 · 기억 곡선 반영`
              : '큐레이션 콘텐츠 · 단어 없이 바로 시작'}
          </span>
        </span>
        <span className="arc-daily-cta">
          시작 <span className="arc-arrow">→</span>
        </span>
      </Link>
    </section>
  );
}

// ── ②③ 게임 섹션 ────────────────────────────────────────────────
function GameSection({
  id,
  eyebrow,
  title,
  desc,
  games,
  badge,
  badgeTone,
  action,
}: {
  id: string;
  eyebrow: string;
  title: string;
  desc: string;
  games: readonly GameEntry[];
  badge?: string;
  badgeTone?: 'live' | 'muted';
  action?: { href: string; label: string };
}) {
  return (
    <section className="arc-sec" aria-labelledby={`arc-sec-${id}`}>
      <div className="arc-sec-head">
        <div className="arc-sec-headline">
          <p className="arc-sec-eyebrow">{eyebrow}</p>
          <h2 id={`arc-sec-${id}`} className="arc-sec-title">
            {title}
            <span className="arc-sec-count">{games.length}</span>
          </h2>
        </div>
        {badge && (
          <span className="arc-sec-badge" data-tone={badgeTone ?? 'muted'}>
            {badge}
          </span>
        )}
      </div>
      <p className="arc-sec-desc">
        {desc}
        {action && (
          <>
            {' '}
            <Link href={action.href} className="arc-sec-link">
              {action.label} →
            </Link>
          </>
        )}
      </p>

      <div className="arc-grid">
        {games.map((g) => (
          <Link
            key={g.slug}
            href={gamePlayHref(g.slug, { from: '/arcade' })}
            className="arc-card"
            style={
              {
                ['--m-a']: g.mood.a,
                ['--m-b']: g.mood.b,
                ['--m-glow']: g.mood.glow,
                ['--m-accent']: g.mood.accent,
              } as CSSProperties
            }
          >
            <span className="arc-card-glow" aria-hidden="true" />
            <div className="arc-card-top">
              <span className="arc-mark">
                <Mark slug={g.slug} />
              </span>
              <span className="arc-chips">
                {g.is3d && <span className="arc-chip arc-chip--3d">3D</span>}
                {g.beta && <span className="arc-chip arc-chip--beta">베타</span>}
                <span className="arc-chip">{g.layer}</span>
              </span>
            </div>
            <div className="arc-card-body">
              <h3 className="arc-name">{g.name}</h3>
              <p className="arc-tag">{g.tagline}</p>
            </div>
            <div className="arc-card-foot">
              <span className="arc-ref">{g.ref}</span>
              <span className="arc-play">
                플레이 <span className="arc-arrow">→</span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Mark({ slug }: { slug: GameEntry['slug'] }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GAME_MARKS[slug]}
    </svg>
  );
}

const GRAIN = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

const ARC_CSS = `
  /* (main) 셸(Sidebar + FlowNav) 안에 놓이므로 좌우 여백을 스스로 두고 라운드 카드로 앉는다. */
  .arc-scene {
    position: relative; min-height: calc(100vh - 96px); width: auto; overflow: hidden; isolation: isolate;
    margin: 12px clamp(12px, 2vw, 20px) 20px;
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
  .arc-head { margin-bottom: clamp(24px, 4vh, 40px); }
  .arc-eyebrow { margin: 0; font-family: var(--font-english, ui-monospace, monospace); font-size: 11px; font-weight: 700; letter-spacing: .28em; text-transform: uppercase; color: rgba(255,225,200,.62); }
  .arc-title { margin: 10px 0 0; font-size: clamp(38px, 7vw, 60px); font-weight: 800; letter-spacing: -.01em; line-height: 1; color: #FBF3EC;
    text-shadow: 0 2px 30px rgba(0,0,0,.4); }
  .arc-sub { margin: 16px 0 0; max-width: 46ch; font-size: clamp(14px, 1.4vw, 16px); line-height: 1.5; color: rgba(246,232,224,.68); }

  .arc-meta { display: flex; flex-wrap: wrap; align-items: center; gap: clamp(14px, 3vw, 30px); margin: 0 0 clamp(20px, 3.5vh, 30px); padding: 14px 18px; border-radius: 16px;
    background: linear-gradient(150deg, rgba(255,255,255,.07), rgba(255,255,255,.02)); border: 1px solid rgba(255,255,255,.12); box-shadow: inset 0 1px 0 rgba(255,255,255,.12); }
  .arc-meta--ghost { min-height: 66px; }
  .arc-meta-item { display: flex; flex-direction: column; gap: 4px; }
  .arc-meta-num { font-size: 21px; font-weight: 800; color: #FBF3EC; font-variant-numeric: tabular-nums; letter-spacing: -.01em; display: inline-flex; align-items: baseline; gap: 5px; }
  .arc-meta-flame { font-size: 17px; }
  .arc-meta-lbl { font-size: 11px; font-weight: 700; letter-spacing: .04em; color: rgba(246,232,224,.6); display: flex; flex-direction: column; gap: 5px; }
  .arc-meta-level { min-width: 128px; }
  .arc-meta-goal { min-width: 150px; margin-left: auto; }
  .arc-meta-goal-total { font-size: 12px; font-weight: 700; color: rgba(246,232,224,.5); }
  .arc-meta-goal[data-met="1"] .arc-meta-num { color: #9BE8C0; }
  .arc-meta-bar { display: block; height: 5px; border-radius: 999px; background: rgba(255,255,255,.14); overflow: hidden; margin-top: 3px; }
  .arc-meta-bar--goal { width: 100%; }
  .arc-meta-bar-fill { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #FFB984, #F0A084); transition: width .5s cubic-bezier(.2,.8,.2,1); }
  .arc-meta-goal[data-met="1"] .arc-meta-bar-fill { background: linear-gradient(90deg, #7FE0A8, #9BE8C0); }

  /* ── ① 오늘의 추천 ── */
  .arc-daily { margin: 0 0 clamp(30px, 5vh, 46px); }
  .arc-daily-card {
    position: relative; overflow: hidden; isolation: isolate;
    display: flex; align-items: center; gap: clamp(16px, 3vw, 26px);
    padding: clamp(20px, 3vw, 28px) clamp(20px, 3vw, 30px);
    border-radius: 22px; text-decoration: none; color: #fff;
    background: linear-gradient(122deg, var(--m-a) 0%, var(--m-b) 100%);
    border: 1px solid rgba(255,255,255,.2);
    box-shadow: 0 26px 56px -24px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.2);
    transition: transform .42s cubic-bezier(.2,.8,.2,1), box-shadow .42s cubic-bezier(.2,.8,.2,1);
  }
  .arc-daily-card:hover { transform: translateY(-5px); box-shadow: 0 36px 70px -24px rgba(0,0,0,.85), 0 0 48px -8px var(--m-glow); }
  .arc-daily-card:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,255,255,.6), 0 26px 56px -24px rgba(0,0,0,.8); }
  .arc-daily-mark { flex-shrink: 0; width: 62px; height: 62px; display: grid; place-items: center; border-radius: 16px;
    color: var(--m-accent); background: rgba(255,255,255,.13); border: 1px solid rgba(255,255,255,.24);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.26), 0 6px 18px -6px rgba(0,0,0,.45); }
  .arc-daily-mark svg { width: 36px; height: 36px; filter: drop-shadow(0 0 8px var(--m-glow)); }
  .arc-daily-body { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
  .arc-daily-eyebrow { font-family: var(--font-english, ui-monospace, monospace); font-size: 10.5px; font-weight: 800; letter-spacing: .2em; text-transform: uppercase; color: rgba(255,255,255,.66); }
  .arc-daily-name { margin: 3px 0 0; font-size: clamp(22px, 3vw, 27px); font-weight: 800; letter-spacing: -.01em; color: #fff; text-shadow: 0 1px 14px rgba(0,0,0,.3); }
  .arc-daily-tag { margin-top: 4px; font-size: 13.5px; line-height: 1.45; color: rgba(255,255,255,.85); word-break: keep-all; }
  .arc-daily-meta { margin-top: 9px; font-size: 11.5px; font-weight: 700; letter-spacing: .01em; color: var(--m-accent); }
  .arc-daily-cta { flex-shrink: 0; display: inline-flex; align-items: center; gap: 7px; padding: 11px 20px; border-radius: 999px;
    font-size: 14px; font-weight: 800; color: #201525; background: rgba(255,255,255,.92);
    box-shadow: 0 8px 22px -8px rgba(0,0,0,.5); }
  .arc-daily-card:hover .arc-daily-cta { background: #fff; }
  @media (max-width: 620px) {
    .arc-daily-card { flex-wrap: wrap; }
    .arc-daily-cta { width: 100%; justify-content: center; }
  }

  /* ── ②③ 섹션 ── */
  .arc-sec { margin: 0 0 clamp(32px, 5.5vh, 52px); }
  .arc-sec-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; }
  .arc-sec-eyebrow { margin: 0; font-family: var(--font-english, ui-monospace, monospace); font-size: 10px; font-weight: 800; letter-spacing: .22em; text-transform: uppercase; color: rgba(255,225,200,.5); }
  .arc-sec-title { display: flex; align-items: center; gap: 9px; margin: 5px 0 0; font-size: clamp(19px, 2.4vw, 23px); font-weight: 800; letter-spacing: -.01em; color: #FBF3EC; }
  .arc-sec-count { font-family: var(--font-english, ui-monospace, monospace); font-size: 11px; font-weight: 800; color: rgba(255,225,200,.62); background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.14); border-radius: 999px; padding: 3px 9px; font-variant-numeric: tabular-nums; }
  .arc-sec-badge { flex-shrink: 0; font-size: 11px; font-weight: 800; letter-spacing: .02em; padding: 6px 12px; border-radius: 999px; border: 1px solid transparent; }
  .arc-sec-badge[data-tone="live"] { color: #9BE8C0; background: rgba(125,224,168,.12); border-color: rgba(125,224,168,.3); }
  .arc-sec-badge[data-tone="muted"] { color: rgba(246,232,224,.66); background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.14); }
  .arc-sec-desc { margin: 10px 0 18px; max-width: 68ch; font-size: 12.5px; line-height: 1.65; color: rgba(240,226,220,.58); word-break: keep-all; }
  .arc-sec-link { color: rgba(255,225,200,.9); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
  .arc-sec-link:hover { color: #fff; }

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
  .arc-card::after, .arc-daily-card::after { content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none; border-radius: inherit;
    background: linear-gradient(180deg, rgba(255,255,255,.10), transparent 34%); }
  .arc-card:hover { transform: translateY(-7px) scale(1.014); box-shadow: 0 34px 64px -22px rgba(0,0,0,.8), 0 0 44px -8px var(--m-glow); }
  .arc-card:hover .arc-card-glow, .arc-daily-card:hover .arc-card-glow { opacity: 1; }
  .arc-card:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,255,255,.6), 0 22px 48px -22px rgba(0,0,0,.75); }

  .arc-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .arc-chips { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 5px; }
  .arc-mark { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 12px;
    color: var(--m-accent); background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.22);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.25), 0 4px 14px -4px rgba(0,0,0,.4); }
  .arc-mark svg { width: 26px; height: 26px; filter: drop-shadow(0 0 6px var(--m-glow)); }
  .arc-chip { font-family: var(--font-english, ui-monospace, monospace); font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
    color: rgba(255,255,255,.92); background: rgba(0,0,0,.20); padding: 5px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,.16); backdrop-filter: blur(4px); }
  .arc-chip--3d { color: #EAF6FF; background: rgba(120,190,255,.24); border-color: rgba(180,220,255,.36); }
  .arc-chip--beta { color: #FFE7C2; background: rgba(255,180,110,.22); border-color: rgba(255,200,150,.36); }

  .arc-card-body { margin-top: auto; }
  .arc-name { margin: 0; font-size: 21px; font-weight: 800; letter-spacing: -.01em; color: #fff; text-shadow: 0 1px 12px rgba(0,0,0,.28); }
  .arc-tag { margin: 5px 0 0; font-size: 13px; line-height: 1.4; color: rgba(255,255,255,.82); word-break: keep-all; }

  .arc-card-foot { display: flex; align-items: center; justify-content: space-between; padding-top: 14px; margin-top: 4px; border-top: 1px solid rgba(255,255,255,.14); }
  .arc-ref { font-family: var(--font-english, ui-monospace, monospace); font-size: 10.5px; letter-spacing: .06em; color: rgba(255,255,255,.6); }
  .arc-play { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 800; color: #fff; }
  .arc-arrow { display: inline-block; transition: transform .3s cubic-bezier(.2,.8,.2,1); }
  .arc-card:hover .arc-arrow, .arc-daily-card:hover .arc-arrow { transform: translateX(4px); }

  .arc-note { margin: clamp(20px, 4vh, 34px) 0 0; font-size: 12.5px; line-height: 1.6; color: rgba(240,226,220,.5); max-width: 68ch; word-break: keep-all; }
  .arc-note code { font-family: var(--font-english, ui-monospace, monospace); font-size: 11.5px; color: rgba(255,225,200,.72); background: rgba(255,255,255,.06); padding: 1px 5px; border-radius: 5px; }
  .arc-credit { margin: 10px 0 0; font-size: 11px; color: rgba(240,226,220,.38); }
  .arc-credit a { color: rgba(240,226,220,.55); text-decoration: underline; }
  .arc-credit a:hover { color: rgba(255,225,200,.8); }

  @keyframes arc-drift { from { transform: translate3d(-2%, -1%, 0); } to { transform: translate3d(2%, 2.5%, 0); } }
  @media (prefers-reduced-motion: reduce) { .arc-glow { animation: none; } .arc-card, .arc-daily-card, .arc-arrow { transition: none; } }
`;
