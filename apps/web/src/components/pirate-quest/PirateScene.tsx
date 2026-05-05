// apps/web/src/components/pirate-quest/PirateScene.tsx
// 해변 환경 + 6 GLB 그리드 + 3D 카메라 + 화창한 분위기

'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { PirateModel } from './PirateModel';
import { useGLTF } from '@react-three/drei';
import type { ItemPlacement } from '@/lib/pirate-quest/types';
import type { PirateWord } from '@/lib/pirate-quest/data';

interface PirateSceneProps {
  /** 17개 단어 GLB 화면 배치 (모두 표시 — 장식) */
  itemPlacements: ItemPlacement[];
  /** 4개 선택지 영단어 (라벨/클릭 활성) */
  activeChoiceEns: string[];
  /** 힌트 활성 시 정답 영단어 (해당 GLB만 황금 외곽선) */
  hintTargetEn: string | null;
  feedbackWord: PirateWord | null;
  feedbackIsCorrect: boolean;
  onChoiceClick: (word: PirateWord) => void;
}

function ResponsiveCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / size.height;
    // 화면 더 넓게 + 캐릭터 풀바디 — 카메라 위에서 내려다봄
    const targetWidth = 14.0;
    const targetHeight = 11.0;
    const fov = 38;
    const fovRad = (fov * Math.PI) / 180;
    let z = targetHeight / 2 / Math.tan(fovRad / 2);
    const zForWidth = targetWidth / 2 / Math.tan(fovRad / 2) / Math.max(aspect, 0.1);
    z = Math.max(z, zForWidth);
    camera.position.set(0, 5.5, z);
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const persp = camera as THREE.PerspectiveCamera;
      persp.fov = fov;
      persp.updateProjectionMatrix();
    }
    camera.lookAt(0, 1.3, 0);
  }, [camera, size.width, size.height]);
  return null;
}

/**
 * 메시 전용 bounding box — 스키닝된 GLB(캐릭터·텐타클)에서
 * Box3.setFromObject 가 bone 위치까지 포함해 사이즈가 비정상적으로 커지는 문제 회피.
 * 각 Mesh 의 geometry.boundingBox 를 mesh.matrixWorld 로 변환해 합집합.
 */
function computeMeshOnlyBox(obj: THREE.Object3D): THREE.Box3 {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3();
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const meshBox = mesh.geometry.boundingBox;
    if (!meshBox) return;
    const cloned = meshBox.clone();
    cloned.applyMatrix4(mesh.matrixWorld);
    box.union(cloned);
  });
  return box;
}

// ─── 정적 GLB 데코레이션 (배경 자산) ───
function StaticGLB({
  url,
  position,
  scale = 1,
  rotationY = 0,
}: {
  url: string;
  position: [number, number, number];
  scale?: number;
  rotationY?: number;
}) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);
  return <primitive object={cloned} position={position} scale={scale} rotation={[0, rotationY, 0]} />;
}

// ─── 자동 스케일 캐릭터 GLB (높이 정규화) ───
function CharacterGLB({
  url,
  position,
  targetHeight = 1.6,
  rotationY = 0,
}: {
  url: string;
  position: [number, number, number];
  /** 모델 정규화 높이 (단위) */
  targetHeight?: number;
  rotationY?: number;
}) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    const box = computeMeshOnlyBox(c);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    if (size.y > 0.01 && isFinite(size.y)) {
      const s = targetHeight / size.y;
      c.scale.setScalar(s);
      c.position.x = -center.x * s;
      c.position.y = -box.min.y * s;
      c.position.z = -center.z * s;
    }
    c.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return c;
  }, [scene, targetHeight]);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <primitive object={cloned} />
    </group>
  );
}

