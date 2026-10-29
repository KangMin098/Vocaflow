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
  ChevronLeft,
  ChevronRight,
  Code2,
  ExternalLink,
  FileText,
  Gauge,
  Headphones,
  Layers,
  NotebookText,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  Search,
  Terminal,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'

import { PassageMap, type MapAnchor, type MapPlacement } from '@/components/csat/PassageMap'
import { useLecture } from '@/components/csat/lecture/LectureStage'
import { preStopNotice, type PreStopRiskCode } from '@/lib/csat/lecture/disclosure-copy'
import type { SkeletonSentence } from '@/lib/csat/passage-skeleton'
import {
  blockKeyForTarget,
  theaterClock,
  theaterTimeline,
  type TheaterBlock,
  type TheaterStep,
} from '@/lib/csat/theater'
import { useTheaterSfx } from '@/lib/csat/theater-sfx'
import { track } from '@/lib/analytics/client'
import type { MeaningNote } from '@/lib/csat/meaning-note'
import { touchedItems, withView } from '@/lib/csat/continuity'
import { pickNextItem } from '@/lib/csat/next-item'
import { distractorsAreTrue, teachingModelOf } from '@/lib/csat/teaching-contract'
import { toItemSlug } from '@/lib/csat/item-slug'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { loadSyncedDissectionRecord, updateDissectionRecord } from '@/lib/csat/session/store'
import type { CheckAttempt, DissectionRecord, Prediction, ReasoningNote, SelfExplanation } from '@/lib/csat/dissect'
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
import { committedOf, grade, type GateCommit, type GateKey } from '@/lib/csat/reveal-gate'
import { answerWithheld, boundaryGate, gateBlocks, gatedLiveKey, type AnswerGateState } from '@/lib/csat/lecture/answer-gate'
import { mergeMeaningSupport, mergeReveal, type AnswerReveal } from '@/lib/csat/lecture/answer-split'

import type { LearnerCatalog } from '@/lib/csat/session/catalog'

import type { CropMarkRequest } from '@/lib/csat/reflow/crop-mark-view'
import { groupOf, rememberScene, type DockGroupId } from '@/lib/csat/inquiry/dock'
import { sceneKey, tabMemory } from '@/lib/csat/item-tab-memory'
import { buildLearningSummary, hasWrittenHistory } from '@/lib/csat/system-learning'
import { ItemPaper, type PaperPassage } from './ItemPaper'
import { EvidenceQuote } from './EvidenceQuote'
import { GateDiff } from './PredictGate'
import { SelfExplain } from './SelfExplain'
import { checkLocateFocus, checkLocateKey, isCheckLocateKey, resolveCheckLocate, UnderstandingChecks } from './UnderstandingChecks'
import { ComparePairs, type ComparePair } from './ComparePairs'
import { reviewDays, type UnderstandingCheck } from '@/lib/csat/understanding-check'
import { hashTag } from '@/lib/csat/dissect'
import { SessionDone } from './SessionDone'
import { InquiryDock } from './InquiryDock'
import { PaperResizer } from './PaperResizer'
import { ReasoningNoteForm } from './ReasoningNoteForm'
import { SystemLearningSummary } from './SystemLearningSummary'
import { V3CompareExplorer, type PairWithheldView } from './V3CompareExplorer'
import { V3Design, V3Judgment, V3Meaning, V3PrincipleLevels, V3Task } from './InquiryV3Panels'
import { DesignSelection, DistractorDesign, PrincipleDesign, TransformDiagram } from './SceneDiagrams'
import { StructurePredict } from './StructurePredict'
import type { InquiryRecord, PairAbsence, V3PairView } from '@/lib/csat/inquiry/labels'
import { TypeJudgment } from '@/components/csat/judgment/TypeJudgment'
import { judgmentRouteProvider } from '@/lib/csat/judgment/provider'
import type { JudgmentItem } from '@/lib/csat/judgment/types'
import { SCENES, nextScene, parseScene, sceneOfBlock, sceneOfCheck, type JudgmentView, type SceneId } from '@/lib/csat/inquiry/scenes'
import { MeaningSupportPanel } from './MeaningSupportPanel'
import type { MeaningSupportView, MsDepth } from '@/lib/csat/meaning-support/labels'
import { alignPassage } from '@/lib/csat/meaning-support/align'
import { bridgeOf, buildItemUrl, parseMeaningParams, relationSentences, relationsOfUnit, sentencesOf, unitsForSentence } from '@/lib/csat/meaning-support/model'
import { ItemFinderDialog, type FinderOrigin } from '@/components/csat/browse/ItemFinderDialog'
import finderStyles from '@/components/csat/browse/item-finder.module.css'
import { EMPTY_FILTER } from '@/lib/csat/browse-model'
import { EMPTY_SELECTION, finderItemHref, finderOriginFor, selectionFromBrowseHref, type FinderSelection } from '@/lib/csat/item-finder'
import styles from './theater.module.css'

const RATES = [0.9, 1, 1.15] as const

