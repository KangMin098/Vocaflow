// labs/claw-poc/src/components/Plush.tsx
import { useEffect, useRef } from 'react'
import {
  RigidBody,
  BallCollider,
  type RapierRigidBody,
} from '@react-three/rapier'
import { registerPlush, unregisterPlush } from '../hooks/plushRegistry'

export type PlushKind = 'kitty' | 'cinnamo' | 'panda' | 'pochacco' | 'bee' | 'mymelody' | 'brownbear' | 'snorlax'

type Props = {
  position: [number, number, number]
  kind: PlushKind
  mass: number
  friction: number
  restitution: number
}

type Style = {
  body: string
  accent: string
  ear?: string
  hasEars?: boolean
  hasHat?: string
  extraRing?: string
}

const STYLES: Record<PlushKind, Style> = {
  kitty:      { body: '#fff2f6', accent: '#ff6b8e', hasEars: true, ear: '#fff2f6' },
  mymelody:   { body: '#ffd0e0', accent: '#ff4d90', hasEars: true, ear: '#ffe4ec', hasHat: '#ff9ec5' },
  cinnamo:    { body: '#f6faff', accent: '#5fb4ff', hasEars: true, ear: '#f6faff' },
  panda:      { body: '#f4f4f4', accent: '#1e1e1e', hasEars: true, ear: '#1e1e1e' },
  pochacco:   { body: '#ffffff', accent: '#2a2a2a', hasEars: true, ear: '#2a2a2a' },
  bee:        { body: '#f7d24a', accent: '#3a2b12', extraRing: '#3a2b12' },
  brownbear:  { body: '#c99a6a', accent: '#7a5a3a', hasEars: true, ear: '#a67f52' },
  snorlax:    { body: '#4a9bcc', accent: '#e8eef4', hasEars: false },
}

const HEAD_R = 0.22

export function Plush({ position, kind, mass, friction, restitution }: Props) {
  const bodyRef = useRef<RapierRigidBody>(null)
  const s = STYLES[kind]

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
      <BallCollider args={[HEAD_R]} mass={mass} />

      {/* body */}
      <mesh castShadow>
        <sphereGeometry args={[HEAD_R, 24, 18]} />
        <meshStandardMaterial color={s.body} roughness={0.9} />
      </mesh>

      {/* belly patch (snorlax/panda) */}
      {(kind === 'snorlax' || kind === 'panda') && (
        <mesh position={[0, -0.03, 0.2]}>
          <sphereGeometry args={[0.16, 16, 12]} />
          <meshStandardMaterial color={s.accent} roughness={0.9} />
        </mesh>
      )}

      {/* ears */}
      {s.hasEars && (
        <>
          <mesh position={[-0.1, 0.17, 0]} castShadow>
            <sphereGeometry args={[0.075, 16, 12]} />
            <meshStandardMaterial color={s.ear ?? s.body} roughness={0.9} />
          </mesh>
          <mesh position={[0.1, 0.17, 0]} castShadow>
            <sphereGeometry args={[0.075, 16, 12]} />
            <meshStandardMaterial color={s.ear ?? s.body} roughness={0.9} />
          </mesh>
        </>
      )}

      {/* MyMelody hat */}
      {s.hasHat && (
        <mesh position={[0, 0.16, 0]}>
          <sphereGeometry args={[0.19, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={s.hasHat} roughness={0.85} />
        </mesh>
      )}

      {/* eyes */}
      <mesh position={[-0.075, 0.02, 0.185]}>
        <sphereGeometry args={[0.024, 12, 10]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
      <mesh position={[0.075, 0.02, 0.185]}>
        <sphereGeometry args={[0.024, 12, 10]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>

      {/* nose/mouth */}
      <mesh position={[0, -0.03, 0.21]}>
        <sphereGeometry args={[0.014, 10, 8]} />
        <meshStandardMaterial color={kind === 'kitty' ? '#ffb84d' : '#0a0a0a'} />
      </mesh>

      {/* Kitty bow (right ear) */}
      {kind === 'kitty' && (
        <mesh position={[0.12, 0.19, 0.05]}>
          <sphereGeometry args={[0.06, 12, 10]} />
          <meshStandardMaterial color={s.accent} />
        </mesh>
      )}

      {/* Cinnamoroll long floppy ear */}
      {kind === 'cinnamo' && (
        <mesh position={[-0.15, 0.02, 0]} rotation={[0, 0, 0.5]}>
          <capsuleGeometry args={[0.05, 0.15, 8, 12]} />
          <meshStandardMaterial color={s.body} roughness={0.9} />
        </mesh>
      )}

      {/* Bee stripes */}
      {kind === 'bee' && s.extraRing && (
        <>
          <mesh position={[0, 0, 0]}>
            <torusGeometry args={[HEAD_R * 0.98, 0.028, 8, 24]} />
            <meshStandardMaterial color={s.extraRing} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <torusGeometry args={[HEAD_R * 0.85, 0.02, 8, 24]} />
            <meshStandardMaterial color={s.extraRing} />
          </mesh>
        </>
      )}

      {/* Keychain tag on top */}
      <group position={[0, HEAD_R + 0.06, 0]}>
        <mesh>
          <torusGeometry args={[0.02, 0.005, 6, 12]} />
          <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, -0.04, 0]}>
          <boxGeometry args={[0.04, 0.055, 0.005]} />
          <meshStandardMaterial color="#fff" />
        </mesh>
      </group>
    </RigidBody>
  )
}
