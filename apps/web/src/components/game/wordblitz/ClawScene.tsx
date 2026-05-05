// apps/web/src/components/game/wordblitz/ClawScene.tsx
// 전체 3D 씬 (Pro-level Redesign)
//
// 카메라: 살짝 위에서 내려다보는 각도 (real arcade view)
//   target height 9.0, target width 8.0, fov 38
//   lookAt [0, 1.4, 0]
//
// 조명 7단계 (인형 색상 보존 + 영화적 분위기):
//   1. hemisphereLight (1.1) - 환경광
//   2. rectAreaLight ceiling (3.5) - 천장 면조명
//   3. directionalLight (0.5) - 정면 fill
//   4. spotLight 1 (15) - 콘솔
//   5. spotLight 2 (8) - 박스 안 인형 강조 (위에서)
//   6. pointLight neon pink (좌)
//   7. pointLight neon cyan (우)
//
// 톤매핑: ACESFilmicToneMapping, exposure 1.05
// 배경: 어두운 보라 그라디언트 + 별 + 멀리 빛 panel

'use client';

import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { ClawMachine } from './ClawMachine';
import { ClawModel } from './ClawModel';
import { Plushie } from './Plushie';
import { WB_COLORS } from '@/lib/wordblitz/theme';
import type { GameState, LiveClawState, ClawTargets } from '@/lib/wordblitz/types';

interface ClawSceneProps {
  state: GameState;
  liveStateRef: React.MutableRefObject<LiveClawState>;
  targetsRef: React.MutableRefObject<ClawTargets>;
  updatePhysics: (dt: number) => void;
}

let rectAreaInitialized = false;
function ensureRectAreaInit() {
  if (rectAreaInitialized) return;
  RectAreaLightUniformsLib.init();
  rectAreaInitialized = true;
}

// ═══════════════════════════════════════════════
// 반응형 카메라 - 살짝 위에서 내려다보는 각도
// ═══════════════════════════════════════════════
function getCameraConfig(aspect: number) {
  // 박스 10.0 + 콘솔 10.4 → target width 12.0 / height 11.0
  const targetHeight = 11.0;
  const targetWidth = 12.5;
  const fov = 36;
  const fovRad = (fov * Math.PI) / 180;

  let z = targetHeight / 2 / Math.tan(fovRad / 2);
  const zForWidth = targetWidth / 2 / Math.tan(fovRad / 2) / Math.max(aspect, 0.1);
  z = Math.max(z, zForWidth);

  return {
    position: [0, 2.6, z] as [number, number, number],
    fov,
    lookAt: [0, 1.7, 0] as [number, number, number],
  };
}

function ResponsiveCamera() {
  const { camera, size } = useThree();

  useEffect(() => {
    const aspect = size.width / size.height;
    const cfg = getCameraConfig(aspect);

    camera.position.set(cfg.position[0], cfg.position[1], cfg.position[2]);
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const persp = camera as THREE.PerspectiveCamera;
      persp.fov = cfg.fov;
      persp.updateProjectionMatrix();
    }
    camera.lookAt(cfg.lookAt[0], cfg.lookAt[1], cfg.lookAt[2]);
  }, [camera, size.width, size.height]);

  return null;
}

// ═══════════════════════════════════════════════
// 물리 / 콘솔 동기화
// ═══════════════════════════════════════════════
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

