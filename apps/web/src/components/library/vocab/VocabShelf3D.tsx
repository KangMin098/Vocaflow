// apps/web/src/components/library/vocab/VocabShelf3D.tsx
//
// **단어장 벽 선반 — 실제 3D 장면(WebGL).**
//
// ── 왜 3D 인가 (2026-09-28 사용자 지시 「Editions 처럼 입체적·사실적·감성적으로 동일하게 — 방법을 강구」) ──
// 참조 shopify.com/editions 서가는 `<canvas>` 하나에 그린 WebGL 장면이다(2026-09-25 소스 실측: DOM 에는 canvas 뿐).
// CSS 3D(perspective · rotateX · box-shadow)로 여러 번 흉내 냈지만 셋이 끝내 안 됐다:
//   · 그림자가 **빛에서** 나오지 않는다 — 책이 기울어도 벽의 그림자 모양이 안 바뀐다.
//   · 책 두께 — filter(drop-shadow)가 preserve-3d 를 평평하게 눌러 옆면이 사라진다.
//   · 선반 위 벽의 흰 조명 번짐과 선반 아래 그늘이 **같은 빛의 결과**로 읽히지 않는다.
// 그래서 참조와 같은 수단을 쓴다: three.js(@react-three/fiber — 스택에 이미 있다) 장면에
//   책 = 두께 있는 상자(앞면 = 교재 표지 SVG 를 그린 텍스처 · 옆면 = 종이 단면) · 선반 = 흰 판 ·
//   빛 = 위 앞에서 내리쬐는 방향광 하나(부드러운 그림자) + 선반 뒤 흰 번짐.
//
// ── 벽 색은 페이지 바탕 그대로 ──────────────────────────────────────
// 사용자 지시(2026-09-26 「회색 배경 제거 · 주위 색과 일치」). 벽은 **그림자만 받는 투명 판**(ShadowMaterial)이라
// 캔버스 밖 페이지 바탕이 그대로 보인다 — 이음새가 생길 수 없다. 흰 번짐도 투명 그라디언트 판이다.
//
// ── 접근성 ──────────────────────────────────────────────────────────
// 캔버스는 스크린리더·키보드에 보이지 않는다. 그래서 **책마다 진짜 버튼**을 캔버스 위 같은 자리에 겹쳐 둔다
// (투명 · 화면 좌표는 매 프레임 3D 에서 투영해 맞춘다). 포커스가 가면 그 버튼에 테두리가 보이고 3D 책이 당겨진다.
// 로빙 탭 · 화살표 이동은 부모(VocabSetCarousel)의 것을 그대로 쓴다.
//
// ── 모션 감소 ───────────────────────────────────────────────────────
// prefers-reduced-motion 이면 기울기·당김 보간을 끄고 즉시 자리를 바꾼다(움직임 제거 · 빛 변화는 남김).

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, invalidate, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { tradeCoverSvg } from '@vocaflow/library-pipeline/vocab-trade-cover'

import { rungForSet } from '@/lib/library/vocab/rung'
import type { PublishedVocabSet } from '@/lib/library/vocab/queries'

// ── 치수(월드 단위 = 표지 폭 1) ───────────────────────────────────────
const BOOK_W = 1
const BOOK_H = 225 / 152 // 시중 단어장 판형
const BOOK_D = 0.07
const GAP = 0.2
const SHELF_T = 0.07 // 선반 두께
const SHELF_D = 0.6 // 선반 깊이 — 기댄 책의 밑동(≈ BOOK_H·sin12° + 여유)이 판 위에 올라앉을 만큼
const SHELF_OVERHANG = 0.85 // 책 줄보다 양쪽으로 긴 길이
const ROW_PITCH = BOOK_H + 0.62
const FOV = 26

export interface ShelfBook {
  set: PublishedVocabSet
  idx: number
}

interface Props {
  rows: ShelfBook[][]
  focused: number | null
  onPoint: (idx: number) => void
  onOpen: (set: PublishedVocabSet, idx: number) => void
  /** 책마다 겹쳐 두는 접근성 버튼 — 부모가 로빙 탭을 관리한다 */
  renderHit: (b: ShelfBook, style: React.CSSProperties) => React.ReactNode
}

