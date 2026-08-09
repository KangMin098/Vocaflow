// apps/web/src/components/pirate-quest/PirateScene.tsx
// 해변 환경 + 장식 GLB 그리드 + 자리 마커 + 깊이(회차) 그레이딩.
//
// v08 — 씬이 세션의 긴장 곡선을 같이 탄다. 잠수를 거듭할수록 해가 내려앉고
// (directionalLight 3.0 → 1.2), 안개가 조이고(near 24 → 12), 하늘이 식는다.
// "지금이 후반"이라는 사실을 숫자가 아니라 빛으로 읽게 하려는 것.

'use client';

import { memo, Suspense, useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

import { PirateModel, type MarkerView } from './PirateModel';
import { beachMetrics, type SceneryPlacement } from './logic';

export interface SceneMarker extends MarkerView {
  slot: number;
}

interface PirateSceneProps {
  scenery: SceneryPlacement[];
  markers: SceneMarker[];
  /** 0(초반 황금빛) → 1(해가 지고 안개가 조인다) */
  depth: number;
  /** 마커 없는 오브젝트를 낮춰 시선을 모을 것인가 */
  focus: boolean;
  reduced: boolean;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function mixHex(a: string, b: string, t: number): string {
  const pa = new THREE.Color(a);
  const pb = new THREE.Color(b);
  return `#${pa.lerp(pb, t).getHexString()}`;
}

/**
 * 카메라는 logic.beachMetrics 와 **같은 식**을 써야 한다 — 마커 자리 선택이 이 투영으로
 * 겹침을 푼다. 여기서 targetWidth 를 14 로 고정하고 있던 것이 390px 겹침의 절반이었다
 * (세로로 긴 화면에서 카메라가 z≈44 까지 물러나 1유닛 ≈ 27.9px 이 됐다).
 */
function ResponsiveCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    const m = beachMetrics(size.width, size.height);
    camera.position.set(0, 5.5, m.camZ);
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const persp = camera as THREE.PerspectiveCamera;
      persp.fov = 38;
      persp.updateProjectionMatrix();
    }
    camera.lookAt(0, 1.3, 0);
  }, [camera, size.width, size.height]);
  return null;
}

/**
 * 메시 전용 bounding box — 스키닝된 GLB(캐릭터·텐타클)에서
 * Box3.setFromObject 가 bone 위치까지 포함해 사이즈가 비정상적으로 커지는 문제 회피.
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

function CharacterGLB({
  url,
  position,
  targetHeight = 1.6,
  rotationY = 0,
}: {
  url: string;
  position: [number, number, number];
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

function Lighting({ depth }: { depth: number }) {
  return (
    <>
      <hemisphereLight args={[0xffc18c, 0xff8855, lerp(2.0, 1.05, depth)]} />
      <directionalLight
        color={0xff9f4e}
        intensity={lerp(3.0, 1.2, depth)}
        position={[8, 4, -5]}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight color={0xffe0aa} intensity={lerp(1.0, 0.5, depth)} position={[0, 4, 8]} />
      <pointLight color={0xffb347} intensity={lerp(4, 1.8, depth)} distance={15} position={[0, 6, 0]} />
      <pointLight color={0xff8c42} intensity={lerp(3, 1.2, depth)} distance={12} position={[-6, 4, 2]} />
      <pointLight color={0xffb347} intensity={lerp(3, 1.2, depth)} distance={12} position={[6, 4, 2]} />
      {/* 바다 반사는 반대로 살아난다 — 물이 차오르는 인상 */}
      <pointLight color={0x4fb8b8} intensity={lerp(1.8, 3.4, depth)} distance={16} position={[0, 0, -6]} />
    </>
  );
}

