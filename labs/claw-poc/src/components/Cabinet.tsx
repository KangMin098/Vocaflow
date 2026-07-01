// labs/claw-poc/src/components/Cabinet.tsx
import { RigidBody } from '@react-three/rapier'

const HALF_W = 2
const HEIGHT = 5
const WALL_T = 0.08
const CHUTE_X = -1.5
const CHUTE_Z = -1.5
const CHUTE_R = 0.55

const NEON = '#ff3d7f'
const NEON_TOP = '#ff77b3'
const RAINBOW_COLORS = ['#ff4d6d', '#ffb84d', '#ffe66d', '#8ce46d', '#4dd0e1', '#7c6df0', '#c86df0']

export function Cabinet() {
  return (
    <>
      {/* ---------------- interior (physical) ---------------- */}
      <RigidBody type="fixed" colliders="cuboid" friction={0.5}>
        {/* floor: 4 pieces around back-left chute */}
        <mesh position={[0, 0, -HALF_W + (HALF_W - (CHUTE_Z + CHUTE_R)) / 2 - CHUTE_R]} receiveShadow>
          <boxGeometry args={[2 * HALF_W, WALL_T, HALF_W - (CHUTE_Z + CHUTE_R)]} />
          <meshStandardMaterial color="#f4f7fb" emissive="#66c8ff" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0, 0, (CHUTE_Z + CHUTE_R + HALF_W) / 2]} receiveShadow>
          <boxGeometry args={[2 * HALF_W, WALL_T, HALF_W - (CHUTE_Z + CHUTE_R)]} />
          <meshStandardMaterial color="#f4f7fb" emissive="#66c8ff" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[(CHUTE_X + CHUTE_R + HALF_W) / 2, 0, CHUTE_Z]} receiveShadow>
          <boxGeometry args={[HALF_W - (CHUTE_X + CHUTE_R), WALL_T, 2 * CHUTE_R]} />
          <meshStandardMaterial color="#f4f7fb" emissive="#66c8ff" emissiveIntensity={0.25} />
        </mesh>

        {/* 4 clear glass walls */}
        <mesh position={[0, HEIGHT / 2, -HALF_W]}>
          <boxGeometry args={[2 * HALF_W, HEIGHT, WALL_T]} />
          <meshPhysicalMaterial color="#bde3f6" transparent opacity={0.12} roughness={0.05} transmission={0.7} />
        </mesh>
        <mesh position={[0, HEIGHT / 2, HALF_W]}>
          <boxGeometry args={[2 * HALF_W, HEIGHT, WALL_T]} />
          <meshPhysicalMaterial color="#bde3f6" transparent opacity={0.12} roughness={0.05} transmission={0.7} />
        </mesh>
        <mesh position={[-HALF_W, HEIGHT / 2, 0]}>
          <boxGeometry args={[WALL_T, HEIGHT, 2 * HALF_W]} />
          <meshPhysicalMaterial color="#bde3f6" transparent opacity={0.12} roughness={0.05} transmission={0.7} />
        </mesh>
        <mesh position={[HALF_W, HEIGHT / 2, 0]}>
          <boxGeometry args={[WALL_T, HEIGHT, 2 * HALF_W]} />
          <meshPhysicalMaterial color="#bde3f6" transparent opacity={0.12} roughness={0.05} transmission={0.7} />
        </mesh>
      </RigidBody>

      {/* ---------------- decoration (no physics) ---------------- */}

      {/* Neon pink LED frame around top of cabinet */}
      {[
        { p: [0, HEIGHT, -HALF_W] as [number, number, number], s: [2 * HALF_W + 0.2, 0.12, 0.12] as [number, number, number] },
        { p: [0, HEIGHT, HALF_W] as [number, number, number], s: [2 * HALF_W + 0.2, 0.12, 0.12] as [number, number, number] },
        { p: [-HALF_W, HEIGHT, 0] as [number, number, number], s: [0.12, 0.12, 2 * HALF_W] as [number, number, number] },
        { p: [HALF_W, HEIGHT, 0] as [number, number, number], s: [0.12, 0.12, 2 * HALF_W] as [number, number, number] },
      ].map((e, i) => (
        <mesh key={`top-${i}`} position={e.p}>
          <boxGeometry args={e.s} />
          <meshStandardMaterial color={NEON} emissive={NEON} emissiveIntensity={1.8} />
        </mesh>
      ))}

      {/* Neon pink LED strips down 4 vertical corners */}
      {[
        [-HALF_W, HEIGHT / 2, -HALF_W],
        [HALF_W, HEIGHT / 2, -HALF_W],
        [-HALF_W, HEIGHT / 2, HALF_W],
        [HALF_W, HEIGHT / 2, HALF_W],
      ].map((p, i) => (
        <mesh key={`corner-${i}`} position={p as [number, number, number]}>
          <boxGeometry args={[0.12, HEIGHT, 0.12]} />
          <meshStandardMaterial color={NEON} emissive={NEON} emissiveIntensity={1.5} />
        </mesh>
      ))}

      {/* Rainbow LED sign bar above cabinet — CATCHING DUCK */}
      <group position={[0, HEIGHT + 0.7, 0]}>
        <mesh>
          <boxGeometry args={[2 * HALF_W + 0.6, 0.55, 0.25]} />
          <meshStandardMaterial color="#0d0d10" />
        </mesh>
        {/* rainbow bar */}
        {RAINBOW_COLORS.map((c, i) => (
          <mesh key={i} position={[-HALF_W - 0.15 + ((2 * HALF_W + 0.3) / RAINBOW_COLORS.length) * (i + 0.5), 0, 0.13]}>
            <boxGeometry args={[(2 * HALF_W + 0.3) / RAINBOW_COLORS.length - 0.02, 0.42, 0.02]} />
            <meshStandardMaterial color={c} emissive={c} emissiveIntensity={2.2} toneMapped={false} />
          </mesh>
        ))}
        {/* top edge neon glow */}
        <mesh position={[0, 0.32, 0]}>
          <boxGeometry args={[2 * HALF_W + 0.7, 0.08, 0.3]} />
          <meshStandardMaterial color={NEON_TOP} emissive={NEON_TOP} emissiveIntensity={2.5} />
        </mesh>
        <mesh position={[0, -0.32, 0]}>
          <boxGeometry args={[2 * HALF_W + 0.7, 0.08, 0.3]} />
          <meshStandardMaterial color={NEON_TOP} emissive={NEON_TOP} emissiveIntensity={2.5} />
        </mesh>
      </group>

      {/* ---------------- bottom SPACE PLAYER control panel ---------------- */}
      <group position={[0, -0.6, HALF_W + 0.2]}>
        {/* main panel — pink slanted */}
        <mesh rotation={[-Math.PI / 6, 0, 0]}>
          <boxGeometry args={[2 * HALF_W + 0.2, 0.9, 0.08]} />
          <meshStandardMaterial color="#ff6a94" roughness={0.5} />
        </mesh>
        {/* black SPACE stripe */}
        <mesh position={[0, -0.3, 0.02]} rotation={[-Math.PI / 6, 0, 0]}>
          <boxGeometry args={[2 * HALF_W + 0.25, 0.2, 0.06]} />
          <meshStandardMaterial color="#0d0d10" />
        </mesh>
        {/* joystick base */}
        <mesh position={[-1.0, 0.08, 0.35]} rotation={[-Math.PI / 6, 0, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.06, 20]} />
          <meshStandardMaterial color="#2a2f36" />
        </mesh>
        {/* joystick shaft */}
        <mesh position={[-1.0, 0.22, 0.4]} rotation={[-Math.PI / 6, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.24, 16]} />
          <meshStandardMaterial color="#4a90c8" emissive="#3a80b0" emissiveIntensity={0.5} />
        </mesh>
        {/* joystick crystal ball */}
        <mesh position={[-1.0, 0.36, 0.44]}>
          <sphereGeometry args={[0.08, 20, 16]} />
          <meshPhysicalMaterial
            color="#ffffff"
            transmission={0.9}
            roughness={0.1}
            transparent
            opacity={0.85}
            emissive="#88bfff"
            emissiveIntensity={0.4}
          />
        </mesh>
        {/* white round button */}
        <mesh position={[1.0, 0.05, 0.34]} rotation={[-Math.PI / 6, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.05, 24]} />
          <meshStandardMaterial color="#f4f4f4" emissive="#ffffff" emissiveIntensity={0.4} />
        </mesh>
        {/* triangle arrow marker */}
        <mesh position={[1.0, 0.05, 0.4]} rotation={[-Math.PI / 6, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.01, 3]} />
          <meshStandardMaterial color="#f6c700" emissive="#f6c700" emissiveIntensity={0.8} />
        </mesh>
      </group>
    </>
  )
}

export const CABINET_BOUNDS = { HALF_W, HEIGHT, CHUTE_X, CHUTE_Z, CHUTE_R }
