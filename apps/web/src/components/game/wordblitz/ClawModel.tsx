// apps/web/src/components/game/wordblitz/ClawModel.tsx
// 집게 - 100% Procedural (GLB 의존 폐기 → 항상 명확히 보임 보장)
//
// 디자인:
//   - 천장 트롤리 (메탈 박스 + 시안 LED)
//   - 스프링 케이블 (TubeGeometry 14턴 helical)
//   - 마운트 디스크 (검정 + 골드 ring + 시안 LED 4점 + 자체 광원)
//   - 본체 (실버 메탈 콘 + 골드 ring + 강한 emissive)
//   - 4팔 손가락 (실버 cylinder + 검정 cone tip + 안쪽 닫힘)
//   - 모든 메탈 부분 자체 발광으로 어두운 박스에서도 명확

'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { WB_COLORS, WB_DIMS } from '@/lib/wordblitz/theme';
import type { LiveClawState } from '@/lib/wordblitz/types';

interface ClawModelProps {
  liveStateRef: React.MutableRefObject<LiveClawState>;
  grabbedPlushieRef?: React.MutableRefObject<THREE.Group | null>;
}

// 케이블 geometry — 매우 얇은 와이어 (가운데 검은 기둥 문제 해결)
// 스프링 형태는 시각적으로 노이즈를 만들기 때문에 단순 직선 cylinder 사용.
// 거의 안 보이게 얇고 메탈릭 회색 — 인형을 가리지 않음.
function createCableGeometry(): THREE.BufferGeometry {
  // length=1 cylinder. scale.y로 늘림.
  return new THREE.CylinderGeometry(0.012, 0.012, 1, 8);
}

