// apps/web/src/components/game/wordblitz/ClawModel.tsx
// 집게 - 천장(Y=7)에서 매달림 + 진자 흔들림
//
// v5 좌표:
//   케이블 시작: Y=7 (박스 천장)
//   집게 home: Y=6
//   집게 drop: Y=2

'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CLAW_MODEL_URL } from '@/lib/wordblitz/data';
import type { LiveClawState } from '@/lib/wordblitz/types';

interface ClawModelProps {
  liveStateRef: React.MutableRefObject<LiveClawState>;
  grabbedPlushieRef?: React.MutableRefObject<THREE.Group | null>;
}

const CLAW_X_RANGE = 2.2;
const CEILING_Y = 7;

export function ClawModel({ liveStateRef, grabbedPlushieRef }: ClawModelProps) {
  const holderRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const cableRef = useRef<THREE.Mesh>(null);
  const armsRef = useRef<THREE.Object3D[]>([]);

  const { scene: glbScene } = useGLTF(CLAW_MODEL_URL);

  const clonedScene = useMemo(() => {
    const clone = glbScene.clone(true);

    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (maxDim > 0 && isFinite(maxDim)) {
      // 집게 크기 - 박스 폭 6의 1/4 정도
      const scale = 1.5 / maxDim;
      clone.scale.setScalar(scale);

      clone.position.x = -center.x * scale;
      clone.position.y = -box.max.y * scale;
      clone.position.z = -center.z * scale;
    }

    const arms: THREE.Object3D[] = [];
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // 머티리얼은 GLB 원본 그대로 (조명 약하게라 그대로 둠)
      }

      if (child.name && /arm|claw|finger|grip|hook/i.test(child.name)) {
        arms.push(child);
      }

      if ((child as THREE.Bone).isBone) {
        arms.push(child);
      }
    });

    armsRef.current = arms;

    if (typeof window !== 'undefined') {
      console.log('[Claw] 본/팔 발견:', arms.length, '개');
    }

    return clone;
  }, [glbScene]);

  useFrame(() => {
    const live = liveStateRef.current;
    const holder = holderRef.current;
    const body = bodyRef.current;
    const cable = cableRef.current;

    if (!holder || !body || !cable) return;

    holder.position.x = live.clawX * CLAW_X_RANGE;
    holder.position.y = live.clawY;
    body.rotation.z = live.clawSwing;

    // 케이블: 천장(Y=7)에서 집게 본체 위까지
    const cableLength = CEILING_Y - live.clawY - 0.2;
    cable.scale.y = Math.max(0.1, cableLength);
    cable.position.y = cableLength / 2 + 0.2;

    const arms = armsRef.current;
    if (arms.length >= 4) {
      const closeAmount = (1 - live.clawOpen) * 0.5;
      arms.forEach((arm) => {
        arm.rotation.x = closeAmount;
      });
    }

    const grabbed = grabbedPlushieRef?.current;
    if (grabbed) {
      grabbed.position.x = holder.position.x + Math.sin(live.clawSwing) * 0.3;
      grabbed.position.y = holder.position.y - 1.6;
      grabbed.position.z = 0;
      grabbed.rotation.z = live.clawSwing * 0.7;
      grabbed.rotation.y += 0.02;
    }
  });

  return (
    <group ref={holderRef} position={[0, 6, 0]}>
      {/* 케이블 (천장 Y=7에서 매달림) */}
      <mesh ref={cableRef}>
        <cylinderGeometry args={[0.04, 0.04, 1, 8]} />
        <meshStandardMaterial color={0x2A3340} roughness={0.4} metalness={0.8} />
      </mesh>
      {/* 집게 본체 */}
      <group ref={bodyRef}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}

useGLTF.preload(CLAW_MODEL_URL);
