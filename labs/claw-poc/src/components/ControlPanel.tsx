// labs/claw-poc/src/components/ControlPanel.tsx
import { useEffect } from 'react'
import { useSequenceStore } from '../hooks/useSequence'

const CAB_LIMIT = 1.6
const STEP = 0.15

export function ControlPanel() {
  const state = useSequenceStore((s) => s.state)
  const start = useSequenceStore((s) => s.start)
  const targetX = useSequenceStore((s) => s.targetX)
  const targetZ = useSequenceStore((s) => s.targetZ)
  const setTarget = useSequenceStore((s) => s.setTarget)

  const disabled = state !== 'idle'

  const nudge = (dx: number, dz: number) => {
    if (disabled) return
    const nx = Math.max(-CAB_LIMIT, Math.min(CAB_LIMIT, targetX + dx))
    const nz = Math.max(-CAB_LIMIT, Math.min(CAB_LIMIT, targetZ + dz))
    setTarget(nx, nz)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') nudge(-STEP, 0)
      else if (e.key === 'ArrowRight') nudge(STEP, 0)
      else if (e.key === 'ArrowUp') nudge(0, -STEP)
      else if (e.key === 'ArrowDown') nudge(0, STEP)
      else if (e.key === ' ' || e.key === 'Enter') start()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 20,
        transform: 'translateX(-50%)',
        zIndex: 10,
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        background: 'linear-gradient(180deg, #ff2d7d 0%, #d61f6a 100%)',
        padding: '10px 22px',
        borderRadius: 14,
        border: '3px solid #0d0d10',
        boxShadow: '0 0 24px rgba(255,45,125,0.7), 0 4px 12px rgba(0,0,0,0.4)',
      }}
    >
      {/* SPACE PLAYER 01 label */}
      <div style={playerLabel}>
        <div style={playerBadge}>01</div>
        <div style={{ fontSize: 11, marginTop: 4, letterSpacing: 1 }}>PLAYER</div>
      </div>

      {/* D-pad */}
      <div style={dpadWrap}>
        <button style={dpadBtn} onClick={() => nudge(0, -STEP)} disabled={disabled} aria-label="up">▲</button>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={dpadBtn} onClick={() => nudge(-STEP, 0)} disabled={disabled} aria-label="left">◀</button>
          <div style={dpadCenter}>
            <div style={{ fontSize: 8, color: '#f6c700', letterSpacing: 1 }}>X: {targetX.toFixed(1)}</div>
            <div style={{ fontSize: 8, color: '#f6c700', letterSpacing: 1 }}>Z: {targetZ.toFixed(1)}</div>
          </div>
          <button style={dpadBtn} onClick={() => nudge(STEP, 0)} disabled={disabled} aria-label="right">▶</button>
        </div>
        <button style={dpadBtn} onClick={() => nudge(0, STEP)} disabled={disabled} aria-label="down">▼</button>
      </div>

      {/* Big DROP button */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <button
          style={{ ...dropBtn, ...(disabled ? { filter: 'grayscale(0.6) brightness(0.6)' } : {}) }}
          onClick={start}
          disabled={disabled}
          aria-label="drop"
        >
          <div style={{ fontSize: 10, letterSpacing: 2 }}>DROP</div>
        </button>
        <div style={{ fontSize: 9, color: '#f6c700', fontWeight: 800, letterSpacing: 1 }}>
          state: {state}
        </div>
      </div>

      {/* SPACE PLAYER 02 label */}
      <div style={playerLabel}>
        <div style={playerBadge}>02</div>
        <div style={{ fontSize: 11, marginTop: 4, letterSpacing: 1 }}>PLAYER</div>
      </div>
    </div>
  )
}

const playerLabel: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  color: '#fff',
  fontFamily: '"Impact", sans-serif',
  fontSize: 22,
  textShadow: '0 0 10px rgba(255,255,255,0.4)',
}

const playerBadge: React.CSSProperties = {
  fontSize: 34,
  fontWeight: 900,
  padding: '4px 10px',
  background: '#0d0d10',
  border: '2px solid #ff2d7d',
  borderRadius: 6,
  color: '#fff',
  minWidth: 44,
  textAlign: 'center',
}

const dpadWrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  padding: 12,
  background: 'rgba(15,15,20,0.9)',
  border: '2px solid #ff2d7d',
  borderRadius: 12,
  boxShadow: '0 0 20px rgba(255,45,125,0.5)',
}

const dpadBtn: React.CSSProperties = {
  width: 42,
  height: 42,
  background: '#2a2f38',
  color: '#f6c700',
  border: '2px solid #4a4f58',
  borderRadius: 6,
  fontSize: 16,
  fontWeight: 800,
  cursor: 'pointer',
  boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.5)',
}

const dpadCenter: React.CSSProperties = {
  width: 42,
  height: 42,
  background: '#0d0d10',
  border: '2px solid #3a3f48',
  borderRadius: 6,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
}

const dropBtn: React.CSSProperties = {
  width: 100,
  height: 100,
  borderRadius: '50%',
  background: 'radial-gradient(circle at 35% 30%, #ffffff 0%, #f4f4f4 50%, #d8d8d8 100%)',
  border: '4px solid #ff2d7d',
  color: '#d63447',
  fontWeight: 900,
  cursor: 'pointer',
  boxShadow: '0 0 24px rgba(255,45,125,0.7), inset 0 -6px 0 rgba(0,0,0,0.15)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
