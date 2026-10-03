// apps/web/src/components/hub/portal/tines-bands.tsx
//
// 허브의 Tines **하위 화면** 어휘 — 홈 띠만으로는 면이 보라 한 색으로 몰려서(2026-10-04 사용자 요청),
// 참조의 다른 화면에서 골격을 더 가져온다. 서버 컴포넌트.
//
//   참조 화면                                   → 여기
//   /solutions/security 히어로 양옆 떠 있는 판   → HeroFlanks(우리 삽화 hero-iso-left/right)
//   /solutions/security 가는 선 사이 2단 진술     → StatementBand
//   /customers 메이슨리 벽(배지 · 책 카드 · 수치)  → ShelfWall — 후기는 지어내지 않는다: 수치는 DB(I5), 표지는 발행 도서
//   /webinars/* 자두색 등록 판                    → ShelfWall 안의 진단 카드(DEEP magenta)

import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import type { CSSProperties, ReactNode } from 'react'

import { BTN } from '@/components/ui/tines-kit'
import { DEEP_CLASS, TINT_CLASS, type Deep, type Tint } from '@/lib/design/tone'
import type { HubPortal, PortalBook } from '@/lib/learner/hub-portal-query'

import { PromoLink } from './PromoLink'

const ILLO = '/illustrations/tines'
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'
const fmt = (n: number) => n.toLocaleString('ko-KR')
const EDGE = 'border border-[color-mix(in_srgb,var(--t1)_30%,transparent)]'

// ── 히어로 양옆 ──────────────────────────────────────────────────────

/** PC 전용 장식. 제목과 겹치지 않게 넓은 화면(lg)에서만 선다. */
export function HeroFlanks() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 hidden h-full lg:block">
      <Image
        src={`${ILLO}/hero-iso-left.webp`}
        alt=""
        width={1328}
        height={1328}
        sizes="300px"
        priority
        className="vf-float absolute -left-6 top-4 w-[280px] select-none xl:w-[320px]"
        style={{ '--float-dur': '7s', '--float-y': '4%' } as CSSProperties}
      />
      <Image
        src={`${ILLO}/hero-iso-right.webp`}
        alt=""
        width={1328}
        height={1328}
        sizes="300px"
        className="vf-float absolute -right-6 top-[38%] w-[260px] select-none xl:w-[300px]"
        style={{ '--float-dur': '8s', '--float-y': '5%', '--float-delay': '1.2s' } as CSSProperties}
      />
    </div>
  )
}

// ── 가는 선 사이 2단 진술 ────────────────────────────────────────────

export function StatementBand() {
  return (
    <div className="mx-auto grid max-w-[1040px] gap-6 border-y border-[var(--bd)] py-14 md:grid-cols-[1.05fr_1fr] md:gap-16 md:py-20">
      <h2 className="break-keep font-serif text-[28px] font-[400] leading-[1.2] tracking-[-0.01em] text-[var(--ju)] md:text-[34px]">
        외운 단어가 금방 사라지는 건, 문장 없이 외웠기 때문입니다.
      </h2>
      <p className="break-keep font-body text-[15px] leading-[1.7] text-[var(--ju)] md:pt-2">
        Vocaflow 는 단어를 따로 떼어 주지 않습니다. 읽던 글의 그 문장째 보관함에 담고, 기억이 흐려질 때쯤 같은 문장으로
        다시 불러냅니다. 읽기 · 복습 · 퀴즈 · 게임이 모두 한 서가의 같은 글에서 나오기 때문에, 오늘 한 공부가 내일 읽을 글의
        이해로 그대로 이어집니다.
      </p>
    </div>
  )
}

// ── 메이슨리 서가 벽 (참조 /customers) ───────────────────────────────

type Stat = { key: string; label: string; value: number | null; unit: string; tint: Tint; deep: Deep; href: string }

