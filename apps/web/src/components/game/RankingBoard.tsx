// apps/web/src/components/game/RankingBoard.tsx
//
// 순위표 한 장 — 게임 하나 · 기간 하나.
//
// ── 이 컴포넌트가 하지 않는 것 ───────────────────────────────────
// 트로피·폭죽·"당신은 챔피언!" 을 쓰지 않는다. CLAUDE.md 는 완주에 폭죽을 금지하고
// 차분한 마무리를 요구한다 — 순위도 같은 규칙 아래 있다. 1위는 굵은 글씨와 얇은 테두리로
// 충분하고, 그 이상은 학습이 아니라 도박의 문법이다.
//
// 그리고 **참가자 수를 숨기지 않는다.** 2명짜리 순위표에서 1위를 성취로 그리면 학습자는
// 한 번은 기뻐하고 두 번째에 이 앱의 모든 수치를 의심하게 된다.
//
// 서버 컴포넌트다 — 순위표는 정적이고, 기간 전환은 링크(쿼리)로 한다.

import Link from 'next/link'

import { GAME_MARKS, type GameSlug } from '@/lib/game/catalog'
import { rankGameName, sampleNote, type Leaderboard, type RankPeriod } from '@/lib/game/ranking'

export default function RankingBoard({
  board,
  /** 기간 탭이 가리킬 기본 경로 (쿼리는 이 컴포넌트가 붙인다) */
  basePath = '/arcade/ranking',
  /** 게임 이름을 제목으로 쓸지 — 종합 페이지에서는 켜고, 게임 상세에서는 끈다 */
  showTitle = true,
  periods,
}: {
  board: Leaderboard
  basePath?: string
  showTitle?: boolean
  periods?: { key: RankPeriod; label: string }[]
}) {
  const { rows, playerCount, period, module } = board
  // 상위 밖의 내 행은 순위가 뛰므로 사이에 구분선을 넣는다(연속처럼 보이면 거짓이 된다).
  const gapAt = rows.findIndex((r, i) => i > 0 && r.rank > rows[i - 1].rank + 1)

  return (
    <section className="rk" aria-label={`${rankGameName(module)} 순위표`}>
      {showTitle && (
        <header className="rk-head">
          <span className="rk-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              {GAME_MARKS[module as GameSlug]}
            </svg>
          </span>
          <h3 className="rk-title">{rankGameName(module)}</h3>
        </header>
      )}

      {periods && periods.length > 1 && (
        <nav className="rk-periods" aria-label="기간 선택">
          {periods.map((p) => (
            <Link
              key={p.key}
              href={`${basePath}?period=${p.key}`}
              className="rk-period"
              aria-current={p.key === period ? 'true' : undefined}
              data-active={p.key === period ? '' : undefined}
            >
              {p.label}
            </Link>
          ))}
        </nav>
      )}

      {rows.length === 0 ? (
        <p className="rk-empty">{sampleNote(0, period)}</p>
      ) : (
        <>
          <ol className="rk-rows">
            {rows.map((r, i) => (
              <li
                key={`${r.rank}-${r.label}`}
                className="rk-row"
                data-me={r.isMe ? '' : undefined}
                data-gap={i === gapAt ? '' : undefined}
              >
                <span className="rk-num" aria-label={`${r.rank}위`}>
                  {r.rank}
                </span>
                <span className="rk-who">
                  {r.label}
                  {r.isMe && <span className="rk-mine">나</span>}
                </span>
                <span className="rk-meta">
                  {r.plays}판
                  {r.bestAccuracy != null && <> · 정확도 {Math.round(r.bestAccuracy)}%</>}
                </span>
                <span className="rk-score">{r.bestScore.toLocaleString()}</span>
              </li>
            ))}
          </ol>
          <p className="rk-note">{sampleNote(playerCount, period)}</p>
        </>
      )}
    </section>
  )
}

/**
 * 순위표 스타일 — 쓰는 페이지가 자기 `<style>` 안에 함께 싣는다.
 * (Game Lab 계열 화면은 인라인 CSS 한 덩어리로 스코프를 맞춘다 — 별도 태그를 두면
 *  같은 화면에 토큰 정의가 둘 생긴다.)
 */
export const RANKING_CSS = `
.rk{
  padding: 18px 18px 15px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.10);
  background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.015));
}
.rk-head{ display:flex; align-items:center; gap:10px; margin-bottom:12px; }
.rk-mark{ width:22px; height:22px; color: rgba(255,255,255,.6); }
.rk-mark svg{ width:100%; height:100%; }
.rk-title{ margin:0; font-size:15px; font-weight:640; color: rgba(255,255,255,.92); }

.rk-periods{ display:flex; gap:6px; margin-bottom:12px; flex-wrap:wrap; }
.rk-period{
  display:inline-flex; align-items:center; min-height:36px; padding:0 12px;
  border-radius:999px; text-decoration:none; font-size:12px; font-weight:600;
  color: rgba(255,255,255,.56); border:1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.03);
  transition: color .18s cubic-bezier(.2,.7,.3,1), border-color .18s cubic-bezier(.2,.7,.3,1), background .18s cubic-bezier(.2,.7,.3,1);
}
.rk-period:hover{ color: rgba(255,255,255,.86); border-color: rgba(255,255,255,.24); }
.rk-period:focus-visible{ outline:2px solid rgba(255,255,255,.6); outline-offset:2px; }
.rk-period[data-active]{ color:#0F0D14; background: rgba(255,255,255,.86); border-color: transparent; }

.rk-rows{ list-style:none; margin:0; padding:0; display:grid; gap:2px; }
.rk-row{
  display:grid; grid-template-columns: 30px 1fr auto auto; align-items:center; gap:10px;
  padding:9px 10px; border-radius:9px; font-size:13px; color: rgba(255,255,255,.76);
}
.rk-row:nth-child(odd){ background: rgba(255,255,255,.022); }
.rk-row[data-me]{
  background: rgba(255,255,255,.075);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.16);
  color: rgba(255,255,255,.95);
}
/* 순위가 건너뛴 자리 — 연속처럼 보이면 순위표가 거짓을 말한다 */
.rk-row[data-gap]{ margin-top:9px; position:relative; }
.rk-row[data-gap]::before{
  content:'⋯'; position:absolute; top:-16px; left:12px;
  font-size:12px; color: rgba(255,255,255,.3); letter-spacing:.2em;
}
.rk-num{ font-variant-numeric: tabular-nums; text-align:right; color: rgba(255,255,255,.5); font-size:12.5px; }
.rk-row:first-child .rk-num{ color: rgba(255,255,255,.9); font-weight:700; }
.rk-who{ min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.rk-mine{
  margin-left:7px; padding:1px 6px; border-radius:999px; font-size:10.5px;
  background: rgba(255,255,255,.16); color: rgba(255,255,255,.9);
}
.rk-meta{ font-size:11.5px; color: rgba(255,255,255,.44); white-space:nowrap; }
.rk-score{ font-variant-numeric: tabular-nums; font-weight:650; color: rgba(255,255,255,.9); }

.rk-note, .rk-empty{
  margin:11px 0 0; font-size:11.5px; line-height:1.6; color: rgba(255,255,255,.46);
}
.rk-empty{ margin:0; }

@media (max-width: 520px){
  .rk-row{ grid-template-columns: 26px 1fr auto; }
  .rk-meta{ display:none; }
}
`
