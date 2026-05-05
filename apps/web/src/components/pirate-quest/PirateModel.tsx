// apps/web/src/components/pirate-quest/PirateModel.tsx
// GLB 모델 로더 + 자동 스케일 + 영단어 라벨 (선택지일 때만) + 클릭

'use client';

import { Html, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { CATEGORY_COLORS } from '@/lib/pirate-quest/data';
import type { PirateWord } from '@/lib/pirate-quest/data';

interface PirateModelProps {
  url: string;
  position: [number, number, number];
  /** 자동 스케일 보정 (기본 1.0 = 1.1 unit) */
  scale?: number;
  /** 영단어 라벨 표시 */
  showLabel?: boolean;
  /** 라벨 표시 영단어 */
  label?: string;
  /** 카테고리 (라벨 색상) */
  category?: PirateWord['category'];
  /** 정답/오답 피드백 */
  feedback?: 'idle' | 'correct' | 'wrong' | 'dimmed';
  /** 힌트 활성 (정답 GLB 황금 외곽선 + 광원) */
  isHintTarget?: boolean;
  onClick?: () => void;
}

const TARGET_HEIGHT = 1.1; // 적절한 사이즈 (이전 0.9 → 1.1)

/**
 * 메시 전용 bounding box — 스키닝된 GLB(텐타클·동물)에서
 * Box3.setFromObject 가 bone 위치까지 포함해 비정상적으로 큰 사이즈가 나오는 문제 회피.
 */
function meshOnlyBox(obj: THREE.Object3D): THREE.Box3 {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3();
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const mb = mesh.geometry.boundingBox;
    if (!mb) return;
    const cloned = mb.clone();
    cloned.applyMatrix4(mesh.matrixWorld);
    box.union(cloned);
  });
  return box;
}

export function PirateModel({
  url,
  position,
  scale = 1.0,
  showLabel = false,
  label,
  category,
  feedback = 'idle',
  isHintTarget = false,
  onClick,
}: PirateModelProps) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const seedRef = useRef(Math.random() * 10);
  const correctPulseRef = useRef(0);
  const wrongShakeRef = useRef(0);

  // 클론 + 자동 스케일 (메시 전용 bbox — 스키닝 GLB 안전)
  const cloned = useMemo(() => {
    const clone = scene.clone(true);
    const box = meshOnlyBox(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    if (size.y > 0.01 && isFinite(size.y)) {
      const s = (TARGET_HEIGHT * scale) / size.y;
      clone.scale.setScalar(s);
      clone.position.x = -center.x * s;
      clone.position.y = -box.min.y * s;
      clone.position.z = -center.z * s;
    }
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          if (m && (m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            const sm = m as THREE.MeshStandardMaterial;
            sm.envMapIntensity = 1.2;
            sm.needsUpdate = true;
          }
        });
      }
    });
    return clone;
  }, [scene, scale]);

  if (feedback === 'correct' && correctPulseRef.current === 0) correctPulseRef.current = 1.0;
  if (feedback === 'wrong' && wrongShakeRef.current === 0) wrongShakeRef.current = 1.0;

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime + seedRef.current;

    const idleY = Math.abs(Math.sin(t * 1.6)) * 0.03;
    const idleR = Math.sin(t * 0.7) * 0.06;
    const hoverY = hovered ? 0.12 : 0;
    const hoverScale = hovered && showLabel ? 1.1 : 1.0;

    let correctY = 0;
    if (correctPulseRef.current > 0) {
      correctY = correctPulseRef.current * 0.5;
      correctPulseRef.current = Math.max(0, correctPulseRef.current - delta * 1.5);
    }

    let wrongX = 0;
    if (wrongShakeRef.current > 0) {
      wrongX = Math.sin(clock.elapsedTime * 30) * wrongShakeRef.current * 0.12;
      wrongShakeRef.current = Math.max(0, wrongShakeRef.current - delta * 2);
    }

    groupRef.current.position.x = position[0] + wrongX;
    groupRef.current.position.y = position[1] + idleY + hoverY + correctY;
    groupRef.current.position.z = position[2];
    groupRef.current.rotation.y = idleR;

    const targetScale = feedback === 'dimmed' ? 0.85 : hoverScale;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.15);
  });

  const isClickable = !!onClick && showLabel;

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={
        isClickable
          ? (e) => {
              e.stopPropagation();
              onClick?.();
            }
          : undefined
      }
      onPointerOver={
        isClickable
          ? (e) => {
              e.stopPropagation();
              setHovered(true);
              document.body.style.cursor = 'pointer';
            }
          : undefined
      }
      onPointerOut={
        isClickable
          ? () => {
              setHovered(false);
              document.body.style.cursor = 'auto';
            }
          : undefined
      }
    >
      <primitive object={cloned} />

      {/* 영단어 라벨 — 화면 픽셀 고정 + 카테고리 색상 */}
      {showLabel && label && (
        <Html
          position={[0, TARGET_HEIGHT * scale + 0.4, 0]}
          center
          zIndexRange={[10, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            className={`pq-glb-label ${
              feedback === 'correct'
                ? 'pq-glb-label--correct'
                : feedback === 'wrong'
                  ? 'pq-glb-label--wrong'
                  : hovered
                    ? 'pq-glb-label--hover'
                    : ''
            }`}
            style={
              category && feedback === 'idle' && !hovered
                ? {
                    background: CATEGORY_COLORS[category].bg,
                    borderColor: CATEGORY_COLORS[category].border,
                    color: CATEGORY_COLORS[category].text,
                  }
                : undefined
            }
          >
            {label}
          </div>
        </Html>
      )}

      {/* 호버 ring (라벨 있는 GLB만) */}
      {hovered && isClickable && (
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.7, 32]} />
          <meshBasicMaterial color={0xFFD93D} transparent opacity={0.75} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* 힌트 외곽선 + 광원 (창의적 요소) */}
      {isHintTarget && (
        <>
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.65, 0.95, 32]} />
            <meshBasicMaterial color={0xFFD93D} transparent opacity={0.9} side={THREE.DoubleSide} />
          </mesh>
          <pointLight color={0xFFD93D} intensity={5} distance={3} position={[0, 1.0, 0]} />
        </>
      )}

      {/* 정답 halo */}
      {feedback === 'correct' && (
        <>
          <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.95, 32]} />
            <meshBasicMaterial color={0xFFD93D} transparent opacity={0.65} side={THREE.DoubleSide} />
          </mesh>
          <pointLight color={0xFFD93D} intensity={4} distance={3} position={[0, 0.8, 0]} />
        </>
      )}
    </group>
  );
}
