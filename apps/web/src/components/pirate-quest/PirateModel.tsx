// apps/web/src/components/pirate-quest/PirateModel.tsx
// GLB 오브젝트 + (있으면) 자리 마커.
//
// v08 핵심 변경 — 마커는 **오브젝트와 무관한 단어**를 들고 있다.
// 이전 판은 word.modelUrl 과 label=word.en 이 같은 오브젝트에 묶여 있어서
// 모양만 보고 정답을 고를 수 있었다. 이제 모델은 순수 배경이고, 마커는
// buildDive 가 무작위로 꽂은 "자리 표식"일 뿐이다.
//
// 마커는 3D 메시가 아니라 실제 <button> 이다 — 모바일 390px 에서 GLB 메시는
// 30px 남짓이라 터치가 빗나갔고, 키보드·스크린리더 경로는 아예 없었다.

'use client';

import { Html, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { memo, useMemo, useRef, useState, type CSSProperties } from 'react';
import * as THREE from 'three';

/**
 * 마커 표시 상태 — 색만이 아니라 글리프·문구로도 구분한다(색각 대응).
 *
 * v08.2 에서 'hauled' 를 없앴다. 회수한 자리를 ✓ + 영단어 + 한국어 뜻으로 계속 띄우면
 *   ① 남은 후보를 화면이 대신 지워줘 마지막 회수가 강제 2지선다가 되고,
 *   ② "영어와 뜻이 동시에 화면에 있는 순간 0" 이라는 이 게임의 인출 전제가 깨진다.
 * 이제 회수한 자리도 잠수 중에는 물에 잠긴 자리와 완전히 똑같이 보인다.
 */
export type MarkerMode = 'label' | 'hidden' | 'correct' | 'wrong';

export interface MarkerView {
  badge: number;
  mode: MarkerMode;
  en: string;
  ko: string;
  interactive: boolean;
  /**
   * 화면 세로 계단(px). 카메라 피치가 7° 남짓이라 z 가 달라도 라벨이 같은 높이에
   * 찍힌다 — 3D 좌표가 아니라 화면 픽셀로 올려야 실제로 안 겹친다.
   */
  liftPx: number;
  onPick: () => void;
}

interface PirateModelProps {
  url: string;
  position: [number, number, number];
  scale?: number;
  marker?: MarkerView | null;
  /** 잠수 중 배경 오브젝트를 살짝 낮춰 마커에 시선을 모은다. */
  dim?: boolean;
  reduced?: boolean;
}

const TARGET_HEIGHT = 1.1;

/**
 * 메시 전용 bounding box — 스키닝된 GLB(텐타클·동물)에서 Box3.setFromObject 가
 * bone 위치까지 포함해 비정상적으로 큰 사이즈가 나오는 문제 회피.
 */
function meshOnlyBox(obj: THREE.Object3D): THREE.Box3 {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3();
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const mb = mesh.geometry.boundingBox;
    if (!mb) return;
    const cloned = mb.clone();
    cloned.applyMatrix4(mesh.matrixWorld);
    box.union(cloned);
  });
  return box;
}

const MODE_GLYPH: Record<MarkerMode, string> = {
  label: '',
  hidden: '≈',
  correct: '✓',
  wrong: '✕',
};

