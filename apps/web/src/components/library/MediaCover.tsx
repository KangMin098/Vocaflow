// apps/web/src/components/library/MediaCover.tsx
//
// 매체 형식 표지 — **자산 0으로 유형을 즉시 읽히게 한다.**
//
// 왜 SVG 절차 생성인가:
//   자료가 도서 401 · 아티클 162 · 스크립트 277 · 만화 969 건이다. 유형별 일러스트를 그려
//   붙이는 건 불가능하고, 스톡 이미지는 학습 맥락과 무관한 장식이 된다(Calm UI 위반).
//   대신 각 매체의 **조판 문법**을 재현한다 — 대본은 고정폭 슬러그라인, 신문은 제호·단 괘선,
//   매거진은 대형 이니셜과 도련 띠. 근거·형식 목록은 `lib/library/media-form.ts` 주석 참조.
//
// 접근성 (BBC GEL 패턴):
//   이 그림은 전부 `aria-hidden` 이다. 텍스트 대안은 **호출부가 제목 뒤에** 시각적으로 숨긴
//   문장으로 넣는다(`mediaFormSrLabel()`). 제목보다 먼저 읽히면 순서가 어긋나기 때문이다.
//   따라서 이 컴포넌트만 붙이고 라벨을 빼면 접근성 회귀다 — `MediaCoverWithLabel` 을 쓰면
//   둘이 항상 함께 나간다.
//
// 색: 새 색을 만들지 않는다. `MEDIA_FORMS[form].accent` = 기존 `--track-*` 토큰이고
//     다크모드는 globals.css 에서 이미 테마별로 뒤집혀 있다.

import { mediaFormSpec, mediaFormSrLabel, type MediaForm } from '@/lib/library/media-form'

/** 제목 → 안정적인 의사난수. 같은 글은 항상 같은 표지가 된다(새로고침마다 바뀌면 산만하다). */
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000
  return h
}

/** 제목에서 라틴 대문자 이니셜 하나. 한글·숫자 제목이면 없을 수 있다. */
function initial(title: string): string {
  const m = /[A-Za-z]/.exec(title)
  return (m?.[0] ?? title.trim()[0] ?? '·').toUpperCase()
}

const SLUG_TIME = ['DAY', 'NIGHT', 'DAWN', 'DUSK'] as const
const SLUG_PLACE = ['LIBRARY', 'CLASSROOM', 'STATION', 'KITCHEN', 'ROOFTOP', 'HALLWAY'] as const

interface Props {
  form: MediaForm
  title: string
  /** 실제 표지가 있으면 그림 대신 그것을 쓴다(도서·만화). */
  imageUrl?: string | null
  className?: string
}

/**
 * 형식별 조판 그림. `viewBox` 는 3:4 고정이고 `slice` 로 잘라 담기므로
 * 카드 비율이 달라도 찌그러지지 않는다(늘리면 활자가 뒤틀려 매체감이 깨진다).
 */
export function MediaCover({ form, title, imageUrl, className }: Props) {
  const spec = mediaFormSpec(form)
  const a = spec.accent
  const h = hash(title)

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 외부 표지 호스트가 고정돼 있지 않다(IA·SE·Gutenberg)
      <img
        src={imageUrl}
        alt=""
        aria-hidden
        loading="lazy"
        className={`h-full w-full object-cover ${className ?? ''}`}
      />
    )
  }

  return (
    <svg
      viewBox="0 0 120 160"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      focusable="false"
      className={`h-full w-full ${className ?? ''}`}
      style={{ background: `color-mix(in srgb, ${a} 10%, var(--bg2))` }}
    >
      {/* 지면 — 종이면. 형식마다 여백 규칙이 달라 여기서 한 번만 깐다. */}
      <rect x="8" y="8" width="104" height="144" fill="var(--bg)" stroke={a} strokeOpacity="0.28" strokeWidth="1" />
      {form === 'script' && <ScriptMarks a={a} h={h} />}
      {form === 'newspaper' && <NewspaperMarks a={a} h={h} />}
      {form === 'magazine' && <MagazineMarks a={a} ch={initial(title)} />}
      {form === 'journal' && <JournalMarks a={a} />}
      {form === 'reference' && <ReferenceMarks a={a} ch={initial(title)} />}
      {form === 'bulletin' && <BulletinMarks a={a} h={h} />}
      {form === 'lesson' && <LessonMarks a={a} h={h} />}
      {(form === 'book' || form === 'comic') && <FallbackMarks a={a} ch={initial(title)} />}
    </svg>
  )
}

