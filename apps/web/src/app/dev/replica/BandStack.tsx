// apps/web/src/app/dev/replica/BandStack.tsx
//
// 청사진을 **그리기만** 하는 렌더러(DD-62 Stage 2). 판단도 수치도 여기 없다 — 전부 computed.json 에서 온다.
// 기존 컴포넌트를 하나도 import 하지 않는다(Stage 2 조건). 그래야 "우리 컴포넌트가 이미 이런 모양이라서
// 비슷해 보이는 것" 과 "구조가 실제로 같은 것" 이 섞이지 않는다.

import type { Band, BlueprintChild, ViewportBlueprint } from './blueprint'
import { lorem } from './blueprint'

function Child({ c }: { c: BlueprintChild }) {
  const base: React.CSSProperties = {
    left: c.x,
    top: c.y,
    width: c.w,
    height: c.h,
    background: c.bg,
    borderRadius: c.radius,
    border: c.border,
  }

  // 그림·일러스트·제품 화면 자리 → 같은 크기의 회색 상자. Stage 3 에서 우리 자산으로 바뀐다.
  if (c.role === 'media' || ['img', 'svg', 'video', 'canvas', 'picture'].includes(c.tag)) {
    return <div className="replica-box replica-media" data-role="media" style={{ ...base, background: undefined }} />
  }

  // 글자 자리 → 같은 글자 수의 lorem. 크기·굵기·행간·자간은 실측 그대로.
  if (c.textLen > 0) {
    return (
      <div
        className="replica-box replica-text"
        data-role="text"
        style={{
          ...base,
          fontSize: c.fontSize,
          fontWeight: c.fontWeight,
          lineHeight: c.lineHeight,
          letterSpacing: c.letterSpacing,
          textAlign: c.textAlign as React.CSSProperties['textAlign'],
          color: c.color,
        }}
      >
        {lorem(c.textLen)}
      </div>
    )
  }

  return <div className="replica-box" data-role="box" style={base} />
}

function BandView({ band, gap }: { band: Band; gap: number }) {
  return (
    <section
      className="replica-band"
      data-band={band.index}
      data-cls={band.cls}
      style={{ height: band.h, marginTop: gap, background: band.bg }}
    >
      {band.children.map((c, i) => (
        <Child key={i} c={c} />
      ))}
    </section>
  )
}

export function BandStack({ vp }: { vp: ViewportBlueprint }) {
  const bands = vp.blueprint
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
      style={{ minHeight: vp.scrollHeight, background: vp.pageBg }}
    >
      {/* 머리·바닥 — 띠 목록 밖(main 위·아래)이라 흐름이 아니라 실측 top 에 그대로 얹는다. */}
      {(vp.chrome ?? []).map((c) => (
        <div
          key={c.part}
          className="replica-box"
          data-part={c.part}
          style={{ left: c.left, top: c.top, width: c.w, height: c.h, background: c.bg, zIndex: 2 }}
        >
          {c.children.map((ch, i) => (
            <Child key={i} c={ch} />
          ))}
        </div>
      ))}
      {bands.map((b, i) => (
        <BandView key={b.index} band={b} gap={gapBefore(i)} />
      ))}
    </div>
  )
}
