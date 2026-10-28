// apps/web/src/lib/scriptquiz/reader-anchor-context.tsx
//
// T-0209 — 퀴즈 페이지가 확인한 읽던 글 문맥(본인 글 · 같은 도서/장 · 본문 읽음)을 오답 복기에 건넨다.
// 확인되지 않은 경로(도서 입구 · 데모 · 개인 퀴즈 본문 없음)는 값이 없다 → 복기에 「글에서 이 문장 보기」가 없다.

'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

import { takeEvidenceAnchor } from './reader-anchor'

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
 * Reader 페이지(WorkspacePage)용 — 근거 문장 id 를 한 번 꺼내고, **이동했다는 사실을 페이지 쪽에 남긴다**(T-0209 Codex P2).
 * Reader(ReadingUniverse)가 모드 전환(읽기 → Spell → 읽기)으로 다시 마운트돼도 강조는 남기되 스크롤 · 초점은 다시 옮기지 않는다.
 */
export function useReaderEvidenceAnchor(
  textId: string,
  evidenceAnchor: { hash: string; map: number[] } | null | undefined,
): { anchorSentenceId: number | null; anchorAutoMove: boolean; onAnchorMoved: () => void } {
  const [anchorSentenceId, setAnchorSentenceId] = useState<number | null>(null)
  const [moved, setMoved] = useState(false)
  useEffect(() => {
    if (!evidenceAnchor) return
    const idx = takeEvidenceAnchor(textId, evidenceAnchor.hash)
    const id = idx != null ? evidenceAnchor.map[idx] : undefined
    if (id != null && id >= 0) {
      setMoved(false)
      setAnchorSentenceId(id)
    }
  }, [textId, evidenceAnchor])
  const onAnchorMoved = useCallback(() => setMoved(true), [])
  return { anchorSentenceId, anchorAutoMove: !moved, onAnchorMoved }
}
