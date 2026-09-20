// apps/web/src/app/dev/replica/AppFrame.tsx
//
// 참조 **앱 UI 골격**을 그리는 렌더러. 값은 `app-measured.json` 에서만 온다.
// `tines-app`(복제)과 `ours-app`(치환)이 **같은 렌더러**를 쓴다 — 다른 렌더러를 쓰면
// "구조·수치 변경 0" 이 말뿐이 된다(BandStack 과 같은 이유).

import { appMeasured } from './blueprint'
import type { ColorFn, MediaAsset } from './ours'
import { fillRole } from './ours'

export type AppSubst = {
  /** 역할(면/선/글자)이 인자다 — BandStack 과 같은 규칙(DD-55 면 금지). */
  color?: ColorFn
  /** 노드(캔버스 위 카드) 자리 → 우리 자산. 없으면 회색 상자. */
  media?: Map<string, MediaAsset>
}

export const appSlotKey = (i: number) => `N${i}`

/** 잰 상자 중 노드인 것 — 배정과 렌더가 같은 순서를 본다. */
export function appNodeSlots(vpKey: string) {
  const v = appMeasured().viewports[vpKey]
  if (!v || v.error) return []
  return v.nodes.map((n, i) => ({ key: appSlotKey(i), w: n.w, h: n.h }))
}

/** 점 격자 타일을 실측값(타일 크기 · 점 반지름 · 색)에서 data URI 로 만든다. */
function dotTile(tile: { width: string; height: string; dotRadius: string; fill: string } | undefined, fill?: string) {
  if (!tile) return undefined
  const { width, height, dotRadius } = tile
  const cx = Number(width) / 2
  const cy = Number(height) / 2
  const svg = `<svg width='${width}' height='${height}' viewBox='0 0 ${width} ${height}' fill='${fill ?? tile.fill}' xmlns='http://www.w3.org/2000/svg'><circle cx='${cx}' cy='${cy}' r='${dotRadius}'/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

export function AppFrame({ vpKey, subst }: { vpKey: string; subst?: AppSubst }) {
  const data = appMeasured()
  const v = data.viewports[vpKey]
  if (!v || v.error) return <div data-app-frame={vpKey}>측정값 없음: {v?.error ?? vpKey}</div>

  const { frame, derived, grid, nodes, boxes } = v
  const col = (hex: string | null | undefined, role: '면' | '선' | '글자') =>
    subst?.color ? subst.color(hex, role) : (hex ?? undefined)
  const nodeIndex = new Map(nodes.map((n, i) => [`${n.x}:${n.y}:${n.w}:${n.h}`, i]))
  // 점 격자는 치환하면 우리 모눈 토큰이 된다(03-system 「원고지」와 같은 자리다).
  const gridFill = subst ? 'var(--grid-line)' : undefined
  const outline = subst ? 'var(--bd)' : 'var(--replica-outline)'

  return (
    <div
      className="replica-vp"
      data-vp={vpKey}
      data-app-frame={vpKey}
      style={{ width: frame.width, height: frame.height, position: 'relative', overflow: 'hidden' }}
    >
      {/* 캔버스 — 앱에서 가장 큰 면. 점 격자는 실측 타일 그대로. */}
      {derived.canvas ? (
        <div
          className="replica-box"
          data-part="canvas"
          style={{
            left: derived.canvas.x,
            top: derived.canvas.y,
            width: derived.canvas.w,
            height: derived.canvas.h,
            background: col(derived.canvas.bg, '면'),
            backgroundImage: dotTile(grid?.tile, gridFill),
            backgroundPosition: grid?.backgroundPosition,
          }}
        />
      ) : null}

      {/* 상단 바 — 실측에서 배경이 투명하다. 자리만 잡고 아래 선으로 경계를 남긴다. */}
      {derived.topBarHeight ? (
        <div
          className="replica-box"
          data-part="topbar"
          style={{ left: 0, top: 0, width: frame.width, height: derived.topBarHeight, borderBottom: `1px solid ${outline}` }}
        />
      ) : null}

      {/* 우측 인스펙터 띠 — 캔버스가 끝난 뒤 남는 자리(칠해진 상자가 아니다). */}
      {derived.canvas && derived.rightInspectorWidth ? (
        <div
          className="replica-box"
          data-part="inspector"
          style={{
            left: derived.canvas.x + derived.canvas.w,
            top: derived.canvas.y,
            width: derived.rightInspectorWidth,
            height: derived.canvas.h,
            borderLeft: `1px solid ${outline}`,
          }}
        />
      ) : null}

      {/* 잰 상자 전부 — 레일 · 패널 · 인스펙터 카드 · 노드. */}
      {boxes.map((b, i) => {
        const ni = nodeIndex.get(`${b.x}:${b.y}:${b.w}:${b.h}`)
        const asset = ni === undefined ? undefined : subst?.media?.get(appSlotKey(ni))
        const style: React.CSSProperties = {
          left: b.x,
          top: b.y,
          width: b.w,
          height: b.h,
          background: ni !== undefined && !asset ? undefined : col(b.bg, fillRole(b.w, b.h)),
          borderRadius: b.radius,
          border: b.borderWidth ? `${b.borderWidth}px solid ${col(b.borderColor, '선') ?? outline}` : undefined,
        }
        if (asset?.kind === 'illustration') {
          return (
            <div
              key={i}
              className="replica-box replica-illo"
              data-part="node"
              data-asset={asset.id}
              style={{ ...style, overflow: 'hidden', display: 'grid', placeItems: 'center' }}
              // 저장소의 생성기가 만든 SVG 문자열뿐이다 — 외부 입력 0
              dangerouslySetInnerHTML={{ __html: asset.svg }}
            />
          )
        }
        if (asset?.kind === 'screen') {
          return (
            <div
              key={i}
              className="replica-box"
              data-part="node"
              data-asset={asset.id}
              style={{ ...style, background: `var(--bg2) url(${asset.url}) center / cover no-repeat`, overflow: 'hidden' }}
            />
          )
        }
        return (
          <div
            key={i}
            className={ni !== undefined ? 'replica-box replica-media' : 'replica-box'}
            data-part={ni !== undefined ? 'node' : 'box'}
            style={style}
          />
        )
      })}
    </div>
  )
}
