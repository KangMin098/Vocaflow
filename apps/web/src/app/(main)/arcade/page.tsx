// apps/web/src/app/(main)/arcade/page.tsx — /arcade
// Game Lab — 단어를 실험하는 연구소. 플랫폼 Reading Room 아트 디렉션의 야간 대응면.
//
// 라우트 그룹 (main) — 허브는 세션이 아니다. 이전에는 (app)(=SessionFrame 전용 풀스크린 그룹)에
// 있어 Sidebar·FlowNav 가 통째로 사라졌고, 그래서 사이드바에 넣을 수도 없었다.
// 게임 본체(/play/*)만 (app) 에 남는다.
//
// ── IA (v08.3 재설계 — "아케이드" → "Game Lab") ────────────────────
//   ① Lab Status      — 스트릭 · 랭크 · 오늘의 할당량 · 앰비언트
//   ② Lab Index       — 구역 바로가기. 19종이 한 화면에 깔리므로 목차가 있어야 한다.
//   ③ Today's Experiment — 결정론적 회전. "고르지 않아도 시작되는" 기본값.
//   ④ Bay 01/02/03    — Recall · Synthesis · Inference. 학습 동사별 구역.
//
//   왜 "연구소" 인가:
//     이전 은유는 "저녁의 서재 + 아케이드" 였다. 그런데 이 화면이 실제로 하는 일은
//     19개의 서로 다른 **실험 장치**를 늘어놓고 오늘 어느 것을 돌릴지 고르게 하는 것이다.
//     서재는 "읽는 곳" 이라 고르는 행위에 이름을 주지 못했고, 아케이드는 오락실이라
//     각 게임이 왜 다른 판돈 구조를 갖는지(시계·거리·자본·박) 설명할 자리가 없었다.
//     연구소 은유는 그 둘을 다 준다 — 구역(Bay) · 실험 코드(RC-01) · 프로토콜(브리핑) ·
//     시운전(Trial Run). 명명이 영문인 이유도 같다: 코드·구역 같은 **구조 라벨**은
//     짧고 고유해야 기억에 남는다. 설명 문장은 한국어로 남긴다(대상 독자).
//
//   ⑤ Protocol 다이얼로그 — v08.3 신설. 카드 우상단 (?) 버튼.
//     이전에는 게임을 고르는 근거가 이름·색·한 줄 태그라인뿐이었다. 19종은 저마다
//     판돈 구조가 다르고 그 차이가 곧 존재 이유인데, 학습자는 들어가 봐야만 알 수 있었다.
//     → 보드 그림 3장(초기/성공/실패) + 눌러서 통과하는 Trial Run 을 붙였다.
//     데이터는 lib/game/brief 단일 출처, 렌더는 components/game/brief/*.
//
//   게임 정의(이름·무드·마크·소스)는 lib/game/catalog 단일 출처 — 이 파일은 배치만 한다.

import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

import ArcadeMetaStrip from '@/components/game/ArcadeMetaStrip';
import BriefButton from '@/components/game/brief/BriefButton';
import { hasBrief } from '@/lib/game/brief';
import {
  GAME_COUNT,
  GAME_MARKS,
  countHubGames,
  gamePlayHref,
  hubSections,
  HUB_TRACKS,
  kstDayIndex,
  pickDailyGame,
  trackOf,
  type GameEntry,
  type GameFamily,
  type HubItem,
} from '@/lib/game/catalog';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Game Lab · Vocaflow' };
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

/**
 * 자료 스코프 — 도서 챕터 / 공용 단어장(`?set=` + `?chapter=`) · 사용자 스크립트(`?text=`).
 *
 * v07.8 이전 결함: 허브의 모든 카드가 `gamePlayHref(slug, { from: '/arcade' })` 로
 * 하드코딩돼 있어, 도서·단어장에서 `?set=` 을 달고 허브에 와도 게임으로 넘어가는 순간
 * 스코프가 증발했다. 그래서 "도서로 아케이드를 플레이"하는 경로가 사실상 없었다.
 */
interface HubScope {
  set?: string;
  text?: string;
  chapter: number | null;
  /** 스코프가 걸려 있으면 자료명(배너 표기용). */
  label?: string;
  /** 이 스코프를 유지한 허브 URL — 게임의 `from`(복귀) 으로 쓴다. */
  selfHref: string;
  active: boolean;
}

function readScope(sp: Record<string, string | string[] | undefined>): Omit<HubScope, 'label'> {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  const set = one(sp.set);
  const text = one(sp.text);
  const chRaw = Number(one(sp.chapter));
  const chapter = Number.isInteger(chRaw) && chRaw > 0 ? chRaw : null;
  const q = new URLSearchParams();
  if (set) q.set('set', set);
  if (text) q.set('text', text);
  if (chapter != null) q.set('chapter', String(chapter));
  const qs = q.toString();
  return { set, text, chapter, selfHref: qs ? `/arcade?${qs}` : '/arcade', active: !!(set || text) };
}

