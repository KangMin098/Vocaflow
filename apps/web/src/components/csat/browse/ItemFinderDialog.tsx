'use client'

// apps/web/src/components/csat/browse/ItemFinderDialog.tsx
//
// **기출 찾기 팝업** — 지금 문항 · 장면을 떠나지 않고 다른 기출을 찾아 확인한 뒤 탐구로 간다. (기출 찾기 FND2 · FND3)
//
// 참조: 3B Storage 캡처의 구조(중앙 흰 면 · 옅은 막 · 구획선 · 작은 제목/아이콘 · 열별 탐색 · 큰 상세 영역).
// 네 구획: 조건 176 · 회차 208 · 문항 220 · 선택 문항 요약(남은 폭). 머리 48 · 검색 줄 48 · 바닥 52(구현 목표치 — 캡처 실측 아님).
//
// 계약(소유자는 이 컴포넌트 하나):
//   · 마운트 = 열림. 닫기 · 취소 · Esc · 배경 · 뒤로가기 · 문항 열기 · 서가 이동이 모두 `exit()` 한 길로 닫힌다.
//   · 이동 · 주소 변경은 오버레이 이력을 걷어낸 **뒤** 한다(useCloseOnBack afterUnwindRef) — 닫으며 곧바로 push 하지 않는다.
//   · 포커스: 열면 검색 필드 · Tab 가둠 · 닫으면 트리거로(useFocusTrap). 열 안 ↑/↓ · Home/End 는 포커스만 옮긴다.
//     Enter/Space 는 그 행을 **고를 뿐** 문항을 열지 않는다 — 열기는 「탐구 열기」 버튼에서만.
//   · 배경 키 처리기(장면 · 강의 ←/→ · Space)에 키가 새지 않는다(Tab 만 통과 — 포커스 가둠이 받는다).
//   · 팝업 안 조건 · 행 선택은 주소 · history 를 바꾸지 않는다. 「서가에 적용」 만 서가 조건을 바꾼다.
//   · 목록은 메타데이터 API(`/api/csat/item-finder`)에서만 — 서가 로더를 import 하지 않는다. 요약은 메타데이터뿐이다.
//   · 늦은 응답은 버린다(AbortController + 요청 번호). 닫힌 뒤 도착한 응답이 상태를 다시 열지 않는다.

import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, ChevronDown, Headphones, Map as MapIcon, RotateCcw, Search, X } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

import { track } from '@/lib/analytics/client'
import type { BrowseFilter, ExamKind } from '@/lib/csat/browse-model'
import {
  applySelection,
  asBrowseCatalog,
  EMPTY_SELECTION,
  FINDER_QUERY_MAX,
  finderExams,
  finderItems,
  reconcilePick,
  rememberFinderOrigin,
  sameSelection,
  splitExam,
  withExam,
  selectionHref,
  selectionIsEmpty,
  type FinderCatalog,
  type FinderSelection,
  type FinderVerify,
} from '@/lib/csat/item-finder'
import { RECENT_FROM } from '@/lib/csat/trap-atlas'
import { useCloseOnBack } from '@/lib/ui/use-close-on-back'
import { useFocusTrap } from '@/lib/ui/use-focus-trap'

import f from './item-finder.module.css'

/** 어디서 열었나 — 계측의 닫힌 값이기도 하다 */
export type FinderOrigin = 'item' | 'compare' | 'browse' | 'home'

export interface ItemFinderDialogProps {
  origin: FinderOrigin
  /** 시작 조건(서가 조건 · 문항의 ret · 비교 장면의 지금 유형) */
  initial: FinderSelection
  /** 지금 보는 문항 — 고르면 팝업만 닫는다 */
  currentItemId?: string | null
  /** 고른 문항의 주소(검증된 복귀 문맥만 싣는다 — finderItemHref) */
  hrefFor: (itemId: string, sel: FinderSelection) => string
  /** 지금 화면 주소 — 다른 문항으로 갈 때 「찾기 전 문항으로」 에 적는다(문항에서 열었을 때만) */
  originHref?: string | null
  /** 팝업을 내린다(부모가 언마운트) */
  onClose: () => void
  /** 서가에서 열었을 때만 — 조건 확정(오버레이 이력을 걷어낸 뒤 부른다) */
  onApply?: (sel: FinderSelection) => void
  /** 다른 문항으로 떠나기 직전(강의 멈춤 · 서가 스크롤 남기기) */
  onBeforeLeave?: (sel: FinderSelection) => void
}

