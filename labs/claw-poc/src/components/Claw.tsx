// labs/claw-poc/src/components/Claw.tsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  RigidBody,
  CuboidCollider,
  CapsuleCollider,
  type RapierRigidBody,
} from '@react-three/rapier'
import * as THREE from 'three'
import {
  useSequenceStore,
  CHUTE_TARGET,
  HOME,
  HOME_Y,
  DESCEND_Y,
  type SeqState,
} from '../hooks/useSequence'
import { findNearestPlush } from '../hooks/plushRegistry'

const OPEN_ANGLE = Math.PI / 4        // 45° outward
const CLOSED_ANGLE = -Math.PI / 15    // ~12° inward (prong tips converge under ball)
const BODY_HALF = { x: 0.3, y: 0.14, z: 0.3 }
const ANCHOR_R = 0.24                 // radius of prong anchor circle
const PRONG_LEN = 0.6
const PRONG_R = 0.03
const N_PRONGS = 3
const GRIP_RADIUS = 1.2               // XZ radius to search for plush at grip (generous)
const GRIP_OFFSET_Y = 0.5             // plush hangs this far below claw body

const _v = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _axis = new THREE.Vector3()

function targetOpenForState(state: SeqState): number {
  switch (state) {
    case 'idle':
    case 'moveToTarget':
    case 'descend':
    case 'release':
    case 'returnHome':
      return 1
    case 'grip':
    case 'lift':
    case 'moveToChute':
      return 0
  }
}

