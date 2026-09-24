'use client'

// apps/web/src/components/csat/theater/AnalysisTheater.tsx
//
// **해설 극장 — 참조(3B 워크스페이스) 골격을 문항 해설로 옮긴 것.**
//
// 첫 판(2026-09-23 오전)은 읽기 판면(42rem) 안에 우겨넣어 두 판이 손가락만큼 좁았다.
// 참조는 **작업 공간**이다 — 화면을 가득 쓰고, 왼쪽 레일은 세로로 끝까지 가며, 가운데는
// 탭으로 갈리고, 바닥에는 단계 카드가 깔린다. 그 골격을 그대로 옮긴다:
//
//   참조                      → 여기
//   ─────────────────────────────────────────────────────────────────
//   왼쪽 레일(대화 기록)       → 차례 레일(강의 큐 12~14개가 쌓인다)
//   레일 머리(버전 · Push live) → 강의 판 · 길이 · 상영 상태
//   레일 배너(브랜치 보는 중)   → 「지금 어디를 보고 있는가」 안내
//   레일 바닥 작성 상자        → 행동 상자(상영 · 펼치기 · 다음 문항)
//   탭(Readme·Monitor·Runs…)  → 분석 · 지문 지도 · 진행 · 원문 · 다른 문항
//   두 판(파일 ⌄ / Output ⌄)  → 왼쪽 기출 원문(지도 + 문제지) 고정 / 오른쪽 분석·진행·같은 유형
//   실행 화면(지표 + 간트)     → 진행(차례 14개의 실제 추정 초로 그린 시간 띠)
//   바닥 단계 카드(파스텔)     → 분석 블록 카드(종류마다 고정 면 색 + 개수 + 활성 링)
//
// ⚠️ 대본은 여기 없다. 왼쪽 단계 이름은 역할·타깃에서 짓고(`lib/csat/theater.ts`),
//    말은 재생을 누른 뒤 `/api/csat/lecture` 로만 온다.

import Link from 'next/link'
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Code2,
  ExternalLink,
  Gauge,
  Headphones,
  Layers,
  ListTree,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { PassageMap, type MapAnchor, type MapPlacement } from '@/components/csat/PassageMap'
import { useLecture } from '@/components/csat/lecture/LectureStage'
import type { SkeletonSentence } from '@/lib/csat/passage-skeleton'
import {
  BLOCK_TINT,
  blockKeyForTarget,
  theaterClock,
  theaterTimeline,
  type TheaterBlock,
  type TheaterStep,
} from '@/lib/csat/theater'
import { useTheaterSfx } from '@/lib/csat/theater-sfx'

import styles from './theater.module.css'

const RATES = [0.9, 1, 1.15] as const

export interface TheaterMap {
  sentences: SkeletonSentence[]
  anchors: MapAnchor[]
  placements: MapPlacement[]
}

export interface TheaterSibling {
  slug: string
  label: string
  no: number
  current: boolean
}

type TabId = 'analysis' | 'run' | 'siblings'

const TABS: { id: TabId; label: string; Icon: typeof BookOpen }[] = [
  { id: 'analysis', label: '분석', Icon: BookOpen },
  { id: 'run', label: '진행', Icon: Gauge },
  { id: 'siblings', label: '같은 유형', Icon: Layers },
]

