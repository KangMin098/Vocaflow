// apps/web/src/components/library/shared/ArticleCover.tsx
//
// 짧은 글(ACP 기사 · Dispatches)의 "디자인된 표지". **가로형이 기본이다.**
//
// ⚠️ 왜 `GradientBookCover` 를 쓰면 안 되나
//   그 컴포넌트는 Penguin Clothbound Classics 를 본뜬 것이다 — 이중 프레임 · 중앙 정렬 serif ·
//   fleuron(❧) · small-caps 부제. 전부 **양장본 고전**의 관습이라, 붙이는 순간 학습자는
//   카드만 보고 그것이 기사인지 책인지 구분하지 못한다.
//
// ── 왜 가로인가 (2026-08-17 레퍼런스 실측) ────────────────────────────────
//   편집 관습에서 **세로 비율은 "이번 호(號)"를, 가로는 "기사"를** 뜻한다.
//     · The Economist  — 카드 16:9 (1280×720 고정) / 커버 3:4
//     · The New Yorker — 카드 모바일 1:1 · 데스크톱 4:3 / 커버 1:1.365
//                        (커버는 CDN 크롭 자체가 무효화돼 있다 — 자르지 않겠다는 강제)
//     · Monocle        — 카드 4:3 (`--aspect-ratio-4-3` 토큰) / 커버 3:4
//     · 롱블랙·뉴닉·폴인 — 4:3 · 아웃스탠딩 600×315
//   세 브랜드 모두 커버(세로)를 기사(가로)와 **비율로 격리**한다. 우리 기사가 3:4 세로 슬롯에
//   있으면 타이포를 아무리 신문처럼 짜도 비율이 "책 한 권"이라고 말한다.
//
// ── 무엇이 "기사답게" 만드는가 ───────────────────────────────────────────
//   ① 네임플레이트 — 출처명을 상단에 괘선과 함께. 신문 1면의 제호.
//   ② 킥커 — 분야 라벨. **세리프**다(Economist fly-title·NY rubric·Monocle category 전부 세리프).
//   ③ 좌측 정렬 헤드라인 — 신문은 왼쪽에 건다. 책 표지는 가운데 정렬한다.
//   ④ 하프톤 망점 + 단 괘선 — 신문 인쇄 질감.
//   ⑤ **날짜·읽는 시간을 넣지 않는다** — Economist·NY·Monocle 카드에 `<time>` 0건,
//      국내 7개 플랫폼도 읽는 시간 표기 0건. 필요하면 카드 바깥 메타 줄이 맡는다.
//
// 색: 출처 액센트(`lib/articles/source-meta.ts`)의 듀오톤. 같은 출처는 같은 색이어야
//   목록에서 출처를 색으로 익힌다. 중성 검정으로 떨어뜨리면 카드가 전부 비슷해져 그 구분이
//   사라진다(v1 에서 실제로 그랬다). Calm UI 를 지키려 원색 그대로는 쓰지 않는다.

import { sourceMeta } from '@/lib/articles/source-meta'

interface ArticleCoverProps {
  title: string
  /** `library_articles.source` 키 (voa · nasa · the_conversation …) */
  source?: string | null
  /** 네임플레이트 오른쪽 — 보통 CEFR. 학습 판단에 필요해 유일하게 남긴 메타다. */
  level?: string | null
  /** 그리드 타일용 축소 타이포 */
  compact?: boolean
}