// memo — 밀물 시계가 초당 60회 상위 상태를 갱신한다. 마커가 없는 장식 오브젝트
// 20여 개까지 매 프레임 재렌더되면 3D 프레임이 그대로 무너진다.
export const PirateModel = memo(function PirateModel({
  url,
  position,
  scale = 1.0,
  marker = null,
  dim = false,
  reduced = false,
}: PirateModelProps) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const seedRef = useRef(Math.random() * 10);
  const popRef = useRef(0);
  const shakeRef = useRef(0);
  const lastModeRef = useRef<MarkerMode | null>(null);

  const cloned = useMemo(() => {
    const clone = scene.clone(true);
    const box = meshOnlyBox(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    if (size.y > 0.01 && isFinite(size.y)) {
      const s = (TARGET_HEIGHT * scale) / size.y;
      clone.scale.setScalar(s);
      clone.position.x = -center.x * s;
      clone.position.y = -box.min.y * s;
      clone.position.z = -center.z * s;
    }
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          if (m && (m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            const sm = m as THREE.MeshStandardMaterial;
            sm.envMapIntensity = 1.2;
            sm.needsUpdate = true;
          }
        });
      }
    });
    return clone;
  }, [scene, scale]);

  const mode = marker?.mode ?? null;
  if (mode !== lastModeRef.current) {
    lastModeRef.current = mode;
    if (mode === 'correct') popRef.current = 1;
    if (mode === 'wrong') shakeRef.current = 1;
  }

  useFrame(({ clock }, delta) => {
    const g = groupRef.current;
    if (!g) return;

    let y = position[1];
    let x = position[0];
    let rot = 0;

    if (!reduced) {
      const t = clock.elapsedTime + seedRef.current;
      y += Math.abs(Math.sin(t * 1.6)) * 0.03;
      rot = Math.sin(t * 0.7) * 0.06;
      if (hovered && marker?.interactive) y += 0.12;
      if (popRef.current > 0) {
        y += popRef.current * 0.5;
        popRef.current = Math.max(0, popRef.current - delta * 1.5);
      }
      if (shakeRef.current > 0) {
        x += Math.sin(clock.elapsedTime * 30) * shakeRef.current * 0.12;
        shakeRef.current = Math.max(0, shakeRef.current - delta * 2);
      }
    } else {
      popRef.current = 0;
      shakeRef.current = 0;
    }

    g.position.set(x, y, position[2]);
    g.rotation.y = rot;

    const target = dim && !marker ? 0.86 : hovered && marker?.interactive ? 1.08 : 1;
    if (reduced) g.scale.setScalar(target);
    else g.scale.lerp(new THREE.Vector3(target, target, target), 0.15);
  });

  const clickable = !!marker?.interactive;

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={
        clickable
          ? (e) => {
              e.stopPropagation();
              marker?.onPick();
            }
          : undefined
      }
      onPointerOver={
        clickable
          ? (e) => {
              e.stopPropagation();
              setHovered(true);
              document.body.style.cursor = 'pointer';
            }
          : undefined
      }
      onPointerOut={
        clickable
          ? () => {
              setHovered(false);
              document.body.style.cursor = 'auto';
            }
          : undefined
      }
    >
      <primitive object={cloned} />

      {marker && (
        <Html position={[0, TARGET_HEIGHT * scale + 0.45, 0]} center zIndexRange={[12, 0]}>
          {/* 계단 래퍼 — 버튼 자신의 hover/active transform 과 충돌하지 않게 한 겹 감싼다.
              줄기(pq-mk-stem)가 올라간 라벨과 그 자리의 오브젝트를 눈으로 다시 잇는다. */}
          <span
            className="pq-mk-lift"
            style={{ '--pq-lift': `${Math.max(0, marker.liftPx)}px` } as CSSProperties}
          >
            {marker.liftPx > 0 && <span className="pq-mk-stem" aria-hidden="true" />}
            <button
              type="button"
              className="pq-mk"
              data-mode={marker.mode}
              data-hover={hovered ? '1' : '0'}
              aria-disabled={marker.interactive ? undefined : 'true'}
              tabIndex={marker.interactive ? 0 : -1}
              onClick={(e) => {
                e.stopPropagation();
                if (marker.interactive) marker.onPick();
              }}
              onPointerEnter={() => setHovered(true)}
              onPointerLeave={() => setHovered(false)}
              aria-label={
                marker.mode === 'label'
                  ? `${marker.badge}번 자리 · ${marker.en}`
                  : marker.mode === 'hidden'
                    ? `${marker.badge}번 자리 · 물에 잠김`
                    : `${marker.badge}번 자리 · ${marker.en} ${marker.ko}`
              }
            >
              <span className="pq-mk-badge" aria-hidden="true">
                {marker.badge}
              </span>
              {marker.mode === 'label' ? (
                <span className="pq-mk-en">{marker.en}</span>
              ) : marker.mode === 'hidden' ? (
                <span className="pq-mk-glyph" aria-hidden="true">
                  {MODE_GLYPH.hidden}
                </span>
              ) : (
                <span className="pq-mk-pair">
                  <span className="pq-mk-glyph" aria-hidden="true">
                    {MODE_GLYPH[marker.mode]}
                  </span>
                  <span className="pq-mk-en">{marker.en}</span>
                  <span className="pq-mk-ko">{marker.ko}</span>
                </span>
              )}
            </button>
          </span>
        </Html>
      )}

      {marker?.interactive && hovered && (
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.72, 32]} />
          <meshBasicMaterial color={0xffd93d} transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}

      {marker?.mode === 'correct' && (
        <>
          <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.95, 32]} />
            <meshBasicMaterial color={0xffd93d} transparent opacity={0.6} side={THREE.DoubleSide} />
          </mesh>
          <pointLight color={0xffd93d} intensity={4} distance={3} position={[0, 0.8, 0]} />
        </>
      )}

      {marker?.mode === 'wrong' && (
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.6, 0.9, 32]} />
          <meshBasicMaterial color={0xb5803a} transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
});
