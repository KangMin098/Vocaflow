// apps/web/src/app/(main)/arcade/page.tsx — /arcade
// 아케이드 허브 — "저녁의 서재". 플랫폼 Reading Room 아트 디렉션의 야간 대응면.
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
//
// ── 아트 디렉션 (v07.5) ───────────────────────────────────────────
//   이전: 보라–마젠타 황혼 + 카드 19장 풀블리드 무지개 그라디언트.
//   플랫폼 토큰(deep ink #0F2540 · paper #FBFAF6 · muted gold #B0843A,
//   Linear식 단일 액센트 "gold 는 5% 미만·시그니처에만")과 접점이 전혀 없어
//   페이퍼 톤 셸 안에서 다른 앱을 붙여둔 것처럼 읽혔다.
//
//   지금: 앱 다크 테마 캔버스(warm dark paper #181410)를 바닥에 깔고 deep ink 를 씌운
//   "저녁의 서재". 게임 개성은 색면이 아니라 **잉크 위 24% 틴트 + 2px 액센트 엣지 + 마크**로,
//   금빛은 오늘의 추천 한 곳에만. 색이 정보를 나르되 시선을 분산시키지 않게 한다.

import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

import ArcadeMetaStrip from '@/components/game/ArcadeMetaStrip';
import {
  GAME_COUNT,
  GAME_MARKS,
  countHubGames,
  gamePlayHref,
  hubSections,
  kstDayIndex,
  pickDailyGame,
  type GameEntry,
  type GameFamily,
  type HubItem,
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
  // 같은 인지 루프를 공유하는 계열은 한 장으로 접힌다(중복 체감 제거).
  const sections = hubSections();

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
          desc={mineDesc(mineReady, stats)}
          items={sections.mine}
          gameCount={countHubGames(sections.mine)}
          badge={mineBadge(mineReady, stats)}
          badgeTone={mineReady ? 'live' : 'muted'}
          action={mineReady ? undefined : { href: '/wordvault', label: '단어 모으러 가기' }}
        />

        {/* ③ 큐레이션 세계 */}
        <GameSection
          id="bank"
          eyebrow="Curated Worlds"
          title="큐레이션 세계"
          desc="수제 콘텐츠로 문맥 추론·철자 규칙·의미 관계를 연습해요. 내 단어가 없어도 지금 바로 플레이할 수 있습니다."
          items={sections.bank}
          gameCount={countHubGames(sections.bank)}
        />

        <p className="arc-note">
          단어장·스크립트에서 <code>?set=</code>·<code>?text=</code>로 진입하면 그 자료의 단어로 플레이합니다.
          아무 것도 지정하지 않으면 “내 단어로 플레이”는 복습 큐를, “큐레이션 세계”는 내장 콘텐츠를 씁니다.
        </p>
        <p className="arc-credit">
          배경음악:{' '}
          <a href="https://www.scottbuckley.com.au/" target="_blank" rel="noopener noreferrer">
            Scott Buckley
          </a>{' '}
          ·{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">
            CC-BY 4.0
          </a>{' '}
          · 효과음: Mixkit
        </p>
      </div>
    </div>
  );
}

// ── 카피 — 3상태(단어없음 / 있고 due 0 / 있고 due N) 를 각각 자연스럽게 ──
//
// Empathetic Feedback: "복습 임박 0개" 같은 무의미한 0 배지나
// "내 복습 단어 로 진행"(수 없는 문장) 같은 깨진 문장을 만들지 않는다.
function mineBadge(mineReady: boolean, s: VocabStats): string {
  if (!mineReady) return '맛보기';
  return s.dueNow > 0 ? `복습 임박 ${s.dueNow}개` : '복습 완료 ✓';
}

function mineDesc(mineReady: boolean, s: VocabStats): string {
  if (!mineReady) {
    return `내 단어가 ${MINE_READY_THRESHOLD}개 이상이면 여기 게임들이 내 단어로 바뀝니다. 지금은 맛보기 단어로 열려요.`;
  }
  if (s.dueNow > 0) {
    return `내 단어 ${s.total}개 중 복습이 임박한 것부터 나와요. 결과는 기억 곡선(FSRS)에 반영됩니다.`;
  }
  return `오늘 복습할 단어는 다 봤어요. 내 단어 ${s.total}개로 한 번 더 놀 수 있고, 결과는 기억 곡선에 반영됩니다.`;
}

