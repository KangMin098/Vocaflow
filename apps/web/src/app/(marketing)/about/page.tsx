// apps/web/src/app/(marketing)/about/page.tsx
// @form: 망각 — 학습 과학 벤토의 망각 칸이 낱말마다 다른 잊는 속도(ILLO 08)를 그린다
//
// 소개 — 참조 사이트 제품 페이지(`/3b/`) 골격(DD-68 · tines-mapping §2):
// 2열 히어로 + 영상 액자 → 영상 3열 → 보라 통판(디자인 방향 4) → 벤토(학습 과학 7) → 색면 모듈 카드 → 약속 목록.
// 끝 CTA 는 레이아웃(`MarketingTail`)이 맡는다.

import Image from 'next/image'
import Link from 'next/link'

import { Illustration } from '@/components/illustrations/Illustration'
import { ILLO_08_DECAY_PER_WORD } from '@/components/illustrations/generated/illo-08-decay-per-word'
import { Bento, Frame, Hero2Col, PurplePanel, SectionHead, ToneCards, WRAP, type Tone } from '@/components/marketing/sections'
import { ComponentVideo } from '@/components/video/ComponentVideo'
import { introVideo, videosByKind } from '@/lib/video/catalog'

const PHILOSOPHY = [
  { title: '차분한 인터페이스', body: '학습 중 시각·청각 자극을 줄입니다. 광고도, 알림도, 빨간 카운터도 없어요.', note: 'Calm UI' },
  { title: '점진적 공개', body: '본질만 먼저 보여 주고, 깊이는 원할 때 펼칩니다.', note: 'Progressive Disclosure' },
  { title: '공감 피드백', body: '비난 대신 격려. "오답"이 아니라 "다시 만나 봐요".', note: 'Empathetic Feedback' },
  { title: '암묵적 진행', body: '숫자 대신 환경의 변화로 성장을 보여 줍니다 — 단어 색이 바뀌는 것처럼.', note: 'Implicit Progress' },
]

const SCIENCE: { kicker: string; title: string; body: string; span?: 1 | 2; illo?: string; decay?: boolean }[] = [
  { kicker: '01 · Active Recall', title: '능동적 회상', body: '떠올리는 연습이 알아보는 연습보다 강한 기억을 만듭니다 (Karpicke & Roediger, 2008).', span: 2, illo: 'spot-quiz' },
  { kicker: '02 · Spaced Repetition', title: '간격 반복', body: '잊을 때쯤 다시 만나면 기억이 단단해집니다. 간격은 FSRS 가 단어마다 계산해요.', illo: 'spot-memory' },
  { kicker: '03 · Desirable Difficulty', title: '바람직한 어려움', body: '약간의 분투가 오래 남게 합니다 (Bjork).' },
  { kicker: '04 · Dual Coding', title: '이중 부호화', body: '말과 그림·소리가 함께 들어오면 기억은 두 길로 들어옵니다 (Paivio).', illo: 'spot-listening' },
  { kicker: '05 · Context-Dependent', title: '맥락 의존 기억', body: '배운 그 글에서 다시 만나면 떠올리기가 더 쉬워집니다.', illo: 'spot-reading' },
  { kicker: '06 · Cognitive Load', title: '인지 부하', body: '작업기억은 한 번에 네 가지 남짓만 다룹니다 (Sweller). 한 번에 한 단어부터.' },
  { kicker: '07 · Forgetting', title: '잊는 속도는 단어마다 다릅니다', body: '같은 날 배운 단어도 기억이 풀리는 속도가 다릅니다 — 그래서 복습 날짜도 단어마다 다릅니다.', span: 2, decay: true },
]

const MODULES: { title: string; body: string; href: string; tone: Tone; illo: string }[] = [
  { title: '읽기', body: '스크립트를 넣으면 모르는 단어를 뽑아 줍니다.', href: '/text', tone: 'success', illo: 'spot-reading' },
  { title: '단어 보관함', body: '담은 단어를 문맥과 함께 모읍니다.', href: '/wordvault', tone: 'ju', illo: 'spot-vault' },
  { title: '플래시카드', body: 'FSRS 간격 반복으로 떠올립니다.', href: '/flashcard', tone: 'info', illo: 'spot-memory' },
  { title: '스펠포지', body: '직접 쳐서 철자까지 떠올립니다.', href: '/spellforge', tone: 'warning', illo: 'spot-quiz' },
  { title: '지문 퀴즈', body: '읽은 글의 이해를 문항으로 확인합니다.', href: '/scriptquiz', tone: 'p', illo: 'spot-quiz' },
  { title: '받아쓰기', body: '소리를 글로 옮기며 듣기를 잡습니다.', href: '/dictate', tone: 'success', illo: 'spot-listening' },
  { title: '대시보드', body: '기억 상태를 색의 변화로 봅니다.', href: '/dashboard', tone: 'ju', illo: 'spot-memory' },
  { title: '워드블리츠', body: '빠르게 알아보는 연습 게임.', href: '/play/wordblitz', tone: 'info', illo: 'spot-vault' },
]