/**
 * 카드 링크에 실을 인자. `from` 도 스코프를 유지한 허브 URL 이어야 한다 —
 * 게임에서 나갔을 때 스코프가 풀린 허브로 떨어지면 "이 도서로 여러 게임 돌기"가 끊긴다.
 */
function scopedHref(scope: HubScope) {
  return { set: scope.set, text: scope.text, chapter: scope.chapter, from: scope.selfHref };
}

/** 배너에 쓸 자료명. 실패해도 배너만 덜 친절해질 뿐이라 조용히 폴백. */
async function fetchScopeLabel(scope: { set?: string; text?: string }): Promise<string | undefined> {
  if (!scope.set && !scope.text) return undefined;
  try {
    const client = (await createClient()) as unknown as SupabaseClient;
    if (scope.set) {
      const { data } = await client.from('shared_word_sets').select('title').eq('id', scope.set).maybeSingle();
      return (data as { title?: string } | null)?.title ?? undefined;
    }
    const { data } = await client.from('texts').select('title').eq('id', scope.text!).maybeSingle();
    return (data as { title?: string } | null)?.title ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * 실험 코드 — 구역 접두 + 그 구역 안의 표시 순번(RC-01 · SY-03 …).
 * 카드와 Protocol 다이얼로그가 같은 코드를 쓰므로 "방금 본 그 카드" 가 이어진다.
 * 카탈로그 순서에서 파생하므로 게임을 추가하면 코드가 자동으로 따라온다.
 */
function labCode(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(2, '0')}`;
}

export default async function ArcadePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const base = readScope(searchParams ?? {});
  const [stats, label] = await Promise.all([fetchVocabStats(), fetchScopeLabel(base)]);
  const scope: HubScope = { ...base, label };
  const mineReady = stats.total >= MINE_READY_THRESHOLD;
  const daily = pickDailyGame(kstDayIndex(), stats.total);
  // 같은 인지 루프를 공유하는 계열은 한 장으로 접힌다(중복 체감 제거).
  const sections = hubSections();
  const dailyTrack = HUB_TRACKS.find((t) => t.key === trackOf(daily.slug));

  return (
    <div className="arc-scene">
      <style dangerouslySetInnerHTML={{ __html: ARC_CSS }} />
      <div className="arc-glow" aria-hidden="true" />
      <div className="arc-grain" aria-hidden="true" />
      <div className="arc-vig" aria-hidden="true" />

      <div className="arc-inner">
        <header className="arc-head">
          <p className="arc-eyebrow">Vocaflow Research Division · {GAME_COUNT} Experiments</p>
          <h1 className="arc-title">Game Lab</h1>
          <p className="arc-sub">
            단어를 실험하는 곳. 구역마다 다른 장치가 놓여 있고, 저마다 다른 것을 걸게 합니다 —
            시계 · 거리 · 자본 · 박(拍).
          </p>
        </header>

        <ArcadeMetaStrip />

        {/* Lab Index — 19종이 한 화면에 깔리므로 목차가 필요하다.
            (Progressive Disclosure: 전부 보여주되 어디로 갈지는 먼저 고르게) */}
        <nav className="arc-index" aria-label="Lab index">
          <a className="arc-index-link" href="#bay-today">
            <span className="arc-index-name">Today</span>
            <span className="arc-index-num">1</span>
          </a>
          {HUB_TRACKS.map((t) => (
            <a key={t.key} className="arc-index-link" href={`#bay-${t.key}`}>
              <span className="arc-index-name">{t.title}</span>
              <span className="arc-index-num">{countHubGames(sections[t.key])}</span>
            </a>
          ))}
        </nav>

        {/* 자료 스코프 배너 — 지금 어떤 자료의 단어로 노는지, 그리고 푸는 길. */}
        {scope.active && (
          <div className="arc-scope" role="status">
            <span className="arc-scope-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10l2 2.5h6.5A1.5 1.5 0 0 1 20 8v10.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5Z" />
              </svg>
            </span>
            <span className="arc-scope-text">
              <span className="arc-scope-tag">Specimen loaded</span>
              <strong>{scope.label ?? (scope.set ? '선택한 단어장' : '선택한 스크립트')}</strong>
              {scope.chapter != null && <span className="arc-scope-ch"> · Chapter {scope.chapter}</span>}
              <span className="arc-scope-sub">의 단어로 플레이합니다 — 아래 게임 전부에 적용돼요.</span>
            </span>
            <Link href="/arcade" className="arc-scope-clear">
              해제
            </Link>
          </div>
        )}

        {/* ① Today's Experiment — 고르지 않아도 시작되는 기본값 */}
        <DailyPick
          game={daily}
          mineReady={mineReady}
          stats={stats}
          scope={scope}
          code={dailyTrack ? `${dailyTrack.code}·TODAY` : 'TODAY'}
        />

        {/* ②③④ 구역(Bay) — v07.8 에서 세운 학습 동사 축을 v08.3 에서 랩 구역으로 명명.
            이전 축은 "내 단어 / 큐레이션 뱅크" 였는데, 전 게임이 학습자 단어를 쓰게 되면서
            그 축이 죽었다(전부 한쪽으로 몰림). 지금 고를 때 실제로 궁금한 것은
            "지금 어떤 연습을 하고 싶은가" 이므로 재인 → 생성 → 추론 순으로 나눈다. */}
        {HUB_TRACKS.map((t, i) => (
          <GameSection
            key={t.key}
            id={t.key}
            code={t.code}
            eyebrow={t.eyebrow}
            title={t.title}
            desc={scope.active ? `${t.desc.split('. ')[0]}. 선택한 자료의 단어로 진행합니다.` : t.desc}
            items={sections[t.key]}
            gameCount={countHubGames(sections[t.key])}
            badge={i === 0 ? (scope.active ? '자료 적용됨' : mineBadge(mineReady, stats)) : undefined}
            badgeTone={scope.active || mineReady ? 'live' : 'muted'}
            action={
              i === 0 && !scope.active && !mineReady
                ? { href: '/wordvault', label: '단어 모으러 가기' }
                : undefined
            }
            scope={scope}
          />
        ))}

        {!scope.active && (
          <p className="arc-note">
            도서 챕터 · 공용 단어장 · 내 스크립트에서 <strong>“아케이드에서 플레이”</strong>로 들어오면
            그 자료의 단어가 이 페이지의 <strong>모든 실험</strong>에 적용됩니다.
            아무 것도 지정하지 않으면 복습 큐의 단어로 진행하고, 단어가 모자라면 맛보기로 열립니다
            (맛보기는 기억 곡선에 남지 않아요).
          </p>
        )}
        <p className="arc-credit">
          배경음악:{' '}
          <a href="https://creatorchords.com" target="_blank" rel="noopener noreferrer">
            Alexander Nakarada
          </a>
          {' · '}
          <a href="https://www.scottbuckley.com.au/" target="_blank" rel="noopener noreferrer">
            Scott Buckley
          </a>
          {' · '}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">
            CC-BY 4.0
          </a>
          {' · 효과음: Mixkit · 곡별 크레딧은 '}
          <a href="/audio/games/CREDITS.txt" target="_blank" rel="noopener noreferrer">
            CREDITS
          </a>
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