/** 표지 SVG → 캔버스 텍스처. 인라인 SVG 가 아니라 이미지로 그리므로 CSS 변수 서체를 실제 목록으로 푼다. */
function useCoverTexture(set: PublishedVocabSet): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  const { rung } = rungForSet(set)
  const spec = set.coverImageMeta?.trade ?? null
  useEffect(() => {
    let dead = false
    const W = 608,
      H = 900
    let svg: string
    if (spec) {
      svg = tradeCoverSvg(spec, { title: set.title, words: set.wordCount, perDay: spec.mode === 'series' ? (rung?.wordsPerDay ?? null) : null })
        .replace(/var\(--font-trade(?:-display)?,\s*([^)]*)\)/g, '$1')
        .replace('style="display:block;width:100%;height:100%"', `width="${W}" height="${H}"`)
    } else {
      // 교재 표지 명세가 없는 권 — 제목만 조판한 임시 표지(빈 텍스처로 두지 않는다)
      const t = set.title.replace(/&/g, '&amp;').replace(/</g, '&lt;')
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#2b2d42"/><text x="44" y="120" font-family="Pretendard, 'Malgun Gothic', sans-serif" font-size="48" font-weight="800" fill="#fff">${t}</text></svg>`
    }
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      if (dead) return
      const c = document.createElement('canvas')
      // 1배 — 표지는 화면에서 ~200px 이다. 2배(1216×1800)로 굽던 동안 41권이 GPU 메모리 ~370MB 를 먹어 첫 그림이 수십 초 걸렸다.
      c.width = W
      c.height = H
      const g = c.getContext('2d')
      if (!g) return
      g.drawImage(img, 0, 0, c.width, c.height)
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      setTex(t)
      invalidate()
    }
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    return () => {
      dead = true
    }
  }, [spec, set.title, set.wordCount, rung?.wordsPerDay])
  return tex
}

/** 종이 단면 — 옆면 텍스처(가는 줄) 하나를 모든 책이 같이 쓴다. */
function usePaperEdge(): THREE.Texture {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 8
    const g = c.getContext('2d')!
    for (let x = 0; x < 64; x++) {
      g.fillStyle = x % 2 ? '#e3dfd6' : '#f8f6f1'
      g.fillRect(x, 0, 1, 8)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
}

/**
 * 선반 그늘 — 선반 바로 아래 벽에 붙는 짧고 부드러운 그늘(참조). 위가 짙고 아래로 사라지며 양 끝도 옅어진다.
 * 그림자 맵으로 그리던 동안 선반 그림자가 벽을 길게·거칠게(디더링) 덮었다 — 모양을 직접 정하는 편이 참조에 가깝다.
 */
function useShelfShade(): THREE.Texture {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 64
    const g = c.getContext('2d')!
    const v = g.createLinearGradient(0, 0, 0, 64)
    v.addColorStop(0, 'rgba(0,0,0,0.30)')
    v.addColorStop(0.25, 'rgba(0,0,0,0.14)')
    v.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = v
    g.fillRect(0, 0, 256, 64)
    // 양 끝 옅게
    g.globalCompositeOperation = 'destination-in'
    const h = g.createLinearGradient(0, 0, 256, 0)
    h.addColorStop(0, 'rgba(0,0,0,0)')
    h.addColorStop(0.08, 'rgba(0,0,0,1)')
    h.addColorStop(0.92, 'rgba(0,0,0,1)')
    h.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = h
    g.fillRect(0, 0, 256, 64)
    return new THREE.CanvasTexture(c)
  }, [])
}

/** 책 그림자 — 흐린 사각(가장자리로 사라진다). 위쪽(벽에 닿은 윗변 둘레)이 조금 더 짙다. */
function useBookShade(): THREE.Texture {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 160
    const g = c.getContext('2d')!
    g.filter = 'blur(12px)'
    const v = g.createLinearGradient(0, 0, 0, 160)
    v.addColorStop(0, 'rgba(0,0,0,0.26)')
    v.addColorStop(1, 'rgba(0,0,0,0.12)')
    g.fillStyle = v
    g.fillRect(22, 20, 84, 120)
    return new THREE.CanvasTexture(c)
  }, [])
}

