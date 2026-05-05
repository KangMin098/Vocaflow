// apps/web/src/components/game/wordblitz/ClawMachine.tsx
// 인형뽑기 박스 + 콘솔 (Premium Dark Arcade — v06.7 재설계)
//
// 핵심 변경:
//   1. 박스 빨강 → 차콜 다크 + 골드 트림 + 시안 네온 액센트 (세련됨)
//   2. 천장 안쪽 분홍 발광 plate 제거 → 집게 가림 원인 제거
//   3. 콘솔 패널 양수 기울임 (사용자 쪽으로 panel normal 향함)
//   4. 박스 너비 9.0 (이전 7.6)
//   5. 천장 안쪽 어두운 보라 (인형 색깔 우뚝 보이게)
//   6. 조이스틱/DROP 빨강 보존 (실제 arcade 클래식 시각 닻)

'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WB_COLORS, WB_DIMS } from '@/lib/wordblitz/theme';

export const MACHINE = {
  width: WB_DIMS.boxWidth,
  height: WB_DIMS.boxHeight,
  depth: WB_DIMS.boxDepth,
  clawHomeY: WB_DIMS.clawHomeY,
  clawDropY: WB_DIMS.clawDropY,
  clawXRange: WB_DIMS.clawXRange,
  consoleY: WB_DIMS.consoleCenterY,
  consoleHeight: WB_DIMS.consoleHeight,
  consoleWidth: WB_DIMS.consoleWidth,
  consoleDepth: WB_DIMS.consoleDepth,
  consoleZ: WB_DIMS.consoleZ,
} as const;

interface ClawMachineProps {
  joystickTilt?: React.MutableRefObject<number>;
  dropPressed?: React.MutableRefObject<number>;
}

// ───────── 텍스처 ─────────

function createSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 배경 그라디언트 (골드)
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#FFE876');
  grad.addColorStop(0.5, '#FFD93D');
  grad.addColorStop(1, '#C9A227');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2048, 512);

  // 상단 시안 띠 (액센트)
  const cyanGrad = ctx.createLinearGradient(0, 0, 0, 30);
  cyanGrad.addColorStop(0, 'rgba(6, 212, 232, 0.6)');
  cyanGrad.addColorStop(1, 'rgba(6, 212, 232, 0)');
  ctx.fillStyle = cyanGrad;
  ctx.fillRect(0, 0, 2048, 30);

  // 다이아몬드 패턴 (양쪽)
  ctx.fillStyle = 'rgba(20, 20, 30, 0.22)';
  for (let i = 0; i < 7; i++) {
    [80, 2048 - 80].forEach((cx) => {
      ctx.save();
      ctx.translate(cx + (cx > 1024 ? -1 : 1) * i * 36, 256);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-12, -12, 24, 24);
      ctx.restore();
    });
  }

  // 메인 텍스트
  ctx.font = 'bold 220px Bungee, cursive';
  ctx.fillStyle = '#0A0A12';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VOCAFLOW', 1024, 220);

  // Subtitle (시안)
  ctx.font = 'bold 56px Bungee, cursive';
  ctx.fillStyle = '#0E7490';
  ctx.fillText('★ WORD  BLITZ ★', 1024, 380);

  // 텍스트 글로우
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 4;
  ctx.font = 'bold 220px Bungee, cursive';
  ctx.strokeText('VOCAFLOW', 1024, 220);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createDropButtonTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);
  ctx.font = 'bold 64px Bungee, cursive';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 10;
  ctx.fillText('DROP!', 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createMoveLabelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 128);
  ctx.font = 'bold 60px Bungee, cursive';
  ctx.fillStyle = '#06D4E8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(6, 212, 232, 0.7)';
  ctx.shadowBlur = 10;
  ctx.fillText('← MOVE →', 256, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createDropLabelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 128);
  ctx.font = 'bold 56px Bungee, cursive';
  ctx.fillStyle = '#FF8895';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 8;
  ctx.fillText('DROP', 128, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// 박스 뒷벽 (별 + 그라디언트)
function createBackWallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, '#3D1A6D');
  grad.addColorStop(0.5, '#1A0530');
  grad.addColorStop(1, '#06030F');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);

  // 큰 별 패턴 (골드)
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const r = Math.random() * 7 + 1.5;
    const a = Math.random() * 0.5 + 0.15;
    ctx.fillStyle = `rgba(255, 217, 61, ${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // 시안 작은 별
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const r = Math.random() * 4 + 1;
    const a = Math.random() * 0.4 + 0.15;
    ctx.fillStyle = `rgba(6, 212, 232, ${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 부드러운 빛점 noise
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const r = Math.random() * 60 + 25;
    const a = Math.random() * 0.05;
    const radial = ctx.createRadialGradient(x, y, 0, x, y, r);
    radial.addColorStop(0, `rgba(236, 72, 153, ${a})`);
    radial.addColorStop(1, 'rgba(236, 72, 153, 0)');
    ctx.fillStyle = radial;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // 큰 배경 텍스트 "WIN BIG!"
  ctx.font = 'bold 100px Bungee, cursive';
  ctx.fillStyle = 'rgba(255, 217, 61, 0.18)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('WIN BIG!', 512, 380);

  ctx.font = 'bold 56px Bungee, cursive';
  ctx.fillStyle = 'rgba(6, 212, 232, 0.20)';
  ctx.fillText('★ ★ ★', 512, 480);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// 측면 패널 텍스처 (별)
function createScoreDisplayTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0A0010';
  ctx.fillRect(0, 0, 512, 128);

  ctx.font = 'bold 18px "JetBrains Mono", monospace';
  ctx.fillStyle = '#06D4E8';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.shadowColor = '#06D4E8';
  ctx.shadowBlur = 8;
  ctx.fillText('CREDITS', 14, 12);

  ctx.font = 'bold 64px "JetBrains Mono", monospace';
  ctx.fillStyle = '#06D4E8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#06D4E8';
  ctx.shadowBlur = 16;
  ctx.fillText('00', 256, 75);

  ctx.shadowBlur = 0;
  ctx.font = 'bold 18px "JetBrains Mono", monospace';
  ctx.fillStyle = '#FFD93D';
  ctx.textAlign = 'right';
  ctx.fillText('READY', 498, 12);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ═══════════════════════════════════════════════
// 박스 프레임 (차콜 + 골드 트림 + 시안 네온)
// ═══════════════════════════════════════════════
function BoxFrames({
  backWallTexture,
}: {
  backWallTexture: THREE.CanvasTexture;
}) {
  const w = WB_DIMS.boxWidth / 2;
  const h = WB_DIMS.boxHeight;
  const d = WB_DIMS.boxDepth / 2;

  return (
    <>
      {/* ═══ 좌측 프레임 (차콜 + 골드 + 핑크 LED 앞만) ═══ */}
      <group position={[-w, h / 2, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.4, h, WB_DIMS.boxDepth]} />
          <meshStandardMaterial
            color={WB_COLORS.frameDark}
            roughness={0.35}
            metalness={0.85}
            envMapIntensity={1.2}
          />
        </mesh>
        {/* 앞면 베벨 (미드 차콜) */}
        <mesh position={[0, 0, d + 0.01]}>
          <planeGeometry args={[0.4, h]} />
          <meshStandardMaterial
            color={WB_COLORS.frameMid}
            roughness={0.32}
            metalness={0.8}
          />
        </mesh>
        {/* 골드 풀길이 라인 */}
        <mesh position={[0.21, 0, d - 0.05]}>
          <boxGeometry args={[0.03, h - 0.4, 0.14]} />
          <meshStandardMaterial
            color={WB_COLORS.goldYellow}
            emissive={WB_COLORS.goldYellow}
            emissiveIntensity={0.6}
            roughness={0.25}
            metalness={0.85}
          />
        </mesh>
        {/* 앞면 핑크 LED strip (앞으로만 - 측면 panel 제거) */}
        <mesh position={[0, 0, d + 0.012]}>
          <boxGeometry args={[0.04, h - 0.6, 0.005]} />
          <meshStandardMaterial
            color={WB_COLORS.neonPink}
            emissive={WB_COLORS.neonPink}
            emissiveIntensity={1.5}
          />
        </mesh>
      </group>

      {/* ═══ 우측 프레임 ═══ */}
      <group position={[w, h / 2, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.4, h, WB_DIMS.boxDepth]} />
          <meshStandardMaterial
            color={WB_COLORS.frameDark}
            roughness={0.35}
            metalness={0.85}
            envMapIntensity={1.2}
          />
        </mesh>
        <mesh position={[0, 0, d + 0.01]}>
          <planeGeometry args={[0.4, h]} />
          <meshStandardMaterial
            color={WB_COLORS.frameMid}
            roughness={0.32}
            metalness={0.8}
          />
        </mesh>
        <mesh position={[-0.21, 0, d - 0.05]}>
          <boxGeometry args={[0.03, h - 0.4, 0.14]} />
          <meshStandardMaterial
            color={WB_COLORS.goldYellow}
            emissive={WB_COLORS.goldYellow}
            emissiveIntensity={0.6}
            roughness={0.25}
            metalness={0.85}
          />
        </mesh>
        {/* 앞면 시안 LED strip (앞으로만) */}
        <mesh position={[0, 0, d + 0.012]}>
          <boxGeometry args={[0.04, h - 0.6, 0.005]} />
          <meshStandardMaterial
            color={WB_COLORS.neonCyan}
            emissive={WB_COLORS.neonCyan}
            emissiveIntensity={1.5}
          />
        </mesh>
      </group>

      {/* ═══ 천장 (차콜 + 골드 베벨) ═══ */}
      <group position={[0, h, 0]}>
        <mesh castShadow>
          <boxGeometry args={[WB_DIMS.boxWidth, 0.35, WB_DIMS.boxDepth]} />
          <meshStandardMaterial
            color={WB_COLORS.frameDark}
            roughness={0.35}
            metalness={0.85}
            envMapIntensity={1.2}
          />
        </mesh>
        <mesh position={[0, 0, d + 0.01]}>
          <planeGeometry args={[WB_DIMS.boxWidth, 0.35]} />
          <meshStandardMaterial
            color={WB_COLORS.frameMid}
            roughness={0.32}
            metalness={0.8}
          />
        </mesh>
        {/* 천장 light box plate — 박스 전체 너비 가득 + 강한 발광
            (cable이 plate 위로 나가지 않게 plate가 가운데 어두운 영역 차단) */}
        <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[WB_DIMS.boxWidth - 0.3, WB_DIMS.boxDepth - 0.2]} />
          <meshStandardMaterial
            color={WB_COLORS.innerCeilingLight}
            roughness={0.7}
            metalness={0.05}
            emissive={WB_COLORS.innerCeilingLight}
            emissiveIntensity={0.85}
          />
        </mesh>
        {/* 천장 plate 둘레 골드 LED frame */}
        <mesh position={[0, -0.04, WB_DIMS.boxDepth / 2 - 0.15]}>
          <boxGeometry args={[WB_DIMS.boxWidth - 0.3, 0.025, 0.025]} />
          <meshStandardMaterial
            color={WB_COLORS.goldYellow}
            emissive={WB_COLORS.goldYellow}
            emissiveIntensity={0.9}
          />
        </mesh>
        <mesh position={[0, -0.04, -WB_DIMS.boxDepth / 2 + 0.15]}>
          <boxGeometry args={[WB_DIMS.boxWidth - 0.3, 0.025, 0.025]} />
          <meshStandardMaterial
            color={WB_COLORS.goldYellow}
            emissive={WB_COLORS.goldYellow}
            emissiveIntensity={0.9}
          />
        </mesh>
        {/* 천장 자체 광원 (강하게) */}
        <pointLight
          color={0xFFE8B0}
          intensity={8}
          distance={8}
          position={[0, -0.5, 0]}
        />
        {/* 천장 골드 트림 (앞 가장자리) */}
        <mesh position={[0, -0.05, d - 0.18]}>
          <boxGeometry args={[WB_DIMS.boxWidth - 0.5, 0.02, 0.04]} />
          <meshStandardMaterial
            color={WB_COLORS.goldYellow}
            emissive={WB_COLORS.goldYellow}
            emissiveIntensity={0.4}
          />
        </mesh>
      </group>

      {/* ═══ 뒷벽 (별 + 그라디언트) ═══ */}
      <mesh position={[0, h / 2, -d]} receiveShadow>
        <boxGeometry args={[WB_DIMS.boxWidth, h, 0.2]} />
        <meshStandardMaterial
          map={backWallTexture}
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>

      {/* ═══ 박스 바닥 (광택 어두운 보라 + 골드 trim) ═══ */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[WB_DIMS.boxWidth - 0.4, 0.1, WB_DIMS.boxDepth - 0.4]} />
        <meshStandardMaterial
          color={WB_COLORS.innerFloor}
          roughness={0.3}
          metalness={0.5}
          envMapIntensity={1.0}
        />
      </mesh>
      {/* 바닥 앞 가장자리 골드 trim */}
      <mesh position={[0, 0.11, d - 0.25]}>
        <boxGeometry args={[WB_DIMS.boxWidth - 0.6, 0.02, 0.04]} />
        <meshStandardMaterial
          color={WB_COLORS.goldYellow}
          emissive={WB_COLORS.goldYellow}
          emissiveIntensity={0.45}
        />
      </mesh>
      {/* 바닥 사이드 골드 trim */}
      <mesh position={[-w + 0.3, 0.11, 0]}>
        <boxGeometry args={[0.04, 0.02, WB_DIMS.boxDepth - 0.6]} />
        <meshStandardMaterial color={WB_COLORS.goldYellow} emissive={WB_COLORS.goldYellow} emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[w - 0.3, 0.11, 0]}>
        <boxGeometry args={[0.04, 0.02, WB_DIMS.boxDepth - 0.6]} />
        <meshStandardMaterial color={WB_COLORS.goldYellow} emissive={WB_COLORS.goldYellow} emissiveIntensity={0.4} />
      </mesh>

      {/* ═══ 외부 베이스 ═══ */}
      <mesh position={[0, -0.35, 0]} receiveShadow>
        <boxGeometry args={[WB_DIMS.boxWidth + 0.4, 0.3, WB_DIMS.boxDepth + 0.4]} />
        <meshStandardMaterial
          color={WB_COLORS.bgDeepPurple}
          roughness={0.5}
          metalness={0.6}
        />
      </mesh>
      <mesh position={[0, -0.5, d + 0.21]}>
        <boxGeometry args={[WB_DIMS.boxWidth + 0.4, 0.025, 0.025]} />
        <meshStandardMaterial
          color={WB_COLORS.goldYellow}
          emissive={WB_COLORS.goldYellow}
          emissiveIntensity={0.6}
        />
      </mesh>

      {/* ═══ 앞면 유리 (살짝 반사 + 가장자리 흰색 발광 frame) ═══ */}
      {/* 유리 plane (매우 약한 흰빛) */}
      <mesh position={[0, h / 2, d]}>
        <planeGeometry args={[WB_DIMS.boxWidth - 0.7, h - 0.7]} />
        <meshBasicMaterial
          color={0xE0F0FF}
          opacity={0.04}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 유리 좌상단 하이라이트 line (slight gleam) */}
      <mesh position={[-WB_DIMS.boxWidth / 2 + 0.5, h * 0.7, d + 0.012]} rotation={[0, 0, -Math.PI / 8]}>
        <planeGeometry args={[1.5, 0.04]} />
        <meshBasicMaterial color={0xFFFFFF} transparent opacity={0.25} />
      </mesh>
      <mesh position={[-WB_DIMS.boxWidth / 2 + 0.8, h * 0.4, d + 0.012]} rotation={[0, 0, -Math.PI / 8]}>
        <planeGeometry args={[0.8, 0.025]} />
        <meshBasicMaterial color={0xFFFFFF} transparent opacity={0.18} />
      </mesh>
      {/* 유리 가장자리 흰색 발광 frame (4면) */}
      {/* 위 */}
      <mesh position={[0, h - 0.4, d + 0.005]}>
        <boxGeometry args={[WB_DIMS.boxWidth - 0.7, 0.025, 0.015]} />
        <meshStandardMaterial color={0xFFFFFF} emissive={0xFFFFFF} emissiveIntensity={0.9} />
      </mesh>
      {/* 아래 */}
      <mesh position={[0, 0.4, d + 0.005]}>
        <boxGeometry args={[WB_DIMS.boxWidth - 0.7, 0.025, 0.015]} />
        <meshStandardMaterial color={0xFFFFFF} emissive={0xFFFFFF} emissiveIntensity={0.9} />
      </mesh>
      {/* 좌 */}
      <mesh position={[-WB_DIMS.boxWidth / 2 + 0.4, h / 2, d + 0.005]}>
        <boxGeometry args={[0.025, h - 0.7, 0.015]} />
        <meshStandardMaterial color={0xFFFFFF} emissive={0xFFFFFF} emissiveIntensity={0.9} />
      </mesh>
      {/* 우 */}
      <mesh position={[WB_DIMS.boxWidth / 2 - 0.4, h / 2, d + 0.005]}>
        <boxGeometry args={[0.025, h - 0.7, 0.015]} />
        <meshStandardMaterial color={0xFFFFFF} emissive={0xFFFFFF} emissiveIntensity={0.9} />
      </mesh>
    </>
  );
}

