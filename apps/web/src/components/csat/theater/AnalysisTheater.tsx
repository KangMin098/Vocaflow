'use client'

// apps/web/src/components/csat/theater/AnalysisTheater.tsx
//
// **해설 극장 — 왼쪽은 차례, 오른쪽은 그 차례가 가리키는 곳.**
//
//   ① 레일   문항 카드 + 사고 과정 단계가 **하나씩 쌓인다**(강의 큐 12~14개 = 이 문항을 읽는 순서)
//   ② 무대   왼: 지문 지도(문장 막대·근거 칩) · 오: 분석 블록이 **차례로 붙는다**
//   ③ 장 카드 바닥 줄 — 누르면 그 장부터
//
// 한 큐 = 왼쪽 한 단계 + 오른쪽 한 블록 + 지도 하이라이트 하나. 셋이 같은 인덱스에서 움직이므로
// 귀·왼쪽·오른쪽이 갈라질 수 없다. 재생 엔진은 `LectureStage`/`LecturePlayer` 를 그대로 쓴다 —
// 이 파일은 **판면과 순서 표시**만 맡는다.
//
// ⚠️ 대본은 여기 없다. 왼쪽 단계 이름은 역할·타깃에서 짓고(`lib/csat/theater.ts`),
//    말은 재생을 누른 뒤 `/api/csat/lecture` 로만 온다.
// ⚠️ 「전부 펼쳐 읽기」를 둔다. 순차 표출은 기본값이지 감옥이 아니다 — 이미 아는 문항을
//    다시 여는 사람에게 12단계를 강요하면 화면이 느려지기만 한다.