/** 흰 번짐 — 가운데가 불투명한 방사형 그라디언트(투명 판에 입힌다). */
function useGlow(): THREE.Texture {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    const r = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    r.addColorStop(0, 'rgba(255,255,255,0.95)')
    r.addColorStop(0.45, 'rgba(255,255,255,0.55)')
    r.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = r
    g.fillRect(0, 0, 256, 256)
    return new THREE.CanvasTexture(c)
  }, [])
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// ── 책 한 권 ────────────────────────────────────────────────────────
function Book({
  book,
  x,
  y,
  lean,
  yaw,
  lifted,
  edge,
  bookShade,
  onPoint,
  onOpen,
  registry,
}: {
  book: ShelfBook
  x: number
  y: number
  lean: number
  yaw: number
  lifted: boolean
  edge: THREE.Texture
  bookShade: THREE.Texture
  onPoint: () => void
  onOpen: () => void
  registry: Map<number, THREE.Object3D>
}) {
  const pivot = useRef<THREE.Group>(null)
  const tex = useCoverTexture(book.set)
  const [hover, setHover] = useState(false)
  const tilt = useRef({ x: 0, y: 0 })
  const reduce = useMemo(reducedMotion, [])
  const hot = hover || lifted

  useEffect(() => {
    const g = pivot.current
    if (g) registry.set(book.idx, g)
    return () => {
      registry.delete(book.idx)
    }
  }, [book.idx, registry])

  useFrame((_, dt) => {
    const g = pivot.current
    if (!g) return
    // 쉴 때: 밑면을 축으로 뒤로 기대고(윗변이 벽 쪽) 좌우로 조금 튼다. 가리키면: 거의 서며 앞으로 나오고 포인터 쪽으로 기운다.
    const tx = hot ? -lean * 0.2 + tilt.current.y * 0.16 : -lean
    const ty = hot ? tilt.current.x * 0.24 : yaw
    // 밑동을 기댄 만큼 앞으로 뺀다 — 윗변이 벽에 **닿고** 뚫지 않는다. 0.02 에 두었을 때 책 윗부분이 벽 판 뒤로
    //   넘어가 반투명 번짐 판에 덮였고(표지가 바래 보였다), 그 경계가 표지를 사선으로 갈랐다.
    const restZ = BOOK_H * Math.sin(lean) + BOOK_D + 0.04
    const tz = hot ? restZ + 0.22 : restZ
    const tyPos = hot ? y + 0.07 : y
    const k = reduce ? 1 : 1 - Math.exp(-dt * 9)
    g.rotation.x += (tx - g.rotation.x) * k
    g.rotation.y += (ty - g.rotation.y) * k
    g.position.z += (tz - g.position.z) * k
    g.position.y += (tyPos - g.position.y) * k
    // demand 모드 — 아직 자리에 안 닿았으면 다음 프레임을 요청한다(닿으면 멈춘다: 가만히 있는 서가는 GPU 를 쓰지 않는다).
    const far = Math.abs(tx - g.rotation.x) + Math.abs(ty - g.rotation.y) + Math.abs(tz - g.position.z) + Math.abs(tyPos - g.position.y)
    if (far > 0.0005) invalidate()
  })

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const uv = e.uv
    if (uv) tilt.current = { x: uv.x - 0.5, y: uv.y - 0.5 }
    invalidate()
  }

  // 상자 면 순서: +x, -x, +y, -y, +z(앞 = 표지), -z(뒤)
  return (
    <>
    {/* 벽에 드리운 책 그림자 — 윗변이 벽에 닿은 자리 둘레가 가장 짙다(기댄 책). 벽 판에 붙인 부드러운 사각. */}
    <mesh position={[x + 0.05, y + BOOK_H * 0.55, 0.004]} renderOrder={1}>
      <planeGeometry args={[BOOK_W * 1.34, BOOK_H * 1.2]} />
      <meshBasicMaterial map={bookShade} transparent depthWrite={false} toneMapped={false} opacity={lifted || hover ? 0.55 : 1} />
    </mesh>
    <group ref={pivot} position={[x, y, BOOK_H * Math.sin(lean) + BOOK_D + 0.04]} rotation={[-lean, yaw, 0]}>
      <mesh
        position={[0, BOOK_H / 2, BOOK_D / 2]}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
          onPoint()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHover(false)
          tilt.current = { x: 0, y: 0 }
          document.body.style.cursor = ''
        }}
        onPointerMove={onMove}
        onClick={(e) => {
          e.stopPropagation()
          onOpen()
        }}
      >
        <boxGeometry args={[BOOK_W, BOOK_H, BOOK_D]} />
        <meshStandardMaterial attach="material-0" map={edge} roughness={0.9} />
        <meshStandardMaterial attach="material-1" map={edge} roughness={0.9} />
        <meshStandardMaterial attach="material-2" map={edge} roughness={0.9} />
        <meshStandardMaterial attach="material-3" color="#d9d5cc" roughness={0.9} />
        {/* 표지 앞면은 빛을 받지 않는 재질 — 참조 표지처럼 인쇄 색 그대로(빛 계산을 거치면 흰 면이 회색으로 눌렸다).
            key — 텍스처가 늦게 도착하면 재질을 새로 만든다. 같은 재질에 map 만 끼우면 셰이더가 안 바뀌어 흰 판으로 남았다. */}
        <meshBasicMaterial key={tex ? tex.uuid : 'blank'} attach="material-4" map={tex ?? undefined} color={tex ? '#ffffff' : '#3a3d4a'} toneMapped={false} />
        <meshStandardMaterial attach="material-5" color="#efece6" roughness={0.9} />
      </mesh>
    </group>
    </>
  )
}