/** 참조의 「83% reduction」 책 카드 — 옅은 면 왼쪽 위에 이름, 오른쪽에 짙은 책(책갈피 홈)과 큰 수. */
function StatBook({ s, index }: { s: Stat & { value: number }; index: number }) {
  return (
    <PromoLink href={s.href} slot="bento" index={70 + index} className={`${TINT_CLASS[s.tint]} ${EDGE} group relative flex h-[230px] rounded-[14px] p-2 ${FOCUS}`}>
      <span className="w-[36%] break-keep p-3 font-serif text-[15px] leading-[1.2] text-[var(--t1)]">{s.label}</span>
      <span className={`${DEEP_CLASS[s.deep]} relative ml-auto flex w-[64%] flex-col justify-end rounded-[6px] p-4 text-right transition-transform duration-[var(--dur-quick)] group-hover:-translate-y-0.5 motion-reduce:transform-none`}>
        {/* 책갈피 — 오른쪽 위 홈 */}
        <span aria-hidden className="absolute right-3 top-0 h-6 w-4 bg-[color-mix(in_srgb,var(--on-deep)_22%,transparent)] [clip-path:polygon(0_0,100%_0,100%_100%,50%_72%,0_100%)]" />
        <span className="font-serif text-[40px] font-[400] leading-none tabular-nums text-[var(--t1)]">{fmt(s.value)}</span>
        <span className="mt-1.5 font-display text-[12px] font-[700] leading-tight text-[var(--t1)]">{s.unit}</span>
      </span>
    </PromoLink>
  )
}

/** 참조의 표지 책 카드(Intercom) — 옅은 면 + 오른쪽에 책 모양으로 놓인 실제 표지와 책갈피. */
function CoverBook({ book, tint, index }: { book: PortalBook; tint: Tint; index: number }) {
  const meta = [book.cefr, book.minutes ? `${fmt(Math.max(1, Math.round(book.minutes / 60)))}시간 분량` : null].filter(Boolean).join(' · ')
  return (
    <PromoLink href={`/library/books/${book.id}`} slot="bento" index={80 + index} className={`${TINT_CLASS[tint]} ${EDGE} group flex h-[190px] gap-3 rounded-[14px] p-2 ${FOCUS}`}>
      <span className="flex w-[42%] flex-col p-3">
        <span className="font-mono text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--t1)]">New classic</span>
        {meta && <span className="mt-auto font-body text-[12px] text-[var(--t1)]">{meta}</span>}
      </span>
      <span className="relative ml-auto w-[58%] overflow-hidden rounded-[6px] transition-transform duration-[var(--dur-quick)] group-hover:-translate-y-0.5 motion-reduce:transform-none">
        {/* eslint-disable-next-line @next/next/no-img-element -- 표지는 여러 외부 호스트(sections.tsx 와 같은 방식) */}
        <img src={book.cover} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        <span aria-hidden className="absolute right-3 top-0 h-6 w-4 bg-[var(--bg)] opacity-80 [clip-path:polygon(0_0,100%_0,100%_100%,50%_72%,0_100%)]" />
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 text-right font-serif text-[15px] font-[600] leading-tight text-white">
          {book.title}
        </span>
      </span>
    </PromoLink>
  )
}

/** 참조 G2 배지 자리 — 우리는 상패가 없으니 진단이 매기는 **척도**를 배지로 세운다(수치 주장 아님). */
function LevelBadge() {
  return (
    <PromoLink href="/diagnostic" slot="bento" index={90} className={`${TINT_CLASS.lavender} ${EDGE} flex h-[250px] items-center justify-center rounded-[14px] ${FOCUS}`}>
      <svg viewBox="0 0 120 150" role="img" aria-label="Vocaflow 읽기 수준 척도 V0에서 V11" className="w-[124px]">
        <path d="M4 4h112v104L60 146 4 108z" fill="var(--bg)" stroke="var(--t1)" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M4 4h112v22H4z" fill="var(--bg)" stroke="var(--t1)" strokeWidth="2.5" />
        <text x="60" y="19.5" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fontWeight="700" letterSpacing="1" fill="var(--t1)">VOCAFLOW</text>
        <text x="60" y="66" textAnchor="middle" fontFamily="var(--font-display)" fontSize="22" fontWeight="700" fill="var(--t1)">V0–V11</text>
        <text x="60" y="84" textAnchor="middle" fontFamily="var(--font-body)" fontSize="10" fontWeight="600" fill="var(--t1)">읽기 수준 척도</text>
        <path d="M5.5 100 60 128l54.5-28v8L60 136 5.5 108z" fill="var(--deep-orange)" />
        <path d="M5.5 92 60 120l54.5-28v8L60 128 5.5 100z" fill="var(--tint-peach)" />
        <path d="M5.5 108 60 136l54.5-28v.8L60 145 5.5 108.8z" fill="var(--deep-magenta)" />
      </svg>
    </PromoLink>
  )
}

