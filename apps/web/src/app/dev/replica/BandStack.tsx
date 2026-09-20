// apps/web/src/app/dev/replica/BandStack.tsx
//
// 청사진을 **그리기만** 하는 렌더러(DD-62 Stage 2). 판단도 수치도 여기 없다 — 전부 computed.json 에서 온다.
// 기존 컴포넌트를 하나도 import 하지 않는다(Stage 2 조건). 그래야 "우리 컴포넌트가 이미 이런 모양이라서
// 비슷해 보이는 것" 과 "구조가 실제로 같은 것" 이 섞이지 않는다.
//
// Stage 3 는 **같은 렌더러**에 `subst` 하나를 더 넘길 뿐이다(색·서체·그림·문구). 복제와 ours 가
// 다른 렌더러를 쓰면 "구조·수치 변경 0" 이 말뿐이 된다 — 여기서 기계적으로 보장한다.

import type { Band, BlueprintChild, ViewportBlueprint } from './blueprint'
import { lorem } from './blueprint'
import type { MediaAsset } from './ours'

export type Subst = {
  /** ① 색 — 실측 hex → 우리 토큰 var(). 없으면 실측값 그대로. */
  color?: (hex?: string) => string | undefined
  /** ② 서체 — 자리의 역할·크기로 표제/본문을 고른다. 크기·행간·굵기·자간은 손대지 않는다. */
  font?: (c: BlueprintChild) => string
  /** ③ 그림 — 자리 key → 우리 자산. */
  media?: Map<string, MediaAsset>
  /** ④ 문구 — 자리 key → 우리 문장. */
  copy?: Map<string, string>
}

const isMedia = (c: BlueprintChild) =>
  c.role === 'media' || ['img', 'svg', 'video', 'canvas', 'picture'].includes(c.tag)

