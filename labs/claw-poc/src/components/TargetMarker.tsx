// labs/claw-poc/src/components/TargetMarker.tsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSequenceStore } from '../hooks/useSequence'

export function TargetMarker() {
  const ref = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const { targetX, targetZ, state } = useSequenceStore.getState()
    if (!ref.current) return
    ref.current.position.set(targetX, 0.07, targetZ)
    const active = state === 'idle'
    ref.current.visible = active
    if (inner.current) {
      const t = clock.getElapsedTime()
      const scale = 1 + 0.15 * Math.sin(t * 4)
      inner.current.scale.set(scale, 1, scale)
    }
  })

  return (
    <group ref={ref}>
      {/* outer ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.34, 32]} />
        <meshStandardMaterial
          color="#f6c700"
          emissive="#f6c700"
          emissiveIntensity={2.5}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {/* pulsing inner ring */}
      <mesh ref={inner} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.14, 0.2, 24]} />
        <meshStandardMaterial
          color="#ff2d7d"
          emissive="#ff2d7d"
          emissiveIntensity={2.5}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {/* cross-hair lines */}
      <mesh position={[0, 0.01, 0]}>
        <boxGeometry args={[0.6, 0.005, 0.02]} />
        <meshStandardMaterial color="#f6c700" emissive="#f6c700" emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.01, 0]}>
        <boxGeometry args={[0.02, 0.005, 0.6]} />
        <meshStandardMaterial color="#f6c700" emissive="#f6c700" emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
    </group>
  )
}
