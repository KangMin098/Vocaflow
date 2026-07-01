// labs/claw-poc/src/App.tsx
import { Canvas } from '@react-three/fiber'
import { PerspectiveCamera, OrbitControls } from '@react-three/drei'
import { Leva } from 'leva'
import { Scene } from './components/Scene'
import { ControlPanel } from './components/ControlPanel'

const RAINBOW = ['#ff2d7d', '#ff7a2d', '#ffd82d', '#8be62d', '#2dd6e6', '#7c6df0', '#e02de6']

export function App() {
  return (
    <>
      <Leva collapsed hidden />

      {/* CATCHING DUCK top banner */}
      <div style={topBanner}>
        <div style={duckMascot}>
          <div style={{ position: 'relative', fontSize: 28 }}>🤖</div>
        </div>
        <div
          style={{
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: 40,
            letterSpacing: 4,
            fontWeight: 900,
            background: `linear-gradient(90deg, ${RAINBOW.join(', ')})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.5))',
          }}
        >
          CATCHING DUCK
        </div>
        <div style={duckMascot}>
          <div style={{ fontSize: 28 }}>🦆</div>
        </div>
      </div>

      {/* Instruction strip */}
      <div style={instructionStrip}>
        <span style={{ color: '#f6c700' }}>◀</span>
        <span>결제 후&nbsp;</span>
        <span style={{ color: '#f6c700', fontSize: 14 }}>▶</span>
        <span>&nbsp;버튼을 누르세요&nbsp;·&nbsp;PRESS ▷ BUTTON AFTER PAYMENT</span>
      </div>

      {/* Bill slot indicator (top-right) */}
      <div style={billSlot}>
        <div style={{ fontSize: 10, letterSpacing: 1 }}>지폐투입구</div>
        <div style={{ width: 60, height: 4, background: '#0d0d10', marginTop: 3, borderRadius: 2 }} />
      </div>

      {/* Price tag (top-left) */}
      <div style={priceTag}>
        <div style={{ color: '#d63447', fontWeight: 800, fontSize: 13 }}>1,000원 &nbsp; 2 PLAY</div>
        <div style={{ color: '#d63447', fontWeight: 800, fontSize: 13 }}>3,000원 &nbsp; 6 PLAY</div>
        <div style={{ color: '#d63447', fontWeight: 800, fontSize: 13 }}>5,000원 &nbsp; 10 PLAY</div>
        <div style={{ color: '#d63447', fontWeight: 800, fontSize: 13 }}>10,000원 &nbsp; 20 PLAY</div>
        <div
          style={{
            marginTop: 6,
            padding: '4px 8px',
            background: '#ff2d7d',
            color: '#fff',
            fontSize: 11,
            fontWeight: 800,
            borderRadius: 12,
            textAlign: 'center',
          }}
        >
          💳 카드결제 OK
        </div>
      </div>

      {/* Keyboard hint */}
      <div style={hint}>← → ↑ ↓ 이동  ·  SPACE / ENTER 로 DROP</div>

      <ControlPanel />

      <Canvas shadows>
        <color attach="background" args={['#0a0a10']} />
        <fog attach="fog" args={['#0a0a10', 12, 30]} />
        <PerspectiveCamera makeDefault position={[0, 3.0, 9.0]} fov={48} />
        <OrbitControls target={[0, 1.8, 0]} enableRotate={false} enableZoom={false} enablePan={false} />

        {/* light */}
        <ambientLight intensity={1.1} />
        <directionalLight
          position={[3, 8, 6]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        {/* neon rim lights */}
        <pointLight position={[-3, 4.5, 3]} intensity={3} color="#ff2d7d" distance={10} />
        <pointLight position={[3, 4.5, 3]} intensity={3} color="#ff2d7d" distance={10} />
        <pointLight position={[0, 1.5, 2]} intensity={2.2} color="#ffcf40" distance={7} />
        {/* holographic interior */}
        <pointLight position={[0, 3, -1.5]} intensity={2.2} color="#7c6df0" distance={7} />
        <pointLight position={[-1.5, 2.5, -1.5]} intensity={1.5} color="#2dd6e6" distance={6} />
        <pointLight position={[1.5, 2.5, -1.5]} intensity={1.5} color="#ff7a2d" distance={6} />
        {/* interior overhead */}
        <pointLight position={[0, 4.8, 0]} intensity={2.5} color="#ffffff" distance={5} />

        <Scene />
      </Canvas>
    </>
  )
}

const topBanner: React.CSSProperties = {
  position: 'fixed',
  top: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 10,
  padding: '10px 24px',
  background: 'linear-gradient(180deg, #0d0d10 0%, #1a1a20 100%)',
  border: '3px solid #ff2d7d',
  borderRadius: 12,
  boxShadow: '0 0 28px rgba(255,45,125,0.65), inset 0 0 14px rgba(255,120,180,0.4)',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
}

const duckMascot: React.CSSProperties = {
  width: 50,
  height: 50,
  borderRadius: '50%',
  background: 'radial-gradient(circle at 50% 50%, #ffe066 0%, #ffcf40 60%, #f6a200 100%)',
  border: '3px solid #fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 0 14px rgba(246,199,0,0.7)',
}

const instructionStrip: React.CSSProperties = {
  position: 'fixed',
  top: 92,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 10,
  padding: '4px 12px',
  background: 'rgba(255,255,255,0.95)',
  color: '#111',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 11,
  fontWeight: 700,
  borderRadius: 4,
  border: '1px solid #f6c700',
  letterSpacing: 1,
  display: 'flex',
  gap: 2,
  alignItems: 'center',
}

const billSlot: React.CSSProperties = {
  position: 'fixed',
  top: 16,
  right: 16,
  zIndex: 10,
  padding: '8px 12px',
  background: '#f6c700',
  color: '#0d0d10',
  fontFamily: 'system-ui, sans-serif',
  fontWeight: 800,
  borderRadius: 4,
  border: '2px solid #d63447',
}

const priceTag: React.CSSProperties = {
  position: 'fixed',
  top: 16,
  left: 16,
  zIndex: 10,
  padding: '10px 14px',
  background: '#fff',
  border: '2px solid #d63447',
  borderRadius: 6,
  lineHeight: 1.5,
  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
}

const hint: React.CSSProperties = {
  position: 'fixed',
  bottom: 4,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 5,
  fontSize: 10,
  color: '#666',
  fontFamily: 'system-ui, sans-serif',
  letterSpacing: 1,
}