// ── 장면 ────────────────────────────────────────────────────────────
function Scene({ rows, focused, onPoint, onOpen, registry }: Omit<Props, 'renderHit'> & { registry: Map<number, THREE.Object3D> }) {
  const edge = usePaperEdge()
  const glow = useGlow()
  const shade = useShelfShade()
  const widest = Math.max(...rows.map((r) => r.length))
  const rowW = widest * BOOK_W + (widest - 1) * GAP
  const shelfW = rowW + SHELF_OVERHANG * 2
  const bookShade = useBookShade()

  return (
    <>
      {/*
        빛의 합 ≈ 1.4(비친 면) / 0.9(그늘). 톤매핑을 끄므로(Canvas flat) 이 값이 곧 화면 밝기다 —
        ACES 톤매핑을 켠 채 1.35+0.6+1.6 을 주던 동안 표지 윗부분이 하얗게 날아가고 흰 번짐이 회색 타원으로 보였다.
      */}
      {/*
        그림자는 **빛으로 계산하지 않는다** — 그림자 맵으로 그리던 동안 선반 그림자가 벽을 길게 덮고(디더링),
        선반을 빼면 책 그림자가 선반을 뚫고 아래 벽에 네모로 찍혔다. 참조의 그늘은 짧고 부드럽다 → 그림자 판(선반 그늘 ·
        책 그림자)으로 모양을 직접 정한다. 빛은 옆면·선반의 입체 음영만 만든다(표지 앞면은 빛을 받지 않는다).
      */}
      <ambientLight intensity={0.78} />
      <hemisphereLight args={['#ffffff', '#e7e1d8', 0.2]} />
      <directionalLight position={[0.6, 8, 6]} intensity={0.55} />

      {rows.map((row, ri) => {
        // 위에서부터: 첫 줄이 가장 위
        const y = (rows.length - 1 - ri) * ROW_PITCH
        const w = row.length * BOOK_W + (row.length - 1) * GAP
        return (
          <group key={ri}>
            {/* 선반 뒤 흰 번짐 — 선반 위 벽이 가장 밝다(참조). */}
            <mesh position={[0, y + BOOK_H * 0.55, -0.015]}>
              <planeGeometry args={[shelfW * 1.15, BOOK_H * 1.9]} />
              <meshBasicMaterial map={glow} transparent depthWrite={false} opacity={0.9} />
            </mesh>
            {/* 선반 판 */}
            {/* 선반 그늘 — 선반 바로 아래 벽 */}
            <mesh position={[0, y - SHELF_T - 0.24, -0.01]}>
              <planeGeometry args={[shelfW * 1.02, 0.5]} />
              <meshBasicMaterial map={shade} transparent depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh position={[0, y - SHELF_T / 2, SHELF_D / 2]} receiveShadow>
              <boxGeometry args={[shelfW, SHELF_T, SHELF_D]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} roughness={0.5} />
            </mesh>
            {row.map((b, i) => (
              <Book
                key={b.set.id}
                book={b}
                x={-w / 2 + BOOK_W / 2 + i * (BOOK_W + GAP)}
                y={y}
                lean={(9 + ((b.idx * 7) % 4)) * (Math.PI / 180)}
                yaw={((((b.idx * 37) % 9) - 4) * Math.PI) / 180}
                lifted={focused === b.idx}
                edge={edge}
                bookShade={bookShade}
                onPoint={() => onPoint(b.idx)}
                onOpen={() => onOpen(b.set, b.idx)}
                registry={registry}
              />
            ))}
          </group>
        )
      })}
      <Framer rows={rows} shelfW={shelfW} />
    </>
  )
}

