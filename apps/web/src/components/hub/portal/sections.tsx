// apps/web/src/components/hub/portal/sections.tsx
//
// 플랫폼 메인(`/hub`)의 면들 — 서버 컴포넌트. 나가는 링크만 `PromoLink`(클라이언트)가 센다.
//
// 조판 규칙(DD-68 참조 사이트 문법 — landing `app/page.tsx` 와 같은 결):
//   · 구획 머리 = 굵은 산세리프 눈썹 + 가벼운 큰 제목 + 오른쪽 글자 링크
//   · 면 색은 **대상에 고정**(`lib/design/tone.ts`) — 만화는 어디서나 주황, 수능은 보라
//   · 수치는 전부 `hub-portal-query` 가 센 것. `null` 이면 그 말 자체를 뺀다(I5)

import { ArrowRight, ArrowUpRight, Check } from 'lucide-react'
import Image from 'next/image'

import { vocabCategoryMeta } from '@/components/library/vocab/categories'
import { BTN, CARD } from '@/components/ui/tines-kit'
import { SOURCE_TRACKS } from '@/lib/articles/source-map'
import { DEEP_CLASS, MODULE_TONE, TINT_CLASS, TINT_ROTATION, MATERIAL_TONE, type ModuleKey } from '@/lib/design/tone'
import type { HubPortal, PortalBook, PortalComic } from '@/lib/learner/hub-portal-query'
import type { WayfinderModel } from '@/lib/learner/wayfinder'

import { PortalArticles } from './PortalArticles'
import { PromoLink } from './PromoLink'

const ILLO = '/illustrations/tines'
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'
const fmt = (n: number) => n.toLocaleString('ko-KR')

// ── 공통 ─────────────────────────────────────────────────────────────

export function SectionHead({ eyebrow, title, href, cta, index = 0, slot }: {
  eyebrow: string
  title: string
  href?: string
  cta?: string
  index?: number
  slot?: Parameters<typeof PromoLink>[0]['slot']
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 md:mb-8">
      <div>
        <p className="font-display text-[14px] font-[700] tracking-[0.04em] text-[var(--ju)]">{eyebrow}</p>
        <h2 className="mt-2 break-keep font-display text-[28px] font-[400] leading-[1.1] tracking-[-0.03em] text-[var(--t1)] md:text-[40px]">
          {title}
        </h2>
      </div>
      {href && cta && slot && (
        <PromoLink href={href} slot={slot} index={index} className={BTN.text}>
          {cta} <ArrowRight size={14} aria-hidden />
        </PromoLink>
      )}
    </header>
  )
}

// ── 내 학습 (배너 옆) ─────────────────────────────────────────────────

/**
 * 배너 옆 「나의 오늘」 — 셸 나침반과 **같은 모델**(`buildWayfinder`)을 읽는다.
 * 할 일 표면을 새로 만들지 않는다: 문장 · CTA · 흐름 진행이 띠와 한 글자도 다르지 않아야 한다
 * (e2e 22-H 가 `data-today-flow` 로 비교한다).
 */