type ListState = { kind: 'loading' } | { kind: 'ready'; catalog: FinderCatalog } | { kind: 'error'; reason: 'auth' | 'gate' | 'list' | 'network' }
type VerifyState = { kind: 'idle' } | { kind: 'checking'; itemId: string } | { kind: 'blocked'; itemId: string; reason: Exclude<FinderVerify, 'open'> | 'auth' }

/** 재열기 복원 — 같은 진입 맥락(자리 · 문항 · 시작 조건)일 때만. 탭 메모리(모듈 변수) */
interface Memory {
  sel: FinderSelection
  examId: string | null
  itemId: string | null
  extra: boolean
  scroll: [number, number, number]
}
const memory = new Map<string, Memory>()

const KIND_LABEL: Record<ExamKind | 'all', string> = { all: '전체', suneung: '수능', mock: '모의평가', hakpyeong: '학력평가' }
const VERIFY_TEXT: Record<Exclude<FinderVerify, 'open'> | 'auth', string> = {
  held: '이 문항은 지금 잠시 닫혀 있어요(풀이 기록을 모으는 기간). 목록을 다시 불러와 다른 문항을 골라 주세요.',
  missing: '이 문항은 지금 공개 목록에 없어요. 목록을 다시 불러와 주세요.',
  error: '지금은 열 수 있는지 확인하지 못했어요. 낡은 목록으로 열지 않아요 — 잠시 뒤 다시 확인해 주세요.',
  auth: '로그인이 끝났어요. 다시 로그인한 뒤 열어 주세요.',
}
const LIST_TEXT: Record<'auth' | 'gate' | 'list' | 'network', string> = {
  auth: '로그인이 끝났어요. 다시 로그인하면 목록을 볼 수 있어요.',
  gate: '지금 열 수 있는 문항인지 판정하지 못했어요. 0문항이라는 뜻이 아니에요.',
  list: '문항 목록을 읽지 못했어요. 0문항이라는 뜻이 아니에요.',
  network: '연결이 끊겨 목록을 받지 못했어요.',
}

