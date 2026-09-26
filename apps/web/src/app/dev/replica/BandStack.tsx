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
import type { ColorFn, ColorRole, MediaAsset } from './ours'
import { fillRole } from './ours'

export type Subst = {
  /** ① 색 — 실측 hex **+ 역할**(면/선/글자) → 우리 토큰 var(). 없으면 실측값 그대로.
   *  역할이 인자인 이유: 같은 값이 면이면 종이, 선이면 주묵, 글자면 잉크로 가야 한다(DD-55). */
  color?: ColorFn
  /** ② 서체 — 자리의 역할·크기로 표제/본문을 고른다. 크기·행간·굵기·자간은 손대지 않는다. */
  font?: (c: BlueprintChild) => string
  /** ③ 그림 — 자리 key → 우리 자산. */
  media?: Map<string, MediaAsset>
  /** ④ 문구 — 자리 key → 우리 문장. */
  copy?: Map<string, string>
}

/** 한글은 라틴보다 글자 상자를 꽉 채운다 — 행간이 1.25 보다 좁으면 위아래가 잘린다. */
function koLineHeight(c: BlueprintChild): string | undefined {
  const size = parseFloat(c.fontSize ?? '0') || 0
  const lh = parseFloat(c.lineHeight ?? '0') || 0
  if (!size) return c.lineHeight
  const MIN = 1.25
  return lh / size >= MIN ? c.lineHeight : `${Math.round(size * MIN * 100) / 100}px`
}

const isMedia = (c: BlueprintChild) =>
  c.role === 'media' || ['img', 'svg', 'video', 'canvas', 'picture'].includes(c.tag)

function Child({ c, k, subst }: { c: BlueprintChild; k: string; subst?: Subst }) {
  const col = (hex: string | undefined, role: ColorRole) => (subst?.color ? subst.color(hex, role) : hex)
  const base: React.CSSProperties = {
    left: c.x,
    top: c.y,
    width: c.w,
    height: c.h,
    // 이 칠이 면인지 표식인지는 **면적**이 가른다 — 치환표를 만든 규칙과 같은 경계(MARK_AREA).
    background: col(c.bg, fillRole(c.w, c.h)),
    borderRadius: c.radius,
    // 덧칠 순서 — 절대 배치라 **문서 순서가 곧 앞뒤**다. 참조에서 제목 아래에 있던 면 상자가
    // 나중에 그려지면 제목을 덮는다(실측 2026-09-20: 히어로 제목 둘째 줄이 통째로 잘렸다).
    // 자리를 옮기지 않고 앞뒤만 세운다: 면 < 그림 < 글자. 복제(tines-*)는 건드리지 않는다 —
    // Stage 2 의 픽셀 기준선이 그 순서로 재어져 있다.
    zIndex: subst ? (isMedia(c) ? 1 : c.textLen > 0 ? 2 : 0) : undefined,
    border: c.border && subst?.color
      ? c.border.replace(/#[0-9a-fA-F]{6}/, (m) => col(m.toLowerCase(), '선') ?? m)
      : c.border,
  }

  // 그림·일러스트·제품 화면 자리
  if (isMedia(c)) {
    const asset = subst?.media?.get(k)
    if (asset?.kind === 'illustration') {
      return (
        <div
          className={`replica-box replica-illo${asset.scene ? ' replica-scene' : ''}`}
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
    // 치환 중에 배정이 없는 그림 자리 = **겹쳐서 뺀 자리**다. 비운다.
    // 회색 자리표시자를 남기면(복제의 기본값) 삽화 위에 커다란 회색 판이 덮인다 — 실측 2026-09-20.
    if (subst) return <div className="replica-box" data-role="media" style={{ ...base, background: undefined }} />
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
          // 행간만은 실측값을 **올린다**. 참조의 1.05 는 라틴 전용 값이라 한글 글리프가 잘린다(실측 2026-09-20).
          // 크기·굵기·자간은 그대로다 — 치환 ② 가 바꾸는 것은 글꼴이고, 행간은 그 글꼴이 요구하는 최소치다.
          lineHeight: subst ? koLineHeight(c) : c.lineHeight,
          letterSpacing: c.letterSpacing,
          textAlign: c.textAlign as React.CSSProperties['textAlign'],
          color: col(c.color, '글자'),
          // 한글은 낱말이 쪼개지면 읽을 수 없다(AGENTS.md I7).
          wordBreak: subst ? 'keep-all' : undefined,
          overflowWrap: subst ? 'break-word' : undefined,
          // 자르지 않고 넘치게 둔다. 한글은 같은 크기에서 라틴보다 줄이 길고 높아 실측 상자를 넘는데,
          // 잘라 버리면 「벼한니다」처럼 **읽을 수 없는 글자**가 남아 판단을 방해한다(실측 2026-09-20).
          // 넘치는 양 자체가 판단 ① 의 재료다 — 참조 상자가 한글에 맞는지를 보여 준다.
          overflow: subst ? 'visible' : undefined,
        }}
      >
        {/* 치환 중에는 배정표가 정본이다 — 거기 없는 자리는 **비운다**(겹쳐서 뺀 자리에 lorem 이 다시 들어오면 안 된다). */}
        {subst ? (subst.copy?.get(k) ?? '') : lorem(c.textLen)}
      </div>
    )
  }

  return <div className="replica-box" data-role="box" style={base} />
}

