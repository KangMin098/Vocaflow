// apps/web/src/components/game/brief/BriefBoard.tsx
// 브리핑 보드 — 게임의 실제 플레이 표면을 축약한 그림. 하나의 렌더러가 두 가지로 쓰인다.
//
//   variant="figure"  절차 설명용 정적 삽화 (강조 + 성공/실패 색)
//   variant="trial"   학습자가 실제로 눌러 통과하는 미니 보드
//
// 같은 컴포넌트를 쓰는 이유: 설명에서 본 그림과 직접 눌러 보는 그림이 다르면
// "설명 → 실행" 사이에 번역이 한 번 더 끼어든다. 같아야 배운 것이 그대로 이어진다.
//
// 스크린샷이 아니라 데이터로 그리는 이유:
//   ① 게임이 바뀌면 스크린샷은 조용히 거짓이 되지만 보드 데이터는 타입이 잡아 준다
//   ② 스크린리더가 읽을 수 있고, 대비·터치 타겟을 토큰으로 통제할 수 있다
//   ③ 19종 × 3프레임 = 57장의 이미지를 리포지토리에 넣지 않아도 된다
//
// v08.4 확장 — 전수 평가(평균 9.6/20)가 드러낸 것은 문안 문제가 아니라 **표현력 부족**이었다.
// 게이지가 하나뿐이라 판돈의 절반이 지워지고, 프롬프트가 판 전체에 고정이라 국면 전환을
// 말로만 알리고, 판돈 2택을 정답 타일과 같은 격자에 섞어 "이건 답이 아니라 결정"이 읽히지
// 않았다. 그래서 다섯 가지를 열었다 — 게이지 배열·핍 / 스텝별 표면 교체 / 결정 스트립 /
// 좌표 격자 / 비용 타일(누르면 게이지가 실제로 깎인다).
//
// CSS 는 문자열로 내보내 GameBriefModal 이 한 번만 주입한다(중복 <style> 방지).

'use client'

import type { CSSProperties } from 'react'

import {
  gaugesOf,
  type BriefBoard as BoardModel,
  type BriefFigure,
  type BriefGaugeState,
  type BriefSurface,
  type BriefToken,
} from '@/lib/game/brief'

/**
 * 시각 폭 — 한글·한자는 라틴 문자의 대략 두 배를 차지한다.
 * `text.length` 로 재면 '재검토하다'(5)가 'endorse'(7)보다 좁다고 나와 정확히 반대로 접힌다.
 */
function visualWidth(s: string): number {
  let n = 0
  for (const ch of s) n += /[ᄀ-ᇿ㄰-㆏가-힣　-〿一-鿿＀-｠]/.test(ch) ? 2 : 1
  return n
}

/**
 * 프레임 폭(모달의 1/3)에서 한 칸이 감당할 수 있는 글자 수 — 11px 기준 실측 근사.
 * 원하는 열 수부터 내려가며 들어가는 첫 값을 고른다(최소 2열).
 */
const FIG_CAPACITY: Record<number, number> = { 2: 15, 3: 8, 4: 5 }
function fitCols(want: number, widest: number): number {
  for (let c = want; c > 2; c--) {
    if (widest <= (FIG_CAPACITY[c] ?? 0)) return c
  }
  return 2
}