export function ItemFinderDialog({ origin, initial, currentItemId = null, hrefFor, originHref = null, onClose, onApply, onBeforeLeave }: ItemFinderDialogProps) {
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const colRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)] as const
  const titleId = useId()
  const hintId = useId()
  const memoKey = `${origin}|${currentItemId ?? ''}|${selectionHref(initial)}`
  const remembered = memory.get(memoKey)

  // 회차 조건은 회차 열의 선택으로 꺼낸다(확정할 때 다시 싣는다 · withExam)
  const [start] = useState(() => splitExam(initial))
  const [sel, setSel] = useState<FinderSelection>(remembered?.sel ?? start.sel)
  const [examId, setExamId] = useState<string | null>(remembered ? remembered.examId : start.examId)
  const [itemId, setItemId] = useState<string | null>(remembered?.itemId ?? null)
  const [extra, setExtra] = useState(remembered?.extra ?? false)
  const [list, setList] = useState<ListState>({ kind: 'loading' })
  const [verify, setVerify] = useState<VerifyState>({ kind: 'idle' })

  // ── 닫기 · 이동의 한 길 ────────────────────────────────────────────────
  const afterUnwindRef = useRef<(() => void) | null>(null)
  const exited = useRef(false)
  const exit = useCallback(
    (action: 'cancel' | 'same' | 'go' | 'apply' | 'browse', after?: () => void) => {
      if (exited.current) return
      exited.current = true
      track({ name: 'csat_path_chosen', props: { axis: 'finder', need: 'none', origin, action } })
      afterUnwindRef.current = after ?? null
      onClose()
    },
    [onClose, origin],
  )
  // 뒤로가기 = 취소(표식은 이미 걷혔다 — 훅이 그 자리에서 after 를 부른다)
  useCloseOnBack(true, () => exit('cancel'), { afterUnwindRef })
  // 포커스 가둠은 공통 훅 · 트리거 복원은 여기서 — 스크롤을 움직이지 않게(preventScroll).
  //   공통 훅의 복원은 트리거를 화면으로 끌어와 「취소 = 원래 스크롤 그대로」 를 깬다(e2e 실측 2026-10-13)
  // 트리거는 첫 렌더에서 잡는다 — effect 때는 포커스 가둠이 이미 패널 안으로 옮겼다
  const [trigger] = useState(() => (typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null)))
  useFocusTrap(true, panelRef, { restoreFocus: false })
  useEffect(() => {
    // 첫 포커스는 검색 필드
    searchRef.current?.focus({ preventScroll: true })
    return () => {
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [trigger])
  // 배경 스크롤 잠금 — 닫히면 원래 값으로
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // ── 목록 조회(요청 번호 + 취소) ─────────────────────────────────────────
  const listSeq = useRef(0)
  const listAbort = useRef<AbortController | null>(null)
  const verifySeq = useRef(0)
  const verifyAbort = useRef<AbortController | null>(null)
  const load = useCallback(() => {
    listAbort.current?.abort()
    const ctrl = new AbortController()
    listAbort.current = ctrl
    const seq = ++listSeq.current
    setList({ kind: 'loading' })
    // 새 목록을 받으면 앞의 막힘(보류 · 삭제 · 판정 실패)은 다시 확인한다 — 진행 중인 재검증도 버린다
    verifySeq.current += 1
    verifyAbort.current?.abort()
    setVerify({ kind: 'idle' })
    fetch('/api/csat/item-finder', { cache: 'no-store', signal: ctrl.signal, credentials: 'same-origin' })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; catalog?: FinderCatalog } | null
        if (seq !== listSeq.current || ctrl.signal.aborted) return
        if (res.status === 401) return setList({ kind: 'error', reason: 'auth' })
        if (!res.ok || !body?.ok || !body.catalog) return setList({ kind: 'error', reason: body?.error === 'gate' ? 'gate' : 'list' })
        setList({ kind: 'ready', catalog: body.catalog })
      })
      .catch(() => {
        if (seq !== listSeq.current || ctrl.signal.aborted) return
        setList({ kind: 'error', reason: 'network' })
      })
  }, [])
  useEffect(() => {
    load()
    return () => {
      // 닫힌 뒤 도착한 응답이 아무것도 바꾸지 않게
      listSeq.current += 1
      listAbort.current?.abort()
    }
  }, [load])
  useEffect(
    () => () => {
      verifySeq.current += 1
      verifyAbort.current?.abort()
    },
    [],
  )

  // ── 결과 ─────────────────────────────────────────────────────────────
  const catalog = list.kind === 'ready' ? asBrowseCatalog(list.catalog) : null
  const results = useMemo(() => (catalog ? applySelection(catalog, sel) : []), [catalog, sel])
  const exams = useMemo(() => (catalog ? finderExams(catalog, results) : []), [catalog, results])
  const rows = useMemo(() => (catalog ? finderItems(catalog, results, examId) : []), [catalog, results, examId])
  const examById = useMemo(() => new Map((catalog?.exams ?? []).map((e) => [e.id, e])), [catalog])
  const typeName = useMemo(() => new Map((catalog?.types ?? []).map((t) => [t.id, t.name])), [catalog])
  const years = useMemo(() => [...new Set((catalog?.exams ?? []).map((e) => e.year))].sort((a, b) => b - a), [catalog])
  const hasHak = useMemo(() => (catalog?.exams ?? []).some((e) => e.kind === 'hakpyeong'), [catalog])
  const picked = itemId ? results.find((i) => i.id === itemId) ?? null : null

  // 조건 · 검색이 바뀌면 결과에 없는 회차 · 문항 선택과 이전 요약을 해제한다
  useEffect(() => {
    if (!catalog) return
    const r = reconcilePick(results, examId, itemId)
    if (r.examId !== examId) setExamId(r.examId)
    if (r.itemId !== itemId) setItemId(r.itemId)
  }, [catalog, results, examId, itemId])
  // 다른 문항을 고르면 이전 재검증 결과는 지운다
  useEffect(() => {
    setVerify((v) => (v.kind !== 'idle' && v.itemId !== itemId ? { kind: 'idle' } : v))
  }, [itemId])

  // 재열기 복원 — 닫힐 때 지금 상태 · 열 스크롤을 남긴다
  const live = useRef({ sel, examId, itemId, extra })
  live.current = { sel, examId, itemId, extra }
  useEffect(() => {
    const cols = colRefs.map((r) => r.current)
    return () => {
      memory.set(memoKey, { ...live.current, scroll: cols.map((c) => c?.scrollTop ?? 0) as [number, number, number] })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 열린 동안 한 번(닫힐 때 저장)
  }, [])
  const restored = useRef(false)
  useEffect(() => {
    if (restored.current || list.kind !== 'ready' || !remembered) return
    restored.current = true
    requestAnimationFrame(() => colRefs.forEach((r, i) => r.current && (r.current.scrollTop = remembered.scroll[i])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.kind])

  // ── 조건 조작 ─────────────────────────────────────────────────────────
  const setFilter = <K extends keyof BrowseFilter>(key: K, value: BrowseFilter[K]) => setSel((s) => ({ ...s, filter: { ...s.filter, [key]: value } }))
  const reset = () => {
    // 「조건 초기화」 는 목적까지 해제한다
    setSel(EMPTY_SELECTION)
    setExamId(null)
    setItemId(null)
  }
  const togglePurpose = (p: 'killer' | 'evidence' | 'recent') => {
    if (p === 'killer') setSel((s) => ({ ...s, purpose: s.purpose === 'killer' ? null : 'killer' }))
    if (p === 'evidence') setFilter('status', sel.filter.status === 'map' ? 'all' : 'map')
    if (p === 'recent') setFilter('from', sel.filter.from === RECENT_FROM ? 'all' : RECENT_FROM)
  }

  // ── 열기 ─────────────────────────────────────────────────────────────
  const isCurrent = picked != null && picked.id === currentItemId
  const open = async () => {
    if (!picked || verify.kind === 'checking') return
    // 막힌 문항은 목록을 다시 받기 전까지 열지 않는다(낡은 목록으로 열기 금지)
    if (verify.kind === 'blocked' && verify.itemId === picked.id) return
    if (isCurrent) return exit('same')
    verifyAbort.current?.abort()
    const ctrl = new AbortController()
    verifyAbort.current = ctrl
    const seq = ++verifySeq.current
    const id = picked.id
    setVerify({ kind: 'checking', itemId: id })
    let result: FinderVerify | 'auth' = 'error'
    try {
      const res = await fetch(`/api/csat/item-finder?verify=${encodeURIComponent(id)}`, { cache: 'no-store', signal: ctrl.signal, credentials: 'same-origin' })
      const body = (await res.json().catch(() => null)) as { ok?: boolean; verify?: FinderVerify } | null
      result = res.status === 401 ? 'auth' : res.ok && body?.ok && body.verify ? body.verify : 'error'
    } catch {
      result = 'error'
    }
    if (seq !== verifySeq.current || ctrl.signal.aborted) return
    if (result !== 'open') return setVerify({ kind: 'blocked', itemId: id, reason: result })
    const eff = withExam(sel, examId)
    const href = hrefFor(id, eff)
    onBeforeLeave?.(eff)
    if (originHref) rememberFinderOrigin(originHref, id)
    exit('go', () => router.push(href))
  }
  const applyToShelf = () => {
    const s = withExam(sel, examId)
    exit('apply', () => onApply?.(s))
  }
  const toShelf = () => {
    const href = selectionHref(withExam(sel, examId))
    exit('browse', () => router.push(href))
  }

  // ── 키보드 ───────────────────────────────────────────────────────────
  const onEscape = () => {
    // 작은 조건 메뉴부터 닫는다
    if (extra) {
      setExtra(false)
      panelRef.current?.querySelector<HTMLElement>('[data-extra-toggle]')?.focus()
      return
    }
    exit('cancel')
  }
  const onPanelKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') return // 포커스 가둠(document)이 받는다
    // 배경(장면 · 강의 · 지도)의 window/document 키 처리기에 새지 않게
    e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      onEscape()
    }
  }
  // 포커스가 패널 밖(body)으로 빠진 경우 — 누른 버튼이 사라졌을 때(목록 다시 불러오기 등). 그래도 Esc 는 닫고,
  //   다른 키는 배경 처리기(window)로 가지 않게 문서 단계에서 멈춘다(e2e 실측 2026-10-13)
  // 다시 불러오기 — 누른 버튼이 사라지므로 포커스를 검색 필드로 옮긴다(포커스가 body 로 빠지지 않게)
  const reload = () => {
    load()
    searchRef.current?.focus({ preventScroll: true })
  }
  const escapeRef = useRef(onEscape)
  escapeRef.current = onEscape
  useEffect(() => {
    const onDocKey = (e: KeyboardEvent) => {
      const panel = panelRef.current
      if (!panel || e.key === 'Tab' || (e.target instanceof Node && panel.contains(e.target))) return
      e.stopPropagation()
      if (e.key === 'Escape') {
        e.preventDefault()
        escapeRef.current()
      }
    }
    document.addEventListener('keydown', onDocKey)
    return () => document.removeEventListener('keydown', onDocKey)
  }, [])
  /** 열 안 ↑/↓ · Home/End — 포커스만 옮긴다(고르지 않는다) */
  const onColumnKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    const t = e.target as HTMLElement
    if (t.tagName === 'SELECT' || t.tagName === 'INPUT') return
    const rows = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-row]')).filter((r) => r.getClientRects().length > 0)
    if (!rows.length) return
    e.preventDefault()
    const at = rows.indexOf(t.closest('[data-row]') as HTMLElement)
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))
    rows[next]?.focus()
  }

  if (typeof document === 'undefined') return null

  const loading = list.kind === 'loading'
  const failed = list.kind === 'error' ? list.reason : null
  const blocked = verify.kind === 'blocked' && verify.itemId === itemId ? verify.reason : null
  const condCount = selectionIsEmpty(sel) ? 0 : 1
  const unchanged = sameSelection(withExam(sel, examId), initial)

  const condRow = (key: string, label: string, on: boolean, onClick: () => void, extraText?: string) => (
    <button key={key} type="button" className={f.row} data-row aria-pressed={on} onClick={onClick} data-cond={key}>
      <span className={f.rowMain}>{label}</span>
      {extraText ? <span className={f.rowMeta}>{extraText}</span> : null}
      {on ? <Check size={13} aria-hidden className={f.rowCheck} /> : null}
    </button>
  )

  return createPortal(
    <div className={f.overlay} role="presentation" onMouseDown={(e) => e.target === e.currentTarget && exit('cancel')} data-testid="item-finder-overlay">
      <div
        ref={panelRef}
        className={f.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onPanelKey}
        data-testid="item-finder"
        data-origin={origin}
        data-state={list.kind}
      >
        {/* 머리 48 */}
        <div className={f.head} data-part="head">
          <Search size={14} aria-hidden className={f.headIcon} />
          <h2 id={titleId} className={f.title}>
            기출 찾기
          </h2>
          <button type="button" className={f.close} onClick={() => exit('cancel')} aria-label="닫기" data-testid="item-finder-close">
            <X size={15} aria-hidden />
          </button>
        </div>

        {/* 검색 줄 48 */}
        <div className={f.searchRow}>
          <label className={f.searchLabel} htmlFor={`${titleId}-q`}>
            찾기
          </label>
          <span className={f.searchBox}>
            <Search size={13} aria-hidden />
            <input
              ref={searchRef}
              id={`${titleId}-q`}
              type="search"
              value={sel.filter.query}
              maxLength={FINDER_QUERY_MAX}
              placeholder="회차 · 유형 · 문항 번호 (예: 2026 34 · 빈칸 2026)"
              onChange={(e) => setFilter('query', e.target.value.slice(0, FINDER_QUERY_MAX))}
              data-testid="item-finder-search"
              autoComplete="off"
            />
          </span>
          <button type="button" className={f.textBtn} onClick={reset} disabled={selectionIsEmpty(sel) && !examId && !itemId} data-testid="item-finder-reset">
            <RotateCcw size={13} aria-hidden />
            조건 초기화
          </button>
        </div>

        {/* 네 구획 */}
        <div className={f.body}>
          {/* ① 조건 */}
          <section className={f.col} aria-labelledby={`${titleId}-c1`}>
            <h3 id={`${titleId}-c1`} className={f.colHead}>
              조건
            </h3>
            <div ref={colRefs[0]} className={f.colScroll} onKeyDown={onColumnKey} data-testid="item-finder-conditions">
              <p className={f.group}>목적</p>
              {condRow('killer', '킬러 유형', sel.purpose === 'killer', () => togglePurpose('killer'))}
              {condRow('evidence', '근거 문장 찾기', sel.filter.status === 'map', () => togglePurpose('evidence'), '지도')}
              {condRow('recent', '최근 기출부터', sel.filter.from === RECENT_FROM, () => togglePurpose('recent'), `${RECENT_FROM}~`)}
              <p className={f.group}>출처</p>
              {(['all', 'suneung', 'mock', ...(hasHak ? (['hakpyeong'] as const) : [])] as const).map((k) =>
                condRow(`kind-${k}`, KIND_LABEL[k], sel.filter.kind === k, () =>
                  setSel((s) => ({ ...s, filter: { ...s.filter, kind: k, grade: k === 'hakpyeong' ? (s.filter.grade ?? 'all') : 'all' } })),
                ),
              )}
              <p className={f.group}>유형</p>
              {condRow('type-all', '유형 전체', sel.filter.type === 'all', () => setFilter('type', 'all'))}
              {(catalog?.types ?? []).map((t) => condRow(`type-${t.id}`, t.name, sel.filter.type === t.id, () => setFilter('type', t.id), t.status === 'retired' ? '폐지' : String(t.items)))}
              <button type="button" className={f.row} data-row data-extra-toggle aria-expanded={extra} onClick={() => setExtra((x) => !x)} data-testid="item-finder-extra">
                <span className={f.rowMain}>추가 조건</span>
                <ChevronDown size={13} aria-hidden className={f.chev} data-open={extra} />
              </button>
              {extra ? (
                <div className={f.extra} data-testid="item-finder-extra-panel">
                  <label className={f.selectLabel}>
                    학년도
                    <select className={f.select} value={sel.filter.year === 'all' ? 'all' : String(sel.filter.year)} onChange={(e) => setFilter('year', e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                      <option value="all">전체</option>
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}학년도
                        </option>
                      ))}
                    </select>
                  </label>
                  {sel.filter.kind === 'hakpyeong' ? (
                    <label className={f.selectLabel}>
                      학년
                      <select className={f.select} value={String(sel.filter.grade ?? 'all')} onChange={(e) => setFilter('grade', e.target.value === 'all' ? 'all' : (Number(e.target.value) as 1 | 2 | 3))}>
                        <option value="all">전체</option>
                        {([3, 2, 1] as const).map((g) => (
                          <option key={g} value={g}>
                            고{g}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {condRow('lecture', '강의 있는 문항만', sel.filter.status === 'lecture', () => setFilter('status', sel.filter.status === 'lecture' ? 'all' : 'lecture'))}
                </div>
              ) : null}
            </div>
          </section>

          {/* ② 회차 */}
          <section className={f.col} aria-labelledby={`${titleId}-c2`}>
            <h3 id={`${titleId}-c2`} className={f.colHead}>
              회차 {catalog ? <span className={f.count}>{exams.length}</span> : null}
            </h3>
            <div ref={colRefs[1]} className={f.colScroll} onKeyDown={onColumnKey}>
              {catalog ? (
                <div role="listbox" aria-label="회차" data-testid="item-finder-exams">
                  <button type="button" role="option" aria-selected={examId === null} tabIndex={examId === null ? 0 : -1} className={f.row} data-row onClick={() => setExamId(null)} data-exam="all">
                    <span className={f.rowMain}>일치하는 회차 전부</span>
                    <span className={f.rowMeta}>{results.length}</span>
                  </button>
                  {exams.map(({ exam, count }) => (
                    <button
                      key={exam.id}
                      type="button"
                      role="option"
                      aria-selected={examId === exam.id}
                      tabIndex={examId === exam.id ? 0 : -1}
                      className={f.row}
                      data-row
                      data-exam={exam.id}
                      onClick={() => setExamId(exam.id)}
                    >
                      <span className={f.rowMain}>{exam.label}</span>
                      <span className={f.rowMeta}>{count}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <ListStatus loading={loading} failed={failed} onRetry={reload} />
              )}
            </div>
          </section>

          {/* ③ 문항 */}
          <section className={f.col} aria-labelledby={`${titleId}-c3`}>
            <h3 id={`${titleId}-c3`} className={f.colHead}>
              문항 {catalog ? <span className={f.count}>{rows.length}</span> : null}
            </h3>
            <div ref={colRefs[2]} className={f.colScroll} onKeyDown={onColumnKey}>
              {catalog ? (
                rows.length === 0 ? (
                  <div className={f.empty} data-testid="item-finder-empty" role="status">
                    <p>이 조건에 맞는 문항이 없어요.</p>
                    <button type="button" className={f.textBtn} onClick={reset}>
                      조건 지우기
                    </button>
                  </div>
                ) : (
                  <div role="listbox" aria-label="문항" data-testid="item-finder-items">
                    {rows.map((i, n) => {
                      const on = i.id === itemId
                      const first = !itemId && n === 0
                      return (
                        <button
                          key={i.id}
                          type="button"
                          role="option"
                          aria-selected={on}
                          tabIndex={on || first ? 0 : -1}
                          className={f.row}
                          data-row
                          data-item={i.id}
                          data-current={i.id === currentItemId}
                          onClick={() => setItemId(i.id)}
                        >
                          <span className={f.no}>{i.no}</span>
                          <span className={f.rowMain}>
                            {typeName.get(i.type_id) ?? i.type_id}
                            {!examId ? <span className={f.sub}>{examById.get(i.exam_id)?.label ?? i.exam_id}</span> : null}
                          </span>
                          {i.id === currentItemId ? <span className={f.now}>지금</span> : null}
                        </button>
                      )
                    })}
                  </div>
                )
              ) : loading ? null : (
                <p className={f.muted}>목록을 받으면 보여요.</p>
              )}
            </div>
          </section>

          {/* ④ 선택 문항 요약 — 메타데이터만 */}
          <section className={`${f.col} ${f.summaryCol}`} aria-labelledby={`${titleId}-c4`} aria-live="polite" data-testid="item-finder-summary">
            <h3 id={`${titleId}-c4`} className={f.colHead}>
              선택 문항
            </h3>
            <div className={f.summary}>
              {!picked ? (
                <p className={f.muted} id={hintId}>
                  {catalog ? '문항을 하나 고르면 회차 · 번호 · 유형과 볼 수 있는 기능이 여기에 나와요. 고른 뒤 「탐구 열기」 로 이동해요.' : '목록을 받는 중이에요.'}
                </p>
              ) : (
                <>
                  <p className={f.sumExam}>{examById.get(picked.exam_id)?.label ?? picked.exam_id}</p>
                  <p className={f.sumTitle}>
                    {picked.no}번 · {typeName.get(picked.type_id) ?? picked.type_id}
                    {picked.points ? <span className={f.tag}>{picked.points}점</span> : null}
                  </p>
                  {isCurrent ? (
                    <p className={f.note} data-testid="item-finder-current">
                      지금 보는 문항이에요. 열면 팝업만 닫히고 장면 · 고른 근거 · 쓰던 글은 그대로예요.
                    </p>
                  ) : null}
                  <dl className={f.facts}>
                    <div>
                      <dt>
                        <Headphones size={13} aria-hidden /> 해설 강의
                      </dt>
                      <dd>{picked.lecture ? `있음 · 약 ${Math.max(1, Math.round(picked.sec / 60))}분` : '아직 없음'}</dd>
                    </div>
                    <div>
                      <dt>
                        <MapIcon size={13} aria-hidden /> 문장 지도
                      </dt>
                      <dd>{picked.map ? '정답 근거 자리 표시 있음' : '없음'}</dd>
                    </div>
                  </dl>
                  <p className={f.muted}>지문 · 선지는 이 기기의 공개 문제지에서 봐요. 여기서는 원문 · 정답 · 해설을 미리 보여 주지 않고, 여는 것만으로 학습 기록이 생기지 않아요.</p>
                  {blocked ? (
                    <div className={f.alert} role="alert" data-testid="item-finder-blocked" data-reason={blocked}>
                      <AlertTriangle size={13} aria-hidden />
                      <p>{VERIFY_TEXT[blocked]}</p>
                      {blocked !== 'auth' ? (
                        <button type="button" className={f.textBtn} onClick={reload}>
                          목록 다시 불러오기
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </section>
        </div>

        {/* 바닥 52 */}
        <div className={f.foot} data-part="foot">
          <p className={f.footStatus} role="status" data-testid="item-finder-status">
            {catalog ? (
              <>
                <b>{results.length}</b>문항 · <b>{exams.length}</b>회차{condCount ? ' · 조건 적용 중' : ''}
              </>
            ) : loading ? (
              '목록을 받는 중…'
            ) : (
              '목록을 받지 못했어요'
            )}
          </p>
          <button type="button" className={f.btn} onClick={() => exit('cancel')} data-testid="item-finder-cancel">
            취소
          </button>
          {origin === 'browse' ? (
            <button type="button" className={f.btn} onClick={applyToShelf} disabled={!catalog || unchanged} data-testid="item-finder-apply">
              서가에 적용
            </button>
          ) : (
            <button type="button" className={f.btn} onClick={toShelf} disabled={!catalog} data-testid="item-finder-shelf">
              전체 서가에서 보기
            </button>
          )}
          <button
            type="button"
            className={`${f.btn} ${f.primary}`}
            onClick={() => void open()}
            aria-disabled={!picked || verify.kind === 'checking' || Boolean(blocked)}
            aria-describedby={!picked ? hintId : undefined}
            data-testid="item-finder-open"
          >
            {verify.kind === 'checking' ? '확인 중…' : '탐구 열기'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function ListStatus({ loading, failed, onRetry }: { loading: boolean; failed: 'auth' | 'gate' | 'list' | 'network' | null; onRetry: () => void }) {
  if (loading) {
    return (
      <p className={f.muted} role="status" data-testid="item-finder-loading">
        목록을 받는 중…
      </p>
    )
  }
  if (!failed) return null
  return (
    <div className={f.alert} role="alert" data-testid="item-finder-error" data-reason={failed}>
      <AlertTriangle size={13} aria-hidden />
      <p>{LIST_TEXT[failed]}</p>
      {failed !== 'auth' ? (
        <button type="button" className={f.textBtn} onClick={onRetry} data-testid="item-finder-retry">
          다시 불러오기
        </button>
      ) : null}
    </div>
  )
}