export function Claw() {
  const bodyRef = useRef<RapierRigidBody>(null)
  const prongRefs = useRef<(RapierRigidBody | null)[]>([])
  const lastState = useRef<SeqState>('idle')
  const phaseStart = useRef(performance.now() / 1000)
  const openAmount = useRef(1)
  const grabbedBody = useRef<RapierRigidBody | null>(null)

  useFrame((_, delta) => {
    const body = bodyRef.current
    if (!body) return

    const { state, targetX, targetZ } = useSequenceStore.getState()

    // ---- claw body target position by state ----
    let desiredX = HOME.x
    let desiredZ = HOME.z
    let desiredY = HOME_Y
    switch (state) {
      case 'moveToTarget':
        desiredX = targetX
        desiredZ = targetZ
        break
      case 'descend':
      case 'grip':
        desiredX = targetX
        desiredZ = targetZ
        desiredY = DESCEND_Y
        break
      case 'lift':
        desiredX = targetX
        desiredZ = targetZ
        break
      case 'moveToChute':
      case 'release':
        desiredX = CHUTE_TARGET.x
        desiredZ = CHUTE_TARGET.z
        break
      case 'returnHome':
      case 'idle':
        break
    }

    const cur = body.translation()
    const smooth = 5
    const nx = THREE.MathUtils.damp(cur.x, desiredX, smooth, delta)
    const ny = THREE.MathUtils.damp(cur.y, desiredY, smooth * 0.7, delta)
    const nz = THREE.MathUtils.damp(cur.z, desiredZ, smooth, delta)
    body.setNextKinematicTranslation({ x: nx, y: ny, z: nz })

    // ---- prong open/close angle ----
    const openTarget = targetOpenForState(state)
    openAmount.current = THREE.MathUtils.damp(openAmount.current, openTarget, 5, delta)
    const alpha = OPEN_ANGLE * openAmount.current + CLOSED_ANGLE * (1 - openAmount.current)

    for (let i = 0; i < N_PRONGS; i++) {
      const prong = prongRefs.current[i]
      if (!prong) continue
      const theta = (i * 2 * Math.PI) / N_PRONGS
      const ax = nx + ANCHOR_R * Math.cos(theta)
      const ay = ny - BODY_HALF.y
      const az = nz + ANCHOR_R * Math.sin(theta)
      _axis.set(-Math.sin(theta), 0, Math.cos(theta))
      _q.setFromAxisAngle(_axis, alpha)
      _v.set(0, -PRONG_LEN / 2, 0).applyQuaternion(_q)
      prong.setNextKinematicTranslation({
        x: ax + _v.x,
        y: ay + _v.y,
        z: az + _v.z,
      })
      prong.setNextKinematicRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w })
    }

    // ---- grip / release transitions ----
    const stateChanged = state !== lastState.current

    if (stateChanged && state === 'grip') {
      const searchPos = { x: nx, y: DESCEND_Y - GRIP_OFFSET_Y, z: nz }
      const plush = findNearestPlush(searchPos, GRIP_RADIUS)
      if (plush) {
        grabbedBody.current = plush.body
        grabbedBody.current.setGravityScale(0, true)
      }
    }
    if (stateChanged && state === 'release') {
      if (grabbedBody.current) {
        grabbedBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
        grabbedBody.current.setAngvel({ x: 0, y: 0, z: 0 }, true)
        grabbedBody.current.setGravityScale(1, true)
        grabbedBody.current = null
      }
    }

    // Teleport gripped plush to hang beneath claw (gravity is 0 while gripped)
    if (grabbedBody.current) {
      grabbedBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
      grabbedBody.current.setAngvel({ x: 0, y: 0, z: 0 }, true)
      grabbedBody.current.setTranslation(
        { x: nx, y: ny - GRIP_OFFSET_Y, z: nz },
        true,
      )
    }

    // ---- FSM transitions ----
    const dxz = Math.hypot(nx - desiredX, nz - desiredZ)
    const dy = Math.abs(ny - desiredY)
    const reachedXZ = dxz < 0.08
    const reachedY = dy < 0.08
    const now = performance.now() / 1000
    const elapsed = now - phaseStart.current
    const advance = (to: SeqState) => {
      phaseStart.current = now
      useSequenceStore.getState().setState(to)
    }
    if (state === 'moveToTarget' && reachedXZ) advance('descend')
    else if (state === 'descend' && reachedY && elapsed > 0.3) advance('grip')
    else if (state === 'grip' && elapsed > 1.0) advance('lift')
    else if (state === 'lift' && reachedY && elapsed > 0.4) advance('moveToChute')
    else if (state === 'moveToChute' && reachedXZ && elapsed > 0.4) advance('release')
    else if (state === 'release' && elapsed > 1.0) advance('returnHome')
    else if (state === 'returnHome' && reachedXZ) advance('idle')

    lastState.current = state
  })

  return (
    <>
      {/* Body — chrome cylinder */}
      <RigidBody
        ref={bodyRef}
        type="kinematicPosition"
        position={[HOME.x, HOME_Y, HOME.z]}
        colliders={false}
      >
        <CuboidCollider args={[BODY_HALF.x, BODY_HALF.y, BODY_HALF.z]} />
        <mesh castShadow>
          <cylinderGeometry args={[BODY_HALF.x, BODY_HALF.x, BODY_HALF.y * 2, 24]} />
          <meshStandardMaterial color="#e2e6ec" metalness={0.9} roughness={0.15} />
        </mesh>
        {/* Pink duck-logo top disc */}
        <mesh position={[0, BODY_HALF.y + 0.09, 0]} castShadow>
          <cylinderGeometry args={[BODY_HALF.x + 0.02, BODY_HALF.x + 0.02, 0.18, 24]} />
          <meshStandardMaterial color="#f8bfd6" roughness={0.5} />
        </mesh>
        {/* Yellow duck-face circle on top */}
        <mesh position={[0, BODY_HALF.y + 0.19, 0]}>
          <cylinderGeometry args={[BODY_HALF.x * 0.7, BODY_HALF.x * 0.7, 0.005, 24]} />
          <meshStandardMaterial color="#ffeb99" emissive="#ffcf40" emissiveIntensity={0.3} />
        </mesh>
        {/* black corrugated cable up to ceiling */}
        <mesh position={[0, 3, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 6, 8]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
        </mesh>
      </RigidBody>

      {/* 3 prongs */}
      {Array.from({ length: N_PRONGS }).map((_, i) => (
        <RigidBody
          key={i}
          ref={(el) => {
            prongRefs.current[i] = el
          }}
          type="kinematicPosition"
          position={[HOME.x, HOME_Y - BODY_HALF.y - PRONG_LEN / 2, HOME.z]}
          colliders={false}
          friction={2.5}
        >
          <CapsuleCollider args={[PRONG_LEN / 2 - PRONG_R, PRONG_R]} />
          {/* main shaft */}
          <mesh castShadow>
            <capsuleGeometry args={[PRONG_R, PRONG_LEN - 2 * PRONG_R, 8, 16]} />
            <meshStandardMaterial color="#cfd3dc" metalness={0.85} roughness={0.2} />
          </mesh>
          {/* curved hook at tip — small angled capsule pointing inward */}
          <mesh
            position={[0, -PRONG_LEN / 2 + 0.05, 0.05]}
            rotation={[Math.PI / 5, 0, 0]}
            castShadow
          >
            <capsuleGeometry args={[PRONG_R * 0.9, 0.1, 8, 12]} />
            <meshStandardMaterial color="#cfd3dc" metalness={0.85} roughness={0.2} />
          </mesh>
        </RigidBody>
      ))}
    </>
  )
}
