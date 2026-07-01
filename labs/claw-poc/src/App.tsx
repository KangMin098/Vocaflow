// labs/claw-poc/src/App.tsx
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Leva } from 'leva'
import { Scene } from './components/Scene'
import { ControlPanel } from './components/ControlPanel'

export function App() {
  return (
    <>
      <Leva collapsed={false} />
      <ControlPanel />
      <Canvas shadows>
        <color attach="background" args={['#181a1f']} />
        <PerspectiveCamera makeDefault position={[6, 5, 8]} fov={45} />
        <OrbitControls target={[0, 2, 0]} maxPolarAngle={Math.PI / 2} />
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[5, 10, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <Scene />
      </Canvas>
    </>
  )
}
