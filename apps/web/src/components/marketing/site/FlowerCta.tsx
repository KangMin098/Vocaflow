// apps/web/src/components/marketing/site/FlowerCta.tsx
//
// 공개 화면 끝의 꽃밭 CTA 띠(DD-68 · tines-mapping C10/P20) — 참조 `WildCodeCTASection`(16페이지 공통, 518px):
// 폭 전체 꽃밭 위로 큰 제목과 알약 CTA 두 개. 랜딩은 도착 계측이 붙은 자기 CTA 를 따로 쓴다.

import Image from 'next/image'
import Link from 'next/link'

import { PILL } from '../pill'

export function FlowerCta({ title = '오늘 읽을 글부터.' }: { title?: string }) {
  return (
    <section aria-label="시작하기" className="relative overflow-hidden">
      <div className="relative z-10 mx-auto flex max-w-[1360px] flex-col items-center px-4 pb-[30vw] pt-20 text-center lg:px-10 lg:pb-[22vw]">
        <h2 className="break-keep font-display text-[44px] font-[500] leading-[1] tracking-[-0.04em] text-[var(--ju)] md:text-[88px]">{title}</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/fit" className={`${PILL} bg-[var(--ju)] text-[var(--on-ju)] hover:bg-[var(--p)]`}>지문 난이도 재 보기</Link>
          <Link href="/signup" className={`${PILL} border border-[var(--ju)] text-[var(--ju)] hover:bg-[var(--bg3)]`}>무료로 시작하기</Link>
        </div>
      </div>
      <Image
        src="/illustrations/tines/bed-flowers.webp"
        alt=""
        width={1664}
        height={928}
        sizes="100vw"
        className="pointer-events-none absolute bottom-0 left-0 w-full select-none [mask-image:linear-gradient(to_bottom,transparent,black_30%)]"
      />
    </section>
  )
}
