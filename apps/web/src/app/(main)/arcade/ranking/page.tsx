// apps/web/src/app/(main)/arcade/ranking/page.tsx — /arcade/ranking
//
// Game Lab 랭킹 — 내 랭크 요약 + 게임별 순위표.
//
// ── 무엇을 랭킹이라 부를 것인가 ──────────────────────────────────
// 원점수를 전 게임에 걸쳐 더하지 않는다. 실측(2026-08-25 · scores 43행)상 같은 "점수" 가
// 게임마다 다른 단위이고(cascade 0~900 · pairflip 0~1460 · scriptquiz 0~40) 풀 크기와
// 세션 길이에 비례한다. 더하면 "누가 큰 단어장을 골랐나" 를 재는 순위가 된다.
//   · 게임별 순위표 → 원점수 (같은 게임 안에서는 단위가 같다)
//   · 종합         → 게임별 백분위의 평균 (`overallRank`)
//
// ── 표본을 숨기지 않는다 ─────────────────────────────────────────
// 지금 이 DB 의 참가자는 2명이다. 그 상태에서 "1위" 를 트로피와 함께 띄우면 학습자는
// 한 번 기뻐하고 두 번째부터 이 앱의 모든 수치를 의심한다. 참가자 수를 매 순위표에
// 적고, 혼자인 게임에서는 순위 대신 개인 최고를 말한다(`rankLine`).
//
// 랭킹은 로그인 표면이다 — /arcade 카탈로그는 공개지만 RPC 는 authenticated 전용이다.

import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'

import RankingBoard, { RANKING_CSS } from '@/components/game/RankingBoard'
import { GAME_CATALOG, type GameSlug } from '@/lib/game/catalog'
import {
  fetchLeaderboard,
  fetchRankSummary,
  overallRank,
  rankLine,
  RANK_PERIODS,
  type Leaderboard,
  type RankPeriod,
} from '@/lib/game/ranking'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: '랭킹 · Game Lab · Vocaflow' }
export const dynamic = 'force-dynamic'

/** 한 화면에 그릴 순위표 수 — 전 19종을 세로로 깔면 목록이지 랭킹이 아니다. */
const BOARDS_ON_PAGE = 6

function readPeriod(sp: Record<string, string | string[] | undefined>): RankPeriod {
  const raw = Array.isArray(sp.period) ? sp.period[0] : sp.period
  return raw === 'all' || raw === 'week' || raw === 'month' ? raw : 'week'
}