/** 오늘의 추천 카드 한 줄 — 단어 수가 0이어도 문장이 깨지지 않게. */
function dailyMeta(usesMyWords: boolean, s: VocabStats): string {
  if (!usesMyWords) return '큐레이션 콘텐츠 · 단어 없이 바로 시작';
  return s.dueNow > 0
    ? `복습 임박한 내 단어 ${s.dueNow}개로 진행 · 기억 곡선 반영`
    : `내 단어 ${s.total}개로 진행 · 기억 곡선 반영`;
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
          <span className="arc-daily-meta">{dailyMeta(usesMyWords, stats)}</span>
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
  items,
  gameCount,
  badge,
  badgeTone,
  action,
}: {
  id: string;
  eyebrow: string;
  title: string;
  desc: string;
  /** 표시 단위 — 단독 게임 또는 계열(모드 묶음) */
  items: HubItem[];
  /** 배지에 쓸 실제 게임 수 (계열은 여러 개를 한 장으로 접으므로 카드 수와 다르다) */
  gameCount: number;
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
            <span className="arc-sec-count">{gameCount}</span>
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
        {items.map((item) =>
          item.kind === 'game' ? (
            <GameCard key={item.game.slug} game={item.game} />
          ) : (
            <FamilyCard key={item.family.key} family={item.family} modes={item.modes} />
          ),
        )}
      </div>
    </section>
  );
}

// ── 단독 게임 카드 ───────────────────────────────────────────────
function GameCard({ game: g }: { game: GameEntry }) {
  return (
    <Link
      href={gamePlayHref(g.slug, { from: '/arcade' })}
      className="arc-card"
      style={moodVars(g.mood)}
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
  );
}

