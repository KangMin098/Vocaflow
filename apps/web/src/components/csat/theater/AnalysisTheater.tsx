// apps/web/src/components/csat/theater/AnalysisTheater.tsx
'use client'
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
  Code2,
  ExternalLink,
  FileText,
  Gauge,
  Headphones,
  Layers,
  ListTree,
  Pause,
  Play,
  Terminal,
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
import { track } from '@/lib/analytics/client'
import { withView } from '@/lib/csat/continuity'
import { toItemSlug } from '@/lib/csat/item-slug'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { loadSyncedDissectionRecord, updateDissectionRecord } from '@/lib/csat/session/store'
import type { DissectionRecord, Prediction } from '@/lib/csat/dissect'
import {
  finishSession,
  isSkipPrediction,
  openSession,
  restartSession,
  revealSession,
  scheduleReview,
  sessionsOf,
  stepSession,
  type LearningSession,
} from '@/lib/csat/learning-session'
import type { Pattern, Transform } from '@/lib/csat/design'
import { OPEN_BEFORE_COMMIT, committedOf, grade, maskChip, maskName, toPrediction, type GateCommit, type GateKey } from '@/lib/csat/reveal-gate'

import type { LearnerCatalog } from '@/lib/csat/session/catalog'

import { ItemPaper, type PaperPassage } from './ItemPaper'
import { EvidenceQuote } from './EvidenceQuote'
import { GateDiff, PredictGate } from './PredictGate'
import { SessionDone } from './SessionDone'
import styles from './theater.module.css'

const RATES = [0.9, 1, 1.15] as const

// 해설 공개 서버 기록 — 최초 공개 시각을 고정해 보관하고, 실패하면 다음에 극장을 열 때 같은 본문으로 다시 보낸다(재전송 = 서버 duplicate · Codex P1)
// userId: 공개한 계정 — 공유 기기에서 다른 계정으로 바뀐 뒤 재전송되면 서버가 버린다(Codex P1)
type PendingReveal = { slug: string; sessionId: string; help: 'independent' | 'viewed_first'; revealedAt: string; userId: string | null }
async function currentUserId(): Promise<string | null> {
  try { return (await createBrowserClient().auth.getUser()).data.user?.id ?? null } catch { return null }
}
const REVEAL_KEY = 'vf.csat.pendingReveals'
const readPending = (): PendingReveal[] => { try { const v = JSON.parse(localStorage.getItem(REVEAL_KEY) ?? '[]'); return Array.isArray(v) ? v : [] } catch { return [] } }
const writePending = (xs: PendingReveal[]) => { try { localStorage.setItem(REVEAL_KEY, JSON.stringify(xs.slice(-50))) } catch { /* 저장소 없음 — 이번 전송만 */ } }
async function postReveal(r: PendingReveal): Promise<boolean> {
  try {
    const res = await fetch(`/api/csat/item/${r.slug}/reveal`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: r.sessionId, help: r.help, revealedAt: r.revealedAt, userId: r.userId }), keepalive: true })
    // 4xx(잘못된 본문 · 로그인 없음)는 다시 보내도 같다 — 보관하지 않는다
    return res.ok || (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429)
  } catch {
    return false
  }
}
async function sendReveal(r: PendingReveal) {
  writePending([...readPending().filter((x) => x.sessionId !== r.sessionId), r])
  if (await postReveal(r)) writePending(readPending().filter((x) => x.sessionId !== r.sessionId))
}
async function flushReveals() {
  const me = await currentUserId()
  // 지금 로그인한 계정이 남긴 것만 다시 보낸다 — 다른 계정의 기록은 그 계정이 다시 열 때까지 둔다
  for (const r of readPending().filter((x) => x.userId !== null && x.userId === me)) if (await postReveal(r)) writePending(readPending().filter((x) => x.sessionId !== r.sessionId))
}

