// apps/web/src/components/game/brief/GameBriefModal.tsx
// Protocol — 게임 브리핑 다이얼로그. 그림 3장으로 규칙을 보여주고, 눌러서 통과하는 트라이얼로 끝난다.
//
// 프로젝트 제약과의 관계:
//   CLAUDE.md 는 "모달 오버레이로 학습 중단" 을 금지한다. 그 규칙의 대상은 **세션 중**이다 —
//   문제를 푸는 도중에 오버레이가 끼어들어 인출을 끊는 것이 금지된 행위다.
//   이 다이얼로그는 세션에 들어가기 **전**, 허브에서 "무엇을 할지 고르는" 국면에만 열린다.
//   끊는 것이 아니라 들어가기 전에 답을 주는 쪽이므로 규칙과 충돌하지 않는다.
//   (반대로 이 정보를 페이지에 펼쳐 두면 19종 × 3프레임이 허브를 덮어 Calm UI 가 깨진다.)
//
// 구성 — 위에서 아래로 인지 부하가 낮아지는 순서:
//   OBJECTIVE  이 게임에서 학습자가 하는 일 (한 문단)
//   PROCEDURE  같은 보드의 세 순간 — 초기 / 성공 / 실패. 글은 그림을 거들 뿐이다.
//   TRIAL RUN  직접 눌러서 통과한다. 절차적 기억은 서술로 만들어지지 않는다.
//   NOTES      조작 · 한 판의 단위 · 학습 기록에 어떻게 남는가
//
// 계열(family) 은 탭으로 모드를 전환한다 — 네 모드가 같은 인출을 공유하고 동기 장치만
// 다르다는 사실이, 탭이라는 형식 자체로 전달된다.

'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'

import BriefBoard, { BRIEF_BOARD_CSS } from '@/components/game/brief/BriefBoard'
import { GAME_BRIEFS } from '@/lib/game/brief'
import { GAME_BY_SLUG, GAME_MARKS, type GameSlug } from '@/lib/game/catalog'

export interface BriefEntry {
  slug: GameSlug
  /** 스코프가 실린 실제 플레이 URL — 허브가 계산해서 넘긴다(스코프 유실 방지). */
  href: string
  /** 실험 코드 (RC-01 등) — 허브 카드와 같은 코드를 쓴다. */
  code?: string
  /** 계열 탭에 쓸 짧은 이름 */
  tabLabel?: string
}

