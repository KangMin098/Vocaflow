// apps/web/src/components/echo/EchoMatchPlayerDynamic.tsx
//
// Piper WASM + onnxruntime-web 은 100% client-side.
// SSR 시 모듈 평가가 hang 가능성 — next/dynamic ssr:false 로 client only 격리.

'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

import type { EchoSentence } from './EchoMatchPlayer'

interface Props {
  textId: string
  libraryBookId?: string | null
  bookTitle?: string
  chapterTitle?: string
  sentences: EchoSentence[]
}

const EchoMatchPlayer = dynamic(
  () => import('./EchoMatchPlayer').then((m) => m.EchoMatchPlayer),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-3 px-6 py-16">
        <Loader2 size={20} className="animate-spin text-[var(--p)]" aria-hidden />
        <p className="font-body text-[12px] text-[var(--t3)]">따라읽기 모듈 준비 중…</p>
      </div>
    ),
  },
)

export function EchoMatchPlayerDynamic(props: Props) {
  return <EchoMatchPlayer {...props} />
}
