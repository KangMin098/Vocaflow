// apps/web/src/components/marketing/signature.tsx
//
// 참조 홈의 **대표 표현** 다섯(DD-68 · tines-mapping §21 — 참조 홈을 확대 대조해 뽑았다):
//   PatternWord   — 거대한 무늬 채움 글자(참조 「100×」 · 「Start today」). 글자 모양으로 그림을 오려 낸다.
//   Ribbon        — 글자 위에 걸친 리본 스티커(참조 「100× FASTER」). 모노 대문자 · 한쪽 제비꼬리.
//   SourceMarquee — CTA 아래 흐르는 이름 띠(참조 고객 로고 줄). 우리는 로고를 지어내지 않고 **실제 콘텐츠 출처 이름**.
//   MonitorCluster— 선언 구간 좌우의 선화 모니터 무리(무늬 화면 · 안테나 · 덩굴).
//   FrameBar      — 제품 액자 위에 걸친 이름표 + 재생 막대.
// 전부 서버 컴포넌트다. 장식은 aria-hidden, 글자(PatternWord)는 읽힌다.

import Image from 'next/image'

const ILLO = '/illustrations/tines'

/**
 * 무늬 채움 글자 — `.pattern-text`(globals.css)가 background-clip:text 를 지원할 때만 글자를 투명하게 한다.
 * 지원하지 않거나 고대비 모드(forced-colors)면 보라 글자로 남는다(읽힘이 먼저).
 */
export function PatternWord({ children, image = 'hero-book-field', className = '' }: { children: React.ReactNode; image?: string; className?: string }) {
  return (
    <span className={`pattern-text ${className}`} style={{ ['--pt-img' as string]: `url(${ILLO}/${image}.webp)` }}>
      {children}
    </span>
  )
}

type RibbonTone = 'green' | 'purple' | 'orange' | 'magenta'
const RIBBON_BG: Record<RibbonTone, string> = {
  green: 'bg-[var(--deep-green)]',
  purple: 'bg-[var(--deep-purple)]',
  orange: 'bg-[var(--deep-orange)]',
  magenta: 'bg-[var(--deep-magenta)]',
}

/** 리본 스티커 — 기울기는 부르는 쪽이 정한다(참조는 -4° ~ 6°). 글자는 크림(진한 면 AA). */
export function Ribbon({ children, tone = 'green', className = '' }: { children: React.ReactNode; tone?: RibbonTone; className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none inline-flex h-8 select-none items-center whitespace-nowrap pl-3 pr-6 font-mono text-[12px] font-[700] uppercase tracking-[0.06em] text-[var(--on-deep)] [clip-path:polygon(0_0,100%_0,calc(100%-12px)_50%,100%_100%,0_100%)] ${RIBBON_BG[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

/**
 * 이름 흐름 띠 — 같은 목록을 두 번 이어 붙여 -50% 로 흘린다(끊김 없음). 움직임을 줄이면(prefers-reduced-motion)
 * 흐름을 멈추고 한 벌만 줄바꿈해 보여 준다. 이름마다 서체를 돌려 로고 줄의 리듬을 낸다.
 */
export function SourceMarquee({ label, names }: { label: string; names: string[] }) {
  const faces = ['font-display font-[700] tracking-[-0.02em]', 'font-serif font-[600]', 'font-mono font-[700] uppercase tracking-[0.02em] text-[20px]', 'font-display font-[500] italic']
  const row = (dup: boolean) =>
    names.map((n, i) => (
      <li key={`${dup ? 'b' : 'a'}-${n}`} aria-hidden={dup || undefined} className={`shrink-0 whitespace-nowrap text-[24px] text-[var(--ju)] ${faces[i % faces.length]} ${dup ? 'motion-reduce:hidden' : ''}`}>
        {n}
      </li>
    ))
  return (
    <div className="relative mt-12 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
      <p className="sr-only">{label}</p>
      <ul aria-label={label} className="flex w-max items-center gap-14 motion-safe:animate-[vf-marquee_48s_linear_infinite] motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:gap-y-4">
        {row(false)}
        {row(true)}
      </ul>
    </div>
  )
}

/** 선화 모니터 무리 — 무늬 화면 액자(라벤더 테두리 · 안테나) + 덩굴 선. 넓은 화면에서만. */
export function MonitorCluster({ side }: { side: 'left' | 'right' }) {
  const frames =
    side === 'left'
      ? [
          { x: 40, y: 20, w: 150, img: 'pattern-kaleido-1', ant: true },
          { x: 0, y: 190, w: 120, img: 'pattern-kaleido-2', ant: false },
          { x: 130, y: 250, w: 190, img: 'pattern-kaleido-1', ant: true },
          { x: 20, y: 440, w: 130, img: 'pattern-kaleido-2', ant: false },
        ]
      : [
          { x: 150, y: 0, w: 130, img: 'pattern-kaleido-2', ant: true },
          { x: 0, y: 150, w: 200, img: 'pattern-kaleido-1', ant: false },
          { x: 190, y: 190, w: 110, img: 'pattern-kaleido-2', ant: true },
          { x: 140, y: 380, w: 160, img: 'pattern-kaleido-1', ant: false },
        ]
  return (
    <div aria-hidden className={`pointer-events-none absolute top-16 hidden h-[620px] w-[320px] select-none xl:block ${side === 'left' ? 'left-0' : 'right-0'}`}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 620" fill="none">
        <path
          d={side === 'left' ? 'M110 150 C 60 260, 200 300, 220 380 S 90 480, 80 560' : 'M210 120 C 260 220, 90 260, 110 330 S 230 420, 220 560'}
          stroke="var(--deep-green)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {frames.map((f, i) => (
        <div key={i} className="absolute" style={{ left: f.x, top: f.y, width: f.w }}>
          {f.ant && (
            <span className="absolute -top-5 left-1/2 flex -translate-x-1/2 flex-col items-center">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-[var(--bd-strong)] bg-[var(--bg)]" />
              <span className="h-3 w-0.5 bg-[var(--bd-strong)]" />
            </span>
          )}
          <div className="rounded-[18px] border-2 border-[var(--bd-strong)] bg-[var(--tint-lavender)] p-2">
            {/* 참조 화면은 옅은 선화 — 무늬를 크림 위에 45% 로 깔아 가볍게 */}
            <Image src={`${ILLO}/${f.img}.webp`} alt="" width={1328} height={1328} className="aspect-[4/3] w-full rounded-[12px] border-2 border-[var(--bd-strong)] bg-[var(--bg)] object-cover opacity-45" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** 제품 액자 위 이름표 + 재생 막대(참조 「Open the IT space」 · 0:04/1:29). 장식이 아니라 이름표는 읽힌다. */
export function FrameBar({ tab }: { tab: string }) {
  return (
    <div className="relative mb-[-10px] flex items-end gap-3 px-6">
      <span className="rounded-t-[10px] bg-[var(--tint-lavender)] px-3 py-1.5 font-display text-[13px] font-[600] text-[var(--t1)]">{tab}</span>
      <span aria-hidden className="mb-2 hidden h-8 flex-1 items-center gap-3 rounded-full bg-[color-mix(in_srgb,var(--tint-lavender)_85%,transparent)] px-4 backdrop-blur-[12px] md:flex">
        <span className="h-3 w-3 rounded-[3px] bg-[var(--ju)]" />
        <span className="relative h-1 flex-1 rounded-full bg-[color-mix(in_srgb,var(--ju)_22%,transparent)]">
          <span className="absolute inset-y-0 left-0 w-[6%] rounded-full bg-[var(--ju)]" />
        </span>
      </span>
    </div>
  )
}
