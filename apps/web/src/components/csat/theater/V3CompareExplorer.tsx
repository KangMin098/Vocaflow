// apps/web/src/components/csat/theater/V3CompareExplorer.tsx
'use client'
//
// **기출 비교 탐구 — 검수된 쌍 하나를 골라 두 문항의 근거 · 판정 조건을 맞대어 본다.** (v3 M5 · 2026-10-12)
//
// 한 문항에 쌍이 70개까지 붙는다(실측). 전부 펼치지 않고: 종류 필터 → 목록에서 한 쌍 선택 → 대응 · 공통/가르는 조건 · 한계.
//   - 대응의 「이 문항 근거」는 왼쪽 지문 지도에서 그 문장을 비춘다(다시 누르면 해제 — 부모 onEvidence).
//   - 상대 근거는 문장 · 선지 번호와 「상대 문항에서 이 비교 보기」 링크로 — 상대 원문을 이 화면에 복제하지 않는다.
//   - 상대로 넘어가면 `back` 으로 돌아올 수 있고, 학습 지도에서 왔으면 `from=map` 을 이어 준다.
//   - 고른 쌍은 주소 `?pair=` 에 남는다(새로 고침 · 뒤로 · 공유). 키보드: 목록에서 ↑/↓ 이동 · Enter 선택 · Esc 선택 해제.
// 데이터는 해시 결속 독립 검수를 지난 쌍만 온다. 숨긴 쌍은 이유별 수를 밝힌다(누락을 정상처럼 보이지 않는다).

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import { PAIR_ABSENCE_TEXT, PAIR_KIND_LABEL, type PairAbsence, type PairKind, type V3PairView } from '@/lib/csat/inquiry/labels'

import styles from './theater.module.css'

const CIRCLED = ['', '①', '②', '③', '④', '⑤']
type Evidence = (sentences: number[], label: string) => void
export interface PairWithheldView { held: number; missing: number; changed: number }

const KINDS: PairKind[] = ['same_structure', 'boundary', 'contrast']

function setPairParam(pairId: string | null) {
  try {
    const url = new URL(window.location.href)
    if (pairId) url.searchParams.set('pair', pairId)
    else url.searchParams.delete('pair')
    window.history.replaceState(window.history.state, '', url)
  } catch {
    // 주소를 못 고쳐도 화면 선택은 유지
  }
}