/**
 * 표지 + 텍스트 대안을 한 묶음으로. **접근성 규칙을 호출부가 잊지 못하게** 하는 것이 목적이다.
 * `titleId` 를 주면 제목 요소 뒤에 라벨이 붙는 순서를 호출부가 직접 배치할 수 있다.
 */
export function MediaCoverSrLabel({
  form,
  readingMinutes,
}: {
  form: MediaForm
  readingMinutes?: number | null
}) {
  return <span className="sr-only">{` — ${mediaFormSrLabel(form, { readingMinutes })}`}</span>
}

// ── 형식별 조판 마크 ────────────────────────────────────────────────
// 각 함수는 "그 매체를 그 매체로 만드는 최소 표식" 만 그린다. 장식을 더하면
// 작은 카드(60px)에서 뭉개져 오히려 유형 구분이 흐려진다.

/** 대본 — 12pt Courier 프로토콜: 슬러그라인 → 중앙 대문자 인물명 → 대사 블록. */
function ScriptMarks({ a, h }: { a: string; h: number }) {
  const place = SLUG_PLACE[h % SLUG_PLACE.length]
  const time = SLUG_TIME[h % SLUG_TIME.length]
  return (
    <>
      <text x="16" y="30" className="font-mono" fontSize="7" fill={a} letterSpacing="0.2">
        {`INT. ${place}`}
      </text>
      <text x="16" y="40" className="font-mono" fontSize="7" fill={a} fillOpacity="0.75" letterSpacing="0.2">
        {`- ${time}`}
      </text>
      {/* 중앙 정렬 대문자 인물명 — 대본을 대본으로 읽히게 하는 결정적 표식 */}
      <text x="60" y="72" textAnchor="middle" className="font-mono" fontSize="7.5" fill="var(--t1)" letterSpacing="0.6">
        MAYA
      </text>
      {/* 대사 블록은 좌우 여백이 본문보다 넓다 */}
      {[82, 90, 98].map((y, i) => (
        <rect key={y} x="34" y={y} width={i === 2 ? 34 : 52} height="2.4" fill="var(--t2)" fillOpacity="0.32" rx="1" />
      ))}
      <text x="60" y="120" textAnchor="middle" className="font-mono" fontSize="6.5" fill={a} letterSpacing="0.5">
        CUT TO:
      </text>
    </>
  )
}

/** 신문 — 제호 괘선 + 발행지 표기 + 다단 칼럼 괘선. */
function NewspaperMarks({ a, h }: { a: string; h: number }) {
  const cols = [16, 52, 88]
  return (
    <>
      {/* 제호(nameplate): 두꺼운 상단 괘선 한 쌍 */}
      <rect x="16" y="20" width="88" height="3.5" fill={a} />
      <rect x="16" y="26" width="88" height="1" fill={a} fillOpacity="0.5" />
      <text x="16" y="38" className="font-display" fontSize="6" fill={a} letterSpacing="1.4" fontWeight="700">
        THE DAILY
      </text>
      {/* dateline */}
      <rect x="16" y="44" width="40" height="1.4" fill="var(--t2)" fillOpacity="0.4" />
      {/* 다단 — 신문을 신문으로 만드는 것은 칼럼 괘선이다 */}
      {cols.map((x, ci) => (
        <g key={x}>
          {Array.from({ length: 9 }, (_, i) => (
            <rect
              key={i}
              x={x}
              y={54 + i * 8}
              width={i === 8 && ci === (h % 3) ? 14 : 24}
              height="2.2"
              fill="var(--t2)"
              fillOpacity="0.3"
              rx="0.8"
            />
          ))}
          {ci < 2 && <rect x={x + 28} y="52" width="0.8" height="74" fill={a} fillOpacity="0.35" />}
        </g>
      ))}
    </>
  )
}

