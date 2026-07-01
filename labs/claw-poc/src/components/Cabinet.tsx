// labs/claw-poc/src/components/Cabinet.tsx
import { RigidBody } from '@react-three/rapier'

const HALF_W = 2
const HEIGHT = 5
const WALL_T = 0.06
const CHUTE_X = -1.5
const CHUTE_Z = -1.5
const CHUTE_R = 0.55

const NEON = '#ff2d7d'
const NEON_BRIGHT = '#ff5599'
const RAINBOW_COLORS = ['#ff2d7d', '#ff7a2d', '#ffd82d', '#8be62d', '#2dd6e6', '#7c6df0', '#e02de6']

export function Cabinet() {
  return (
    <>
      {/* ---------------- interior (physical) ---------------- */}
      <RigidBody type="fixed" colliders="cuboid" friction={0.5}>
        {/* floor — bright white glowing */}
        <mesh position={[0, 0, -HALF_W + (HALF_W - (CHUTE_Z + CHUTE_R)) / 2 - CHUTE_R]} receiveShadow>
          <boxGeometry args={[2 * HALF_W, WALL_T, HALF_W - (CHUTE_Z + CHUTE_R)]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[0, 0, (CHUTE_Z + CHUTE_R + HALF_W) / 2]} receiveShadow>
          <boxGeometry args={[2 * HALF_W, WALL_T, HALF_W - (CHUTE_Z + CHUTE_R)]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[(CHUTE_X + CHUTE_R + HALF_W) / 2, 0, CHUTE_Z]} receiveShadow>
          <boxGeometry args={[HALF_W - (CHUTE_X + CHUTE_R), WALL_T, 2 * CHUTE_R]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.35} />
        </mesh>

        {/* 4 clear glass walls */}
        <mesh position={[0, HEIGHT / 2, -HALF_W]}>
          <boxGeometry args={[2 * HALF_W, HEIGHT, WALL_T]} />
          <meshPhysicalMaterial color="#c8e4ff" transparent opacity={0.08} roughness={0.02} transmission={0.85} />
        </mesh>
        <mesh position={[0, HEIGHT / 2, HALF_W]}>
          <boxGeometry args={[2 * HALF_W, HEIGHT, WALL_T]} />
          <meshPhysicalMaterial color="#c8e4ff" transparent opacity={0.08} roughness={0.02} transmission={0.85} />
        </mesh>
        <mesh position={[-HALF_W, HEIGHT / 2, 0]}>
          <boxGeometry args={[WALL_T, HEIGHT, 2 * HALF_W]} />
          <meshPhysicalMaterial color="#c8e4ff" transparent opacity={0.08} roughness={0.02} transmission={0.85} />
        </mesh>
        <mesh position={[HALF_W, HEIGHT / 2, 0]}>
          <boxGeometry args={[WALL_T, HEIGHT, 2 * HALF_W]} />
          <meshPhysicalMaterial color="#c8e4ff" transparent opacity={0.08} roughness={0.02} transmission={0.85} />
        </mesh>
      </RigidBody>

      {/* ---------------- Holographic rainbow back wall (interior decoration) ---------------- */}
      <group position={[0, HEIGHT / 2, -HALF_W + 0.05]}>
        {RAINBOW_COLORS.map((c, i) => {
          const x = -HALF_W + 0.2 + ((2 * HALF_W - 0.4) / RAINBOW_COLORS.length) * (i + 0.5)
          return (
            <mesh key={i} position={[x, 0, 0]}>
              <planeGeometry args={[(2 * HALF_W - 0.4) / RAINBOW_COLORS.length * 0.85, HEIGHT * 0.9]} />
              <meshStandardMaterial
                color={c}
                emissive={c}
                emissiveIntensity={0.7}
                transparent
                opacity={0.35}
                toneMapped={false}
              />
            </mesh>
          )
        })}
      </group>

      {/* ---------------- Neon pink frame ---------------- */}
      {/* Top frame */}
      {[
        { p: [0, HEIGHT + 0.05, -HALF_W] as [number, number, number], s: [2 * HALF_W + 0.25, 0.14, 0.14] as [number, number, number] },
        { p: [0, HEIGHT + 0.05, HALF_W] as [number, number, number], s: [2 * HALF_W + 0.25, 0.14, 0.14] as [number, number, number] },
        { p: [-HALF_W, HEIGHT + 0.05, 0] as [number, number, number], s: [0.14, 0.14, 2 * HALF_W] as [number, number, number] },
        { p: [HALF_W, HEIGHT + 0.05, 0] as [number, number, number], s: [0.14, 0.14, 2 * HALF_W] as [number, number, number] },
      ].map((e, i) => (
        <mesh key={`top-${i}`} position={e.p}>
          <boxGeometry args={e.s} />
          <meshStandardMaterial color={NEON} emissive={NEON} emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
      ))}

      {/* Vertical corner strips */}
      {[
        [-HALF_W, HEIGHT / 2, -HALF_W],
        [HALF_W, HEIGHT / 2, -HALF_W],
        [-HALF_W, HEIGHT / 2, HALF_W],
        [HALF_W, HEIGHT / 2, HALF_W],
      ].map((p, i) => (
        <mesh key={`corner-${i}`} position={p as [number, number, number]}>
          <boxGeometry args={[0.14, HEIGHT, 0.14]} />
          <meshStandardMaterial color={NEON} emissive={NEON} emissiveIntensity={2.0} toneMapped={false} />
        </mesh>
      ))}

      {/* Bottom skirt around cabinet (below floor) */}
      {[
        { p: [0, -0.4, -HALF_W] as [number, number, number], s: [2 * HALF_W + 0.25, 0.8, 0.14] as [number, number, number] },
        { p: [0, -0.4, HALF_W] as [number, number, number], s: [2 * HALF_W + 0.25, 0.8, 0.14] as [number, number, number] },
      ].map((e, i) => (
        <mesh key={`skirt-${i}`} position={e.p}>
          <boxGeometry args={e.s} />
          <meshStandardMaterial color={NEON_BRIGHT} emissive={NEON} emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
      ))}

      {/* ---------------- Rainbow LED sign bar above cabinet ---------------- */}
      <group position={[0, HEIGHT + 0.85, 0]}>
        {/* black backing */}
        <mesh>
          <boxGeometry args={[2 * HALF_W + 0.7, 0.7, 0.25]} />
          <meshStandardMaterial color="#0a0a0e" />
        </mesh>
        {/* rainbow LED bars */}
        {RAINBOW_COLORS.map((c, i) => (
          <mesh
            key={i}
            position={[
              -HALF_W - 0.2 + ((2 * HALF_W + 0.4) / RAINBOW_COLORS.length) * (i + 0.5),
              0,
              0.13,
            ]}
          >
            <boxGeometry args={[(2 * HALF_W + 0.4) / RAINBOW_COLORS.length - 0.02, 0.56, 0.03]} />
            <meshStandardMaterial color={c} emissive={c} emissiveIntensity={3} toneMapped={false} />
          </mesh>
        ))}
        {/* top/bottom pink glow edges */}
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[2 * HALF_W + 0.8, 0.1, 0.3]} />
          <meshStandardMaterial color={NEON_BRIGHT} emissive={NEON_BRIGHT} emissiveIntensity={3} toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.4, 0]}>
          <boxGeometry args={[2 * HALF_W + 0.8, 0.1, 0.3]} />
          <meshStandardMaterial color={NEON_BRIGHT} emissive={NEON_BRIGHT} emissiveIntensity={3} toneMapped={false} />
        </mesh>
      </group>

      {/* ---------------- Bottom SPACE PLAYER control panel (2-player) — cosmetic, further back ---------------- */}
      <group visible={false} position={[0, -0.85, HALF_W + 0.35]}>
        {/* Main panel: pink slanted */}
        <mesh rotation={[-Math.PI / 6, 0, 0]}>
          <boxGeometry args={[2 * HALF_W + 0.35, 1.0, 0.1]} />
          <meshStandardMaterial color="#ff5578" roughness={0.4} />
        </mesh>
        {/* Black SPACE stripe */}
        <mesh position={[0, -0.35, 0.03]} rotation={[-Math.PI / 6, 0, 0]}>
          <boxGeometry args={[2 * HALF_W + 0.4, 0.22, 0.08]} />
          <meshStandardMaterial color="#0a0a0e" />
        </mesh>

        {/* --- Player 01 (left) --- */}
        {/* Joystick base */}
        <mesh position={[-1.35, 0.05, 0.4]} rotation={[-Math.PI / 6, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.06, 20]} />
          <meshStandardMaterial color="#1a1e28" />
        </mesh>
        {/* Joystick shaft */}
        <mesh position={[-1.35, 0.19, 0.44]} rotation={[-Math.PI / 6, 0, 0]}>
          <cylinderGeometry args={[0.024, 0.024, 0.22, 16]} />
          <meshStandardMaterial color="#4a90d8" emissive="#4a90d8" emissiveIntensity={0.4} />
        </mesh>
        {/* Joystick crystal ball */}
        <mesh position={[-1.35, 0.33, 0.5]}>
          <sphereGeometry args={[0.075, 20, 16]} />
          <meshPhysicalMaterial
            color="#ffffff"
            transmission={0.95}
            roughness={0.05}
            transparent
            opacity={0.9}
            emissive="#88bfff"
            emissiveIntensity={0.5}
            ior={1.4}
          />
        </mesh>
        {/* White button p1 */}
        <mesh position={[-0.55, 0.05, 0.4]} rotation={[-Math.PI / 6, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.05, 24]} />
          <meshStandardMaterial color="#f8f8f8" emissive="#ffffff" emissiveIntensity={0.4} />
        </mesh>
        {/* Yellow triangle marker p1 */}
        <mesh
          position={[-0.55, 0.05, 0.44]}
          rotation={[-Math.PI / 6, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.045, 0.045, 0.006, 3]} />
          <meshStandardMaterial color="#f6c700" emissive="#f6c700" emissiveIntensity={1.2} toneMapped={false} />
        </mesh>

        {/* --- Player 02 (right, mirrored) --- */}
        <mesh position={[1.35, 0.05, 0.4]} rotation={[-Math.PI / 6, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.06, 20]} />
          <meshStandardMaterial color="#1a1e28" />
        </mesh>
        <mesh position={[1.35, 0.19, 0.44]} rotation={[-Math.PI / 6, 0, 0]}>
          <cylinderGeometry args={[0.024, 0.024, 0.22, 16]} />
          <meshStandardMaterial color="#d84a4a" emissive="#d84a4a" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[1.35, 0.33, 0.5]}>
          <sphereGeometry args={[0.075, 20, 16]} />
          <meshPhysicalMaterial
            color="#ffe0e0"
            transmission={0.95}
            roughness={0.05}
            transparent
            opacity={0.9}
            emissive="#ff88a0"
            emissiveIntensity={0.5}
            ior={1.4}
          />
        </mesh>
        <mesh position={[0.55, 0.05, 0.4]} rotation={[-Math.PI / 6, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.05, 24]} />
          <meshStandardMaterial color="#f8f8f8" emissive="#ffffff" emissiveIntensity={0.4} />
        </mesh>
        <mesh
          position={[0.55, 0.05, 0.44]}
          rotation={[-Math.PI / 6, 0, -Math.PI / 2]}
        >
          <cylinderGeometry args={[0.045, 0.045, 0.006, 3]} />
          <meshStandardMaterial color="#f6c700" emissive="#f6c700" emissiveIntensity={1.2} toneMapped={false} />
        </mesh>
      </group>
    </>
  )
}

export const CABINET_BOUNDS = { HALF_W, HEIGHT, CHUTE_X, CHUTE_Z, CHUTE_R }