export function V3CompareExplorer({
  pairs,
  absence,
  withheld,
  initialPairId,
  currentSlug,
  fromMap,
  returnTo,
  onEvidence,
  linkable,
  selectedKey,
}: {
  pairs: V3PairView[]
  absence: PairAbsence | null
  withheld: PairWithheldView
  initialPairId: string | null
  currentSlug: string
  fromMap: boolean
  /** 다른 문항의 비교에서 넘어왔으면 그 문항으로 돌아가는 링크 */
  returnTo: { href: string; label: string } | null
  onEvidence: Evidence
  linkable: boolean
  selectedKey: string | null
}) {
  const counts = useMemo(() => Object.fromEntries(KINDS.map((k) => [k, pairs.filter((p) => p.kind === k).length])) as Record<PairKind, number>, [pairs])
  const [kind, setKind] = useState<PairKind | 'all'>('all')
  const shown = kind === 'all' ? pairs : pairs.filter((p) => p.kind === kind)
  const [selectedId, setSelectedId] = useState<string | null>(initialPairId && pairs.some((p) => p.pairId === initialPairId) ? initialPairId : null)
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)
  const detailRef = useRef<HTMLElement>(null)
  const selected = selectedId ? pairs.find((p) => p.pairId === selectedId) ?? null : null
  const hidden = withheld.held + withheld.missing + withheld.changed

  useEffect(() => {
    if (active >= shown.length) setActive(Math.max(0, shown.length - 1))
  }, [shown.length, active])

  const choose = (id: string | null) => {
    setSelectedId(id)
    setPairParam(id)
    if (id) requestAnimationFrame(() => detailRef.current?.focus())
  }
  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      const next = Math.min(shown.length - 1, Math.max(0, active + (e.key === 'ArrowDown' ? 1 : -1)))
      setActive(next)
      listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[next]?.focus()
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      if (shown[active]) choose(shown[active].pairId)
    } else if (e.key === 'Escape' && selectedId) {
      e.preventDefault()
      choose(null)
    }
  }
  const otherHref = (p: V3PairView) =>
    `/csat/item/${p.otherSlug}?scene=compare&pair=${encodeURIComponent(p.pairId)}&back=${encodeURIComponent(currentSlug)}${fromMap ? '&from=map' : ''}`

  const withheldNote = hidden ? (
    <p className="break-keep text-[12.5px] text-[var(--t2)]" data-testid="v3-compare-withheld">
      검수된 비교 {hidden}쌍은 지금 보여 드리지 않아요 —{' '}
      {[withheld.held ? `상대 문항 비공개 ${withheld.held}` : '', withheld.missing ? `상대 문항이 공개 목록에 없음 ${withheld.missing}` : '', withheld.changed ? `상대 분석이 바뀜 ${withheld.changed}` : '']
        .filter(Boolean)
        .join(' · ')}
      .
    </p>
  ) : null

  if (!pairs.length) {
    return (
      <>
        {returnTo ? <a className={styles.back} href={returnTo.href} data-testid="v3-compare-return">← {returnTo.label}로 돌아가기</a> : null}
        {absence ? (
          <p className="break-keep text-[13px] text-[var(--t2)]" data-testid="v3-compare-absent" data-reason={absence}>
            {PAIR_ABSENCE_TEXT[absence]}
          </p>
        ) : null}
        {withheldNote}
      </>
    )
  }

  return (
    <section className={styles.diagram} aria-label="검수된 기출 비교" data-testid="v3-compare">
      <p className={styles.diagramHead}>
        <b>검수된 기출 비교 {pairs.length}쌍</b>
        <span className={styles.epistemic}>독립 검수 · 두 문항 범위</span>
      </p>
      {returnTo ? (
        <a className={styles.back} href={returnTo.href} data-testid="v3-compare-return">
          ← {returnTo.label}로 돌아가기
        </a>
      ) : null}
      {withheldNote}

      <div className={styles.cmpFilters} role="group" aria-label="비교 종류">
        <button type="button" aria-pressed={kind === 'all'} onClick={() => setKind('all')}>전체 {pairs.length}</button>
        {KINDS.filter((k) => counts[k]).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} data-testid={`v3-kind-${k}`}>
            {PAIR_KIND_LABEL[k]} {counts[k]}
          </button>
        ))}
      </div>

      <ul ref={listRef} className={styles.cmpList} role="listbox" aria-label="비교할 기출 고르기 — ↑/↓ 이동 · Enter 선택 · Esc 해제" onKeyDown={onListKey} data-testid="v3-pair-list">
        {shown.map((p, i) => (
          <li
            key={p.pairId}
            role="option"
            aria-selected={p.pairId === selectedId}
            tabIndex={i === active ? 0 : -1}
            onClick={() => {
              setActive(i)
              choose(p.pairId === selectedId ? null : p.pairId)
            }}
            onFocus={() => setActive(i)}
            data-testid="v3-pair-option"
            data-kind={p.kind}
          >
            <b>{p.otherLabel}</b>
            <span className={styles.diagramLabel}>{PAIR_KIND_LABEL[p.kind]}</span>
            <span className="break-keep">{p.focus}</span>
          </li>
        ))}
      </ul>

      {selected ? (
        <article ref={detailRef} tabIndex={-1} className={styles.designRow} data-kind={selected.kind} data-testid="v3-pair" aria-label={`${selected.otherLabel}와의 비교`}>
          <p className="break-keep">
            <span className={styles.diagramLabel}>{PAIR_KIND_LABEL[selected.kind]}</span>
            <b>이 문항 ↔ {selected.otherLabel}</b> — {selected.focus}
          </p>
          <table className={styles.cmpTable}>
            <caption className="sr-only">두 문항 근거의 대응</caption>
            <thead>
              <tr>
                <th scope="col">이 문항 근거</th>
                <th scope="col">대응 관계</th>
                <th scope="col">{selected.otherLabel} 근거</th>
              </tr>
            </thead>
            <tbody>
              {selected.mappings.map((m, i) => {
                const key = `pair-${selected.pairId}-${i}`
                return (
                  <tr key={i} data-testid="v3-mapping">
                    <td>
                      {linkable ? (
                        <button type="button" className={styles.evidenceBtn} aria-pressed={selectedKey === key} onClick={() => onEvidence(m.self.sentences, key)} data-testid="v3-mapping-self">
                          {m.self.sentences.join(' · ')}번 문장{m.self.choices?.length ? ` · ${m.self.choices.map((c) => CIRCLED[c]).join('')}` : ''} {selectedKey === key ? '강조 해제' : '지문에서 보기'}
                        </button>
                      ) : (
                        <span className={styles.quiet}>{m.self.sentences.join(' · ')}번 문장(문장 대응 확인 중)</span>
                      )}
                    </td>
                    <td className="break-keep">{m.relation}</td>
                    <td>
                      {m.other.sentences.join(' · ')}번 문장{m.other.choices?.length ? ` · ${m.other.choices.map((c) => CIRCLED[c]).join('')}` : ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {selected.shared.length ? (
            <p className="break-keep"><span className={styles.diagramLabel}>두 문항에 같은 조건</span>{selected.shared.join(' · ')}</p>
          ) : null}
          {selected.differences.map((d, i) => {
            const key = `diff-${selected.pairId}-${i}`
            return (
              <p key={i} className="break-keep" data-testid="v3-difference">
                <span className={styles.diagramLabel}>판정을 가르는 조건</span>
                {d.text} <span className={styles.quiet}>(상대 {d.otherSentences.join(' · ')}번 문장)</span>{' '}
                {linkable ? (
                  <button type="button" className={styles.evidenceBtn} aria-pressed={selectedKey === key} onClick={() => onEvidence(d.selfSentences, key)}>
                    이 문항 {d.selfSentences.join(' · ')}번 문장 {selectedKey === key ? '강조 해제' : '보기'}
                  </button>
                ) : null}
              </p>
            )
          })}
          <p className="break-keep"><span className={styles.diagramLabel}>이 비교가 말하지 않는 것</span>{selected.limitation}</p>
          <p className={styles.cmpActions}>
            <a className={styles.back} href={otherHref(selected)} data-testid="v3-pair-go-other">
              {selected.otherLabel}에서 이 비교 보기 →
            </a>
            <button type="button" className={styles.back} onClick={() => choose(null)} data-testid="v3-pair-clear">
              선택 해제
            </button>
          </p>
        </article>
      ) : (
        <p className={styles.quiet}>목록에서 비교할 기출을 하나 고르세요. 두 문항의 근거가 어떻게 대응하고 무엇이 판정을 가르는지 보여 드려요.</p>
      )}
    </section>
  )
}