// ═══════════════════════════════════════════════
// 배경 별 (3겹 깊이감)
// ═══════════════════════════════════════════════
function BackgroundStars() {
  const farRef = useRef<THREE.BufferGeometry>(null);
  const midRef = useRef<THREE.BufferGeometry>(null);
  const nearRef = useRef<THREE.BufferGeometry>(null);
  const goldRef = useRef<THREE.BufferGeometry>(null);

  useEffect(() => {
    const setup = (
      ref: React.RefObject<THREE.BufferGeometry>,
      count: number,
      zMin: number,
      zMax: number,
      spreadX: number = 80,
      spreadY: number = 30,
    ) => {
      if (!ref.current) return;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * spreadX;
        positions[i * 3 + 1] = (Math.random() - 0.2) * spreadY;
        positions[i * 3 + 2] = zMin - Math.random() * (zMax - zMin);
      }
      ref.current.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    };
    // 화려한 디스코 룸 — 별 + 컨페티 다층
    setup(farRef, 400, 18, 30);
    setup(midRef, 200, 12, 18, 60, 25);
    setup(nearRef, 120, 6, 12, 40, 20);
    setup(goldRef, 150, 8, 16, 50, 22);
  }, []);

  return (
    <>
      <points>
        <bufferGeometry ref={farRef} />
        <pointsMaterial color={0xFFFFFF} size={0.05} sizeAttenuation transparent opacity={0.7} />
      </points>
      <points>
        <bufferGeometry ref={midRef} />
        <pointsMaterial color={WB_COLORS.neonPink} size={0.07} sizeAttenuation transparent opacity={0.65} />
      </points>
      <points>
        <bufferGeometry ref={nearRef} />
        <pointsMaterial color={WB_COLORS.neonCyan} size={0.08} sizeAttenuation transparent opacity={0.6} />
      </points>
      <points>
        <bufferGeometry ref={goldRef} />
        <pointsMaterial color={WB_COLORS.goldYellow} size={0.06} sizeAttenuation transparent opacity={0.7} />
      </points>
    </>
  );
}

