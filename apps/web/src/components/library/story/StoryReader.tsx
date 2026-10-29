// apps/web/src/components/library/story/StoryReader.tsx
//
// LCP Story 판본 하나의 독서 화면. 주소가 정본이다:
//   `/library/stories/<releaseKey>`        = 작품 입구(HOOK · 편집 목표 · 원천 줄 · 목차 · 내 진도 · 다음 행동 하나 — 본문 없음)
//   `/library/stories/<releaseKey>?unit=N` = 그 단위 본문 + 목차 · 진도 · 다음 행동 하나 · 「이 단위 읽음 표시」 · 이전/다음
// 계약: docs/LCP_STORY.md §12(위치 ≠ 완료 · 각색 완독 ≠ 원문 완독) · §13 · §17.
//
// - **표시 문**: 본문 · 원문 인용 · 목차 완료 표시 · 진도는 브라우저 인증이 서버 viewerId 와 같다고 **긍정 확인(same)** 된 뒤에만 그린다.
//   확인 중(checking)에는 공개 메타 · HOOK · 편집 목표 · 원천 줄과 「로그인 확인 중」만, 조작은 잠근다. 바뀜(changed)이면 개인 내용 없이
//   다시 불러온다. 이것은 화면 표시 · 요청 발송의 보호다 — 이미 받은 응답 바이트를 회수하지는 않는다.
// - 화면 렌더 · 새로 고침은 아무것도 기록하지 않는다. 위치는 시작 · 이어 읽기 · 이동 클릭에서만, 완료는 버튼에서만(story-reader-session).
// - 서버가 저장을 거부하면(차단 · 닫힘 · 단위 없음 · 계정 바뀜 · 로그인 필요) 개인 내용을 지우고 이유를 말한 뒤 서버 상태를 다시 받는다.
// - 본문은 텍스트 노드로만 그린다(HTML 해석 없음). 원문 대응 · 단어 뜻은 요청할 때만 연다.
// - 학습자 행동 구조: 단위 고르기 → 읽기 → 읽음 표시 → (원하면) 원문 인용 추적 · 단어 뜻.
// - 작품 입구 · 로그인 전 화면은 시작 전 선택 안내(편집 판단 부담 · 접힌 주의 — U1)를 공개 정보로 보인다(필수 확인 · 자동 열림 없음).
// - 단위 화면은 본문 뒤에 그 단위의 시대적 맥락 설명(접힌 <details> — W2)을 긍정 확인(same) 뒤에만 보인다(필수 확인 · 자동 열림 없음).
// - D4(UX01~04 · docs/lcp-story/D4_IMPLEMENTATION.md): 입구는 고르는 정보(첫 장면 첫 문장 · 편집 목표 · 부담 · 접힌 주의) → 시작 행동 →
//   선택 펼침(첫 장면 전체 · 원천 · 도움 사용법) 순서. 단위 화면은 작은 작품 맥락 + 단위 제목(h1) · 도구 줄의 맥락 설명 진입(결속된
//   ready 설명이 있을 때만). 이어 읽기는 「마지막으로 연 단위」의 첫머리. 전 단위 표시 뒤 다음 행동은 실제 서가 공급에 맞춰 본문 한 곳에만.

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type MouseEvent,
  type ReactNode,
} from 'react'

import { track } from '@/lib/analytics/client'
import type { PublicEvent } from '@/lib/analytics/events'
import type {
  StoryCatalogRelease,
  StoryLearnerFailure,
  StoryPositionReason,
  StoryReaderPageState,
  StoryReaderSource,
  StoryReleaseGuidanceView,
} from '@/lib/library/story/learner-types'

import { storyVaultHref } from '@/lib/library/story/return-context'

import { StoryActivity } from './StoryActivity'
import { activitySlotFor } from './story-activity-view'
import { STORY_ACTIVITY_SLOTS } from './story-activity-slots'
import { CONTEXT_NOTES_ID, StoryContextNotes } from './StoryContextNotes'
import { StoryGuidance } from './StoryGuidance'
import { StorySourcePanel } from './StorySourcePanel'
import { StoryUnitText, type StoryWordLookupProps } from './StoryUnitText'
import styles from './story.module.css'
import {
  DENIAL_TITLE,
  StoryReaderSession,
  readerAuthDecision,
  readerVisibility,
  type StoryReaderActions,
  type StoryReaderSnapshot,
} from './story-reader-session'
import {
  COVERAGE_LABEL,
  KIND_LABEL,
  READING_HELP_LINE,
  afterCompletionWording,
  boundContextNoteCount,
  completionWording,
  contextNotesEntryLabel,
  editorialTargetLabel,
  hookPreview,
  isFullyMarked,
  nextActionFor,
  positionWording,
  readerHref,
  shouldFocusUnitHeading,
  sourceLine,
  unitLabel,
  type StoryNextAction,
} from './story-view'
import {
  markAnchorLeft,
  needsReturnPick,
  ownerTag,
  rememberSaveAnchor,
  returnContextKey,
  returnWordFor,
  takeReturnAnchor,
  type StoryReturnPick,
} from './story-return-anchor'
import { markAfterSave, visibleVaultAfterHref, type StoryVaultAfterMark } from './story-vault-after'
import { useStoryAuthGuard, type StoryAuthGuard, type StoryAuthSource, type StoryAuthStatus } from './use-story-auth-guard'

export interface StoryReaderProps {
  state: StoryReaderPageState
  releaseKey: string
  actions: StoryReaderActions
  /** 이동(기본 router.push(href, { scroll: false })). */
  navigate?: (href: string) => void
  /** 계측 주입(기본 track). */
  onEvent?: (e: PublicEvent) => void
  /** 인증 구독 원천 주입(기본 브라우저 Supabase 세션) — 하네스 · 시험이 로그아웃 · 계정 전환을 만든다. */
  authGuard?: StoryAuthSource
  /** 일시 오류 다시 시도(기본 router.refresh). */
  onRetry?: () => void
  /** 서버 거부 · 인증 바뀜 뒤 서버 상태 다시 받기(기본 router.refresh). */
  onRefresh?: () => void
  /** 인증이 바뀐 뒤 「다시 불러오기」 버튼(기본 전체 새로 고침). */
  onReload?: () => void
  /** 단어 뜻 툴팁 주입(기본 WordLookupPopover) — 시험 · 하네스용. */
  wordLookup?: ComponentType<StoryWordLookupProps>
}

const CATALOG_HREF = '/library/stories'
const CONTENT_ID = 'story-content'
const HEADING_ID = 'story-unit-heading'
const SOURCE_PANEL_ID = 'story-source-panel'

