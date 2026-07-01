// labs/claw-poc/src/components/Cabinet.tsx
import { RigidBody } from '@react-three/rapier'

const HALF_W = 2
const HEIGHT = 5
const WALL_T = 0.06
const CHUTE_X = -1.5
const CHUTE_Z = -1.5
const CHUTE_R = 0.55

// pastel palette
const CANDY_PINK = '#ffb0d0'
const CANDY_PINK_DEEP = '#ff8ec3'
const MINT = '#b8f0d8'
const CREAM = '#fff5e6'
const LAVENDER = '#dcc8ff'

const RAINBOW_COLORS = ['#ffb5d5', '#ffcfb0', '#ffefa0', '#c5eebf', '#a5e0ea', '#c4bfff', '#e5b0f0']

export function Cabinet() {
  return (
    <>
      {/* ---------------- interior (physical) ---------------- */}
      <RigidBody type="fixed" colliders="cuboid" friction={0.5}>
        {/* floor — bright cream */}
        <mesh position={[0, 0, -HALF_W + (HALF_W - (CHUTE_Z + CHUTE_R)) / 2 - CHUTE_R]} receiveShadow>
          <boxGeometry args={[2 * HALF_W, WALL_T, HALF_W - (CHUTE_Z + CHUTE_R)]} />
          <meshStandardMaterial color={CREAM} emissive={CREAM} emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[0, 0, (CHUTE_Z + CHUTE_R + HALF_W) / 2]} receiveShadow>
          <boxGeometry args={[2 * HALF_W, WALL_T, HALF_W - (CHUTE_Z + CHUTE_R)]} />
          <meshStandardMaterial color={CREAM} emissive={CREAM} emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[(CHUTE_X + CHUTE_R + HALF_W) / 2, 0, CHUTE_Z]} receiveShadow>
          <boxGeometry args={[HALF_W - (CHUTE_X + CHUTE_R), WALL_T, 2 * CHUTE_R]} />
          <meshStandardMaterial color={CREAM} emissive={CREAM} emissiveIntensity={0.6} />
        </mesh>

        {/* 4 clear glass walls */}
        <mesh position={[0, HEIGHT / 2, -HALF_W]}>
          <boxGeometry args={[2 * HALF_W, HEIGHT, WALL_T]} />
          <meshPhysicalMaterial color="#e0f0ff" transparent opacity={0.07} roughness={0.02} transmission={0.9} />
        </mesh>
        <mesh position={[0, HEIGHT / 2, HALF_W]}>
          <boxGeometry args={[2 * HALF_W, HEIGHT, WALL_T]} />
          <meshPhysicalMaterial color="#e0f0ff" transparent opacity={0.07} roughness={0.02} transmission={0.9} />
        </mesh>
        <mesh position={[-HALF_W, HEIGHT / 2, 0]}>
          <boxGeometry args={[WALL_T, HEIGHT, 2 * HALF_W]} />
          <meshPhysicalMaterial color="#e0f0ff" transparent opacity={0.07} roughness={0.02} transmission={0.9} />
        </mesh>
        <mesh position={[HALF_W, HEIGHT / 2, 0]}>
          <boxGeometry args={[WALL_T, HEIGHT, 2 * HALF_W]} />
          <meshPhysicalMaterial color="#e0f0ff" transparent opacity={0.07} roughness={0.02} transmission={0.9} />
        </mesh>
      </RigidBody>

      {/* ---------------- Holographic rainbow back interior ---------------- */}
      {/* solid cream back panel behind rainbow so the shimmer stands out */}
      <mesh position={[0, HEIGHT / 2, -HALF_W + 0.02]}>
        <planeGeometry args={[2 * HALF_W - 0.05, HEIGHT - 0.05]} />
        <meshStandardMaterial color={CREAM} emissive={CREAM} emissiveIntensity={1.2} />
      </mesh>
      {/* rainbow shimmer overlay */}
      <group position={[0, HEIGHT / 2, -HALF_W + 0.08]}>
        {RAINBOW_COLORS.map((c, i) => {
          const x = -HALF_W + 0.15 + ((2 * HALF_W - 0.3) / RAINBOW_COLORS.length) * (i + 0.5)
          return (
            <mesh key={i} position={[x, 0, 0]}>
              <planeGeometry args={[(2 * HALF_W - 0.3) / RAINBOW_COLORS.length * 0.95, HEIGHT - 0.1]} />
              <meshStandardMaterial
                color={c}
                emissive={c}
                emissiveIntensity={1.4}
                transparent
                opacity={0.55}
                toneMapped={false}
              />
            </mesh>
          )
        })}
      </group>

      {/* Star sprinkles on the back wall (cute) */}
      {[
        [-1.4, 3.8], [-0.7, 4.2], [0.4, 4.0], [1.3, 3.6],
        [-1.2, 2.5], [0.8, 2.8], [1.5, 3.0],
      ].map(([x, y], i) => (
        <mesh key={`star-${i}`} position={[x, y, -HALF_W + 0.12]}>
          <cylinderGeometry args={[0.07, 0.07, 0.005, 5]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2} toneMapped={false} />
        </mesh>
      ))}

      {/* ---------------- Pastel candy pink neon frame ---------------- */}
      {/* Top frame */}
      {[
        { p: [0, HEIGHT + 0.05, -HALF_W] as [number, number, number], s: [2 * HALF_W + 0.3, 0.16, 0.16] as [number, number, number] },
        { p: [0, HEIGHT + 0.05, HALF_W] as [number, number, number], s: [2 * HALF_W + 0.3, 0.16, 0.16] as [number, number, number] },
        { p: [-HALF_W, HEIGHT + 0.05, 0] as [number, number, number], s: [0.16, 0.16, 2 * HALF_W] as [number, number, number] },
        { p: [HALF_W, HEIGHT + 0.05, 0] as [number, number, number], s: [0.16, 0.16, 2 * HALF_W] as [number, number, number] },
      ].map((e, i) => (
        <mesh key={`top-${i}`} position={e.p}>
          <boxGeometry args={e.s} />
          <meshStandardMaterial color={CANDY_PINK_DEEP} emissive={CANDY_PINK_DEEP} emissiveIntensity={1.4} toneMapped={false} />
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
          <boxGeometry args={[0.16, HEIGHT, 0.16]} />
          <meshStandardMaterial color={CANDY_PINK_DEEP} emissive={CANDY_PINK_DEEP} emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      ))}

      {/* Cream cabinet body — solid white/cream skirt around */}
      <mesh position={[0, -0.5, -HALF_W]}>
        <boxGeometry args={[2 * HALF_W + 0.3, 1.0, 0.15]} />
        <meshStandardMaterial color={CREAM} emissive={CREAM} emissiveIntensity={0.3} />
      </mesh>
      {/* Bottom candy pink skirt front */}
      <mesh position={[0, -0.5, HALF_W]}>
        <boxGeometry args={[2 * HALF_W + 0.3, 1.0, 0.15]} />
        <meshStandardMaterial color={CANDY_PINK} emissive={CANDY_PINK} emissiveIntensity={0.5} />
      </mesh>
      {[-HALF_W, HALF_W].map((x, i) => (
        <mesh key={`side-skirt-${i}`} position={[x, -0.5, 0]}>
          <boxGeometry args={[0.15, 1.0, 2 * HALF_W]} />
          <meshStandardMaterial color={CANDY_PINK} emissive={CANDY_PINK} emissiveIntensity={0.4} />
        </mesh>
      ))}

      {/* ---------------- Rainbow LED sign bar above cabinet ---------------- */}
      <group position={[0, HEIGHT + 0.95, 0]}>
        {/* white/cream backing (kawaii, not black) */}
        <mesh>
          <boxGeometry args={[2 * HALF_W + 0.8, 0.75, 0.2]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
        </mesh>
        {/* rainbow LED bars */}
        {RAINBOW_COLORS.map((c, i) => (
          <mesh
            key={i}
            position={[
              -HALF_W - 0.25 + ((2 * HALF_W + 0.5) / RAINBOW_COLORS.length) * (i + 0.5),
              0,
              0.11,
            ]}
          >
            <boxGeometry args={[(2 * HALF_W + 0.5) / RAINBOW_COLORS.length - 0.03, 0.6, 0.025]} />
            <meshStandardMaterial color={c} emissive={c} emissiveIntensity={2.4} toneMapped={false} />
          </mesh>
        ))}
        {/* candy pink glow edges */}
        <mesh position={[0, 0.42, 0]}>
          <boxGeometry args={[2 * HALF_W + 0.9, 0.1, 0.24]} />
          <meshStandardMaterial color={CANDY_PINK_DEEP} emissive={CANDY_PINK_DEEP} emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.42, 0]}>
          <boxGeometry args={[2 * HALF_W + 0.9, 0.1, 0.24]} />
          <meshStandardMaterial color={CANDY_PINK_DEEP} emissive={CANDY_PINK_DEEP} emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
      </group>

      {/* Cute ornaments — hearts hovering above sign */}
      <mesh position={[-2.2, HEIGHT + 1.4, 0]}>
        <sphereGeometry args={[0.09, 12, 10]} />
        <meshStandardMaterial color={CANDY_PINK_DEEP} emissive={CANDY_PINK_DEEP} emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      <mesh position={[2.2, HEIGHT + 1.4, 0]}>
        <sphereGeometry args={[0.09, 12, 10]} />
        <meshStandardMaterial color={LAVENDER} emissive={LAVENDER} emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      <mesh position={[0, HEIGHT + 1.55, 0]}>
        <sphereGeometry args={[0.11, 12, 10]} />
        <meshStandardMaterial color={MINT} emissive={MINT} emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
    </>
  )
}

export const CABINET_BOUNDS = { HALF_W, HEIGHT, CHUTE_X, CHUTE_Z, CHUTE_R }