// 해설 공개 서버 기록 — 최초 공개 시각을 고정해 보관하고, 실패하면 다음에 극장을 열 때 같은 본문으로 다시 보낸다(재전송 = 서버 duplicate · Codex P1)
// userId: 공개한 계정 — 공유 기기에서 다른 계정으로 바뀐 뒤 재전송되면 서버가 버린다(Codex P1)
type PendingReveal = { slug: string; sessionId: string; help: 'independent' | 'viewed_first'; revealedAt: string; userId: string | null }
async function currentUserId(): Promise<string | null> {
  // getSession 은 기기에 저장된 로그인 세션을 읽는다(네트워크 불필요) — 오프라인 공개도 계정에 묶여 나중에 재전송된다(Codex P1).
  // 계정 확인 자체는 서버(learnerContext)가 한다 — 여기 값은 「누가 남긴 대기 기록인가」 표시일 뿐
  try { return (await createBrowserClient().auth.getSession()).data.session?.user.id ?? null } catch { return null }
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
// 기기 세션 → 공개한 계정(기기 기록에는 소유자가 없다 — 공유 기기에서 다른 계정의 세션을 보완 전송하지 않으려고 따로 둔다)
const OWNER_KEY = 'vf.csat.revealOwners'
const readOwners = (): Record<string, string> => { try { const v = JSON.parse(localStorage.getItem(OWNER_KEY) ?? '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} } }
const rememberOwner = (sessionId: string, userId: string | null) => {
  if (!userId) return
  try { const o = readOwners(); o[sessionId] = userId; const keys = Object.keys(o); for (const k of keys.slice(0, Math.max(0, keys.length - 500))) delete o[k]; localStorage.setItem(OWNER_KEY, JSON.stringify(o)) } catch { /* 저장소 없음 */ }
}
async function sendReveal(r: PendingReveal) {
  rememberOwner(r.sessionId, r.userId)
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

/**
 * 판단 장면 「정답 보기」 뒤 포커스 — 정답 근거 제목([data-block="analysis:answer"] h2)으로 옮긴다(T-0188).
 * 공개 상태가 커밋된 뒤에도 정답 블록이 한두 프레임 늦게 그려질 수 있어, 제목이 나타날 때까지 프레임마다 다시 찾는다.
 * maxFrames 안에 끝내 나타나지 않을 때만 판단 선택지로 대체한다(문서 밖으로 빠지지 않게).
 * 돌려주는 함수로 남은 시도를 취소한다 — 화면이 사라진 뒤 다음 화면의 제목으로 옮기지 않게 effect 정리에서 부른다.
 */
export function focusRevealedAnswer(doc: Pick<Document, 'querySelector'>, opts: { maxFrames?: number; schedule?: (cb: () => void) => unknown } = {}): () => void {
  let cancelled = false
  const raw = opts.schedule ?? ((cb: () => void) => requestAnimationFrame(cb))
  const schedule = (cb: () => void) => raw(() => {
    if (!cancelled) cb()
  })
  const maxFrames = Math.max(1, opts.maxFrames ?? 60)
  const place = (h: HTMLElement) => {
    h.tabIndex = -1
    h.focus()
  }
  const attempt = (frame: number) => {
    const h = doc.querySelector<HTMLElement>('[data-block="analysis:answer"] h2')
    if (h) return place(h)
    if (frame + 1 < maxFrames) {
      schedule(() => attempt(frame + 1))
      return
    }
    const fallback = doc.querySelector<HTMLElement>('[data-testid="judgment-options"]')
    if (fallback) place(fallback)
  }
  schedule(() => attempt(0))
  return () => {
    cancelled = true
  }
}

export interface TheaterMap {
  sentences: SkeletonSentence[]
  anchors: MapAnchor[]
  placements: MapPlacement[]
}

export interface TheaterSibling {
  id: string
  slug: string
  label: string
  no: number
  current: boolean
}

type TabId = 'analysis' | 'script' | 'run' | 'siblings'

const TABS: { id: TabId; label: string; Icon: typeof BookOpen }[] = [
  { id: 'analysis', label: '분석', Icon: BookOpen },
  { id: 'script', label: '읽기 강의', Icon: NotebookText },
  { id: 'run', label: '진행', Icon: Gauge },
  { id: 'siblings', label: '같은 유형', Icon: Layers },
]

export function AnalysisTheater({
  title,
  typeName,
  points,
  minutes,
  steps: initialSteps,
  blocks: initialBlocks,
  checks: initialChecks = [],
  comparePairs: initialComparePairs = [],
  v3Pairs: initialV3Pairs = [],
  pairAbsence = null,
  pairWithheld = { held: 0, missing: 0, changed: 0 },
  initialPairId = null,
  compareReturn = null,
  currentSlug = '',
  initialScene = 'task',
  initialJudgmentView = 'answer',
  sceneNormalized = false,
  inquiry: initialInquiry = null,
  map: initialMap,
  itemId,
  backHref,
  backTo = 'home',
  mapReturn = null,
  carry = '',
  typeHref,
  next,
  source,
  siblings,
  examLabel,
  paper,
  gate: initialGate,
  analysisVersion = null,
  sourceUnitsHash = null,
  typeId,
  meaningSupport: initialMeaningSupport = null,
  judgmentItem = null,
  initialMeaning = null,
  initialDepth = 'brief',
  initialRelation = null,
  initialBridge = false,
  meaningNormalized = false,
  finder = null,
  lectureDisclosure = null,
}: {
  title: string
  typeName: string | null
  points: number | null
  minutes: number
  steps: TheaterStep[]
  blocks: TheaterBlock[]
  /** 이해 확인 과제(M4) — 서버가 검수된 분석에서 만든다 */
  checks?: UnderstandingCheck[]
  /** 같은 원리 비교 쌍(M4) — 독립 검수 통과분만 */
  comparePairs?: ComparePair[]
  /** v3 비교 쌍(M4) — 해시 결속 독립 검수 · 상대 공개 확인을 지난 것만, 이 문항 기준으로 돌린 형태 */
  v3Pairs?: V3PairView[]
  /** v3 비교가 없을 때 그 이유(쌍 없음 · 상대 비공개 · stale) */
  pairAbsence?: PairAbsence | null
  /** 화면에서 뺀 검수 쌍의 이유별 수 */
  pairWithheld?: PairWithheldView
  /** 주소 `?pair=` 로 열 쌍 */
  initialPairId?: string | null
  /** 다른 문항의 비교에서 넘어왔으면 돌아갈 곳(`?back=`) */
  compareReturn?: { href: string; label: string } | null
  /** 이 문항 slug — 상대로 넘어갈 때 back 으로 넘긴다 */
  currentSlug?: string
  /** 일곱 장면 중 처음 열 장면(URL `?scene=` · 서버가 parseScene 으로 정규화) */
  initialScene?: SceneId
  /** 문항 성립 장면의 처음 보기 — 옛 `distractor` 링크면 options */
  initialJudgmentView?: JudgmentView
  /** 주소의 장면 값이 옛 별칭 · 무효값이었다 — 첫 렌더 뒤 replace 로 정규형으로 고친다 */
  sceneNormalized?: boolean
  /** 탐구 데이터(오답 설계 · 원리) — 분석 버전이 같을 때만 서버가 넘긴다 */
  inquiry?: InquiryRecord | null
  map: TheaterMap | null
  /** 문항 id(`2026#31`) — 열람 기록용 */
  itemId: string
  /** 기출분석공간 홈 */
  backHref: string
  /** 「뒤로」 가 어디로 가나 — 기출 탐구 서가(같은 조건) · 내 학습 지도 */
  backTo?: 'home' | 'browse'
  /** 학습 지도에서 들어왔으면 지도로 돌아가는 주소(v3 M4) — 탐구 이력은 독립 진단이 아니다 */
  mapReturn?: string | null
  /** 비교 상대 문항으로 옮길 때 이어 갈 문맥(서가 조건 · 지도 복귀) — 문항 화면이 검증해 만든 쿼리 조각(`&…`) */
  carry?: string
  /** 이 유형의 서가 — 유형을 모르면 null */
  typeHref: string | null
  next: { href: string; label: string } | null
  /** url 이 null 이면 갈 곳이 없다(학력평가 — 교육청 출제라 평가원 자료실에 없다). 링크 대신 사유만 보인다 */
  source: { url: string | null; direct: boolean; reason: string | null }
  siblings: TheaterSibling[]
  examLabel: string
  /** 왼쪽 열 원본 — 기기의 문제지 추출본을 읽는다(서버는 원문을 보내지 않는다) */
  paper: { catalog: LearnerCatalog; examId: string; no: number }
  /** 지난 예측 기록(2026-10-10 이전 예측 관문)의 차이 카드를 다시 보이는 데만 쓴다 — 새 예측은 받지 않는다 */
  gate: GateKey
  /** 이 화면이 읽은 분석 버전 — 정답 요청 때 서버가 같은 판본인지 맞춘다(다르면 409) */
  analysisVersion?: number | null
  /** 판단 도구 근거 연결의 독립 결속 해시(서버 · 원문 이해 배포 결속 + 지도 분할 일치일 때만) — 없으면 근거 강조를 끈다 */
  sourceUnitsHash?: string | null
  /** 유형 id — 학습 목표(이 문항에서 설명할 관계)를 유형 교수 계약에서 고른다 */
  typeId?: string
  /** v3.1 원문 이해 교수 설명 — 결속(분석 버전 · units_hash · 배포 레코드 해시)이 맞을 때만 서버가 넘긴다. 없으면 기존 v3 의미 패널 */
  meaningSupport?: MeaningSupportView | null
  /** URL meaning= (서버가 allowlist 로 검증한 unit) */
  initialMeaning?: string | null
  initialDepth?: MsDepth
  /** URL rel= (그 의미에 이어진 관계일 때만) */
  initialRelation?: string | null
  /** URL bridge=1 — 원문 이해에서 문항 성립 · 설계 재구성으로 이어 온 상태 */
  initialBridge?: boolean
  /** 주소의 meaning · depth · rel · bridge 중 무효값이 있었다 — 첫 렌더 뒤 정규형 주소로 바꾼다 */
  meaningNormalized?: boolean
  /** 기출 찾기(문항 머리 · 비교 없음 안내). null = 숨김(독립 확인 중). mapCtxQuery = 서버가 검증한 지도 복귀 조각 */
  finder?: { fromMap: boolean; mapCtxQuery: string } | null
  /** 검증된 「직접 정답 공개」 경계 — 서버가 대본 결속을 확인한 것만. 없으면 「정답 직접 안내 전까지」 경로를 내주지 않는다 */
  /** D 판단 도구(T-0161) — 페이지가 G 현재 판본 결속으로 만든 정답 없는 문항. 없으면 도구 없음 */
  judgmentItem?: JudgmentItem | null
  lectureDisclosure?: { verified: true; stopBefore: number; preStopRisk: PreStopRiskCode } | { verified: false } | null
}) {
  const lec = useLecture()
  // ── 판단 장면 정답 지연 조회 (b) — 첫 응답에는 정답 · 확정 해설이 없다. 학습자가 요청하면 서버가 노출 원장을 먼저 커밋하고
  // 공개 자료를 돌려준다. 받은 자료는 이 컴포넌트 상태에만 둔다(저장소 · 캐시 없음). 마운트 · prefetch 로는 요청하지 않는다
  const [revealed, setRevealed] = useState<AnswerReveal | null>(null)
  // 판단 장면 「정답 보기」 가 남긴 포커스 요청 — 공개 상태가 커밋된 뒤(useLayoutEffect)에만 옮긴다(T-0188 경합)
  const pendingRevealFocus = useRef(false)
  useLayoutEffect(() => {
    if (!revealed || !pendingRevealFocus.current) return
    pendingRevealFocus.current = false
    return focusRevealedAnswer(document)
  }, [revealed])
  const [revealState, setRevealState] = useState<'idle' | 'pending' | 'failed'>('idle')
  const merged = useMemo(
    () =>
      revealed
        ? mergeReveal(
            { blocks: initialBlocks, anchors: initialMap?.anchors ?? [], placements: initialMap?.placements ?? [], checks: initialChecks, comparePairs: initialComparePairs, v3Pairs: initialV3Pairs, inquiry: initialInquiry, gate: initialGate },
            revealed,
          )
        : null,
    [revealed, initialBlocks, initialMap, initialChecks, initialComparePairs, initialV3Pairs, initialInquiry, initialGate],
  )
  const steps = revealed?.steps ?? initialSteps
  const blocks = merged?.blocks ?? initialBlocks
  const checks = merged?.checks ?? initialChecks
  const comparePairs = merged?.comparePairs ?? initialComparePairs
  const v3Pairs = merged?.v3Pairs ?? initialV3Pairs
  const inquiry = merged?.inquiry ?? initialInquiry
  const gate = merged?.gate ?? initialGate
  // T-0145 판단 도구(interaction34)는 선택 상태를 자식 안에 둔다 — 정답 공개 뒤에는 장면을 옮겨도 패널을 마운트한 채 숨겨
  // 학습자가 고른 범위 · 조건 · 비교 쌍 · 설계 선택을 보존한다(연결 계약 C7 · T-0152 R152-01). 공개 전에는 도구가 안내만 그리므로 유지할 상태가 없다
  const keepTools = Boolean(revealed && inquiry?.v3?.interaction34)
  const map = useMemo(
    () => (initialMap && merged ? { ...initialMap, sentences: revealed?.mapSentences ?? initialMap.sentences, anchors: merged.anchors, placements: merged.placements } : initialMap),
    [initialMap, merged, revealed],
  )
  // ── 기출 찾기(FND2 · FND3) — 학습 상태(장면 · 근거 · 초안)와 분리된 팝업 상태 ──────────────
  const [finderOpen, setFinderOpen] = useState<FinderOrigin | null>(null)
  // 「찾기 전 문항으로」 — 찾기로 이 문항에 왔을 때만(탭 메모리 · 첫 렌더 뒤에 읽는다: 서버 렌더와 어긋나지 않게)
  const [finderBack, setFinderBack] = useState<string | null>(null)
  useEffect(() => setFinderBack(finderOriginFor(itemId)), [itemId])
  const pauseLecture = () => {
    // 위치는 그대로 두고 멈춘다 — 닫아도 저절로 다시 틀지 않는다(재생 버튼으로 명시적으로 잇는다)
    if (lec?.status === 'playing') lec.toggle()
  }
  const openFinder = (o: 'item' | 'compare') => {
    pauseLecture()
    track({ name: 'csat_path_chosen', props: { axis: 'finder', need: 'none', origin: o, action: 'open' } })
    setFinderOpen(o)
  }
  const finderRet = backTo === 'browse' ? backHref : null
  const finderInitial: FinderSelection =
    finderOpen === 'compare' && typeId
      ? { filter: { ...EMPTY_FILTER, type: typeId }, purpose: null }
      : selectionFromBrowseHref(finderRet) ?? EMPTY_SELECTION
  const isReviewPhase = (s: LearningSession | null | undefined) => s?.phase === 'review'
  const goal = teachingModelOf(typeId)
  const [quotePassage, setQuotePassage] = useState<PaperPassage | null>(null)
  // 문항 이동 직후에는 이전 문항의 지문으로 인용을 검증하지 않는다.
  const currentPassage = quotePassage?.itemId === itemId ? quotePassage.passage : null
  const back = (to: 'home' | 'type' | 'browse') => () => track({ name: 'csat_item_back', props: { to } })
  // 학습 세션(G0 계약) — undefined = 기록 읽는 중. 세션은 시도가 0건이어도 있다.
  const [session, setSession] = useState<LearningSession | null | undefined>(undefined)
  // 공개 게이트 — undefined = 기록 읽는 중 · null = 아직 확정 안 함
  const [committed, setCommitted] = useState<Prediction | null | undefined>(undefined)
  const [resumedAt, setResumedAt] = useState<number | null>(null)
  // 이 기기에서 본 문항 — 다음 문항을 본 기록으로 고른다(F14). 읽기 전에는 서버가 고른 것을 쓴다
  const [seen, setSeen] = useState<ReadonlySet<string> | null>(null)
  // 이 문항의 자기 설명(M4) — 기기 기록에서 읽고, 저장 · 대조 때 갱신한다
  const [explained, setExplained] = useState<SelfExplanation[]>([])
  const pickExplained = (r: DissectionRecord) => setExplained((r.explanations ?? []).filter((x) => x.item === itemId))
  // 원리 노트(v3 M4) — 이 문항 것만. 저장은 id 단위 교체(대조 표시도 같은 경로)
  const [notes, setNotes] = useState<ReasoningNote[]>([])
  const pickNotes = (r: DissectionRecord) => {
    setNotes((r.reasoningNotes ?? []).filter((x) => x.item === itemId))
    setMeaningNotes((r.meaningNotes ?? []).filter((x) => x.item === itemId))
  }
  // 원문 이해 「내 말로」 노트(v3.2) — 이 문항 것만. 저장은 id(문항|의미) 단위 교체 · 실제 저장 결과를 돌려준다
  const [meaningNotes, setMeaningNotes] = useState<MeaningNote[]>([])
  const saveMeaningNote = (x: MeaningNote): Promise<boolean> =>
    persist((r) => ({ ...r, meaningNotes: [...(r.meaningNotes ?? []).filter((y) => y.id !== x.id), x], updatedAt: Date.now() }))
      .then(({ record, saved }) => {
        if (saved) pickNotes(record)
        return saved
      })
      .catch(() => false)
  // 이 문항의 이해 확인 시도(M4)
  const [checked, setChecked] = useState<CheckAttempt[]>([])
  const pickChecked = (r: DissectionRecord) => setChecked((r.checks ?? []).filter((x) => x.item === itemId))
  const [comparedWith, setComparedWith] = useState<ReadonlySet<string>>(new Set())
  const pickCompared = (r: DissectionRecord) => setComparedWith(new Set((r.compares ?? []).filter((x) => x.item === itemId).map((x) => x.other)))
  const sfx = useTheaterSfx()
  const [cursor, setCursor] = useState(0)
  const ready = useRef(false)
  // 기출 원문 열 폭(PaperResizer 가 --paper-w 를 이 격자에 건다)
  const bodyRef = useRef<HTMLDivElement | null>(null)
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
      setSeen(touchedItems(record))
      pickExplained(record)
      pickNotes(record)
      pickChecked(record)
      pickCompared(record)
      if (principleTag) setPrincipleSaved(record.formulas.some((f) => f.tag === principleTag && f.sources.includes(itemId)))
      const { session: s, resumed } = opened as { session: LearningSession; resumed: boolean }
      // 예측 관문은 없다(F01 · 2026-10-10) — 문항을 열면 해설을 바로 본다. 그래서 이 열람은 「해설을 먼저 본」 공개로
      // 남긴다(viewed_first · 시도 없음). 같은 문항의 Practice · 확인 과제가 독립 수행으로 잘못 세지지 않게 한다.
      if (s.stage === 'open') {
        const id = s.id
        const res = await persist((r) => revealSession(r, id, 'viewed_first', null, Date.now()))
        if (!alive) return
        sync(res.record, id)
        const revealedAt = new Date().toISOString()
        void currentUserId().then((userId) => sendReveal({ slug: toItemSlug(itemId), sessionId: id, help: 'viewed_first', revealedAt, userId }))
      } else sync(record, s.id)
      // 이미 공개된 이 문항의 기기 세션(이 변경 전 · 다른 기기에서 동기화된 것)도 서버에 한 번 남긴다 — 최초 공개 시각 그대로 · 재전송은 서버 duplicate(Codex P1)
      void currentUserId().then((userId) => {
        const owners = readOwners()
        for (const x of sessionsOf(record)) {
          if (x.item !== itemId || x.stage === 'open') continue
          // 이 계정이 공개한 세션만 보완 전송한다 — 소유자를 모르는 옛 세션 · 다른 계정 세션은 보내지 않는다(Codex P1)
          if (!userId || owners[x.id] !== userId) continue
          void sendReveal({ slug: toItemSlug(itemId), sessionId: x.id, help: x.help === 'viewed_first' || x.help === 'hint' ? 'viewed_first' : 'independent', revealedAt: new Date(x.revealedAt ?? x.updatedAt).toISOString(), userId })
        }
      })
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
  const finished = session?.stage === 'finished'
  // 원리 저장(M4) — 유형 관계 · 적용 조건 · 한계 · 출처 문항을 함께. 같은 유형 원리는 한 줄로 모이고 출처만 늘어난다
  const principleTag = goal ? hashTag(`theater|${typeId}|${goal.relation}`) : null
  const [principleSaved, setPrincipleSaved] = useState(false)
  const savePrinciple = () => {
    if (!goal || !principleTag) return
    setPrincipleSaved(true)
    track({ name: 'csat_principle_saved', props: { from: 'theater' } })
    void persist((r) => {
      const prev = r.formulas.find((f) => f.tag === principleTag)
      // 검수된 탐구 원리가 있으면 그 통하는 조건 · 쓰면 안 되는 조건을 함께 담는다(M4 — 관계 문장만 저장하던 공백)
      const ip = inquiry?.principle
      const f = { tag: principleTag, text: goal.relation, type: typeId ?? '', sources: [...new Set([...(prev?.sources ?? []), itemId])], conditions: ip ? ip.when_applies.join(' · ') : goal.answerDesign, limit: ip ? ip.when_not.join(' · ') : goal.pitfalls[0], from: 'theater' as const }
      return { ...r, formulas: [...r.formulas.filter((x) => x.tag !== principleTag), f], updatedAt: Date.now() }
    })
  }
  const recordCompare = (other: string) => {
    setComparedWith((s) => new Set([...s, other]))
    const x = { id: globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${other}`, item: itemId, other, at: Date.now() }
    void persist((r) => ({ ...r, compares: [...(r.compares ?? []), x], updatedAt: Date.now() })).then(({ record }) => pickCompared(record))
  }
  const recordCheck = (x: CheckAttempt) => {
    setChecked((xs) => [...xs, x])
    void persist((r) => ({ ...r, checks: [...(r.checks ?? []), x], updatedAt: Date.now() })).then(({ record }) => pickChecked(record))
  }
  const finish = () => {
    if (!session) return
    const id = session.id
    void persist((r) => finishSession(r, id, Date.now())).then(({ record }) => {
      sync(record, id)
      requestAnimationFrame(() => document.querySelector('[data-testid="session-done"]')?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
    })
  }
  // 간격은 이해 확인 결과로 — 다 첫 시도에 맞혔으면 7일, 다시 골랐으면 3일, 답을 열었거나 안 했으면 1일(M4).
  //   완료 화면의 「N일 뒤 다시 보기」 표시와 클릭 예약이 **같은 값**을 쓴다(T-0216 — 예전 표시는 늘 3일이었다)
  const doneReviewDays = reviewDays(checked.filter((x) => !x.review))
  const review = () => {
    if (!session) return
    const id = session.id
    const days = doneReviewDays
    track({ name: 'csat_review_scheduled', props: { days } })
    void persist((r) => scheduleReview(r, id, Date.now(), days)).then(({ record }) => sync(record, id))
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
  const [tab, setTab] = useState<TabId>('analysis')
  const [scene, setScene] = useState<SceneId>(initialScene)
  // 판단 도구 공개 provider — 문항(slug)마다 새로 만든다(멱등 키가 다른 문항으로 넘어가지 않게)
  const judgmentReveal = useMemo(() => judgmentRouteProvider(toItemSlug(itemId)), [itemId])
  // v3 근거 연결 — 패널에서 고른 근거 문장(1-기반). 장면을 옮기면 비운다(다른 장면의 근거가 남아 비추지 않게)
  // 처음 근거 선택 — 이 문항 · 장면을 전에 봤으면 탭 메모리에서(문항을 다녀와도 남는다 · item-tab-memory)
  const [evidence, setEvidence] = useState<{ sentences: number[]; key: string } | null>(() => tabMemory.scene.get(sceneKey(itemId, initialScene))?.evidence ?? null)
  const v3 = inquiry?.v3 ?? null
  // 지도 문장 수가 v3 작성 때와 같을 때만 연결한다 — 원문 분할이 다르면 잘못된 문장을 비추지 않는다
  const v3Linkable = Boolean(v3 && map && map.sentences.length === v3.sentence_count)
  const onEvidence = (sentences: number[], key: string) => {
    setEvidence(evidence?.key === key ? null : { sentences, key })
  }
  // 작업공간 W2/W3 — 장면별 근거 선택 · 오른쪽 판 스크롤을 이 탭 메모리에 문항별로 기억한다. 주소 · 뒤로가기가 장면을 정하고, 메모리는 그 장면의 선택만 되살린다.
  //   기억이 없으면(미방문) 선택 없음, 학습자가 해제했으면 해제(null) 그대로 — 자동 선택으로 덮지 않는다.
  //   저장 위치는 모듈 탭 메모리(item-tab-memory) — 문항 주소가 바뀌면 이 컴포넌트가 다시 마운트되므로 컴포넌트 안에 두면 문항 왕복에서 사라진다
  const sceneMem = useRef(tabMemory.scene)
  const memKey = (sc: SceneId) => `${itemId}|${sc}`
  const pendingScroll = useRef<{ explain: number; evidence: number } | null>(null)
  const evidencePaneRef = useRef<HTMLDivElement>(null)
  // 뒤로가기(popstate)는 이전 렌더의 클로저로 불리므로 최신 장면 · 근거를 ref 로 둔다
  const live = useRef<{ scene: SceneId; evidence: { sentences: number[]; key: string } | null }>({ scene: initialScene, evidence })
  const stashScene = () => {
    const prev = sceneMem.current.get(memKey(live.current.scene))
    sceneMem.current.set(memKey(live.current.scene), {
      evidence: live.current.evidence,
      scroll: blocksRef.current?.scrollTop ?? seenScroll.current.explain ?? prev?.scroll ?? 0,
      evScroll: evidencePaneRef.current?.scrollTop ?? seenScroll.current.evidence ?? prev?.evScroll ?? 0,
    })
  }
  // 문항을 떠날 때(언마운트) 지금 장면을 남긴다 — 판 DOM 은 이미 떨어졌으므로 스크롤은 지켜본 마지막 값, 못 봤으면 전에 남긴 값
  const seenScroll = useRef<{ explain: number | null; evidence: number | null }>({ explain: null, evidence: null })
  useEffect(() => {
    const pairs = [
      [blocksRef.current, 'explain'],
      [evidencePaneRef.current, 'evidence'],
    ] as const
    const offs = pairs.map(([el, k]) => {
      if (!el) return () => {}
      const on = () => {
        seenScroll.current[k] = el.scrollTop
      }
      el.addEventListener('scroll', on, { passive: true })
      return () => el.removeEventListener('scroll', on)
    })
    return () => offs.forEach((off) => off())
  })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 떠날 때 한 번(마운트 시점의 문항 키)
  useEffect(() => () => stashScene(), [])
  const recallScene = (sc: SceneId) => {
    const m = sceneMem.current.get(memKey(sc))
    // 비교 쌍의 근거는 그 비교 화면이 다시 열려 쌍을 고를 때만 — 쌍 선택 없이 강조만 되살리지 않는다
    const ev = m?.evidence && !(sc === 'compare' && /^(pair|diff)-/.test(m.evidence.key)) ? m.evidence : null
    setEvidence(ev)
    pendingScroll.current = { explain: m?.scroll ?? 0, evidence: m?.evScroll ?? 0 }
  }
  // 요소별 마지막 장면(제목 클릭이 여는 곳) · 가운데 판 접힘 · 근거 판 보기(위치 · 관계)
  const [lastByGroup, setLastByGroup] = useState<Partial<Record<DockGroupId, SceneId>>>(() => rememberScene({}, initialScene))
  const [evidenceCollapsed, setEvidenceCollapsed] = useState(false)
  // 다시 열린 근거 판에 기억한 스크롤을 놓는다
  useEffect(() => {
    if (evidenceCollapsed) return
    const to = pendingScroll.current
    if (to && evidencePaneRef.current) evidencePaneRef.current.scrollTop = to.evidence
    pendingScroll.current = null
  }, [evidenceCollapsed])
  const [evidenceView, setEvidenceView] = useState<'map' | 'relation'>('map')
  // 자기 설명 · 원리 노트 작성 초안은 없다(T-0091 학습 정리 전환) — 탭 메모리의 옛 초안 칸(item-tab-memory)은 손대지 않고 둔다
  // v3.1 원문 이해 — 선택(의미 · 관계 · 깊이 · 구절)과 메모리 초안은 여기서 갖는다. 장면을 옮겨도 남고, 새로 고침 · 문항 이탈엔 사라진다.
  //   주소에는 검증된 meaning · depth · rel · bridge 만 싣는다(초안 · 구절 선택은 싣지 않는다). 뒤로/앞으로는 주소에서 모두 되살린다.
  const ms = useMemo(() => mergeMeaningSupport(initialMeaningSupport, revealed?.meaningSupport), [initialMeaningSupport, revealed])
  const [msUnit, setMsUnit] = useState<string | null>(initialMeaning ?? ms?.defaultUnitId ?? null)
  const [msRelation, setMsRelation] = useState<string | null>(initialRelation)
  const [msDepth, setMsDepth] = useState<MsDepth>(initialDepth)
  const [msBridge, setMsBridge] = useState(initialBridge)
  //   원문 이해 초안은 의미 단위 id(u1 …)가 문항마다 겹치므로 문항 키 아래에 둔다
  // 원문 이해 읽어 주기 — 지금 말하는 설명의 원문 문장(지도 강조가 따라간다)
  const [msSpeak, setMsSpeak] = useState<number[]>([])
  const [msDrafts, setMsDrafts] = useState<Record<string, string>>(() => tabMemory.meaning[itemId] ?? {})
  useEffect(() => {
    tabMemory.meaning[itemId] = msDrafts
  }, [itemId, msDrafts])
  // 지도 문장 선택 결과 — unit 이 0 개 · 여러 개일 때 이전 설명 · 관계를 접고 그 문장만 말한다(설명을 지어내지 않는다)
  const [msPick, setMsPick] = useState<{ n: number; unitIds: string[] } | null>(null)
  // 고른 구절(앵커 id) — 대조가 맞을 때만 문제지 · 지도에 표시
  const [msPhrase, setMsPhrase] = useState<string | null>(null)
  // 지도의 근거 칩(정답 · 오답 근거)을 고르면 원문 이해 강조를 내려놓는다 — 지도가 칩과 의미를 동시에 비추지 않게(Codex P2 · 2026-10-13).
  //   의미 · 관계 · 구절 · 문장을 다시 고르거나 장면을 옮기면 원문 이해 강조로 돌아온다
  const [msChip, setMsChip] = useState(false)
  // 원문 대조 — 기기 문제지(ItemPaper)와 빌드 대조 자료. 여는 중 · 없음 · 다름 · 맞음
  const paperStatus = quotePassage?.itemId === itemId ? (quotePassage.status ?? (quotePassage.passage ? 'ready' : 'loading')) : 'loading'
  const msText = useMemo(() => alignPassage(ms?.alignment, paperStatus, currentPassage), [ms, paperStatus, currentPassage])
  // 지도 강조 · 문장 고르기는 분할(서버 · 문장 수 + 길이)이 같고, 기기 원문이 있으면 글자까지 맞을 때만
  const msMapOk = Boolean(ms && v3Linkable && ms.splitOk && msText.state !== 'mismatch')
  const msHref = (sceneId: SceneId, o: { unit: string | null; depth: MsDepth; rel: string | null; bridge: boolean }) =>
    buildItemUrl(new URL(window.location.href), { scene: sceneId, meaning: o.unit, depth: o.depth, rel: o.rel, bridge: o.bridge })
  const writeMs = (o: { unit: string | null; depth: MsDepth; rel: string | null }) =>
    window.history.replaceState(window.history.state, '', msHref(scene, { ...o, bridge: false }))
  const pickMsUnit = (id: string | null, from: 'chip' | 'map' | 'relation' = 'chip') => {
    if (id) track({ name: 'csat_meaning_unit_selected', props: { from, depth: msDepth } })
    setMsUnit(id)
    setMsRelation(null)
    setMsPick(null)
    setMsChip(false)
    setMsPhrase(null)
    writeMs({ unit: id, depth: msDepth, rel: null })
  }
  // 전체 통합 · 경계에서 거슬러 오르기 — 의미와 관계를 한 번에(관계는 그 의미에 이어진 것만 주소에 실린다)
  const traceMs = (unitId: string, relationId: string | null, target: 'step' | 'link' | 'boundary' = relationId ? 'link' : 'step') => {
    track({ name: 'csat_meaning_whole_traced', props: { target } })
    const rk = relationId ? ms?.relations.find((r) => r.id === relationId)?.kind : undefined
    if (rk) track({ name: 'csat_meaning_relation_opened', props: { kind: rk, from: 'trace' } })
    else track({ name: 'csat_meaning_unit_selected', props: { from: 'trace', depth: msDepth } })
    setMsUnit(unitId)
    setMsRelation(relationId)
    setMsPick(null)
    setMsChip(false)
    setMsPhrase(null)
    writeMs({ unit: unitId, depth: msDepth, rel: relationId })
  }
  const pickMsRelation = (id: string | null) => {
    const rk = id ? ms?.relations.find((r) => r.id === id)?.kind : undefined
    if (rk) track({ name: 'csat_meaning_relation_opened', props: { kind: rk, from: 'unit' } })
    setMsRelation(id)
    setMsPick(null)
    setMsChip(false)
    setMsPhrase(null)
    writeMs({ unit: msUnit, depth: msDepth, rel: id })
  }
  // 구절 — 고르면 관계 선택을 푼다(문제지 · 지도가 같은 구절 하나를 가리키게)
  const pickMsPhrase = (id: string | null) => {
    setMsPhrase(id)
    setMsChip(false)
    if (id && msRelation) {
      setMsRelation(null)
      writeMs({ unit: msUnit, depth: msDepth, rel: null })
    }
  }
  const pickMsDepth = (d: MsDepth) => {
    if (d !== msDepth) track({ name: 'csat_meaning_depth_changed', props: { depth: d } })
    setMsDepth(d)
    writeMs({ unit: msUnit, depth: d, rel: msRelation })
  }
  // 지도 문장 — 한 의미면 그 의미로. 0 · 여러 개면 관계 선택을 풀고 이전 설명을 접는다(옛 설명 · 관계 강조와 섞이지 않게)
  const onMapSentence = (n: number) => {
    if (!ms) return
    setMsChip(false)
    const hits = unitsForSentence(ms, n)
    if (hits.length === 1) return pickMsUnit(hits[0].id, 'map')
    setMsPick({ n, unitIds: hits.map((u) => u.id) })
    setMsRelation(null)
    setMsPhrase(null)
    writeMs({ unit: msUnit, depth: msDepth, rel: null })
  }
  const msActive = Boolean(ms && scene === 'meaning')
  // F08 — 원본 크롭 위에 짚을 밑줄: 근거로 고른 선지(choice-n) · 평가 과제 장면의 함축 밑줄 어구. 대응 판정은 ItemPaper(crop-mark-view)
  const choicePick = evidence ? /^choice-([1-5])$/.exec(evidence.key) : null
  const paperMarkReq: CropMarkRequest | null = choicePick ? { kind: 'choice', n: Number(choicePick[1]) } : scene === 'task' ? { kind: 'implied' } : null
  const msPhraseSentence = ms && msPhrase ? ms.anchors.find((a) => a.id === msPhrase)?.sentence ?? null : null
  const msFocus = ms
    ? msPick ? [msPick.n] : msRelation ? relationSentences(ms, msRelation) : msPhraseSentence ? [msPhraseSentence] : sentencesOf(ms, msUnit)
    : []
  const msPaperMark = msActive && msText.state === 'ok' && msPhrase ? msText.spans[msPhrase] ?? null : null
  // 장면 이동 — 학습자가 고른 것은 history 에 쌓고(뒤로가기), 강의가 따라 옮긴 것은 주소만 바꾼다
  const selectScene = (id: SceneId, how: 'push' | 'replace' = 'push') => {
    stashScene()
    setScene(id)
    recallScene(id)
    setMsPick(null)
    setMsChip(false)
    setMsPhrase(null)
    setMsBridge(false)
    if (ms) {
      // 원문 이해 선택(의미 · 깊이 · 관계)은 주소에 남긴다 — 다른 장면에서 돌아와도 같은 의미가 열린다
      window.history[how === 'push' ? 'pushState' : 'replaceState'](window.history.state, '', msHref(id, { unit: msUnit, depth: msDepth, rel: msRelation, bridge: false }))
      return
    }
    const url = new URL(window.location.href)
    url.searchParams.set('scene', id)
    url.searchParams.delete('judgmentView')
    window.history[how === 'push' ? 'pushState' : 'replaceState'](window.history.state, '', url)
  }
  // 원문 이해 → 문항 성립 · 설계 재구성: 이 의미가 걸린 선택지 · 설계 근거를 들고 간다(주소 bridge=1 — 뒤로가기로 원래 의미에 돌아온다)
  const goBridge = (target: 'judgment' | 'design') => {
    track({ name: 'csat_meaning_bridge_followed', props: { scene: target } })
    stashScene()
    setScene(target)
    // 이어 온 맥락(bridge)이 근거를 대신 짚는다 — 이 장면의 지난 선택은 되살리지 않는다
    setEvidence(null)
    pendingScroll.current = { explain: 0, evidence: 0 }
    setMsPick(null)
    setMsChip(false)
    setMsPhrase(null)
    setMsBridge(true)
    window.history.pushState(window.history.state, '', msHref(target, { unit: msUnit, depth: msDepth, rel: msRelation, bridge: true }))
  }
  const msUnitObj = ms?.units.find((u) => u.id === msUnit) ?? null
  const msBridgeFocus =
    ms && msBridge && msUnitObj
      ? { unitLabel: msUnitObj.labelKo, ...bridgeOf(ms, msUnitObj.id), onReturn: () => selectScene('meaning') }
      : null
  // 판단 도구 인스턴스 결속 — 분석 revision 이 바뀌면 지난 단위 인스턴스를 버린다(선택이 다른 revision 으로 넘어가지 않게)
  const toolRev = String(inquiry?.analysis_version ?? 'na')
  const [bridgeSeen, setBridgeSeen] = useState<{ rev: string; units: string[] }>({ rev: toolRev, units: [] })
  const bridgeUnit = msBridgeFocus ? msUnit : null
  useEffect(() => {
    setBridgeSeen((cur) => {
      const units = cur.rev === toolRev ? cur.units : []
      if (cur.rev === toolRev && (!bridgeUnit || units.includes(bridgeUnit))) return cur
      return { rev: toolRev, units: bridgeUnit && !units.includes(bridgeUnit) ? [...units, bridgeUnit] : units }
    })
  }, [toolRev, bridgeUnit])
  const bridgeUnits = (bridgeSeen.rev === toolRev ? bridgeSeen.units : []).concat(bridgeUnit && !(bridgeSeen.rev === toolRev && bridgeSeen.units.includes(bridgeUnit)) ? [bridgeUnit] : [])
  useEffect(() => {
    // 뒤로가기 · 앞으로가기 — 장면 · 의미 · 깊이 · 관계 · 이어 온 맥락을 **주소에서** 되살린다(서버와 같은 파서 · allowlist)
    const onPop = () => {
      const q = new URL(window.location.href).searchParams
      const sc = parseScene(q.get('scene')).scene
      stashScene()
      setScene(sc)
      recallScene(sc)
      if (!ms) return
      const p = parseMeaningParams(
        { meaning: q.get('meaning'), depth: q.get('depth'), rel: q.get('rel'), bridge: q.get('bridge') },
        ms.units.map((u) => u.id),
        ms.defaultUnitId,
        (u) => relationsOfUnit(ms, u).map((r) => r.id),
      )
      setMsUnit(p.unitId)
      setMsDepth(p.depth)
      setMsRelation(p.relationId)
      setMsBridge(p.bridge)
      setMsPick(null)
      setMsChip(false)
      setMsPhrase(null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 장면 메모리는 ref · 문항 id 로 충분
  }, [ms])
  // 원문 이해 주소의 무효값(모르는 의미 · 깊이 · 관계 · bridge) — 화면 상태뿐 아니라 **주소도** 정규형으로(history 를 쌓지 않는다)
  useEffect(() => {
    if (!ms || !meaningNormalized) return
    window.history.replaceState(window.history.state, '', msHref(initialScene, { unit: initialMeaning ?? ms.defaultUnitId, depth: initialDepth, rel: initialRelation, bridge: initialBridge }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 첫 렌더 한 번(서버가 정규화한 값)
  }, [])
  // 옛 장면 값(essence · structure · answer · distractor) · 무효값은 정규형으로 주소만 고친다(history 를 쌓지 않는다)
  useEffect(() => {
    if (!sceneNormalized) return
    const url = new URL(window.location.href)
    url.searchParams.set('scene', initialScene)
    if (initialJudgmentView === 'options') url.searchParams.set('judgmentView', 'options')
    window.history.replaceState(window.history.state, '', url)
  }, [sceneNormalized, initialScene, initialJudgmentView])
  // 옛 `distractor` 링크 — 문항 성립 장면의 비선정 선지 구역부터 보인다(특정 선지 번호는 지어내지 않는다)
  useEffect(() => {
    if (initialScene !== 'judgment' || initialJudgmentView !== 'options') return
    document.getElementById('judgment-options')?.scrollIntoView({ block: 'start' })
  }, [initialScene, initialJudgmentView])
  const railRef = useRef<HTMLElement>(null)
  const blocksRef = useRef<HTMLDivElement>(null)
  live.current = { scene, evidence }
  // 문항 재진입(기출 찾기 왕복 · 뒤로가기) — 이 문항 · 장면을 전에 봤으면 두 판 스크롤을 되살린다. 마운트 때 한 번만,
  //   프레임의 pendingScroll 흐름(장면 전환 · 근거 판 접힘)과 섞지 않는다
  useEffect(() => {
    const m = tabMemory.scene.get(sceneKey(itemId, initialScene))
    if (!m) return
    if (blocksRef.current) blocksRef.current.scrollTop = m.scroll
    if (evidencePaneRef.current) evidencePaneRef.current.scrollTop = m.evScroll
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 때 한 번(그 문항 · 첫 장면)
  }, [])
  useEffect(() => {
    setLastByGroup((l) => rememberScene(l, scene))
    const to = pendingScroll.current
    pendingScroll.current = null
    if (to && blocksRef.current) blocksRef.current.scrollTop = to.explain
    if (to && evidencePaneRef.current) evidencePaneRef.current.scrollTop = to.evidence
  }, [scene])
  const played = useRef(-1)

  const playing = Boolean(lec && (lec.status === 'playing' || lec.status === 'paused'))
  // 강의 도구를 여는 동안 설명 판은 내려간다 — 돌아오면 그 스크롤로
  const explainScroll = useRef<number | null>(null)
  useEffect(() => {
    if (tab !== 'analysis' || explainScroll.current == null) return
    if (blocksRef.current) blocksRef.current.scrollTop = explainScroll.current
    explainScroll.current = null
  }, [tab])
  // 강의가 열리는 중에 학습자가 장면을 골랐다 — 열리면 곧바로 멈춘다(재개는 학습자가)
  const holdLecture = useRef(false)
  useEffect(() => {
    if (!lec || !holdLecture.current) return
    if (lec.status === 'playing') lec.toggle()
    else if (lec.status !== 'loading') holdLecture.current = false
  }, [lec, lec?.status])
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

  // 모든 블록은 처음부터 읽을 수 있다(F03) — 차례는 지금 설명하는 블록을 강조(data-live)할 뿐 여닫지 않는다.
  // 강의가 끝나도, 강의가 그 블록을 가리키지 않아도 정답 근거 · 오답 설계 · 재는 능력은 그대로 남는다.
  const label = (name: string) => name
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
  // ── 정답 공개 경로(2026-10-24 P1~P5) — 강의를 듣기 전에 학습자가 고른다. 고르기 전에는 어떤 cue 도 받지도 틀지도 않는다.
  // 원문부터 · 전체(정답 포함) · 정답 직접 안내 전까지(검증된 경계가 있을 때만). 강제 퀴즈 · 필수 선지 선택으로 대신하지 않는다
  const [lecturePath, setLecturePath] = useState<'self' | 'full' | 'until' | null>(null)
  const stopAt = lectureDisclosure?.verified ? lectureDisclosure.stopBefore : null
  // 정답 공개 동의 — 경계 안내의 「계속 듣기(정답 공개)」 또는 감춘 블록의 「정답 보기」 만 켠다(건너뛰기 · 멈춤 · 키 이동은 켜지 않는다)
  const [answerConsent, setAnswerConsent] = useState(false)
  // 정답 감춤 선택 — 「정답 직접 안내 전까지」 를 고르면 켜지고, 강의 오류로 경로가 풀려도 동의 전까지 꺼지지 않는다(r4 R4-02)
  const [answerHide, setAnswerHide] = useState(false)
  const answerGate: AnswerGateState = { path: lecturePath, stopAt, consented: answerConsent, hideAnswer: answerHide }
  const withheld = answerWithheld(answerGate)
  // 저장된 예측과 출제자 답의 대조 · 완료 카드의 채점도 정답 공개다 — 동의 전에는 그리지 않는다(T-0140 r6 R6-01)
  const diff = mine && !withheld && revealed ? <GateDiff commit={mine} result={grade(mine, gate)} gateKey={gate} /> : null
  const nextLive = useMemo(() => {
    if (!seen) return next ? { ...next, revisit: false } : null
    const pick = pickNextItem(
      siblings.map((x) => ({ id: x.id, slug: x.slug, exam_label: x.label, no: x.no, explained: true })),
      itemId,
      () => true,
      seen,
    )
    // 기출 탐구에서 왔으면(backTo=browse · backHref = 검증된 서가 주소) 다음 문항도 같은 조건(ret)을 이어 간다(v3 M1)
    const ret = backTo === 'browse' ? `?ret=${encodeURIComponent(backHref)}` : ''
    return pick ? { href: `/csat/item/${pick.item.slug}${ret}`, label: `${pick.item.exam_label} ${pick.item.no}번`, revisit: pick.revisit } : null
  }, [seen, next, siblings, itemId, backTo, backHref])
  const done =
    finished && session ? (
      <SessionDone
        session={session}
        result={committed && !isSkipPrediction(committed) && mine && !withheld && revealed ? grade(mine, gate) : null}
        next={nextLive}
        typeHref={typeHref}
        now={Date.now()}
        reviewDays={doneReviewDays}
        onReview={review}
        onRestart={restart}
      />
    ) : null
  const step = steps[cursor] ?? null
  // 레일 차례는 오답 번호를 지운 키를 들고 있다(maskDisclosureSteps) — 재생 중이면 받은 cue 의 실제 대상으로 맞춘다
  const rawLiveKey = lec?.activeKey && (lec.status === 'playing' || lec.status === 'paused') ? blockKeyForTarget(lec.activeKey, blockKeys) : step ? blockKeyForTarget(step.targetKey, blockKeys) : null
  // 동의 전에는 경계 뒤 차례 · 정답을 확정하는 블록을 강조하지 않는다(D6-02)
  const liveKey = withheld && stopAt != null && cursor >= stopAt && !(lec?.status === 'playing' || lec?.status === 'paused') ? null : gatedLiveKey(rawLiveKey, blocks, answerGate)
  // 동의 전 화면 — 정답 칩 · 정답 근거 · 오답 소거 블록은 자리표시만(D6-01 화면 미표시. 첫 HTML · props 의 지연 조회는 (b))
  const shownBlocks = gateBlocks(blocks, answerGate)
  const sceneBlocks = shownBlocks.filter((b) => sceneOfBlock(b.kind) === scene)
  const sceneChecks = checks.filter((c) => sceneOfCheck(c.kind) === scene)
  // 동의 전 정답 · 소거를 다루는 다른 패널(판단 · 오답 설계 · 이해 확인 · 비교)도 같은 자리표시로 — 장면을 여는 것은 동의가 아니다(r4 R4-01 · R4-03)
  // 성공(서버가 노출 원장을 커밋하고 공개 자료를 돌려줌)이면 true — 정답이 담긴 강의(전체 · 경계 계속)는 true 를 받은 뒤에만 튼다(R147-03)
  const requestReveal = async (source: 'judgment_scene' | 'lecture_full' | 'lecture_continue'): Promise<boolean> => {
    if (revealed) {
      setAnswerConsent(true)
      return true
    }
    if (revealState === 'pending') return false
    setRevealState('pending')
    try {
      const res = await fetch(`/api/csat/item/${toItemSlug(itemId)}/judgment`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        // tool — 화면에 D 판단 도구가 있으면 그 결속(라우트가 지금 결속과 대조), 없으면 null(도구 없는 정상 공개 · T-0161 r2)
        body: JSON.stringify({ analysisVersion, clientExposureId: crypto.randomUUID(), source, tool: judgmentItem ? { analysisVersion: judgmentItem.version.analysisVersion, unitsHash: judgmentItem.version.unitsHash } : null }),
      })
      const body = (await res.json().catch(() => null)) as { ok?: boolean; reveal?: AnswerReveal } | null
      if (!res.ok || !body?.ok || !body.reveal) throw new Error(String(res.status))
      // 강의(전체 · 경계 계속)로 연 경우는 포커스 요청을 남기지 않는다(T-0140)
      pendingRevealFocus.current = source === 'judgment_scene'
      setRevealed(body.reveal)
      setAnswerConsent(true)
      setRevealState('idle')
      // 판단 장면에서 학습자가 누른 「정답 보기」 — 누른 단추가 사라지므로 포커스를 공개된 정답 근거 제목으로 옮긴다(문서 밖으로 빠지지 않게).
      // 실제 이동은 revealed 커밋 뒤 useLayoutEffect 가 한다. 강의(전체 · 경계 계속)로 연 경우는 옮기지 않는다(강의 진행이 포커스를 가져가지 않는 계약)
      return true
    } catch {
      // 기록 실패 · 판본 변경 · 보류 — 정답을 보이지 않는다(서버도 보내지 않았다)
      setRevealState('failed')
      return false
    }
  }
  const revealButton = (
    <>
      <button type="button" className={styles.back} onClick={() => void requestReveal('judgment_scene')} disabled={revealState === 'pending'} data-testid="answer-reveal">
        {revealState === 'pending' ? '정답을 여는 중…' : '정답 보기'}
      </button>
      {revealState === 'failed' ? (
        <p className="break-keep" role="status" data-testid="answer-reveal-failed">
          지금은 정답을 열 수 없어요. 잠시 뒤 다시 눌러 주세요.
        </p>
      ) : null}
    </>
  )
  const withheldPanel = (id: string, title: string) => (
    <section key={id} className={styles.block} data-withheld="true" data-testid={`withheld-${id}`} aria-label={title}>
      <h2>{title}</h2>
      <p className="break-keep">{withheld ? '「정답 직접 안내 전까지」 를 골라 정답 · 오답을 정하는 내용은 아직 감춰 두었어요.' : '정답 · 오답을 정하는 내용이라 정답을 요청한 뒤에 보여요. 열면 「정답을 본 뒤」 로 기록돼요.'}</p>
      {revealButton}
    </section>
  )
  const renderBlock = (b: TheaterBlock & { withheld?: boolean }) =>
    b.withheld ? (
      <article key={b.key} data-block={b.key} data-kind={b.kind} data-withheld="true" data-live={false} className={styles.block}>
        <h2>{b.title}</h2>
        <p className="break-keep">「정답 직접 안내 전까지」 를 골라 정답을 정하는 설명은 아직 감춰 두었어요.</p>
        {revealButton}
      </article>
    ) : (
    <article key={b.key} data-block={b.key} data-lecture-target={b.key} data-kind={b.kind} data-live={b.key === liveKey} className={styles.block}>
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
      <EvidenceQuote passage={currentPassage} quote={b.quote} truncated={b.quoteTruncated} />
    </article>
  )

  // 강의가 다른 장면의 블록을 설명해도 장면을 저절로 바꾸지 않는다 — 장면을 바꾸면 학습자가 고른 의미 · 구절이 지워진다.
  // 그 장면으로 갈지는 학습자가 고른다(강의는 계속 흐르고, 아래 안내 단추로 옮긴다)
  const liveBlockKind = liveKey ? blocks.find((b) => b.key === liveKey)?.kind : undefined
  const lectureScene = lec && (lec.status === 'playing' || lec.status === 'paused') && liveBlockKind ? sceneOfBlock(liveBlockKind) : null
  const lectureElsewhere = lectureScene && lectureScene !== scene ? SCENES.find((x) => x.id === lectureScene) ?? null : null
  const offerRef = useRef<HTMLDivElement | null>(null)
  // 안내 줄은 학습자가 재생을 한 번이라도 시작한 뒤에만 선다 — 읽기 강의 탭의 대본 불러오기(loading → idle)나
  // 불러오기 실패(error)로는 줄이 끼었다 빠지지 않는다
  const [lectureStarted, setLectureStarted] = useState(false)
  useEffect(() => {
    if (lec?.status === 'playing') setLectureStarted(true)
  }, [lec?.status])

  const [chooser, setChooser] = useState<{ from: number; byLearner: boolean } | null>(null)
  const [untilFailed, setUntilFailed] = useState(false)
  const [atBoundary, setAtBoundary] = useState(false)
  const chooserRef = useRef<HTMLHeadingElement | null>(null)
  const boundaryRef = useRef<HTMLHeadingElement | null>(null)
  // 정답 없이 강의를 마쳤다는 안내(aria-live) — 동의가 아니다
  const [boundaryNote, setBoundaryNote] = useState<'closed' | null>(null)
  // 경계가 첫 cue 이면 들을 것이 없다 — 이 경로를 내주지 않는다
  const untilOk = stopAt != null && stopAt > 0 && !untilFailed
  const untilFrom = (from: number) => (stopAt != null ? Math.min(from, Math.max(0, stopAt - 1)) : from)
  const requestPlay = (from: number) => {
    if (!lec) return
    if (lecturePath === 'full') return lec.start(from, 'start', 'full')
    if (lecturePath === 'until' && untilOk) return lec.start(untilFrom(from), 'start', 'until')
    setChooser({ from, byLearner: true })
  }
  const choosePath = (p: 'self' | 'full' | 'until') => {
    const from = chooser?.from ?? 0
    setChooser(null)
    setAtBoundary(false)
    setBoundaryNote(null)
    // 「전체(정답 포함)」 는 정답 공개 동의다 — 노출 원장 기록이 성공한 뒤에만 경로를 정하고 강의를 받는다. 실패하면 다시 고르게 둔다(R147-03)
    if (p === 'full') {
      void requestReveal('lecture_full').then((ok) => {
        if (!ok) return setChooser({ from, byLearner: false })
        setLecturePath('full')
        lec?.start(from, 'start', 'full')
      })
      return
    }
    setLecturePath(p)
    if (p === 'until') setAnswerHide(true)
    // 경계 뒤에 서 있던 차례는 경계 앞으로 — 고른 순간 정답 블록이 강조되지 않게
    if (p === 'until' && stopAt != null && cursor >= stopAt && !playing) setCursor(Math.max(0, stopAt - 1))
    if (!lec || p === 'self') return
    if (p === 'until') lec.start(untilFrom(from), 'start', 'until')
  }
  // 포커스는 학습자가 연 경우에만 옮긴다 — 강의가 경계에 닿거나 서버가 거절해 열린 안내는 aria-live 로만 알린다(T-0140 Codex P2)
  // 닫힐 때(Escape · 「닫기」 · 경로 선택) 포커스는 선택을 연 단추로 돌아간다. 그 단추가 사라졌으면 머리 줄 재생 단추, 그것도 없으면 극장 자체(T-0152 r3)
  const chooserOpenerRef = useRef<HTMLElement | null>(null)
  const chooserWasOpen = useRef(false)
  const playBtnRef = useRef<HTMLButtonElement | null>(null)
  const theaterRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (chooser?.byLearner) {
      const a = document.activeElement
      if (a instanceof HTMLElement && a !== document.body && !a.closest('[data-testid="lecture-chooser"]')) chooserOpenerRef.current = a
      chooserRef.current?.focus()
    }
    if (chooser) {
      chooserWasOpen.current = true
      return
    }
    if (!chooserWasOpen.current) return
    chooserWasOpen.current = false
    const opener = chooserOpenerRef.current
    chooserOpenerRef.current = null
    // 학습자가 연 선택이 아니었다면(경계 · 서버 거절) 포커스를 옮기지 않는다 — 단, 포커스가 사라진 선택 안에 있었으면 문서 밖으로 빠지지 않게 되돌린다
    const lost = !document.activeElement || document.activeElement === document.body
    if (!opener && !lost) return
    const target = [opener, playBtnRef.current, theaterRef.current].find((el): el is HTMLElement => Boolean(el && el.isConnected && el.getClientRects().length > 0))
    target?.focus()
  }, [chooser])
  useEffect(() => {
    if (lecturePath !== 'until' || !lec) return
    // 서버가 경계를 거절했다(결속 불일치 등) — 안전 구간을 추정하지 않고 다시 고르게 한다
    if (lec.status === 'error') {
      setUntilFailed(true)
      setLecturePath(null)
      setChooser({ from: 0, byLearner: false })
    }
    // 받은 범위(경계 직전)까지 다 들었다 — 넘을지는 학습자가 고른다
    if (lec.status === 'ended') setAtBoundary(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lec?.status, lecturePath])
  const continuePastBoundary = () => {
    setAtBoundary(false)
    setBoundaryNote(null)
    // 경계 뒤(정답 cue)는 노출 원장 기록이 성공한 뒤에만 받는다 — 실패하면 경계 안내를 다시 연다(R147-03)
    void requestReveal('lecture_continue').then((ok) => {
      if (!ok) return setAtBoundary(true)
      setLecturePath('full')
      if (lec && stopAt != null) lec.start(stopAt, 'start', 'full')
    })
  }

  const move = (delta: number) => {
    const to = Math.max(0, Math.min(steps.length - 1, cursor + delta))
    if (to === cursor) return
    // 경계 검사는 goto 한 곳에서 — 시작 전 · 일시정지 · 끝남 상태의 ←/→ · 이전/다음 차례도 경계를 넘지 못한다(D6-02)
    if (!(playing && lec) || boundaryGate(to, answerGate) === 'boundary') return goto(to)
    void (delta > 0 ? lec.next() : lec.prev())
  }
  const goto = (index: number) => {
    // 정답 직접 안내 전까지 고른 동안 — 경계 뒤 차례는 재생 · 일시정지 · 끝남 어느 상태에서도 넘을지 묻는다(건너뛰어 답을 듣게 하지 않는다).
    // 멈춤은 재생 중일 때만(pauseLecture) — 일시정지에서 toggle 하면 오히려 다시 튼다(T-0140 Codex r2 P2)
    if (boundaryGate(index, answerGate) === 'boundary') {
      pauseLecture()
      setAtBoundary(true)
      return
    }
    if (playing && lec) lec.start(index, 'cue')
    else setCursor(index)
  }


  // 읽기 강의 탭을 열면 대본을 불러온다(재생하지 않는다) — 음성이 없어도 같은 설명을 읽는다
  useEffect(() => {
    // 읽기 강의 탭도 같은 공개 경로를 따른다 — 고른 범위만 불러온다. 고르기 전에는 탭 안의 「어떻게 볼지 고르기」 로 묻는다
    if (tab === 'script' && lec && !lec.cues.length && lec.status === 'idle' && (lecturePath === 'full' || lecturePath === 'until')) lec.load(lecturePath)
  }, [tab, lec, lecturePath])

  useEffect(() => {
    // 재생 중 학습자가 스스로 스크롤해 따라가기를 껐으면 차례 줄도 화면을 끌고 가지 않는다
    if (lec?.status === 'playing' && !lec.following) return
    railRef.current?.querySelector('[data-state="live"]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const tag = t?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return
      // 기출 원문 폭 손잡이 위의 ←/→ 는 폭 조절이다
      if (t?.getAttribute('role') === 'separator') return
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return
      if (e.key === ' ') {
        // 단추 위의 Space 는 그 단추의 일이다
        if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY' || !lec) return
        e.preventDefault()
        if (lec.status === 'idle' || lec.status === 'error') requestPlay(cursor)
        else lec.toggle()
        return
      }
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
  // 지금 차례가 강의에서 놓인 **추정 위치**(앞 차례 추정 초의 합) — 실제로 들은 시간이 아니다(F13).
  // 중간 시작 · 반복 · 배속 · 멈춤은 이 값을 바꾸지 않는다. 실제 청취는 LectureStage 의 heard 가 센다.
  const position = timeline.segments.slice(0, cursor).reduce((sum, s) => sum + s.sec, 0)

  // ── 작업공간 W1~W3: 원문 열 → 메인 프레임(근거·관계 판 + 설명·판단 판) → 하단 탐구 도크 ───────────────
  const group = groupOf(scene)
  const sceneDef = SCENES.find((x) => x.id === scene)
  // 근거·관계 판의 「관계」 보기 — 이 장면에 검수된 설계 도식이 있을 때만(없으면 지도 · 빈 상태). 관계선을 새로 만들지 않는다
  const relation =
    !gate.design ? null
      // FINAL §6 ⑤ — 구조 도식을 바로 보이지 않고 먼저 예측하게 한다(서버 대조 뒤 도식). 예측 없이 보기도 된다
      : scene === 'meaning' ? <StructurePredict key={itemId} slug={toItemSlug(itemId)} design={gate.design} sentenceCount={map ? map.sentences.length : null} />
        : scene === 'judgment' ? <TransformDiagram design={gate.design} />
          : scene === 'design' ? <DesignSelection design={gate.design} />
            : null
  const showRelation = Boolean(relation && evidenceView === 'relation')
  // 지도에 비출 근거 — 이해 확인에서 학습자가 누른 위치 확인이 먼저(지도 문장 수와 다시 대조), 원문 이해는 v3.1 의미 대조,
  //   그 밖은 검수된 v3 근거(분할이 같을 때만). 위치 확인 키는 v3 근거로 비추지 않는다(문장 수가 다르면 아무것도 비추지 않는다)
  const checkFocus = checkLocateFocus(evidence, map ? map.sentences.length : null)
  const v3Evidence = evidence && !isCheckLocateKey(evidence.key) ? evidence : null
  const mapFocus = checkFocus ?? (msActive ? (msMapOk && msSpeak.length ? msSpeak.map((n) => n - 1) : msMapOk && !msChip && msFocus.length ? msFocus.map((n) => n - 1) : null) : v3Linkable && v3Evidence ? v3Evidence.sentences.map((n) => n - 1) : null)
  const focusSummary = checkFocus ? checkFocus.map((n) => n + 1) : msActive ? (msMapOk && msFocus.length ? msFocus : []) : v3Linkable && v3Evidence ? v3Evidence.sentences : []
  // 이해 확인 「선택한 N번 문장 지도에서 보기」 — 명시적으로 누를 때만. 감춘 지도 · 없는 지도 · 문장 수 불일치 · 범위 밖이면 비추지 않는다.
  //   관계 보기였거나 판을 접어 뒀으면 지도로 되돌려 연다. 기록(onRecord) · 시도 수는 건드리지 않는다
  const locateCheck = (sentence: number, sentenceCount: number) => {
    if (withheld || !map) return false
    const k = resolveCheckLocate(map.sentences.length, sentenceCount, sentence)
    if (k == null) return false
    setEvidence({ sentences: [k + 1], key: checkLocateKey(sentenceCount) })
    setEvidenceCollapsed(false)
    setEvidenceView('map')
    return true
  }
  const evidenceLabel = focusSummary.length ? `${focusSummary.join(' · ')}번 문장` : '고른 근거 없음'
  // 하단 도크 · 다음 장면 — 학습자의 직접 선택이 강의의 자동 따라가기보다 먼저다(재생 중이면 멈춘다 · 재개는 학습자가)
  const pickScene = (id: SceneId) => {
    setTab('analysis')
    if (lec && lec.status === 'playing') lec.toggle()
    else if (lec && lec.status === 'loading') holdLecture.current = true
    if (id !== scene) selectScene(id)
  }
  const toolTabs = TABS.filter((t) => t.id !== 'analysis')
  const openTool = (id: TabId) => {
    if (tab === 'analysis') explainScroll.current = blocksRef.current?.scrollTop ?? 0
    setTab(tab === id ? 'analysis' : id)
  }

  return (
    <div className={styles.workspace} data-csat-theater data-testid="analysis-theater" ref={theaterRef} tabIndex={-1}>
      {/* ── 문항 머리: ← · 회차/번호/유형 · 학습 지도/목록 복귀 · 강의 도구 ─────────────── */}
      <header className={styles.bar}>
        <Link className={styles.backIcon} href={backHref} onClick={back(backTo)} data-testid="item-back-home" data-back={backTo} aria-label={backTo === 'browse' ? '기출 탐구 — 고른 조건으로' : '내 학습 지도'}>
          <ChevronLeft size={16} aria-hidden />
        </Link>
        <h1 className={styles.docTitle}>{title}</h1>
        {typeName ? <span className={styles.tag}>{typeName}</span> : null}
        {points ? <span className={styles.tag}>{points}점</span> : null}
        <nav className={styles.crumbs} aria-label="목록으로">
          {finderBack ? (
            <Link className={styles.back} href={finderBack} data-testid="item-finder-back">
              찾기 전 문항으로
            </Link>
          ) : null}
          {mapReturn ? (
            <Link className={styles.back} href={mapReturn} data-testid="item-back-map">
              학습 지도로
            </Link>
          ) : null}
          {typeHref ? (
            <Link className={styles.back} href={typeHref} onClick={back('type')} data-testid="item-back-type">
              이 유형 목록
            </Link>
          ) : null}
          <Link className={styles.back} href="/csat/browse" onClick={back('browse')} data-testid="item-back-browse">
            서가
          </Link>
        </nav>
        {finder ? (
          <button type="button" className={finderStyles.trigger} onClick={() => openFinder('item')} aria-haspopup="dialog" data-testid="item-finder-open-btn">
            <span className={finderStyles.triggerFace}><Search size={14} aria-hidden />
            기출 찾기</span>
          </button>
        ) : null}
        {/* 강의 도구 — 재생 · 속도 · 대본 · 진행(차례) · 같은 유형. 분석 장면을 강의 진행에 묶지 않는다 */}
        <div className={styles.barRight} role="group" aria-label="강의 도구" data-testid="lecture-tools">
          {toolTabs.map(({ id, label, Icon }) => (
            <button key={id} type="button" className={styles.toolBtn} aria-pressed={tab === id} onClick={() => openTool(id)} data-testid={`tool-${id}`}>
              <Icon size={13} aria-hidden /> {label}
            </button>
          ))}
          <button type="button" className={styles.iconBtn} onClick={sfx.toggle} aria-pressed={sfx.on} title="효과음" aria-label="효과음">
            {sfx.on ? <Volume2 size={15} aria-hidden /> : <VolumeX size={15} aria-hidden />}
          </button>
          {lec ? (
            <button
              type="button"
              className={styles.rate}
              onClick={() => lec.setRate(RATES[(RATES.indexOf(lec.rate as (typeof RATES)[number]) + 1) % RATES.length])}
              title="말하기 속도"
              aria-label={`말하기 속도 ${lec.rate.toFixed(2).replace(/0$/, '')}배`}
            >
              {lec.rate.toFixed(2).replace(/0$/, '')}×
            </button>
          ) : null}
          {lec ? (
            <button
              ref={playBtnRef}
              type="button"
              className={styles.play}
              onClick={() => (status === 'idle' || status === 'error' ? requestPlay(cursor) : lec.toggle())}
            >
              <MainIcon size={15} aria-hidden /> {mainLabel}
            </button>
          ) : null}
        </div>
      </header>
      {chooser && lec ? (
        <section
          className={styles.lectureChooser}
          aria-labelledby="lecture-chooser-h"
          data-testid="lecture-chooser"
          onKeyDown={(e) => {
            // Escape = 「닫기」(강의를 시작하지 않고 선택만 접는다) — 극장 전역 단축키로 새지 않게 여기서 멈춘다
            if (e.key !== 'Escape') return
            e.stopPropagation()
            setChooser(null)
          }}
        >
          <h2 id="lecture-chooser-h" ref={chooserRef} tabIndex={-1} className={styles.chooserTitle}>
            강의를 어떻게 볼까요?
          </h2>
          <p className={styles.chooserNote}>
            강의는 정답과, 정답을 좁히는 단서를 말해요.{untilFailed ? ' 이 강의는 지금 정답 공개 지점을 확인하지 못해 전체 강의만 들을 수 있어요.' : ''}
          </p>
          <div className={styles.chooserRow}>
            <button type="button" className={styles.lectureOfferBtn} onClick={() => choosePath('self')} data-testid="lecture-path-self">
              원문부터 직접 분석
            </button>
            <button type="button" className={styles.lectureOfferBtn} onClick={() => choosePath('full')} data-testid="lecture-path-full">
              전체 해설 강의 듣기(정답 포함)
            </button>
            {untilOk ? (
              <button type="button" className={styles.lectureOfferBtn} onClick={() => choosePath('until')} aria-describedby="lecture-until-note" data-testid="lecture-path-until">
                정답 직접 안내 전까지 듣기
              </button>
            ) : null}
            <button type="button" className={styles.lectureOfferBtn} onClick={() => setChooser(null)} data-testid="lecture-path-cancel">
              닫기
            </button>
          </div>
          <p id="lecture-until-note" className={styles.chooserNote} data-testid="lecture-until-note">
            {untilOk && lectureDisclosure?.verified
              ? preStopNotice(lectureDisclosure.preStopRisk)
              : '이 강의는 정답 공개 지점이 검증되지 않아 「정답 직접 안내 전까지」 를 고를 수 없어요.'}
          </p>
        </section>
      ) : null}
      {atBoundary && lec ? (
        <section className={styles.lectureChooser} aria-labelledby="lecture-boundary-h" data-testid="lecture-boundary">
          <h2 id="lecture-boundary-h" ref={boundaryRef} tabIndex={-1} className={styles.chooserTitle}>
            다음 부분에서 정답을 직접 말해요
          </h2>
          <div className={styles.chooserRow}>
            <button type="button" className={styles.lectureOfferBtn} onClick={continuePastBoundary} data-testid="lecture-boundary-continue">
              계속 듣기(정답 공개)
            </button>
            <button type="button" className={styles.lectureOfferBtn} onClick={() => {
                pauseLecture()
                setAtBoundary(false)
              }}
              data-testid="lecture-boundary-stop">
              여기서 멈춤
            </button>
            <button
              type="button"
              className={styles.lectureOfferBtn}
              onClick={() => {
                // R3 「건너뛰기」 = 정답 없이 강의를 마친다(2026-10-24 사용자 결정). 정답 구간으로 옮기지 않고, 정답 cue 를 받지도 틀지도 않으며,
                // 차례 · 강조 · 장면 · 스크롤 · 포커스를 바꾸지 않는다. 공개 동의가 아니다 — 정답을 들으려면 「계속 듣기(정답 공개)」 를 따로 고른다(D6-03)
                pauseLecture()
                setAtBoundary(false)
                setBoundaryNote('closed')
              }}
              data-testid="lecture-boundary-skip"
            >
              정답 없이 강의 마치기
            </button>
            <button
              type="button"
              className={styles.lectureOfferBtn}
              onClick={() => {
                pauseLecture()
                setAtBoundary(false)
                setLecturePath('self')
                document.querySelector<HTMLElement>('[data-testid="workspace-paper"]')?.focus()
              }}
              data-testid="lecture-boundary-self"
            >
              원문 분석으로
            </button>
          </div>
        </section>
      ) : null}
      {/* 강의 안내 줄 — 학습자가 강의를 한 번 시작한 뒤로는 끝나도 같은 자리 · 같은 높이로 남는다
          (재생 시작 = 학습자 동작으로 한 번 생기고, 강의 진행 · 종료로는 끼었다 빠지며 본문을 밀지 않는다).
          따라가기 단추는 사라지지 않고 켜짐/꺼짐만 바뀐다 — 라벨은 고정, 상태는 aria-pressed 하나로 */}
      {lec && lectureStarted ? (
        <div className={styles.lectureOffer} data-testid="lecture-offer" ref={offerRef} tabIndex={-1}>
          <button
            type="button"
            className={styles.lectureOfferBtn}
            aria-pressed={lec.following}
            onClick={lec.following ? lec.unfollow : lec.follow}
            data-testid="lecture-offer-follow"
          >
            설명 위치 따라가기
          </button>
          {lectureElsewhere ? (
            <button
              type="button"
              className={styles.lectureOfferBtn}
              onClick={() => {
                selectScene(lectureElsewhere.id)
                // 누른 단추는 장면이 바뀌면 사라진다 — 포커스를 안내 줄에 남긴다
                offerRef.current?.focus()
              }}
              data-testid="lecture-offer-scene"
            >
              강의는 지금 「{lectureElsewhere.label}」 장면을 설명하고 있어요 · 그 장면 보기
            </button>
          ) : null}
        </div>
      ) : null}
      {/* 장면이 갈릴 때만 알린다(큐마다 읽지 않는다) — 알림 영역은 처음부터 문서에 있어야 첫 변경도 읽힌다 */}
      {lec ? (
        <span className={styles.srOnly} aria-live="polite">
          {atBoundary ? '정답을 직접 말하기 직전에서 멈췄어요. 계속 들을지 고르세요' : boundaryNote === 'closed' ? '정답을 듣지 않고 강의를 마쳤어요. 정답은 계속 감춰 둡니다' : lectureElsewhere ? `강의가 「${lectureElsewhere.label}」 장면을 설명하고 있어요` : ''}
        </span>
      ) : null}

      <div className={styles.body} ref={bodyRef}>
        {/* ── 원문 열: 기출문제 원본(기기 문제지) + 문항 행동 줄 ───────────────── */}
        <aside className={styles.rail} aria-label="기출문제 원본" data-testid="workspace-paper">
          <PaperResizer bodyRef={bodyRef} />
          <p className={styles.railTop}>
            <FileText size={13} aria-hidden />
            <b>기출문제 원본</b>
            <span className={styles.railTime}>{examLabel}</span>
          </p>
          <div className={styles.stream}>
            <ItemPaper key={itemId} catalog={paper.catalog} examId={paper.examId} no={paper.no} onPassageChange={setQuotePassage} highlight={msPaperMark} mark={paperMarkReq} />
          </div>
          {/* 문항 단위 행동 — 「마치기」 는 열람 종료이지 이해 판정이 아니다 */}
          <div className={styles.itemActions} data-testid="workspace-actions">
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
            <div className={styles.itemActionRow}>
              {session && !finished ? (
                <button type="button" className={styles.finishBtn} onClick={finish} data-testid="finish-item">
                  이 문항 마치기
                </button>
              ) : null}
              {finished ? (
                <span className={styles.resume} data-testid="finished-badge">
                  마친 문항
                </span>
              ) : null}
              {nextLive ? (
                <Link href={nextLive.href} data-testid="next-item" data-revisit={nextLive.revisit}>
                  {nextLive.revisit ? `이 유형을 다 봤어요 · ${nextLive.label} 다시 보기` : '같은 유형 다음 문항'}
                </Link>
              ) : (
                <Link href={typeHref ?? '/csat/browse'}>이 유형 목록</Link>
              )}
            </div>
          </div>
        </aside>

        {/* ── 메인 작업 프레임 ─────────────────────────────── */}
        <section className={styles.main} data-testid="workspace-frame" data-scene={scene} data-group={group.id}>
          <div className={styles.frameHead} data-testid="workspace-head">
            <p className={styles.frameCrumb}>
              <span>{group.label}</span>
              {sceneDef && sceneDef.label !== group.label ? (
                <>
                  <span aria-hidden>/</span>
                  <b>{sceneDef.label}</b>
                </>
              ) : null}
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
            {evidenceCollapsed ? (
              <p className={styles.frameEvidence} data-testid="evidence-summary">
                근거: {evidenceLabel}
              </p>
            ) : null}
            <button
              type="button"
              className={styles.toolBtn}
              aria-pressed={evidenceCollapsed}
              onClick={() => {
                if (!evidenceCollapsed) stashScene()
                else pendingScroll.current = { explain: blocksRef.current?.scrollTop ?? 0, evidence: sceneMem.current.get(memKey(scene))?.evScroll ?? 0 }
                setEvidenceCollapsed((v) => !v)
              }}
              data-testid="evidence-toggle"
            >
              {evidenceCollapsed ? <PanelLeftOpen size={13} aria-hidden /> : <PanelLeftClose size={13} aria-hidden />} {evidenceCollapsed ? '근거 판 열기' : '근거 판 접기'}
            </button>
          </div>

          {judgmentItem ? (
            // 판단 장면 하나를 통째로 — 도구 자체가 원문 증거면 + 판단면을 가진다. key = 문항 · 판본(이전 선택 · 해설이 넘어가지 않게).
            // 다른 장면에서는 숨긴 채 유지한다 — 장면 왕복이 학습자 선택 · 스크롤을 지우지 않게(T-0140 학습자 제어)
            <section className={styles.judgmentTool} hidden={scene !== 'judgment'} aria-label="유형 판단 도구" data-testid="judgment-tool-d" data-item={judgmentItem.id} data-analysis-version={judgmentItem.version.analysisVersion}>
              <TypeJudgment key={`${judgmentItem.id}@${judgmentItem.version.analysisVersion}:${judgmentItem.version.unitsHash}`} item={judgmentItem} reveal={judgmentReveal} stages={['first']} />
            </section>
          ) : null}
          <div className={styles.panes} data-collapsed={evidenceCollapsed}>
            {/* ── 근거·관계 판: 선택한 근거의 위치 · 관계 ── */}
            {!evidenceCollapsed ? (
              <section className={styles.pane} aria-label="근거·관계" data-testid="pane-evidence" data-view={showRelation ? 'relation' : 'map'}>
                <div className={styles.paneHead}>
                  <Code2 size={13} aria-hidden />
                  <span className={styles.file}>근거·관계</span>
                  {relation ? (
                    <span className={styles.viewSwitch} role="group" aria-label="근거 판 보기">
                      <button type="button" aria-pressed={!showRelation} onClick={() => setEvidenceView('map')} data-testid="evidence-view-map">
                        위치
                      </button>
                      <button type="button" aria-pressed={showRelation} onClick={() => setEvidenceView('relation')} data-testid="evidence-view-relation">
                        관계
                      </button>
                    </span>
                  ) : null}
                  <em>{map ? `${map.sentences.length}문장` : '지도 없음'}</em>
                </div>
                {/* 스크롤 판은 키보드로도 닿아야 한다(axe scrollable-region-focusable · T-0181) — 지도가 감춰져 포커스할 것이 없을 때도 */}
                <div className={styles.paneBody} ref={evidencePaneRef} tabIndex={0} role="region" aria-label="근거·관계 내용">
                  {session === undefined ? <p className={styles.quiet} aria-busy="true">기록을 확인하는 중…</p> : null}
                  {done}
                  {diff}
                  {withheld ? (
                    <p className={styles.quiet} data-testid="map-withheld">
                      지문 지도는 정답 근거 · 오답 위치를 표시해 「정답 직접 안내 전까지」 동안 감춰 두었어요. 오른쪽 「정답 보기」 로 펼칠 수 있어요.
                    </p>
                  ) : showRelation ? (
                    relation
                  ) : map ? (
                    <PassageMap
                      sentences={map.sentences}
                      anchors={map.anchors}
                      placements={map.placements}
                      focusSentences={mapFocus}
                      onSelect={msActive ? () => { setMsChip(true); setMsPhrase(null) } : undefined}
                      onSentenceSelect={msActive && msMapOk ? onMapSentence : undefined}
                    />
                  ) : (
                    <p className={styles.quiet}>이 문항은 지문 골격을 구하지 못해 지도가 없어요. 설명은 오른쪽에서 그대로 읽을 수 있어요.</p>
                  )}
                  {scene === 'meaning' ? (
                    <p className="break-keep text-[13px] text-[var(--t2)]" data-testid="structure-hint">
                      {map
                        ? '지도에서 문장을 골라 실제 의미와 범위를 확인하세요. 역할 라벨은 의미를 대조하는 도구이고, 문장 길이는 위치를 보여 줄 뿐 중요도가 아닙니다.'
                        : '이 문항은 지문 골격을 구하지 못해 지도가 없어요. 오른쪽 설명과 다른 장면의 분석은 그대로 읽을 수 있어요.'}
                    </p>
                  ) : null}
                  <p className={styles.legend}>
                    <span className={styles.legendAnswer}>정답 근거</span>
                    <span className={styles.legendReject}>오답 지우는 자리</span>
                  </p>
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
            ) : null}

            {/* ── 설명·판단 판: 지금 장면의 의미 · 판단 설명(또는 강의 도구의 보조 보기) ── */}
            <section className={styles.pane} aria-label={tab === 'analysis' ? '설명·판단' : '강의 도구'} data-testid="pane-explain">
              <div className={styles.paneHead}>
                <Terminal size={13} aria-hidden />
                <span className={styles.file}>{tab === 'analysis' ? sceneDef?.label ?? '설명' : TABS.find((t) => t.id === tab)?.label}</span>
                {tab === 'analysis' ? (
                  <em>요점 → 근거 → 상세</em>
                ) : (
                  <button type="button" className={styles.paneBack} onClick={() => setTab('analysis')} data-testid="tool-close">
                    탐구로 돌아가기
                  </button>
                )}
              </div>

              {tab === 'analysis' ? (
                <div className={`${styles.paneBody} ${styles.blockPane}`} ref={blocksRef}>
                  {evidenceCollapsed ? done : null}
                  {evidenceCollapsed ? diff : null}
                  <h2 className={styles.sceneQuestion} data-testid="scene-question">
                    {sceneDef?.question}
                  </h2>
                  {/* 동의 전(「정답 직접 안내 전까지」) — 문항 분석 장면은 허용 목록만 그린다. 판단 · 설계 · 지도 · 원리 · 정리 · 과제 · 비교는
                      정답 · 소거를 담을 수 있어 장면마다 막는 대신 통째로 감춘다(T-0140 r4 · r5). 유형 단위 탐구 질문만 남긴다 */}
                  {withheld ? (
                    <>
                      {scene === 'task' && goal ? (
                        <section className={styles.goal} aria-label="이 문항에서 탐구할 질문" data-testid="learning-goal">
                          <b>이 문항에서 확인할 관계</b>
                          <p className="break-keep">{goal.relation}</p>
                        </section>
                      ) : null}
                      {withheldPanel('scene', sceneDef?.label ?? '분석')}
                    </>
                  ) : (
                    <>
                  {scene === 'task' && goal ? (
                    <section className={styles.goal} aria-label="이 문항에서 탐구할 질문" data-testid="learning-goal">
                      <b>이 문항에서 확인할 관계</b>
                      <p className="break-keep">{goal.relation}</p>
                      {distractorsAreTrue(typeId, itemId) ? (
                        <p className="break-keep">
                          이 유형은 <em>정답으로 고를 선지</em>와 <em>내용이 맞는 선지</em>가 다릅니다 — 비선정 선지의 설명은 「왜 맞는 말인가」입니다.
                        </p>
                      ) : null}
                      {goal.visual ? (
                        <p className="break-keep">수치 판단은 원본 도표를 직접 읽어야 확정됩니다. 도표를 못 보면 계산 방법만 확인하세요.</p>
                      ) : null}
                    </section>
                  ) : null}
                  {/* T-0145 판단 도구(2026-34 · Interactive34) — 정답 공개(판단 라우트 · 노출 원장 기록 뒤 revealed)일 때만 answerRevealed. 공개 전에는 도구가 안내만 그리고, v3 본문은 첫 응답에 없다(answer-split) */}
                  {v3 && (scene === 'task' || keepTools) ? (
                    <div style={{ display: scene === 'task' ? 'contents' : 'none' }} data-tool-scene="task">
                      <V3Task v3={v3} answerRevealed={Boolean(revealed)} />
                    </div>
                  ) : null}
                  {scene === 'meaning' && ms ? (
                    <MeaningSupportPanel
                      view={ms}
                      unitId={msUnit}
                      relationId={msRelation}
                      depth={msDepth}
                      draft={msUnit ? msDrafts[msUnit] ?? '' : ''}
                      notes={meaningNotes}
                      analysisVersion={inquiry?.analysis_version ?? null}
                      onSaveNote={saveMeaningNote}
                      pick={msPick}
                      phraseId={msPhrase}
                      textAlign={msText}
                      passage={msText.state === 'ok' ? currentPassage : null}
                      splitOk={Boolean(v3Linkable && ms.splitOk)}
                      onSelectUnit={pickMsUnit}
                      onSelectRelation={pickMsRelation}
                      onPhrase={pickMsPhrase}
                      onDepth={pickMsDepth}
                      onDraft={(t) => { if (msUnit) setMsDrafts((cur) => ({ ...cur, [msUnit]: t })) }}
                      onGo={goBridge}
                      onTrace={traceMs}
                      onSpeaking={setMsSpeak}
                    />
                  ) : null}
                  {scene === 'meaning' && v3 && !ms ? <V3Meaning v3={v3} onEvidence={onEvidence} linkable={v3Linkable} selectedKey={evidence?.key ?? null} answerRevealed={Boolean(revealed)} /> : null}
                  {scene === 'judgment' && v3 && withheld ? withheldPanel('judgment', '정답 판단') : null}
                  {v3 && !withheld && (scene === 'judgment' || keepTools) ? (
                    <div style={{ display: scene === 'judgment' ? 'contents' : 'none' }} data-tool-scene="judgment">
                      {/* 도구 선택은 인스턴스 안에 있다 — bridge 왕복이 지우지 않도록 「분석 revision · 단위」 별 인스턴스를 숨겨 유지한다(R152-01). 문항이 바뀌면 화면째 새로 그려지고, revision 이 바뀌면 키가 달라져 넘어가지 않는다 */}
                      {[null, ...bridgeUnits].map((u) => {
                        const active = (msBridgeFocus ? msUnit : null) === u
                        const unitObj = u && ms ? ms.units.find((x) => x.id === u) ?? null : null
                        const focus = u === null ? undefined : active ? msBridgeFocus : ms && unitObj ? { unitLabel: unitObj.labelKo, ...bridgeOf(ms, unitObj.id), onReturn: () => selectScene('meaning') } : undefined
                        return (
                          <div key={`${toolRev}:${u ?? 'plain'}`} style={{ display: active ? 'contents' : 'none' }} data-tool-instance={u ?? 'plain'}>
                            <V3Judgment v3={v3} onEvidence={onEvidence} linkable={v3Linkable} selectedKey={evidence?.key ?? null} focus={focus} answerRevealed={Boolean(revealed)} sourceUnitsHash={sourceUnitsHash ?? undefined} />
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                  {scene === 'design' ? (
                    <p className={styles.quiet} data-testid="design-epistemic">
                      아래는 관찰된 근거에서 분석자가 재구성한 설계 해석이에요 — 실제 출제 과정의 기록이 아닙니다.
                    </p>
                  ) : null}
                  {v3 && (scene === 'design' || keepTools) ? (
                    <div style={{ display: scene === 'design' ? 'contents' : 'none' }} data-tool-scene="design">
                      <V3Design v3={v3} onEvidence={onEvidence} linkable={v3Linkable} selectedKey={evidence?.key ?? null} focus={msBridgeFocus} answerRevealed={Boolean(revealed)} />
                    </div>
                  ) : null}
                  {relation && !showRelation && !evidenceCollapsed ? (
                    <p className={styles.quiet} data-testid="relation-hint">
                      이 장면의 설계 도식은 왼쪽 근거 판의 「관계」 보기에 있어요.
                    </p>
                  ) : null}
                  {relation && evidenceCollapsed ? relation : null}
                  <p className={styles.status}>
                    <span data-on={playing}>{playing ? 'LIVE' : 'READY'}</span>
                    {step ? `${step.kind} · ${Math.round(step.sec)}초` : '분석'}
                  </p>
                  {scene === 'judgment' && !revealed ? (
                    <section className={styles.block} data-testid="judgment-reveal" aria-label="정답 확인">
                      <h2>정답 확인</h2>
                      <p className="break-keep">정답과 오답을 가르는 설명은 직접 판단해 본 뒤 요청할 때 열려요. 열면 「정답을 본 뒤」 로 기록돼요.</p>
                      {revealButton}
                    </section>
                  ) : null}
                  {scene === 'judgment' ? (
                    <>
                      {sceneBlocks.filter((b) => b.kind !== 'reject').map(renderBlock)}
                      <section aria-label="다른 선택지가 요구를 충족하지 못하는 조건" id="judgment-options" data-testid="judgment-options">
                        {inquiry ? withheld ? withheldPanel('distractors', '오답 설계') : <DistractorDesign distractors={inquiry.distractors} review={inquiry.review} /> : null}
                        {sceneBlocks.filter((b) => b.kind === 'reject').map(renderBlock)}
                      </section>
                    </>
                  ) : (
                    sceneBlocks.map(renderBlock)
                  )}
                  {sceneChecks.length && withheld ? withheldPanel('checks', '이해 확인') : null}
                  {sceneChecks.length && !withheld ? (
                    <UnderstandingChecks key={`checks-${itemId}-${scene}`} itemId={itemId} checks={sceneChecks} saved={checked} review={isReviewPhase(session)} onRecord={recordCheck} onLocate={map ? locateCheck : undefined} />
                  ) : null}
                  {scene === 'compare' && (withheld || !revealed) ? withheldPanel('compare', '기출 비교') : null}
                  {scene === 'compare' && !withheld && revealed ? (
                    <V3CompareExplorer
                      key={`cmp-${itemId}`}
                      pairs={v3Pairs}
                      absence={pairAbsence === 'none' && comparePairs.length ? null : pairAbsence}
                      withheld={pairWithheld}
                      initialPairId={initialPairId}
                      currentSlug={currentSlug}
                      fromMap={Boolean(mapReturn)}
                      carry={carry}
                      returnTo={compareReturn}
                      onEvidence={onEvidence}
                      onClearEvidence={() => setEvidence((cur) => (cur && /^(pair|diff)-/.test(cur.key) ? null : cur))}
                      linkable={v3Linkable}
                      selectedKey={evidence?.key ?? null}
                      onFindOther={finder ? () => openFinder('compare') : undefined}
                    />
                  ) : null}
                  {scene === 'compare' && !withheld && revealed ? (
                    comparePairs.length ? (
                      <section aria-label="검수 전 1차 비교" data-testid="legacy-compare">
                        <p className="break-keep text-[13px] text-[var(--t2)]">아래는 v3 검수 전의 1차 비교 메모예요(문장 근거와 결속되지 않았어요).</p>
                        <ComparePairs pairs={comparePairs} compared={comparedWith} onCompared={recordCompare} carry={carry} />
                      </section>
                    ) : v3Pairs.length || pairAbsence ? null : (
                      <p className="break-keep text-[13px] text-[var(--t2)]" data-testid="compare-empty">
                        이 문항과 짝지은 검수된 비교 문항을 준비 중이에요. 같은 유형이라는 이유만으로 같은 원리라고 잇지 않아요 — 강의 도구의 「같은 유형」에서 목록은 볼 수 있어요.
                      </p>
                    )
                  ) : null}
                  {scene === 'principle' && inquiry?.principle ? <PrincipleDesign principle={inquiry.principle} review={inquiry.review} /> : null}
                  {scene === 'principle' ? <V3PrincipleLevels hasCandidate={Boolean(inquiry?.principle)} pairs={v3Pairs} /> : null}
                  {scene === 'principle' && goal ? (
                    <section className={styles.goal} aria-label="이 문항의 원리" data-testid="principle-scene">
                      <b>이 문항에서 확인한 관계</b>
                      <p className="break-keep">{goal.relation}</p>
                      <p className="break-keep">
                        이 문항 하나에서 얻은 잠정 원리예요. 다른 문항에도 통하는지는 성립 조건이 같을 때만입니다 — 「기출 비교」에서 검수된 사례로 경계를 확인하세요.
                      </p>
                      <button type="button" className={styles.back} onClick={savePrinciple} disabled={principleSaved} data-testid="principle-save">
                        {principleSaved ? '내 원리에 저장됨' : '이 원리 저장'}
                      </button>
                    </section>
                  ) : null}
                  {scene === 'explain' ? (
                    <SystemLearningSummary
                      key={`summary-${itemId}`}
                      summary={buildLearningSummary({
                        goal,
                        principle: inquiry?.principle ?? null,
                        rejects: withheld ? [] : blocks.filter((b) => b.kind === 'reject'),
                        choiceEvidence: v3Linkable ? v3?.choices : undefined,
                        checks,
                        checkScene: sceneOfCheck,
                        hasCompare: v3Pairs.length > 0,
                        hasLecture: Boolean(lec && steps.length),
                      })}
                      canKeep={Boolean(goal)}
                      kept={principleSaved}
                      onKeep={savePrinciple}
                      onGo={pickScene}
                      initialEvidenceKey={evidence?.key}
                      onShowEvidence={(sentences, key) => {
                        setEvidence(sentences.length ? { sentences, key } : null)
                        if (sentences.length) { setEvidenceCollapsed(false); setEvidenceView('map') }
                      }}
                      onLecture={() => setTab('script')}
                      historyState={session === undefined ? 'loading' : 'ready'}
                      history={
                        hasWrittenHistory({ explanations: explained.length, notes: notes.length }) ? (
                          <>
                            <SelfExplain saved={explained} />
                            <ReasoningNoteForm
                              analysisVersion={inquiry?.analysis_version ?? null}
                              principle={inquiry?.principle ?? null}
                              saved={notes}
                              showModel={false}
                              onShowEvidence={v3Linkable ? (sentences) => { setEvidence({ sentences, key: 'note-evidence' }); setEvidenceCollapsed(false); setEvidenceView('map') } : undefined}
                            />
                          </>
                        ) : null
                      }
                    />
                  ) : null}
                  {/* 정답을 받기 전에는 「설명이 없다」 가 아니라 감춘 것이다 — 판단 · 비교 장면 밖에서도 정답 요청 자리를 둔다 */}
                  {!revealed && !withheld && scene !== 'judgment' && scene !== 'compare' && !sceneBlocks.length && !sceneChecks.length ? withheldPanel('scene-pending', sceneDef?.label ?? '분석') : null}
                  {revealed && !sceneBlocks.length && !sceneChecks.length && !['compare', 'meaning', 'explain'].includes(scene) && !(scene === 'task' && goal) && !(scene === 'principle' && goal) ? (
                    <p className="break-keep text-[13px] text-[var(--t2)]" data-testid="scene-empty">
                      이 문항은 이 장면에 해당하는 검수된 설명이 아직 없어요. 다른 장면의 분석은 그대로 읽을 수 있어요.
                    </p>
                  ) : null}
                    </>
                  )}
                  {nextScene(scene) ? (
                    <button type="button" className={styles.back} onClick={() => pickScene(nextScene(scene)!)} data-testid="scene-next">
                      다음 장면 · {SCENES.find((x) => x.id === nextScene(scene))?.label} →
                    </button>
                  ) : null}
                </div>
              ) : null}

              {tab === 'script' ? (
                <div className={styles.paneBody} data-testid="reading-lecture">
                  {!lec || !steps.length ? (
                    <p className={styles.quiet}>이 문항은 아직 강의 대본이 없어요. 탐구 장면의 설명은 그대로 읽을 수 있어요.</p>
                  ) : lec.status === 'error' && !lec.cues.length ? (
                    <p className={styles.quiet} role="status">
                      대본을 불러오지 못했어요. 탐구 장면의 설명은 그대로 읽을 수 있어요.{' '}
                      <button type="button" className={styles.back} onClick={() => (lecturePath === 'full' || lecturePath === 'until' ? lec.load(lecturePath) : setChooser({ from: 0, byLearner: true }))}>
                        다시 불러오기
                      </button>
                    </p>
                  ) : !lec.cues.length && lecturePath !== 'full' && lecturePath !== 'until' ? (
                    // 공개 경로를 고르기 전에는 대본을 받지 않는다 — 읽기 강의도 정답을 말한다
                    <p className={styles.quiet}>
                      대본에는 정답과, 정답을 좁히는 단서가 있어요.{' '}
                      <button type="button" className={styles.back} onClick={() => setChooser({ from: 0, byLearner: true })} data-testid="script-choose">
                        어떻게 볼지 고르기
                      </button>
                    </p>
                  ) : !lec.cues.length ? (
                    <p className={styles.quiet} aria-busy="true">대본을 여는 중…</p>
                  ) : (
                    <ol className={styles.script}>
                      {lec.cues.map((c, i) => (
                        <li key={c.id} data-live={i === cursor}>
                          <button type="button" onClick={() => goto(i)} aria-current={i === cursor ? 'step' : undefined}>
                            <span className={styles.scriptNo}>{String(i + 1).padStart(2, '0')}</span>
                            <span className="break-keep">{c.text}</span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
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
                      <dt>추정 위치</dt>
                      <dd>{theaterClock(position)}</dd>
                    </div>
                    <div>
                      <dt>전체</dt>
                      <dd>{theaterClock(timeline.total)}</dd>
                    </div>
                  </div>
                  <p className={styles.runNav}>
                    <button type="button" className={styles.round} onClick={() => move(-1)} disabled={cursor === 0} aria-label="이전 차례">
                      <ChevronLeft size={15} aria-hidden />
                    </button>
                    <span className={styles.pill}>
                      {cursor + 1} / {Math.max(1, steps.length)} · 약 {theaterClock(position)} 지점
                    </span>
                    <button type="button" className={styles.round} onClick={() => move(1)} disabled={cursor >= steps.length - 1} aria-label="다음 차례">
                      <ChevronRight size={15} aria-hidden />
                    </button>
                  </p>
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
                          title={`${seg.kind} · ${label(seg.name)} · ${Math.round(seg.sec)}초`}
                          aria-label={`${seg.index + 1}단계 ${label(seg.name)} · ${Math.round(seg.sec)}초`}
                        />
                      ))}
                    </div>
                    <div className={styles.axis}>
                      {timeline.marks.map((m) => (
                        <span key={m}>{m}s</span>
                      ))}
                    </div>
                  </div>
                  <ol className={styles.runList} ref={railRef as RefObject<HTMLOListElement>}>
                    {timeline.segments.map((seg) => (
                      <li key={seg.index} data-state={seg.index === cursor ? 'live' : seg.index < cursor ? 'done' : 'wait'}>
                        <button type="button" onClick={() => goto(seg.index)} aria-current={seg.index === cursor ? 'step' : undefined}>
                          <span className={styles.runNo}>{String(seg.index + 1).padStart(2, '0')}</span>
                          <span className={styles.runKind}>{seg.kind}</span>
                          <span className={styles.runName}>{label(seg.name)}</span>
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
                        <Link href={`/csat/item/${s.slug}${backTo === 'browse' ? `?ret=${encodeURIComponent(backHref)}` : ''}`} aria-current={s.current ? 'page' : undefined} data-current={s.current}>
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

          {/* ── 하단 탐구 도크: 네 요소 · 일곱 장면(강의 큐 카드를 대신한다 — 차례는 강의 도구의 「진행」) ── */}
          <InquiryDock current={scene} last={lastByGroup} onSelect={(id) => pickScene(id)} />
        </section>
      </div>
      {finder && finderOpen ? (
        <ItemFinderDialog
          origin={finderOpen}
          initial={finderInitial}
          currentItemId={itemId}
          // 다른 문항은 기본 장면에서 · 검증된 복귀 문맥(서가 ret · 지도 from/task/ws/step)만 — 비교 pair/back · 원문 이해 · check 는 넘기지 않는다
          hrefFor={(id) => finderItemHref(id, { ret: finderRet, fromMap: finder.fromMap, mapCtxQuery: finder.mapCtxQuery })}
          originHref={`${window.location.pathname}${window.location.search}`}
          onClose={() => setFinderOpen(null)}
          // 떠나기 전에 강의를 멈추고 지금 장면(근거 · 판 스크롤)을 탭 메모리에 남긴다 — 「찾기 전 문항으로」 가 되살린다
          onBeforeLeave={() => {
            pauseLecture()
            stashScene()
          }}
        />
      ) : null}
    </div>
  )
}