export function StoryReader(props: StoryReaderProps) {
  const { state, releaseKey } = props
  const router = useRouter()
  const viewerId = state.status === 'ready' ? state.viewerId : null
  const { guard, status: authStatus } = useStoryAuthGuard(viewerId, props.authGuard)
  const navigate = props.navigate ?? ((href: string) => router.push(href, { scroll: false }))
  const emit = props.onEvent ?? track
  const retry = props.onRetry ?? (() => router.refresh())
  const refresh = props.onRefresh ?? (() => router.refresh())
  const reload = props.onReload ?? (() => window.location.reload())

  // 인증 바뀜은 개인 내용이 있는 ready 에서만 화면을 바꾼다. blocked · unavailable 은 서버가 말한 이유를 그대로 보인다(바뀜 화면 · 자동 새로 고침 없음).
  const decision = readerAuthDecision(state.status, authStatus)
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  const refreshedFor = useRef<StoryAuthGuard | null>(null)
  useEffect(() => {
    if (decision.autoRefresh && refreshedFor.current !== guard) {
      refreshedFor.current = guard
      refreshRef.current()
    }
  }, [decision.autoRefresh, guard])

  if (decision.authChangedView) {
    return (
      <StatePage title="로그인 상태가 바뀌었어요" kind="auth_changed">
        <p className={styles.lede}>이 화면의 본문과 진도를 지웠어요. 지금 로그인한 계정으로 다시 불러오세요.</p>
        <div className={styles.actionRow}>
          <button type="button" className={styles.cta} onClick={reload}>
            다시 불러오기
          </button>
          <Link href={CATALOG_HREF} className={styles.ctaQuiet}>
            Stories 서가로
          </Link>
        </div>
      </StatePage>
    )
  }

  if (state.status === 'signed_out') return <SignedOut loginHref={state.loginHref} release={state.release} guidance={state.guidance} />

  if (state.status === 'blocked') {
    return (
      <StatePage title="이 계정으로는 지금 읽을 수 없어요" kind="blocked">
        <p className={styles.lede}>계정이 이용 중지 상태예요. 계정 상태가 바뀌면 다시 읽을 수 있어요.</p>
        <Link href={CATALOG_HREF} className={styles.ctaSecondary}>
          Stories 서가로
        </Link>
      </StatePage>
    )
  }

  if (state.status === 'unavailable') return <Unavailable failure={state.failure} releaseKey={releaseKey} onRetry={retry} />

  const bound =
    state.context.releaseKey === releaseKey &&
    (state.release === null || state.release.releaseKey === releaseKey) &&
    (state.unit === null || (state.unit.releaseKey === releaseKey && state.unit.unitCount === state.context.unitCount))
  if (!bound) {
    return (
      <Unavailable
        failure={{ ok: false, code: 'reader_data_invalid', message: '판본 정보가 서로 맞지 않아요.', retryable: false }}
        releaseKey={releaseKey}
        onRetry={retry}
      />
    )
  }

  return (
    <ReadyReader
      state={state}
      releaseKey={releaseKey}
      actions={props.actions}
      navigate={navigate}
      emit={emit}
      refresh={refresh}
      guard={guard}
      authStatus={authStatus}
      wordLookup={props.wordLookup}
    />
  )
}

// ── 준비된 독서 화면 ───────────────────────────────────────────────────────

type ReadyState = Extract<StoryReaderPageState, { status: 'ready' }>