/** 매거진 — 대형 디스플레이 이니셜 + 하단 도련 띠 + 폴리오. */
function MagazineMarks({ a, ch }: { a: string; ch: string }) {
  return (
    <>
      <text
        x="60"
        y="86"
        textAnchor="middle"
        className="font-editorial"
        fontSize="66"
        fill={a}
        fillOpacity="0.9"
      >
        {ch}
      </text>
      {/* 도련 띠 — 잡지는 사진이 지면 끝까지 나간다. 그 자리를 색면으로 표시. */}
      <rect x="8" y="118" width="104" height="18" fill={a} fillOpacity="0.85" />
      <rect x="16" y="124" width="52" height="2.6" fill="var(--bg)" fillOpacity="0.9" rx="1" />
      <rect x="16" y="130" width="34" height="2.6" fill="var(--bg)" fillOpacity="0.6" rx="1" />
      {/* 폴리오(면 번호) */}
      <text x="104" y="148" textAnchor="end" className="font-display" fontSize="6.5" fill="var(--t2)">
        24
      </text>
    </>
  )
}

/** 학술지 — 초록 괘선 + 도판 + 캡션 격자. */
function JournalMarks({ a }: { a: string }) {
  return (
    <>
      <text x="16" y="28" className="font-display" fontSize="6" fill={a} letterSpacing="1.2" fontWeight="700">
        ABSTRACT
      </text>
      <rect x="16" y="32" width="88" height="0.9" fill={a} fillOpacity="0.6" />
      {[38, 44, 50].map((y, i) => (
        <rect key={y} x="16" y={y} width={i === 2 ? 56 : 88} height="2.2" fill="var(--t2)" fillOpacity="0.3" rx="0.8" />
      ))}
      {/* 도판 — 학술지 지면의 중심 */}
      <rect x="16" y="60" width="88" height="42" fill={a} fillOpacity="0.14" stroke={a} strokeOpacity="0.45" strokeWidth="0.9" />
      <polyline points="22,96 40,80 56,88 74,68 98,74" fill="none" stroke={a} strokeWidth="1.6" strokeLinejoin="round" />
      <text x="16" y="112" className="font-display" fontSize="5.5" fill="var(--t2)" letterSpacing="0.4">
        FIG. 1
      </text>
      {[120, 126, 132].map((y, i) => (
        <rect key={y} x="16" y={y} width={i === 2 ? 40 : 88} height="2" fill="var(--t2)" fillOpacity="0.26" rx="0.8" />
      ))}
    </>
  )
}

/** 백과 — 색인 탭 + 표제어 + 도판 자리. */
function ReferenceMarks({ a, ch }: { a: string; ch: string }) {
  return (
    <>
      {/* 색인 탭 — 사전·연감의 손잡이 */}
      {[28, 46, 64, 82, 100].map((y, i) => (
        <rect key={y} x="104" y={y} width="8" height="14" fill={a} fillOpacity={i === 1 ? 0.9 : 0.28} rx="1" />
      ))}
      {/* 표제어: 굵은 headword + 발음 괄호 */}
      <text x="16" y="34" className="font-editorial" fontSize="16" fill="var(--t1)" fontWeight="600">
        {ch}
      </text>
      <rect x="16" y="42" width="52" height="2.4" fill={a} fillOpacity="0.7" rx="1" />
      {[52, 58, 64, 70].map((y, i) => (
        <rect key={y} x="16" y={y} width={i === 3 ? 44 : 80} height="2.1" fill="var(--t2)" fillOpacity="0.3" rx="0.8" />
      ))}
      {/* 도판 자리 — 백과는 항목마다 작은 삽도를 단다 */}
      <rect x="16" y="80" width="42" height="32" fill={a} fillOpacity="0.16" stroke={a} strokeOpacity="0.4" strokeWidth="0.9" />
      <circle cx="37" cy="96" r="9" fill="none" stroke={a} strokeOpacity="0.7" strokeWidth="1.4" />
      {[82, 88, 94, 100, 106].map((y, i) => (
        <rect key={y} x="64" y={y} width={i === 4 ? 20 : 34} height="2" fill="var(--t2)" fillOpacity="0.26" rx="0.8" />
      ))}
    </>
  )
}

