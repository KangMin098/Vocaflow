// apps/web/src/components/marketing/site/ScatterCta.tsx
//
// 공개 페이지 끝 CTA(DD-68 · tines-mapping §20) — 참조 콘텐츠 페이지의 「Built by you, powered by Tines」 띠:
// 폭 전체 **흩어진 물건 그림**(band-scatter, 가운데 45% 가 비어 있다) 한가운데 크림 카드 — 로고 · 세리프 제목 ·
// 알약 둘 · 「이미 계정이 있나요? 로그인」 한 줄. 꽃밭(bed-flowers)은 참조처럼 홈 전용으로 남긴다.
// 서버 컴포넌트 — 그림은 장식(alt="").

import Image from 'next/image'
import Link from 'next/link'

import { BTN } from '@/components/ui/tines-kit'

import { LogoMark } from './LogoMark'

export function ScatterCta({ title = '오늘 읽을 글부터.' }: { title?: string }) {
  return (
    <section aria-label="시작하기" className="relative mx-auto w-full max-w-[1360px] overflow-hidden px-4 py-10 lg:px-10 lg:py-16">
      <div className="relative">
        <Image
          src="/illustrations/tines/band-scatter.webp"
          alt=""
          width={1664}
          height={928}
          sizes="(min-width: 1360px) 1280px, 100vw"
          className="pointer-events-none absolute inset-0 hidden h-full w-full select-none object-cover md:block"
        />
        <div className="relative mx-auto flex min-h-[420px] max-w-[440px] items-center py-10 md:min-h-[560px]">
          <div className="w-full rounded-[14px] border border-[var(--bd)] bg-[var(--bg)] px-7 py-9 text-center">
            <span className="inline-flex justify-center"><LogoMark /></span>
            <h2 className="mt-4 break-keep font-serif text-[30px] font-[400] leading-[1.15] text-[var(--t1)] md:text-[36px]">{title}</h2>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link href="/fit" className={BTN.primary}>지문 난이도 재 보기</Link>
              <Link href="/signup" className={BTN.secondary}>무료로 시작하기</Link>
            </div>
            <p className="mt-5 font-body text-[13.5px] text-[var(--t2)]">
              이미 계정이 있나요?{' '}
              <Link href="/login" className="inline-flex min-h-[44px] items-center font-display font-[700] text-[var(--ju)] underline-offset-4 hover:underline">
                로그인
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