// ── 계열 카드 — 같은 인출을 여러 재미로 ──────────────────────────
//
// 카드 자체는 링크가 아니다(중첩 <a> 금지). 모드 칩 하나하나가 실제 플레이 링크.
// "왜 비슷한 게 여러 개인가"에 답하려면 공통점(인출)과 차이(동기 장치)를 같이 보여야 한다.
function FamilyCard({ family: f, modes }: { family: GameFamily; modes: GameEntry[] }) {
  return (
    <div
      className="arc-card arc-card--family"
      style={moodVars(f.mood)}
      role="group"
      aria-labelledby={`arc-fam-${f.key}`}
    >
      <span className="arc-card-glow" aria-hidden="true" />
      <div className="arc-card-top">
        <span className="arc-mark">
          <Mark slug={f.markOf} />
        </span>
        <span className="arc-chips">
          <span className="arc-chip arc-chip--modes">{modes.length}모드</span>
          <span className="arc-chip">{f.layer}</span>
        </span>
      </div>
      <div className="arc-card-body">
        <h3 id={`arc-fam-${f.key}`} className="arc-name">
          {f.name}
        </h3>
        <p className="arc-tag">{f.tagline}</p>
      </div>
      <ul className="arc-modes">
        {modes.map((m) => (
          <li key={m.slug}>
            <Link href={gamePlayHref(m.slug, { from: '/arcade' })} className="arc-mode">
              <span className="arc-mode-name">{m.modeLabel ?? m.name}</span>
              {m.modeNote && <span className="arc-mode-note">{m.modeNote}</span>}
              <span className="arc-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="arc-card-foot">
        <span className="arc-ref">{f.ref}</span>
      </div>
    </div>
  );
}

function moodVars(m: GameEntry['mood']): CSSProperties {
  return {
    ['--m-a']: m.a,
    ['--m-b']: m.b,
    ['--m-glow']: m.glow,
    ['--m-accent']: m.accent,
  } as CSSProperties;
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
  /* ── 아트 디렉션 (v07.5 재정렬) ────────────────────────────────
     이전: 보라–마젠타 황혼 + 카드 19장 풀블리드 무지개 그라디언트.
     플랫폼(Reading Room — deep ink #0F2540 · paper #FBFAF6 · muted gold #B0843A,
     Linear식 단일 액센트 5% 미만)과 아무 접점이 없어, 페이퍼 톤 셸 안에서
     "다른 앱을 붙여놓은" 이물질로 읽혔다.

     지금: 앱의 **다크 테마 캔버스(warm dark paper #181410)** 를 바닥으로 깔고
     deep ink 를 한 겹 씌운 "저녁의 서재". 앰비언트도 gold + ink 두 색만.
     게임별 개성은 풀블리드 색면이 아니라 **잉크 베이스 위 22% 틴트 + 액센트 마크**로.
     ───────────────────────────────────────────────────────────── */
  .arc-scene {
    position: relative; min-height: calc(100vh - 96px); width: auto; overflow: hidden; isolation: isolate;
    margin: 12px clamp(12px, 2vw, 20px) 20px;
    border-radius: 24px;
    background:
      radial-gradient(125% 85% at 14% -8%, #16283E 0%, transparent 54%),
      radial-gradient(115% 95% at 102% 106%, #241C14 0%, transparent 50%),
      linear-gradient(160deg, #13100C 0%, #181410 46%, #121821 100%);
    font-family: var(--font-display, system-ui, sans-serif);
  }
  .arc-glow { position: absolute; inset: -25%; z-index: 0; pointer-events: none;
    background:
      radial-gradient(38% 40% at 26% 20%, rgba(176,132,58,.16), transparent 70%),
      radial-gradient(44% 46% at 80% 78%, rgba(15,37,64,.42), transparent 70%);
    animation: arc-drift 26s ease-in-out infinite alternate; }
  .arc-grain { position: absolute; inset: 0; z-index: 0; pointer-events: none; opacity: .05; mix-blend-mode: overlay; background-image: url("${GRAIN}"); }
  .arc-vig { position: absolute; inset: 0; z-index: 0; pointer-events: none; box-shadow: inset 0 0 220px 30px rgba(0,0,0,.5), inset 0 0 60px rgba(0,0,0,.25); border-radius: 24px; }

  .arc-inner { position: relative; z-index: 1; max-width: 1040px; margin: 0 auto; padding: clamp(36px, 7vh, 76px) clamp(20px, 4vw, 44px) 56px; }
  .arc-head { margin-bottom: clamp(24px, 4vh, 40px); }
  .arc-eyebrow { margin: 0; font-family: var(--font-english, ui-monospace, monospace); font-size: 11px; font-weight: 700; letter-spacing: .28em; text-transform: uppercase; color: rgba(212,168,86,.72); }
  .arc-title { margin: 10px 0 0; font-size: clamp(38px, 7vw, 60px); font-weight: 800; letter-spacing: -.01em; line-height: 1; color: #FBF3EC;
    text-shadow: 0 2px 30px rgba(0,0,0,.4); }
  .arc-sub { margin: 16px 0 0; max-width: 46ch; font-size: clamp(14px, 1.4vw, 16px); line-height: 1.5; color: rgba(240,234,224,.62); }

  .arc-meta { display: flex; flex-wrap: wrap; align-items: center; gap: clamp(14px, 3vw, 30px); margin: 0 0 clamp(20px, 3.5vh, 30px); padding: 14px 18px; border-radius: 16px;
    background: linear-gradient(150deg, rgba(255,255,255,.07), rgba(255,255,255,.02)); border: 1px solid rgba(255,255,255,.12); box-shadow: inset 0 1px 0 rgba(255,255,255,.12); }
  .arc-meta--ghost { min-height: 66px; }
  .arc-meta-item { display: flex; flex-direction: column; gap: 4px; }
  .arc-meta-num { font-size: 21px; font-weight: 800; color: #FBF3EC; font-variant-numeric: tabular-nums; letter-spacing: -.01em; display: inline-flex; align-items: baseline; gap: 5px; }
  .arc-meta-flame { font-size: 17px; }
  .arc-meta-lbl { font-size: 11px; font-weight: 700; letter-spacing: .04em; color: rgba(246,232,224,.6); display: flex; flex-direction: column; gap: 5px; }
  .arc-meta-level { min-width: 128px; }
  .arc-meta-goal { min-width: 150px; margin-left: auto; }
  .arc-meta-music { display: inline-flex; align-items: center; gap: 7px; min-height: 44px; padding: 0 14px; border-radius: 999px; cursor: pointer;
    font-family: var(--font-display, system-ui, sans-serif); font-size: 12px; font-weight: 700; letter-spacing: -.01em; white-space: nowrap;
    color: rgba(246,232,224,.72); background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.16);
    transition: color .15s var(--ease, ease), background-color .15s var(--ease, ease), border-color .15s var(--ease, ease), transform .12s var(--ease, ease); }
  .arc-meta-music:hover { color: #FBF3EC; background: rgba(255,255,255,.12); border-color: rgba(255,255,255,.28); }
  .arc-meta-music:active { transform: scale(.97); }
  .arc-meta-music:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,225,200,.45); }
  .arc-meta-music[data-on="1"] { color: #FFE0C4; background: rgba(255,184,132,.16); border-color: rgba(255,184,132,.4); }
  @media (prefers-reduced-motion: reduce) { .arc-meta-music { transition: none; } }
  .arc-meta-goal-total { font-size: 12px; font-weight: 700; color: rgba(246,232,224,.5); }
  .arc-meta-goal[data-met="1"] .arc-meta-num { color: #9BE8C0; }
  .arc-meta-bar { display: block; height: 5px; border-radius: 999px; background: rgba(255,255,255,.14); overflow: hidden; margin-top: 3px; }
  .arc-meta-bar--goal { width: 100%; }
  .arc-meta-bar-fill { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #FFB984, #F0A084); transition: width .5s cubic-bezier(.2,.8,.2,1); }
  .arc-meta-goal[data-met="1"] .arc-meta-bar-fill { background: linear-gradient(90deg, #7FE0A8, #9BE8C0); }

  /* ── ① 오늘의 추천 ── */
  .arc-daily { margin: 0 0 clamp(30px, 5vh, 46px); }
  /* 오늘의 추천 = 이 화면의 유일한 시그니처 모먼트.
     브랜드 규칙(gold 는 5% 미만, 보상·시그니처에만)에 따라 **여기서만** 금빛을 쓴다.
     추천 게임의 무드색은 마크에만 남겨 "오늘"이라는 의미가 색을 이기게 한다. */
  .arc-daily-card {
    position: relative; overflow: hidden; isolation: isolate;
    display: flex; align-items: center; gap: clamp(16px, 3vw, 26px);
    padding: clamp(20px, 3vw, 28px) clamp(20px, 3vw, 30px);
    border-radius: 22px; text-decoration: none; color: #F7F0E4;
    background:
      radial-gradient(120% 160% at 0% 0%, rgba(176,132,58,.30) 0%, transparent 58%),
      linear-gradient(122deg, #1F1710 0%, #171E2B 100%);
    border: 1px solid rgba(212,168,86,.34);
    box-shadow: 0 26px 56px -24px rgba(0,0,0,.85), inset 0 1px 0 rgba(212,168,86,.20);
    transition: transform .42s cubic-bezier(.2,.8,.2,1), box-shadow .42s cubic-bezier(.2,.8,.2,1), border-color .42s ease;
  }
  .arc-daily-card:hover { transform: translateY(-5px); border-color: rgba(212,168,86,.6);
    box-shadow: 0 36px 70px -24px rgba(0,0,0,.9), 0 0 44px -16px rgba(212,168,86,.5); }
  .arc-daily-card:focus-visible { outline: none; box-shadow: 0 0 0 3px #D4A856, 0 26px 56px -24px rgba(0,0,0,.8); }
  .arc-daily-mark { flex-shrink: 0; width: 62px; height: 62px; display: grid; place-items: center; border-radius: 16px;
    color: var(--m-accent); background: rgba(255,255,255,.08); border: 1px solid rgba(212,168,86,.28);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.26), 0 6px 18px -6px rgba(0,0,0,.45); }
  .arc-daily-mark svg { width: 36px; height: 36px; filter: drop-shadow(0 0 8px var(--m-glow)); }
  .arc-daily-body { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
  .arc-daily-eyebrow { font-family: var(--font-english, ui-monospace, monospace); font-size: 10.5px; font-weight: 800; letter-spacing: .2em; text-transform: uppercase; color: #D4A856; }
  .arc-daily-name { margin: 3px 0 0; font-size: clamp(22px, 3vw, 27px); font-weight: 800; letter-spacing: -.01em; color: #fff; text-shadow: 0 1px 14px rgba(0,0,0,.3); }
  .arc-daily-tag { margin-top: 4px; font-size: 13.5px; line-height: 1.45; color: rgba(255,255,255,.85); word-break: keep-all; }
  .arc-daily-meta { margin-top: 9px; font-size: 11.5px; font-weight: 700; letter-spacing: .01em; color: rgba(212,168,86,.9); }
  .arc-daily-cta { flex-shrink: 0; display: inline-flex; align-items: center; gap: 7px; padding: 11px 20px; border-radius: 999px;
    font-size: 14px; font-weight: 800; color: #17110A; background: linear-gradient(180deg,#E6C275,#C9A055);
    box-shadow: 0 8px 22px -8px rgba(0,0,0,.5); }
  .arc-daily-card:hover .arc-daily-cta { background: linear-gradient(180deg,#F0D08A,#D4A856); }
  @media (max-width: 620px) {
    .arc-daily-card { flex-wrap: wrap; }
    .arc-daily-cta { width: 100%; justify-content: center; }
  }

  /* ── ②③ 섹션 ── */
  .arc-sec { margin: 0 0 clamp(32px, 5.5vh, 52px); }
  .arc-sec-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; }
  .arc-sec-eyebrow { margin: 0; font-family: var(--font-english, ui-monospace, monospace); font-size: 10px; font-weight: 800; letter-spacing: .22em; text-transform: uppercase; color: rgba(240,234,224,.42); }
  .arc-sec-title { display: flex; align-items: center; gap: 9px; margin: 5px 0 0; font-size: clamp(19px, 2.4vw, 23px); font-weight: 800; letter-spacing: -.01em; color: #FBF3EC; }
  .arc-sec-count { font-family: var(--font-english, ui-monospace, monospace); font-size: 11px; font-weight: 800; color: rgba(240,234,224,.6); background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14); border-radius: 999px; padding: 3px 9px; font-variant-numeric: tabular-nums; }
  .arc-sec-badge { flex-shrink: 0; font-size: 11px; font-weight: 800; letter-spacing: .02em; padding: 6px 12px; border-radius: 999px; border: 1px solid transparent; }
  .arc-sec-badge[data-tone="live"] { color: #E6C275; background: rgba(176,132,58,.16); border-color: rgba(212,168,86,.36); }
  .arc-sec-badge[data-tone="muted"] { color: rgba(246,232,224,.66); background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.14); }
  .arc-sec-desc { margin: 10px 0 18px; max-width: 68ch; font-size: 12.5px; line-height: 1.65; color: rgba(240,226,220,.58); word-break: keep-all; }
  .arc-sec-link { color: rgba(255,225,200,.9); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
  .arc-sec-link:hover { color: #fff; }

  .arc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(14px, 1.8vw, 20px); }
  @media (max-width: 860px) { .arc-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 560px) { .arc-grid { grid-template-columns: 1fr; } }

  /* 카드 = 공통 잉크 베이스 + 게임 무드 22% 틴트. 색은 장식이 아니라 식별 신호.
     (이전엔 카드마다 100% 채도 그라디언트 → 19색 무지개로 시선이 분산됐다) */
  .arc-card {
    position: relative; overflow: hidden; isolation: isolate;
    display: flex; flex-direction: column; gap: 14px; min-height: 208px; padding: 22px 22px 18px;
    border-radius: 20px; text-decoration: none; color: #F2ECE3;
    background:
      linear-gradient(158deg, color-mix(in srgb, var(--m-a) 24%, #171310) 0%, #131009 62%, #14171E 100%);
    border: 1px solid rgba(255,255,255,.10);
    box-shadow: 0 20px 44px -24px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.09);
    transition: transform .42s cubic-bezier(.2,.8,.2,1), box-shadow .42s cubic-bezier(.2,.8,.2,1), border-color .42s ease;
  }
  /* 상단 2px 액센트 엣지 — 게임 정체성을 색면이 아닌 얇은 신호로 */
  .arc-card::before { content: ''; position: absolute; inset: 0 0 auto 0; height: 2px; pointer-events: none;
    background: linear-gradient(90deg, var(--m-accent), transparent 72%); opacity: .55; transition: opacity .42s ease; }
  .arc-card:hover::before, .arc-card--family:hover::before { opacity: 1; }
  .arc-card-glow { position: absolute; inset: 0; z-index: -1; pointer-events: none;
    background: radial-gradient(72% 54% at 26% 4%, var(--m-glow), transparent 64%); opacity: .30; transition: opacity .42s ease; }
  .arc-card::after, .arc-daily-card::after { content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none; border-radius: inherit;
    background: linear-gradient(180deg, rgba(255,255,255,.10), transparent 34%); }
  .arc-card:hover { transform: translateY(-5px); border-color: color-mix(in srgb, var(--m-accent) 34%, rgba(255,255,255,.10));
    box-shadow: 0 30px 58px -24px rgba(0,0,0,.85), 0 0 32px -14px var(--m-glow); }
  .arc-card:hover .arc-card-glow, .arc-daily-card:hover .arc-card-glow { opacity: .62; }
  .arc-card:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--m-accent), 0 22px 48px -22px rgba(0,0,0,.75); }

  .arc-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .arc-chips { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 5px; }
  .arc-mark { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 12px;
    color: var(--m-accent); background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.14);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.25), 0 4px 14px -4px rgba(0,0,0,.4); }
  .arc-mark svg { width: 26px; height: 26px; filter: drop-shadow(0 0 6px var(--m-glow)); }
  .arc-chip { font-family: var(--font-english, ui-monospace, monospace); font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
    color: rgba(240,234,224,.78); background: rgba(0,0,0,.28); padding: 5px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,.16); backdrop-filter: blur(4px); }
  .arc-chip--3d { color: #EAF6FF; background: rgba(120,190,255,.24); border-color: rgba(180,220,255,.36); }
  .arc-chip--beta { color: #FFE7C2; background: rgba(255,180,110,.22); border-color: rgba(255,200,150,.36); }
  .arc-chip--modes { color: var(--m-accent); background: rgba(255,255,255,.16); border-color: rgba(255,255,255,.3); }

  /* ── 계열 카드 — 같은 인출, 다른 재미. 카드는 컨테이너, 모드 칩이 링크 ── */
  .arc-card--family { cursor: default; grid-column: span 2; min-height: 208px; }
  .arc-card--family:hover { transform: none; box-shadow: 0 22px 48px -22px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.18); }
  @media (max-width: 560px) { .arc-card--family { grid-column: span 1; } }
  .arc-modes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 14px 0 0; padding: 0; list-style: none; }
  @media (max-width: 560px) { .arc-modes { grid-template-columns: 1fr; } }
  .arc-mode { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 8px 12px; border-radius: 12px; text-decoration: none;
    background: rgba(0,0,0,.20); border: 1px solid rgba(255,255,255,.16); color: #fff;
    transition: background-color .2s var(--ease, ease), border-color .2s var(--ease, ease), transform .2s var(--ease, ease); }
  .arc-mode:hover { background: rgba(255,255,255,.16); border-color: rgba(255,255,255,.34); transform: translateX(2px); }
  .arc-mode:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,255,255,.6); }
  .arc-mode-name { font-size: 13px; font-weight: 800; letter-spacing: -.01em; white-space: nowrap; }
  .arc-mode-note { flex: 1; min-width: 0; font-size: 11px; line-height: 1.3; color: rgba(255,255,255,.7); word-break: keep-all; }
  .arc-mode .arc-arrow { font-size: 12px; color: var(--m-accent); }
  .arc-mode:hover .arc-arrow { transform: translateX(3px); }
  @media (prefers-reduced-motion: reduce) { .arc-mode { transition: none; } }

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
