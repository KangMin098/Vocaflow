// apps/web/src/lib/scriptquiz/reader-anchor-context.tsx
//
// T-0209 — 퀴즈 페이지가 확인한 읽던 글 문맥(본인 글 · 같은 도서/장 · 본문 읽음)을 오답 복기에 건넨다.
// 확인되지 않은 경로(도서 입구 · 데모 · 개인 퀴즈 본문 없음)는 값이 없다 → 복기에 「글에서 이 문장 보기」가 없다.

'use client'

import { createContext, useContext, type ReactNode } from 'react'

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
