// apps/web/src/app/(main)/csat/drill/page.tsx
//
// **오답 감별 훈련** — 재설계가 남겨 둔 구멍(③ 겨루기)을 메우는 화면.
//
// 허브와 유형 화면은 학습자가 ①**알고** ②**짚게** 한다. 그런데 거기까지는 **읽고 납득하는**
// 물건이고 **인출이 일어나지 않는다**(원칙 1 Active Recall). 아홉 가지를 아무리 잘 읽어도
// 다음 지문에서 그것을 알아보는 것은 다른 능력이다.
//
// ⚠️ **지문이 필요 없는 문제다.** 쓰이는 글은 전부 우리가 쓴 오답 해설이라, 평가원 저작물을
//    한 글자도 안 쓰고 1,934개의 훈련 문제가 나온다. 저작권 경계를 건드리지 않는 유일한 형태다.
//
// ⚠️ **`<main>` 이 아니라 `<div>` 다** — 셸이 이미 `<main id="main-content">` 를 그린다.
//    중첩하면 스크린리더가 본문을 못 짚는데 axe 의 wcag2a/aa 로는 안 잡힌다(best-practice 규칙).

import type { Metadata } from 'next'
import Link from 'next/link'

import { TrapDrill } from '@/components/csat/TrapDrill'
import { DRILL_SIZE, loadTrapDrill } from '@/lib/csat/drill-loader'
import { universalCoverage } from '@/lib/csat/trap-atlas'

export const metadata: Metadata = {
  title: '오답 감별 훈련 — 기출 유형 분석',
  description: '평가원 기출 오답 해설을 읽고 그 수법의 이름을 맞히는 훈련. 지문 없이 풀 수 있습니다.',
}

export const dynamic = 'force-dynamic'

export default async function CsatDrillPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string }>
}) {
  const { set } = await searchParams
  // 세트 씨앗. 같은 씨앗이면 같은 여덟 문제가 나온다 — 「여덟 개 더」가 새 씨앗을 준다.
  // 값을 그대로 쓰지 않고 길이를 잘라 둔다(URL 로 들어온 문자열을 무제한으로 씨앗에 넣지 않는다).
  const seed = (set ?? 'first').slice(0, 40)
  // 구운 JSON 을 읽을 뿐이라 **조회 왕복이 0** 이다(동기 함수인 이유).
  const { cards, pool, error } = loadTrapDrill(seed, DRILL_SIZE)
  const cover = universalCoverage()

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link
        href="/csat"
        className="inline-flex min-h-[44px] items-center text-sm text-[var(--t3)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
      >
        ← 오답 지도
      </Link>

      <header className="mb-5 mt-2">
        <h1 className="break-keep font-editorial text-2xl font-[600] text-[var(--t1)]">오답 감별 훈련</h1>
        {/* 무엇을 재는 훈련인지 먼저 말한다 — 「지문 풀이」로 오해하면 실망한다. */}
        <p className="mt-2 max-w-2xl break-keep text-sm leading-relaxed text-[var(--t2)]">
          기출 오답 해설을 읽고 <strong>그 수법의 이름</strong>을 고릅니다. 이름을 한 번 꺼내 본 수법은 다음
          지문에서 눈에 걸려요 — 지도에서 본 {cover.kinds}가지가 여기 나옵니다.
        </p>
      </header>

      {error ? (
        <p className="break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4 text-sm text-[var(--t2)]">
          지금은 훈련 문제를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
        </p>
      ) : (
        <TrapDrill cards={cards} pool={pool} />
      )}

      <p className="mt-8 break-keep text-xs leading-relaxed text-[var(--t3)]">
        문항 원문은 싣지 않습니다. 여기 있는 글은 전부 그 문항을 분석해 우리가 쓴 것입니다.
        지문·선지의 저작권은 한국교육과정평가원에 있어요.
      </p>
    </div>
  )
}