function BandView({ band, gap, subst }: { band: Band; gap: number; subst?: Subst }) {
  const col = (hex: string | undefined, role: ColorRole) => (subst?.color ? subst.color(hex, role) : hex)
  return (
    <section
      className="replica-band"
      data-band={band.index}
      data-cls={band.cls}
      style={{ height: band.h, marginTop: gap, background: col(band.bg, '면') }}
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

/** 두 상자가 겹치는 넓이 — 자리 중복을 재는 데만 쓴다. */
const overlap = (a: BlueprintChild, b: BlueprintChild) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))

/**
 * 그림 자리 — **겹치는 것은 바깥 하나만** 남긴다.
 *
 * 참조의 히어로는 SVG 가 겹겹이 들어앉아 있어 띠 하나에 그림 자리가 62개고 그중 **37개가 겹친다**(실측).
 * 복제에서는 전부 회색이라 한 덩어리로 읽혔지만, 우리 삽화를 넣으면 그림 위에 그림이 쌓여 난장이 된다.
 * 자리를 옮기거나 줄이는 게 아니라 **거기에 두 번째 그림을 놓지 않는** 것이다(구조·수치 변경 0).
 */
export const mediaSlots = (vp: ViewportBlueprint) => {
  const all = slots(vp).filter(({ c }) => isMedia(c))
  const kept: typeof all = []
  for (const s of all) {
    const mine = s.c.w * s.c.h
    if (mine > 0 && kept.some((k) => overlap(s.c, k.c) / mine >= 0.6)) continue
    kept.push(s)
  }
  return kept.map(({ key, c }) => ({ key, w: c.w, h: c.h }))
}

/**
 * 글자 자리 — 그림과 같은 이유로 **겹치는 것은 바깥 하나만**.
 * 머리띠에서 로고·내비·버튼 상자가 서로 물려 있어, 자리마다 다른 낱말을 넣으면 글자가 겹쳐 찍힌다(실측).
 */
export const textSlots = (vp: ViewportBlueprint) => {
  const all = slots(vp).filter(({ c }) => !isMedia(c) && c.textLen > 0)
  const kept: typeof all = []
  for (const s of all) {
    const mine = s.c.w * s.c.h
    if (mine > 0 && kept.some((k) => overlap(s.c, k.c) / mine >= 0.6)) continue
    kept.push(s)
  }
  return kept
    .map(({ key, c }) => ({
      key,
      role: c.role,
      textLen: c.textLen,
      fontSize: c.fontSize,
      x: c.x,
      y: c.y,
      w: c.w,
      h: c.h,
    }))
}

export function BandStack({ vp, subst }: { vp: ViewportBlueprint; subst?: Subst }) {
  const bands = vp.blueprint
  const col = (hex: string | undefined, role: ColorRole) => (subst?.color ? subst.color(hex, role) : hex)
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
      style={{ minHeight: vp.scrollHeight, background: col(vp.pageBg, '면') }}
    >
      {/* 머리·바닥 — 띠 목록 밖(main 위·아래)이라 흐름이 아니라 실측 top 에 그대로 얹는다. */}
      {(vp.chrome ?? []).map((c) => (
        <div
          key={c.part}
          className="replica-box"
          data-part={c.part}
          style={{ left: c.left, top: c.top, width: c.w, height: c.h, background: col(c.bg, '면'), zIndex: 2 }}
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
