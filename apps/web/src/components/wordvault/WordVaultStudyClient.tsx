// apps/web/src/components/wordvault/WordVaultStudyClient.tsx
// /wordvault/study RSC → StudyMode 연결 client wrapper.
// 빈 상태(보유 단어 0)는 차분한 안내 + 둘러보기 CTA.

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Check, Sparkles } from 'lucide-react'

import { StudyMode } from '@/components/wordvault/StudyMode'
import type { WordItem } from '@/components/wordvault/types'

interface WordVaultStudyClientProps {
  words: WordItem[]
  /** 빈 상태 카피 프레이밍 — 'study'(학습) | 'review'(복습). 기본 study. */
  mode?: 'study' | 'review'
  /**
   * 나갈 때 돌아갈 곳. `?from` 을 페이지가 풀어 넘긴다.
   *
   * 없으면 허브다. 예전에는 **언제나** 허브였고, 목록(`/wordvault/browse`)에서
   * "이 단어로 학습 시작" 을 눌러 들어온 사람도 끝나면 목록을 잃었다.
   */
  backHref?: string
}

export function WordVaultStudyClient({
  words,
  mode = 'study',
  backHref = '/wordvault',
}: WordVaultStudyClientProps) {
  const router = useRouter()
  const [done, setDone] = useState(false)

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

  /**
   * 다 끝냈을 때 보여 줄 화면.
   *
   * ⚠️ 2026-09-05 전까지는 **마지막 단어를 평가하는 순간 곧바로 허브로 튕겼다.**
   *    방금 무엇을 했는지 확인할 자리도, 다음 한 걸음도 없었다(D4). 여기서 멈춰 세운다 —
   *    폭죽·트로피는 쓰지 않는다(CLAUDE.md: 차분한 "오늘 잘 마쳤어요" 를 선호).
   */
  if (done) {
    return (
      <div className="mx-auto flex max-w-[480px] flex-col items-center px-s-4 py-s-16 text-center">
        <h1 className="sr-only">{screenName} 완료</h1>
        <div className="mb-s-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-bg2 text-t2">
          <Check size={22} aria-hidden />
        </div>
        <h2 className="mb-s-2 break-keep font-editorial text-[24px] font-[500] leading-snug tracking-[-0.015em] text-t1">
          오늘 잘 마쳤어요
        </h2>
        <p className="mb-s-6 break-keep font-body text-sm text-t2">
          {words.length}개를 {screenName}했어요. 방금 평가한 간격에 맞춰 다시 만나게 돼요.
        </p>
        <div className="flex flex-col items-stretch gap-s-2 sm:flex-row">
          <Link
            href={backHref}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-bg2 px-s-5 font-display text-[13px] font-semibold text-t1 no-underline transition-colors duration-normal hover:bg-bg3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
          >
            돌아가기
          </Link>
          {/* 복습 화면은 "지금 복습할 것" 만 담으므로, 방금 학습한 뒤에도 비어 있을 수 있다.
              그래서 목록을 두 번째 길로 함께 둔다 — 막다른 화면을 만들지 않는다. */}
          <Link
            href="/wordvault/browse"
            className="inline-flex min-h-[44px] items-center justify-center rounded-md px-s-5 font-display text-[13px] font-semibold text-t2 no-underline transition-colors duration-normal hover:bg-bg2 hover:text-t1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
          >
            내 단어 보기 →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* 위와 같은 이유 — 보이는 제목 없이도 화면에는 이름이 있어야 한다. */}
      <h1 className="sr-only">{screenName}</h1>
      <StudyMode
        words={words}
        onExit={(reason) => {
          if (reason === 'completed') {
            setDone(true)
            return
          }
          router.push(backHref)
        }}
      />
    </>
  )
}
