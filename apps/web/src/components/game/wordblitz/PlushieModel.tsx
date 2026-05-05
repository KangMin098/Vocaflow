// apps/web/src/components/game/wordblitz/PlushieModel.tsx
// 인형 GLB 로더 + 애니메이션 + sphere 폴백 (Master Redesign §5-3)
//
// 핵심:
//   - 모든 인형 Y(높이) 1.0 통일 (box.size.y 기준 자동 스케일)
//   - 바닥(box.min.y)이 정확히 Y=0 에 닿음
//   - 머티리얼 그대로 (emissive 적용 X) - 원본 색상 보존 ★
//   - PBR 환경광 보정만 (envMapIntensity 0.8) - low-poly GLB 자연스럽게
//   - GLB 애니메이션 자동 재생 (있으면 첫 번째)
//   - 없으면 미세 회전 + 둥둥
//   - 각 인형 고유 seed 로 다양화
//   - ErrorBoundary + Suspense → sphere 폴백

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
  /** 외부에서 클릭 시 트리거 (점프 + 애니 부스트) */
  clickPulseRef?: React.MutableRefObject<number>;
}

const PLUSHIE_TARGET_HEIGHT = 1.5;

function PlushieGLB({ type, seed = 0, clickPulseRef }: PlushieModelProps) {
  if (!type.modelUrl) {
    throw new Error('No modelUrl');
  }

  const { scene, animations } = useGLTF(type.modelUrl);
  const groupRef = useRef<THREE.Group>(null);

  // 클론 + Y 기준 통일 스케일 + 바닥 정렬
  const cloned = useMemo(() => {
    const clone = scene.clone(true);

    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    if (size.y > 0 && isFinite(size.y)) {
      // Y(높이) 1.0 으로 통일 → 모든 인형 같은 크기
      const scale = PLUSHIE_TARGET_HEIGHT / size.y;
      clone.scale.setScalar(scale);

      // 가로/세로 중심 정렬 + 바닥(box.min.y) 정확히 Y=0
      clone.position.x = -center.x * scale;
      clone.position.y = -box.min.y * scale;
      clone.position.z = -center.z * scale;
    }

    // 머티리얼 - 원본 색상 보존 + PBR 환경광 보정만
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // PBR envMapIntensity - GLB 원본 색깔 우뚝 보이게 (어두운 박스 배경 보상)
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          if (
            m &&
            ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial ||
              (m as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial)
          ) {
            const sm = m as THREE.MeshStandardMaterial;
            // GLB 캐릭터 특징(원본 색상) 살리기 — 환경광 풀로
            sm.envMapIntensity = 1.0;
            // 약간의 자체 발광 추가 (어두운 박스에서 캐릭터 풍부함)
            if (!sm.emissive || sm.emissive.r + sm.emissive.g + sm.emissive.b === 0) {
              sm.emissive = sm.color.clone();
              sm.emissiveIntensity = 0.08;
            }
            sm.needsUpdate = true;
          }
        });
      }
    });

    return clone;
  }, [scene]);

  // GLB 애니메이션 자동 재생 (있으면)
  const { actions, names } = useAnimations(animations, groupRef);

  useEffect(() => {
    if (names.length === 0) return;

    // 모든 GLB 애니메이션 동시 재생 (idle, walk, dance 등 다 살림)
    names.forEach((name) => {
      const action = actions[name];
      if (action) {
        action.reset().fadeIn(0.5).play();
        action.timeScale = 0.8 + Math.random() * 0.6;
      }
    });

    return () => {
      names.forEach((name) => {
        const action = actions[name];
        if (action) action.fadeOut(0.5);
      });
    };
  }, [actions, names]);

  // Idle 애니메이션 — 활발한 움직임 + 클릭 시 점프 부스트
  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;

    const t = clock.elapsedTime + seed;

    // 클릭 펄스 감쇠 (1.0에서 시작해서 0으로)
    let clickBoost = 0;
    if (clickPulseRef && clickPulseRef.current > 0) {
      clickBoost = clickPulseRef.current;
      clickPulseRef.current = Math.max(0, clickPulseRef.current - delta * 2);
    }

    if (names.length > 0) {
      // GLB 애니 + 추가 점프
      groupRef.current.position.y = Math.abs(Math.sin(t * 2.0)) * 0.08 + clickBoost * 0.4;
      groupRef.current.rotation.y = Math.sin(t * 0.6) * 0.08 + clickBoost * 0.3;
      // 클릭 시 GLB 애니메이션 timeScale 부스트
      if (clickBoost > 0.5) {
        names.forEach((name) => {
          const action = actions[name];
          if (action) action.timeScale = 2.0;
        });
      } else if (clickBoost > 0 && clickBoost < 0.05) {
        names.forEach((name) => {
          const action = actions[name];
          if (action) action.timeScale = 0.8 + Math.random() * 0.6;
        });
      }
    } else {
      // GLB 애니 없으면 매우 활발한 idle + 클릭 점프
      groupRef.current.rotation.y = Math.sin(t * 0.8) * 0.15 + clickBoost * 0.5;
      groupRef.current.position.y = Math.abs(Math.sin(t * 2.2)) * 0.1 + clickBoost * 0.5;
      groupRef.current.rotation.z = Math.sin(t * 1.1) * 0.06;
      groupRef.current.rotation.x = Math.sin(t * 1.5) * 0.03;
    }
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
      {/* 몸통 */}
      <mesh position={[0, radius, 0]} castShadow receiveShadow>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial
          color={type.color}
          roughness={0.7}
          metalness={0.05}
        />
      </mesh>

      {/* 눈 */}
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
