// labs/claw-poc/src/App.tsx
import { Canvas } from '@react-three/fiber'
import { PerspectiveCamera, OrbitControls, Sparkles } from '@react-three/drei'
import { Leva } from 'leva'
import { Scene } from './components/Scene'
import { ControlPanel } from './components/ControlPanel'

const RAINBOW = ['#ff8ec3', '#ffb5a0', '#ffd88a', '#b8e896', '#8ee0e6', '#b8b0ff', '#e8a0f0']

export function App() {
  return (
    <>
      <Leva collapsed hidden />

      {/* pastel background */}
      <div style={pastelBg} aria-hidden />

      {/* sparkle emojis floating (CSS) */}
      <div style={sparkleLayer} aria-hidden>
        <span style={{ ...sparkleItem, top: '18%', left: '8%',  fontSize: 22, animationDelay: '0s' }}>✨</span>
        <span style={{ ...sparkleItem, top: '30%', left: '92%', fontSize: 18, animationDelay: '0.6s' }}>✨</span>
        <span style={{ ...sparkleItem, top: '55%', left: '4%',  fontSize: 16, animationDelay: '1.2s' }}>💖</span>
        <span style={{ ...sparkleItem, top: '65%', left: '95%', fontSize: 24, animationDelay: '0.4s' }}>⭐</span>
        <span style={{ ...sparkleItem, top: '12%', left: '38%', fontSize: 14, animationDelay: '1.5s' }}>✨</span>
        <span style={{ ...sparkleItem, top: '12%', left: '62%', fontSize: 14, animationDelay: '0.8s' }}>✨</span>
        <span style={{ ...sparkleItem, top: '45%', left: '2%',  fontSize: 20, animationDelay: '0.2s' }}>🌈</span>
        <span style={{ ...sparkleItem, top: '78%', left: '10%', fontSize: 18, animationDelay: '1.0s' }}>💫</span>
        <span style={{ ...sparkleItem, top: '82%', left: '88%', fontSize: 18, animationDelay: '1.4s' }}>💫</span>
      </div>

      {/* CATCHING DUCK top banner */}
      <div style={topBanner}>
        <div style={mascot}><div style={{ fontSize: 26 }}>🤖</div></div>
        <div
          style={{
            fontFamily: '"Comic Sans MS", "Nanum Pen Script", cursive, sans-serif',
            fontSize: 40,
            letterSpacing: 3,
            fontWeight: 900,
            background: `linear-gradient(90deg, ${RAINBOW.join(', ')})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 2px 4px rgba(255,180,220,0.7))',
          }}
        >
          CATCHING DUCK
        </div>
        <div style={mascot}><div style={{ fontSize: 26 }}>🦆</div></div>
      </div>

      {/* Instruction strip */}
      <div style={instructionStrip}>
        <span style={{ color: '#ff7ab0' }}>♡</span>
        <span>결제 후&nbsp;</span>
        <span style={{ color: '#ff9dc0', fontSize: 14 }}>▶</span>
        <span>&nbsp;버튼을 누르세요&nbsp;·&nbsp;PRESS ▷ BUTTON AFTER PAYMENT</span>
        <span style={{ color: '#ff7ab0' }}>♡</span>
      </div>

      {/* Bill slot indicator (top-right) */}
      <div style={billSlot}>
        <div style={{ fontSize: 10, letterSpacing: 1 }}>💰 지폐투입구</div>
        <div style={{ width: 60, height: 4, background: '#a86200', marginTop: 3, borderRadius: 2 }} />
      </div>

      {/* Price tag (top-left) */}
      <div style={priceTag}>
        <div style={{ color: '#ff5c8f', fontWeight: 800, fontSize: 13 }}>💗 1,000원 &nbsp; 2 PLAY</div>
        <div style={{ color: '#ff5c8f', fontWeight: 800, fontSize: 13 }}>💗 3,000원 &nbsp; 6 PLAY</div>
        <div style={{ color: '#ff5c8f', fontWeight: 800, fontSize: 13 }}>💗 5,000원 &nbsp; 10 PLAY</div>
        <div style={{ color: '#ff5c8f', fontWeight: 800, fontSize: 13 }}>💗 10,000원 &nbsp; 20 PLAY</div>
        <div
          style={{
            marginTop: 8,
            padding: '5px 10px',
            background: 'linear-gradient(90deg, #ffb0d0, #ffd0e0)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 800,
            borderRadius: 14,
            textAlign: 'center',
            border: '2px solid #fff',
            boxShadow: '0 2px 6px rgba(255,150,190,0.4)',
          }}
        >
          💳 카드결제 OK
        </div>
      </div>

      {/* Keyboard hint */}
      <div style={hint}>← → ↑ ↓ 이동  ·  SPACE / ENTER 로 DROP</div>

      <ControlPanel />

      <Canvas
        shadows
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        style={{ position: 'absolute', inset: 0 }}
      >
        <PerspectiveCamera makeDefault position={[0, 3.0, 9.0]} fov={48} />
        <OrbitControls target={[0, 1.8, 0]} enableRotate={false} enableZoom={false} enablePan={false} />
        <fog attach="fog" args={['#fff0f6', 12, 30]} />

        {/* --- bright kawaii lighting --- */}
        <ambientLight intensity={1.4} color="#fff2f8" />
        <directionalLight
          position={[3, 8, 6]}
          intensity={1.4}
          color="#fff8f0"
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        {/* soft pastel rim */}
        <pointLight position={[-4, 4, 4]}  intensity={2.5} color="#ffb0d0" distance={12} />
        <pointLight position={[4, 4, 4]}   intensity={2.5} color="#b0e0ff" distance={12} />
        <pointLight position={[0, 5, 4]}   intensity={2}   color="#fff5d0" distance={10} />
        {/* holographic interior fill */}
        <pointLight position={[0, 3, -1]}    intensity={2.5} color="#ffd8f0" distance={8} />
        <pointLight position={[-1.5, 2, -1]} intensity={1.8} color="#b0e8ff" distance={7} />
        <pointLight position={[1.5, 2, -1]}  intensity={1.8} color="#ffd8b0" distance={7} />
        {/* overhead brightness */}
        <pointLight position={[0, 4.7, 0]}  intensity={2.8} color="#ffffff" distance={5} />

        {/* Scene incl. cabinet, plush, claw */}
        <Scene />

        {/* Sparkle particles floating in front */}
        <Sparkles count={80} scale={[8, 6, 3]} size={4} speed={0.4} opacity={0.9} color="#ffd0e8" position={[0, 2.5, 2]} />
        <Sparkles count={40} scale={[6, 5, 2]} size={5} speed={0.3} opacity={0.8} color="#fff0a0" position={[0, 3, 3]} />
      </Canvas>

      <style>{`
        @keyframes float {
          0% { transform: translateY(0) rotate(0deg); opacity: 0.7; }
          50% { transform: translateY(-14px) rotate(15deg); opacity: 1; }
          100% { transform: translateY(0) rotate(0deg); opacity: 0.7; }
        }
      `}</style>
    </>
  )
}

const pastelBg: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: -1,
  background: `
    radial-gradient(circle at 20% 20%, #ffe4f0 0%, transparent 40%),
    radial-gradient(circle at 80% 30%, #e0e8ff 0%, transparent 40%),
    radial-gradient(circle at 50% 90%, #fff0d8 0%, transparent 45%),
    linear-gradient(180deg, #ffe8f2 0%, #f0e8ff 50%, #fff5e8 100%)
  `,
}

const sparkleLayer: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2,
  pointerEvents: 'none',
}

const sparkleItem: React.CSSProperties = {
  position: 'absolute',
  animation: 'float 3s ease-in-out infinite',
  filter: 'drop-shadow(0 0 8px rgba(255,200,230,0.8))',
}

const topBanner: React.CSSProperties = {
  position: 'fixed',
  top: 14,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 10,
  padding: '10px 28px',
  background: 'linear-gradient(180deg, #ffffff 0%, #fff0f6 100%)',
  border: '4px solid #ffb0d0',
  borderRadius: 24,
  boxShadow: '0 6px 24px rgba(255,150,200,0.5), inset 0 -3px 0 rgba(255,180,220,0.3)',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
}

const mascot: React.CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: '50%',
  background: 'radial-gradient(circle at 40% 35%, #fff5e0 0%, #ffd66a 60%, #ffb02a 100%)',
  border: '3px solid #fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 3px 10px rgba(255,180,60,0.5)',
}

const instructionStrip: React.CSSProperties = {
  position: 'fixed',
  top: 92,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 10,
  padding: '5px 14px',
  background: 'rgba(255,255,255,0.95)',
  color: '#a04870',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 11,
  fontWeight: 700,
  borderRadius: 20,
  border: '2px solid #ffb0d0',
  letterSpacing: 1,
  display: 'flex',
  gap: 4,
  alignItems: 'center',
  boxShadow: '0 2px 6px rgba(255,150,200,0.3)',
}

const billSlot: React.CSSProperties = {
  position: 'fixed',
  top: 14,
  right: 14,
  zIndex: 10,
  padding: '8px 12px',
  background: 'linear-gradient(180deg, #ffe066 0%, #ffb84d 100%)',
  color: '#7a4a00',
  fontFamily: 'system-ui, sans-serif',
  fontWeight: 800,
  borderRadius: 12,
  border: '3px solid #fff',
  boxShadow: '0 3px 10px rgba(255,180,60,0.5)',
}

const priceTag: React.CSSProperties = {
  position: 'fixed',
  top: 14,
  left: 14,
  zIndex: 10,
  padding: '10px 14px',
  background: 'linear-gradient(180deg, #ffffff 0%, #fff0f6 100%)',
  border: '3px solid #ff9dc0',
  borderRadius: 16,
  lineHeight: 1.6,
  boxShadow: '0 4px 12px rgba(255,150,200,0.4)',
}

const hint: React.CSSProperties = {
  position: 'fixed',
  bottom: 4,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 5,
  fontSize: 10,
  color: '#c88ba8',
  fontFamily: 'system-ui, sans-serif',
  letterSpacing: 1,
}
