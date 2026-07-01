// labs/claw-poc/src/components/Cabinet.tsx
import { RigidBody } from '@react-three/rapier'

const HALF_W = 2       // interior half-width (x, z)
const HEIGHT = 5       // top y
const WALL_T = 0.1     // wall thickness
const CHUTE_X = -1.5   // chute center x
const CHUTE_Z = -1.5   // chute center z
const CHUTE_R = 0.55   // chute half-size

// Floor is split into 4 rectangles surrounding the chute hole in the back-left corner.
export function Cabinet() {
  return (
    <RigidBody type="fixed" colliders="cuboid" friction={0.5}>
      {/* floor: 4 pieces around chute (back-left corner) */}
      {/* back strip (z < chute) */}
      <mesh position={[0, 0, -HALF_W + (HALF_W - (CHUTE_Z + CHUTE_R)) / 2 - CHUTE_R]} receiveShadow>
        <boxGeometry args={[2 * HALF_W, WALL_T, HALF_W - (CHUTE_Z + CHUTE_R)]} />
        <meshStandardMaterial color="#3a3f4b" />
      </mesh>
      {/* front strip (z > chute), spans full width */}
      <mesh position={[0, 0, (CHUTE_Z + CHUTE_R + HALF_W) / 2]} receiveShadow>
        <boxGeometry args={[2 * HALF_W, WALL_T, HALF_W - (CHUTE_Z + CHUTE_R)]} />
        <meshStandardMaterial color="#3a3f4b" />
      </mesh>
      {/* right of chute (x > chute) */}
      <mesh
        position={[
          (CHUTE_X + CHUTE_R + HALF_W) / 2,
          0,
          CHUTE_Z,
        ]}
        receiveShadow
      >
        <boxGeometry args={[HALF_W - (CHUTE_X + CHUTE_R), WALL_T, 2 * CHUTE_R]} />
        <meshStandardMaterial color="#3a3f4b" />
      </mesh>
      {/* (no piece to the left of chute — chute goes to the corner) */}

      {/* 4 walls (transparent-ish, but solid physics) */}
      <mesh position={[0, HEIGHT / 2, -HALF_W]}>
        <boxGeometry args={[2 * HALF_W, HEIGHT, WALL_T]} />
        <meshStandardMaterial color="#8fb2d6" transparent opacity={0.15} />
      </mesh>
      <mesh position={[0, HEIGHT / 2, HALF_W]}>
        <boxGeometry args={[2 * HALF_W, HEIGHT, WALL_T]} />
        <meshStandardMaterial color="#8fb2d6" transparent opacity={0.15} />
      </mesh>
      <mesh position={[-HALF_W, HEIGHT / 2, 0]}>
        <boxGeometry args={[WALL_T, HEIGHT, 2 * HALF_W]} />
        <meshStandardMaterial color="#8fb2d6" transparent opacity={0.15} />
      </mesh>
      <mesh position={[HALF_W, HEIGHT / 2, 0]}>
        <boxGeometry args={[WALL_T, HEIGHT, 2 * HALF_W]} />
        <meshStandardMaterial color="#8fb2d6" transparent opacity={0.15} />
      </mesh>
    </RigidBody>
  )
}

export const CABINET_BOUNDS = {
  HALF_W,
  HEIGHT,
  CHUTE_X,
  CHUTE_Z,
  CHUTE_R,
}
