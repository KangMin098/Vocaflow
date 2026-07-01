// labs/claw-poc/src/components/Plush.tsx
import { useEffect, useRef } from 'react'
import {
  RigidBody,
  BallCollider,
  type RapierRigidBody,
} from '@react-three/rapier'
import { registerPlush, unregisterPlush } from '../hooks/plushRegistry'

export type PlushKind = 'kitty' | 'cinnamo' | 'panda' | 'pochacco' | 'bee'

type Props = {
  position: [number, number, number]
  kind: PlushKind
  mass: number
  friction: number
  restitution: number
}

const PALETTE: Record<PlushKind, { body: string; accent: string; ear?: string }> = {
  kitty: { body: '#ffe9f0', accent: '#f4a5c0', ear: '#ffe9f0' },
  cinnamo: { body: '#f6f8ff', accent: '#8ec7ff' },
  panda: { body: '#f4f4f4', accent: '#1e1e1e', ear: '#1e1e1e' },
  pochacco: { body: '#ffffff', accent: '#2a2a2a', ear: '#2a2a2a' },
  bee: { body: '#f3d461', accent: '#3a2b12' },
}

const HEAD_R = 0.22

export function Plush({ position, kind, mass, friction, restitution }: Props) {
  const bodyRef = useRef<RapierRigidBody>(null)
  const c = PALETTE[kind]

  useEffect(() => {
    const b = bodyRef.current
    if (!b) return
    const id = registerPlush(b)
    return () => unregisterPlush(id)
  }, [])

  return (
    <RigidBody
      ref={bodyRef}
      position={position}
      colliders={false}
      friction={friction}
      restitution={restitution}
      linearDamping={0.5}
      angularDamping={0.8}
    >
      {/* physics: single ball approximates cuddly plush */}
      <BallCollider args={[HEAD_R]} mass={mass} />
      {/* body sphere */}
      <mesh castShadow>
        <sphereGeometry args={[HEAD_R, 24, 18]} />
        <meshStandardMaterial color={c.body} roughness={0.9} />
      </mesh>
      {/* two little ears */}
      {kind !== 'bee' && (
        <>
          <mesh position={[-0.1, 0.16, 0]} castShadow>
            <sphereGeometry args={[0.07, 16, 12]} />
            <meshStandardMaterial color={c.ear ?? c.body} roughness={0.9} />
          </mesh>
          <mesh position={[0.1, 0.16, 0]} castShadow>
            <sphereGeometry args={[0.07, 16, 12]} />
            <meshStandardMaterial color={c.ear ?? c.body} roughness={0.9} />
          </mesh>
        </>
      )}
      {/* eyes */}
      <mesh position={[-0.07, 0.02, 0.19]}>
        <sphereGeometry args={[0.022, 10, 8]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.07, 0.02, 0.19]}>
        <sphereGeometry args={[0.022, 10, 8]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* bee stripes */}
      {kind === 'bee' && (
        <>
          <mesh position={[0, 0, 0]}>
            <torusGeometry args={[HEAD_R * 0.98, 0.025, 8, 24]} />
            <meshStandardMaterial color={c.accent} />
          </mesh>
        </>
      )}
      {/* accent bow (kitty) */}
      {kind === 'kitty' && (
        <mesh position={[0.12, 0.18, 0.05]}>
          <sphereGeometry args={[0.05, 12, 8]} />
          <meshStandardMaterial color={c.accent} />
        </mesh>
      )}
      {/* keychain tag hanging from top */}
      <mesh position={[0, HEAD_R + 0.05, 0]}>
        <boxGeometry args={[0.03, 0.05, 0.005]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
      {/* underused suppress warning */}
      <mesh visible={false}>
        <boxGeometry args={[0.001, 0.001, 0.001]} />
        <meshStandardMaterial color={c.accent} />
      </mesh>
    </RigidBody>
  )
}
