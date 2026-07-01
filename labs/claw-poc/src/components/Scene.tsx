// labs/claw-poc/src/components/Scene.tsx
import { Physics } from '@react-three/rapier'
import { useControls, folder } from 'leva'
import { Cabinet } from './Cabinet'
import { Plush } from './Plush'
import { Claw } from './Claw'

const PLUSH_SPAWN: [number, number, number][] = [
  [-0.6, 0.8, 0.2],
  [0.4, 0.9, -0.5],
  [-0.2, 0.85, -0.7],
  [0.8, 0.8, 0.5],
  [0.0, 0.9, 0.9],
  [-0.9, 0.85, -0.1],
  [0.6, 0.8, -0.9],
]

export function Scene() {
  const world = useControls({
    World: folder({
      gravity: { value: -9.81, min: -20, max: -1, step: 0.1 },
      debug: false,
    }),
    Plush: folder({
      plushMass: { value: 0.35, min: 0.05, max: 2, step: 0.05 },
      plushFriction: { value: 1.4, min: 0, max: 4, step: 0.1 },
      plushRestitution: { value: 0.05, min: 0, max: 1, step: 0.05 },
    }),
    Grip: folder({
      gripStiffness: { value: 30, min: 1, max: 200, step: 1 },
      gripDamping: { value: 4, min: 0, max: 30, step: 0.5 },
      prongFriction: { value: 2.5, min: 0, max: 5, step: 0.1 },
    }),
  })

  return (
    <Physics gravity={[0, world.gravity, 0]} debug={world.debug}>
      <Cabinet />
      {PLUSH_SPAWN.map((pos, i) => (
        <Plush
          key={i}
          position={pos}
          mass={world.plushMass}
          friction={world.plushFriction}
          restitution={world.plushRestitution}
        />
      ))}
      <Claw
        gripStiffness={world.gripStiffness}
        gripDamping={world.gripDamping}
        prongFriction={world.prongFriction}
      />
    </Physics>
  )
}
