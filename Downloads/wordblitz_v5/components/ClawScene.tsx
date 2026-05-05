// apps/web/src/components/game/wordblitz/ClawScene.tsx
// 전체 3D 씬 - v5
//
// v5 변경:
//   - 카메라 [0, 2, 16] - 멀리 + 살짝 위 → 박스 + 콘솔 모두 보임
//   - lookAt [0, 1.5, 0] - 박스와 콘솔 중간
//   - spotLight 제거 → ambientLight 강하게 (1.0)만
//   - 인형 색상 망가지지 않음

'use client';

import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ClawMachine } from './ClawMachine';
import { ClawModel } from './ClawModel';
import { Plushie } from './Plushie';
import type { GameState, LiveClawState, ClawTargets } from '@/lib/wordblitz/types';

interface ClawSceneProps {
  state: GameState;
  liveStateRef: React.MutableRefObject<LiveClawState>;
  targetsRef: React.MutableRefObject<ClawTargets>;
  updatePhysics: (dt: number) => void;
}

function PhysicsUpdater({ updatePhysics }: { updatePhysics: (dt: number) => void }) {
  useFrame((_, delta) => {
    updatePhysics(delta);
  });
  return null;
}

function ConsoleStateSync({
  liveStateRef,
  joystickTilt,
  dropPressed,
  isDropping,
}: {
  liveStateRef: React.MutableRefObject<LiveClawState>;
  joystickTilt: React.MutableRefObject<number>;
  dropPressed: React.MutableRefObject<number>;
  isDropping: boolean;
}) {
  useFrame(() => {
    joystickTilt.current = liveStateRef.current.clawX;
    dropPressed.current = isDropping ? 1 : 0;
  });
  return null;
}

function BackgroundStars() {
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  useEffect(() => {
    if (!geometryRef.current) return;
    const positions = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 70;
      positions[i * 3 + 1] = (Math.random() - 0.3) * 25;
      positions[i * 3 + 2] = -12 - Math.random() * 8;
    }
    geometryRef.current.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  }, []);

  return (
    <points>
      <bufferGeometry ref={geometryRef} />
      <pointsMaterial color={0xFFFFFF} size={0.04} sizeAttenuation />
    </points>
  );
}

function SceneContent({ state, liveStateRef, targetsRef, updatePhysics }: ClawSceneProps) {
  const grabbedPlushieRef = useRef<THREE.Group | null>(null);
  const joystickTiltRef = useRef(0);
  const dropPressedRef = useRef(0);

  const isDropping = state.phase === 'dropping' || state.phase === 'grabbing';

  return (
    <>
      <PhysicsUpdater updatePhysics={updatePhysics} />
      <ConsoleStateSync
        liveStateRef={liveStateRef}
        joystickTilt={joystickTiltRef}
        dropPressed={dropPressedRef}
        isDropping={isDropping}
      />

      {/* ═══════ 조명 - 거의 없음 (인형 색상 보존) ═══════ */}
      {/* 환경광 - 강하게, 모든 방향 균일 */}
      <ambientLight color={0xFFFFFF} intensity={1.0} />

      {/* 약한 보조 directional - 그림자만 살짝 */}
      <directionalLight
        color={0xFFFFFF}
        intensity={0.3}
        position={[3, 8, 5]}
      />

      {/* ═══════ 배경 (우주) ═══════ */}
      <BackgroundStars />

      {/* 멀리 어두운 벽 */}
      <mesh position={[0, 5, -10]}>
        <planeGeometry args={[80, 40]} />
        <meshBasicMaterial color={0x0E0A1F} />
      </mesh>

      {/* ═══════ 박스 + 콘솔 ═══════ */}
      <ClawMachine joystickTilt={joystickTiltRef} dropPressed={dropPressedRef} />

      {/* ═══════ 집게 ═══════ */}
      <Suspense fallback={null}>
        <ClawModel
          liveStateRef={liveStateRef}
          grabbedPlushieRef={grabbedPlushieRef}
        />
      </Suspense>

      {/* ═══════ 인형들 ═══════ */}
      {state.plushies.map((plushie) => (
        <Plushie
          key={plushie.id}
          data={plushie}
          isGrabbed={state.grabbedPlushieId === plushie.id}
          ref={state.grabbedPlushieId === plushie.id ? grabbedPlushieRef : undefined}
        />
      ))}
    </>
  );
}

export function ClawScene({ state, liveStateRef, targetsRef, updatePhysics }: ClawSceneProps) {
  return (
    <Canvas
      // 카메라 - 박스(Y 0~7) + 콘솔(Y -2~-4) 모두 보이게
      camera={{
        position: [0, 2, 16],   // 멀리, 살짝 위
        fov: 35,                // 좁은 시야각 → 압축감
        near: 0.1,
        far: 100,
      }}
      gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #1a0530 0%, #4a1080 50%, #1a0530 100%)',
      }}
      onCreated={({ camera }) => {
        // 박스(중앙 Y=3.5) + 콘솔(중앙 Y=-3) 의 중간 정도
        camera.lookAt(0, 1.5, 0);
      }}
    >
      <fog attach="fog" args={[0x1a0530, 22, 50]} />
      <SceneContent
        state={state}
        liveStateRef={liveStateRef}
        targetsRef={targetsRef}
        updatePhysics={updatePhysics}
      />
    </Canvas>
  );
}