/** 오늘의 추천 카드 한 줄 — 단어 수가 0이어도 문장이 깨지지 않게. */
function dailyMeta(usesMyWords: boolean, s: VocabStats): string {
  // v07.8 — 이전 문구는 '큐레이션 콘텐츠 · 단어 없이 바로 시작' 이었다. 전 게임이 학습자
  // 단어를 쓰게 된 지금 "큐레이션 콘텐츠"는 거짓이다. 단어가 부족하면 맛보기로 degrade
  // 되고 그때는 FSRS 에 남지 않는다 — 그 사실을 숨기지 않는다.
  if (!usesMyWords) return '단어 없이 바로 시작 · 맛보기 단어로 진행(기록 안 됨)';
  return s.dueNow > 0
    ? `복습 임박한 내 단어 ${s.dueNow}개로 진행 · 기억 곡선 반영`
    : `내 단어 ${s.total}개로 진행 · 기억 곡선 반영`;
}

// ── ① Today's Experiment ─────────────────────────────────────────
function DailyPick({
  game,
  mineReady,
  stats,
  scope,
  code,
}: {
  game: GameEntry;
  mineReady: boolean;
  stats: VocabStats;
  scope: HubScope;
  code: string;
}) {
  const usesMyWords = game.source === 'mine' && mineReady;
  const href = gamePlayHref(game.slug, scopedHref(scope));
  return (
    <section className="arc-daily" id="bay-today" aria-labelledby="arc-daily-title">
      <Link
        href={href}
        className="arc-daily-card"
        data-design-card
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
          <span className="arc-daily-eyebrow">Today&rsquo;s Experiment</span>
          <h2 id="arc-daily-title" className="arc-daily-name">
            {game.name}
          </h2>
          <span className="arc-daily-tag">{game.tagline}</span>
          <span className="arc-daily-meta">
            {scope.active
              ? `${scope.label ?? '선택한 자료'}${scope.chapter != null ? ` · Chapter ${scope.chapter}` : ''} 의 단어로 진행`
              : dailyMeta(usesMyWords, stats)}
          </span>
        </span>
        <span className="arc-daily-cta">
          Start <span className="arc-arrow">→</span>
        </span>
      </Link>
      {hasBrief(game.slug) && (
        <div className="arc-daily-aside">
          <BriefButton
            variant="pill"
            subject={game.name}
            entries={[{ slug: game.slug, href, code }]}
          />
        </div>
      )}
    </section>
  );
}

