// apps/web/src/components/wordvault/WordVaultStudyClient.tsx
// /wordvault/study RSC → StudyMode 연결 client wrapper.
// 빈 상태(보유 단어 0)는 차분한 안내 + 둘러보기 CTA.

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'

import { StudyMode } from '@/components/wordvault/StudyMode'
import type { WordItem } from '@/components/wordvault/types'

interface WordVaultStudyClientProps {
  words: WordItem[]
}

export function WordVaultStudyClient({ words }: WordVaultStudyClientProps) {
  const router = useRouter()

  if (words.length === 0) {
    return (
      <div className="mx-auto flex max-w-[480px] flex-col items-center px-s-4 py-s-16 text-center">
        <div className="mb-s-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-bg2 text-t3">
          <Sparkles size={22} aria-hidden />
        </div>
        <h2 className="mb-s-2 font-editorial text-[24px] font-[500] leading-snug tracking-[-0.015em] text-t1">
          오늘 학습할 단어가 아직 없어요
        </h2>
        <p className="mb-s-6 font-body text-sm text-t2">
          텍스트에서 단어를 모으거나 단어장을 구독하면 여기서 차분히 익힐 수 있어요.
        </p>
        <Link
          href="/wordvault/browse"
          className="rounded-md bg-bg2 px-s-5 py-s-2.5 font-display text-[13px] font-semibold text-t1 no-underline transition-colors duration-normal hover:bg-bg3"
        >
          단어 둘러보기 →
        </Link>
      </div>
    )
  }

  return <StudyMode words={words} onExit={() => router.push('/wordvault')} />
}