export default async function ArcadeRankingPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const period = readPeriod(searchParams ?? {})
  const client = (await createClient()) as unknown as SupabaseClient
  const {
    data: { user },
  } = await client.auth.getUser()

  const summary = user ? await fetchRankSummary(client, period) : []
  const overall = overallRank(summary)

  // 어느 게임의 순위표를 그릴까 —
  //   ① 내가 기록을 남긴 게임(내 순위가 있는 곳이 가장 궁금하다)
  //   ② 모자라면 카탈로그 순서로 채운다(빈 순위표도 "첫 기록을 남기면 올라옵니다" 를 말한다)
  const mine = summary.map((s) => s.module)
  const filler = GAME_CATALOG.map((g) => g.slug).filter((s) => !mine.includes(s))
  const slugs: GameSlug[] = [...mine, ...filler].slice(0, BOARDS_ON_PAGE)

  const boards: Leaderboard[] = await Promise.all(
    slugs.map((slug) => fetchLeaderboard(client, slug, period, 5)),
  )

  return (
    <div className="rkp">
      <style dangerouslySetInnerHTML={{ __html: RANKING_CSS + PAGE_CSS }} />

      <header className="rkp-head">
        <p className="rkp-eyebrow">Game Lab · Standings</p>
        <h1 className="rkp-title">랭킹</h1>
        <p className="rkp-sub">
          점수는 <strong>게임 안에서만</strong> 비교해요. 게임마다 점수 단위가 다르고
          단어 수에 따라 커지기 때문에, 전부 더해 줄 세우면 “누가 큰 단어장을 골랐나”를 재게 됩니다.
        </p>
      </header>

      <nav className="rkp-periods" aria-label="기간 선택">
        {RANK_PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`/arcade/ranking?period=${p.key}`}
            className="rkp-period"
            aria-current={p.key === period ? 'true' : undefined}
            data-active={p.key === period ? '' : undefined}
          >
            <span className="rkp-period-label">{p.label}</span>
            <span className="rkp-period-note">{p.note}</span>
          </Link>
        ))}
      </nav>

      {!user ? (
        <p className="rkp-gate">
          랭킹은 로그인하면 볼 수 있어요. 게임은 로그인 없이도 둘러볼 수 있습니다 —{' '}
          <Link href="/arcade">Game Lab 으로</Link>
        </p>
      ) : (
        <section className="rkp-me" aria-label="내 랭크">
          <h2 className="rkp-me-title">내 랭크</h2>
          {summary.length === 0 ? (
            <p className="rkp-me-empty">
              이 기간에는 아직 기록이 없어요. <Link href="/arcade">아무 게임이나 한 판</Link> 돌리면
              여기에 순위가 생깁니다.
            </p>
          ) : (
            <>
              <div className="rkp-stats">
                <div className="rkp-stat">
                  <span className="rkp-stat-n">{overall.playedGames}</span>
                  <span className="rkp-stat-k">플레이한 게임</span>
                </div>
                {/* 백분위는 표본이 있을 때만 말한다.
                    2명짜리 게임에서 2위는 백분위 0 이고, 그것을 "상위 100%" 로 옮기면
                    **꼴찌가 최고 성적처럼 읽힌다** — 실제로 그 화면을 만들었다가 잡았다.
                    표본이 작으면 대신 "1위인 게임" 을 센다: 참이고, 오해될 여지가 없다. */}
                <div className="rkp-stat">
                  <span className="rkp-stat-n">
                    {overall.percentileMeaningful && overall.meanPercentile != null
                      ? `상위 ${Math.max(1, Math.round(100 - overall.meanPercentile))}%`
                      : overall.rankedGames > 0
                        ? overall.topFinishes
                        : '—'}
                  </span>
                  <span className="rkp-stat-k">
                    {overall.percentileMeaningful
                      ? `${overall.rankedGames}종 평균`
                      : overall.rankedGames > 0
                        ? `1위인 게임 · 겨룬 ${overall.rankedGames}종`
                        : '아직 겨룰 상대가 없어요'}
                  </span>
                </div>
                <div className="rkp-stat">
                  <span className="rkp-stat-n">{overall.soloBests}</span>
                  <span className="rkp-stat-k">나만 기록한 게임</span>
                </div>
              </div>

              <ul className="rkp-mine">
                {summary.map((s) => (
                  <li key={s.module} className="rkp-mine-row">
                    <Link href={`/play/${s.module}`} className="rkp-mine-link">
                      <span className="rkp-mine-name">{gameName(s.module)}</span>
                      <span className="rkp-mine-line">{rankLine(s)}</span>
                      <span className="rkp-mine-plays">{s.plays}판</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section className="rkp-boards" aria-label="게임별 순위표">
        <h2 className="rkp-boards-title">게임별 순위</h2>
        <div className="rkp-grid">
          {boards.map((b) => (
            <RankingBoard key={b.module} board={b} />
          ))}
        </div>
        <p className="rkp-more">
          여기 없는 게임의 순위는 그 게임을 한 판 돌리면 이 목록 맨 앞으로 올라와요 ·{' '}
          <Link href="/arcade">Game Lab 전체 보기</Link>
        </p>
      </section>
    </div>
  )
}

function gameName(slug: GameSlug): string {
  return GAME_CATALOG.find((g) => g.slug === slug)?.name ?? slug
}

const PAGE_CSS = `
.rkp{
  min-height: 100vh;
  padding: 36px 20px 64px;
  background: radial-gradient(1200px 600px at 50% -10%, #221B33 0%, #12101A 46%, #0C0A12 100%);
  color: rgba(255,255,255,.9);
}
.rkp > * { max-width: 940px; margin-left:auto; margin-right:auto; }
.rkp-head{ margin-bottom: 20px; }
.rkp-eyebrow{ margin:0 0 6px; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color: rgba(255,255,255,.44); }
.rkp-title{ margin:0; font-size:30px; font-weight:660; letter-spacing:-.02em; }
.rkp-sub{ margin:10px 0 0; max-width:64ch; font-size:13.5px; line-height:1.72; color: rgba(255,255,255,.58); }
.rkp-sub strong{ color: rgba(255,255,255,.85); font-weight:620; }

.rkp-periods{ display:flex; gap:8px; flex-wrap:wrap; margin-bottom:22px; }
.rkp-period{
  display:flex; flex-direction:column; gap:4px; min-height:56px; justify-content:center;
  padding:8px 16px; border-radius:12px; text-decoration:none;
  border:1px solid rgba(255,255,255,.10); background: rgba(255,255,255,.03);
  transition: border-color .18s cubic-bezier(.2,.7,.3,1), background .18s cubic-bezier(.2,.7,.3,1);
}
.rkp-period:hover{ border-color: rgba(255,255,255,.26); background: rgba(255,255,255,.055); }
.rkp-period:focus-visible{ outline:2px solid rgba(255,255,255,.65); outline-offset:2px; }
.rkp-period[data-active]{ border-color: rgba(255,255,255,.5); background: rgba(255,255,255,.09); }
.rkp-period-label{ font-size:13px; font-weight:650; color: rgba(255,255,255,.9); }
.rkp-period-note{ font-size:11px; color: rgba(255,255,255,.42); }

.rkp-gate{
  margin:0 auto 26px; padding:16px 20px; border-radius:14px; max-width:64ch;
  border:1px solid rgba(255,255,255,.10); background: rgba(255,255,255,.03);
  font-size:13px; line-height:1.7; color: rgba(255,255,255,.62);
}
.rkp-gate a, .rkp-me-empty a, .rkp-more a{ color: rgba(255,255,255,.9); }

.rkp-me{
  margin-bottom:28px; padding:20px 20px 16px; border-radius:18px;
  border:1px solid rgba(255,255,255,.10);
  background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.018));
}
.rkp-me-title{ margin:0 0 14px; font-size:16px; font-weight:640; }
.rkp-me-empty{ margin:0; font-size:13px; line-height:1.7; color: rgba(255,255,255,.6); }

.rkp-stats{ display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-bottom:16px; }
.rkp-stat{
  display:grid; gap:4px; padding:12px 16px; border-radius:12px;
  background: rgba(255,255,255,.035); border:1px solid rgba(255,255,255,.07);
}
.rkp-stat-n{ font-size:21px; font-weight:660; font-variant-numeric: tabular-nums; }
.rkp-stat-k{ font-size:11.5px; color: rgba(255,255,255,.48); }

.rkp-mine{ list-style:none; margin:0; padding:0; display:grid; gap:4px; }
.rkp-mine-link{
  display:grid; grid-template-columns: minmax(0,1fr) auto; align-items:center;
  gap:4px 12px; padding:12px 12px; border-radius:11px; text-decoration:none;
  border:1px solid rgba(255,255,255,.07); background: rgba(255,255,255,.022);
  transition: border-color .18s cubic-bezier(.2,.7,.3,1), background .18s cubic-bezier(.2,.7,.3,1);
}
.rkp-mine-link:hover{ border-color: rgba(255,255,255,.24); background: rgba(255,255,255,.05); }
.rkp-mine-link:focus-visible{ outline:2px solid rgba(255,255,255,.6); outline-offset:2px; }
.rkp-mine-name{ font-size:14px; font-weight:620; color: rgba(255,255,255,.92); }
.rkp-mine-plays{ grid-row:1 / span 2; font-size:12px; color: rgba(255,255,255,.44); font-variant-numeric: tabular-nums; }
.rkp-mine-line{ grid-column:1; font-size:12px; color: rgba(255,255,255,.55); }

.rkp-boards-title{ margin:0 0 13px; font-size:16px; font-weight:640; }
.rkp-grid{ display:grid; gap:12px; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
.rkp-more{ margin:16px 0 0; font-size:12px; color: rgba(255,255,255,.45); }

@media (max-width: 560px){
  .rkp{ padding:28px 16px 52px; }
  .rkp-title{ font-size:25px; }
  .rkp-stats{ grid-template-columns: 1fr; }
  .rkp-grid{ grid-template-columns: 1fr; }
}
`
