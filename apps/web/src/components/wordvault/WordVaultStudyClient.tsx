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
  /** 빈 상태 카피 프레이밍 — 'study'(학습) | 'review'(복습). 기본 study. */
  mode?: 'study' | 'review'
}

export function WordVaultStudyClient({ words, mode = 'study' }: WordVaultStudyClientProps) {
  const router = useRouter()

  const screenName = mode === 'review' ? '복습' : '학습'

  if (words.length === 0) {
    return (
      <div className="mx-auto flex max-w-[480px] flex-col items-center px-s-4 py-s-16 text-center">
        {/* ⚠️ 이 화면에는 보이는 제목이 없다 — Calm UI 라 그렇게 설계했다. 그래도 이름은 있어야 한다:
            h1 이 없으면 스크린리더로 "여기가 어디" 를 물을 방법이 없다(실측 2026-08-23).
            아래 h2 는 **상태 안내**지 화면 이름이 아니다 — 둘은 다른 것이다. */}
        <h1 className="sr-only">{screenName}</h1>
        <div className="mb-s-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-bg2 text-t3">
          <Sparkles size={22} aria-hidden />
        </div>
        <h2 className="mb-s-2 font-editorial text-[24px] font-[500] leading-snug tracking-[-0.015em] text-t1">
          {mode === 'review' ? '지금 복습할 단어가 없어요' : '오늘 학습할 단어가 아직 없어요'}
        </h2>
        <p className="mb-s-6 font-body text-sm text-t2">
          {mode === 'review'
            ? '잘 따라가고 있어요 — 복습할 단어가 쌓이면 여기에 나타나요.'
            : '텍스트에서 단어를 모으거나 단어장을 구독하면 여기서 차분히 익힐 수 있어요.'}
        </p>
        <Link
          href="/wordvault/browse"
          className="rounded-md bg-bg2 px-s-5 py-s-3 font-display text-[13px] font-semibold text-t1 no-underline transition-colors duration-normal hover:bg-bg3"
        >
          단어 둘러보기 →
        </Link>
      </div>
    )
  }

  return (
    <>
      {/* 위와 같은 이유 — 보이는 제목 없이도 화면에는 이름이 있어야 한다. */}
      <h1 className="sr-only">{screenName}</h1>
      <StudyMode words={words} onExit={() => router.push('/wordvault')} />
    </>
  )
}
