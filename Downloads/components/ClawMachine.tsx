// apps/web/src/components/game/wordblitz/ClawMachine.tsx
// 인형뽑기 박스 + 콘솔
//
// v5 좌표계 (그림 검증):
//   Y =  8.0  LED 사인
//   Y =  7.0  박스 천장
//   Y =  6.0  집게 home
//   Y =  2.0  집게 drop
//   Y =  0.0  박스 내부 바닥
//   Y = -1.0  박스 외부 베이스
//   Y = -2.0  콘솔 윗면
//   Y = -3.0  콘솔 중심
//   Y = -4.0  콘솔 바닥
//
// 박스 크기: width 6, height 7, depth 3

'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const MACHINE = {
  width: 6,
  height: 7,
  depth: 3,
  // 집게 좌표
  clawHomeY: 6,
  clawDropY: 2,
  clawXRange: 2.2,
  // 콘솔
  consoleY: -3,        // 콘솔 중심
  consoleHeight: 1.6,  // 콘솔 두께
  consoleWidth: 6.5,
  consoleDepth: 2.2,
} as const;

interface ClawMachineProps {
  joystickTilt?: React.MutableRefObject<number>;
  dropPressed?: React.MutableRefObject<number>;
}

export function ClawMachine({ joystickTilt, dropPressed }: ClawMachineProps = {}) {
  const signMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const stickGroupRef = useRef<THREE.Group>(null);
  const dropButtonRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (signMatRef.current) {
      signMatRef.current.emissiveIntensity = 0.6 + Math.sin(clock.elapsedTime * 2) * 0.2;
    }
    if (stickGroupRef.current && joystickTilt) {
      const target = joystickTilt.current * 0.4;
      stickGroupRef.current.rotation.z += (target - stickGroupRef.current.rotation.z) * 0.2;
    }
    if (dropButtonRef.current && dropPressed) {
      const target = dropPressed.current > 0.5 ? -0.06 : 0;
      dropButtonRef.current.position.y += (target - dropButtonRef.current.position.y) * 0.3;
    }
  });

  // VOCAFLOW LED 텍스처
  const signTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#FFD93D';
    ctx.fillRect(0, 0, 1024, 256);

    ctx.font = 'bold 110px Bungee, cursive';
    ctx.fillStyle = '#1a0530';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VOCAFLOW', 512, 128);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  const dropTextTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 256);
    ctx.font = 'bold 50px Bungee, cursive';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 6;
    ctx.fillText('DROP!', 128, 128);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  const w = MACHINE.width / 2;
  const h = MACHINE.height;
  const d = MACHINE.depth / 2;
  const cy = MACHINE.consoleY;
  const cw = MACHINE.consoleWidth / 2;
  const cd = MACHINE.consoleDepth / 2;

  return (
    <group>
      {/* ════════════════════════════════════════════
          박스 (Y: 0 ~ 7)
          ════════════════════════════════════════════ */}

      {/* 외부 베이스 (검정 받침대, Y: -1 ~ -0.5) */}
      <mesh position={[0, -0.75, 0]} receiveShadow>
        <boxGeometry args={[MACHINE.width + 0.4, 0.5, MACHINE.depth + 0.4]} />
        <meshStandardMaterial color={0x1a1a1a} roughness={0.6} metalness={0.4} />
      </mesh>

      {/* 박스 내부 바닥 (베이지, Y: 0) */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[MACHINE.width - 0.3, 0.1, MACHINE.depth - 0.3]} />
        <meshStandardMaterial color={0xF5F0E8} roughness={0.7} metalness={0.05} />
      </mesh>

      {/* 좌측 빨간 프레임 */}
      <mesh position={[-w, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, h, MACHINE.depth]} />
        <meshStandardMaterial color={0xE63946} roughness={0.4} metalness={0.4} />
      </mesh>

      {/* 우측 빨간 프레임 */}
      <mesh position={[w, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, h, MACHINE.depth]} />
        <meshStandardMaterial color={0xE63946} roughness={0.4} metalness={0.4} />
      </mesh>

      {/* 뒤쪽 어두운 벽 */}
      <mesh position={[0, h / 2, -d]} receiveShadow>
        <boxGeometry args={[MACHINE.width, h, 0.2]} />
        <meshStandardMaterial color={0x2A1A4A} roughness={0.7} />
      </mesh>

      {/* 천장 (빨간) */}
      <mesh position={[0, h, 0]} castShadow>
        <boxGeometry args={[MACHINE.width, 0.2, MACHINE.depth]} />
        <meshStandardMaterial color={0xE63946} roughness={0.4} metalness={0.4} />
      </mesh>

      {/* 앞쪽 유리창 (살짝 보이게) */}
      <mesh position={[0, h / 2, d]}>
        <planeGeometry args={[MACHINE.width - 0.4, h - 0.4]} />
        <meshPhysicalMaterial
          color={0xFFFFFF}
          metalness={0}
          roughness={0.05}
          transmission={0.95}
          opacity={0.08}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* LED 사인 (Y: 8) */}
      <mesh position={[0, h + 0.5, d - 0.1]}>
        <boxGeometry args={[MACHINE.width - 0.3, 0.6, 0.15]} />
        <meshStandardMaterial
          ref={signMatRef}
          color={0xFFD93D}
          emissive={0xFFD93D}
          emissiveIntensity={0.7}
          roughness={0.3}
        />
      </mesh>

      <mesh position={[0, h + 0.5, d - 0.01]}>
        <planeGeometry args={[MACHINE.width - 0.4, 0.55]} />
        <meshBasicMaterial map={signTexture} />
      </mesh>

      {/* ════════════════════════════════════════════
          콘솔 (Y: -2 ~ -4) - 박스와 분리
          ════════════════════════════════════════════ */}

      {/* 콘솔 본체 (빨간) */}
      <mesh position={[0, cy, 0]} castShadow receiveShadow>
        <boxGeometry args={[MACHINE.consoleWidth, MACHINE.consoleHeight, MACHINE.consoleDepth]} />
        <meshStandardMaterial color={0xC8232E} roughness={0.4} metalness={0.4} />
      </mesh>

      {/* 콘솔 윗면 하이라이트 (밝은 빨강) */}
      <mesh position={[0, cy + MACHINE.consoleHeight / 2 - 0.05, 0]}>
        <boxGeometry args={[MACHINE.consoleWidth - 0.05, 0.1, MACHINE.consoleDepth - 0.05]} />
        <meshStandardMaterial color={0xE63946} roughness={0.4} metalness={0.4} />
      </mesh>

      {/* ────── 좌측 보라 패널 + 작은 빨간 버튼 2개 ────── */}
      <mesh position={[-2.0, cy + 0.85, cd - 0.5]} castShadow>
        <boxGeometry args={[1.4, 0.2, 0.9]} />
        <meshStandardMaterial color={0x2A1A4A} roughness={0.5} metalness={0.3} />
      </mesh>

      <mesh position={[-2.3, cy + 1.0, cd - 0.5]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.13, 16]} />
        <meshStandardMaterial color={0xE63946} roughness={0.3} />
      </mesh>
      <mesh position={[-1.7, cy + 1.0, cd - 0.5]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.13, 16]} />
        <meshStandardMaterial color={0xE63946} roughness={0.3} />
      </mesh>

      {/* ────── 중앙 조이스틱 ────── */}
      {/* 보라 패널 */}
      <mesh position={[0, cy + 0.85, cd - 0.5]} castShadow>
        <boxGeometry args={[1.6, 0.2, 0.9]} />
        <meshStandardMaterial color={0x2A1A4A} roughness={0.5} metalness={0.3} />
      </mesh>

      {/* 검정 cylindar 베이스 */}
      <mesh position={[0, cy + 0.97, cd - 0.5]}>
        <cylinderGeometry args={[0.32, 0.4, 0.12, 24]} />
        <meshStandardMaterial color={0x0A0512} roughness={0.6} metalness={0.4} />
      </mesh>

      {/* 검정 hole */}
      <mesh position={[0, cy + 1.04, cd - 0.5]}>
        <cylinderGeometry args={[0.22, 0.22, 0.04, 24]} />
        <meshStandardMaterial color={0x000000} roughness={0.9} />
      </mesh>

      {/* 조이스틱 stick + ball (회전 그룹) */}
      <group ref={stickGroupRef} position={[0, cy + 1.05, cd - 0.5]}>
        {/* Stick (검은 막대) */}
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.09, 0.8, 16]} />
          <meshStandardMaterial color={0x111118} roughness={0.5} metalness={0.6} />
        </mesh>

        {/* 빨간 공 (stick 끝, 일체형) */}
        <mesh position={[0, 0.95, 0]} castShadow>
          <sphereGeometry args={[0.32, 32, 24]} />
          <meshStandardMaterial color={0xE63946} roughness={0.25} metalness={0.15} />
        </mesh>
      </group>

      {/* ────── 우측 DROP 버튼 ────── */}
      <mesh position={[2.0, cy + 0.85, cd - 0.5]} castShadow>
        <boxGeometry args={[1.4, 0.2, 0.9]} />
        <meshStandardMaterial color={0x2A1A4A} roughness={0.5} metalness={0.3} />
      </mesh>

      <mesh position={[2.0, cy + 0.97, cd - 0.5]}>
        <cylinderGeometry args={[0.42, 0.46, 0.12, 24]} />
        <meshStandardMaterial color={0x0A0512} roughness={0.6} metalness={0.4} />
      </mesh>

      {/* 빨간 큰 버튼 (눌림 애니메이션) */}
      <mesh ref={dropButtonRef} position={[2.0, cy + 1.13, cd - 0.5]} castShadow>
        <cylinderGeometry args={[0.36, 0.36, 0.18, 24]} />
        <meshStandardMaterial color={0xE63946} roughness={0.3} />
      </mesh>

      {/* DROP! 텍스트 */}
      <mesh position={[2.0, cy + 1.23, cd - 0.5]} rotation={[-Math.PI / 2, 0, -0.1]}>
        <planeGeometry args={[0.55, 0.55]} />
        <meshBasicMaterial map={dropTextTexture} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}
