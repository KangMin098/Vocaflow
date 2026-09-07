// apps/web/src/components/library/textbooks/ShareVolumeButton.tsx
//
// 낱권 **공유**.
//
// ── 왜 필요한가 ────────────────────────────────────────────────────
// 상업 교재 상세는 '찜하기·공유하기·문의하기' 를 함께 낸다(NE_Books 관측 2026-08-31).
// 우리 낱권 상세는 담기·풀기 둘뿐이라 그 축이 2/3 이었다(`catalog-benchmark.mjs` D4).
//
// 그런데 이건 지수 때문에 만드는 것이 아니다. 이 저장소가 **유일하게 성립한다고 계산한
// 성장 경로가 교사 → 학급**이고(PLATFORM_AUDIT §핵심 산술: 교사 3,500명 × 학급 30명),
// 교사가 "이 권부터 시작하세요" 를 보낼 방법이 지금 없다. 서가는 비로그인에도 열려 있으므로
// (공개 표면) 받은 학생은 로그인 없이 바로 열어 볼 수 있다 — 그 점이 종이 교재와 다르다.
//
// ⚠️ **클립보드는 실패한다.** 권한 거부·비보안 컨텍스트·구형 브라우저에서 조용히 안 된다.
//    성공한 척하면 학습자는 빈 클립보드를 붙여 넣는다. 그래서 결과를 실제로 확인해 말한다.
// ⚠️ `navigator.share` 는 사용자가 취소해도 reject 한다 — 취소를 **실패로 적지 않는다**
//    (AbortError). 취소했는데 "실패" 가 뜨면 뭔가 잘못된 줄 안다.

'use client'

import { Check, Link2 } from 'lucide-react'
import { useEffect, useState } from 'react'

type Result = 'idle' | 'copied' | 'shared' | 'failed'

export function ShareVolumeButton({ step, title }: { step: number; title: string }) {
  const [result, setResult] = useState<Result>('idle')

  // 결과 표시는 잠깐만 — 계속 남아 있으면 다음에 눌렀을 때 이번 결과인지 알 수 없다.
  useEffect(() => {
    if (result === 'idle') return
    const t = setTimeout(() => setResult('idle'), 2600)
    return () => clearTimeout(t)
  }, [result])

  async function onShare() {
    // 절대 URL 은 **브라우저에서** 만든다 — 서버에서 만들면 배포 도메인을 하드코딩하게 된다.
    const url = `${window.location.origin}/library/textbooks/${step}`

    // ① 기기가 공유 시트를 주면 그걸 쓴다(모바일에서 가장 자연스럽다).
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url })
        setResult('shared')
        return
      } catch (err) {
        // 사용자가 취소한 것은 실패가 아니다 — 조용히 원래대로 돌아간다.
        if (err instanceof DOMException && err.name === 'AbortError') return
        // 그 밖의 오류는 아래 복사로 떨어진다.
      }
    }

    // ② 클립보드. 되는지 **확인하고** 말한다.
    try {
      await navigator.clipboard.writeText(url)
      setResult('copied')
    } catch {
      setResult('failed')
    }
  }

  const label =
    result === 'copied'
      ? '링크를 복사했어요'
      : result === 'shared'
        ? '공유했어요'
        : result === 'failed'
          ? '복사하지 못했어요'
          : '링크 공유'

  return (
    <button
      type="button"
      onClick={onShare}
      // ⚠️ 결과를 aria-live 로도 알린다. 아이콘만 바꾸면 스크린리더 사용자는 아무 일도 안 일어난 줄 안다.
      className="group inline-flex min-h-[48px] w-fit items-center gap-2 rounded-ios-pill border border-[var(--bd)] bg-[var(--bg)] px-5 font-display text-[14px] font-[700] text-[var(--t1)] motion-safe:transition-all motion-safe:hover:border-[var(--p)] motion-safe:hover:text-[var(--p)] motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:opacity-60"
    >
      {result === 'copied' || result === 'shared' ? (
        <Check size={15} aria-hidden />
      ) : (
        <Link2 size={15} aria-hidden />
      )}
      <span>{label}</span>
      <span role="status" aria-live="polite" className="sr-only">
        {result === 'idle' ? '' : label}
      </span>
    </button>
  )
}