export function MyTodayPanel({ model }: { model: WayfinderModel | null }) {
  if (!model) {
    return (
      <aside aria-label="시작하기" className={`${CARD.line} flex flex-col p-6 md:p-7`}>
        <p className="font-mono text-[12px] font-[700] uppercase tracking-[0.06em] text-[var(--ju)]">Start</p>
        <h2 className="mt-4 break-keep font-serif text-[26px] font-[700] leading-[1.2] text-[var(--t1)]">
          5분이면 오늘 읽을 것이 정해져요
        </h2>
        <p className="mt-3 break-keep font-body text-[15px] leading-[1.6] text-[var(--t2)]">
          몇 개의 단어를 아는지만 확인하면, 지금 읽을 수 있는 글과 오늘 만날 단어를 골라 드려요.
        </p>
        <Image src={`${ILLO}/spot-reading.webp`} alt="" width={1328} height={1328} className="mx-auto my-4 w-[150px] select-none" />
        <div className="mt-auto flex flex-col gap-2">
          <PromoLink href="/diagnostic" slot="panel" index={0} className={BTN.primary}>
            5분 시작하기 <ArrowRight size={15} aria-hidden />
          </PromoLink>
          <PromoLink href="/login?next=/hub" slot="panel" index={1} className={BTN.secondary}>
            로그인
          </PromoLink>
        </div>
      </aside>
    )
  }

  const { now, steps, done, total, past, counts, reach } = model
  return (
    <aside aria-label="나의 오늘" className={`${CARD.line} flex flex-col p-6 md:p-7`}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[12px] font-[700] uppercase tracking-[0.06em] text-[var(--ju)]">Today · {now.kicker}</p>
        {total > 0 && (
          <p data-today-flow className="font-mono text-[12px] font-[700] tabular-nums text-[var(--t2)]">
            오늘의 흐름 {done}/{total}
          </p>
        )}
      </div>
      <h2 className="mt-5 break-keep font-serif text-[22px] font-[700] leading-[1.3] text-[var(--t1)] md:text-[24px]">{now.headline}</h2>
      <PromoLink href={now.href} slot="panel" index={0} className={`${BTN.primary} mt-5 self-start`}>
        {now.cta} <ArrowRight size={15} aria-hidden />
      </PromoLink>

      <dl className="mt-6 grid grid-cols-3 gap-2 border-t border-[var(--bd)] pt-5">
        <Stat label="연속" value={`${past.streak}일`} />
        <Stat label="다시 볼 단어" value={fmt(counts.attention)} />
        <Stat label="읽을 수 있는 책" value={reach.vLevel === null ? '진단 후' : fmt(reach.open)} />
      </dl>
      {steps.length > 0 && (
        <ol aria-label="오늘의 흐름" className="mt-5 flex flex-col gap-1 border-t border-[var(--bd)] pt-4">
          {steps.map((st) => (
            <li key={st.key}>
              <PromoLink
                href={st.href}
                slot="panel"
                index={2}
                className={`flex min-h-[44px] items-center gap-3 rounded-[10px] px-2 hover:bg-[var(--bg3)] ${FOCUS}`}
              >
                <span
                  aria-hidden
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    st.done ? 'border-[var(--ju)] bg-[var(--ju)] text-[var(--on-ju)]' : st.current ? 'border-[var(--ju)]' : 'border-[var(--bd-strong)]'
                  }`}
                >
                  {st.done && <Check size={12} strokeWidth={3} />}
                </span>
                <span className={`flex-1 font-display text-[14px] ${st.current ? 'font-[700] text-[var(--t1)]' : 'font-[500] text-[var(--t2)]'} ${st.done ? 'line-through' : ''}`}>
                  {st.name}
                </span>
                <span className="sr-only">{st.done ? '완료' : st.current ? '지금 할 차례' : '남음'}</span>
                {st.current && <ArrowRight size={14} aria-hidden className="text-[var(--ju)]" />}
              </PromoLink>
            </li>
          ))}
        </ol>
      )}
      <PromoLink href="/dashboard" slot="panel" index={1} className={`${BTN.text} mt-auto pt-3`}>
        내 성장 보기 <ArrowRight size={14} aria-hidden />
      </PromoLink>
    </aside>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="break-keep font-body text-[12px] leading-tight text-[var(--t2)]">{label}</dt>
      <dd className="mt-1 font-display text-[22px] font-[600] tabular-nums tracking-[-0.02em] text-[var(--t1)]">{value}</dd>
    </div>
  )
}

// ── 바로 가기 ────────────────────────────────────────────────────────

const QUICK: { href: string; label: string; spot: string; tone: ModuleKey }[] = [
  { href: '/library/books', label: '읽기', spot: 'spot-reading', tone: 'read' },
  { href: '/wordvault', label: '단어 보관함', spot: 'spot-vault', tone: 'wordvault' },
  { href: '/flashcard', label: '플래시카드', spot: 'spot-flashcard', tone: 'flashcard' },
  { href: '/wordblitz', label: '워드블리츠', spot: 'spot-wordblitz', tone: 'wordblitz' },
  { href: '/pairflip', label: '페어플립', spot: 'spot-pairflip', tone: 'pairflip' },
  { href: '/spellforge', label: '스펠포지', spot: 'spot-spellforge', tone: 'spellforge' },
  { href: '/dictate', label: '받아쓰기', spot: 'spot-listening', tone: 'dictation' },
  { href: '/scriptquiz', label: '지문 퀴즈', spot: 'spot-quiz', tone: 'scriptquiz' },
  { href: '/comics', label: '만화', spot: 'spot-comic', tone: 'spellforge' },
  { href: '/dashboard', label: '내 성장', spot: 'spot-dashboard', tone: 'dashboard' },
]

export function QuickMenu() {
  return (
    <nav aria-label="바로 가기" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex w-max gap-3 md:gap-4 lg:grid lg:w-full lg:grid-cols-10">
        {QUICK.map((q, i) => (
          <li key={q.href}>
            <PromoLink href={q.href} slot="quick" index={i} className={`group flex w-[84px] flex-col items-center gap-2 rounded-[14px] py-1 lg:w-full ${FOCUS}`}>
              <span className={`${TINT_CLASS[MODULE_TONE[q.tone].tint]} flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full transition-transform duration-[var(--dur-quick)] ease-[var(--ease-out-quint)] group-hover:-translate-y-1 motion-reduce:transform-none md:h-[84px] md:w-[84px]`}>
                <Image src={`${ILLO}/${q.spot}.webp`} alt="" width={1328} height={1328} sizes="84px" className="h-[86%] w-[86%] select-none object-contain" />
              </span>
              <span className="break-keep text-center font-display text-[13px] font-[600] leading-tight text-[var(--t1)]">{q.label}</span>
            </PromoLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// ── 새로 들어온 고전 ─────────────────────────────────────────────────

export function NewBooksShelf({ books }: { books: PortalBook[] }) {
  if (books.length === 0) return null
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] lg:-mx-10 lg:px-10">
      <ul className="flex w-max gap-5">
        {books.map((b, i) => (
          <li key={b.id} className="w-[132px] md:w-[152px]">
            <PromoLink href={`/library/books/${b.id}`} slot="shelf" index={i} className={`group block rounded-[10px] ${FOCUS}`}>
              <span className="relative block aspect-[2/3] overflow-hidden rounded-[10px] border border-[var(--bd)] bg-[var(--bg3)] shadow-[0_1px_0_rgb(0_0_0/0.04),0_10px_24px_-14px_rgb(40_20_60/0.45)] transition-transform duration-[var(--dur-quick)] ease-[var(--ease-out-quint)] group-hover:-translate-y-1 motion-reduce:transform-none">
                {/* 표지 호스트가 여러 곳이라(next.config remotePatterns 밖도 있다) 원본을 그대로 쓴다 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
                {b.cefr && (
                  <span className="absolute left-2 top-2 inline-flex h-6 items-center rounded-full bg-[var(--bg)] px-2 font-mono text-[11px] font-[700] text-[var(--t1)]">
                    {b.cefr}
                  </span>
                )}
              </span>
              <span className="mt-3 line-clamp-2 block break-keep font-serif text-[15px] font-[700] leading-snug text-[var(--t1)] group-hover:underline">{b.title}</span>
              {b.author && <span className="mt-0.5 line-clamp-1 block font-body text-[13px] text-[var(--t2)]">{b.author}</span>}
            </PromoLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── 홍보 격자 ────────────────────────────────────────────────────────

export function PromoBento({ comics, comicTotal }: { comics: PortalComic[]; comicTotal: number | null }) {
  const covers = comics.filter((c) => c.cover).slice(0, 3)
  return (
    <div className="grid gap-4 md:grid-cols-4 md:auto-rows-[228px] md:gap-5">
      {/* 만화 — 큰 칸 */}
      <PromoLink
        href="/comics"
        slot="bento"
        index={0}
        className={`${DEEP_CLASS[MATERIAL_TONE.comic.deep]} group relative flex min-h-[360px] flex-col overflow-hidden rounded-[var(--r-2xl)] p-7 md:col-span-2 md:row-span-2 md:p-10 ${FOCUS}`}
      >
        <p className="font-mono text-[12px] font-[700] uppercase tracking-[0.06em] text-[var(--t1)]">Comics{comicTotal ? ` · ${fmt(comicTotal)}편` : ''}</p>
        <h3 className="mt-5 max-w-[12ch] break-keep font-display text-[34px] font-[400] leading-[1.06] tracking-[-0.03em] text-[var(--t1)] md:text-[48px]">
          같은 책을, 그림으로 먼저.
        </h3>
        <p className="mt-4 max-w-[30ch] break-keep font-serif text-[18px] leading-[1.45] text-[var(--t1)]">
          원서를 만화로 옮기고, 오래된 만화는 복원했어요. 줄거리를 알고 읽으면 원문이 가벼워집니다.
        </p>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-6 font-display text-[14px] font-[700] text-[var(--t1)]">
          만화 보기 <ArrowRight size={14} aria-hidden />
        </span>
        {covers.length > 0 ? (
          <span aria-hidden className="pointer-events-none absolute -bottom-6 right-6 hidden h-[240px] w-[300px] md:block">
            {covers.map((c, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={c.href}
                src={c.cover!}
                alt=""
                loading="lazy"
                className="absolute bottom-0 w-[140px] rounded-[8px] border-2 border-[var(--on-deep)] shadow-[0_18px_30px_-12px_rgb(0_0_0/0.45)] transition-transform duration-[var(--dur-normal,300ms)] ease-[var(--ease-out-quint)] motion-reduce:transform-none"
                style={{ right: `${i * 70}px`, transform: `rotate(${(i - 1) * 7}deg)`, zIndex: 3 - i }}
              />
            ))}
          </span>
        ) : (
          <Image src={`${ILLO}/tile-comics.webp`} alt="" width={1328} height={1328} className="absolute bottom-8 right-8 hidden w-[220px] rounded-[16px] md:block" />
        )}
      </PromoLink>

      <BentoCard href="/csat" index={1} tone={DEEP_CLASS.purple} wide eyebrow="CSAT" title="평가원 기출, 유형별 해부" body="출제자의 의도와 오답의 이유를 지문 위에서 따라갑니다." illo="tile-csat" />
      <BentoCard href="/dictate" index={2} tone={TINT_CLASS[MODULE_TONE.dictation.tint]} eyebrow="Listen" title="받아쓰기" body="소리를 잡고 철자로 옮겨요." illo="spot-listening" />
      <BentoCard href="/library/textbooks" index={3} tone={TINT_CLASS[MATERIAL_TONE.textbook.tint]} eyebrow="Textbook" title="교재" body="교과서 본문을 단원별로." illo="tile-textbooks" />
      <BentoCard href="/teacher" index={4} tone={DEEP_CLASS.charcoal} wide eyebrow="Teacher" title="학급의 어휘를 한 화면에서" body="초대코드 하나로 학생을 모으고 진행을 봅니다." illo="tile-teacher" />
      <BentoCard href="/dashboard" index={5} tone={TINT_CLASS.yellow} wide eyebrow="Growth" title="기억이 흐려지기 전에" body="단어마다 기억 상태를 네 색으로, 오늘 다시 볼 것부터." illo="tile-dashboard" />
    </div>
  )
}

function BentoCard({ href, index, tone, wide, eyebrow, title, body, illo }: {
  href: string
  index: number
  tone: string
  wide?: boolean
  eyebrow: string
  title: string
  body: string
  illo: string
}) {
  return (
    <PromoLink
      href={href}
      slot="bento"
      index={index}
      className={`${tone} group relative flex min-h-[210px] flex-col overflow-hidden rounded-[var(--r-2xl)] p-6 transition-[filter] duration-[var(--dur-quick)] hover:brightness-[1.04] ${wide ? 'pr-[124px] md:col-span-2 md:pr-[180px]' : 'pr-[100px] md:pr-6'} ${FOCUS}`}
    >
      <p className="font-mono text-[12px] font-[700] uppercase tracking-[0.06em] text-[var(--t1)]">{eyebrow}</p>
      <h3 className={`mt-3 break-keep font-serif font-[700] leading-[1.15] text-[var(--t1)] ${wide ? 'text-[26px]' : 'text-[22px]'}`}>{title}</h3>
      <p className={`mt-2 break-keep font-body text-[14px] leading-[1.55] text-[var(--t1)] ${wide ? 'max-w-[30ch]' : 'max-w-[16ch]'}`}>{body}</p>
      <ArrowUpRight size={18} aria-hidden className="mt-auto text-[var(--t1)] transition-transform duration-[var(--dur-quick)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none" />
      <Image
        src={`${ILLO}/${illo}.webp`}
        alt=""
        width={1328}
        height={1328}
        sizes="160px"
        className={`pointer-events-none absolute select-none rounded-[14px] ${wide ? 'bottom-5 right-5 w-[100px] md:w-[150px]' : 'bottom-4 right-4 w-[84px] md:w-[92px]'}`}
      />
    </PromoLink>
  )
}

// ── 읽을거리 ─────────────────────────────────────────────────────────

/** 주제 트랙 → 소품. 저장소에 커밋된 그림만 쓴다(`public/illustrations/tines`). */
const TRACK_SPOT: Record<string, string> = {
  listen: 'spot-listening',
  easy: 'spot-reading',
  topic: 'spot-search',
  news: 'spot-empty-page',
  argue: 'spot-echomatch',
  data: 'spot-dashboard',
  reference: 'spot-dictionary',
}

export function ReadingSection({ portal }: { portal: HubPortal }) {
  const { articles, facts } = portal
  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
      {articles.length > 0 && (
        <div className={`${CARD.line} p-6 md:p-8`}>
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-serif text-[22px] font-[700] text-[var(--t1)]">새로 올라온 글</h3>
            {facts.articles !== null && <p className="font-mono text-[12px] font-[700] tabular-nums text-[var(--t2)]">전체 {fmt(facts.articles)}편</p>}
          </div>
          <div className="mt-3">
            <PortalArticles articles={articles} />
          </div>
        </div>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {SOURCE_TRACKS.map((t, i) => (
          <li key={t.key}>
            <PromoLink
              href={`/library/scripts?series=${encodeURIComponent(t.key)}`}
              slot="reading"
              index={articles.length + i}
              className={`${TINT_CLASS[TINT_ROTATION[i % TINT_ROTATION.length]]} group flex h-full min-h-[104px] items-center gap-3 rounded-[14px] p-4 transition-[filter] duration-[var(--dur-quick)] hover:brightness-[1.03] ${FOCUS}`}
            >
              <Image src={`${ILLO}/${TRACK_SPOT[t.key] ?? 'spot-reading'}.webp`} alt="" width={1328} height={1328} sizes="64px" className="h-16 w-16 shrink-0 select-none object-contain" />
              <span className="min-w-0">
                <span className="block break-keep font-display text-[15px] font-[700] leading-snug text-[var(--t1)]">{t.title}</span>
                <span className="mt-1 line-clamp-2 block break-keep font-body text-[13px] leading-snug text-[var(--t1)] opacity-90">{t.oneLine}</span>
              </span>
            </PromoLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── 아케이드 띠 ──────────────────────────────────────────────────────

const GAMES = [
  { href: '/wordblitz', name: '워드블리츠', body: '뜻을 보고 빠르게 고르는 속도전', tile: 'tile-wordblitz' },
  { href: '/pairflip', name: '페어플립', body: '단어와 뜻, 뒤집어 짝 맞추기', tile: 'tile-pairflip' },
  { href: '/spellforge', name: '스펠포지', body: '뜻을 보고 철자를 직접 써 보기', tile: 'tile-spellforge' },
] as const

export function ArcadeBand() {
  return (
    <div className={`${DEEP_CLASS.magenta} relative overflow-hidden rounded-[var(--r-2xl)] px-6 py-10 md:px-12 md:py-14`}>
      <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="font-mono text-[12px] font-[700] uppercase tracking-[0.06em] text-[var(--t1)]">Arcade</p>
          <h2 className="mt-5 break-keep font-display text-[36px] font-[400] leading-[1.06] tracking-[-0.03em] text-[var(--t1)] md:text-[52px]">
            담은 단어로
            <br />
            한 판 더.
          </h2>
          <p className="mt-5 max-w-[32ch] break-keep font-serif text-[18px] leading-[1.5] text-[var(--t1)]">
            복습이 지루할 때는 게임으로. 문제는 내 보관함의 단어로 나옵니다.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <PromoLink href="/arcade" slot="arcade" index={0} className={BTN.onDeep}>
              아케이드 입장
            </PromoLink>
            <PromoLink href="/arcade/ranking" slot="arcade" index={1} className={`${BTN.text} text-[var(--t1)]`}>
              랭킹 보기 <ArrowRight size={14} aria-hidden />
            </PromoLink>
          </div>
        </div>
        <ul className="grid grid-cols-3 gap-2 sm:gap-4">
          {GAMES.map((g, i) => (
            <li key={g.href}>
              <PromoLink
                href={g.href}
                slot="arcade"
                index={2 + i}
                className={`group flex h-full flex-col rounded-[14px] bg-[var(--on-deep)] p-2 sm:rounded-[18px] sm:p-3 transition-transform duration-[var(--dur-quick)] ease-[var(--ease-out-quint)] hover:-translate-y-1 motion-reduce:transform-none ${FOCUS}`}
              >
                <Image src={`${ILLO}/${g.tile}.webp`} alt="" width={1328} height={1328} sizes="(min-width: 640px) 220px, 90vw" className="aspect-square w-full select-none rounded-[12px] object-cover" />
                <span className="mt-2 px-1 break-keep font-serif text-[15px] font-[700] text-[var(--on-ju)] sm:mt-3 sm:text-[19px]">{g.name}</span>
                <span className="mb-1 mt-1 hidden px-1 break-keep font-body sm:block text-[13px] leading-snug text-[var(--on-ju)] opacity-90">{g.body}</span>
              </PromoLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ── 단어장 컬렉션 ────────────────────────────────────────────────────

export function VocabCollections({ categories }: { categories: HubPortal['setCategories'] }) {
  const shown = categories
    .map((c) => ({ ...c, meta: vocabCategoryMeta(c.id) }))
    .filter((c): c is typeof c & { meta: NonNullable<typeof c.meta> } => c.meta !== null)
  if (shown.length === 0) return null
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {shown.map((c, i) => (
        <li key={c.id}>
          <PromoLink
            href="/library/vocab"
            slot="vocab"
            index={i}
            className={`${TINT_CLASS[TINT_ROTATION[(i + 2) % TINT_ROTATION.length]]} group flex min-h-[148px] flex-col justify-between rounded-[14px] p-5 transition-[filter] duration-[var(--dur-quick)] hover:brightness-[1.03] ${FOCUS}`}
          >
            <span>
              <span className="block font-serif text-[20px] font-[700] text-[var(--t1)]">{c.meta.label}</span>
              <span className="mt-1 block break-keep font-body text-[13px] text-[var(--t1)] opacity-90">{c.meta.hint}</span>
            </span>
            <span className="flex items-end justify-between">
              <span className="font-display text-[34px] font-[500] tabular-nums leading-none tracking-[-0.03em] text-[var(--t1)]">
                {fmt(c.count)}
                <span className="ml-1 font-body text-[13px] font-[500] tracking-normal">세트</span>
              </span>
              <ArrowUpRight size={16} aria-hidden className="text-[var(--t1)]" />
            </span>
          </PromoLink>
        </li>
      ))}
    </ul>
  )
}

// ── 서가 규모 ────────────────────────────────────────────────────────

export function ScaleBand({ facts }: { facts: HubPortal['facts'] }) {
  const items = [
    { value: facts.books, label: '권의 고전', sub: '챕터별 어휘 포함' },
    { value: facts.articles, label: '편의 글', sub: `${SOURCE_TRACKS.length}개 주제 시리즈` },
    { value: facts.comics, label: '편의 만화', sub: '원서 만화 · 복원' },
    { value: facts.curatedSets, label: '개의 단어장', sub: '범주별 큐레이션' },
  ].filter((i): i is { value: number; label: string; sub: string } => i.value !== null)
  if (items.length === 0) return null
  return (
    <div className="relative overflow-hidden rounded-[var(--r-2xl)] bg-[var(--tint-lavender)] px-6 py-10 md:px-12 md:py-14">
      <Image src={`${ILLO}/pattern-kaleido-1.webp`} alt="" width={1664} height={928} sizes="40vw" className="pointer-events-none absolute -right-20 -top-10 hidden w-[520px] select-none opacity-60 lg:block" />
      <div className="relative">
        <p className="font-display text-[14px] font-[700] tracking-[0.04em] text-[var(--ju)]">지금 서가에는</p>
        <ul className="mt-6 grid grid-cols-2 gap-x-8 gap-y-8 lg:grid-cols-4">
          {items.map((i) => (
            <li key={i.label}>
              <p className="font-display text-[40px] font-[500] tabular-nums leading-none tracking-[-0.03em] text-[var(--t1)] md:text-[56px]">{fmt(i.value)}</p>
              <p className="mt-2 font-serif text-[17px] font-[700] text-[var(--t1)]">{i.label}</p>
              <p className="mt-0.5 font-body text-[13px] text-[var(--t2)]">{i.sub}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