function Lighting() {
  return (
    <>
      {/* 하늘 환경광 (선셋 따뜻한 오렌지) */}
      <hemisphereLight args={[0xFFC18C, 0xFF8855, 2.0]} />
      {/* 황금시간대 햇빛 (수평선 낮은 각도) */}
      <directionalLight
        color={0xFF9F4E}
        intensity={3.0}
        position={[8, 4, -5]}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* 정면 fill (따뜻한 황금) */}
      <directionalLight color={0xFFE0AA} intensity={1.0} position={[0, 4, 8]} />
      {/* 강한 황금빛 sunset glow */}
      <pointLight color={0xFFB347} intensity={4} distance={15} position={[0, 6, 0]} />
      {/* 좌측 따뜻한 보조 */}
      <pointLight color={0xFF8C42} intensity={3} distance={12} position={[-6, 4, 2]} />
      {/* 우측 따뜻한 보조 */}
      <pointLight color={0xFFB347} intensity={3} distance={12} position={[6, 4, 2]} />
      {/* 청록 바다 반사 */}
      <pointLight color={0x4FB8B8} intensity={1.8} distance={14} position={[0, 0, -6]} />
    </>
  );
}

function Beach() {
  return (
    <>
      {/* 모래 바닥 (밝은 황금) */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[50, 30]} />
        <meshStandardMaterial color={0xFCC067} roughness={0.95} metalness={0.05} />
      </mesh>
      {/* 모래 젖은 영역 (바다 가까이) */}
      <mesh position={[0, -0.04, -5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[50, 8]} />
        <meshStandardMaterial color={0xE89E48} roughness={0.95} transparent opacity={0.7} />
      </mesh>
      {/* 바다 (청록) */}
      <mesh position={[0, 0.02, -10]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 22]} />
        <meshStandardMaterial color={0x4FB8B8} roughness={0.2} metalness={0.55} envMapIntensity={2.0} />
      </mesh>
      {/* 바다 깊은 부분 */}
      <mesh position={[0, 0.03, -16]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 14]} />
        <meshStandardMaterial color={0x2A7E8C} roughness={0.3} metalness={0.45} />
      </mesh>
      {/* 하늘 멀리 (선셋 그라디언트) - 큰 plane */}
      <mesh position={[0, 9, -24]}>
        <planeGeometry args={[100, 40]} />
        <meshBasicMaterial color={0xFFB85C} />
      </mesh>
      {/* 멀리 산 실루엣 (좌) */}
      <mesh position={[-9, 3, -22]}>
        <coneGeometry args={[3.5, 4.5, 5]} />
        <meshBasicMaterial color={0x6B3E2A} />
      </mesh>
      <mesh position={[-13, 3.5, -23]}>
        <coneGeometry args={[3.0, 5.5, 5]} />
        <meshBasicMaterial color={0x553520} />
      </mesh>
      {/* 멀리 산 실루엣 (우) */}
      <mesh position={[10, 3, -22]}>
        <coneGeometry args={[3.0, 4, 5]} />
        <meshBasicMaterial color={0x6B3E2A} />
      </mesh>
      {/* 큰 태양 (수평선 황금 sunset) */}
      <mesh position={[0, 4.5, -22]}>
        <circleGeometry args={[2.5, 32]} />
        <meshBasicMaterial color={0xFFE680} transparent opacity={0.95} />
      </mesh>
      <mesh position={[0, 4.5, -21.95]}>
        <circleGeometry args={[1.6, 32]} />
        <meshBasicMaterial color={0xFFFFFF} transparent opacity={0.7} />
      </mesh>
      {/* 구름 (옅은 톤) */}
      <mesh position={[-6, 8, -20]}>
        <sphereGeometry args={[1.4, 16, 12]} />
        <meshBasicMaterial color={0xFFCC99} transparent opacity={0.7} />
      </mesh>
      <mesh position={[-4, 8.3, -20]}>
        <sphereGeometry args={[1.1, 16, 12]} />
        <meshBasicMaterial color={0xFFCC99} transparent opacity={0.7} />
      </mesh>
      <mesh position={[7, 9, -21]}>
        <sphereGeometry args={[1.5, 16, 12]} />
        <meshBasicMaterial color={0xFFD9A0} transparent opacity={0.75} />
      </mesh>
      <mesh position={[9, 8.8, -21]}>
        <sphereGeometry args={[1.2, 16, 12]} />
        <meshBasicMaterial color={0xFFD9A0} transparent opacity={0.75} />
      </mesh>
    </>
  );
}

