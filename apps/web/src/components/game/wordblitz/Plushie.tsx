// apps/web/src/components/game/wordblitz/Plushie.tsx
// 인형 컨테이너 (Pro-level Redesign)
//
// 강화 디자인:
//   1. 라벨 - 더 큰 카드 (그림자 + 둥근 모서리 + 글로우)
//   2. Billboard - Y축만 회전 (인형들이 스택돼 보이지 않게)
//   3. 정답 - 황금 halo + ring + 빛 광선 + 펄스
//   4. 정답 인형은 일반보다 살짝 위에 띄움

'use client';

import { useFrame } from '@react-three/fiber';
import { forwardRef, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PlushieModel } from './PlushieModel';
import type { PlushieInstance } from '@/lib/wordblitz/types';
import { WB_COLORS } from '@/lib/wordblitz/theme';

interface PlushieProps {
  data: PlushieInstance;
  isGrabbed: boolean;
}

// ─── 라벨 텍스처 ───
function createLabelTexture(text: string, isTarget: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 768, 192);

  // 그림자 (먼저 - 카드 뒤에)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  const shadowOffset = 8;

  ctx.font = 'bold 92px Lora, serif';
  const textW = ctx.measureText(text).width;
  const padding = 60;
  const labelW = textW + padding;
  const labelH = 110;
  const x = (768 - labelW) / 2;
  const y = (192 - labelH) / 2;
  const r = 22;

  // 그림자
  drawRoundedRect(ctx, x + shadowOffset, y + shadowOffset, labelW, labelH, r);
  ctx.fill();

  // 카드 배경 - 정답=황금 그라디언트, 일반=흰 그라디언트
  if (isTarget) {
    const grad = ctx.createLinearGradient(x, y, x, y + labelH);
    grad.addColorStop(0, '#FFE876');
    grad.addColorStop(0.5, '#FFD93D');
    grad.addColorStop(1, '#E0AC1E');
    ctx.fillStyle = grad;
  } else {
    const grad = ctx.createLinearGradient(x, y, x, y + labelH);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
    grad.addColorStop(1, 'rgba(245, 245, 250, 0.96)');
    ctx.fillStyle = grad;
  }
  drawRoundedRect(ctx, x, y, labelW, labelH, r);
  ctx.fill();

  // 테두리
  ctx.strokeStyle = isTarget ? '#A77E0E' : '#1A0F0A';
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, x, y, labelW, labelH, r);
  ctx.stroke();

  // 내부 하이라이트 라인 (글로스 효과)
  ctx.strokeStyle = isTarget ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, x + 4, y + 4, labelW - 8, labelH - 8, r - 4);
  ctx.stroke();

  // 텍스트
  ctx.fillStyle = '#1A0F0A';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 384, 96);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export const Plushie = forwardRef<THREE.Group, PlushieProps>(function Plushie(
  { data, isGrabbed },
  ref
) {
  const internalRef = useRef<THREE.Group>(null);
  const groupRef = (ref ?? internalRef) as React.MutableRefObject<THREE.Group | null>;
  const labelGroupRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const clickPulseRef = useRef(0);

  const seed = useMemo(() => Math.random() * 10, []);
  const baseY = data.position[1];
  // 정답 인형은 살짝 위에 (시선 유도)
  const targetLift = data.isTarget ? 0.18 : 0;

  const labelTex = useMemo(
    () => createLabelTexture(data.word.en, data.isTarget),
    [data.word.en, data.isTarget]
  );

  useFrame(({ clock, camera }) => {
    if (!groupRef.current) return;

    // 잡힌 상태일 때 GLB 애니 부스트 (clickPulse 0.7 유지 → PlushieModel에서 timeScale ↑)
    if (isGrabbed) {
      clickPulseRef.current = Math.max(clickPulseRef.current, 0.7);
      // 라벨도 카메라 향함
      if (labelGroupRef.current) {
        const dx = camera.position.x - labelGroupRef.current.position.x;
        const dz = camera.position.z - labelGroupRef.current.position.z;
        labelGroupRef.current.rotation.y = Math.atan2(dx, dz);
      }
      return;
    }

    const t = clock.elapsedTime;

    // 정답 인형 - 둥둥 부유
    if (data.isTarget) {
      groupRef.current.position.y = baseY + targetLift + Math.sin(t * 2.5) * 0.07;
    }

    // Billboard - Y축만 (수평 카메라 향함, 인형 위 라벨이 항상 정면)
    if (labelGroupRef.current) {
      const dx = camera.position.x - labelGroupRef.current.position.x;
      const dz = camera.position.z - labelGroupRef.current.position.z;
      labelGroupRef.current.rotation.y = Math.atan2(dx, dz);
    }

    // Halo
    if (haloRef.current && data.isTarget) {
      const mat = haloRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.35 + Math.sin(t * 2.5) * 0.18;
    }
    // Ring
    if (ringRef.current && data.isTarget) {
      ringRef.current.rotation.z += 0.025;
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.55 + Math.sin(t * 3) * 0.2;
    }
    // Beam
    if (beamRef.current && data.isTarget) {
      const mat = beamRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.18 + Math.sin(t * 2) * 0.08;
    }
  });

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    // 클릭 펄스 1.0 → useFrame에서 0으로 감쇠
    clickPulseRef.current = 1.0;
  };

  return (
    <group
      ref={groupRef as React.RefObject<THREE.Group>}
      position={[data.position[0], baseY + targetLift, data.position[2]]}
      rotation={[0, data.rotationY, 0]}
      onClick={handleClick}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      {/* GLB 인형 */}
      <PlushieModel
        type={data.type}
        isTarget={data.isTarget}
        seed={seed}
        clickPulseRef={clickPulseRef}
      />

      {/* 단어 라벨 (Y축 빌보드) — 인형 height 1.5에 맞춰 위치 조정 */}
      <group ref={labelGroupRef} position={[0, 1.9, 0]}>
        <mesh renderOrder={999}>
          <planeGeometry args={[1.6, 0.42]} />
          <meshBasicMaterial
            map={labelTex}
            transparent
            depthWrite={false}
            depthTest={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* ─── 정답 전용 시각 강조 (사이즈 ↑ - 인형 1.5에 맞춤) ─── */}
      {data.isTarget && !isGrabbed && (
        <>
          {/* 바닥 halo (큰 부드러운 원) */}
          <mesh ref={haloRef} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.1, 32]} />
            <meshBasicMaterial
              color={WB_COLORS.goldYellow}
              transparent
              opacity={0.5}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>

          {/* 바닥 ring (회전) */}
          <mesh ref={ringRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.7, 0.9, 32]} />
            <meshBasicMaterial
              color={WB_COLORS.goldYellow}
              transparent
              opacity={0.75}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>

          {/* 위로 솟는 빛 광선 (cone) */}
          <mesh ref={beamRef} position={[0, 1.7, 0]}>
            <cylinderGeometry args={[0.06, 0.55, 3.0, 24, 1, true]} />
            <meshBasicMaterial
              color={WB_COLORS.goldYellow}
              transparent
              opacity={0.2}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>

          {/* 정답 인형 자체 광원 */}
          <pointLight
            color={WB_COLORS.goldYellow}
            intensity={1.5}
            distance={2.5}
            position={[0, 0.7, 0]}
          />
        </>
      )}
    </group>
  );
});
