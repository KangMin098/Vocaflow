// apps/web/src/components/game/wordblitz/Plushie.tsx
// 인형 컨테이너 - GLB 모델 + 단어 라벨 + 정답 글로우
//
// v5 변경:
//   - PlushieModel에 seed 전달 (애니메이션 다양화)
//   - 정답 인형은 글로우 ring으로 표시 (emissive 안 씀)

'use client';

import { useFrame } from '@react-three/fiber';
import { forwardRef, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PlushieModel } from './PlushieModel';
import type { PlushieInstance } from '@/lib/wordblitz/types';

interface PlushieProps {
  data: PlushieInstance;
  isGrabbed: boolean;
}

function createLabelTexture(text: string, isTarget: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.font = 'bold 70px Lora, serif';
  const textW = ctx.measureText(text).width;
  const labelW = textW + 40;
  const labelX = (512 - labelW) / 2;

  ctx.fillStyle = isTarget ? 'rgba(255, 217, 61, 0.95)' : 'rgba(255, 255, 255, 0.95)';
  const r = 14;
  const x = labelX, y = 30, w = labelW, h = 68;
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
  ctx.fill();

  ctx.strokeStyle = isTarget ? '#E0AC1E' : '#2A1810';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#1A0F0A';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export const Plushie = forwardRef<THREE.Group, PlushieProps>(function Plushie(
  { data, isGrabbed },
  ref
) {
  const internalRef = useRef<THREE.Group>(null);
  const groupRef = (ref ?? internalRef) as React.MutableRefObject<THREE.Group | null>;
  const labelRef = useRef<THREE.Mesh>(null);
  const glowRingRef = useRef<THREE.Mesh>(null);

  // 각 인형 고유 시드 (애니메이션 다양화)
  const seed = useMemo(() => Math.random() * 10, []);
  const baseY = data.position[1];

  const labelTex = useMemo(
    () => createLabelTexture(data.word.en, data.isTarget),
    [data.word.en, data.isTarget]
  );

  useFrame(({ clock, camera }) => {
    if (!groupRef.current || isGrabbed) return;

    const t = clock.elapsedTime;

    // 정답 인형 살짝 둥둥
    if (data.isTarget) {
      groupRef.current.position.y = baseY + Math.sin(t * 3) * 0.08;
    }

    // 라벨 카메라 향함
    if (labelRef.current) {
      labelRef.current.lookAt(camera.position);
    }

    // 글로우 ring 회전 + 깜박임
    if (glowRingRef.current && data.isTarget) {
      glowRingRef.current.rotation.z += 0.02;
      const mat = glowRingRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.4 + Math.sin(t * 3) * 0.2;
    }
  });

  return (
    <group
      ref={groupRef as React.RefObject<THREE.Group>}
      position={data.position}
      rotation={[0, data.rotationY, 0]}
    >
      {/* GLB 모델 (애니메이션 자동 재생) */}
      <PlushieModel type={data.type} isTarget={data.isTarget} seed={seed} />

      {/* 단어 라벨 (인형 위, 카메라 향함) */}
      <mesh ref={labelRef} position={[0, 1.4, 0]}>
        <planeGeometry args={[1.4, 0.35]} />
        <meshBasicMaterial
          map={labelTex}
          transparent
          depthWrite={false}
          depthTest={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 정답 글로우 ring */}
      {data.isTarget && !isGrabbed && (
        <mesh ref={glowRingRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.7, 32]} />
          <meshBasicMaterial color={0xFFD93D} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
});