const PROMISES = [
  { not: '정확도를 빨간 글씨로 압박하기', instead: '진행은 색과 여백의 변화로 보여 줍니다.' },
  { not: '연속 학습이 끊겼다고 알리는 창', instead: '잠시 떠나도 탓하지 않습니다. 돌아오면 그냥 반겨요.' },
  { not: '오답을 빨강으로만 표시하기', instead: '색에 기대지 않고 "다시 만나 봐요" 로 말합니다.' },
  { not: '학습 흐름을 끊는 광고 · 업셀', instead: '학습 중에는 어떤 방해도 없습니다.' },
  { not: '100% 에 폭죽 · 트로피', instead: '"오늘 잘 마쳤어요" 한 줄이면 충분합니다.' },
]

export const metadata = {
  title: '소개',
  description: '영어를 오래 가게 만드는 학습 — 학습 방향 4개와 학습 과학 7개를 도구로 합니다.',
}

export default function AboutPage() {
  const intro = introVideo()
  const benefitVideos = videosByKind().benefit

  return (
    <div className="bg-[var(--bg)]">
      <Hero2Col
        kicker="우리의 미션"
        title={<>영어를 오래 가게<br />만드는 학습.</>}
        sub="단어를 외우는 게 아니라 머리에 남도록. 학습 과학과 디자인을 도구로, 차분하게 단단하게 오래."
        ctas={[{ href: '/fit', label: '지문 난이도 재 보기', primary: true }, { href: '/signup', label: '무료로 시작하기' }]}
        media={
          <Frame>
            {intro ? (
              <ComponentVideo video={intro} />
            ) : (
              <Image src="/illustrations/tines/tile-about.webp" alt="" width={1328} height={1328} priority sizes="(min-width: 1024px) 50vw, 100vw" className="h-auto w-full" />
            )}
          </Frame>
        }
      />

      {/* ── 다른 점 세 가지 — 각 영상이 그 주장을 화면에서 증명한다 ── */}
      {benefitVideos.length > 0 && (
        <section className={`${WRAP} pb-24`}>
          <SectionHead kicker="다른 점 세 가지" title="말 대신 화면으로 증명합니다." sub="각 영상은 근거와 출처를 함께 보여 줍니다." />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {benefitVideos.map((v) => (
              <article key={v.id}>
                <Frame><ComponentVideo video={v} /></Frame>
                <h3 className="mt-3 break-keep font-serif text-[20px] font-[700]">
                  <Link href={`/video/${v.id}`} className="text-[var(--ju)] underline-offset-4 hover:underline">{v.title}</Link>
                </h3>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ── 디자인 방향 4 — 보라 통판 ── */}
      <PurplePanel
        kicker="디자인 방향"
        title={<>학습은 차분할수록<br />깊어집니다.</>}
        items={PHILOSOPHY}
        cta={{ href: '/video', label: '영상으로 보기' }}
      />

      {/* ── 학습 과학 7 — 벤토 ── */}
      <section className={`${WRAP} py-24 lg:py-32`}>
        <SectionHead kicker="학습 과학" title="인지심리학이 입증한 일곱 가지 원칙." sub="모든 모듈은 적어도 하나의 원칙에 근거합니다." />
        <div className="mt-12">
          <Bento
            cells={SCIENCE.map((s) => ({
              kicker: s.kicker,
              title: s.title,
              body: s.body,
              span: s.span,
              illo: s.illo,
              media: s.decay ? <Illustration asset={ILLO_08_DECAY_PER_WORD} /> : undefined,
            }))}
          />
        </div>
      </section>

      {/* ── 모듈 — 색면 카드 ── */}
      <section className={`${WRAP} pb-24`}>
        <SectionHead kicker="모듈" title="하나의 스크립트, 여러 번의 만남." sub="같은 단어를 여러 맥락에서 만날 때 기억은 단단해집니다." />
        <div className="mt-12">
          <ToneCards items={MODULES} columns={4} />
        </div>
      </section>

      {/* ── 약속 — 하지 않는 것 ── */}
      <section className={`${WRAP} pb-24`}>
        <SectionHead kicker="약속" title="저희가 하지 않는 것들." serifTitle />
        <ul className="mt-10 divide-y divide-[var(--bd)] border-y border-[var(--bd)]">
          {PROMISES.map((p) => (
            <li key={p.not} className="grid gap-2 py-6 md:grid-cols-[1fr_1.4fr] md:gap-10">
              <p className="break-keep font-body text-[16px] text-[var(--ju)] line-through decoration-[var(--ju)]/50">{p.not}</p>
              <p className="break-keep font-serif text-[20px] leading-[1.45] text-[var(--ju)]">{p.instead}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