interface Props {
  entries: BriefEntry[]
  /** 계열 카드에서 열었을 때의 계열명 */
  familyName?: string
  onClose: () => void
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

export default function GameBriefModal({ entries, familyName, onClose }: Props) {
  const [tab, setTab] = useState(0)
  const [mounted, setMounted] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  const entry = entries[Math.min(tab, entries.length - 1)]
  const game = GAME_BY_SLUG[entry.slug]
  const brief = GAME_BRIEFS[entry.slug]

  useEffect(() => setMounted(true), [])

  // 배경 스크롤 잠금 — 오버레이 뒤가 따라 움직이면 "어디에 있는지" 감각이 깨진다.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // 열릴 때 패널로 포커스 이동, 닫힐 때 원래 자리로 복귀.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const t = window.setTimeout(() => panelRef.current?.focus(), 20)
    return () => {
      window.clearTimeout(t)
      opener?.focus?.()
    }
  }, [])

  // Esc 닫기 + Tab 순환(포커스 트랩). 트랩이 없으면 뒤 페이지로 탭이 새어 나간다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null,
      )
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  if (!mounted || !game || !brief) return null

  const mood = game.mood
  const styleVars = {
    ['--m-a']: mood.a,
    ['--m-b']: mood.b,
    ['--m-glow']: mood.glow,
    ['--m-accent']: mood.accent,
  } as CSSProperties

  return createPortal(
    <div className="bf-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <style dangerouslySetInnerHTML={{ __html: BRIEF_CSS }} />
      <div
        ref={panelRef}
        className="bf-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={styleVars}
      >
        <header className="bf-head">
          <span className="bf-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              {GAME_MARKS[entry.slug]}
            </svg>
          </span>
          <div className="bf-head-body">
            <p className="bf-eyebrow">
              Protocol{entry.code ? ` · ${entry.code}` : ''}
              {familyName ? ` · ${familyName}` : ''}
            </p>
            <h2 id={titleId} className="bf-title">
              {game.name}
            </h2>
            <p className="bf-tag">{game.tagline}</p>
          </div>
          <button type="button" className="bf-close" onClick={onClose} aria-label="브리핑 닫기">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="bf-chips">
          <span className="bf-chip">{game.layer}</span>
          <span className="bf-chip">{game.ref}</span>
          {game.is3d && <span className="bf-chip bf-chip--3d">3D</span>}
        </div>

        {entries.length > 1 && (
          <div className="bf-tabs" role="tablist" aria-label="모드 선택">
            {entries.map((e, i) => (
              <button
                key={e.slug}
                type="button"
                role="tab"
                id={`${titleId}-tab-${i}`}
                aria-controls={`${titleId}-panel`}
                className="bf-tab"
                aria-selected={i === tab}
                tabIndex={i === tab ? 0 : -1}
                onClick={() => setTab(i)}
              >
                {e.tabLabel ?? GAME_BY_SLUG[e.slug]?.name ?? e.slug}
              </button>
            ))}
          </div>
        )}

        <div
          className="bf-body"
          id={`${titleId}-panel`}
          role={entries.length > 1 ? 'tabpanel' : undefined}
          aria-labelledby={entries.length > 1 ? `${titleId}-tab-${tab}` : undefined}
          tabIndex={entries.length > 1 ? 0 : undefined}
        >
          <section className="bf-sec">
            <h3 className="bf-sec-title">Objective</h3>
            <p className="bf-obj">{brief.objective}</p>
          </section>

          <section className="bf-sec">
            <h3 className="bf-sec-title">
              Procedure <span className="bf-sec-note">그림 3장</span>
            </h3>
            <ol className="bf-figs">
              {brief.figures.map((fig, i) => (
                <li key={i} className="bf-fig">
                  <figure>
                    <BriefBoard
                      board={brief.board}
                      variant="figure"
                      figure={fig}
                      answer={brief.trial.steps[0]?.want}
                    />
                    <figcaption className="bf-fig-cap">
                      <span className="bf-fig-num" aria-hidden="true">
                        {i + 1}
                      </span>
                      {fig.caption}
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ol>
          </section>

          <Trial key={entry.slug} slug={entry.slug} />

          <section className="bf-sec">
            <h3 className="bf-sec-title">Notes</h3>
            <dl className="bf-notes">
              <div>
                <dt>Controls</dt>
                <dd>{brief.facts.input}</dd>
              </div>
              <div>
                <dt>One run</dt>
                <dd>{brief.facts.run}</dd>
              </div>
              <div>
                <dt>Record</dt>
                <dd>{brief.facts.record}</dd>
              </div>
            </dl>
          </section>
        </div>

        <footer className="bf-foot">
          <button type="button" className="bf-later" onClick={onClose}>
            나중에
          </button>
          <Link href={entry.href} className="bf-launch">
            Launch <span aria-hidden="true">→</span>
          </Link>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

// ── Trial Run — 눌러서 통과하는 미니 절차 ───────────────────────────
//
// 판정은 브리핑 데이터의 `want` 하나로만 한다. 게임 로직을 흉내 내지 않는 이유:
// 흉내는 반드시 실제와 어긋나고, 어긋난 순간 튜토리얼이 거짓말이 된다.
// 여기서 가르치는 것은 점수 규칙이 아니라 **손동작 하나**다.
function Trial({ slug }: { slug: GameSlug }) {
  const brief = GAME_BRIEFS[slug]
  const steps = useMemo(() => brief?.trial.steps ?? [], [brief])

  const [step, setStep] = useState(0)
  const [picked, setPicked] = useState<string[]>([])
  const [wrong, setWrong] = useState<string | null>(null)
  const [misses, setMisses] = useState(0)
  const [solved, setSolved] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t))
    },
    [],
  )

  const reset = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    setStep(0)
    setPicked([])
    setWrong(null)
    setMisses(0)
    setSolved(false)
  }, [])

  const current = steps[Math.min(step, steps.length - 1)]

  const onPick = useCallback(
    (id: string) => {
      if (solved || !current) return
      const got = picked.filter((p) => current.want.includes(p))
      const isRight = current.ordered
        ? current.want[got.length] === id
        : current.want.includes(id) && !picked.includes(id)

      if (!isRight) {
        setWrong(id)
        setMisses((m) => m + 1)
        timers.current.push(window.setTimeout(() => setWrong(null), 480))
        return
      }

      const next = [...picked, id]
      setPicked(next)
      if (got.length + 1 < current.want.length) return

      // 스텝 통과 — ✓ 를 보여 준 뒤 넘어간다(즉시 전환하면 무엇이 맞았는지 못 본다).
      if (step + 1 < steps.length) {
        timers.current.push(
          window.setTimeout(() => {
            setStep((s) => s + 1)
            setMisses(0)
          }, 620),
        )
      } else {
        timers.current.push(window.setTimeout(() => setSolved(true), 420))
      }
    },
    [current, picked, solved, step, steps.length],
  )

  if (!brief || steps.length === 0) return null

  return (
    <section className="bf-sec bf-trial">
      <h3 className="bf-sec-title">
        Trial Run <span className="bf-sec-note">직접 해보기</span>
      </h3>

      <div className="bf-trial-box">
        <div className="bf-trial-head">
          <span className="bf-steps" aria-hidden="true">
            {steps.map((_, i) => (
              <i key={i} data-on={solved || i < step ? 'done' : i === step ? 'now' : 'todo'} />
            ))}
          </span>
          <p className="bf-say" role="status" aria-live="polite">
            {solved ? brief.trial.done : current?.say}
          </p>
        </div>

        <BriefBoard
          board={brief.board}
          variant="trial"
          step={step}
          picked={picked}
          wrong={wrong}
          solved={solved}
          onPick={onPick}
        />

        <div className="bf-trial-foot">
          {solved ? (
            <>
              <span className="bf-ok">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 12.5l5 5L20 6.5" />
                </svg>
                통과했어요
              </span>
              <button type="button" className="bf-again" onClick={reset}>
                다시 해보기
              </button>
            </>
          ) : misses >= 2 && current?.hint ? (
            <p className="bf-hint">힌트 · {current.hint}</p>
          ) : (
            <p className="bf-hint bf-hint--quiet">틀려도 괜찮아요. 여기 결과는 기록되지 않아요.</p>
          )}
        </div>
      </div>
    </section>
  )
}

