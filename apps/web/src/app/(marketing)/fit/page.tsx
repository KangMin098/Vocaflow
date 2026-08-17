// apps/web/src/app/(marketing)/fit/page.tsx
// 지문 난이도 진단 — 로그인 없이 영어 지문의 학년 수준을 판정하는 공개 화면.
//
// 왜 마케팅 그룹인가:
//   (main) 학습자 표면은 이미 22개이고 진단 F5 가 "표면 4개 이하" 를 목표로 잡았다.
//   이 화면은 학습 모듈이 아니라 **가입 전에 가치를 보여주는 관문**이라 (marketing) 이 맞다.
//   학습자 표면 수를 늘리지 않는다.
//
// 왜 공개인가 (2026-08-16 진단 §6):
//   10만 학습자로 가는 유일하게 계산이 맞는 경로는 교사 3,500명 × 학급 30명(CAC 0)이다.
//   그런데 결정적 기능이 로그인 뒤에 있으면 교사는 가입 전에 가치를 볼 수 없다.
//   허용 CAC 가 가입당 ₩400 인 시장에서, 관문 앞에 둘 수 있는 가치가 유일한 획득 수단이다.

import type { Metadata } from 'next'
import Link from 'next/link'

import { PublicFitClient } from '@/components/textfit/PublicFitClient'

export const metadata: Metadata = {
  title: '지문 난이도 진단 · Vocaflow',
  description:
    '영어 지문을 붙여넣으면 중1부터 학술 원서까지 학년별로 몇 %가 읽히는지 바로 보여드립니다. 로그인 없이, 저장하지 않고.',
  openGraph: {
    title: '이 지문, 우리 반에 맞을까? · Vocaflow',
    description: '지문을 붙여넣으면 학년별 어휘 커버리지가 바로 나옵니다. 로그인 불필요.',
  },
}

/** 이 화면이 답하는 질문들 — 교사가 실제로 쓰는 말로 적는다. */
const QUESTIONS = [
  {
    q: '이 지문, 우리 반에 맞나요?',
    a: '학년별로 몇 %가 읽히는지 한 번에 나옵니다. 하나의 숫자가 아니라 학년축 전체 곡선이라, 반 편성이 섞여 있어도 판단할 수 있어요.',
  },
  {
    q: '몇 학년용 지문인가요?',
    a: '어휘 커버리지가 95%(편하게 읽히는 기준)에 처음 닿는 학년을 적정 레벨로 표시합니다.',
  },
  {
    q: '어떤 단어를 미리 짚어야 하나요?',
    a: '지문에서 가장 어려운 단어를 V-Level과 함께 뽑아 줍니다. 수업 전 5분 어휘 예습에 그대로 쓸 수 있어요.',
  },
]

export default function FitPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <header className="mb-9 flex flex-col gap-3">
        <p className="m-0 font-mono text-[11px] font-[700] uppercase tracking-[0.10em] text-[var(--p)]">
          지문 난이도 진단
        </p>
        <h1 className="m-0 text-balance font-display text-[30px] font-[800] leading-[1.2] tracking-[-0.03em] text-[var(--t1)] md:text-[38px]">
          이 지문, 우리 반에 맞을까?
        </h1>
        <p className="m-0 max-w-[52ch] font-body text-[15px] leading-[1.75] text-[var(--t2)] md:text-[16px]">
          영어 지문을 붙여넣으면 <b>중1부터 학술 원서까지 학년별로 몇 %가 읽히는지</b> 바로
          나옵니다. 가입도, 설치도 필요 없습니다. 붙여넣은 지문은 저장하지 않습니다.
        </p>
      </header>

      <PublicFitClient />

      {/* ── 이 화면이 답하는 것 ── */}
      <section aria-label="자주 쓰는 방법" className="mt-14 flex flex-col gap-4">
        <h2 className="m-0 font-display text-[18px] font-[750] tracking-[-0.02em] text-[var(--t1)]">
          이럴 때 씁니다
        </h2>
        <dl className="m-0 grid grid-cols-1 gap-3">
          {QUESTIONS.map(({ q, a }) => (
            <div
              key={q}
              className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-5"
            >
              <dt className="font-display text-[14.5px] font-[700] text-[var(--t1)]">{q}</dt>
              <dd className="m-0 mt-2 font-body text-[13.5px] leading-[1.7] text-[var(--t2)]">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── 방법 근거 ── */}
      <section
        aria-label="판정 근거"
        className="mt-10 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-5 md:p-6"
      >
        <h2 className="m-0 font-display text-[15px] font-[750] tracking-[-0.02em] text-[var(--t1)]">
          어떻게 재나요
        </h2>
        <ul className="mt-3 flex list-disc flex-col gap-2.5 pl-5 font-body text-[13.5px] leading-[1.7] text-[var(--t2)]">
          <li>
            지문의 <b>러닝 워드</b>(기능어 포함) 대비, 해당 학년이 아는 어휘의 비율을 셉니다 — Hu &amp;
            Nation(2000)의 어휘 커버리지 정의입니다.
          </li>
          <li>
            기준선 <b>98%·95%</b>는 같은 연구의 읽기 이해 임계에서 왔습니다. 이후 재현
            연구(Kremmel 외, 2023)가 90~98% 사이 차이는 크지 않다고 보고해, 하나의 절벽이 아니라{' '}
            <b>구간</b>으로 표시합니다.
          </li>
          <li>
            학년별 어휘는 자체 학습 어휘 목록(표제어 <b>20,776</b>개, V-Level 1~11)을 씁니다. 레벨을
            확인할 수 없는 단어는 <b>감추지 않고</b> 범위로 표시합니다.
          </li>
          <li>
            영영 사전 <b>47,137</b> 표제어와 도서–어휘 연결 <b>1,678,478</b>건 위에서 동작합니다.
          </li>
        </ul>
        <p className="m-0 mt-4 font-body text-[12.5px] leading-[1.65] text-[var(--t3)]">
          더 자세한 원리는{' '}
          <Link
            href="/about"
            className="border-b border-[var(--p)] text-[var(--p)] transition-opacity duration-[var(--dur-normal)] hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
          >
            소개
          </Link>
          에서 볼 수 있어요.
        </p>
      </section>
    </div>
  )
}