function Beach({ depth }: { depth: number }) {
  const sand = mixHex('#FCC067', '#8E6A46', depth);
  const wet = mixHex('#E89E48', '#6C513A', depth);
  const sea = mixHex('#4FB8B8', '#1E5F70', depth);
  const deepSea = mixHex('#2A7E8C', '#123C4C', depth);
  const sky = mixHex('#FFB85C', '#5C4470', depth);
  const sun = mixHex('#FFE680', '#FFB07A', depth);
  return (
    <>
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[50, 30]} />
        <meshStandardMaterial color={sand} roughness={0.95} metalness={0.05} />
      </mesh>
      <mesh position={[0, -0.04, -5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[50, 8]} />
        <meshStandardMaterial color={wet} roughness={0.95} transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 0.02, -10]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 22]} />
        <meshStandardMaterial color={sea} roughness={0.2} metalness={0.55} envMapIntensity={2.0} />
      </mesh>
      <mesh position={[0, 0.03, -16]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 14]} />
        <meshStandardMaterial color={deepSea} roughness={0.3} metalness={0.45} />
      </mesh>
      <mesh position={[0, 9, -24]}>
        <planeGeometry args={[100, 40]} />
        <meshBasicMaterial color={sky} />
      </mesh>
      <mesh position={[-9, 3, -22]}>
        <coneGeometry args={[3.5, 4.5, 5]} />
        <meshBasicMaterial color={mixHex('#6B3E2A', '#2E2038', depth)} />
      </mesh>
      <mesh position={[-13, 3.5, -23]}>
        <coneGeometry args={[3.0, 5.5, 5]} />
        <meshBasicMaterial color={mixHex('#553520', '#241A2C', depth)} />
      </mesh>
      <mesh position={[10, 3, -22]}>
        <coneGeometry args={[3.0, 4, 5]} />
        <meshBasicMaterial color={mixHex('#6B3E2A', '#2E2038', depth)} />
      </mesh>
      {/* 태양이 회차마다 수평선으로 내려앉는다 */}
      <mesh position={[0, lerp(4.5, 1.4, depth), -22]}>
        <circleGeometry args={[2.5, 32]} />
        <meshBasicMaterial color={sun} transparent opacity={0.95} />
      </mesh>
      <mesh position={[0, lerp(4.5, 1.4, depth), -21.95]}>
        <circleGeometry args={[1.6, 32]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={lerp(0.7, 0.28, depth)} />
      </mesh>
      <mesh position={[-6, 8, -20]}>
        <sphereGeometry args={[1.4, 16, 12]} />
        <meshBasicMaterial color={mixHex('#FFCC99', '#7A6690', depth)} transparent opacity={0.7} />
      </mesh>
      <mesh position={[-4, 8.3, -20]}>
        <sphereGeometry args={[1.1, 16, 12]} />
        <meshBasicMaterial color={mixHex('#FFCC99', '#7A6690', depth)} transparent opacity={0.7} />
      </mesh>
      <mesh position={[7, 9, -21]}>
        <sphereGeometry args={[1.5, 16, 12]} />
        <meshBasicMaterial color={mixHex('#FFD9A0', '#8877A0', depth)} transparent opacity={0.75} />
      </mesh>
      <mesh position={[9, 8.8, -21]}>
        <sphereGeometry args={[1.2, 16, 12]} />
        <meshBasicMaterial color={mixHex('#FFD9A0', '#8877A0', depth)} transparent opacity={0.75} />
      </mesh>
    </>
  );
}

/** 배경 자산은 세션 내내 고정 — memo 로 상위 재렌더에서 완전히 떼어낸다. */
const Decor = memo(function Decor() {
  return (
    <Suspense fallback={null}>
      <StaticGLB url="/pirate/Ship.glb" position={[0, 0.3, -10]} scale={0.95} rotationY={Math.PI * 0.05} />
      <StaticGLB url="/pirate/Skull.glb" position={[8.0, 0.3, -6.5]} scale={1.4} rotationY={-0.4} />
      <StaticGLB url="/pirate/Rock-BvlfuHFAuI.glb" position={[9.0, 0, -5.5]} scale={1.0} rotationY={0.5} />
      <StaticGLB url="/pirate/Palm Tree.glb" position={[9.5, 0, -5.0]} scale={1.0} rotationY={-0.3} />
      <StaticGLB url="/pirate/Dock.glb" position={[-7.5, 0, -5.0]} scale={1.0} rotationY={0.3} />
      <StaticGLB url="/pirate/House.glb" position={[-8.5, 0, -5.8]} scale={0.85} rotationY={0.4} />
      <StaticGLB url="/pirate/House-2kytqGs4rH.glb" position={[-10.0, 0, -5.3]} scale={0.7} rotationY={0.5} />
      <StaticGLB url="/pirate/Palm Tree.glb" position={[-7.0, 0, -4.0]} scale={0.95} rotationY={0.2} />
      <StaticGLB url="/pirate/Palm Tree-A6cKJYFsIb.glb" position={[-9.5, 0, -3.5]} scale={0.9} rotationY={1.0} />
      <StaticGLB url="/pirate/Small Ship.glb" position={[-3.5, 0.3, -8.5]} scale={0.7} rotationY={0.5} />
      <StaticGLB url="/pirate/Shark.glb" position={[-3.5, 1.2, -3.5]} scale={0.7} rotationY={0.3} />
      <StaticGLB url="/pirate/Shark.glb" position={[3.5, 1.2, -3.5]} scale={0.65} rotationY={-0.3} />
      <StaticGLB url="/pirate/Rock-4vHWF8XUBn.glb" position={[-10.5, 0, -1.5]} scale={1.2} rotationY={0.6} />
      <StaticGLB url="/pirate/Rocks.glb" position={[-9, 0, 0.5]} scale={0.85} rotationY={-0.2} />
      <StaticGLB url="/pirate/Rock-6cytS1cPiL.glb" position={[10.5, 0, -1.0]} scale={1.2} rotationY={-0.7} />
      <StaticGLB url="/pirate/Rocks-IFU6cm2Xow.glb" position={[9.0, 0, 0.7]} scale={0.85} rotationY={0.4} />
      <StaticGLB url="/pirate/Palm Tree-P0tgwyXBgr.glb" position={[-6.5, 0, 2.5]} scale={1.1} rotationY={0.5} />
      <StaticGLB url="/pirate/Palm Tree.glb" position={[6.5, 0, 2.5]} scale={1.05} rotationY={-0.4} />
      <StaticGLB url="/pirate/Large Bone.glb" position={[-4.5, 0, 4.8]} scale={0.4} rotationY={0.7} />
      <StaticGLB url="/pirate/Skull-VGtSTNRf2O.glb" position={[4.5, 0, 4.8]} scale={0.35} rotationY={-0.3} />
      <StaticGLB url="/pirate/Wood.glb" position={[-3.0, 0, 5.0]} scale={0.4} rotationY={0.4} />
      <StaticGLB url="/pirate/Wood.glb" position={[3.0, 0, 5.0]} scale={0.4} rotationY={-1.0} />
      <StaticGLB url="/pirate/Skeleton-yq5ATpujSt.glb" position={[8.5, 0, 1.8]} scale={0.9} rotationY={0.4} />
      <StaticGLB url="/pirate/Swords.glb" position={[-2.5, 0, 4.7]} scale={0.32} rotationY={1.2} />
      <StaticGLB url="/pirate/Rock.glb" position={[-0.8, 0, 4.7]} scale={0.25} />
      <StaticGLB url="/pirate/Rock-cg6yBEddtZ.glb" position={[2.5, 0, 4.8]} scale={0.25} rotationY={0.5} />
      <StaticGLB url="/pirate/Rocks-e1rgb5i2kF.glb" position={[-4.8, 0, 5.0]} scale={0.3} rotationY={-0.3} />
    </Suspense>
  );
});