interface Props {
  board: BoardModel
  variant: 'figure' | 'trial'
  /** variant="figure" — 이 프레임이 강조할 것 */
  figure?: BriefFigure
  /**
   * variant="trial" — 현재 스텝의 표면 교체(프롬프트·서류·게이지).
   * figure 는 자체적으로 BriefSurface 를 겸하므로 이 prop 은 트라이얼 전용이다.
   */
  surface?: BriefSurface
  /** variant="trial" — 현재 스텝(토큰 노출 제어) */
  step?: number
  /** variant="trial" — 지금까지 누른 토큰(순서 보존) */
  picked?: string[]
  /** variant="trial" — 방금 빗나간 토큰 */
  wrong?: string | null
  /** variant="trial" — 트라이얼 통과 */
  solved?: boolean
  /** variant="trial" — 비용 타일이 누적해 깎은 게이지 상태 */
  hudState?: (BriefGaugeState | null)[]
  /** variant="trial" · kind="type" — 지금까지 입력된 철자 */
  typed?: string
  /**
   * assemble 프레임에서 슬롯에 미리 채워 보일 토큰 id 순서(= 정답).
   * 빈 상자만 칠해 두면 "채워진다"는 사실은 전해도 **무엇이** 채워지는지가 빠져,
   * 조립형 게임의 프레임이 셋 다 같은 그림으로 읽힌다(실측).
   */
  answer?: string[]
  onPick?: (id: string) => void
}

