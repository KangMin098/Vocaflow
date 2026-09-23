// apps/web/src/components/marketing/site/ScatterCta.tsx
//
// 공개 페이지 끝 CTA(DD-68 · tines-mapping §20) — 참조 콘텐츠 페이지의 「Built by you, powered by Tines」 띠:
// 폭 전체 **흩어진 물건 그림**(band-scatter, 가운데 45% 가 비어 있다) 한가운데 크림 카드 — 로고 · 세리프 제목 ·
// 알약 둘 · 「이미 계정이 있나요? 로그인」 한 줄. 꽃밭(bed-flowers)은 참조처럼 홈 전용으로 남긴다.
// 서버 컴포넌트 — 그림은 장식(alt="").

import Image from 'next/image'
import Link from 'next/link'
import type { CSSProperties } from 'react'

import { BTN } from '@/components/ui/tines-kit'

import { LogoMark } from './LogoMark'

export function ScatterCta({ title = '오늘 읽을 글부터.' }: { title?: string }) {
  return (
    <section aria-label="시작하기" className="relative mx-auto w-full max-w-[1360px] overflow-hidden px-4 py-10 lg:px-10 lg:py-16">
      <div className="relative">
        {/* 띠가 스크롤에 맞춰 천천히 지나간다(§4.5 `.vf-parallax` · `view()` 타임라인).
            여백은 **6% 균일 확대**로 만든다 — 위아래로만 늘리면 상자 비율이 달라져
            `object-cover` 가 다른 데를 자르고, 삽화에 그려진 액자선이 띠 안으로 들어온다
            (실측 2026-09-23 · tines-mapping §29-11). 미지원 브라우저·모션 끔에서는 제자리. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block">
          <div className="h-full w-full scale-[1.06]">
            <Image
              src="/illustrations/tines/band-scatter.webp"
              alt=""
              width={1664}
              height={928}
              sizes="(min-width: 1360px) 1280px, 100vw"
              className="vf-parallax h-full w-full select-none object-cover"
              style={{ '--par-from': '-0.6rem', '--par-to': '0.6rem' } as CSSProperties}
            />
          </div>
        </div>
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