export function ArticleCover({ title, source, level, compact = false }: ArticleCoverProps) {
  const meta = sourceMeta(source ?? 'rss')
  const accent = meta.color.startsWith('#') ? meta.color : '#57534E'

  // 제호가 길면(Conversation · Simple Wiki) 넓은 자간 그대로는 잘린다 — 길이에 따라 조인다.
  const nameplate = meta.short.toUpperCase()
  const wide = nameplate.length > 9

  // 킥커·제호를 **세리프**로. 레퍼런스 셋이 전부 세리프였다(Monocle 은 메타까지 세리프).
  const mastheadCls = compact
    ? `font-editorial font-[600] ${wide ? 'text-[8.5px] tracking-[0.12em]' : 'text-[10px] tracking-[0.2em]'}`
    : `font-editorial font-[600] ${wide ? 'text-[11px] tracking-[0.14em]' : 'text-[13px] tracking-[0.22em]'}`
  const kickerCls = compact
    ? 'font-editorial text-[8.5px] font-[600] uppercase tracking-[0.14em]'
    : 'font-editorial text-[10.5px] font-[600] uppercase tracking-[0.16em]'
  const levelCls = compact
    ? 'font-editorial text-[8.5px] font-[600] tracking-[0.1em]'
    : 'font-editorial text-[10.5px] font-[600] tracking-[0.12em]'
  // 긴 낱말(Photosynthesis)이 가로로 잘리던 것 — break-words + 하이픈 허용.
  const headlineCls = compact
    ? 'font-editorial text-[13.5px] font-[600] leading-[1.2] tracking-[-0.012em] [hyphens:auto] break-words line-clamp-3'
    : 'font-editorial text-[22px] font-[600] leading-[1.18] tracking-[-0.015em] [hyphens:auto] break-words line-clamp-4'

  return (
    <div
      className={`absolute inset-0 flex flex-col text-white ${compact ? 'px-3 py-2.5' : 'px-5 py-4'}`}
    >
      {/* ── 바탕: 출처 액센트 듀오톤 (같은 색상의 짙은 톤으로 내린다) ── */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(148deg,
            color-mix(in oklab, ${accent} 92%, white 8%) 0%,
            ${accent} 38%,
            color-mix(in oklab, ${accent} 56%, #0a0c10 44%) 100%)`,
        }}
      />
      {/* 잉크가 고르지 않은 느낌 — 왼쪽 위에서 빛이 든다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(110% 100% at 6% 0%, rgba(255,255,255,0.17) 0%, rgba(255,255,255,0) 60%)',
        }}
      />
      {/* 하프톤 망점 — 신문 인쇄 질감 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.24]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.55) 0.5px, transparent 0.55px)',
          backgroundSize: compact ? '3px 3px' : '3.5px 3.5px',
        }}
      />
      {/* 단 괘선 — 가로형에서는 오른쪽 단을 세로로 가른다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-[72%] w-px bg-white/[0.08]"
      />

      {/* ── ① 네임플레이트 — 신문 1면 제호 ─────────────────────── */}
      <div aria-hidden className="relative h-px w-full shrink-0 bg-white/40" />
      <div className="relative flex shrink-0 items-baseline justify-between gap-2 py-1.5">
        <span className={`${mastheadCls} min-w-0 truncate text-white`}>{nameplate}</span>
        {level && <span className={`${levelCls} shrink-0 tabular-nums text-white/70`}>{level}</span>}
      </div>
      <div aria-hidden className="relative h-[2px] w-full shrink-0 bg-white/85" />

      {/* ── ②③ 킥커 + 헤드라인 ──────────────────────────────────
           `min-h-0` 가 없으면 flex 자식이 줄지 않아 **line-clamp 이 무력해지고**
           헤드라인이 카드 밖으로 넘친다(v1 에서 실제로 그랬다). */}
      <div
        className={`relative flex min-h-0 flex-1 flex-col overflow-hidden ${compact ? 'mt-1.5 pr-[26%]' : 'mt-2.5 pr-[28%]'}`}
      >
        <p className={`${kickerCls} shrink-0 text-white/72`}>{meta.domain}</p>
        <h3 className={`${headlineCls} mt-1 text-white`}>{title}</h3>
      </div>

      {/* ── ④ 하단 괘선 — 신문 단 마감. 날짜·읽는 시간은 넣지 않는다. ── */}
      <div aria-hidden className="relative mt-1.5 h-px w-full shrink-0 bg-white/28" />
    </div>
  )
}
