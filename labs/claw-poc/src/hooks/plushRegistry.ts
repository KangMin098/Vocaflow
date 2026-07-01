// labs/claw-poc/src/hooks/plushRegistry.ts
import type { RapierRigidBody } from '@react-three/rapier'

type Entry = {
  id: number
  body: RapierRigidBody
}

const entries = new Map<number, Entry>()
let nextId = 1

export function registerPlush(body: RapierRigidBody): number {
  const id = nextId++
  entries.set(id, { id, body })
  return id
}

export function unregisterPlush(id: number) {
  entries.delete(id)
}

export function forEachPlush(fn: (e: Entry) => void) {
  entries.forEach(fn)
}

export function findNearestPlush(
  worldPos: { x: number; y: number; z: number },
  radius: number,
): Entry | null {
  let best: Entry | null = null
  let bestDist = radius
  entries.forEach((e) => {
    const t = e.body.translation()
    const dx = t.x - worldPos.x
    const dy = t.y - worldPos.y
    const dz = t.z - worldPos.z
    const d = Math.hypot(dx, dy, dz)
    if (d < bestDist) {
      bestDist = d
      best = e
    }
  })
  return best
}