function ReadyReader({
  state,
  releaseKey,
  actions,
  navigate,
  emit,
  refresh,
  guard,
  authStatus,
  wordLookup,
}: {
  state: ReadyState
  releaseKey: string
  actions: StoryReaderActions
  navigate: (href: string) => void
  emit: (e: PublicEvent) => void
  refresh: () => void
  guard: StoryAuthGuard
  authStatus: StoryAuthStatus
  wordLookup?: ComponentType<StoryWordLookupProps>
}) {
  const { context, unit, siblings } = state
  const latest = useRef({ actions, navigate, emit, refresh })
  latest.current = { actions, navigate, emit, refresh }

  const sessionRef = useRef<{ session: StoryReaderSession; guard: StoryAuthGuard; viewerId: string } | null>(null)
  if (
    !sessionRef.current ||
    sessionRef.current.session.releaseKey !== releaseKey ||
    sessionRef.current.guard !== guard ||
    sessionRef.current.viewerId !== state.viewerId
  ) {
    const titles: Array<string | null> = Array.from({ length: context.unitCount }, () => null)
    for (const entry of context.toc) if (entry.unitIndex >= 0 && entry.unitIndex < titles.length) titles[entry.unitIndex] = entry.unitTitle
    sessionRef.current = {
      guard,
      viewerId: state.viewerId,
      session: new StoryReaderSession({
        releaseKey,
        viewerId: state.viewerId,
        unitCount: context.unitCount,
        kind: context.kind,
        coverage: context.coverage,
        completionLabel: context.completionLabel,
        unitTitles: titles,
        auth: guard,
        actions: {
          recordPosition: (input) => latest.current.actions.recordPosition(input),
          completeUnit: (input) => latest.current.actions.completeUnit(input),
          saveWord: (input) => {
            const save = latest.current.actions.saveWord
            return save ? save(input) : Promise.resolve({ ok: false as const, code: 'temporary' as const, message: '지금은 저장할 수 없어요.', retryable: false })
          },
        },
        navigate: (href) => latest.current.navigate(href),
        emit: (event) => latest.current.emit(event),
        refresh: () => latest.current.refresh(),
      }),
    }
  }
  const session = sessionRef.current.session
  useEffect(() => () => session.detach(), [session])
  const snap: StoryReaderSnapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)

  // 서버 거부 뒤 서버가 새 상태를 다시 그렸으면(같은 사람 · 같은 판본 · ready) 그 상태가 정본이다.
  const deniedAt = useRef<ReadyState | null>(null)
  if (snap.denied && deniedAt.current === null) deniedAt.current = state
  useEffect(() => {
    if (!snap.denied) {
      deniedAt.current = null
      return
    }
    if (deniedAt.current !== null && deniedAt.current !== state) {
      deniedAt.current = null
      session.clearDenial()
    }
  }, [state, snap.denied, session])

  const view = useMemo(() => deriveView(state, snap), [state, snap])
  const unitIndex = unit?.unitIndex ?? null
  const visibility = readerVisibility(authStatus, snap.denied)
  const verified = authStatus === 'same' && visibility === 'private'

  // 단위 이동 뒤에만 단위 제목으로 초점(첫 진입은 옮기지 않는다).
  const headingRef = useRef<HTMLHeadingElement>(null)
  const previousUnit = useRef<number | null | undefined>(undefined)
  useEffect(() => {
    if (shouldFocusUnitHeading(previousUnit.current, unitIndex)) headingRef.current?.focus()
    previousUnit.current = unitIndex
  }, [unitIndex])

  // U03 — 이 화면에서 관측한 유효 저장(같은 세션)이 있을 때만 독서 후 「내 단어장 살펴보기」. 메모리 문맥뿐이다.
  const [vaultMark, setVaultMark] = useState<StoryVaultAfterMark | null>(null)
  const vaultAfterHref = visibleVaultAfterHref(vaultMark, { owner: session, verified, denied: snap.denied !== null })

  // U03 — 같은 탭에서 단어장에 다녀왔으면 담은 낱말이 든 문장을 한 번 보여 준다(story-return-anchor.ts · 진도 계약은 단위 그대로).
  // 긍정 확인(same)된 본인 화면에서만 꺼낸다 — 확인 전에는 기다리고, 단위마다 한 번만 판정한다.
  // 표식 주인 = 서버가 그리고 인증 경계가 긍정 확인한 viewer(짧은 해시) — 같은 탭의 다른 계정 표식을 쓰지 않는다.
  const anchorOwner = ownerTag(state.viewerId)
  // 꺼낸 결과는 꺼낸 문맥(주인 · 발행본 · 단위)에 묶는다 — 같은 단위 번호라도 다른 사용자 · 발행본이면 쓰지 않고 새로 판정한다.
  const returnContext = verified && unitIndex !== null ? returnContextKey(anchorOwner, releaseKey, unitIndex) : null
  const [returnPick, setReturnPick] = useState<StoryReturnPick | null>(null)
  useEffect(() => {
    if (!needsReturnPick(returnPick, returnContext) || unitIndex === null || returnContext === null) return
    setReturnPick({ context: returnContext, word: takeReturnAnchor(anchorOwner, releaseKey, unitIndex) })
  }, [returnPick, returnContext, anchorOwner, releaseKey, unitIndex])
  const returnWordIndex = returnWordFor(returnPick, returnContext)

  const [sourceOpen, setSourceOpen] = useState(false)
  const [selectedAnchor, setSelectedAnchor] = useState<number | null>(null)
  // 맥락 설명 열림(D4-UX02) — 진입 단추로 연 경우에만 돌아가기를 제공한다. 단위가 바뀌면 닫힌 채로 시작한다.
  const [notesOpen, setNotesOpen] = useState<{ unit: number | null; open: boolean; viaEntry: boolean }>({ unit: null, open: false, viaEntry: false })
  const notesEntryRef = useRef<HTMLButtonElement>(null)
  // T-0228 근거 활동 「본문에서 다시 확인」 — 단위 · 낱말 번호 · 누른 차례(nonce)
  // 활동과 같은 결속(본인 · 발행본 · 단위 · 인증 세대)에 묶는다 — 결속이 바뀌면 버린다(돌아와도 이전 근거 강조가 되살아나지 않는다)
  const revisitContext = verified && unitIndex !== null ? `${anchorOwner}|${releaseKey}|${unitIndex}|${guard.token()}` : null
  const [revisit, setRevisit] = useState<{ context: string; wordIndex: number; nonce: number } | null>(null)
  useEffect(() => {
    if (revisit && revisit.context !== revisitContext) setRevisit(null)
  }, [revisit, revisitContext])
  useEffect(() => {
    setSelectedAnchor(null)
    setNotesOpen({ unit: unitIndex, open: false, viaEntry: false })
  }, [unitIndex])

  const kind = KIND_LABEL[context.kind]
  const header = (
    <header className={styles.head}>
      {unit && verified ? (
        <Link href={readerHref(releaseKey, null)} className={styles.crumb}>
          ← 목차로
        </Link>
      ) : (
        <Link href={CATALOG_HREF} className={styles.crumb}>
          ← Stories
        </Link>
      )}
      <h1 className={styles.title} lang="en">
        {context.title}
      </h1>
      <p className={styles.meta}>
        <span className={styles.metaStrong}>{kind.name}</span> · {COVERAGE_LABEL[context.coverage]} · {context.unitCount}단위
      </p>
    </header>
  )

  if (visibility === 'denied' && snap.denied) {
    return (
      <div className={styles.page} data-story-reader="denied" data-story-state={snap.denied.code}>
        {header}
        <div className={styles.state} role="status" aria-live="polite" data-story-denied={snap.denied.code}>
          <h2 className={styles.stateTitle}>{DENIAL_TITLE[snap.denied.code]}</h2>
          <p className={styles.lede}>{snap.denied.message}</p>
          <p className={styles.meta}>이 화면의 본문과 진도를 지우고 지금 상태를 다시 불러오고 있어요.</p>
          <Link href={CATALOG_HREF} className={styles.ctaQuiet}>
            Stories 서가로
          </Link>
        </div>
      </div>
    )
  }

  const navLocked = snap.navPending !== null || !verified
  const go = (target: number, reason: StoryPositionReason) => {
    void session.go(target, reason)
  }

  const eventBase = { kind: context.kind, coverage: context.coverage } as const
  const toggleSource = () => {
    const next = !sourceOpen
    setSourceOpen(next)
    if (!next) setSelectedAnchor(null)
    if (next && unit) {
      emit({
        name: 'story_reader_action',
        props: { ...eventBase, action: 'source_open', unit_index: unit.unitIndex, completed: view.fullyCompleted },
      })
    }
  }
  const switchEdition = () => {
    emit({
      name: 'story_reader_action',
      props: { ...eventBase, action: 'edition_switch', unit_index: unitIndex ?? -1, completed: verified ? view.fullyCompleted : false },
    })
  }

  const next = view.next
  const anchorsBound = unit !== null && context.unit.unitIndex === unit.unitIndex

  // T-0228 근거 선택 활동 — 연결한 활동의 after_unit 단위 · 긍정 확인(same)된 본인 화면 · 조회/제출 액션이 있을 때만.
  // 「본문에서 다시 확인」은 단위 본문의 복귀 강조를 그대로 쓴다(누를 때마다 nonce). 단위가 바뀌면 그 단위 것만 쓴다.
  const activitySlot = unit ? activitySlotFor(STORY_ACTIVITY_SLOTS, releaseKey, unit.unitIndex) : null
  const loadActivity = actions.loadActivity
  const submitActivity = actions.submitActivity
  const unitRevisit = revisit && revisitContext !== null && revisit.context === revisitContext ? { wordIndex: revisit.wordIndex, nonce: revisit.nonce } : null

  // D5-I01 선택 낱말 저장 — 위치 · 완료와 같은 세션 문을 쓴다(session.saveWord): 긍정 확인(same)된 본인 화면에서만 보내고,
  // 신원 · 접근 거부는 같은 거부 전이(개인 내용 폐기 + 서버 상태 다시 받기) · 다른 주인의 성공은 인증 경계 무효 · 늦은 응답은 stale.
  const wordSave =
    unit && actions.saveWord
      ? {
          vaultHref: storyVaultHref({ releaseKey, unitIndex: unit.unitIndex }),
          onLeave: () => {
            markAnchorLeft(anchorOwner)
          },
          call: async ({ wordIndex, surface }: { wordIndex: number; surface: string }) => {
            const href = storyVaultHref({ releaseKey, unitIndex: unit.unitIndex })
            const out = await session.saveWord({ unitIndex: unit.unitIndex, wordIndex, surface })
            // 세션이 이미 늦은 응답 · 거부 · 다른 주인을 stale 로 걸렀다 — 그 판정만 재사용한다(저장 · 멱등 재구현 없음).
            setVaultMark((prev) => markAfterSave(prev, session, out, href))
            if (!('stale' in out) && out.ok && (out.data.status === 'saved' || out.data.status === 'already_exists')) {
              rememberSaveAnchor({ owner: anchorOwner, releaseKey, unitIndex: unit.unitIndex, wordIndex })
            }
            return out
          },
        }
      : null

  // 맥락 설명 진입(D4-UX02): 긍정 확인(same) 뒤 · 지금 발행본 · 단위에 결속된 ready 설명이 있을 때만. 오류 · 미적용 · 어긋남 · 0개면 없다.
  const noteCount = unit ? boundContextNoteCount(state.contextNotes, releaseKey, unit.unitIndex) : 0
  const notesState = notesOpen.unit === unitIndex ? notesOpen : { unit: unitIndex, open: false, viaEntry: false }
  const openNotesFromEntry = () => {
    setNotesOpen({ unit: unitIndex, open: true, viaEntry: true })
    // 펼친 뒤 요약으로 초점(스크롤은 그 자리가 보이도록만) — 진도 · 완료 기록 없음.
    requestAnimationFrame(() => {
      const details = document.getElementById(CONTEXT_NOTES_ID)
      const summary = details?.querySelector<HTMLElement>('summary')
      summary?.focus({ preventScroll: true })
      // 설명의 첫머리가 보이도록(고정 머리 아래 · scroll-margin) — 끝에 걸치지 않게.
      details?.scrollIntoView({ block: 'start' })
    })
  }
  const returnToNotesEntry = () => {
    notesEntryRef.current?.focus({ preventScroll: true })
    notesEntryRef.current?.scrollIntoView({ block: 'center' })
  }
  const notesEntry =
    noteCount > 0 ? (
      <button
        ref={notesEntryRef}
        type="button"
        className={styles.toolButton}
        aria-controls={CONTEXT_NOTES_ID}
        aria-expanded={notesState.open}
        onClick={() => (notesState.open ? setNotesOpen({ unit: unitIndex, open: false, viaEntry: false }) : openNotesFromEntry())}
        data-story-context-entry={noteCount}
      >
        {contextNotesEntryLabel(noteCount)}
      </button>
    ) : null

  // 단위 화면 머리(D4-UX02) — 작품 이름은 작은 복귀 맥락, 단위 제목이 주 제목(h1). 확인 중 · 거부 화면은 위 공통 머리를 쓴다.
  const unitHeader = unit ? (
    <header className={`${styles.head} ${styles.headCompact}`} data-story-head="unit">
      <p className={styles.contextLine}>
        <Link href={readerHref(releaseKey, null)} className={styles.crumb}>
          ← 목차로
        </Link>
        <span className={styles.workContext}>
          <span lang="en">{context.title}</span> · {kind.name} · {context.unitCount}단위
        </span>
      </p>
      <h1 id={HEADING_ID} ref={headingRef} tabIndex={-1} className={styles.unitHeading}>
        {unitLabel(unit.unitIndex, unit.unitTitle)}
      </h1>
    </header>
  ) : null

  // ── 확인 중: 공개 메타만 ──
  if (!verified) {
    return (
      <div className={styles.page} data-story-reader={unit ? 'unit' : 'entry'} data-story-private="hidden">
        {header}
        <EntrySelection release={state.release} guidance={state.guidance} />
        <div className={styles.notice} role="status" aria-live="polite" data-story-identity="checking">
          <p className={styles.statusText}>로그인 상태를 확인하고 있어요 — 확인되면 본문과 내 진도가 보여요.</p>
        </div>
        <EntryDetails release={state.release} source={context.source} />
        <Siblings siblings={siblings} onSwitch={switchEdition} />
      </div>
    )
  }

  return (
    <div
      className={`${styles.page} ${unit ? styles.pageUnit : ''}`}
      data-story-reader={unit ? 'unit' : 'entry'}
      data-story-private="shown"
    >
      {/* 셸에 이미 「본문으로 건너뛰기」(#main)가 있다 — 목적지가 다른 링크가 같은 이름이면 스크린리더에서 구별되지 않는다. */}
      <a href={`#${CONTENT_ID}`} className={`${styles.skip} ${styles.ctaSecondary}`}>
        이야기 본문으로 건너뛰기
      </a>

      {unit ? unitHeader : header}

      <div className={styles.reader}>
        <div id={CONTENT_ID} className={styles.readerMain} tabIndex={-1} role="region" aria-label="본문">
          {unit ? (
            <>
              <StoryUnitText
                key={`${releaseKey}:${unit.unitIndex}`}
                text={unit.text}
                tracing={sourceOpen && selectedAnchor !== null}
                lookup={wordLookup}
                tools={notesEntry}
                save={wordSave ?? undefined}
                returnWordIndex={returnWordIndex}
                revisit={unitRevisit}
              />
              <StoryContextNotes
                key={`notes:${releaseKey}:${unit.unitIndex}`}
                view={state.contextNotes}
                releaseKey={releaseKey}
                unitIndex={unit.unitIndex}
                open={notesState.open}
                onOpenChange={(open) => setNotesOpen((s) => ({ unit: unitIndex, open, viaEntry: open ? s.viaEntry && s.unit === unitIndex : false }))}
                onReturn={notesState.viaEntry && notesEntry ? returnToNotesEntry : undefined}
              />
              {activitySlot && loadActivity && submitActivity && verified ? (
                <StoryActivity
                  key={`activity:${releaseKey}:${unit.unitIndex}:${activitySlot.activityId}`}
                  slot={activitySlot}
                  viewerId={state.viewerId}
                  auth={guard}
                  calls={{ load: loadActivity, submit: submitActivity }}
                  unitIndex={unit.unitIndex}
                  unitText={unit.text}
                  onRevisit={(wordIndex) => {
                    if (revisitContext !== null) setRevisit((r) => ({ context: revisitContext, wordIndex, nonce: (r?.nonce ?? 0) + 1 }))
                  }}
                />
              ) : null}
              <div className={styles.actionZone}>
                <div className={styles.actionRow}>
                  <CompleteControl
                    unitIndex={unit.unitIndex}
                    marked={view.completed.has(unit.unitIndex)}
                    pending={snap.completing.includes(unit.unitIndex)}
                    primary={next.type === 'complete'}
                    onComplete={() => void session.complete(unit.unitIndex)}
                  />
                  {next.type === 'navigate' ? (
                    <PositionLink
                      releaseKey={releaseKey}
                      unitIndex={next.unitIndex}
                      reason="navigate"
                      disabled={navLocked}
                      className={styles.cta}
                      onGo={go}
                      dataAction="next"
                    >
                      {next.unitIndex === unit.unitIndex + 1 ? '다음 단위 읽기' : `표시하지 않은 단위로 — ${next.unitIndex + 1}번째`}
                    </PositionLink>
                  ) : null}
                  {next.type === 'done' ? (
                    <p className={styles.doneMark} data-story-done>
                      {view.wording?.text} — 모든 단위를 읽음으로 표시했어요
                    </p>
                  ) : null}
                </div>
                {view.fullyCompleted ? (
                  <AfterCompletion
                    otherWorks={state.otherWorks}
                    releaseKey={releaseKey}
                    navLocked={navLocked}
                    onGo={go}
                    vaultHref={vaultAfterHref}
                    onVaultLeave={() => markAnchorLeft(anchorOwner)}
                  />
                ) : null}
                <nav className={styles.navRow} aria-label="단위 이동">
                  {unit.unitIndex > 0 ? (
                    <PositionLink
                      releaseKey={releaseKey}
                      unitIndex={unit.unitIndex - 1}
                      reason="navigate"
                      disabled={navLocked}
                      className={styles.ctaQuiet}
                      onGo={go}
                      dataAction="prev"
                    >
                      ← 이전 단위
                    </PositionLink>
                  ) : (
                    <span />
                  )}
                  {unit.unitIndex + 1 < context.unitCount && !(next.type === 'navigate' && next.unitIndex === unit.unitIndex + 1) ? (
                    <PositionLink
                      releaseKey={releaseKey}
                      unitIndex={unit.unitIndex + 1}
                      reason="navigate"
                      disabled={navLocked}
                      className={styles.ctaQuiet}
                      onGo={go}
                      dataAction="forward"
                    >
                      다음 단위 →
                    </PositionLink>
                  ) : null}
                </nav>
              </div>
            </>
          ) : (
            <>
              {/* D4-UX01 정보 순서: 고르는 데 필요한 것(첫 장면 · 편집 목표 · 부담 · 접힌 주의) → 시작 행동 → 선택해서 펼치는 상세(첫 장면 전체 · 원천 · 도움 사용법). */}
              <EntrySelection release={state.release} guidance={state.guidance} />
              <EntryMain view={view} next={next} releaseKey={releaseKey} navLocked={navLocked} onGo={go} otherWorks={state.otherWorks} />
              <EntryDetails release={state.release} source={context.source} withHelp />
            </>
          )}

          <StatusDock
            snap={snap}
            releaseKey={releaseKey}
            canSend={verified}
            onRetry={() => void session.retry()}
            onDismiss={() => session.dismissStatus()}
          />
        </div>

        <aside className={styles.aside} aria-label="목차와 진도">
          <section className={styles.asideBlock} aria-labelledby="story-progress-title" data-story-progress>
            <h2 id="story-progress-title" className={styles.asideTitle}>
              내 진도 · 이 판본만
            </h2>
            {view.hasRecord ? (
              <>
                {view.lastUnitIndex !== null ? <span data-story-last-unit>{positionWording(view.lastUnitIndex, context.unitCount)}</span> : null}
                <span className={view.wording?.done ? styles.doneMark : undefined} data-story-completion>
                  {view.wording?.text}
                </span>
                {/* 다음 행동은 본문 쪽 한 곳에만 둔다(D4-UX04 — 같은 링크를 레일에 겹쳐 두지 않는다). */}
              </>
            ) : (
              <span>아직 읽은 기록이 없어요.</span>
            )}
          </section>

          {unit && anchorsBound ? (
            <div className={styles.asideBlock}>
              <button
                type="button"
                className={`${styles.ctaSecondary} ${styles.sourceToggle}`}
                aria-expanded={sourceOpen}
                aria-controls={SOURCE_PANEL_ID}
                onClick={toggleSource}
                data-story-source-toggle
              >
                {sourceOpen ? '목차로 돌아가기' : '원문 대응 보기'}
              </button>
            </div>
          ) : null}

          {unit && anchorsBound && sourceOpen ? (
            <StorySourcePanel
              id={SOURCE_PANEL_ID}
              source={context.source}
              anchors={context.unit.anchors}
              unitIndex={unit.unitIndex}
              unitTitle={unit.unitTitle}
              selected={selectedAnchor}
              onSelect={setSelectedAnchor}
            />
          ) : (
            <nav className={styles.asideBlock} aria-labelledby="story-toc-title">
              <h2 id="story-toc-title" className={styles.asideTitle}>
                목차
              </h2>
              <ol className={styles.toc} data-story-toc>
                {view.toc.map((entry) => (
                  <li key={entry.unitIndex}>
                    <PositionLink
                      releaseKey={releaseKey}
                      unitIndex={entry.unitIndex}
                      reason="navigate"
                      disabled={navLocked}
                      className={styles.tocLink}
                      onGo={go}
                      current={entry.unitIndex === unitIndex}
                      dataAction="toc"
                    >
                      <span>{unitLabel(entry.unitIndex, entry.unitTitle)}</span>
                      <span className={styles.tocMark}>{entry.completed ? '✓ 읽음' : ''}</span>
                    </PositionLink>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <Siblings siblings={siblings} onSwitch={switchEdition} />
        </aside>
      </div>
    </div>
  )
}

// ── 화면 값 계산 ───────────────────────────────────────────────────────────

interface ReaderView {
  toc: Array<{ unitIndex: number; unitTitle: string | null; completed: boolean }>
  completed: ReadonlySet<number>
  completedCount: number
  fullyCompleted: boolean
  lastUnitIndex: number | null
  hasRecord: boolean
  wording: { done: boolean; text: string } | null
  next: StoryNextAction
}

function deriveView(state: ReadyState, snap: StoryReaderSnapshot): ReaderView {
  const { context, unit } = state
  const unitCount = context.unitCount
  const completed = new Set<number>()
  for (const entry of context.toc) if (entry.completed) completed.add(entry.unitIndex)
  for (const u of snap.completedLocal) completed.add(u)
  const toc = [...context.toc]
    .filter((e) => e.unitIndex >= 0 && e.unitIndex < unitCount)
    .sort((a, b) => a.unitIndex - b.unitIndex)
    .map((e) => ({ unitIndex: e.unitIndex, unitTitle: e.unitTitle, completed: completed.has(e.unitIndex) }))
  const completedCount = Math.min(
    unitCount,
    Math.max(context.progress?.completedUnitCount ?? 0, snap.counts?.completedUnitCount ?? 0, completed.size),
  )
  const flag = (context.progress?.completed ?? false) || (snap.counts?.completed ?? false)
  const counts = { completedUnitCount: completedCount, unitCount, completed: flag }
  const hasRecord = context.progress !== null || snap.counts !== null || completed.size > 0
  const lastUnitIndex = context.progress?.lastUnitIndex ?? null
  return {
    toc,
    completed,
    completedCount,
    fullyCompleted: isFullyMarked(counts),
    lastUnitIndex,
    hasRecord,
    wording: hasRecord ? completionWording(counts, context.completionLabel, context.coverage) : null,
    next: nextActionFor({ unitIndex: unit?.unitIndex ?? null, unitCount, completedUnits: completed, lastUnitIndex }),
  }
}

// ── 조각 ───────────────────────────────────────────────────────────────────

/**
 * HOOK 앞머리(D4-UX01) — 여러 문장이면 저장된 첫 문장만 앞에 보이고 전문은 펼침(EntryDetails · 로그인 전 「첫 장면 전체」)에 그대로 둔다.
 * 한 문장이면 전문을 그대로 보인다(잘라 보일 것이 없다).
 */
function HookLead({ hookText }: { hookText: string }) {
  const hook = hookPreview(hookText)
  if (!hook.truncated) {
    return (
      <blockquote className={styles.hook} lang="en" aria-label="진입 장면" data-story-hook>
        {hookText}
      </blockquote>
    )
  }
  return (
    <p className={styles.hookPreview} lang="en" data-story-hook-preview>
      {hook.preview}
      <span className={styles.srOnly} lang="ko">
        {' '}
        (첫 장면의 첫 문장이에요 — 전체는 아래 펼침에 있어요)
      </span>
    </p>
  )
}

/**
 * 시작 전에 고르는 데 필요한 공개 정보(D4-UX01 — 시작 행동보다 앞) — HOOK 첫 문장 · 편집 목표 난이도(진단 아님) · 선택 안내(부담 · 접힌 주의).
 * HOOK 을 줄여 보일 때 전문은 바로 아래 EntryDetails 의 펼침에 저장값 그대로 있다. 주의는 시작 전에 펼쳐 볼 수 있다.
 */
function EntrySelection({ release, guidance }: { release: StoryCatalogRelease | null; guidance: StoryReleaseGuidanceView }) {
  if (!release) {
    return (
      <section className={styles.entryPublic} aria-label="작품 정보" data-story-entry-public>
        <p className={styles.meta} data-story-release-missing>
          작품 정보를 불러오지 못했어요.
        </p>
      </section>
    )
  }
  return (
    <section className={styles.entryPublic} aria-label="작품 정보" data-story-entry-public>
      <HookLead hookText={release.hookText} />
      <p className={styles.meta} data-story-target>
        {editorialTargetLabel(release.targetCefr)}
        {release.targetCefr ? ' · 판본을 만들 때 겨냥한 수준이에요(진단 결과가 아니에요)' : ''}
      </p>
      <StoryGuidance view={guidance} />
    </section>
  )
}

/**
 * 선택해서 펼치는 상세(D4-UX01) — 첫 장면 전체(저장된 HOOK 그대로) · 원천 줄(원작 언어 · 본문 언어 · 번역자 · 원천 판본) ·
 * (입구에서만) 읽는 중 도움 사용법. 접어 두어도 지우거나 요약해 바꾸지 않는다.
 */
function EntryDetails({ release, source, withHelp = false }: { release: StoryCatalogRelease | null; source: StoryReaderSource; withHelp?: boolean }) {
  const hookInDetails = release !== null && hookPreview(release.hookText).truncated
  return (
    <details className={`${styles.cautions} ${styles.entryDetails}`} data-story-entry-details>
      <summary>{hookInDetails ? '첫 장면 전체 · 원천 판본 정보' : '원천 판본 정보'}{withHelp ? ' · 읽는 중 도움' : ''}</summary>
      <div className={styles.entryDetailsBody}>
        {release && hookInDetails ? (
          <blockquote className={styles.hook} lang="en" aria-label="진입 장면" data-story-hook>
            {release.hookText}
          </blockquote>
        ) : null}
        <p className={styles.meta} data-story-source-line>
          {sourceLine(source)}
        </p>
        {withHelp ? (
          <p className={styles.meta} data-story-help-line>
            {READING_HELP_LINE}
          </p>
        ) : null}
      </div>
    </details>
  )
}

/**
 * 전 단위 표시 뒤 다음 행동(D4-UX04) — 실제 공급에 맞춘다: 다른 작품이 있으면 서가에서 고르기, 없으면 그렇다고 말하고
 * 서가 둘러보기 · 처음부터 다시 보기(명시적 이동 — 기존 위치 기록 경로). 추천 · 다음 에피소드 · 다른 판본 승계를 만들지 않는다.
 */
export function AfterCompletion({
  otherWorks,
  releaseKey,
  navLocked,
  onGo,
  showRestart = true,
  vaultHref = null,
  onVaultLeave,
}: {
  otherWorks: number | null
  releaseKey: string
  navLocked: boolean
  onGo: (unitIndex: number, reason: StoryPositionReason) => void
  showRestart?: boolean
  /** U03 — 이 화면에서 유효 저장을 관측했을 때만(기존 검증 왕복 주소). 서가 · 다시 읽기 뒤 마지막 보조 선택. */
  vaultHref?: string | null
  /** U03 — 단어장으로 떠날 때(같은 탭 복귀 문장 표지 · 지금 주인의 표식만). */
  onVaultLeave?: () => void
}) {
  const wording = afterCompletionWording(otherWorks)
  return (
    <div className={styles.afterCompletion} data-story-after-completion={otherWorks === null ? 'unknown' : otherWorks > 0 ? 'other-works' : 'only-work'}>
      {wording.note ? <p className={styles.meta}>{wording.note}</p> : null}
      <div className={styles.actionRow}>
        <Link href={CATALOG_HREF} className={styles.ctaSecondary} data-story-next-story>
          {wording.label}
        </Link>
        {showRestart ? (
          <PositionLink
            releaseKey={releaseKey}
            unitIndex={0}
            reason="start"
            disabled={navLocked}
            className={styles.ctaQuiet}
            onGo={onGo}
            dataAction="reread"
          >
            처음부터 다시 보기
          </PositionLink>
        ) : null}
        {vaultHref ? (
          <Link href={vaultHref} className={styles.ctaQuiet} data-story-vault-after onClick={onVaultLeave}>
            내 단어장 살펴보기
          </Link>
        ) : null}
      </div>
    </div>
  )
}

function EntryMain({
  view,
  next,
  releaseKey,
  navLocked,
  onGo,
  otherWorks,
}: {
  view: ReaderView
  next: StoryNextAction
  releaseKey: string
  navLocked: boolean
  onGo: (unitIndex: number, reason: StoryPositionReason) => void
  otherWorks: number | null
}) {
  const action = next.type === 'start' || next.type === 'resume' ? next : ({ type: 'start', unitIndex: 0 } as const)
  const target = view.toc.find((e) => e.unitIndex === action.unitIndex)
  return (
    <div className={styles.actionZone} data-story-entry>
      <p className={styles.lede} data-story-entry-lede>
        {action.type === 'resume'
          ? `마지막으로 연 단위는 ${unitLabel(action.unitIndex, target?.unitTitle ?? null)}예요. 그 단위 첫머리부터 이어 읽어요(문장 위치는 저장하지 않아요).`
          : '첫 단위부터 읽기 시작해요. 단위를 다 읽으면 직접 읽음으로 표시해요.'}
      </p>
      <div className={styles.actionRow}>
        <PositionLink
          releaseKey={releaseKey}
          unitIndex={action.unitIndex}
          reason={action.type}
          disabled={navLocked}
          className={styles.cta}
          onGo={onGo}
          dataAction={action.type}
        >
          {action.type === 'resume' ? '이어 읽기' : '처음부터 읽기'}
        </PositionLink>
        {action.type === 'resume' && action.unitIndex !== 0 ? (
          <PositionLink
            releaseKey={releaseKey}
            unitIndex={0}
            reason="start"
            disabled={navLocked}
            className={styles.ctaQuiet}
            onGo={onGo}
            dataAction="restart"
          >
            처음부터
          </PositionLink>
        ) : null}
      </div>
      {view.fullyCompleted ? (
        <AfterCompletion otherWorks={otherWorks} releaseKey={releaseKey} navLocked={navLocked} onGo={onGo} showRestart={false} />
      ) : null}
    </div>
  )
}

/** 위치를 기록하고 이동하는 링크 — 수정 키 클릭(새 탭 등)은 브라우저에 맡기고 기록하지 않는다. */
function PositionLink({
  releaseKey,
  unitIndex,
  reason,
  disabled,
  className,
  onGo,
  current,
  dataAction,
  children,
}: {
  releaseKey: string
  unitIndex: number
  reason: StoryPositionReason
  disabled: boolean
  className: string
  onGo: (unitIndex: number, reason: StoryPositionReason) => void
  current?: boolean
  dataAction: string
  children: ReactNode
}) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    if (disabled) return
    onGo(unitIndex, reason)
  }
  return (
    <a
      href={readerHref(releaseKey, unitIndex)}
      className={className}
      onClick={onClick}
      aria-disabled={disabled ? 'true' : undefined}
      aria-current={current ? 'page' : undefined}
      data-story-go={dataAction}
      data-unit={unitIndex}
    >
      {children}
    </a>
  )
}

export function CompleteControl({
  unitIndex,
  marked,
  pending,
  primary,
  onComplete,
}: {
  unitIndex: number
  marked: boolean
  pending: boolean
  primary: boolean
  onComplete: () => void
}) {
  // T-0224 — 읽음 표시가 성공하면 단추가 안내 문장으로 바뀌며 초점이 BODY 로 떨어졌다(pa-t224 before 실측: 기다리는 동안 disabled 로도 떨어짐).
  //   · 기다리는 동안 disabled 대신 aria-disabled + 클릭 무시 — 단추가 초점을 끝까지 가진다(실패 · 다시 시도도 같은 단추에서).
  //   · 이 단추로 누른 그 표시가 반영된 **그 순간 한 번만** 안내로 초점을 옮긴다. 기다리는 사이 학습자가 단추를 떠났으면(blur) 취소한다.
  //     표시가 반영된 렌더에서 단추가 빠지며 나는 blur 는 무시한다(markedRef) — T-0217 SessionDone 과 같은 패턴.
  //   · 이미 표시된 단위로 들어옴 · 재렌더 · 실패 · 계정 변경(화면이 내려감)에는 옮기지 않는다. 완료 호출 · 이벤트는 그대로.
  const noteRef = useRef<HTMLSpanElement>(null)
  const pressedRef = useRef(false)
  const markedRef = useRef(marked)
  markedRef.current = marked
  //   초점 인계는 **그 요청의 결과**에 묶는다(Codex P2): 이 단추로 보낸 요청이 끝나는 그 렌더(기다림 true → false)에서
  //   표시가 됐으면 성공 — 옮긴다. 표시가 안 됐으면 실패 — 누름을 바로 해제한다. 그래서 실패 뒤 다른 경로(서버 재반영 등)로
  //   표시가 생겨도 옮기지 않는다. 다시 누르면 그 새 요청으로 다시 판정한다.
  const wasPendingRef = useRef(pending)
  useEffect(() => {
    const finished = wasPendingRef.current && !pending
    wasPendingRef.current = pending
    if (!pressedRef.current || !finished) return
    pressedRef.current = false
    if (marked) noteRef.current?.focus()
  }, [pending, marked])
  if (marked) {
    return (
      <span ref={noteRef} tabIndex={-1} className={styles.marked} data-story-complete="marked" data-unit={unitIndex}>
        ✓ 이 단위는 읽음으로 표시했어요
      </span>
    )
  }
  return (
    <button
      type="button"
      className={primary ? styles.cta : styles.ctaSecondary}
      onClick={() => {
        if (pending) return
        pressedRef.current = true
        onComplete()
      }}
      onBlur={() => {
        if (!markedRef.current) pressedRef.current = false
      }}
      aria-disabled={pending || undefined}
      aria-busy={pending}
      data-story-complete={pending ? 'pending' : 'ready'}
      data-unit={unitIndex}
    >
      {pending ? '표시하는 중…' : '이 단위 읽음 표시'}
    </button>
  )
}

function StatusDock({
  snap,
  releaseKey,
  canSend,
  onRetry,
  onDismiss,
}: {
  snap: StoryReaderSnapshot
  releaseKey: string
  canSend: boolean
  onRetry: () => void
  onDismiss: () => void
}) {
  const status = snap.status
  return (
    <div className={styles.statusDock} role="status" aria-live="polite" aria-atomic="true" data-story-status={status?.tone ?? 'idle'}>
      {status ? (
        <div className={`${styles.notice} ${status.tone === 'error' ? styles.noticeError : ''}`}>
          <p className={styles.statusText}>
            {status.message}
            {status.tone === 'error' && status.detail ? <span className={styles.statusDetail}>{status.detail}</span> : null}
          </p>
          {status.tone === 'error' && status.retry ? (
            <button type="button" className={styles.ctaSecondary} onClick={onRetry} disabled={!canSend} data-story-retry>
              다시 시도
            </button>
          ) : null}
          {status.tone === 'error' && status.retry?.kind === 'position' ? (
            <a href={readerHref(releaseKey, status.retry.input.unitIndex)} className={styles.ctaQuiet} data-story-open-unsaved>
              저장하지 않고 열기
            </a>
          ) : null}
          {status.tone !== 'pending' ? (
            <button type="button" className={styles.ctaQuiet} onClick={onDismiss}>
              닫기
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function Siblings({ siblings, onSwitch }: { siblings: StoryCatalogRelease[] | null; onSwitch: () => void }) {
  return (
    <section className={styles.asideBlock} aria-labelledby="story-siblings-title" data-story-siblings={siblings === null ? 'error' : siblings.length}>
      <h2 id="story-siblings-title" className={styles.asideTitle}>
        같은 작품의 다른 판본
      </h2>
      {siblings === null ? (
        <span>다른 판본을 불러오지 못했어요.</span>
      ) : siblings.length === 0 ? (
        <span>이 작품의 다른 판본은 아직 없어요.</span>
      ) : (
        <>
          <span>판본마다 위치와 읽음 표시가 따로 기록돼요.</span>
          <ul className={styles.siblingList}>
            {siblings.map((sibling) => (
              <li key={sibling.releaseKey}>
                <Link href={readerHref(sibling.releaseKey, null)} className={styles.siblingLink} onClick={onSwitch} data-story-sibling>
                  {KIND_LABEL[sibling.kind].name}
                  <span>
                    {editorialTargetLabel(sibling.targetCefr)} · {COVERAGE_LABEL[sibling.coverage]} · {sibling.unitCount}단위
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function SignedOut({
  loginHref,
  release,
  guidance,
}: {
  loginHref: string
  release: StoryCatalogRelease | null
  guidance: StoryReleaseGuidanceView
}) {
  const preview = release ? hookPreview(release.hookText) : null
  return (
    <div className={styles.page} data-story-reader="signed_out">
      <header className={styles.head}>
        <Link href={CATALOG_HREF} className={styles.crumb}>
          ← Stories
        </Link>
        <h1 className={styles.title} lang={release ? 'en' : undefined}>
          {release ? release.title : '이야기 판본'}
        </h1>
        {release ? (
          <p className={styles.meta}>
            <span className={styles.metaStrong}>{KIND_LABEL[release.kind].name}</span> · {editorialTargetLabel(release.targetCefr)} ·{' '}
            {COVERAGE_LABEL[release.coverage]} · {release.unitCount}단위
          </p>
        ) : null}
      </header>
      {release ? (
        <>
          <HookLead hookText={release.hookText} />
          <StoryGuidance view={guidance} />
        </>
      ) : null}
      <div className={styles.state}>
        <p className={styles.lede}>본문은 로그인한 뒤 읽을 수 있어요. 로그인하면 이 판본 입구로 돌아와요. 읽은 위치와 읽음 표시는 내 계정에만 기록돼요.</p>
        <div className={styles.actionRow}>
          <Link href={loginHref} className={styles.cta} data-story-login>
            로그인하고 읽기
          </Link>
          <Link href={CATALOG_HREF} className={styles.ctaQuiet}>
            다른 작품 보기
          </Link>
        </div>
      </div>
      {release && preview?.truncated ? (
        <details className={`${styles.cautions} ${styles.entryDetails}`} data-story-entry-details>
          <summary>첫 장면 전체</summary>
          <div className={styles.entryDetailsBody}>
            <blockquote className={styles.hook} lang="en" aria-label="진입 장면" data-story-hook>
              {release.hookText}
            </blockquote>
          </div>
        </details>
      ) : null}
    </div>
  )
}

const UNAVAILABLE_TITLE: Record<StoryLearnerFailure['code'], string> = {
  auth_required: '로그인이 필요해요',
  account_blocked: '이 계정으로는 지금 읽을 수 없어요',
  release_unavailable: '지금은 열 수 없는 판본이에요',
  unit_not_found: '이 단위를 찾을 수 없어요',
  reader_not_ready: '읽기 화면 준비 중',
  reader_data_invalid: '판본 정보를 확인하지 못했어요',
  invalid_input: '주소가 올바르지 않아요',
  viewer_changed: '로그인한 계정이 바뀌었어요',
  temporary: '잠시 불러오지 못했어요',
  activity_locked: '아직 열리지 않은 활동이에요',
  activity_unavailable: '이 활동은 지금 열 수 없어요',
}

function Unavailable({ failure, releaseKey, onRetry }: { failure: StoryLearnerFailure; releaseKey: string; onRetry: () => void }) {
  return (
    <StatePage title={UNAVAILABLE_TITLE[failure.code]} kind={failure.code}>
      {failure.message ? <p className={styles.lede}>{failure.message}</p> : null}
      <div className={styles.actionRow}>
        {failure.retryable ? (
          <button type="button" className={styles.cta} onClick={onRetry} data-story-retry>
            다시 시도
          </button>
        ) : null}
        {failure.code === 'unit_not_found' ? (
          <Link href={readerHref(releaseKey, null)} className={styles.ctaSecondary}>
            목차로
          </Link>
        ) : null}
        <Link href={CATALOG_HREF} className={styles.ctaQuiet}>
          Stories 서가로
        </Link>
      </div>
    </StatePage>
  )
}

function StatePage({ title, kind, children }: { title: string; kind: string; children: ReactNode }) {
  return (
    <div className={styles.page} data-story-reader="state" data-story-state={kind}>
      <div className={styles.state} role="status">
        <h1 className={styles.stateTitle}>{title}</h1>
        {children}
      </div>
    </div>
  )
}