// ═══════════════════════════════════════════════
// LED 사인 (골드 + 시안 별 + 도트)
// ═══════════════════════════════════════════════
function LEDSign({
  signMatRef,
  signTexture,
}: {
  signMatRef: React.RefObject<THREE.MeshStandardMaterial>;
  signTexture: THREE.CanvasTexture;
}) {
  const h = WB_DIMS.boxHeight;
  const w = WB_DIMS.boxWidth;
  const d = WB_DIMS.boxDepth / 2;

  return (
    <group position={[0, h + 0.65, d - 0.1]}>
      {/* 백 패널 (차콜 메탈) */}
      <mesh castShadow>
        <boxGeometry args={[w + 0.2, 0.95, 0.3]} />
        <meshStandardMaterial color={WB_COLORS.frameDark} roughness={0.4} metalness={0.85} />
      </mesh>

      {/* 메인 사인 (골드 LED) */}
      <mesh position={[0, 0, 0.16]}>
        <boxGeometry args={[w - 0.2, 0.8, 0.06]} />
        <meshStandardMaterial
          ref={signMatRef}
          color={WB_COLORS.goldYellow}
          emissive={WB_COLORS.goldYellow}
          emissiveIntensity={0.85}
          roughness={0.2}
          metalness={0.4}
        />
      </mesh>
      <mesh position={[0, 0, 0.2]}>
        <planeGeometry args={[w - 0.3, 0.7]} />
        <meshBasicMaterial map={signTexture} transparent />
      </mesh>

      {/* 좌측 시안 별 LED */}
      <group position={[-w / 2 + 0.4, 0, 0.21]}>
        <mesh>
          <circleGeometry args={[0.16, 32]} />
          <meshStandardMaterial
            color={WB_COLORS.neonCyan}
            emissive={WB_COLORS.neonCyan}
            emissiveIntensity={1.3}
          />
        </mesh>
        <mesh position={[0, 0, 0.001]}>
          <circleGeometry args={[0.09, 32]} />
          <meshBasicMaterial color={0xFFFFFF} />
        </mesh>
      </group>
      {/* 우측 핑크 별 LED */}
      <group position={[w / 2 - 0.4, 0, 0.21]}>
        <mesh>
          <circleGeometry args={[0.16, 32]} />
          <meshStandardMaterial
            color={WB_COLORS.neonPink}
            emissive={WB_COLORS.neonPink}
            emissiveIntensity={1.3}
          />
        </mesh>
        <mesh position={[0, 0, 0.001]}>
          <circleGeometry args={[0.09, 32]} />
          <meshBasicMaterial color={0xFFFFFF} />
        </mesh>
      </group>

      {/* 사인 위 도트 LED 줄 */}
      {Array.from({ length: 10 }, (_, i) => i).map((i) => (
        <mesh key={`l-${i}`} position={[-w / 2 + 1.2 + i * 0.18, 0.36, 0.21]}>
          <circleGeometry args={[0.028, 16]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? WB_COLORS.neonCyan : WB_COLORS.goldYellow}
            emissive={i % 2 === 0 ? WB_COLORS.neonCyan : WB_COLORS.goldYellow}
            emissiveIntensity={1}
          />
        </mesh>
      ))}
      {Array.from({ length: 10 }, (_, i) => i).map((i) => (
        <mesh key={`r-${i}`} position={[w / 2 - 1.2 - i * 0.18, 0.36, 0.21]}>
          <circleGeometry args={[0.028, 16]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? WB_COLORS.neonPink : WB_COLORS.goldYellow}
            emissive={i % 2 === 0 ? WB_COLORS.neonPink : WB_COLORS.goldYellow}
            emissiveIntensity={1}
          />
        </mesh>
      ))}

      {/* 사인 광원 (천장 위 빛 떨어짐 - 골드 + 시안) */}
      <pointLight color={WB_COLORS.goldYellow} intensity={5} distance={5} position={[0, -0.5, -0.5]} />
      <pointLight color={WB_COLORS.neonCyan} intensity={3} distance={4} position={[-w / 2 + 0.4, 0, 0.4]} />
      <pointLight color={WB_COLORS.neonPink} intensity={3} distance={4} position={[w / 2 - 0.4, 0, 0.4]} />
    </group>
  );
}