/** 참조 /webinars 자두색 등록 판 — 우리는 5분 진단 진입. 자두색은 짙은 자홍과 짙은 잉크를 섞어 만든다(새 색 0).
    `.tone-deep-magenta` 가 배경을 주므로 클래스가 아니라 인라인으로 덮는다. */
const PLUM: CSSProperties = { backgroundColor: 'color-mix(in srgb, var(--deep-magenta) 62%, var(--deep-ink))' }
function PlumCard() {
  return (
    <div className={`${DEEP_CLASS.magenta} flex flex-col items-center rounded-[14px] px-6 py-10 text-center`} style={PLUM}>
      <Image src={`${ILLO}/spot-quiz.webp`} alt="" width={1328} height={1328} sizes="88px" className="w-[84px] select-none" />
      <h3 className="mt-4 break-keep font-display text-[17px] font-[700] text-[var(--t1)]">5분 진단으로 시작하기</h3>
      <p className="mt-1.5 break-keep font-body text-[13px] leading-[1.5] text-[var(--t1)]">아는 단어 비율을 재면, 지금 읽을 수 있는 책이 바로 정해집니다.</p>
      <PromoLink href="/diagnostic" slot="bento" index={91} className={`${BTN.onDeep} mt-6`}>
        진단 시작 <ArrowRight size={14} aria-hidden />
      </PromoLink>
    </div>
  )
}

/** 참조 「Cool vendor」 짙은 남색 판 — 우리는 기억 4색의 계산식. */
function FormulaCard() {
  return (
    <PromoLink href="/wordvault" slot="bento" index={92} className={`${DEEP_CLASS.ink} flex h-[250px] flex-col rounded-[14px] p-7 ${FOCUS}`}>
      <span className="font-display text-[15px] font-[700] text-[var(--t1)]">기억 계산</span>
      <span className="mt-auto font-mono text-[30px] font-[400] uppercase leading-[1.05] tracking-[-0.01em] text-[var(--t1)]">
        Memory
        <br />
        decay
      </span>
      <span className="mt-2 font-mono text-[15px] text-[var(--t1)] opacity-85">R(t) = e^(ln0.9 · t/S)</span>
    </PromoLink>
  )
}

export function ShelfWall({ portal }: { portal: HubPortal }) {
  const { facts, newBooks } = portal
  const stats: Stat[] = [
    { key: 'books', label: '챕터별 어휘가 뽑힌 고전', value: facts.books, unit: '권 · 고전 서가', tint: 'green', deep: 'green', href: '/library/books' },
    { key: 'comics', label: '원서 만화와 복원 만화', value: facts.comics, unit: '편 · 만화', tint: 'pink', deep: 'magenta', href: '/comics' },
    { key: 'articles', label: '수준별로 다시 고른 글', value: facts.articles, unit: '편 · 짧은 글', tint: 'peach', deep: 'orange', href: '/library/scripts' },
    { key: 'sets', label: '목적별 큐레이션', value: facts.curatedSets, unit: '개 · 단어장', tint: 'teal', deep: 'charcoal', href: '/library/vocab' },
  ]
  const counted = stats.filter((s): s is Stat & { value: number } => s.value !== null && s.value > 0)
  const covers = newBooks.slice(0, 2)
  const coverTints: Tint[] = ['peach', 'lavender']

  // 세 기둥 — 참조처럼 기둥마다 시작 높이가 달라 벽이 계단처럼 엇갈린다.
  const cards = [
    <LevelBadge key="badge" />,
    ...(covers[0] ? [<CoverBook key="c0" book={covers[0]} tint={coverTints[0]} index={0} />] : []),
    ...counted.map((s, i) => <StatBook key={s.key} s={s} index={i} />),
    <FormulaCard key="formula" />,
    ...(covers[1] ? [<CoverBook key="c1" book={covers[1]} tint={coverTints[1]} index={1} />] : []),
    <PlumCard key="plum" />,
  ]
  const cols: ReactNode[][] = [[], [], []]
  cards.forEach((c, i) => cols[i % 3].push(c))

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cols.map((col, i) => (
        <div key={i} className={`flex flex-col gap-4 ${i === 1 ? 'md:-mt-0' : i === 0 ? 'md:mt-16' : 'md:mt-6'}`}>
          {col}
        </div>
      ))}
    </div>
  )
}
