// apps/web/src/app/(main)/csat/overlay/page.tsx
//
// **평가원 문제지 위에 우리 해설을 얹어 읽는 화면.**
//
// 왜 이 화면이 필요한가 — `/csat/item/[slug]` 는 해설만 싣는다(문항 원문은 평가원 저작물이라
// 우리가 들고 있어도 내보내지 않는다). 그래서 학습자는 **평가원 공개 문제지를 곁에 두고**
// 읽어야 했다. 그 「곁」을 같은 화면으로 옮기는 것이 여기다.
//
// ⚠️ 원본은 **학습자 브라우저에서만** 열린다. 서버로 올라가는 것은 파일을 알아보는 SHA-256
//    64자뿐이고, 프록시를 두지 않는다 — 두면 우리가 전송하는 것이 되어 경계가 무너진다.
//    상세는 `OverlayClient.tsx` 머리 주석과 `lib/csat/overlay.ts`.

import type { Metadata } from 'next'
import Link from 'next/link'

import { anchorCatalog } from '@/lib/csat/overlay'

import OverlayClient from './OverlayClient'

export const metadata: Metadata = {
  title: '문제지에 해설 얹기',
  description: '평가원 공개 문제지를 열면 문항마다 우리 해설을 그 자리에 붙여 드립니다.',
}

export const dynamic = 'force-dynamic'

export default function CsatOverlayPage() {
  const catalog = anchorCatalog()

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link
        href="/csat"
        className="inline-flex min-h-[44px] items-center text-sm text-[var(--t3)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
      >
        ← 기출 유형 분석
      </Link>

      <header className="mb-6 mt-2">
        <h1 className="font-display text-2xl font-bold text-[var(--t1)]">문제지에 해설 얹기</h1>
        <p className="mt-2 max-w-2xl break-keep text-sm leading-relaxed text-[var(--t2)]">
          평가원에서 받은 문제지를 열면, 문항 번호 자리에 <strong>우리 해설</strong>을 붙여
          드려요. 오답이 가리키는 선지 자리도 그 위에 표시해요.
        </p>
      </header>

      <OverlayClient catalog={catalog} />

      <p className="mt-8 max-w-3xl break-keep text-xs leading-relaxed text-[var(--t3)]">
        문항 원문은 싣지 않습니다. 지문·선지의 저작권은 한국교육과정평가원에 있고, 여기 있는 것은 그
        문항을 분석해 우리가 쓴 글입니다. 여러분이 연 문제지는 <strong>여러분 브라우저 안에서만</strong>{' '}
        열리고 우리 서버로 올라가지 않으며, 해설이 얹힌 파일을 내려받는 기능은 두지 않았습니다.
      </p>
    </main>
  )
}