/** 카메라를 장면 폭에 맞춘다 — 눈은 선반보다 조금 위(윗변이 멀어 보인다). */
function Framer({ rows, shelfW }: { rows: ShelfBook[][]; shelfW: number }) {
  const { camera, size } = useThree()
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const sceneH = rows.length * ROW_PITCH + 0.4
    const aspect = size.width / size.height
    const halfV = (FOV * Math.PI) / 360
    const needH = Math.max(sceneH, (shelfW + 0.4) / aspect)
    const dist = needH / 2 / Math.tan(halfV)
    const cy = ((rows.length - 1) * ROW_PITCH) / 2 + BOOK_H * 0.42
    cam.fov = FOV
    cam.position.set(0, cy + dist * 0.12, dist)
    cam.lookAt(0, cy, 0)
    cam.updateProjectionMatrix()
  }, [camera, size, rows, shelfW])
  return null
}

/** 3D 책 위치를 화면 좌표로 투영해 접근성 버튼을 겹친다. */
function HitSync({ registry, onRects }: { registry: Map<number, THREE.Object3D>; onRects: (r: Map<number, DOMRectLike>) => void }) {
  const { camera, size } = useThree()
  const last = useRef('')
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const out = new Map<number, DOMRectLike>()
    registry.forEach((obj, idx) => {
      const pts: [number, number][] = []
      for (const [px, py] of [
        [-BOOK_W / 2, 0],
        [BOOK_W / 2, 0],
        [-BOOK_W / 2, BOOK_H],
        [BOOK_W / 2, BOOK_H],
      ] as const) {
        v.set(px, py, BOOK_D).applyMatrix4(obj.matrixWorld).project(camera)
        pts.push([((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height])
      }
      const xs = pts.map((p) => p[0])
      const ys = pts.map((p) => p[1])
      out.set(idx, { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) })
    })
    const key = [...out].map(([k, r]) => `${k}:${r.left | 0},${r.top | 0},${r.width | 0}`).join('|')
    if (key !== last.current) {
      last.current = key
      onRects(out)
    }
  })
  return null
}

type DOMRectLike = { left: number; top: number; width: number; height: number }

export default function VocabShelf3D({ rows, focused, onPoint, onOpen, renderHit }: Props) {
  const registry = useMemo(() => new Map<number, THREE.Object3D>(), [])
  const [rects, setRects] = useState<Map<number, DOMRectLike>>(new Map())
  // 높이 — 줄 수에 비례(폭은 부모). 참조처럼 선반 위아래로 벽이 넉넉하다.
  const height = Math.round(rows.length * 330 + 90)
  return (
    <div className="relative w-full" style={{ height }}>
      <Canvas
        frameloop="demand"
        // 톤매핑 끔 — 표지 색이 교재 표지 SVG 와 같게, 흰 선반·번짐이 흰색 그대로 나온다.
        flat
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ fov: FOV, near: 0.1, far: 100, position: [0, 2, 12] }}
        style={{ position: 'absolute', inset: 0 }}
        // 캔버스는 보조기기에 숨긴다 — 같은 정보가 겹쳐 둔 버튼에 있다.
        aria-hidden
      >
        <Scene rows={rows} focused={focused} onPoint={onPoint} onOpen={onOpen} registry={registry} />
        <HitSync registry={registry} onRects={setRects} />
      </Canvas>
      {rows.flat().map((b) => {
        const r = rects.get(b.idx)
        if (!r) return null
        return renderHit(b, { position: 'absolute', left: r.left, top: r.top, width: r.width, height: r.height })
      })}
    </div>
  )
}
