// apps/web/src/components/game/wordblitz/PlushieModel.tsx
// 인형 GLB 로더 + GLB 애니메이션 + sphere 폴백
//
// v5 변경:
//   - GLB 애니메이션 자동 재생 (idle 등) - useAnimations 사용
//   - emissive 적용 안 함 → 원본 색상 그대로
//   - 살짝 둥둥 효과 (BobAnimation)

'use client';

import { useGLTF, useAnimations } from '@react-three/drei';
import { ErrorBoundary } from 'react-error-boundary';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PlushieType } from '@/lib/wordblitz/data';

interface PlushieModelProps {
  type: PlushieType;
  isTarget: boolean;
  /** 각 인형 고유 시드 (애니메이션 다양화) */
  seed?: number;
}

const PLUSHIE_TARGET_HEIGHT = 1.0;

function PlushieGLB({ type, seed = 0 }: PlushieModelProps) {
  if (!type.modelUrl) {
    throw new Error('No modelUrl');
  }

  const { scene, animations } = useGLTF(type.modelUrl);
  const groupRef = useRef<THREE.Group>(null);

  // 클론 + 자동 스케일
  const cloned = useMemo(() => {
    const clone = scene.clone(true);

    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    if (size.y > 0 && isFinite(size.y)) {
      const scale = PLUSHIE_TARGET_HEIGHT / size.y;
      clone.scale.setScalar(scale);

      clone.position.x = -center.x * scale;
      clone.position.y = -box.min.y * scale;
      clone.position.z = -center.z * scale;
    }

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // 머티리얼 그대로 (emissive 적용 안 함)
      }
    });

    return clone;
  }, [scene]);

  // GLB 애니메이션 (있으면 자동 재생)
  const { actions, names } = useAnimations(animations, groupRef);

  useEffect(() => {
    if (names.length === 0) return;

    // 첫 번째 애니메이션 자동 재생 (idle, breathe 등)
    const firstAction = actions[names[0]];
    if (firstAction) {
      firstAction.reset().fadeIn(0.5).play();
      // 약간 느리게 (인형뽑기 분위기)
      firstAction.timeScale = 0.7 + Math.random() * 0.3;
    }

    return () => {
      if (firstAction) firstAction.fadeOut(0.5);
    };
  }, [actions, names]);

  // GLB 애니메이션 없으면 미세 둥둥 효과
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    if (names.length > 0) return; // 애니메이션 있으면 둥둥 X

    const t = clock.elapsedTime + seed;
    // 미세 회전 (살아있는 느낌)
    groupRef.current.rotation.y = Math.sin(t * 0.5) * 0.05;
    // 미세 위아래 (호흡)
    groupRef.current.position.y = Math.sin(t * 1.2) * 0.02;
  });

  return (
    <group ref={groupRef}>
      <primitive object={cloned} />
    </group>
  );
}

function PlushieFallback({ type }: PlushieModelProps) {
  const radius = 0.5;

  return (
    <group>
      <mesh position={[0, radius, 0]} castShadow receiveShadow>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial
          color={type.color}
          roughness={0.7}
          metalness={0.05}
        />
      </mesh>

      <mesh position={[-0.15, radius + 0.05, 0.42]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshBasicMaterial color={0x1A0F0A} />
      </mesh>
      <mesh position={[0.15, radius + 0.05, 0.42]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshBasicMaterial color={0x1A0F0A} />
      </mesh>
    </group>
  );
}

export function PlushieModel(props: PlushieModelProps) {
  if (!props.type.modelUrl) {
    return <PlushieFallback {...props} />;
  }

  return (
    <ErrorBoundary fallback={<PlushieFallback {...props} />}>
      <Suspense fallback={<PlushieFallback {...props} />}>
        <PlushieGLB {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}