function SceneContent({ itemPlacements, activeChoiceEns, hintTargetEn, feedbackWord, feedbackIsCorrect, onChoiceClick }: PirateSceneProps) {
  const activeSet = new Set(activeChoiceEns);
  return (
    <>
      <ResponsiveCamera />
      <Lighting />
      <Beach />

      {/* ═══ 배경 자산 — 레퍼런스 비율 (캐릭터 잘 보이게) ═══ */}
      <Suspense fallback={null}>
        {/* 중앙 후면: 해적선 — 작게 + 더 멀리 (캐릭터 압도 X) */}
        <StaticGLB url="/pirate/Ship.glb" position={[0, 0.3, -10]} scale={0.95} rotationY={Math.PI * 0.05} />

        {/* 우측 후면: 해골 절벽 (커야 함) */}
        <StaticGLB url="/pirate/Skull.glb" position={[8.0, 0.3, -6.5]} scale={1.4} rotationY={-0.4} />
        <StaticGLB url="/pirate/Rock-BvlfuHFAuI.glb" position={[9.0, 0, -5.5]} scale={1.0} rotationY={0.5} />
        <StaticGLB url="/pirate/Palm Tree.glb" position={[9.5, 0, -5.0]} scale={1.0} rotationY={-0.3} />

        {/* 좌측 후면: 부두 + 마을 */}
        <StaticGLB url="/pirate/Dock.glb" position={[-7.5, 0, -5.0]} scale={1.0} rotationY={0.3} />
        <StaticGLB url="/pirate/House.glb" position={[-8.5, 0, -5.8]} scale={0.85} rotationY={0.4} />
        <StaticGLB url="/pirate/House-2kytqGs4rH.glb" position={[-10.0, 0, -5.3]} scale={0.7} rotationY={0.5} />
        <StaticGLB url="/pirate/Palm Tree.glb" position={[-7.0, 0, -4.0]} scale={0.95} rotationY={0.2} />
        <StaticGLB url="/pirate/Palm Tree-A6cKJYFsIb.glb" position={[-9.5, 0, -3.5]} scale={0.9} rotationY={1.0} />

        {/* 멀리 작은 배 */}
        <StaticGLB url="/pirate/Small Ship.glb" position={[-3.5, 0.3, -8.5]} scale={0.7} rotationY={0.5} />

        {/* 상어 (수면 위로 점프) — 원본 처럼 좌·우 */}
        <StaticGLB url="/pirate/Shark.glb" position={[-3.5, 1.2, -3.5]} scale={0.7} rotationY={0.3} />
        <StaticGLB url="/pirate/Shark.glb" position={[3.5, 1.2, -3.5]} scale={0.65} rotationY={-0.3} />

        {/* 좌·우 측면 큰 바위 절벽 */}
        <StaticGLB url="/pirate/Rock-4vHWF8XUBn.glb" position={[-10.5, 0, -1.5]} scale={1.2} rotationY={0.6} />
        <StaticGLB url="/pirate/Rocks.glb" position={[-9, 0, 0.5]} scale={0.85} rotationY={-0.2} />
        <StaticGLB url="/pirate/Rock-6cytS1cPiL.glb" position={[10.5, 0, -1.0]} scale={1.2} rotationY={-0.7} />
        <StaticGLB url="/pirate/Rocks-IFU6cm2Xow.glb" position={[9.0, 0, 0.7]} scale={0.85} rotationY={0.4} />

        {/* 양 측면 야자수 */}
        <StaticGLB url="/pirate/Palm Tree-P0tgwyXBgr.glb" position={[-6.5, 0, 2.5]} scale={1.1} rotationY={0.5} />
        <StaticGLB url="/pirate/Palm Tree.glb" position={[6.5, 0, 2.5]} scale={1.05} rotationY={-0.4} />

        {/* 전경 모래 위 뼈/잔해 — 작게 + 측면 (가운데 비움) */}
        <StaticGLB url="/pirate/Large Bone.glb" position={[-4.5, 0, 4.8]} scale={0.4} rotationY={0.7} />
        <StaticGLB url="/pirate/Skull-VGtSTNRf2O.glb" position={[4.5, 0, 4.8]} scale={0.35} rotationY={-0.3} />
        <StaticGLB url="/pirate/Wood.glb" position={[-3.0, 0, 5.0]} scale={0.4} rotationY={0.4} />
        <StaticGLB url="/pirate/Wood.glb" position={[3.0, 0, 5.0]} scale={0.4} rotationY={-1.0} />

        {/* 추가 해골 잔해 (배경) */}
        <StaticGLB url="/pirate/Skeleton-yq5ATpujSt.glb" position={[8.5, 0, 1.8]} scale={0.9} rotationY={0.4} />

        {/* 검 잔해 */}
        <StaticGLB url="/pirate/Swords.glb" position={[-2.5, 0, 4.7]} scale={0.32} rotationY={1.2} />

        {/* 작은 바위 분산 */}
        <StaticGLB url="/pirate/Rock.glb" position={[-0.8, 0, 4.7]} scale={0.25} />
        <StaticGLB url="/pirate/Rock-cg6yBEddtZ.glb" position={[2.5, 0, 4.8]} scale={0.25} rotationY={0.5} />
        <StaticGLB url="/pirate/Rocks-e1rgb5i2kF.glb" position={[-4.8, 0, 5.0]} scale={0.3} rotationY={-0.3} />
      </Suspense>

      {/* ━━━ 17 GLB 모두 표시 — 4개만 라벨/클릭 활성, 나머지는 장식 ━━━ */}
      <Suspense fallback={null}>
        {itemPlacements.map(({ word, slot }) => {
          const isActive = activeSet.has(word.en);
          let phase: 'idle' | 'correct' | 'wrong' | 'dimmed' = 'idle';
          if (feedbackWord) {
            if (word.en === feedbackWord.en) {
              phase = feedbackIsCorrect ? 'correct' : 'wrong';
            } else if (!isActive) {
              phase = 'dimmed';
            }
          }
          return (
            <PirateModel
              key={word.en}
              url={word.modelUrl}
              position={[slot.x, 0, slot.z]}
              scale={word.scale ?? 1.0}
              showLabel={isActive}
              label={word.en}
              category={word.category}
              feedback={phase}
              isHintTarget={hintTargetEn === word.en}
              onClick={isActive ? () => onChoiceClick(word) : undefined}
            />
          );
        })}

        {/* ━━━ 메인 캐릭터 5명 (전경 — 자동 스케일 1.7 unit 높이 통일) ━━━ */}
        <CharacterGLB url="/pirate/Pirate Captain.glb" position={[0, 0, 4.0]} targetHeight={1.8} />
        <CharacterGLB url="/pirate/Anne.glb"           position={[-2.8, 0, 3.8]} targetHeight={1.6} rotationY={0.3} />
        <CharacterGLB url="/pirate/Henry.glb"          position={[2.8, 0, 3.8]}  targetHeight={1.6} rotationY={-0.3} />
        <CharacterGLB url="/pirate/Sharky.glb"         position={[-5.8, 0, 3.5]} targetHeight={1.7} rotationY={0.5} />
        <CharacterGLB url="/pirate/Skeleton.glb"       position={[5.8, 0, 3.5]}  targetHeight={1.7} rotationY={-0.4} />
      </Suspense>
    </>
  );
}