import Link from 'next/link'
import { ChevronLeft, ChevronRight, Headphones, ListTree, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { PassageMap, type MapAnchor, type MapPlacement } from '@/components/csat/PassageMap'
import { useLecture } from '@/components/csat/lecture/LectureStage'
import type { SkeletonSentence } from '@/lib/csat/passage-skeleton'
import { blockKeyForTarget, type TheaterBlock, type TheaterStep } from '@/lib/csat/theater'
import { useTheaterSfx } from '@/lib/csat/theater-sfx'

import styles from './theater.module.css'

const RATES = [0.9, 1, 1.15] as const

export interface TheaterMap {
  sentences: SkeletonSentence[]
  anchors: MapAnchor[]
  placements: MapPlacement[]
}

export function AnalysisTheater({
  title,
  typeName,
  minutes,
  steps,
  blocks,
  map,
  backHref,
  backLabel,
  next,
}: {
  title: string
  typeName: string | null
  minutes: number
  steps: TheaterStep[]
  blocks: TheaterBlock[]
  map: TheaterMap | null
  backHref: string
  backLabel: string
  next: { href: string; label: string } | null
}) {
  const lec = useLecture()
  const sfx = useTheaterSfx()
  const [cursor, setCursor] = useState(0)
  const [all, setAll] = useState(steps.length === 0)
  const railRef = useRef<HTMLDivElement>(null)
  const blocksRef = useRef<HTMLDivElement>(null)
  const played = useRef(-1)

  const playing = Boolean(lec && (lec.status === 'playing' || lec.status === 'paused'))
  const blockKeys = useMemo(() => blocks.map((b) => b.key), [blocks])

  // 재생 중에는 엔진이 차례를 쥔다. 멈춰 있으면 학습자가 쥔다(← → · 단계 클릭).
  useEffect(() => {
    if (playing && lec) setCursor(lec.index)
  }, [playing, lec])

  // 큐가 바뀔 때 한 번. 같은 자리로 돌아온 경우는 내지 않는다 — 소리가 «새 단계» 를 뜻해야 한다.
  useEffect(() => {
    if (played.current === cursor) return
    const first = played.current === -1
    played.current = cursor
    if (!first || playing) sfx.play(steps[cursor]?.sfx ?? 'step')
  }, [cursor, playing, sfx, steps])

  // 지금까지 지나온 단계가 가리킨 블록만 열려 있다. 「전부 펼쳐 읽기」면 전부.
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
    const index = steps.findIndex((s) => blockKeyForTarget(s.targetKey, blockKeys) === key)
    if (index >= 0) goto(index)
    setTimeout(() => blocksRef.current?.querySelector(`[data-block="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 0)
  }

  // 지금 단계가 보이게 — 큐가 바뀔 때만 한 번(붙들기·멈춤으로는 움직이지 않는다)
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
  const mainLabel =
    status === 'loading'
      ? '여는 중…'
      : status === 'playing'
        ? '멈춤'
        : status === 'paused'
          ? '이어서'
          : status === 'ended'
            ? '처음부터'
            : lec?.mode === 'silent'
              ? `하이라이트만 · 약 ${minutes}분`
              : `상영 시작 · 약 ${minutes}분`
  const MainIcon = status === 'playing' ? Pause : lec?.mode === 'silent' ? Play : Headphones
  const progress = steps.length ? ((cursor + 1) / steps.length) * 100 : 0

  return (
    <div className={styles.root} data-testid="analysis-theater">
      <header className={styles.top}>
        <div className={styles.topIn}>
          <div className={styles.brand}>
            <Link className={styles.back} href={backHref}>
              <ChevronLeft size={15} aria-hidden /> {backLabel}
            </Link>
            <b>{title}</b>
            {typeName ? <span>{typeName}</span> : null}
          </div>
          <div className={styles.ctl}>
            <button type="button" onClick={sfx.toggle} aria-pressed={sfx.on} title="효과음">
              {sfx.on ? <Volume2 size={15} aria-hidden /> : <VolumeX size={15} aria-hidden />}
              <span>{sfx.on ? '효과음 켬' : '효과음 끔'}</span>
            </button>
            <button type="button" onClick={() => setAll((v) => !v)} aria-pressed={all}>
              <ListTree size={15} aria-hidden />
              <span>{all ? '차례대로 보기' : '전부 펼쳐 읽기'}</span>
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
            <button type="button" onClick={() => move(-1)} disabled={cursor === 0} title="이전 단계">
              <ChevronLeft size={16} aria-hidden />
            </button>
            <button type="button" onClick={() => move(1)} disabled={cursor >= steps.length - 1} title="다음 단계">
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
          {lec ? (
            <button type="button" className={styles.play} onClick={() => (status === 'idle' ? lec.start(cursor, 'start') : lec.toggle())}>
              <MainIcon size={16} aria-hidden /> {mainLabel}
            </button>
          ) : null}
        </div>
        <div className={styles.progress}>
          <i style={{ width: `${progress}%` }} />
        </div>
        {lec?.error ? (
          <p className={styles.notice} role="status">
            {lec.error} 다시 눌러 주세요.
          </p>
        ) : lec?.mode === 'silent' && playing ? (
          <p className={styles.notice} role="status">
            이 기기에 한국어 음성이 없어 소리 없이 강조만 넘어가요.
          </p>
        ) : null}
      </header>

      <div className={styles.theater}>
        {/* ① 레일 — 문항과 사고 과정 */}
        <section className={styles.rail} aria-label="이 문항을 읽는 차례">
          <div className={styles.railHead}>
            <p className={styles.eyebrow}>차례 {steps.length || blocks.length}</p>
            <h1>{title}</h1>
            <p className={styles.railMeta}>
              {typeName ?? '유형 미정'}
              {steps.length ? ` · 약 ${minutes}분` : ' · 상영 없음'}
            </p>
          </div>
          <div className={styles.steps} ref={railRef}>
            {steps.length ? (
              steps.map((s) => {
                const state = s.index === cursor ? 'live' : s.index < cursor ? 'done' : 'wait'
                return (
                  <div key={s.id} className={styles.step} data-state={state}>
                    <span className={styles.dot} aria-hidden />
                    <button type="button" className={styles.stepBtn} onClick={() => goto(s.index)} aria-current={state === 'live' ? 'step' : undefined}>
                      <span className={styles.stepKind}>
                        {s.kind} · {String(s.index + 1).padStart(2, '0')}
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
          <p className={styles.railFoot}>← → 로 단계를 옮겨요. 단계를 누르면 그 자리부터 다시 들어요.</p>
        </section>

        {/* ② 무대 — 지도와 부가 정보 */}
        <section className={styles.stage} aria-label="지문 지도와 분석">
          <div className={styles.stageBar}>
            <p className={styles.now}>
              <span>{String(cursor + 1).padStart(2, '0')}</span>
              <b>{step?.name ?? '분석 읽기'}</b>
            </p>
            <p className={styles.legendRow}>
              <span className={styles.legendAnswer}>정답 근거</span>
              <span className={styles.legendReject}>오답 지우는 자리</span>
            </p>
          </div>
          <div className={styles.panes}>
            <div className={styles.mapPane}>
              {map ? (
                <PassageMap sentences={map.sentences} anchors={map.anchors} placements={map.placements} />
              ) : (
                <p className={styles.quiet}>이 문항은 지문 골격을 구하지 못해 지도가 없어요. 분석은 오른쪽에서 그대로 읽을 수 있어요.</p>
              )}
            </div>
            <div className={styles.blockPane} ref={blocksRef}>
              {blocks.map((b) => {
                const shown = open.has(b.key)
                return (
                  <article
                    key={b.key}
                    data-block={b.key}
                    data-lecture-target={b.key}
                    data-kind={b.kind}
                    className={styles.block}
                    hidden={!shown}
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
                )
              })}
              {!all && steps.length ? <p className={styles.pending}>{blocks.length - [...open].length}개가 뒤 단계에서 열려요.</p> : null}
            </div>
          </div>

          {/* ③ 장 카드 */}
          <nav className={styles.chapters} aria-label="분석 블록으로 이동">
            {blocks.map((b) => (
              <button
                key={b.key}
                type="button"
                className={styles.chapter}
                data-state={open.has(b.key) ? (blockKeyForTarget(step?.targetKey ?? '', blockKeys) === b.key ? 'live' : 'done') : 'wait'}
                onClick={() => jumpToBlock(b.key)}
              >
                <b>{b.title}</b>
                <span>{b.chips[0]?.text ?? ''}</span>
              </button>
            ))}
          </nav>
        </section>
      </div>

      {next ? (
        <p className={styles.next}>
          <Link href={next.href}>
            같은 유형 다음 문항 · {next.label} <ChevronRight size={15} aria-hidden />
          </Link>
        </p>
      ) : null}
    </div>
  )
}