function SceneContent({ scenery, markers, depth, focus, reduced }: PirateSceneProps) {
  const markerBySlot = useMemo(() => {
    const m = new Map<number, SceneMarker>();
    markers.forEach((mk) => m.set(mk.slot, mk));
    return m;
  }, [markers]);

  return (
    <>
      <ResponsiveCamera />
      <Lighting depth={depth} />
      <Beach depth={depth} />
      <Decor />

      <Suspense fallback={null}>
        {scenery.map((s) => (
          <PirateModel
            key={s.slot}
            url={s.modelUrl}
            position={[s.x, 0, s.z]}
            scale={s.scale}
            marker={markerBySlot.get(s.slot) ?? null}
            dim={focus}
            reduced={reduced}
          />
        ))}

        <CharacterGLB url="/pirate/Pirate Captain.glb" position={[0, 0, 4.0]} targetHeight={1.8} />
        <CharacterGLB url="/pirate/Anne.glb" position={[-2.8, 0, 3.8]} targetHeight={1.6} rotationY={0.3} />
        <CharacterGLB url="/pirate/Henry.glb" position={[2.8, 0, 3.8]} targetHeight={1.6} rotationY={-0.3} />
        <CharacterGLB url="/pirate/Sharky.glb" position={[-5.8, 0, 3.5]} targetHeight={1.7} rotationY={0.5} />
        <CharacterGLB url="/pirate/Skeleton.glb" position={[5.8, 0, 3.5]} targetHeight={1.7} rotationY={-0.4} />
      </Suspense>
    </>
  );
}

// memo — 상위(PirateQuestGame)는 밀물 시계 때문에 초당 60회 재렌더된다.
// 씬 props 는 잠수 전환 때만 바뀌므로 여기서 끊어야 3D 가 산다.
export const PirateScene = memo(function PirateScene(props: PirateSceneProps) {
  const d = props.depth;
  const sky = [
    mixHex('#E85A2C', '#2B1E44', d),
    mixHex('#FF8C42', '#3E2A55', d),
    mixHex('#FFB347', '#5A3C63', d),
    mixHex('#FFD580', '#7A5570', d),
    mixHex('#FFE8B0', '#9A7078', d),
    mixHex('#FCC067', '#8E6A46', d),
  ];
  return (
    <Canvas
      camera={{ position: [0, 5.5, 16], fov: 38, near: 0.1, far: 100 }}
      shadows
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: lerp(1.25, 1.0, d),
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: `linear-gradient(180deg, ${sky[0]} 0%, ${sky[1]} 20%, ${sky[2]} 40%, ${sky[3]} 60%, ${sky[4]} 80%, ${sky[5]} 100%)`,
      }}
    >
      {/* args 는 얕은 비교로 재생성 여부가 갈린다 — 문자열/숫자로만 넘겨 매 프레임 Fog 재생성을 막는다. */}
      <fog attach="fog" args={[mixHex('#FFB85C', '#4A3A5E', d), lerp(24, 12, d), lerp(40, 26, d)]} />
      <SceneContent {...props} />
    </Canvas>
  );
});

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