// ── ②③④ 구역 ────────────────────────────────────────────────────
function GameSection({
  id,
  code,
  eyebrow,
  title,
  desc,
  items,
  gameCount,
  badge,
  badgeTone,
  action,
  scope,
}: {
  id: string;
  /** 실험 코드 접두 (RC · SY · IN) */
  code: string;
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
  scope: HubScope;
}) {
  return (
    <section className="arc-sec" id={`bay-${id}`} aria-labelledby={`arc-sec-${id}`}>
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
        {items.map((item, i) =>
          item.kind === 'game' ? (
            <GameCard key={item.game.slug} game={item.game} scope={scope} code={labCode(code, i)} />
          ) : (
            <FamilyCard
              key={item.family.key}
              family={item.family}
              modes={item.modes}
              scope={scope}
              code={labCode(code, i)}
            />
          ),
        )}
      </div>
    </section>
  );
}

// ── 단독 게임 카드 ───────────────────────────────────────────────
//
// 카드 본체는 `<a>` 여야 한다(새 탭·주소 복사·프리페치·e2e 계약). 브리핑 트리거는
// 중첩 인터랙티브가 되지 않도록 **형제**로 두고 우상단에 겹친다(.arc-slot).
function GameCard({ game: g, scope, code }: { game: GameEntry; scope: HubScope; code: string }) {
  const href = gamePlayHref(g.slug, scopedHref(scope));
  return (
    <div className="arc-slot">
      <Link href={href} className="arc-card" data-design-card style={moodVars(g.mood)}>
        <span className="arc-card-glow" aria-hidden="true" />
        <div className="arc-card-top">
          <span className="arc-mark">
            <Mark slug={g.slug} />
          </span>
          <span className="arc-chips">
            {g.is3d && <span className="arc-chip arc-chip--3d">3D</span>}
            {g.beta && <span className="arc-chip arc-chip--beta">베타</span>}
          </span>
        </div>
        <div className="arc-card-body">
          {/* data-design-title — 격자 안 메타 제목. 계측이 줄 수 균질성을 본다 */}
          <h3 data-design-title className="arc-name">
            {g.name}
          </h3>
          <p className="arc-tag">{g.tagline}</p>
        </div>
        <div className="arc-card-foot">
          <span className="arc-ref">
            <span className="arc-code">{code}</span>
            {g.layer}
          </span>
          <span className="arc-play">
            Play <span className="arc-arrow">→</span>
          </span>
        </div>
      </Link>
      {hasBrief(g.slug) && (
        <BriefButton subject={g.name} entries={[{ slug: g.slug, href, code }]} />
      )}
    </div>
  );
}