export function ClawModel({ liveStateRef, grabbedPlushieRef }: ClawModelProps) {
  const holderRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const cableRef = useRef<THREE.Mesh>(null);
  const fingersRef = useRef<(THREE.Group | null)[]>([null, null, null, null]);

  const cableGeo = useMemo(createCableGeometry, []);

  // 천장 plate Y (천장 frame 안쪽 발광 plate) — cable 시작점
  const CEILING_PLATE_Y = WB_DIMS.ceilingY - 0.05;

  useFrame(() => {
    const live = liveStateRef.current;
    const holder = holderRef.current;
    const body = bodyRef.current;
    const cable = cableRef.current;
    if (!holder || !body || !cable) return;

    const worldX = live.clawX * WB_DIMS.clawXRange;
    holder.position.x = worldX;
    holder.position.y = live.clawY;
    holder.position.z = 0;

    body.rotation.z = live.clawSwing;

    // 케이블 길이 — 천장 plate에서 마운트 disc 윗면까지
    const cableLength = Math.max(0.2, CEILING_PLATE_Y - live.clawY - 0.07);
    cable.scale.y = cableLength;
    cable.position.y = cableLength / 2 + 0.07;

    // 4팔 닫힘 — 더 큰 회전으로 명확
    const closeAmount = (1 - live.clawOpen) * 1.0;
    fingersRef.current.forEach((finger) => {
      if (finger) finger.rotation.x = closeAmount;
    });

    // 잡힌 인형 따라가기
    const grabbed = grabbedPlushieRef?.current;
    if (grabbed) {
      grabbed.position.x = worldX + Math.sin(live.clawSwing) * 0.3;
      grabbed.position.y = live.clawY - 1.2;
      grabbed.position.z = 0;
      grabbed.rotation.z = live.clawSwing * 0.7;
      grabbed.rotation.y += 0.02;
    }
  });

  const fingerAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];

  return (
    <>
      {/* ─── 집게 어셈블리 (트롤리 제거 — 천장 plate가 cable을 자연스럽게 가림) ─── */}
      <group ref={holderRef} position={[0, WB_DIMS.clawHomeY, 0]}>
        {/* 얇은 메탈 와이어 — 인형 안 가림 */}
        <mesh ref={cableRef}>
          <primitive object={cableGeo} attach="geometry" />
          <meshStandardMaterial
            color={0xC0C0CA}
            roughness={0.25}
            metalness={0.95}
            envMapIntensity={1.8}
            transparent
            opacity={0.85}
          />
        </mesh>

        {/* 케이블 끝 둥근 캡 (실제 UFO catcher hub) */}
        <mesh position={[0, 0.18, 0]} castShadow>
          <sphereGeometry args={[0.18, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color={0x303038}
            roughness={0.28}
            metalness={0.95}
            envMapIntensity={1.8}
            emissive={0x1A2030}
            emissiveIntensity={0.2}
          />
        </mesh>

        {/* 마운트 디스크 (집게 윗부분) */}
        <mesh position={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.45, 0.16, 32]} />
          <meshStandardMaterial
            color={0x252530}
            roughness={0.28}
            metalness={0.95}
            envMapIntensity={1.8}
            emissive={0x1A2030}
            emissiveIntensity={0.25}
          />
        </mesh>

        {/* 마운트 위 골드 ring */}
        <mesh position={[0, 0.085, 0]}>
          <torusGeometry args={[0.42, 0.032, 12, 32]} />
          <meshStandardMaterial
            color={WB_COLORS.goldYellow}
            roughness={0.25}
            metalness={0.9}
            emissive={WB_COLORS.goldYellow}
            emissiveIntensity={0.55}
          />
        </mesh>
        {/* 마운트 아래 골드 ring */}
        <mesh position={[0, -0.085, 0]}>
          <torusGeometry args={[0.45, 0.025, 12, 32]} />
          <meshStandardMaterial
            color={WB_COLORS.goldYellow}
            roughness={0.25}
            metalness={0.9}
            emissive={WB_COLORS.goldYellow}
            emissiveIntensity={0.45}
          />
        </mesh>

        {/* 마운트 시안 LED 4점 */}
        {[0, 1, 2, 3].map((i) => {
          const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * 0.34, 0.075, Math.sin(angle) * 0.34]}
            >
              <sphereGeometry args={[0.03, 12, 12]} />
              <meshStandardMaterial
                color={WB_COLORS.clawAccent}
                emissive={WB_COLORS.clawAccent}
                emissiveIntensity={1.8}
              />
            </mesh>
          );
        })}

        {/* 마운트 자체 광원 */}
        <pointLight
          color={WB_COLORS.clawAccent}
          intensity={2.5}
          distance={3}
          position={[0, 0, 0]}
        />

        {/* ─── 본체 (진자 그룹) ─── */}
        <group ref={bodyRef} position={[0, -0.07, 0]}>
          {/* 메인 콘 (크고 명확한 실버 메탈 + 자체 발광) */}
          <mesh position={[0, -0.4, 0]} castShadow>
            <cylinderGeometry args={[0.4, 0.22, 0.75, 32]} />
            <meshStandardMaterial
              color={WB_COLORS.clawSilver}
              roughness={0.18}
              metalness={0.95}
              envMapIntensity={2.0}
              emissive={0x6878A0}
              emissiveIntensity={0.15}
            />
          </mesh>

          {/* 본체 골드 ring 액센트 */}
          <mesh position={[0, -0.1, 0]}>
            <torusGeometry args={[0.39, 0.022, 8, 32]} />
            <meshStandardMaterial
              color={WB_COLORS.goldYellow}
              emissive={WB_COLORS.goldYellow}
              emissiveIntensity={0.45}
              roughness={0.3}
              metalness={0.85}
            />
          </mesh>

          {/* 본체 바닥 plate */}
          <mesh position={[0, -0.82, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.22, 0.08, 32]} />
            <meshStandardMaterial
              color={0x303038}
              roughness={0.25}
              metalness={0.95}
              emissive={0x1A2030}
              emissiveIntensity={0.2}
            />
          </mesh>

          {/* 본체 바닥 시안 LED */}
          <mesh position={[0, -0.79, 0]}>
            <torusGeometry args={[0.18, 0.012, 8, 24]} />
            <meshStandardMaterial
              color={WB_COLORS.clawAccent}
              emissive={WB_COLORS.clawAccent}
              emissiveIntensity={1.5}
            />
          </mesh>

          {/* 4팔 손가락 (실제 UFO catcher 형태 - 굵은 hinge → 가늘어지는 finger → 뾰족 발톱) */}
          {fingerAngles.map((angle, i) => {
            const px = Math.cos(angle) * 0.2;
            const pz = Math.sin(angle) * 0.2;
            return (
              <group
                key={i}
                position={[px, -0.85, pz]}
                rotation={[0, -angle + Math.PI / 2, 0]}
              >
                <group
                  ref={(el) => {
                    fingersRef.current[i] = el;
                  }}
                >
                  {/* hinge joint (구체 - 회전 축 표시) */}
                  <mesh position={[0, 0, 0]} castShadow>
                    <sphereGeometry args={[0.07, 12, 10]} />
                    <meshStandardMaterial
                      color={0x303038}
                      roughness={0.3}
                      metalness={0.95}
                    />
                  </mesh>
                  {/* 손가락 상단 (굵은 부분) */}
                  <mesh position={[0, -0.18, 0.04]} rotation={[-0.18, 0, 0]} castShadow>
                    <cylinderGeometry args={[0.065, 0.05, 0.4, 14]} />
                    <meshStandardMaterial
                      color={WB_COLORS.clawSilver}
                      roughness={0.18}
                      metalness={0.95}
                      envMapIntensity={2.0}
                      emissive={0x6878A0}
                      emissiveIntensity={0.15}
                    />
                  </mesh>
                  {/* 손가락 하단 (가늘어짐) */}
                  <mesh position={[0, -0.43, 0.14]} rotation={[-0.4, 0, 0]} castShadow>
                    <cylinderGeometry args={[0.05, 0.03, 0.22, 12]} />
                    <meshStandardMaterial
                      color={WB_COLORS.clawSilver}
                      roughness={0.18}
                      metalness={0.95}
                      envMapIntensity={2.0}
                      emissive={0x6878A0}
                      emissiveIntensity={0.15}
                    />
                  </mesh>
                  {/* 발톱 tip (안쪽으로 굽은 cone) */}
                  <mesh
                    position={[0, -0.58, 0.22]}
                    rotation={[Math.PI - 0.55, 0, 0]}
                    castShadow
                  >
                    <coneGeometry args={[0.04, 0.16, 12]} />
                    <meshStandardMaterial
                      color={0x1A1A22}
                      roughness={0.35}
                      metalness={0.9}
                    />
                  </mesh>
                </group>
              </group>
            );
          })}
        </group>
      </group>
    </>
  );
}