function Child({ c, k, subst }: { c: BlueprintChild; k: string; subst?: Subst }) {
  const col = (hex?: string) => (subst?.color ? subst.color(hex) : hex)
  const base: React.CSSProperties = {
    left: c.x,
    top: c.y,
    width: c.w,
    height: c.h,
    background: col(c.bg),
    borderRadius: c.radius,
    border: c.border && subst?.color
      ? c.border.replace(/#[0-9a-fA-F]{6}/, (m) => col(m.toLowerCase()) ?? m)
      : c.border,
  }

  // 그림·일러스트·제품 화면 자리
  if (isMedia(c)) {
    const asset = subst?.media?.get(k)
    if (asset?.kind === 'illustration') {
      return (
        <div
          className="replica-box replica-illo"
          data-role="media"
          data-asset={asset.id}
          style={{ ...base, background: undefined, overflow: 'hidden', display: 'grid', placeItems: 'center' }}
          // 저장소의 생성기가 만든 SVG 문자열뿐이다 — 외부 입력 0 (Illustration.tsx 와 같은 근거)
          dangerouslySetInnerHTML={{ __html: asset.svg }}
        />
      )
    }
    if (asset?.kind === 'screen') {
      return (
        <div
          className="replica-box"
          data-role="media"
          data-asset={asset.id}
          style={{
            ...base,
            background: `var(--bg2) url(${asset.url}) center / cover no-repeat`,
            overflow: 'hidden',
            border: '1px solid var(--bd)',
          }}
        />
      )
    }
    if (asset?.kind === 'fill') {
      return <div className="replica-box" data-role="media" style={{ ...base, background: 'var(--bd)' }} />
    }
    return <div className="replica-box replica-media" data-role="media" style={{ ...base, background: undefined }} />
  }

  // 글자 자리 — 크기·굵기·행간·자간은 실측 그대로. 바뀌는 것은 글꼴과 문장뿐이다.
  if (c.textLen > 0) {
    return (
      <div
        className="replica-box replica-text"
        data-role="text"
        style={{
          ...base,
          fontFamily: subst?.font ? subst.font(c) : undefined,
          fontSize: c.fontSize,
          fontWeight: c.fontWeight,
          lineHeight: c.lineHeight,
          letterSpacing: c.letterSpacing,
          textAlign: c.textAlign as React.CSSProperties['textAlign'],
          color: col(c.color),
          // 한글은 낱말이 쪼개지면 읽을 수 없다(AGENTS.md I7).
          wordBreak: subst ? 'keep-all' : undefined,
          overflowWrap: subst ? 'break-word' : undefined,
        }}
      >
        {subst?.copy?.get(k) ?? lorem(c.textLen)}
      </div>
    )
  }

  return <div className="replica-box" data-role="box" style={base} />
}

function BandView({ band, gap, subst }: { band: Band; gap: number; subst?: Subst }) {
  const col = (hex?: string) => (subst?.color ? subst.color(hex) : hex)
  return (
    <section
      className="replica-band"
      data-band={band.index}
      data-cls={band.cls}
      style={{ height: band.h, marginTop: gap, background: col(band.bg) }}
    >
      {band.children.map((c, i) => (
        <Child key={i} c={c} k={slotKey('B', band.index, i)} subst={subst} />
      ))}
    </section>
  )
}

/**
 * 자리 key — 배정(planMedia · planCopy)과 렌더가 **같은 규칙**으로 만들어야 한다.
 * 한쪽만 바뀌면 그림·문구가 조용히 엉뚱한 자리로 간다(그리고 시트만 보면 "디자인이 이상하다" 로 읽힌다).
 * `slots()` 가 유일한 생산자다 — 렌더는 그 key 를 되받아 쓴다.
 */
export const slotKey = (scope: 'B' | 'H' | 'F', bandIndex: number, childIndex: number) =>
  `${scope}${bandIndex}:${childIndex}`

/** 청사진의 모든 자리를 **렌더와 같은 순서·같은 key** 로 펼친다. */
export function slots(vp: ViewportBlueprint) {
  const out: { key: string; c: BlueprintChild }[] = []
  for (const ch of vp.chrome ?? []) {
    const scope = ch.part === 'header' ? 'H' : 'F'
    ch.children.forEach((c, i) => out.push({ key: slotKey(scope, 0, i), c }))
  }
  for (const b of vp.blueprint) {
    b.children.forEach((c, i) => out.push({ key: slotKey('B', b.index, i), c }))
  }
  return out
}

export const mediaSlots = (vp: ViewportBlueprint) =>
  slots(vp).filter(({ c }) => isMedia(c)).map(({ key, c }) => ({ key, w: c.w, h: c.h }))

export const textSlots = (vp: ViewportBlueprint) =>
  slots(vp)
    .filter(({ c }) => !isMedia(c) && c.textLen > 0)
    .map(({ key, c }) => ({ key, role: c.role, textLen: c.textLen, fontSize: c.fontSize }))

export function BandStack({ vp, subst }: { vp: ViewportBlueprint; subst?: Subst }) {
  const bands = vp.blueprint
  const col = (hex?: string) => (subst?.color ? subst.color(hex) : hex)
  // 간격은 **청사진 띠의 실측 top** 에서 계산한다.
  // `rhythm.sectionGaps` 는 다른 띠 목록(전폭·흐름 안·가장 안쪽)의 것이라 여기 쓰면 자리가 어긋난다.
  const gapBefore = (i: number) => {
    if (i === 0) return bands[0]?.top ?? 0 // 첫 띠 위는 머리띠가 차지한 자리
    const prev = bands[i - 1]
    return Math.max(0, Math.round((bands[i].top - (prev.top + prev.h)) * 100) / 100)
  }
  return (
    <div
      className="replica-vp"
      data-vp={vp.viewport.key}
      data-scrollheight={vp.scrollHeight}
      style={{ minHeight: vp.scrollHeight, background: col(vp.pageBg) }}
    >
      {/* 머리·바닥 — 띠 목록 밖(main 위·아래)이라 흐름이 아니라 실측 top 에 그대로 얹는다. */}
      {(vp.chrome ?? []).map((c) => (
        <div
          key={c.part}
          className="replica-box"
          data-part={c.part}
          style={{ left: c.left, top: c.top, width: c.w, height: c.h, background: col(c.bg), zIndex: 2 }}
        >
          {c.children.map((ch, i) => (
            <Child key={i} c={ch} k={slotKey(c.part === 'header' ? 'H' : 'F', 0, i)} subst={subst} />
          ))}
        </div>
      ))}
      {bands.map((b, i) => (
        <BandView key={b.index} band={b} gap={gapBefore(i)} subst={subst} />
      ))}
    </div>
  )
}