const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`

/** 이 세션의 예측 — 세션 id 로 묶인 것, 세션이 없던 시절 남긴 것은 공개된 세션에서만 이어 받는다 */
function predictionOf(record: DissectionRecord, s: LearningSession): Prediction | null {
  const mine = record.predictions.filter((p) => p.item === s.item && p.source === 'theater')
  const own = mine.filter((p) => p.session === s.id)
  if (own.length) return own[own.length - 1]
  if (s.stage === 'open') return null
  const legacy = mine.filter((p) => !p.session)
  return legacy.length ? legacy[legacy.length - 1] : null
}

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
  itemId,
  backHref,
  typeHref,
  next,
  source,
  siblings,
  examLabel,
  paper,
  gate,
  typeId,
}: {
  title: string
  typeName: string | null
  points: number | null
  minutes: number
  steps: TheaterStep[]
  blocks: TheaterBlock[]
  map: TheaterMap | null
  /** 문항 id(`2026#31`) — 열람 기록용 */
  itemId: string
  /** 기출분석공간 홈 */
  backHref: string
  /** 이 유형의 서가 — 유형을 모르면 null */
  typeHref: string | null
  next: { href: string; label: string } | null
  /** url 이 null 이면 갈 곳이 없다(학력평가 — 교육청 출제라 평가원 자료실에 없다). 링크 대신 사유만 보인다 */
  source: { url: string | null; direct: boolean; reason: string | null }
  siblings: TheaterSibling[]
  examLabel: string
  /** 왼쪽 열 원본 — 기기의 문제지 추출본을 읽는다(서버는 원문을 보내지 않는다) */
  paper: { catalog: LearnerCatalog; examId: string; no: number }
  /** 공개 게이트의 정답 열쇠 — 확정 전에는 화면에 쓰지 않는다 */
  gate: GateKey
  typeId: string
}) {
  const lec = useLecture()
  const [quotePassage, setQuotePassage] = useState<PaperPassage | null>(null)
  // 문항 이동 직후에는 이전 문항의 지문으로 인용을 검증하지 않는다.
  const currentPassage = quotePassage?.itemId === itemId ? quotePassage.passage : null
  const back = (to: 'home' | 'type' | 'browse') => () => track({ name: 'csat_item_back', props: { to } })
  // 학습 세션(G0 계약) — undefined = 기록 읽는 중. 세션은 시도가 0건이어도 있다.
  const [session, setSession] = useState<LearningSession | null | undefined>(undefined)
  // 공개 게이트 — undefined = 기록 읽는 중 · null = 아직 확정 안 함
  const [committed, setCommitted] = useState<Prediction | null | undefined>(undefined)
  const [resumedAt, setResumedAt] = useState<number | null>(null)
  const sfx = useTheaterSfx()
  const [cursor, setCursor] = useState(0)
  const ready = useRef(false)
  // 기기 저장(IndexedDB) 실패 — 기록은 이 탭 메모리에만 있다. 완료처럼 보여도 창을 닫으면 사라진다고 알린다
  const [saveFailed, setSaveFailed] = useState(false)
  const persist = (fn: (r: DissectionRecord) => DissectionRecord) =>
    updateDissectionRecord(fn).then((res) => {
      if (!res.saved) setSaveFailed(true)
      return res
    })
  const sync =(record: DissectionRecord, id: string) => {
    const s = sessionsOf(record).find((x) => x.id === id) ?? null
    setSession(s)
    setCommitted(s ? predictionOf(record, s) : null)
    return s
  }
  // 문항을 연다 — 서버 사본과 합친 뒤(다른 기기에서 하던 자리) 열람을 남기고 세션을 재개하거나 새로 연다
  // 앞서 실패한 해설 공개 기록을 다시 보낸다(최초 공개 시각 그대로)
  useEffect(() => { void flushReveals() }, [])
  useEffect(() => {
    let alive = true
    ready.current = false
    void (async () => {
      await loadSyncedDissectionRecord().catch(() => null)
      let opened: { session: LearningSession; resumed: boolean } | null = null
      const { record } = await persist((r) => {
        const now = Date.now()
        const viewed = withView(r, itemId, now)
        const o = openSession(viewed, { itemId, steps: steps.length, now, newId, legacy: committedOf(viewed, itemId) })
        opened = o
        return o.record
      })
      if (!alive || !opened) return
      const { session: s, resumed } = opened as { session: LearningSession; resumed: boolean }
      sync(record, s.id)
      if (resumed && s.step > 0 && s.step < steps.length) {
        setCursor(s.step)
        setResumedAt(s.step)
      } else setCursor(0)
      ready.current = true
    })()
    return () => {
      alive = false
    }
    // steps.length 는 서버가 정한 값 — 문항이 바뀔 때만 다시 연다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId])
  // 단계 위치를 남긴다 — 이탈 뒤 그 자리에서 이어 본다(같은 단계면 저장하지 않는다)
  useEffect(() => {
    if (!ready.current || !session || session.stage === 'finished') return
    const id = session.id
    void persist((r) => stepSession(r, id, cursor, Date.now()))
  }, [cursor, session])
  const revealed = committed != null || (session != null && session.stage !== 'open')
  const finished = session?.stage === 'finished'
  const commit = (c: GateCommit) => {
    if (!session) return
    const skip = c.sentence == null && c.choice == null
    const attempt = newId()
    const p: Prediction = { ...toPrediction(itemId, typeId, c, grade(c, gate), Date.now()), attempt, session: session.id }
    setCommitted(p)
    // 예측 패널이 길어 판을 내린 채 확정하면 차이 카드가 판 위쪽 밖에 열린다 — 그리로 데려간다
    requestAnimationFrame(() => document.querySelector('[data-testid="gate-diff"]')?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
    const id = session.id
    void persist((r) => {
      // 같은 시도가 두 번 오면 한 건(멱등) · 「모르겠어요」는 시도가 아니라 도움 수준(viewed_first)
      const predictions = r.predictions.some((x) => x.attempt === attempt) ? r.predictions : [...r.predictions, p]
      return revealSession({ ...r, predictions }, id, skip ? 'viewed_first' : 'independent', skip ? null : attempt, Date.now())
    }).then(({ record }) => sync(record, id))
    // 서버 학습 세션에도 공개를 남긴다 — 같은 문항의 Practice · 확인 과제가 「해설을 본 뒤의 판단」 임을 서버가 알게(Codex P1).
    // 학습 흐름을 막지 않는다(실패해도 극장은 계속) · 같은 공개의 재전송은 서버에서 duplicate
    const revealedAt = new Date().toISOString()
    void currentUserId().then((userId) => sendReveal({ slug: toItemSlug(itemId), sessionId: id, help: skip ? 'viewed_first' : 'independent', revealedAt, userId }))
  }
  const finish = () => {
    if (!session) return
    const id = session.id
    void persist((r) => finishSession(r, id, Date.now())).then(({ record }) => {
      sync(record, id)
      requestAnimationFrame(() => document.querySelector('[data-testid="session-done"]')?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
    })
  }
  const review = () => {
    if (!session) return
    const id = session.id
    void persist((r) => scheduleReview(r, id, Date.now())).then(({ record }) => sync(record, id))
  }
  const restart = () => {
    let fresh: LearningSession | null = null
    void persist((r) => {
      const o = restartSession(r, itemId, steps.length, Date.now(), newId)
      fresh = o.session
      return o.record
    }).then(({ record }) => {
      if (!fresh) return
      setResumedAt(null)
      setCursor(0)
      sync(record, (fresh as LearningSession).id)
    })
  }
  const [all, setAll] = useState(steps.length === 0)
  const [tab, setTab] = useState<TabId>('analysis')
  const railRef = useRef<HTMLElement>(null)
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

  // 확정 전엔 머리 · 「재는 것」만 — 차례·「전부 펼치기」와 무관하게 닫아 둔다
  const shownOpen = revealed ? open : new Set(blocks.filter((b) => OPEN_BEFORE_COMMIT.has(b.kind)).map((b) => b.key))
  const label = (name: string, kind: string) => (revealed ? name : maskName(name, kind))
  const mine: GateCommit | null = committed
    ? {
        sentence: committed.sentence ?? null,
        choice: committed.choice ?? null,
        confidence: committed.confidence ?? 1,
        // 설계 칸은 고른 것만 기록된다 — 없으면 undefined 로 두어 차이 카드에서 그 줄을 빼게 한다
        ...(committed.topic !== undefined ? { topic: committed.topic } : {}),
        ...(committed.pattern ? { pattern: committed.pattern as Pattern } : {}),
        ...(committed.transform ? { transform: committed.transform as Transform } : {}),
      }
    : null
  const diff = mine ? <GateDiff commit={mine} result={grade(mine, gate)} gateKey={gate} /> : null
  // 마지막 단계(강의가 없으면 공개 직후)에서 마칠 수 있다
  const atEnd = steps.length === 0 || cursor >= steps.length - 1
  const done =
    finished && session ? (
      <SessionDone
        session={session}
        result={committed && !isSkipPrediction(committed) && mine ? grade(mine, gate) : null}
        next={next}
        typeHref={typeHref}
        now={Date.now()}
        onReview={review}
        onRestart={restart}
      />
    ) : null
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
    railRef.current?.querySelector('[data-state="live"]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
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
      {/* ── 상단: ← 제목 + 태그 칩 · 오른쪽 재생 컨트롤 ─────────────── */}
      <header className={styles.bar}>
        <Link className={styles.backIcon} href={backHref} onClick={back('home')} data-testid="item-back-home" aria-label="기출분석공간 홈">
          <ChevronLeft size={16} aria-hidden />
        </Link>
        <h1 className={styles.docTitle}>{title}</h1>
        {typeName ? <span className={styles.tag}>{typeName}</span> : null}
        {points ? <span className={styles.tag}>{points}점</span> : null}
        <nav className={styles.crumbs} aria-label="목록으로">
          {typeHref ? (
            <Link className={styles.back} href={typeHref} onClick={back('type')} data-testid="item-back-type">
              이 유형 목록
            </Link>
          ) : null}
          <Link className={styles.back} href="/csat/browse" onClick={back('browse')} data-testid="item-back-browse">
            서가
          </Link>
        </nav>
        <div className={styles.barRight}>
          <button type="button" className={styles.iconBtn} onClick={sfx.toggle} aria-pressed={sfx.on} title="효과음" aria-label="효과음">
            {sfx.on ? <Volume2 size={15} aria-hidden /> : <VolumeX size={15} aria-hidden />}
          </button>
          <button type="button" className={styles.iconBtn} onClick={() => setAll((v) => !v)} aria-pressed={all} title="전부 펼쳐 읽기" aria-label="전부 펼쳐 읽기">
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
            <button
              type="button"
              className={styles.play}
              disabled={!revealed}
              title={revealed ? undefined : '예측을 확정하면 상영할 수 있어요'}
              onClick={() => (status === 'idle' ? lec.start(cursor, 'start') : lec.toggle())}
            >
              <MainIcon size={15} aria-hidden /> {revealed ? mainLabel : '예측 후 상영'}
            </button>
          ) : null}
        </div>
      </header>

      <div className={styles.body}>
        {/* ── ① 왼쪽 열: 기출문제 원본 + 행동 상자 ───────────────── */}
        <aside className={styles.rail} aria-label="기출문제 원본">
          <p className={styles.railTop}>
            <FileText size={13} aria-hidden />
            <b>기출문제 원본</b>
            <span className={styles.railTime}>{examLabel}</span>
          </p>
          <div className={styles.stream}>
            <ItemPaper key={itemId} catalog={paper.catalog} examId={paper.examId} no={paper.no} onPassageChange={setQuotePassage} />
          </div>

          <div className={styles.composer}>
            <p className={styles.composerHead}>
              <span className={styles.avatar} aria-hidden>
                V
              </span>
              이 문항으로 무엇을 할까요?
            </p>
            {saveFailed ? (
              <p className={styles.resumeNote} role="status" data-testid="save-failed">
                이 기기에 기록을 저장하지 못했어요 — 이 탭을 닫으면 학습 기록이 사라져요.
              </p>
            ) : null}
            {resumedAt != null && !finished ? (
              <p className={styles.resumeNote} role="status" data-testid="resume-notice">
                지난번 {resumedAt + 1}단계에서 이어서 봐요
              </p>
            ) : null}
            <div className={styles.composerActions}>
              {revealed && !finished && atEnd ? (
                <button type="button" className={styles.finishBtn} onClick={finish} data-testid="finish-item">
                  이 문항 마치기
                </button>
              ) : null}
              {finished ? (
                <span className={styles.resume} data-testid="finished-badge">
                  마친 문항
                </span>
              ) : null}
              <button type="button" onClick={() => move(1)} disabled={cursor >= steps.length - 1}>
                다음 단계
              </button>
              <button type="button" onClick={() => setTab('run')}>
                진행 보기
              </button>
              {next ? (
                <Link href={next.href}>같은 유형 다음 문항</Link>
              ) : (
                <Link href={typeHref ?? '/csat/browse'}>이 유형 목록</Link>
              )}
            </div>
            <div className={styles.composerFoot}>
              <span className={styles.pill}>
                {cursor + 1} / {Math.max(1, steps.length)} · {theaterClock(elapsed)} 지남
              </span>
              <button type="button" className={styles.round} onClick={() => move(-1)} disabled={cursor === 0} title="이전 단계" aria-label="이전 단계">
                <ChevronLeft size={15} aria-hidden />
              </button>
              <button type="button" className={styles.round} onClick={() => move(1)} disabled={cursor >= steps.length - 1} title="다음 단계" aria-label="다음 단계">
                <ChevronRight size={15} aria-hidden />
              </button>
            </div>
          </div>
        </aside>

        {/* ── ② 본문: 탭 + 두 판 ─────────────────────────────── */}
        <section className={styles.main}>
          <div className={styles.stageHead}>
            <nav className={styles.tabs} aria-label="보기">
              {TABS.map(({ id, label, Icon }) => (
                <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>
                  <Icon size={13} aria-hidden /> {label}
                </button>
              ))}
            </nav>
            <p className={styles.legend}>
              <span className={styles.legendAnswer}>정답 근거</span>
              <span className={styles.legendReject}>오답 지우는 자리</span>
              <span className={styles.clock}>
                {theaterClock(elapsed)} / {theaterClock(timeline.total)}
              </span>
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
              {/* ── 왼쪽 판: 원문 · 지문 지도 · 정답 근거 ── */}
              <section className={styles.pane} aria-label="지문 지도">
                <p className={styles.paneHead}>
                  <Code2 size={13} aria-hidden />
                  <span className={styles.file}>지문 지도</span>
                  <ChevronDown size={12} aria-hidden />
                  <em>{map ? `${map.sentences.length} SENTENCES` : 'NO MAP'}</em>
                </p>
                <div className={styles.paneBody}>
                  <p className={styles.lead}>
                    <b>{step ? label(step.name, step.kind) : '분석 읽기'}</b>{' '}
                    <code>
                      {String(cursor + 1).padStart(2, '0')} / {String(Math.max(1, steps.length)).padStart(2, '0')}
                    </code>
                  </p>
                  {session === undefined ? (
                    <p className={styles.quiet} aria-busy="true">기록을 확인하는 중…</p>
                  ) : !revealed ? (
                    <PredictGate sentences={map ? map.sentences.map((x) => x.chars) : []} design={gate.design} onCommit={commit} />
                  ) : map ? (
                    <>
                      {done}
                      {diff}
                      <PassageMap sentences={map.sentences} anchors={map.anchors} placements={map.placements} />
                    </>
                  ) : (
                    <>
                      {done}
                      {diff}
                      <p className={styles.quiet}>이 문항은 지문 골격을 구하지 못해 지도가 없어요. 분석은 오른쪽에서 그대로 읽을 수 있어요.</p>
                    </>
                  )}
                  <dl className={styles.kv}>
                    <div>
                      <dt>문제지</dt>
                      <dd>
                        {source.url ? (
                          <a href={source.url} target="_blank" rel="noreferrer">
                            {source.direct ? '평가원 문제지 PDF 열기' : '평가원 게시판에서 찾기'} <ExternalLink size={13} aria-hidden />
                          </a>
                        ) : (
                          <span className="break-keep">원문 링크 없음 — 받아 둔 문제지 PDF 를 놓으면 이 기기에서만 보여요</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                  {source.reason ? <p className={styles.quiet}>{source.reason}</p> : null}
                </div>
              </section>

              {/* ── 오른쪽 판: 분석 / 진행 / 같은 유형 ── */}
              <section className={styles.pane} aria-label="해설">
                <p className={styles.paneHead}>
                  <Terminal size={13} aria-hidden />
                  <span className={styles.file}>{TABS.find((t) => t.id === tab)?.label}</span>
                  <ChevronDown size={12} aria-hidden />
                  <em>
                    {tab === 'analysis'
                      ? `${[...shownOpen].length} / ${blocks.length} BLOCKS`
                      : tab === 'run'
                        ? `${steps.length} STEPS`
                        : `${siblings.length} ITEMS`}
                  </em>
                </p>

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
                        hidden={!shownOpen.has(b.key)}
                      >
                        <div className={styles.chips}>
                          {b.chips.filter((c) => revealed || !maskChip(c.text)).map((c) => (
                            <span key={c.text} className={styles.chip} data-tone={c.tone ?? 'plain'}>
                              {c.text}
                            </span>
                          ))}
                        </div>
                        <h2>{b.title}</h2>
                        {b.body.map((p, i) => (
                          <p key={i}>{p}</p>
                        ))}
                        <EvidenceQuote passage={currentPassage} quote={b.quote} truncated={b.quoteTruncated} />
                      </article>
                    ))}
                    {!revealed ? (
                      <p className={styles.pending}>
                        <b>{blocks.length - shownOpen.size}개가 아직 닫혀 있어요</b>
                        왼쪽에서 근거 문장 · 정답 · 확신도를 확정하면 정답 근거와 오답 설계가 열립니다.
                      </p>
                    ) : !all && steps.length && blocks.length > shownOpen.size ? (
                      <p className={styles.pending}>
                        <b>{blocks.length - shownOpen.size}개가 아직 닫혀 있어요</b>
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
                            {playing ? '● 상영 중' : '멈춤'}
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
                            title={`${seg.kind} · ${label(seg.name, seg.kind)} · ${Math.round(seg.sec)}초`}
                            aria-label={`${seg.index + 1}단계 ${label(seg.name, seg.kind)} · ${Math.round(seg.sec)}초`}
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
                            <span className={styles.runName}>{label(seg.name, seg.kind)}</span>
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

          {/* ── ③ 하단 도크: 강의 차례(예전 왼쪽 레일) — 강의가 없으면 분석 블록 ── */}
          <div className={styles.dockHead}>
            <span className={styles.liveDot} data-on={playing} aria-hidden />
            <b>{steps.length ? `강의 · 차례 ${steps.length}` : `분석 블록 ${blocks.length}`}</b>
            <span className={styles.railTime}>{steps.length ? theaterClock(timeline.total) : '상영 없음'}</span>
          </div>
          {steps.length ? (
            <nav className={styles.cards} aria-label="이 문항을 읽는 차례" ref={railRef}>
              {steps.map((s) => {
                const state = s.index === cursor ? 'live' : s.index < cursor ? 'done' : 'wait'
                const key = blockKeyForTarget(s.targetKey, blockKeys)
                const kind = blocks.find((b) => b.key === key)?.kind
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={styles.card}
                    data-state={state}
                    data-tint={kind ? BLOCK_TINT[kind] : 'peach'}
                    onClick={() => goto(s.index)}
                    aria-current={state === 'live' ? 'step' : undefined}
                  >
                    <b>{label(s.name, s.kind)}</b>
                    <span>
                      <em>{String(s.index + 1).padStart(2, '0')}</em>
                      <i>{s.kind}</i>
                      <i>{Math.round(s.sec)}초</i>
                    </span>
                    {state === 'live' ? <u aria-hidden /> : null}
                  </button>
                )
              })}
            </nav>
          ) : (
            <nav className={styles.cards} aria-label="분석 블록으로 이동">
              {blocks.filter((b) => revealed || OPEN_BEFORE_COMMIT.has(b.kind)).map((b) => (
                <button key={b.key} type="button" className={styles.card} data-state="done" data-tint={BLOCK_TINT[b.kind]} onClick={() => jumpToBlock(b.key)}>
                  <b>{b.title}</b>
                  <span>
                    <em>{b.body.length || 1}</em>
                    {b.chips.slice(0, 2).map((c) => (
                      <i key={c.text}>{c.text}</i>
                    ))}
                  </span>
                </button>
              ))}
            </nav>
          )}
        </section>
      </div>
    </div>
  )
}
