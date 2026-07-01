// labs/claw-poc/src/components/Scene.tsx
import { Physics } from '@react-three/rapier'
import { useControls, folder } from 'leva'
import { Cabinet } from './Cabinet'
import { Plush, type PlushKind } from './Plush'
import { Claw } from './Claw'
import { TargetMarker } from './TargetMarker'

type Spawn = { pos: [number, number, number]; kind: PlushKind }

// spawn plushies with slight offset so they settle into a pile
const PLUSH_SPAWN: Spawn[] = [
  { pos: [-0.9, 0.9, 0.4],  kind: 'kitty' },
  { pos: [-0.3, 1.0, 0.1],  kind: 'cinnamo' },
  { pos: [0.3, 0.9, -0.2],  kind: 'panda' },
  { pos: [0.9, 1.0, 0.5],   kind: 'pochacco' },
  { pos: [-0.1, 0.9, 0.8],  kind: 'bee' },
  { pos: [-1.1, 0.9, -0.3], kind: 'mymelody' },
  { pos: [0.5, 1.0, 0.9],   kind: 'brownbear' },
  { pos: [-0.5, 0.9, -0.4], kind: 'snorlax' },
  { pos: [0.1, 1.1, 0.4],   kind: 'kitty' },
  { pos: [1.0, 0.9, -0.4],  kind: 'brownbear' },
  { pos: [-0.4, 1.1, 0.9],  kind: 'panda' },
  { pos: [0.7, 1.0, 0.1],   kind: 'mymelody' },
]

export function Scene() {
  const cfg = useControls({
    World: folder({
      gravity: { value: -9.81, min: -20, max: -1, step: 0.1 },
      debug: false,
    }),
    Plush: folder({
      plushMass: { value: 0.35, min: 0.05, max: 2, step: 0.05 },
      plushFriction: { value: 1.4, min: 0, max: 4, step: 0.1 },
      plushRestitution: { value: 0.05, min: 0, max: 1, step: 0.05 },
    }),
  })

  return (
    <Physics gravity={[0, cfg.gravity, 0]} debug={cfg.debug}>
      <Cabinet />
      <TargetMarker />
      {PLUSH_SPAWN.map((s, i) => (
        <Plush
          key={i}
          position={s.pos}
          kind={s.kind}
          mass={cfg.plushMass}
          friction={cfg.plushFriction}
          restitution={cfg.plushRestitution}
        />
      ))}
      <Claw />
    </Physics>
  )
}
