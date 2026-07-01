// labs/claw-poc/src/components/Scene.tsx
import { Physics } from '@react-three/rapier'
import { useControls, folder } from 'leva'
import { Cabinet } from './Cabinet'
import { Plush, type PlushKind } from './Plush'
import { Claw } from './Claw'

type Spawn = { pos: [number, number, number]; kind: PlushKind }

const PLUSH_SPAWN: Spawn[] = [
  { pos: [-0.6, 0.8, 0.2], kind: 'kitty' },
  { pos: [0.4, 0.9, -0.5], kind: 'cinnamo' },
  { pos: [-0.2, 0.85, -0.7], kind: 'panda' },
  { pos: [0.8, 0.8, 0.5], kind: 'pochacco' },
  { pos: [0.0, 0.9, 0.9], kind: 'bee' },
  { pos: [-0.9, 0.85, -0.1], kind: 'kitty' },
  { pos: [0.6, 0.8, -0.9], kind: 'cinnamo' },
  { pos: [0.2, 0.85, 0.4], kind: 'panda' },
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