// ── 계열 카드 — 같은 인출을 여러 재미로 ──────────────────────────
//
// 카드 자체는 링크가 아니다(중첩 <a> 금지). 모드 칩 하나하나가 실제 플레이 링크.
// "왜 비슷한 게 여러 개인가"에 답하려면 공통점(인출)과 차이(동기 장치)를 같이 보여야 한다.
function FamilyCard({
  family: f,
  modes,
  scope,
  code,
}: {
  family: GameFamily;
  modes: GameEntry[];
  scope: HubScope;
  code: string;
}) {
  const entries = modes
    .filter((m) => hasBrief(m.slug))
    .map((m, i) => ({
      slug: m.slug,
      href: gamePlayHref(m.slug, scopedHref(scope)),
      code: `${code}${String.fromCharCode(97 + i)}`,
      tabLabel: m.modeLabel ?? m.name,
    }));

  return (
    <div className="arc-slot arc-slot--family">
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
            <span className="arc-chip arc-chip--modes">{modes.length} modes</span>
          </span>
        </div>
        <div className="arc-card-body">
          <h3 id={`arc-fam-${f.key}`} data-design-title className="arc-name">
            {f.name}
          </h3>
          <p className="arc-tag">{f.tagline}</p>
        </div>
        <ul className="arc-modes">
          {modes.map((m) => (
            <li key={m.slug}>
              <Link href={gamePlayHref(m.slug, scopedHref(scope))} className="arc-mode">
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
          <span className="arc-ref">
            <span className="arc-code">{code}</span>
            {f.layer}
          </span>
        </div>
      </div>
      {entries.length > 0 && (
        <BriefButton subject={f.name} familyName={f.name} entries={entries} />
      )}
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
  /* ── 아트 디렉션 ───────────────────────────────────────────────
     플랫폼(Reading Room — deep ink #0F2540 · paper #FBFAF6 · muted gold #B0843A,
     Linear식 단일 액센트 5% 미만)과 접점을 유지한다. 앱의 **다크 테마 캔버스
     (warm dark paper #181410)** 를 바닥으로 깔고 deep ink 를 한 겹 씌운 야간 실험실.
     게임별 개성은 풀블리드 색면이 아니라 **잉크 베이스 위 24% 틴트 + 2px 액센트 엣지 + 마크**로,
     금빛은 Today's Experiment 한 곳에만.
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
  .arc-eyebrow { margin: 0; font-family: var(--font-english, ui-monospace, monospace); font-size: 11px; font-weight: 700; letter-spacing: .28em; text-transform: uppercase; color: rgba(212,168,86,.78); }
  .arc-title { margin: 10px 0 0; font-size: clamp(38px, 7vw, 60px); font-weight: 800; letter-spacing: -.015em; line-height: 1; color: #FBF3EC;
    text-shadow: 0 2px 30px rgba(0,0,0,.4); }
  .arc-sub { margin: 16px 0 0; max-width: 48ch; font-size: clamp(14px, 1.4vw, 16px); line-height: 1.6; color: rgba(240,234,224,.66); word-break: keep-all; }

  .arc-meta { display: flex; flex-wrap: wrap; align-items: center; gap: clamp(14px, 3vw, 30px); margin: 0 0 clamp(14px, 2.5vh, 20px); padding: 14px 18px; border-radius: 16px;
    background: linear-gradient(150deg, rgba(255,255,255,.07), rgba(255,255,255,.02)); border: 1px solid rgba(255,255,255,.12); box-shadow: inset 0 1px 0 rgba(255,255,255,.12); }
  .arc-meta--ghost { min-height: 66px; }
  .arc-meta-item { display: flex; flex-direction: column; gap: 4px; }
  .arc-meta-num { font-size: 21px; font-weight: 800; color: #FBF3EC; font-variant-numeric: tabular-nums; letter-spacing: -.01em; display: inline-flex; align-items: baseline; gap: 5px; }
  .arc-meta-flame { font-size: 17px; }
  .arc-meta-lbl { font-family: var(--font-english, ui-monospace, monospace); font-size: 9.5px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: rgba(246,232,224,.62); display: flex; flex-direction: column; gap: 5px; }
  .arc-meta-level { min-width: 128px; }
  .arc-meta-goal { min-width: 158px; margin-left: auto; }
  .arc-meta-music { display: inline-flex; align-items: center; gap: 7px; min-height: 44px; padding: 0 14px; border-radius: 999px; cursor: pointer;
    font-family: var(--font-display, system-ui, sans-serif); font-size: 12px; font-weight: 700; letter-spacing: -.01em; white-space: nowrap;
    color: rgba(246,232,224,.76); background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.16);
    transition: color .15s var(--ease, ease), background-color .15s var(--ease, ease), border-color .15s var(--ease, ease), transform .12s var(--ease, ease); }
  .arc-meta-music:hover { color: #FBF3EC; background: rgba(255,255,255,.12); border-color: rgba(255,255,255,.28); }
  .arc-meta-music:active { transform: scale(.97); }
  .arc-meta-music:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,225,200,.45); }
  .arc-meta-music[data-on="1"] { color: #FFE0C4; background: rgba(255,184,132,.16); border-color: rgba(255,184,132,.4); }
  @media (prefers-reduced-motion: reduce) { .arc-meta-music { transition: none; } }
  .arc-meta-goal-total { font-size: 12px; font-weight: 700; color: rgba(246,232,224,.55); }
  .arc-meta-goal[data-met="1"] .arc-meta-num { color: #9BE8C0; }
  .arc-meta-bar { display: block; height: 5px; border-radius: 999px; background: rgba(255,255,255,.14); overflow: hidden; margin-top: 3px; }
  .arc-meta-bar--goal { width: 100%; }
  .arc-meta-bar-fill { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #FFB984, #F0A084); transition: width .5s cubic-bezier(.2,.8,.2,1); }
  .arc-meta-goal[data-met="1"] .arc-meta-bar-fill { background: linear-gradient(90deg, #7FE0A8, #9BE8C0); }

  /* ── Lab Index — 구역 목차 ── */
  .arc-index { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 clamp(20px, 3.5vh, 30px); }
  .arc-index-link { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px; border-radius: 999px;
    text-decoration: none; color: rgba(240,234,224,.76); background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.13);
    transition: background-color .15s var(--ease, ease), color .15s var(--ease, ease), border-color .15s var(--ease, ease); }
  .arc-index-link:hover { color: #FBF3EC; background: rgba(255,255,255,.11); border-color: rgba(255,255,255,.28); }
  .arc-index-link:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,225,200,.45); }
  .arc-index-name { font-size: 12.5px; font-weight: 700; letter-spacing: -.01em; }
  .arc-index-num { font-family: var(--font-english, ui-monospace, monospace); font-size: 10.5px; font-weight: 800; font-variant-numeric: tabular-nums;
    color: rgba(240,234,224,.62); background: rgba(0,0,0,.3); border-radius: 999px; padding: 2px 7px; }

  /* ── ① Today's Experiment ── */
  .arc-daily { margin: 0 0 clamp(30px, 5vh, 46px); scroll-margin-top: 20px; }
  /* 이 화면의 유일한 시그니처 모먼트.
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
  .arc-daily-meta { margin-top: 9px; font-size: 11.5px; font-weight: 700; letter-spacing: .01em; color: rgba(226,186,110,.95); }
  .arc-daily-cta { flex-shrink: 0; display: inline-flex; align-items: center; gap: 7px; padding: 11px 20px; border-radius: 999px;
    font-size: 14px; font-weight: 800; color: #17110A; background: linear-gradient(180deg,#E6C275,#C9A055);
    box-shadow: 0 8px 22px -8px rgba(0,0,0,.5); }
  .arc-daily-card:hover .arc-daily-cta { background: linear-gradient(180deg,#F0D08A,#D4A856); }
  .arc-daily-aside { display: flex; justify-content: flex-end; margin-top: 10px; }
  @media (max-width: 620px) {
    .arc-daily-card { flex-wrap: wrap; }
    .arc-daily-cta { width: 100%; justify-content: center; }
  }

  /* ── ②③④ 구역 ── */
  .arc-sec { margin: 0 0 clamp(32px, 5.5vh, 52px); scroll-margin-top: 20px; }
  .arc-sec-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; }
  .arc-sec-eyebrow { margin: 0; font-family: var(--font-english, ui-monospace, monospace); font-size: 10px; font-weight: 800; letter-spacing: .22em; text-transform: uppercase; color: rgba(240,234,224,.5); }
  .arc-sec-title { display: flex; align-items: center; gap: 9px; margin: 5px 0 0; font-size: clamp(19px, 2.4vw, 23px); font-weight: 800; letter-spacing: -.01em; color: #FBF3EC; }
  .arc-sec-count { font-family: var(--font-english, ui-monospace, monospace); font-size: 11px; font-weight: 800; color: rgba(240,234,224,.66); background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14); border-radius: 999px; padding: 3px 9px; font-variant-numeric: tabular-nums; }
  .arc-sec-badge { flex-shrink: 0; font-size: 11px; font-weight: 800; letter-spacing: .02em; padding: 6px 12px; border-radius: 999px; border: 1px solid transparent; }
  .arc-sec-badge[data-tone="live"] { color: #E6C275; background: rgba(176,132,58,.16); border-color: rgba(212,168,86,.36); }
  .arc-sec-badge[data-tone="muted"] { color: rgba(246,232,224,.7); background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.14); }
  .arc-sec-desc { margin: 10px 0 18px; max-width: 68ch; font-size: 12.5px; line-height: 1.65; color: rgba(240,226,220,.62); word-break: keep-all; }
  .arc-sec-link { color: rgba(255,225,200,.92); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
  .arc-sec-link:hover { color: #fff; }

  .arc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(14px, 1.8vw, 20px); }
  @media (max-width: 860px) { .arc-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 560px) { .arc-grid { grid-template-columns: 1fr; } }

  /* 카드 슬롯 — 카드(<a>) 와 브리핑 트리거(<button>) 를 형제로 담는다.
     중첩 인터랙티브를 만들지 않으면서 시각적으로는 한 장으로 읽히게. */
  .arc-slot { position: relative; display: flex; }
  .arc-slot--family { grid-column: span 2; }
  @media (max-width: 560px) { .arc-slot--family { grid-column: span 1; } }
  .arc-slot > .arc-card { flex: 1; min-width: 0; }

  /* 카드 = 공통 잉크 베이스 + 게임 무드 24% 틴트. 색은 장식이 아니라 식별 신호. */
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
  .arc-slot:hover .arc-card::before { opacity: 1; }
  .arc-card-glow { position: absolute; inset: 0; z-index: -1; pointer-events: none;
    background: radial-gradient(72% 54% at 26% 4%, var(--m-glow), transparent 64%); opacity: .30; transition: opacity .42s ease; }
  .arc-card::after, .arc-daily-card::after { content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none; border-radius: inherit;
    background: linear-gradient(180deg, rgba(255,255,255,.10), transparent 34%); }
  a.arc-card:hover { transform: translateY(-5px); border-color: color-mix(in srgb, var(--m-accent) 34%, rgba(255,255,255,.10));
    box-shadow: 0 30px 58px -24px rgba(0,0,0,.85), 0 0 32px -14px var(--m-glow); }
  .arc-card:hover .arc-card-glow, .arc-daily-card:hover .arc-card-glow { opacity: .62; }
  .arc-card:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--m-accent), 0 22px 48px -22px rgba(0,0,0,.75); }

  /* 우상단 44px 은 브리핑 트리거 자리 — 칩이 그 아래로 흐르지 않게 확보한다. */
  .arc-card-top { display: flex; align-items: flex-start; gap: 8px; padding-right: 44px; }
  .arc-chips { display: flex; flex-wrap: wrap; gap: 5px; padding-top: 4px; }
  .arc-mark { width: 42px; height: 42px; flex: none; display: grid; place-items: center; border-radius: 12px;
    color: var(--m-accent); background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.14);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.25), 0 4px 14px -4px rgba(0,0,0,.4); }
  .arc-mark svg { width: 26px; height: 26px; filter: drop-shadow(0 0 6px var(--m-glow)); }
  .arc-chip { font-family: var(--font-english, ui-monospace, monospace); font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
    color: rgba(240,234,224,.82); background: rgba(0,0,0,.28); padding: 5px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,.16); backdrop-filter: blur(4px); }
  .arc-chip--3d { color: #EAF6FF; background: rgba(120,190,255,.24); border-color: rgba(180,220,255,.36); }
  .arc-chip--beta { color: #FFE7C2; background: rgba(255,180,110,.22); border-color: rgba(255,200,150,.36); }
  .arc-chip--modes { color: var(--m-accent); background: rgba(255,255,255,.16); border-color: rgba(255,255,255,.3); }

  /* 브리핑 트리거 */
  .arc-brief { position: absolute; top: 14px; right: 14px; z-index: 2;
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    width: 44px; height: 44px; border-radius: 999px; cursor: pointer; font: inherit;
    color: rgba(240,234,224,.72); background: rgba(10,8,6,.5); border: 1px solid rgba(255,255,255,.16);
    backdrop-filter: blur(4px);
    transition: color .15s var(--ease, ease), background-color .15s var(--ease, ease), border-color .15s var(--ease, ease), transform .12s var(--ease, ease); }
  .arc-brief:hover { color: #FFF6EA; background: rgba(20,16,12,.8); border-color: color-mix(in srgb, var(--m-accent) 55%, rgba(255,255,255,.2)); }
  .arc-brief:active { transform: scale(.94); }
  .arc-brief:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,225,200,.6); }
  .arc-brief--pill { position: static; width: auto; padding: 0 16px; font-size: 12.5px; font-weight: 700; letter-spacing: -.01em;
    color: rgba(240,234,224,.8); background: rgba(255,255,255,.06); }
  @media (prefers-reduced-motion: reduce) { .arc-brief { transition: none; } }

  /* ── 계열 카드 — 같은 인출, 다른 재미. 카드는 컨테이너, 모드 칩이 링크 ── */
  .arc-card--family { cursor: default; min-height: 208px; }
  .arc-modes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 14px 0 0; padding: 0; list-style: none; }
  @media (max-width: 560px) { .arc-modes { grid-template-columns: 1fr; } }
  .arc-mode { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 8px 12px; border-radius: 12px; text-decoration: none;
    background: rgba(0,0,0,.20); border: 1px solid rgba(255,255,255,.16); color: #fff;
    transition: background-color .2s var(--ease, ease), border-color .2s var(--ease, ease), transform .2s var(--ease, ease); }
  .arc-mode:hover { background: rgba(255,255,255,.16); border-color: rgba(255,255,255,.34); transform: translateX(2px); }
  .arc-mode:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,255,255,.6); }
  .arc-mode-name { font-family: var(--font-english, ui-monospace, monospace); font-size: 12px; font-weight: 800; letter-spacing: .02em; white-space: nowrap; }
  .arc-mode-note { flex: 1; min-width: 0; font-size: 11px; line-height: 1.3; color: rgba(255,255,255,.74); word-break: keep-all; }
  .arc-mode .arc-arrow { font-size: 12px; color: var(--m-accent); }
  .arc-mode:hover .arc-arrow { transform: translateX(3px); }
  @media (prefers-reduced-motion: reduce) { .arc-mode { transition: none; } }

  .arc-card-body { margin-top: auto; }
  .arc-name { margin: 0; font-size: 21px; font-weight: 800; letter-spacing: -.01em; color: #fff; text-shadow: 0 1px 12px rgba(0,0,0,.28); }
  .arc-tag { margin: 5px 0 0; font-size: 13px; line-height: 1.4; color: rgba(255,255,255,.84); word-break: keep-all; }

  .arc-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-top: 14px; margin-top: 4px; border-top: 1px solid rgba(255,255,255,.14); }
  .arc-ref { display: inline-flex; align-items: center; gap: 7px; min-width: 0; font-size: 11px; letter-spacing: .01em; color: rgba(255,255,255,.64); }
  .arc-code { font-family: var(--font-english, ui-monospace, monospace); font-size: 10px; font-weight: 800; letter-spacing: .1em;
    color: var(--m-accent); background: rgba(0,0,0,.34); border: 1px solid rgba(255,255,255,.14); border-radius: 6px; padding: 2px 6px; }
  .arc-play { flex: none; display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-english, ui-monospace, monospace); font-size: 12px; font-weight: 800; letter-spacing: .04em; color: #fff; }
  .arc-arrow { display: inline-block; transition: transform .3s cubic-bezier(.2,.8,.2,1); }
  .arc-slot:hover .arc-arrow, .arc-daily-card:hover .arc-arrow { transform: translateX(4px); }

  .arc-note { margin: clamp(20px, 4vh, 34px) 0 0; font-size: 12.5px; line-height: 1.6; color: rgba(240,226,220,.56); max-width: 68ch; word-break: keep-all; }
  /* 자료 스코프 배너 — 도서/스크립트/단어장에서 들어왔을 때만. gold 액센트는 여기 한 곳. */
  .arc-scope { display: flex; align-items: center; gap: 11px; padding: 12px 16px; margin-bottom: clamp(20px, 3.5vh, 30px); border-radius: 14px;
    border: 1px solid rgba(212,168,86,.34); background: linear-gradient(140deg, rgba(212,168,86,.14), rgba(212,168,86,.05));
    box-shadow: inset 0 1px 0 rgba(255,255,255,.08); color: #F4EADB; }
  .arc-scope-mark { display: grid; place-items: center; width: 28px; height: 28px; flex: none; border-radius: 9px;
    background: rgba(212,168,86,.18); color: #E7C182; }
  .arc-scope-text { flex: 1; min-width: 0; font-size: 13.5px; line-height: 1.5; }
  .arc-scope-tag { display: block; font-family: var(--font-english, ui-monospace, monospace); font-size: 9.5px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: rgba(226,186,110,.95); }
  .arc-scope-text strong { font-weight: 800; color: #FFF3DF; }
  .arc-scope-ch { color: #E7C182; font-weight: 700; }
  .arc-scope-sub { color: rgba(240,230,215,.7); }
  .arc-scope-clear { flex: none; min-height: 44px; display: inline-flex; align-items: center; padding: 0 14px;
    border-radius: 999px; border: 1px solid rgba(255,255,255,.18); color: rgba(240,230,215,.84);
    font-size: 12.5px; font-weight: 700; text-decoration: none; transition: background .15s, color .15s, border-color .15s, transform .12s; }
  .arc-scope-clear:hover { background: rgba(255,255,255,.1); color: #FBF3EC; border-color: rgba(255,255,255,.3); }
  .arc-scope-clear:active { transform: scale(.97); }
  .arc-scope-clear:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,225,200,.45); }
  @media (max-width: 560px) { .arc-scope { flex-wrap: wrap; } .arc-scope-text { flex-basis: 100%; order: 2; } }
  @media (prefers-reduced-motion: reduce) { .arc-scope-clear { transition: none; } }

  .arc-credit { margin: 10px 0 0; font-size: 11px; color: rgba(240,226,220,.44); }
  .arc-credit a { color: rgba(240,226,220,.6); text-decoration: underline; }
  .arc-credit a:hover { color: rgba(255,225,200,.85); }

  @keyframes arc-drift { from { transform: translate3d(-2%, -1%, 0); } to { transform: translate3d(2%, 2.5%, 0); } }
  @media (prefers-reduced-motion: reduce) { .arc-glow { animation: none; } .arc-card, .arc-daily-card, .arc-arrow { transition: none; } }
`;
