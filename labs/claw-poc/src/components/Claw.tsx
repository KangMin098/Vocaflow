// labs/claw-poc/src/components/Claw.tsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  RigidBody,
  CuboidCollider,
  CapsuleCollider,
  useRevoluteJoint,
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

type Props = {
  gripStiffness: number
  gripDamping: number
  prongFriction: number
}

const OPEN_ANGLE = Math.PI / 5   // ~36°
const CLOSED_ANGLE = 0

const BODY_HALF = { x: 0.35, y: 0.15, z: 0.35 }
const PRONG_HALF_HEIGHT = 0.35
const PRONG_RADIUS = 0.05
const ANCHOR_X = 0.15
const ANCHOR_Y_ON_BODY = -BODY_HALF.y
const ANCHOR_Y_ON_PRONG = PRONG_HALF_HEIGHT

let phaseTimer = 0

export function Claw({ gripStiffness, gripDamping, prongFriction }: Props) {
  const bodyRef = useRef<RapierRigidBody>(null)
  const leftRef = useRef<RapierRigidBody>(null)
  const rightRef = useRef<RapierRigidBody>(null)

  const leftJoint = useRevoluteJoint(bodyRef, leftRef, [
    [-ANCHOR_X, ANCHOR_Y_ON_BODY, 0],
    [0, ANCHOR_Y_ON_PRONG, 0],
    [0, 0, 1],
  ])
  const rightJoint = useRevoluteJoint(bodyRef, rightRef, [
    [ANCHOR_X, ANCHOR_Y_ON_BODY, 0],
    [0, ANCHOR_Y_ON_PRONG, 0],
    [0, 0, 1],
  ])

  useFrame((_, delta) => {
    const body = bodyRef.current
    if (!body) return

    const { state, targetX, targetZ } = useSequenceStore.getState()

    let desiredX = HOME.x
    let desiredZ = HOME.z
    let desiredY = HOME_Y
    let wantOpen = true

    switch (state) {
      case 'idle':
        break
      case 'moveToTarget':
        desiredX = targetX
        desiredZ = targetZ
        break
      case 'descend':
        desiredX = targetX
        desiredZ = targetZ
        desiredY = DESCEND_Y
        break
      case 'grip':
        desiredX = targetX
        desiredZ = targetZ
        desiredY = DESCEND_Y
        wantOpen = false
        break
      case 'lift':
        desiredX = targetX
        desiredZ = targetZ
        wantOpen = false
        break
      case 'moveToChute':
        desiredX = CHUTE_TARGET.x
        desiredZ = CHUTE_TARGET.z
        wantOpen = false
        break
      case 'release':
        desiredX = CHUTE_TARGET.x
        desiredZ = CHUTE_TARGET.z
        wantOpen = true
        break
      case 'returnHome':
        wantOpen = true
        break
    }

    const cur = body.translation()
    const smooth = 6
    const newX = THREE.MathUtils.damp(cur.x, desiredX, smooth, delta)
    const newY = THREE.MathUtils.damp(cur.y, desiredY, smooth * 0.7, delta)
    const newZ = THREE.MathUtils.damp(cur.z, desiredZ, smooth, delta)
    body.setNextKinematicTranslation({ x: newX, y: newY, z: newZ })

    // motor targets — left opens +angle, right opens -angle (mirrored)
    const target = wantOpen ? OPEN_ANGLE : CLOSED_ANGLE
    // configureMotorPosition(target, stiffness, damping)
    // Rapier joint API: RevoluteImpulseJoint#configureMotorPosition
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(leftJoint.current as any)?.configureMotorPosition(target, gripStiffness, gripDamping)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(rightJoint.current as any)?.configureMotorPosition(-target, gripStiffness, gripDamping)

    // FSM transitions
    const dxz = Math.hypot(cur.x - desiredX, cur.z - desiredZ)
    const dy = Math.abs(cur.y - desiredY)
    const reachedXZ = dxz < 0.06
    const reachedY = dy < 0.06

    phaseTimer += delta

    const advance = (to: SeqState) => {
      phaseTimer = 0
      useSequenceStore.getState().setState(to)
    }

    if (state === 'moveToTarget' && reachedXZ) advance('descend')
    else if (state === 'descend' && reachedY) advance('grip')
    else if (state === 'grip' && phaseTimer > 0.9) advance('lift')
    else if (state === 'lift' && reachedY) advance('moveToChute')
    else if (state === 'moveToChute' && reachedXZ) advance('release')
    else if (state === 'release' && phaseTimer > 0.7) advance('returnHome')
    else if (state === 'returnHome' && reachedXZ) advance('idle')
  })

  return (
    <>
      {/* Claw body — kinematic, moved by FSM */}
      <RigidBody
        ref={bodyRef}
        type="kinematicPosition"
        position={[HOME.x, HOME_Y, HOME.z]}
        colliders={false}
      >
        <CuboidCollider args={[BODY_HALF.x, BODY_HALF.y, BODY_HALF.z]} />
        <mesh castShadow>
          <boxGeometry args={[BODY_HALF.x * 2, BODY_HALF.y * 2, BODY_HALF.z * 2]} />
          <meshStandardMaterial color="#c0c4cc" metalness={0.6} roughness={0.3} />
        </mesh>
        {/* cable to ceiling — visual only */}
        <mesh position={[0, 3, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 6, 8]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      </RigidBody>

      {/* Left prong */}
      <RigidBody
        ref={leftRef}
        position={[HOME.x - ANCHOR_X, HOME_Y + ANCHOR_Y_ON_BODY - PRONG_HALF_HEIGHT, 0]}
        colliders={false}
        friction={prongFriction}
        linearDamping={0.3}
        angularDamping={0.4}
      >
        <CapsuleCollider args={[PRONG_HALF_HEIGHT, PRONG_RADIUS]} mass={0.2} />
        <mesh castShadow>
          <capsuleGeometry args={[PRONG_RADIUS, PRONG_HALF_HEIGHT * 2, 8, 16]} />
          <meshStandardMaterial color="#9aa0aa" metalness={0.8} roughness={0.2} />
        </mesh>
      </RigidBody>

      {/* Right prong */}
      <RigidBody
        ref={rightRef}
        position={[HOME.x + ANCHOR_X, HOME_Y + ANCHOR_Y_ON_BODY - PRONG_HALF_HEIGHT, 0]}
        colliders={false}
        friction={prongFriction}
        linearDamping={0.3}
        angularDamping={0.4}
      >
        <CapsuleCollider args={[PRONG_HALF_HEIGHT, PRONG_RADIUS]} mass={0.2} />
        <mesh castShadow>
          <capsuleGeometry args={[PRONG_RADIUS, PRONG_HALF_HEIGHT * 2, 8, 16]} />
          <meshStandardMaterial color="#9aa0aa" metalness={0.8} roughness={0.2} />
        </mesh>
      </RigidBody>
    </>
  )
}