// ═══════════════════════════════════════════════
// 콘솔 본체 (차콜 + LCD 시안)
// ═══════════════════════════════════════════════
function ConsoleBody({ scoreDisplayTexture }: { scoreDisplayTexture: THREE.CanvasTexture }) {
  const ch = WB_DIMS.consoleHeight;

  return (
    <group position={[0, WB_DIMS.consoleCenterY, WB_DIMS.consoleZ]}>
      {/* 메인 박스 (차콜 메탈) */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[WB_DIMS.consoleWidth, ch, WB_DIMS.consoleDepth]} />
        <meshStandardMaterial
          color={WB_COLORS.consoleBody}
          roughness={0.35}
          metalness={0.8}
          envMapIntensity={1.2}
        />
      </mesh>

      {/* 앞면 베벨 */}
      <mesh position={[0, 0, WB_DIMS.consoleDepth / 2 + 0.005]}>
        <planeGeometry args={[WB_DIMS.consoleWidth - 0.05, ch - 0.05]} />
        <meshStandardMaterial
          color={WB_COLORS.frameMid}
          roughness={0.32}
          metalness={0.7}
        />
      </mesh>

      {/* 좌·우 골드 액센트 라인 */}
      <mesh position={[-WB_DIMS.consoleWidth / 2 + 0.08, 0, WB_DIMS.consoleDepth / 2 + 0.008]}>
        <planeGeometry args={[0.06, ch - 0.2]} />
        <meshStandardMaterial
          color={WB_COLORS.goldYellow}
          emissive={WB_COLORS.goldYellow}
          emissiveIntensity={0.55}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[WB_DIMS.consoleWidth / 2 - 0.08, 0, WB_DIMS.consoleDepth / 2 + 0.008]}>
        <planeGeometry args={[0.06, ch - 0.2]} />
        <meshStandardMaterial
          color={WB_COLORS.goldYellow}
          emissive={WB_COLORS.goldYellow}
          emissiveIntensity={0.55}
          roughness={0.3}
        />
      </mesh>

      {/* LCD 점수 디스플레이 (앞면 위) */}
      <mesh position={[0, ch / 2 - 0.32, WB_DIMS.consoleDepth / 2 + 0.012]}>
        <planeGeometry args={[2.4, 0.55]} />
        <meshBasicMaterial map={scoreDisplayTexture} />
      </mesh>
      {/* LCD 베젤 */}
      <mesh position={[0, ch / 2 - 0.32, WB_DIMS.consoleDepth / 2 + 0.011]}>
        <planeGeometry args={[2.55, 0.65]} />
        <meshStandardMaterial color={0x000000} roughness={0.5} metalness={0.6} />
      </mesh>

      {/* 베이스 그림자 보강 */}
      <mesh position={[0, -ch / 2 - 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[WB_DIMS.consoleWidth + 0.4, WB_DIMS.consoleDepth + 0.4]} />
        <meshBasicMaterial color={0x000000} transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════
// 메인 컴포넌트
// ═══════════════════════════════════════════════
export function ClawMachine({ joystickTilt, dropPressed }: ClawMachineProps = {}) {
  const signMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const stickGroupRef = useRef<THREE.Group>(null);
  const dropButtonRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (signMatRef.current) {
      signMatRef.current.emissiveIntensity = 0.7 + Math.sin(clock.elapsedTime * 1.5) * 0.25;
    }
    if (stickGroupRef.current && joystickTilt) {
      const target = -joystickTilt.current * 0.4;
      stickGroupRef.current.rotation.z += (target - stickGroupRef.current.rotation.z) * 0.2;
    }
    if (dropButtonRef.current && dropPressed) {
      const target = dropPressed.current > 0.5 ? -0.05 : 0;
      dropButtonRef.current.position.y += (target - dropButtonRef.current.position.y) * 0.3;
    }
  });

  const signTexture = useMemo(createSignTexture, []);
  const dropTextTexture = useMemo(createDropButtonTexture, []);
  const moveLabelTexture = useMemo(createMoveLabelTexture, []);
  const dropLabelTexture = useMemo(createDropLabelTexture, []);
  const backWallTexture = useMemo(createBackWallTexture, []);
  const scoreDisplayTexture = useMemo(createScoreDisplayTexture, []);

  // 콘솔 패널 좌표
  const consoleCenterY = WB_DIMS.consoleCenterY;
  const consolePanelPivotY = consoleCenterY + WB_DIMS.consoleHeight / 2;
  const TILT = WB_DIMS.consoleTilt; // ★ 양수 - 사용자 쪽으로 panel 기울어짐

  return (
    <group>
      <BoxFrames backWallTexture={backWallTexture} />
      <LEDSign signMatRef={signMatRef} signTexture={signTexture} />
      <ConsoleBody scoreDisplayTexture={scoreDisplayTexture} />

      {/* ════════════════════════════════════════════
          기울어진 컨트롤 패널 (사용자 쪽으로 + π/7.5)
          ════════════════════════════════════════════ */}
      <group position={[0, consolePanelPivotY, WB_DIMS.consoleZ]} rotation={[TILT, 0, 0]}>
        {/* 패널 표면 (차콜 다크) */}
        <mesh position={[0, 0.04, 0]}>
          <boxGeometry args={[WB_DIMS.consoleWidth - 0.2, 0.08, WB_DIMS.consoleDepth - 0.1]} />
          <meshStandardMaterial
            color={WB_COLORS.consolePanel}
            roughness={0.5}
            metalness={0.5}
          />
        </mesh>
        {/* 패널 베젤 (앞 골드 trim) */}
        <mesh position={[0, 0.085, WB_DIMS.consoleDepth / 2 - 0.1]}>
          <boxGeometry args={[WB_DIMS.consoleWidth - 0.2, 0.03, 0.04]} />
          <meshStandardMaterial
            color={WB_COLORS.goldYellow}
            emissive={WB_COLORS.goldYellow}
            emissiveIntensity={0.5}
            roughness={0.3}
            metalness={0.8}
          />
        </mesh>

        {/* ── 좌측: 동전 슬롯 + 컬러 버튼 + MOVE 라벨 (사이즈 ↑) ── */}
        <group position={[-2.7, 0.09, 0]}>
          {/* 동전 슬롯 (골드) */}
          <mesh position={[0, 0.07, -0.42]} castShadow>
            <boxGeometry args={[0.85, 0.14, 0.36]} />
            <meshStandardMaterial
              color={WB_COLORS.goldYellow}
              roughness={0.25}
              metalness={0.8}
              envMapIntensity={1.5}
            />
          </mesh>
          <mesh position={[0, 0.15, -0.42]}>
            <boxGeometry args={[0.45, 0.02, 0.06]} />
            <meshBasicMaterial color={0x000000} />
          </mesh>

          {/* 작은 버튼 좌 (← 시안) - 사이즈 ↑ */}
          <mesh position={[-0.3, 0.12, 0.32]} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 0.14, 24]} />
            <meshStandardMaterial
              color={WB_COLORS.neonCyan}
              roughness={0.3}
              metalness={0.4}
              emissive={WB_COLORS.neonCyan}
              emissiveIntensity={0.4}
            />
          </mesh>
          <mesh position={[-0.3, 0.19, 0.32]}>
            <cylinderGeometry args={[0.18, 0.18, 0.005, 24]} />
            <meshStandardMaterial color={0x67E8F9} roughness={0.2} metalness={0.5} />
          </mesh>

          {/* 작은 버튼 우 (→ 핑크) - 사이즈 ↑ */}
          <mesh position={[0.3, 0.12, 0.32]} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 0.14, 24]} />
            <meshStandardMaterial
              color={WB_COLORS.neonPink}
              roughness={0.3}
              metalness={0.4}
              emissive={WB_COLORS.neonPink}
              emissiveIntensity={0.4}
            />
          </mesh>
          <mesh position={[0.3, 0.19, 0.32]}>
            <cylinderGeometry args={[0.18, 0.18, 0.005, 24]} />
            <meshStandardMaterial color={0xF9A8D4} roughness={0.2} metalness={0.5} />
          </mesh>

          {/* MOVE 라벨 */}
          <mesh position={[0, 0.05, 0.78]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.2, 0.3]} />
            <meshBasicMaterial map={moveLabelTexture} transparent depthWrite={false} />
          </mesh>
        </group>

        {/* ── 중앙 조이스틱 (대형, 빨간 공 - 클래식 arcade 시각 닻) ── */}
        <group position={[0, 0.09, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.6, 0.7, 0.24, 32]} />
            <meshStandardMaterial
              color={WB_COLORS.consoleBlack}
              roughness={0.4}
              metalness={0.7}
              envMapIntensity={1.3}
            />
          </mesh>
          <mesh position={[0, 0.13, 0]}>
            <cylinderGeometry args={[0.55, 0.55, 0.02, 32]} />
            <meshStandardMaterial color={0x303038} roughness={0.35} metalness={0.8} />
          </mesh>
          {/* 골드 ring */}
          <mesh position={[0, 0.15, 0]}>
            <torusGeometry args={[0.55, 0.024, 12, 32]} />
            <meshStandardMaterial
              color={WB_COLORS.goldYellow}
              emissive={WB_COLORS.goldYellow}
              emissiveIntensity={0.55}
              roughness={0.3}
              metalness={0.8}
            />
          </mesh>
          <mesh position={[0, 0.145, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.04, 24]} />
            <meshBasicMaterial color={0x000000} />
          </mesh>

          {/* Stick + Ball (작게 — 박스 안 침투 X, 인형 안 가림) */}
          <group ref={stickGroupRef} position={[0, 0.16, 0]}>
            <mesh position={[0, 0.22, 0]} castShadow>
              <cylinderGeometry args={[0.07, 0.09, 0.45, 16]} />
              <meshStandardMaterial
                color={0x111118}
                roughness={0.35}
                metalness={0.8}
                envMapIntensity={1.3}
              />
            </mesh>
            {/* 스틱 베이스 골드 칼라 */}
            <mesh position={[0, 0.06, 0]}>
              <torusGeometry args={[0.1, 0.022, 12, 24]} />
              <meshStandardMaterial
                color={WB_COLORS.goldYellow}
                roughness={0.3}
                metalness={0.85}
                emissive={WB_COLORS.goldYellow}
                emissiveIntensity={0.5}
              />
            </mesh>
            {/* 빨간 공 (작게 — 박스 침투 방지) */}
            <mesh position={[0, 0.5, 0]} castShadow>
              <sphereGeometry args={[0.22, 32, 24]} />
              <meshStandardMaterial
                color={WB_COLORS.interactiveRed}
                roughness={0.2}
                metalness={0.25}
                envMapIntensity={1.8}
                emissive={WB_COLORS.interactiveRed}
                emissiveIntensity={0.15}
              />
            </mesh>
            {/* 광택 하이라이트 */}
            <mesh position={[-0.07, 0.58, 0.11]}>
              <sphereGeometry args={[0.05, 16, 16]} />
              <meshBasicMaterial color={0xFFFFFF} transparent opacity={0.75} />
            </mesh>
            <mesh position={[-0.04, 0.62, 0.14]}>
              <sphereGeometry args={[0.02, 12, 12]} />
              <meshBasicMaterial color={0xFFFFFF} transparent opacity={0.9} />
            </mesh>
          </group>
        </group>

        {/* ── 우측: 큰 DROP 버튼 (대형, 빨강 클래식) ── */}
        <group position={[2.7, 0.09, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.75, 0.82, 0.22, 32]} />
            <meshStandardMaterial
              color={WB_COLORS.consoleBlack}
              roughness={0.4}
              metalness={0.7}
            />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.7, 0.7, 0.02, 32]} />
            <meshStandardMaterial color={0x303038} roughness={0.35} metalness={0.8} />
          </mesh>
          <mesh position={[0, 0.14, 0]}>
            <torusGeometry args={[0.7, 0.024, 12, 32]} />
            <meshStandardMaterial
              color={WB_COLORS.goldYellow}
              emissive={WB_COLORS.goldYellow}
              emissiveIntensity={0.55}
              roughness={0.3}
              metalness={0.8}
            />
          </mesh>

          {/* 빨간 큰 버튼 (대형) */}
          <mesh ref={dropButtonRef} position={[0, 0.32, 0]} castShadow>
            <cylinderGeometry args={[0.6, 0.6, 0.28, 32]} />
            <meshStandardMaterial
              color={WB_COLORS.interactiveRed}
              roughness={0.25}
              metalness={0.3}
              emissive={WB_COLORS.interactiveRed}
              emissiveIntensity={0.3}
            />
          </mesh>
          <mesh position={[0, 0.47, 0]}>
            <cylinderGeometry args={[0.6, 0.6, 0.005, 32]} />
            <meshStandardMaterial
              color={WB_COLORS.interactiveRedLight}
              roughness={0.18}
              metalness={0.5}
            />
          </mesh>

          <mesh position={[0, 0.475, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.0, 1.0]} />
            <meshBasicMaterial map={dropTextTexture} transparent depthWrite={false} />
          </mesh>
          <mesh position={[0, 0.05, 0.92]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.95, 0.38]} />
            <meshBasicMaterial map={dropLabelTexture} transparent depthWrite={false} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
