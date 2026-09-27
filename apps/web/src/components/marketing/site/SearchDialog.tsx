// apps/web/src/components/marketing/site/SearchDialog.tsx
//
// 전역 검색 모달(DD-68 · tines-mapping §10) — 참조 `GlobalSearch`: 전면 대화상자 · 위 입력 · 아래 묶음별 결과.
// 열기: 헤더의 원형 단추 · Ctrl/⌘+K. 닫기: Esc · 바깥 누름 · 닫기 단추 → 포커스는 연 단추로 돌아간다.
// Tab 은 창 안에서만 돈다. 입력은 200ms 뒤에 조회하고, 앞선 요청은 취소한다.

'use client'

import { Search, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import type { SearchGroups, SearchHit } from '@/lib/search/global'

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'
const GROUP_LABEL: Record<keyof SearchGroups, string> = { pages: '화면', books: '도서', words: '단어', videos: '영상' }
const GROUP_ORDER: (keyof SearchGroups)[] = ['pages', 'books', 'words', 'videos']

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; q: string; groups: SearchGroups; partial: string[] }
  | { kind: 'error' }

export function SearchButton() {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const close = useCallback(() => { setOpen(false); trigger.current?.focus() }, [])

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label="검색 (Ctrl+K)"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={`inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg3)] text-[var(--ju)] transition-colors duration-[var(--dur-quick)] hover:bg-[var(--tint-lavender)] ${FOCUS}`}
      >
        <Search size={17} aria-hidden />
      </button>
      {open && <SearchDialog onClose={close} />}
    </>
  )
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })
  const panel = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const titleId = useId()

  useEffect(() => { input.current?.focus() }, [])

  // 조회 — 200ms 모았다가, 앞선 요청은 취소
  useEffect(() => {
    const term = q.trim()
    if (!term) { setState({ kind: 'idle' }); return }
    const ctl = new AbortController()
    const t = setTimeout(async () => {
      setState({ kind: 'loading' })
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal })
        if (!r.ok) throw new Error(String(r.status))
        const j = (await r.json()) as { q: string; groups: SearchGroups; partial: string[] }
        setState({ kind: 'done', q: j.q, groups: j.groups, partial: j.partial })
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setState({ kind: 'error' })
      }
    }, 200)
    return () => { clearTimeout(t); ctl.abort() }
  }, [q])

  // Esc 닫기 · Tab 은 창 안에서만
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
    if (e.key !== 'Tab' || !panel.current) return
    const items = [...panel.current.querySelectorAll<HTMLElement>('a[href], button, input')].filter((x) => !x.hasAttribute('disabled'))
    if (!items.length) return
    const first = items[0], last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  const total = state.kind === 'done' ? GROUP_ORDER.reduce((n, g) => n + state.groups[g].length, 0) : 0

  return (
    <div
      // 참조 GlobalSearch: 화면을 검게 덮지 않는다 — 옅은 라벤더 막 + blur, 그 위에 유리 막대(tines-mapping §14)
      className="fixed inset-0 z-[60] flex items-start justify-center bg-[color-mix(in_srgb,var(--tint-lavender)_45%,transparent)] px-4 pt-[12vh] backdrop-blur-[6px] motion-safe:animate-[vf-dropdown-in_var(--dur-slow)_var(--ease-out-quint)_both]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="w-full max-w-[900px] overflow-hidden rounded-[14px] border border-[var(--bd)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] shadow-[var(--sh-overlay)] backdrop-blur-[12px]"
      >
        <h2 id={titleId} className="sr-only">사이트 검색</h2>
        {/* 포커스 표시는 입력 줄 전체가 맡는다(아래 보라 선) — 입력칸 자체 테두리는 끈다 */}
        <div className="flex items-center gap-3 border-b border-[var(--bd)] bg-[color-mix(in_srgb,var(--tint-lavender)_80%,transparent)] px-4 focus-within:shadow-[inset_0_-2px_0_var(--ju)]">
          <Search size={18} aria-hidden className="shrink-0 text-[var(--ju)]" />
          <label htmlFor={`${titleId}-q`} className="sr-only">검색어</label>
          <input
            id={`${titleId}-q`}
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="화면 · 도서 · 단어 · 영상 검색"
            autoComplete="off"
            className="h-14 min-w-0 flex-1 bg-transparent font-display text-[17px] text-[var(--t1)] outline-none placeholder:text-[var(--t2)] focus:outline-none focus-visible:outline-none"
          />
          <button type="button" onClick={onClose} aria-label="검색 닫기" className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--ju)] hover:bg-[var(--bg3)] ${FOCUS}`}>
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3" aria-live="polite">
          {state.kind === 'idle' && <p className="px-3 py-10 text-center font-display text-[15px] text-[var(--t2)]">검색어를 입력하세요.</p>}
          {state.kind === 'loading' && <p className="px-3 py-10 text-center font-display text-[15px] text-[var(--t2)]">찾는 중…</p>}
          {state.kind === 'error' && <p className="px-3 py-10 text-center font-display text-[15px] text-[var(--t1)]">지금 검색을 불러오지 못했어요. 잠시 뒤에 다시 해 보세요.</p>}
          {state.kind === 'done' && total === 0 && (
            <div className="flex flex-col items-center px-3 py-8 text-center">
              <Image src="/illustrations/tines/spot-search.webp" alt="" width={1328} height={1328} className="w-[120px]" />
              <p className="mt-3 break-keep font-serif text-[20px] text-[var(--t1)]">「{state.q}」에 맞는 것이 없어요.</p>
              <p className="mt-2 break-keep font-body text-[14px] text-[var(--t2)]">서가를 둘러보거나, 읽을 지문을 직접 재 볼 수 있어요.</p>
              <div className="mt-4 flex gap-2">
                <Link href="/library/books" onClick={onClose} className={`inline-flex min-h-[44px] items-center rounded-full border border-[var(--ju)] px-4 font-display text-[14px] font-[700] text-[var(--ju)] ${FOCUS}`}>서가 둘러보기</Link>
                <Link href="/fit" onClick={onClose} className={`inline-flex min-h-[44px] items-center rounded-full bg-[var(--ju)] px-4 font-display text-[14px] font-[700] text-[var(--on-ju)] ${FOCUS}`}>지문 재 보기</Link>
              </div>
            </div>
          )}
          {state.kind === 'done' && total > 0 && GROUP_ORDER.filter((g) => state.groups[g].length > 0).map((g) => (
            <section key={g} className="mb-2">
              <p className="px-3 pb-1 pt-3 font-display text-[12px] font-[700] tracking-[0.06em] text-[var(--ju)]">{GROUP_LABEL[g]}</p>
              <ul>{state.groups[g].map((h) => <Hit key={`${g}-${h.href ?? h.title}`} hit={h} onNavigate={onClose} />)}</ul>
            </section>
          ))}
          {state.kind === 'done' && state.partial.length > 0 && (
            <p className="px-3 pb-2 pt-3 font-body text-[13px] text-[var(--t1)]">
              {state.partial.map((p) => GROUP_LABEL[p as keyof SearchGroups] ?? p).join(' · ')} 묶음은 지금 불러오지 못했어요.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Hit({ hit, onNavigate }: { hit: SearchHit; onNavigate: () => void }) {
  const body = (
    <>
      <span className="block font-display text-[15px] font-[600] text-[var(--t1)]">{hit.title}</span>
      {hit.sub && <span className="mt-0.5 block break-keep font-body text-[13px] text-[var(--t2)]">{hit.sub}</span>}
    </>
  )
  return (
    <li>
      {hit.href ? (
        <Link href={hit.href} onClick={onNavigate} className={`block rounded-[var(--r-lg)] px-3 py-2.5 hover:bg-[var(--bg2)] ${FOCUS}`}>{body}</Link>
      ) : (
        <div className="rounded-[var(--r-lg)] px-3 py-2.5">{body}</div>
      )}
    </li>
  )
}
