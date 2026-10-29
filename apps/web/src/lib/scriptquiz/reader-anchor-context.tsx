// apps/web/src/lib/scriptquiz/reader-anchor-context.tsx
//
// T-0209 — 퀴즈 페이지가 확인한 읽던 글 문맥(본인 글 · 같은 도서/장 · 본문 읽음)을 오답 복기에 건넨다.
// 확인되지 않은 경로(도서 입구 · 데모 · 개인 퀴즈 본문 없음)는 값이 없다 → 복기에 「글에서 이 문장 보기」가 없다.

'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

import { anchorAfterMoved, anchorAfterTake, anchorKey, takeEvidenceAnchor, visibleReaderAnchor, type ReaderAnchorState } from './reader-anchor'

export interface EvidenceReaderContext {
  textId: string
}

const Ctx = createContext<EvidenceReaderContext | null>(null)

export function EvidenceReaderProvider({ value, children }: { value: EvidenceReaderContext | null; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useEvidenceReader(): EvidenceReaderContext | null {
  return useContext(Ctx)
}

/**
 * Reader 페이지(WorkspacePage)용 — 근거 문장 id 를 한 번 꺼내고, 그 상태(문장 id · 옮김)를 **글 id · 본문 해시에 묶어** 페이지 쪽에 둔다.
 * - 모드 전환(읽기 → Spell → 읽기)으로 Reader 가 다시 마운트돼도 강조만 남기고 스크롤 · 초점은 다시 옮기지 않는다(P2 1차).
 * - 본문 갱신(router.refresh 로 새 해시) · 다른 글로 바뀌면 옛 상태를 쓰지 않는다 — 강조 · 이동 모두 해제(P2 3차).
 * - 페이지를 떠났다 돌아오면 상태가 없고 표식도 이미 지워져 첫머리다.
 * 판정은 순수 함수(reader-anchor.ts anchorAfterTake · anchorAfterMoved · visibleReaderAnchor)가 한다.
 */
export function useReaderEvidenceAnchor(
  textId: string,
  evidenceAnchor: { hash: string; map: number[] } | null | undefined,
): { anchorSentenceId: number | null; anchorAutoMove: boolean; onAnchorMoved: () => void } {
  const key = anchorKey(textId, evidenceAnchor?.hash)
  const [state, setState] = useState<ReaderAnchorState | null>(null)
  useEffect(() => {
    const taken = key && evidenceAnchor ? takeEvidenceAnchor(textId, evidenceAnchor.hash) : null
    setState((prev) => anchorAfterTake(prev, key, taken, evidenceAnchor?.map))
  }, [key, textId, evidenceAnchor])
  const onAnchorMoved = useCallback(() => setState((prev) => anchorAfterMoved(prev, key)), [key])
  return { ...visibleReaderAnchor(state, key), onAnchorMoved }
}