export function PirateScene(props: PirateSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 5.5, 16], fov: 38, near: 0.1, far: 100 }}
      shadows
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.25,
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background:
          'linear-gradient(180deg, #E85A2C 0%, #FF8C42 20%, #FFB347 40%, #FFD580 60%, #FFE8B0 80%, #FCC067 100%)',
      }}
    >
      <fog attach="fog" args={[0xFFB85C, 22, 38]} />
      <SceneContent {...props} />
    </Canvas>
  );
}

// Preload 자주 쓰는 GLB
useGLTF.preload('/pirate/Palm Tree.glb');
useGLTF.preload('/pirate/Palm Tree-A6cKJYFsIb.glb');
useGLTF.preload('/pirate/Palm Tree-P0tgwyXBgr.glb');
useGLTF.preload('/pirate/Rock.glb');
useGLTF.preload('/pirate/Dock.glb');
useGLTF.preload('/pirate/House.glb');
useGLTF.preload('/pirate/Small Ship.glb');
useGLTF.preload('/pirate/Pirate Captain.glb');
useGLTF.preload('/pirate/Anne.glb');
useGLTF.preload('/pirate/Henry.glb');
useGLTF.preload('/pirate/Sharky.glb');
useGLTF.preload('/pirate/Skeleton.glb');
useGLTF.preload('/pirate/Ship.glb');