// ═══════════════════════════════════════════════
// 7단계 조명
// ═══════════════════════════════════════════════
function Lighting() {
  return (
    <>
      {/* 1. Hemisphere - 환경광 (강하게) */}
      <hemisphereLight args={[0xFFFFFF, 0xFFE4F1, 2.2]} />

      {/* 2. 천장 면조명 (강하게) */}
      <rectAreaLight
        width={8.5}
        height={2.8}
        intensity={6.5}
        color={0xFFFFFF}
        position={[0, 5.4, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      />

      {/* 3. 정면 fill (인형 색깔 풍부히) */}
      <directionalLight color={0xFFFFFF} intensity={1.1} position={[0, 3, 10]} />

      {/* 4. 박스 안 인형 강조 (위에서 따뜻한 빛) */}
      <spotLight
        color={0xFFF4E0}
        intensity={18}
        position={[0, 5.0, 5]}
        angle={Math.PI / 3.5}
        penumbra={0.7}
        distance={9}
        target-position={[0, 0.5, 0]}
      />

      {/* 5. 콘솔 스포트 */}
      <spotLight
        color={0xFFFFFF}
        intensity={14}
        position={[0, 2, 7]}
        angle={Math.PI / 5}
        penumbra={0.5}
        distance={8}
        target-position={[0, -1.9, 1.4]}
      />

      {/* 6. 네온 분위기 좌 (핑크) */}
      <pointLight
        color={0xFF6BB5}
        intensity={9}
        distance={11}
        position={[-6, 2.5, 1]}
      />

      {/* 7. 네온 분위기 우 (시안) */}
      <pointLight
        color={0x06D4E8}
        intensity={9}
        distance={11}
        position={[6, 2.5, 1]}
      />

      {/* 8. 위 핑크 디스코 라이트 */}
      <pointLight
        color={0xFFB4DE}
        intensity={5}
        distance={14}
        position={[0, 7, 3]}
      />
    </>
  );
}

// ═══════════════════════════════════════════════
// 환경 — 진짜 인형뽑기 방 (샤방샤방 디스코)
// ═══════════════════════════════════════════════
function Environment() {
  return (
    <>
      {/* 멀리 디스코 벽 (밝은 보라) */}
      <mesh position={[0, 2, -14]}>
        <planeGeometry args={[140, 70]} />
        <meshBasicMaterial color={0x6336A3} />
      </mesh>

      {/* 광택 디스코 플로어 (밝은 핑크 보라 + 반사) */}
      <mesh position={[0, -2.85, 1]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 40]} />
        <meshStandardMaterial
          color={0x6B47C9}
          roughness={0.25}
          metalness={0.75}
          envMapIntensity={2.0}
        />
      </mesh>

      {/* 디스코 바닥 컨페티 패턴 (작은 반짝이 box들) */}
      {Array.from({ length: 60 }, (_, i) => {
        const angle = (i / 60) * Math.PI * 2 + (i % 7) * 0.3;
        const radius = 6 + (i % 5) * 1.2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius * 0.5 + 2;
        const colors = [0xFF6BB5, 0x06D4E8, 0xFFD93D, 0xEC4899, 0xFFFFFF];
        const color = colors[i % colors.length];
        return (
          <mesh key={i} position={[x, -2.78, z]} rotation={[0, (i * 0.5) % Math.PI, 0]}>
            <planeGeometry args={[0.15, 0.15]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.6}
              transparent
              opacity={0.85}
            />
          </mesh>
        );
      })}

      {/* 박스 외부 환경 광원 — 박스 자체를 밝게 비춤 (인형뽑기 방 분위기) */}
      <pointLight color={0xFFEACC} intensity={6} distance={18} position={[0, 4, 6]} />
      <pointLight color={0xFF6BB5} intensity={4} distance={15} position={[-9, 3, 4]} />
      <pointLight color={0x06D4E8} intensity={4} distance={15} position={[9, 3, 4]} />
      <pointLight color={0xFFD93D} intensity={3.5} distance={12} position={[0, -2.5, 6]} />
      <pointLight color={0xEC4899} intensity={2.5} distance={10} position={[-6, 0, 8]} />
      <pointLight color={0x06D4E8} intensity={2.5} distance={10} position={[6, 0, 8]} />
    </>
  );
}

// ═══════════════════════════════════════════════
// 메인 씬
// ═══════════════════════════════════════════════
function SceneContent({ state, liveStateRef, updatePhysics }: ClawSceneProps) {
  const grabbedPlushieRef = useRef<THREE.Group | null>(null);
  const joystickTiltRef = useRef(0);
  const dropPressedRef = useRef(0);

  const isDropping = state.phase === 'dropping' || state.phase === 'grabbing';

  return (
    <>
      <ResponsiveCamera />
      <PhysicsUpdater updatePhysics={updatePhysics} />
      <ConsoleStateSync
        liveStateRef={liveStateRef}
        joystickTilt={joystickTiltRef}
        dropPressed={dropPressedRef}
        isDropping={isDropping}
      />

      <Lighting />
      <BackgroundStars />
      <Environment />

      {/* 박스 + 콘솔 */}
      <ClawMachine joystickTilt={joystickTiltRef} dropPressed={dropPressedRef} />

      {/* 집게 (procedural) */}
      <Suspense fallback={null}>
        <ClawModel
          liveStateRef={liveStateRef}
          grabbedPlushieRef={grabbedPlushieRef}
        />
      </Suspense>

      {/* 인형들 */}
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

// ═══════════════════════════════════════════════
// Canvas 래퍼
// ═══════════════════════════════════════════════
export function ClawScene({ state, liveStateRef, targetsRef, updatePhysics }: ClawSceneProps) {
  ensureRectAreaInit();

  return (
    <Canvas
      camera={{ position: [0, 2.6, 18], fov: 36, near: 0.1, far: 100 }}
      shadows
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.35,
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background:
          'radial-gradient(ellipse 90% 80% at center 35%, #FFE4F1 0%, #FFB4DE 20%, #E48FE0 40%, #A55FCC 65%, #6336A3 85%, #3D1A6E 100%)',
      }}
    >
      <fog attach="fog" args={[0x6336A3, 25, 65]} />
      <SceneContent
        state={state}
        liveStateRef={liveStateRef}
        targetsRef={targetsRef}
        updatePhysics={updatePhysics}
      />
    </Canvas>
  );
}