export function AnalysisTheater({
  title,
  typeName,
  points,
  minutes,
  steps,
  blocks,
  map,
  backHref,
  backLabel,
  next,
  source,
  siblings,
  examLabel,
}: {
  title: string
  typeName: string | null
  points: number | null
  minutes: number
  steps: TheaterStep[]
  blocks: TheaterBlock[]
  map: TheaterMap | null
  backHref: string
  backLabel: string
  next: { href: string; label: string } | null
  source: { url: string; direct: boolean; reason: string | null }
  siblings: TheaterSibling[]
  examLabel: string
}) {
  const lec = useLecture()
  const sfx = useTheaterSfx()
  const [cursor, setCursor] = useState(0)
  const [all, setAll] = useState(steps.length === 0)
  const [tab, setTab] = useState<TabId>('analysis')
  const railRef = useRef<HTMLDivElement>(null)
  const blocksRef = useRef<HTMLDivElement>(null)
  const played = useRef(-1)

  const playing = Boolean(lec && (lec.status === 'playing' || lec.status === 'paused'))
  const blockKeys = useMemo(() => blocks.map((b) => b.key), [blocks])
  const timeline = useMemo(() => theaterTimeline(steps), [steps])

  useEffect(() => {
    if (playing && lec) setCursor(lec.index)
  }, [playing, lec])

  useEffect(() => {
    if (played.current === cursor) return
    const first = played.current === -1
    played.current = cursor
    if (!first || playing) sfx.play(steps[cursor]?.sfx ?? 'step')
  }, [cursor, playing, sfx, steps])

  const open = useMemo(() => {
    if (all || !steps.length) return new Set(blockKeys)
    const shown = new Set<string>(['analysis:head'])
    for (let i = 0; i <= cursor && i < steps.length; i += 1) {
      const key = blockKeyForTarget(steps[i].targetKey, blockKeys)
      if (key && key !== 'analysis:map') shown.add(key)
    }
    return shown
  }, [all, blockKeys, cursor, steps])

  const step = steps[cursor] ?? null
  const liveKey = step ? blockKeyForTarget(step.targetKey, blockKeys) : null

  const move = (delta: number) => {
    const to = Math.max(0, Math.min(steps.length - 1, cursor + delta))
    if (to === cursor) return
    if (playing && lec) void (delta > 0 ? lec.next() : lec.prev())
    else setCursor(to)
  }
  const goto = (index: number) => {
    if (playing && lec) lec.start(index, 'cue')
    else setCursor(index)
  }
  const jumpToBlock = (key: string) => {
    setTab('analysis')
    const index = steps.findIndex((s) => blockKeyForTarget(s.targetKey, blockKeys) === key)
    if (index >= 0) goto(index)
    window.setTimeout(
      () => blocksRef.current?.querySelector(`[data-block="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
      0,
    )
  }

  useEffect(() => {
    railRef.current?.querySelector('[data-state="live"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [cursor])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        move(1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        move(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const status = lec?.status ?? 'idle'
  const silent = lec?.mode === 'silent'
  const mainLabel =
    status === 'loading'
      ? '여는 중…'
      : status === 'playing'
        ? '멈춤'
        : status === 'paused'
          ? '이어서'
          : status === 'ended'
            ? '처음부터'
            : silent
              ? `하이라이트만 · 약 ${minutes}분`
              : `상영 시작 · 약 ${minutes}분`
  const MainIcon = status === 'playing' ? Pause : silent ? Play : Headphones
  const elapsed = timeline.segments.slice(0, cursor).reduce((sum, s) => sum + s.sec, 0)

  return (
    <div className={styles.workspace} data-csat-theater data-testid="analysis-theater">
      {/* ── 상단 막대 ─────────────────────────────────────────── */}
      <header className={styles.bar}>
        <Link className={styles.back} href={backHref}>
          <ChevronLeft size={15} aria-hidden /> {backLabel}
        </Link>
        <h1 className={styles.docTitle}>{title}</h1>
        {typeName ? <span className={styles.tag}># {typeName}</span> : null}
        {points ? <span className={styles.tagQuiet}>{points}점</span> : null}
        <div className={styles.barRight}>
          <button type="button" className={styles.iconBtn} onClick={sfx.toggle} aria-pressed={sfx.on} title="효과음">
            {sfx.on ? <Volume2 size={15} aria-hidden /> : <VolumeX size={15} aria-hidden />}
          </button>
          <button type="button" className={styles.iconBtn} onClick={() => setAll((v) => !v)} aria-pressed={all} title="전부 펼쳐 읽기">
            <ListTree size={15} aria-hidden />
          </button>
          {lec ? (
            <button
              type="button"
              className={styles.rate}
              onClick={() => lec.setRate(RATES[(RATES.indexOf(lec.rate as (typeof RATES)[number]) + 1) % RATES.length])}
              title="말하기 속도"
            >
              {lec.rate.toFixed(2).replace(/0$/, '')}×
            </button>
          ) : null}
          {lec ? (
            <button type="button" className={styles.play} onClick={() => (status === 'idle' ? lec.start(cursor, 'start') : lec.toggle())}>
              <MainIcon size={15} aria-hidden /> {mainLabel}
            </button>
          ) : null}
        </div>
      </header>

      <div className={styles.body}>
        {/* ── ① 레일 ─────────────────────────────────────────── */}
        <aside className={styles.rail} aria-label="이 문항을 읽는 차례">
          <div className={styles.railTop}>
            <span className={styles.liveDot} data-on={playing} aria-hidden />
            <b>{steps.length ? `강의 · 차례 ${steps.length}` : '상영 없음'}</b>
            <span className={styles.railTime}>{steps.length ? theaterClock(timeline.total) : '—'}</span>
          </div>
          <p className={styles.railBanner}>
            <Circle size={12} aria-hidden />
            <span>{all ? '전부 펼쳐 읽는 중이에요.' : playing ? '상영을 따라가는 중이에요.' : '차례를 눌러 그 자리부터 볼 수 있어요.'}</span>
            <button type="button" onClick={() => setAll((v) => !v)}>
              {all ? '차례대로' : '전부 펼치기'}
            </button>
          </p>

          <div className={styles.stream} ref={railRef}>
            {steps.length ? (
              steps.map((s) => {
                const state = s.index === cursor ? 'live' : s.index < cursor ? 'done' : 'wait'
                return (
                  <div key={s.id} className={styles.step} data-state={state}>
                    <span className={styles.dot} aria-hidden />
                    <button type="button" className={styles.stepBtn} onClick={() => goto(s.index)} aria-current={state === 'live' ? 'step' : undefined}>
                      <span className={styles.stepKind}>
                        {s.kind} · {String(s.index + 1).padStart(2, '0')}
                        <em>{Math.round(s.sec)}초</em>
                      </span>
                      {s.name}
                    </button>
                  </div>
                )
              })
            ) : (
              <p className={styles.quiet}>이 문항에는 아직 상영(강의)이 없어요. 오른쪽 분석은 그대로 읽을 수 있어요.</p>
            )}
          </div>

          {/* 참조의 작성 상자 자리 — 여기서는 «이 문항으로 무엇을 할까» 다 */}
          <div className={styles.composer}>
            <p className={styles.composerHead}>
              <span className={styles.avatar} aria-hidden>
                V
              </span>
              이 문항으로 무엇을 할까요?
            </p>
            <div className={styles.composerActions}>
              <button type="button" onClick={() => move(1)} disabled={cursor >= steps.length - 1}>
                다음 단계
              </button>
              <button type="button" onClick={() => setTab('run')}>
                진행 보기
              </button>
              {next ? (
                <Link href={next.href}>같은 유형 다음 문항</Link>
              ) : (
                <Link href={backHref}>기출 목록</Link>
              )}
            </div>
            <div className={styles.composerFoot}>
              <span className={styles.pill}>
                {cursor + 1} / {Math.max(1, steps.length)} · {theaterClock(elapsed)} 지남
              </span>
              <button type="button" className={styles.round} onClick={() => move(-1)} disabled={cursor === 0} title="이전 단계">
                <ChevronLeft size={15} aria-hidden />
              </button>
              <button type="button" className={styles.round} onClick={() => move(1)} disabled={cursor >= steps.length - 1} title="다음 단계">
                <ChevronRight size={15} aria-hidden />
              </button>
            </div>
          </div>
        </aside>

        {/* ── ② 본문 ─────────────────────────────────────────── */}
        <section className={styles.main}>
          {/* 참조의 단계 머리(← Control onboarding demo · 오른쪽 도구) */}
          <div className={styles.stageHead}>
            <button type="button" className={styles.iconBtn} onClick={() => move(-1)} disabled={cursor === 0} title="이전 단계">
              <ChevronLeft size={15} aria-hidden />
            </button>
            <p className={styles.now}>
              <b>{step?.name ?? '분석 읽기'}</b>
              <span>
                {String(cursor + 1).padStart(2, '0')} / {String(Math.max(1, steps.length)).padStart(2, '0')}
              </span>
            </p>
            <p className={styles.legend}>
              <span className={styles.legendAnswer}>정답 근거</span>
              <span className={styles.legendReject}>오답 지우는 자리</span>
              <span className={styles.clock}>{theaterClock(elapsed)} / {theaterClock(timeline.total)}</span>
            </p>
            {lec?.error ? (
              <p className={styles.notice} role="status">
                {lec.error}
              </p>
            ) : silent && playing ? (
              <p className={styles.notice} role="status">
                한국어 음성이 없어 강조만 넘어가요
              </p>
            ) : null}
          </div>

          <div className={styles.view}>
            <div className={styles.panes}>
              {/* ── 왼쪽 판: 기출 원문(참조의 README 자리) ── */}
              <section className={styles.pane} aria-label="기출 원문">
                <p className={styles.paneHead}>
                  <Code2 size={13} aria-hidden />
                  <span className={styles.file}>원문 · {examLabel}</span>
                  <ChevronDown size={12} aria-hidden />
                  <em>{map ? `${map.sentences.length} SENTENCES` : 'NO MAP'}</em>
                </p>
                <div className={styles.paneBody}>
                  <p className={styles.lead}>
                    <b>{title}</b>
                    {typeName ? <> · <code>{typeName}</code></> : null}
                    {points ? <> · <code>{points}점</code></> : null}
                  </p>
                  {map ? (
                    <PassageMap sentences={map.sentences} anchors={map.anchors} placements={map.placements} />
                  ) : (
                    <p className={styles.quiet}>이 문항은 지문 골격을 구하지 못해 지도가 없어요. 분석은 오른쪽에서 그대로 읽을 수 있어요.</p>
                  )}
                  <dl className={styles.kv}>
                    <div>
                      <dt>문제지</dt>
                      <dd>
                        <a href={source.url} target="_blank" rel="noreferrer">
                          {source.direct ? '평가원 문제지 PDF 열기' : '평가원 게시판에서 찾기'} <ExternalLink size={13} aria-hidden />
                        </a>
                      </dd>
                    </div>
                  </dl>
                  {source.reason ? <p className={styles.quiet}>{source.reason}</p> : null}
                  <p className={styles.quiet}>
                    지문·선지는 평가원 저작물이라 이 화면에 싣지 않아요 — 막대는 <b>문장 길이</b>이고, 근거 인용만 짧게 드러납니다.
                  </p>
                </div>
              </section>

              {/* ── 오른쪽 판: 출력(참조의 Output ⌄ 자리) ── */}
              <section className={styles.pane} aria-label="해설">
                <div className={styles.paneHead}>
                  <nav className={styles.tabs} aria-label="보기">
                    {TABS.map(({ id, label, Icon }) => (
                      <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>
                        <Icon size={13} aria-hidden /> {label}
                      </button>
                    ))}
                  </nav>
                  <em>
                    {tab === 'analysis'
                      ? `${[...open].length} / ${blocks.length} BLOCKS`
                      : tab === 'run'
                        ? `${steps.length} STEPS`
                        : `${siblings.length} ITEMS`}
                  </em>
                </div>

                {tab === 'analysis' ? (
                  <div className={`${styles.paneBody} ${styles.blockPane}`} ref={blocksRef}>
                    <p className={styles.status}>
                      <span data-on={playing}>{playing ? 'LIVE' : 'READY'}</span>
                      {step ? `${step.kind} · ${Math.round(step.sec)}초` : '분석'}
                    </p>
                    {blocks.map((b) => (
                      <article
                        key={b.key}
                        data-block={b.key}
                        data-lecture-target={b.key}
                        data-kind={b.kind}
                        data-live={b.key === liveKey}
                        className={styles.block}
                        hidden={!open.has(b.key)}
                      >
                        <div className={styles.chips}>
                          {b.chips.map((c) => (
                            <span key={c.text} className={styles.chip} data-tone={c.tone ?? 'plain'}>
                              {c.text}
                            </span>
                          ))}
                        </div>
                        <h2>{b.title}</h2>
                        {b.body.map((p, i) => (
                          <p key={i}>{p}</p>
                        ))}
                        {b.quote ? <blockquote lang="en">{b.quote}</blockquote> : null}
                      </article>
                    ))}
                    {!all && steps.length && blocks.length > open.size ? (
                      <p className={styles.pending}>
                        <b>{blocks.length - open.size}개가 아직 닫혀 있어요</b>
                        차례를 넘기면 그 자리에서 열립니다. 지금 전부 읽으려면 위의 «전부 펼쳐 읽기».
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {tab === 'run' ? (
                  <div className={styles.paneBody}>
                    <div className={styles.metrics}>
                      <div>
                        <dt>차례</dt>
                        <dd>{steps.length}</dd>
                      </div>
                      <div>
                        <dt>지금</dt>
                        <dd>
                          {String(cursor + 1).padStart(2, '0')}
                          <span className={styles.badge} data-on={playing}>
                            {playing ? '상영 중' : '멈춤'}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt>지난 시간</dt>
                        <dd>{theaterClock(elapsed)}</dd>
                      </div>
                      <div>
                        <dt>전체</dt>
                        <dd>{theaterClock(timeline.total)}</dd>
                      </div>
                    </div>
                    <div className={styles.gantt}>
                      <div className={styles.track} role="group" aria-label="차례별 길이">
                        {timeline.segments.map((seg) => (
                          <button
                            key={seg.index}
                            type="button"
                            className={styles.seg}
                            style={{ width: `${seg.pct}%` }}
                            data-state={seg.index === cursor ? 'live' : seg.index < cursor ? 'done' : 'wait'}
                            onClick={() => goto(seg.index)}
                            title={`${seg.kind} · ${seg.name} · ${Math.round(seg.sec)}초`}
                            aria-label={`${seg.index + 1}단계 ${seg.name} · ${Math.round(seg.sec)}초`}
                          />
                        ))}
                      </div>
                      <div className={styles.axis}>
                        {timeline.marks.map((m) => (
                          <span key={m}>{m}s</span>
                        ))}
                      </div>
                    </div>
                    <ol className={styles.runList}>
                      {timeline.segments.map((seg) => (
                        <li key={seg.index} data-state={seg.index === cursor ? 'live' : seg.index < cursor ? 'done' : 'wait'}>
                          <button type="button" onClick={() => goto(seg.index)}>
                            <span className={styles.runNo}>{String(seg.index + 1).padStart(2, '0')}</span>
                            <span className={styles.runKind}>{seg.kind}</span>
                            <span className={styles.runName}>{seg.name}</span>
                            <span className={styles.runSec}>{Math.round(seg.sec)}초</span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}

                {tab === 'siblings' ? (
                  <div className={styles.paneBody}>
                    <ul className={styles.siblings}>
                      {siblings.map((s) => (
                        <li key={s.slug}>
                          <Link href={`/csat/item/${s.slug}`} aria-current={s.current ? 'page' : undefined} data-current={s.current}>
                            <b>{s.no}</b>
                            <span>{s.label}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            </div>
          </div>

          {/* ── ③ 바닥 블록 카드 ────────────────────────────── */}
          <nav className={styles.cards} aria-label="분석 블록으로 이동">
            {blocks.map((b) => {
              const state = b.key === liveKey ? 'live' : open.has(b.key) ? 'done' : 'wait'
              return (
                <button
                  key={b.key}
                  type="button"
                  className={styles.card}
                  data-state={state}
                  data-tint={BLOCK_TINT[b.kind]}
                  onClick={() => jumpToBlock(b.key)}
                >
                  <b>{b.title}</b>
                  <span>
                    <em>{b.body.length || 1}</em>
                    {b.chips.slice(0, 2).map((c) => (
                      <i key={c.text}>{c.text}</i>
                    ))}
                  </span>
                  {state === 'live' ? <u aria-hidden /> : null}
                </button>
              )
            })}
          </nav>
        </section>
      </div>
    </div>
  )
}
