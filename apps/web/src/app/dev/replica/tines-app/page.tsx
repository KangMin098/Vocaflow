// apps/web/src/app/dev/replica/tines-app/page.tsx
//
// 참조 **앱 UI 골격**의 구조 복제(DD-62 Stage 2 · 내부 측정용 · 배포 차단은 ../layout.tsx).
// 값은 `scripts/design/extract-app.mjs` 가 잰 app-measured.json 에서만 온다 — 여기에 수치를 적지 않는다.
//
// 그리는 것: 상단 바 · 좌측 아이콘 레일 · 좌측 목록 패널 · 중앙 캔버스(점 격자) · 우측 인스펙터.
// 노드는 회색 사각형이다(Stage 3 에서 우리 자산·데이터로 바뀐다).
//
// 완료 기준: 참조 캡처와 나란히 놓았을 때 상자 위치 ±8px (`node scripts/design/replica-diff.mjs --app`).

import { appMeasured } from '../blueprint'

export const dynamic = 'force-dynamic'

/** 점 격자 타일을 실측값(타일 크기 · 점 반지름 · 색)에서 data URI 로 만든다. */
function dotTile(tile?: { width: string; height: string; dotRadius: string; fill: string }) {
  if (!tile) return undefined
  const { width, height, dotRadius, fill } = tile
  const cx = Number(width) / 2
  const cy = Number(height) / 2
  const svg = `<svg width='${width}' height='${height}' viewBox='0 0 ${width} ${height}' fill='${fill}' xmlns='http://www.w3.org/2000/svg'><circle cx='${cx}' cy='${cy}' r='${dotRadius}'/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

function AppFrame({ vpKey }: { vpKey: string }) {
  const data = appMeasured()
  const v = data.viewports[vpKey]
  if (!v || v.error) return <div data-app-frame={vpKey}>측정값 없음: {v?.error ?? vpKey}</div>

  const { frame, derived, grid, nodes, boxes } = v
  const nodeKey = new Set(nodes.map((n) => `${n.x}:${n.y}:${n.w}:${n.h}`))

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
            background: derived.canvas.bg,
            backgroundImage: dotTile(grid?.tile),
            backgroundPosition: grid?.backgroundPosition,
          }}
        />
      ) : null}

      {/* 상단 바 — 실측에서 배경이 투명하다. 자리만 잡고 아래 선으로 경계를 남긴다. */}
      {derived.topBarHeight ? (
        <div
          className="replica-box"
          data-part="topbar"
          style={{
            left: 0,
            top: 0,
            width: frame.width,
            height: derived.topBarHeight,
            borderBottom: '1px solid var(--replica-outline)',
          }}
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
            borderLeft: '1px solid var(--replica-outline)',
          }}
        />
      ) : null}

      {/* 잰 상자 전부 — 레일 · 패널 · 인스펙터 카드 · 노드. 노드만 회색으로 바꾼다. */}
      {boxes.map((b, i) => {
        const isNode = nodeKey.has(`${b.x}:${b.y}:${b.w}:${b.h}`)
        return (
          <div
            key={i}
            className={isNode ? 'replica-box replica-media' : 'replica-box'}
            data-part={isNode ? 'node' : 'box'}
            style={{
              left: b.x,
              top: b.y,
              width: b.w,
              height: b.h,
              background: isNode ? undefined : (b.bg ?? undefined),
              borderRadius: b.radius,
              border: b.borderWidth ? `${b.borderWidth}px solid ${b.borderColor ?? 'var(--replica-outline)'}` : undefined,
            }}
          />
        )
      })}
    </div>
  )
}

export default function TinesAppReplica() {
  return (
    <>
      <AppFrame vpKey="1440" />
      <AppFrame vpKey="375" />
    </>
  )
}