const BRIEF_CSS = `
  .bf-scrim { position: fixed; inset: 0; z-index: 90; display: flex; align-items: center; justify-content: center;
    padding: clamp(0px, 4vh, 40px) clamp(0px, 4vw, 32px);
    background: rgba(8,6,4,.72); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    animation: bf-in .18s ease-out; }
  @keyframes bf-in { from { opacity: 0; } to { opacity: 1; } }

  .bf-panel { position: relative; display: flex; flex-direction: column; width: min(760px, 100%); max-height: 100%;
    border-radius: 22px; overflow: hidden; isolation: isolate;
    font-family: var(--font-display, system-ui, sans-serif); color: #F4EEE4;
    background:
      radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, var(--m-a) 26%, transparent) 0%, transparent 56%),
      linear-gradient(158deg, #17130E 0%, #14161E 100%);
    border: 1px solid color-mix(in srgb, var(--m-accent) 26%, rgba(255,255,255,.14));
    box-shadow: 0 40px 90px -30px rgba(0,0,0,.92); }
  .bf-panel:focus { outline: none; }
  @media (max-width: 620px) {
    .bf-scrim { padding: 0; align-items: flex-end; }
    .bf-panel { width: 100%; max-height: 94vh; border-radius: 22px 22px 0 0; }
  }

  /* 헤더 */
  .bf-head { display: flex; align-items: flex-start; gap: 14px; padding: 20px 20px 12px; }
  .bf-mark { flex: none; display: grid; place-items: center; width: 46px; height: 46px; border-radius: 13px;
    color: var(--m-accent); background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.16);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.22); }
  .bf-mark svg { width: 28px; height: 28px; filter: drop-shadow(0 0 6px var(--m-glow)); }
  .bf-head-body { flex: 1; min-width: 0; }
  .bf-eyebrow { margin: 0; font-family: var(--font-english, ui-monospace, monospace); font-size: 10px; font-weight: 800;
    letter-spacing: .2em; text-transform: uppercase; color: var(--m-accent); }
  .bf-title { margin: 5px 0 0; font-size: clamp(21px, 3.4vw, 26px); font-weight: 800; letter-spacing: -.01em; color: #fff; }
  .bf-tag { margin: 5px 0 0; font-size: 13px; line-height: 1.45; color: rgba(244,238,228,.76); word-break: keep-all; }
  .bf-close { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px;
    color: rgba(244,238,228,.8); background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14);
    cursor: pointer; transition: background-color .15s var(--ease, ease), color .15s var(--ease, ease); }
  .bf-close:hover { background: rgba(255,255,255,.14); color: #fff; }
  .bf-close:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--m-accent); }

  .bf-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 20px 12px; }
  .bf-chip { font-family: var(--font-english, ui-monospace, monospace); font-size: 10px; font-weight: 800;
    letter-spacing: .07em; text-transform: uppercase; color: rgba(244,238,228,.82);
    background: rgba(0,0,0,.3); border: 1px solid rgba(255,255,255,.16); border-radius: 999px; padding: 5px 10px; }
  .bf-chip--3d { color: #EAF6FF; background: rgba(120,190,255,.2); border-color: rgba(180,220,255,.36); }

  /* 계열 탭 */
  .bf-tabs { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 20px 14px; }
  .bf-tab { min-height: 44px; padding: 0 15px; border-radius: 999px; cursor: pointer;
    font: inherit; font-size: 12.5px; font-weight: 800; letter-spacing: -.01em;
    color: rgba(244,238,228,.74); background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14);
    transition: background-color .15s var(--ease, ease), color .15s var(--ease, ease), border-color .15s var(--ease, ease); }
  .bf-tab:hover { background: rgba(255,255,255,.13); color: #fff; }
  .bf-tab[aria-selected="true"] { color: #16110B; background: var(--m-accent); border-color: var(--m-accent); }
  .bf-tab:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--m-accent); }

  /* 본문 — 여기만 스크롤한다(헤더·푸터 고정) */
  .bf-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
    padding: 4px 20px 20px; display: flex; flex-direction: column; gap: 22px; }

  .bf-sec-title { display: flex; align-items: baseline; gap: 8px; margin: 0 0 10px;
    font-family: var(--font-english, ui-monospace, monospace); font-size: 11px; font-weight: 800;
    letter-spacing: .2em; text-transform: uppercase; color: rgba(244,238,228,.58); }
  .bf-sec-note { font-family: var(--font-display, system-ui, sans-serif); font-size: 11px; font-weight: 700;
    letter-spacing: 0; text-transform: none; color: rgba(244,238,228,.44); }
  .bf-obj { margin: 0; font-size: 14px; line-height: 1.7; color: rgba(248,242,234,.92); word-break: keep-all; }

  /* 절차 3프레임 */
  .bf-figs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 0; padding: 0; list-style: none; }
  @media (max-width: 700px) { .bf-figs { grid-template-columns: 1fr; } }
  .bf-fig figure { margin: 0; display: flex; flex-direction: column; gap: 8px; height: 100%; }
  .bf-fig-cap { display: flex; gap: 7px; font-size: 11.5px; line-height: 1.55; color: rgba(242,234,224,.74); word-break: keep-all; }
  .bf-fig-num { flex: none; display: grid; place-items: center; width: 17px; height: 17px; margin-top: 1px; border-radius: 999px;
    font-family: var(--font-english, ui-monospace, monospace); font-size: 10px; font-weight: 800;
    color: #16110B; background: var(--m-accent); }

  /* 트라이얼 */
  .bf-trial-box { display: flex; flex-direction: column; gap: 12px; padding: 14px; border-radius: 16px;
    background: linear-gradient(160deg, color-mix(in srgb, var(--m-a) 14%, rgba(255,255,255,.04)), rgba(0,0,0,.24));
    border: 1px solid color-mix(in srgb, var(--m-accent) 22%, rgba(255,255,255,.12)); }
  .bf-trial-head { display: flex; align-items: flex-start; gap: 10px; }
  .bf-steps { flex: none; display: inline-flex; gap: 5px; padding-top: 6px; }
  .bf-steps i { width: 7px; height: 7px; border-radius: 999px; background: rgba(255,255,255,.22); }
  .bf-steps i[data-on="now"] { background: var(--m-accent); }
  .bf-steps i[data-on="done"] { background: #7ED6A4; }
  .bf-say { margin: 0; flex: 1; font-size: 13.5px; font-weight: 700; line-height: 1.55; color: #FFF6EA; word-break: keep-all; }

  .bf-trial-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 44px; }
  .bf-hint { margin: 0; font-size: 11.5px; line-height: 1.5; color: rgba(255,224,196,.86); word-break: keep-all; }
  .bf-hint--quiet { color: rgba(242,234,224,.52); }
  .bf-ok { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 800; color: #9BE8C0; }
  .bf-again { min-height: 44px; padding: 0 14px; border-radius: 999px; cursor: pointer; font: inherit;
    font-size: 12.5px; font-weight: 700; color: rgba(244,238,228,.82);
    background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.16);
    transition: background-color .15s var(--ease, ease), color .15s var(--ease, ease); }
  .bf-again:hover { background: rgba(255,255,255,.14); color: #fff; }
  .bf-again:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--m-accent); }

  /* 노트 */
  .bf-notes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 0; }
  @media (max-width: 620px) { .bf-notes { grid-template-columns: 1fr; } }
  .bf-notes > div { padding: 10px 12px; border-radius: 12px; background: rgba(0,0,0,.24); border: 1px solid rgba(255,255,255,.1); }
  .bf-notes dt { font-family: var(--font-english, ui-monospace, monospace); font-size: 9.5px; font-weight: 800;
    letter-spacing: .14em; text-transform: uppercase; color: rgba(244,238,228,.56); }
  .bf-notes dd { margin: 5px 0 0; font-size: 12px; line-height: 1.5; color: rgba(248,242,234,.88); word-break: keep-all; }

  /* 푸터 */
  .bf-foot { display: flex; align-items: center; justify-content: flex-end; gap: 10px;
    padding: 14px 20px; border-top: 1px solid rgba(255,255,255,.12); background: rgba(0,0,0,.26); }
  .bf-later { min-height: 44px; padding: 0 16px; border-radius: 999px; cursor: pointer; font: inherit;
    font-size: 13px; font-weight: 700; color: rgba(244,238,228,.74);
    background: transparent; border: 1px solid rgba(255,255,255,.18);
    transition: background-color .15s var(--ease, ease), color .15s var(--ease, ease); }
  .bf-later:hover { background: rgba(255,255,255,.09); color: #fff; }
  .bf-later:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--m-accent); }
  .bf-launch { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 22px; border-radius: 999px;
    font-size: 14px; font-weight: 800; letter-spacing: -.01em; text-decoration: none; color: #17110A;
    background: linear-gradient(180deg, color-mix(in srgb, var(--m-accent) 92%, #fff), var(--m-accent));
    box-shadow: 0 10px 24px -10px rgba(0,0,0,.6);
    transition: transform .15s var(--ease, ease), filter .15s var(--ease, ease); }
  .bf-launch:hover { filter: brightness(1.06); transform: translateY(-1px); }
  .bf-launch:focus-visible { outline: none; box-shadow: 0 0 0 3px #fff; }

  @media (prefers-reduced-motion: reduce) {
    .bf-scrim { animation: none; }
    .bf-launch, .bf-close, .bf-tab, .bf-again, .bf-later { transition: none; }
    .bf-launch:hover { transform: none; }
  }
` + BRIEF_BOARD_CSS
