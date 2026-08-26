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
import { redirect } from 'next/navigation'

import { PublicFitClient } from '@/components/textfit/PublicFitClient'
import { absoluteUrl } from '@/lib/seo/site'

import { SHARE_PARAM, SHARE_PATH, decodeProfile } from '@/lib/textfit/share'

const BASE_TITLE = '지문 난이도 진단 · Vocaflow'
const BASE_DESC =
  '영어 지문을 붙여넣으면 중1부터 학술 원서까지 학년별로 몇 %가 읽히는지 바로 보여드립니다. 로그인 없이, 저장하지 않고.'

type SearchParams = { [key: string]: string | string[] | undefined }

/** `?r=` 값을 문자열 하나로 — 배열로 오면(중복 파라미터) 첫 번째만 본다. */
function readShareParam(sp: SearchParams | undefined): string | null {
  const raw = sp?.[SHARE_PARAM]
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) return raw[0] ?? null
  return null
}

/**
 * 이 화면은 **도구 자체**다 — 검색으로 들어오는 문이라 색인 대상이다.
 * 공유받은 결과는 `/fit/s/[payload]` 가 따로 담당한다(그쪽은 noindex + 결과 미리보기 이미지).
 */
import { fetchPlatformFacts, formatCount } from '@/lib/marketing/trust-signals'

export const metadata: Metadata = {
  title: BASE_TITLE,
  description: BASE_DESC,
  keywords: [
    '영어 지문 난이도',
    '수능 영어 지문 수준',
    '영어 지문 몇 학년',
    '어휘 커버리지',
    '내신 영어 지문 분석',
    '영어 단어 수준 측정',
  ],
  alternates: { canonical: absoluteUrl('/fit') },
  openGraph: {
    type: 'website',
    url: absoluteUrl('/fit'),
    title: '이 지문, 우리 반에 맞을까?',
    description: BASE_DESC,
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

/**
 * 구조화 데이터 — 화면에 이미 있는 문답을 검색엔진이 읽을 수 있는 형태로 한 번 더 낸다.
 *
 * ⚠️ `QUESTIONS` 배열을 그대로 쓴다. 여기 답을 따로 적으면 화면과 구조화 데이터가 갈라지고,
 *    그건 검색엔진이 "페이지에 없는 내용을 마크업했다" 로 보는 위반이다.
 */
function structuredData(): string {
  return JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: '지문 난이도 진단',
      url: absoluteUrl('/fit'),
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web',
      inLanguage: 'ko',
      description: BASE_DESC,
      // 무료이고 가입도 필요 없다 — 이게 이 화면의 핵심 성질이라 명시한다.
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
      featureList: [
        '영어 지문 학년별 어휘 커버리지 분석',
        '적정 학년 판정',
        '지문 내 고난도 단어 추출',
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: QUESTIONS.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
  ])
}

/**
 * ⚠️ 이 화면이 인용하는 수치는 **상수로 적지 않는다.**
 *    2026-08-26 실측에서 여기 박혀 있던 두 수(47,137 · 1,678,478)가 9일 만에 어긋나 있었다.
 *    `components/marketing/__tests__/no-hardcoded-stats.test.ts` 가 재발을 막는다.
 */
export default async function FitPage({ searchParams }: { searchParams?: SearchParams }) {
  const facts = await fetchPlatformFacts()
  // 구버전 공유 링크(`/fit?r=`) 호환 — 이미 복사돼 돌아다니는 주소를 죽이지 않는다.
  // 새 링크는 `/fit/s/<payload>` 이고, 그쪽에만 미리보기 이미지가 붙는다.
  const legacyShared = decodeProfile(readShareParam(searchParams))
  if (legacyShared) redirect(`${SHARE_PATH}/${readShareParam(searchParams)}`)

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <script
        type="application/ld+json"
        // 내용이 코드에서 만든 JSON 문자열이라 사용자 입력이 섞이지 않는다.
        dangerouslySetInnerHTML={{ __html: structuredData() }}
      />
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
        <ul className="mt-3 flex list-disc flex-col gap-3 pl-5 font-body text-[13.5px] leading-[1.7] text-[var(--t2)]">
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
            학년별 어휘는 자체 학습 어휘 목록(V-Level 1~11)을 씁니다.
            레벨을 확인할 수 없는 단어는 <b>감추지 않고</b> 범위로 표시합니다.
          </li>
          <li>
            {facts ? (
              <>
                영영 사전 <b>{formatCount(facts.headwords)}</b> 표제어와 도서–어휘 연결{' '}
                <b>{formatCount(facts.bookVocabLinks)}</b>건 위에서 동작합니다.
              </>
            ) : (
              <>영영 사전과 도서–어휘 연결 위에서 동작합니다.</>
            )}
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