/** 기관 발표 — 인장 링 + 릴리스 날짜줄. */
function BulletinMarks({ a, h }: { a: string; h: number }) {
  return (
    <>
      <circle cx="60" cy="52" r="20" fill="none" stroke={a} strokeOpacity="0.75" strokeWidth="1.6" />
      <circle cx="60" cy="52" r="14" fill="none" stroke={a} strokeOpacity="0.4" strokeWidth="0.9" strokeDasharray="2 2" />
      <circle cx="60" cy="52" r="5.5" fill={a} fillOpacity="0.8" />
      <text x="60" y="86" textAnchor="middle" className="font-display" fontSize="6" fill={a} letterSpacing="1.5" fontWeight="700">
        NEWS RELEASE
      </text>
      <rect x="26" y="92" width="68" height="1" fill={a} fillOpacity="0.55" />
      <text x="60" y="103" textAnchor="middle" className="font-mono" fontSize="5.5" fill="var(--t2)">
        {`No. ${100 + (h % 800)}`}
      </text>
      {[112, 118, 124, 130].map((y, i) => (
        <rect key={y} x="16" y={y} width={i === 3 ? 46 : 88} height="2.1" fill="var(--t2)" fillOpacity="0.28" rx="0.8" />
      ))}
    </>
  )
}

/** 어학 강의 — 파형 + 재생 눈금. 음성이 본체라는 걸 형태로 말한다. */
function LessonMarks({ a, h }: { a: string; h: number }) {
  const bars = Array.from({ length: 21 }, (_, i) => {
    const v = (h + i * 37) % 100
    return 8 + (v / 100) * 46
  })
  return (
    <>
      {bars.map((height, i) => (
        <rect
          key={i}
          x={16 + i * 4.2}
          y={62 - height / 2}
          width="2.6"
          height={height}
          rx="1.3"
          fill={a}
          fillOpacity={i < 9 ? 0.9 : 0.34}
        />
      ))}
      {/* 재생 눈금 — 어디까지 들었는지의 은유 */}
      <rect x="16" y="98" width="88" height="2" rx="1" fill="var(--t2)" fillOpacity="0.25" />
      <rect x="16" y="98" width="38" height="2" rx="1" fill={a} />
      <circle cx="54" cy="99" r="3.4" fill={a} />
      <text x="16" y="120" className="font-display" fontSize="6" fill={a} letterSpacing="1.3" fontWeight="700">
        LISTEN &amp; REPEAT
      </text>
      {[128, 134].map((y, i) => (
        <rect key={y} x="16" y={y} width={i === 1 ? 40 : 74} height="2.1" fill="var(--t2)" fillOpacity="0.28" rx="0.8" />
      ))}
    </>
  )
}

/** 도서·만화 표지가 없을 때 — 기존 그라디언트 톤과 충돌하지 않는 최소 표식. */
function FallbackMarks({ a, ch }: { a: string; ch: string }) {
  return (
    <>
      <text x="60" y="94" textAnchor="middle" className="font-editorial" fontSize="58" fill={a} fillOpacity="0.85">
        {ch}
      </text>
      <rect x="16" y="118" width="60" height="2.6" fill={a} fillOpacity="0.5" rx="1" />
    </>
  )
}
