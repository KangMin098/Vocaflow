// labs/claw-poc/src/App.tsx
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Leva } from 'leva'
import { Scene } from './components/Scene'
import { ControlPanel } from './components/ControlPanel'

const RAINBOW = ['#ff4d6d', '#ffb84d', '#ffe66d', '#8ce46d', '#4dd0e1', '#7c6df0', '#c86df0']

export function App() {
  return (
    <>
      <Leva collapsed={false} />
      <ControlPanel />

      {/* CATCHING DUCK banner overlay */}
      <div
        style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          padding: '10px 28px',
          background: 'linear-gradient(180deg, #0d0d10 0%, #1a1a20 100%)',
          border: '3px solid #ff3d7f',
          borderRadius: 10,
          boxShadow: '0 0 24px rgba(255,61,127,0.6), inset 0 0 12px rgba(255,120,180,0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: 34,
            letterSpacing: 4,
            fontWeight: 900,
            background: `linear-gradient(90deg, ${RAINBOW.join(', ')})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 8px rgba(255,255,255,0.3)',
            filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.35))',
          }}
        >
          CATCHING DUCK
        </div>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: '50%',
            background: '#f6c700',
            border: '3px solid #fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
          }}
          aria-label="duck"
        >
          🦆
        </div>
      </div>

      {/* Bottom price tag */}
      <div
        style={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          padding: '8px 14px',
          background: '#fff',
          border: '2px solid #d63447',
          borderRadius: 6,
          color: '#d63447',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 12,
          lineHeight: 1.5,
          fontWeight: 700,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
      >
        <div>1,000원 &nbsp; 2 PLAY</div>
        <div>3,000원 &nbsp; 6 PLAY</div>
        <div>5,000원 &nbsp; 10 PLAY</div>
        <div>10,000원 &nbsp; 20 PLAY</div>
      </div>

      {/* Card OK sticker */}
      <div
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 10,
          padding: '6px 12px',
          background: '#ff3d7f',
          color: '#fff',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 800,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        💳 카드결제 OK
      </div>

      <Canvas shadows>
        <color attach="background" args={['#141419']} />
        <PerspectiveCamera makeDefault position={[6.5, 4, 8]} fov={42} />
        <OrbitControls target={[0, 2.2, 0]} maxPolarAngle={Math.PI / 2} />
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[5, 10, 5]}
          intensity={1.1}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        {/* accent lights for neon feel */}
        <pointLight position={[0, 5.5, 3]} intensity={2} color="#ff3d7f" distance={6} />
        <pointLight position={[0, 5.5, -3]} intensity={2} color="#7c6df0" distance={6} />
        <Scene />
      </Canvas>
    </>
  )
}
