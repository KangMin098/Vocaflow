// labs/claw-poc/src/components/Plush.tsx
import { RigidBody, BallCollider } from '@react-three/rapier'

type Props = {
  position: [number, number, number]
  mass: number
  friction: number
  restitution: number
}

const RADIUS = 0.22

export function Plush({ position, mass, friction, restitution }: Props) {
  // color varies per position hash for visual distinction
  const hue = Math.abs(Math.round((position[0] + position[2]) * 40)) % 360

  return (
    <RigidBody
      position={position}
      colliders={false}
      friction={friction}
      restitution={restitution}
      linearDamping={0.4}
      angularDamping={0.6}
    >
      <BallCollider args={[RADIUS]} mass={mass} />
      <mesh castShadow>
        <sphereGeometry args={[RADIUS, 24, 16]} />
        <meshStandardMaterial color={`hsl(${hue}, 60%, 65%)`} roughness={0.85} />
      </mesh>
    </RigidBody>
  )
}