export default function BriefBoard({
  board,
  variant,
  figure,
  surface,
  step = 0,
  picked = [],
  wrong = null,
  solved = false,
  hudState,
  typed = '',
  answer,
  onPick,
}: Props) {
  const isTrial = variant === 'trial'
  const focus = new Set(figure?.focus ?? [])
  const tokens = board.tokens.filter((t) => (isTrial ? (t.from ?? 0) <= step : true))
  const choices = (board.choices ?? []).filter((c) => (isTrial ? (c.from ?? 0) <= step : true))

  // 국면이 바뀌는 게임 — 프롬프트·서류는 스텝/프레임이 갈아 끼울 수 있다.
  const sfc: BriefSurface = (isTrial ? surface : figure) ?? {}
  const prompt = board.prompt
    ? { ...board.prompt, ...(sfc.prompt ?? {}) }
    : sfc.prompt?.label && sfc.prompt.value
      ? { label: sfc.prompt.label, value: sfc.prompt.value, kind: sfc.prompt.kind, note: sfc.prompt.note }
      : undefined
  const doc = sfc.doc ?? board.doc
  const headword = sfc.headword ?? board.headword

  // 절차 프레임은 트라이얼 보드의 1/3 폭에 들어간다. 같은 열 수를 그대로 쓰면
  // 'colleague' · '재검토하다' 같은 타일이 옆 칸을 침범해 잘린다(실측). 열 수를
  // 내용 폭에서 역산해 정한다 — 데이터에 손대지 않고 그림만 접히게.
  const widest = Math.max(1, ...board.tokens.map((t) => visualWidth(t.text)))
  const figCols = fitCols(board.cols ?? 2, widest)
  // 좌표 격자 — 위치 자체가 결정인 게임. 열 수는 데이터가 정한다.
  const grid = board.tokens.some((t) => t.at)
  const gridCols = grid ? Math.max(...board.tokens.map((t) => (t.at?.[1] ?? 0) + 1)) : 0
  const cols = grid ? gridCols : isTrial ? (board.cols ?? 2) : figCols
  // 글자 하나짜리 조각(철자 조립)은 모바일에서도 접지 않는다 — 접으면 오히려 읽기 어렵다.
  const compact = widest <= 3

  // assemble · type — 슬롯이 몇 칸 찼는가. 삽화는 figure.filled, 트라이얼은 실제 진행.
  const typing = board.kind === 'type'
  const filled = isTrial ? (typing ? typed.length : picked.length) : (figure?.filled ?? 0)
  const figAnswer = figure?.answer ?? answer

  // 게이지 — 배열이 정본. figure.hudPct 는 0번 막대의 축약형(레거시 호환).
  const gauges = gaugesOf(board)
  const gaugeAt = (i: number): BriefGaugeState => {
    const fromSurface = sfc.hud?.[i] ?? undefined
    const fromTrial = isTrial ? (hudState?.[i] ?? undefined) : undefined
    const legacy = i === 0 && figure?.hudPct != null ? { pct: figure.hudPct } : undefined
    return { ...(legacy ?? {}), ...(fromSurface ?? {}), ...(fromTrial ?? {}) }
  }

  const tokenState = (id: string): string => {
    if (isTrial) {
      if (wrong === id) return 'bad'
      if (picked.includes(id)) return 'good'
      return 'idle'
    }
    if (!focus.has(id)) return 'idle'
    return figure?.state === 'bad' ? 'bad' : figure?.state === 'good' ? 'good' : 'on'
  }

  const tileBody = (t: BriefToken) => (
    <>
      <span className="bb-tile-text">{t.text}</span>
      {t.sub && <span className="bb-tile-sub">{t.sub}</span>}
      {t.effect?.badge && <span className="bb-tile-cost">{t.effect.badge}</span>}
    </>
  )

  return (
    <div
      className="bb"
      data-kind={board.kind}
      data-variant={variant}
      data-solved={solved ? '1' : '0'}
      data-compact={compact ? '1' : '0'}
      data-grid={grid ? '1' : '0'}
      style={{ ['--bb-cols']: String(cols) } as CSSProperties}
    >
      {/* 귀납형 게임 — 규칙 대신 증거가 먼저 놓인다 */}
      {board.evidence && (
        <div className="bb-ev">
          <div className="bb-ev-col" data-tone="ok">
            <span className="bb-ev-cap">맞는 예</span>
            {board.evidence.ok.map((line) => (
              <span key={line} className="bb-ev-line">
                {line}
              </span>
            ))}
          </div>
          <div className="bb-ev-col" data-tone="no">
            <span className="bb-ev-cap">틀린 예</span>
            {board.evidence.no.map((row) => {
              const text = typeof row === 'string' ? row : row.text
              const fix = typeof row === 'string' ? undefined : row.fix
              return (
                <span key={text} className="bb-ev-line">
                  {/* 취소선 + 올바른 철자 — 무엇이 틀렸는지와 무엇이 옳은지를 한 줄에 */}
                  <s>{text}</s>
                  {fix && <em className="bb-ev-fix">→ {fix}</em>}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* judge — 서류 맨 위 표제. doc 행으로 눕히면 "먼저 읽는 것"이라는 위계가 사라진다. */}
      {headword && (
        <p className="bb-head" data-kind={board.kind}>
          {headword}
        </p>
      )}

      {prompt && (
        <div className="bb-prompt" data-pk={prompt.kind ?? 'text'}>
          <span className="bb-prompt-label">{prompt.label}</span>
          <span className="bb-prompt-value">
            {prompt.kind === 'audio' && (
              <span className="bb-wave" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
            )}
            {prompt.value}
          </span>
          {prompt.note && <span className="bb-prompt-note">{prompt.note}</span>}
        </div>
      )}

      {/* 심사대 서류 — 축마다 한 줄 */}
      {doc && (
        <dl className="bb-doc">
          {doc.map((row) => (
            <div key={row.label} className="bb-doc-row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* 조립·타이핑 슬롯 — 칸 수가 곧 단어 길이다.
          role 없이 aria-label 만 붙이면 axe aria-prohibited-attr 위반이고, 그렇다고 라벨을
          빼면 스크린리더에게는 "빈 칸 몇 개"가 통째로 사라진다 → group 으로 묶어 둘 다 지킨다. */}
      {board.slots != null && (
        <div className="bb-slots" role="group" aria-label={`빈 칸 ${board.slots}개 중 ${filled}개 채움`}>
          {Array.from({ length: board.slots }, (_, i) => {
            let text = ''
            if (typing) {
              // 타이핑 보드는 토큰이 아니라 글자가 들어간다 — 트레이가 없는 게임의 정체다.
              text = isTrial ? (typed[i] ?? '') : i < filled ? (figAnswer?.join('')[i] ?? '') : ''
            } else {
              const id = isTrial ? picked[i] : i < filled ? figAnswer?.[i] : undefined
              text = (id ? board.tokens.find((x) => x.id === id)?.text : undefined) ?? ''
            }
            return (
              <span key={i} className="bb-slot" data-filled={i < filled ? '1' : '0'}>
                {text}
              </span>
            )
          })}
        </div>
      )}

      {/* 타일 격자 — `at` 이 있으면 좌표대로, 없으면 흐름대로.
          `data-id` 는 장식이 아니다: cascade 는 같은 정답('collapse')이 세 자리에 깔리는 것이
          게임의 전부여서, 텍스트로는 세 타일을 구별할 방법이 아예 없다(사람도, 테스트도). */}
      {tokens.length > 0 && (
        <div
          className="bb-tiles"
          role={isTrial ? 'group' : undefined}
          aria-label={isTrial ? '연습 보드' : undefined}
        >
          {tokens.map((t) => {
            const style = t.at
              ? ({ gridRow: t.at[0] + 1, gridColumn: t.at[1] + 1 } as CSSProperties)
              : undefined
            return isTrial ? (
              <button
                key={t.id}
                type="button"
                className="bb-tile"
                style={style}
                data-id={t.id}
                data-state={tokenState(t.id)}
                data-tone={t.tone ?? 'plain'}
                aria-pressed={picked.includes(t.id)}
                disabled={solved}
                onClick={() => onPick?.(t.id)}
              >
                {tileBody(t)}
              </button>
            ) : (
              <span
                key={t.id}
                className="bb-tile"
                style={style}
                data-id={t.id}
                data-state={tokenState(t.id)}
                data-tone={t.tone ?? 'plain'}
              >
                {tileBody(t)}
              </span>
            )
          })}
        </div>
      )}

      {/* 판돈 결정 — 격자 밖 별도 줄. 답이 아니라 결정임을 형태로 구별한다.
          두 경로의 손익을 나란히 놓아야 결정이 성립하므로 카드는 여러 줄을 갖는다. */}
      {choices.length > 0 && (
        <div className="bb-choices" role={isTrial ? 'group' : undefined} aria-label={isTrial ? '결정' : undefined}>
          <span className="bb-choices-cap">결정</span>
          <div className="bb-choices-row">
            {choices.map((c) => {
              const body = (
                <>
                  <span className="bb-ch-label">{c.label}</span>
                  {c.lines.map((l) => (
                    <span key={l} className="bb-ch-line">
                      {l}
                    </span>
                  ))}
                </>
              )
              return isTrial ? (
                <button
                  key={c.id}
                  type="button"
                  className="bb-ch"
                  data-id={c.id}
                  data-state={tokenState(c.id)}
                  data-tone={c.tone ?? 'plain'}
                  aria-pressed={picked.includes(c.id)}
                  disabled={solved}
                  onClick={() => onPick?.(c.id)}
                >
                  {body}
                </button>
              ) : (
                <span key={c.id} className="bb-ch" data-id={c.id} data-state={tokenState(c.id)} data-tone={c.tone ?? 'plain'}>
                  {body}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* 압력 게이지 — 시계·거리·잔고·박·목숨. 이 게임들은 압력이 거의 항상 둘 이상이다. */}
      {gauges.length > 0 && (
        <div className="bb-huds">
          {gauges.map((g, i) => {
            const st = gaugeAt(i)
            const value = st.value ?? g.value
            return (
              <div key={g.label} className="bb-hud" data-kind={g.pips ? 'pips' : 'bar'}>
                <span className="bb-hud-label">{g.label}</span>
                {g.pips ? (
                  <span className="bb-pips" aria-label={`${g.label} ${st.left ?? g.pips.left}/${g.pips.total}`}>
                    {Array.from({ length: g.pips.total }, (_, k) => (
                      <i key={k} data-on={k < (st.left ?? g.pips!.left) ? '1' : '0'} />
                    ))}
                  </span>
                ) : (
                  <span className="bb-hud-bar" aria-hidden="true">
                    <span
                      className="bb-hud-fill"
                      style={{ width: `${Math.round(Math.max(0, Math.min(1, st.pct ?? g.pct ?? 0)) * 100)}%` }}
                    />
                  </span>
                )}
                {value && <span className="bb-hud-val">{value}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export const BRIEF_BOARD_CSS = `
  /* ── 보드 ─────────────────────────────────────────────────────────
     잉크 베이스 + 게임 무드 액센트(--m-accent). 아케이드 카드와 같은 문법이라
     "카드에서 본 그 게임" 이 브리핑에서도 같은 색으로 이어진다. */
  .bb { display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 14px;
    background: linear-gradient(158deg, rgba(255,255,255,.05), rgba(0,0,0,.22));
    border: 1px solid rgba(255,255,255,.10); }
  .bb[data-variant="trial"] { gap: 12px; padding: 16px; border-color: color-mix(in srgb, var(--m-accent) 26%, rgba(255,255,255,.12)); }

  .bb-prompt { display: flex; flex-direction: column; gap: 3px; padding: 9px 12px; border-radius: 10px;
    background: rgba(0,0,0,.28); border: 1px solid rgba(255,255,255,.10); }
  .bb-prompt-label { font-family: var(--font-english, ui-monospace, monospace); font-size: 9.5px; font-weight: 800;
    letter-spacing: .14em; text-transform: uppercase; color: rgba(240,234,224,.62); }
  .bb-prompt-value { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 800; color: #FFF6EA; word-break: keep-all; }
  .bb[data-variant="trial"] .bb-prompt-value { font-size: 18px; }
  .bb-prompt[data-pk="glyph"] .bb-prompt-value { font-size: 22px; letter-spacing: .12em; color: var(--m-accent); }
  .bb-prompt[data-pk="audio"] .bb-prompt-value { color: var(--m-accent); letter-spacing: .18em; }
  .bb-prompt-note { margin-top: 2px; font-size: 11.5px; line-height: 1.5; color: rgba(238,230,220,.72); word-break: keep-all; }

  /* judge 표제 — 서류에서 가장 먼저 읽는 것. 크기로 위계를 준다. */
  .bb-head { margin: 0; font-family: var(--font-english, ui-monospace, monospace); font-size: 22px; font-weight: 800;
    letter-spacing: .02em; text-align: center; color: #FFF6EA; }
  .bb[data-variant="figure"] .bb-head { font-size: 15px; }

  /* 소리 프롬프트 — 정적 막대. reduced-motion 에서도 의미가 유지되도록 애니메이션은 장식일 뿐. */
  .bb-wave { display: inline-flex; align-items: flex-end; gap: 2px; height: 14px; }
  .bb-wave i { width: 3px; border-radius: 2px; background: var(--m-accent); opacity: .85; animation: bb-wave 1.1s ease-in-out infinite; }
  .bb-wave i:nth-child(1) { height: 6px;  animation-delay: 0s; }
  .bb-wave i:nth-child(2) { height: 12px; animation-delay: .12s; }
  .bb-wave i:nth-child(3) { height: 9px;  animation-delay: .24s; }
  .bb-wave i:nth-child(4) { height: 14px; animation-delay: .36s; }
  .bb-wave i:nth-child(5) { height: 7px;  animation-delay: .48s; }
  @keyframes bb-wave { 0%,100% { transform: scaleY(.55); } 50% { transform: scaleY(1); } }

  /* 증거 — 맞는 예 / 틀린 예. 색만으로 말하지 않도록 라벨을 붙인다(색맹 대응). */
  .bb-ev { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .bb-ev-col { display: flex; flex-direction: column; gap: 3px; padding: 8px 10px; border-radius: 10px;
    background: rgba(0,0,0,.24); border: 1px solid rgba(255,255,255,.10); }
  .bb-ev-col[data-tone="ok"] { border-color: rgba(126,214,164,.34); }
  .bb-ev-col[data-tone="no"] { border-color: rgba(232,140,124,.34); }
  .bb-ev-cap { font-size: 9.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
  .bb-ev-col[data-tone="ok"] .bb-ev-cap { color: #9BE8C0; }
  .bb-ev-col[data-tone="no"] .bb-ev-cap { color: #F3B7AC; }
  .bb-ev-line { font-family: var(--font-english, ui-monospace, monospace); font-size: 11.5px; color: rgba(246,240,232,.9); }
  .bb-ev-col[data-tone="ok"] .bb-ev-line s { text-decoration: none; }
  .bb-ev-fix { margin-left: 5px; font-style: normal; color: #9BE8C0; }

  /* 서류 — 축마다 한 줄 */
  .bb-doc { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 10px 12px; border-radius: 10px;
    background: rgba(255,252,244,.07); border: 1px solid rgba(255,255,255,.14); }
  .bb-doc-row { display: flex; gap: 10px; align-items: baseline; }
  .bb-doc-row dt { flex: none; width: 34px; font-size: 10px; font-weight: 800; letter-spacing: .04em; color: rgba(240,234,224,.6); }
  .bb-doc-row dd { margin: 0; font-family: var(--font-english, ui-monospace, monospace); font-size: 12.5px; color: #FFF6EA; word-break: break-word; }

  /* 조립·타이핑 슬롯 */
  .bb-slots { display: flex; flex-wrap: wrap; gap: 6px; }
  .bb-slot { display: grid; place-items: center; min-width: 34px; height: 38px; padding: 0 8px; border-radius: 9px;
    font-family: var(--font-english, ui-monospace, monospace); font-size: 15px; font-weight: 800; color: #FFF6EA;
    background: rgba(0,0,0,.3); border: 1px dashed rgba(255,255,255,.24); }
  .bb-slot[data-filled="1"] { border-style: solid; border-color: color-mix(in srgb, var(--m-accent) 55%, transparent);
    background: color-mix(in srgb, var(--m-accent) 16%, rgba(0,0,0,.3)); }
  /* 타이핑 보드는 트레이가 없다 — 슬롯이 곧 입력 칸이라는 것을 커서로 알린다. */
  .bb[data-kind="type"][data-variant="trial"] .bb-slot[data-filled="0"]:first-of-type { border-color: var(--m-accent); }

  /* 타일 격자 */
  .bb-tiles { display: grid; grid-template-columns: repeat(var(--bb-cols, 2), minmax(0, 1fr)); gap: 7px; }
  /* 좌표 격자 — "가장 낮은 줄" · "돌 옆" 이 위치로만 성립하는 게임. 빈 칸을 남긴다. */
  .bb[data-grid="1"] .bb-tiles { grid-auto-rows: minmax(0, auto); }
  .bb-tile { display: flex; flex-direction: column; justify-content: center; gap: 2px; min-height: 44px;
    padding: 8px 10px; border-radius: 10px; text-align: left; font: inherit; overflow: hidden;
    background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14); color: #F4EEE4; }
  /* overflow-wrap: 열 수 계산이 빗나가도 옆 칸을 침범하는 대신 줄바꿈으로 물러난다(최후 방어). */
  .bb-tile-text { font-size: 13px; font-weight: 700; letter-spacing: -.01em; word-break: keep-all; overflow-wrap: anywhere; }
  .bb-tile-sub { font-size: 10.5px; line-height: 1.35; color: rgba(240,232,222,.66); word-break: keep-all; overflow-wrap: anywhere; }
  /* 비용 배지 — 이 타일을 누르면 무엇을 지출하는가. 지출은 실수가 아니라 수단이다. */
  .bb-tile-cost { align-self: flex-start; margin-top: 2px; padding: 1px 5px; border-radius: 999px;
    font-family: var(--font-english, ui-monospace, monospace); font-size: 9.5px; font-weight: 800;
    color: #F3D9AC; background: rgba(176,132,58,.24); border: 1px solid rgba(176,132,58,.44); }
  /* 프레임은 삽화다 — 44px 터치 규격은 누를 수 있는 것에만 적용된다. 더 조밀해도 된다. */
  .bb[data-variant="figure"] .bb-tile { min-height: 34px; padding: 6px 8px; }
  .bb[data-variant="figure"] .bb-tile-text { font-size: 11px; }
  .bb[data-variant="figure"] .bb-tile-sub { font-size: 9.5px; }
  .bb[data-variant="figure"] .bb-tile-cost { font-size: 8.5px; }
  /* 좁은 화면의 트라이얼 — 4열은 390px 에서 글자를 뭉갠다. 글자 조각·좌표 보드만 예외. */
  @media (max-width: 560px) {
    .bb[data-variant="trial"][data-compact="0"][data-grid="0"] .bb-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  .bb-tile[data-tone="danger"] { border-color: rgba(232,140,124,.38); background: rgba(232,140,124,.10); }
  .bb-tile[data-tone="quiet"] { border-style: dashed; color: rgba(244,238,228,.82); }

  /* 상태 — 색 + 굵기 + 테두리 3중으로. 색 하나만으로 정보를 나르지 않는다. */
  .bb-tile[data-state="on"]   { border-color: color-mix(in srgb, var(--m-accent) 62%, transparent);
    background: color-mix(in srgb, var(--m-accent) 16%, rgba(255,255,255,.06)); color: #FFF8EE; }
  .bb-tile[data-state="good"] { border-color: rgba(126,214,164,.62); background: rgba(126,214,164,.16); color: #E9FBF1; }
  .bb-tile[data-state="bad"]  { border-color: rgba(232,140,124,.62); background: rgba(232,140,124,.16); color: #FDECE7; }
  .bb-tile[data-state="good"] .bb-tile-text::after { content: ' ✓'; color: #9BE8C0; font-weight: 900; }
  .bb-tile[data-state="bad"] .bb-tile-text::after  { content: ' ✕'; color: #F3B7AC; font-weight: 900; }

  /* 결정 스트립 — 정답 타일과 다른 모양이어야 "답이 아니라 결정" 이 읽힌다. */
  .bb-choices { display: flex; flex-direction: column; gap: 5px; padding-top: 2px;
    border-top: 1px dashed rgba(255,255,255,.16); }
  .bb-choices-cap { font-family: var(--font-english, ui-monospace, monospace); font-size: 9px; font-weight: 800;
    letter-spacing: .16em; text-transform: uppercase; color: color-mix(in srgb, var(--m-accent) 72%, #FFF6EA); }
  .bb-choices-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: 7px; }
  .bb-ch { display: flex; flex-direction: column; gap: 2px; min-height: 44px; padding: 8px 10px;
    border-radius: 10px 10px 10px 2px; text-align: left; font: inherit; overflow: hidden;
    background: rgba(0,0,0,.30); border: 1px solid rgba(255,255,255,.20); color: #F4EEE4; }
  .bb-ch-label { font-size: 12.5px; font-weight: 800; letter-spacing: -.01em; word-break: keep-all; }
  .bb-ch-line { font-family: var(--font-english, ui-monospace, monospace); font-size: 10px; line-height: 1.45;
    color: rgba(242,234,224,.74); word-break: keep-all; overflow-wrap: anywhere; }
  .bb-ch[data-tone="danger"] { border-color: rgba(232,140,124,.44); }
  .bb-ch[data-tone="quiet"] { border-style: dashed; }
  .bb-ch[data-state="on"]   { border-color: color-mix(in srgb, var(--m-accent) 66%, transparent);
    background: color-mix(in srgb, var(--m-accent) 18%, rgba(0,0,0,.30)); color: #FFF8EE; }
  .bb-ch[data-state="good"] { border-color: rgba(126,214,164,.66); background: rgba(126,214,164,.17); color: #E9FBF1; }
  .bb-ch[data-state="bad"]  { border-color: rgba(232,140,124,.66); background: rgba(232,140,124,.17); color: #FDECE7; }
  .bb-ch[data-state="good"] .bb-ch-label::after { content: ' ✓'; color: #9BE8C0; font-weight: 900; }
  .bb-ch[data-state="bad"] .bb-ch-label::after  { content: ' ✕'; color: #F3B7AC; font-weight: 900; }
  .bb[data-variant="figure"] .bb-ch { min-height: 32px; padding: 6px 8px; }
  .bb[data-variant="figure"] .bb-ch-label { font-size: 10.5px; }
  .bb[data-variant="figure"] .bb-ch-line { font-size: 8.5px; }

  /* 트라이얼 — 실제로 누를 수 있는 상태 */
  .bb[data-variant="trial"] .bb-tile,
  .bb[data-variant="trial"] .bb-ch { cursor: pointer;
    transition: transform .14s var(--ease, ease), background-color .18s var(--ease, ease), border-color .18s var(--ease, ease); }
  .bb[data-variant="trial"] .bb-tile:hover:not(:disabled),
  .bb[data-variant="trial"] .bb-ch:hover:not(:disabled) { background: rgba(255,255,255,.13); border-color: rgba(255,255,255,.34); transform: translateY(-1px); }
  .bb[data-variant="trial"] .bb-tile:active:not(:disabled),
  .bb[data-variant="trial"] .bb-ch:active:not(:disabled) { transform: scale(.98); }
  .bb[data-variant="trial"] .bb-tile:focus-visible,
  .bb[data-variant="trial"] .bb-ch:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--m-accent); }
  .bb[data-variant="trial"] .bb-tile:disabled,
  .bb[data-variant="trial"] .bb-ch:disabled { cursor: default; opacity: .92; }
  .bb[data-variant="trial"] .bb-tile[data-state="bad"],
  .bb[data-variant="trial"] .bb-ch[data-state="bad"] { animation: bb-shake .32s var(--ease, ease); }
  @keyframes bb-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }

  /* 압력 게이지 — 여러 개. 판돈이 하나로 압축되면 게임의 정체가 지워진다. */
  .bb-huds { display: flex; flex-direction: column; gap: 5px; }
  .bb-hud { display: flex; align-items: center; gap: 9px; }
  .bb-hud-label { flex: none; min-width: 62px; font-size: 10px; font-weight: 800; letter-spacing: .05em; color: rgba(240,234,224,.66); }
  .bb-hud-bar { flex: 1; height: 5px; border-radius: 999px; background: rgba(255,255,255,.14); overflow: hidden; }
  .bb-hud-fill { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--m-accent), color-mix(in srgb, var(--m-accent) 40%, transparent));
    transition: width .45s cubic-bezier(.2,.8,.2,1); }
  .bb-hud-val { flex: none; font-family: var(--font-english, ui-monospace, monospace); font-size: 10.5px; font-weight: 800; color: rgba(255,246,234,.9); }
  /* 이산 자원 — 목숨 · 촛불 · 남은 기회. 백분율 막대로 그리면 "반쯤 남은 촛불" 이 된다. */
  .bb-pips { flex: 1; display: flex; align-items: center; gap: 4px; }
  .bb-pips i { width: 9px; height: 9px; border-radius: 3px; background: rgba(255,255,255,.16);
    border: 1px solid rgba(255,255,255,.22); transition: background-color .28s var(--ease, ease); }
  .bb-pips i[data-on="1"] { background: var(--m-accent); border-color: color-mix(in srgb, var(--m-accent) 70%, transparent); }

  @media (prefers-reduced-motion: reduce) {
    .bb-wave i { animation: none; }
    .bb[data-variant="trial"] .bb-tile,
    .bb[data-variant="trial"] .bb-ch { transition: none; }
    .bb[data-variant="trial"] .bb-tile[data-state="bad"],
    .bb[data-variant="trial"] .bb-ch[data-state="bad"] { animation: none; }
    .bb-hud-fill, .bb-pips i { transition: none; }
  }
`
